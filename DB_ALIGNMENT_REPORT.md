# DATABASE SCHEMA ALIGNMENT REPORT
**Generated:** February 6, 2026  
**Status:** Pre-Implementation Verification

---

## EXISTING SCHEMA (Current - Verified)

### public.users
```
id (uuid)              ← Primary key
phone (text)           ← 254702245555 (Gideon - CONFIRMED)
full_name (text)
subscribed (boolean)
subscription_type (text)
subscription_level (integer)
created_at
updated_at
```
**Sample data:** Gideon already exists
```json
{
  "id": "823c3bcd-b66f-4010-9922-4a3b411226cc",
  "phone": "254702245555",
  "full_name": "Unknown User"
}
```

### public.brands
```
id (uuid)              ← PRIMARY
is_platform_owner (boolean)
...other fields
```
**Usage:** Tags conversations with brand_id (currently DEFAULT_BRAND_ID for everything)

### public.conversations
```
id (uuid)
brand_id (uuid)        ← FK to brands
user_id (uuid)         ← FK to users
whatsapp_message_id (text)
direction (text)       ← 'incoming' | 'outgoing'
raw_payload (jsonb)
message_text (text)
created_at
updated_at
```
**Current issue:** All messages logged to DEFAULT_BRAND_ID (single tenant assumption)

### public.subscriptions
```
id (uuid)
user_id (uuid)         ← FK to users
phone (text)
amount (integer)
plan_type (text)       ← 'monthly' | 'one'
level (integer)
status (text)          ← 'pending' | 'subscribed' | 'failed'
mpesa_checkout_request_id (text)
account_ref (text)
metadata (jsonb)
created_at
updated_at
```

### public.user_sessions
```
phone (text)           ← PRIMARY-ish
context (jsonb)        ← state machine data
updated_at
```

### alphadome.* (Existing)
- `portfolio_items` - Samples, case studies
- `brand_business_profiles` - Brand info
- `freelancer_submissions` - Deliverables
- `matchbox_reports` - Analytics/recommendations
- `bot_configs` - Generic bot config (not multi-tenant)
- `conversation_profile_changes` - Update logs

---

## PROPOSED NEW SCHEMA (Non-Breaking Addition)

### alphadome.bot_tenants ⭐ PRIMARY TABLE
```
id (uuid PRIMARY KEY)
client_name (text)                     ← "Kassangas Music Shop"
client_phone (text UNIQUE)             ← "254702245555"
client_email (text)
brand_id (uuid FK)                     ← Links to public.brands
point_of_contact_name (text)           ← "Gideon"
point_of_contact_phone (text)          ← "0702245555"

# WhatsApp Credentials (ENCRYPTED IN PROD)
whatsapp_phone_number_id (text)        ← Meta Phone ID
whatsapp_business_account_id (text)
whatsapp_access_token (text)           ← 🔒 MUST BE ENCRYPTED
whatsapp_token_expires_at (timestamp)

# LLM Config
ai_provider (text)                     ← 'openai' | 'openrouter' | 'huggingface'
ai_api_key (text)                      ← 🔒 MUST BE ENCRYPTED
ai_model (text)

# Status & Control
is_active (boolean)
is_verified (boolean)
webhook_verify_token (text UNIQUE)
webhook_url (text)

metadata (jsonb)
created_at
updated_at
```

**Relationship Diagram:**
```
public.users (Gideon)
       │
       ▼
public.brands (Kassangas brand)
       │
       ▼
alphadome.bot_tenants (Kassangas bot instance)
       │
       ├─── alphadome.bot_templates (3-5 templates per tenant)
       │
       ├─── alphadome.bot_training_data (100+ FAQ/canned replies per tenant)
       │
       ├─── alphadome.bot_control_settings (1 settings row per tenant)
       │
       └─── alphadome.bot_message_logs (optional, 1000s of messages per tenant)
```

---

### alphadome.bot_templates
```
id (uuid PRIMARY KEY)
bot_tenant_id (uuid FK)                ← Which client
template_name (text)                   ← "default", "product", "support"
description (text)

# Prompt Configuration
system_prompt (text)                   ← Full system message for LLM
conversation_context (jsonb)           ← Pre-loaded context
tone (text)                            ← 'professional' | 'friendly'
max_response_length (integer)

is_active (boolean)
is_default (boolean)

metadata (jsonb)
created_at
updated_at
```

**Isolation:** Each tenant can have different prompts (no data leak)

### alphadome.bot_training_data
```
id (uuid PRIMARY KEY)
bot_tenant_id (uuid FK)                ← Which client

# Content Type
data_type (text)                       ← 'faq' | 'canned_reply' | 'example'
question (text)
answer (text)

category (text)                        ← 'Products' | 'Support' | 'Hours'
priority (integer)                     ← Higher = searched first
confidence_score (numeric)             ← 0.0-1.0 for RAG ranking

is_active (boolean)
created_at
updated_at
```

**Example Kassangas FAQ:**
```json
{
  "bot_tenant_id": "<Kassangas UUID>",
  "data_type": "faq",
  "question": "What instruments do you sell?",
  "answer": "We sell guitars, keyboards, drums, and more. Visit us at...",
  "category": "Products",
  "priority": 10
}
```

### alphadome.bot_control_settings
```
id (uuid PRIMARY KEY)
bot_tenant_id (uuid FK UNIQUE)         ← One per tenant

# Feature Toggles
is_bot_enabled (boolean)
max_messages_per_hour (integer)
max_messages_per_user_per_day (integer)
enable_ai_responses (boolean)
enable_payment_flow (boolean)          ← For Alphadome subscriptions
enable_training_mode (boolean)
enable_auto_reply (boolean)

# Logging Control
log_conversations (boolean)
log_errors (boolean)

# Escalation
escalation_phone (text)                ← Who to contact if something breaks
escalation_email (text)

metadata (jsonb)
created_at
updated_at
```

### alphadome.bot_message_logs (Optional)
```
id (uuid PRIMARY KEY)
bot_tenant_id (uuid FK)                ← Which client's messages

user_phone (text)
user_id (uuid FK)
direction (text)                       ← 'incoming' | 'outgoing'
message_text (text)
whatsapp_message_id (text)

ai_processed (boolean)
ai_response (text)
error_message (text)

template_used (text)
training_data_id (uuid FK)             ← Which FAQ/canned reply was used

metadata (jsonb)
created_at
```

**Note:** Optional table for client-specific log isolation. Current approach uses `public.conversations` tagged with `brand_id`.

---

## DATA ISOLATION VERIFICATION MATRIX

| Data                      | Current Risk | New Isolation | Mechanism |
|---------------------------|--------------|---------------|-----------|
| WhatsApp Token            | 🔴 Shared    | 🟢 Per-tenant | `bot_tenants.whatsapp_access_token` |
| OpenAI Key                | 🔴 Shared    | 🟢 Per-tenant | `bot_tenants.ai_api_key` |
| Conversation Templates    | 🔴 Shared    | 🟢 Per-tenant | `bot_templates.bot_tenant_id` |
| Training Data (FAQ)       | 🔴 Shared    | 🟢 Per-tenant | `bot_training_data.bot_tenant_id` |
| Feature Toggles           | 🔴 Shared    | 🟢 Per-tenant | `bot_control_settings.bot_tenant_id` |
| Webhook Verify Token      | 🔴 Shared    | 🟢 Per-tenant | `bot_tenants.webhook_verify_token` UNIQUE |
| Message Logs              | 🟡 Shared    | 🟢 Per-tenant | `bot_tenants.brand_id` or separate table |
| User Contact Registry     | 🟢 Shared    | 🟢 Shared OK | `public.users` (phone directory) |
| Subscription Records      | 🟢 Shared    | 🟢 Shared OK | `public.subscriptions` (legal records) |

---

## IMPLEMENTATION CHECKLIST

### Database Layer
- [ ] Run migration: `2025-02-06_add_bot_tenants_schema.sql`
- [ ] Verify all 4 new tables created
- [ ] Create Row-Level Security (RLS) policies per tenant
- [ ] Set up pgcrypto encryption for token fields
- [ ] Create indexes for performance

### Server Layer (server.js)
- [ ] Create `loadTenantContext()` middleware
- [ ] Update webhook handler to load tenant config
- [ ] Update message generation to use tenant templates
- [ ] Update WhatsApp send to use tenant token
- [ ] Update logging to include tenant_id

### Dashboard Layer (Optional Phase 3)
- [ ] List tenants
- [ ] Create/edit tenant
- [ ] Manage templates per tenant
- [ ] Manage training data per tenant
- [ ] View logs per tenant
- [ ] Control toggles per tenant

### Security Layer
- [ ] Implement field encryption (whatsapp_access_token, ai_api_key)
- [ ] Implement RLS policies
- [ ] Rotate webhook_verify_token periodically
- [ ] Add audit logging for credential access
- [ ] Set up alerts for token expiry

---

## MIGRATION PATH (Zero Downtime)

### Phase A: Add New Schema (No code changes)
1. Run migration (add 4 new tables)
2. Current server.js still works (uses DEFAULT_BRAND_ID)
3. Zero impact on running system

### Phase B: Insert Kassangas Tenant
1. Create row in `bot_tenants` for Kassangas
2. Insert default templates + training data
3. Still not active (`is_active = false`)

### Phase C: Update Server Code
1. Add `loadTenantContext` middleware
2. Update webhook handler
3. Deploy to staging, test
4. No breaking changes to existing API

### Phase D: Go Live for Kassangas
1. Set Kassangas `is_active = true`
2. Point Kassangas WhatsApp webhook to new handler
3. Monitor for errors
4. Rollback if needed (simply set `is_active = false`)

---

## ENCRYPTION STRATEGY (For Production)

### Option 1: Supabase pgcrypto (Simple)
```sql
UPDATE alphadome.bot_tenants
SET whatsapp_access_token = pgp_sym_encrypt(token, 'secret_key')
WHERE id = '...';
```

### Option 2: Supabase Vault (Recommended)
```sql
-- Store encryption key in vault
SELECT vault.create_secret('whatsapp-key-v1', 'actual-key-value', 'WhatsApp Token Encryption Key');

-- Use in queries (via RPC function)
SELECT decrypt_token(id) FROM bot_tenants;
```

### Option 3: Application-Level Encryption
- Encrypt before storing (in server.js)
- Decrypt on use
- Key stored in `process.env.ENCRYPTION_KEY`

**Recommendation:** Option 2 (Vault) for Alphadome

---

## SUMMARY

✅ **Current State Verified:**
- Gideon (254702245555) exists in database
- Existing schema is multi-brand capable but single-tenant in practice
- No breaking changes needed to add multi-tenant support

✅ **Aligned Solution:**
- 4 new tables in `alphadome` schema
- Complete tenant isolation via foreign keys
- Non-breaking, additive migration
- Backward compatible with existing code

✅ **Ready to Deploy:**
1. Run SQL migration
2. Create Kassangas tenant record
3. Update server.js (Phase C)
4. Test and go live

**Next action:** Approval to proceed with Phase A (DB migration)
