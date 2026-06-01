/**
 * Rate limit configuration
 */

export const RATE_LIMITS = {
  DEFAULT_PER_MINUTE: 20,
  PREMIUM_PER_MINUTE: 100,
  BUSINESS_PER_MINUTE: 500,
  ENTERPRISE_PER_MINUTE: 5000,
  
  // Per endpoint limits
  VERIFY_SYNC: {
    FREE: 10,
    PREMIUM: 50,
    BUSINESS: 200,
    ENTERPRISE: 1000,
  },
  
  VERIFY_ASYNC: {
    FREE: 5,
    PREMIUM: 25,
    BUSINESS: 100,
    ENTERPRISE: 500,
  },
  
  BATCH_VERIFY: {
    FREE: 1,
    PREMIUM: 10,
    BUSINESS: 50,
    ENTERPRISE: 200,
  },
  
  DOCUMENT_UPLOAD: {
    FREE: 5,
    PREMIUM: 20,
    BUSINESS: 100,
    ENTERPRISE: 500,
  },
  
  API_KEY_CREATE: {
    FREE: 3,
    PREMIUM: 10,
    BUSINESS: 50,
    ENTERPRISE: 200,
  },
  
  ORG_INVITE: {
    FREE: 5,
    PREMIUM: 20,
    BUSINESS: 100,
    ENTERPRISE: 500,
  },
};

export const WINDOW_DURATIONS = {
  PER_MINUTE: 60 * 1000,
  PER_HOUR: 60 * 60 * 1000,
  PER_DAY: 24 * 60 * 60 * 1000,
  PER_MONTH: 30 * 24 * 60 * 60 * 1000,
};

export function getRateLimit(plan: string, endpoint: string): number {
  const limits = (RATE_LIMITS as any)[endpoint] || RATE_LIMITS.DEFAULT_PER_MINUTE;
  return limits[plan.toUpperCase()] || limits.FREE || RATE_LIMITS.DEFAULT_PER_MINUTE;
}
