-- Migration: RPC for tenant templates (bypass schema cache)
-- Date: 2026-02-08

CREATE OR REPLACE FUNCTION public.get_templates_by_tenant(
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_items jsonb;
BEGIN
  SELECT jsonb_agg(
    to_jsonb(t)
    ORDER BY t.is_default DESC, t.created_at ASC
  ) INTO v_items
  FROM alphadome.bot_templates t
  WHERE t.bot_tenant_id = p_tenant_id
    AND t.is_active = true;

  RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb));
END;
$$;
