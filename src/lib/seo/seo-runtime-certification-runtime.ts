import "server-only";

import { validateAiSeoRuntime, getAiSeoGeneratorPlaceholder } from "@/src/lib/seo/seo-ai-runtime";
import {
  runSeoAuditSnapshot,
  validateSeoAuditRuntime
} from "@/src/lib/seo/seo-audit-runtime";
import {
  validateAnalyticsRuntime,
  getAnalyticsRuntimeStatus,
  isAnalyticsConnected
} from "@/src/lib/seo/seo-analytics-runtime";
import {
  buildBreadcrumbSchemaFromSeoPage,
  getBreadcrumbSchemaRuntimeStatus,
  validateBreadcrumbSchema
} from "@/src/lib/seo/seo-breadcrumb-schema-runtime";
import { resolveCanonicalFromPage } from "@/src/lib/seo/seo-canonical-runtime";
import {
  runSeoDataCertification,
  validateSeoDataCertification
} from "@/src/lib/seo/seo-data-certification-runtime";
import {
  getSeoEditableFields,
  validateSeoEditorRuntime
} from "@/src/lib/seo/seo-editor-runtime";
import {
  generateSeoExportSnapshot,
  validateSeoExportRuntime
} from "@/src/lib/seo/seo-export-runtime";
import {
  getFaqSchemaPlaceholder,
  getFaqSchemaRuntimeStatus,
  validateFaqSchema
} from "@/src/lib/seo/seo-faq-schema-runtime";
import {
  getIndexingWarningSummary,
  listIndexingWarnings,
  validateIndexingWarningRuntime
} from "@/src/lib/seo/seo-indexing-warning-runtime";
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
  getProductSchemaRuntimeStatus,
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
  runSeoSecurityCertification,
  validateSeoSecurityCertification
} from "@/src/lib/seo/seo-security-certification-runtime";
import {
  listSeoSafeActions,
  validateSeoSafeAction
} from "@/src/lib/seo/seo-safe-action-runtime";
import {
  getSearchConsoleRuntimeStatus,
  validateSearchConsoleRuntime,
  isSearchConsoleConnected
} from "@/src/lib/seo/seo-search-console-runtime";
import {
  listSitemapEntries,
  mapSitemapRuntimeToAdminFields
} from "@/src/lib/seo/seo-sitemap-runtime";
import { mapStructuredDataRuntimeToAdminFields } from "@/src/lib/seo/seo-structured-data-runtime";
import {
  getWebsiteSchema,
  validateWebsiteSchema
} from "@/src/lib/seo/seo-website-schema-runtime";

export type SeoRuntimeCertificationStatus = "certified" | "needs_attention";

export type SeoRuntimeCertificationSource = "seo_runtime_certification_runtime";

export type SeoRuntimeCertificationCheck = {
  id: string;
  label: string;
  message: string;
  passed: boolean;
};

export type SeoRuntimeCertificationResult = {
  checks: SeoRuntimeCertificationCheck[];
  failedChecks: number;
  generatedAt: string;
  passedChecks: number;
  readOnly: true;
  source: SeoRuntimeCertificationSource;
  status: SeoRuntimeCertificationStatus;
  totalChecks: number;
  warnings: string[];
};

export type SeoRuntimeCertificationSummary = {
  readOnly: true;
  status: SeoRuntimeCertificationStatus;
  summary: string;
};

export type SeoRuntimeCertificationValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_RUNTIME_CERTIFICATION_SOURCE = "seo_runtime_certification_runtime" as const;

function buildCheck(
  id: string,
  label: string,
  passed: boolean,
  successMessage: string,
  failureMessage: string
): SeoRuntimeCertificationCheck {
  return {
    id,
    label,
    message: passed ? successMessage : failureMessage,
    passed
  };
}

function finalizeRuntimeCertificationResult(
  checks: SeoRuntimeCertificationCheck[]
): SeoRuntimeCertificationResult {
  const passedChecks = checks.filter((check) => check.passed).length;
  const failedChecks = checks.length - passedChecks;
  const warnings = checks.filter((check) => !check.passed).map((check) => `${check.label}: ${check.message}`);

  return {
    checks,
    failedChecks,
    generatedAt: new Date().toISOString(),
    passedChecks,
    readOnly: true,
    source: SEO_RUNTIME_CERTIFICATION_SOURCE,
    status: failedChecks === 0 ? "certified" : "needs_attention",
    totalChecks: checks.length,
    warnings
  };
}

export async function runSeoRuntimeCertification(): Promise<SeoRuntimeCertificationResult> {
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
    safeActions,
    dataCertification,
    securityCertification
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
    Promise.resolve(listSeoSafeActions()),
    runSeoDataCertification(),
    runSeoSecurityCertification()
  ]);

  const publicPages = seoPages.filter((page) => page.id !== SEO_PAGE_RUNTIME_FALLBACK_ID);
  const samplePage = publicPages[0] ?? null;
  const editorFields = getSeoEditableFields();
  const aiSeoPlaceholder = getAiSeoGeneratorPlaceholder();
  const indexingSummary = getIndexingWarningSummary(indexingWarnings);

  const checks: SeoRuntimeCertificationCheck[] = [
    buildCheck(
      "seo_registry_runtime",
      "SEO Registry runtime exists",
      registryItems.length > 0,
      "SEO Registry runtime is available.",
      "SEO Registry runtime is missing or empty."
    ),
    buildCheck(
      "seo_page_runtime",
      "SEO Page runtime exists",
      publicPages.length > 0,
      "SEO Page runtime is available.",
      "SEO Page runtime is missing or empty."
    ),
    buildCheck(
      "meta_title_runtime",
      "Meta Title runtime works",
      samplePage !== null && resolveMetaTitleFromPage(samplePage).metaTitle.trim().length > 0,
      "Meta Title runtime resolves safe values.",
      "Meta Title runtime failed to resolve values."
    ),
    buildCheck(
      "meta_description_runtime",
      "Meta Description runtime works",
      samplePage !== null && resolveMetaDescriptionFromPage(samplePage).metaDescription.trim().length > 0,
      "Meta Description runtime resolves safe values.",
      "Meta Description runtime failed to resolve values."
    ),
    buildCheck(
      "canonical_runtime",
      "Canonical runtime works",
      samplePage !== null && resolveCanonicalFromPage(samplePage).canonicalPath.startsWith("/"),
      "Canonical runtime resolves safe paths.",
      "Canonical runtime failed to resolve paths."
    ),
    buildCheck(
      "open_graph_runtime",
      "Open Graph runtime works",
      samplePage !== null && resolveOpenGraphFromPage(samplePage).title.trim().length > 0,
      "Open Graph runtime resolves safe metadata.",
      "Open Graph runtime failed to resolve metadata."
    ),
    buildCheck(
      "language_runtime",
      "Language runtime works",
      samplePage !== null && resolveSeoLanguageFromPage(samplePage).language.trim().length > 0,
      "Language runtime resolves safe language values.",
      "Language runtime failed to resolve language values."
    ),
    buildCheck(
      "sitemap_runtime",
      "Sitemap runtime works",
      sitemapEntries.length > 0 && (sitemapRuntime.status === "ready" || sitemapRuntime.status === "warning"),
      "Sitemap runtime is connected and readable.",
      "Sitemap runtime failed readiness checks."
    ),
    buildCheck(
      "robots_runtime",
      "Robots runtime works",
      robotsRules.disallowedRoutes.length > 0 &&
        (robotsRules.status === "ready" || robotsRules.status === "warning"),
      "Robots runtime is connected and readable.",
      "Robots runtime failed readiness checks."
    ),
    buildCheck(
      "structured_data_runtime",
      "Structured Data runtime works",
      structuredDataRuntime.structuredData.length > 0,
      "Structured Data runtime is connected and readable.",
      "Structured Data runtime failed readiness checks."
    ),
    buildCheck(
      "organization_schema_runtime",
      "Organization schema runtime works",
      validateOrganizationSchema(getOrganizationSchema()).isValid,
      "Organization schema runtime passed validation.",
      "Organization schema runtime failed validation."
    ),
    buildCheck(
      "website_schema_runtime",
      "Website schema runtime works",
      validateWebsiteSchema(getWebsiteSchema()).isValid,
      "Website schema runtime passed validation.",
      "Website schema runtime failed validation."
    ),
    buildCheck(
      "breadcrumb_schema_runtime",
      "Breadcrumb schema runtime works",
      (() => {
        const status = getBreadcrumbSchemaRuntimeStatus();
        if (status !== "ready" && status !== "placeholder") {
          return false;
        }

        if (!samplePage) {
          return true;
        }

        const schema = buildBreadcrumbSchemaFromSeoPage(samplePage);
        return schema ? validateBreadcrumbSchema(schema).isValid : true;
      })(),
      "Breadcrumb schema runtime passed validation.",
      "Breadcrumb schema runtime failed validation."
    ),
    buildCheck(
      "product_schema_runtime",
      "Product schema runtime is safe placeholder/runtime-ready",
      (getProductSchemaRuntimeStatus() === "placeholder" || getProductSchemaRuntimeStatus() === "ready") &&
        validateProductSchema(getProductSchemaPlaceholder()).isValid,
      "Product schema runtime is safe and runtime-ready.",
      "Product schema runtime failed placeholder readiness checks."
    ),
    buildCheck(
      "faq_schema_runtime",
      "FAQ schema runtime is safe placeholder/runtime-ready",
      (getFaqSchemaRuntimeStatus() === "placeholder" || getFaqSchemaRuntimeStatus() === "ready") &&
        validateFaqSchema(getFaqSchemaPlaceholder()).isValid,
      "FAQ schema runtime is safe and runtime-ready.",
      "FAQ schema runtime failed placeholder readiness checks."
    ),
    buildCheck(
      "search_console_runtime",
      "Search Console runtime is safe not_connected",
      validateSearchConsoleRuntime().isValid &&
        getSearchConsoleRuntimeStatus() === "not_connected" &&
        !isSearchConsoleConnected(),
      "Search Console runtime is safely not connected.",
      "Search Console runtime failed safe not_connected checks."
    ),
    buildCheck(
      "analytics_runtime",
      "Analytics runtime is safe not_connected",
      validateAnalyticsRuntime().isValid &&
        getAnalyticsRuntimeStatus() === "not_connected" &&
        !isAnalyticsConnected(),
      "Analytics runtime is safely not connected.",
      "Analytics runtime failed safe not_connected checks."
    ),
    buildCheck(
      "indexing_warning_runtime",
      "Indexing Warning runtime works",
      validateIndexingWarningRuntime({ summary: indexingSummary, warnings: indexingWarnings }).isValid,
      "Indexing Warning runtime is connected and readable.",
      "Indexing Warning runtime failed validation."
    ),
    buildCheck(
      "seo_audit_runtime",
      "SEO Audit runtime works",
      validateSeoAuditRuntime(auditSnapshot).isValid,
      "SEO Audit runtime passed read-only validation.",
      "SEO Audit runtime failed read-only validation."
    ),
    buildCheck(
      "seo_report_runtime",
      "SEO Report runtime works",
      validateSeoReportRuntime(reportSnapshot).isValid,
      "SEO Report runtime passed read-only validation.",
      "SEO Report runtime failed read-only validation."
    ),
    buildCheck(
      "seo_review_runtime",
      "SEO Review runtime works",
      validateSeoReviewRuntime(reviewItems).isValid && reviewItems.length > 0,
      "SEO Review runtime passed read-only validation.",
      "SEO Review runtime failed read-only validation."
    ),
    buildCheck(
      "seo_safe_action_runtime",
      "SEO Safe Action runtime works",
      safeActions.length > 0 && safeActions.every((action) => validateSeoSafeAction(action.id).isValid),
      "SEO Safe Action runtime passed read-only validation.",
      "SEO Safe Action runtime failed read-only validation."
    ),
    buildCheck(
      "seo_export_runtime",
      "SEO Export runtime is in-memory only",
      validateSeoExportRuntime(exportSnapshot).isValid && exportSnapshot.readOnly === true,
      "SEO Export runtime remains in-memory only.",
      "SEO Export runtime failed in-memory validation."
    ),
    buildCheck(
      "seo_editor_runtime",
      "SEO Editor runtime is validation-only",
      validateSeoEditorRuntime(editorFields).isValid &&
        editorFields.every((field) => field.implemented === false),
      "SEO Editor runtime remains validation-only.",
      "SEO Editor runtime failed validation-only checks."
    ),
    buildCheck(
      "ai_seo_runtime",
      "AI SEO runtime is placeholder-only",
      validateAiSeoRuntime(aiSeoPlaceholder).isValid && aiSeoPlaceholder.generated === false,
      "AI SEO runtime remains placeholder-only.",
      "AI SEO runtime failed placeholder-only checks."
    ),
    buildCheck(
      "seo_data_certification_exists",
      "SEO Data Certification exists",
      validateSeoDataCertification(dataCertification).isValid && dataCertification.totalChecks > 0,
      "SEO Data Certification runtime is present and readable.",
      "SEO Data Certification runtime is missing or invalid."
    ),
    buildCheck(
      "seo_security_certification_exists",
      "SEO Security Certification exists",
      validateSeoSecurityCertification(securityCertification).isValid &&
        securityCertification.totalChecks > 0,
      "SEO Security Certification runtime is present and readable.",
      "SEO Security Certification runtime is missing or invalid."
    )
  ];

  return finalizeRuntimeCertificationResult(checks);
}

export function getSeoRuntimeCertificationStatus(
  result: SeoRuntimeCertificationResult
): SeoRuntimeCertificationStatus {
  return result.status;
}

export function getSeoRuntimeCertificationSummary(
  result: SeoRuntimeCertificationResult
): SeoRuntimeCertificationSummary {
  return {
    readOnly: true,
    status: result.status,
    summary: [
      `status ${result.status}`,
      `${result.passedChecks}/${result.totalChecks} runtime checks passed`,
      `${result.failedChecks} failed`,
      `${result.warnings.length} warning(s)`
    ].join("; ")
  };
}

export function validateSeoRuntimeCertification(
  result: SeoRuntimeCertificationResult
): SeoRuntimeCertificationValidation {
  const issues: string[] = [];

  if (!result.readOnly) {
    issues.push("SEO runtime certification must remain read-only.");
  }

  if (result.source !== SEO_RUNTIME_CERTIFICATION_SOURCE) {
    issues.push("SEO runtime certification must originate from the runtime certification runtime.");
  }

  if (!result.generatedAt) {
    issues.push("SEO runtime certification must include a generatedAt timestamp.");
  }

  if (result.totalChecks !== result.checks.length) {
    issues.push("SEO runtime certification totalChecks must match the check list length.");
  }

  if (result.passedChecks + result.failedChecks !== result.totalChecks) {
    issues.push("SEO runtime certification passed and failed counts must match totalChecks.");
  }

  if (result.failedChecks !== result.warnings.length) {
    issues.push("SEO runtime certification warnings must match failed check count.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapSeoRuntimeCertificationRuntimeToAdminFields() {
  const result = await runSeoRuntimeCertification();
  const validation = validateSeoRuntimeCertification(result);
  const summary = getSeoRuntimeCertificationSummary(result);

  return {
    failedChecks: result.failedChecks,
    generatedAt: result.generatedAt,
    passedChecks: result.passedChecks,
    readOnly: true,
    status: validation.isValid ? summary.status : "needs_attention",
    summary: validation.isValid
      ? summary.summary
      : "SEO runtime certification validation requires safe read-only defaults.",
    totalChecks: result.totalChecks,
    warnings: result.warnings
  };
}

// SEO-29+ placeholders: production certification stays disconnected.
export const SEO_RUNTIME_CERTIFICATION_FUTURE_HOOKS = ["seo_production_certification"] as const;
