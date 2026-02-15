// Simple Express-based admin dashboard for catalog/training data management
import express from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const supabase = createClient(process.env.SB_URL, process.env.SB_SERVICE_ROLE_KEY);

// Basic auth middleware (reuse ADMIN_PASS)
const ADMIN_PASS = process.env.ADMIN_PASS;
function adminAuth(req, res, next) {
  const key = req.headers["x-admin-key"] || req.query.key;
  if (!ADMIN_PASS || key !== ADMIN_PASS) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// List all catalog items for a tenant
app.get("/catalog", adminAuth, async (req, res) => {
  const { tenant_phone } = req.query;
  if (!tenant_phone) return res.status(400).json({ error: "Missing tenant_phone" });
  const { data, error } = await supabase
    .from("catalog")
    .select("*")
    .eq("tenant_phone", tenant_phone);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Add or update a catalog item
app.post("/catalog", adminAuth, async (req, res) => {
  const item = req.body;
  if (!item.tenant_phone || !item.name) return res.status(400).json({ error: "Missing fields" });
  const { data, error } = await supabase
    .from("catalog")
    .upsert([item], { onConflict: ["tenant_phone", "sku"] });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// List all training data for a tenant
app.get("/training", adminAuth, async (req, res) => {
  const { tenant_phone } = req.query;
  if (!tenant_phone) return res.status(400).json({ error: "Missing tenant_phone" });
  const { data, error } = await supabase
    .from("training_data")
    .select("*")
    .eq("tenant_phone", tenant_phone);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Add or update a training data entry
app.post("/training", adminAuth, async (req, res) => {
  const entry = req.body;
  if (!entry.tenant_phone || !entry.question) return res.status(400).json({ error: "Missing fields" });
  const { data, error } = await supabase
    .from("training_data")
    .upsert([entry], { onConflict: ["tenant_phone", "question"] });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Start the dashboard server (default port 4001)
const PORT = process.env.ADMIN_DASHBOARD_PORT || 4001;
app.listen(PORT, () => {
  console.log(`Admin dashboard running on port ${PORT}`);
});
