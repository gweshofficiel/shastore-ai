import "server-only";

import { resolveCanonicalFromPage } from "@/src/lib/seo/seo-canonical-runtime";
import {
  listSeoPages,
  normalizeSeoPageRoute,
  SEO_PAGE_RUNTIME_FALLBACK_ID,
  type SeoPageRuntime
} from "@/src/lib/seo/seo-page-runtime";
import type { SeoRegistrySource } from "@/src/lib/seo/seo-registry-runtime";

export type SitemapChangeFrequency =
  | "always"
  | "daily"
  | "hourly"
  | "monthly"
  | "never"
  | "weekly"
  | "yearly";

export type SitemapEntrySource = SeoRegistrySource | "seo_sitemap_runtime";

export type SitemapEntry = {
  canonicalPath: string;
  changeFrequency: SitemapChangeFrequency;
  lastModified: string | null;
  priority: number;
  route: string;
  source: SitemapEntrySource;
};

export type SitemapRuntimeStatus = "ready" | "warning";

export type SitemapRuntimeSummary = {
  entryCount: number;
  excludedRoutes: string[];
  includedRoutes: string[];
  lastGenerated: string;
  status: SitemapRuntimeStatus;
};

export const SEO_SITEMAP_ROUTE_MAX_LENGTH = 240 as const;

export const SITEMAP_EXCLUDED_ROUTE_PATTERNS = [
  "/admin/*",
  "/api/*",
  "/dashboard/*",
  "/store/*/account",
  "/store/*/cart",
  "/store/*/checkout",
  "/store/*/compare",
  "/store/*/order/*",
  "/store/*/receipt/*",
  "/store/*/track",
  "/store/*/wishlist"
] as const;

const BLOCKED_SITEMAP_PREFIXES = ["/admin", "/api", "/dashboard"] as const;

const BLOCKED_SITEMAP_SEGMENTS = [
  "/account",
  "/cart",
  "/checkout",
  "/compare",
  "/order/",
  "/receipt/",
  "/track",
  "/wishlist"
] as const;

function text(value: unknown, maxLength: number = SEO_SITEMAP_ROUTE_MAX_LENGTH) {
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

function isBlockedSitemapRoute(normalized: string) {
  if (/^(?:https?:|javascript:|data:)/i.test(normalized)) {
    return true;
  }

  if (
    BLOCKED_SITEMAP_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    )
  ) {
    return true;
  }

  const lower = normalized.toLowerCase();

  return BLOCKED_SITEMAP_SEGMENTS.some((segment) => lower.includes(segment));
}

export function normalizeSitemapRoute(route: unknown) {
  const cleaned = text(route, SEO_SITEMAP_ROUTE_MAX_LENGTH);

  if (!cleaned) {
    return "";
  }

  if (/^(?:https?:|javascript:|data:)/i.test(cleaned)) {
    return "";
  }

  const relative = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  const normalized = relative.replace(/\/+$/, "") || "/";

  if (isBlockedSitemapRoute(normalized)) {
    return "";
  }

  return normalized;
}

export function isSitemapAllowedRoute(route: unknown) {
  const normalized = normalizeSitemapRoute(route);
  return Boolean(normalized);
}

function resolveSitemapPriority(route: string) {
  if (route === "/") {
    return 1;
  }

  if (["/features", "/pricing", "/reseller"].includes(route)) {
    return 0.8;
  }

  return 0.6;
}

function resolveSitemapChangeFrequency(route: string): SitemapChangeFrequency {
  if (route === "/blog") {
    return "weekly";
  }

  if (route === "/") {
    return "weekly";
  }

  return "monthly";
}

function buildSitemapEntryFromPage(page: SeoPageRuntime): SitemapEntry | null {
  const route = normalizeSitemapRoute(normalizeSeoPageRoute(page.route));

  if (!route || page.id === SEO_PAGE_RUNTIME_FALLBACK_ID) {
    return null;
  }

  const canonical = resolveCanonicalFromPage(page);
  const canonicalPath = normalizeSitemapRoute(canonical.canonicalPath) || route;

  return {
    canonicalPath,
    changeFrequency: resolveSitemapChangeFrequency(route),
    lastModified: page.lastUpdated,
    priority: resolveSitemapPriority(route),
    route,
    source: page.source
  };
}

function sortSitemapEntries(entries: SitemapEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.route === "/") {
      return -1;
    }

    if (right.route === "/") {
      return 1;
    }

    return left.route.localeCompare(right.route);
  });
}

export async function listSitemapEntries(): Promise<SitemapEntry[]> {
  try {
    const pages = await listSeoPages();
    const entries = pages
      .map((page) => buildSitemapEntryFromPage(page))
      .filter((entry): entry is SitemapEntry => Boolean(entry));

    const uniqueByRoute = new Map<string, SitemapEntry>();

    for (const entry of entries) {
      if (!uniqueByRoute.has(entry.route)) {
        uniqueByRoute.set(entry.route, entry);
      }
    }

    return sortSitemapEntries([...uniqueByRoute.values()]);
  } catch (error) {
    console.error("[seo-sitemap-runtime] sitemap entry list failed", error);
    return [];
  }
}

export async function resolveSitemapEntryByRoute(route: string): Promise<SitemapEntry | null> {
  const normalizedRoute = normalizeSitemapRoute(route);

  if (!normalizedRoute) {
    return null;
  }

  try {
    const entries = await listSitemapEntries();
    return entries.find((entry) => entry.route === normalizedRoute) ?? null;
  } catch (error) {
    console.error("[seo-sitemap-runtime] sitemap route resolve failed", error);
    return null;
  }
}

export async function mapSitemapRuntimeToAdminFields(): Promise<SitemapRuntimeSummary> {
  const entries = await listSitemapEntries();
  const includedRoutes = entries.map((entry) => entry.route);

  return {
    entryCount: entries.length,
    excludedRoutes: [...SITEMAP_EXCLUDED_ROUTE_PATTERNS],
    includedRoutes,
    lastGenerated: `Generated dynamically by app/sitemap.ts (${entries.length} platform routes)`,
    status: entries.length > 0 ? "ready" : "warning"
  };
}

// SEO-10+ placeholders: sitemap regeneration and store route merging stay disconnected.
export const SEO_SITEMAP_FUTURE_HOOKS = ["seo_sitemap_regeneration", "seo_sitemap_store_merge"] as const;
