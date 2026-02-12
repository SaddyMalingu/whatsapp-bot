/*
  Tiny runner: posts a CSV file to /admin/catalog/import-csv
  Requires server running and ADMIN_PASS set.
*/

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
const fetchFn = globalThis.fetch;

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ADMIN_PASS = process.env.ADMIN_PASS;

if (!ADMIN_PASS) {
  console.error('ADMIN_PASS not set');
  process.exit(1);
}

if (!fetchFn) {
  console.error('fetch is not available in this Node version');
  process.exit(1);
}

const csvPath = path.join(process.cwd(), 'admin', 'catalog_template.csv');
if (!fs.existsSync(csvPath)) {
  console.error('CSV template not found:', csvPath);
  process.exit(1);
}

const form = new FormData();
form.append('tenant_phone', '0702245555');
form.append('catalog_csv', fs.createReadStream(csvPath));

const res = await fetchFn(`${SERVER_URL}/admin/catalog/import-csv`, {
  method: 'POST',
  headers: { 'x-admin-key': ADMIN_PASS },
  body: form
});

const json = await res.json();
console.log(JSON.stringify(json, null, 2));
