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
import {
  buildBreadcrumbSchemaFromSeoPage,
  mapBreadcrumbSchemaRuntimeToAdminFields
} from "@/src/lib/seo/seo-breadcrumb-schema-runtime";
import {
  getProductSchemaPlaceholder,
  mapProductSchemaRuntimeToAdminFields
} from "@/src/lib/seo/seo-product-schema-runtime";
import {
  getFaqSchemaPlaceholder,
  mapFaqSchemaRuntimeToAdminFields
} from "@/src/lib/seo/seo-faq-schema-runtime";

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

export function listStructuredDataTypes(): StructuredDataTypeDefinition[] {
  const organization = mapOrganizationSchemaRuntimeToAdminFields();
  const website = mapWebsiteSchemaRuntimeToAdminFields();
  const breadcrumb = mapBreadcrumbSchemaRuntimeToAdminFields();
  const product = mapProductSchemaRuntimeToAdminFields();
  const faq = mapFaqSchemaRuntimeToAdminFields();

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
    {
      key: "breadcrumb",
      name: breadcrumb.name,
      note: breadcrumb.note,
      status: breadcrumb.status
    },
    {
      key: "product",
      name: product.name,
      note: product.note,
      status: product.status
    },
    {
      key: "faq",
      name: faq.name,
      note: faq.note,
      status: faq.status
    }
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

  const breadcrumbSchema = buildBreadcrumbSchemaFromSeoPage(page);

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
      breadcrumbSchema ?? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: []
      },
      getProductSchemaPlaceholder(),
      getFaqSchemaPlaceholder()
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

// SEO-16+ placeholders: structured data editor and public content integration stay disconnected.
export const SEO_STRUCTURED_DATA_FUTURE_HOOKS = ["seo_structured_data_editor"] as const;
