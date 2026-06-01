import type { MiddlewareHandler } from 'hono';
import type { Bindings, Variables } from '../../types';
import { verifyJWT, verifyApiKey } from '../utils/crypto.utils';

export const authMiddleware: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  const startTime = performance.now();
  const authHeader = c.req.header('Authorization');
  const apiKey = c.req.header('X-API-Key');
  
  let userId: string | null = null;
  let orgId: string | null = null;
  let isPremium = false;
  
  try {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      if (payload) {
        userId = payload.user_id;
        orgId = payload.org_id;
        isPremium = payload.is_premium || false;
        c.executionCtx.waitUntil(updateLastActive(userId, orgId, c.env));
      }
    }
    
    if (!userId && apiKey) {
      const apiKeyData = await verifyApiKey(apiKey, c.env);
      if (apiKeyData) {
        userId = apiKeyData.user_id;
        orgId = apiKeyData.org_id;
        isPremium = apiKeyData.is_premium || false;
        c.executionCtx.waitUntil(updateApiKeyLastUsed(apiKeyData.key_id, c.env));
      }
    }
    
    if (!userId) {
      return c.json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication token' }
      }, 401);
    }
    
    const user = await getUserById(userId, c.env);
    if (!user || user.role === 'disabled') {
      return c.json({ error: { code: 'ACCESS_DENIED', message: 'Account disabled' } }, 403);
    }
    
    const org = await getOrganizationById(orgId, c.env);
    if (!org || org.billing_status === 'canceled') {
      return c.json({ error: { code: 'ORG_INACTIVE', message: 'Organization inactive' } }, 403);
    }
    
    c.set('userId', userId);
    c.set('orgId', orgId);
    c.set('isPremium', isPremium);
    c.set('requestId', crypto.randomUUID());
    c.set('startTime', startTime);
    
    c.header('X-User-Id', userId);
    c.header('X-Org-Id', orgId);
    
    await next();
    
    const processingTime = performance.now() - startTime;
    c.header('X-Processing-Time', `${Math.round(processingTime)}ms`);
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: { code: 'AUTH_ERROR', message: 'Authentication failed' } }, 500);
  }
};

export const optionalAuthMiddleware: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  const startTime = performance.now();
  try {
    const authHeader = c.req.header('Authorization');
    const apiKey = c.req.header('X-API-Key');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      if (payload) {
        c.set('userId', payload.user_id);
        c.set('orgId', payload.org_id);
        c.set('isPremium', payload.is_premium || false);
      }
    }
    
    if (!c.get('userId') && apiKey) {
      const apiKeyData = await verifyApiKey(apiKey, c.env);
      if (apiKeyData) {
        c.set('userId', apiKeyData.user_id);
        c.set('orgId', apiKeyData.org_id);
        c.set('isPremium', apiKeyData.is_premium || false);
      }
    }
    
    c.set('requestId', crypto.randomUUID());
    c.set('startTime', startTime);
    await next();
    
    const processingTime = performance.now() - startTime;
    c.header('X-Processing-Time', `${Math.round(processingTime)}ms`);
  } catch (error) {
    await next();
  }
};

async function updateLastActive(userId: string, orgId: string, env: Bindings): Promise<void> {
  await env.DB.prepare(`UPDATE users SET last_active_at = ? WHERE id = ? AND org_id = ?`)
    .bind(Date.now(), userId, orgId).run();
}

async function updateApiKeyLastUsed(keyId: string, env: Bindings): Promise<void> {
  await env.DB.prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`)
    .bind(Date.now(), keyId).run();
}

async function getUserById(userId: string, env: Bindings): Promise<any> {
  return await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first();
}

async function getOrganizationById(orgId: string, env: Bindings): Promise<any> {
  return await env.DB.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(orgId).first();
}
