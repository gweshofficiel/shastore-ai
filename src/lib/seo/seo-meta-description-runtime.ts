import "server-only";

import {
  resolveSeoPageByRoute,
  resolveSeoPageBySlug,
  type SeoPageRuntime
} from "@/src/lib/seo/seo-page-runtime";

export type MetaDescriptionRuntimeStatus = "missing" | "ready";

export type MetaDescriptionRuntime = {
  metaDescription: string;
  metaDescriptionStatus: MetaDescriptionRuntimeStatus;
  normalizedDescription: string;
  sourceLabel: string;
  usedDefault: boolean;
  withinLengthTarget: boolean;
};

export const SEO_META_DESCRIPTION_DEFAULT =
  "Platform SEO metadata is missing from content storage." as const;
export const SEO_META_DESCRIPTION_TARGET_LENGTH = 160 as const;
export const SEO_META_DESCRIPTION_MAX_LENGTH = 500 as const;

function text(value: unknown, maxLength: number = SEO_META_DESCRIPTION_MAX_LENGTH) {
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

export function getDefaultMetaDescription() {
  return SEO_META_DESCRIPTION_DEFAULT;
}

export function getDefaultMetaDescriptionForPageLabel(pageLabel: string) {
  const cleanedLabel = text(pageLabel, 120);

  if (!cleanedLabel) {
    return getDefaultMetaDescription();
  }

  return `Learn more about ${cleanedLabel} on SHASTORE AI.`;
}

export function normalizeMetaDescription(description: unknown) {
  const cleaned = text(description, SEO_META_DESCRIPTION_MAX_LENGTH);

  if (!cleaned) {
    return getDefaultMetaDescription();
  }

  return cleaned;
}

export function resolveMetaDescriptionFromPage(page: SeoPageRuntime): MetaDescriptionRuntime {
  const rawDescription = text(page.metaDescription, SEO_META_DESCRIPTION_MAX_LENGTH);
  const usedDefault = !rawDescription;
  const normalizedDescription = usedDefault
    ? getDefaultMetaDescriptionForPageLabel(page.label)
    : normalizeMetaDescription(rawDescription);
  const metaDescription = normalizedDescription || getDefaultMetaDescription();

  return {
    metaDescription,
    metaDescriptionStatus: usedDefault ? "missing" : "ready",
    normalizedDescription: metaDescription,
    sourceLabel: page.label,
    usedDefault,
    withinLengthTarget: metaDescription.length <= SEO_META_DESCRIPTION_TARGET_LENGTH
  };
}

export async function resolveMetaDescriptionBySlug(slug: string): Promise<MetaDescriptionRuntime> {
  try {
    const page = await resolveSeoPageBySlug(slug);
    return resolveMetaDescriptionFromPage(page);
  } catch (error) {
    console.error("[seo-meta-description-runtime] meta description slug resolve failed", error);

    return {
      metaDescription: getDefaultMetaDescription(),
      metaDescriptionStatus: "missing",
      normalizedDescription: getDefaultMetaDescription(),
      sourceLabel: slug || "unknown",
      usedDefault: true,
      withinLengthTarget: true
    };
  }
}

export async function resolveMetaDescriptionByRoute(route: string): Promise<MetaDescriptionRuntime> {
  try {
    const page = await resolveSeoPageByRoute(route);
    return resolveMetaDescriptionFromPage(page);
  } catch (error) {
    console.error("[seo-meta-description-runtime] meta description route resolve failed", error);

    return {
      metaDescription: getDefaultMetaDescription(),
      metaDescriptionStatus: "missing",
      normalizedDescription: getDefaultMetaDescription(),
      sourceLabel: route || "/",
      usedDefault: true,
      withinLengthTarget: true
    };
  }
}

export function mapMetaDescriptionRuntimeToAdminFields(page: SeoPageRuntime) {
  const metaDescriptionRuntime = resolveMetaDescriptionFromPage(page);

  return {
    metaDescription: metaDescriptionRuntime.metaDescription,
    metaDescriptionStatus: metaDescriptionRuntime.metaDescriptionStatus
  };
}

// SEO-6+ placeholders: meta description editing and AI generation stay disconnected.
export const SEO_META_DESCRIPTION_FUTURE_HOOKS = [
  "seo_meta_description_editor",
  "seo_meta_description_ai_generator"
] as const;
