-- Migration: RPC for catalog search (bypass schema cache)
-- Date: 2026-02-07

CREATE SCHEMA IF NOT EXISTS alphadome;

CREATE OR REPLACE FUNCTION public.get_catalog(tenant_phone text, q text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_items jsonb;
BEGIN
  SELECT id INTO v_tenant_id
  FROM alphadome.bot_tenants
  WHERE client_phone = tenant_phone
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant not found for phone: %', tenant_phone;
  END IF;

  WITH products AS (
    SELECT p.id, p.sku, p.name, p.description, p.price, p.currency, p.stock_count, p.metadata
    FROM alphadome.bot_products p
    WHERE p.bot_tenant_id = v_tenant_id
      AND (q IS NULL OR p.sku ILIKE '%' || q || '%' OR p.name ILIKE '%' || q || '%')
    LIMIT 200
  ), images AS (
    SELECT i.product_id, i.image_url, i.is_primary
    FROM alphadome.bot_product_images i
    WHERE i.product_id IN (SELECT id FROM products)
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', p.id,
    'sku', p.sku,
    'name', p.name,
    'description', p.description,
    'price', p.price,
    'currency', p.currency,
    'stock_count', p.stock_count,
    'metadata', p.metadata,
    'primary_image', (
      SELECT image_url FROM images i
      WHERE i.product_id = p.id
      ORDER BY i.is_primary DESC
      LIMIT 1
    )
  )) INTO v_items
  FROM products p;

  RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb));
END;
$$;
