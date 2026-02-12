# 📊 ALPHADOME MULTI-TENANT SYSTEM — VISUAL QUICK REFERENCE

## Current System vs. Future System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CURRENT SYSTEM (❌ Risk)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│         ┌──────────────────────────────────────────────────┐            │
│         │            server.js                             │            │
│         │         (Single Configuration)                  │            │
│         └──────────────┬─────────────────────────────────┘            │
│                        │                                              │
│        ┌───────────────┼───────────────┐                             │
│        │               │               │                             │
│        ▼               ▼               ▼                             │
│    ┌─────────┐    ┌─────────┐    ┌─────────┐                       │
│    │ Gideon  │    │ Client2 │    │ Client3 │                       │
│    │ 0702... │    │  ...    │    │  ...    │                       │
│    └────┬────┘    └────┬────┘    └────┬────┘                       │
│         │               │               │                             │
│         └───────────────┼───────────────┘                             │
│                        │                                              │
│                        ▼                                              │
│         ┌──────────────────────────────────────┐                     │
│         │  Shared WhatsApp Token               │ ← Data Leak ❌     │
│         │  Shared OpenAI Key                   │ ← Data Leak ❌     │
│         │  DEFAULT_BRAND_ID (all logs)         │ ← No Isolation ❌  │
│         │  Single System Prompt                │ ← No Customization │
│         │  Shared FAQ                          │ ← No Privacy ❌    │
│         └──────────────────────────────────────┘                     │
│                        │                                              │
│                        ▼                                              │
│         ┌──────────────────────────────────────┐                     │
│         │         SUPABASE                     │                     │
│         │  • public.users (shared)             │                     │
│         │  • public.conversations (shared)    │                     │
│         │  • public.subscriptions              │                     │
│         │  • alphadome.* (multi-purpose)      │                     │
│         └──────────────────────────────────────┘                     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────────┘

PROBLEMS:
  ✗ Can't add more clients without risking data leaks
  ✗ All clients use same WhatsApp token
  ✗ All clients use same OpenAI quota
  ✗ No way to customize per client
  ✗ Impossible to have truly isolated tenants
```

---

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   FUTURE SYSTEM (✅ Secure & Scalable)                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│                  ┌──────────────────────────────┐                       │
│                  │     server.js                │                       │
│                  │  (Tenant-Aware Middleware)   │                       │
│                  └──────────────┬───────────────┘                       │
│                                │                                        │
│                ┌───────────────┼───────────────┐                       │
│                │               │               │                       │
│                ▼               ▼               ▼                       │
│           ┌─────────┐     ┌─────────┐    ┌─────────┐                │
│           │ Gideon  │     │ Client2 │    │ Client3 │                │
│           │ 0702... │     │  ...    │    │  ...    │                │
│           └────┬────┘     └────┬────┘    └────┬────┘                │
│                │               │               │                      │
│                └───────────┬───┴───────────┬───┘                      │
│                            │               │                          │
│                   Tenant Lookup by Phone  │                          │
│                            │               │                          │
│        ┌───────────────────▼──┐  ┌────────▼──────────────┐           │
│        │ alphadome.bot_tenants│  │alphadome.bot_tenants  │           │
│        │ ─────────────────────│  │ ──────────────────────│           │
│        │ Client: Kassangas    │  │ Client: Client2      │           │
│        │ Phone: 254702245555  │  │ Phone: 254712345678  │           │
│        │ Token: token_A (🔒) │  │ Token: token_B (🔒)  │           │
│        │ Brand: brand_A       │  │ Brand: brand_B        │           │
│        └───────┬──────────────┘  └─────┬────────────────┘           │
│                │                       │                             │
│        ┌───────▼──────────┐  ┌─────────▼──────────┐                │
│        │ bot_templates    │  │ bot_templates      │                │
│        │ ─────────────────│  │ ──────────────────│                │
│        │ • Welcome        │  │ • Custom Prompt   │                │
│        │ • Products       │  │ • Different Tone  │                │
│        │ • Support        │  │ • Other templates │                │
│        └────────┬─────────┘  └──────────┬────────┘                │
│                 │                       │                          │
│        ┌────────▼──────────┐  ┌─────────▼──────────┐              │
│        │ bot_training_data │  │bot_training_data   │              │
│        │ ─────────────────│  │ ──────────────────│              │
│        │ • Kassangas FAQ  │  │ • Client2 FAQ     │              │
│        │ • Hours          │  │ • Different Q&As  │              │
│        │ • Products       │  │ • Other entries   │              │
│        │ • Payments       │  │                   │              │
│        └────────┬─────────┘  └──────────┬────────┘              │
│                 │                       │                       │
│        ┌────────▼──────────┐  ┌─────────▼──────────┐           │
│        │bot_control_settings│ │bot_control_settings│           │
│        │ ─────────────────│  │ ──────────────────│           │
│        │ On/Off: true     │  │ On/Off: true      │           │
│        │ Rate limits: 200 │  │ Rate limits: 500  │           │
│        │ Features: ABC    │  │ Features: XYZ     │           │
│        └──────────────────┘  └──────────────────┘            │
│                 │                       │                    │
│                 └───────┬───────────────┘                    │
│                        │                                     │
│                        ▼                                     │
│         ┌──────────────────────────────────────┐            │
│         │         SUPABASE (Multi-Tenant)      │            │
│         │  ✓ public.users (shared contact DB) │            │
│         │  ✓ public.conversations (per-brand) │            │
│         │  ✓ public.subscriptions              │            │
│         │  ✓ alphadome.bot_tenants            │            │
│         │  ✓ alphadome.bot_templates          │            │
│         │  ✓ alphadome.bot_training_data      │            │
│         │  ✓ alphadome.bot_control_settings   │            │
│         └──────────────────────────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────────────────┘

BENEFITS:
  ✓ Each client has unique WhatsApp token (encrypted)
  ✓ Each client has unique OpenAI key (or shared)
  ✓ Each client has custom templates & FAQ
  ✓ Each client can toggle features independently
  ✓ Zero data leaks between clients
  ✓ Scales to 100+ clients without code changes
  ✓ ONE server running = low operational cost
  ✓ Backward compatible with existing system
```

---

## Message Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    INCOMING MESSAGE FLOW                         │
└─────────────────────────────────────────────────────────────────┘

1. RECEIVE MESSAGE
   ┌──────────────────────────────────┐
   │  WhatsApp User                   │
   │  Phone: 254702245555             │
   │  Message: "What are your hours?" │
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  POST /webhook                   │
   │  Extract: from = 254702245555    │
   └─────────────┬────────────────────┘

2. IDENTIFY TENANT
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  Load Tenant Context             │
   │  SELECT * FROM bot_tenants       │
   │  WHERE client_phone =            │
   │        '254702245555'            │
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  Tenant Loaded:                  │
   │  • client_name: Kassangas        │
   │  • brand_id: UUID_A              │
   │  • whatsapp_token: token_A (🔒) │
   │  • ai_key: key_A (🔒)           │
   └─────────────┬────────────────────┘

3. LOAD CONFIGURATION
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  Load Template                   │
   │  SELECT * FROM bot_templates     │
   │  WHERE bot_tenant_id = UUID_A    │
   │  AND is_default = true           │
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  Template Loaded:                │
   │  system_prompt: "You are a...    │
   │   Kassangas Music Shop           │
   │   assistant..."                  │
   │  tone: "professional"            │
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  Load Training Data              │
   │  SELECT * FROM bot_training_data │
   │  WHERE bot_tenant_id = UUID_A    │
   │  AND is_active = true            │
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  Training Data Loaded:           │
   │  • FAQ: Hours 9-6 M-S            │
   │  • FAQ: Products list            │
   │  • Canned: Greeting              │
   │  • (9 entries for Kassangas)     │
   └─────────────┬────────────────────┘

4. GENERATE RESPONSE
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  Match User Question             │
   │  "What are your hours?"          │
   │  ↓                               │
   │  Found: FAQ entry               │
   │  "Monday-Saturday 9-6 PM"        │
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  Call AI (if needed)             │
   │  openai.chat.completions.create( │
   │    model: 'gpt-4o-mini',         │
   │    system_prompt: template,      │
   │    user_message: question        │
   │  )                               │
   │  Using: tenant's OpenAI key_A 🔒│
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  Response Generated:             │
   │  "Our hours are Monday-Saturday  │
   │   9 AM to 6 PM. Sunday we're     │
   │   closed. Visit us or call..."   │
   └─────────────┬────────────────────┘

5. SEND RESPONSE
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  Send via WhatsApp              │
   │  POST /whatsapp/send             │
   │  to: 254702245555               │
   │  message: response              │
   │  token: tenant.token_A (🔒)    │
   └─────────────┬────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  ✓ Message Sent                  │
   │  WhatsApp receives message       │
   │  User sees response              │
   └──────────────────────────────────┘

6. LOG CONVERSATION
                 │
                 ▼
   ┌──────────────────────────────────┐
   │  Log to Database                 │
   │  INSERT INTO conversations       │
   │  (brand_id: UUID_A,              │
   │   user_id: gideon_uuid,          │
   │   direction: 'outgoing',         │
   │   message_text: response)        │
   └──────────────────────────────────┘

KEY ISOLATION POINTS:
  🔒 Token decrypted only at send time
  🔒 AI key decrypted only at call time
  🔒 Template specific to Kassangas
  🔒 Training data specific to Kassangas
  🔒 Logs tagged with Kassangas brand_id
  ✓ All other clients' data not accessed
```

---

## Database Relationship Diagram

```
public.users
    ↓
    ├─── id: 823c3bcd-... (Gideon)
    ├─── phone: 254702245555
    ├─── full_name: Gideon
    └─── subscribed: true/false
         │
         ▼ (joins on brand_id)

public.brands
    ↓
    ├─── id: 1af71403-... (Kassangas brand, or new)
    ├─── is_platform_owner: false
    └─── ...
         │
         ▼ (references brand_id)

alphadome.bot_tenants ⭐ PRIMARY
    ├─ id: kassangas-tenant-uuid
    ├─ client_name: "Kassangas Music Shop"
    ├─ client_phone: "254702245555" (UNIQUE)
    ├─ point_of_contact_name: "Gideon"
    ├─ brand_id: 1af71403-...
    ├─ whatsapp_phone_number_id: "868405499681303"
    ├─ whatsapp_access_token: encrypted_token
    ├─ ai_api_key: encrypted_key
    ├─ is_active: true/false
    └─ is_verified: true/false
         │
         ├──→ alphadome.bot_templates
         │    ├─ id: template-1
         │    ├─ bot_tenant_id: kassangas-tenant-uuid
         │    ├─ template_name: "default"
         │    ├─ system_prompt: "You are Kassangas..."
         │    ├─ is_default: true
         │    ├─ is_active: true
         │    └─ (3 more templates)
         │
         ├──→ alphadome.bot_training_data
         │    ├─ id: faq-1
         │    ├─ bot_tenant_id: kassangas-tenant-uuid
         │    ├─ data_type: "faq"
         │    ├─ question: "What are your hours?"
         │    ├─ answer: "Monday-Saturday 9-6"
         │    ├─ category: "Business"
         │    ├─ priority: 100
         │    ├─ is_active: true
         │    └─ (8 more entries)
         │
         └──→ alphadome.bot_control_settings
              ├─ id: settings-1
              ├─ bot_tenant_id: kassangas-tenant-uuid (UNIQUE)
              ├─ is_bot_enabled: true
              ├─ max_messages_per_hour: 200
              ├─ enable_ai_responses: true
              ├─ escalation_phone: "0702245555"
              └─ ...

public.conversations (shared, tagged by brand)
    ├─ id: msg-1
    ├─ brand_id: 1af71403-... (Kassangas brand)
    ├─ user_id: 823c3bcd-... (Gideon)
    ├─ direction: "incoming"
    ├─ message_text: "What are your hours?"
    └─ created_at: 2026-02-06...

    ├─ id: msg-2
    ├─ brand_id: 1af71403-... (Kassangas brand)
    ├─ user_id: 823c3bcd-... (Gideon)
    ├─ direction: "outgoing"
    ├─ message_text: "Monday-Saturday 9-6..."
    └─ created_at: 2026-02-06...
```

---

## Access Control (RLS Policy Example)

```
ROW-LEVEL SECURITY RULES:

FOR bot_tenants:
  • Only admins of brand_id can see/edit
  • Use: auth.jwt() -> custom_claim = brand_id
  
  CREATE POLICY "admin_see_own_tenant"
  ON alphadome.bot_tenants
  FOR ALL
  USING (brand_id = auth.jwt()->>'brand_id');

FOR bot_templates:
  • Only admins whose brand owns the tenant can see/edit
  
  CREATE POLICY "admin_see_own_templates"
  ON alphadome.bot_templates
  FOR ALL
  USING (
    bot_tenant_id IN (
      SELECT id FROM alphadome.bot_tenants
      WHERE brand_id = auth.jwt()->>'brand_id'
    )
  );

FOR bot_training_data:
  • Same as templates
  
FOR bot_control_settings:
  • Same as templates
  
RESULT:
  ✓ Gideon (brand A) can't see Client2's (brand B) data
  ✓ Each admin sees only their tenant configs
  ✓ Data is compartmentalized at DB level
```

---

## Message Volume Scenario (Scale Test)

```
ONE SERVER, MULTIPLE TENANTS:

Incoming rate per tenant:
  • Kassangas: ~50 messages/hour
  • Client-2: ~100 messages/hour
  • Client-3: ~75 messages/hour
  • Client-N: variable
  
Total: ~1000 messages/hour (example)

Server capacity (current):
  • Can handle 10,000+ messages/hour
  • Current usage: Single client only
  • Safety margin: 10x headroom

Database capacity:
  • 4 new tables (small, indexed)
  • Add ~100 rows per new tenant
  • Storage per tenant: <1 MB
  • 1000 tenants = <1 GB additional

Scaling strategy:
  Week 4: 1 client (Kassangas)
  Month 2: 5 clients
  Month 3: 20 clients
  Month 6: 100 clients (easy)
  Year 1: 500+ clients (with monitoring)

No infrastructure changes needed until:
  • >10,000 messages/second (extreme scale)
  • Or storage >100 GB (multipart growth)
```

---

## Timeline Gantt Chart

```
WEEK 1: DATABASE
  |████| Day 1: Run migrations
  
WEEK 2: SERVER CODE
  |████|████| Days 1-2: Implement tenant middleware
         |████| Day 3: Testing
  
WEEK 3: DASHBOARD (OPTIONAL)
           |████|████| Days 1-2: Build UI
                  |████| Day 3: Integration
  
WEEK 4: GO LIVE
                     |████| Day 1: Deploy
                        |████| Day 2: Monitor
  
TOTAL: 4 weeks for full implementation (including optional dashboard)
       2 weeks for core functionality (without dashboard)
```

---

All these diagrams are visual references for understanding the architecture.
For detailed implementation, see the accompanying documentation files.
