import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import { createClient } from "@supabase/supabase-js";
import { log } from "./utils/logger.js";
import {
  startHealthMonitor,
  incrementErrorCount,
  runHealthCheck,
} from "./utils/healthMonitor.js";
import { sendMessage } from "./utils/messenger.js";
import crypto from "crypto"; 

dotenv.config();

const app = express();
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SERVICE_ROLE_KEY
);

// ✅ Default brand UUID (your platform brand)
const DEFAULT_BRAND_ID =
  process.env.DEFAULT_BRAND_ID || "1af71403-b4c3-4eac-9aab-48ee2576a9bb";

const ADMIN_PASS = process.env.ADMIN_PASS;
const ADMIN_NUMBERS = process.env.ADMIN_NUMBERS
  ? process.env.ADMIN_NUMBERS.split(",").map((n) => n.trim())
  : [];

startHealthMonitor(ADMIN_NUMBERS, 200);
runHealthCheck(ADMIN_NUMBERS);

let pendingClearConfirmations = {};

// ===== VERIFY WEBHOOK =====
app.get("/webhook", (req, res) => {
  const verify_token = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === verify_token) {
    log("Webhook verified!", "SYSTEM");
    res.status(200).send(challenge);
  } else {
    log("Webhook verification failed", "WARN");
    res.sendStatus(403);
  }
});

// ===== HANDLE INCOMING WHATSAPP MESSAGES =====
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (!body.object) {
    log("Webhook received non-message event", "DEBUG");
    return res.sendStatus(404);
  }

  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.trim();
  const waMessageId = message.id;
  const rawPayload = body.entry?.[0]?.changes?.[0]?.value;

  if (!text) return res.sendStatus(200);

  log(`Received from ${from}: ${text}`, "INCOMING");

  try {
    // STEP 1: Find or create user
    let { data: userData, error: userErr } = await supabase
      .from("users")
      .select("id, phone")
      .eq("phone", from)
      .maybeSingle();

    if (userErr) throw userErr;

    if (!userData) {
      const { data: newUser, error: newUserErr } = await supabase
        .from("users")
        .insert([{ phone: from, full_name: "Unknown User" }])
        .select("id")
        .single();

      if (newUserErr) throw newUserErr;
      userData = newUser;
      log(`New user created: ${from}`, "SYSTEM");
    }

    // STEP 2: Identify brand (fallback to your platform)
    let brandId = DEFAULT_BRAND_ID;
    try {
      const { data: brandData, error: brandErr } = await supabase
        .from("brands")
        .select("id")
        .eq("is_platform_owner", true)
        .limit(1)
        .single();

      if (!brandErr && brandData) {
        brandId = brandData.id;
      }
    } catch {
      brandId = DEFAULT_BRAND_ID;
    }


 // ---------- INSERT START: Join Alphadome / STK flow ----------
    // detect join command (case-insensitive)
    if (text.trim().toUpperCase() === "JOIN ALPHADOME" || text.trim().toUpperCase() === "JOIN") {
      try {
        // normalize phone to 2547XXXXXXXX (no + or leading 0)
        let normalizedPhone = from.replace(/^\+/, "");
        if (normalizedPhone.startsWith("0")) normalizedPhone = "254" + normalizedPhone.slice(1);

        const amount = parseFloat(process.env.SUBSCRIPTION_AMOUNT || "900");
        const accountRef = process.env.SUBSCRIPTION_ACCOUNT_REF || "Alphadome_Basic";

        // create pending subscription
        const { data: newSub, error: subErr } = await supabase
          .from("subscriptions")
          .insert([{
            user_id: userData.id,
            phone: normalizedPhone,
            amount,
            account_ref: accountRef,
            status: "pending",
          }])
          .select("id")
          .single();
        if (subErr) throw subErr;

        // call STK push
        const stkResp = await initiateStkPush({
          phone: normalizedPhone,
          amount,
          accountRef,
          transactionDesc: "Alphadome Subscription"
        });

        const checkoutId = stkResp?.CheckoutRequestID || stkResp?.checkoutRequestID || null;
        if (checkoutId) {
          await supabase
            .from("subscriptions")
            .update({ mpesa_checkout_request_id: checkoutId, metadata: stkResp })
            .eq("id", newSub.id);
        }

        await sendMessage(from, `✅ Payment prompt sent. Please complete the payment on your phone to finish subscription. If you have trouble, call +254117604817 or +254743780542.`);
        log(`STK push initiated for ${from} (sub id ${newSub.id})`, "SYSTEM");
      } catch (err) {
        log(`Failed to initiate subscription for ${from}: ${err.message}`, "ERROR");
        await sendMessage(from, "⚠️ We couldn't start the payment flow. Please try again later or contact +254117604817 or +254743780542 for help.");
      }

      // stop further processing for this incoming message
      return res.sendStatus(200);
    }
    // ---------- INSERT END ----------

  
    // STEP 3: Log inbound message
    const { error: convErr } = await supabase.from("conversations").insert([
      {
        brand_id: brandId,
        user_id: userData.id,
        whatsapp_message_id: waMessageId,
        direction: "incoming",
        raw_payload: rawPayload,
        message_text: text,
        created_at: new Date().toISOString(),
      },
    ]);
    if (convErr) throw convErr;

   

    // STEP 4: Generate AI reply
    const reply = await generateReply(text);
    await sendMessage(from, reply);

    // STEP 5: Log outbound message
    const { error: outErr } = await supabase.from("conversations").insert([
      {
        brand_id: brandId,
        user_id: userData.id,
        direction: "outgoing",
        message_text: reply,
        created_at: new Date().toISOString(),
      },
    ]);
    if (outErr) throw outErr;
  } catch (err) {
    log(`Error processing message from ${from}: ${err.message}`, "ERROR");
  }

  res.sendStatus(200);
});

  // ---------- INSERT START: M-Pesa callback endpoint ----------
    
app.post("/mpesa/callback", async (req, res) => {
  try {
    const body = req.body;

    // respond immediately to provider
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    const checkoutId = body.Body?.stkCallback?.CheckoutRequestID;
    const resultCode = body.Body?.stkCallback?.ResultCode;
    const callbackMetadata = body.Body?.stkCallback?.CallbackMetadata?.Item || [];

    const { data: subs, error: subErr } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("mpesa_checkout_request_id", checkoutId)
      .limit(1)
      .single();

    if (subErr || !subs) {
      log(`MPESA callback: subscription not found for CheckoutRequestID ${checkoutId}`, "WARN");
      return;
    }

    if (resultCode === 0) {
      const receipt = callbackMetadata.find(i => i.Name === "MpesaReceiptNumber")?.Value || null;
      const amount = callbackMetadata.find(i => i.Name === "Amount")?.Value || null;
      const phone = callbackMetadata.find(i => i.Name === "PhoneNumber")?.Value || subs.phone;

      await supabase.from("subscriptions").update({
        status: "paid",
        mpesa_receipt_no: receipt,
        metadata: { callback: body }
      }).eq("id", subs.id);

      await sendMessage(phone, `🎉 Payment received! Thank you for joining Alphadome. Receipt: ${receipt}.`);
      log(`Subscription ${subs.id} marked paid (receipt ${receipt})`, "SYSTEM");
    } else {
      await supabase.from("subscriptions").update({
        status: "failed",
        metadata: { callback: body }
      }).eq("id", subs.id);

      await sendMessage(subs.phone, `⚠️ We couldn't confirm your payment. Please try again or contact +254117604817 or +254743780542 for help.`);
      log(`Subscription ${subs.id} payment failed (ResultCode ${resultCode})`, "WARN");
    }
  } catch (err) {
    log(`MPESA callback processing error: ${err.message}`, "ERROR");
  }
});
// ---------- INSERT END ----------


// ===== ADMIN COMMANDS (unchanged) =====
async function handleDiagnose(from, text) {
  const pass = text.split(" ")[1];
  if (!ADMIN_NUMBERS.includes(from) || pass !== ADMIN_PASS) {
    await sendMessage(from, "❌ Unauthorized or wrong password.");
    log(`Unauthorized /diagnose attempt from ${from}`, "WARN");
    return;
  }

  const mem = process.memoryUsage();
  const uptime = process.uptime().toFixed(0);
  const report = `🩺 Bot Diagnostics:
• Uptime: ${uptime}s
• RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB
• Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`;

  await sendMessage(from, report);
  log(`Sent diagnostics to ${from}`, "SYSTEM");
}

// ... keep handleLogs, handleClearLogs, confirmClearLogs, handleHealthCheck, sendHelpMenu, and generateReply functions exactly as in the last version ...

async function handleLogs(from, text) {
  const pass = text.split(" ")[1];
  if (!ADMIN_NUMBERS.includes(from) || pass !== ADMIN_PASS) {
    await sendMessage(from, "❌ Unauthorized or wrong password.");
    log(`Unauthorized /logs attempt from ${from}`, "WARN");
    return;
  }

  const logPath = path.join(process.cwd(), "logs", "bot.log");
  if (!fs.existsSync(logPath)) {
    await sendMessage(from, "No logs found yet.");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(logPath));
    const uploadResponse = await axios.post("https://file.io", formData, {
      headers: formData.getHeaders(),
    });
    const fileUrl = uploadResponse.data.link;

    await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        type: "document",
        document: { link: fileUrl, filename: "bot.log" },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    log(`Sent log file link to ${from}`, "OUTGOING");
  } catch (err) {
    log(`Failed to send logs: ${err.message}`, "ERROR");
    await sendMessage(from, "⚠️ Error sending log file.");
  }
}

async function handleClearLogs(from, text) {
  const pass = text.split(" ")[1];
  if (!ADMIN_NUMBERS.includes(from) || pass !== ADMIN_PASS) {
    await sendMessage(from, "❌ Unauthorized or wrong password.");
    log(`Unauthorized /clearlogs attempt from ${from}`, "WARN");
    return;
  }

  pendingClearConfirmations[from] = true;
  await sendMessage(from, "⚠️ Are you sure you want to clear logs? Reply with 'YES' within 30 seconds to confirm.");
  log(`Pending /clearlogs confirmation for ${from}`, "SYSTEM");

  setTimeout(() => delete pendingClearConfirmations[from], 30000);
}

async function confirmClearLogs(from) {
  const logPath = path.join(process.cwd(), "logs", "bot.log");
  if (!fs.existsSync(logPath)) {
    await sendMessage(from, "No log file found to clear.");
    return;
  }

  try {
    fs.truncateSync(logPath, 0);
    log("Log file manually cleared by admin after confirmation.", "SYSTEM");
    await sendMessage(from, "🧹 Log file cleared successfully.");
  } catch (err) {
    log(`Error clearing logs: ${err.message}`, "ERROR");
    await sendMessage(from, "⚠️ Failed to clear logs.");
  }
}

async function handleHealthCheck(from, text) {
  const pass = text.split(" ")[1];
  if (!ADMIN_NUMBERS.includes(from) || pass !== ADMIN_PASS) {
    await sendMessage(from, "❌ Unauthorized or wrong password.");
    log(`Unauthorized /healthcheck attempt from ${from}`, "WARN");
    return;
  }

  try {
    const mem = process.memoryUsage();
    const uptimeHours = (process.uptime() / 3600).toFixed(2);
    const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(2);
    const rss = (mem.rss / 1024 / 1024).toFixed(2);

    await runHealthCheck([from]);

    const message = `🩺 *Bot Health Report*
• Uptime: ${uptimeHours} hours
• RSS: ${rss} MB
• Heap Used: ${heapUsed} MB
• Errors (last hour): 0

✅ Health snapshot logged to *logs/health.json*`;

    await sendMessage(from, message);
    log(`Manual health check triggered by ${from}`, "SYSTEM");
  } catch (err) {
    log(`Health check error: ${err.message}`, "ERROR");
    await sendMessage(from, "⚠️ Failed to complete health check.");
  }
}

async function sendHelpMenu(from) {
  const commands = [
    { cmd: "/help", desc: "List all available admin commands." },
    { cmd: "/diagnose <password>", desc: "Show uptime and memory diagnostics." },
    { cmd: "/logs <password>", desc: "Get the latest bot log file." },
    { cmd: "/clearlogs <password>", desc: "Clear the bot log file (requires YES confirmation)." },
    { cmd: "/healthcheck <password>", desc: "Run an instant health check and update logs/health.json." },
  ];

  let message = "🛠 *Admin Commands*\n\n";
  for (const c of commands) message += `• *${c.cmd}*\n  ${c.desc}\n\n`;
  await sendMessage(from, message.trim());
  log(`Sent help menu to ${from}`, "SYSTEM");
}


// ===== GPT REPLY GENERATION ===== 
async function generateReply(userMessage) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful WhatsApp assistant for Alphadome. Be professional, warm, and concise. Encourage users to explore Alphadome’s digital ecosystem and community.",
        },
        { role: "user", content: userMessage },
      ],
    });

    const reply = completion.choices[0].message.content;
    log(`Generated reply: ${reply}`, "AI");
    return reply;

  } catch (err) {
    incrementErrorCount();
    log(`GPT error: ${err.message}`, "ERROR");

    // === Updated fallback message with contact numbers ===
    return `👋 Hey there! Welcome to *Alphadome* — your all-in-one creative AI ecosystem helping brands, creators, and innovators thrive in the digital world.

Here’s a glimpse of what we build and do:

• 🤖 Explore my AI Agent Portfolio → https://beacons.ai/saddymalingu  
• 🎥 Creative Campaigns & Video Reels → https://www.instagram.com/afrika_bc/  
• 🎬 Meet our AI Influencers & Bots →  
   https://www.tiktok.com/@soma.katiba  
   https://www.tiktok.com/@saddymalingu  
• 📰 Read insights & stories — more coming soon!

Alphadome helps brands scale through automation, AI storytelling, and digital creativity.

💡 Want to be part of this system? Reply *Join Alphadome* to get started.

📞 Need help? Contact the creator directly:  
• Call: +254743780542  
• WhatsApp: +254117604817`;
  }
}

// helper: get oauth token from Safaricom Daraja
async function getMpesaAuthToken() {
  try {
    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;
    const auth = Buffer.from(`${key}:${secret}`).toString("base64");

    const base = process.env.MPESA_ENV === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

    const resp = await axios.get(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return resp.data.access_token;
  } catch (err) {
    log(`M-Pesa auth error: ${err.response?.data || err.message}`, "ERROR");
    throw err;
  }
}

// helper: initiate STK push
// phone must be in format 2547XXXXXXXX (no leading 0)
async function initiateStkPush({ phone, amount, accountRef, transactionDesc }) {
  try {
    const token = await getMpesaAuthToken();
    const base = process.env.MPESA_ENV === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14); // YYYYMMDDhhmmss
    const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

    const body = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,               // MSISDN sending the money
      PartyB: shortcode,           // paybill/shortcode receiving payment
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: accountRef,
      TransactionDesc: transactionDesc || "Alphadome subscription"
    };

    const resp = await axios.post(`${base}/mpesa/stkpush/v1/processrequest`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    // resp.data should contain CheckoutRequestID & ResponseCode
    return resp.data;
  } catch (err) {
    log(`STK Push error: ${err.response?.data || err.message}`, "ERROR");
    throw err;
  }
}

// ===== LIVE LOG STREAM =====
app.get("/logs/live", async (req, res) => {
  const key = req.query.key;
  if (key !== process.env.ADMIN_PASS) {
    return res.status(403).send("Unauthorized");
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const { data: recentLogs, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!error && recentLogs) {
    recentLogs.reverse().forEach((logEntry) => {
      res.write(`data: [${logEntry.created_at}] [${logEntry.level}] [${logEntry.source}] ${logEntry.message}\n\n`);
    });
  }

  let lastCheck = new Date().toISOString();
  const interval = setInterval(async () => {
    const { data: newLogs } = await supabase
      .from("logs")
      .select("*")
      .gt("created_at", lastCheck)
      .order("created_at", { ascending: true });

    if (newLogs && newLogs.length > 0) {
      lastCheck = newLogs[newLogs.length - 1].created_at;
      newLogs.forEach((logEntry) => {
        res.write(`data: [${logEntry.created_at}] [${logEntry.level}] [${logEntry.source}] ${logEntry.message}\n\n`);
      });
    }
  }, 3000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});


// ========== GET HISTORICAL LOGS ==========
// Example usage: /logs/history?days=3&key=YOUR_ADMIN_PASS
app.get("/logs/history", async (req, res) => {
  try {
    const { key, days = 3 } = req.query;

    // 🔐 Security check
    if (key !== process.env.ADMIN_PASS) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // ⏱ Get logs from X days ago
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[HISTORY LOG ERROR]", error.message);
      return res.status(500).json({ error: error.message });
    }

    // 🗂 Return logs in JSON
    res.status(200).json({
      message: `Fetched ${data.length} logs from the last ${days} day(s)`,
      logs: data,
    });
  } catch (err) {
    console.error("[HISTORY ROUTE ERROR]", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === AUTO-RETRY FAILED WHATSAPP MESSAGES ===
setInterval(async () => {
  try {
    const { data: failedMsgs, error } = await supabase
      .from("whatsapp_logs")
      .select("id, phone, error_message, retry_count")
      .eq("status", "failed")
      .lt("retry_count", 3) // only retry up to 3 times
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );

    if (error) throw error;
    if (!failedMsgs?.length) return;

    log(`🔁 Retrying ${failedMsgs.length} failed WhatsApp messages`, "SYSTEM");

    for (const msg of failedMsgs) {
      try {
        const fallback = `🙏 *Apologies for the delay!* We had a temporary issue earlier, but we're back online now.  

👋 Hey there! Welcome to *Alphadome* — your all-in-one creative AI ecosystem helping brands, creators, and innovators thrive in the digital world. 

Here’s a glimpse of what we build and do:

• 🤖 Explore my AI Agent Portfolio → https://beacons.ai/saddymalingu  
• 🎥 Creative Campaigns & Video Reels → https://www.instagram.com/afrika_bc/  
• 🎬 Meet our AI Influencers & Bots →  
   https://www.tiktok.com/@soma.katiba  
   https://www.tiktok.com/@saddymalingu  
• 📰 Read insights & stories — more coming soon!

Alphadome helps brands scale through automation, AI storytelling, and digital creativity.

💡 Want to be part of this system? Reply *Join Alphadome* to get started.

📞 Need help? Contact the creator directly:  
• Call : +254743780542  
• WhatsApp: +254117604817`;

        const sent = await sendMessage(msg.phone, fallback);
        if (sent) {
          await supabase
            .from("whatsapp_logs")
            .update({ status: "resent", retry_count: (msg.retry_count || 0) + 1 })
            .eq("id", msg.id);

          log(`✅ Successfully resent message to ${msg.phone}`, "SYSTEM");
        } else {
          throw new Error("Message send failed (no confirmation).");
        }
      } catch (retryErr) {
        // increment retry count and mark as permanently failed after 3 attempts
        const nextRetry = (msg.retry_count || 0) + 1;
        const newStatus = nextRetry >= 3 ? "permanent_failure" : "failed";

        await supabase
          .from("whatsapp_logs")
          .update({ retry_count: nextRetry, status: newStatus })
          .eq("id", msg.id);

        log(
          `❌ Retry ${nextRetry} failed for ${msg.phone}: ${retryErr.message}`,
          "ERROR"
        );
      }
    }
  } catch (err) {
    log(`Retry job failed: ${err.message}`, "ERROR");
  }
}, 5 * 60 * 1000); // runs every 5 minutes


// ===== START SERVER =====
app.listen(process.env.PORT, () => {
  log(`Server running on port ${process.env.PORT}`, "SYSTEM");
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
