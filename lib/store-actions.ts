"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  canCreateStore,
  canPublishStore,
  canUseCustomDomain,
  canUseCustomBranding,
  canUseSeo,
  canUseTemplate,
  getUpgradeMessage,
  getUserSubscriptionAccess
} from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";
import { defaultStoreThemeSettings, normalizeStoreThemeSettings } from "@/lib/store-theme";
import { defaultStoreTemplateId } from "@/lib/store-templates";
import type { StoreThemeSettings } from "@/types/storefront";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStoreSlug, resolveUniqueStoreSlug } from "@/lib/stores/slug";
import { isValidHostname } from "@/lib/domains/utils";

type DraftCategory = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
};

type DraftProduct = {
  id: string;
  categoryId: string;
  name: string;
  price: string;
  description: string;
  imageUrl?: string;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type StorePublicationRow = {
  custom_domain?: string | null;
  domain_status?: "pending" | "verifying" | "connected" | "failed" | null;
  domain_verified_at?: string | null;
  id: string;
  slug?: string | null;
  subdomain?: string | null;
  status?: string | null;
  visibility?: string | null;
  published_at?: string | null;
};

function parseJsonField<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (!value || typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanUrl(value: FormDataEntryValue | null) {
  const text = cleanText(value, 500);
  if (!text) {
    return "";
  }

  return text.startsWith("https://") || text.startsWith("http://") ? text : "";
}

function cleanHostname(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.-]/g, "")
    .slice(0, 253);
}

function cleanSubdomain(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 63);
}

function parseVisibility(value: FormDataEntryValue | null) {
  return value === "private" ? "private" : "public";
}

function publicationHostname(customDomain: string, subdomain: string) {
  if (customDomain) {
    return customDomain;
  }

  if (subdomain) {
    return `${subdomain}.shastore.ai`;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asSupabaseError(error: unknown): SupabaseLikeError | null {
  if (!error) {
    return null;
  }

  if (isRecord(error)) {
    return {
      code: typeof error.code === "string" ? error.code : undefined,
      message: typeof error.message === "string" ? error.message : undefined,
      details:
        typeof error.details === "string" || error.details === null
          ? error.details
          : undefined,
      hint: typeof error.hint === "string" || error.hint === null ? error.hint : undefined
    };
  }

  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as unknown;
      if (isRecord(parsed)) {
        return asSupabaseError(parsed);
      }
    } catch {
      return { message: error.message };
    }
    return { message: error.message };
  }

  return { message: String(error) };
}

function formatStoreActionError(error: unknown): string {
  const record = asSupabaseError(error);
  const code = record?.code ?? "";
  const message = record?.message ?? "";

  if (code === "PGRST204" || message.includes("schema cache")) {
    return "Your database is missing required columns. Run the latest supabase/schema.sql migration in the Supabase SQL editor, then try again.";
  }

  if (code === "PGRST205" || message.includes("Could not find the table")) {
    return "A required database table is missing. Apply the latest supabase/schema.sql migration, then try again.";
  }

  if (code === "23503") {
    return "Store data could not be linked in the database. Confirm store template seeds exist, then try again.";
  }

  if (message) {
    return message;
  }

  return "Something went wrong while saving your store. Please try again.";
}

function isMissingColumn(error: SupabaseLikeError | null, column: string) {
  return (
    error?.code === "PGRST204" &&
    (error.message ?? "").toLowerCase().includes(column.toLowerCase())
  );
}

function isMissingTable(error: SupabaseLikeError | null, table: string) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" &&
    (message.includes(`'${table}'`) || message.includes(`"${table}"`) || message.includes(table))
  );
}

function redirectWithStoreError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectWithDatabaseError(detail?: string): never {
  const params = new URLSearchParams({ error: "REAL_DATABASE_ERROR" });

  if (detail) {
    params.set("detail", detail.slice(0, 500));
  }

  redirect(`/dashboard/stores/new?${params.toString()}`);
}

function isStorePlanGatingEnabled() {
  return process.env.STORE_PLAN_GATING_ENABLED !== "false";
}

function storeOwnerOrFilter(userId: string) {
  return `user_id.eq.${userId},owner_user_id.eq.${userId}`;
}

function isMissingOwnerUserColumn(error: SupabaseLikeError | null) {
  return isMissingColumn(error, "owner_user_id");
}

function isMissingSlugColumn(error: SupabaseLikeError | null) {
  return isMissingColumn(error, "slug");
}

async function persistStoreSlug(
  supabase: SupabaseClient,
  storeId: string,
  storeName: string,
  existingSlug?: string | null
) {
  const slug = await resolveUniqueStoreSlug(supabase, storeName, storeId, existingSlug);
  const { error } = await supabase
    .from("stores")
    .update({ slug, updated_at: new Date().toISOString() })
    .eq("id", storeId);

  if (error && !isMissingSlugColumn(asSupabaseError(error))) {
    console.warn("[store-actions] stores.slug persist warning:", error.message);
  }

  return slug;
}

async function getOwnedStoreForCatalogAction(
  supabase: SupabaseClient,
  userId: string,
  storeId: string
) {
  let result = await supabase
    .from("stores")
    .select("id, name, slug, user_id, owner_user_id")
    .eq("id", storeId)
    .or(storeOwnerOrFilter(userId))
    .maybeSingle();

  if (result.error && isMissingOwnerUserColumn(asSupabaseError(result.error))) {
    result = await supabase
      .from("stores")
      .select("id, name, slug, user_id")
      .eq("id", storeId)
      .eq("user_id", userId)
      .maybeSingle();
  }

  return result;
}

async function revalidateStoreCatalogPaths(
  supabase: SupabaseClient,
  storeId: string,
  storeSlug?: string | null,
  productId?: string | null
) {
  const { data: publication } = await supabase
    .from("published_stores")
    .select("slug")
    .eq("store_id", storeId)
    .maybeSingle();
  const slug =
    typeof publication?.slug === "string" && publication.slug.trim()
      ? publication.slug
      : storeSlug;

  revalidatePath(`/dashboard/stores/${storeId}`);
  revalidatePath("/dashboard/stores");

  if (slug) {
    revalidatePath(`/store/${slug}`);

    if (productId) {
      revalidatePath(`/store/${slug}/product/${productId}`);
    }
  }
}

async function confirmPersistedStore(
  supabase: SupabaseClient,
  userId: string,
  storeId: string
) {
  let result = await supabase
    .from("stores")
    .select("id, name, status, user_id, owner_user_id, created_at")
    .eq("id", storeId)
    .or(storeOwnerOrFilter(userId))
    .maybeSingle();

  if (result.error && isMissingOwnerUserColumn(asSupabaseError(result.error))) {
    result = await supabase
      .from("stores")
      .select("id, name, status, user_id, created_at")
      .eq("id", storeId)
      .eq("user_id", userId)
      .maybeSingle();
  }

  return result;
}

function normalizeTemplateId(value: string) {
  const trimmed = value.trim();
  return trimmed || defaultStoreTemplateId;
}

const databaseTemplateIds = new Set([
  "minimal-luxury",
  "fashion-modern",
  "electronics-dark",
  "beauty-glow",
  "marketplace-grid",
  "premium-brand",
  "gadget-neon",
  "clean-scandinavian",
  "arabic-luxury",
  "tiktok-product-store",
  "modern-store"
]);

const templateIdAliases: Record<string, string> = {
  "luxury-dark": "minimal-luxury",
  "minimal-clean": "clean-scandinavian",
  "arabic-premium": "arabic-luxury",
  "fashion-editorial": "fashion-modern",
  "tiktok-product": "tiktok-product-store",
  "modern-gradient": "premium-brand",
  "scandinavian-light": "clean-scandinavian"
};

function resolveDatabaseTemplateId(value: string) {
  const normalized = normalizeTemplateId(value);
  const aliased = templateIdAliases[normalized] ?? normalized;

  if (databaseTemplateIds.has(aliased)) {
    return aliased;
  }

  return "minimal-luxury";
}

async function productIdsForCategory(
  supabase: SupabaseClient,
  storeId: string,
  userId: string,
  categoryId: string
) {
  const { data } = await supabase
    .from("store_products")
    .select("id")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .eq("category_id", categoryId);

  return (data ?? []).map((product) => product.id).filter(Boolean);
}

export type SaveStoreDraftState = {
  error: string | null;
  message: string | null;
  ok: boolean;
};

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: string }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function buildStoreDataPayload({
  brandColor,
  categories,
  currency,
  products,
  storeDescription,
  storeName,
  templateId,
  themeSettings,
  whatsappNumber
}: {
  brandColor: string;
  categories: DraftCategory[];
  currency: string;
  products: DraftProduct[];
  storeDescription: string;
  storeName: string;
  templateId: string;
  themeSettings: StoreThemeSettings;
  whatsappNumber: string;
}) {
  return {
    brandColor,
    categories,
    currency,
    products,
    storeDescription,
    storeName,
    templateId,
    themeSettings,
    whatsappNumber
  };
}

async function insertStoreDraftRow(
  supabase: SupabaseClient,
  userId: string,
  input: {
    brandColor: string;
    currency: string;
    logoImageUrl: string | null;
    name: string;
    projectId: string | null;
    storeData: Record<string, unknown>;
    storeDescription: string | null;
    templateId: string;
    whatsappNumber: string | null;
  }
) {
  const slug = buildStoreSlug(input.name, crypto.randomUUID().slice(0, 8));
  const base = {
    brand_color: input.brandColor,
    currency: input.currency,
    description: input.storeDescription,
    logo_image_url: input.logoImageUrl,
    name: input.name,
    project_id: input.projectId,
    status: "draft" as const,
    template_id: input.templateId,
    user_id: userId,
    whatsapp_number: input.whatsappNumber
  };

  const payloadAttempts: Array<Record<string, unknown>> = [
    {
      ...base,
      is_active: true,
      owner_user_id: userId,
      provisioning_state: "pending",
      slug,
      store_data: input.storeData,
      subscription_plan: "free"
    },
    {
      ...base,
      owner_user_id: userId,
      slug,
      store_data: input.storeData
    },
    {
      ...base,
      owner_user_id: userId,
      slug
    },
    {
      ...base,
      owner_user_id: userId
    },
    base
  ];

  let lastError: SupabaseLikeError | null = null;

  for (const payload of payloadAttempts) {
    console.log("[saveStoreDraft] insert attempt keys:", Object.keys(payload).join(", "));

    let result = await supabase
      .from("stores")
      .insert(payload as never)
      .select("id, name, status, user_id, created_at")
      .single();

    if (result.error && isMissingOwnerUserColumn(asSupabaseError(result.error))) {
      const legacyPayload = { ...payload };
      delete legacyPayload.owner_user_id;
      result = await supabase
        .from("stores")
        .insert(legacyPayload as never)
        .select("id, name, status, user_id, created_at")
        .single();
    }

    if (!result.error && result.data) {
      console.log("[saveStoreDraft] insert success:", result.data);
      return { data: result.data, error: null };
    }

    lastError = asSupabaseError(result.error);
    const message = (lastError?.message ?? "").toLowerCase();

    if (lastError?.code !== "PGRST204" && !message.includes("column")) {
      break;
    }
  }

  return { data: null, error: lastError };
}

async function persistStoreDraftFromForm(
  formData: FormData
): Promise<{ error?: string; ok: true; storeId: string } | { error: string; ok: false }> {
  console.log("[saveStoreDraft] persistStoreDraftFromForm start");

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required to save a store draft." };
  }

  const storeName = String(formData.get("storeName") ?? "").trim();
  const storeDescription = String(formData.get("storeDescription") ?? "").trim();
  const brandColor = String(formData.get("brandColor") ?? "#0f172a").trim() || "#0f172a";
  const currency = String(formData.get("currency") ?? "USD").trim() || "USD";
  const whatsappNumber = String(formData.get("whatsappNumber") ?? "").trim();
  const templateId = resolveDatabaseTemplateId(String(formData.get("templateId") ?? ""));
  const categories = parseCategories(formData);
  const products = parseProducts(formData);
  const themeSettings = parseThemeSettings(formData);
  const logoImageUrl =
    (await uploadStoreLogo(supabase, user.id, formData)) || themeSettings.logoUrl || null;

  console.log("[saveStoreDraft] parsed payload", {
    categories: categories.length,
    products: products.length,
    storeName,
    templateId,
    userId: user.id
  });

  if (!storeName) {
    return { ok: false, error: "Store name is required." };
  }

  if (isStorePlanGatingEnabled()) {
    const access = await getUserSubscriptionAccess(user.id);

    if (!canCreateStore(access)) {
      return { ok: false, error: getUpgradeMessage("stores") || "Store limit reached." };
    }

    if (!canUseTemplate(access, templateId)) {
      return { ok: false, error: getUpgradeMessage("template") };
    }

    if (!canUseCustomBranding(access) && hasCustomBranding(themeSettings, logoImageUrl)) {
      return { ok: false, error: getUpgradeMessage("branding") };
    }
  }

  const { projectId, error: projectError } = await createStoreProject(
    supabase,
    user.id,
    storeName
  );

  if (projectError) {
    console.error("[saveStoreDraft] project create failed:", projectError);
    return { ok: false, error: projectError };
  }

  const storeData = buildStoreDataPayload({
    brandColor,
    categories,
    currency,
    products,
    storeDescription,
    storeName,
    templateId,
    themeSettings,
    whatsappNumber
  });

  const insertResult = await insertStoreDraftRow(supabase, user.id, {
    brandColor,
    currency,
    logoImageUrl,
    name: storeName,
    projectId,
    storeData,
    storeDescription: storeDescription || null,
    templateId,
    whatsappNumber: whatsappNumber || null
  });

  if (insertResult.error || !insertResult.data) {
    if (projectId) {
      await supabase.from("projects").delete().eq("id", projectId);
    }
    const message = formatStoreActionError(insertResult.error);
    console.error("[saveStoreDraft] store insert failed:", message, insertResult.error);
    return { ok: false, error: message };
  }

  const insertedStoreId =
    insertResult.data && "id" in insertResult.data && typeof insertResult.data.id === "string"
      ? insertResult.data.id
      : null;

  if (!insertedStoreId) {
    console.error("[saveStoreDraft] missing inserted store id");
    return { ok: false, error: "Store insert returned no id." };
  }

  const persistedStore = await confirmPersistedStore(supabase, user.id, insertedStoreId);

  if (persistedStore.error) {
    console.error("[saveStoreDraft] confirm select failed:", persistedStore.error);
    await cleanupDraft(supabase, insertedStoreId, projectId);
    return { ok: false, error: formatStoreActionError(persistedStore.error) };
  }

  if (!persistedStore.data) {
    console.error("[saveStoreDraft] confirm select returned no row");
    await cleanupDraft(supabase, insertedStoreId, projectId);
    return { ok: false, error: "Store row was not found after insert." };
  }

  const store = persistedStore.data;

  await saveThemeSettings(
    supabase,
    store.id,
    user.id,
    templateId,
    themeSettings.primaryColor || brandColor,
    {
      ...themeSettings,
      logoUrl: logoImageUrl || themeSettings.logoUrl
    },
    logoImageUrl
  );

  const categoryIdMap = new Map<string, string>();

  for (let index = 0; index < categories.length; index += 1) {
    const category = categories[index];
    const { data: savedCategory, error } = await supabase
      .from("store_categories")
      .insert({
        store_id: store.id,
        user_id: user.id,
        name: category.name,
        description: category.description || null,
        image_url: category.imageUrl ?? null,
        sort_order: index
      })
      .select("id")
      .single();

    if (error || !savedCategory) {
      console.warn("[saveStoreDraft] category insert warning:", error);
      break;
    }

    if (category.id) {
      categoryIdMap.set(category.id, savedCategory.id);
    }
  }

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const mappedCategoryId = product.categoryId
      ? categoryIdMap.get(product.categoryId) ?? null
      : null;

    const { error } = await supabase.from("store_products").insert({
      store_id: store.id,
      category_id: mappedCategoryId,
      user_id: user.id,
      name: product.name,
      description: product.description || null,
      price: product.price || null,
      image_url: product.imageUrl ?? null,
      sort_order: index
    });

    if (error) {
      console.warn("[saveStoreDraft] product insert warning:", error);
      break;
    }
  }

  await persistStoreSlug(supabase, store.id, storeName);

  console.log("[saveStoreDraft] persistStoreDraftFromForm complete", store.id);
  return { ok: true, storeId: store.id };
}

export async function saveStoreDraftAction(
  _prev: SaveStoreDraftState | null,
  formData: FormData
): Promise<SaveStoreDraftState> {
  console.log("[saveStoreDraft] action invoked");

  try {
    const result = await persistStoreDraftFromForm(formData);

    if (!result.ok) {
      console.error("[saveStoreDraft] action failed:", result.error);
      return {
        ok: false,
        error: result.error,
        message: null
      };
    }

    revalidatePath("/dashboard/stores");
    revalidatePath("/dashboard");
    redirect("/dashboard/stores?saved=true");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error("[saveStoreDraft] unexpected action error:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected save failure.",
      message: null
    };
  }

  return {
    ok: false,
    error: "Unknown save failure.",
    message: null
  };
}

function parseCategories(formData: FormData): DraftCategory[] {
  const raw = parseJsonField<unknown[]>(formData.get("categories"), []);

  if (!Array.isArray(raw)) {
    return [];
  }

  const categories: DraftCategory[] = [];

  for (const entry of raw) {
    if (!isRecord(entry)) {
      continue;
    }

    const name = String(entry.name ?? "").trim();
    if (!name) {
      continue;
    }

    const imageUrl = String(entry.imageUrl ?? "").trim();

    categories.push({
      id: String(entry.id ?? ""),
      name,
      description: String(entry.description ?? "").trim(),
      imageUrl: imageUrl || undefined
    });
  }

  return categories;
}

function parseProducts(formData: FormData): DraftProduct[] {
  const raw = parseJsonField<unknown[]>(formData.get("products"), []);

  if (!Array.isArray(raw)) {
    return [];
  }

  const products: DraftProduct[] = [];

  for (const entry of raw) {
    if (!isRecord(entry)) {
      continue;
    }

    const name = String(entry.name ?? "").trim();
    if (!name) {
      continue;
    }

    const imageUrl = String(entry.imageUrl ?? "").trim();

    products.push({
      id: String(entry.id ?? ""),
      categoryId: String(entry.categoryId ?? "").trim(),
      name,
      price: String(entry.price ?? "").trim(),
      description: String(entry.description ?? "").trim(),
      imageUrl: imageUrl || undefined
    });
  }

  return products;
}

function parseThemeSettings(formData: FormData): StoreThemeSettings {
  const fromJson = normalizeStoreThemeSettings(
    parseJsonField<unknown>(formData.get("themeSettings"), defaultStoreThemeSettings)
  );

  return normalizeStoreThemeSettings({
    ...fromJson,
    primaryColor: formData.get("themePrimaryColor") ?? fromJson.primaryColor,
    secondaryColor: formData.get("themeSecondaryColor") ?? fromJson.secondaryColor,
    accentColor: formData.get("themeAccentColor") ?? fromJson.accentColor,
    gradientFrom: formData.get("themeGradientFrom") ?? fromJson.gradientFrom,
    gradientTo: formData.get("themeGradientTo") ?? fromJson.gradientTo,
    buttonStyle: formData.get("themeButtonStyle") ?? fromJson.buttonStyle,
    headingFont: formData.get("themeHeadingFont") ?? fromJson.headingFont,
    bodyFont: formData.get("themeBodyFont") ?? fromJson.bodyFont,
    fontScale: formData.get("themeFontScale") ?? fromJson.fontScale,
    logoUrl: formData.get("themeLogoUrl") ?? fromJson.logoUrl,
    navigationStyle: formData.get("themeNavigationStyle") ?? fromJson.navigationStyle,
    stickyHeader:
      formData.get("themeStickyHeader") === null
        ? fromJson.stickyHeader
        : formData.get("themeStickyHeader") === "true",
    announcementText: formData.get("themeAnnouncementText") ?? fromJson.announcementText,
    bannerImageUrl: formData.get("themeBannerImageUrl") ?? fromJson.bannerImageUrl,
    heroTitle: formData.get("themeHeroTitle") ?? fromJson.heroTitle,
    heroSubtitle: formData.get("themeHeroSubtitle") ?? fromJson.heroSubtitle,
    heroBackground: formData.get("themeHeroBackground") ?? fromJson.heroBackground,
    ctaText: formData.get("themeCtaText") ?? fromJson.ctaText,
    ctaStyle: formData.get("themeCtaStyle") ?? fromJson.ctaStyle,
    footerStyle: formData.get("themeFooterStyle") ?? fromJson.footerStyle,
    footerBackgroundColor:
      formData.get("themeFooterBackgroundColor") ?? fromJson.footerBackgroundColor,
    footerTextColor: formData.get("themeFooterTextColor") ?? fromJson.footerTextColor,
    copyrightText: formData.get("themeCopyrightText") ?? fromJson.copyrightText,
    instagramUrl: formData.get("themeInstagramUrl") ?? fromJson.instagramUrl,
    tiktokUrl: formData.get("themeTiktokUrl") ?? fromJson.tiktokUrl,
    facebookUrl: formData.get("themeFacebookUrl") ?? fromJson.facebookUrl
  });
}

async function uploadStoreLogo(
  supabase: SupabaseClient,
  userId: string,
  formData: FormData
) {
  const logo = formData.get("logoImage");

  if (!(logo instanceof File) || logo.size === 0) {
    return null;
  }

  const extension = logo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${userId}/store-logos/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("product-images").upload(path, logo, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) {
    return null;
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from("product-images").getPublicUrl(path);

  return publicUrl;
}

async function createStoreProject(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<{ projectId: string | null; error: string | null }> {
  const base = { user_id: userId, name };

  let result = await supabase
    .from("projects")
    .insert({ ...base, project_type: "store" })
    .select("id")
    .single();

  if (isMissingColumn(asSupabaseError(result.error), "project_type")) {
    result = await supabase.from("projects").insert(base).select("id").single();
  }

  if (result.error) {
    if (isMissingTable(asSupabaseError(result.error), "projects")) {
      return { projectId: null, error: null };
    }

    return { projectId: null, error: formatStoreActionError(result.error) };
  }

  return { projectId: result.data?.id ?? null, error: null };
}

async function cleanupDraft(
  supabase: SupabaseClient,
  storeId: string | null,
  projectId: string | null
) {
  if (storeId) {
    await supabase.from("stores").delete().eq("id", storeId);
  }

  if (projectId) {
    await supabase.from("projects").delete().eq("id", projectId);
  }
}

async function saveThemeSettings(
  supabase: SupabaseClient,
  storeId: string,
  userId: string,
  templateId: string,
  brandColor: string,
  settings: StoreThemeSettings,
  logoImageUrl: string | null
) {
  const { error } = await supabase.from("store_theme_settings").insert({
    store_id: storeId,
    user_id: userId,
    template_id: templateId,
    brand_color: brandColor,
    logo_image_url: logoImageUrl,
    settings
  });

  if (!error) {
    return;
  }

  const formatted = asSupabaseError(error);
  if (
    isMissingTable(formatted, "store_theme_settings") ||
    isMissingColumn(formatted, "store_theme_settings")
  ) {
    return;
  }

  // Theme settings are optional when the table exists but template FK or seeds are missing.
  if (formatted?.code === "23503") {
    return;
  }
}

function validateDraftPayload(storeName: string, redirectPath: string) {
  if (!storeName) {
    redirectWithStoreError(redirectPath, "Store name is required.");
  }
}

function hasCustomBranding(settings: StoreThemeSettings, logoImageUrl: string | null) {
  return Boolean(
    logoImageUrl ||
      settings.logoUrl ||
      settings.secondaryColor !== defaultStoreThemeSettings.secondaryColor ||
      settings.accentColor !== defaultStoreThemeSettings.accentColor ||
      settings.gradientFrom !== defaultStoreThemeSettings.gradientFrom ||
      settings.gradientTo !== defaultStoreThemeSettings.gradientTo ||
      settings.buttonStyle !== defaultStoreThemeSettings.buttonStyle ||
      settings.headingFont !== defaultStoreThemeSettings.headingFont ||
      settings.bodyFont !== defaultStoreThemeSettings.bodyFont ||
      settings.announcementText ||
      settings.bannerImageUrl ||
      settings.heroTitle ||
      settings.heroSubtitle ||
      settings.ctaText !== defaultStoreThemeSettings.ctaText ||
      settings.footerBackgroundColor !== defaultStoreThemeSettings.footerBackgroundColor ||
      settings.footerTextColor !== defaultStoreThemeSettings.footerTextColor ||
      settings.copyrightText ||
      settings.instagramUrl ||
      settings.tiktokUrl ||
      settings.facebookUrl
  );
}

export async function saveStoreDraft(formData: FormData) {
  const result = await saveStoreDraftAction(null, formData);
  if (result.error) {
    redirect(
      `/dashboard/stores/new?error=REAL_DATABASE_ERROR&detail=${encodeURIComponent(result.error)}`
    );
  }
}

export async function deleteStoreDraft(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = String(formData.get("storeId") ?? "");
  const { error } = await supabase
    .from("stores")
    .delete()
    .eq("id", storeId)
    .or(storeOwnerOrFilter(user.id));

  if (error) {
    redirectWithStoreError("/dashboard/stores", formatStoreActionError(error));
  }

  revalidatePath("/dashboard/stores");
  redirect("/dashboard/stores?deleted=true");
}

export async function createManagedStoreCategory(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = cleanText(formData.get("storeId"), 80);
  const name = cleanText(formData.get("categoryName"), 120);
  const description = cleanText(formData.get("categoryDescription"), 500);
  const imageUrl = cleanUrl(formData.get("categoryImageUrl"));
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId || !name) {
    redirectWithStoreError(detailPath, "Category name is required.");
  }

  const { data: store, error: storeError } = await getOwnedStoreForCatalogAction(
    supabase,
    user.id,
    storeId
  );

  if (storeError || !store) {
    redirectWithStoreError(detailPath, "You can only edit products for your own stores.");
  }

  const { count } = await supabase
    .from("store_categories")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("user_id", user.id);

  const { error } = await supabase.from("store_categories").insert({
    store_id: storeId,
    user_id: user.id,
    name,
    description: description || null,
    image_url: imageUrl || null,
    sort_order: count ?? 0
  });

  if (error) {
    redirectWithStoreError(detailPath, formatStoreActionError(error));
  }

  await revalidateStoreCatalogPaths(supabase, storeId, store.slug);
  redirect(`${detailPath}?catalog=category-created`);
}

export async function updateManagedStoreCategory(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = cleanText(formData.get("storeId"), 80);
  const categoryId = cleanText(formData.get("categoryId"), 80);
  const name = cleanText(formData.get("categoryName"), 120);
  const description = cleanText(formData.get("categoryDescription"), 500);
  const imageUrl = cleanUrl(formData.get("categoryImageUrl"));
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId || !categoryId || !name) {
    redirectWithStoreError(detailPath, "Category name is required.");
  }

  const { data: store, error: storeError } = await getOwnedStoreForCatalogAction(
    supabase,
    user.id,
    storeId
  );

  if (storeError || !store) {
    redirectWithStoreError(detailPath, "You can only edit categories for your own stores.");
  }

  const productIds = await productIdsForCategory(supabase, storeId, user.id, categoryId);
  const { error } = await supabase
    .from("store_categories")
    .update({
      name,
      description: description || null,
      image_url: imageUrl || null
    })
    .eq("id", categoryId)
    .eq("store_id", storeId)
    .eq("user_id", user.id);

  if (error) {
    redirectWithStoreError(detailPath, formatStoreActionError(error));
  }

  await revalidateStoreCatalogPaths(supabase, storeId, store.slug);
  for (const productId of productIds) {
    await revalidateStoreCatalogPaths(supabase, storeId, store.slug, productId);
  }

  redirect(`${detailPath}?catalog=category-updated`);
}

export async function deleteManagedStoreCategory(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = cleanText(formData.get("storeId"), 80);
  const categoryId = cleanText(formData.get("categoryId"), 80);
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId || !categoryId) {
    redirectWithStoreError(detailPath, "Choose a category before deleting.");
  }

  const { data: store, error: storeError } = await getOwnedStoreForCatalogAction(
    supabase,
    user.id,
    storeId
  );

  if (storeError || !store) {
    redirectWithStoreError(detailPath, "You can only edit categories for your own stores.");
  }

  const productIds = await productIdsForCategory(supabase, storeId, user.id, categoryId);
  const { error: clearProductsError } = await supabase
    .from("store_products")
    .update({
      category_id: null,
      updated_at: new Date().toISOString()
    })
    .eq("store_id", storeId)
    .eq("user_id", user.id)
    .eq("category_id", categoryId);

  if (clearProductsError) {
    redirectWithStoreError(detailPath, formatStoreActionError(clearProductsError));
  }

  const { error } = await supabase
    .from("store_categories")
    .delete()
    .eq("id", categoryId)
    .eq("store_id", storeId)
    .eq("user_id", user.id);

  if (error) {
    redirectWithStoreError(detailPath, formatStoreActionError(error));
  }

  await revalidateStoreCatalogPaths(supabase, storeId, store.slug);
  for (const productId of productIds) {
    await revalidateStoreCatalogPaths(supabase, storeId, store.slug, productId);
  }

  redirect(`${detailPath}?catalog=category-deleted`);
}

export async function createManagedStoreProduct(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = cleanText(formData.get("storeId"), 80);
  const name = cleanText(formData.get("productName"), 180);
  const price = cleanText(formData.get("productPrice"), 80);
  const description = cleanText(formData.get("productDescription"), 1000);
  const imageUrl = cleanUrl(formData.get("productImageUrl"));
  const categoryId = cleanText(formData.get("categoryId"), 80);
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId || !name) {
    redirectWithStoreError(detailPath, "Product name is required.");
  }

  const { data: store, error: storeError } = await getOwnedStoreForCatalogAction(
    supabase,
    user.id,
    storeId
  );

  if (storeError || !store) {
    redirectWithStoreError(detailPath, "You can only edit products for your own stores.");
  }

  const categoryBelongsToStore = categoryId
    ? await supabase
        .from("store_categories")
        .select("id")
        .eq("id", categoryId)
        .eq("store_id", storeId)
        .eq("user_id", user.id)
        .maybeSingle()
    : null;

  if (categoryId && !categoryBelongsToStore?.data) {
    redirectWithStoreError(detailPath, "Selected category was not found for this store.");
  }

  const { count } = await supabase
    .from("store_products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("user_id", user.id);

  const { data: product, error } = await supabase
    .from("store_products")
    .insert({
      store_id: storeId,
      user_id: user.id,
      category_id: categoryId || null,
      name,
      description: description || null,
      price: price || null,
      image_url: imageUrl || null,
      sort_order: count ?? 0
    })
    .select("id")
    .single();

  if (error || !product) {
    redirectWithStoreError(detailPath, formatStoreActionError(error));
  }

  await revalidateStoreCatalogPaths(supabase, storeId, store.slug, product.id);
  redirect(`${detailPath}?catalog=product-created`);
}

export async function updateManagedStoreProduct(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = cleanText(formData.get("storeId"), 80);
  const productId = cleanText(formData.get("productId"), 80);
  const name = cleanText(formData.get("productName"), 180);
  const price = cleanText(formData.get("productPrice"), 80);
  const description = cleanText(formData.get("productDescription"), 1000);
  const imageUrl = cleanUrl(formData.get("productImageUrl"));
  const categoryId = cleanText(formData.get("categoryId"), 80);
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId || !productId || !name) {
    redirectWithStoreError(detailPath, "Product name is required.");
  }

  const { data: store, error: storeError } = await getOwnedStoreForCatalogAction(
    supabase,
    user.id,
    storeId
  );

  if (storeError || !store) {
    redirectWithStoreError(detailPath, "You can only edit products for your own stores.");
  }

  const categoryBelongsToStore = categoryId
    ? await supabase
        .from("store_categories")
        .select("id")
        .eq("id", categoryId)
        .eq("store_id", storeId)
        .eq("user_id", user.id)
        .maybeSingle()
    : null;

  if (categoryId && !categoryBelongsToStore?.data) {
    redirectWithStoreError(detailPath, "Selected category was not found for this store.");
  }

  const { error } = await supabase
    .from("store_products")
    .update({
      category_id: categoryId || null,
      name,
      description: description || null,
      price: price || null,
      image_url: imageUrl || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", productId)
    .eq("store_id", storeId)
    .eq("user_id", user.id);

  if (error) {
    redirectWithStoreError(detailPath, formatStoreActionError(error));
  }

  await revalidateStoreCatalogPaths(supabase, storeId, store.slug, productId);
  redirect(`${detailPath}?catalog=product-updated`);
}

export async function deleteManagedStoreProduct(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = cleanText(formData.get("storeId"), 80);
  const productId = cleanText(formData.get("productId"), 80);
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId || !productId) {
    redirectWithStoreError(detailPath, "Choose a product before deleting.");
  }

  const { data: store, error: storeError } = await getOwnedStoreForCatalogAction(
    supabase,
    user.id,
    storeId
  );

  if (storeError || !store) {
    redirectWithStoreError(detailPath, "You can only edit products for your own stores.");
  }

  const { error } = await supabase
    .from("store_products")
    .delete()
    .eq("id", productId)
    .eq("store_id", storeId)
    .eq("user_id", user.id);

  if (error) {
    redirectWithStoreError(detailPath, formatStoreActionError(error));
  }

  await revalidateStoreCatalogPaths(supabase, storeId, store.slug, productId);
  redirect(`${detailPath}?catalog=product-deleted`);
}

export async function saveStoreThemeSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = String(formData.get("storeId") ?? "").trim();
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId) {
    redirectWithStoreError("/dashboard/stores", "Store not found.");
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, template_id")
    .eq("id", storeId)
    .or(storeOwnerOrFilter(user.id))
    .single();

  if (storeError || !store) {
    redirectWithStoreError(detailPath, formatStoreActionError(storeError));
  }

  const themeSettings = parseThemeSettings(formData);
  const logoImageUrl =
    (await uploadStoreLogo(supabase, user.id, formData)) || themeSettings.logoUrl || null;
  const settings = {
    ...themeSettings,
    logoUrl: logoImageUrl || themeSettings.logoUrl
  };
  if (isStorePlanGatingEnabled()) {
    const access = await getUserSubscriptionAccess(user.id);

    if (!canUseCustomBranding(access) && hasCustomBranding(settings, logoImageUrl)) {
      redirectWithStoreError(detailPath, getUpgradeMessage("branding"));
    }
  }

  const { error } = await supabase.from("store_theme_settings").upsert(
    {
      store_id: store.id,
      user_id: user.id,
      template_id: store.template_id || defaultStoreTemplateId,
      brand_color: settings.primaryColor,
      logo_image_url: logoImageUrl,
      settings,
      updated_at: new Date().toISOString()
    },
    { onConflict: "store_id" }
  );

  if (error) {
    redirectWithStoreError(detailPath, formatStoreActionError(error));
  }

  await supabase
    .from("stores")
    .update({
      brand_color: settings.primaryColor,
      logo_image_url: logoImageUrl
    })
    .eq("id", store.id)
    .or(storeOwnerOrFilter(user.id));

  const { data: publication } = await supabase
    .from("published_stores")
    .select("slug")
    .eq("store_id", store.id)
    .eq("user_id", user.id)
    .eq("status", "published")
    .maybeSingle();

  revalidatePath(`/dashboard/stores/${store.id}`);
  if (publication?.slug) {
    revalidatePath(`/store/${publication.slug}`);
  }

  redirect(`/dashboard/stores/${store.id}?theme=saved`);
}

export async function resetStoreThemeSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = String(formData.get("storeId") ?? "").trim();
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId) {
    redirectWithStoreError("/dashboard/stores", "Store not found.");
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, slug, template_id")
    .eq("id", storeId)
    .or(storeOwnerOrFilter(user.id))
    .single();

  if (storeError || !store) {
    redirectWithStoreError(detailPath, formatStoreActionError(storeError));
  }

  const { error } = await supabase.from("store_theme_settings").upsert(
    {
      store_id: store.id,
      user_id: user.id,
      template_id: store.template_id || defaultStoreTemplateId,
      brand_color: defaultStoreThemeSettings.primaryColor,
      logo_image_url: null,
      settings: defaultStoreThemeSettings,
      updated_at: new Date().toISOString()
    },
    { onConflict: "store_id" }
  );

  if (error) {
    redirectWithStoreError(detailPath, formatStoreActionError(error));
  }

  await supabase
    .from("stores")
    .update({
      brand_color: defaultStoreThemeSettings.primaryColor,
      logo_image_url: null
    })
    .eq("id", store.id)
    .or(storeOwnerOrFilter(user.id));

  await revalidateStoreCatalogPaths(supabase, store.id, store.slug);
  redirect(`${detailPath}?theme=reset`);
}

export async function saveStorePublicationSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = String(formData.get("storeId") ?? "").trim();
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId) {
    redirectWithStoreError("/dashboard/stores", "Store not found.");
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, name, slug")
    .eq("id", storeId)
    .or(storeOwnerOrFilter(user.id))
    .single();

  if (storeError || !store) {
    redirectWithStoreError(detailPath, formatStoreActionError(storeError));
  }

  const slug = await persistStoreSlug(
    supabase,
    store.id,
    String(store.name ?? "").trim() || "store",
    store.slug
  );
  const customDomain = cleanHostname(formData.get("customDomain"));
  const subdomain = cleanSubdomain(formData.get("subdomain"));
  const hostname = publicationHostname(customDomain, subdomain);
  const visibility = parseVisibility(formData.get("visibility"));
  const now = new Date().toISOString();
  if (isStorePlanGatingEnabled()) {
    const access = await getUserSubscriptionAccess(user.id);

    if (!canUseSeo(access)) {
      const hasSeoFields = Boolean(
        cleanText(formData.get("seoTitle")) ||
          cleanText(formData.get("seoDescription"), 320) ||
          cleanText(formData.get("ogTitle")) ||
          cleanText(formData.get("ogDescription"), 320) ||
          cleanUrl(formData.get("faviconUrl")) ||
          cleanUrl(formData.get("socialImageUrl"))
      );

      if (hasSeoFields) {
        redirectWithStoreError(detailPath, getUpgradeMessage("seo"));
      }
    }

    if (
      !canUseCustomDomain(access) &&
      (cleanHostname(formData.get("customDomain")) || cleanSubdomain(formData.get("subdomain")))
    ) {
      redirectWithStoreError(detailPath, getUpgradeMessage("domain"));
    }
  }

  const publicationPayload = {
    store_id: store.id,
    user_id: user.id,
    slug,
    url: `/store/${slug}`,
    visibility,
    seo_title: cleanText(formData.get("seoTitle")),
    seo_description: cleanText(formData.get("seoDescription"), 320),
    og_title: cleanText(formData.get("ogTitle")),
    og_description: cleanText(formData.get("ogDescription"), 320),
    favicon_url: cleanUrl(formData.get("faviconUrl")),
    social_image_url: cleanUrl(formData.get("socialImageUrl")),
    custom_domain: customDomain || null,
    subdomain: subdomain || null,
    hostname,
    updated_at: now
  };

  const { data: rawPublication } = await supabase
    .from("published_stores")
    .select("*")
    .eq("store_id", store.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const publication = rawPublication as StorePublicationRow | null;

  const { error } = publication
    ? await supabase
        .from("published_stores")
        .update(publicationPayload as never)
        .eq("id", publication.id)
        .eq("user_id", user.id)
    : await supabase.from("published_stores").insert({
        ...publicationPayload,
        status: "draft",
        published_at: null
      } as never);

  if (error) {
    redirectWithStoreError(detailPath, formatStoreActionError(error));
  }

  revalidatePath(`/dashboard/stores/${store.id}`);
  revalidatePath("/dashboard/stores");
  if (publication?.status === "published") {
    revalidatePath(`/store/${slug}`);
  }

  redirect(`/dashboard/stores/${store.id}?publication=saved`);
}

export async function saveStoreDomainSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = String(formData.get("storeId") ?? "").trim();
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId) {
    redirectWithStoreError("/dashboard/stores", "Store not found.");
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, name, slug")
    .eq("id", storeId)
    .or(storeOwnerOrFilter(user.id))
    .single();

  if (storeError || !store) {
    redirectWithStoreError(detailPath, formatStoreActionError(storeError));
  }

  const customDomain = cleanHostname(formData.get("customDomain"));
  const intent = cleanText(formData.get("domainIntent"), 40);

  if (customDomain && !isValidHostname(customDomain)) {
    redirectWithStoreError(detailPath, "Enter a valid custom domain, for example shop.example.com.");
  }

  if (isStorePlanGatingEnabled() && customDomain) {
    const access = await getUserSubscriptionAccess(user.id);

    if (!canUseCustomDomain(access)) {
      redirectWithStoreError(detailPath, getUpgradeMessage("domain"));
    }
  }

  const slug = await persistStoreSlug(
    supabase,
    store.id,
    String(store.name ?? "").trim() || "store",
    store.slug
  );
  const { data: rawPublication } = await supabase
    .from("published_stores")
    .select("*")
    .eq("store_id", store.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const publication = rawPublication as StorePublicationRow | null;
  const previousDomain = cleanHostname(publication?.custom_domain ?? null);
  const domainChanged = previousDomain !== customDomain;
  const domainStatus =
    customDomain && intent === "verify" && !domainChanged
      ? "verifying"
      : customDomain
        ? domainChanged
          ? "pending"
          : publication?.domain_status ?? "pending"
        : "pending";
  const publicationPayload = {
    custom_domain: customDomain || null,
    domain_status: domainStatus,
    domain_verified_at:
      customDomain && !domainChanged && publication?.domain_status === "connected"
        ? publication.domain_verified_at ?? null
        : null,
    hostname: customDomain || publication?.subdomain || null,
    slug,
    updated_at: new Date().toISOString(),
    url: `/store/${slug}`
  };

  const { error } = publication
    ? await supabase
        .from("published_stores")
        .update(publicationPayload as never)
        .eq("id", publication.id)
        .eq("user_id", user.id)
    : await supabase.from("published_stores").insert({
        ...publicationPayload,
        store_id: store.id,
        user_id: user.id,
        status: "draft",
        visibility: "public",
        published_at: null
      } as never);

  if (error) {
    redirectWithStoreError(detailPath, formatStoreActionError(error));
  }

  revalidatePath(detailPath);
  revalidatePath("/dashboard/stores");
  revalidatePath(`/store/${slug}`);
  redirect(`${detailPath}?domain=${intent === "verify" ? "verifying" : "saved"}`);
}

export async function unpublishStore(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = String(formData.get("storeId") ?? "").trim();
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId) {
    redirectWithStoreError("/dashboard/stores", "Store not found.");
  }

  const { data: rawPublication, error: publicationError } = await supabase
    .from("published_stores")
    .select("*")
    .eq("store_id", storeId)
    .eq("user_id", user.id)
    .maybeSingle();
  const publication = rawPublication as StorePublicationRow | null;

  if (publicationError) {
    redirectWithStoreError(detailPath, formatStoreActionError(publicationError));
  }

  await supabase
    .from("stores")
    .update({ status: "unpublished", updated_at: new Date().toISOString() })
    .eq("id", storeId)
    .or(storeOwnerOrFilter(user.id));

  if (publication) {
    const { error } = await supabase
      .from("published_stores")
      .update({
        status: "unpublished",
        visibility: "private",
        updated_at: new Date().toISOString()
      } as never)
      .eq("id", publication.id)
      .eq("user_id", user.id);

    if (error) {
      redirectWithStoreError(detailPath, formatStoreActionError(error));
    }

    revalidatePath(`/store/${publication.slug}`);
  }

  revalidatePath("/dashboard/stores");
  revalidatePath(detailPath);
  redirect(`${detailPath}?unpublished=true`);
}

export async function publishStoreDraft(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/stores");
  }

  const storeId = String(formData.get("storeId") ?? "").trim();
  const detailPath = storeId ? `/dashboard/stores/${storeId}` : "/dashboard/stores";

  if (!storeId) {
    redirectWithStoreError("/dashboard/stores", "Store not found.");
  }

  const { data: store, error: storeLookupError } = await supabase
    .from("stores")
    .select("id, name, slug")
    .eq("id", storeId)
    .or(storeOwnerOrFilter(user.id))
    .single();

  if (storeLookupError || !store) {
    redirectWithStoreError(detailPath, formatStoreActionError(storeLookupError));
  }

  const storeName = String(store.name ?? "").trim();
  if (!storeName) {
    redirectWithStoreError(detailPath, "Store name is required before publishing.");
  }

  const slug = await persistStoreSlug(supabase, store.id, storeName, store.slug);

  const [{ data: categories, error: categoriesError }, { data: products, error: productsError }] =
    await Promise.all([
      supabase
        .from("store_categories")
        .select("id")
        .eq("store_id", store.id)
        .eq("user_id", user.id),
      supabase
        .from("store_products")
        .select("id")
        .eq("store_id", store.id)
        .eq("user_id", user.id)
    ]);

  if (categoriesError) {
    redirectWithStoreError(detailPath, formatStoreActionError(categoriesError));
  }

  if (productsError) {
    redirectWithStoreError(detailPath, formatStoreActionError(productsError));
  }

  if (!categories?.length) {
    redirectWithStoreError(
      detailPath,
      "Add at least one category before publishing this store."
    );
  }

  if (!products?.length) {
    redirectWithStoreError(
      detailPath,
      "Add at least one product before publishing this store."
    );
  }
  if (isStorePlanGatingEnabled()) {
    const access = await getUserSubscriptionAccess(user.id);

    if (!canPublishStore(access)) {
      redirectWithStoreError(detailPath, getUpgradeMessage("publish"));
    }
  }

  const publishedAt = new Date().toISOString();
  const { data: updatedStore, error: storeError } = await supabase
    .from("stores")
    .update({
      slug,
      status: "published",
      updated_at: publishedAt
    })
    .eq("id", storeId)
    .or(storeOwnerOrFilter(user.id))
    .select("id, name, slug")
    .single();

  if (storeError || !updatedStore) {
    redirectWithStoreError(detailPath, formatStoreActionError(storeError));
  }

  const publishedSlug =
    String(updatedStore.slug ?? "").trim() ||
    (await persistStoreSlug(
      supabase,
      updatedStore.id,
      String(updatedStore.name ?? storeName),
      slug
    ));
  const { data: rawPublication, error: publicationLookupError } = await supabase
    .from("published_stores")
    .select("*")
    .eq("store_id", updatedStore.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const publication = rawPublication as StorePublicationRow | null;
  const publicationTableMissing = isMissingTable(
    asSupabaseError(publicationLookupError),
    "published_stores"
  );

  if (publicationLookupError && !publicationTableMissing) {
    redirectWithStoreError(detailPath, formatStoreActionError(publicationLookupError));
  }

  if (publication) {
    const { error } = await supabase
      .from("published_stores")
      .update({
        slug: publishedSlug,
        url: `/store/${publishedSlug}`,
        status: "published",
        visibility: publication.visibility || "public",
        published_at: publishedAt,
        updated_at: publishedAt
      } as never)
      .eq("id", publication.id)
      .eq("user_id", user.id);

    if (error) {
      redirectWithStoreError(detailPath, formatStoreActionError(error));
    }
  } else if (!publicationTableMissing) {
    const { error } = await supabase.from("published_stores").insert({
      store_id: updatedStore.id,
      user_id: user.id,
      slug: publishedSlug,
      url: `/store/${publishedSlug}`,
      status: "published",
      visibility: "public",
      published_at: publishedAt
    } as never);

    if (error) {
      redirectWithStoreError(detailPath, formatStoreActionError(error));
    }
  }

  revalidatePath("/dashboard/stores");
  revalidatePath("/dashboard");
  revalidatePath(`/store/${publishedSlug}`);
  redirect(`/dashboard/stores?published=${publishedSlug}`);
}
