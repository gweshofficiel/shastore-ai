import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStorefrontContextFromHostname } from "@/lib/storefront-hostname-context";
import { defaultStoreThemeSettings, normalizeStoreThemeSettings } from "@/lib/store-theme";
import type { StoreThemeSettings } from "@/types/storefront";

export type PublicStorefrontProduct = {
  categoryId: string | null;
  categoryName: string | null;
  compareAtPrice: number | string | null;
  description: string | null;
  gallery: unknown[];
  id: string;
  imageUrl: string | null;
  price: number | string | null;
  priceLabel: string | null;
  sku: string | null;
  status: string | null;
  title: string;
};

export type PublicStorefrontCategory = {
  description: string | null;
  id: string;
  imageUrl: string | null;
  name: string;
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
  themeSettings: StoreThemeSettings;
  store: {
    description: string | null;
    id: string;
    slug: string;
    status: string;
    title: string;
    visibility: string;
    currency: string;
    whatsappNumber: string | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeRuntimeFont(value: unknown) {
  if (value === "editorial" || value === "luxury" || value === "soft") {
    return "serif";
  }

  if (value === "technical" || value === "mono") {
    return "mono";
  }

  if (value === "display") {
    return "display";
  }

  return "inter";
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
    description: textValue(value.description) || null,
    gallery: Array.isArray(value.gallery) ? value.gallery : [],
    id,
    imageUrl: textValue(value.imageUrl) || null,
    price: typeof value.price === "number" || typeof value.price === "string" ? value.price : null,
    priceLabel: textValue(value.priceLabel) || null,
    sku: textValue(value.sku) || null,
    status: textValue(value.status) || null,
    title
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
    name
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
    themeSettings: normalizeStoreThemeSettings(value.themeSettings, defaultStoreThemeSettings),
    store: {
      description: textValue(store.description) || null,
      id,
      slug,
      status: textValue(store.status, "active"),
      title,
      visibility: textValue(store.visibility, "public"),
      currency: textValue(store.currency, "USD"),
      whatsappNumber: textValue(store.whatsappNumber) || null
    }
  };
}

function categoriesFromStoreData(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.categories)) {
    return [];
  }

  return value.categories.filter(isRecord).map(normalizeCategory).filter((category): category is PublicStorefrontCategory => Boolean(category));
}

function productsFromStoreData(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.products)) {
    return [];
  }

  const categoriesById = new Map<string, string>();

  if (Array.isArray(value.categories)) {
    for (const category of value.categories) {
      if (!isRecord(category)) {
        continue;
      }

      const id = textValue(category.id);
      const name = textValue(category.name);

      if (id && name) {
        categoriesById.set(id, name);
      }
    }
  }

  return value.products
    .filter(isRecord)
    .map((product, index) => ({
      categoryId: textValue(product.categoryId) || null,
      categoryName: categoriesById.get(textValue(product.categoryId)) ?? null,
      compareAtPrice: null,
      description: textValue(product.description) || null,
      gallery: [],
      id: textValue(product.id, `product-${index + 1}`),
      imageUrl: textValue(product.imageUrl) || null,
      price: textValue(product.price) || null,
      priceLabel: textValue(product.price) || null,
      sku: null,
      status: "published",
      title: textValue(product.name)
    }))
    .filter((product) => product.title);
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
      "id, name, description, brand_color, currency, whatsapp_number, status, slug, store_data, template_id, theme_settings, theme_color, font_style, layout_style"
    )
    .eq("id", publication.store_id)
    .eq("status", "published")
    .maybeSingle();
  const store = rawStore as {
    brand_color: string;
    currency: string;
    description: string | null;
    id: string;
    name: string;
    slug: string | null;
    status: string;
    store_data: unknown;
    template_id?: string | null;
    theme_color?: string | null;
    theme_settings?: unknown;
    font_style?: string | null;
    layout_style?: string | null;
    whatsapp_number: string | null;
  } | null;

  if (storeError || !store?.slug) {
    return null;
  }

  const { data: products } = await client
    .from("store_products" as never)
    .select("id, title, name, slug, description, price, compare_at_price, currency, image_url, gallery, category_id, status")
    .eq("store_id", store.id)
    .eq("status" as never, "active" as never)
    .order("sort_order", { ascending: true });
  const { data: categories } = await client
    .from("store_categories")
    .select("id, name, description, image_url")
    .eq("store_id", store.id)
    .order("sort_order", { ascending: true });
  const savedCategories = (categories ?? []).map((category) => ({
    description: category.description,
    id: category.id,
    imageUrl: category.image_url,
    name: category.name
  }));
  const categoriesById = new Map(savedCategories.map((category) => [category.id, category.name]));
  const savedProducts = ((products ?? []) as Array<Record<string, unknown>>).map((product) => ({
    categoryId: typeof product.category_id === "string" ? product.category_id : null,
    categoryName:
      typeof product.category_id === "string" ? categoriesById.get(product.category_id) ?? null : null,
    compareAtPrice: product.compare_at_price,
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
    id: String(product.id ?? ""),
    title: textValue(product.title, textValue(product.name, "Untitled product")),
    description: textValue(product.description) || null,
    imageUrl: textValue(product.image_url) || null,
    price: typeof product.price === "number" || typeof product.price === "string" ? product.price : null,
    priceLabel: typeof product.price === "string" ? product.price : null,
    sku: null,
    status: textValue(product.status, "active")
  }));
  const fallbackCategories = categoriesFromStoreData(store.store_data);
  const fallbackProducts = productsFromStoreData(store.store_data);
  const { data: themeRow } = await client
    .from("store_theme_settings")
    .select("settings, theme_settings, theme_color")
    .eq("store_id", store.id)
    .maybeSingle();
  const themeRecord = (themeRow ?? {}) as {
    settings?: unknown;
    theme_color?: string | null;
    theme_settings?: unknown;
  };
  const storeThemeSettings = isRecord(store.theme_settings) ? store.theme_settings : {};
  const persistedThemeSettings = isRecord(themeRecord.theme_settings) ? themeRecord.theme_settings : {};
  const themeSettings = normalizeStoreThemeSettings(
    {
      ...storeThemeSettings,
      ...persistedThemeSettings,
      ...(isRecord(themeRecord.settings) ? themeRecord.settings : {}),
      bodyFont: normalizeRuntimeFont(store.font_style),
      headingFont: normalizeRuntimeFont(store.font_style),
      primaryColor: themeRecord.theme_color || store.theme_color || store.brand_color
    },
    defaultStoreThemeSettings
  );

  return normalizePreview({
    branding: {
      primaryColor: themeSettings.primaryColor || store.brand_color || "#0f172a",
      secondaryColor: themeSettings.secondaryColor || "#2563eb",
      themeMode: "light"
    },
    brandingConfig: {},
    categories: savedCategories.length ? savedCategories : fallbackCategories,
    fontStyle: store.font_style || "inter",
    layoutStyle: store.layout_style || "classic",
    products: savedProducts.length ? savedProducts : fallbackProducts,
    sectionsSchema: [],
    templateId: store.template_id || "general-starter",
    themeColor: themeSettings.primaryColor || store.theme_color || store.brand_color || "#0f172a",
    themeConfig: {},
    themeSettings,
    store: {
      currency: store.currency || "USD",
      description: store.description,
      id: store.id,
      slug: store.slug,
      status: "active",
      title: store.name,
      visibility: publication?.visibility ?? "public",
      whatsappNumber: store.whatsapp_number || null
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
