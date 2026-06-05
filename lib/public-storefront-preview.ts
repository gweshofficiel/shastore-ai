import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveStorefrontThemeRuntime } from "@/lib/storefront-theme-runtime";
import { getStorefrontContextFromHostname } from "@/lib/storefront-hostname-context";
import {
  buildPublicStoreNavigation,
  getEnabledStoreNavigationRows,
  type PublicStoreNavigation
} from "@/lib/storefront/navigation";
import { normalizeStoreCurrencySettings, type StoreCurrencySettings } from "@/lib/store-currencies";
import { normalizeStoreLanguageSettings, type StoreLanguageSettings } from "@/lib/store-languages";
import { defaultStoreThemeSettings, normalizeStoreThemeSettings } from "@/lib/store-theme";
import {
  generatedVisualAssetsFromStoreData,
  resolveGeneratedVisualAssetForSlot,
  type GeneratedVisualAssetStore,
  type VisualAssetReference
} from "@/lib/storefront/visual-assets";
import type { StoreThemeSettings } from "@/types/storefront";

export type PublicStorefrontVariant = {
  id: string;
  name: string;
  optionColor: string | null;
  optionCustomName: string | null;
  optionCustomValue: string | null;
  optionMaterial: string | null;
  optionSize: string | null;
  priceOverride: number | string | null;
  sku: string | null;
  status: string | null;
  stockQuantity: number | null;
};

export type PublicStorefrontProduct = {
  aiVisualAsset?: VisualAssetReference | null;
  canonicalUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  compareAtPrice: number | string | null;
  createdAt: string | null;
  currency: string | null;
  description: string | null;
  digitalDeliveryEnabled: boolean;
  digitalFileName: string | null;
  gallery: unknown[];
  id: string;
  imageUrl: string | null;
  inventoryStatus: string | null;
  lowStockThreshold: number | null;
  noindex: boolean;
  ogDescription: string | null;
  ogImageUrl: string | null;
  ogTitle: string | null;
  price: number | string | null;
  priceLabel: string | null;
  productType: "physical" | "digital";
  requiresShipping: boolean;
  seoDescription: string | null;
  seoKeywords: string | null;
  seoTitle: string | null;
  sku: string | null;
  slug: string | null;
  status: string | null;
  recentlyPurchasedAt: string | null;
  salesCount: number;
  title: string;
  stockQuantity: number | null;
  trackInventory: boolean;
  variants: PublicStorefrontVariant[];
};

export type PublicStorefrontCategory = {
  aiVisualAsset?: VisualAssetReference | null;
  canonicalUrl: string | null;
  description: string | null;
  id: string;
  imageUrl: string | null;
  name: string;
  noindex: boolean;
  ogDescription: string | null;
  ogImageUrl: string | null;
  ogTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  seoTitle: string | null;
  slug: string | null;
  status: string | null;
};

export type PublicStorefrontPageLink = {
  id: string;
  pageType: string | null;
  slug: string;
  title: string;
};

export type PublicStorefrontPreview = {
  branding: {
    primaryColor: string;
    secondaryColor: string;
    themeMode: string;
  };
  brandingConfig: Record<string, unknown>;
  categories: PublicStorefrontCategory[];
  fontStyle: string;
  generatedVisualAssets: GeneratedVisualAssetStore;
  layoutStyle: string;
  navigation: PublicStoreNavigation;
  pages: PublicStorefrontPageLink[];
  products: PublicStorefrontProduct[];
  sectionsSchema: unknown[];
  templateId: string;
  themeColor: string;
  themeConfig: Record<string, unknown>;
  themeRuntime: {
    logEvents: string[];
    status: string;
    themeId: string | null;
    themeKey: string;
  };
  themeSettings: StoreThemeSettings;
  store: {
    businessAddress: string | null;
    businessHours: string | null;
    deliveryEnabled: boolean;
    deliveryFee: number | null;
    deliveryNotes: string | null;
    description: string | null;
    freeDeliveryThreshold: number | null;
    id: string;
    canonicalUrl: string | null;
    noindex: boolean;
    ogDescription: string | null;
    ogImageUrl: string | null;
    ogTitle: string | null;
    pickupEnabled: boolean;
    privacyPolicy: string | null;
    refundPolicy: string | null;
    slug: string;
    status: string;
    language: string;
    languageSettings: StoreLanguageSettings;
    socialLinks: Record<string, string>;
    storeEmail: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
    seoDescription: string | null;
    seoKeywords: string | null;
    seoTitle: string | null;
    termsOfService: string | null;
    timezone: string;
    title: string;
    visibility: string;
    currency: string;
    currencySettings: StoreCurrencySettings;
    whatsappNumber: string | null;
    workspaceId: string | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function salesQuantity(value: unknown) {
  const quantity = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
}

function isValidSalesOrder(order: { order_status?: string | null; payment_status?: string | null }) {
  const orderStatus = String(order.order_status ?? "").toLowerCase();
  const paymentStatus = String(order.payment_status ?? "").toLowerCase();

  return (
    ["paid", "captured", "succeeded", "completed"].includes(paymentStatus) ||
    ["confirmed", "processing", "completed", "fulfilled", "shipped", "delivered"].includes(orderStatus)
  );
}

function recordProductSale(
  summaries: Map<string, { recentlyPurchasedAt: string | null; salesCount: number }>,
  input: {
    productId: string | null;
    purchasedAt: string | null;
    quantity: number;
  }
) {
  if (!input.productId || input.quantity <= 0) {
    return;
  }

  const current = summaries.get(input.productId) ?? {
    recentlyPurchasedAt: null,
    salesCount: 0
  };
  const currentTime = current.recentlyPurchasedAt ? new Date(current.recentlyPurchasedAt).getTime() : 0;
  const nextTime = input.purchasedAt ? new Date(input.purchasedAt).getTime() : 0;

  summaries.set(input.productId, {
    recentlyPurchasedAt: nextTime > currentTime ? input.purchasedAt : current.recentlyPurchasedAt,
    salesCount: current.salesCount + input.quantity
  });
}

async function loadProductSalesSummaries(
  client: SupabaseClient,
  storeId: string,
  productIds: string[]
) {
  const summaries = new Map<string, { recentlyPurchasedAt: string | null; salesCount: number }>();

  if (!productIds.length) {
    return summaries;
  }

  const { data: rawOrders } = await client
    .from("orders" as never)
    .select("id, created_at, order_status, payment_status")
    .eq("store_id" as never, storeId as never)
    .order("created_at" as never, { ascending: false })
    .limit(500);
  const validOrders = ((rawOrders ?? []) as unknown as Array<{
    created_at: string | null;
    id: string;
    order_status?: string | null;
    payment_status?: string | null;
  }>).filter(isValidSalesOrder);
  const validOrderIds = validOrders.map((order) => order.id);
  const orderDateById = new Map(validOrders.map((order) => [order.id, order.created_at]));

  if (validOrderIds.length) {
    const { data: rawItems } = await client
      .from("order_items" as never)
      .select("order_id, product_id, quantity")
      .in("order_id" as never, validOrderIds as never)
      .in("product_id" as never, productIds as never);

    for (const item of (rawItems ?? []) as unknown as Array<{
      order_id: string | null;
      product_id: string | null;
      quantity: number | string | null;
    }>) {
      recordProductSale(summaries, {
        productId: item.product_id,
        purchasedAt: item.order_id ? orderDateById.get(item.order_id) ?? null : null,
        quantity: salesQuantity(item.quantity)
      });
    }
  }

  const { data: rawStoreOrders } = await client
    .from("store_orders" as never)
    .select("created_at, items, order_status, payment_status")
    .eq("store_id" as never, storeId as never)
    .order("created_at" as never, { ascending: false })
    .limit(500);

  for (const order of ((rawStoreOrders ?? []) as unknown as Array<{
    created_at: string | null;
    items: unknown;
    order_status?: string | null;
    payment_status?: string | null;
  }>).filter(isValidSalesOrder)) {
    if (!Array.isArray(order.items)) {
      continue;
    }

    for (const item of order.items.filter(isRecord)) {
      const productId = textValue(item.product_id) || textValue(item.productId) || textValue(item.id) || null;

      if (!productId || !productIds.includes(productId)) {
        continue;
      }

      recordProductSale(summaries, {
        productId,
        purchasedAt: order.created_at,
        quantity: salesQuantity(item.quantity)
      });
    }
  }

  return summaries;
}

function normalizeProduct(value: unknown): PublicStorefrontProduct | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = textValue(value.id);
  const title = textValue(value.title);
  const status = textValue(value.status) || null;

  if (!id || !title) {
    return null;
  }

  return {
    aiVisualAsset: isRecord(value.aiVisualAsset) ? value.aiVisualAsset as VisualAssetReference : null,
    canonicalUrl: textValue(value.canonicalUrl) || textValue(value.canonical_url) || null,
    categoryId: textValue(value.categoryId) || null,
    categoryName: textValue(value.categoryName) || null,
    compareAtPrice:
      typeof value.compareAtPrice === "number" || typeof value.compareAtPrice === "string"
        ? value.compareAtPrice
        : null,
    createdAt: textValue(value.createdAt) || textValue(value.created_at) || null,
    currency: textValue(value.currency) || null,
    description: textValue(value.description) || null,
    digitalDeliveryEnabled: false,
    digitalFileName: null,
    gallery: Array.isArray(value.gallery) ? value.gallery : [],
    id,
    imageUrl: textValue(value.imageUrl) || null,
    inventoryStatus: textValue(value.inventoryStatus) || null,
    lowStockThreshold: typeof value.lowStockThreshold === "number" ? value.lowStockThreshold : null,
    noindex: value.noindex === true,
    ogDescription: textValue(value.ogDescription) || textValue(value.og_description) || null,
    ogImageUrl: textValue(value.ogImageUrl) || textValue(value.og_image_url) || null,
    ogTitle: textValue(value.ogTitle) || textValue(value.og_title) || null,
    price: typeof value.price === "number" || typeof value.price === "string" ? value.price : null,
    priceLabel: textValue(value.priceLabel) || null,
    productType: "physical",
    requiresShipping: true,
    seoDescription: textValue(value.seoDescription) || textValue(value.seo_description) || null,
    seoKeywords: textValue(value.seoKeywords) || textValue(value.seo_keywords) || null,
    seoTitle: textValue(value.seoTitle) || textValue(value.seo_title) || null,
    sku: textValue(value.sku) || null,
    slug: textValue(value.slug) || null,
    status: status === "published" ? "active" : status,
    recentlyPurchasedAt: textValue(value.recentlyPurchasedAt) || textValue(value.recently_purchased_at) || null,
    salesCount: salesQuantity(value.salesCount ?? value.sales_count),
    title,
    stockQuantity: typeof value.stockQuantity === "number" ? value.stockQuantity : null,
    trackInventory: value.trackInventory === true,
    variants: Array.isArray(value.variants)
      ? value.variants.filter((variant): variant is PublicStorefrontVariant => isRecord(variant)).map((variant) => ({
          id: textValue(variant.id),
          name: textValue(variant.name, "Variant"),
          optionColor: textValue(variant.optionColor) || null,
          optionCustomName: textValue(variant.optionCustomName) || null,
          optionCustomValue: textValue(variant.optionCustomValue) || null,
          optionMaterial: textValue(variant.optionMaterial) || null,
          optionSize: textValue(variant.optionSize) || null,
          priceOverride:
            typeof variant.priceOverride === "number" || typeof variant.priceOverride === "string"
              ? variant.priceOverride
              : null,
          sku: textValue(variant.sku) || null,
          status: textValue(variant.status, "active"),
          stockQuantity: typeof variant.stockQuantity === "number" ? variant.stockQuantity : null
        }))
      : []
  };
}

function normalizeCategory(value: unknown): PublicStorefrontCategory | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = textValue(value.id);
  const name = textValue(value.name);

  if (!id || !name) {
    return null;
  }

  return {
    aiVisualAsset: isRecord(value.aiVisualAsset) ? value.aiVisualAsset as VisualAssetReference : null,
    canonicalUrl: textValue(value.canonicalUrl) || textValue(value.canonical_url) || null,
    description: textValue(value.description) || null,
    id,
    imageUrl: textValue(value.imageUrl) || null,
    name,
    noindex: value.noindex === true,
    ogDescription: textValue(value.ogDescription) || textValue(value.og_description) || null,
    ogImageUrl: textValue(value.ogImageUrl) || textValue(value.og_image_url) || null,
    ogTitle: textValue(value.ogTitle) || textValue(value.og_title) || null,
    seoDescription: textValue(value.seoDescription) || textValue(value.seo_description) || null,
    seoKeywords: textValue(value.seoKeywords) || textValue(value.seo_keywords) || null,
    seoTitle: textValue(value.seoTitle) || textValue(value.seo_title) || null,
    slug: textValue(value.slug) || null,
    status: textValue(value.status, "active")
  };
}

function normalizePageLink(value: unknown): PublicStorefrontPageLink | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = textValue(value.id);
  const slug = textValue(value.slug);
  const title = textValue(value.title);

  if (!id || !slug || !title) {
    return null;
  }

  return {
    id,
    pageType: textValue(value.pageType) || textValue(value.page_type) || null,
    slug,
    title
  };
}

export async function getPublishedPageLinks(client: SupabaseClient, storeId: string) {
  const { data, error } = await client
    .from("store_pages" as never)
    .select("id, title, slug, page_type, created_at")
    .eq("store_id", storeId)
    .eq("status", "published")
    .order("created_at" as never, { ascending: true } as never)
    .order("title" as never, { ascending: true } as never);

  if (error) {
    console.warn("[storefront-preview] published page links failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    return [];
  }

  return ((data ?? []) as unknown[]).map(normalizePageLink).filter((page): page is PublicStorefrontPageLink => Boolean(page));
}

async function getPublishedStoreSeo(client: SupabaseClient, storeId: string) {
  const { data, error } = await client
    .from("published_stores" as never)
    .select("seo_title, seo_description, seo_keywords, og_title, og_description, og_image_url, social_image_url, canonical_url, noindex")
    .eq("store_id", storeId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as {
    canonical_url?: string | null;
    noindex?: boolean | null;
    og_description?: string | null;
    og_image_url?: string | null;
    og_title?: string | null;
    seo_description?: string | null;
    seo_keywords?: string | null;
    seo_title?: string | null;
    social_image_url?: string | null;
  } | null;
}

async function getStoreDataForPreview(client: SupabaseClient, storeId: string) {
  const { data, error } = await client
    .from("stores" as never)
    .select("store_data")
    .eq("id" as never, storeId as never)
    .maybeSingle();

  if (error || !data) {
    return {};
  }

  const row = data as { store_data?: unknown };
  return isRecord(row.store_data) ? row.store_data : {};
}

function withGeneratedVisualAssets(preview: PublicStorefrontPreview, storeData: unknown): PublicStorefrontPreview {
  const generatedVisualAssets = generatedVisualAssetsFromStoreData(storeData);

  return {
    ...preview,
    categories: preview.categories.map((category) => ({
      ...category,
      aiVisualAsset: resolveGeneratedVisualAssetForSlot({
        generatedVisualAssets,
        slot: "category.image",
        storeId: preview.store.id,
        targetId: category.id
      }) ?? category.aiVisualAsset ?? null
    })),
    generatedVisualAssets,
    products: preview.products.map((product) => ({
      ...product,
      aiVisualAsset: resolveGeneratedVisualAssetForSlot({
        generatedVisualAssets,
        slot: "product.primary",
        storeId: preview.store.id,
        targetId: product.id
      }) ?? product.aiVisualAsset ?? null
    }))
  };
}

function normalizePreview(value: unknown): PublicStorefrontPreview | null {
  if (!isRecord(value)) {
    return null;
  }

  const store = isRecord(value.store) ? value.store : null;
  const branding = isRecord(value.branding) ? value.branding : {};

  if (!store) {
    return null;
  }

  const id = textValue(store.id);
  const slug = textValue(store.slug);
  const title = textValue(store.title);

  if (!id || !slug || !title) {
    return null;
  }

  return {
    branding: {
      primaryColor: textValue(branding.primaryColor, "#0f172a"),
      secondaryColor: textValue(branding.secondaryColor, "#2563eb"),
      themeMode: textValue(branding.themeMode, "light")
    },
    brandingConfig: isRecord(value.brandingConfig) ? value.brandingConfig : {},
    categories: Array.isArray(value.categories)
      ? value.categories.map(normalizeCategory).filter((category): category is PublicStorefrontCategory => Boolean(category))
      : [],
    fontStyle: textValue(value.fontStyle, "inter"),
    generatedVisualAssets: generatedVisualAssetsFromStoreData(value.storeData),
    layoutStyle: textValue(value.layoutStyle, "classic"),
    navigation: {
      footer: [],
      header: []
    },
    pages: Array.isArray(value.pages)
      ? value.pages.map(normalizePageLink).filter((page): page is PublicStorefrontPageLink => Boolean(page))
      : [],
    products: Array.isArray(value.products)
      ? value.products.map(normalizeProduct).filter((product): product is PublicStorefrontProduct => Boolean(product))
      : [],
    sectionsSchema: Array.isArray(value.sectionsSchema) ? value.sectionsSchema : [],
    templateId: textValue(value.templateId, "general-starter"),
    themeColor: textValue(value.themeColor, textValue(branding.primaryColor, "#0f172a")),
    themeConfig: isRecord(value.themeConfig) ? value.themeConfig : {},
    themeRuntime: isRecord(value.themeRuntime)
      ? {
          logEvents: Array.isArray(value.themeRuntime.logEvents)
            ? value.themeRuntime.logEvents.filter((item): item is string => typeof item === "string")
            : [],
          status: textValue(value.themeRuntime.status, "published"),
          themeId: textValue(value.themeRuntime.themeId) || null,
          themeKey: textValue(value.themeRuntime.themeKey, textValue(value.templateId, "general-starter"))
        }
      : {
          logEvents: [],
          status: "published",
          themeId: null,
          themeKey: textValue(value.templateId, "general-starter")
        },
    themeSettings: normalizeStoreThemeSettings(value.themeSettings, defaultStoreThemeSettings),
    store: {
      businessAddress: textValue(store.businessAddress) || null,
      businessHours: textValue(store.businessHours) || null,
      deliveryEnabled: booleanValue(store.deliveryEnabled),
      deliveryFee: numberValue(store.deliveryFee),
      deliveryNotes: textValue(store.deliveryNotes, "") || null,
      description: textValue(store.description) || null,
      freeDeliveryThreshold: numberValue(store.freeDeliveryThreshold),
      id,
      canonicalUrl: textValue(store.canonicalUrl) || textValue(store.canonical_url) || null,
      noindex: store.noindex === true,
      ogDescription: textValue(store.ogDescription) || textValue(store.og_description) || null,
      ogImageUrl: textValue(store.ogImageUrl) || textValue(store.og_image_url) || textValue(store.socialImageUrl) || null,
      ogTitle: textValue(store.ogTitle) || textValue(store.og_title) || null,
      pickupEnabled: booleanValue(store.pickupEnabled),
      privacyPolicy: textValue(store.privacyPolicy, "") || null,
      refundPolicy: textValue(store.refundPolicy, "") || null,
      slug,
      status: textValue(store.status, "active"),
      language: textValue(store.language, "en"),
      languageSettings: normalizeStoreLanguageSettings(store.languageSettings),
      socialLinks: isRecord(store.socialLinks)
        ? Object.fromEntries(
            Object.entries(store.socialLinks).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0
            )
          )
        : {},
      storeEmail: textValue(store.storeEmail) || textValue(store.supportEmail) || null,
      supportEmail: textValue(store.supportEmail) || null,
      supportPhone: textValue(store.supportPhone) || null,
      seoDescription: textValue(store.seoDescription) || textValue(store.seo_description) || null,
      seoKeywords: textValue(store.seoKeywords) || textValue(store.seo_keywords) || null,
      seoTitle: textValue(store.seoTitle) || textValue(store.seo_title) || null,
      termsOfService: textValue(store.termsOfService, "") || null,
      timezone: textValue(store.timezone, "UTC"),
      title,
      visibility: textValue(store.visibility, "public"),
      currency: textValue(store.currency, "USD"),
      currencySettings: normalizeStoreCurrencySettings(store.currencySettings, textValue(store.currency, "USD")),
      whatsappNumber: textValue(store.whatsappNumber) || null,
      workspaceId: textValue(store.workspaceId) || null
    }
  };
}

function categoriesFromStoreData(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.categories)) {
    return [];
  }

  return value.categories.filter(isRecord).map(normalizeCategory).filter((category): category is PublicStorefrontCategory => Boolean(category));
}

async function loadStoreModePublicPreview(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    return null;
  }

  const client = createAdminClient() ?? (await createClient());
  const { data: rawPublication } = await client
    .from("published_stores")
    .select("store_id, status, visibility, slug, seo_title, seo_description, seo_keywords, og_title, og_description, og_image_url, social_image_url, canonical_url, noindex")
    .eq("slug", normalizedSlug)
    .eq("status", "published")
    .eq("visibility", "public")
    .maybeSingle();
  const publication = rawPublication as {
    slug: string;
    status: string;
    store_id: string;
    visibility: string;
    seo_title?: string | null;
    seo_description?: string | null;
    seo_keywords?: string | null;
    og_title?: string | null;
    og_description?: string | null;
    og_image_url?: string | null;
    social_image_url?: string | null;
    canonical_url?: string | null;
    noindex?: boolean | null;
  } | null;

  if (!publication) {
    return null;
  }

  const { data: rawStore, error: storeError } = await client
    .from("stores")
    .select(
      "id, workspace_id, name, description, brand_color, logo_image_url, currency, currency_settings, whatsapp_number, store_email, support_email, support_phone, business_address, business_hours, language, language_settings, timezone, social_links, delivery_enabled, pickup_enabled, delivery_fee, free_delivery_threshold, delivery_notes, privacy_policy, terms_of_service, refund_policy, status, slug, store_data, template_id, theme_settings, theme_color, font_style, layout_style"
    )
    .eq("id", publication.store_id)
    .eq("status", "published")
    .maybeSingle();
  const store = rawStore as {
    brand_color: string;
    currency: string;
    currency_settings?: unknown;
    description: string | null;
    id: string;
    workspace_id?: string | null;
    name: string;
    slug: string | null;
    status: string;
    store_data: unknown;
    template_id?: string | null;
    theme_color?: string | null;
    theme_settings?: unknown;
    font_style?: string | null;
    layout_style?: string | null;
    business_address?: string | null;
    business_hours?: string | null;
    delivery_enabled?: boolean | null;
    delivery_fee?: number | string | null;
    delivery_notes?: string | null;
    free_delivery_threshold?: number | string | null;
    pickup_enabled?: boolean | null;
    privacy_policy?: string | null;
    refund_policy?: string | null;
    language?: string | null;
    language_settings?: unknown;
    social_links?: unknown;
    store_email?: string | null;
    support_email?: string | null;
    support_phone?: string | null;
    terms_of_service?: string | null;
    timezone?: string | null;
    whatsapp_number: string | null;
  } | null;

  if (storeError || !store?.slug) {
    return null;
  }

  const { data: products } = await client
    .from("store_products" as never)
    .select("id, title, name, slug, description, price, compare_at_price, currency, image_url, gallery, category_id, status, product_type, requires_shipping, digital_file_name, digital_delivery_enabled, stock_quantity, track_inventory, low_stock_threshold, inventory_status, seo_title, seo_description, seo_keywords, og_title, og_description, og_image_url, canonical_url, noindex, created_at")
    .eq("store_id", store.id)
    .eq("status" as never, "active" as never)
    .order("sort_order", { ascending: true });
  const productIds = ((products ?? []) as Array<{ id?: unknown }>)
    .map((product) => (typeof product.id === "string" ? product.id : null))
    .filter((id): id is string => Boolean(id));
  const { data: variants } = productIds.length
    ? await client
        .from("product_variants" as never)
        .select("id, product_id, name, option_size, option_color, option_material, option_custom_name, option_custom_value, sku, price_override, stock_quantity, status")
        .eq("store_id", store.id)
        .eq("status" as never, "active" as never)
        .in("product_id" as never, productIds as never)
        .order("created_at", { ascending: true })
    : { data: [] };
  const { data: categories } = await client
    .from("store_categories" as never)
    .select("id, name, slug, description, image_url, status, seo_title, seo_description, seo_keywords, og_title, og_description, og_image_url, canonical_url, noindex")
    .eq("store_id" as never, store.id as never)
    .eq("status" as never, "active" as never)
    .order("sort_order", { ascending: true });
  const generatedVisualAssets = generatedVisualAssetsFromStoreData(store.store_data);
  const savedCategories = ((categories ?? []) as Array<Record<string, unknown>>).map((category) => ({
    aiVisualAsset: resolveGeneratedVisualAssetForSlot({
      generatedVisualAssets,
      slot: "category.image",
      storeId: store.id,
      targetId: String(category.id ?? "")
    }),
    description: textValue(category.description) || null,
    id: String(category.id ?? ""),
    imageUrl: textValue(category.image_url) || null,
    name: textValue(category.name, "Category"),
    canonicalUrl: textValue(category.canonical_url) || null,
    noindex: category.noindex === true,
    ogDescription: textValue(category.og_description) || null,
    ogImageUrl: textValue(category.og_image_url) || null,
    ogTitle: textValue(category.og_title) || null,
    seoDescription: textValue(category.seo_description) || null,
    seoKeywords: textValue(category.seo_keywords) || null,
    seoTitle: textValue(category.seo_title) || null,
    slug: textValue(category.slug) || null,
    status: textValue(category.status, "active")
  }));
  const categoriesById = new Map(savedCategories.map((category) => [category.id, category.name]));
  const variantsByProduct = new Map<string, PublicStorefrontVariant[]>();
  for (const variant of (variants ?? []) as Array<Record<string, unknown>>) {
    const productId = typeof variant.product_id === "string" ? variant.product_id : null;
    if (!productId) {
      continue;
    }

    const savedVariants = variantsByProduct.get(productId) ?? [];
    savedVariants.push({
      id: String(variant.id ?? ""),
      name: textValue(variant.name, "Variant"),
      optionColor: textValue(variant.option_color) || null,
      optionCustomName: textValue(variant.option_custom_name) || null,
      optionCustomValue: textValue(variant.option_custom_value) || null,
      optionMaterial: textValue(variant.option_material) || null,
      optionSize: textValue(variant.option_size) || null,
      priceOverride:
        typeof variant.price_override === "number" || typeof variant.price_override === "string"
          ? variant.price_override
          : null,
      sku: textValue(variant.sku) || null,
      status: textValue(variant.status, "active"),
      stockQuantity:
        typeof variant.stock_quantity === "number"
          ? variant.stock_quantity
          : typeof variant.stock_quantity === "string" && variant.stock_quantity.trim()
            ? Number.parseInt(variant.stock_quantity, 10)
            : null
    });
    variantsByProduct.set(productId, savedVariants);
  }
  const salesSummaryByProduct = await loadProductSalesSummaries(client, store.id, productIds);
  const savedProducts = ((products ?? []) as Array<Record<string, unknown>>).map((product) => ({
    aiVisualAsset: resolveGeneratedVisualAssetForSlot({
      generatedVisualAssets,
      slot: "product.primary",
      storeId: store.id,
      targetId: String(product.id ?? "")
    }),
    categoryId: typeof product.category_id === "string" ? product.category_id : null,
    categoryName:
      typeof product.category_id === "string" ? categoriesById.get(product.category_id) ?? null : null,
    compareAtPrice: product.compare_at_price,
    createdAt: textValue(product.created_at) || null,
    currency: textValue(product.currency) || null,
    digitalDeliveryEnabled: product.digital_delivery_enabled === true,
    digitalFileName: textValue(product.digital_file_name) || null,
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
    id: String(product.id ?? ""),
    inventoryStatus: textValue(product.inventory_status) || null,
    lowStockThreshold: typeof product.low_stock_threshold === "number" ? product.low_stock_threshold : null,
    canonicalUrl: textValue(product.canonical_url) || null,
    noindex: product.noindex === true,
    ogDescription: textValue(product.og_description) || null,
    ogImageUrl: textValue(product.og_image_url) || null,
    ogTitle: textValue(product.og_title) || null,
    seoDescription: textValue(product.seo_description) || null,
    seoKeywords: textValue(product.seo_keywords) || null,
    seoTitle: textValue(product.seo_title) || null,
    title: textValue(product.title, textValue(product.name, "Untitled product")),
    description: textValue(product.description) || null,
    imageUrl: textValue(product.image_url) || null,
    price: typeof product.price === "number" || typeof product.price === "string" ? product.price : null,
    priceLabel: typeof product.price === "string" ? product.price : null,
    productType: textValue(product.product_type) === "digital" ? "digital" : "physical",
    requiresShipping: textValue(product.product_type) === "digital" ? false : product.requires_shipping !== false,
    sku: null,
    slug: textValue(product.slug) || null,
    status: textValue(product.status, "active"),
    recentlyPurchasedAt: salesSummaryByProduct.get(String(product.id ?? ""))?.recentlyPurchasedAt ?? null,
    salesCount: salesSummaryByProduct.get(String(product.id ?? ""))?.salesCount ?? 0,
    stockQuantity: (() => {
      if (typeof product.stock_quantity === "number" && Number.isFinite(product.stock_quantity)) {
        return product.stock_quantity;
      }

      if (typeof product.stock_quantity === "string" && product.stock_quantity.trim()) {
        const parsed = Number.parseInt(product.stock_quantity, 10);
        return Number.isFinite(parsed) ? parsed : null;
      }

      return null;
    })(),
    trackInventory: product.track_inventory === true,
    variants: variantsByProduct.get(String(product.id ?? "")) ?? []
  }));
  const fallbackCategories = categoriesFromStoreData(store.store_data);
  const pages = await getPublishedPageLinks(client, store.id);
  const navigationRows = await getEnabledStoreNavigationRows(client, store.id);
  const { data: themeRow } = await client
    .from("store_theme_settings")
    .select("settings, theme_settings, logo_image_url, theme_color, font_style, layout_style")
    .eq("store_id", store.id)
    .maybeSingle();
  const themeRecord = (themeRow ?? {}) as {
    font_style?: string | null;
    layout_style?: string | null;
    logo_image_url?: string | null;
    settings?: unknown;
    template_id?: string | null;
    theme_color?: string | null;
    theme_settings?: unknown;
  };
  const persistedLogoUrl =
    textValue(themeRecord.logo_image_url) ||
    (isRecord(themeRecord.settings) ? textValue(themeRecord.settings.logoUrl) : "") ||
    (isRecord(themeRecord.theme_settings) ? textValue(themeRecord.theme_settings.logoUrl) : "") ||
    textValue((store as { logo_image_url?: string | null }).logo_image_url);
  const themeRuntime = await resolveStorefrontThemeRuntime({
    brandColor: store.brand_color,
    client,
    fallbackSettings: defaultStoreThemeSettings,
    fontStyle: themeRecord.font_style ?? store.font_style,
    layoutStyle: themeRecord.layout_style ?? store.layout_style,
    selectedThemeKey: themeRecord.template_id ?? store.template_id,
    storeId: store.id,
    storeSettings: store.theme_settings,
    themeSettingsRow: {
      ...(isRecord(themeRecord.theme_settings) ? themeRecord.theme_settings : {}),
      ...(isRecord(themeRecord.settings) ? themeRecord.settings : {}),
      ...(persistedLogoUrl ? { logoUrl: persistedLogoUrl } : {}),
      font_style: themeRecord.font_style,
      layout_style: themeRecord.layout_style,
      primaryColor: themeRecord.theme_color || store.theme_color || store.brand_color
    },
    workspaceId: store.workspace_id
  });
  const themeSettings = themeRuntime.settings;

  const preview = normalizePreview({
    branding: themeRuntime.branding,
    brandingConfig: {},
    categories: savedCategories.length ? savedCategories : fallbackCategories,
    fontStyle: themeRuntime.fontStyle,
    storeData: store.store_data,
    layoutStyle: themeRuntime.layoutStyle,
    pages,
    products: savedProducts,
    sectionsSchema: themeRuntime.layoutSections,
    templateId: themeRuntime.themeKey || store.template_id || "general-starter",
    themeColor: themeRuntime.themeColor,
    themeConfig: themeRuntime.themeConfig,
    themeRuntime: {
      logEvents: themeRuntime.logEvents,
      status: themeRuntime.status,
      themeId: themeRuntime.themeId,
      themeKey: themeRuntime.themeKey
    },
    themeSettings,
    store: {
      businessAddress: store.business_address || null,
      businessHours: store.business_hours || null,
      currency: store.currency || "USD",
      deliveryEnabled: Boolean(store.delivery_enabled),
      deliveryFee: numberValue(store.delivery_fee),
      deliveryNotes: store.delivery_notes || null,
      description: store.description,
      freeDeliveryThreshold: numberValue(store.free_delivery_threshold),
      id: store.id,
      canonicalUrl: publication?.canonical_url || null,
      noindex: publication?.noindex === true,
      ogDescription: publication?.og_description || null,
      ogImageUrl: publication?.og_image_url || publication?.social_image_url || null,
      ogTitle: publication?.og_title || null,
      pickupEnabled: Boolean(store.pickup_enabled),
      privacyPolicy: store.privacy_policy || null,
      refundPolicy: store.refund_policy || null,
      slug: store.slug,
      status: "active",
      language: store.language || "en",
      languageSettings: normalizeStoreLanguageSettings(store.language_settings),
      socialLinks: isRecord(store.social_links)
        ? Object.fromEntries(
            Object.entries(store.social_links).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0
            )
          )
        : {},
      storeEmail: store.store_email || store.support_email || null,
      supportEmail: store.support_email || store.store_email || null,
      supportPhone: store.support_phone || null,
      seoDescription: publication?.seo_description || null,
      seoKeywords: publication?.seo_keywords || null,
      seoTitle: publication?.seo_title || null,
      termsOfService: store.terms_of_service || null,
      timezone: store.timezone || "UTC",
      title: store.name,
      visibility: publication?.visibility ?? "public",
      whatsappNumber: store.whatsapp_number || null,
      currencySettings: normalizeStoreCurrencySettings(store.currency_settings, store.currency),
      workspaceId: store.workspace_id || null
    }
  });

  const enrichedPreview = preview ? withGeneratedVisualAssets(preview, store.store_data) : null;

  return enrichedPreview
    ? {
        ...enrichedPreview,
        navigation: buildPublicStoreNavigation({
          categories: enrichedPreview.categories,
          pages: enrichedPreview.pages,
          products: enrichedPreview.products,
          rows: navigationRows,
          storeSlug: enrichedPreview.store.slug
        })
      }
    : null;
}

export async function getPublicStorefrontPreview(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  const storeModePreview = await loadStoreModePublicPreview(normalizedSlug);

  if (storeModePreview) {
    return storeModePreview;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_storefront_preview" as never, {
    store_slug: normalizedSlug
  } as never);

  if (error) {
    console.error("[storefront-preview] public preview load failed", {
      code: error.code,
      message: error.message,
      slug: normalizedSlug
    });
    return null;
  }

  const preview = normalizePreview(data);

  if (!preview) {
    return null;
  }

  const readClient = createAdminClient() ?? supabase;
  const [pages, navigationRows, storeSeo, storeData] = await Promise.all([
    getPublishedPageLinks(readClient, preview.store.id),
    getEnabledStoreNavigationRows(readClient, preview.store.id),
    getPublishedStoreSeo(readClient, preview.store.id),
    getStoreDataForPreview(readClient, preview.store.id)
  ]);

  const previewWithPages = {
    ...preview,
    pages,
    store: storeSeo
      ? {
          ...preview.store,
          canonicalUrl: storeSeo.canonical_url || preview.store.canonicalUrl,
          noindex: storeSeo.noindex === true,
          ogDescription: storeSeo.og_description || preview.store.ogDescription,
          ogImageUrl: storeSeo.og_image_url || storeSeo.social_image_url || preview.store.ogImageUrl,
          ogTitle: storeSeo.og_title || preview.store.ogTitle,
          seoDescription: storeSeo.seo_description || preview.store.seoDescription,
          seoKeywords: storeSeo.seo_keywords || preview.store.seoKeywords,
          seoTitle: storeSeo.seo_title || preview.store.seoTitle
        }
      : preview.store
  };

  const enrichedPreview = withGeneratedVisualAssets(previewWithPages, storeData);

  return {
    ...enrichedPreview,
    navigation: buildPublicStoreNavigation({
      categories: enrichedPreview.categories,
      pages: enrichedPreview.pages,
      products: enrichedPreview.products,
      rows: navigationRows,
      storeSlug: enrichedPreview.store.slug
    })
  };
}

export async function getPublicStorefrontPreviewByHostname(hostname: string) {
  const context = await getStorefrontContextFromHostname(hostname);

  if (!context) {
    return null;
  }

  return getPublicStorefrontPreview(context.storeSlug);
}
