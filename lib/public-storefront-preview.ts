import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStorefrontContextFromHostname } from "@/lib/storefront-hostname-context";

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

async function loadStoreModePublicPreview(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    return null;
  }

  const client = createAdminClient() ?? (await createClient());
  const { data: rawStore, error: storeError } = await client
    .from("stores")
    .select("id, name, description, brand_color, status, slug")
    .eq("slug", normalizedSlug)
    .eq("status", "published")
    .maybeSingle();
  const store = rawStore as {
    brand_color: string;
    description: string | null;
    id: string;
    name: string;
    slug: string | null;
    status: string;
  } | null;

  if (storeError || !store?.slug) {
    return null;
  }

  const { data: rawPublication } = await client
    .from("published_stores")
    .select("status, visibility")
    .eq("store_id", store.id)
    .maybeSingle();
  const publication = rawPublication as { status: string; visibility: string } | null;

  if (publication) {
    if (publication.status !== "published" || publication.visibility !== "public") {
      return null;
    }
  }

  const { data: products } = await client
    .from("store_products")
    .select("id, name, description, price")
    .eq("store_id", store.id)
    .order("sort_order", { ascending: true });

  return normalizePreview({
    branding: {
      primaryColor: store.brand_color || "#0f172a",
      secondaryColor: "#2563eb",
      themeMode: "light"
    },
    products: (products ?? []).map((product) => ({
      id: product.id,
      title: product.name,
      description: product.description,
      price: product.price,
      priceLabel: product.price,
      sku: null,
      status: "published"
    })),
    store: {
      description: store.description,
      id: store.id,
      slug: store.slug,
      status: "active",
      title: store.name,
      visibility: publication?.visibility ?? "public"
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
