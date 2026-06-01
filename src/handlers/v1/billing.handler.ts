import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { LemonSqueezyClient } from '../../integrations/lemonsqueezy/client';
import type { Bindings, Variables } from '../../types';

export const billingHandler = new Hono<{ Bindings: Bindings; Variables: Variables }>();

billingHandler.get('/subscription', async (c) => {
  const orgId = c.get('orgId');
  
  const subscription = await c.env.DB.prepare(`
    SELECT s.*, o.plan, o.billing_status, o.max_monthly_verifications, o.verifications_used
    FROM organizations o
    LEFT JOIN subscriptions s ON s.org_id = o.id AND s.status = 'active'
    WHERE o.id = ?
  `).bind(orgId).first();
  
  const remainingThisMonth = (subscription?.max_monthly_verifications || 100) - (subscription?.verifications_used || 0);
  
  return c.json({
    success: true,
    data: {
      plan: subscription?.plan || 'free',
      status: subscription?.billing_status || 'active',
      current_period_end: subscription?.current_period_end,
      cancel_at_period_end: subscription?.cancel_at_period_end || false,
      limit: subscription?.max_monthly_verifications || 100,
      used: subscription?.verifications_used || 0,
      remaining: Math.max(0, remainingThisMonth),
      features: getPlanFeatures(subscription?.plan || 'free'),
    }
  });
});

billingHandler.get('/invoices', async (c) => {
  const orgId = c.get('orgId');
  const invoices = await c.env.DB.prepare(`
    SELECT id, amount, currency, status, invoice_url, created_at, paid_at
    FROM invoices WHERE org_id = ? ORDER BY created_at DESC
  `).bind(orgId).all();
  
  return c.json({ success: true, data: invoices.results });
});

billingHandler.post('/create-checkout', zValidator('json', z.object({
  variant_id: z.number(),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
})), async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const body = c.req.valid('json');
  
  const lemonClient = new LemonSqueezyClient(c.env);
  const checkoutUrl = await lemonClient.createCheckout({
    user_id: userId,
    org_id: orgId,
    plan_variant_id: body.variant_id,
    success_url: body.success_url,
    cancel_url: body.cancel_url,
  });
  
  return c.json({ success: true, data: { checkout_url: checkoutUrl } });
});

billingHandler.post('/cancel', async (c) => {
  const orgId = c.get('orgId');
  
  const subscription = await c.env.DB.prepare(`
    SELECT lemon_squeezy_id FROM subscriptions WHERE org_id = ? AND status = 'active'
  `).bind(orgId).first();
  
  if (!subscription) {
    return c.json({ error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription found' } }, 400);
  }
  
  const lemonClient = new LemonSqueezyClient(c.env);
  await lemonClient.cancelSubscription(subscription.lemon_squeezy_id, true);
  
  await c.env.DB.prepare(`
    UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE org_id = ?
  `).bind(Date.now(), orgId).run();
  
  return c.json({ success: true, message: 'Subscription will be cancelled at period end' });
});

billingHandler.get('/portal', async (c) => {
  const orgId = c.get('orgId');
  const subscription = await c.env.DB.prepare(`
    SELECT lemon_squeezy_id FROM subscriptions WHERE org_id = ?
  `).bind(orgId).first();
  
  if (!subscription) {
    return c.json({ error: { code: 'NO_SUBSCRIPTION', message: 'No subscription found' } }, 400);
  }
  
  // Redirect to Lemon Squeezy customer portal
  const portalUrl = `https://app.lemonsqueezy.com/my-orders/${subscription.lemon_squeezy_id}`;
  return c.json({ success: true, data: { portal_url: portalUrl } });
});

function getPlanFeatures(plan: string): string[] {
  const features: Record<string, string[]> = {
    free: ['100 verifications/month', 'Standard verification', 'Basic support', 'Email support'],
    pro: ['1,000 verifications/month', 'Deep verification mode', 'Batch processing (up to 50)', 'Priority support', 'API access'],
    business: ['10,000 verifications/month', 'All verification modes', 'Batch processing (up to 500)', 'Priority support', 'API access', 'Team management (10 seats)', 'Webhook support'],
    enterprise: ['Unlimited verifications', 'All features', 'Custom SLA', 'Dedicated support', 'SSO', 'On-premise deployment'],
  };
  return features[plan] || features.free;
}
