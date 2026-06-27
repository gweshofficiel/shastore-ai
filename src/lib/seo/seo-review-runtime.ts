import "server-only";

import {
  getSeoAuditRuntimeStatus,
  getSeoAuditSummary,
  runSeoAuditSnapshot
} from "@/src/lib/seo/seo-audit-runtime";
import {
  listIndexingWarnings,
  type IndexingWarning
} from "@/src/lib/seo/seo-indexing-warning-runtime";
import { mapCanonicalRuntimeToAdminFields } from "@/src/lib/seo/seo-canonical-runtime";
import { mapMetaDescriptionRuntimeToAdminFields } from "@/src/lib/seo/seo-meta-description-runtime";
import { mapMetaTitleRuntimeToAdminFields } from "@/src/lib/seo/seo-meta-title-runtime";
import { mapOpenGraphRuntimeToAdminFields } from "@/src/lib/seo/seo-open-graph-runtime";
import { mapSeoLanguageRuntimeToAdminFields } from "@/src/lib/seo/seo-language-runtime";
import {
  listSeoPages,
  normalizeSeoPageRoute,
  type SeoPageRuntime
} from "@/src/lib/seo/seo-page-runtime";
import { normalizeRobotsRoute } from "@/src/lib/seo/seo-robots-runtime";
import {
  generateSeoReportSnapshot,
  getSeoReportSummary
} from "@/src/lib/seo/seo-report-runtime";
import { type SeoRegistrySource } from "@/src/lib/seo/seo-registry-runtime";

export type SeoReviewItemStatus =
  | "blocked_private_route"
  | "missing_required_seo"
  | "needs_review"
  | "reviewed";

export type SeoReviewRuntimeStatus = "incomplete" | "needs_review" | "placeholder" | "review_ready";

export type SeoReviewItem = {
  id: string;
  label: string;
  lastUpdated: string | null;
  reviewed: boolean;
  reviewStatus: SeoReviewItemStatus;
  route: string;
  slug: string;
  source: SeoRegistrySource;
  warnings: string[];
};

export type SeoReviewSummary = {
  readOnly: true;
  runtimeStatus: SeoReviewRuntimeStatus;
  summary: string;
};

export type SeoReviewRuntimeValidation = {
  isValid: boolean;
  issues: string[];
};

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

function normalizeReviewRoute(route: string) {
  return normalizeRobotsRoute(normalizeSeoPageRoute(route)) || "/";
}

function isPrivateRouteExposure(route: string) {
  const normalized = normalizeReviewRoute(route).toLowerCase();
  return PRIVATE_ROUTE_SEGMENTS.some((segment) => normalized.includes(segment));
}

function warningsForRoute(route: string, indexingWarnings: IndexingWarning[]) {
  const normalizedRoute = normalizeReviewRoute(route);

  return indexingWarnings.filter((warning) => normalizeReviewRoute(warning.route) === normalizedRoute);
}

function buildPageReviewWarnings(page: SeoPageRuntime, routeWarnings: IndexingWarning[]) {
  const warnings: string[] = [];

  if (page.metaTitleStatus === "missing") {
    warnings.push("Missing meta title.");
  }

  if (page.metaDescriptionStatus === "missing") {
    warnings.push("Missing meta description.");
  }

  if (page.canonicalStatus === "missing") {
    warnings.push("Missing canonical path.");
  }

  if (page.openGraphStatus === "placeholder") {
    warnings.push("Open Graph metadata needs review.");
  }

  if (page.languageStatus === "placeholder") {
    warnings.push("Language metadata needs review.");
  }

  for (const warning of routeWarnings) {
    warnings.push(warning.message);
  }

  return warnings;
}

function resolveReviewStatus(page: SeoPageRuntime, routeWarnings: IndexingWarning[]): SeoReviewItemStatus {
  if (
    isPrivateRouteExposure(page.route) ||
    routeWarnings.some((warning) => warning.code === "private_route_exposure")
  ) {
    return "blocked_private_route";
  }

  if (
    page.metaTitleStatus === "missing" ||
    page.metaDescriptionStatus === "missing" ||
    page.canonicalStatus === "missing"
  ) {
    return "missing_required_seo";
  }

  if (page.runtimeReady && routeWarnings.length === 0) {
    return "reviewed";
  }

  return "needs_review";
}

function buildSeoReviewItem(page: SeoPageRuntime, indexingWarnings: IndexingWarning[]): SeoReviewItem {
  const routeWarnings = warningsForRoute(page.route, indexingWarnings);
  const metaTitle = mapMetaTitleRuntimeToAdminFields(page);
  const metaDescription = mapMetaDescriptionRuntimeToAdminFields(page);
  const canonical = mapCanonicalRuntimeToAdminFields(page);
  const openGraph = mapOpenGraphRuntimeToAdminFields(page);
  const language = mapSeoLanguageRuntimeToAdminFields(page);

  const enrichedPage: SeoPageRuntime = {
    ...page,
    canonicalStatus: canonical.canonicalStatus,
    metaDescriptionStatus: metaDescription.metaDescriptionStatus,
    metaTitleStatus: metaTitle.metaTitleStatus,
    openGraphStatus: openGraph.openGraphStatus,
    languageStatus: language.languageStatus,
    runtimeReady:
      metaTitle.metaTitleStatus === "ready" &&
      metaDescription.metaDescriptionStatus === "ready" &&
      canonical.canonicalStatus === "ready" &&
      openGraph.openGraphStatus === "ready" &&
      language.languageStatus === "ready"
  };

  return {
    id: page.id,
    label: page.label,
    lastUpdated: page.lastUpdated,
    reviewed: page.reviewed,
    reviewStatus: resolveReviewStatus(enrichedPage, routeWarnings),
    route: page.route,
    slug: page.slug,
    source: page.source,
    warnings: buildPageReviewWarnings(enrichedPage, routeWarnings)
  };
}

export async function listSeoReviewItems(): Promise<SeoReviewItem[]> {
  const [seoPages, indexingWarnings] = await Promise.all([listSeoPages(), listIndexingWarnings()]);

  return seoPages.map((page) => buildSeoReviewItem(page, indexingWarnings));
}

export function getSeoReviewRuntimeStatus(items: SeoReviewItem[]): SeoReviewRuntimeStatus {
  if (items.length === 0) {
    return "placeholder";
  }

  if (items.some((item) => item.reviewStatus === "missing_required_seo")) {
    return "incomplete";
  }

  if (
    items.some((item) => item.reviewStatus === "blocked_private_route") ||
    items.some((item) => item.reviewStatus === "needs_review")
  ) {
    return "needs_review";
  }

  if (items.every((item) => item.reviewStatus === "reviewed")) {
    return "review_ready";
  }

  return "placeholder";
}

export function getSeoReviewSummary(items: SeoReviewItem[]): SeoReviewSummary {
  const runtimeStatus = getSeoReviewRuntimeStatus(items);
  const reviewedCount = items.filter((item) => item.reviewStatus === "reviewed").length;
  const needsReviewCount = items.filter((item) => item.reviewStatus === "needs_review").length;
  const missingRequiredCount = items.filter((item) => item.reviewStatus === "missing_required_seo").length;
  const blockedPrivateCount = items.filter((item) => item.reviewStatus === "blocked_private_route").length;

  return {
    readOnly: true,
    runtimeStatus,
    summary: [
      `${items.length} review item(s)`,
      `${reviewedCount} reviewed`,
      `${needsReviewCount} needs review`,
      `${missingRequiredCount} missing required SEO`,
      `${blockedPrivateCount} blocked private route`
    ].join("; ")
  };
}

export function validateSeoReviewRuntime(items: SeoReviewItem[]): SeoReviewRuntimeValidation {
  const issues: string[] = [];

  for (const item of items) {
    if (!item.id.trim()) {
      issues.push("SEO review items must include a page id.");
      break;
    }

    if (!item.slug.trim()) {
      issues.push("SEO review items must include a slug.");
      break;
    }

    if (!item.route.trim()) {
      issues.push("SEO review items must include a route.");
      break;
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function mapSeoReviewItemToAdminFields(item: SeoReviewItem) {
  return {
    reviewed: item.reviewed,
    reviewSource: item.source,
    reviewStatus: item.reviewStatus,
    reviewWarnings: item.warnings
  };
}

export async function mapSeoReviewRuntimeToAdminFields() {
  const [items, auditSnapshot, reportSnapshot] = await Promise.all([
    listSeoReviewItems(),
    runSeoAuditSnapshot(),
    generateSeoReportSnapshot()
  ]);
  const validation = validateSeoReviewRuntime(items);
  const reviewSummary = getSeoReviewSummary(items);
  const auditSummary = getSeoAuditSummary(auditSnapshot);
  const reportSummary = getSeoReportSummary(reportSnapshot);

  return {
    items,
    readOnly: true,
    runtimeStatus: validation.isValid ? reviewSummary.runtimeStatus : "placeholder",
    summary: validation.isValid
      ? [
          reviewSummary.summary,
          `audit ${getSeoAuditRuntimeStatus(auditSnapshot)}`,
          `report ${reportSummary.runtimeStatus}`
        ].join("; ")
      : "SEO review runtime validation requires safe read-only defaults."
  };
}

// SEO-22+ placeholders: persistent review state, editor, and AI generation stay disconnected.
export const SEO_REVIEW_FUTURE_HOOKS = ["seo_review_persistence", "seo_editor", "seo_ai_generator"] as const;
