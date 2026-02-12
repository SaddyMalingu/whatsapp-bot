# 🔐 META CREDENTIALS CHECKLIST & IMMEDIATE ACTION PLAN

**Date:** February 6, 2026  
**Status:** Ready to Execute Week 1 (Partial - Database + Server Prep)

---

## 📋 META CREDENTIALS NEEDED (For Gideon/Kassangas)

Contact Gideon and request these from Meta Business Manager:

### **Credential 1: WhatsApp Business Phone Number ID**
- **What it is:** Meta's internal ID for the WhatsApp phone number
- **Where to find:** Meta Business Manager → WhatsApp → Phone Numbers → Click phone number → See "Phone Number ID"
- **Format:** Numeric string, e.g., `868405499681303`
- **Current value in .env:** `PHONE_NUMBER_ID=868405499681303`
- **Kassangas value:** DIFFERENT (will be unique to their Meta account)
- **Store in DB:** `alphadome.bot_tenants.whatsapp_phone_number_id`

### **Credential 2: WhatsApp Business Account ID**
- **What it is:** Meta's ID for the business account (optional but recommended)
- **Where to find:** Meta Business Manager → Settings → Info tab → Business ID or WABA ID
- **Format:** Numeric, e.g., `108459245087655`
- **Current value in .env:** Not stored (but used internally)
- **Kassangas value:** Request from Meta
- **Store in DB:** `alphadome.bot_tenants.whatsapp_business_account_id`

### **Credential 3: WhatsApp Access Token** ⚠️ **CRITICAL**
- **What it is:** API token to authenticate WhatsApp API requests
- **Where to find:** Meta Business Manager → Apps → Your App → Messenger → Settings → Token
- **Format:** Long string starting with `EAA...`
- **Current value in .env:** `WHATSAPP_TOKEN=EAAOZAitZCbfIMBP2...`
- **⚠️ IMPORTANT:** This is SECRET - treat like a password
- **Expiry:** May expire (check `whatsapp_token_expires_at`)
- **Kassangas value:** Gideon will need to create/generate this
- **Store in DB:** `alphadome.bot_tenants.whatsapp_access_token` (🔒 ENCRYPTED)
- **Rotation:** Can generate new tokens anytime

### **Credential 4: Verify Token** (Optional, We Control This)
- **What it is:** Security token for webhook verification
- **Where to find:** You define this, tell Meta to use it
- **Format:** Any string you choose, e.g., `my_verify_token_kassangas_v1`
- **Current value in .env:** `VERIFY_TOKEN=my_verify_token`
- **Store in DB:** `alphadome.bot_tenants.webhook_verify_token`
- **Action:** Generate unique token for Kassangas

---

## ✅ WHAT WE CAN DO NOW (While Waiting for Meta Credentials)

### Phase 1A: Database Setup (NO credentials needed yet)
```
✅ Step 1: Run migration #1 (creates empty tables)
   → File: migrations/2025-02-06_add_bot_tenants_schema.sql
   → Action: Copy & run in Supabase SQL Editor
   → Time: 5 minutes
   → No credentials needed

✅ Step 2: Prepare migration #2 (don't run yet, just update template)
   → File: migrations/2025-02-06_setup_kassangas_tenant.sql
   → Action: Edit placeholders (but leave credentials blank for now)
   → Time: 5 minutes
   → Mark: "TODO: Update with Gideon's Meta credentials"
```

### Phase 1B: Server Code Preparation (NO credentials needed yet)
```
✅ Step 3: Create tenant-aware middleware
   → Add: loadTenantContext() function to server.js
   → Time: 30 minutes
   → No credentials needed - it just loads from DB

✅ Step 4: Update webhook handler
   → Refactor: Extract tenant logic
   → Add: Tenant-specific template loading
   → Time: 45 minutes
   → No credentials needed - just routing logic

✅ Step 5: Prepare message generation
   → Refactor: generateReply() to accept tenant config
   → Time: 30 minutes
   → No credentials needed - just function signature
```

### Phase 1C: Testing Preparation (NO credentials needed yet)
```
✅ Step 6: Create test utilities
   → Add: Tenant loading test function
   → Add: Message routing test
   → Time: 30 minutes
   → Can test with mock credentials
```

---

## ⏳ WHAT REQUIRES META CREDENTIALS (Blocked Until Gideon Provides Them)

```
❌ Step 7: Insert Kassangas tenant into DB
   ← Blocked: Need whatsapp_phone_number_id
   ← Blocked: Need whatsapp_access_token
   ← Blocked: Need whatsapp_business_account_id
   → Can do: Once credentials arrive (5 minutes)

❌ Step 8: Test webhook verification
   ← Blocked: Need to tell Meta about Kassangas's webhook URL
   ← Blocked: Need whatsapp_access_token to make test call
   → Can do: Once credentials arrive (10 minutes)

❌ Step 9: Test end-to-end message flow
   ← Blocked: Need Kassangas's WhatsApp token to receive/send
   ← Blocked: Need Kassangas's phone number ID
   → Can do: Once credentials arrive (testing phase)
```

---

## 🎯 IMMEDIATE ACTION PLAN (DO THIS RIGHT NOW)

### **TODAY (Feb 6, ~2 hours of coding)**

**Task 1: Run Database Migration #1** (5 min)
```bash
# Step 1: Go to Supabase → SQL Editor
# Step 2: Copy entire content from:
#        migrations/2025-02-06_add_bot_tenants_schema.sql
# Step 3: Paste into SQL Editor
# Step 4: Click RUN
# Expected: Success - 4 tables created

# Verify with this query:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'alphadome' AND table_name LIKE 'bot_%';

# Expected result:
# bot_tenants
# bot_templates
# bot_training_data
# bot_control_settings
```

**Task 2: Create Tenant-Aware Middleware** (30 min)
```javascript
// Add this to server.js (before webhook handlers)

async function loadTenantContext(req, res, next) {
  // INCOMING MESSAGE
  const incomingPhone = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  
  if (!incomingPhone) {
    return next(); // Not a message, skip
  }

  try {
    // Load tenant by phone number
    const { data: tenant, error } = await supabase
      .from("alphadome.bot_tenants")
      .select("*")
      .eq("client_phone", incomingPhone)
      .single();

    if (error) {
      log(`Tenant not found for ${incomingPhone}: ${error.message}`, "WARN");
      // For now, fall back to DEFAULT_BRAND_ID (backward compatibility)
      req.tenant = null;
      req.isTenantAware = false;
      return next();
    }

    if (!tenant) {
      log(`No tenant config for ${incomingPhone}`, "WARN");
      req.tenant = null;
      req.isTenantAware = false;
      return next();
    }

    // Tenant found - attach to request
    req.tenant = tenant;
    req.isTenantAware = true;
    
    log(`Tenant loaded: ${tenant.client_name} (${incomingPhone})`, "SYSTEM");
    next();
  } catch (err) {
    log(`Error loading tenant context: ${err.message}`, "ERROR");
    req.tenant = null;
    req.isTenantAware = false;
    next();
  }
}

// USE MIDDLEWARE (add before POST /webhook handler)
app.use(loadTenantContext);
```

**Task 3: Update Webhook Handler for Tenant Routing** (45 min)
```javascript
// Modify existing POST /webhook handler to use tenant config

// BEFORE (current):
// ├─ Load user by phone
// ├─ Load DEFAULT_BRAND_ID
// ├─ Generate reply (hardcoded AI model)
// └─ Send via hardcoded WHATSAPP_TOKEN

// AFTER (tenant-aware):
// ├─ Load user by phone
// ├─ Load TENANT if available
// ├─ Load tenant's TEMPLATE
// ├─ Load tenant's TRAINING DATA
// ├─ Generate reply using tenant config
// └─ Send via tenant's WHATSAPP_TOKEN (or fallback to default)

// Key changes:
// 1. Use req.tenant.brand_id instead of DEFAULT_BRAND_ID
// 2. Load template from bot_templates table
// 3. Load training data from bot_training_data table
// 4. Pass tenant config to generateReply()
// 5. Use tenant's WhatsApp token if available
```

**Task 4: Refactor generateReply() Function** (30 min)
```javascript
// BEFORE:
async function generateReply(userMessage) {
  const systemMessage = {
    role: "system",
    content: "You are a helpful WhatsApp assistant for Alphadome..."
  };
  // ... rest of function
}

// AFTER:
async function generateReply(userMessage, tenantConfig = null, trainingData = []) {
  // Use tenant's system prompt if available
  let systemPrompt = "You are a helpful WhatsApp assistant for Alphadome..."; // default
  
  if (tenantConfig?.template?.system_prompt) {
    systemPrompt = tenantConfig.template.system_prompt;
  }
  
  const systemMessage = {
    role: "system",
    content: systemPrompt
  };
  
  // Optional: Inject training data into context
  if (trainingData.length > 0) {
    // Could use RAG here to select relevant training
    log(`Using ${trainingData.length} training entries for response`, "AI");
  }
  
  // ... rest of function (same AI logic)
}
```

**Task 5: Create Test Script** (30 min)
```javascript
// Create: test_tenant_routing.js

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SERVICE_ROLE_KEY
);

async function testTenantLoading() {
  console.log("🔍 Testing Tenant Loading...\n");

  // Test 1: Load Kassangas (once it exists in DB)
  try {
    const { data: kassangas, error } = await supabase
      .from("alphadome.bot_tenants")
      .select("*")
      .eq("client_phone", "254702245555")
      .single();

    if (error) {
      console.log("❌ Kassangas tenant NOT found (expected - wait for credentials)");
      console.log(`   Error: ${error.message}`);
    } else if (kassangas) {
      console.log("✅ Kassangas tenant FOUND");
      console.log(`   Client: ${kassangas.client_name}`);
      console.log(`   Brand ID: ${kassangas.brand_id}`);
      console.log(`   Active: ${kassangas.is_active}`);
    }
  } catch (err) {
    console.error("❌ Test error:", err.message);
  }

  // Test 2: Load templates (once DB has data)
  try {
    const { data: templates, error } = await supabase
      .from("alphadome.bot_templates")
      .select("*")
      .limit(3);

    if (templates && templates.length > 0) {
      console.log(`\n✅ Found ${templates.length} templates`);
      templates.forEach(t => {
        console.log(`   • ${t.template_name} (tenant: ${t.bot_tenant_id})`);
      });
    } else {
      console.log("\n❌ No templates found (expected - wait for credentials)");
    }
  } catch (err) {
    console.error("❌ Templates test error:", err.message);
  }

  // Test 3: Load training data
  try {
    const { data: training, error } = await supabase
      .from("alphadome.bot_training_data")
      .select("*")
      .limit(3);

    if (training && training.length > 0) {
      console.log(`\n✅ Found ${training.length} training entries`);
      training.forEach(t => {
        console.log(`   • [${t.data_type}] ${t.question}`);
      });
    } else {
      console.log("\n❌ No training data found (expected - wait for credentials)");
    }
  } catch (err) {
    console.error("❌ Training data test error:", err.message);
  }

  process.exit(0);
}

testTenantLoading();
```

---

## 📝 PREPARATION CHECKLIST (Do Now)

```
DATABASE LAYER:
  ☐ Run migration: 2025-02-06_add_bot_tenants_schema.sql
  ☐ Verify: 4 new tables exist in Supabase
  ☐ Verify: Tables have correct columns
  ☐ Verify: Indexes created

SERVER CODE LAYER:
  ☐ Create loadTenantContext() middleware
  ☐ Add to server.js BEFORE webhook handlers
  ☐ Refactor generateReply() to accept tenant config
  ☐ Update webhook handler to use req.tenant
  ☐ Create test_tenant_routing.js
  ☐ Run test_tenant_routing.js (should find 0 tenants - expected)

DOCUMENTATION LAYER:
  ☐ Save this checklist locally
  ☐ Share "What Meta Credentials Needed" with Gideon
  ☐ Set reminder: "Ask Gideon for credentials on [DATE]"

BLOCKING ITEMS (Wait for Gideon):
  ⏳ WhatsApp Business Phone Number ID
  ⏳ WhatsApp Business Account ID
  ⏳ WhatsApp Access Token
  → Once received: 30 min to insert into DB + test
```

---

## 📞 MESSAGE TO SEND TO GIDEON

```
Hi Gideon,

We're setting up your Kassangas Music Shop bot in our system. 
To connect it to WhatsApp, I need 3 pieces of information from your Meta Business Manager:

1. **WhatsApp Business Phone Number ID**
   Where: Meta Business Manager → WhatsApp → Phone Numbers → Click your number → "Phone Number ID"
   Example: 868405499681303

2. **WhatsApp Business Account ID** (Optional but helps)
   Where: Meta Business Manager → Settings → Business ID
   Example: 108459245087655

3. **WhatsApp Access Token** ⚠️ KEEP THIS SECRET
   Where: Meta Business Manager → Apps → Your App → Messenger → Settings → Token
   Example: EAA...xyz (long string)
   ⚠️ This is like a password - never share it publicly

Please send these to me and I'll have your bot set up and ready within 30 minutes.

Thanks!
```

---

## 🕐 TIMELINE (What's Realistic)

```
RIGHT NOW (Feb 6):
  ✅ Run migration #1 (5 min)
  ✅ Code tenant middleware (1 hour)
  ✅ Run test script (5 min)
  → Expected: Tests pass, tenants = 0 (no data yet)

WHEN GIDEON RESPONDS (same day or next):
  ✅ Insert Kassangas credentials (5 min)
  ✅ Run migration #2 with credentials (5 min)
  ✅ Test webhook verification (10 min)
  ✅ Test message routing (10 min)
  → Expected: All tests pass, bot fully operational

NEXT WEEK:
  ✅ Fine-tune templates/training
  ✅ Test edge cases
  ✅ Deploy to production
  ✅ Train Gideon on dashboard
```

---

## ❓ WHAT IF GIDEON NEVER PROVIDES CREDENTIALS?

**Fallback Plan:**
```
✓ Server remains backward compatible
✓ Existing DEFAULT_BRAND_ID still works
✓ Gideon can use bot via default account
✓ Can upgrade to tenant-specific setup later
✓ No breaking changes
```

---

## 🎬 START IMMEDIATELY

**Right now, execute this in order:**

```
1. Run: migrations/2025-02-06_add_bot_tenants_schema.sql in Supabase
2. Create: loadTenantContext() middleware in server.js
3. Update: generateReply() function signature
4. Create: test_tenant_routing.js
5. Run: node test_tenant_routing.js
6. Verify: All tests pass (tenants = 0 is OK for now)
7. Commit: Changes to git
8. Send: Credential request to Gideon
9. Wait: For Gideon's response
10. When ready: Run migration #2 (insert Kassangas)
```

**Estimated time:** 2-2.5 hours total coding  
**Dependencies blocked:** None - can do this immediately  
**Risk:** None - backward compatible  

Ready to start? I can provide the exact code snippets and step-by-step implementation next.
