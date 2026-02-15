// Catalog webhook endpoint for real-time catalog sync
import express from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const supabase = createClient(process.env.SB_URL, process.env.SB_SERVICE_ROLE_KEY);

// Webhook endpoint to receive catalog updates (POST)
app.post("/webhook/catalog", async (req, res) => {
  const { tenant_phone, catalog } = req.body;
  if (!tenant_phone || !Array.isArray(catalog)) {
    return res.status(400).json({ error: "Missing tenant_phone or catalog array" });
  }
  // Upsert all catalog items
  const { data, error } = await supabase
    .from("catalog")
    .upsert(catalog.map(item => ({ ...item, tenant_phone })), { onConflict: ["tenant_phone", "sku"] });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, updated: data.length });
});

// Start the webhook server (default port 4002)
const PORT = process.env.CATALOG_WEBHOOK_PORT || 4002;
app.listen(PORT, () => {
  console.log(`Catalog webhook server running on port ${PORT}`);
});
