import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SERVICE_ROLE_KEY
);

async function checkMigration() {
  console.log("🔍 Checking migration status...\n");

  try {
    // Check 1: Does alphadome schema exist?
    const { data: schemaCheck, error: schemaErr } = await supabase
      .from("information_schema.schemata")
      .select("schema_name")
      .eq("schema_name", "alphadome");

    console.log("Check 1: Alphadome schema");
    if (schemaErr) {
      console.log(`  ✗ Error: ${schemaErr.message}`);
    } else {
      console.log(`  ✓ Schema exists:`, schemaCheck.length > 0 ? "YES" : "NO");
    }

    // Check 2: List all tables in alphadome schema
    const { data: tables, error: tablesErr } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "alphadome")
      .order("table_name");

    console.log("\nCheck 2: Tables in alphadome schema");
    if (tablesErr) {
      console.log(`  ✗ Error: ${tablesErr.message}`);
    } else if (tables && tables.length > 0) {
      console.log(`  ✓ Found ${tables.length} table(s):`);
      tables.forEach(t => console.log(`    - ${t.table_name}`));
    } else {
      console.log("  ⚠️  No tables found in alphadome schema");
    }

    // Check 3: Check bot_tenants specifically
    console.log("\nCheck 3: Check bot_tenants table");
    const { data: tenants, error: tenantsErr } = await supabase
      .from("alphadome.bot_tenants")
      .select("id")
      .limit(1);

    if (tenantsErr) {
      console.log(`  ✗ Error: ${tenantsErr.message}`);
    } else {
      console.log(`  ✓ bot_tenants table is accessible (${tenants.length} rows)`);
    }
  } catch (err) {
    console.error("Fatal error:", err.message);
  }
}

checkMigration();
