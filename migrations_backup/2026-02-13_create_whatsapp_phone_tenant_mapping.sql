-- Create mapping between WhatsApp phone numbers and tenants
BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_phone_tenant_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES public.bot_tenants(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast phone lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON public.whatsapp_phone_tenant_mapping(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_tenant_id ON public.whatsapp_phone_tenant_mapping(tenant_id);

-- Enable RLS
ALTER TABLE public.whatsapp_phone_tenant_mapping ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to read all mappings (drop old one if exists)
DROP POLICY IF EXISTS "Service role can read mappings" ON public.whatsapp_phone_tenant_mapping;
CREATE POLICY "Service role can read mappings" ON public.whatsapp_phone_tenant_mapping
  FOR SELECT USING (true);

COMMIT;
