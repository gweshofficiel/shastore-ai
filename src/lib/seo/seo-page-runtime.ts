import "server-only";

import {
  getSeoRegistry,
  type SeoRegistryItem,
  type SeoRegistrySource
} from "@/src/lib/seo/seo-registry-runtime";

export type SeoPageRuntimeStatus = "missing" | "placeholder" | "ready";

export type SeoPageRuntime = {
  canonicalPath: string;
  canonicalStatus: SeoPageRuntimeStatus;
  id: string;
  label: string;
  language: string;
  languageReady: boolean;
  languageStatus: SeoPageRuntimeStatus;
  lastUpdated: string | null;
  metaDescription: string;
  metaDescriptionStatus: SeoPageRuntimeStatus;
  metaTitle: string;
  metaTitleStatus: SeoPageRuntimeStatus;
  openGraphEnabled: boolean;
  openGraphExplicitlyDisabled: boolean;
  openGraphImagePath: string;
  openGraphStatus: SeoPageRuntimeStatus;
  reviewed: boolean;
  route: string;
  runtimeReady: boolean;
  safeSummary: string;
  slug: string;
  source: SeoRegistrySource;
};

export const SEO_PAGE_RUNTIME_FALLBACK_ID = "unknown_seo_page" as const;

function text(value: unknown, maxLength = 500) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

export function normalizeSeoPageRoute(route: string) {
  const cleaned = text(route, 200);

  if (!cleaned) {
    return "/";
  }

  const normalized = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;

  return normalized.replace(/\/+$/, "") || "/";
}

function resolveMetaTitleStatus(metaTitle: string): SeoPageRuntimeStatus {
  return metaTitle.trim() ? "ready" : "missing";
}

function resolveMetaDescriptionStatus(metaDescription: string): SeoPageRuntimeStatus {
  return metaDescription.trim() ? "ready" : "missing";
}

function resolveCanonicalStatus(canonicalPath: string): SeoPageRuntimeStatus {
  return canonicalPath.trim() ? "ready" : "missing";
}

function resolveOpenGraphStatus(openGraphEnabled: boolean): SeoPageRuntimeStatus {
  return openGraphEnabled ? "ready" : "placeholder";
}

function resolveLanguageStatus(languageReady: boolean): SeoPageRuntimeStatus {
  return languageReady ? "ready" : "placeholder";
}

export function buildSeoPageRuntimeFromRegistryItem(item: SeoRegistryItem): SeoPageRuntime {
  const metaTitleStatus = resolveMetaTitleStatus(item.metaTitle);
  const metaDescriptionStatus = resolveMetaDescriptionStatus(item.metaDescription);
  const canonicalStatus = resolveCanonicalStatus(item.canonicalPath);
  const openGraphStatus = resolveOpenGraphStatus(item.openGraphEnabled);
  const languageStatus = resolveLanguageStatus(item.languageReady);
  const runtimeReady =
    metaTitleStatus === "ready" &&
    metaDescriptionStatus === "ready" &&
    canonicalStatus === "ready" &&
    openGraphStatus === "ready" &&
    languageStatus === "ready";

  return {
    canonicalPath: item.canonicalPath,
    canonicalStatus,
    id: item.id,
    label: item.label,
    language: item.language,
    languageReady: item.languageReady,
    languageStatus,
    lastUpdated: item.lastUpdated,
    metaDescription: item.metaDescription,
    metaDescriptionStatus,
    metaTitle: item.metaTitle,
    metaTitleStatus,
    openGraphEnabled: item.openGraphEnabled,
    openGraphExplicitlyDisabled: item.openGraphExplicitlyDisabled,
    openGraphImagePath: item.openGraphImagePath,
    openGraphStatus,
    reviewed: item.reviewed,
    route: item.route,
    runtimeReady,
    safeSummary: runtimeReady
      ? `${item.label} SEO page runtime is ready for read-only Super Admin visibility.`
      : `${item.label} SEO page runtime is available with safe read-only fallbacks.`,
    slug: item.slug,
    source: item.source
  };
}

export function buildFallbackSeoPageRuntime(params?: { route?: string; slug?: string }): SeoPageRuntime {
  const slug = text(params?.slug, 120) || "unknown";
  const route = normalizeSeoPageRoute(params?.route ?? "/");
  const label = slug === "unknown" ? "Unknown SEO page" : `Unknown SEO page (${slug})`;

  return {
    canonicalPath: route,
    canonicalStatus: route === "/" ? "ready" : "missing",
    id: SEO_PAGE_RUNTIME_FALLBACK_ID,
    label,
    language: "en",
    languageReady: false,
    languageStatus: "placeholder",
    lastUpdated: null,
    metaDescription: "",
    metaDescriptionStatus: "missing",
    metaTitle: "SHASTORE AI",
    metaTitleStatus: "ready",
    openGraphEnabled: false,
    openGraphExplicitlyDisabled: false,
    openGraphImagePath: "",
    openGraphStatus: "placeholder",
    reviewed: false,
    route,
    runtimeReady: false,
    safeSummary: "Safe SEO page runtime fallback applied for missing or unknown registry page.",
    slug,
    source: "seo_registry_runtime"
  };
}

export async function listSeoPages(): Promise<SeoPageRuntime[]> {
  try {
    const registry = await getSeoRegistry();
    return registry.map(buildSeoPageRuntimeFromRegistryItem);
  } catch (error) {
    console.error("[seo-page-runtime] SEO page list failed", error);
    return [buildFallbackSeoPageRuntime()];
  }
}

export async function resolveSeoPageBySlug(slug: string): Promise<SeoPageRuntime> {
  const cleanedSlug = text(slug, 120);

  if (!cleanedSlug) {
    return buildFallbackSeoPageRuntime();
  }

  try {
    const pages = await listSeoPages();
    return pages.find((page) => page.slug === cleanedSlug) ?? buildFallbackSeoPageRuntime({ slug: cleanedSlug });
  } catch (error) {
    console.error("[seo-page-runtime] SEO page slug resolve failed", error);
    return buildFallbackSeoPageRuntime({ slug: cleanedSlug });
  }
}

export async function resolveSeoPageByRoute(route: string): Promise<SeoPageRuntime> {
  const normalizedRoute = normalizeSeoPageRoute(route);

  try {
    const pages = await listSeoPages();
    return pages.find((page) => page.route === normalizedRoute) ?? buildFallbackSeoPageRuntime({ route: normalizedRoute });
  } catch (error) {
    console.error("[seo-page-runtime] SEO page route resolve failed", error);
    return buildFallbackSeoPageRuntime({ route: normalizedRoute });
  }
}

export function mapSeoPageRuntimeToAdminSeoPage(page: SeoPageRuntime): {
  canonicalStatus: "missing" | "ready";
  languageStatus: "placeholder" | "ready";
  lastUpdated: string | null;
  metaDescriptionStatus: "missing" | "ready";
  metaTitleStatus: "missing" | "ready";
  openGraphStatus: "placeholder" | "ready";
  page: string;
  slug: string;
} {
  return {
    canonicalStatus: page.canonicalStatus === "ready" ? "ready" : "missing",
    languageStatus: page.languageStatus === "ready" ? "ready" : "placeholder",
    lastUpdated: page.lastUpdated,
    metaDescriptionStatus: page.metaDescriptionStatus === "ready" ? "ready" : "missing",
    metaTitleStatus: page.metaTitleStatus === "ready" ? "ready" : "missing",
    openGraphStatus: page.openGraphStatus === "ready" ? "ready" : "placeholder",
    page: page.label,
    slug: page.slug
  };
}

export function listSeoPageRuntimeCatalog() {
  return listSeoPages().then((pages) =>
    pages.map((page) => ({
      label: page.label,
      route: page.route,
      runtimeReady: page.runtimeReady,
      slug: page.slug
    }))
  );
}

// SEO-9+ placeholders stay disconnected.
export const SEO_PAGE_RUNTIME_FUTURE_HOOKS = ["seo_robots_runtime"] as const;
