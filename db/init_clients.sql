-- ============================================================================
-- CKEKEA — ESQUEMA COMPLETO NEON POSTGRESQL (USUARIOS, SUPERADMIN, CONSUMO, BANCO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS web_clients (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  business_name     TEXT NOT NULL,
  business_type     TEXT NOT NULL DEFAULT 'RETAIL',
  email             TEXT NOT NULL UNIQUE,
  phone             TEXT,
  password_hash     TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'USER',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  plan_tier         TEXT NOT NULL DEFAULT 'ESTANDAR',
  payment_status    TEXT NOT NULL DEFAULT 'TRIAL',
  payment_reference TEXT,
  bot_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  bot_name          TEXT NOT NULL DEFAULT 'Max',
  whatsapp_phone    TEXT,
  business_hours    TEXT DEFAULT 'Lunes a Sábado de 8:00am a 7:00pm',
  delivery_info     TEXT DEFAULT 'Sí, hacemos envíos y entregas en tienda.',
  api_key           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migraciones seguras si la tabla ya existía
ALTER TABLE web_clients ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE web_clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_web_clients_email ON web_clients(email);
CREATE INDEX IF NOT EXISTS idx_web_clients_tenant ON web_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_web_clients_role ON web_clients(role);

-- Tabla de métricas de consumo por empresa (API REST vs Chatbot IA)
CREATE TABLE IF NOT EXISTS usage_metrics (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_type  TEXT NOT NULL, -- 'API_CALL' | 'CHATBOT_MSG' | 'BANK_VERIFY'
  endpoint     TEXT,
  tokens_used  INTEGER NOT NULL DEFAULT 0,
  latency_ms   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_tenant_date ON usage_metrics(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_type ON usage_metrics(metric_type);

-- Tabla de integración de API Bancaria (global o por comercio, lista para Mercantil/BDV/Banesco/BNC)
CREATE TABLE IF NOT EXISTS bank_integrations (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  scope             TEXT NOT NULL DEFAULT 'TENANT', -- 'GLOBAL' | 'TENANT'
  provider          TEXT NOT NULL DEFAULT 'MERCANTIL', -- 'MERCANTIL' | 'BDV' | 'BANESCO' | 'BNC' | 'BANCAMIGA' | 'CUSTOM'
  verification_mode TEXT NOT NULL DEFAULT 'MANUAL', -- 'MANUAL' | 'BANK_API' | 'SIMULATED'
  api_base_url      TEXT,
  api_key           TEXT,
  client_secret     TEXT,
  merchant_id       TEXT,
  account_phone     TEXT,
  account_rif       TEXT,
  auto_approve      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
