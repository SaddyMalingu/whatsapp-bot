# ALPHADOME MULTI-TENANT BOT DEPLOYMENT PLAN
## Alignment with Existing Supabase Schema & Data Leakage Prevention

**Date:** February 6, 2026  
**Status:** Planning Phase  
**Client:** Kassangas Music Shop (Gideon, 0702245555 → 254702245555)

---

## 1. VERIFICATION: CURRENT DB STATE

### ✅ Confirmed Existing Tables
```
✓ public.users                  - ID: 823c3bcd-b66f-4010-9922-4a3b411226cc
                                  Phone: 254702245555
                                  Name: Unknown User
                                  
✓ public.brands                 - Your platform brand (DEFAULT_BRAND_ID)
✓ public.conversations          - Logs incoming/outgoing messages (brand_id, user_id, direction)
✓ public.subscriptions          - Subscription records (user_id, phone, plan_type, level)
✓ public.user_sessions          - Session state (phone, context)
✓ public.whatsapp_logs          - (Appears to be used for auto-retry)
✓ alphadome.*                   - Portfolio, business profiles, submissions, reports, bot_configs, profile changes
```

### ⚠️ Data Isolation Gaps (Current)
- Single bot instance (current server.js) serves all contacts via `DEFAULT_BRAND_ID`
- No per-tenant credentials (all use one `WHATSAPP_TOKEN`, one OpenAI key)
- No per-client webhook configuration
- No runtime template/training data per client
- **Risk:** If deployed to Alphadome, all tenants would share:
  - WhatsApp messaging credentials
  - AI model credentials
  - Conversation logs (all logged to same brand_id)

---

## 2. NEW SCHEMA: MULTI-TENANT ISOLATION

### Tables Added (in `alphadome` schema)
```
alphadome.bot_tenants            ← Master tenant config (credentials, phone, webhook)
alphadome.bot_templates          ← Per-tenant system prompts & conversation templates
alphadome.bot_training_data      ← Per-tenant FAQ, canned replies, training samples
alphadome.bot_control_settings   ← Per-tenant feature toggles (on/off, rate limits, etc.)
alphadome.bot_message_logs       ← (Optional) Per-tenant isolated message logs
```

### Why This Prevents Data Leaks
1. **Tenant Isolation:** Each client has its own `bot_tenant_id`
2. **Encrypted Credentials:** Each tenant stores unique WhatsApp token, AI key
3. **Separate Conversation Context:** Templates and training data are NOT shared
4. **Runtime Routing:** Incoming messages routed by phone → tenant lookup → load tenant config
5. **Optional Separate Logging:** If needed, can log per-tenant instead of to shared `public.conversations`

---

## 3. DEPLOYMENT ARCHITECTURE: ONE RUNNING SERVICE, MANY TENANTS

### Current Single-Bot Model (Server.js)
```
┌─────────────────────────────────────┐
│      EXPRESS SERVER (port 3000)      │
│   Hardcoded to DEFAULT_BRAND_ID      │
└──────┬──────────────────────────┬────┘
       │                          │
   POST /webhook          POST /mpesa/callback
       │                          │
       └──────────┬───────────────┘
                  │
          ┌───────▼────────┐
          │   SUPABASE     │
          │  (Single tenant)│
          └────────────────┘
```

### New Multi-Tenant Model (Future)
```
┌──────────────────────────────────────────────────┐
│  EXPRESS SERVER (port 3000)                      │
│  Tenant-Aware Middleware                         │
│  - Extract phone/token from request              │
│  - Load tenant config from alphadome.bot_tenants │
│  - Run with tenant context                       │
└─────────────┬────────────────────────────┬───────┘
              │                            │
      POST /webhook                POST /mpesa/callback
              │                            │
              ▼                            ▼
    ┌──────────────────────┐    ┌────────────────────┐
    │ Webhook Handler      │    │ M-Pesa Callback    │
    │ (tenant-aware)       │    │ (tenant-aware)     │
    │                      │    │                    │
    │ 1. Identify tenant   │    │ 1. Identify tenant │
    │    by phone number   │    │    from context    │
    │ 2. Load template     │    │ 2. Mark subscription
    │ 3. Load training data│    │    for that tenant │
    │ 4. Generate response │    │                    │
    │ 5. Send via          │    └────────────────────┘
    │    tenant's WhatsApp │
    │    token             │
    └──────────────────────┘
              │
    ┌─────────▼───────────────────────────────────┐
    │   SUPABASE (Multi-Tenant Aware)             │
    ├─────────────────────────────────────────────┤
    │  • public.users (shared contact registry)   │
    │  • alphadome.bot_tenants (tenant configs)   │
    │  • alphadome.bot_templates (per-tenant)     │
    │  • alphadome.bot_training_data (per-tenant) │
    │  • alphadome.bot_message_logs (optional)    │
    │  • public.conversations (per-brand, shared) │
    └─────────────────────────────────────────────┘
```

---

## 4. IMPLEMENTATION ROADMAP

### Phase 1: Database Setup (Week 1)
- [ ] Run `2025-02-06_add_bot_tenants_schema.sql` migration in Supabase
- [ ] Insert row for Kassangas in `alphadome.bot_tenants`
- [ ] Insert default template and control settings
- [ ] Confirm no data loss in existing tables

### Phase 2: Server Code Updates (Week 2)
- [ ] Create `tenantLoader` middleware to fetch tenant by phone/webhook token
- [ ] Refactor webhook handler to use tenant config
- [ ] Add tenant-aware message generation (pick template, load training data)
- [ ] Add tenant-aware WhatsApp send (use tenant's token)
- [ ] Update M-Pesa callback to work with tenant context

### Phase 3: Simple Dashboard (Week 3)
- [ ] Build basic React/Vue dashboard page (Alphadome admin)
- [ ] Features:
  - List tenants (clients)
  - Create new tenant (provision client)
  - Edit template & training data per tenant
  - View recent messages (per-tenant logs)
  - Toggle bot on/off per tenant
  - Update credentials (WhatsApp token, OpenAI key)
- [ ] Optional: Add test message sender

### Phase 4: Deployment & Onboarding (Week 4)
- [ ] Deploy updated server.js to Render/hosting
- [ ] Set up Kassangas tenant in production
- [ ] Configure Kassangas WhatsApp webhook (point to new handler)
- [ ] Train Kassangas bot with templates & FAQ
- [ ] Test end-to-end message flow
- [ ] Provide Kassangas with admin dashboard access

---

## 5. SECURITY & DATA ISOLATION CHECKLIST

### ✅ Encryption
- [ ] Store `whatsapp_access_token` encrypted (use Supabase pgcrypto or Vault)
- [ ] Store `ai_api_key` encrypted
- [ ] Decrypt only when needed (at message generation time)

### ✅ Authentication & Authorization
- [ ] Implement Row-Level Security (RLS) on `bot_tenants`, `bot_templates`, `bot_training_data`
- [ ] Admin can only see/edit their own tenant data
- [ ] Use JWT claims to identify tenant

### ✅ Isolation
- [ ] Each tenant has unique `webhook_verify_token`
- [ ] Each tenant has unique WhatsApp credentials (if multi-WhatsApp)
- [ ] Conversation logs tagged with `bot_tenant_id` (optional: separate table)
- [ ] Rate limits per tenant

### ✅ Monitoring
- [ ] Alert on token expiry (`whatsapp_token_expires_at`)
- [ ] Log all credential access (who decrypted what, when)
- [ ] Monitor tenant usage (messages per hour, errors)

---

## 6. IMMEDIATE NEXT STEPS FOR KASSANGAS

### Client Onboarding Checklist

**Contact:** Gideon (0702245555)  
**Business:** Kassangas Music Shop  
**Status:** Already interacted with bot (confirmed in logs)

#### Step 1: Obtain WhatsApp Credentials
- [ ] Request Meta Business Account ID from Gideon
- [ ] Request WhatsApp Business Phone ID
- [ ] Request/create WhatsApp Access Token (with long expiry)
- [ ] Test token connectivity

#### Step 2: Obtain AI Credentials (Optional)
- [ ] Option A: Use shared OpenAI account (for now, can migrate later)
- [ ] Option B: Request Gideon to provide own OpenAI API key

#### Step 3: Provision in Database
```sql
INSERT INTO alphadome.bot_tenants (
  client_name, client_phone, client_email,
  point_of_contact_name, point_of_contact_phone,
  whatsapp_phone_number_id, whatsapp_access_token,
  webhook_verify_token, is_active
) VALUES (
  'Kassangas Music Shop',
  '254702245555',
  'gideon@kassangas.example.com',
  'Gideon',
  '0702245555',
  '<Meta Phone ID>',
  '<encrypted WhatsApp token>',
  '<unique token>',
  false  -- not active until fully configured
);
```

#### Step 4: Configure Templates & Training Data
- [ ] Insert default template (e.g., "Welcome to Kassangas")
- [ ] Insert FAQ pairs (products, hours, contact info)
- [ ] Insert canned replies (greeting, help, escalation)

#### Step 5: Enable & Test
- [ ] Set `is_active = true` for Kassangas tenant
- [ ] Verify webhook connection to Meta
- [ ] Send test message
- [ ] Confirm response uses Kassangas template/training

---

## 7. EXAMPLE MODIFIED server.js LOGIC (Pseudocode)

```javascript
// Middleware: Load tenant context
async function loadTenantContext(req, res, next) {
  const incomingPhone = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  const webhookToken = req.query["hub.verify_token"];
  
  // Lookup tenant by phone or webhook token
  const { data: tenant } = await supabase
    .from("bot_tenants")
    .select("*")
    .or(`client_phone.eq.${incomingPhone},webhook_verify_token.eq.${webhookToken}`)
    .single();
  
  if (!tenant) {
    // No tenant found, reject or use default
    return res.sendStatus(403);
  }
  
  // Attach tenant to request context
  req.tenant = tenant;
  next();
}

// Webhook handler (simplified)
app.post("/webhook", loadTenantContext, async (req, res) => {
  const tenant = req.tenant;
  const fromPhone = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  const text = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
  
  try {
    // Step 1: Fetch user (or create)
    let user = await getOrCreateUser(fromPhone);
    
    // Step 2: Load tenant's template & training data
    const template = await loadTemplate(tenant.id, "default");
    const trainingData = await loadTrainingData(tenant.id);
    
    // Step 3: Generate response (using tenant's template + training data)
    const response = await generateResponse(text, template, trainingData);
    
    // Step 4: Send via tenant's WhatsApp token
    await sendMessage(fromPhone, response, tenant.whatsapp_access_token);
    
    // Step 5: Log conversation (to public.conversations with tenant brand_id)
    await logConversation(tenant.brand_id, user.id, text, response);
    
  } catch (err) {
    log(`Tenant ${tenant.id} error: ${err.message}`, "ERROR");
  }
  
  res.sendStatus(200);
});
```

---

## 8. SUMMARY

**Current State:**
- Single bot instance serving all users via one WhatsApp token
- All conversations logged to shared brand
- High data leakage risk if deployed to multiple clients

**Aligned Solution:**
- Add 4 new tables to `alphadome` schema for tenant management
- No breaking changes to existing `public.*` schema
- Middleware to load tenant config at request time
- Separate credentials, templates, training data per client
- Optional separate logging per tenant

**Next Action:**
- Apply migration `2025-02-06_add_bot_tenants_schema.sql`
- Create Kassangas tenant record (await Meta credentials)
- Update server.js with tenant-aware logic
- Build dashboard for admin to manage tenants

---

**Questions?**
Feel free to ask about any step in the plan. This approach ensures:
- ✅ No data leaks between clients
- ✅ Zero downtime deployment
- ✅ Backward compatible with existing schema
- ✅ Scalable to 100+ clients
