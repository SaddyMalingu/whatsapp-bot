-- Migration: Create bot_product_variants table (normalized product variants)
-- Date: 2026-02-06

CREATE SCHEMA IF NOT EXISTS alphadome;

CREATE TABLE IF NOT EXISTS alphadome.bot_product_variants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES alphadome.bot_products(id) ON DELETE CASCADE,
  variant_sku TEXT UNIQUE,
  name TEXT,
  price NUMERIC(12,2),
  stock_count INTEGER DEFAULT 0,
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON alphadome.bot_product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_variant_sku ON alphadome.bot_product_variants(variant_sku);

-- Verification
SELECT 'variant_table_exists' AS check, COUNT(*) FROM alphadome.bot_product_variants;
