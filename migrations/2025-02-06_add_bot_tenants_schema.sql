-- ============================================================================
-- ALPHADOME MULTI-TENANT BOT SYSTEM - MIGRATION
-- ============================================================================
-- Extends existing Supabase schema to support per-client WhatsApp bot tenants
-- without redeployment. Maintains alignment with existing tables.
-- 
-- Verified existing tables:
--   • public.users (id, phone, full_name, subscribed, subscription_type, level)
--   • public.brands (id, is_platform_owner, ...)
--   • public.conversations (brand_id, user_id, whatsapp_message_id, direction, ...)
--   • public.subscriptions (user_id, phone, amount, plan_type, level, status, ...)
--   • public.user_sessions (phone, context, updated_at)
--   • alphadome.* (portfolio, business profiles, submissions, etc.)
--
-- NEW TABLES FOR MULTI-TENANT BOT SUPPORT:
--   • alphadome.bot_tenants          - per-client bot config & credentials
--   • alphadome.bot_templates        - prompt templates & conversation rules per tenant
--   • alphadome.bot_training_data    - FAQ pairs, canned replies, training samples
--   • alphadome.bot_control_settings - feature toggles, rate limits, on/off switch
--   • alphadome.bot_message_logs     - separate logging per tenant (optional, encrypted)
--
-- ============================================================================

BEGIN;

-- Ensure pgcrypto exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure schema exists for alphadome objects
CREATE SCHEMA IF NOT EXISTS alphadome;
COMMENT ON SCHEMA alphadome IS 'Alphadome application schema for multi-tenant bot objects';

-- ============================================================================
-- 1. BOT TENANTS TABLE
-- ============================================================================
-- One row per client WhatsApp bot instance
-- Stores credentials, phone, status, and webhook config per tenant
--
CREATE TABLE IF NOT EXISTS alphadome.bot_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Client identifier
  client_name text NOT NULL,                    -- "Kassangas Music Shop"
  client_phone text UNIQUE NOT NULL,            -- "+254702245555" (primary contact)
  client_email text,
  
  -- Brand/Account association
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  point_of_contact_name text,                   -- "Gideon"
  point_of_contact_phone text,                  -- "0702245555"
  
  -- WhatsApp credentials (encrypted in transit, stored securely)
  whatsapp_phone_number_id text NOT NULL,       -- Meta phone ID (e.g., "868405499681303")
  whatsapp_business_account_id text,            -- Meta business account ID
  whatsapp_access_token text NOT NULL,          -- Meta token (MUST BE ENCRYPTED IN PROD)
  whatsapp_token_expires_at timestamp with time zone,
  
  -- LLM & AI config
  ai_provider text DEFAULT 'openai',            -- 'openai' | 'openrouter' | 'huggingface'
  ai_api_key text,                              -- ENCRYPTED in production
  ai_model text DEFAULT 'gpt-4o-mini',
  
  -- Tenant status
  is_active boolean DEFAULT false,              -- not active until fully configured
  is_verified boolean DEFAULT false,            -- webhook verified with Meta
  
  -- Webhook config
  webhook_verify_token text UNIQUE,             -- per-tenant verify token
  webhook_url text,                             -- e.g., /webhook/kassangas or /webhook/{tenant_id}
  
  -- Metadata & settings
  metadata jsonb DEFAULT '{}'::jsonb,           -- custom config, branding, etc.
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_tenants_brand ON alphadome.bot_tenants(brand_id);
CREATE INDEX IF NOT EXISTS idx_bot_tenants_phone ON alphadome.bot_tenants(client_phone);
CREATE INDEX IF NOT EXISTS idx_bot_tenants_active ON alphadome.bot_tenants(is_active);

-- ============================================================================
-- 2. BOT TEMPLATES TABLE
-- ============================================================================
-- Per-tenant conversation templates and system prompts
--
CREATE TABLE IF NOT EXISTS alphadome.bot_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_tenant_id uuid NOT NULL REFERENCES alphadome.bot_tenants(id) ON DELETE CASCADE,
  
  -- Template name and description
  template_name text NOT NULL,                  -- "default", "product_inquiry", "support", etc.
  description text,
  
  -- System prompt and context
  system_prompt text NOT NULL,                  -- Full system message for LLM
  conversation_context jsonb DEFAULT '[]'::jsonb, -- Pre-loaded context/history
  
  -- Tone and personality
  tone text DEFAULT 'professional',             -- 'professional', 'friendly', 'casual', etc.
  max_response_length integer DEFAULT 1000,
  
  -- Template status
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,             -- Which template to use by default
  
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_templates_tenant ON alphadome.bot_templates(bot_tenant_id);
CREATE INDEX IF NOT EXISTS idx_bot_templates_active ON alphadome.bot_templates(is_active);

-- ============================================================================
-- 3. BOT TRAINING DATA TABLE
-- ============================================================================
-- FAQ pairs, canned replies, and training samples per tenant
--
CREATE TABLE IF NOT EXISTS alphadome.bot_training_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_tenant_id uuid NOT NULL REFERENCES alphadome.bot_tenants(id) ON DELETE CASCADE,
  
  -- Data type
  data_type text NOT NULL,                      -- 'faq' | 'canned_reply' | 'example'
  
  -- Content
  question text,                                -- What the user might ask
  answer text NOT NULL,                         -- The response to give
  
  -- Metadata
  category text,                                -- For organization (e.g., "Products", "Support")
  priority integer DEFAULT 0,                   -- Higher = searched first
  confidence_score numeric DEFAULT 1.0,         -- 0.0-1.0, for RAG ranking
  
  -- Control
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_tenant ON alphadome.bot_training_data(bot_tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_active ON alphadome.bot_training_data(is_active);
CREATE INDEX IF NOT EXISTS idx_training_type ON alphadome.bot_training_data(data_type);

-- ============================================================================
-- 4. BOT CONTROL SETTINGS TABLE
-- ============================================================================
-- Feature toggles, rate limits, and runtime control per tenant
--
CREATE TABLE IF NOT EXISTS alphadome.bot_control_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_tenant_id uuid NOT NULL UNIQUE REFERENCES alphadome.bot_tenants(id) ON DELETE CASCADE,
  
  -- On/Off switch
  is_bot_enabled boolean DEFAULT true,
  
  -- Rate limiting
  max_messages_per_hour integer DEFAULT 100,
  max_messages_per_user_per_day integer DEFAULT 50,
  
  -- Feature toggles
  enable_ai_responses boolean DEFAULT true,
  enable_payment_flow boolean DEFAULT false,    -- For subscription/Alphadome
  enable_training_mode boolean DEFAULT false,   -- Accept training input from admin
  enable_auto_reply boolean DEFAULT true,
  
  -- Logging
  log_conversations boolean DEFAULT true,
  log_errors boolean DEFAULT true,
  
  -- Contact for escalations
  escalation_phone text,                        -- e.g., admin phone
  escalation_email text,
  
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_tenant ON alphadome.bot_control_settings(bot_tenant_id);

-- ============================================================================
-- 5. BOT MESSAGE LOGS TABLE (Optional, Encrypted)
-- ============================================================================
-- Per-tenant conversation logs (alternative to logging to public.conversations)
-- Use this if you want tenant isolation at the log level
--
CREATE TABLE IF NOT EXISTS alphadome.bot_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_tenant_id uuid NOT NULL REFERENCES alphadome.bot_tenants(id) ON DELETE CASCADE,
  
  -- Message metadata
  user_phone text NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Direction and content
  direction text NOT NULL,                      -- 'incoming' | 'outgoing'
  message_text text NOT NULL,
  whatsapp_message_id text,
  
  -- Processing status
  ai_processed boolean DEFAULT false,
  ai_response text,
  
  -- Error tracking
  error_message text,
  
  -- Context
  template_used text,
  training_data_id uuid REFERENCES alphadome.bot_training_data(id) ON DELETE SET NULL,
  
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_tenant ON alphadome.bot_message_logs(bot_tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_phone ON alphadome.bot_message_logs(user_phone);
CREATE INDEX IF NOT EXISTS idx_message_logs_created ON alphadome.bot_message_logs(created_at);

-- ============================================================================
-- GRANTS (Optional - adjust for your Supabase auth setup)
-- ============================================================================
-- Uncomment if using authenticated role:
-- GRANT USAGE ON SCHEMA alphadome TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA alphadome TO authenticated;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
--
-- NEXT STEPS:
-- 1. Run this migration in your Supabase SQL editor
-- 2. For each client, insert a row into alphadome.bot_tenants
-- 3. Insert default templates and control settings for each tenant
-- 4. Update server.js webhook handler to load tenant config by phone/token
-- 5. Build dashboard UI to manage tenants, templates, and training data
-- 6. Implement encryption for sensitive fields (whatsapp_access_token, ai_api_key)
--
-- SECURITY NOTES:
-- - Store whatsapp_access_token and ai_api_key encrypted (use Supabase Vault or
--   encrypt before storing, decrypt on use)
-- - Use Row-Level Security (RLS) policies to ensure tenants can only access their own data
-- - Rotate webhook_verify_token per tenant
-- - Monitor token expiry and alert on bot_tenants.whatsapp_token_expires_at
--
