/*
  Tiny runner: posts a sample product payload to /admin/catalog/upload
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

const form = new FormData();
form.append('tenant_phone', '0702245555');
form.append('products_json', JSON.stringify([
  {
    sku: 'KASS-NEW-010',
    name: 'Mic Stand (Boom)',
    description: 'Adjustable boom mic stand for stage and studio.',
    price: 3200,
    currency: 'KES',
    stock_count: 8,
    image_url: null,
    metadata: { category: 'accessories', tags: ['mic','stand'], brand: 'Kassangas' }
  }
]));

const testImage = path.join(process.cwd(), 'admin', 'images', 'KASS-NEW-010.jpg');
if (fs.existsSync(testImage)) {
  form.append('images', fs.createReadStream(testImage));
}

const res = await fetchFn(`${SERVER_URL}/admin/catalog/upload`, {
  method: 'POST',
  headers: { 'x-admin-key': ADMIN_PASS },
  body: form
});

const json = await res.json();
console.log(JSON.stringify(json, null, 2));
