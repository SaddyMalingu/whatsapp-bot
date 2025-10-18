import fs from "fs";
import path from "path";

const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, "bot.log");

// Auto-rotate if log file exceeds 1 MB
function rotateIfNeeded() {
  try {
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > 1024 * 1024) { // 1 MB
        const backupName = `bot_${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
        fs.renameSync(logFile, path.join(logDir, backupName));
        fs.writeFileSync(logFile, ""); // start fresh
      }
    }
  } catch (err) {
    console.error("[LOGGER ROTATION ERROR]", err?.message || err);
  }
}

// unified logger
export function log(message, type = "INFO") {
  rotateIfNeeded();

  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type}] ${message}\n`;

  try {
    console.log(logEntry.trim());
  } catch {}

  try {
    fs.appendFileSync(logFile, logEntry);
  } catch (err) {
    console.error("[LOGGER ERROR]", err?.message || err);
  }
}
