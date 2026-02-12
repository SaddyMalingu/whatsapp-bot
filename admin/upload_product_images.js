/*
 Admin: upload_product_images.js
 - Uploads local product images (or downloads remote URLs) to Supabase Storage
 - Updates `alphadome.bot_products.image_url` with the public URL

 Usage:
   1. Ensure .env contains SB_URL and SB_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY if needed
   2. Put image files in ./admin/images or provide a CSV mapping
   3. Run: node admin/upload_product_images.js

 Notes:
 - This script requires @supabase/supabase-js and node-fetch (for remote downloads)
 - It will create a storage bucket named 'product-images' if it doesn't exist
*/

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE_ROLE_KEY || process.env.SB_ANON_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('Missing SB_URL or SB_SERVICE_ROLE_KEY / SB_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const IMAGES_DIR = path.join(process.cwd(), 'admin', 'images');
const BUCKET = 'product-images';

async function ensureBucket() {
  try {
    const { data: exists, error } = await supabase.storage.getBucket(BUCKET).catch(() => ({ data: null, error: null }));
    // supabase-js v2 getBucket returns bucket meta or null; create if not exists
    if (!exists) {
      console.log('Creating storage bucket:', BUCKET);
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
      if (createErr) throw createErr;
    }
  } catch (e) {
    console.warn('Could not ensure bucket existence; trying to proceed:', e.message || e);
  }
}

async function uploadFile(filePath, destKey) {
  const fileStream = fs.createReadStream(filePath);
  const { data, error } = await supabase.storage.from(BUCKET).upload(destKey, fileStream, { upsert: true });
  if (error) throw error;
  // build public URL
  const publicUrl = `${SB_URL.replace('/rest/v1', '').replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(destKey)}`;
  return publicUrl;
}

async function downloadRemoteToTemp(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);
  const buffer = await res.buffer();
  fs.writeFileSync(destPath, buffer);
}

async function updateProductImageUrl(productId, url) {
  const { error } = await supabase.from('alphadome.bot_products').update({ image_url: url, updated_at: new Date().toISOString() }).eq('id', productId);
  if (error) throw error;
}

async function insertProductImage(productId, url, isPrimary = true) {
  const { error } = await supabase.from('alphadome.bot_product_images').insert({
    product_id: productId,
    image_url: url,
    is_primary: isPrimary,
    sort_order: 1
  });
  if (error) throw error;
}

async function main() {
  await ensureBucket();

  if (!fs.existsSync(IMAGES_DIR)) {
    console.error('Images directory not found:', IMAGES_DIR);
    process.exit(1);
  }

  // Expected file mapping format: product_{sku}.{ext} OR product_{id}.{ext}
  const files = fs.readdirSync(IMAGES_DIR).filter(f => !f.startsWith('.'));
  if (files.length === 0) {
    console.log('No images found in', IMAGES_DIR);
    process.exit(0);
  }

  for (const fileName of files) {
    const localPath = path.join(IMAGES_DIR, fileName);
    // try to map SKU or ID from filename
    const base = path.parse(fileName).name; // e.g., KASS-GTR-001 or <uuid>
    const destKey = `${Date.now()}_${fileName}`;

    try {
      const publicUrl = await uploadFile(localPath, destKey);
      console.log('Uploaded', fileName, '->', publicUrl);

      // Try to update by SKU first
      const { data: bySku, error: skuErr } = await supabase.from('alphadome.bot_products').select('id').eq('sku', base).limit(1).maybeSingle();
      if (skuErr) throw skuErr;
      if (bySku && bySku.id) {
        await updateProductImageUrl(bySku.id, publicUrl);
        await insertProductImage(bySku.id, publicUrl, true);
        console.log('Updated product (by SKU) image_url and portfolio image for', base);
        continue;
      }

      // Try to update by product id
      const { data: byId, error: idErr } = await supabase.from('alphadome.bot_products').select('id').eq('id', base).limit(1).maybeSingle();
      if (idErr) throw idErr;
      if (byId && byId.id) {
        await updateProductImageUrl(byId.id, publicUrl);
        await insertProductImage(byId.id, publicUrl, true);
        console.log('Updated product (by ID) image_url and portfolio image for', base);
        continue;
      }

      console.log('No matching product found for', base, '— uploaded but not linked');
    } catch (e) {
      console.error('Error processing', fileName, e.message || e);
    }
  }

  console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
