/**
 * Validation utilities
 */

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
  return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function isBase64(str: string): boolean {
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(str);
}

export function isValidApiKey(key: string): boolean {
  return key.startsWith('tr_') && key.length >= 32;
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validateTextLength(text: string, min: number = 10, max: number = 50000): { valid: boolean; error?: string } {
  if (text.length < min) return { valid: false, error: `Text must be at least ${min} characters` };
  if (text.length > max) return { valid: false, error: `Text cannot exceed ${max} characters` };
  return { valid: true };
}
