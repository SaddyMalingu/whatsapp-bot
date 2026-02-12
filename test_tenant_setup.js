#!/usr/bin/env node

/**
 * Test Script: Verify Multi-Tenant Database Setup
 * 
 * Run this after migrations to confirm:
 * 1. Tables created successfully
 * 2. Kassangas tenant can be queried (once credentials added)
 * 3. Templates and training data can be loaded
 * 4. Tenant-aware routing works
 * 
 * Usage:
 *   node test_tenant_setup.js
 * 
 * Expected output:
 *   ✓ All 4 tables exist
 *   ✓ No tenants found yet (expected - wait for credentials)
 *   ✓ Tenant loading logic works
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import chalk from "chalk";

dotenv.config();

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SERVICE_ROLE_KEY
);

// Color output
const green = (msg) => console.log(chalk.green("✓ " + msg));
const red = (msg) => console.log(chalk.red("✗ " + msg));
const blue = (msg) => console.log(chalk.blue("ℹ " + msg));
const yellow = (msg) => console.log(chalk.yellow("⏳ " + msg));

async function runTests() {
  console.log(chalk.bold.cyan("\n🧪 MULTI-TENANT SETUP TESTS\n"));

  let passCount = 0;
  let failCount = 0;

  // TEST 1: Check if all 4 tables exist
  console.log(chalk.bold("Test 1: Verify Database Tables"));
  console.log("─".repeat(50));

  try {
    const tables = [
      "alphadome.bot_tenants",
      "alphadome.bot_templates",
      "alphadome.bot_training_data",
      "alphadome.bot_control_settings",
    ];

    for (const table of tables) {
      const tableName = table.split(".")[1];
      const { data, error } = await supabase.from(table).select("*").limit(1);

      if (error && error.code !== "PGRST116") {
        // PGRST116 = table exists but empty
        red(`Table ${tableName}: ${error.message}`);
        failCount++;
      } else {
        green(`Table ${tableName} exists`);
        passCount++;
      }
    }
  } catch (err) {
    red(`Tables check failed: ${err.message}`);
    failCount++;
  }

  // TEST 2: Count existing tenants
  console.log("\n" + chalk.bold("Test 2: Check Existing Tenants"));
  console.log("─".repeat(50));

  try {
    const { data: tenants, error } = await supabase
      .from("alphadome.bot_tenants")
      .select("id, client_name, client_phone, is_active");

    if (error) {
      red(`Failed to load tenants: ${error.message}`);
      failCount++;
    } else if (!tenants || tenants.length === 0) {
      yellow(
        "No tenants found (expected - waiting for Gideon's Meta credentials)"
      );
      passCount++;
    } else {
      green(`Found ${tenants.length} tenant(s)`);
      tenants.forEach((t) => {
        blue(
          `  • ${t.client_name} (${t.client_phone}) - Active: ${t.is_active}`
        );
      });
      passCount++;
    }
  } catch (err) {
    red(`Tenant count failed: ${err.message}`);
    failCount++;
  }

  // TEST 3: Simulate Gideon lookup
  console.log("\n" + chalk.bold("Test 3: Simulate Tenant Lookup (Gideon)"));
  console.log("─".repeat(50));

  try {
    const gideonPhone = "254702245555";
    const { data: tenant, error } = await supabase
      .from("alphadome.bot_tenants")
      .select("*")
      .eq("client_phone", gideonPhone)
      .single();

    if (error && error.code === "PGRST116") {
      yellow(`Gideon's tenant not found yet (${gideonPhone})`);
      yellow("This is expected - waiting for credentials to be added");
      passCount++;
    } else if (error) {
      red(`Lookup failed: ${error.message}`);
      failCount++;
    } else if (tenant) {
      green(`✓ Gideon's tenant found!`);
      blue(`  • Client: ${tenant.client_name}`);
      blue(`  • Phone: ${tenant.client_phone}`);
      blue(`  • Active: ${tenant.is_active}`);
      blue(`  • Verified: ${tenant.is_verified}`);
      passCount++;
    }
  } catch (err) {
    red(`Gideon lookup failed: ${err.message}`);
    failCount++;
  }

  // TEST 4: Check templates (should be empty until setup)
  console.log("\n" + chalk.bold("Test 4: Check Templates"));
  console.log("─".repeat(50));

  try {
    const { data: templates, error } = await supabase
      .from("alphadome.bot_templates")
      .select("id, bot_tenant_id, template_name, is_default");

    if (error) {
      red(`Failed to load templates: ${error.message}`);
      failCount++;
    } else if (!templates || templates.length === 0) {
      yellow("No templates found (expected - waiting for setup)");
      passCount++;
    } else {
      green(`Found ${templates.length} template(s)`);
      templates.forEach((t) => {
        blue(
          `  • ${t.template_name} (tenant: ${t.bot_tenant_id}) - Default: ${t.is_default}`
        );
      });
      passCount++;
    }
  } catch (err) {
    red(`Templates check failed: ${err.message}`);
    failCount++;
  }

  // TEST 5: Check training data (should be empty until setup)
  console.log("\n" + chalk.bold("Test 5: Check Training Data"));
  console.log("─".repeat(50));

  try {
    const { data: training, error } = await supabase
      .from("alphadome.bot_training_data")
      .select("id, bot_tenant_id, data_type, question");

    if (error) {
      red(`Failed to load training data: ${error.message}`);
      failCount++;
    } else if (!training || training.length === 0) {
      yellow("No training data found (expected - waiting for setup)");
      passCount++;
    } else {
      green(`Found ${training.length} training entry(ies)`);
      training.forEach((t) => {
        blue(`  • [${t.data_type}] ${t.question || "(canned reply)"}`);
      });
      passCount++;
    }
  } catch (err) {
    red(`Training data check failed: ${err.message}`);
    failCount++;
  }

  // TEST 6: Verify control settings table exists
  console.log("\n" + chalk.bold("Test 6: Check Control Settings"));
  console.log("─".repeat(50));

  try {
    const { data: settings, error } = await supabase
      .from("alphadome.bot_control_settings")
      .select("id, bot_tenant_id, is_bot_enabled");

    if (error) {
      red(`Failed to load settings: ${error.message}`);
      failCount++;
    } else if (!settings || settings.length === 0) {
      yellow("No settings found (expected - waiting for setup)");
      passCount++;
    } else {
      green(`Found ${settings.length} control setting(s)`);
      passCount++;
    }
  } catch (err) {
    red(`Control settings check failed: ${err.message}`);
    failCount++;
  }

  // SUMMARY
  console.log("\n" + "═".repeat(50));
  console.log(chalk.bold("\n📊 TEST SUMMARY\n"));
  console.log(
    chalk.green(`✓ Passed: ${passCount}`) + " / " + chalk.red(`✗ Failed: ${failCount}`)
  );

  if (failCount === 0) {
    console.log(
      chalk.bold.green(
        "\n✅ All tests passed! Database is ready for multi-tenant setup.\n"
      )
    );
    console.log(chalk.cyan("Next steps:"));
    console.log("  1. Share META_CREDENTIALS_CHECKLIST.md with Gideon");
    console.log("  2. Wait for Gideon to provide Meta credentials");
    console.log("  3. Run: migrations/2025-02-06_setup_kassangas_tenant.sql");
    console.log("  4. Rerun this test to verify Gideon's tenant was created");
  } else {
    console.log(
      chalk.bold.red(
        `\n❌ ${failCount} test(s) failed. Check the error messages above.\n`
      )
    );
  }

  console.log("═".repeat(50) + "\n");

  process.exit(failCount === 0 ? 0 : 1);
}

// Run tests
runTests().catch((err) => {
  red(`Unexpected error: ${err.message}`);
  process.exit(1);
});
