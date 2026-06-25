import "server-only";

import {
  listPlatformPages,
  type PlatformPageRegistryRecord
} from "@/src/lib/platform-website/platform-pages-registry";

export type SeoRegistrySource = "platform_pages_registry" | "seo_registry_runtime";

export type SeoRegistryItem = {
  canonicalPath: string;
  id: string;
  label: string;
  language: string;
  languageReady: boolean;
  lastUpdated: string | null;
  metaDescription: string;
  metaTitle: string;
  openGraphEnabled: boolean;
  reviewed: boolean;
  route: string;
  slug: string;
  source: SeoRegistrySource;
};

type SeoRegistryDefinition = {
  id: string;
  label: string;
  route: string;
  slug: string;
};

const SEO_REGISTRY_DEFINITIONS: readonly SeoRegistryDefinition[] = [
  { id: "seo:homepage", label: "Homepage", route: "/", slug: "homepage" },
  { id: "seo:pricing", label: "Pricing Page", route: "/pricing", slug: "pricing" },
  { id: "seo:features", label: "Features Page", route: "/features", slug: "features" },
  { id: "seo:about", label: "About Us", route: "/about", slug: "about" },
  { id: "seo:contact", label: "Contact Us", route: "/contact", slug: "contact" },
  { id: "seo:blog", label: "Blog", route: "/blog", slug: "blog" },
  { id: "seo:affiliates", label: "Affiliates Page", route: "/affiliates", slug: "affiliates" },
  { id: "seo:reseller", label: "Reseller Program Page", route: "/reseller", slug: "reseller" },
  { id: "seo:careers", label: "Careers Page", route: "/careers", slug: "careers" },
  { id: "seo:legal", label: "Legal Pages", route: "/legal", slug: "legal" }
] as const;

export const SEO_REGISTRY_PAGE_SLUGS = SEO_REGISTRY_DEFINITIONS.map((item) => item.slug);

function text(value: unknown, maxLength = 500) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolvePrimaryLanguage(languageStatus: Record<string, string>) {
  const languageMap: Record<string, string> = {
    Arabic: "ar",
    English: "en",
    French: "fr"
  };

  for (const [language, status] of Object.entries(languageStatus)) {
    if (status === "ready") {
      return languageMap[language] ?? "en";
    }
  }

  return "en";
}

function hasLanguageReady(languageStatus: Record<string, string>) {
  return Object.values(languageStatus).some((status) => status === "ready");
}

function hasOpenGraphEnabled(openGraph: Record<string, unknown>) {
  if (!Object.keys(openGraph).length) {
    return false;
  }

  const status = text(openGraph.status) || "ready";
  return Boolean(status && !status.toLowerCase().includes("placeholder") && status !== "missing");
}

function buildFallbackSeoRegistryItem(definition: SeoRegistryDefinition): SeoRegistryItem {
  return {
    canonicalPath: definition.route,
    id: definition.id,
    label: definition.label,
    language: "en",
    languageReady: false,
    lastUpdated: null,
    metaDescription: "",
    metaTitle: `${definition.label} - SHASTORE AI`,
    openGraphEnabled: false,
    reviewed: false,
    route: definition.route,
    slug: definition.slug,
    source: "seo_registry_runtime"
  };
}

function buildSeoRegistryItemFromPlatformPage(
  definition: SeoRegistryDefinition,
  page: PlatformPageRegistryRecord
): SeoRegistryItem {
  const openGraph = isRecord(page.openGraph) ? page.openGraph : {};

  return {
    canonicalPath: text(page.canonicalPath, 200) || page.routePath || definition.route,
    id: page.id || definition.id,
    label: page.title || definition.label,
    language: resolvePrimaryLanguage(page.languageStatus),
    languageReady: hasLanguageReady(page.languageStatus),
    lastUpdated: page.updatedAt,
    metaDescription:
      text(page.seoDescription, 500) || "Platform SEO metadata is missing from content storage.",
    metaTitle: text(page.seoTitle, 180) || `${page.title || definition.label} - SHASTORE AI`,
    openGraphEnabled: hasOpenGraphEnabled(openGraph),
    reviewed: false,
    route: page.routePath || definition.route,
    slug: page.slug || definition.slug,
    source: "platform_pages_registry"
  };
}

export function buildSeoRegistryItems(
  platformPages: PlatformPageRegistryRecord[] | null | undefined
): SeoRegistryItem[] {
  const pagesBySlug = new Map(
    (platformPages ?? [])
      .filter((page) => SEO_REGISTRY_PAGE_SLUGS.includes(page.slug))
      .map((page) => [page.slug, page] as const)
  );

  return SEO_REGISTRY_DEFINITIONS.map((definition) => {
    const platformPage = pagesBySlug.get(definition.slug);

    if (!platformPage) {
      return buildFallbackSeoRegistryItem(definition);
    }

    return buildSeoRegistryItemFromPlatformPage(definition, platformPage);
  });
}

export async function getSeoRegistry(): Promise<SeoRegistryItem[]> {
  try {
    const platformPages = await listPlatformPages();
    return buildSeoRegistryItems(platformPages);
  } catch (error) {
    console.error("[seo-registry-runtime] SEO registry load failed", error);
    return SEO_REGISTRY_DEFINITIONS.map(buildFallbackSeoRegistryItem);
  }
}

export async function getSeoRegistryItemBySlug(slug: string): Promise<SeoRegistryItem | null> {
  const cleanedSlug = text(slug, 120);

  if (!cleanedSlug) {
    return null;
  }

  const registry = await getSeoRegistry();
  return registry.find((item) => item.slug === cleanedSlug) ?? null;
}

export async function getSeoRegistryItemByRoute(route: string): Promise<SeoRegistryItem | null> {
  const cleanedRoute = text(route, 200);

  if (!cleanedRoute) {
    return null;
  }

  const normalizedRoute = cleanedRoute.startsWith("/") ? cleanedRoute.replace(/\/+$/, "") || "/" : `/${cleanedRoute}`;
  const registry = await getSeoRegistry();

  return registry.find((item) => item.route === normalizedRoute) ?? null;
}

export function mapSeoRegistryItemToAdminSeoPage(item: SeoRegistryItem): {
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
    canonicalStatus: item.canonicalPath.trim() ? "ready" : "missing",
    languageStatus: item.languageReady ? "ready" : "placeholder",
    lastUpdated: item.lastUpdated,
    metaDescriptionStatus: item.metaDescription.trim() ? "ready" : "missing",
    metaTitleStatus: item.metaTitle.trim() ? "ready" : "missing",
    openGraphStatus: item.openGraphEnabled ? "ready" : "placeholder",
    page: item.label,
    slug: item.slug
  };
}

export function listSeoRegistryCatalog() {
  return SEO_REGISTRY_DEFINITIONS.map((definition) => ({
    label: definition.label,
    route: definition.route,
    slug: definition.slug
  }));
}

// SEO-3+ placeholders: meta editing, AI generator, and review persistence stay disconnected.
export const SEO_REGISTRY_FUTURE_HOOKS = [
  "seo_editor",
  "ai_seo_generator",
  "seo_review_persistence"
] as const;
