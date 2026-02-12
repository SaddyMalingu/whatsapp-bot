import axios from "axios";
import { log } from "./logger.js";
import { incrementErrorCount } from "./healthMonitor.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SB_URL, process.env.SB_SERVICE_ROLE_KEY);

function resolveAuth(creds) {
  return {
    token: creds?.whatsappToken || process.env.WHATSAPP_TOKEN,
    phoneNumberId: creds?.whatsappPhoneNumberId || process.env.PHONE_NUMBER_ID,
  };
}

function isInvalidOAuthToken(err) {
  const code = err?.response?.data?.error?.code;
  const message = err?.response?.data?.error?.message || "";
  return code === 190 || message.toLowerCase().includes("invalid oauth access token");
}

async function postWhatsAppMessage(to, payload, creds = null) {
  const { token, phoneNumberId } = resolveAuth(creds);
  return axios.post(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
}

// ===== SEND WHATSAPP MESSAGE =====
export async function sendMessage(to, message, creds = null) {
  try {
    const res = await postWhatsAppMessage(
      to,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      },
      creds
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
    if (creds && isInvalidOAuthToken(err)) {
      log("⚠️ Invalid tenant token detected; retrying with fallback credentials", "WARN");
      try {
        const res = await postWhatsAppMessage(
          to,
          {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: message },
          },
          null
        );
        log(`✅ Message sent successfully to ${to}`, "OUTGOING");
        await supabase.from("whatsapp_logs").insert([
          {
            phone: to,
            status: "sent",
            response_code: res.status,
            response_body: res.data,
          },
        ]);
        return true;
      } catch (retryErr) {
        err = retryErr;
      }
    }
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

// ===== SEND IMAGE MESSAGE =====
export async function sendImage(to, imageUrl, caption = "", creds = null) {
  try {
    const res = await postWhatsAppMessage(
      to,
      {
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: { link: imageUrl, caption },
      },
      creds
    );

    log(`✅ Image sent successfully to ${to}`, "OUTGOING");
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
    if (creds && isInvalidOAuthToken(err)) {
      log("⚠️ Invalid tenant token detected; retrying image with fallback credentials", "WARN");
      try {
        const res = await postWhatsAppMessage(
          to,
          {
            messaging_product: "whatsapp",
            to,
            type: "image",
            image: { link: imageUrl, caption },
          },
          null
        );
        log(`✅ Image sent successfully to ${to}`, "OUTGOING");
        await supabase.from("whatsapp_logs").insert([
          {
            phone: to,
            status: "sent",
            response_code: res.status,
            response_body: res.data,
          },
        ]);
        return true;
      } catch (retryErr) {
        err = retryErr;
      }
    }
    incrementErrorCount();
    const details = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    log(`❌ WhatsApp image send error to ${to}: ${details}`, "ERROR");
    await supabase.from("whatsapp_logs").insert([
      {
        phone: to,
        status: "failed",
        error_message: details,
      },
    ]);
    return false;
  }
}

// ===== SEND INTERACTIVE LIST =====
export async function sendInteractiveList(to, bodyText, buttonText, sections, creds = null) {
  try {
    const res = await postWhatsAppMessage(
      to,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: bodyText },
          action: { button: buttonText, sections },
        },
      },
      creds
    );

    log(`✅ Interactive list sent successfully to ${to}`, "OUTGOING");
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
    if (creds && isInvalidOAuthToken(err)) {
      log("⚠️ Invalid tenant token detected; retrying list with fallback credentials", "WARN");
      try {
        const res = await postWhatsAppMessage(
          to,
          {
            messaging_product: "whatsapp",
            to,
            type: "interactive",
            interactive: {
              type: "list",
              body: { text: bodyText },
              action: { button: buttonText, sections },
            },
          },
          null
        );
        log(`✅ Interactive list sent successfully to ${to}`, "OUTGOING");
        await supabase.from("whatsapp_logs").insert([
          {
            phone: to,
            status: "sent",
            response_code: res.status,
            response_body: res.data,
          },
        ]);
        return true;
      } catch (retryErr) {
        err = retryErr;
      }
    }
    incrementErrorCount();
    const details = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    log(`❌ WhatsApp list send error to ${to}: ${details}`, "ERROR");
    await supabase.from("whatsapp_logs").insert([
      {
        phone: to,
        status: "failed",
        error_message: details,
      },
    ]);
    return false;
  }
}
