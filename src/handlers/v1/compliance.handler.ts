import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ulid } from 'ulid';
import type { Bindings, Variables } from '../../types';

const complianceScanSchema = z.object({
  text: z.string().min(10).max(100000),
  rules: z.array(z.string()).optional(),
  include_remediation: z.boolean().default(true),
});

export const complianceHandler = new Hono<{ Bindings: Bindings; Variables: Variables }>();

complianceHandler.post('/scan', zValidator('json', complianceScanSchema), async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const body = c.req.valid('json');
  
  const checkId = ulid();
  
  await c.env.DB.prepare(`
    INSERT INTO compliance_checks (id, org_id, text_preview, status, created_at)
    VALUES (?, ?, ?, 'processing', ?)
  `).bind(checkId, orgId, body.text.slice(0, 500), Date.now()).run();
  
  // Queue for processing
  await c.env.JOB_QUEUE.send({
    type: 'compliance_check',
    compliance_id: checkId,
    text: body.text,
    rules: body.rules,
    include_remediation: body.include_remediation,
    org_id: orgId,
    user_id: userId,
    timestamp: Date.now(),
  });
  
  return c.json({
    success: true,
    data: {
      check_id: checkId,
      status: 'queued',
      check_url: `/v1/compliance/checks/${checkId}`,
    }
  });
});

complianceHandler.get('/checks/:checkId', async (c) => {
  const checkId = c.req.param('checkId');
  const orgId = c.get('orgId');
  
  const result = await c.env.DB.prepare(`
    SELECT id, risk_level, violations, status, created_at
    FROM compliance_checks WHERE id = ? AND org_id = ?
  `).bind(checkId, orgId).first();
  
  if (!result) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Check not found' } }, 404);
  }
  
  return c.json({ success: true, data: result });
});

complianceHandler.get('/rules', async (c) => {
  const rules = {
    pii: ['email', 'phone', 'ssn', 'credit_card', 'passport', 'driver_license'],
    phi: ['medical_record', 'diagnosis', 'treatment', 'prescription', 'insurance_id'],
    financial: ['bank_account', 'routing_number', 'iban', 'swift_code', 'transaction'],
    legal: ['attorney_client_privilege', 'confidential', 'trade_secret', 'nds'],
    toxic: ['hate_speech', 'harassment', 'threat', 'profanity', 'discrimination'],
  };
  
  return c.json({ success: true, data: rules });
});
