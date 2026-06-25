import "server-only";

import { getAppBaseUrl } from "@/lib/deployment/config";

export type OrganizationSchemaRuntimeStatus = "placeholder" | "ready";

export type OrganizationSchema = {
  "@context": "https://schema.org";
  "@type": "Organization";
  description: string;
  logo: string;
  name: string;
  sameAs: string[];
  url: string;
};

export type OrganizationSchemaValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_ORGANIZATION_DEFAULT_NAME = "SHASTORE AI" as const;
export const SEO_ORGANIZATION_DEFAULT_DESCRIPTION =
  "AI copy and template-based ecommerce landing pages for products." as const;
export const SEO_ORGANIZATION_DEFAULT_LOGO_PATH = "/brand/platform-logo.svg" as const;
export const SEO_ORGANIZATION_MAX_FIELD_LENGTH = 500 as const;
export const SEO_ORGANIZATION_MAX_SAME_AS_LINKS = 8 as const;

export const SEO_ORGANIZATION_DEFAULT_SAME_AS: readonly string[] = [] as const;

const BLOCKED_URL_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /mailto:/i,
  /tel:/i,
  /supabase/i
] as const;

const PRIVATE_FIELD_PATTERNS = [
  /@/,
  /\b(?:api[_-]?key|secret|token|password|billing|tenant|reseller)\b/i,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/
] as const;

function text(value: unknown, maxLength: number = SEO_ORGANIZATION_MAX_FIELD_LENGTH) {
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

function isSafePublicUrl(value: string, options?: { requireHttps?: boolean }) {
  const cleaned = text(value, SEO_ORGANIZATION_MAX_FIELD_LENGTH);

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

  if (options?.requireHttps) {
    return /^https:\/\//i.test(cleaned);
  }

  return /^https?:\/\//i.test(cleaned);
}

function isSafePublicText(value: string) {
  const cleaned = text(value, SEO_ORGANIZATION_MAX_FIELD_LENGTH);

  if (!cleaned) {
    return false;
  }

  return !PRIVATE_FIELD_PATTERNS.some((pattern) => pattern.test(cleaned));
}

export function getOrganizationSchema(): OrganizationSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    description: SEO_ORGANIZATION_DEFAULT_DESCRIPTION,
    logo: absoluteUrl(SEO_ORGANIZATION_DEFAULT_LOGO_PATH),
    name: SEO_ORGANIZATION_DEFAULT_NAME,
    sameAs: [...SEO_ORGANIZATION_DEFAULT_SAME_AS],
    url: siteBaseUrl()
  };
}

export function validateOrganizationSchema(schema: unknown): OrganizationSchemaValidation {
  const issues: string[] = [];

  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return {
      isValid: false,
      issues: ["Organization schema must be a JSON-LD object."]
    };
  }

  const record = schema as Record<string, unknown>;

  if (record["@context"] !== "https://schema.org") {
    issues.push("Organization schema @context must be https://schema.org.");
  }

  if (record["@type"] !== "Organization") {
    issues.push("Organization schema @type must be Organization.");
  }

  const name = text(record.name, SEO_ORGANIZATION_MAX_FIELD_LENGTH);
  if (!isSafePublicText(name)) {
    issues.push("Organization schema name must be a safe public platform label.");
  }

  const url = text(record.url, SEO_ORGANIZATION_MAX_FIELD_LENGTH);
  if (!isSafePublicUrl(url)) {
    issues.push("Organization schema url must be a safe public platform URL.");
  }

  const logo = text(record.logo, SEO_ORGANIZATION_MAX_FIELD_LENGTH);
  if (!isSafePublicUrl(logo)) {
    issues.push("Organization schema logo must be a safe public platform asset URL.");
  }

  const description = text(record.description, SEO_ORGANIZATION_MAX_FIELD_LENGTH);
  if (!isSafePublicText(description)) {
    issues.push("Organization schema description must be a safe public platform summary.");
  }

  if (!Array.isArray(record.sameAs)) {
    issues.push("Organization schema sameAs must be an array.");
  } else {
    const sameAsLinks = record.sameAs.slice(0, SEO_ORGANIZATION_MAX_SAME_AS_LINKS);

    if (record.sameAs.length > SEO_ORGANIZATION_MAX_SAME_AS_LINKS) {
      issues.push("Organization schema sameAs exceeds the safe public link limit.");
    }

    for (const link of sameAsLinks) {
      const cleanedLink = text(link, SEO_ORGANIZATION_MAX_FIELD_LENGTH);

      if (!isSafePublicUrl(cleanedLink, { requireHttps: true })) {
        issues.push("Organization schema sameAs links must be safe public HTTPS URLs only.");
        break;
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function getOrganizationSchemaRuntimeStatus(): OrganizationSchemaRuntimeStatus {
  const validation = validateOrganizationSchema(getOrganizationSchema());
  return validation.isValid ? "ready" : "placeholder";
}

export function mapOrganizationSchemaRuntimeToAdminFields() {
  const status = getOrganizationSchemaRuntimeStatus();

  return {
    name: "Organization schema",
    note:
      status === "ready"
        ? "Platform Organization JSON-LD is validated with safe public fields only."
        : "Organization schema validation requires safe platform defaults.",
    status
  };
}

// SEO-13+ placeholders: organization editor and dynamic sameAs links stay disconnected.
export const SEO_ORGANIZATION_SCHEMA_FUTURE_HOOKS = [
  "seo_organization_schema_editor",
  "seo_organization_same_as_links"
] as const;
