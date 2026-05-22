import { createClient } from "@/lib/supabase/server";
import { resolveStoreByHostname } from "@/lib/domains/utils";

export type PublicStorefrontProduct = {
  description: string | null;
  id: string;
  price: number | string | null;
  priceLabel: string | null;
  sku: string | null;
  status: string | null;
  title: string;
};

export type PublicStorefrontPreview = {
  branding: {
    primaryColor: string;
    secondaryColor: string;
    themeMode: string;
  };
  products: PublicStorefrontProduct[];
  store: {
    description: string | null;
    id: string;
    slug: string;
    status: string;
    title: string;
    visibility: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
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
    description: textValue(value.description) || null,
    id,
    price: typeof value.price === "number" || typeof value.price === "string" ? value.price : null,
    priceLabel: textValue(value.priceLabel) || null,
    sku: textValue(value.sku) || null,
    status: textValue(value.status) || null,
    title
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
    products: Array.isArray(value.products)
      ? value.products.map(normalizeProduct).filter((product): product is PublicStorefrontProduct => Boolean(product))
      : [],
    store: {
      description: textValue(store.description) || null,
      id,
      slug,
      status: textValue(store.status, "active"),
      title,
      visibility: textValue(store.visibility, "public")
    }
  };
}

export async function getPublicStorefrontPreview(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_storefront_preview" as never, {
    store_slug: slug
  } as never);

  if (error) {
    console.error("[storefront-preview] public preview load failed", {
      code: error.code,
      message: error.message,
      slug
    });
    return null;
  }

  return normalizePreview(data);
}

export async function getPublicStorefrontPreviewByHostname(hostname: string) {
  const slug = await resolveStoreByHostname(hostname);

  if (!slug) {
    return null;
  }

  return getPublicStorefrontPreview(slug);
}
