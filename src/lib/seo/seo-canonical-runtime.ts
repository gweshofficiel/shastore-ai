import "server-only";

import {
  normalizeSeoPageRoute,
  resolveSeoPageByRoute,
  resolveSeoPageBySlug,
  type SeoPageRuntime
} from "@/src/lib/seo/seo-page-runtime";

export type CanonicalRuntimeStatus = "missing" | "ready";

export type CanonicalRuntime = {
  canonicalPath: string;
  canonicalStatus: CanonicalRuntimeStatus;
  normalizedPath: string;
  sourceLabel: string;
  usedRouteFallback: boolean;
};

export const SEO_CANONICAL_DEFAULT_PATH = "/" as const;
export const SEO_CANONICAL_MAX_LENGTH = 240 as const;

const BLOCKED_CANONICAL_PREFIXES = ["/admin", "/api", "/dashboard"] as const;

function text(value: unknown, maxLength: number = SEO_CANONICAL_MAX_LENGTH) {
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

export function getDefaultCanonicalPath() {
  return SEO_CANONICAL_DEFAULT_PATH;
}

function normalizeCanonicalPathFormat(pathValue: unknown): string {
  const cleaned = text(pathValue, SEO_CANONICAL_MAX_LENGTH);

  if (!cleaned || cleaned === "/") {
    return getDefaultCanonicalPath();
  }

  if (/^(?:https?:|javascript:|data:)/i.test(cleaned)) {
    return getDefaultCanonicalPath();
  }

  const relative = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  return relative.replace(/\/+$/, "") || getDefaultCanonicalPath();
}

function isBlockedCanonicalPathNormalized(normalized: string): boolean {
  return BLOCKED_CANONICAL_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function isBlockedCanonicalPath(path: string): boolean {
  return isBlockedCanonicalPathNormalized(normalizeCanonicalPathFormat(path));
}

export function normalizeCanonicalPath(pathValue: unknown): string {
  const normalized = normalizeCanonicalPathFormat(pathValue);

  if (isBlockedCanonicalPathNormalized(normalized)) {
    return getDefaultCanonicalPath();
  }

  return normalized;
}

function resolveSafeCanonicalPath(page: SeoPageRuntime, rawCanonical: string) {
  const safeRoute = normalizeCanonicalPath(normalizeSeoPageRoute(page.route));

  if (!rawCanonical) {
    return {
      canonicalPath: safeRoute || getDefaultCanonicalPath(),
      usedRouteFallback: true
    };
  }

  const normalizedCanonical = normalizeCanonicalPath(rawCanonical);

  if (!isBlockedCanonicalPath(normalizedCanonical)) {
    return {
      canonicalPath: normalizedCanonical || getDefaultCanonicalPath(),
      usedRouteFallback: false
    };
  }

  return {
    canonicalPath: safeRoute || getDefaultCanonicalPath(),
    usedRouteFallback: true
  };
}

export function resolveCanonicalFromPage(page: SeoPageRuntime): CanonicalRuntime {
  const rawCanonical = text(page.canonicalPath, SEO_CANONICAL_MAX_LENGTH);
  const resolved = resolveSafeCanonicalPath(page, rawCanonical);
  const canonicalPath = resolved.canonicalPath || getDefaultCanonicalPath();

  return {
    canonicalPath,
    canonicalStatus: resolved.usedRouteFallback ? "missing" : "ready",
    normalizedPath: canonicalPath,
    sourceLabel: page.label,
    usedRouteFallback: resolved.usedRouteFallback
  };
}

export async function resolveCanonicalPathBySlug(slug: string): Promise<CanonicalRuntime> {
  try {
    const page = await resolveSeoPageBySlug(slug);
    return resolveCanonicalFromPage(page);
  } catch (error) {
    console.error("[seo-canonical-runtime] canonical slug resolve failed", error);

    return {
      canonicalPath: getDefaultCanonicalPath(),
      canonicalStatus: "missing",
      normalizedPath: getDefaultCanonicalPath(),
      sourceLabel: slug || "unknown",
      usedRouteFallback: true
    };
  }
}

export async function resolveCanonicalPathByRoute(route: string): Promise<CanonicalRuntime> {
  try {
    const page = await resolveSeoPageByRoute(route);
    return resolveCanonicalFromPage(page);
  } catch (error) {
    console.error("[seo-canonical-runtime] canonical route resolve failed", error);

    return {
      canonicalPath: normalizeCanonicalPath(route),
      canonicalStatus: "missing",
      normalizedPath: normalizeCanonicalPath(route),
      sourceLabel: route || "/",
      usedRouteFallback: true
    };
  }
}

export function mapCanonicalRuntimeToAdminFields(page: SeoPageRuntime) {
  const canonicalRuntime = resolveCanonicalFromPage(page);

  return {
    canonicalPath: canonicalRuntime.canonicalPath,
    canonicalStatus: canonicalRuntime.canonicalStatus
  };
}

// SEO-6+ placeholders: canonical editing and sitemap integration stay disconnected.
export const SEO_CANONICAL_FUTURE_HOOKS = ["seo_canonical_editor", "seo_canonical_sitemap_integration"] as const;
