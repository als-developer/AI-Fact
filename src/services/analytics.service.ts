/**
 * Analytics Service
 * Tracks usage metrics and generates insights
 */

import type { Bindings } from '../types';

export interface AnalyticsEvent {
  eventType: string;
  orgId: string;
  userId?: string;
  properties: Record<string, any>;
}

export class AnalyticsService {
  constructor(private env: Bindings) {}

  async track(event: AnalyticsEvent): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO analytics_events (id, org_id, user_id, event_type, properties, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      event.orgId,
      event.userId || null,
      event.eventType,
      JSON.stringify(event.properties),
      Date.now()
    ).run();

    // Also send to Cloudflare Analytics Engine if available
    if (this.env.ANALYTICS) {
      this.env.ANALYTICS.writeDataPoint({
        blobs: [event.eventType, event.orgId],
        doubles: [event.properties.value || 0],
        indexes: [event.eventType],
      });
    }
  }

  async aggregateDaily(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    // Aggregate stats per organization
    const stats = await this.env.DB.prepare(`
      SELECT 
        org_id,
        COUNT(*) as total_verifications,
        SUM(credits_used) as total_credits,
        AVG(overall_score) as avg_score
      FROM verification_jobs
      WHERE date(created_at / 1000, 'unixepoch') = ?
      GROUP BY org_id
    `).bind(dateStr).all();

    for (const stat of stats.results) {
      await this.env.DB.prepare(`
        INSERT INTO usage_stats (id, date, org_id, total_verifications, total_claims, avg_confidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, org_id) DO UPDATE SET
          total_verifications = excluded.total_verifications,
          total_claims = excluded.total_claims,
          avg_confidence = excluded.avg_confidence
      `).bind(
        crypto.randomUUID(),
        dateStr,
        stat.org_id,
        stat.total_verifications,
        stat.total_credits,
        stat.avg_score,
        Date.now()
      ).run();
    }
  }

  async getOrgStats(orgId: string, days: number = 30): Promise<any> {
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    const stats = await this.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_verifications,
        SUM(credits_used) as total_credits,
        AVG(overall_score) as avg_accuracy,
        SUM(CASE WHEN verdict = 'FALSE' THEN 1 ELSE 0 END) as false_claims
      FROM verification_jobs
      WHERE org_id = ? AND created_at > ?
    `).bind(orgId, startDate).first();

    const dailyTrend = await this.env.DB.prepare(`
      SELECT date(created_at / 1000, 'unixepoch') as day, COUNT(*) as count
      FROM verification_jobs
      WHERE org_id = ? AND created_at > ?
      GROUP BY day
      ORDER BY day DESC
      LIMIT 30
    `).bind(orgId, startDate).all();

    return {
      total_verifications: stats?.total_verifications || 0,
      total_credits: stats?.total_credits || 0,
      avg_accuracy: Math.round((stats?.avg_accuracy || 0) * 10) / 10,
      false_claims: stats?.false_claims || 0,
      daily_trend: dailyTrend.results,
    };
  }
}
