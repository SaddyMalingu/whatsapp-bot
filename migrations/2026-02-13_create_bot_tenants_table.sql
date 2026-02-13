-- Create bot_tenants table for multi-tenant system
BEGIN;

CREATE TABLE IF NOT EXISTS public.bot_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL UNIQUE,
  point_of_contact_name TEXT,
  point_of_contact_phone TEXT,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast tenant lookups by phone
CREATE INDEX idx_bot_tenants_phone ON public.bot_tenants(client_phone);
CREATE INDEX idx_bot_tenants_status ON public.bot_tenants(status);

-- Enable RLS
ALTER TABLE public.bot_tenants ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to read all tenants
CREATE POLICY "Service role can read tenants" ON public.bot_tenants
  FOR SELECT USING (true);

COMMIT;
