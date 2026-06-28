import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { ReportAuditCoverageState } from "@/src/lib/reports/report-audit-runtime";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";

export type ReportReviewSource = "report_review_runtime";

export type ReportReviewCoverageState =
  | "partial"
  | "pending_review"
  | "planned"
  | "reviewed"
  | "unavailable";

export type ReportReviewAvailabilityState =
  | "available"
  | "degraded"
  | "empty"
  | "error"
  | "planned"
  | "unavailable";

export type ReportReviewStatus =
  | "not_required"
  | "partial"
  | "pending_review"
  | "planned"
  | "reviewed"
  | "unavailable";

export type ReportReviewCertificationReadiness =
  | "certified"
  | "needs_attention"
  | "not_applicable"
  | "planned"
  | "ready_for_certification"
  | "unavailable";

export type ReportReviewRuntimeState = "degraded" | "empty" | "planned" | "ready" | "unavailable";

export type ReportReviewLoadingState = "degraded" | "empty" | "error" | "loaded" | "planned";

export type ReportReviewAuditRef = {
  auditCoverageState: ReportAuditCoverageState;
  auditGaps: string[];
  lastGeneratedState: string;
  latestSafeAuditEvent: string | null;
};

export type ReportReviewEntry = {
  certificationReadinessSignal: ReportReviewCertificationReadiness;
  lastReviewedState: string;
  readOnly: true;
  reportKey: string;
  reportTitle: string;
  reviewAvailabilityState: ReportReviewAvailabilityState;
  reviewCoverageState: ReportReviewCoverageState;
  reviewGaps: string[];
  reviewNotesState: string;
  reviewSourceDescription: string;
  reviewStatus: ReportReviewStatus;
  reviewerState: string;
};

export type ReportReviewSelectedSummary = ReportReviewEntry;

export type ReportReviewCoverageBreakdownItem = {
  count: number;
  label: ReportReviewCoverageState;
};

export type ReportReviewTotals = {
  partialReports: number;
  pendingReviewReports: number;
  plannedReports: number;
  reviewedReports: number;
  unavailableReports: number;
};

export type ReportReviewSnapshot = {
  byCoverage: ReportReviewCoverageBreakdownItem[];
  entries: ReportReviewEntry[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  loadingState: ReportReviewLoadingState;
  readOnly: true;
  selectedReportKey: string | null;
  selectedReportReview: ReportReviewSelectedSummary | null;
  source: ReportReviewSource;
  status: ReportReviewRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  totals: ReportReviewTotals;
  warnings: string[];
};

export const REPORT_REVIEW_SOURCE = "report_review_runtime" as const;

const RUNTIME_MODULE_REPORT_KEYS = new Set([
  "rp-2-revenue-reports",
  "rp-3-store-reports",
  "rp-4-user-reports",
  "rp-5-subscription-reports",
  "rp-6-payment-reports",
  "rp-7-ai-reports",
  "rp-8-domain-email-reports",
  "rp-9-marketplace-reports",
  "rp-10-security-reports",
  "rp-11-operations-reports"
]);

function safeText(value: unknown, fallback = "") {
  const normalized =
    typeof value === "string" && value.trim()
      ? maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, 160)
      : fallback;

  return normalized;
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function reportReviewCoverageBadgeTone(
  coverage: ReportReviewCoverageState
): "amber" | "blue" | "green" | "red" | "slate" {
  if (coverage === "reviewed") {
    return "green";
  }

  if (coverage === "pending_review") {
    return "amber";
  }

  if (coverage === "partial") {
    return "amber";
  }

  if (coverage === "planned") {
    return "blue";
  }

  return "red";
}

export function reportReviewCoverageLabel(coverage: ReportReviewCoverageState) {
  return formatLabel(coverage);
}

function resolveReviewAvailabilityState(input: {
  registryStatus: string;
  runtimeStatus: ReportRuntimeStatus;
}): ReportReviewAvailabilityState {
  if (input.registryStatus === "planned" || input.registryStatus === "inactive") {
    return "planned";
  }

  if (input.runtimeStatus === "planned" || input.runtimeStatus === "inactive") {
    return "planned";
  }

  if (input.runtimeStatus === "error") {
    return "error";
  }

  if (input.runtimeStatus === "empty") {
    return "empty";
  }

  if (input.runtimeStatus === "degraded") {
    return "degraded";
  }

  if (
    input.runtimeStatus === "available" ||
    input.runtimeStatus === "active" ||
    input.runtimeStatus === "certified" ||
    input.runtimeStatus === "partial"
  ) {
    return "available";
  }

  return "unavailable";
}

function resolveCertificationReadiness(input: {
  certificationState: string;
  registryStatus: string;
  runtimeStatus: ReportRuntimeStatus;
}): ReportReviewCertificationReadiness {
  if (input.certificationState === "certified" || input.runtimeStatus === "certified") {
    return "certified";
  }

  if (input.certificationState === "needs_attention") {
    return "needs_attention";
  }

  if (input.certificationState === "not_applicable") {
    return "not_applicable";
  }

  if (input.certificationState === "planned" || input.registryStatus === "planned") {
    return "planned";
  }

  if (input.runtimeStatus === "error" || input.runtimeStatus === "inactive") {
    return "unavailable";
  }

  if (
    input.runtimeStatus === "available" ||
    input.runtimeStatus === "active" ||
    input.registryStatus === "ready"
  ) {
    return "ready_for_certification";
  }

  return "needs_attention";
}

function buildReviewSourceDescription(reportKey: string) {
  if (RUNTIME_MODULE_REPORT_KEYS.has(reportKey)) {
    return "Registry metadata, RP-13 status, RP-19 audit signals, and RP-2 through RP-11 adapter outputs (read-only, in-memory).";
  }

  if (reportKey === "rp-20-report-review") {
    return "Registry metadata and RP-12 through RP-19 runtime resolver outputs (read-only, in-memory).";
  }

  return "Registry metadata, RP-13 status, RP-19 audit signals, and Reporting Center runtime outputs (read-only, in-memory).";
}

function resolveReviewStatus(input: {
  auditRef?: ReportReviewAuditRef;
  certificationState: string;
  registryStatus: string;
  runtimeStatus: ReportRuntimeStatus;
}): ReportReviewStatus {
  if (input.registryStatus === "planned" || input.registryStatus === "inactive") {
    return "planned";
  }

  if (input.runtimeStatus === "planned" || input.runtimeStatus === "inactive") {
    return "planned";
  }

  if (input.runtimeStatus === "error") {
    return "unavailable";
  }

  if (input.registryStatus === "review") {
    return "pending_review";
  }

  if (input.certificationState === "needs_attention") {
    return "pending_review";
  }

  if (input.certificationState === "certified" || input.runtimeStatus === "certified") {
    return "reviewed";
  }

  if (input.runtimeStatus === "degraded" || input.runtimeStatus === "partial") {
    return "pending_review";
  }

  if (
    input.registryStatus === "ready" &&
    input.auditRef?.auditCoverageState === "covered" &&
    (input.runtimeStatus === "available" || input.runtimeStatus === "active")
  ) {
    return "reviewed";
  }

  if (input.auditRef?.auditCoverageState === "partial" || input.runtimeStatus === "empty") {
    return "partial";
  }

  if (input.certificationState === "not_applicable" && input.registryStatus === "ready") {
    return "not_required";
  }

  return "partial";
}

function resolveReviewCoverage(input: {
  auditRef?: ReportReviewAuditRef;
  certificationState: string;
  registryStatus: string;
  reviewStatus: ReportReviewStatus;
  runtimeStatus: ReportRuntimeStatus;
}): { reviewCoverageState: ReportReviewCoverageState; reviewGaps: string[] } {
  const reviewGaps: string[] = [];

  reviewGaps.push("Review records are not written during RP-20 page load.");
  reviewGaps.push("Approve, reject, and review-submit actions remain disabled.");

  if (input.reviewStatus === "planned") {
    reviewGaps.push("Review workflow remains planned for this report.");
    return { reviewCoverageState: "planned", reviewGaps };
  }

  if (input.reviewStatus === "unavailable") {
    reviewGaps.push("Review signals are unavailable for this report.");
    return { reviewCoverageState: "unavailable", reviewGaps };
  }

  if (input.reviewStatus === "pending_review") {
    if (input.registryStatus === "review") {
      reviewGaps.push("Registry status marks this report for review attention.");
    }

    if (input.certificationState === "needs_attention") {
      reviewGaps.push("Certification state requires review attention.");
    }

    if (input.runtimeStatus === "degraded" || input.runtimeStatus === "partial") {
      reviewGaps.push("Runtime status indicates partial or degraded review readiness.");
    }

    return { reviewCoverageState: "pending_review", reviewGaps };
  }

  if (input.reviewStatus === "reviewed") {
    if (input.auditRef?.auditCoverageState !== "covered") {
      reviewGaps.push("Audit coverage is not fully covered yet.");
      return { reviewCoverageState: "partial", reviewGaps };
    }

    return { reviewCoverageState: "reviewed", reviewGaps };
  }

  if (input.reviewStatus === "not_required") {
    reviewGaps.push("Formal review is not required for this registry entry.");
    return { reviewCoverageState: "reviewed", reviewGaps };
  }

  if (input.auditRef?.auditCoverageState === "partial") {
    reviewGaps.push("Audit coverage is partial.");
  }

  if (!input.auditRef?.latestSafeAuditEvent) {
    reviewGaps.push("No latest safe audit event proxy is available.");
  }

  return { reviewCoverageState: "partial", reviewGaps };
}

function resolveReviewerState(reviewStatus: ReportReviewStatus) {
  if (reviewStatus === "reviewed" || reviewStatus === "not_required") {
    return "Super Admin read-only session (reviewer identity not persisted).";
  }

  if (reviewStatus === "pending_review") {
    return "No reviewer assigned; review workflow not enabled in RP-20.";
  }

  if (reviewStatus === "planned") {
    return "Reviewer assignment remains planned.";
  }

  return "Reviewer state unavailable.";
}

function resolveLastReviewedState(input: {
  auditRef?: ReportReviewAuditRef;
  certificationState: string;
  reviewStatus: ReportReviewStatus;
}) {
  if (input.reviewStatus === "reviewed" && input.certificationState === "certified") {
    return "Certification state indicates review readiness (no persisted review timestamp).";
  }

  if (input.auditRef?.latestSafeAuditEvent) {
    return `Inferred from latest safe audit event proxy: ${safeText(input.auditRef.latestSafeAuditEvent)}`;
  }

  if (input.reviewStatus === "pending_review") {
    return "Review attention required; no last reviewed state recorded.";
  }

  if (input.reviewStatus === "planned") {
    return "Review workflow planned; no last reviewed state recorded.";
  }

  return "No last reviewed state recorded.";
}

function resolveReviewNotesState(reviewStatus: ReportReviewStatus, registryStatus: string) {
  if (reviewStatus === "pending_review" || registryStatus === "review") {
    return "Review attention indicated by registry or runtime signals. Private review notes are not persisted in RP-20.";
  }

  return "Public review notes are not persisted in RP-20.";
}

export type ReportReviewRuntimeInput = {
  auditEntriesByReportKey: Record<string, ReportReviewAuditRef | undefined>;
  registryReports: Array<{
    certificationState: string;
    name: string;
    reportKey: string;
    status: string;
  }>;
  reportStatusByReportKey: Record<string, { runtimeStatus: ReportRuntimeStatus } | undefined>;
  selectedReportKey: string | null;
};

function buildCoverageBreakdown(entries: ReportReviewEntry[]): ReportReviewCoverageBreakdownItem[] {
  const counts: Record<ReportReviewCoverageState, number> = {
    partial: 0,
    pending_review: 0,
    planned: 0,
    reviewed: 0,
    unavailable: 0
  };

  for (const entry of entries) {
    counts[entry.reviewCoverageState] += 1;
  }

  return (Object.keys(counts) as ReportReviewCoverageState[])
    .map((label) => ({ count: counts[label], label }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function resolveSnapshotStatus(entries: ReportReviewEntry[]): ReportReviewRuntimeState {
  if (entries.length === 0) {
    return "unavailable";
  }

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator[entry.reviewCoverageState] += 1;
      return accumulator;
    },
    { partial: 0, pending_review: 0, planned: 0, reviewed: 0, unavailable: 0 }
  );

  if (totals.unavailable > entries.length / 2) {
    return "degraded";
  }

  if (totals.planned > entries.length / 2) {
    return "planned";
  }

  if (totals.reviewed === 0 && totals.partial === 0) {
    return "empty";
  }

  if (totals.pending_review + totals.partial + totals.unavailable > entries.length / 2) {
    return "degraded";
  }

  return "ready";
}

function resolveLoadingState(status: ReportReviewRuntimeState): ReportReviewLoadingState {
  if (status === "unavailable") {
    return "error";
  }

  if (status === "empty") {
    return "empty";
  }

  if (status === "planned") {
    return "planned";
  }

  if (status === "degraded") {
    return "degraded";
  }

  return "loaded";
}

export function runReportReviewSnapshot(input: ReportReviewRuntimeInput): ReportReviewSnapshot {
  const warnings: string[] = [];

  warnings.push("Report Review is read-only on page load. No review rows are created or mutated.");
  warnings.push("Review display derives from registry metadata, RP-13 status, and RP-19 audit signals only.");
  warnings.push("Sensitive values are masked before display.");

  const entries: ReportReviewEntry[] = input.registryReports.map((report) => {
    const statusEntry = input.reportStatusByReportKey[report.reportKey];
    const runtimeStatus = statusEntry?.runtimeStatus ?? "planned";
    const auditRef = input.auditEntriesByReportKey[report.reportKey];
    const reviewStatus = resolveReviewStatus({
      auditRef,
      certificationState: report.certificationState,
      registryStatus: report.status,
      runtimeStatus
    });
    const { reviewCoverageState, reviewGaps } = resolveReviewCoverage({
      auditRef,
      certificationState: report.certificationState,
      registryStatus: report.status,
      reviewStatus,
      runtimeStatus
    });

    if (report.reportKey === "rp-20-report-review") {
      reviewGaps.push("Dedicated review persistence and submit workflow remain planned.");
    }

    return {
      certificationReadinessSignal: resolveCertificationReadiness({
        certificationState: report.certificationState,
        registryStatus: report.status,
        runtimeStatus
      }),
      lastReviewedState: resolveLastReviewedState({
        auditRef,
        certificationState: report.certificationState,
        reviewStatus
      }),
      readOnly: true,
      reportKey: report.reportKey,
      reportTitle: safeText(report.name, report.reportKey),
      reviewAvailabilityState: resolveReviewAvailabilityState({
        registryStatus: report.status,
        runtimeStatus
      }),
      reviewCoverageState,
      reviewGaps,
      reviewNotesState: resolveReviewNotesState(reviewStatus, report.status),
      reviewSourceDescription: buildReviewSourceDescription(report.reportKey),
      reviewStatus,
      reviewerState: resolveReviewerState(reviewStatus)
    };
  });

  const totals: ReportReviewTotals = {
    partialReports: entries.filter((entry) => entry.reviewCoverageState === "partial").length,
    pendingReviewReports: entries.filter((entry) => entry.reviewCoverageState === "pending_review").length,
    plannedReports: entries.filter((entry) => entry.reviewCoverageState === "planned").length,
    reviewedReports: entries.filter((entry) => entry.reviewCoverageState === "reviewed").length,
    unavailableReports: entries.filter((entry) => entry.reviewCoverageState === "unavailable").length
  };
  const status = resolveSnapshotStatus(entries);
  const loadingState = resolveLoadingState(status);
  const generatedAt = new Date().toISOString();
  const selectedReportReview =
    input.selectedReportKey != null
      ? entries.find((entry) => entry.reportKey === input.selectedReportKey) ?? null
      : null;

  return {
    byCoverage: buildCoverageBreakdown(entries),
    entries,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${totals.reviewedReports} reviewed · ${totals.pendingReviewReports} pending review`,
    loadingState,
    readOnly: true,
    selectedReportKey: input.selectedReportKey,
    selectedReportReview,
    source: REPORT_REVIEW_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${totals.reviewedReports} reviewed`,
      `${totals.pendingReviewReports} pending review`,
      `${totals.partialReports} partial`,
      `${totals.plannedReports} planned`,
      `${totals.unavailableReports} unavailable`
    ].join("; "),
    superAdminReportsOnly: true,
    totals,
    warnings
  };
}

export async function mapReportReviewRuntimeToAdminFields(input: ReportReviewRuntimeInput) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      byCoverage: [],
      entries: [],
      errorMessage: "Super Admin access is required for Report Review runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Review unavailable",
      loadingState: "error" as const,
      readOnly: true as const,
      selectedReportKey: input.selectedReportKey,
      selectedReportReview: null,
      status: "unavailable" as const,
      summary: "Report Review requires Super Admin access.",
      superAdminReportsOnly: true as const,
      totals: {
        partialReports: 0,
        pendingReviewReports: 0,
        plannedReports: 0,
        reviewedReports: 0,
        unavailableReports: 0
      },
      warnings: ["Super Admin access is required for Report Review runtime."]
    };
  }

  const snapshot = runReportReviewSnapshot(input);

  return {
    byCoverage: snapshot.byCoverage,
    entries: snapshot.entries,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    loadingState: snapshot.loadingState,
    readOnly: true as const,
    selectedReportKey: snapshot.selectedReportKey,
    selectedReportReview: snapshot.selectedReportReview,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    totals: snapshot.totals,
    warnings: snapshot.warnings
  };
}

export function buildReportReviewRuntimeInput(input: {
  auditEntries: Array<{
    auditCoverageState: ReportAuditCoverageState;
    auditGaps: string[];
    lastGeneratedState: string;
    latestSafeAuditEvent: string | null;
    reportKey: string;
  }>;
  registryReports: Array<{
    certificationState: string;
    name: string;
    reportKey: string;
    status: string;
  }>;
  reportStatusByReportKey: Record<string, { runtimeStatus: ReportRuntimeStatus } | undefined>;
  selectedReportKey: string | null;
}): ReportReviewRuntimeInput {
  const auditEntriesByReportKey: Record<string, ReportReviewAuditRef | undefined> = {};

  for (const entry of input.auditEntries) {
    auditEntriesByReportKey[entry.reportKey] = {
      auditCoverageState: entry.auditCoverageState,
      auditGaps: entry.auditGaps,
      lastGeneratedState: entry.lastGeneratedState,
      latestSafeAuditEvent: entry.latestSafeAuditEvent
    };
  }

  return {
    auditEntriesByReportKey,
    registryReports: input.registryReports,
    reportStatusByReportKey: input.reportStatusByReportKey,
    selectedReportKey: input.selectedReportKey
  };
}
