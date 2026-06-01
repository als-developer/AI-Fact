import type { Bindings } from '../types';

export class CleanupWorker {
  constructor(private env: Bindings) {}

  async run(): Promise<void> {
    console.log('Starting cleanup worker...');
    const startTime = Date.now();
    let cleanedCount = 0;

    try {
      const sessionsCleaned = await this.cleanSessions(7);
      cleanedCount += sessionsCleaned;
      console.log(`Cleaned ${sessionsCleaned} expired sessions`);

      const jobsCleaned = await this.cleanJobs(30);
      cleanedCount += jobsCleaned;
      console.log(`Cleaned ${jobsCleaned} old jobs`);

      const factsCleaned = await this.cleanFacts(90);
      cleanedCount += factsCleaned;
      console.log(`Cleaned ${factsCleaned} old facts`);

      const keysCleaned = await this.cleanApiKeys();
      cleanedCount += keysCleaned;
      console.log(`Cleaned ${keysCleaned} expired API keys`);

      const analyticsCleaned = await this.cleanAnalytics(30);
      cleanedCount += analyticsCleaned;
      console.log(`Cleaned ${analyticsCleaned} old analytics events`);

      console.log(`Cleanup completed in ${Date.now() - startTime}ms, cleaned ${cleanedCount} items`);
      await this.recordMetrics(cleanedCount, Date.now() - startTime);
    } catch (error) {
      console.error('Cleanup worker failed:', error);
    }
  }

  private async cleanSessions(maxAgeDays: number): Promise<number> {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const result = await this.env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?`).bind(cutoff).run();
    return result.meta?.changes || 0;
  }

  private async cleanJobs(maxAgeDays: number): Promise<number> {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const result = await this.env.DB.prepare(`DELETE FROM verification_jobs WHERE status IN ('completed', 'failed', 'cancelled') AND completed_at < ?`).bind(cutoff).run();
    return result.meta?.changes || 0;
  }

  private async cleanFacts(maxAgeDays: number): Promise<number> {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const result = await this.env.DB.prepare(`DELETE FROM verified_facts WHERE last_verified_at < ?`).bind(cutoff).run();
    return result.meta?.changes || 0;
  }

  private async cleanApiKeys(): Promise<number> {
    const result = await this.env.DB.prepare(`DELETE FROM api_keys WHERE expires_at IS NOT NULL AND expires_at < ?`).bind(Date.now()).run();
    return result.meta?.changes || 0;
  }

  private async cleanAnalytics(maxAgeDays: number): Promise<number> {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const result = await this.env.DB.prepare(`DELETE FROM analytics_events WHERE created_at < ?`).bind(cutoff).run();
    return result.meta?.changes || 0;
  }

  private async recordMetrics(cleanedCount: number, duration: number): Promise<void> {
    await this.env.DB.prepare(`INSERT INTO analytics_events (id, org_id, event_type, properties, created_at) VALUES (?, 'system', 'cleanup.completed', ?, ?)`)
      .bind(crypto.randomUUID(), JSON.stringify({ cleanedCount, durationMs: duration }), Date.now()).run();
  }
}
