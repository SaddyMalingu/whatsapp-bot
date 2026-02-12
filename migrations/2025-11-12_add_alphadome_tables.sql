-- Migration: Add Alphadome tables for Portfolio, Business Profiles, Freelancer Submissions,
-- MatchBox reports, Bot configs, and Conversation profile change logs.
-- Generated: 2025-11-12
-- Run this against your Supabase/Postgres DB using psql or the Supabase SQL editor.

-- NOTE: This migration assumes the following existing tables/columns from your schema:
-- public.users(id uuid), public.brands(id uuid), public.tasks(id uuid),
-- public.freelancers(id uuid), storage.objects(id uuid)

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS alphadome;

-- Portfolio items (samples, case studies, deliverables)
CREATE TABLE IF NOT EXISTS alphadome.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text,
  description text,
  status text DEFAULT 'published', -- draft | published | archived
  visibility text DEFAULT 'private', -- private | public | unlisted
  storage_object_id uuid REFERENCES storage.objects(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_brand ON alphadome.portfolio_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_uploaded_by ON alphadome.portfolio_items(uploaded_by);

-- Brand business profiles (comprehensive profile built from conversations)
CREATE TABLE IF NOT EXISTS alphadome.brand_business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  display_name text,
  industry text,
  website text,
  description text,
  contacts jsonb DEFAULT '{}'::jsonb, -- { phone, email, addresses }
  social_links jsonb DEFAULT '{}'::jsonb,
  marketing_goals jsonb DEFAULT '{}'::jsonb,
  current_assets jsonb DEFAULT '{}'::jsonb, -- pointers to portfolio_items, storage objects
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_profiles_brand ON alphadome.brand_business_profiles(brand_id);

-- Freelancer submissions: files or deliverables uploaded by freelancers or external contributors
CREATE TABLE IF NOT EXISTS alphadome.freelancer_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE SET NULL,
  submitted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  portfolio_item_id uuid REFERENCES alphadome.portfolio_items(id) ON DELETE SET NULL,
  file_object_id uuid REFERENCES storage.objects(id) ON DELETE SET NULL,
  content jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending', -- pending | accepted | rejected
  review_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_freelancer ON alphadome.freelancer_submissions(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task ON alphadome.freelancer_submissions(task_id);

-- MatchBox reports: analytics, recommendations, and deliverables produced by MatchBox
CREATE TABLE IF NOT EXISTS alphadome.matchbox_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  generated_by text, -- 'matchbox' | 'bot' | 'freelancer'
  title text,
  summary text,
  insights jsonb DEFAULT '{}'::jsonb,
  recommended_tasks jsonb DEFAULT '[]'::jsonb,
  report_files jsonb DEFAULT '[]'::jsonb, -- array of storage.object ids or portfolio_item ids
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_matchbox_brand ON alphadome.matchbox_reports(brand_id);

-- Bot configuration store: keep bot personalities, capabilities, and routing info
CREATE TABLE IF NOT EXISTS alphadome.bot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_key text UNIQUE NOT NULL, -- short identifier used in code (e.g. 'matchbox', 'landing_page')
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

-- Conversation profile change logs: whenever the bot updates a user's business profile
CREATE TABLE IF NOT EXISTS alphadome.conversation_profile_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  change_type text, -- 'profile_field', 'consent', 'opt_in', 'opt_out', etc
  payload jsonb DEFAULT '{}'::jsonb, -- details of the change
  source text, -- 'whatsapp', 'matchbox', 'admin'
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_changes_user ON alphadome.conversation_profile_changes(user_id);

-- Useful indexes to support retrieval and RAG workflows
CREATE INDEX IF NOT EXISTS idx_portfolio_metadata_gin ON alphadome.portfolio_items USING gin (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_business_metadata_gin ON alphadome.brand_business_profiles USING gin (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_matchbox_insights_gin ON alphadome.matchbox_reports USING gin (insights jsonb_path_ops);

-- Grant basic select/insert/update on new schema to authenticated role (optional)
-- (Adjust roles as per your Supabase setup)
-- GRANT USAGE ON SCHEMA alphadome TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA alphadome TO authenticated;

-- End of migration
