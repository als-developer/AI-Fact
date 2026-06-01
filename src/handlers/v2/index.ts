import { Hono } from 'hono';
import type { Bindings, Variables } from '../../types';

export const v2Router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

v2Router.get('/', (c) => {
  return c.json({
    name: 'TruthEngine API v2',
    version: '2.0.0',
    description: 'Advanced features for premium users',
    endpoints: {
      verify: {
        enhanced: 'POST /v2/verify/enhanced',
        batch: 'POST /v2/verify/batch',
      },
      insights: {
        trends: 'GET /v2/insights/trends',
        report: 'GET /v2/insights/report',
      },
    },
  });
});

v2Router.post('/verify/enhanced', async (c) => {
  const isPremium = c.get('isPremium');
  if (!isPremium) {
    return c.json({ error: { code: 'PREMIUM_REQUIRED', message: 'Enhanced verification requires premium subscription' } }, 402);
  }
  
  // Enhanced verification with additional features
  return c.json({ message: 'Enhanced verification endpoint - premium only' });
});

v2Router.post('/verify/batch', async (c) => {
  const isPremium = c.get('isPremium');
  if (!isPremium) {
    return c.json({ error: { code: 'PREMIUM_REQUIRED', message: 'Batch verification requires premium subscription' } }, 402);
  }
  
  return c.json({ message: 'Batch verification endpoint - premium only' });
});

v2Router.get('/insights/trends', async (c) => {
  const orgId = c.get('orgId');
  
  const trends = await c.env.DB.prepare(`
    SELECT date, total_verifications, total_claims, avg_confidence
    FROM usage_stats WHERE org_id = ? ORDER BY date DESC LIMIT 30
  `).bind(orgId).all();
  
  return c.json({ success: true, data: trends.results });
});
