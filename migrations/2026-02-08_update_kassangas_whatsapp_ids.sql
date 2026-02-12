-- Migration: Update Kassangas tenant WhatsApp IDs
-- Date: 2026-02-08

-- Set the correct WhatsApp phone_number_id (from Render logs)
UPDATE alphadome.bot_tenants
SET whatsapp_phone_number_id = '868405499681303'
WHERE client_phone IN ('254702245555', '0702245555');

-- Optional: set WhatsApp business_account_id if available
-- UPDATE alphadome.bot_tenants
-- SET whatsapp_business_account_id = '<PASTE_BUSINESS_ACCOUNT_ID>'
-- WHERE client_phone IN ('254702245555', '0702245555');

-- Verify
SELECT id, client_name, client_phone, whatsapp_phone_number_id, whatsapp_business_account_id
FROM alphadome.bot_tenants
WHERE client_phone IN ('254702245555', '0702245555');
