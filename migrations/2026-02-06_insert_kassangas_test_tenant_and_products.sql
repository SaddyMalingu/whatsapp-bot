-- Migration: Insert Kassangas Music Shop test tenant and product catalog
-- Date: 2026-02-06
-- Note: This migration inserts a test tenant record with placeholder Meta credentials
-- and creates a `bot_products` table (catalog). Replace placeholders with real
-- WhatsApp credentials when available, then run in Supabase SQL editor.

-- 1. Ensure schema exists
CREATE SCHEMA IF NOT EXISTS alphadome;

-- 2. Create products/catalog table if not exists
CREATE TABLE IF NOT EXISTS alphadome.bot_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_tenant_id uuid REFERENCES alphadome.bot_tenants(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2),
  currency VARCHAR(8) DEFAULT 'KES',
  stock_count INTEGER DEFAULT 0,
  image_url TEXT,
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Insert or update Kassangas test tenant (placeholders for credentials)
-- Replace access token and phone ID once Gideon provides them.
-- Note: webhook_verify_token will be provided by the client as part of credentials.
-- For now it's NULL; update it after credentials are shared.
INSERT INTO alphadome.bot_tenants (
  client_name,
  client_phone,
  brand_id,
  whatsapp_phone_number_id,
  whatsapp_business_account_id,
  whatsapp_access_token,
  ai_provider,
  ai_api_key,
  ai_model,
  is_active,
  is_verified,
  webhook_verify_token,
  webhook_url,
  metadata,
  created_at, updated_at
) VALUES (
  'Kassangas Music Shop',
  '0702245555',
  NULL,
  'PHONE_NUMBER_ID_PLACEHOLDER',
  'BUSINESS_ACCOUNT_ID_PLACEHOLDER',
  'ACCESS_TOKEN_PLACEHOLDER',
  'openai',
  NULL,
  'gpt-3.5-turbo',
  true,
  false,
  NULL,
  'https://your-domain.com/webhook',
  '{"created_by":"migration","purpose":"test-tenant"}'::jsonb,
  now(), now()
)
ON CONFLICT (client_phone) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  whatsapp_phone_number_id = EXCLUDED.whatsapp_phone_number_id,
  whatsapp_business_account_id = EXCLUDED.whatsapp_business_account_id,
  whatsapp_access_token = EXCLUDED.whatsapp_access_token,
  ai_provider = EXCLUDED.ai_provider,
  ai_model = EXCLUDED.ai_model,
  is_active = EXCLUDED.is_active,
  webhook_url = EXCLUDED.webhook_url,
  metadata = alphadome.bot_tenants.metadata || EXCLUDED.metadata,
  updated_at = now();

-- After receiving credentials, set webhook_verify_token explicitly:
-- UPDATE alphadome.bot_tenants
-- SET webhook_verify_token = 'CLIENT_PROVIDED_TOKEN'
-- WHERE client_phone = '0702245555';

-- 4. Insert sample product catalog for Kassangas
-- Use public image URLs as placeholders; replace with hosted images when available

WITH tenant AS (
  SELECT id FROM alphadome.bot_tenants WHERE client_phone = '0702245555' LIMIT 1
)
INSERT INTO alphadome.bot_products (
  bot_tenant_id, sku, name, description, price, currency, stock_count, image_url, metadata
)
SELECT
  t.id,
  x.sku,
  x.name,
  x.description,
  x.price,
  x.currency,
  x.stock_count,
  x.image_url,
  x.metadata::jsonb
FROM tenant t,
  (VALUES
    (
      'KASS-GTR-001',
      'Acoustic Guitar - Classic',
      'Full-size acoustic guitar, spruce top, mahogany back and sides. Great tone for beginners and professionals.',
      12500.00,
      'KES',
      8,
      'https://images.unsplash.com/photo-1511376777868-611b54f68947?auto=format&fit=crop&w=800&q=60',
      '{"category":"guitars","condition":"new","tags":["acoustic","guitar","strings"],"brand":"Kassangas"}'
    ),
    (
      'KASS-EGTR-002',
      'Electric Guitar - Sonic Red',
      'Solid-body electric guitar with dual humbuckers. Includes gig bag and starter set.',
      23500.00,
      'KES',
      4,
      'https://images.unsplash.com/photo-1518444023807-0ea5f6b7c3d1?auto=format&fit=crop&w=800&q=60',
      '{"category":"guitars","condition":"new","tags":["electric","guitar","rock"],"brand":"Kassangas"}'
    ),
    (
      'KASS-KBD-003',
      '88-Key Keyboard',
      '88-key digital keyboard with weighted keys and 128 voices. USB MIDI enabled.',
      48000.00,
      'KES',
      2,
      'https://images.unsplash.com/photo-1519340333755-47a7e9b9f7f7?auto=format&fit=crop&w=800&q=60',
      '{"category":"keyboards","condition":"new","tags":["keyboard","piano","midi"],"brand":"Kassangas"}'
    ),
    (
      'KASS-AMP-004',
      'Practice Amplifier 20W',
      'Compact 20W guitar amplifier with clean and overdrive channels. Great for home practice.',
      6500.00,
      'KES',
      10,
      'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=60',
      '{"category":"amplifiers","condition":"new","tags":["amp","practice","guitar"],"brand":"Kassangas"}'
    )
  ) AS x(sku, name, description, price, currency, stock_count, image_url, metadata)
ON CONFLICT DO NOTHING;

-- 5. Verification queries (returns counts)
SELECT 'tenant_rows' AS check, COUNT(*) FROM alphadome.bot_tenants WHERE client_phone = '0702245555';
SELECT 'product_rows' AS check, COUNT(*) FROM alphadome.bot_products WHERE bot_tenant_id IN (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '0702245555');

-- END OF MIGRATION
