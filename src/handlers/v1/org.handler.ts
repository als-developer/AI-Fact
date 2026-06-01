import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ulid } from 'ulid';
import { hashPassword } from '../../core/utils/crypto.utils';
import type { Bindings, Variables } from '../../types';

export const orgHandler = new Hono<{ Bindings: Bindings; Variables: Variables }>();

orgHandler.get('/', async (c) => {
  const orgId = c.get('orgId');
  const org = await c.env.DB.prepare(`SELECT id, name, slug, billing_status, plan, max_monthly_verifications, verifications_used, max_monthly_seats, seats_used, settings, created_at FROM organizations WHERE id = ?`).bind(orgId).first();
  return c.json({ success: true, data: org });
});

orgHandler.patch('/', zValidator('json', z.object({ name: z.string().optional(), settings: z.any().optional() })), async (c) => {
  const orgId = c.get('orgId');
  const body = c.req.valid('json');
  if (body.name) await c.env.DB.prepare(`UPDATE organizations SET name = ?, updated_at = ? WHERE id = ?`).bind(body.name, Date.now(), orgId).run();
  if (body.settings) await c.env.DB.prepare(`UPDATE organizations SET settings = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(body.settings), Date.now(), orgId).run();
  return c.json({ success: true, message: 'Organization updated' });
});

orgHandler.get('/members', async (c) => {
  const orgId = c.get('orgId');
  const members = await c.env.DB.prepare(`SELECT id, email, name, role, created_at, last_active_at FROM users WHERE org_id = ? ORDER BY role DESC, created_at ASC`).bind(orgId).all();
  return c.json({ success: true, data: members.results });
});

orgHandler.post('/invite', zValidator('json', z.object({ email: z.string().email(), role: z.enum(['admin', 'member']) })), async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE org_id = ? AND email = ?`).bind(orgId, body.email).first();
  if (existing) return c.json({ error: { code: 'USER_EXISTS', message: 'User already in organization' } }, 400);

  const newUserId = ulid();
  await c.env.DB.prepare(`INSERT INTO users (id, org_id, email, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(newUserId, orgId, body.email, body.email.split('@')[0], body.role, Date.now(), Date.now()).run();

  await c.env.DB.prepare(`UPDATE organizations SET seats_used = seats_used + 1 WHERE id = ?`).bind(orgId).run();

  return c.json({ success: true, data: { user_id: newUserId, email: body.email, role: body.role } });
});

orgHandler.delete('/members/:userId', async (c) => {
  const orgId = c.get('orgId');
  const memberId = c.req.param('userId');
  const currentUserId = c.get('userId');

  if (memberId === currentUserId) return c.json({ error: { code: 'CANNOT_REMOVE_SELF', message: 'Cannot remove yourself' } }, 400);

  await c.env.DB.prepare(`DELETE FROM users WHERE id = ? AND org_id = ?`).bind(memberId, orgId).run();
  await c.env.DB.prepare(`UPDATE organizations SET seats_used = seats_used - 1 WHERE id = ?`).bind(orgId).run();

  return c.json({ success: true, message: 'Member removed' });
});
