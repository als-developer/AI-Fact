import type { Bindings } from '../types';
import { FactCheckService } from '../services/fact-check.service';
import { DocumentProcessorService } from '../services/document-processor.service';
import { AudioAnalysisService } from '../services/audio-analysis.service';
import { ComplianceService } from '../services/compliance.service';

export interface QueueMessage {
  type: 'verification' | 'document_processing' | 'audio_analysis' | 'compliance_check' | 'webhook_delivery';
  job_id?: string;
  document_id?: string;
  audio_id?: string;
  compliance_id?: string;
  webhook_id?: string;
  request?: any;
  timestamp: number;
}

export class QueueHandler {
  constructor(private env: Bindings) {}

  async process(message: QueueMessage): Promise<void> {
    console.log(`Processing queue message: ${message.type}`, { job_id: message.job_id });
    const startTime = Date.now();

    try {
      switch (message.type) {
        case 'verification':
          await this.processVerification(message);
          break;
        case 'document_processing':
          await this.processDocument(message);
          break;
        case 'audio_analysis':
          await this.processAudio(message);
          break;
        case 'compliance_check':
          await this.processCompliance(message);
          break;
        case 'webhook_delivery':
          await this.processWebhook(message);
          break;
        default:
          console.warn(`Unknown message type: ${(message as any).type}`);
      }
      console.log(`Processed ${message.type} in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error(`Failed to process ${message.type}:`, error);
      throw error;
    }
  }

  private async processVerification(message: QueueMessage): Promise<void> {
    const { job_id, request } = message;
    await this.env.DB.prepare(`UPDATE verification_jobs SET status = 'processing', started_at = ? WHERE id = ?`)
      .bind(Date.now(), job_id).run();

    const factCheckService = new FactCheckService(this.env);
    const result = await factCheckService.verifySync(request);

    await this.env.DB.prepare(`UPDATE verification_jobs SET status = 'completed', overall_score = ?, verdict = ?, summary = ?, results = ?, completed_at = ? WHERE id = ?`)
      .bind(result.overall_score, result.verdict, JSON.stringify(result.summary), JSON.stringify(result.claims), Date.now(), job_id).run();

    if (request.callback_url) {
      await this.sendWebhook(request.callback_url, { event: 'verification.completed', job_id, result });
    }
  }

  private async processDocument(message: QueueMessage): Promise<void> {
    const { document_id, storage_path, org_id, user_id } = message;
    await this.env.DB.prepare(`UPDATE documents SET status = 'processing' WHERE id = ?`).bind(document_id).run();

    const file = await this.env.DOCUMENTS.get(storage_path);
    if (!file) throw new Error(`File not found: ${storage_path}`);

    const fileBuffer = await file.arrayBuffer();
    const fileText = await this.extractText(fileBuffer, file.httpMetadata?.contentType || '');

    const factCheckService = new FactCheckService(this.env);
    const jobId = await this.queueVerificationWithText(fileText, org_id, user_id);

    await this.env.DB.prepare(`INSERT INTO document_jobs (document_id, job_id) VALUES (?, ?)`).bind(document_id, jobId).run();
    await this.env.DB.prepare(`UPDATE documents SET status = 'completed', processed_at = ? WHERE id = ?`).bind(Date.now(), document_id).run();
  }

  private async processAudio(message: QueueMessage): Promise<void> {
    const { audio_id } = message;
    const audioService = new AudioAnalysisService(this.env);
    const result = await audioService.analyze(audio_id);

    await this.env.DB.prepare(`UPDATE deepfake_audits SET verdict = ?, confidence = ?, features = ?, processing_time_ms = ? WHERE id = ?`)
      .bind(result.verdict, result.confidence, JSON.stringify(result.features), result.processing_time_ms, audio_id).run();
  }

  private async processCompliance(message: QueueMessage): Promise<void> {
    const { compliance_id } = message;
    const complianceService = new ComplianceService(this.env);
    const result = await complianceService.scan(compliance_id);

    await this.env.DB.prepare(`UPDATE compliance_checks SET risk_level = ?, violations = ? WHERE id = ?`)
      .bind(result.risk_level, JSON.stringify(result.violations), compliance_id).run();
  }

  private async processWebhook(message: QueueMessage): Promise<void> {
    const { webhook_id } = message;
    const webhook = await this.env.DB.prepare(`SELECT * FROM webhook_events WHERE id = ?`).bind(webhook_id).first();

    if (!webhook) { console.error(`Webhook not found: ${webhook_id}`); return; }

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': this.generateSignature(webhook.payload, webhook.secret) },
        body: JSON.stringify(webhook.payload),
      });

      if (response.ok) {
        await this.env.DB.prepare(`UPDATE webhook_events SET status = 'delivered', delivered_at = ? WHERE id = ?`).bind(Date.now(), webhook_id).run();
      } else {
        throw new Error(`Webhook failed with status ${response.status}`);
      }
    } catch (error) {
      const retryCount = webhook.retry_count + 1;
      const maxRetries = webhook.max_retries || 3;

      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        await this.env.JOB_QUEUE.send({ type: 'webhook_delivery', webhook_id, timestamp: Date.now() + delay }, { delaySeconds: delay / 1000 });
        await this.env.DB.prepare(`UPDATE webhook_events SET status = 'retrying', retry_count = ?, last_error = ? WHERE id = ?`)
          .bind(retryCount, String(error), webhook_id).run();
      } else {
        await this.env.DB.prepare(`UPDATE webhook_events SET status = 'failed', last_error = ? WHERE id = ?`).bind(String(error), webhook_id).run();
      }
    }
  }

  private async extractText(buffer: ArrayBuffer, mimeType: string): Promise<string> {
    if (mimeType === 'text/plain') return new TextDecoder().decode(buffer);
    if (mimeType === 'application/pdf') return '[PDF content extracted]';
    return '';
  }

  private generateSignature(payload: any, secret: string): string {
    return 'sha256=signature_placeholder';
  }

  private async sendWebhook(url: string, payload: any): Promise<void> {
    const webhookId = crypto.randomUUID();
    await this.env.WEBHOOK_QUEUE.send({ type: 'webhook_delivery', webhook_id: webhookId, url, payload, timestamp: Date.now() });
  }

  private async queueVerificationWithText(text: string, orgId: string, userId: string): Promise<string> {
    const jobId = crypto.randomUUID();
    await this.env.JOB_QUEUE.send({ type: 'verification', job_id: jobId, request: { text, user_id: userId, org_id: orgId }, timestamp: Date.now() });
    return jobId;
  }
}
