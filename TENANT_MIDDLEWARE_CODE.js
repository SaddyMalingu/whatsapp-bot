// ============================================================================
// TENANT-AWARE MIDDLEWARE & UPDATED FUNCTIONS FOR server.js
// ============================================================================
// 
// Add these functions to server.js AFTER line 47 (after getPaymentAmount)
// and BEFORE the webhook handlers
//
// This enables multi-tenant support while maintaining backward compatibility
//
// ============================================================================

// ========== MULTI-TENANT SUPPORT: Load Tenant Context ==========
/**
 * Middleware to load tenant configuration by incoming phone number
 * Attaches req.tenant (or null if no tenant found)
 * Attaches req.isTenantAware (true if tenant found, false = fallback to default)
 */
async function loadTenantContext(req, res, next) {
  try {
    // Extract phone number from incoming message
    const incomingPhone = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
    
    if (!incomingPhone) {
      // Not a message event, skip tenant loading
      req.tenant = null;
      req.isTenantAware = false;
      return next();
    }

    // Look up tenant by phone number in database
    const { data: tenant, error } = await supabase
      .from("alphadome.bot_tenants")
      .select("*")
      .eq("client_phone", incomingPhone)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = "not found", which is OK
      log(`Tenant lookup error for ${incomingPhone}: ${error.message}`, "WARN");
      req.tenant = null;
      req.isTenantAware = false;
      return next();
    }

    if (!tenant) {
      // No tenant config - use default (backward compatibility)
      log(`No tenant found for ${incomingPhone} - using default`, "DEBUG");
      req.tenant = null;
      req.isTenantAware = false;
      return next();
    }

    // Tenant found!
    if (!tenant.is_active) {
      log(`Tenant ${tenant.client_name} is inactive - using fallback`, "WARN");
      req.tenant = null;
      req.isTenantAware = false;
      return next();
    }

    // Attach tenant to request
    req.tenant = tenant;
    req.isTenantAware = true;
    log(`✓ Tenant loaded: ${tenant.client_name} (${incomingPhone})`, "SYSTEM");

    next();
  } catch (err) {
    log(`Unexpected error in loadTenantContext: ${err.message}`, "ERROR");
    req.tenant = null;
    req.isTenantAware = false;
    next();
  }
}

// ========== MULTI-TENANT SUPPORT: Load Tenant Templates ==========
/**
 * Load active templates for a tenant
 * Returns array of templates or empty array if tenant is null
 */
async function loadTenantTemplates(tenantId) {
  if (!tenantId) return [];

  try {
    const { data: templates, error } = await supabase
      .from("alphadome.bot_templates")
      .select("*")
      .eq("bot_tenant_id", tenantId)
      .eq("is_active", true)
      .order("is_default", { ascending: false });

    if (error) {
      log(`Error loading templates for tenant ${tenantId}: ${error.message}`, "ERROR");
      return [];
    }

    return templates || [];
  } catch (err) {
    log(`Exception loading templates: ${err.message}`, "ERROR");
    return [];
  }
}

// ========== MULTI-TENANT SUPPORT: Load Tenant Training Data ==========
/**
 * Load training data (FAQ, canned replies) for a tenant
 * Returns array of training entries or empty array if tenant is null
 */
async function loadTenantTrainingData(tenantId) {
  if (!tenantId) return [];

  try {
    const { data: training, error } = await supabase
      .from("alphadome.bot_training_data")
      .select("*")
      .eq("bot_tenant_id", tenantId)
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("confidence_score", { ascending: false });

    if (error) {
      log(`Error loading training data for tenant ${tenantId}: ${error.message}`, "ERROR");
      return [];
    }

    return training || [];
  } catch (err) {
    log(`Exception loading training data: ${err.message}`, "ERROR");
    return [];
  }
}

// ========== MULTI-TENANT SUPPORT: Get Default System Prompt ==========
/**
 * Returns the system prompt for a tenant, or the default Alphadome prompt
 * Used as the base for generateReply()
 */
function getSystemPrompt(tenant = null, templates = []) {
  // If tenant has a default template, use its system prompt
  if (templates.length > 0) {
    const defaultTemplate = templates.find(t => t.is_default) || templates[0];
    if (defaultTemplate?.system_prompt) {
      return defaultTemplate.system_prompt;
    }
  }

  // Fallback: Default Alphadome prompt
  return `You are a helpful WhatsApp assistant for Alphadome. Be professional, warm, and concise. Encourage users to explore Alphadome's digital ecosystem and community.`;
}

// ========== MULTI-TENANT SUPPORT: Get Decrypted Credentials ==========
/**
 * Returns decrypted credentials for a tenant
 * In production, implement proper encryption/decryption
 * For now, returns as-is (plaintext in DB - UPGRADE IN PROD)
 */
function getDecryptedCredentials(tenant) {
  if (!tenant) {
    return {
      whatsappToken: process.env.WHATSAPP_TOKEN,
      aiApiKey: process.env.OPENAI_API_KEY,
      aiProvider: "openai",
      aiModel: "gpt-4o-mini",
    };
  }

  return {
    whatsappToken: tenant.whatsapp_access_token || process.env.WHATSAPP_TOKEN,
    aiApiKey: tenant.ai_api_key || process.env.OPENAI_API_KEY,
    aiProvider: tenant.ai_provider || "openai",
    aiModel: tenant.ai_model || "gpt-4o-mini",
  };
}

// ============================================================================
// UPDATED FUNCTION: generateReply()
// ============================================================================
/**
 * Generate AI reply with tenant-aware configuration
 * 
 * @param {string} userMessage - The user's message
 * @param {object} tenant - Tenant object (or null for default)
 * @param {array} templates - Array of templates for tenant (or null)
 * @param {array} trainingData - Array of training entries (FAQ, etc.)
 * @returns {string} - AI-generated response
 */
async function generateReply(userMessage, tenant = null, templates = null, trainingData = []) {
  // Get system prompt (tenant-specific or default)
  const systemPromptContent = getSystemPrompt(tenant, templates || []);
  
  const systemMessage = {
    role: "system",
    content: systemPromptContent,
  };

  // Try to match user message with training data (FAQ/canned replies)
  if (trainingData.length > 0) {
    for (const entry of trainingData) {
      if (entry.data_type === "faq" && entry.question && entry.answer) {
        // Simple keyword matching (can be improved with embeddings)
        if (
          userMessage.toLowerCase().includes(entry.question.toLowerCase()) ||
          entry.question.toLowerCase().includes(userMessage.toLowerCase())
        ) {
          log(
            `✓ Matched training data: ${entry.category || "General"}`,
            "AI"
          );
          return entry.answer;
        }
      }
    }
  }

  // Get credentials (tenant-specific or default)
  const creds = getDecryptedCredentials(tenant);

  // 1️⃣ Try OpenAI first
  try {
    const openaiClient = new OpenAI({
      apiKey: creds.aiApiKey,
    });

    const completion = await openaiClient.chat.completions.create({
      model: creds.aiModel,
      messages: [systemMessage, { role: "user", content: userMessage }],
    });

    const reply = completion.choices[0].message.content;
    log(`✓ ${creds.aiProvider} reply: ${reply.substring(0, 50)}...`, "AI");
    return reply;
  } catch (openAIErr) {
    incrementErrorCount();
    log(`${creds.aiProvider} error: ${openAIErr.message}`, "ERROR");
  }

  // 2️⃣ Fallback to OpenRouter Meta Llama 3.3 free
  try {
    const routerResponse = await axios.post(
      "https://api.openrouter.ai/v1/chat/completions",
      {
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [systemMessage, { role: "user", content: userMessage }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (routerResponse.data?.choices?.length > 0) {
      const routerReply = routerResponse.data.choices[0].message.content;
      log(`✓ OpenRouter reply: ${routerReply.substring(0, 50)}...`, "AI");
      return routerReply;
    }
  } catch (routerErr) {
    log(`OpenRouter error: ${routerErr.message}`, "ERROR");
  }

  // 3️⃣ Fallback to Hugging Face
  try {
    const hfResponse = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "meta-llama/Llama-3.1-8B-Instruct:novita",
        messages: [systemMessage, { role: "user", content: userMessage }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (hfResponse.data?.choices?.length > 0) {
      const hfReply = hfResponse.data.choices[0].message.content;
      log(`✓ HuggingFace reply: ${hfReply.substring(0, 50)}...`, "AI");
      return hfReply;
    }
  } catch (hfErr) {
    log(`HuggingFace error: ${hfErr.message}`, "ERROR");
  }

  // 4️⃣ Static fallback message
  return fallbackMessage();
}

// ============================================================================
// UPDATED WEBHOOK HANDLER (POST /webhook)
// ============================================================================
// 
// KEY CHANGES:
// 1. Extract brand_id from tenant (or use DEFAULT_BRAND_ID)
// 2. Load tenant's templates and training data
// 3. Pass tenant config to generateReply()
// 4. Log with tenant's brand_id (for isolation)
//
// TO IMPLEMENT:
// Replace the existing POST /webhook handler with this version
// Keep all the JOIN ALPHADOME / STK / M-Pesa logic unchanged
// Only update the message handling and AI response parts
//
// ============================================================================

/*
REPLACEMENT CODE for POST /webhook handler:

app.post("/webhook", loadTenantContext, async (req, res) => {
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

    // STEP 2: Identify brand (tenant-aware)
    // ⭐ NEW: Use tenant's brand_id if available
    let brandId = DEFAULT_BRAND_ID;
    
    if (req.isTenantAware && req.tenant?.brand_id) {
      brandId = req.tenant.brand_id;
      log(`Using tenant brand: ${req.tenant.client_name}`, "SYSTEM");
    } else {
      // Fallback to default brand
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
    }

    // STEP 2B: Check for JOIN ALPHADOME / STK flows
    // (KEEP EXISTING CODE - all the subscription/payment logic)
    // ... [existing JOIN ALPHADOME code remains unchanged] ...

    // STEP 3: Load tenant-specific configuration
    // ⭐ NEW: Load templates and training data
    let templates = [];
    let trainingData = [];
    
    if (req.isTenantAware && req.tenant?.id) {
      templates = await loadTenantTemplates(req.tenant.id);
      trainingData = await loadTenantTrainingData(req.tenant.id);
      log(
        `Loaded ${templates.length} templates and ${trainingData.length} training entries`,
        "SYSTEM"
      );
    }

    // STEP 4: Log inbound message
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

    // STEP 5: Generate AI reply (tenant-aware)
    // ⭐ UPDATED: Pass tenant config to generateReply()
    const reply = await generateReply(
      text,
      req.tenant || null,      // tenant config (or null)
      templates.length > 0 ? templates : null,  // templates (or null)
      trainingData            // training data (FAQ, etc.)
    );
    
    await sendMessage(from, reply);

    // STEP 6: Log outbound message
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
*/

// ============================================================================
// END OF TENANT-AWARE CODE ADDITIONS
// ============================================================================
