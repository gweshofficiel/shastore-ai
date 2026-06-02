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

export type StorefrontStandardNavigationKey =
  | "products"
  | "categories"
  | "about"
  | "blog"
  | "faq"
  | "contact"
  | "account"
  | "wishlist"
  | "cart";

export type StorefrontStandardNavigationItem = {
  enabled: boolean;
  href: string;
  key: StorefrontStandardNavigationKey;
  label: string;
  sortOrder: number;
};

export type StorefrontResolvedNavigation = {
  accountEnabled: boolean;
  cartEnabled: boolean;
  links: StorefrontStandardNavigationItem[];
  wishlistEnabled: boolean;
};

export type PublicStoreNavigation = {
  footer: PublicStoreNavigationLink[];
  header: PublicStoreNavigationLink[];
};

export const storefrontStandardNavigationOptions: Array<{
  defaultEnabled: boolean;
  defaultSortOrder: number;
  key: StorefrontStandardNavigationKey;
  label: string;
}> = [
  { defaultEnabled: true, defaultSortOrder: 10, key: "products", label: "Products" },
  { defaultEnabled: true, defaultSortOrder: 20, key: "categories", label: "Categories" },
  { defaultEnabled: true, defaultSortOrder: 30, key: "about", label: "About Us" },
  { defaultEnabled: true, defaultSortOrder: 40, key: "blog", label: "Blog" },
  { defaultEnabled: true, defaultSortOrder: 50, key: "faq", label: "FAQ" },
  { defaultEnabled: true, defaultSortOrder: 60, key: "contact", label: "Contact" },
  { defaultEnabled: true, defaultSortOrder: 70, key: "account", label: "Account" },
  { defaultEnabled: true, defaultSortOrder: 80, key: "wishlist", label: "Wishlist" },
  { defaultEnabled: true, defaultSortOrder: 90, key: "cart", label: "Cart" }
];

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

export async function getStoreNavigationRows(client: SupabaseClient, storeId: string) {
  const { data, error } = await client
    .from("store_navigation_links" as never)
    .select("id, label, location, link_type, page_id, category_id, product_id, custom_url, sort_order, is_enabled")
    .eq("store_id", storeId)
    .order("sort_order" as never, { ascending: true } as never)
    .order("created_at" as never, { ascending: true } as never);

  if (error) {
    console.warn("[storefront-navigation] all navigation links failed", {
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

export function standardNavigationHref(
  key: StorefrontStandardNavigationKey,
  storeSlug: string
) {
  const hrefs: Record<StorefrontStandardNavigationKey, string> = {
    about: `/store/${storeSlug}/about`,
    account: `/store/${storeSlug}/account`,
    blog: `/store/${storeSlug}/blog`,
    cart: `/store/${storeSlug}/cart`,
    categories: "#categories",
    contact: `/store/${storeSlug}/contact`,
    faq: `/store/${storeSlug}/faq`,
    products: "#products",
    wishlist: `/store/${storeSlug}/wishlist`
  };

  return hrefs[key];
}

function standardNavigationKeyFromHref(
  href: string | null,
  storeSlug: string
): StorefrontStandardNavigationKey | null {
  if (!href) {
    return null;
  }

  const normalizedHref = href.trim().toLowerCase();

  for (const option of storefrontStandardNavigationOptions) {
    if (standardNavigationHref(option.key, storeSlug).toLowerCase() === normalizedHref) {
      return option.key;
    }
  }

  return null;
}

function visibleStandardNavigationKey({
  hasPublishedAbout,
  hasPublishedBlogArticles,
  hasPublishedFaqs,
  key
}: {
  hasPublishedAbout: boolean;
  hasPublishedBlogArticles: boolean;
  hasPublishedFaqs: boolean;
  key: StorefrontStandardNavigationKey;
}) {
  if (key === "about") {
    return hasPublishedAbout;
  }

  if (key === "blog") {
    return hasPublishedBlogArticles;
  }

  if (key === "faq") {
    return hasPublishedFaqs;
  }

  return true;
}

function uniqueResolvedLinks(links: StorefrontStandardNavigationItem[]) {
  const seenHrefs = new Set<string>();
  const seenLabels = new Set<string>();
  const unique: StorefrontStandardNavigationItem[] = [];

  for (const link of links) {
    const hrefKey = link.href.trim().toLowerCase();
    const labelKey = link.label.trim().toLowerCase();

    if (!hrefKey || !labelKey || seenHrefs.has(hrefKey) || seenLabels.has(labelKey)) {
      continue;
    }

    seenHrefs.add(hrefKey);
    seenLabels.add(labelKey);
    unique.push(link);
  }

  return unique;
}

export function resolveStorefrontHeaderNavigation({
  customLinks,
  hasPublishedAbout,
  hasPublishedBlogArticles,
  hasPublishedFaqs,
  rows,
  storeSlug
}: {
  customLinks: PublicStoreNavigationLink[];
  hasPublishedAbout: boolean;
  hasPublishedBlogArticles: boolean;
  hasPublishedFaqs: boolean;
  rows: StoreNavigationRow[];
  storeSlug: string;
}): StorefrontResolvedNavigation {
  const headerRows = rows.filter((row) => row.location === "header");
  const configuredStandard = new Map<StorefrontStandardNavigationKey, StoreNavigationRow>();

  for (const row of headerRows) {
    const key =
      row.link_type === "custom"
        ? standardNavigationKeyFromHref(row.custom_url, storeSlug)
        : null;

    if (key && !configuredStandard.has(key)) {
      configuredStandard.set(key, row);
    }
  }

  const standardLinks = storefrontStandardNavigationOptions
    .map<StorefrontStandardNavigationItem>((option) => {
      const row = configuredStandard.get(option.key);

      return {
        enabled: row ? row.is_enabled === true : option.defaultEnabled,
        href: standardNavigationHref(option.key, storeSlug),
        key: option.key,
        label: row?.label || option.label,
        sortOrder: row?.sort_order ?? option.defaultSortOrder
      };
    })
    .filter((link) => link.enabled)
    .filter((link) =>
      visibleStandardNavigationKey({
        hasPublishedAbout,
        hasPublishedBlogArticles,
        hasPublishedFaqs,
        key: link.key
      })
    );
  const customHeaderLinks = customLinks
    .filter((link) => !standardNavigationKeyFromHref(link.href, storeSlug))
    .map<StorefrontStandardNavigationItem>((link) => ({
      enabled: true,
      href: link.href,
      key: "products",
      label: link.label,
      sortOrder: link.sortOrder
    }));
  const links = uniqueResolvedLinks([...standardLinks, ...customHeaderLinks]).sort(
    (left, right) => left.sortOrder - right.sortOrder
  );

  return {
    accountEnabled: standardLinks.some((link) => link.key === "account"),
    cartEnabled: standardLinks.some((link) => link.key === "cart"),
    links: links.filter(
      (link) => link.key !== "account" && link.key !== "wishlist" && link.key !== "cart"
    ),
    wishlistEnabled: standardLinks.some((link) => link.key === "wishlist")
  };
}
