import "server-only";

import { getAnalyticsRuntimeStatus } from "@/src/lib/seo/seo-analytics-runtime";
import {
  getSeoAuditRuntimeStatus,
  getSeoAuditSummary,
  runSeoAuditSnapshot,
  type SeoAuditRuntimeStatus,
  type SeoAuditSnapshot
} from "@/src/lib/seo/seo-audit-runtime";
import {
  getIndexingWarningSummary,
  listIndexingWarnings,
  type IndexingWarningSummary
} from "@/src/lib/seo/seo-indexing-warning-runtime";
import { mapRobotsRuntimeToAdminFields } from "@/src/lib/seo/seo-robots-runtime";
import { getSearchConsoleRuntimeStatus } from "@/src/lib/seo/seo-search-console-runtime";
import { mapSitemapRuntimeToAdminFields } from "@/src/lib/seo/seo-sitemap-runtime";
import { mapStructuredDataRuntimeToAdminFields } from "@/src/lib/seo/seo-structured-data-runtime";

export type SeoReportRuntimeStatus = "incomplete" | "needs_review" | "placeholder" | "report_ready";

export type SeoReportRecommendationPriority = "action" | "info" | "review";

export type SeoReportRecommendation = {
  id: string;
  message: string;
  priority: SeoReportRecommendationPriority;
  readOnly: true;
};

export type SeoReportSnapshot = {
  analyticsStatus: ReturnType<typeof getAnalyticsRuntimeStatus>;
  generatedAt: string;
  indexingWarningSummary: string;
  readOnly: true;
  recommendations: SeoReportRecommendation[];
  reportStatus: SeoReportRuntimeStatus;
  robotsReadiness: "ready" | "warning";
  searchConsoleStatus: ReturnType<typeof getSearchConsoleRuntimeStatus>;
  seoAuditRuntimeStatus: SeoAuditRuntimeStatus;
  seoAuditSummary: string;
  sitemapReadiness: "ready" | "warning";
  structuredDataReadiness: "placeholder" | "ready";
};

export type SeoReportSummary = {
  readOnly: true;
  runtimeStatus: SeoReportRuntimeStatus;
  summary: string;
};

export type SeoReportRuntimeValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_REPORT_EXPORT_HOOK_LABEL = "SEO report export" as const;

function formatIndexingWarningSummary(summary: IndexingWarningSummary): string {
  if (summary.totalWarnings === 0) {
    return "No indexing warnings detected from safe SEO runtimes.";
  }

  const parts = [`${summary.totalWarnings} indexing warning(s)`];

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
    parts.push(`${summary.warningCountByCode.search_console_not_connected} Search Console warning(s)`);
  }

  return parts.join("; ");
}

function buildSeoReportRecommendations(auditSnapshot: SeoAuditSnapshot): SeoReportRecommendation[] {
  const recommendations: SeoReportRecommendation[] = [];

  if (!auditSnapshot.searchConsoleConnected) {
    recommendations.push({
      id: "connect_search_console",
      message: "Connect Search Console in a later secure phase.",
      priority: "info",
      readOnly: true
    });
  }

  if (!auditSnapshot.analyticsConnected) {
    recommendations.push({
      id: "connect_analytics",
      message: "Connect Analytics in a later secure phase.",
      priority: "info",
      readOnly: true
    });
  }

  if (auditSnapshot.missingMetaTitles > 0 || auditSnapshot.missingMetaDescriptions > 0) {
    recommendations.push({
      id: "review_missing_meta",
      message: "Review missing meta titles and descriptions on public SEO pages.",
      priority: "action",
      readOnly: true
    });
  }

  if (auditSnapshot.structuredDataStatus === "placeholder") {
    recommendations.push({
      id: "validate_structured_data",
      message: "Validate structured data before production certification.",
      priority: "review",
      readOnly: true
    });
  }

  return recommendations;
}

export async function generateSeoReportSnapshot(): Promise<SeoReportSnapshot> {
  const [
    auditSnapshot,
    indexingWarnings,
    sitemapRuntime,
    robotsRuntime,
    structuredDataRuntime
  ] = await Promise.all([
    runSeoAuditSnapshot(),
    listIndexingWarnings(),
    mapSitemapRuntimeToAdminFields(),
    mapRobotsRuntimeToAdminFields(),
    Promise.resolve(mapStructuredDataRuntimeToAdminFields())
  ]);

  const auditSummary = getSeoAuditSummary(auditSnapshot);
  const indexingSummary = getIndexingWarningSummary(indexingWarnings);
  const recommendations = buildSeoReportRecommendations(auditSnapshot);

  const snapshot: SeoReportSnapshot = {
    analyticsStatus: getAnalyticsRuntimeStatus(),
    generatedAt: new Date().toISOString(),
    indexingWarningSummary: formatIndexingWarningSummary(indexingSummary),
    readOnly: true,
    recommendations,
    reportStatus: "placeholder",
    robotsReadiness: robotsRuntime.status,
    searchConsoleStatus: getSearchConsoleRuntimeStatus(),
    seoAuditRuntimeStatus: getSeoAuditRuntimeStatus(auditSnapshot),
    seoAuditSummary: auditSummary.summary,
    sitemapReadiness: sitemapRuntime.status,
    structuredDataReadiness: structuredDataRuntime.structuredDataStatus
  };

  return {
    ...snapshot,
    reportStatus: getSeoReportRuntimeStatus(snapshot)
  };
}

export function getSeoReportSummary(snapshot: SeoReportSnapshot): SeoReportSummary {
  const runtimeStatus = getSeoReportRuntimeStatus(snapshot);

  return {
    readOnly: true,
    runtimeStatus,
    summary: [
      `report ${runtimeStatus}`,
      snapshot.seoAuditSummary,
      snapshot.indexingWarningSummary,
      `sitemap ${snapshot.sitemapReadiness}`,
      `robots ${snapshot.robotsReadiness}`,
      `structured data ${snapshot.structuredDataReadiness}`,
      `Search Console ${snapshot.searchConsoleStatus}`,
      `Analytics ${snapshot.analyticsStatus}`,
      `${snapshot.recommendations.length} recommendation(s)`
    ].join("; ")
  };
}

export function getSeoReportRuntimeStatus(snapshot: SeoReportSnapshot): SeoReportRuntimeStatus {
  if (!snapshot.readOnly) {
    return "placeholder";
  }

  switch (snapshot.seoAuditRuntimeStatus) {
    case "audit_ready":
      return "report_ready";
    case "incomplete":
      return "incomplete";
    case "needs_review":
      return "needs_review";
    default:
      return "placeholder";
  }
}

export function validateSeoReportRuntime(snapshot: SeoReportSnapshot): SeoReportRuntimeValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("SEO report runtime must remain read-only.");
  }

  if (!snapshot.generatedAt) {
    issues.push("SEO report snapshot must include a generatedAt timestamp.");
  }

  if (!snapshot.seoAuditSummary.trim()) {
    issues.push("SEO report snapshot must include an SEO audit summary.");
  }

  if (!snapshot.indexingWarningSummary.trim()) {
    issues.push("SEO report snapshot must include an indexing warning summary.");
  }

  for (const recommendation of snapshot.recommendations) {
    if (!recommendation.readOnly) {
      issues.push("SEO report recommendations must remain read-only.");
      break;
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapSeoReportRuntimeToAdminFields() {
  const snapshot = await generateSeoReportSnapshot();
  const validation = validateSeoReportRuntime(snapshot);
  const reportSummary = getSeoReportSummary(snapshot);

  return {
    exportHookLabel: SEO_REPORT_EXPORT_HOOK_LABEL,
    exportPlaceholderStatus: "placeholder" as const,
    readOnly: true,
    recommendations: snapshot.recommendations.map((recommendation) => recommendation.message),
    runtimeStatus: validation.isValid ? reportSummary.runtimeStatus : "placeholder",
    summary: validation.isValid
      ? reportSummary.summary
      : "SEO report runtime validation requires safe read-only defaults."
  };
}

// SEO-21+ placeholders: SEO report export, editor, and AI generation stay disconnected.
export const SEO_REPORT_FUTURE_HOOKS = [
  "seo_report_export",
  "seo_editor",
  "seo_ai_generator"
] as const;
