/**
 * Test setup and configuration
 */

import { vi } from 'vitest';

// Mock Cloudflare environment
globalThis.fetch = vi.fn();

// Mock console methods to reduce noise in tests
console.log = vi.fn();
console.error = vi.fn();
console.warn = vi.fn();

// Mock crypto
globalThis.crypto = {
  randomUUID: () => 'test-uuid-1234',
  getRandomValues: (arr: any) => arr,
} as any;

// Test timeout
vi.setConfig({ testTimeout: 30000 });

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});
