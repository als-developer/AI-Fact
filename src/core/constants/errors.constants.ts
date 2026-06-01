/**
 * Error codes and messages
 */

export const ERROR_CODES = {
  // Auth errors (1000-1999)
  UNAUTHORIZED: { code: 1001, message: 'Unauthorized access' },
  INVALID_TOKEN: { code: 1002, message: 'Invalid or expired token' },
  INVALID_API_KEY: { code: 1003, message: 'Invalid API key' },
  ACCESS_DENIED: { code: 1004, message: 'Access denied' },
  RATE_LIMIT_EXCEEDED: { code: 1005, message: 'Rate limit exceeded' },
  
  // Validation errors (2000-2999)
  INVALID_REQUEST: { code: 2001, message: 'Invalid request' },
  MISSING_FIELD: { code: 2002, message: 'Missing required field' },
  INVALID_TEXT_LENGTH: { code: 2003, message: 'Text length invalid' },
  INVALID_FILE_TYPE: { code: 2004, message: 'Invalid file type' },
  FILE_TOO_LARGE: { code: 2005, message: 'File too large' },
  
  // Resource errors (3000-3999)
  NOT_FOUND: { code: 3001, message: 'Resource not found' },
  ALREADY_EXISTS: { code: 3002, message: 'Resource already exists' },
  INSUFFICIENT_CREDITS: { code: 3003, message: 'Insufficient credits' },
  ORG_INACTIVE: { code: 3004, message: 'Organization inactive' },
  USER_NOT_FOUND: { code: 3005, message: 'User not found' },
  
  // Billing errors (4000-4999)
  PREMIUM_REQUIRED: { code: 4001, message: 'Premium subscription required' },
  PAYMENT_FAILED: { code: 4002, message: 'Payment failed' },
  SUBSCRIPTION_CANCELLED: { code: 4003, message: 'Subscription cancelled' },
  
  // Internal errors (5000-5999)
  INTERNAL_ERROR: { code: 5001, message: 'Internal server error' },
  DATABASE_ERROR: { code: 5002, message: 'Database error' },
  API_ERROR: { code: 5003, message: 'External API error' },
  TIMEOUT: { code: 5004, message: 'Request timeout' },
};

export function getErrorResponse(code: number, details?: string) {
  const error = Object.values(ERROR_CODES).find(e => e.code === code);
  return {
    error: {
      code: error?.code || 5001,
      message: error?.message || 'Unknown error',
      details: details || null,
    },
  };
}
