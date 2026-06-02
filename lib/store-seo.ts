import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicUrl } from "@/lib/deployment/config";

export type SeoFallbackRule = "existing_data" | "store_defaults" | "title_with_store";
export type GoogleVerificationStatus = "not_started" | "pending" | "verified" | "failed";

export type StoreSeoSettings = {
  blogFallbackRule: SeoFallbackRule;
  defaultMetaDescription: string;
  defaultMetaTitle: string;
  defaultOgImageUrl: string;
  googleConnectedPropertyUrl: string;
  googleVerificationMetaCode: string;
  googleVerificationStatus: GoogleVerificationStatus;
  homepageSeoDescription: string;
  homepageSeoTitle: string;
  productFallbackRule: SeoFallbackRule;
};

export const defaultStoreSeoSettings: StoreSeoSettings = {
  blogFallbackRule: "existing_data",
  defaultMetaDescription: "",
  defaultMetaTitle: "",
  defaultOgImageUrl: "",
  googleConnectedPropertyUrl: "",
  googleVerificationMetaCode: "",
  googleVerificationStatus: "not_started",
  homepageSeoDescription: "",
  homepageSeoTitle: "",
  productFallbackRule: "existing_data"
};

const fallbackRules = new Set<SeoFallbackRule>(["existing_data", "store_defaults", "title_with_store"]);
const googleVerificationStatuses = new Set<GoogleVerificationStatus>(["not_started", "pending", "verified", "failed"]);

export function cleanSeoText(value: unknown, maxLength = 320) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function cleanSeoUrl(value: unknown) {
  const text = cleanSeoText(value, 500);

  if (!text) {
    return "";
  }

  return text.startsWith("https://") || text.startsWith("http://") || text.startsWith("/") ? text : "";
}

export function cleanGoogleVerificationMetaCode(value: unknown) {
  const text = cleanSeoText(value, 1000);

  if (!text) {
    return "";
  }

  const contentMatch = text.match(/content=["']([^"']+)["']/i);

  return (contentMatch?.[1] ?? text)
    .replace(/^<meta\s+/i, "")
    .replace(/\/?>$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim()
    .slice(0, 500);
}

export function normalizeGoogleVerificationStatus(value: unknown): GoogleVerificationStatus {
  return googleVerificationStatuses.has(value as GoogleVerificationStatus)
    ? value as GoogleVerificationStatus
    : defaultStoreSeoSettings.googleVerificationStatus;
}

export function normalizeStoreSeoSettings(value: unknown): StoreSeoSettings {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const productFallbackRule = fallbackRules.has(input.productFallbackRule as SeoFallbackRule)
    ? input.productFallbackRule as SeoFallbackRule
    : defaultStoreSeoSettings.productFallbackRule;
  const blogFallbackRule = fallbackRules.has(input.blogFallbackRule as SeoFallbackRule)
    ? input.blogFallbackRule as SeoFallbackRule
    : defaultStoreSeoSettings.blogFallbackRule;

  return {
    blogFallbackRule,
    defaultMetaDescription: cleanSeoText(input.defaultMetaDescription),
    defaultMetaTitle: cleanSeoText(input.defaultMetaTitle, 180),
    defaultOgImageUrl: cleanSeoUrl(input.defaultOgImageUrl),
    googleConnectedPropertyUrl: cleanSeoUrl(input.googleConnectedPropertyUrl),
    googleVerificationMetaCode: cleanGoogleVerificationMetaCode(input.googleVerificationMetaCode),
    googleVerificationStatus: normalizeGoogleVerificationStatus(input.googleVerificationStatus),
    homepageSeoDescription: cleanSeoText(input.homepageSeoDescription),
    homepageSeoTitle: cleanSeoText(input.homepageSeoTitle, 180),
    productFallbackRule
  };
}

export async function loadStoreSeoSettings(supabase: SupabaseClient, storeId: string) {
  const { data } = await supabase
    .from("stores" as never)
    .select("seo_settings")
    .eq("id" as never, storeId as never)
    .maybeSingle();
  const row = data as { seo_settings?: unknown } | null;

  return normalizeStoreSeoSettings(row?.seo_settings);
}

export function absoluteSeoImageUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return getPublicUrl(value);
}

export function googleVerificationMetadata(settings: StoreSeoSettings): Metadata["verification"] | undefined {
  return settings.googleVerificationMetaCode
    ? { google: settings.googleVerificationMetaCode }
    : undefined;
}

export function homepageSeoMetadata({
  canonicalUrl,
  noindex,
  settings,
  storeDescription,
  storeKeywords,
  storeOgDescription,
  storeOgImageUrl,
  storeOgTitle,
  storeSeoDescription,
  storeSeoTitle,
  storeTitle
}: {
  canonicalUrl?: string | null;
  noindex?: boolean;
  settings: StoreSeoSettings;
  storeDescription?: string | null;
  storeKeywords?: string | null;
  storeOgDescription?: string | null;
  storeOgImageUrl?: string | null;
  storeOgTitle?: string | null;
  storeSeoDescription?: string | null;
  storeSeoTitle?: string | null;
  storeTitle: string;
}): Metadata {
  const title = settings.homepageSeoTitle || storeSeoTitle || settings.defaultMetaTitle || storeTitle;
  const description =
    settings.homepageSeoDescription ||
    storeSeoDescription ||
    settings.defaultMetaDescription ||
    storeDescription ||
    `Shop products from ${storeTitle}, powered by SHASTORE AI.`;
  const ogTitle = storeOgTitle || title;
  const ogDescription = storeOgDescription || description;
  const ogImage = absoluteSeoImageUrl(storeOgImageUrl || settings.defaultOgImageUrl);

  return {
    alternates: canonicalUrl ? { canonical: canonicalUrl } : undefined,
    description,
    keywords: storeKeywords || undefined,
    openGraph: {
      description: ogDescription,
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: storeTitle,
      title: ogTitle,
      type: "website"
    },
    robots: { follow: !noindex, index: !noindex },
    title,
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      description: ogDescription,
      images: ogImage ? [ogImage] : undefined,
      title: ogTitle
    },
    verification: googleVerificationMetadata(settings)
  };
}

export function productSeoDescription({
  description,
  productTitle,
  rule,
  settings,
  storeTitle
}: {
  description?: string | null;
  productTitle: string;
  rule: SeoFallbackRule;
  settings: StoreSeoSettings;
  storeTitle: string;
}) {
  if (description) {
    return description;
  }

  if (rule === "store_defaults" && settings.defaultMetaDescription) {
    return settings.defaultMetaDescription;
  }

  return `Order ${productTitle} from ${storeTitle}, powered by SHASTORE AI.`;
}

export function contentSeoTitle({
  explicitTitle,
  rule,
  settings,
  storeTitle,
  title
}: {
  explicitTitle?: string | null;
  rule: SeoFallbackRule;
  settings: StoreSeoSettings;
  storeTitle: string;
  title: string;
}) {
  if (explicitTitle) {
    return explicitTitle;
  }

  if (rule === "store_defaults" && settings.defaultMetaTitle) {
    return settings.defaultMetaTitle;
  }

  return rule === "title_with_store" ? `${title} | ${storeTitle}` : title;
}
