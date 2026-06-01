-- ============================================
-- TruthEngine Ultimate - Core Database Schema
-- Migration: 001_initial.sql
-- Version: 3.0.0
-- ============================================

-- Organizations table (multi-tenant core)
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    billing_status TEXT DEFAULT 'active',
    plan TEXT DEFAULT 'free',
    max_monthly_verifications INTEGER DEFAULT 100,
    verifications_used INTEGER DEFAULT 0,
    max_monthly_seats INTEGER DEFAULT 5,
    seats_used INTEGER DEFAULT 0,
    settings TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_org_slug ON organizations(slug);
CREATE INDEX idx_org_billing_status ON organizations(billing_status);
CREATE INDEX idx_org_plan ON organizations(plan);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'member',
    api_key_hash TEXT,
    api_key_preview TEXT,
    last_active_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(org_id, email)
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_key_hash ON users(api_key_hash);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    key_preview TEXT NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT,
    expires_at INTEGER,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    lemon_squeezy_id TEXT UNIQUE NOT NULL,
    variant_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    current_period_start INTEGER NOT NULL,
    current_period_end INTEGER NOT NULL,
    cancel_at_period_end INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Verification Jobs table
CREATE TABLE IF NOT EXISTS verification_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    org_id TEXT NOT NULL,
    batch_id TEXT,
    text_preview TEXT,
    total_claims INTEGER DEFAULT 0,
    overall_score REAL,
    verdict TEXT,
    summary TEXT,
    results TEXT,
    processing_time_ms INTEGER,
    engine_mode TEXT DEFAULT 'standard',
    credits_used INTEGER DEFAULT 0,
    status TEXT DEFAULT 'processing',
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_verification_jobs_org_id ON verification_jobs(org_id);
CREATE INDEX idx_verification_jobs_user_id ON verification_jobs(user_id);
CREATE INDEX idx_verification_jobs_status ON verification_jobs(status);
CREATE INDEX idx_verification_jobs_created_at ON verification_jobs(created_at);

-- Verified Facts Cache
CREATE TABLE IF NOT EXISTS verified_facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_hash TEXT UNIQUE NOT NULL,
    claim TEXT NOT NULL,
    embedding TEXT,
    verdict TEXT NOT NULL,
    confidence REAL NOT NULL,
    sources TEXT,
    verification_count INTEGER DEFAULT 1,
    last_verified_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_verified_facts_claim_hash ON verified_facts(claim_hash);
CREATE INDEX idx_verified_facts_verdict ON verified_facts(verdict);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    page_count INTEGER,
    storage_path TEXT NOT NULL,
    status TEXT DEFAULT 'uploading',
    created_at INTEGER NOT NULL,
    processed_at INTEGER,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_documents_org_id ON documents(org_id);
CREATE INDEX idx_documents_status ON documents(status);

-- Webhook Events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT,
    url TEXT NOT NULL,
    secret TEXT,
    status TEXT DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    delivered_at INTEGER,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_webhook_events_org_id ON webhook_events(org_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);

-- Analytics Events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    properties TEXT,
    user_id TEXT,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_analytics_org_id ON analytics_events(org_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);

-- Daily Usage Stats table
CREATE TABLE IF NOT EXISTS usage_stats (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    org_id TEXT NOT NULL,
    total_verifications INTEGER DEFAULT 0,
    total_claims INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0,
    avg_processing_time REAL,
    avg_confidence REAL,
    api_calls INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    UNIQUE(date, org_id)
);

CREATE INDEX idx_usage_stats_org_id ON usage_stats(org_id);
CREATE INDEX idx_usage_stats_date ON usage_stats(date);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Compliance Checks table
CREATE TABLE IF NOT EXISTS compliance_checks (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    text_preview TEXT,
    risk_level TEXT,
    violations TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_compliance_org_id ON compliance_checks(org_id);
CREATE INDEX idx_compliance_risk_level ON compliance_checks(risk_level);

-- Deepfake Audits table
CREATE TABLE IF NOT EXISTS deepfake_audits (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT,
    audio_url TEXT,
    verdict TEXT NOT NULL,
    confidence REAL NOT NULL,
    features TEXT,
    processing_time_ms INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_deepfake_org_id ON deepfake_audits(org_id);
CREATE INDEX idx_deepfake_verdict ON deepfake_audits(verdict);
