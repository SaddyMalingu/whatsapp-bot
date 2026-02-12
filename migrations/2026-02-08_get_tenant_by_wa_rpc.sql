-- Migration: RPC for tenant lookup by WhatsApp metadata (bypass schema cache)
-- Date: 2026-02-08

CREATE SCHEMA IF NOT EXISTS alphadome;

CREATE OR REPLACE FUNCTION public.get_tenant_by_wa(
  business_phone_id text DEFAULT NULL,
  business_account_id text DEFAULT NULL,
  business_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant jsonb;
  v_phone text;
  v_alt_phone text;
BEGIN
  -- normalize phone to digits only
  v_phone := regexp_replace(COALESCE(business_phone, ''), '\\D', '', 'g');

  IF business_phone_id IS NOT NULL AND business_phone_id <> '' THEN
    SELECT to_jsonb(t) INTO v_tenant
    FROM alphadome.bot_tenants t
    WHERE t.whatsapp_phone_number_id = business_phone_id
    LIMIT 1;
  END IF;

  IF v_tenant IS NULL AND business_account_id IS NOT NULL AND business_account_id <> '' THEN
    SELECT to_jsonb(t) INTO v_tenant
    FROM alphadome.bot_tenants t
    WHERE t.whatsapp_business_account_id = business_account_id
    LIMIT 1;
  END IF;

  IF v_tenant IS NULL AND v_phone IS NOT NULL AND v_phone <> '' THEN
    SELECT to_jsonb(t) INTO v_tenant
    FROM alphadome.bot_tenants t
    WHERE t.client_phone = v_phone
    LIMIT 1;

    IF v_tenant IS NULL THEN
      IF v_phone LIKE '254%' THEN
        v_alt_phone := '0' || RIGHT(v_phone, 9);
      ELSIF v_phone LIKE '0%' THEN
        v_alt_phone := '254' || SUBSTRING(v_phone FROM 2);
      END IF;

      IF v_alt_phone IS NOT NULL THEN
        SELECT to_jsonb(t) INTO v_tenant
        FROM alphadome.bot_tenants t
        WHERE t.client_phone = v_alt_phone
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('tenant', v_tenant);
END;
$$;
