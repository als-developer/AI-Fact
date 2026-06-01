import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ulid } from 'ulid';
import { FactCheckService } from '../../services/fact-check.service';
import { VerifyRequestSchema } from '../../types/api.types';
import type { Bindings, Variables } from '../../types';

export const verifyHandler = new Hono<{ Bindings: Bindings; Variables: Variables }>();

verifyHandler.post('/sync', zValidator('json', VerifyRequestSchema), async (c) => {
  const startTime = performance.now();
  const body = c.req.valid('json');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const isPremium = c.get('isPremium');
  
  if (body.engine_mode === 'deep' && !isPremium) {
    return c.json({ error: { code: 'PREMIUM_REQUIRED', message: 'Deep verification requires premium subscription' } }, 402);
  }
  
  const factCheckService = new FactCheckService(c.env);
  const result = await factCheckService.verifySync({
    text: body.text, user_id: userId, org_id: orgId,
    engine_mode: body.engine_mode, threshold: body.threshold,
    include_sources: body.include_sources, language: body.language
  });
  
  return c.json({ success: true, data: result, meta: { request_id: c.get('requestId'), processing_time_ms: performance.now() - startTime } });
});

verifyHandler.post('/async', zValidator('json', VerifyRequestSchema), async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const jobId = ulid();
  
  const factCheckService = new FactCheckService(c.env);
  await factCheckService.queueVerification(jobId, {
    text: body.text, user_id: userId, org_id: orgId,
    engine_mode: body.engine_mode, threshold: body.threshold,
    include_sources: body.include_sources, language: body.language,
    callback_url: body.callback_url
  });
  
  return c.json({ success: true, data: { job_id: jobId, status: 'queued', check_url: `/v1/jobs/${jobId}` } });
});

verifyHandler.get('/jobs/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const orgId = c.get('orgId');
  const factCheckService = new FactCheckService(c.env);
  const job = await factCheckService.getJobStatus(jobId);
  
  if (!job) return c.json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } }, 404);
  if (job.org_id !== orgId && !c.get('isPremium')) {
    return c.json({ error: { code: 'ACCESS_DENIED', message: 'Access denied' } }, 403);
  }
  
  return c.json({ success: true, data: job });
});
