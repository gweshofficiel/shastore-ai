import "server-only";

import type { PublicPlatformPage } from "@/src/lib/platform-website/public-page-resolver";

export type PlatformLocale = "ar" | "en" | "fr";
export type PlatformTranslationReadiness = "missing" | "needs_review" | "partial" | "ready";

export type PlatformTranslatedPage = PublicPlatformPage & {
  direction: "ltr" | "rtl";
  fallbackLocale: PlatformLocale | "base";
  locale: PlatformLocale;
  requestedLocale: PlatformLocale;
};

type PlatformTranslationPageLike = {
  translations?: unknown;
};

export const platformLocales: PlatformLocale[] = ["en", "ar", "fr"];

function text(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .trim()
    .slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function recordValue(value: unknown) {
  return isRecord(value) ? value : {};
}

function translationRecord(page: PlatformTranslationPageLike, locale: PlatformLocale) {
  const translations = recordValue(page.translations);

  return recordValue(translations[locale]);
}

function translationText(record: Record<string, unknown>, camelKey: string, snakeKey: string, maxLength = 2000) {
  return text(record[camelKey] ?? record[snakeKey], maxLength);
}

function translationBody(record: Record<string, unknown>, baseBody: Record<string, unknown>) {
  if (isRecord(record.body)) {
    return record.body;
  }

  const content = text(record.content, 5000);

  if (content) {
    return {
      sections: [
        {
          text: content,
          type: "translation"
        }
      ]
    };
  }

  return baseBody;
}

function translationOpenGraph(record: Record<string, unknown>, baseOpenGraph: Record<string, unknown>) {
  const openGraph = recordValue(record.openGraph ?? record.open_graph);

  return {
    ...baseOpenGraph,
    ...openGraph
  };
}

function hasTranslationContent(record: Record<string, unknown>) {
  return Boolean(
    text(record.status, 40) ||
    text(record.content, 5000) ||
    translationText(record, "title", "title", 180) ||
    translationText(record, "headline", "headline", 240) ||
    translationText(record, "subtitle", "subtitle", 500) ||
    translationText(record, "seoTitle", "seo_title", 180) ||
    translationText(record, "seoDescription", "seo_description", 500) ||
    translationText(record, "canonicalPath", "canonical_path", 240) ||
    isRecord(record.body) ||
    isRecord(record.openGraph) ||
    isRecord(record.open_graph)
  );
}

function localeStatus(record: Record<string, unknown>): PlatformTranslationReadiness {
  const status = text(record.status, 40);

  if (!hasTranslationContent(record) || status === "placeholder") {
    return "missing";
  }

  if (status === "ready") {
    return "ready";
  }

  if (status === "needs_review") {
    return "needs_review";
  }

  return "partial";
}

function missingFields(record: Record<string, unknown>) {
  return [
    !translationText(record, "title", "title", 180) ? "title" : null,
    !translationText(record, "headline", "headline", 240) ? "headline" : null,
    !translationText(record, "subtitle", "subtitle", 500) ? "subtitle" : null,
    !isRecord(record.body) && !text(record.content, 5000) ? "body" : null,
    !translationText(record, "seoTitle", "seo_title", 180) ? "seo_title" : null,
    !translationText(record, "seoDescription", "seo_description", 500) ? "seo_description" : null,
    !text(recordValue(record.openGraph ?? record.open_graph).title, 180) ? "open_graph.title" : null,
    !text(recordValue(record.openGraph ?? record.open_graph).description, 300) ? "open_graph.description" : null
  ].filter((field): field is string => Boolean(field));
}

export function getPlatformPageFallbackLocale(locale: string | null | undefined): PlatformLocale {
  return platformLocales.includes(locale as PlatformLocale) ? locale as PlatformLocale : "en";
}

export function isPlatformLocale(locale: string | null | undefined): locale is PlatformLocale {
  return platformLocales.includes(locale as PlatformLocale);
}

export function validatePlatformTranslations(page: PlatformTranslationPageLike) {
  const locales = Object.fromEntries(
    platformLocales.map((locale) => [
      locale,
      localeStatus(translationRecord(page, locale))
    ])
  ) as Record<PlatformLocale, PlatformTranslationReadiness>;
  const missingFieldsByLocale = Object.fromEntries(
    platformLocales.map((locale) => [
      locale,
      missingFields(translationRecord(page, locale))
    ])
  ) as Record<PlatformLocale, string[]>;

  return {
    isReady: platformLocales.every((locale) => locales[locale] === "ready"),
    locales,
    missingFields: missingFieldsByLocale
  };
}

export function getPlatformTranslationStatus(page: PlatformTranslationPageLike) {
  return validatePlatformTranslations(page).locales;
}

export function getPlatformPageTranslation(page: PublicPlatformPage, locale: string | null | undefined): PlatformTranslatedPage {
  const requestedLocale = getPlatformPageFallbackLocale(locale);
  const requestedRecord = translationRecord(page, requestedLocale);
  const englishRecord = translationRecord(page, "en");
  const requestedStatus = localeStatus(requestedRecord);
  const englishStatus = localeStatus(englishRecord);
  const fallbackLocale: PlatformLocale | "base" = requestedStatus === "ready"
    ? requestedLocale
    : englishStatus === "ready"
      ? "en"
      : "base";
  const record = fallbackLocale === "base"
    ? {}
    : fallbackLocale === requestedLocale
      ? requestedRecord
      : englishRecord;
  const title = translationText(record, "title", "title", 180) || page.title;
  const headline = translationText(record, "headline", "headline", 240) || page.headline || title;
  const subtitle = translationText(record, "subtitle", "subtitle", 500) || page.subtitle;
  const seoTitle = translationText(record, "seoTitle", "seo_title", 180) || page.seoTitle;
  const seoDescription = translationText(record, "seoDescription", "seo_description", 500) || page.seoDescription;
  const canonicalPath = translationText(record, "canonicalPath", "canonical_path", 240) || page.canonicalPath;

  return {
    ...page,
    body: translationBody(record, page.body),
    canonicalPath,
    direction: requestedLocale === "ar" ? "rtl" : "ltr",
    fallbackLocale,
    headline,
    locale: requestedLocale,
    openGraph: translationOpenGraph(record, page.openGraph),
    requestedLocale,
    seoDescription,
    seoTitle,
    subtitle,
    title
  };
}
