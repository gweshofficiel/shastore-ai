import "server-only";

import {
  getPlatformPageEditorContent,
  updatePlatformPageContent,
  type PlatformPageEditorRecord
} from "@/src/lib/platform-website/platform-content-storage";
import { platformLocales, type PlatformLocale } from "@/src/lib/platform-website/platform-translations-runtime";

export type PlatformSeoScore = "Missing SEO" | "Needs Improvement" | "Ready";

export type PlatformSeoLocaleDraft = {
  canonicalPath: string;
  locale: PlatformLocale;
  openGraphDescription: string;
  openGraphTitle: string;
  seoDescription: string;
  seoTitle: string;
};

export type PlatformSeoDraft = {
  base: PlatformSeoLocaleDraft;
  generatedAt: string;
  locales: Partial<Record<PlatformLocale, PlatformSeoLocaleDraft>>;
  pageId: string;
  score: PlatformSeoScore;
  sourceSummary: string;
};

function text(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function jsonRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function sentence(value: string, maxLength: number) {
  const cleaned = text(value, maxLength + 80);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const clipped = cleaned.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");

  return `${clipped.slice(0, lastSpace > 40 ? lastSpace : maxLength).trimEnd()}.`;
}

function canonicalPath(value: unknown, fallback: string) {
  const source = text(value || fallback, 240);
  const relative = source.startsWith("/") ? source : `/${source}`;

  if (/^(?:https?:|javascript:|data:)/i.test(source) || relative.startsWith("//")) {
    return fallback.startsWith("/") ? fallback : `/${fallback}`;
  }

  return relative.replace(/\/+$/, "") || "/";
}

function bodyText(body: Record<string, unknown>) {
  const sections = Array.isArray(body.sections) ? body.sections : [];
  const sectionText = sections
    .map((section) => {
      if (!isRecord(section)) {
        return "";
      }

      return [
        text(section.heading ?? section.title, 180),
        text(section.text ?? section.content ?? section.body, 1000)
      ].filter(Boolean).join(". ");
    })
    .filter(Boolean)
    .join(" ");

  return sectionText || text(body.text ?? body.content ?? body.body, 1200);
}

function titleFor(input: { headline?: string | null; title?: string | null }) {
  const source = text(input.headline, 90) || text(input.title, 90) || "SHASTORE AI";
  const withBrand = source.toLowerCase().includes("shastore") ? source : `${source} | SHASTORE AI`;

  return sentence(withBrand, 70);
}

function descriptionFor(input: { body?: Record<string, unknown>; headline?: string | null; subtitle?: string | null; title?: string | null }) {
  const source = text(input.subtitle, 500) ||
    bodyText(input.body ?? {}) ||
    text(input.headline, 240) ||
    text(input.title, 180);

  return sentence(source, 160);
}

function localeRecord(page: PlatformPageEditorRecord, locale: PlatformLocale) {
  return jsonRecord(page.translations[locale]);
}

function hasLocaleContent(record: Record<string, unknown>) {
  return Boolean(
    text(record.title, 180) ||
    text(record.headline, 240) ||
    text(record.subtitle, 500) ||
    text(record.content, 1200) ||
    isRecord(record.body)
  );
}

function draftFor(input: {
  body: Record<string, unknown>;
  canonicalPath?: string | null;
  headline?: string | null;
  locale: PlatformLocale;
  routePath: string;
  subtitle?: string | null;
  title?: string | null;
}): PlatformSeoLocaleDraft {
  const seoTitle = titleFor(input);
  const seoDescription = descriptionFor(input);

  return {
    canonicalPath: canonicalPath(input.canonicalPath, input.routePath),
    locale: input.locale,
    openGraphDescription: seoDescription,
    openGraphTitle: seoTitle,
    seoDescription,
    seoTitle
  };
}

export function scorePlatformSeo(input: {
  canonicalPath?: string | null;
  openGraph?: Record<string, unknown>;
  seoDescription?: string | null;
  seoTitle?: string | null;
}) {
  const openGraph = input.openGraph ?? {};
  const missing = [
    !text(input.seoTitle, 70),
    !text(input.seoDescription, 160),
    !text(input.canonicalPath, 240),
    !text(openGraph.title, 180),
    !text(openGraph.description, 300)
  ].filter(Boolean).length;

  if (missing === 0) {
    return "Ready" as const;
  }

  return missing >= 3 ? "Missing SEO" as const : "Needs Improvement" as const;
}

export function validateSeoDraft(draft: unknown): PlatformSeoDraft {
  if (!isRecord(draft)) {
    throw new Error("SEO draft must be an object.");
  }

  const base = jsonRecord(draft.base);
  const pageId = text(draft.pageId, 120);

  if (!pageId) {
    throw new Error("SEO draft page id is required.");
  }

  const normalize = (value: Record<string, unknown>, locale: PlatformLocale): PlatformSeoLocaleDraft => {
    const seoTitle = sentence(text(value.seoTitle, 100), 70);
    const seoDescription = sentence(text(value.seoDescription, 220), 160);
    const canonical = canonicalPath(value.canonicalPath, "/");
    const openGraphTitle = sentence(text(value.openGraphTitle, 180) || seoTitle, 180);
    const openGraphDescription = sentence(text(value.openGraphDescription, 300) || seoDescription, 300);

    if (!seoTitle || !seoDescription || !canonical || !openGraphTitle || !openGraphDescription) {
      throw new Error("SEO draft is missing required generated fields.");
    }

    return {
      canonicalPath: canonical,
      locale,
      openGraphDescription,
      openGraphTitle,
      seoDescription,
      seoTitle
    };
  };
  const locales = jsonRecord(draft.locales);
  const normalizedBase = normalize(base, "en");

  return {
    base: normalizedBase,
    generatedAt: text(draft.generatedAt, 80) || new Date().toISOString(),
    locales: Object.fromEntries(
      platformLocales
        .filter((locale) => isRecord(locales[locale]))
        .map((locale) => [locale, normalize(jsonRecord(locales[locale]), locale)])
    ),
    pageId,
    score: scorePlatformSeo({
      canonicalPath: normalizedBase.canonicalPath,
      openGraph: {
        description: normalizedBase.openGraphDescription,
        title: normalizedBase.openGraphTitle
      },
      seoDescription: normalizedBase.seoDescription,
      seoTitle: normalizedBase.seoTitle
    }),
    sourceSummary: text(draft.sourceSummary, 500)
  };
}

export async function generateSeoDraft(pageId: string): Promise<PlatformSeoDraft> {
  const page = await getPlatformPageEditorContent(pageId);

  if (!page) {
    throw new Error("Platform page could not be loaded for SEO generation.");
  }

  const base = draftFor({
    body: page.body,
    canonicalPath: page.canonicalPath,
    headline: page.headline,
    locale: "en",
    routePath: page.routePath,
    subtitle: page.subtitle,
    title: page.title
  });
  const locales = Object.fromEntries(
    platformLocales
      .map((locale) => {
        const record = localeRecord(page, locale);

        if (!hasLocaleContent(record)) {
          return null;
        }

        return [
          locale,
          draftFor({
            body: jsonRecord(record.body),
            canonicalPath: text(record.canonicalPath ?? record.canonical_path, 240) || page.canonicalPath,
            headline: text(record.headline, 240),
            locale,
            routePath: page.routePath,
            subtitle: text(record.subtitle, 500),
            title: text(record.title, 180)
          })
        ] as const;
      })
      .filter((entry): entry is readonly [PlatformLocale, PlatformSeoLocaleDraft] => Boolean(entry))
  );

  return validateSeoDraft({
    base,
    generatedAt: new Date().toISOString(),
    locales,
    pageId: page.id,
    sourceSummary: [
      text(page.title, 180),
      text(page.headline, 240),
      text(page.subtitle, 300),
      bodyText(page.body)
    ].filter(Boolean).join(" | ").slice(0, 500)
  });
}

export async function applySeoDraft(pageId: string, draft: unknown) {
  const validDraft = validateSeoDraft(draft);
  const page = await getPlatformPageEditorContent(pageId);

  if (!page || page.id !== validDraft.pageId) {
    throw new Error("SEO draft does not match the requested platform page.");
  }

  const translations = Object.fromEntries(
    platformLocales.map((locale) => {
      const existing = jsonRecord(page.translations[locale]);
      const localeDraft = validDraft.locales[locale];

      if (!localeDraft) {
        return [locale, existing];
      }

      return [
        locale,
        {
          ...existing,
          canonical_path: localeDraft.canonicalPath,
          open_graph: {
            ...jsonRecord(existing.openGraph ?? existing.open_graph),
            description: localeDraft.openGraphDescription,
            title: localeDraft.openGraphTitle
          },
          seo_description: localeDraft.seoDescription,
          seo_title: localeDraft.seoTitle
        }
      ];
    })
  );

  return updatePlatformPageContent(page.id, {
    canonicalPath: validDraft.base.canonicalPath,
    openGraph: {
      ...page.openGraph,
      description: validDraft.base.openGraphDescription,
      title: validDraft.base.openGraphTitle
    },
    seoDescription: validDraft.base.seoDescription,
    seoTitle: validDraft.base.seoTitle,
    translations
  });
}
