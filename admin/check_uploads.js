/*
  Check if uploads exist for a tenant
  Uses SQL via Supabase RPC to avoid schema cache issues
*/

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE_ROLE_KEY || process.env.SB_ANON_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('Missing SB_URL or SB_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const tenantPhone = process.env.TENANT_PHONE || '0702245555';

async function main() {
  const sql = `
    select
      t.id as tenant_id,
      t.client_phone,
      (select count(*) from alphadome.bot_products p where p.bot_tenant_id = t.id) as products,
      (select count(*) from alphadome.bot_product_images i where i.product_id in (select id from alphadome.bot_products p2 where p2.bot_tenant_id = t.id)) as images,
      (select count(*) from alphadome.bot_product_variants v where v.product_id in (select id from alphadome.bot_products p3 where p3.bot_tenant_id = t.id)) as variants,
      (select count(*) from alphadome.bot_collections c where c.bot_tenant_id = t.id) as collections,
      (select count(*) from alphadome.bot_collection_items ci where ci.collection_id in (select id from alphadome.bot_collections c2 where c2.bot_tenant_id = t.id)) as collection_items
    from alphadome.bot_tenants t
    where t.client_phone = '${tenantPhone}'
    limit 1;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql, params: '[]' });
  if (error) {
    console.error('RPC exec_sql failed:', error.message);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch(e => { console.error(e.message); process.exit(1); });
