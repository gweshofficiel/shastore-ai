import type { PublicStorefrontPageLink } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreFooterLinkKey =
  | "products"
  | "categories"
  | "faq"
  | "contact"
  | "blog"
  | "privacy"
  | "terms"
  | "refund"
  | "shipping";

export type StoreFooterLinkSettings = Record<StoreFooterLinkKey, boolean>;

export const defaultStoreFooterLinkSettings: StoreFooterLinkSettings = {
  blog: true,
  categories: true,
  contact: true,
  faq: true,
  privacy: true,
  products: true,
  refund: true,
  shipping: false,
  terms: true
};

export const storeFooterLinkOptions: Array<{ key: StoreFooterLinkKey; label: string }> = [
  { key: "products", label: "Products" },
  { key: "categories", label: "Categories" },
  { key: "faq", label: "FAQ" },
  { key: "contact", label: "Contact" },
  { key: "blog", label: "Blog" },
  { key: "privacy", label: "Privacy Policy" },
  { key: "terms", label: "Terms" },
  { key: "refund", label: "Refund Policy" },
  { key: "shipping", label: "Shipping Policy" }
];

type FooterLink = {
  href: string;
  id: string;
  label: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeStoreFooterLinkSettings(value: unknown): StoreFooterLinkSettings {
  if (!isRecord(value)) {
    return defaultStoreFooterLinkSettings;
  }

  return storeFooterLinkOptions.reduce<StoreFooterLinkSettings>(
    (settings, option) => ({
      ...settings,
      [option.key]: typeof value[option.key] === "boolean" ? value[option.key] : settings[option.key]
    }),
    { ...defaultStoreFooterLinkSettings }
  );
}

function findPublishedPage(pages: PublicStorefrontPageLink[], candidates: string[]) {
  const normalized = candidates.map((candidate) => candidate.toLowerCase());

  return pages.find((page) => {
    const pageType = page.pageType?.toLowerCase();
    const slug = page.slug.toLowerCase();
    return normalized.includes(pageType || "") || normalized.includes(slug);
  });
}

function uniqueFooterLinks(links: FooterLink[]) {
  const seenHrefs = new Set<string>();
  const seenLabels = new Set<string>();
  const unique: FooterLink[] = [];

  for (const link of links) {
    const href = link.href.trim();
    const label = link.label.trim();
    const hrefKey = href.toLowerCase();
    const labelKey = label.toLowerCase();

    if (!href || !label || seenHrefs.has(hrefKey) || seenLabels.has(labelKey)) {
      continue;
    }

    seenHrefs.add(hrefKey);
    seenLabels.add(labelKey);
    unique.push({ href, id: link.id, label });
  }

  return unique;
}

export function buildManagedFooterLinks({
  hasPublishedBlogArticles,
  hasPublishedFaqs,
  pages,
  settings,
  storeSlug
}: {
  hasPublishedBlogArticles: boolean;
  hasPublishedFaqs: boolean;
  pages: PublicStorefrontPageLink[];
  settings: StoreFooterLinkSettings;
  storeSlug: string;
}) {
  const privacyPage = findPublishedPage(pages, ["privacy", "privacy-policy"]);
  const termsPage = findPublishedPage(pages, ["terms", "terms-of-service", "terms-conditions"]);
  const refundPage = findPublishedPage(pages, ["refund", "returns", "returns-policy", "refund-policy"]);
  const shippingPage = findPublishedPage(pages, ["shipping", "shipping-policy"]);
  const links: FooterLink[] = [];

  if (settings.products) {
    links.push({ href: `/store/${storeSlug}#products`, id: "products", label: "Products" });
  }

  if (settings.categories) {
    links.push({ href: `/store/${storeSlug}#categories`, id: "categories", label: "Categories" });
  }

  if (settings.faq && hasPublishedFaqs) {
    links.push({ href: `/store/${storeSlug}/faq`, id: "faq", label: "FAQ" });
  }

  if (settings.contact) {
    links.push({ href: `/store/${storeSlug}/contact`, id: "contact", label: "Contact" });
  }

  if (settings.blog && hasPublishedBlogArticles) {
    links.push({ href: `/store/${storeSlug}/blog`, id: "blog", label: "Blog" });
  }

  if (settings.privacy) {
    links.push({
      href: privacyPage ? `/store/${storeSlug}/pages/${privacyPage.slug}` : `/store/${storeSlug}/privacy`,
      id: "privacy",
      label: "Privacy Policy"
    });
  }

  if (settings.terms) {
    links.push({
      href: termsPage ? `/store/${storeSlug}/pages/${termsPage.slug}` : `/store/${storeSlug}/terms`,
      id: "terms",
      label: "Terms"
    });
  }

  if (settings.refund) {
    links.push({
      href: refundPage ? `/store/${storeSlug}/pages/${refundPage.slug}` : `/store/${storeSlug}/refund`,
      id: "refund",
      label: "Refund Policy"
    });
  }

  if (settings.shipping && shippingPage) {
    links.push({
      href: `/store/${storeSlug}/pages/${shippingPage.slug}`,
      id: "shipping",
      label: "Shipping Policy"
    });
  }

  return uniqueFooterLinks(links);
}

export async function loadStoreFooterLinkSettings(storeId: string) {
  const admin = createAdminClient();

  if (!admin) {
    return defaultStoreFooterLinkSettings;
  }

  const { data } = await admin
    .from("stores" as never)
    .select("footer_link_settings")
    .eq("id" as never, storeId as never)
    .maybeSingle();
  const store = data as { footer_link_settings?: unknown } | null;

  return normalizeStoreFooterLinkSettings(store?.footer_link_settings);
}
