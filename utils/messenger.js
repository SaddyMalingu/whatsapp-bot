import axios from "axios";
import { log } from "./logger.js";
import { incrementErrorCount } from "./healthMonitor.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SB_URL, process.env.SB_SERVICE_ROLE_KEY);

// ===== SEND WHATSAPP MESSAGE =====
export async function sendMessage(to, message) {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    log(`✅ Message sent successfully to ${to}`, "OUTGOING");

    // Log success to Supabase
    await supabase.from("whatsapp_logs").insert([
      {
        phone: to,
        status: "sent",
        response_code: res.status,
        response_body: res.data,
      },
    ]);

    return true;
  } catch (err) {
    incrementErrorCount();

    const details = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;

    log(`❌ WhatsApp send error to ${to}: ${details}`, "ERROR");

    // Log failure in Supabase for retry tracking
    await supabase.from("whatsapp_logs").insert([
      {
        phone: to,
        status: "failed",
        error_message: details,
      },
    ]);

    return false; // important for retry logic
  }
}
