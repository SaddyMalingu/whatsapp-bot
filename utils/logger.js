import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Log LLM env presence at startup (no secrets)
try {
  const envLog = `[${new Date().toISOString()}] [SYSTEM] ENV LLM keys: openai=${Boolean(process.env.OPENAI_API_KEY)} openrouter=${Boolean(process.env.OPENROUTER_KEY)} hf=${Boolean(process.env.HF_API_KEY)}`;
  console.log(envLog);
} catch (err) {
  console.log(`[${new Date().toISOString()}] [WARN] ENV LLM keys log failed: ${err?.message || err}`);
}

// === Initialize Supabase client ===
const supabase = createClient(process.env.SB_URL, process.env.SB_SERVICE_ROLE_KEY);

// === Local log directory setup ===
const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, "bot.log");

// === Auto-rotate if file > 1MB ===
function rotateIfNeeded() {
  try {
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > 1024 * 1024) {
        const backupName = `bot_${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
        fs.renameSync(logFile, path.join(logDir, backupName));
        fs.writeFileSync(logFile, ""); // start fresh
      }
    }
  } catch (err) {
    console.error("[LOGGER ROTATION ERROR]", err?.message || err);
  }
}

// === Unified logger (console + file + Supabase) ===
export function log(message, type = "INFO") {
  rotateIfNeeded();

  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type}] ${message}\n`;

  // Print to console
  console.log(logEntry.trim());

  // Save to local file
  try {
    fs.appendFileSync(logFile, logEntry);
  } catch (err) {
    console.error("[LOGGER FILE ERROR]", err?.message || err);
  }

  // Save to Supabase (non-blocking)
  supabase
    .from("logs")
    .insert([
      {
        message,
        level: type,
        source: "BOT",
        created_at: new Date().toISOString(),
      },
    ])
    .then(({ error }) => {
      if (error) console.error("[LOGGER DB ERROR]", error.message);
    });
}
