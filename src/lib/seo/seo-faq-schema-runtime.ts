import "server-only";

import { getAppBaseUrl } from "@/lib/deployment/config";
import { isRobotsAllowedRoute, normalizeRobotsRoute } from "@/src/lib/seo/seo-robots-runtime";
import { listSitemapEntries } from "@/src/lib/seo/seo-sitemap-runtime";

export type FaqSchemaRuntimeStatus = "placeholder" | "ready";

export type FaqSchema = {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  description: string;
  mainEntity: [];
  name: string;
  url: string;
};

export type FaqSchemaValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_FAQ_SCHEMA_PLACEHOLDER_NAME = "FAQ schema runtime placeholder" as const;
export const SEO_FAQ_SCHEMA_PLACEHOLDER_DESCRIPTION =
  "Safe placeholder only. Public FAQ JSON-LD integration is reserved for a later phase." as const;
export const SEO_FAQ_MAX_FIELD_LENGTH = 500 as const;

const BLOCKED_FAQ_PREFIXES = ["/admin", "/api", "/dashboard"] as const;

const BLOCKED_FAQ_SEGMENTS = [
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
  /stripe/i,
  /nowpayments/i,
  /\/admin(?:\/|$)/i,
  /\/api(?:\/|$)/i,
  /\/dashboard(?:\/|$)/i
] as const;

const PRIVATE_FIELD_PATTERNS = [
  /@/,
  /\b(?:api[_-]?key|secret|token|password|billing|tenant|reseller|internal|private)\b/i,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
] as const;

function text(value: unknown, maxLength: number = SEO_FAQ_MAX_FIELD_LENGTH) {
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

function isBlockedFaqRoute(normalized: string) {
  if (/^(?:https?:|javascript:|data:)/i.test(normalized)) {
    return true;
  }

  if (
    BLOCKED_FAQ_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    )
  ) {
    return true;
  }

  const lower = normalized.toLowerCase();

  return BLOCKED_FAQ_SEGMENTS.some((segment) => lower.includes(segment));
}

function isFaqAllowedRoute(route: unknown) {
  const normalized = normalizeRobotsRoute(route);

  if (!normalized || !isRobotsAllowedRoute(normalized)) {
    return false;
  }

  return !isBlockedFaqRoute(normalized);
}

function containsPrivateData(value: unknown): boolean {
  if (typeof value === "string") {
    return PRIVATE_FIELD_PATTERNS.some((pattern) => pattern.test(value));
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsPrivateData(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => containsPrivateData(item));
  }

  return false;
}

function isSafePublicText(value: string) {
  const cleaned = text(value, SEO_FAQ_MAX_FIELD_LENGTH);

  if (!cleaned) {
    return false;
  }

  return !PRIVATE_FIELD_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function isSafePublicUrl(value: string) {
  const cleaned = text(value, SEO_FAQ_MAX_FIELD_LENGTH);

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

export function getFaqSchemaPlaceholder(): FaqSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    description: SEO_FAQ_SCHEMA_PLACEHOLDER_DESCRIPTION,
    mainEntity: [],
    name: SEO_FAQ_SCHEMA_PLACEHOLDER_NAME,
    url: siteBaseUrl()
  };
}

export async function getFaqSchemaByRoute(route: string): Promise<FaqSchema | null> {
  const normalizedRoute = normalizeRobotsRoute(route);

  if (!normalizedRoute || !isFaqAllowedRoute(normalizedRoute)) {
    return null;
  }

  try {
    const sitemapEntries = await listSitemapEntries();
    const isPlatformRoute = sitemapEntries.some((entry) => entry.route === normalizedRoute);
    const isPublicFaqRoute = /\/store\/[^/]+\/faq(?:\/|$)/i.test(normalizedRoute);

    if (!isPlatformRoute && !isPublicFaqRoute) {
      return null;
    }

    return getFaqSchemaPlaceholder();
  } catch (error) {
    console.error("[seo-faq-schema-runtime] faq route resolve failed", error);
    return null;
  }
}

function validateMainEntity(mainEntity: unknown, issues: string[]) {
  if (!Array.isArray(mainEntity)) {
    issues.push("FAQ schema mainEntity must be an array.");
    return;
  }

  if (mainEntity.length > 0) {
    issues.push("FAQ schema placeholder must keep mainEntity empty in this phase.");
  }
}

export function validateFaqSchema(schema: unknown): FaqSchemaValidation {
  const issues: string[] = [];

  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return {
      isValid: false,
      issues: ["FAQ schema must be a JSON-LD object."]
    };
  }

  const record = schema as Record<string, unknown>;

  if (record["@context"] !== "https://schema.org") {
    issues.push("FAQ schema @context must be https://schema.org.");
  }

  if (record["@type"] !== "FAQPage") {
    issues.push("FAQ schema @type must be FAQPage.");
  }

  const name = text(record.name, SEO_FAQ_MAX_FIELD_LENGTH);
  if (!isSafePublicText(name)) {
    issues.push("FAQ schema name must be a safe public label.");
  }

  const description = text(record.description, SEO_FAQ_MAX_FIELD_LENGTH);
  if (!isSafePublicText(description)) {
    issues.push("FAQ schema description must be a safe public summary.");
  }

  const url = text(record.url, SEO_FAQ_MAX_FIELD_LENGTH);
  if (!isSafePublicUrl(url)) {
    issues.push("FAQ schema url must be a safe public platform URL.");
  }

  validateMainEntity(record.mainEntity, issues);

  if (containsPrivateData(record)) {
    issues.push("FAQ schema must not include private tenant, billing, or internal content.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function getFaqSchemaRuntimeStatus(): FaqSchemaRuntimeStatus {
  const validation = validateFaqSchema(getFaqSchemaPlaceholder());

  if (!validation.isValid) {
    return "placeholder";
  }

  return "placeholder";
}

export function mapFaqSchemaRuntimeToAdminFields() {
  const status = getFaqSchemaRuntimeStatus();
  const validation = validateFaqSchema(getFaqSchemaPlaceholder());

  return {
    name: "FAQ schema placeholder",
    note: validation.isValid
      ? "FAQ schema runtime exists. Real FAQ JSON-LD requires public FAQ/content runtime integration in a later safe phase."
      : "FAQ schema runtime validation requires safe placeholder defaults.",
    status
  };
}

// SEO-16+ placeholders: public FAQ/content runtime integration stays disconnected.
export const SEO_FAQ_SCHEMA_FUTURE_HOOKS = ["seo_faq_public_runtime_integration"] as const;
