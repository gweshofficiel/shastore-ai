import "server-only";

import {
  getDefaultCanonicalPath,
  isBlockedCanonicalPath,
  normalizeCanonicalPath,
  resolveCanonicalFromPage
} from "@/src/lib/seo/seo-canonical-runtime";
import {
  getDefaultMetaDescription,
  resolveMetaDescriptionFromPage
} from "@/src/lib/seo/seo-meta-description-runtime";
import {
  getDefaultMetaTitle,
  resolveMetaTitleFromPage
} from "@/src/lib/seo/seo-meta-title-runtime";
import {
  normalizeSeoPageRoute,
  resolveSeoPageByRoute,
  resolveSeoPageBySlug,
  SEO_PAGE_RUNTIME_FALLBACK_ID,
  type SeoPageRuntime
} from "@/src/lib/seo/seo-page-runtime";

export type OpenGraphRuntimeStatus = "placeholder" | "ready";

export type OpenGraphRuntime = {
  description: string;
  enabled: boolean;
  image: string;
  openGraphStatus: OpenGraphRuntimeStatus;
  sourceLabel: string;
  title: string;
  type: string;
  url: string;
  usedDefaultImage: boolean;
};

export const SEO_OPEN_GRAPH_DEFAULT_TYPE = "website" as const;
export const SEO_OPEN_GRAPH_DEFAULT_IMAGE = "/opengraph-image.png" as const;
export const SEO_OPEN_GRAPH_IMAGE_MAX_LENGTH = 1000 as const;

const BLOCKED_OPEN_GRAPH_PREFIXES = ["/admin", "/api", "/dashboard"] as const;

function text(value: unknown, maxLength: number = SEO_OPEN_GRAPH_IMAGE_MAX_LENGTH) {
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

function isBlockedOpenGraphRoute(route: string) {
  const normalized = normalizeCanonicalPath(normalizeSeoPageRoute(route));
  return isBlockedCanonicalPath(normalized);
}

function isBlockedOpenGraphPathNormalized(normalized: string) {
  return BLOCKED_OPEN_GRAPH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function getDefaultOpenGraph(): Omit<OpenGraphRuntime, "openGraphStatus" | "sourceLabel" | "usedDefaultImage"> {
  return {
    description: getDefaultMetaDescription(),
    enabled: true,
    image: SEO_OPEN_GRAPH_DEFAULT_IMAGE,
    title: getDefaultMetaTitle(),
    type: SEO_OPEN_GRAPH_DEFAULT_TYPE,
    url: getDefaultCanonicalPath()
  };
}

export function normalizeOpenGraphImage(imagePath: unknown) {
  const cleaned = text(imagePath, SEO_OPEN_GRAPH_IMAGE_MAX_LENGTH);

  if (!cleaned) {
    return SEO_OPEN_GRAPH_DEFAULT_IMAGE;
  }

  if (/^(?:javascript:|data:)/i.test(cleaned)) {
    return SEO_OPEN_GRAPH_DEFAULT_IMAGE;
  }

  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }

  const relative = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  const normalized = relative.replace(/\/+$/, "") || SEO_OPEN_GRAPH_DEFAULT_IMAGE;

  if (isBlockedOpenGraphPathNormalized(normalized)) {
    return SEO_OPEN_GRAPH_DEFAULT_IMAGE;
  }

  return normalized;
}

function resolveOpenGraphEnabled(page: SeoPageRuntime) {
  if (page.id === SEO_PAGE_RUNTIME_FALLBACK_ID) {
    return false;
  }

  if (isBlockedOpenGraphRoute(page.route)) {
    return false;
  }

  if (page.openGraphExplicitlyDisabled) {
    return false;
  }

  return true;
}

export function resolveOpenGraphFromPage(page: SeoPageRuntime): OpenGraphRuntime {
  const metaTitle = resolveMetaTitleFromPage(page);
  const metaDescription = resolveMetaDescriptionFromPage(page);
  const canonical = resolveCanonicalFromPage(page);
  const enabled = resolveOpenGraphEnabled(page);
  const rawImage = text(page.openGraphImagePath, SEO_OPEN_GRAPH_IMAGE_MAX_LENGTH);
  const image = normalizeOpenGraphImage(rawImage);
  const defaults = getDefaultOpenGraph();

  return {
    description: metaDescription.metaDescription || defaults.description,
    enabled,
    image,
    openGraphStatus: enabled ? "ready" : "placeholder",
    sourceLabel: page.label,
    title: metaTitle.metaTitle || defaults.title,
    type: SEO_OPEN_GRAPH_DEFAULT_TYPE,
    url: canonical.canonicalPath || defaults.url,
    usedDefaultImage: !rawImage
  };
}

export async function resolveOpenGraphBySlug(slug: string): Promise<OpenGraphRuntime> {
  try {
    const page = await resolveSeoPageBySlug(slug);
    return resolveOpenGraphFromPage(page);
  } catch (error) {
    console.error("[seo-open-graph-runtime] open graph slug resolve failed", error);

    const defaults = getDefaultOpenGraph();

    return {
      ...defaults,
      enabled: false,
      openGraphStatus: "placeholder",
      sourceLabel: slug || "unknown",
      usedDefaultImage: true
    };
  }
}

export async function resolveOpenGraphByRoute(route: string): Promise<OpenGraphRuntime> {
  try {
    const page = await resolveSeoPageByRoute(route);
    return resolveOpenGraphFromPage(page);
  } catch (error) {
    console.error("[seo-open-graph-runtime] open graph route resolve failed", error);

    const defaults = getDefaultOpenGraph();

    return {
      ...defaults,
      enabled: false,
      openGraphStatus: "placeholder",
      sourceLabel: route || "/",
      url: normalizeCanonicalPath(route),
      usedDefaultImage: true
    };
  }
}

export function mapOpenGraphRuntimeToAdminFields(page: SeoPageRuntime) {
  const openGraphRuntime = resolveOpenGraphFromPage(page);

  return {
    openGraphStatus: openGraphRuntime.openGraphStatus,
    openGraphTitle: openGraphRuntime.enabled ? openGraphRuntime.title : "Open Graph disabled"
  };
}

// SEO-8+ placeholders: open graph editing and AI generation stay disconnected.
export const SEO_OPEN_GRAPH_FUTURE_HOOKS = ["seo_open_graph_editor", "seo_open_graph_ai_generator"] as const;
