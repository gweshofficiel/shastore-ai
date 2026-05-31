import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PublicStorefrontCategory,
  PublicStorefrontPageLink,
  PublicStorefrontProduct
} from "@/lib/public-storefront-preview";

export type StoreNavigationLocation = "footer" | "header";
export type StoreNavigationLinkType = "category" | "custom" | "home" | "page" | "product";

export type StoreNavigationRow = {
  category_id: string | null;
  custom_url: string | null;
  id: string;
  is_enabled: boolean;
  label: string;
  link_type: StoreNavigationLinkType;
  location: StoreNavigationLocation;
  page_id: string | null;
  product_id: string | null;
  sort_order: number;
};

export type PublicStoreNavigationLink = {
  href: string;
  id: string;
  label: string;
  linkType: StoreNavigationLinkType;
  location: StoreNavigationLocation;
  sortOrder: number;
};

export type PublicStoreNavigation = {
  footer: PublicStoreNavigationLink[];
  header: PublicStoreNavigationLink[];
};

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeNavigationRow(value: unknown): StoreNavigationRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = textValue(row.id);
  const label = textValue(row.label);
  const location = textValue(row.location) as StoreNavigationLocation;
  const linkType = textValue(row.link_type) as StoreNavigationLinkType;

  if (
    !id ||
    !label ||
    (location !== "header" && location !== "footer") ||
    !["category", "custom", "home", "page", "product"].includes(linkType)
  ) {
    return null;
  }

  return {
    category_id: textValue(row.category_id) || null,
    custom_url: textValue(row.custom_url) || null,
    id,
    is_enabled: row.is_enabled !== false,
    label,
    link_type: linkType,
    location,
    page_id: textValue(row.page_id) || null,
    product_id: textValue(row.product_id) || null,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : Number(row.sort_order ?? 0) || 0
  };
}

export async function getEnabledStoreNavigationRows(client: SupabaseClient, storeId: string) {
  const { data, error } = await client
    .from("store_navigation_links" as never)
    .select("id, label, location, link_type, page_id, category_id, product_id, custom_url, sort_order, is_enabled")
    .eq("store_id", storeId)
    .eq("is_enabled", true)
    .order("sort_order" as never, { ascending: true } as never)
    .order("created_at" as never, { ascending: true } as never);

  if (error) {
    console.warn("[storefront-navigation] navigation links failed", {
      code: error.code,
      message: error.message,
      storeId
    });
    return [];
  }

  return ((data ?? []) as unknown[])
    .map(normalizeNavigationRow)
    .filter((row): row is StoreNavigationRow => Boolean(row));
}

function safeCustomHref(value: string | null) {
  if (!value) {
    return null;
  }

  const url = value.trim();

  if (
    url.startsWith("/") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:")
  ) {
    return url;
  }

  return null;
}

export function resolveNavigationHref({
  categories,
  pages,
  products,
  row,
  storeSlug
}: {
  categories: PublicStorefrontCategory[];
  pages: PublicStorefrontPageLink[];
  products: PublicStorefrontProduct[];
  row: StoreNavigationRow;
  storeSlug: string;
}) {
  if (row.link_type === "home") {
    return `/store/${storeSlug}`;
  }

  if (row.link_type === "custom") {
    return safeCustomHref(row.custom_url);
  }

  if (row.link_type === "page" && row.page_id) {
    const page = pages.find((item) => item.id === row.page_id);
    return page ? `/store/${storeSlug}/pages/${page.slug}` : null;
  }

  if (row.link_type === "category" && row.category_id) {
    const category = categories.find((item) => item.id === row.category_id);
    return category ? `/store/${storeSlug}/category/${encodeURIComponent(category.slug || category.id)}` : null;
  }

  if (row.link_type === "product" && row.product_id) {
    const product = products.find((item) => item.id === row.product_id);
    return product ? `/store/${storeSlug}/product/${encodeURIComponent(product.slug || product.id)}` : null;
  }

  return null;
}

export function buildPublicStoreNavigation({
  categories,
  pages,
  products,
  rows,
  storeSlug
}: {
  categories: PublicStorefrontCategory[];
  pages: PublicStorefrontPageLink[];
  products: PublicStorefrontProduct[];
  rows: StoreNavigationRow[];
  storeSlug: string;
}): PublicStoreNavigation {
  const navigation: PublicStoreNavigation = { footer: [], header: [] };

  for (const row of rows) {
    const href = resolveNavigationHref({ categories, pages, products, row, storeSlug });

    if (!href) {
      continue;
    }

    navigation[row.location].push({
      href,
      id: row.id,
      label: row.label,
      linkType: row.link_type,
      location: row.location,
      sortOrder: row.sort_order
    });
  }

  return navigation;
}
