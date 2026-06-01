import { z } from 'zod';

export const VerifyRequestSchema = z.object({
  text: z.string().min(10).max(50000),
  user_id: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
  engine_mode: z.enum(['standard', 'deep', 'academic', 'compliance']).default('standard'),
  threshold: z.number().min(0.5).max(0.95).default(0.75),
  include_sources: z.boolean().default(true),
  language: z.string().default('en'),
  callback_url: z.string().url().optional(),
});

export const BatchVerifyRequestSchema = z.object({
  texts: z.array(z.string().min(10)).min(1).max(100),
  engine_mode: z.enum(['standard', 'deep', 'academic', 'compliance']).default('standard'),
  threshold: z.number().min(0.5).max(0.95).default(0.75),
  include_sources: z.boolean().default(true),
});

export const DocumentUploadSchema = z.object({
  filename: z.string().min(1),
  mime_type: z.string().regex(/^application\/pdf|text\/plain$/),
  size: z.number().min(1).max(50 * 1024 * 1024),
});

export const ApiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).default(['read', 'write']),
  expires_in_days: z.number().min(1).max(365).optional(),
});

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string; version: string; environment: string; uptime: number;
  checks: { database: boolean; cache: boolean; storage: boolean; queues: boolean; apis: Record<string, boolean> };
}

export interface RateLimitInfo {
  limit: number; remaining: number; reset: number; retryAfter?: number;
}

export interface PaginationParams {
  page?: number; limit?: number; cursor?: string;
  sort?: 'asc' | 'desc'; sortBy?: string;
}
