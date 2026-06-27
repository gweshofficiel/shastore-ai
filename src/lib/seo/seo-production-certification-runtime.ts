import "server-only";

import { validateAiSeoRuntime, getAiSeoGeneratorPlaceholder } from "@/src/lib/seo/seo-ai-runtime";
import {
  validateAnalyticsRuntime,
  getAnalyticsRuntimeStatus,
  isAnalyticsConnected
} from "@/src/lib/seo/seo-analytics-runtime";
import { isBlockedCanonicalPath, resolveCanonicalFromPage } from "@/src/lib/seo/seo-canonical-runtime";
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
import { resolveMetaDescriptionFromPage } from "@/src/lib/seo/seo-meta-description-runtime";
import { resolveMetaTitleFromPage } from "@/src/lib/seo/seo-meta-title-runtime";
import { listSeoPages, SEO_PAGE_RUNTIME_FALLBACK_ID } from "@/src/lib/seo/seo-page-runtime";
import {
  runSeoRuntimeCertification,
  validateSeoRuntimeCertification
} from "@/src/lib/seo/seo-runtime-certification-runtime";
import { getRobotsRuntimeRules, isRobotsAllowedRoute } from "@/src/lib/seo/seo-robots-runtime";
import {
  runSeoSecurityCertification,
  validateSeoSecurityCertification
} from "@/src/lib/seo/seo-security-certification-runtime";
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

export type SeoProductionCertificationStatus = "needs_attention" | "production_certified";

export type SeoProductionCertificationSource = "seo_production_certification_runtime";

export type SeoProductionCertificationCheck = {
  id: string;
  label: string;
  message: string;
  passed: boolean;
};

export type SeoProductionCertificationResult = {
  checks: SeoProductionCertificationCheck[];
  failedChecks: number;
  generatedAt: string;
  passedChecks: number;
  readOnly: true;
  source: SeoProductionCertificationSource;
  status: SeoProductionCertificationStatus;
  totalChecks: number;
  warnings: string[];
};

export type SeoProductionCertificationSummary = {
  readOnly: true;
  status: SeoProductionCertificationStatus;
  summary: string;
};

export type SeoProductionCertificationValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_PRODUCTION_CERTIFICATION_SOURCE = "seo_production_certification_runtime" as const;

const PRIVATE_ROUTE_TEST_PATHS = [
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

function hasSafeCertificationReport(
  result: {
    readOnly: true;
    status: "certified" | "needs_attention";
  },
  isValid: boolean
) {
  return (
    isValid &&
    result.readOnly === true &&
    (result.status === "certified" || result.status === "needs_attention")
  );
}

function buildCheck(
  id: string,
  label: string,
  passed: boolean,
  successMessage: string,
  failureMessage: string
): SeoProductionCertificationCheck {
  return {
    id,
    label,
    message: passed ? successMessage : failureMessage,
    passed
  };
}

function finalizeProductionCertificationResult(
  checks: SeoProductionCertificationCheck[]
): SeoProductionCertificationResult {
  const passedChecks = checks.filter((check) => check.passed).length;
  const failedChecks = checks.length - passedChecks;
  const warnings = checks.filter((check) => !check.passed).map((check) => `${check.label}: ${check.message}`);

  return {
    checks,
    failedChecks,
    generatedAt: new Date().toISOString(),
    passedChecks,
    readOnly: true,
    source: SEO_PRODUCTION_CERTIFICATION_SOURCE,
    status: failedChecks === 0 ? "production_certified" : "needs_attention",
    totalChecks: checks.length,
    warnings
  };
}

export async function runSeoProductionCertification(): Promise<SeoProductionCertificationResult> {
  const [
    dataCertification,
    securityCertification,
    runtimeCertification,
    seoPages,
    sitemapEntries,
    sitemapRuntime,
    robotsRules,
    structuredDataRuntime,
    exportSnapshot,
    safeActions
  ] = await Promise.all([
    runSeoDataCertification(),
    runSeoSecurityCertification(),
    runSeoRuntimeCertification(),
    listSeoPages(),
    listSitemapEntries(),
    mapSitemapRuntimeToAdminFields(),
    getRobotsRuntimeRules(),
    Promise.resolve(mapStructuredDataRuntimeToAdminFields()),
    generateSeoExportSnapshot(),
    Promise.resolve(listSeoSafeActions())
  ]);

  const publicPages = seoPages.filter((page) => page.id !== SEO_PAGE_RUNTIME_FALLBACK_ID);
  const editorFields = getSeoEditableFields();
  const aiSeoPlaceholder = getAiSeoGeneratorPlaceholder();

  const checks: SeoProductionCertificationCheck[] = [
    buildCheck(
      "data_certification_report",
      "SEO Data Certification reports safely",
      hasSafeCertificationReport(dataCertification, validateSeoDataCertification(dataCertification).isValid),
      `SEO Data Certification reports ${dataCertification.status}.`,
      "SEO Data Certification failed safe reporting checks."
    ),
    buildCheck(
      "security_certification_report",
      "SEO Security Certification reports safely",
      hasSafeCertificationReport(securityCertification, validateSeoSecurityCertification(securityCertification).isValid),
      `SEO Security Certification reports ${securityCertification.status}.`,
      "SEO Security Certification failed safe reporting checks."
    ),
    buildCheck(
      "runtime_certification_report",
      "SEO Runtime Certification reports safely",
      hasSafeCertificationReport(runtimeCertification, validateSeoRuntimeCertification(runtimeCertification).isValid),
      `SEO Runtime Certification reports ${runtimeCertification.status}.`,
      "SEO Runtime Certification failed safe reporting checks."
    ),
    buildCheck(
      "sitemap_runtime_ready",
      "Sitemap runtime is ready",
      sitemapRuntime.status === "ready",
      "Sitemap runtime is production ready.",
      "Sitemap runtime is not ready."
    ),
    buildCheck(
      "robots_runtime_ready",
      "Robots runtime is ready",
      robotsRules.status === "ready",
      "Robots runtime is production ready.",
      "Robots runtime is not ready."
    ),
    buildCheck(
      "structured_data_runtime_ready",
      "Structured data runtime is ready",
      structuredDataRuntime.structuredDataStatus === "ready",
      "Structured data runtime is production ready.",
      "Structured data runtime is not ready."
    ),
    buildCheck(
      "public_meta_titles_safe",
      "Public pages have safe meta titles",
      publicPages.every((page) => {
        const metaTitle = resolveMetaTitleFromPage(page);
        return metaTitle.metaTitleStatus !== "missing" && isSafePublicText(metaTitle.metaTitle);
      }),
      "All public SEO pages have safe meta titles.",
      "One or more public SEO pages are missing safe meta titles."
    ),
    buildCheck(
      "public_meta_descriptions_safe",
      "Public pages have safe meta descriptions",
      publicPages.every((page) => {
        const metaDescription = resolveMetaDescriptionFromPage(page);
        return (
          metaDescription.metaDescriptionStatus !== "missing" &&
          isSafePublicText(metaDescription.metaDescription)
        );
      }),
      "All public SEO pages have safe meta descriptions.",
      "One or more public SEO pages are missing safe meta descriptions."
    ),
    buildCheck(
      "public_canonicals_safe",
      "Public pages have safe canonicals",
      publicPages.every((page) => {
        const canonical = resolveCanonicalFromPage(page);
        return (
          canonical.canonicalStatus === "ready" &&
          canonical.canonicalPath.startsWith("/") &&
          !isBlockedCanonicalPath(canonical.canonicalPath)
        );
      }),
      "All public SEO pages have safe canonical paths.",
      "One or more public SEO pages have unsafe canonical paths."
    ),
    buildCheck(
      "sitemap_excludes_private_routes",
      "Private routes are excluded from sitemap",
      sitemapEntries.every((entry) => isSitemapAllowedRoute(entry.route)) &&
        PRIVATE_ROUTE_TEST_PATHS.every((route) => !isSitemapAllowedRoute(route)),
      "Sitemap runtime excludes private routes.",
      "Sitemap runtime includes one or more private routes."
    ),
    buildCheck(
      "robots_blocks_private_routes",
      "Private routes are blocked by robots",
      robotsRules.disallowedRoutes.length > 0 &&
        PRIVATE_ROUTE_TEST_PATHS.every((route) => !isRobotsAllowedRoute(route)),
      "Robots runtime blocks private routes.",
      "Robots runtime allows one or more private routes."
    ),
    buildCheck(
      "safe_actions_non_destructive",
      "Safe actions are non-destructive",
      safeActions.every((action) => validateSeoSafeAction(action.id).isValid && action.destructive === false),
      "All SEO safe actions remain non-destructive.",
      "One or more SEO safe actions failed non-destructive checks."
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
      "export_in_memory_placeholder",
      "Export is in-memory/placeholder only",
      validateSeoExportRuntime(exportSnapshot).isValid && exportSnapshot.readOnly === true,
      "SEO export runtime remains in-memory and placeholder-only.",
      "SEO export runtime failed in-memory placeholder checks."
    ),
    buildCheck(
      "ai_seo_placeholder_only",
      "AI SEO is placeholder-only",
      validateAiSeoRuntime(aiSeoPlaceholder).isValid && aiSeoPlaceholder.generated === false,
      "AI SEO runtime remains placeholder-only.",
      "AI SEO runtime is not placeholder-only."
    ),
    buildCheck(
      "search_console_safely_not_connected",
      "Search Console is safely not_connected",
      validateSearchConsoleRuntime().isValid && !isSearchConsoleConnected(),
      "Search Console runtime is safely not connected.",
      "Search Console runtime failed safe not_connected checks."
    ),
    buildCheck(
      "analytics_safely_not_connected",
      "Analytics is safely not_connected",
      validateAnalyticsRuntime().isValid &&
        getAnalyticsRuntimeStatus() === "not_connected" &&
        !isAnalyticsConnected(),
      "Analytics runtime is safely not connected.",
      "Analytics runtime failed safe not_connected checks."
    )
  ];

  return finalizeProductionCertificationResult(checks);
}

export function getSeoProductionCertificationStatus(
  result: SeoProductionCertificationResult
): SeoProductionCertificationStatus {
  return result.status;
}

export function getSeoProductionCertificationSummary(
  result: SeoProductionCertificationResult
): SeoProductionCertificationSummary {
  return {
    readOnly: true,
    status: result.status,
    summary: [
      `status ${result.status}`,
      `${result.passedChecks}/${result.totalChecks} production checks passed`,
      `${result.failedChecks} failed`,
      `${result.warnings.length} warning(s)`
    ].join("; ")
  };
}

export function validateSeoProductionCertification(
  result: SeoProductionCertificationResult
): SeoProductionCertificationValidation {
  const issues: string[] = [];

  if (!result.readOnly) {
    issues.push("SEO production certification must remain read-only.");
  }

  if (result.source !== SEO_PRODUCTION_CERTIFICATION_SOURCE) {
    issues.push("SEO production certification must originate from the production certification runtime.");
  }

  if (!result.generatedAt) {
    issues.push("SEO production certification must include a generatedAt timestamp.");
  }

  if (result.totalChecks !== result.checks.length) {
    issues.push("SEO production certification totalChecks must match the check list length.");
  }

  if (result.passedChecks + result.failedChecks !== result.totalChecks) {
    issues.push("SEO production certification passed and failed counts must match totalChecks.");
  }

  if (result.failedChecks !== result.warnings.length) {
    issues.push("SEO production certification warnings must match failed check count.");
  }

  if (result.status !== "production_certified" && result.status !== "needs_attention") {
    issues.push("SEO production certification status must be production_certified or needs_attention.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapSeoProductionCertificationRuntimeToAdminFields() {
  const result = await runSeoProductionCertification();
  const validation = validateSeoProductionCertification(result);
  const summary = getSeoProductionCertificationSummary(result);

  return {
    failedChecks: result.failedChecks,
    generatedAt: result.generatedAt,
    passedChecks: result.passedChecks,
    readOnly: true,
    status: validation.isValid ? summary.status : "needs_attention",
    summary: validation.isValid
      ? summary.summary
      : "SEO production certification validation requires safe read-only defaults.",
    totalChecks: result.totalChecks,
    warnings: result.warnings
  };
}
