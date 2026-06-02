import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ulid } from 'ulid';
import type { Bindings, Variables } from '../../types';
import { LemonSqueezyWebhookHandler } from '../../integrations/lemonsqueezy/webhooks';

export const webhookHandler = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const webhookConfigSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()),
  secret: z.string().optional(),
});

webhookHandler.get('/', async (c) => {
  const orgId = c.get('orgId');
  const webhooks = await c.env.DB.prepare(`
    SELECT id, url, event_type, status, created_at, delivered_at
    FROM webhook_events WHERE org_id = ? GROUP BY url
  `).bind(orgId).all();
  
  return c.json({ success: true, data: webhooks.results });
});

webhookHandler.post('/', zValidator('json', webhookConfigSchema), async (c) => {
  const orgId = c.get('orgId');
  const body = c.req.valid('json');
  
  // Store webhook configuration
  const webhookId = ulid();
  await c.env.DB.prepare(`
    INSERT INTO webhook_events (id, org_id, url, secret, event_type, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'configured', ?)
  `).bind(webhookId, orgId, body.url, body.secret || null, JSON.stringify(body.events), Date.now()).run();
  
  return c.json({ success: true, data: { id: webhookId, url: body.url, events: body.events } });
});

webhookHandler.delete('/:webhookId', async (c) => {
  const orgId = c.get('orgId');
  const webhookId = c.req.param('webhookId');
  
  await c.env.DB.prepare(`DELETE FROM webhook_events WHERE id = ? AND org_id = ?`).bind(webhookId, orgId).run();
  
  return c.json({ success: true, message: 'Webhook deleted' });
});

// Lemon Squeezy webhook endpoint (no auth, signature verified)
webhookHandler.post('/lemonsqueezy', async (c) => {
  const signature = c.req.header('X-Signature') || '';
  const payload = await c.req.json();
  
  const handler = new LemonSqueezyWebhookHandler(c.env);
  await handler.process(payload, signature);
  
  return c.json({ success: true });
});

// Test webhook
webhookHandler.post('/test', zValidator('json', z.object({ url: z.string().url(), payload: z.any() })), async (c) => {
  const body = c.req.valid('json');
  
  try {
    const response = await fetch(body.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body.payload),
    });
    
    return c.json({ success: response.ok, status: response.status });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});




/**
 * Lemon Squeezy webhook endpoint (no auth, signature verified)
 * Add this to your existing webhook.handler.ts
 */

import { LemonSqueezyRealWebhookHandler } from '../../integrations/lemonsqueezy/real-webhook';

// Add this endpoint to your webhook handler
webhookHandler.post('/lemonsqueezy', async (c) => {
  const signature = c.req.header('X-Signature') || '';
  const payload = await c.req.json();
  
  try {
    const handler = new LemonSqueezyRealWebhookHandler(c.env);
    await handler.process(payload, signature);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});
