-- Add LLM usage tracking fields to public.conversations
BEGIN;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS llm_used boolean,
  ADD COLUMN IF NOT EXISTS llm_provider text,
  ADD COLUMN IF NOT EXISTS llm_latency_ms integer,
  ADD COLUMN IF NOT EXISTS llm_error text,
  ADD COLUMN IF NOT EXISTS llm_reason text;

COMMIT;
