import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveStorefrontThemeRuntime } from "@/lib/storefront-theme-runtime";
import { getStorefrontContextFromHostname } from "@/lib/storefront-hostname-context";
import { defaultStoreThemeSettings, normalizeStoreThemeSettings } from "@/lib/store-theme";
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
  categoryId: string | null;
  categoryName: string | null;
  compareAtPrice: number | string | null;
  currency: string | null;
  description: string | null;
  gallery: unknown[];
  id: string;
  imageUrl: string | null;
  inventoryStatus: string | null;
  lowStockThreshold: number | null;
  price: number | string | null;
  priceLabel: string | null;
  sku: string | null;
  slug: string | null;
  status: string | null;
  title: string;
  stockQuantity: number | null;
  trackInventory: boolean;
  variants: PublicStorefrontVariant[];
};

export type PublicStorefrontCategory = {
  description: string | null;
  id: string;
  imageUrl: string | null;
  name: string;
  slug: string | null;
  status: string | null;
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
  layoutStyle: string;
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
    pickupEnabled: boolean;
    privacyPolicy: string | null;
    refundPolicy: string | null;
    slug: string;
    status: string;
    language: string;
    socialLinks: Record<string, string>;
    storeEmail: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
    termsOfService: string | null;
    timezone: string;
    title: string;
    visibility: string;
    currency: string;
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

function normalizeProduct(value: unknown): PublicStorefrontProduct | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = textValue(value.id);
  const title = textValue(value.title);

  if (!id || !title) {
    return null;
  }

  return {
    categoryId: textValue(value.categoryId) || null,
    categoryName: textValue(value.categoryName) || null,
    compareAtPrice:
      typeof value.compareAtPrice === "number" || typeof value.compareAtPrice === "string"
        ? value.compareAtPrice
        : null,
    currency: textValue(value.currency) || null,
    description: textValue(value.description) || null,
    gallery: Array.isArray(value.gallery) ? value.gallery : [],
    id,
    imageUrl: textValue(value.imageUrl) || null,
    inventoryStatus: textValue(value.inventoryStatus) || null,
    lowStockThreshold: typeof value.lowStockThreshold === "number" ? value.lowStockThreshold : null,
    price: typeof value.price === "number" || typeof value.price === "string" ? value.price : null,
    priceLabel: textValue(value.priceLabel) || null,
    sku: textValue(value.sku) || null,
    slug: textValue(value.slug) || null,
    status: textValue(value.status) || null,
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
    description: textValue(value.description) || null,
    id,
    imageUrl: textValue(value.imageUrl) || null,
    name,
    slug: textValue(value.slug) || null,
    status: textValue(value.status, "active")
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
    layoutStyle: textValue(value.layoutStyle, "classic"),
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
      pickupEnabled: booleanValue(store.pickupEnabled),
      privacyPolicy: textValue(store.privacyPolicy, "") || null,
      refundPolicy: textValue(store.refundPolicy, "") || null,
      slug,
      status: textValue(store.status, "active"),
      language: textValue(store.language, "en"),
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
      termsOfService: textValue(store.termsOfService, "") || null,
      timezone: textValue(store.timezone, "UTC"),
      title,
      visibility: textValue(store.visibility, "public"),
      currency: textValue(store.currency, "USD"),
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
    .select("store_id, status, visibility, slug")
    .eq("slug", normalizedSlug)
    .eq("status", "published")
    .eq("visibility", "public")
    .maybeSingle();
  const publication = rawPublication as {
    slug: string;
    status: string;
    store_id: string;
    visibility: string;
  } | null;

  if (!publication) {
    return null;
  }

  const { data: rawStore, error: storeError } = await client
    .from("stores")
    .select(
      "id, workspace_id, name, description, brand_color, currency, whatsapp_number, store_email, support_email, support_phone, business_address, business_hours, language, timezone, social_links, delivery_enabled, pickup_enabled, delivery_fee, free_delivery_threshold, delivery_notes, privacy_policy, terms_of_service, refund_policy, status, slug, store_data, template_id, theme_settings, theme_color, font_style, layout_style"
    )
    .eq("id", publication.store_id)
    .eq("status", "published")
    .maybeSingle();
  const store = rawStore as {
    brand_color: string;
    currency: string;
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
    .select("id, title, name, slug, description, price, compare_at_price, currency, image_url, gallery, category_id, status, stock_quantity, track_inventory, low_stock_threshold, inventory_status")
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
    .select("id, name, slug, description, image_url, status")
    .eq("store_id" as never, store.id as never)
    .eq("status" as never, "active" as never)
    .order("sort_order", { ascending: true });
  const savedCategories = ((categories ?? []) as Array<Record<string, unknown>>).map((category) => ({
    description: textValue(category.description) || null,
    id: String(category.id ?? ""),
    imageUrl: textValue(category.image_url) || null,
    name: textValue(category.name, "Category"),
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
  const savedProducts = ((products ?? []) as Array<Record<string, unknown>>).map((product) => ({
    categoryId: typeof product.category_id === "string" ? product.category_id : null,
    categoryName:
      typeof product.category_id === "string" ? categoriesById.get(product.category_id) ?? null : null,
    compareAtPrice: product.compare_at_price,
    currency: textValue(product.currency) || null,
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
    id: String(product.id ?? ""),
    inventoryStatus: textValue(product.inventory_status) || null,
    lowStockThreshold: typeof product.low_stock_threshold === "number" ? product.low_stock_threshold : null,
    title: textValue(product.title, textValue(product.name, "Untitled product")),
    description: textValue(product.description) || null,
    imageUrl: textValue(product.image_url) || null,
    price: typeof product.price === "number" || typeof product.price === "string" ? product.price : null,
    priceLabel: typeof product.price === "string" ? product.price : null,
    sku: null,
    slug: textValue(product.slug) || null,
    status: textValue(product.status, "active"),
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
  const { data: themeRow } = await client
    .from("store_theme_settings")
    .select("settings, theme_settings, theme_color, font_style, layout_style")
    .eq("store_id", store.id)
    .maybeSingle();
  const themeRecord = (themeRow ?? {}) as {
    font_style?: string | null;
    layout_style?: string | null;
    settings?: unknown;
    template_id?: string | null;
    theme_color?: string | null;
    theme_settings?: unknown;
  };
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
      font_style: themeRecord.font_style,
      layout_style: themeRecord.layout_style,
      primaryColor: themeRecord.theme_color || store.theme_color || store.brand_color
    },
    workspaceId: store.workspace_id
  });
  const themeSettings = themeRuntime.settings;

  return normalizePreview({
    branding: themeRuntime.branding,
    brandingConfig: {},
    categories: savedCategories.length ? savedCategories : fallbackCategories,
    fontStyle: themeRuntime.fontStyle,
    layoutStyle: themeRuntime.layoutStyle,
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
      pickupEnabled: Boolean(store.pickup_enabled),
      privacyPolicy: store.privacy_policy || null,
      refundPolicy: store.refund_policy || null,
      slug: store.slug,
      status: "active",
      language: store.language || "en",
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
      termsOfService: store.terms_of_service || null,
      timezone: store.timezone || "UTC",
      title: store.name,
      visibility: publication?.visibility ?? "public",
      whatsappNumber: store.whatsapp_number || null,
      workspaceId: store.workspace_id || null
    }
  });
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

  return normalizePreview(data);
}

export async function getPublicStorefrontPreviewByHostname(hostname: string) {
  const context = await getStorefrontContextFromHostname(hostname);

  if (!context) {
    return null;
  }

  return getPublicStorefrontPreview(context.storeSlug);
}
