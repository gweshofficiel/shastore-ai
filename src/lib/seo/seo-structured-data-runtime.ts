import "server-only";

import { getAppBaseUrl } from "@/lib/deployment/config";
import { resolveCanonicalFromPage } from "@/src/lib/seo/seo-canonical-runtime";
import { resolveMetaDescriptionFromPage } from "@/src/lib/seo/seo-meta-description-runtime";
import { resolveMetaTitleFromPage } from "@/src/lib/seo/seo-meta-title-runtime";
import {
  normalizeSeoPageRoute,
  resolveSeoPageByRoute,
  resolveSeoPageBySlug,
  SEO_PAGE_RUNTIME_FALLBACK_ID,
  type SeoPageRuntime
} from "@/src/lib/seo/seo-page-runtime";
import { isRobotsAllowedRoute, normalizeRobotsRoute } from "@/src/lib/seo/seo-robots-runtime";
import { listSitemapEntries } from "@/src/lib/seo/seo-sitemap-runtime";
import {
  getOrganizationSchema,
  mapOrganizationSchemaRuntimeToAdminFields
} from "@/src/lib/seo/seo-organization-schema-runtime";
import {
  getWebsiteSchema,
  mapWebsiteSchemaRuntimeToAdminFields
} from "@/src/lib/seo/seo-website-schema-runtime";

export type StructuredDataRuntimeStatus = "placeholder" | "ready";

export type StructuredDataSchemaType =
  | "BreadcrumbList"
  | "FAQPage"
  | "Organization"
  | "Product"
  | "WebPage"
  | "WebSite";

export type StructuredDataTypeKey =
  | "breadcrumb"
  | "faq"
  | "organization"
  | "product"
  | "website";

export type StructuredDataSchemaObject = {
  "@context": "https://schema.org";
  "@type": StructuredDataSchemaType;
  [key: string]: unknown;
};

export type StructuredDataTypeDefinition = {
  key: StructuredDataTypeKey;
  name: string;
  note: string;
  status: StructuredDataRuntimeStatus;
};

export type StructuredDataRouteResolution = {
  allowed: boolean;
  route: string;
  schemas: StructuredDataSchemaObject[];
  sourceLabel: string;
  types: StructuredDataTypeDefinition[];
};

export type StructuredDataRuntimeSummary = {
  structuredData: StructuredDataTypeDefinition[];
  structuredDataStatus: StructuredDataRuntimeStatus;
};

export const SEO_STRUCTURED_DATA_DEFAULT_ORGANIZATION = "SHASTORE AI" as const;
export const SEO_STRUCTURED_DATA_DEFAULT_DESCRIPTION =
  "AI copy and template-based ecommerce landing pages for products." as const;

const STATIC_STRUCTURED_DATA_TYPES: readonly StructuredDataTypeDefinition[] = [
  {
    key: "breadcrumb",
    name: "Breadcrumb schema",
    note: "Reserved for public platform and store route breadcrumbs.",
    status: "placeholder"
  },
  {
    key: "product",
    name: "Product schema placeholder",
    note: "Store product structured data belongs to Store Owner SEO and storefront runtime.",
    status: "placeholder"
  },
  {
    key: "faq",
    name: "FAQ schema placeholder",
    note: "Reserved for platform FAQ and store FAQ pages without duplicating Store Owner SEO.",
    status: "placeholder"
  }
] as const;

function siteBaseUrl() {
  return getAppBaseUrl().replace(/\/+$/, "");
}

function absoluteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteBaseUrl()}${normalizedPath}`;
}

function buildWebPageSchema(params: {
  description: string;
  route: string;
  title: string;
}): StructuredDataSchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    description: params.description,
    name: params.title,
    url: absoluteUrl(params.route)
  };
}

function buildBreadcrumbPlaceholder(): StructuredDataSchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [],
    name: "Breadcrumb schema placeholder"
  };
}

function buildProductPlaceholder(): StructuredDataSchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Product schema placeholder",
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/PreOrder"
    }
  };
}

function buildFaqPlaceholder(): StructuredDataSchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [],
    name: "FAQ schema placeholder"
  };
}

export function listStructuredDataTypes(): StructuredDataTypeDefinition[] {
  const organization = mapOrganizationSchemaRuntimeToAdminFields();
  const website = mapWebsiteSchemaRuntimeToAdminFields();

  return [
    {
      key: "organization",
      name: organization.name,
      note: organization.note,
      status: organization.status
    },
    {
      key: "website",
      name: website.name,
      note: website.note,
      status: website.status
    },
    ...STATIC_STRUCTURED_DATA_TYPES.map((item) => ({ ...item }))
  ];
}

export function getStructuredDataRuntimeStatus(): StructuredDataRuntimeStatus {
  return listStructuredDataTypes().every((item) => item.status === "ready") ? "ready" : "placeholder";
}

export function isStructuredDataAllowedRoute(route: unknown) {
  const normalized = normalizeRobotsRoute(route);

  if (!normalized || !isRobotsAllowedRoute(normalized)) {
    return false;
  }

  return !["/admin", "/api", "/dashboard"].some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

function buildBlockedStructuredDataResolution(route: string): StructuredDataRouteResolution {
  return {
    allowed: false,
    route,
    schemas: [],
    sourceLabel: route || "blocked",
    types: listStructuredDataTypes()
  };
}

function buildStructuredDataFromPage(page: SeoPageRuntime): StructuredDataRouteResolution {
  const route = normalizeRobotsRoute(normalizeSeoPageRoute(page.route)) || "/";
  const metaTitle = resolveMetaTitleFromPage(page);
  const metaDescription = resolveMetaDescriptionFromPage(page);
  const canonical = resolveCanonicalFromPage(page);
  const safeRoute = canonical.canonicalPath || route;
  const description = metaDescription.metaDescription || SEO_STRUCTURED_DATA_DEFAULT_DESCRIPTION;
  const title = metaTitle.metaTitle || SEO_STRUCTURED_DATA_DEFAULT_ORGANIZATION;

  return {
    allowed: true,
    route: safeRoute,
    schemas: [
      getOrganizationSchema(),
      getWebsiteSchema(description),
      buildWebPageSchema({
        description,
        route: safeRoute,
        title
      }),
      buildBreadcrumbPlaceholder(),
      buildProductPlaceholder(),
      buildFaqPlaceholder()
    ],
    sourceLabel: page.label,
    types: listStructuredDataTypes()
  };
}

export async function resolveStructuredDataBySlug(slug: string): Promise<StructuredDataRouteResolution> {
  try {
    const page = await resolveSeoPageBySlug(slug);
    const route = normalizeRobotsRoute(normalizeSeoPageRoute(page.route));

    if (!route || page.id === SEO_PAGE_RUNTIME_FALLBACK_ID || !isStructuredDataAllowedRoute(route)) {
      return buildBlockedStructuredDataResolution(route || "/");
    }

    const sitemapEntries = await listSitemapEntries();
    const isPlatformRoute = sitemapEntries.some((entry) => entry.route === route);

    if (!isPlatformRoute) {
      return buildBlockedStructuredDataResolution(route);
    }

    return buildStructuredDataFromPage(page);
  } catch (error) {
    console.error("[seo-structured-data-runtime] structured data slug resolve failed", error);
    return buildBlockedStructuredDataResolution(slug || "/");
  }
}

export async function resolveStructuredDataByRoute(route: string): Promise<StructuredDataRouteResolution> {
  const normalizedRoute = normalizeRobotsRoute(route);

  if (!normalizedRoute || !isStructuredDataAllowedRoute(normalizedRoute)) {
    return buildBlockedStructuredDataResolution(normalizedRoute || "/");
  }

  try {
    const sitemapEntries = await listSitemapEntries();
    const isPlatformRoute = sitemapEntries.some((entry) => entry.route === normalizedRoute);

    if (!isPlatformRoute) {
      return buildBlockedStructuredDataResolution(normalizedRoute);
    }

    const page = await resolveSeoPageByRoute(normalizedRoute);

    if (page.id === SEO_PAGE_RUNTIME_FALLBACK_ID) {
      return buildBlockedStructuredDataResolution(normalizedRoute);
    }

    return buildStructuredDataFromPage(page);
  } catch (error) {
    console.error("[seo-structured-data-runtime] structured data route resolve failed", error);
    return buildBlockedStructuredDataResolution(normalizedRoute);
  }
}

export function mapStructuredDataRuntimeToAdminFields(): StructuredDataRuntimeSummary {
  const structuredData = listStructuredDataTypes();

  return {
    structuredData,
    structuredDataStatus: getStructuredDataRuntimeStatus()
  };
}

// SEO-13+ placeholders: full breadcrumb, product, and FAQ JSON-LD stay disconnected.
export const SEO_STRUCTURED_DATA_FUTURE_HOOKS = [
  "seo_breadcrumb_schema",
  "seo_product_schema",
  "seo_faq_schema"
] as const;
