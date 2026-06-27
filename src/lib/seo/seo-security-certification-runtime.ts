import "server-only";

import { validateAiSeoRuntime, getAiSeoGeneratorPlaceholder } from "@/src/lib/seo/seo-ai-runtime";
import { validateAnalyticsRuntime, getAnalyticsConnectionPlaceholder } from "@/src/lib/seo/seo-analytics-runtime";
import { isBlockedCanonicalPath, normalizeCanonicalPath } from "@/src/lib/seo/seo-canonical-runtime";
import { getSeoEditableFields, validateSeoEditorRuntime } from "@/src/lib/seo/seo-editor-runtime";
import { generateSeoExportSnapshot, validateSeoExportRuntime } from "@/src/lib/seo/seo-export-runtime";
import { getFaqSchemaPlaceholder, getFaqSchemaByRoute, validateFaqSchema } from "@/src/lib/seo/seo-faq-schema-runtime";
import { resolveOpenGraphFromPage } from "@/src/lib/seo/seo-open-graph-runtime";
import {
  getOrganizationSchema,
  validateOrganizationSchema
} from "@/src/lib/seo/seo-organization-schema-runtime";
import { listSeoPages, normalizeSeoPageRoute, type SeoPageRuntime } from "@/src/lib/seo/seo-page-runtime";
import {
  getProductSchemaPlaceholder,
  getProductSchemaByRoute,
  validateProductSchema
} from "@/src/lib/seo/seo-product-schema-runtime";
import { getSeoRegistry } from "@/src/lib/seo/seo-registry-runtime";
import { getRobotsRuntimeRules, isRobotsAllowedRoute } from "@/src/lib/seo/seo-robots-runtime";
import { listSeoSafeActions, validateSeoSafeAction } from "@/src/lib/seo/seo-safe-action-runtime";
import {
  getSearchConsoleConnectionPlaceholder,
  validateSearchConsoleRuntime
} from "@/src/lib/seo/seo-search-console-runtime";
import { isSitemapAllowedRoute, listSitemapEntries } from "@/src/lib/seo/seo-sitemap-runtime";
import {
  isStructuredDataAllowedRoute,
  resolveStructuredDataByRoute
} from "@/src/lib/seo/seo-structured-data-runtime";
import { getWebsiteSchema, validateWebsiteSchema } from "@/src/lib/seo/seo-website-schema-runtime";

export type SeoSecurityCertificationStatus = "certified" | "needs_attention";

export type SeoSecurityCertificationSource = "seo_security_certification_runtime";

export type SeoSecurityCertificationCheck = {
  id: string;
  label: string;
  message: string;
  passed: boolean;
};

export type SeoSecurityCertificationResult = {
  checks: SeoSecurityCertificationCheck[];
  failedChecks: number;
  generatedAt: string;
  passedChecks: number;
  readOnly: true;
  source: SeoSecurityCertificationSource;
  status: SeoSecurityCertificationStatus;
  totalChecks: number;
  warnings: string[];
};

export type SeoSecurityCertificationSummary = {
  readOnly: true;
  status: SeoSecurityCertificationStatus;
  summary: string;
};

export type SeoSecurityCertificationValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_SECURITY_CERTIFICATION_SOURCE = "seo_security_certification_runtime" as const;

const PRIVATE_ROUTE_SEGMENTS = [
  "/account",
  "/cart",
  "/checkout",
  "/compare",
  "/order/",
  "/receipt/",
  "/track",
  "/wishlist"
] as const;

const BLOCKED_ROUTE_PREFIXES = ["/admin", "/api", "/dashboard"] as const;

const BLOCKED_SECURITY_TEST_ROUTES = [
  "/admin",
  "/admin/seo",
  "/api/health",
  "/dashboard",
  "/store/example/account",
  "/store/example/cart",
  "/store/example/checkout",
  "/store/example/order/123",
  "/store/example/track",
  "/store/example/wishlist"
] as const;

function buildCheck(
  id: string,
  label: string,
  passed: boolean,
  successMessage: string,
  failureMessage: string
): SeoSecurityCertificationCheck {
  return {
    id,
    label,
    message: passed ? successMessage : failureMessage,
    passed
  };
}

function normalizeRoute(route: string) {
  return normalizeSeoPageRoute(route);
}

function isAdminRoute(route: string) {
  const normalized = normalizeRoute(route).toLowerCase();
  return normalized === "/admin" || normalized.startsWith("/admin/");
}

function isApiRoute(route: string) {
  const normalized = normalizeRoute(route).toLowerCase();
  return normalized === "/api" || normalized.startsWith("/api/");
}

function isDashboardRoute(route: string) {
  const normalized = normalizeRoute(route).toLowerCase();
  return normalized === "/dashboard" || normalized.startsWith("/dashboard/");
}

function isPrivateCommerceRoute(route: string) {
  const normalized = normalizeRoute(route).toLowerCase();
  return PRIVATE_ROUTE_SEGMENTS.some((segment) => normalized.includes(segment));
}

function openGraphDisabledForPrivateRoute(page: SeoPageRuntime) {
  return resolveOpenGraphFromPage(page);
}

function buildSecurityTestPage(route: string): SeoPageRuntime {
  const normalizedRoute = normalizeRoute(route);

  return {
    canonicalPath: normalizedRoute,
    canonicalStatus: "ready",
    id: "seo:security_test",
    label: "Security test page",
    language: "en",
    languageReady: true,
    languageStatus: "ready",
    lastUpdated: null,
    metaDescription: "Security certification test page.",
    metaDescriptionStatus: "ready",
    metaTitle: "Security certification test page",
    metaTitleStatus: "ready",
    openGraphEnabled: true,
    openGraphExplicitlyDisabled: false,
    openGraphImagePath: "/opengraph-image.png",
    openGraphStatus: "ready",
    reviewed: false,
    route: normalizedRoute,
    runtimeReady: true,
    safeSummary: "Security certification synthetic page.",
    slug: "security-test",
    source: "seo_registry_runtime"
  };
}

function finalizeSecurityCertificationResult(
  checks: SeoSecurityCertificationCheck[]
): SeoSecurityCertificationResult {
  const passedChecks = checks.filter((check) => check.passed).length;
  const failedChecks = checks.length - passedChecks;
  const warnings = checks.filter((check) => !check.passed).map((check) => `${check.label}: ${check.message}`);

  return {
    checks,
    failedChecks,
    generatedAt: new Date().toISOString(),
    passedChecks,
    readOnly: true,
    source: SEO_SECURITY_CERTIFICATION_SOURCE,
    status: failedChecks === 0 ? "certified" : "needs_attention",
    totalChecks: checks.length,
    warnings
  };
}

export async function runSeoSecurityCertification(): Promise<SeoSecurityCertificationResult> {
  const [
    registryItems,
    seoPages,
    sitemapEntries,
    robotsRules,
    exportSnapshot,
    structuredDataPrivate,
    productSchemaPrivate,
    faqSchemaPrivate
  ] = await Promise.all([
    getSeoRegistry(),
    listSeoPages(),
    listSitemapEntries(),
    getRobotsRuntimeRules(),
    generateSeoExportSnapshot(),
    resolveStructuredDataByRoute("/admin/seo"),
    getProductSchemaByRoute("/store/example/account"),
    getFaqSchemaByRoute("/admin/help")
  ]);

  const editorFields = getSeoEditableFields();
  const aiSeoPlaceholder = getAiSeoGeneratorPlaceholder();
  const organizationSchema = getOrganizationSchema();
  const websiteSchema = getWebsiteSchema();
  const productSchema = getProductSchemaPlaceholder();
  const faqSchema = getFaqSchemaPlaceholder();
  const searchConsoleConnection = getSearchConsoleConnectionPlaceholder();
  const analyticsConnection = getAnalyticsConnectionPlaceholder();
  const safeActions = listSeoSafeActions();

  const registryRoutes = [...registryItems.map((item) => item.route), ...seoPages.map((page) => page.route)];

  const checks: SeoSecurityCertificationCheck[] = [
    buildCheck(
      "registry_no_admin_routes",
      "No admin routes exposed in SEO registry",
      registryRoutes.every((route) => !isAdminRoute(route)),
      "SEO registry does not expose admin routes.",
      "SEO registry exposes one or more admin routes."
    ),
    buildCheck(
      "registry_no_api_routes",
      "No api routes exposed in SEO registry",
      registryRoutes.every((route) => !isApiRoute(route)),
      "SEO registry does not expose api routes.",
      "SEO registry exposes one or more api routes."
    ),
    buildCheck(
      "registry_no_dashboard_routes",
      "No dashboard routes exposed in SEO registry",
      registryRoutes.every((route) => !isDashboardRoute(route)),
      "SEO registry does not expose dashboard routes.",
      "SEO registry exposes one or more dashboard routes."
    ),
    buildCheck(
      "registry_no_private_commerce_routes",
      "No private commerce routes exposed as public SEO pages",
      registryRoutes.every((route) => !isPrivateCommerceRoute(route)),
      "SEO registry does not expose account, cart, checkout, order, track, or wishlist routes.",
      "SEO registry exposes one or more private commerce routes."
    ),
    buildCheck(
      "canonical_blocks_private_routes",
      "Canonical runtime blocks private routes",
      BLOCKED_SECURITY_TEST_ROUTES.every((route) => isBlockedCanonicalPath(route)) &&
        seoPages.every((page) => !isBlockedCanonicalPath(normalizeCanonicalPath(page.canonicalPath))),
      "Canonical runtime blocks admin, api, dashboard, and private routes.",
      "Canonical runtime allows one or more private routes."
    ),
    buildCheck(
      "sitemap_excludes_private_routes",
      "Sitemap runtime excludes private routes",
      sitemapEntries.every((entry) => isSitemapAllowedRoute(entry.route)) &&
        BLOCKED_SECURITY_TEST_ROUTES.every((route) => !isSitemapAllowedRoute(route)),
      "Sitemap runtime excludes private and admin routes.",
      "Sitemap runtime includes one or more private routes."
    ),
    buildCheck(
      "robots_blocks_private_routes",
      "Robots runtime blocks private routes",
      robotsRules.disallowedRoutes.length > 0 &&
        BLOCKED_SECURITY_TEST_ROUTES.every((route) => !isRobotsAllowedRoute(route)),
      "Robots runtime blocks private and admin routes.",
      "Robots runtime allows one or more private routes."
    ),
    buildCheck(
      "open_graph_private_route_safe",
      "Open Graph runtime does not generate data for private routes",
      BLOCKED_SECURITY_TEST_ROUTES.every((route) => !openGraphDisabledForPrivateRoute(buildSecurityTestPage(route)).enabled),
      "Open Graph runtime disables generation for private routes.",
      "Open Graph runtime generates data for one or more private routes."
    ),
    buildCheck(
      "structured_data_private_route_safe",
      "Structured data runtime does not generate schema for private routes",
      !structuredDataPrivate.allowed &&
        structuredDataPrivate.schemas.length === 0 &&
        BLOCKED_SECURITY_TEST_ROUTES.every((route) => !isStructuredDataAllowedRoute(route)),
      "Structured data runtime blocks schema generation for private routes.",
      "Structured data runtime generates schema for one or more private routes."
    ),
    buildCheck(
      "organization_schema_public_only",
      "Organization schema exposes public platform data only",
      validateOrganizationSchema(organizationSchema).isValid,
      "Organization schema exposes public platform data only.",
      "Organization schema failed public-only security validation."
    ),
    buildCheck(
      "website_schema_public_only",
      "Website schema exposes public platform data only",
      validateWebsiteSchema(websiteSchema).isValid,
      "Website schema exposes public platform data only.",
      "Website schema failed public-only security validation."
    ),
    buildCheck(
      "product_schema_no_private_commerce_data",
      "Product schema does not expose seller/buyer/private tenant data",
      validateProductSchema(productSchema).isValid && productSchemaPrivate === null,
      "Product schema remains a public-safe placeholder without private commerce data.",
      "Product schema failed private commerce security validation."
    ),
    buildCheck(
      "faq_schema_no_internal_content",
      "FAQ schema does not expose internal/admin-only content",
      validateFaqSchema(faqSchema).isValid && faqSchemaPrivate === null,
      "FAQ schema remains a public-safe placeholder without internal content.",
      "FAQ schema failed internal content security validation."
    ),
    buildCheck(
      "search_console_no_tokens",
      "Search Console runtime stores no tokens",
      validateSearchConsoleRuntime(searchConsoleConnection).isValid,
      "Search Console runtime stores no OAuth tokens or secrets.",
      "Search Console runtime failed token-free security validation."
    ),
    buildCheck(
      "analytics_no_tokens_or_tracking",
      "Analytics runtime stores no tokens and injects no tracking scripts",
      validateAnalyticsRuntime(analyticsConnection).isValid,
      "Analytics runtime stores no tokens and injects no tracking scripts.",
      "Analytics runtime failed token-free security validation."
    ),
    buildCheck(
      "safe_actions_non_destructive",
      "SEO Safe Actions are non-destructive",
      safeActions.every((action) => validateSeoSafeAction(action.id).isValid && action.destructive === false),
      "All SEO safe actions remain non-destructive.",
      "One or more SEO safe actions failed non-destructive security validation."
    ),
    buildCheck(
      "export_no_filesystem_access",
      "SEO Export does not access filesystem or generate files",
      validateSeoExportRuntime(exportSnapshot).isValid &&
        exportSnapshot.readOnly === true &&
        !JSON.stringify(exportSnapshot).includes(".csv") &&
        !JSON.stringify(exportSnapshot).includes(".pdf"),
      "SEO export runtime remains in-memory only with no filesystem access.",
      "SEO export runtime failed filesystem-free security validation."
    ),
    buildCheck(
      "editor_validation_only",
      "SEO Editor is validation-only",
      validateSeoEditorRuntime(editorFields).isValid &&
        editorFields.every((field) => field.implemented === false),
      "SEO editor runtime remains validation-only.",
      "SEO editor runtime failed validation-only security checks."
    ),
    buildCheck(
      "ai_seo_no_provider_calls",
      "AI SEO does not call AI providers or send prompts",
      validateAiSeoRuntime(aiSeoPlaceholder).isValid &&
        aiSeoPlaceholder.generated === false &&
        aiSeoPlaceholder.readOnly === true,
      "AI SEO runtime remains placeholder-only without provider calls or prompts.",
      "AI SEO runtime failed provider-free security validation."
    )
  ];

  return finalizeSecurityCertificationResult(checks);
}

export function getSeoSecurityCertificationStatus(
  result: SeoSecurityCertificationResult
): SeoSecurityCertificationStatus {
  return result.status;
}

export function getSeoSecurityCertificationSummary(
  result: SeoSecurityCertificationResult
): SeoSecurityCertificationSummary {
  return {
    readOnly: true,
    status: result.status,
    summary: [
      `status ${result.status}`,
      `${result.passedChecks}/${result.totalChecks} checks passed`,
      `${result.failedChecks} failed`,
      `${result.warnings.length} warning(s)`
    ].join("; ")
  };
}

export function validateSeoSecurityCertification(
  result: SeoSecurityCertificationResult
): SeoSecurityCertificationValidation {
  const issues: string[] = [];

  if (!result.readOnly) {
    issues.push("SEO security certification must remain read-only.");
  }

  if (result.source !== SEO_SECURITY_CERTIFICATION_SOURCE) {
    issues.push("SEO security certification must originate from the security certification runtime.");
  }

  if (!result.generatedAt) {
    issues.push("SEO security certification must include a generatedAt timestamp.");
  }

  if (result.totalChecks !== result.checks.length) {
    issues.push("SEO security certification totalChecks must match the check list length.");
  }

  if (result.passedChecks + result.failedChecks !== result.totalChecks) {
    issues.push("SEO security certification passed and failed counts must match totalChecks.");
  }

  if (result.failedChecks !== result.warnings.length) {
    issues.push("SEO security certification warnings must match failed check count.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapSeoSecurityCertificationRuntimeToAdminFields() {
  const result = await runSeoSecurityCertification();
  const validation = validateSeoSecurityCertification(result);
  const summary = getSeoSecurityCertificationSummary(result);

  return {
    failedChecks: result.failedChecks,
    generatedAt: result.generatedAt,
    passedChecks: result.passedChecks,
    readOnly: true,
    status: validation.isValid ? summary.status : "needs_attention",
    summary: validation.isValid
      ? summary.summary
      : "SEO security certification validation requires safe read-only defaults.",
    totalChecks: result.totalChecks,
    warnings: result.warnings
  };
}

// SEO-28+ placeholders: runtime and production certification stay disconnected.
export const SEO_SECURITY_CERTIFICATION_FUTURE_HOOKS = [
  "seo_runtime_certification",
  "seo_production_certification"
] as const;
