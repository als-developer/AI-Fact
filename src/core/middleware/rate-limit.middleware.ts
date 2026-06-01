import type { MiddlewareHandler } from 'hono';
import type { Bindings, Variables } from '../../types';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (c: any) => string;
}

const DEFAULT_KEY_GENERATOR = (c: any) => {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'anonymous';
};

export function rateLimitMiddleware(options: RateLimitOptions): MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> {
  const windowMs = options.windowMs;
  const max = options.max;
  const keyGenerator = options.keyGenerator || DEFAULT_KEY_GENERATOR;
  
  return async (c, next) => {
    const key = keyGenerator(c);
    const cacheKey = `rate_limit:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    try {
      let rateData = await c.env.RATE_LIMIT.get(cacheKey, 'json') as RateLimitData | null;
      
      if (!rateData) {
        rateData = { count: 0, windowStart: now, resetAt: now + windowMs };
      }
      
      if (rateData.windowStart < windowStart) {
        rateData = { count: 0, windowStart: now, resetAt: now + windowMs };
      }
      
      if (rateData.count >= max) {
        const retryAfter = Math.ceil((rateData.resetAt - now) / 1000);
        c.header('X-RateLimit-Limit', String(max));
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', String(Math.ceil(rateData.resetAt / 1000)));
        c.header('Retry-After', String(retryAfter));
        
        return c.json({
          error: { code: 'RATE_LIMIT_EXCEEDED', message: `Too many requests. Limit: ${max} per ${windowMs / 1000} seconds.`, retryAfter }
        }, 429);
      }
      
      rateData.count++;
      const ttl = Math.ceil((rateData.resetAt - now) / 1000);
      await c.env.RATE_LIMIT.put(cacheKey, JSON.stringify(rateData), { expirationTtl: Math.max(1, ttl) });
      
      c.header('X-RateLimit-Limit', String(max));
      c.header('X-RateLimit-Remaining', String(max - rateData.count));
      c.header('X-RateLimit-Reset', String(Math.ceil(rateData.resetAt / 1000)));
      
      c.set('rateLimitRemaining', max - rateData.count);
      c.set('rateLimitReset', rateData.resetAt);
      
      await next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      await next();
    }
  };
}

interface RateLimitData {
  count: number;
  windowStart: number;
  resetAt: number;
}
