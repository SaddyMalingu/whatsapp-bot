-- Migration: RPC for portfolio seeding (bypass schema cache)
-- Date: 2026-02-07

CREATE SCHEMA IF NOT EXISTS alphadome;

-- Ensure unique keys for safe upserts
-- Remove duplicates before adding unique indexes
WITH ranked_products AS (
  SELECT id,
         bot_tenant_id,
         sku,
         ROW_NUMBER() OVER (PARTITION BY bot_tenant_id, sku ORDER BY created_at DESC, id DESC) AS rn
  FROM alphadome.bot_products
)
DELETE FROM alphadome.bot_products p
USING ranked_products r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_products_tenant_sku
  ON alphadome.bot_products(bot_tenant_id, sku);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_collections_tenant_name
  ON alphadome.bot_collections(bot_tenant_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_unique
  ON alphadome.bot_collection_items(collection_id, product_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_unique
  ON alphadome.bot_product_images(product_id, image_url);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku
  ON alphadome.bot_product_variants(variant_sku);

-- RPC: seed portfolio by tenant phone
CREATE OR REPLACE FUNCTION public.seed_portfolio(tenant_phone text, payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_products_count int := 0;
  v_variants_count int := 0;
  v_images_count int := 0;
  v_collections_count int := 0;
  v_items_count int := 0;
BEGIN
  SELECT id INTO v_tenant_id
  FROM alphadome.bot_tenants
  WHERE client_phone = tenant_phone
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant not found for phone: %', tenant_phone;
  END IF;

  -- Products
  IF payload ? 'products' THEN
    INSERT INTO alphadome.bot_products (
      bot_tenant_id, sku, name, description, price, currency, stock_count, image_url, metadata
    )
    SELECT
      v_tenant_id,
      p.sku,
      p.name,
      p.description,
      p.price,
      p.currency,
      p.stock_count,
      p.image_url,
      p.metadata
    FROM jsonb_to_recordset(payload->'products') AS p(
      sku text,
      name text,
      description text,
      price numeric,
      currency text,
      stock_count int,
      image_url text,
      metadata jsonb
    )
    ON CONFLICT (bot_tenant_id, sku)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      currency = EXCLUDED.currency,
      stock_count = EXCLUDED.stock_count,
      image_url = EXCLUDED.image_url,
      metadata = COALESCE(alphadome.bot_products.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
      updated_at = now();

    GET DIAGNOSTICS v_products_count = ROW_COUNT;
  END IF;

  -- Variants
  IF payload ? 'variants' THEN
    INSERT INTO alphadome.bot_product_variants (
      product_id, variant_sku, name, price, stock_count, metadata
    )
    SELECT
      prod.id,
      v.variant_sku,
      v.name,
      v.price,
      v.stock_count,
      v.metadata
    FROM jsonb_to_recordset(payload->'variants') AS v(
      product_sku text,
      variant_sku text,
      name text,
      price numeric,
      stock_count int,
      metadata jsonb
    )
    JOIN alphadome.bot_products prod
      ON prod.bot_tenant_id = v_tenant_id
     AND prod.sku = v.product_sku
    ON CONFLICT (variant_sku)
    DO UPDATE SET
      name = EXCLUDED.name,
      price = EXCLUDED.price,
      stock_count = EXCLUDED.stock_count,
      metadata = COALESCE(alphadome.bot_product_variants.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
      updated_at = now();

    GET DIAGNOSTICS v_variants_count = ROW_COUNT;
  END IF;

  -- Images
  IF payload ? 'images' THEN
    INSERT INTO alphadome.bot_product_images (
      product_id, image_url, alt_text, sort_order, is_primary, metadata
    )
    SELECT
      prod.id,
      i.image_url,
      i.alt_text,
      COALESCE(i.sort_order, 0),
      COALESCE(i.is_primary, false),
      i.metadata
    FROM jsonb_to_recordset(payload->'images') AS i(
      product_sku text,
      image_url text,
      alt_text text,
      sort_order int,
      is_primary boolean,
      metadata jsonb
    )
    JOIN alphadome.bot_products prod
      ON prod.bot_tenant_id = v_tenant_id
     AND prod.sku = i.product_sku
    ON CONFLICT (product_id, image_url) DO NOTHING;

    GET DIAGNOSTICS v_images_count = ROW_COUNT;
  END IF;

  -- Collections
  IF payload ? 'collections' THEN
    INSERT INTO alphadome.bot_collections (
      bot_tenant_id, name, description, is_active, sort_order, metadata
    )
    SELECT
      v_tenant_id,
      c.name,
      c.description,
      COALESCE(c.is_active, true),
      COALESCE(c.sort_order, 0),
      c.metadata
    FROM jsonb_to_recordset(payload->'collections') AS c(
      name text,
      description text,
      is_active boolean,
      sort_order int,
      metadata jsonb
    )
    ON CONFLICT (bot_tenant_id, name)
    DO UPDATE SET
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active,
      sort_order = EXCLUDED.sort_order,
      metadata = COALESCE(alphadome.bot_collections.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
      updated_at = now();

    GET DIAGNOSTICS v_collections_count = ROW_COUNT;
  END IF;

  -- Collection items
  IF payload ? 'collection_items' THEN
    INSERT INTO alphadome.bot_collection_items (
      collection_id, product_id, sort_order, metadata
    )
    SELECT
      col.id,
      prod.id,
      COALESCE(ci.sort_order, 0),
      ci.metadata
    FROM jsonb_to_recordset(payload->'collection_items') AS ci(
      collection_name text,
      product_sku text,
      sort_order int,
      metadata jsonb
    )
    JOIN alphadome.bot_collections col
      ON col.bot_tenant_id = v_tenant_id
     AND col.name = ci.collection_name
    JOIN alphadome.bot_products prod
      ON prod.bot_tenant_id = v_tenant_id
     AND prod.sku = ci.product_sku
    ON CONFLICT (collection_id, product_id) DO NOTHING;

    GET DIAGNOSTICS v_items_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'products_upserted', v_products_count,
    'variants_upserted', v_variants_count,
    'images_inserted', v_images_count,
    'collections_upserted', v_collections_count,
    'collection_items_inserted', v_items_count
  );
END;
$$;
