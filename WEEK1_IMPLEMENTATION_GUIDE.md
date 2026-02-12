# 🚀 WEEK 1-2 IMPLEMENTATION: Step-by-Step Guide

**Status:** Ready to Execute Now  
**Timeline:** 2-3 hours of coding  
**Blocking:** Nothing - can do immediately  

---

## STEP-BY-STEP IMPLEMENTATION

### **STEP 1: Run Database Migration #1** ✅ (5 minutes)

This creates the 4 new database tables. No code changes, no credentials needed.

```bash
# Go to: Supabase Dashboard → SQL Editor
# Copy entire file: migrations/2025-02-06_add_bot_tenants_schema.sql
# Paste into SQL Editor
# Click: RUN

# Verify - Run this query:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'alphadome' AND table_name LIKE 'bot_%'
ORDER BY table_name;

# Expected result (4 rows):
# bot_control_settings
# bot_tenants
# bot_templates
# bot_training_data
```

---

### **STEP 2: Add Middleware to server.js** ✅ (30 minutes)

This adds tenant-awareness to the server without breaking existing code.

#### **2A. Add imports (if needed)**
```javascript
// Check if these are already imported (they should be):
// import { createClient } from "@supabase/supabase-js";
// import { log } from "./utils/logger.js";
// (They're already there, so skip this)
```

#### **2B. Add middleware functions**

Open `server.js` and find line 50 (after the `getPaymentAmount` function).

Copy these functions and **insert them there** (before the webhook handlers):

```javascript
// ========== MULTI-TENANT SUPPORT: Load Tenant Context ==========
async function loadTenantContext(req, res, next) {
  try {
    const incomingPhone = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
    
    if (!incomingPhone) {
      req.tenant = null;
      req.isTenantAware = false;
      return next();
    }

    const { data: tenant, error } = await supabase
      .from("alphadome.bot_tenants")
      .select("*")
      .eq("client_phone", incomingPhone)
      .single();

    if (error && error.code !== "PGRST116") {
      log(`Tenant lookup error for ${incomingPhone}: ${error.message}`, "WARN");
      req.tenant = null;
      req.isTenantAware = false;
      return next();
    }

    if (!tenant) {
      log(`No tenant found for ${incomingPhone} - using default`, "DEBUG");
      req.tenant = null;
      req.isTenantAware = false;
      return next();
    }

    if (!tenant.is_active) {
      log(`Tenant ${tenant.client_name} is inactive - using fallback`, "WARN");
      req.tenant = null;
      req.isTenantAware = false;
      return next();
    }

    req.tenant = tenant;
    req.isTenantAware = true;
    log(`✓ Tenant loaded: ${tenant.client_name} (${incomingPhone})`, "SYSTEM");
    next();
  } catch (err) {
    log(`Error in loadTenantContext: ${err.message}`, "ERROR");
    req.tenant = null;
    req.isTenantAware = false;
    next();
  }
}

// ========== Load Tenant Templates ==========
async function loadTenantTemplates(tenantId) {
  if (!tenantId) return [];
  try {
    const { data: templates, error } = await supabase
      .from("alphadome.bot_templates")
      .select("*")
      .eq("bot_tenant_id", tenantId)
      .eq("is_active", true)
      .order("is_default", { ascending: false });

    if (error) {
      log(`Error loading templates: ${error.message}`, "ERROR");
      return [];
    }
    return templates || [];
  } catch (err) {
    log(`Exception loading templates: ${err.message}`, "ERROR");
    return [];
  }
}

// ========== Load Tenant Training Data ==========
async function loadTenantTrainingData(tenantId) {
  if (!tenantId) return [];
  try {
    const { data: training, error } = await supabase
      .from("alphadome.bot_training_data")
      .select("*")
      .eq("bot_tenant_id", tenantId)
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("confidence_score", { ascending: false });

    if (error) {
      log(`Error loading training data: ${error.message}`, "ERROR");
      return [];
    }
    return training || [];
  } catch (err) {
    log(`Exception loading training data: ${err.message}`, "ERROR");
    return [];
  }
}

// ========== Get System Prompt ==========
function getSystemPrompt(tenant = null, templates = []) {
  if (templates.length > 0) {
    const defaultTemplate = templates.find(t => t.is_default) || templates[0];
    if (defaultTemplate?.system_prompt) {
      return defaultTemplate.system_prompt;
    }
  }
  return `You are a helpful WhatsApp assistant for Alphadome. Be professional, warm, and concise. Encourage users to explore Alphadome's digital ecosystem and community.`;
}

// ========== Get Decrypted Credentials ==========
function getDecryptedCredentials(tenant) {
  if (!tenant) {
    return {
      whatsappToken: process.env.WHATSAPP_TOKEN,
      aiApiKey: process.env.OPENAI_API_KEY,
      aiProvider: "openai",
      aiModel: "gpt-4o-mini",
    };
  }
  return {
    whatsappToken: tenant.whatsapp_access_token || process.env.WHATSAPP_TOKEN,
    aiApiKey: tenant.ai_api_key || process.env.OPENAI_API_KEY,
    aiProvider: tenant.ai_provider || "openai",
    aiModel: tenant.ai_model || "gpt-4o-mini",
  };
}
```

---

### **STEP 3: Update generateReply() Function** ✅ (30 minutes)

Find the existing `generateReply()` function (around line 850+).

**Replace it with this tenant-aware version:**

```javascript
async function generateReply(userMessage, tenant = null, templates = null, trainingData = []) {
  const systemPromptContent = getSystemPrompt(tenant, templates || []);
  
  const systemMessage = {
    role: "system",
    content: systemPromptContent,
  };

  // Try to match user message with training data (FAQ/canned replies)
  if (trainingData.length > 0) {
    for (const entry of trainingData) {
      if (entry.data_type === "faq" && entry.question && entry.answer) {
        if (
          userMessage.toLowerCase().includes(entry.question.toLowerCase()) ||
          entry.question.toLowerCase().includes(userMessage.toLowerCase())
        ) {
          log(`✓ Matched training data: ${entry.category || "General"}`, "AI");
          return entry.answer;
        }
      }
    }
  }

  const creds = getDecryptedCredentials(tenant);

  // 1️⃣ Try OpenAI first
  try {
    const openaiClient = new OpenAI({
      apiKey: creds.aiApiKey,
    });

    const completion = await openaiClient.chat.completions.create({
      model: creds.aiModel,
      messages: [systemMessage, { role: "user", content: userMessage }],
    });

    const reply = completion.choices[0].message.content;
    log(`✓ ${creds.aiProvider} reply: ${reply.substring(0, 50)}...`, "AI");
    return reply;
  } catch (openAIErr) {
    incrementErrorCount();
    log(`${creds.aiProvider} error: ${openAIErr.message}`, "ERROR");
  }

  // 2️⃣ Fallback to OpenRouter
  try {
    const routerResponse = await axios.post(
      "https://api.openrouter.ai/v1/chat/completions",
      {
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [systemMessage, { role: "user", content: userMessage }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (routerResponse.data?.choices?.length > 0) {
      const routerReply = routerResponse.data.choices[0].message.content;
      log(`✓ OpenRouter reply: ${routerReply.substring(0, 50)}...`, "AI");
      return routerReply;
    }
  } catch (routerErr) {
    log(`OpenRouter error: ${routerErr.message}`, "ERROR");
  }

  // 3️⃣ Fallback to Hugging Face
  try {
    const hfResponse = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "meta-llama/Llama-3.1-8B-Instruct:novita",
        messages: [systemMessage, { role: "user", content: userMessage }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (hfResponse.data?.choices?.length > 0) {
      const hfReply = hfResponse.data.choices[0].message.content;
      log(`✓ HuggingFace reply: ${hfReply.substring(0, 50)}...`, "AI");
      return hfReply;
    }
  } catch (hfErr) {
    log(`HuggingFace error: ${hfErr.message}`, "ERROR");
  }

  // 4️⃣ Static fallback
  return fallbackMessage();
}
```

---

### **STEP 4: Update POST /webhook Handler** ✅ (45 minutes)

Find the existing `app.post("/webhook", async (req, res) => {` handler (around line 80).

**Key changes:**
1. Add `loadTenantContext` to the handler
2. Extract brand_id from tenant
3. Load templates and training data
4. Pass to generateReply()

**Replace the handler like this:**

```javascript
app.post("/webhook", loadTenantContext, async (req, res) => {
  const body = req.body;

  if (!body.object) {
    log("Webhook received non-message event", "DEBUG");
    return res.sendStatus(404);
  }

  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.trim();
  const waMessageId = message.id;
  const rawPayload = body.entry?.[0]?.changes?.[0]?.value;

  if (!text) return res.sendStatus(200);

  log(`Received from ${from}: ${text}`, "INCOMING");

  try {
    // STEP 1: Find or create user
    let { data: userData, error: userErr } = await supabase
      .from("users")
      .select("id, phone")
      .eq("phone", from)
      .maybeSingle();

    if (userErr) throw userErr;

    if (!userData) {
      const { data: newUser, error: newUserErr } = await supabase
        .from("users")
        .insert([{ phone: from, full_name: "Unknown User" }])
        .select("id")
        .single();

      if (newUserErr) throw newUserErr;
      userData = newUser;
      log(`New user created: ${from}`, "SYSTEM");
    }

    // STEP 2: Identify brand (TENANT-AWARE)
    let brandId = DEFAULT_BRAND_ID;
    
    if (req.isTenantAware && req.tenant?.brand_id) {
      brandId = req.tenant.brand_id;
      log(`Using tenant brand: ${req.tenant.client_name}`, "SYSTEM");
    } else {
      try {
        const { data: brandData, error: brandErr } = await supabase
          .from("brands")
          .select("id")
          .eq("is_platform_owner", true)
          .limit(1)
          .single();

        if (!brandErr && brandData) {
          brandId = brandData.id;
        }
      } catch {
        brandId = DEFAULT_BRAND_ID;
      }
    }

    // [KEEP ALL EXISTING CODE HERE - JOIN ALPHADOME / STK / M-Pesa handlers]
    // ... (all the subscription logic remains the same) ...

    // STEP 3: Load tenant-specific configuration (NEW)
    let templates = [];
    let trainingData = [];
    
    if (req.isTenantAware && req.tenant?.id) {
      templates = await loadTenantTemplates(req.tenant.id);
      trainingData = await loadTenantTrainingData(req.tenant.id);
      log(
        `Loaded ${templates.length} templates and ${trainingData.length} training entries`,
        "SYSTEM"
      );
    }

    // STEP 4: Log inbound message
    const { error: convErr } = await supabase.from("conversations").insert([
      {
        brand_id: brandId,
        user_id: userData.id,
        whatsapp_message_id: waMessageId,
        direction: "incoming",
        raw_payload: rawPayload,
        message_text: text,
        created_at: new Date().toISOString(),
      },
    ]);
    if (convErr) throw convErr;

    // STEP 5: Generate AI reply (TENANT-AWARE)
    const reply = await generateReply(
      text,
      req.tenant || null,
      templates.length > 0 ? templates : null,
      trainingData
    );
    
    await sendMessage(from, reply);

    // STEP 6: Log outbound message
    const { error: outErr } = await supabase.from("conversations").insert([
      {
        brand_id: brandId,
        user_id: userData.id,
        direction: "outgoing",
        message_text: reply,
        created_at: new Date().toISOString(),
      },
    ]);
    if (outErr) throw outErr;

  } catch (err) {
    log(`Error processing message from ${from}: ${err.message}`, "ERROR");
  }

  res.sendStatus(200);
});
```

---

### **STEP 5: Test the Changes** ✅ (10 minutes)

```bash
# 1. Install chalk for colored output (if not installed)
npm install chalk

# 2. Run the test script
node test_tenant_setup.js

# Expected output:
# ✓ All 4 tables exist
# ✓ No tenants found yet (expected)
# ⏳ Gideon's tenant not found yet (expected)
# ✓ Tests passed
```

---

### **STEP 6: Commit Changes** ✅ (5 minutes)

```bash
# 1. Stage changes
git add server.js test_tenant_setup.js

# 2. Commit
git commit -m "feat: add multi-tenant support (Week 1)

- Added loadTenantContext middleware
- Updated generateReply() for tenant config
- Updated webhook handler for tenant routing
- Added test_tenant_setup.js for verification
- Backward compatible with existing code
- Awaiting Gideon's Meta credentials for activation"

# 3. Push (optional)
git push origin main
```

---

### **STEP 7: Share Credential Request** ✅ (5 minutes)

Send this to Gideon:

```
Hi Gideon,

We're setting up Kassangas Music Shop's WhatsApp bot. 
To complete the setup, I need 3 pieces from your Meta Business Manager:

1. WhatsApp Business Phone Number ID
   (Found at: Meta Business Manager → WhatsApp → Phone Numbers)
   Example: 868405499681303

2. WhatsApp Business Account ID (Optional but helpful)
   (Found at: Meta Business Manager → Settings → Business ID)
   Example: 108459245087655

3. WhatsApp Access Token ⚠️ KEEP THIS SECRET
   (Found at: Meta Business Manager → Apps → Your App → Messenger → Token)
   Example: EAA...xyz (very long string)

Please reply with these and I'll activate your bot within 30 minutes.

Thanks!
```

---

### **STEP 8: When Gideon Responds** ⏳ (30 minutes)

Once you have the credentials:

```bash
# 1. Open: migrations/2025-02-06_setup_kassangas_tenant.sql
#    Update these 3 placeholders:
#    - whatsapp_phone_number_id: '868405499681303' → Use Gideon's value
#    - whatsapp_access_token: 'EAAOZAitZCbfIMBP2...' → Use Gideon's value
#    - client_email: 'gideon@kassangas.example.com' → Use Gideon's email

# 2. Go to: Supabase → SQL Editor
#    Copy & paste the updated migration
#    Click: RUN

# 3. Run verification:
node test_tenant_setup.js

# Expected output:
# ✓ Kassangas tenant found!
# ✓ 3 templates loaded
# ✓ 9 training entries loaded
# ✓ All tests passed
```

---

## 📋 IMPLEMENTATION CHECKLIST

**BEFORE RUNNING:**
- [ ] Have server.js open
- [ ] Have TENANT_MIDDLEWARE_CODE.js open (reference)
- [ ] Have test_tenant_setup.js ready to run

**DATABASE (Step 1):**
- [ ] Run migration #1 in Supabase
- [ ] Verify 4 tables created
- [ ] Copy paste all verification queries work

**SERVER CODE (Steps 2-4):**
- [ ] Add loadTenantContext() function
- [ ] Add loadTenantTemplates() function
- [ ] Add loadTenantTrainingData() function
- [ ] Add getSystemPrompt() function
- [ ] Add getDecryptedCredentials() function
- [ ] Update generateReply() function
- [ ] Update POST /webhook handler
- [ ] Verify server.js syntax (npm start should work)

**TESTING (Step 5):**
- [ ] Run: node test_tenant_setup.js
- [ ] All tests pass
- [ ] No console errors

**GIT (Step 6):**
- [ ] Commit changes
- [ ] Push to branch (or main)

**COMMUNICATION (Step 7):**
- [ ] Send credential request to Gideon
- [ ] Wait for response

**ACTIVATION (Step 8, when credentials arrive):**
- [ ] Update migration #2 with credentials
- [ ] Run migration #2 in Supabase
- [ ] Rerun test_tenant_setup.js
- [ ] Verify Kassangas tenant created
- [ ] Test end-to-end message flow

---

## 🎯 EXPECTED OUTCOMES

**After Step 7:**
- ✅ Server updated with tenant awareness
- ✅ Backward compatible (existing code still works)
- ✅ Ready for Gideon's credentials
- ✅ Test script confirms setup

**After Step 8 (when credentials arrive):**
- ✅ Kassangas tenant in database
- ✅ Templates & training data loaded
- ✅ Bot routes messages to Kassangas config
- ✅ Full multi-tenant support active

---

**Time estimate:** 2-3 hours total  
**Blocking items:** None (code can be done immediately)  
**Risk level:** Low (backward compatible, additive changes)  
**Dependencies:** Gideon's Meta credentials (not blocking code changes)

Ready to start? Begin with **STEP 1**.
