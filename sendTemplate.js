// sendTemplate.js
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

async function sendTemplate(to) {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: "afrika", // ✅ your approved template
          language: { code: "en" }, // use en_US for English
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Template 'afrika' sent successfully to ${to}`);
    console.log("Response:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("❌ Failed to send template:");
    console.error(err.response?.data || err.message);
  }
}

// Run via command line argument
const number = process.argv[2];
if (!number) {
  console.error("⚠️ Usage: node sendTemplate.js <whatsapp_number>");
  process.exit(1);
}

sendTemplate(number);
