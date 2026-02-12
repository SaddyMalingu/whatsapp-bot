# 🚀 ALPHADOME MULTI-TENANT BOT DEPLOYMENT

## Overview

This directory now contains a **complete plan to deploy your WhatsApp bot to multiple clients** (starting with Kassangas Music Shop) **without redeploying your application**.

**Key Achievement:** Gideon (0702245555) is confirmed in your database, and a secure, isolated multi-tenant infrastructure is designed and ready for implementation.

---

## 📁 What's New (Files Created Feb 6, 2026)

### Planning & Documentation
- **`EXECUTIVE_SUMMARY.md`** ← **START HERE** 
  - High-level overview of the problem, solution, and next steps
  - 5-minute read for non-technical stakeholders

- **`DEPLOYMENT_PLAN.md`**
  - Detailed 4-week implementation roadmap
  - Phase-by-phase breakdown (DB, server code, dashboard, launch)
  - Security checklist for multi-tenant isolation

- **`DB_ALIGNMENT_REPORT.md`**
  - Technical deep-dive into database schema (current vs. new)
  - Data isolation verification matrix
  - Encryption strategy recommendations

### SQL Migrations
- **`migrations/2025-02-06_add_bot_tenants_schema.sql`**
  - Adds 4 new tables to `alphadome` schema:
    - `bot_tenants` - Per-client configuration
    - `bot_templates` - Per-client conversation templates
    - `bot_training_data` - Per-client FAQ & training
    - `bot_control_settings` - Per-client feature toggles
  - Non-breaking, additive (existing system still works)

- **`migrations/2025-02-06_setup_kassangas_tenant.sql`**
  - Pre-configured setup for Kassangas Music Shop
  - Inserts default templates (welcome, product inquiry, support)
  - Inserts training data (FAQ about hours, products, payment)
  - Ready to run after main migration (just update credentials)

---

## 🎯 Quick Start (What to Do Now)

### Week 1: Database Setup
```bash
# 1. Go to Supabase → SQL Editor
#    Copy & paste: migrations/2025-02-06_add_bot_tenants_schema.sql
#    Run it

# 2. Go to Supabase → SQL Editor
#    Copy & paste: migrations/2025-02-06_setup_kassangas_tenant.sql
#    Update these placeholders:
#      - whatsapp_phone_number_id (from Meta)
#      - whatsapp_access_token (from Meta)
#      - client_email (ask Gideon)
#    Run it

# 3. Verify the setup
#    Run the verification queries at the end of the Kassangas script
```

### Week 2: Server Code Update
- Modify `server.js` to load tenant config on incoming messages
- See `DEPLOYMENT_PLAN.md` section 7 for pseudocode

### Week 3: Dashboard (Optional)
- Build a simple UI to manage tenants, templates, and training data

### Week 4: Go Live
- Test Kassangas end-to-end
- Point their WhatsApp webhook to your updated handler
- Monitor and support

---

## 🏗️ Architecture (The Problem & Solution)

### Current System (Single Tenant)
```
WhatsApp → server.js → Uses HARDCODED token → All clients share credentials
```
**Problem:** Can't scale to multiple clients safely

### New System (Multi-Tenant)
```
WhatsApp → server.js (tenant-aware) → Load tenant config from DB → Use tenant's token
```
**Benefit:** Scale to 100+ clients, each with isolated credentials & data

---

## 🔒 Data Isolation (What's Protected)

| Aspect | Before | After |
|--------|--------|-------|
| WhatsApp Token | Shared | Each client has own |
| OpenAI Key | Shared | Each client has own |
| Conversation Template | Shared | Each client has own |
| FAQ/Training Data | Shared | Each client has own |
| Feature Toggles | Shared | Each client controls independently |
| Logs | All mixed | (Optional) Per-client logs |

---

## 📋 Database Schema (New Tables)

### `alphadome.bot_tenants`
Master config for each client:
```
id (uuid)                    → Primary key
client_name (text)           → "Kassangas Music Shop"
client_phone (text UNIQUE)   → "254702245555"
whatsapp_phone_number_id     → Meta Phone ID
whatsapp_access_token        → 🔒 ENCRYPTED
ai_api_key                   → 🔒 ENCRYPTED
is_active (boolean)          → Turn bot on/off per client
webhook_verify_token         → Unique per client
```

### `alphadome.bot_templates`
Per-client conversation templates:
```
bot_tenant_id → Links to bot_tenants
template_name → "default", "product_inquiry", "support"
system_prompt → Full LLM system message (Kassangas-specific)
tone → "professional" | "friendly"
```

### `alphadome.bot_training_data`
Per-client FAQ & training:
```
bot_tenant_id → Links to bot_tenants
data_type → "faq" | "canned_reply"
question → "What are your hours?"
answer → "Monday-Saturday 9 AM - 6 PM"
category → "Business" | "Products" | "Payment"
```

### `alphadome.bot_control_settings`
Per-client feature toggles:
```
bot_tenant_id → Links to bot_tenants
is_bot_enabled → Turn on/off
max_messages_per_hour → 200
enable_ai_responses → true
enable_payment_flow → false (can enable later)
escalation_phone → "0702245555" (Gideon)
```

---

## 🔑 Key Values (For Reference)

**Kassangas Contact (Confirmed in Database):**
- Name: Gideon
- Phone: 0702245555 → Normalized: 254702245555
- User ID: 823c3bcd-b66f-4010-9922-4a3b411226cc
- Status: Already interacted with bot (logs from Oct 18)

**Your Default Brand (Currently Used):**
- Brand ID: 1af71403-b4c3-4eac-9aab-48ee2576a9bb
- (Can create a dedicated Kassangas brand later)

---

## 🔐 Security Considerations

### Encryption (Must Do in Production)
- `whatsapp_access_token` → Use Supabase pgcrypto or Vault
- `ai_api_key` → Use Supabase pgcrypto or Vault
- Decrypt only when needed (at message generation time)

### Access Control (RLS)
- Implement Row-Level Security policies
- Each tenant can only see their own data
- Audit all credential access

### Token Management
- Monitor expiry dates
- Rotate every 90 days
- Alert on expiry 14 days in advance

---

## 📝 Server.js Changes Required (Week 2)

### Pseudocode Example
```javascript
// 1. Add middleware to identify tenant by phone
app.use(async (req, res, next) => {
  const fromPhone = req.body.entry[0].changes[0].value.messages[0].from;
  
  const tenant = await supabase
    .from("bot_tenants")
    .select("*")
    .eq("client_phone", fromPhone)
    .single();
  
  req.tenant = tenant;
  next();
});

// 2. Update webhook handler to use tenant config
app.post("/webhook", async (req, res) => {
  const tenant = req.tenant;
  const text = req.body.entry[0].changes[0].value.messages[0].text.body;
  
  // Load tenant's template
  const template = await supabase
    .from("bot_templates")
    .select("*")
    .eq("bot_tenant_id", tenant.id)
    .eq("is_default", true)
    .single();
  
  // Load tenant's training data
  const training = await supabase
    .from("bot_training_data")
    .select("*")
    .eq("bot_tenant_id", tenant.id)
    .eq("is_active", true);
  
  // Generate response using tenant's template + training
  const response = await generateResponse(text, template, training);
  
  // Send using tenant's WhatsApp token
  await sendMessage(req.tenant.client_phone, response, tenant.whatsapp_access_token);
  
  res.sendStatus(200);
});
```

---

## ✅ Verification Checklist

After running the migrations, verify:

```sql
-- Check tenant was created
SELECT * FROM alphadome.bot_tenants 
WHERE client_phone = '254702245555';

-- Check templates
SELECT COUNT(*) FROM alphadome.bot_templates
WHERE bot_tenant_id = '...'; -- Should see 3

-- Check training data
SELECT data_type, COUNT(*) FROM alphadome.bot_training_data
WHERE bot_tenant_id = '...'
GROUP BY data_type; -- Should see 'faq' and 'canned_reply'

-- Check control settings
SELECT * FROM alphadome.bot_control_settings
WHERE bot_tenant_id = '...';
```

---

## 📞 Contact & Support

**For Gideon (Kassangas):**
- Provide dashboard access (Week 3)
- Training: "How to manage templates and FAQ"
- Support: Phone/email for escalations

**For Your Team:**
1. Read `EXECUTIVE_SUMMARY.md` (5 min)
2. Review `DEPLOYMENT_PLAN.md` (15 min)
3. Run migrations (5 min)
4. Start Week 2 server code (3 days)

---

## 🎉 Result After Implementation

**One running server at `alphadome.onrender.com`:**
- ✅ Kassangas can operate their bot independently
- ✅ Gideon can manage templates & FAQ via dashboard
- ✅ No shared credentials between clients
- ✅ Each client can have custom personality
- ✅ Ready to add 10, 100, 1000+ more clients
- ✅ Zero downtime, no redeployment per client

---

## 📚 Document Map

```
project-root/
├── EXECUTIVE_SUMMARY.md          ← Start here (overview)
├── DEPLOYMENT_PLAN.md            ← Implementation roadmap
├── DB_ALIGNMENT_REPORT.md        ← Technical deep-dive
├── migrations/
│   ├── 2025-02-06_add_bot_tenants_schema.sql        ← Run first
│   └── 2025-02-06_setup_kassangas_tenant.sql        ← Run second
└── server.js                      ← To be updated Week 2
```

---

**Status:** ✅ Ready for Database Setup (Week 1)  
**Next Action:** Run migrations in Supabase  
**Questions?** See DEPLOYMENT_PLAN.md or DB_ALIGNMENT_REPORT.md
