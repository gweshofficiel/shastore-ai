import "server-only";

import {
  getSeoAuditRuntimeStatus,
  getSeoAuditSummary,
  runSeoAuditSnapshot,
  type SeoAuditRuntimeStatus
} from "@/src/lib/seo/seo-audit-runtime";
import {
  getIndexingWarningSummary,
  listIndexingWarnings
} from "@/src/lib/seo/seo-indexing-warning-runtime";
import {
  generateSeoReportSnapshot,
  getSeoReportRuntimeStatus,
  getSeoReportSummary,
  type SeoReportRuntimeStatus
} from "@/src/lib/seo/seo-report-runtime";
import {
  getSeoReviewRuntimeStatus,
  getSeoReviewSummary,
  listSeoReviewItems,
  type SeoReviewRuntimeStatus
} from "@/src/lib/seo/seo-review-runtime";
import {
  getSeoSafeActionRuntimeStatus,
  getSeoSafeActionSummary,
  listSeoSafeActions,
  type SeoSafeActionRuntimeStatus
} from "@/src/lib/seo/seo-safe-action-runtime";

export type SeoExportRuntimeStatus = "export_ready" | "incomplete" | "needs_review" | "placeholder";

export type SeoExportSnapshot = {
  auditRuntimeStatus: SeoAuditRuntimeStatus;
  auditSummary: string;
  exportStatus: SeoExportRuntimeStatus;
  generatedAt: string;
  readOnly: true;
  reportRuntimeStatus: SeoReportRuntimeStatus;
  reportSummary: string;
  reviewRuntimeStatus: SeoReviewRuntimeStatus;
  reviewSummary: string;
  safeActionRuntimeStatus: SeoSafeActionRuntimeStatus;
  safeActionSummary: string;
  safeRecommendations: string[];
  warningSummary: string;
};

export type SeoExportSummary = {
  readOnly: true;
  runtimeStatus: SeoExportRuntimeStatus;
  summary: string;
};

export type SeoExportRuntimeValidation = {
  isValid: boolean;
  issues: string[];
};

export const SEO_EXPORT_PLACEHOLDER_STATUS = "placeholder" as const;

function formatWarningSummary(indexingWarnings: Awaited<ReturnType<typeof listIndexingWarnings>>) {
  const summary = getIndexingWarningSummary(indexingWarnings);

  if (summary.totalWarnings === 0) {
    return "No indexing warnings detected from safe SEO runtimes.";
  }

  return `${summary.totalWarnings} indexing warning(s) from safe SEO runtimes.`;
}

export async function generateSeoExportSnapshot(): Promise<SeoExportSnapshot> {
  const [reportSnapshot, auditSnapshot, reviewItems, safeActions, indexingWarnings] = await Promise.all([
    generateSeoReportSnapshot(),
    runSeoAuditSnapshot(),
    listSeoReviewItems(),
    Promise.resolve(listSeoSafeActions()),
    listIndexingWarnings()
  ]);

  const auditSummary = getSeoAuditSummary(auditSnapshot);
  const reportSummary = getSeoReportSummary(reportSnapshot);
  const reviewSummary = getSeoReviewSummary(reviewItems);
  const safeActionSummary = getSeoSafeActionSummary(safeActions);

  const snapshot: SeoExportSnapshot = {
    auditRuntimeStatus: getSeoAuditRuntimeStatus(auditSnapshot),
    auditSummary: auditSummary.summary,
    exportStatus: "placeholder",
    generatedAt: new Date().toISOString(),
    readOnly: true,
    reportRuntimeStatus: getSeoReportRuntimeStatus(reportSnapshot),
    reportSummary: reportSummary.summary,
    reviewRuntimeStatus: getSeoReviewRuntimeStatus(reviewItems),
    reviewSummary: reviewSummary.summary,
    safeActionRuntimeStatus: getSeoSafeActionRuntimeStatus(safeActions),
    safeActionSummary: safeActionSummary.summary,
    safeRecommendations: reportSnapshot.recommendations.map((recommendation) => recommendation.message),
    warningSummary: formatWarningSummary(indexingWarnings)
  };

  return {
    ...snapshot,
    exportStatus: getSeoExportRuntimeStatus(snapshot)
  };
}

export function getSeoExportSummary(snapshot: SeoExportSnapshot): SeoExportSummary {
  const runtimeStatus = getSeoExportRuntimeStatus(snapshot);

  return {
    readOnly: true,
    runtimeStatus,
    summary: [
      `export ${runtimeStatus}`,
      snapshot.reportSummary,
      snapshot.auditSummary,
      snapshot.reviewSummary,
      snapshot.warningSummary,
      snapshot.safeActionSummary,
      `${snapshot.safeRecommendations.length} recommendation(s)`
    ].join("; ")
  };
}

export function getSeoExportRuntimeStatus(snapshot: SeoExportSnapshot): SeoExportRuntimeStatus {
  if (!snapshot.readOnly) {
    return "placeholder";
  }

  if (
    snapshot.auditRuntimeStatus === "incomplete" ||
    snapshot.reviewRuntimeStatus === "incomplete" ||
    snapshot.reportRuntimeStatus === "incomplete"
  ) {
    return "incomplete";
  }

  if (
    snapshot.auditRuntimeStatus === "needs_review" ||
    snapshot.reviewRuntimeStatus === "needs_review" ||
    snapshot.reportRuntimeStatus === "needs_review"
  ) {
    return "needs_review";
  }

  if (snapshot.safeActionRuntimeStatus === "invalid") {
    return "placeholder";
  }

  if (
    snapshot.reportRuntimeStatus === "report_ready" &&
    snapshot.reviewRuntimeStatus === "review_ready" &&
    snapshot.auditRuntimeStatus === "audit_ready"
  ) {
    return "export_ready";
  }

  return "placeholder";
}

export function validateSeoExportRuntime(snapshot: SeoExportSnapshot): SeoExportRuntimeValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("SEO export runtime must remain read-only.");
  }

  if (!snapshot.generatedAt) {
    issues.push("SEO export snapshot must include a generatedAt timestamp.");
  }

  if (!snapshot.reportSummary.trim()) {
    issues.push("SEO export snapshot must include a report summary.");
  }

  if (!snapshot.auditSummary.trim()) {
    issues.push("SEO export snapshot must include an audit summary.");
  }

  if (!snapshot.reviewSummary.trim()) {
    issues.push("SEO export snapshot must include a review summary.");
  }

  if (!snapshot.warningSummary.trim()) {
    issues.push("SEO export snapshot must include a warning summary.");
  }

  if (!snapshot.safeActionSummary.trim()) {
    issues.push("SEO export snapshot must include a safe action summary.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapSeoExportRuntimeToAdminFields() {
  const snapshot = await generateSeoExportSnapshot();
  const validation = validateSeoExportRuntime(snapshot);
  const exportSummary = getSeoExportSummary(snapshot);

  return {
    exportPlaceholderStatus: SEO_EXPORT_PLACEHOLDER_STATUS,
    readOnly: true,
    runtimeStatus: validation.isValid ? exportSummary.runtimeStatus : "placeholder",
    safeRecommendations: snapshot.safeRecommendations,
    snapshot,
    summary: validation.isValid
      ? exportSummary.summary
      : "SEO export runtime validation requires safe read-only defaults."
  };
}

// SEO-24+ placeholders: file download, editor, and AI generation stay disconnected.
export const SEO_EXPORT_FUTURE_HOOKS = ["seo_export_download", "seo_editor", "seo_ai_generator"] as const;
