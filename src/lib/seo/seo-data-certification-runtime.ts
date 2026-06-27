import "server-only";

import { validateAiSeoRuntime, getAiSeoGeneratorPlaceholder } from "@/src/lib/seo/seo-ai-runtime";
import {
  runSeoAuditSnapshot,
  validateSeoAuditRuntime
} from "@/src/lib/seo/seo-audit-runtime";
import { validateAnalyticsRuntime, isAnalyticsConnected } from "@/src/lib/seo/seo-analytics-runtime";
import {
  buildBreadcrumbSchemaFromSeoPage,
  validateBreadcrumbSchema
} from "@/src/lib/seo/seo-breadcrumb-schema-runtime";
import { isBlockedCanonicalPath, resolveCanonicalFromPage } from "@/src/lib/seo/seo-canonical-runtime";
import {
  getSeoEditableFields,
  validateSeoEditorRuntime
} from "@/src/lib/seo/seo-editor-runtime";
import {
  generateSeoExportSnapshot,
  validateSeoExportRuntime
} from "@/src/lib/seo/seo-export-runtime";
import { validateFaqSchema, getFaqSchemaPlaceholder } from "@/src/lib/seo/seo-faq-schema-runtime";
import { listIndexingWarnings } from "@/src/lib/seo/seo-indexing-warning-runtime";
import { resolveSeoLanguageFromPage } from "@/src/lib/seo/seo-language-runtime";
import { resolveMetaDescriptionFromPage } from "@/src/lib/seo/seo-meta-description-runtime";
import { resolveMetaTitleFromPage } from "@/src/lib/seo/seo-meta-title-runtime";
import { resolveOpenGraphFromPage } from "@/src/lib/seo/seo-open-graph-runtime";
import {
  getOrganizationSchema,
  validateOrganizationSchema
} from "@/src/lib/seo/seo-organization-schema-runtime";
import { listSeoPages, SEO_PAGE_RUNTIME_FALLBACK_ID } from "@/src/lib/seo/seo-page-runtime";
import {
  getProductSchemaPlaceholder,
  validateProductSchema
} from "@/src/lib/seo/seo-product-schema-runtime";
import { getSeoRegistry } from "@/src/lib/seo/seo-registry-runtime";
import {
  generateSeoReportSnapshot,
  validateSeoReportRuntime
} from "@/src/lib/seo/seo-report-runtime";
import {
  listSeoReviewItems,
  validateSeoReviewRuntime
} from "@/src/lib/seo/seo-review-runtime";
import { getRobotsRuntimeRules } from "@/src/lib/seo/seo-robots-runtime";
import {
  listSeoSafeActions,
  validateSeoSafeAction
} from "@/src/lib/seo/seo-safe-action-runtime";
import {
  validateSearchConsoleRuntime,
  isSearchConsoleConnected
} from "@/src/lib/seo/seo-search-console-runtime";
import {
  isSitemapAllowedRoute,
  listSitemapEntries,
  mapSitemapRuntimeToAdminFields
} from "@/src/lib/seo/seo-sitemap-runtime";
import { mapStructuredDataRuntimeToAdminFields } from "@/src/lib/seo/seo-structured-data-runtime";
import {
  getWebsiteSchema,
  validateWebsiteSchema
} from "@/src/lib/seo/seo-website-schema-runtime";

export type SeoDataCertificationStatus = "certified" | "needs_attention";

export type SeoDataCertificationSource = "seo_data_certification_runtime";

export type SeoDataCertificationCheck = {
  id: string;
  label: string;
  message: string;
  passed: boolean;
};

export type SeoDataCertificationResult = {
  checks: SeoDataCertificationCheck[];
  failedChecks: number;
  generatedAt: string;
  passedChecks: number;
  readOnly: true;
  source: SeoDataCertificationSource;
  status: SeoDataCertificationStatus;
  totalChecks: number;
  warnings: string[];
};

export type SeoDataCertificationSummary = {
  readOnly: true;
  status: SeoDataCertificationStatus;
  summary: string;
};

export type SeoDataCertificationValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_DATA_CERTIFICATION_SOURCE = "seo_data_certification_runtime" as const;

const FORBIDDEN_TEXT_PATTERNS = [
  /@/,
  /\b(?:api[_-]?key|secret|token|password|billing|tenant|reseller|supabase|stripe)\b/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
] as const;

function isSafePublicText(value: string) {
  const cleaned = value.trim();
  if (!cleaned) {
    return false;
  }

  return !FORBIDDEN_TEXT_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function buildCheck(
  id: string,
  label: string,
  passed: boolean,
  successMessage: string,
  failureMessage: string
): SeoDataCertificationCheck {
  return {
    id,
    label,
    message: passed ? successMessage : failureMessage,
    passed
  };
}

function finalizeCertificationResult(checks: SeoDataCertificationCheck[]): SeoDataCertificationResult {
  const passedChecks = checks.filter((check) => check.passed).length;
  const failedChecks = checks.length - passedChecks;
  const warnings = checks.filter((check) => !check.passed).map((check) => `${check.label}: ${check.message}`);

  return {
    checks,
    failedChecks,
    generatedAt: new Date().toISOString(),
    passedChecks,
    readOnly: true,
    source: SEO_DATA_CERTIFICATION_SOURCE,
    status: failedChecks === 0 ? "certified" : "needs_attention",
    totalChecks: checks.length,
    warnings
  };
}

export async function runSeoDataCertification(): Promise<SeoDataCertificationResult> {
  const [
    registryItems,
    seoPages,
    sitemapEntries,
    sitemapRuntime,
    robotsRules,
    structuredDataRuntime,
    indexingWarnings,
    auditSnapshot,
    reportSnapshot,
    exportSnapshot,
    reviewItems,
    safeActions
  ] = await Promise.all([
    getSeoRegistry(),
    listSeoPages(),
    listSitemapEntries(),
    mapSitemapRuntimeToAdminFields(),
    getRobotsRuntimeRules(),
    Promise.resolve(mapStructuredDataRuntimeToAdminFields()),
    listIndexingWarnings(),
    runSeoAuditSnapshot(),
    generateSeoReportSnapshot(),
    generateSeoExportSnapshot(),
    listSeoReviewItems(),
    Promise.resolve(listSeoSafeActions())
  ]);

  const editorFields = getSeoEditableFields();
  const aiSeoPlaceholder = getAiSeoGeneratorPlaceholder();
  const organizationSchema = getOrganizationSchema();
  const websiteSchema = getWebsiteSchema();
  const productSchema = getProductSchemaPlaceholder();
  const faqSchema = getFaqSchemaPlaceholder();

  const publicPages = seoPages.filter((page) => page.id !== SEO_PAGE_RUNTIME_FALLBACK_ID);
  const pageIds = publicPages.map((page) => page.id);
  const slugs = publicPages.map((page) => page.slug);
  const routes = publicPages.map((page) => page.route);

  const checks: SeoDataCertificationCheck[] = [
    buildCheck(
      "public_seo_pages_exist",
      "Public SEO pages exist",
      publicPages.length > 0,
      `${publicPages.length} public SEO page(s) available.`,
      "No public SEO pages were found in the registry runtime."
    ),
    buildCheck(
      "page_ids_unique",
      "Page ids are unique",
      new Set(pageIds).size === pageIds.length,
      "All SEO page ids are unique.",
      "Duplicate SEO page ids were detected."
    ),
    buildCheck(
      "slugs_unique",
      "Slugs are unique",
      new Set(slugs).size === slugs.length,
      "All SEO page slugs are unique.",
      "Duplicate SEO page slugs were detected."
    ),
    buildCheck(
      "routes_unique",
      "Routes are unique",
      new Set(routes).size === routes.length,
      "All SEO page routes are unique.",
      "Duplicate SEO page routes were detected."
    ),
    buildCheck(
      "meta_titles_safe",
      "Meta titles are safe and non-empty",
      publicPages.every((page) => {
        const metaTitle = resolveMetaTitleFromPage(page);
        return metaTitle.metaTitleStatus !== "missing" && isSafePublicText(metaTitle.metaTitle);
      }),
      "All public SEO pages have safe non-empty meta titles.",
      "One or more public SEO pages are missing safe meta titles."
    ),
    buildCheck(
      "meta_descriptions_safe",
      "Meta descriptions are safe and non-empty",
      publicPages.every((page) => {
        const metaDescription = resolveMetaDescriptionFromPage(page);
        return (
          metaDescription.metaDescriptionStatus !== "missing" &&
          isSafePublicText(metaDescription.metaDescription)
        );
      }),
      "All public SEO pages have safe non-empty meta descriptions.",
      "One or more public SEO pages are missing safe meta descriptions."
    ),
    buildCheck(
      "canonical_paths_safe",
      "Canonical paths are safe and public",
      publicPages.every((page) => {
        const canonical = resolveCanonicalFromPage(page);
        return (
          canonical.canonicalStatus === "ready" &&
          canonical.canonicalPath.startsWith("/") &&
          !isBlockedCanonicalPath(canonical.canonicalPath)
        );
      }),
      "All public SEO pages expose safe canonical paths.",
      "One or more public SEO pages have unsafe or missing canonical paths."
    ),
    buildCheck(
      "open_graph_safe",
      "Open Graph data is safe",
      publicPages.every((page) => {
        const openGraph = resolveOpenGraphFromPage(page);
        return (
          (openGraph.openGraphStatus === "ready" || openGraph.openGraphStatus === "placeholder") &&
          isSafePublicText(openGraph.title) &&
          isSafePublicText(openGraph.image || "/opengraph-image.png")
        );
      }),
      "All public SEO pages expose safe Open Graph metadata.",
      "One or more public SEO pages have unsafe Open Graph metadata."
    ),
    buildCheck(
      "language_values_safe",
      "Language values are safe",
      publicPages.every((page) => {
        const language = resolveSeoLanguageFromPage(page);
        return language.languageStatus === "ready" && isSafePublicText(language.language);
      }),
      "All public SEO pages expose safe language values.",
      "One or more public SEO pages have unsafe language values."
    ),
    buildCheck(
      "sitemap_excludes_private_routes",
      "Sitemap excludes private routes",
      sitemapEntries.every((entry) => isSitemapAllowedRoute(entry.route)) &&
        sitemapRuntime.excludedRoutes.length > 0,
      "Sitemap runtime excludes private and admin routes.",
      "Sitemap runtime includes blocked routes or missing exclusions."
    ),
    buildCheck(
      "robots_blocks_private_routes",
      "Robots blocks private routes",
      robotsRules.disallowedRoutes.length > 0 && robotsRules.status === "ready",
      "Robots runtime blocks private and admin routes.",
      "Robots runtime is missing required private route blocks."
    ),
    buildCheck(
      "structured_data_public_only",
      "Structured data exposes public data only",
      validateOrganizationSchema(organizationSchema).isValid &&
        validateWebsiteSchema(websiteSchema).isValid &&
        validateProductSchema(productSchema).isValid &&
        validateFaqSchema(faqSchema).isValid &&
        structuredDataRuntime.structuredData.every(
          (item) => item.status === "ready" || item.status === "placeholder"
        ),
      "Structured data and schema runtimes expose public-safe placeholders only.",
      "Structured data runtime failed public-only validation."
    ),
    buildCheck(
      "search_console_safely_disconnected",
      "Search Console is safely not connected",
      validateSearchConsoleRuntime().isValid && !isSearchConsoleConnected(),
      "Search Console remains safely disconnected in this phase.",
      "Search Console runtime is not in a safe disconnected state."
    ),
    buildCheck(
      "analytics_safely_disconnected",
      "Analytics is safely not connected",
      validateAnalyticsRuntime().isValid && !isAnalyticsConnected(),
      "Analytics remains safely disconnected in this phase.",
      "Analytics runtime is not in a safe disconnected state."
    ),
    buildCheck(
      "safe_actions_non_destructive",
      "Safe actions are non-destructive",
      safeActions.every((action) => validateSeoSafeAction(action.id).isValid && action.destructive === false),
      "All SEO safe actions are non-destructive.",
      "One or more SEO safe actions failed non-destructive validation."
    ),
    buildCheck(
      "editor_validation_only",
      "Editor is validation-only",
      validateSeoEditorRuntime(editorFields).isValid &&
        editorFields.every((field) => field.implemented === false),
      "SEO editor runtime remains validation-only.",
      "SEO editor runtime is not validation-only."
    ),
    buildCheck(
      "ai_seo_placeholder_only",
      "AI SEO is placeholder-only",
      validateAiSeoRuntime(aiSeoPlaceholder).isValid && aiSeoPlaceholder.generated === false,
      "AI SEO runtime remains placeholder-only.",
      "AI SEO runtime is not placeholder-only."
    ),
    buildCheck(
      "seo_registry_aligned",
      "SEO registry aligns with page runtime",
      registryItems.length === publicPages.length,
      "SEO registry and page runtime counts align.",
      "SEO registry and page runtime counts do not align."
    ),
    buildCheck(
      "organization_schema_valid",
      "Organization schema runtime is valid",
      validateOrganizationSchema(organizationSchema).isValid,
      "Organization schema runtime passed validation.",
      "Organization schema runtime failed validation."
    ),
    buildCheck(
      "website_schema_valid",
      "Website schema runtime is valid",
      validateWebsiteSchema(websiteSchema).isValid,
      "Website schema runtime passed validation.",
      "Website schema runtime failed validation."
    ),
    buildCheck(
      "breadcrumb_schema_safe",
      "Breadcrumb schema runtime is safe",
      publicPages.every((page) => {
        const schema = buildBreadcrumbSchemaFromSeoPage(page);
        return schema ? validateBreadcrumbSchema(schema).isValid : true;
      }),
      "Breadcrumb schema runtime passed safe public validation.",
      "Breadcrumb schema runtime failed safe public validation."
    ),
    buildCheck(
      "indexing_warnings_safe",
      "Indexing warning runtime is safe",
      indexingWarnings.every(
        (warning) => isSafePublicText(warning.message) && isSafePublicText(warning.sourceLabel)
      ),
      "Indexing warning runtime messages remain secret-free.",
      "Indexing warning runtime contains unsafe message content."
    ),
    buildCheck(
      "audit_runtime_valid",
      "SEO audit runtime is valid",
      validateSeoAuditRuntime(auditSnapshot).isValid,
      "SEO audit runtime passed read-only validation.",
      "SEO audit runtime failed read-only validation."
    ),
    buildCheck(
      "report_runtime_valid",
      "SEO report runtime is valid",
      validateSeoReportRuntime(reportSnapshot).isValid,
      "SEO report runtime passed read-only validation.",
      "SEO report runtime failed read-only validation."
    ),
    buildCheck(
      "review_runtime_valid",
      "SEO review runtime is valid",
      validateSeoReviewRuntime(reviewItems).isValid,
      "SEO review runtime passed read-only validation.",
      "SEO review runtime failed read-only validation."
    ),
    buildCheck(
      "export_runtime_valid",
      "SEO export runtime is valid",
      validateSeoExportRuntime(exportSnapshot).isValid,
      "SEO export runtime passed read-only validation.",
      "SEO export runtime failed read-only validation."
    )
  ];

  return finalizeCertificationResult(checks);
}

export function getSeoDataCertificationStatus(
  result: SeoDataCertificationResult
): SeoDataCertificationStatus {
  return result.status;
}

export function getSeoDataCertificationSummary(
  result: SeoDataCertificationResult
): SeoDataCertificationSummary {
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

export function validateSeoDataCertification(
  result: SeoDataCertificationResult
): SeoDataCertificationValidation {
  const issues: string[] = [];

  if (!result.readOnly) {
    issues.push("SEO data certification must remain read-only.");
  }

  if (result.source !== SEO_DATA_CERTIFICATION_SOURCE) {
    issues.push("SEO data certification must originate from the certification runtime.");
  }

  if (!result.generatedAt) {
    issues.push("SEO data certification must include a generatedAt timestamp.");
  }

  if (result.totalChecks !== result.checks.length) {
    issues.push("SEO data certification totalChecks must match the check list length.");
  }

  if (result.passedChecks + result.failedChecks !== result.totalChecks) {
    issues.push("SEO data certification passed and failed counts must match totalChecks.");
  }

  if (result.failedChecks !== result.warnings.length) {
    issues.push("SEO data certification warnings must match failed check count.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapSeoDataCertificationRuntimeToAdminFields() {
  const result = await runSeoDataCertification();
  const validation = validateSeoDataCertification(result);
  const summary = getSeoDataCertificationSummary(result);

  return {
    failedChecks: result.failedChecks,
    generatedAt: result.generatedAt,
    passedChecks: result.passedChecks,
    readOnly: true,
    status: validation.isValid ? summary.status : "needs_attention",
    summary: validation.isValid
      ? summary.summary
      : "SEO data certification validation requires safe read-only defaults.",
    totalChecks: result.totalChecks,
    warnings: result.warnings
  };
}

// SEO-27+ placeholders: security, runtime, and production certification stay disconnected.
export const SEO_DATA_CERTIFICATION_FUTURE_HOOKS = [
  "seo_security_certification",
  "seo_runtime_certification",
  "seo_production_certification"
] as const;
