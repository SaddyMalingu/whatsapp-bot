-- RPC: Get all active tenant bots
CREATE OR REPLACE FUNCTION get_active_tenants()
RETURNS TABLE (
  id UUID,
  client_name TEXT,
  client_phone TEXT,
  description TEXT,
  point_of_contact_name TEXT,
  brand_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bt.id,
    bt.client_name,
    bt.client_phone,
    bt.description,
    bt.point_of_contact_name,
    bt.brand_id
  FROM public.bot_tenants bt
  WHERE bt.status = 'active'
  ORDER BY bt.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get tenant by phone
CREATE OR REPLACE FUNCTION get_tenant_by_phone(p_phone TEXT)
RETURNS TABLE (
  id UUID,
  client_name TEXT,
  client_phone TEXT,
  description TEXT,
  point_of_contact_name TEXT,
  point_of_contact_phone TEXT,
  brand_id UUID,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bt.id,
    bt.client_name,
    bt.client_phone,
    bt.description,
    bt.point_of_contact_name,
    bt.point_of_contact_phone,
    bt.brand_id,
    bt.status
  FROM public.bot_tenants bt
  WHERE bt.client_phone = p_phone;
END;
$$ LANGUAGE plpgsql;

-- RPC: Create new tenant
CREATE OR REPLACE FUNCTION create_tenant(
  p_client_name TEXT,
  p_client_phone TEXT,
  p_poc_name TEXT,
  p_poc_phone TEXT,
  p_description TEXT,
  p_brand_id UUID
)
RETURNS TABLE (
  id UUID,
  client_name TEXT,
  client_phone TEXT
) AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  INSERT INTO public.bot_tenants (
    client_name,
    client_phone,
    point_of_contact_name,
    point_of_contact_phone,
    description,
    brand_id,
    status
  ) VALUES (
    p_client_name,
    p_client_phone,
    p_poc_name,
    p_poc_phone,
    p_description,
    p_brand_id,
    'active'
  )
  RETURNING bot_tenants.id INTO v_tenant_id;

  -- Create phone mapping
  INSERT INTO public.whatsapp_phone_tenant_mapping (
    phone,
    tenant_id,
    status
  ) VALUES (
    p_client_phone,
    v_tenant_id,
    'active'
  );

  RETURN QUERY
  SELECT
    bot_tenants.id,
    bot_tenants.client_name,
    bot_tenants.client_phone
  FROM public.bot_tenants
  WHERE bot_tenants.id = v_tenant_id;
END;
$$ LANGUAGE plpgsql;
