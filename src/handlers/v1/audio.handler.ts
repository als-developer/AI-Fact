import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ulid } from 'ulid';
import type { Bindings, Variables } from '../../types';

const audioAnalysisSchema = z.object({
  audio_url: z.string().url(),
  engine_mode: z.enum(['standard', 'deep']).default('standard'),
});

export const audioHandler = new Hono<{ Bindings: Bindings; Variables: Variables }>();

audioHandler.post('/analyze', zValidator('json', audioAnalysisSchema), async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const body = c.req.valid('json');
  
  const auditId = ulid();
  
  await c.env.DB.prepare(`
    INSERT INTO deepfake_audits (id, org_id, user_id, audio_url, status, created_at)
    VALUES (?, ?, ?, ?, 'processing', ?)
  `).bind(auditId, orgId, userId, body.audio_url, Date.now()).run();
  
  // Queue for processing
  await c.env.JOB_QUEUE.send({
    type: 'audio_analysis',
    audio_id: auditId,
    audio_url: body.audio_url,
    engine_mode: body.engine_mode,
    org_id: orgId,
    user_id: userId,
    timestamp: Date.now(),
  });
  
  return c.json({
    success: true,
    data: {
      audit_id: auditId,
      status: 'queued',
      check_url: `/v1/audio/jobs/${auditId}`,
    }
  });
});

audioHandler.get('/jobs/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const orgId = c.get('orgId');
  
  const result = await c.env.DB.prepare(`
    SELECT id, verdict, confidence, features, processing_time_ms, status, created_at
    FROM deepfake_audits WHERE id = ? AND org_id = ?
  `).bind(jobId, orgId).first();
  
  if (!result) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Job not found' } }, 404);
  }
  
  return c.json({ success: true, data: result });
});
