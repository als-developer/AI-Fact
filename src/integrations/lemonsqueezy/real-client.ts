/**
 * Lemon Squeezy Client - REAL PRODUCTION INTEGRATION
 * Handles subscription billing and payment processing
 */

import type { Bindings } from '../../types';

export interface CreateCheckoutOptions {
  user_id: string;
  org_id: string;
  plan_variant_id: number;
  success_url?: string;
  cancel_url?: string;
  email?: string;
  name?: string;
}

export interface SubscriptionResponse {
  id: string;
  status: 'active' | 'past_due' | 'cancelled' | 'expired' | 'on_trial';
  current_period_end: number;
  current_period_start: number;
  cancel_at_period_end: boolean;
  variant_id: number;
  product_name: string;
  product_price: number;
  currency: string;
}

export interface CheckoutResponse {
  url: string;
  checkout_id: string;
}

export class LemonSqueezyRealClient {
  private apiKey: string;
  private storeId: string;
  private baseUrl = 'https://api.lemonsqueezy.com/v1';

  constructor(private env: Bindings) {
    this.apiKey = env.LEMON_SQUEEZY_API_KEY;
    this.storeId = env.LEMON_SQUEEZY_STORE_ID;
  }

  /**
   * Create a real checkout URL for subscription
   */
  async createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResponse> {
    if (!this.apiKey || !this.storeId) {
      throw new Error('LEMON_SQUEEZY_API_KEY or STORE_ID not configured');
    }

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
            custom_price: null,
            checkout_data: {
              email: options.email || null,
              name: options.name || null,
              custom: {
                user_id: options.user_id,
                org_id: options.org_id,
              },
            },
            success_url: options.success_url || 'https://truthengine.ai/dashboard?checkout=success',
            cancel_url: options.cancel_url || 'https://truthengine.ai/pricing',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Lemon Squeezy checkout failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      url: data.data.attributes.url,
      checkout_id: data.data.id,
    };
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<SubscriptionResponse | null> {
    const response = await fetch(`${this.baseUrl}/subscriptions/${subscriptionId}`, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to get subscription: ${response.status}`);

    const data = await response.json();
    const attrs = data.data.attributes;
    const variantAttrs = attrs.variant?.attributes || {};

    return {
      id: data.data.id,
      status: attrs.status,
      current_period_start: new Date(attrs.current_period_start).getTime(),
      current_period_end: new Date(attrs.renews_at || attrs.ends_at).getTime(),
      cancel_at_period_end: attrs.cancel_at_period_end || false,
      variant_id: attrs.variant_id,
      product_name: variantAttrs.name || 'Subscription',
      product_price: variantAttrs.price / 100 || 0,
      currency: variantAttrs.currency || 'USD',
    };
  }

  /**
   * Get customer's active subscription by organization ID
   */
  async getActiveSubscriptionByOrgId(orgId: string): Promise<SubscriptionResponse | null> {
    // First get from our database
    const result = await (this.env as any).DB.prepare(`
      SELECT lemon_squeezy_id FROM subscriptions WHERE org_id = ? AND status = 'active'
    `).bind(orgId).first();

    if (!result) return null;

    return this.getSubscription(result.lemon_squeezy_id);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = true): Promise<void> {
    const response = await fetch(`${this.baseUrl}/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'subscriptions',
          id: subscriptionId,
          attributes: {
            cancel_at_period_end: atPeriodEnd,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel subscription: ${response.status}`);
    }
  }

  /**
   * Get all available plans
   */
  async getPlans(): Promise<Array<{
    id: number;
    name: string;
    description: string;
    price: number;
    interval: 'month' | 'year';
    features: string[];
    variant_id: number;
  }>> {
    const response = await fetch(`${this.baseUrl}/variants?filter[store_id]=${this.storeId}`, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) throw new Error(`Failed to get plans: ${response.status}`);

    const data = await response.json();
    
    return data.data.map((item: any) => {
      const attrs = item.attributes;
      return {
        id: parseInt(item.id),
        name: attrs.name,
        description: attrs.description || '',
        price: attrs.price / 100,
        interval: attrs.interval === 'month' ? 'month' : 'year',
        variant_id: parseInt(item.id),
        features: this.getPlanFeatures(attrs.name),
      };
    });
  }

  private getPlanFeatures(planName: string): string[] {
    const features: Record<string, string[]> = {
      'Pro Monthly': [
        '✓ 1,000 verifications/month',
        '✓ Deep verification mode',
        '✓ Batch processing (up to 50 items)',
        '✓ Priority email support',
        '✓ API access',
      ],
      'Pro Yearly': [
        '✓ 1,000 verifications/month',
        '✓ Deep verification mode',
        '✓ Batch processing (up to 50 items)',
        '✓ Priority email support',
        '✓ API access',
        '✓ 2 months free',
      ],
      'Business Monthly': [
        '✓ 10,000 verifications/month',
        '✓ All verification modes',
        '✓ Batch processing (up to 500 items)',
        '✓ Priority support',
        '✓ API access with higher limits',
        '✓ Team management (up to 10 seats)',
        '✓ Webhook support',
      ],
      'Business Yearly': [
        '✓ 10,000 verifications/month',
        '✓ All verification modes',
        '✓ Batch processing (up to 500 items)',
        '✓ Priority support',
        '✓ API access with higher limits',
        '✓ Team management (up to 10 seats)',
        '✓ Webhook support',
        '✓ 2 months free',
      ],
      'Enterprise': [
        '✓ Unlimited verifications',
        '✓ All features',
        '✓ Custom SLA',
        '✓ Dedicated support',
        '✓ SSO & SAML',
        '✓ On-premise deployment',
        '✓ 24/7 phone support',
      ],
    };
    
    return features[planName] || ['✓ Standard verification', '✓ Basic support'];
  }
}
