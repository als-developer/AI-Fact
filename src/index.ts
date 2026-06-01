/**
 * TruthEngine Ultimate - Sovereign AI Fact-Checking Platform
 * Cloudflare Worker Entry Point
 * Version: 3.0.0 | Tier-0 Enterprise Ready
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger } from 'hono/logger';
import { compress } from 'hono/compress';
import { etag } from 'hono/etag';
import { timeout } from 'hono/timeout';

import { v1Router } from './handlers/v1';
import { v2Router } from './handlers/v2';
import { errorHandler, notFoundHandler } from './core/middleware/error-handler.middleware';
import { authMiddleware, optionalAuthMiddleware } from './core/middleware/auth.middleware';
import { rateLimitMiddleware } from './core/middleware/rate-limit.middleware';
import { cacheMiddleware } from './core/middleware/cache.middleware';
import { loggingMiddleware } from './core/middleware/logging.middleware';
import { securityHeadersMiddleware } from './core/middleware/security-headers.middleware';
import { requestIdMiddleware } from './core/middleware/request-id.middleware';
import { ENV, getConfig } from './config/environment';
import { RATE_LIMITS } from './config/rate-limits';
import { HealthService } from './services/health.service';
import { CleanupWorker } from './workers/cleanup-worker';
import { QueueHandler } from './workers/queue-worker';
import { AnalyticsService } from './services/analytics.service';
import { KeyRotationService } from './services/key-rotation.service';
import { WebhookService } from './services/webhook.service';

import type { Bindings, Variables } from './types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================
// GLOBAL MIDDLEWARE PIPELINE
// ============================================

app.use('*', requestIdMiddleware);
app.use('*', loggingMiddleware);
app.use('*', compress({ encoding: 'gzip', threshold: 1024 }));
app.use('*', etag());
app.use('*', securityHeadersMiddleware);
app.use('*', secureHeaders());

app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = ENV.CORS_ORIGINS?.split(',') || [
      'https://chat.openai.com', 'https://chatgpt.com',
      'https://claude.ai', 'https://gemini.google.com',
      'https://truthengine.ai', 'https://*.truthengine.ai',
    ];
    if (!origin) return allowedOrigins[0];
    if (allowedOrigins.includes(origin)) return origin;
    return allowedOrigins[0];
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-User-Id', 'X-Org-Id', 'X-Request-ID'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Request-ID'],
  maxAge: 86400,
  credentials: true,
}));

app.use('*', timeout(30000));
app.use('/v1/verify/async', timeout(120000));
app.use('/v2/batch/*', timeout(180000));

app.use('/v1/*', rateLimitMiddleware({
  windowMs: 60 * 1000,
  max: RATE_LIMITS.DEFAULT_PER_MINUTE,
  keyGenerator: (c) => c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'anonymous',
}));

app.use('/v2/*', rateLimitMiddleware({
  windowMs: 60 * 1000,
  max: RATE_LIMITS.PREMIUM_PER_MINUTE,
  keyGenerator: (c) => c.req.header('X-API-Key') || c.req.header('CF-Connecting-IP') || 'anonymous',
}));

// ============================================
// PUBLIC ENDPOINTS
// ============================================

app.get('/health', async (c) => {
  const healthService = new HealthService(c.env);
  const status = await healthService.check();
  return c.json({
    status: status.healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    environment: ENV.ENVIRONMENT,
    uptime: performance.now(),
    checks: status.checks,
  }, status.healthy ? 200 : 503);
});

app.get('/ready', async (c) => {
  const db = c.env.DB;
  try {
    await db.prepare('SELECT 1').run();
    return c.json({ ready: true, database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    return c.json({ ready: false, database: 'disconnected', error: String(error) }, 503);
  }
});

app.get('/live', (c) => c.json({ alive: true, timestamp: new Date().toISOString() }));

app.get('/', (c) => c.json({
  name: 'TruthEngine Ultimate', version: '3.0.0',
  description: 'Sovereign AI Fact-Checking Platform',
  documentation: 'https://docs.truthengine.ai',
  status: 'operational',
  endpoints: { health: '/health', v1: '/v1', v2: '/v2', docs: '/docs' },
}));

app.get('/docs', (c) => c.redirect('https://docs.truthengine.ai'));

app.get('/openapi.json', async (c) => {
  return c.json({
    openapi: '3.0.0',
    info: {
      title: 'TruthEngine Ultimate API',
      description: 'Enterprise-grade AI fact-checking and verification platform',
      version: '3.0.0',
      contact: { name: 'TruthEngine Support', email: 'support@truthengine.ai' },
    },
    servers: [
      { url: 'https://api.truthengine.ai', description: 'Production' },
      { url: 'https://staging.truthengine.ai', description: 'Staging' },
      { url: 'http://localhost:8787', description: 'Local Development' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
    },
    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
    paths: {},
  });
});

// ============================================
// API VERSION ROUTERS
// ============================================

app.route('/v1', authMiddleware, v1Router);
app.route('/v2', optionalAuthMiddleware, v2Router);

// ============================================
// ERROR HANDLING
// ============================================

app.onError(errorHandler);
app.notFound(notFoundHandler);

// ============================================
// EXPORTS
// ============================================

export default {
  fetch: app.fetch,
  
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;
    try {
      if (cron === '0 */6 * * *') {
        const cleanupWorker = new CleanupWorker(env);
        ctx.waitUntil(cleanupWorker.run());
      } else if (cron === '0 0 * * *') {
        const analyticsService = new AnalyticsService(env);
        ctx.waitUntil(analyticsService.aggregateDaily());
        const keyRotationService = new KeyRotationService(env);
        ctx.waitUntil(keyRotationService.rotateExpiringKeys());
      } else if (cron === '*/15 * * * *') {
        const webhookService = new WebhookService(env);
        ctx.waitUntil(webhookService.processRetries());
      }
    } catch (error) {
      console.error(`Scheduled task failed for cron ${cron}:`, error);
    }
  },
  
  async queue(batch: MessageBatch, env: Bindings): Promise<void> {
    const queueHandler = new QueueHandler(env);
    for (const message of batch.messages) {
      try {
        await queueHandler.process(message);
      } catch (error) {
        console.error(`Failed to process message ${message.id}:`, error);
        if (message.attempts < 3) {
          message.retry({ delaySeconds: Math.pow(2, message.attempts) * 5 });
        }
      }
    }
  },
};
