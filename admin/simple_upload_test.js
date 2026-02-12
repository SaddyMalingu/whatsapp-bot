/*
  Tiny runner: posts a simple product to /admin/catalog/simple
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
form.append('name', 'Studio Headphones');
form.append('price', '8200');
form.append('stock_count', '6');
form.append('category', 'audio');
form.append('tags', 'headphones,studio');
form.append('brand', 'Kassangas');
form.append('description', 'Closed-back monitoring headphones for studio work.');
form.append('collection', 'Featured');
form.append('collection_description', 'Top picks and best sellers');

const testImage = path.join(process.cwd(), 'admin', 'images', 'sample.jpg');
if (fs.existsSync(testImage)) {
  form.append('images', fs.createReadStream(testImage));
}

const res = await fetchFn(`${SERVER_URL}/admin/catalog/simple`, {
  method: 'POST',
  headers: { 'x-admin-key': ADMIN_PASS },
  body: form
});

const json = await res.json();
console.log(JSON.stringify(json, null, 2));
