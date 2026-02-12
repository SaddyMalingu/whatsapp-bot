/*
 admin/seed_products.js
 - Enrich `alphadome.bot_products` with categories, tags, variants
 - Inserts additional sample products and variant rows into metadata

 Usage:
   node admin/seed_products.js

 Notes:
 - Requires SB_URL and SB_SERVICE_ROLE_KEY (service role) in .env
*/

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE_ROLE_KEY || process.env.SB_ANON_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('Missing SB_URL or SB_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

async function insertVariants(productId, variants) {
  // Insert normalized variant rows into alphadome.bot_product_variants
  const rows = variants.map(v => ({
    product_id: productId,
    variant_sku: v.variant_sku,
    name: v.name,
    price: v.price,
    stock_count: v.stock,
    metadata: v.metadata || {}
  }));

  const { data, error } = await supabase.from('alphadome.bot_product_variants').insert(rows).select();
  if (error) throw error;
  return data;
}

async function main() {
  try {
    // Use RPC to bypass schema cache (no hardcoding)
    const tenantPhone = process.env.TENANT_PHONE || '0702245555';

    // Build payload for RPC
    const products = [
      {
        sku: 'KASS-STR-005',
        name: 'Guitar Strings (Set of 6)',
        description: 'High-quality phosphor bronze strings for acoustic guitars. Bright tone and long life.',
        price: 1200.00,
        currency: 'KES',
        stock_count: 50,
        image_url: null,
        metadata: { category: 'accessories', tags: ['strings','guitar','accessory'], condition: 'new', brand: 'Kassangas' }
      },
      {
        sku: 'KASS-CASE-006',
        name: 'Guitar Hard Case',
        description: 'Durable hard case with plush interior padding. Fits most dreadnought and full-size guitars.',
        price: 6500.00,
        currency: 'KES',
        stock_count: 12,
        image_url: null,
        metadata: { category: 'cases', tags: ['case','protection'], condition: 'new', brand: 'Kassangas' }
      },
      {
        sku: 'KASS-MIC-007',
        name: 'Dynamic Vocal Microphone',
        description: 'Cardioid dynamic mic for live vocals and rehearsals. Includes cable and pouch.',
        price: 3800.00,
        currency: 'KES',
        stock_count: 18,
        image_url: null,
        metadata: { category: 'microphones', tags: ['mic','vocal','live'], condition: 'new', brand: 'Kassangas' }
      },
      {
        sku: 'KASS-DRM-008',
        name: '5-Piece Drum Kit',
        description: 'Complete 5-piece drum kit with cymbals and hardware. Ideal for beginners.',
        price: 59000.00,
        currency: 'KES',
        stock_count: 1,
        image_url: null,
        metadata: { category: 'drums', tags: ['drum','kit','percussion'], condition: 'new', brand: 'Kassangas' }
      }
    ];
    const variants = [
      { product_sku: 'KASS-GTR-001', variant_sku: 'KASS-GTR-001-S', name: 'Natural - Spruce', price: 12500.00, stock_count: 3, metadata: { finish: 'natural', top: 'spruce' } },
      { product_sku: 'KASS-GTR-001', variant_sku: 'KASS-GTR-001-BLK', name: 'Black Finish', price: 12750.00, stock_count: 5, metadata: { finish: 'black' } },
      { product_sku: 'KASS-KBD-003', variant_sku: 'KASS-KBD-003-BLK', name: 'Black Finish', price: 48000.00, stock_count: 1, metadata: { finish: 'black' } },
      { product_sku: 'KASS-KBD-003', variant_sku: 'KASS-KBD-003-WHT', name: 'White Finish', price: 49000.00, stock_count: 1, metadata: { finish: 'white' } }
    ];

    const images = [
      { product_sku: 'KASS-GTR-001', image_url: 'https://images.unsplash.com/photo-1511376777868-611b54f68947?auto=format&fit=crop&w=800&q=60', is_primary: true },
      { product_sku: 'KASS-EGTR-002', image_url: 'https://images.unsplash.com/photo-1518444023807-0ea5f6b7c3d1?auto=format&fit=crop&w=800&q=60', is_primary: true },
      { product_sku: 'KASS-KBD-003', image_url: 'https://images.unsplash.com/photo-1519340333755-47a7e9b9f7f7?auto=format&fit=crop&w=800&q=60', is_primary: true },
      { product_sku: 'KASS-AMP-004', image_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=60', is_primary: true }
    ];

    const collections = [
      { name: 'Featured', description: 'Top picks and best sellers', sort_order: 1 },
      { name: 'New Arrivals', description: 'Latest instruments in stock', sort_order: 2 },
      { name: 'Accessories', description: 'Strings, cases, and add-ons', sort_order: 3 }
    ];

    const collectionItems = [
      { collection_name: 'Featured', product_sku: 'KASS-GTR-001', sort_order: 1 },
      { collection_name: 'Featured', product_sku: 'KASS-EGTR-002', sort_order: 2 },
      { collection_name: 'Featured', product_sku: 'KASS-KBD-003', sort_order: 3 },
      { collection_name: 'Accessories', product_sku: 'KASS-STR-005', sort_order: 1 },
      { collection_name: 'Accessories', product_sku: 'KASS-CASE-006', sort_order: 2 },
      { collection_name: 'New Arrivals', product_sku: 'KASS-MIC-007', sort_order: 1 },
      { collection_name: 'New Arrivals', product_sku: 'KASS-DRM-008', sort_order: 2 }
    ];

    const payload = { products, variants, images, collections, collection_items: collectionItems };
    const { data, error } = await supabase.rpc('seed_portfolio', { tenant_phone: tenantPhone, payload });
    if (error) throw error;
    console.log('Seeded via RPC:', data);

    console.log('Seeding complete');
  } catch (e) {
    console.error('Error seeding products:', e.message || e);
    process.exit(1);
  }
}

main();
