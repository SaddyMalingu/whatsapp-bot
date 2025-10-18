import fs from "fs";
import path from "path";
import { log } from "./logger.js";
import { sendMessage } from "./messenger.js";

let errorCount = 0;

// ====== INCREMENT ERROR COUNT ======
export function incrementErrorCount() {
  errorCount++;
}

// Reset error count every hour
setInterval(() => {
  errorCount = 0;
}, 60 * 60 * 1000);

// ====== AUTOMATIC HEALTH MONITOR ======
export function startHealthMonitor(admins = [], thresholdMB = 200) {
  setInterval(() => runHealthCheck(admins, thresholdMB), 6 * 60 * 60 * 1000);
  log("Health monitor started.", "SYSTEM");
}

// ====== MANUAL HEALTH CHECK ======
export async function runHealthCheck(admins = [], thresholdMB = 200) {
  const mem = process.memoryUsage();
  const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const rss = (mem.rss / 1024 / 1024).toFixed(2);
  const uptime = (process.uptime() / 3600).toFixed(2); // hours

  const health = {
    timestamp: new Date().toISOString(),
    uptimeHours: uptime,
    rssMB: rss,
    heapUsedMB: heapUsed,
    errorsLastHour: errorCount,
  };

  const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
fs.writeFileSync(path.join(logDir, "health.json"), JSON.stringify(health, null, 2));

  log("✅ Manual health check recorded.", "SYSTEM");

  if (heapUsed > thresholdMB || errorCount > 5) {
    for (const admin of admins) {
      await sendMessage(
        admin,
        `⚠️ *Health Alert*\nHeap: ${heapUsed} MB\nErrors (last hour): ${errorCount}\nUptime: ${uptime}h`
      );
    }
    log("Health alert sent to admins.", "WARN");
  }
}
