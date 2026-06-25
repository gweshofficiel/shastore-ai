import "server-only";

import {
  resolveSeoPageByRoute,
  resolveSeoPageBySlug,
  type SeoPageRuntime
} from "@/src/lib/seo/seo-page-runtime";

export type MetaTitleRuntimeStatus = "missing" | "ready";

export type MetaTitleRuntime = {
  metaTitle: string;
  metaTitleStatus: MetaTitleRuntimeStatus;
  normalizedTitle: string;
  sourceLabel: string;
  usedDefault: boolean;
  withinLengthTarget: boolean;
};

export const SEO_META_TITLE_DEFAULT = "SHASTORE AI" as const;
export const SEO_META_TITLE_TARGET_LENGTH = 60 as const;
export const SEO_META_TITLE_MAX_LENGTH = 180 as const;

function text(value: unknown, maxLength: number = SEO_META_TITLE_MAX_LENGTH) {
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

export function getDefaultMetaTitle() {
  return SEO_META_TITLE_DEFAULT;
}

export function getDefaultMetaTitleForPageLabel(pageLabel: string) {
  const cleanedLabel = text(pageLabel, 120);

  if (!cleanedLabel) {
    return getDefaultMetaTitle();
  }

  return `${cleanedLabel} - ${SEO_META_TITLE_DEFAULT}`;
}

export function normalizeMetaTitle(title: unknown) {
  const cleaned = text(title, SEO_META_TITLE_MAX_LENGTH);

  if (!cleaned) {
    return getDefaultMetaTitle();
  }

  return cleaned;
}

export function resolveMetaTitleFromPage(page: SeoPageRuntime): MetaTitleRuntime {
  const rawTitle = text(page.metaTitle, SEO_META_TITLE_MAX_LENGTH);
  const usedDefault = !rawTitle;
  const normalizedTitle = usedDefault ? getDefaultMetaTitleForPageLabel(page.label) : normalizeMetaTitle(rawTitle);
  const metaTitle = normalizedTitle || getDefaultMetaTitle();

  return {
    metaTitle,
    metaTitleStatus: usedDefault ? "missing" : "ready",
    normalizedTitle: metaTitle,
    sourceLabel: page.label,
    usedDefault,
    withinLengthTarget: metaTitle.length <= SEO_META_TITLE_TARGET_LENGTH
  };
}

export async function resolveMetaTitleBySlug(slug: string): Promise<MetaTitleRuntime> {
  try {
    const page = await resolveSeoPageBySlug(slug);
    return resolveMetaTitleFromPage(page);
  } catch (error) {
    console.error("[seo-meta-title-runtime] meta title slug resolve failed", error);

    return {
      metaTitle: getDefaultMetaTitle(),
      metaTitleStatus: "missing",
      normalizedTitle: getDefaultMetaTitle(),
      sourceLabel: slug || "unknown",
      usedDefault: true,
      withinLengthTarget: true
    };
  }
}

export async function resolveMetaTitleByRoute(route: string): Promise<MetaTitleRuntime> {
  try {
    const page = await resolveSeoPageByRoute(route);
    return resolveMetaTitleFromPage(page);
  } catch (error) {
    console.error("[seo-meta-title-runtime] meta title route resolve failed", error);

    return {
      metaTitle: getDefaultMetaTitle(),
      metaTitleStatus: "missing",
      normalizedTitle: getDefaultMetaTitle(),
      sourceLabel: route || "/",
      usedDefault: true,
      withinLengthTarget: true
    };
  }
}

export function mapMetaTitleRuntimeToAdminFields(page: SeoPageRuntime) {
  const metaTitleRuntime = resolveMetaTitleFromPage(page);

  return {
    metaTitle: metaTitleRuntime.metaTitle,
    metaTitleStatus: metaTitleRuntime.metaTitleStatus
  };
}

// SEO-5+ placeholders: meta title editing and AI generation stay disconnected.
export const SEO_META_TITLE_FUTURE_HOOKS = ["seo_meta_title_editor", "seo_meta_title_ai_generator"] as const;
