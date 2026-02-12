-- Migration: RPC for conversation context (bypass schema cache)
-- Date: 2026-02-08

CREATE OR REPLACE FUNCTION public.get_conversation_context(
  p_user_id uuid,
  p_brand_id uuid,
  p_limit integer DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_items jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'direction', c.direction,
      'message_text', c.message_text,
      'created_at', c.created_at
    )
    ORDER BY c.created_at ASC
  ) INTO v_items
  FROM (
    SELECT direction, message_text, created_at
    FROM public.conversations
    WHERE user_id = p_user_id
      AND brand_id = p_brand_id
      AND message_text IS NOT NULL
    ORDER BY created_at DESC
    LIMIT COALESCE(p_limit, 8)
  ) c;

  RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb));
END;
$$;
