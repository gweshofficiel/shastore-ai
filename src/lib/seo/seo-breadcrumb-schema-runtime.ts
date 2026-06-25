import "server-only";

import { getAppBaseUrl } from "@/lib/deployment/config";
import { resolveCanonicalFromPage } from "@/src/lib/seo/seo-canonical-runtime";
import {
  normalizeSeoPageRoute,
  resolveSeoPageByRoute,
  resolveSeoPageBySlug,
  SEO_PAGE_RUNTIME_FALLBACK_ID,
  type SeoPageRuntime
} from "@/src/lib/seo/seo-page-runtime";
import { isRobotsAllowedRoute, normalizeRobotsRoute } from "@/src/lib/seo/seo-robots-runtime";
import { listSitemapEntries } from "@/src/lib/seo/seo-sitemap-runtime";

export type BreadcrumbSchemaRuntimeStatus = "placeholder" | "ready";

export type BreadcrumbListItem = {
  "@type": "ListItem";
  item: string;
  name: string;
  position: number;
};

export type BreadcrumbSchema = {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: BreadcrumbListItem[];
};

export type BreadcrumbSchemaValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_BREADCRUMB_HOME_NAME = "Home" as const;
export const SEO_BREADCRUMB_MAX_FIELD_LENGTH = 240 as const;
export const SEO_BREADCRUMB_MAX_ITEMS = 8 as const;

const BLOCKED_BREADCRUMB_PREFIXES = ["/admin", "/api", "/dashboard"] as const;

const BLOCKED_BREADCRUMB_SEGMENTS = [
  "/account",
  "/cart",
  "/checkout",
  "/compare",
  "/order/",
  "/receipt/",
  "/track",
  "/wishlist"
] as const;

const BLOCKED_URL_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /mailto:/i,
  /tel:/i,
  /supabase/i,
  /\/admin(?:\/|$)/i,
  /\/api(?:\/|$)/i,
  /\/dashboard(?:\/|$)/i
] as const;

const PRIVATE_FIELD_PATTERNS = [
  /@/,
  /\b(?:api[_-]?key|secret|token|password|billing|tenant|reseller)\b/i,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/
] as const;

function text(value: unknown, maxLength: number = SEO_BREADCRUMB_MAX_FIELD_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function siteBaseUrl() {
  return getAppBaseUrl().replace(/\/+$/, "");
}

function absoluteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteBaseUrl()}${normalizedPath}`;
}

function isBlockedBreadcrumbRoute(normalized: string) {
  if (/^(?:https?:|javascript:|data:)/i.test(normalized)) {
    return true;
  }

  if (
    BLOCKED_BREADCRUMB_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    )
  ) {
    return true;
  }

  const lower = normalized.toLowerCase();

  return BLOCKED_BREADCRUMB_SEGMENTS.some((segment) => lower.includes(segment));
}

export function isBreadcrumbAllowedRoute(route: unknown) {
  const normalized = normalizeRobotsRoute(route);

  if (!normalized || !isRobotsAllowedRoute(normalized)) {
    return false;
  }

  return !isBlockedBreadcrumbRoute(normalized);
}

function isSafePublicUrl(value: string) {
  const cleaned = text(value, SEO_BREADCRUMB_MAX_FIELD_LENGTH);

  if (!cleaned) {
    return false;
  }

  if (BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return false;
  }

  if (PRIVATE_FIELD_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return false;
  }

  if (cleaned.startsWith("/")) {
    return !cleaned.includes("..");
  }

  return /^https?:\/\//i.test(cleaned);
}

function isSafePublicText(value: string) {
  const cleaned = text(value, SEO_BREADCRUMB_MAX_FIELD_LENGTH);

  if (!cleaned) {
    return false;
  }

  return !PRIVATE_FIELD_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function buildHomeListItem(): BreadcrumbListItem {
  return {
    "@type": "ListItem",
    item: absoluteUrl("/"),
    name: SEO_BREADCRUMB_HOME_NAME,
    position: 1
  };
}

export function buildBreadcrumbSchemaFromSeoPage(page: SeoPageRuntime): BreadcrumbSchema | null {
  const route = normalizeRobotsRoute(normalizeSeoPageRoute(page.route));

  if (!route || page.id === SEO_PAGE_RUNTIME_FALLBACK_ID || !isBreadcrumbAllowedRoute(route)) {
    return null;
  }

  const canonical = resolveCanonicalFromPage(page);
  const safeRoute = normalizeRobotsRoute(canonical.canonicalPath) || route;
  const pageName = text(page.label, SEO_BREADCRUMB_MAX_FIELD_LENGTH) || SEO_BREADCRUMB_HOME_NAME;
  const itemListElement: BreadcrumbListItem[] = [buildHomeListItem()];

  if (safeRoute !== "/") {
    itemListElement.push({
      "@type": "ListItem",
      item: absoluteUrl(safeRoute),
      name: pageName,
      position: 2
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: itemListElement.slice(0, SEO_BREADCRUMB_MAX_ITEMS)
  };
}

function buildSampleBreadcrumbSchema(label: string, route: string): BreadcrumbSchema | null {
  return buildBreadcrumbSchemaFromSeoPage({
    canonicalPath: route,
    canonicalStatus: "ready",
    id: "seo:breadcrumb-sample",
    label,
    language: "en",
    languageReady: true,
    languageStatus: "ready",
    lastUpdated: null,
    metaDescription: "",
    metaDescriptionStatus: "ready",
    metaTitle: label,
    metaTitleStatus: "ready",
    openGraphEnabled: true,
    openGraphExplicitlyDisabled: false,
    openGraphImagePath: "",
    openGraphStatus: "ready",
    reviewed: false,
    route,
    runtimeReady: true,
    safeSummary: "Breadcrumb schema sample page.",
    slug: "sample",
    source: "seo_registry_runtime"
  });
}

export async function getBreadcrumbSchemaByRoute(route: string): Promise<BreadcrumbSchema | null> {
  const normalizedRoute = normalizeRobotsRoute(route);

  if (!normalizedRoute || !isBreadcrumbAllowedRoute(normalizedRoute)) {
    return null;
  }

  try {
    const sitemapEntries = await listSitemapEntries();
    const isPlatformRoute = sitemapEntries.some((entry) => entry.route === normalizedRoute);

    if (!isPlatformRoute) {
      return null;
    }

    const page = await resolveSeoPageByRoute(normalizedRoute);

    if (page.id === SEO_PAGE_RUNTIME_FALLBACK_ID) {
      return null;
    }

    return buildBreadcrumbSchemaFromSeoPage(page);
  } catch (error) {
    console.error("[seo-breadcrumb-schema-runtime] breadcrumb route resolve failed", error);
    return null;
  }
}

export async function getBreadcrumbSchemaBySlug(slug: string): Promise<BreadcrumbSchema | null> {
  try {
    const page = await resolveSeoPageBySlug(slug);
    const route = normalizeRobotsRoute(normalizeSeoPageRoute(page.route));

    if (!route || page.id === SEO_PAGE_RUNTIME_FALLBACK_ID || !isBreadcrumbAllowedRoute(route)) {
      return null;
    }

    const sitemapEntries = await listSitemapEntries();
    const isPlatformRoute = sitemapEntries.some((entry) => entry.route === route);

    if (!isPlatformRoute) {
      return null;
    }

    return buildBreadcrumbSchemaFromSeoPage(page);
  } catch (error) {
    console.error("[seo-breadcrumb-schema-runtime] breadcrumb slug resolve failed", error);
    return null;
  }
}

function validateListItem(item: unknown, index: number, issues: string[]) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    issues.push(`Breadcrumb schema itemListElement[${index}] must be a ListItem object.`);
    return;
  }

  const record = item as Record<string, unknown>;

  if (record["@type"] !== "ListItem") {
    issues.push(`Breadcrumb schema itemListElement[${index}] @type must be ListItem.`);
  }

  const position = typeof record.position === "number" ? record.position : Number(record.position);
  if (!Number.isInteger(position) || position < 1 || position > SEO_BREADCRUMB_MAX_ITEMS) {
    issues.push(`Breadcrumb schema itemListElement[${index}] position must be a safe positive integer.`);
  }

  const name = text(record.name, SEO_BREADCRUMB_MAX_FIELD_LENGTH);
  if (!isSafePublicText(name)) {
    issues.push(`Breadcrumb schema itemListElement[${index}] name must be a safe public label.`);
  }

  const itemUrl = text(record.item, SEO_BREADCRUMB_MAX_FIELD_LENGTH);
  if (!isSafePublicUrl(itemUrl)) {
    issues.push(`Breadcrumb schema itemListElement[${index}] item must be a safe public URL.`);
  }
}

export function validateBreadcrumbSchema(schema: unknown): BreadcrumbSchemaValidation {
  const issues: string[] = [];

  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return {
      isValid: false,
      issues: ["Breadcrumb schema must be a JSON-LD object."]
    };
  }

  const record = schema as Record<string, unknown>;

  if (record["@context"] !== "https://schema.org") {
    issues.push("Breadcrumb schema @context must be https://schema.org.");
  }

  if (record["@type"] !== "BreadcrumbList") {
    issues.push("Breadcrumb schema @type must be BreadcrumbList.");
  }

  if (!Array.isArray(record.itemListElement) || !record.itemListElement.length) {
    issues.push("Breadcrumb schema itemListElement must contain at least one ListItem.");
  } else {
    const items = record.itemListElement.slice(0, SEO_BREADCRUMB_MAX_ITEMS);

    if (record.itemListElement.length > SEO_BREADCRUMB_MAX_ITEMS) {
      issues.push("Breadcrumb schema itemListElement exceeds the safe public item limit.");
    }

    items.forEach((item, index) => validateListItem(item, index, issues));

    const firstItem = items[0] as Record<string, unknown> | undefined;
    const firstName = text(firstItem?.name, SEO_BREADCRUMB_MAX_FIELD_LENGTH);

    if (firstName !== SEO_BREADCRUMB_HOME_NAME) {
      issues.push("Breadcrumb schema must include Home as the first breadcrumb item.");
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function getBreadcrumbSchemaRuntimeStatus(): BreadcrumbSchemaRuntimeStatus {
  const homeSchema = buildSampleBreadcrumbSchema("Homepage", "/");
  const pricingSchema = buildSampleBreadcrumbSchema("Pricing Page", "/pricing");

  if (!homeSchema || !pricingSchema) {
    return "placeholder";
  }

  const homeValidation = validateBreadcrumbSchema(homeSchema);
  const pricingValidation = validateBreadcrumbSchema(pricingSchema);

  return homeValidation.isValid && pricingValidation.isValid ? "ready" : "placeholder";
}

export function mapBreadcrumbSchemaRuntimeToAdminFields() {
  const status = getBreadcrumbSchemaRuntimeStatus();

  return {
    name: "Breadcrumb schema",
    note:
      status === "ready"
        ? "Platform breadcrumb JSON-LD is validated for public SEO routes with Home as the first item."
        : "Breadcrumb schema validation requires safe platform route defaults.",
    status
  };
}

// SEO-14+ placeholders: store breadcrumb merging and dynamic trail expansion stay disconnected.
export const SEO_BREADCRUMB_SCHEMA_FUTURE_HOOKS = [
  "seo_breadcrumb_store_merge",
  "seo_breadcrumb_dynamic_trail"
] as const;
