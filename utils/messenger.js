import axios from "axios";
import { log } from "./logger.js";
import { incrementErrorCount } from "./healthMonitor.js"; // ✅ add this line

// ===== SEND WHATSAPP MESSAGE =====
export async function sendMessage(to, message) {
  try {
    await axios.post(
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

    log(`Message sent successfully to ${to}`, "OUTGOING");
  } catch (err) {
    incrementErrorCount(); // ✅ increment error counter when message fails
    const details = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    log(`WhatsApp send error: ${details}`, "ERROR");
  }
}
