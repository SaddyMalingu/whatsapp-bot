-- Migration: Create product portfolio tables (images + collections)
-- Date: 2026-02-07

CREATE SCHEMA IF NOT EXISTS alphadome;

-- Product images (multiple per product)
CREATE TABLE IF NOT EXISTS alphadome.bot_product_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES alphadome.bot_products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON alphadome.bot_product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON alphadome.bot_product_images(is_primary);

-- Collections (portfolio groups like "Featured", "New Arrivals")
CREATE TABLE IF NOT EXISTS alphadome.bot_collections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_tenant_id uuid REFERENCES alphadome.bot_tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_tenant ON alphadome.bot_collections(bot_tenant_id);

-- Collection items (many-to-many)
CREATE TABLE IF NOT EXISTS alphadome.bot_collection_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id uuid NOT NULL REFERENCES alphadome.bot_collections(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES alphadome.bot_products(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON alphadome.bot_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_product ON alphadome.bot_collection_items(product_id);

-- Verification
SELECT 'product_images_table' AS check, COUNT(*) FROM alphadome.bot_product_images;
SELECT 'collections_table' AS check, COUNT(*) FROM alphadome.bot_collections;
SELECT 'collection_items_table' AS check, COUNT(*) FROM alphadome.bot_collection_items;
