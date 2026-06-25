import "server-only";

import { getAppBaseUrl } from "@/lib/deployment/config";

export type WebsiteSchemaRuntimeStatus = "placeholder" | "ready";

export type WebsitePotentialAction = {
  "@type": "SearchAction";
  "query-input": string;
  target: {
    "@type": "EntryPoint";
    urlTemplate: string;
  };
};

export type WebsiteSchema = {
  "@context": "https://schema.org";
  "@type": "WebSite";
  description: string;
  name: string;
  potentialAction: WebsitePotentialAction;
  url: string;
};

export type WebsiteSchemaValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_WEBSITE_DEFAULT_NAME = "SHASTORE AI" as const;
export const SEO_WEBSITE_DEFAULT_DESCRIPTION =
  "AI copy and template-based ecommerce landing pages for products." as const;
export const SEO_WEBSITE_SEARCH_PATH = "/blog" as const;
export const SEO_WEBSITE_SEARCH_QUERY_PARAM = "search" as const;
export const SEO_WEBSITE_MAX_FIELD_LENGTH = 500 as const;

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

function text(value: unknown, maxLength: number = SEO_WEBSITE_MAX_FIELD_LENGTH) {
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
  const cleaned = text(value, SEO_WEBSITE_MAX_FIELD_LENGTH);

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
  const cleaned = text(value, SEO_WEBSITE_MAX_FIELD_LENGTH);

  if (!cleaned) {
    return false;
  }

  return !PRIVATE_FIELD_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function buildDefaultPotentialAction(): WebsitePotentialAction {
  const searchUrl = absoluteUrl(
    `${SEO_WEBSITE_SEARCH_PATH}?${SEO_WEBSITE_SEARCH_QUERY_PARAM}={search_term_string}`
  );

  return {
    "@type": "SearchAction",
    "query-input": "required name=search_term_string",
    target: {
      "@type": "EntryPoint",
      urlTemplate: searchUrl
    }
  };
}

export function getWebsiteSchema(description?: string): WebsiteSchema {
  const safeDescription = text(description, SEO_WEBSITE_MAX_FIELD_LENGTH) || SEO_WEBSITE_DEFAULT_DESCRIPTION;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description: safeDescription,
    name: SEO_WEBSITE_DEFAULT_NAME,
    potentialAction: buildDefaultPotentialAction(),
    url: siteBaseUrl()
  };
}

function validatePotentialAction(action: unknown, issues: string[]) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    issues.push("Website schema potentialAction must be a JSON-LD object.");
    return;
  }

  const record = action as Record<string, unknown>;

  if (record["@type"] !== "SearchAction") {
    issues.push("Website schema potentialAction @type must be SearchAction.");
  }

  const queryInput = text(record["query-input"], SEO_WEBSITE_MAX_FIELD_LENGTH);
  if (!queryInput || !queryInput.includes("search_term_string")) {
    issues.push("Website schema potentialAction query-input must reference search_term_string.");
  }

  const target = record.target;

  if (!target || typeof target !== "object" || Array.isArray(target)) {
    issues.push("Website schema potentialAction target must be an EntryPoint object.");
    return;
  }

  const targetRecord = target as Record<string, unknown>;

  if (targetRecord["@type"] !== "EntryPoint") {
    issues.push("Website schema potentialAction target @type must be EntryPoint.");
  }

  const urlTemplate = text(targetRecord.urlTemplate, SEO_WEBSITE_MAX_FIELD_LENGTH);
  if (!isSafePublicUrl(urlTemplate)) {
    issues.push("Website schema potentialAction target urlTemplate must be a safe public platform URL.");
  }
}

export function validateWebsiteSchema(schema: unknown): WebsiteSchemaValidation {
  const issues: string[] = [];

  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return {
      isValid: false,
      issues: ["Website schema must be a JSON-LD object."]
    };
  }

  const record = schema as Record<string, unknown>;

  if (record["@context"] !== "https://schema.org") {
    issues.push("Website schema @context must be https://schema.org.");
  }

  if (record["@type"] !== "WebSite") {
    issues.push("Website schema @type must be WebSite.");
  }

  const name = text(record.name, SEO_WEBSITE_MAX_FIELD_LENGTH);
  if (!isSafePublicText(name)) {
    issues.push("Website schema name must be a safe public platform label.");
  }

  const url = text(record.url, SEO_WEBSITE_MAX_FIELD_LENGTH);
  if (!isSafePublicUrl(url)) {
    issues.push("Website schema url must be a safe public platform URL.");
  }

  const description = text(record.description, SEO_WEBSITE_MAX_FIELD_LENGTH);
  if (!isSafePublicText(description)) {
    issues.push("Website schema description must be a safe public platform summary.");
  }

  validatePotentialAction(record.potentialAction, issues);

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function getWebsiteSchemaRuntimeStatus(): WebsiteSchemaRuntimeStatus {
  const validation = validateWebsiteSchema(getWebsiteSchema());
  return validation.isValid ? "ready" : "placeholder";
}

export function mapWebsiteSchemaRuntimeToAdminFields() {
  const status = getWebsiteSchemaRuntimeStatus();

  return {
    name: "Website schema",
    note:
      status === "ready"
        ? "Platform Website JSON-LD is validated with safe public fields and SearchAction only."
        : "Website schema validation requires safe platform defaults.",
    status
  };
}

// SEO-13+ placeholders: website editor and dynamic search targets stay disconnected.
export const SEO_WEBSITE_SCHEMA_FUTURE_HOOKS = [
  "seo_website_schema_editor",
  "seo_website_search_target"
] as const;
