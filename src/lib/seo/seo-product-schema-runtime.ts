import "server-only";

import { getAppBaseUrl } from "@/lib/deployment/config";
import { isRobotsAllowedRoute, normalizeRobotsRoute } from "@/src/lib/seo/seo-robots-runtime";
import { listSitemapEntries } from "@/src/lib/seo/seo-sitemap-runtime";

export type ProductSchemaRuntimeStatus = "placeholder" | "ready";

export type ProductSchemaOffer = {
  "@type": "Offer";
  availability: string;
  url: string;
};

export type ProductSchema = {
  "@context": "https://schema.org";
  "@type": "Product";
  description: string;
  name: string;
  offers: ProductSchemaOffer;
};

export type ProductSchemaValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_PRODUCT_SCHEMA_PLACEHOLDER_NAME = "Product schema runtime placeholder" as const;
export const SEO_PRODUCT_SCHEMA_PLACEHOLDER_DESCRIPTION =
  "Safe placeholder only. Public product JSON-LD integration is reserved for a later phase." as const;
export const SEO_PRODUCT_MAX_FIELD_LENGTH = 500 as const;

const BLOCKED_PRODUCT_PREFIXES = ["/admin", "/api", "/dashboard"] as const;

const BLOCKED_PRODUCT_SEGMENTS = [
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
  /\b(?:api[_-]?key|secret|token|password|billing|tenant|reseller|seller|buyer|sku|uuid)\b/i,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
] as const;

function text(value: unknown, maxLength: number = SEO_PRODUCT_MAX_FIELD_LENGTH) {
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

function isBlockedProductRoute(normalized: string) {
  if (/^(?:https?:|javascript:|data:)/i.test(normalized)) {
    return true;
  }

  if (
    BLOCKED_PRODUCT_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    )
  ) {
    return true;
  }

  const lower = normalized.toLowerCase();

  return BLOCKED_PRODUCT_SEGMENTS.some((segment) => lower.includes(segment));
}

function isProductAllowedRoute(route: unknown) {
  const normalized = normalizeRobotsRoute(route);

  if (!normalized || !isRobotsAllowedRoute(normalized)) {
    return false;
  }

  return !isBlockedProductRoute(normalized);
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
  const cleaned = text(value, SEO_PRODUCT_MAX_FIELD_LENGTH);

  if (!cleaned) {
    return false;
  }

  return !PRIVATE_FIELD_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function isSafePublicUrl(value: string) {
  const cleaned = text(value, SEO_PRODUCT_MAX_FIELD_LENGTH);

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

export function getProductSchemaPlaceholder(): ProductSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    description: SEO_PRODUCT_SCHEMA_PLACEHOLDER_DESCRIPTION,
    name: SEO_PRODUCT_SCHEMA_PLACEHOLDER_NAME,
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/PreOrder",
      url: siteBaseUrl()
    }
  };
}

export async function getProductSchemaByRoute(route: string): Promise<ProductSchema | null> {
  const normalizedRoute = normalizeRobotsRoute(route);

  if (!normalizedRoute || !isProductAllowedRoute(normalizedRoute)) {
    return null;
  }

  try {
    const sitemapEntries = await listSitemapEntries();
    const isPlatformRoute = sitemapEntries.some((entry) => entry.route === normalizedRoute);
    const isPublicProductRoute = /\/store\/[^/]+\/product\/[^/]+/i.test(normalizedRoute);

    if (!isPlatformRoute && !isPublicProductRoute) {
      return null;
    }

    return getProductSchemaPlaceholder();
  } catch (error) {
    console.error("[seo-product-schema-runtime] product route resolve failed", error);
    return null;
  }
}

function validateOffer(offer: unknown, issues: string[]) {
  if (!offer || typeof offer !== "object" || Array.isArray(offer)) {
    issues.push("Product schema offers must be an Offer object.");
    return;
  }

  const record = offer as Record<string, unknown>;

  if (record["@type"] !== "Offer") {
    issues.push("Product schema offers @type must be Offer.");
  }

  const availability = text(record.availability, SEO_PRODUCT_MAX_FIELD_LENGTH);
  if (!availability.startsWith("https://schema.org/")) {
    issues.push("Product schema offers availability must use a schema.org URL.");
  }

  const url = text(record.url, SEO_PRODUCT_MAX_FIELD_LENGTH);
  if (!isSafePublicUrl(url)) {
    issues.push("Product schema offers url must be a safe public platform URL.");
  }

  if ("price" in record || "priceCurrency" in record || "seller" in record || "sku" in record) {
    issues.push("Product schema placeholder must not include private commerce fields in this phase.");
  }
}

export function validateProductSchema(schema: unknown): ProductSchemaValidation {
  const issues: string[] = [];

  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return {
      isValid: false,
      issues: ["Product schema must be a JSON-LD object."]
    };
  }

  const record = schema as Record<string, unknown>;

  if (record["@context"] !== "https://schema.org") {
    issues.push("Product schema @context must be https://schema.org.");
  }

  if (record["@type"] !== "Product") {
    issues.push("Product schema @type must be Product.");
  }

  const name = text(record.name, SEO_PRODUCT_MAX_FIELD_LENGTH);
  if (!isSafePublicText(name)) {
    issues.push("Product schema name must be a safe public label.");
  }

  const description = text(record.description, SEO_PRODUCT_MAX_FIELD_LENGTH);
  if (!isSafePublicText(description)) {
    issues.push("Product schema description must be a safe public summary.");
  }

  validateOffer(record.offers, issues);

  if (containsPrivateData(record)) {
    issues.push("Product schema must not include private seller, buyer, billing, or internal identifiers.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function getProductSchemaRuntimeStatus(): ProductSchemaRuntimeStatus {
  const validation = validateProductSchema(getProductSchemaPlaceholder());

  if (!validation.isValid) {
    return "placeholder";
  }

  return "placeholder";
}

export function mapProductSchemaRuntimeToAdminFields() {
  const status = getProductSchemaRuntimeStatus();
  const validation = validateProductSchema(getProductSchemaPlaceholder());

  return {
    name: "Product schema placeholder",
    note: validation.isValid
      ? "Product schema runtime exists. Real product JSON-LD requires public product runtime integration in a later safe phase."
      : "Product schema runtime validation requires safe placeholder defaults.",
    status
  };
}

// SEO-16+ placeholders: public product runtime integration stays disconnected.
export const SEO_PRODUCT_SCHEMA_FUTURE_HOOKS = ["seo_product_public_runtime_integration"] as const;
