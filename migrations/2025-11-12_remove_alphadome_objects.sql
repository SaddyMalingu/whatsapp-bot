-- Cleanup script: Remove Alphadome schema and related objects (staging-safe)
-- Run this BEFORE applying the full staging schema if you want a clean slate.
-- IMPORTANT: This will DROP the `alphadome` schema and everything in it.

BEGIN;

-- Drop alphadome schema and all contained objects
DROP SCHEMA IF EXISTS alphadome CASCADE;

-- If you created the pgcrypto extension only for this migration and want to remove it,
-- you can drop it. Be careful: other objects might depend on it.
-- DROP EXTENSION IF EXISTS pgcrypto CASCADE;

COMMIT;

-- Notes:
-- 1) This is destructive for the `alphadome` schema only. It does not touch other schemas (public, auth, storage, realtime).
-- 2) Run this in staging first to ensure you remove any partial runs of the previous migration.
