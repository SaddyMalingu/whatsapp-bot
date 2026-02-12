-- Full Alphadome schema (staging-friendly)
-- This script creates the alphadome schema and all Alphadome tables.
-- It also creates lightweight STUB tables for referenced objects (users, brands, freelancers, tasks, storage.objects)
-- only IF they do not already exist. Stubs are minimal and safe in staging.

-- Run in a staging copy of your DB.

BEGIN;

-- 1) Ensure pgcrypto is available for gen_random_uuid();
-- Supabase typically allows creating pgcrypto from the SQL editor (owner role).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Create minimal stub tables for referenced objects if missing (staging-safe).
-- These stubs avoid FK failures when running in an empty staging DB.
-- If your staging already contains these real tables, these CREATE TABLE IF NOT EXISTS statements will be NO-OP.

-- public.users (stub)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY
);

-- public.brands (stub)
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY
);

-- public.freelancers (stub)
CREATE TABLE IF NOT EXISTS public.freelancers (
  id uuid PRIMARY KEY
);

-- public.tasks (stub)
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY
);

-- NOTE: storage.objects is managed by Supabase and already exists.
-- We skip creating a stub here to avoid permission errors.

-- 3) Create alphadome schema and tables
CREATE SCHEMA IF NOT EXISTS alphadome;

-- Portfolio items
CREATE TABLE IF NOT EXISTS alphadome.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text,
  description text,
  status text DEFAULT 'published',
  visibility text DEFAULT 'private',
  storage_object_id uuid REFERENCES storage.objects(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_brand ON alphadome.portfolio_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_uploaded_by ON alphadome.portfolio_items(uploaded_by);

-- Brand business profiles
CREATE TABLE IF NOT EXISTS alphadome.brand_business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  display_name text,
  industry text,
  website text,
  description text,
  contacts jsonb DEFAULT '{}'::jsonb,
  social_links jsonb DEFAULT '{}'::jsonb,
  marketing_goals jsonb DEFAULT '{}'::jsonb,
  current_assets jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_profiles_brand ON alphadome.brand_business_profiles(brand_id);

-- Freelancer submissions
CREATE TABLE IF NOT EXISTS alphadome.freelancer_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE SET NULL,
  submitted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  portfolio_item_id uuid REFERENCES alphadome.portfolio_items(id) ON DELETE SET NULL,
  file_object_id uuid REFERENCES storage.objects(id) ON DELETE SET NULL,
  content jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending',
  review_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_freelancer ON alphadome.freelancer_submissions(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task ON alphadome.freelancer_submissions(task_id);

-- MatchBox reports
CREATE TABLE IF NOT EXISTS alphadome.matchbox_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  generated_by text,
  title text,
  summary text,
  insights jsonb DEFAULT '{}'::jsonb,
  recommended_tasks jsonb DEFAULT '[]'::jsonb,
  report_files jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_matchbox_brand ON alphadome.matchbox_reports(brand_id);

-- Bot configs
CREATE TABLE IF NOT EXISTS alphadome.bot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_key text UNIQUE NOT NULL,
  bot_name text,
  description text,
  owner_brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  capabilities jsonb DEFAULT '[]'::jsonb,
  default_personality jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Conversation profile change logs
CREATE TABLE IF NOT EXISTS alphadome.conversation_profile_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  change_type text,
  payload jsonb DEFAULT '{}'::jsonb,
  source text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_changes_user ON alphadome.conversation_profile_changes(user_id);

-- Useful indexes for RAG/workflows
CREATE INDEX IF NOT EXISTS idx_portfolio_metadata_gin ON alphadome.portfolio_items USING gin (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_business_metadata_gin ON alphadome.brand_business_profiles USING gin (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_matchbox_insights_gin ON alphadome.matchbox_reports USING gin (insights jsonb_path_ops);

COMMIT;

-- END — Alphadome full staging schema

-- IMPORTANT NOTES:
-- - If any of the stub tables were created above and you later import a copy of your full production schema,
--   you should DROP the stubs or migrate columns as appropriate.
-- - This file is designed to be safe in staging; it will not overwrite existing real tables because it uses
--   CREATE TABLE IF NOT EXISTS and only creates small stubs when necessary.
