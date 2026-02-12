-- ============================================================================
-- KASSANGAS MUSIC SHOP - BOT TENANT SETUP SCRIPT
-- ============================================================================
-- Run this AFTER the main migration (2025-02-06_add_bot_tenants_schema.sql)
-- 
-- This script:
-- 1. Creates a bot tenant record for Kassangas Music Shop
-- 2. Inserts default templates (welcome, product inquiry, support)
-- 3. Inserts training data (FAQ, canned replies)
-- 4. Creates control settings with defaults
-- 5. Tags everything with Kassangas' brand & contact info
--
-- BEFORE RUNNING:
-- - Ensure you have Gideon's WhatsApp Business Account details
-- - Have a WhatsApp Access Token (preferably long-expiry)
-- - Have a Brand record in public.brands for Kassangas (or use DEFAULT_BRAND_ID)
--
-- ============================================================================

BEGIN;

-- Step 1: Insert Kassangas Bot Tenant
-- CUSTOMIZE THESE VALUES:
--   - whatsapp_phone_number_id: Get from Meta Business Manager
--   - whatsapp_access_token: Get from Meta (store encrypted in production)
--   - webhook_verify_token: Generate unique random token
--   - client_email: Ask Gideon for email

INSERT INTO alphadome.bot_tenants (
  client_name,
  client_phone,
  client_email,
  brand_id,
  point_of_contact_name,
  point_of_contact_phone,
  whatsapp_phone_number_id,
  whatsapp_business_account_id,
  whatsapp_access_token,
  ai_provider,
  ai_api_key,
  ai_model,
  is_active,
  is_verified,
  webhook_verify_token,
  webhook_url,
  metadata
) VALUES (
  'Kassangas Music Shop',                              -- client_name
  '254702245555',                                     -- client_phone (normalized)
  'gideon@kassangas.example.com',                     -- client_email (UPDATE THIS)
  '1af71403-b4c3-4eac-9aab-48ee2576a9bb',            -- brand_id (use DEFAULT_BRAND_ID or create new)
  'Gideon',                                           -- point_of_contact_name
  '0702245555',                                       -- point_of_contact_phone
  '868405499681303',                                  -- whatsapp_phone_number_id (UPDATE FROM META)
  '108459245087655',                                  -- whatsapp_business_account_id (UPDATE FROM META)
  'EAAOZAitZCbfIMBP2...',                            -- whatsapp_access_token (UPDATE AND ENCRYPT IN PROD)
  'openai',                                           -- ai_provider
  'sk-proj-...',                                      -- ai_api_key (shared or Gideon's own - ENCRYPT IN PROD)
  'gpt-4o-mini',                                      -- ai_model
  false,                                              -- is_active (set to true after verification)
  false,                                              -- is_verified (set to true after webhook test)
  'kassangas_webhook_token_' || gen_random_uuid()::text,  -- webhook_verify_token (generated)
  '/webhook/kassangas',                               -- webhook_url (optional, for reference)
  jsonb_build_object(
    'business_type', 'music_shop',
    'location', 'Nairobi, Kenya',
    'setup_date', now()::date,
    'notes', 'First Alphadome client deployment - Kassangas Music Shop'
  )
) ON CONFLICT DO NOTHING
RETURNING id AS kassangas_tenant_id;

-- SAVE THE RETURNED tenant_id FOR NEXT STEPS

-- Step 2: Get the tenant_id (manually after insert, or use the RETURNING clause)
-- For this script, we'll use a variable approach:
--
-- Option A: If you know the tenant_id, replace 'TENANT_ID_HERE' below
-- Option B: Run the query above first, get the ID, then run the rest

-- Step 3: Insert Default Templates for Kassangas
-- This assumes bot_tenant_id from Step 1 (you may need to adjust the UUID)

-- Template 1: Welcome Message
INSERT INTO alphadome.bot_templates (
  bot_tenant_id,
  template_name,
  description,
  system_prompt,
  conversation_context,
  tone,
  max_response_length,
  is_active,
  is_default
) VALUES (
  (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
  'default',
  'Default welcome and general inquiries',
  'You are a helpful assistant for Kassangas Music Shop, a retail store specializing in musical instruments and audio equipment. Be warm, professional, and helpful. When asked about products, provide accurate information about our inventory. If you don''t know, suggest contacting Gideon at 0702245555 or visiting our location in Nairobi. Always be polite and encourage customers to explore our full range of instruments and services.',
  jsonb_build_array(
    jsonb_build_object('role', 'system', 'content', 'You are a Kassangas Music Shop assistant')
  ),
  'friendly',
  1500,
  true,
  true
);

-- Template 2: Product Inquiry
INSERT INTO alphadome.bot_templates (
  bot_tenant_id,
  template_name,
  description,
  system_prompt,
  tone,
  max_response_length,
  is_active,
  is_default
) VALUES (
  (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
  'product_inquiry',
  'For product-specific questions',
  'You are a knowledgeable sales assistant for Kassangas Music Shop. A customer is asking about a specific product. Provide details about the product (availability, price, specifications if known), and encourage them to visit us or call Gideon for more details. Be helpful and not pushy.',
  'professional',
  1000,
  true,
  false
);

-- Template 3: Support/Complaint
INSERT INTO alphadome.bot_templates (
  bot_tenant_id,
  template_name,
  description,
  system_prompt,
  tone,
  max_response_length,
  is_active,
  is_default
) VALUES (
  (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
  'support',
  'For customer complaints or support issues',
  'You are a customer service representative for Kassangas Music Shop. A customer has a complaint or support issue. Acknowledge their concern, apologize for any inconvenience, and ask for details. Offer solutions if possible, or escalate to Gideon at 0702245555 or support@kassangas.example.com.',
  'empathetic',
  1200,
  true,
  false
);

-- Step 4: Insert Training Data (FAQ + Canned Replies) for Kassangas
INSERT INTO alphadome.bot_training_data (
  bot_tenant_id,
  data_type,
  question,
  answer,
  category,
  priority,
  confidence_score,
  is_active
) VALUES
  -- Business Hours & Location
  (
    (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
    'faq',
    'What are your business hours?',
    'We are open Monday to Saturday, 9 AM to 6 PM. Sunday we''re closed. For after-hours inquiries, reach out to Gideon at 0702245555.',
    'Business',
    100,
    1.0,
    true
  ),
  (
    (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
    'faq',
    'Where is Kassangas Music Shop located?',
    'We''re located in Nairobi, Kenya. Our address is [INSERT ADDRESS]. You can also reach us at 0702245555 for directions.',
    'Business',
    100,
    1.0,
    true
  ),
  
  -- Products
  (
    (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
    'faq',
    'What instruments do you sell?',
    'We stock a wide range of instruments including guitars (acoustic, electric, bass), keyboards, drums, amps, mixers, microphones, and audio equipment. We also offer lessons and repairs. Visit us to see the full range!',
    'Products',
    90,
    1.0,
    true
  ),
  (
    (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
    'faq',
    'Do you offer instrument rentals?',
    'Yes, we offer rental options for many instruments. Contact Gideon at 0702245555 to inquire about rental rates and terms.',
    'Products',
    80,
    0.9,
    true
  ),
  (
    (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
    'faq',
    'Do you provide instrument repair services?',
    'Yes! We offer professional repair and maintenance services for guitars, keyboards, drums, and more. Bring your instrument in or call 0702245555 for a quote.',
    'Products',
    80,
    0.9,
    true
  ),
  
  -- Payment & Purchase
  (
    (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
    'faq',
    'What payment methods do you accept?',
    'We accept cash, M-Pesa, card payments, and bank transfers. For details on payment options or installment plans, contact Gideon.',
    'Payment',
    80,
    0.95,
    true
  ),
  (
    (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
    'faq',
    'Do you offer installment plans?',
    'Yes, we offer flexible payment plans for select items. Contact Gideon at 0702245555 to discuss your budget and options.',
    'Payment',
    70,
    0.85,
    true
  ),
  
  -- Canned Replies
  (
    (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
    'canned_reply',
    'greeting',
    'Hello! Welcome to Kassangas Music Shop. 🎵 How can we help you today? Are you looking for a specific instrument, or would you like to know more about our services?',
    'Greeting',
    100,
    1.0,
    true
  ),
  (
    (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
    'canned_reply',
    'help',
    'I can help you with: 🎸 Product inquiries, 💰 Pricing & payment, 🛠️ Repairs & maintenance, 📍 Location & hours, or anything else about Kassangas Music Shop. What would you like to know?',
    'Help',
    90,
    1.0,
    true
  ),
  (
    (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
    'canned_reply',
    'escalation',
    'Thank you for reaching out. For more detailed assistance, please contact Gideon directly at 0702245555 or visit us in person. We''re happy to help!',
    'Escalation',
    80,
    1.0,
    true
  );

-- Step 5: Insert Control Settings for Kassangas
INSERT INTO alphadome.bot_control_settings (
  bot_tenant_id,
  is_bot_enabled,
  max_messages_per_hour,
  max_messages_per_user_per_day,
  enable_ai_responses,
  enable_payment_flow,
  enable_training_mode,
  enable_auto_reply,
  log_conversations,
  log_errors,
  escalation_phone,
  escalation_email,
  metadata
) VALUES (
  (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555' LIMIT 1),
  true,                                              -- is_bot_enabled
  200,                                              -- max_messages_per_hour
  50,                                               -- max_messages_per_user_per_day
  true,                                             -- enable_ai_responses
  false,                                            -- enable_payment_flow (can enable later)
  true,                                             -- enable_training_mode (allow Gideon to add more FAQ)
  true,                                             -- enable_auto_reply
  true,                                             -- log_conversations
  true,                                             -- log_errors
  '0702245555',                                     -- escalation_phone (Gideon)
  'gideon@kassangas.example.com',                  -- escalation_email (UPDATE THIS)
  jsonb_build_object(
    'deployment_date', now()::date,
    'notes', 'Initial setup - moderate message limits'
  )
);

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to confirm setup)
-- ============================================================================

-- 1. Verify Kassangas tenant was created
SELECT id, client_name, client_phone, is_active, is_verified 
FROM alphadome.bot_tenants 
WHERE client_phone = '254702245555';

-- 2. Verify templates were created
SELECT id, template_name, is_default, is_active
FROM alphadome.bot_templates
WHERE bot_tenant_id = (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555');

-- 3. Count training data entries
SELECT data_type, COUNT(*) as count
FROM alphadome.bot_training_data
WHERE bot_tenant_id = (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555')
GROUP BY data_type;

-- 4. Verify control settings
SELECT is_bot_enabled, max_messages_per_hour, enable_ai_responses
FROM alphadome.bot_control_settings
WHERE bot_tenant_id = (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555');

-- ============================================================================
-- NEXT STEPS AFTER THIS SCRIPT
-- ============================================================================
--
-- 1. ✅ Database setup complete
-- 2. ⏳ Obtain Gideon's WhatsApp webhook details from Meta
-- 3. ⏳ Test webhook connection (can update webhook_url later)
-- 4. ⏳ Set is_verified = true once webhook is confirmed
-- 5. ⏳ Set is_active = true when ready to go live
-- 6. ⏳ Update server.js to load Kassangas tenant on incoming messages
-- 7. ⏳ Configure dashboard access for Gideon
--
-- UPDATE QUERIES (when you're ready):
--
-- To activate:
-- UPDATE alphadome.bot_tenants SET is_active = true, is_verified = true 
-- WHERE client_phone = '254702245555';
--
-- To add more FAQ:
-- INSERT INTO alphadome.bot_training_data (...) VALUES (...);
--
-- To disable temporarily:
-- UPDATE alphadome.bot_control_settings SET is_bot_enabled = false
-- WHERE bot_tenant_id = (SELECT id FROM alphadome.bot_tenants WHERE client_phone = '254702245555');
--
