import "server-only";

import {
  isBlockedCanonicalPath,
  resolveCanonicalFromPage
} from "@/src/lib/seo/seo-canonical-runtime";
import { resolveMetaDescriptionFromPage } from "@/src/lib/seo/seo-meta-description-runtime";
import { resolveMetaTitleFromPage } from "@/src/lib/seo/seo-meta-title-runtime";
import {
  listSeoPages,
  normalizeSeoPageRoute,
  SEO_PAGE_RUNTIME_FALLBACK_ID,
  type SeoPageRuntime
} from "@/src/lib/seo/seo-page-runtime";
import {
  isRobotsAllowedRoute,
  normalizeRobotsRoute
} from "@/src/lib/seo/seo-robots-runtime";
import { isSearchConsoleConnected } from "@/src/lib/seo/seo-search-console-runtime";
import {
  isSitemapAllowedRoute,
  listSitemapEntries,
  normalizeSitemapRoute
} from "@/src/lib/seo/seo-sitemap-runtime";

export type IndexingWarningSeverity = "info" | "warning";

export type IndexingWarningCode =
  | "blocked_sitemap_route"
  | "missing_meta_description"
  | "missing_meta_title"
  | "private_route_exposure"
  | "search_console_not_connected"
  | "unsafe_canonical_route";

export type IndexingWarning = {
  code: IndexingWarningCode;
  message: string;
  route: string;
  severity: IndexingWarningSeverity;
  sourceLabel: string;
};

export type IndexingWarningRuntimeStatus = "missing" | "placeholder" | "ready";

export type IndexingWarningSummary = {
  readOnly: true;
  totalWarnings: number;
  warningCountByCode: Record<IndexingWarningCode, number>;
};

export type IndexingWarningRuntimeValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_INDEXING_WARNING_READINESS_NAME = "Indexing warnings placeholder" as const;

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

const FORBIDDEN_WARNING_PATTERNS = [
  /@/,
  /\b(?:api[_-]?key|secret|token|password|billing|tenant|reseller|supabase|stripe)\b/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
] as const;

function emptyWarningCounts(): Record<IndexingWarningCode, number> {
  return {
    blocked_sitemap_route: 0,
    missing_meta_description: 0,
    missing_meta_title: 0,
    private_route_exposure: 0,
    search_console_not_connected: 0,
    unsafe_canonical_route: 0
  };
}

function isPrivateRouteExposure(route: string) {
  const normalized = normalizeRobotsRoute(route).toLowerCase();
  return PRIVATE_ROUTE_SEGMENTS.some((segment) => normalized.includes(segment));
}

function isSafeWarningText(value: string) {
  const cleaned = value.trim();
  if (!cleaned) {
    return false;
  }

  return !FORBIDDEN_WARNING_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function addWarning(
  warnings: IndexingWarning[],
  warning: IndexingWarning
) {
  if (!isSafeWarningText(warning.message) || !isSafeWarningText(warning.sourceLabel)) {
    return;
  }

  warnings.push(warning);
}

function collectPageWarnings(
  page: SeoPageRuntime,
  sitemapRoutes: Set<string>,
  warnings: IndexingWarning[]
) {
  if (page.id === SEO_PAGE_RUNTIME_FALLBACK_ID) {
    return;
  }

  const route = normalizeRobotsRoute(normalizeSeoPageRoute(page.route)) || "/";
  const metaTitle = resolveMetaTitleFromPage(page);
  const metaDescription = resolveMetaDescriptionFromPage(page);
  const canonical = resolveCanonicalFromPage(page);
  const sourceLabel = page.label;

  if (metaTitle.metaTitleStatus === "missing") {
    addWarning(warnings, {
      code: "missing_meta_title",
      message: `Missing meta title for ${sourceLabel}.`,
      route,
      severity: "warning",
      sourceLabel
    });
  }

  if (metaDescription.metaDescriptionStatus === "missing") {
    addWarning(warnings, {
      code: "missing_meta_description",
      message: `Missing meta description for ${sourceLabel}.`,
      route,
      severity: "warning",
      sourceLabel
    });
  }

  if (canonical.usedRouteFallback || isBlockedCanonicalPath(page.canonicalPath)) {
    addWarning(warnings, {
      code: "unsafe_canonical_route",
      message: `Canonical path needs review for ${sourceLabel}.`,
      route,
      severity: "warning",
      sourceLabel
    });
  }

  if (!isSitemapAllowedRoute(route) || !sitemapRoutes.has(route)) {
    addWarning(warnings, {
      code: "blocked_sitemap_route",
      message: `Route is not safely included in the public sitemap for ${sourceLabel}.`,
      route,
      severity: "warning",
      sourceLabel
    });
  }

  if (
    isPrivateRouteExposure(route) ||
    isPrivateRouteExposure(canonical.canonicalPath) ||
    !isRobotsAllowedRoute(route)
  ) {
    addWarning(warnings, {
      code: "private_route_exposure",
      message: `Private or blocked route pattern detected for ${sourceLabel}.`,
      route,
      severity: "warning",
      sourceLabel
    });
  }
}

export async function listIndexingWarnings(): Promise<IndexingWarning[]> {
  const warnings: IndexingWarning[] = [];

  try {
    const [seoPages, sitemapEntries] = await Promise.all([listSeoPages(), listSitemapEntries()]);
    const sitemapRoutes = new Set(sitemapEntries.map((entry) => entry.route));

    for (const page of seoPages) {
      collectPageWarnings(page, sitemapRoutes, warnings);
    }

    for (const route of sitemapEntries.map((entry) => entry.route)) {
      const normalizedRoute = normalizeSitemapRoute(route);
      if (normalizedRoute && !isRobotsAllowedRoute(normalizedRoute)) {
        addWarning(warnings, {
          code: "private_route_exposure",
          message: "Sitemap route is not allowed by robots runtime rules.",
          route: normalizedRoute,
          severity: "warning",
          sourceLabel: "Sitemap runtime"
        });
      }
    }
  } catch (error) {
    console.error("[seo-indexing-warning-runtime] indexing warning collection failed", error);
  }

  if (!isSearchConsoleConnected()) {
    addWarning(warnings, {
      code: "search_console_not_connected",
      message: "Search Console is not connected for indexing visibility.",
      route: "/",
      severity: "info",
      sourceLabel: "Search Console runtime"
    });
  }

  return warnings;
}

export function getIndexingWarningSummary(warnings: IndexingWarning[]): IndexingWarningSummary {
  const warningCountByCode = emptyWarningCounts();

  for (const warning of warnings) {
    warningCountByCode[warning.code] += 1;
  }

  return {
    readOnly: true,
    totalWarnings: warnings.length,
    warningCountByCode
  };
}

function hasCriticalWarnings(summary: IndexingWarningSummary) {
  return (
    summary.warningCountByCode.missing_meta_title > 0 ||
    summary.warningCountByCode.missing_meta_description > 0 ||
    summary.warningCountByCode.unsafe_canonical_route > 0 ||
    summary.warningCountByCode.blocked_sitemap_route > 0 ||
    summary.warningCountByCode.private_route_exposure > 0
  );
}

export function getIndexingWarningRuntimeStatus(
  warnings: IndexingWarning[],
  options?: { isProduction?: boolean }
): IndexingWarningRuntimeStatus {
  const summary = getIndexingWarningSummary(warnings);
  const isProduction = options?.isProduction ?? process.env.NODE_ENV === "production";

  if (summary.totalWarnings === 0) {
    return "ready";
  }

  if (hasCriticalWarnings(summary)) {
    return "missing";
  }

  if (!isProduction) {
    return "missing";
  }

  return "placeholder";
}

export function validateIndexingWarningRuntime(input: {
  summary: IndexingWarningSummary;
  warnings: IndexingWarning[];
}): IndexingWarningRuntimeValidation {
  const issues: string[] = [];

  if (!input.summary.readOnly) {
    issues.push("Indexing warning runtime must remain read-only.");
  }

  if (input.summary.totalWarnings !== input.warnings.length) {
    issues.push("Indexing warning summary must match the warning list length.");
  }

  for (const warning of input.warnings) {
    if (!isSafeWarningText(warning.message) || !isSafeWarningText(warning.sourceLabel)) {
      issues.push("Indexing warning messages must stay free of secrets and private identifiers.");
      break;
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

function buildAdminNote(warnings: IndexingWarning[], isProduction: boolean) {
  const summary = getIndexingWarningSummary(warnings);

  if (summary.totalWarnings === 0) {
    return isProduction
      ? "No read-only indexing warnings detected from safe SEO runtimes."
      : "Non-production environment should be reviewed before indexing.";
  }

  const parts: string[] = [];

  if (summary.warningCountByCode.missing_meta_title) {
    parts.push(`${summary.warningCountByCode.missing_meta_title} missing meta title warning(s)`);
  }

  if (summary.warningCountByCode.missing_meta_description) {
    parts.push(`${summary.warningCountByCode.missing_meta_description} missing meta description warning(s)`);
  }

  if (summary.warningCountByCode.unsafe_canonical_route) {
    parts.push(`${summary.warningCountByCode.unsafe_canonical_route} unsafe canonical warning(s)`);
  }

  if (summary.warningCountByCode.blocked_sitemap_route) {
    parts.push(`${summary.warningCountByCode.blocked_sitemap_route} blocked sitemap warning(s)`);
  }

  if (summary.warningCountByCode.private_route_exposure) {
    parts.push(`${summary.warningCountByCode.private_route_exposure} private route warning(s)`);
  }

  if (summary.warningCountByCode.search_console_not_connected) {
    parts.push("Search Console not connected");
  }

  const warningText = parts.length ? parts.join(", ") : `${summary.totalWarnings} read-only warning(s)`;

  return isProduction
    ? `Read-only indexing warnings from safe SEO runtimes: ${warningText}.`
    : `Non-production environment should be reviewed before indexing. ${warningText}.`;
}

export async function mapIndexingWarningRuntimeToAdminFields(isProduction: boolean) {
  const warnings = await listIndexingWarnings();
  const summary = getIndexingWarningSummary(warnings);
  const validation = validateIndexingWarningRuntime({ summary, warnings });
  const runtimeStatus = getIndexingWarningRuntimeStatus(warnings, { isProduction });
  const status = runtimeStatus === "ready" ? "placeholder" : runtimeStatus;

  return {
    analyticsReadinessItem: {
      name: SEO_INDEXING_WARNING_READINESS_NAME,
      note: validation.isValid
        ? buildAdminNote(warnings, isProduction)
        : "Indexing warning runtime validation requires safe read-only defaults.",
      status
    },
    runtimeStatus,
    summary,
    warnings
  };
}

// SEO-19+ placeholders: Search Console-backed indexing warnings stay disconnected.
export const SEO_INDEXING_WARNING_FUTURE_HOOKS = ["seo_indexing_search_console_warnings"] as const;
