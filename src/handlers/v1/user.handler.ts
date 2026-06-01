import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateApiKey, hashPassword } from '../../core/utils/crypto.utils';
import type { Bindings, Variables } from '../../types';

export const userHandler = new Hono<{ Bindings: Bindings; Variables: Variables }>();

userHandler.get('/me', async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare(`SELECT id, email, name, role, created_at FROM users WHERE id = ?`).bind(userId).first();
  return c.json({ success: true, data: user });
});

userHandler.patch('/me', zValidator('json', z.object({ name: z.string().optional() })), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  await c.env.DB.prepare(`UPDATE users SET name = COALESCE(?, name), updated_at = ? WHERE id = ?`).bind(body.name, Date.now(), userId).run();
  return c.json({ success: true, message: 'User updated' });
});

userHandler.get('/api-keys', async (c) => {
  const userId = c.get('userId');
  const keys = await c.env.DB.prepare(`SELECT id, name, key_preview, created_at, last_used_at, expires_at FROM api_keys WHERE user_id = ?`).bind(userId).all();
  return c.json({ success: true, data: keys.results });
});

userHandler.post('/api-keys', zValidator('json', z.object({ name: z.string().min(1), expires_in_days: z.number().optional() })), async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const body = c.req.valid('json');
  const { key, hash, preview } = await generateApiKey();
  const expiresAt = body.expires_in_days ? Date.now() + (body.expires_in_days * 24 * 60 * 60 * 1000) : null;

  await c.env.DB.prepare(`INSERT INTO api_keys (id, user_id, org_id, key_hash, key_preview, name, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), userId, orgId, hash, preview, body.name, expiresAt, Date.now()).run();

  return c.json({ success: true, data: { key, preview, name: body.name, expires_at: expiresAt }, message: 'Store this key securely - it will not be shown again' });
});

userHandler.delete('/api-keys/:keyId', async (c) => {
  const keyId = c.req.param('keyId');
  const userId = c.get('userId');
  await c.env.DB.prepare(`DELETE FROM api_keys WHERE id = ? AND user_id = ?`).bind(keyId, userId).run();
  return c.json({ success: true, message: 'API key deleted' });
});
