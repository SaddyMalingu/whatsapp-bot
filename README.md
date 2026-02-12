# Alphadome WhatsApp Bot (Multi‑Tenant)

This repo contains the Alphadome WhatsApp bot with multi‑tenant routing, product catalog, and portfolio support.

## Admin Catalog Upload (Dashboard)

Start the server and open:

- http://localhost:3000/admin?key=YOUR_ADMIN_PASS

You can upload:
- Products (JSON)
- Product images (named by SKU)
- CSV catalog import

### Required env vars

- `ADMIN_PASS`
- `SB_URL`
- `SB_SERVICE_ROLE_KEY`

### Upload Flow

1. Run DB migrations:
   - `migrations/2026-02-06_insert_kassangas_test_tenant_and_products.sql`
   - `migrations/2026-02-07_create_product_portfolio_tables.sql`
   - `migrations/2026-02-06_create_product_variants_table.sql`
   - `migrations/2026-02-07_seed_portfolio_rpc.sql`

2. Start server:

```powershell
npm start
```

3. Open dashboard:

```text
http://localhost:3000/admin?key=YOUR_ADMIN_PASS
```

## CLI Upload Test

```powershell
node admin/upload_test.js
```

## Simple Upload Test (Auto‑SKU)

```powershell
node admin/simple_upload_test.js
```

## CSV Import Test

```powershell
node admin/upload_csv_test.js
```

## Notes

- Images should be named by SKU (e.g., `KASS-GTR-001.jpg`).
- The upload endpoint uses the RPC `public.seed_portfolio` to bypass Supabase schema cache issues.
