/**
 * Rate limits and quotas
 */

export const RATE_LIMITS = {
  DEFAULT_PER_MINUTE: 20,
  PREMIUM_PER_MINUTE: 100,
  BUSINESS_PER_MINUTE: 500,
  ENTERPRISE_PER_MINUTE: 5000,
  
  VERIFICATION_PER_DAY: {
    FREE: 100,
    PRO: 1000,
    BUSINESS: 10000,
    ENTERPRISE: -1, // Unlimited
  },
  
  DOCUMENT_SIZE_MB: {
    FREE: 10,
    PRO: 50,
    BUSINESS: 100,
    ENTERPRISE: 500,
  },
  
  BATCH_SIZE: {
    FREE: 10,
    PRO: 50,
    BUSINESS: 500,
    ENTERPRISE: 5000,
  },
  
  TEAM_SEATS: {
    FREE: 1,
    PRO: 5,
    BUSINESS: 20,
    ENTERPRISE: -1,
  },
  
  CACHE_TTL: {
    VERIFIED_FACT: 86400, // 24 hours
    SESSION: 604800, // 7 days
    API_RESPONSE: 3600, // 1 hour
    RATE_LIMIT: 60, // 1 minute
  },
};

export const FILE_LIMITS = {
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  ALLOWED_MIME_TYPES: ['application/pdf', 'text/plain', 'text/csv', 'application/json'],
  ALLOWED_EXTENSIONS: ['.pdf', '.txt', '.csv', '.json'],
  MAX_PAGES: 500,
  MAX_FILENAME_LENGTH: 255,
};

export const TEXT_LIMITS = {
  MIN_VERIFICATION_TEXT: 10,
  MAX_VERIFICATION_TEXT: 50000,
  MAX_BATCH_TEXTS: 100,
  MAX_CLAIMS_PER_DOCUMENT: 1000,
  MAX_SENTENCE_LENGTH: 500,
};
