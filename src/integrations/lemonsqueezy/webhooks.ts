import type { Bindings } from '../../types';

export interface WebhookPayload {
  meta: { event_name: string; custom_data?: { user_id?: string; org_id?: string } };
  data: { type: string; id: string; attributes: any };
}

export class LemonSqueezyWebhookHandler {
  constructor(private env: Bindings) {}

  async process(payload: WebhookPayload, signature: string): Promise<void> {
    if (!this.verifySignature(payload, signature)) throw new Error('Invalid webhook signature');

    const eventName = payload.meta.event_name;
    const customData = payload.meta.custom_data || {};
    const userId = customData.user_id;
    const orgId = customData.org_id;

    console.log(`Processing webhook: ${eventName}`, { userId, orgId });

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
        await this.handleSubscriptionUpdate(payload, userId, orgId);
        break;
      case 'subscription_cancelled':
        await this.handleSubscriptionCancelled(payload, userId, orgId);
        break;
      case 'subscription_expired':
        await this.handleSubscriptionExpired(payload, userId, orgId);
        break;
      case 'order_created':
        await this.handleOrderCreated(payload, userId, orgId);
        break;
      default:
        console.log(`Unhandled webhook event: ${eventName}`);
    }
  }

  private async handleSubscriptionUpdate(payload: WebhookPayload, userId?: string, orgId?: string): Promise<void> {
    const subscriptionId = payload.data.id;
    const attributes = payload.data.attributes;
    const status = attributes.status;
    const variantId = attributes.variant_id;

    let plan = 'free';
    if (variantId === 123456) plan = 'pro';
    if (variantId === 123457) plan = 'business';
    if (variantId === 123458) plan = 'enterprise';

    if (orgId) {
      await this.env.DB.prepare(`UPDATE organizations SET plan = ?, billing_status = ?, updated_at = ? WHERE id = ?`)
        .bind(plan, status, Date.now(), orgId).run();

      await this.env.DB.prepare(`INSERT OR REPLACE INTO subscriptions (id, org_id, lemon_squeezy_id, variant_id, status, current_period_start, current_period_end, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(subscriptionId, orgId, subscriptionId, variantId, status, new Date(attributes.current_period_start).getTime(), new Date(attributes.renews_at || attributes.ends_at).getTime(), Date.now(), Date.now()).run();
    }
  }

  private async handleSubscriptionCancelled(payload: WebhookPayload, userId?: string, orgId?: string): Promise<void> {
    if (orgId) {
      await this.env.DB.prepare(`UPDATE organizations SET billing_status = 'canceled', updated_at = ? WHERE id = ?`)
        .bind(Date.now(), orgId).run();
    }
  }

  private async handleSubscriptionExpired(payload: WebhookPayload, userId?: string, orgId?: string): Promise<void> {
    if (orgId) {
      await this.env.DB.prepare(`UPDATE organizations SET plan = 'free', billing_status = 'expired', updated_at = ? WHERE id = ?`)
        .bind(Date.now(), orgId).run();
    }
  }

  private async handleOrderCreated(payload: WebhookPayload, userId?: string, orgId?: string): Promise<void> {
    const attributes = payload.data.attributes;
    const amount = attributes.total / 100;
    const currency = attributes.currency;

    if (orgId) {
      await this.env.DB.prepare(`INSERT INTO invoices (id, org_id, subscription_id, amount, currency, status, invoice_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(payload.data.id, orgId, attributes.first_subscription_id || null, amount, currency, 'paid', attributes.url, Date.now()).run();
    }
  }

  private verifySignature(payload: WebhookPayload, signature: string): boolean {
    const secret = this.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    if (!secret) return true;
    // In production, implement proper HMAC verification
    return true;
  }
}
