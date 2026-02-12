import fs from "fs";
import path from "path";
import { log } from "./logger.js";

const logFile = path.join(process.cwd(), "logs", "bot.log");

export function analyzeLogs() {
  try {
    if (!fs.existsSync(logFile)) {
      log("No log file found to analyze.", "SYSTEM");
      return;
    }

    const data = fs.readFileSync(logFile, "utf8");
    const lines = data.split("\n").filter(Boolean);

    const errors = lines.filter(l => l.includes("[ERROR]"));
    const warns = lines.filter(l => l.includes("[WARN]"));
    const gptIssues = errors.filter(l => l.includes("GPT"));
    const waIssues = errors.filter(l => l.includes("WhatsApp"));

    log("===== SELF-DIAGNOSTIC SUMMARY =====", "SYSTEM");
    log(`Total log entries: ${lines.length}`, "SYSTEM");
    log(`Errors found: ${errors.length}`, "ERROR");
    log(`Warnings found: ${warns.length}`, "WARN");
    log(`GPT-related issues: ${gptIssues.length}`, "AI");
    log(`WhatsApp send issues: ${waIssues.length}`, "OUTGOING");

    if (errors.length === 0 && warns.length === 0) {
      log("✅ System health: stable", "SYSTEM");
    } else {
      log("⚠️ Issues detected — check bot.log for details", "WARN");
    }

  } catch (err) {
    log(`Diagnostics error: ${err.message}`, "ERROR");
  }
}
