/**
 * TruthEngine Ultimate - Core Type Definitions
 */

export interface Bindings {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  ASSETS: R2Bucket;
  BACKUPS: R2Bucket;
  CACHE: KVNamespace;
  SESSION: KVNamespace;
  RATE_LIMIT: KVNamespace;
  JOB_QUEUE: Queue;
  WEBHOOK_QUEUE: Queue;
  EMAIL_QUEUE: Queue;
  WEBSOCKET_SYNC: DurableObjectNamespace;
  JOB_TRACKER: DurableObjectNamespace;
  ENVIRONMENT: string;
  API_VERSION: string;
  DEFAULT_MODEL: string;
  MAX_TEXT_LENGTH: string;
  DEFAULT_RATE_LIMIT: string;
  CACHE_TTL: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  CORS_ORIGINS: string;
  HUGGINGFACE_API_KEY: string;
  TAVILY_API_KEY: string;
  COHERE_API_KEY: string;
  OPENAI_API_KEY: string;
  LEMON_SQUEEZY_API_KEY: string;
  LEMON_SQUEEZY_STORE_ID: string;
  LEMON_SQUEEZY_WEBHOOK_SECRET: string;
}

export interface Variables {
  userId?: string;
  orgId?: string;
  apiKey?: string;
  requestId: string;
  startTime: number;
  isPremium: boolean;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
}

export interface VerificationRequest {
  text: string;
  user_id?: string;
  org_id?: string;
  engine_mode?: 'standard' | 'deep' | 'academic' | 'compliance';
  threshold?: number;
  include_sources?: boolean;
  language?: string;
  callback_url?: string;
}

export interface VerificationResult {
  job_id: string;
  status: 'processing' | 'completed' | 'failed' | 'partial';
  overall_score: number;
  verdict: 'TRUE' | 'PARTIAL' | 'SUSPICIOUS' | 'FALSE';
  claims: ClaimResult[];
  summary: VerificationSummary;
  processing_time_ms: number;
  credits_used?: number;
  remaining_credits?: number;
}

export interface ClaimResult {
  claim: string;
  verdict: 'TRUE' | 'SUSPICIOUS' | 'FALSE';
  confidence: number;
  color: 'green' | 'yellow' | 'red';
  sources: Source[];
  semantic_similarity: number;
  claim_type?: 'factual' | 'opinion' | 'prediction' | 'definition';
  position?: { start: number; end: number };
}

export interface Source {
  url: string;
  title: string;
  snippet: string;
  domain_authority: number;
  published_date?: string;
  author?: string;
  site_name?: string;
  favicon?: string;
}

export interface VerificationSummary {
  total_claims: number;
  verified_count: number;
  suspicious_count: number;
  false_count: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence_distribution: { high: number; medium: number; low: number };
  top_domains: Array<{ domain: string; count: number }>;
}

export interface Organization {
  id: string; name: string; slug: string;
  billing_status: 'active' | 'past_due' | 'canceled' | 'trialing';
  plan: 'free' | 'pro' | 'business' | 'enterprise';
  max_monthly_verifications: number; verifications_used: number;
  max_monthly_seats: number; seats_used: number;
  settings: OrganizationSettings;
  created_at: number; updated_at: number;
}

export interface OrganizationSettings {
  allowed_domains?: string[]; allowed_ips?: string[];
  webhook_url?: string; webhook_events?: string[];
  custom_branding?: boolean; audit_log_retention_days?: number;
  api_rate_limit_multiplier?: number;
}

export interface User {
  id: string; org_id: string; email: string; name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  api_key_hash?: string; api_key_preview?: string;
  last_active_at?: number; created_at: number; updated_at: number;
}

export interface ApiKey {
  id: string; user_id: string; org_id: string;
  key_hash: string; key_preview: string; name: string;
  permissions: string[]; expires_at?: number;
  last_used_at?: number; created_at: number;
}

export interface Job {
  id: string; org_id: string; user_id: string;
  type: 'verification' | 'batch' | 'document' | 'audio' | 'compliance';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number; payload: any; result?: any; error?: string;
  attempts: number; max_attempts: number;
  created_at: number; started_at?: number; completed_at?: number; scheduled_for?: number;
}
