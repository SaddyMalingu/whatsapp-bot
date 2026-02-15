// DB Context Functions for LLM

async function fetchUserProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, phone, full_name, subscribed, subscription_type, subscription_level")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    log(`User profile error: ${error.message}`, "WARN");
    return null;
  }
  return data || null;
}

async function fetchBrandProfile(brandId) {
  if (!brandId) return null;
  const { data, error} = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .maybeSingle();
  if (error) {
    log(`Brand profile error: ${error.message}`, "WARN");
    return null;
  }
  return data || null;
}

function buildDbContext({ userProfile, brandProfile, tenant, catalogMatches = [] }) {
  const blocks = [];

  if (tenant) {
    const tenantBlock = {
      client_name: tenant.client_name,
      client_phone: tenant.client_phone,
      client_email: tenant.client_email,
      brand_id: tenant.brand_id,
      point_of_contact_name: tenant.point_of_contact_name,
      point_of_contact_phone: tenant.point_of_contact_phone,
    };
    blocks.push(`Tenant profile:\n${JSON.stringify(tenantBlock, null, 2)}`);
  }

  if (brandProfile) {
    const brandBlock = {
      id: brandProfile.id,
      name: brandProfile.name || brandProfile.brand_name || null,
      description: brandProfile.description || brandProfile.bio || null,
      website: brandProfile.website || null,
      email: brandProfile.email || null,
      phone: brandProfile.phone || null,
      location: brandProfile.location || null,
      industry: brandProfile.industry || null,
      category: brandProfile.category || null,
      tagline: brandProfile.tagline || null,
    };
    blocks.push(`Brand profile:\n${JSON.stringify(brandBlock, null, 2)}`);
  }

  if (userProfile) {
    const userBlock = {
      id: userProfile.id,
      phone: userProfile.phone,
      full_name: userProfile.full_name,
      subscribed: userProfile.subscribed,
      subscription_type: userProfile.subscription_type,
      subscription_level: userProfile.subscription_level,
    };
    blocks.push(`User profile:\n${JSON.stringify(userBlock, null, 2)}`);
  }

  if (Array.isArray(userPurchases) && userPurchases.length) {
    blocks.push(`Recent purchases:\n${JSON.stringify(userPurchases, null, 2)}`);
  }

  if (Array.isArray(userMessages) && userMessages.length) {
    blocks.push(`Recent messages:\n${JSON.stringify(userMessages, null, 2)}`);
  }

  if (catalogMatches.length) {
    const catalogBlock = catalogMatches.slice(0, 5).map((item) => ({
      sku: item.sku || item.id,
      name: item.name,
      price: item.price,
      currency: item.currency || "KES",
      stock_count: item.stock_count,
      category: item.category || item.metadata?.category || null,
      tags: item.tags || item.metadata?.tags || null,
    }));
    blocks.push(`Catalog matches:\n${JSON.stringify(catalogBlock, null, 2)}`);
  }

  return blocks.join("\n\n").trim();
}

export { fetchUserProfile, fetchBrandProfile, buildDbContext };
