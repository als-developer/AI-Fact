/**
 * Real Billing Handler - Production Ready
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { LemonSqueezyRealClient } from '../../integrations/lemonsqueezy/real-client';
import type { Bindings, Variables } from '../../types';

export const realBillingHandler = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Plan variant IDs (Replace with your actual Lemon Squeezy variant IDs)
const PLAN_VARIANTS = {
  PRO_MONTHLY: 123456,
  PRO_YEARLY: 123457,
  BUSINESS_MONTHLY: 123458,
  BUSINESS_YEARLY: 123459,
  ENTERPRISE: 123460,
};

/**
 * Get current subscription
 */
realBillingHandler.get('/subscription', async (c) => {
  const orgId = c.get('orgId');
  
  const subscription = await c.env.DB.prepare(`
    SELECT s.*, o.plan, o.billing_status, o.max_monthly_verifications, o.verifications_used
    FROM organizations o
    LEFT JOIN subscriptions s ON s.org_id = o.id AND s.status = 'active'
    WHERE o.id = ?
  `).bind(orgId).first();
  
  let lemonSubscription = null;
  if (subscription?.lemon_squeezy_id) {
    const client = new LemonSqueezyRealClient(c.env);
    lemonSubscription = await client.getSubscription(subscription.lemon_squeezy_id);
  }
  
  const remaining = (subscription?.max_monthly_verifications || 100) - (subscription?.verifications_used || 0);
  
  return c.json({
    success: true,
    data: {
      plan: subscription?.plan || 'free',
      status: subscription?.billing_status || 'active',
      current_period_end: lemonSubscription?.current_period_end || null,
      cancel_at_period_end: lemonSubscription?.cancel_at_period_end || false,
      limit: subscription?.max_monthly_verifications || 100,
      used: subscription?.verifications_used || 0,
      remaining: Math.max(0, remaining),
    },
  });
});

/**
 * Create checkout for subscription
 */
realBillingHandler.post('/create-checkout', zValidator('json', z.object({
  plan: z.enum(['pro_monthly', 'pro_yearly', 'business_monthly', 'business_yearly', 'enterprise']),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
})), async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const body = c.req.valid('json');
  
  // Get user email for pre-filling
  const user = await c.env.DB.prepare(`
    SELECT email, name FROM users WHERE id = ?
  `).bind(userId).first();
  
  const variantId = PLAN_VARIANTS[body.plan.toUpperCase() as keyof typeof PLAN_VARIANTS];
  if (!variantId) {
    return c.json({ error: { code: 'INVALID_PLAN', message: 'Invalid plan selected' } }, 400);
  }
  
  const client = new LemonSqueezyRealClient(c.env);
  const checkout = await client.createCheckout({
    user_id: userId,
    org_id: orgId,
    plan_variant_id: variantId,
    success_url: body.success_url,
    cancel_url: body.cancel_url,
    email: user?.email,
    name: user?.name,
  });
  
  return c.json({ success: true, data: { checkout_url: checkout.url, checkout_id: checkout.checkout_id } });
});

/**
 * Cancel subscription
 */
realBillingHandler.post('/cancel', async (c) => {
  const orgId = c.get('orgId');
  
  const subscription = await c.env.DB.prepare(`
    SELECT lemon_squeezy_id FROM subscriptions WHERE org_id = ? AND status = 'active'
  `).bind(orgId).first();
  
  if (!subscription) {
    return c.json({ error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription found' } }, 400);
  }
  
  const client = new LemonSqueezyRealClient(c.env);
  await client.cancelSubscription(subscription.lemon_squeezy_id, true);
  
  await c.env.DB.prepare(`
    UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE org_id = ?
  `).bind(Date.now(), orgId).run();
  
  return c.json({ success: true, message: 'Subscription will be cancelled at period end' });
});

/**
 * Get available plans
 */
realBillingHandler.get('/plans', async (c) => {
  const client = new LemonSqueezyRealClient(c.env);
  const plans = await client.getPlans();
  
  return c.json({ success: true, data: plans });
});

/**
 * Get invoices
 */
realBillingHandler.get('/invoices', async (c) => {
  const orgId = c.get('orgId');
  
  const invoices = await c.env.DB.prepare(`
    SELECT id, amount, currency, status, invoice_url, created_at, paid_at
    FROM invoices WHERE org_id = ? ORDER BY created_at DESC LIMIT 50
  `).bind(orgId).all();
  
  return c.json({ success: true, data: invoices.results });
});

/**
 * Get customer portal URL
 */
realBillingHandler.get('/portal', async (c) => {
  const orgId = c.get('orgId');
  
  const subscription = await c.env.DB.prepare(`
    SELECT lemon_squeezy_id FROM subscriptions WHERE org_id = ?
  `).bind(orgId).first();
  
  if (!subscription) {
    return c.json({ error: { code: 'NO_SUBSCRIPTION', message: 'No subscription found' } }, 400);
  }
  
  // Lemon Squeezy customer portal
  const portalUrl = `https://app.lemonsqueezy.com/my-orders/${subscription.lemon_squeezy_id}`;
  
  return c.json({ success: true, data: { portal_url: portalUrl } });
});
