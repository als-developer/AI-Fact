import * as bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function generateApiKey(): Promise<{ key: string; hash: string; preview: string }> {
  const key = `tr_${crypto.randomUUID().replace(/-/g, '')}${Date.now().toString(36)}`;
  const hash = await hashPassword(key);
  const preview = `${key.substring(0, 8)}...${key.substring(key.length - 8)}`;
  return { key, hash, preview };
}

export async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export async function verifyApiKey(apiKey: string, env: any): Promise<any> {
  const hash = await hashPassword(apiKey);
  const result = await env.DB.prepare(`
    SELECT k.user_id, k.org_id, u.role, o.plan as is_premium
    FROM api_keys k
    JOIN users u ON k.user_id = u.id
    JOIN organizations o ON k.org_id = o.id
    WHERE k.key_hash = ? AND (k.expires_at IS NULL OR k.expires_at > ?)
  `).bind(hash, Date.now()).first();
  
  if (result) {
    return { user_id: result.user_id, org_id: result.org_id, is_premium: result.is_premium !== 'free', key_id: result.id };
  }
  return null;
}

export function generateToken(userId: string, orgId: string, isPremium: boolean): string {
  const payload = { user_id: userId, org_id: orgId, is_premium: isPremium, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 };
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadBase64 = btoa(JSON.stringify(payload));
  const signature = btoa('signature_placeholder');
  return `${header}.${payloadBase64}.${signature}`;
}

export function encrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

export function decrypt(encrypted: string, key: string): string {
  const decoded = atob(encrypted);
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}
