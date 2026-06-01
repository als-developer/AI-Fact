import type { Bindings } from '../../types';

export interface CheckoutOptions {
  user_id: string;
  org_id: string;
  plan_variant_id: number;
  success_url?: string;
  cancel_url?: string;
}

export interface SubscriptionData {
  id: string;
  status: 'active' | 'past_due' | 'cancelled' | 'expired';
  current_period_end: number;
  cancel_at_period_end: boolean;
  variant_id: number;
}

export interface InvoiceData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  url: string;
  created_at: string;
}

export class LemonSqueezyClient {
  private apiKey: string;
  private storeId: string;
  private baseUrl = 'https://api.lemonsqueezy.com/v1';

  constructor(private env: Bindings) {
    this.apiKey = env.LEMON_SQUEEZY_API_KEY;
    this.storeId = env.LEMON_SQUEEZY_STORE_ID;
  }

  async createCheckout(options: CheckoutOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/checkouts`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            store_id: parseInt(this.storeId),
            variant_id: options.plan_variant_id,
            checkout_data: {
              custom: { user_id: options.user_id, org_id: options.org_id },
            },
            success_url: options.success_url || 'https://truthengine.ai/dashboard?checkout=success',
            cancel_url: options.cancel_url || 'https://truthengine.ai/pricing',
          },
        },
      }),
    });

    if (!response.ok) throw new Error(`Lemon Squeezy checkout failed: ${response.status}`);
    const data = await response.json();
    return data.data.attributes.url;
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionData | null> {
    const response = await fetch(`${this.baseUrl}/subscriptions/${subscriptionId}`, {
      headers: { 'Accept': 'application/vnd.api+json', 'Authorization': `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to get subscription: ${response.status}`);
    }
    const data = await response.json();
    const attrs = data.data.attributes;
    return {
      id: data.data.id,
      status: attrs.status,
      current_period_end: new Date(attrs.renews_at).getTime(),
      cancel_at_period_end: attrs.cancelled,
      variant_id: attrs.variant_id,
    };
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = true): Promise<void> {
    const response = await fetch(`${this.baseUrl}/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: { 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        data: { type: 'subscriptions', id: subscriptionId, attributes: { cancelled: atPeriodEnd } },
      }),
    });
    if (!response.ok) throw new Error(`Failed to cancel subscription: ${response.status}`);
  }

  async listInvoices(orgId: string): Promise<InvoiceData[]> {
    const response = await fetch(`${this.baseUrl}/invoices?filter[store_id]=${this.storeId}`, {
      headers: { 'Accept': 'application/vnd.api+json', 'Authorization': `Bearer ${this.apiKey}` },
    });
    if (!response.ok) throw new Error(`Failed to list invoices: ${response.status}`);
    const data = await response.json();
    return data.data.map((item: any) => ({
      id: item.id,
      amount: item.attributes.total / 100,
      currency: item.attributes.currency,
      status: item.attributes.status,
      url: item.attributes.url,
      created_at: item.attributes.created_at,
    }));
  }

  async getPlans(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/variants?filter[store_id]=${this.storeId}`, {
      headers: { 'Accept': 'application/vnd.api+json', 'Authorization': `Bearer ${this.apiKey}` },
    });
    if (!response.ok) throw new Error(`Failed to get plans: ${response.status}`);
    const data = await response.json();
    return data.data.map((item: any) => ({
      id: item.id,
      name: item.attributes.name,
      price: item.attributes.price / 100,
      interval: item.attributes.interval,
      variant_id: parseInt(item.id),
    }));
  }
}
