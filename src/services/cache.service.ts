import type { Bindings } from '../types';

export interface CacheEntry<T = any> { data: T; timestamp: number; expiresAt: number; }

export class CacheService {
  private defaultTTL = 3600;
  constructor(private env: Bindings) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.env.CACHE.get(key);
      if (!cached) return null;
      const entry: CacheEntry<T> = JSON.parse(cached);
      if (Date.now() > entry.expiresAt) { await this.delete(key); return null; }
      return entry.data;
    } catch { return null; }
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return await Promise.all(keys.map(key => this.get<T>(key)));
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiresAt = Date.now() + ((ttl || this.defaultTTL) * 1000);
    await this.env.CACHE.put(key, JSON.stringify({ data: value, timestamp: Date.now(), expiresAt }), { expirationTtl: ttl || this.defaultTTL });
  }

  async setMany<T>(entries: { key: string; value: T; ttl?: number }[]): Promise<void> {
    await Promise.all(entries.map(entry => this.set(entry.key, entry.value, entry.ttl)));
  }

  async delete(key: string): Promise<void> { await this.env.CACHE.delete(key); }

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    const current = await this.get<number>(key);
    const newValue = (current || 0) + amount;
    await this.set(key, newValue);
    return newValue;
  }
}
