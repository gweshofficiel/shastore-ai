import "server-only";

import {
  isBlockedCanonicalPath,
  normalizeCanonicalPath
} from "@/src/lib/seo/seo-canonical-runtime";
import {
  normalizeSeoPageRoute,
  resolveSeoPageByRoute,
  resolveSeoPageBySlug,
  SEO_PAGE_RUNTIME_FALLBACK_ID,
  type SeoPageRuntime
} from "@/src/lib/seo/seo-page-runtime";

export type SeoLanguageRuntimeStatus = "placeholder" | "ready";

export type SeoLanguageRuntime = {
  language: string;
  languageReady: boolean;
  languageStatus: SeoLanguageRuntimeStatus;
  normalizedLanguage: string;
  sourceLabel: string;
  usedDefault: boolean;
};

export const SEO_LANGUAGE_DEFAULT = "en" as const;
export const SEO_LANGUAGE_MAX_LENGTH = 35 as const;

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  ar: "ar",
  arabic: "ar",
  en: "en",
  english: "en",
  fr: "fr",
  french: "fr"
};

function text(value: unknown, maxLength: number = SEO_LANGUAGE_MAX_LENGTH) {
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

function isBlockedLanguageRoute(route: string) {
  const normalizedRoute = normalizeCanonicalPath(normalizeSeoPageRoute(route));
  return isBlockedCanonicalPath(normalizedRoute);
}

export function getDefaultSeoLanguage() {
  return SEO_LANGUAGE_DEFAULT;
}

export function normalizeSeoLanguage(language: unknown) {
  const cleaned = text(language, SEO_LANGUAGE_MAX_LENGTH).toLowerCase().replace(/_/g, "-");

  if (!cleaned) {
    return getDefaultSeoLanguage();
  }

  const compact = cleaned.replace(/[^a-z-]/g, "");
  const alias = LANGUAGE_NAME_TO_CODE[compact];

  if (alias) {
    return alias;
  }

  const parts = compact.split("-").filter(Boolean);
  const primary = parts[0] ?? "";

  if (!/^[a-z]{2,3}$/.test(primary)) {
    return getDefaultSeoLanguage();
  }

  if (parts.length === 1) {
    return primary;
  }

  const subtags = parts
    .slice(1)
    .map((part) => part.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  if (!subtags.length) {
    return primary;
  }

  return [primary, ...subtags].join("-").slice(0, SEO_LANGUAGE_MAX_LENGTH);
}

function resolveLanguageStatus(page: SeoPageRuntime, usedDefault: boolean): SeoLanguageRuntimeStatus {
  if (page.id === SEO_PAGE_RUNTIME_FALLBACK_ID || isBlockedLanguageRoute(page.route)) {
    return "placeholder";
  }

  if (usedDefault || !page.languageReady) {
    return "placeholder";
  }

  return "ready";
}

export function resolveSeoLanguageFromPage(page: SeoPageRuntime): SeoLanguageRuntime {
  const rawLanguage = text(page.language, SEO_LANGUAGE_MAX_LENGTH);
  const usedDefault = !rawLanguage;
  const normalizedLanguage = usedDefault ? getDefaultSeoLanguage() : normalizeSeoLanguage(rawLanguage);
  const language = normalizedLanguage || getDefaultSeoLanguage();
  const languageReady = page.languageReady && !usedDefault && page.id !== SEO_PAGE_RUNTIME_FALLBACK_ID;

  return {
    language,
    languageReady,
    languageStatus: resolveLanguageStatus(page, usedDefault),
    normalizedLanguage: language,
    sourceLabel: page.label,
    usedDefault
  };
}

export async function resolveSeoLanguageBySlug(slug: string): Promise<SeoLanguageRuntime> {
  try {
    const page = await resolveSeoPageBySlug(slug);
    return resolveSeoLanguageFromPage(page);
  } catch (error) {
    console.error("[seo-language-runtime] language slug resolve failed", error);

    return {
      language: getDefaultSeoLanguage(),
      languageReady: false,
      languageStatus: "placeholder",
      normalizedLanguage: getDefaultSeoLanguage(),
      sourceLabel: slug || "unknown",
      usedDefault: true
    };
  }
}

export async function resolveSeoLanguageByRoute(route: string): Promise<SeoLanguageRuntime> {
  try {
    const page = await resolveSeoPageByRoute(route);
    return resolveSeoLanguageFromPage(page);
  } catch (error) {
    console.error("[seo-language-runtime] language route resolve failed", error);

    return {
      language: getDefaultSeoLanguage(),
      languageReady: false,
      languageStatus: "placeholder",
      normalizedLanguage: getDefaultSeoLanguage(),
      sourceLabel: route || "/",
      usedDefault: true
    };
  }
}

export function mapSeoLanguageRuntimeToAdminFields(page: SeoPageRuntime) {
  const languageRuntime = resolveSeoLanguageFromPage(page);

  return {
    language: languageRuntime.language,
    languageStatus: languageRuntime.languageStatus
  };
}

// SEO-8+ placeholders: language editor and hreflang runtime stay disconnected.
export const SEO_LANGUAGE_FUTURE_HOOKS = ["seo_language_editor", "seo_hreflang_runtime"] as const;
