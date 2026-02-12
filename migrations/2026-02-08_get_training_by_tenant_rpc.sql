-- Migration: RPC for tenant training data (bypass schema cache)
-- Date: 2026-02-08

CREATE OR REPLACE FUNCTION public.get_training_by_tenant(
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
    ORDER BY t.priority DESC, t.confidence_score DESC, t.created_at ASC
  ) INTO v_items
  FROM alphadome.bot_training_data t
  WHERE t.bot_tenant_id = p_tenant_id
    AND t.is_active = true;

  RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb));
END;
$$;
