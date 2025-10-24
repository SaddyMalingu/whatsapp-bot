// supabase/functions/whatsapp-webhook/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment variables from Supabase
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// WhatsApp verify token
const VERIFY_TOKEN = Deno.env.get("VERIFY_TOKEN") || "my_verify_token";

serve(async (req) => {
  const { method, url } = req;
  const { searchParams } = new URL(url);

  // ✅ 1. Webhook Verification (GET request)
  if (method === "GET") {
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified!");
      return new Response(challenge, { status: 200 });
    } else {
      return new Response("Verification failed", { status: 403 });
    }
  }

  // ✅ 2. Incoming Message (POST request)
  if (method === "POST") {
    try {
      const body = await req.json();
      console.log("Received message:", body);

      // Extract message details safely
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const message = changes?.value?.messages?.[0];

      if (!message) {
        return new Response("No message found", { status: 200 });
      }

      const from = message.from; // User's WhatsApp number
      const text = message.text?.body || "";
      const timestamp = new Date().toISOString();

      // Store message in Supabase
      const { error } = await supabase.from("conversations").insert([
        {
          user_id: from,
          message: text,
          direction: "inbound",
          created_at: timestamp,
        },
      ]);

      if (error) throw error;

      return new Response("Message stored successfully", { status: 200 });
    } catch (err) {
      console.error("Error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
