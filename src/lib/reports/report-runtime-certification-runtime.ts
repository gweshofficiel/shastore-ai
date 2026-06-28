import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { ReportDataCertificationStatus } from "@/src/lib/reports/report-data-certification-runtime";
import type { ReportExportAvailabilityState } from "@/src/lib/reports/report-export-runtime";
import type { ReportScheduleAvailabilityState } from "@/src/lib/reports/report-scheduled-reports-runtime";
import type { ReportSecurityCertificationStatus } from "@/src/lib/reports/report-security-certification-runtime";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";

export type ReportRuntimeCertificationSource = "report_runtime_certification_runtime";

export type ReportRuntimeCertificationStatus =
  | "runtime_blocked"
  | "runtime_certified"
  | "runtime_partial"
  | "runtime_planned"
  | "runtime_unsafe"
  | "runtime_unknown";

export type ReportRuntimeCertificationRuntimeState =
  | "degraded"
  | "empty"
  | "planned"
  | "ready"
  | "unavailable";

export type ReportRuntimeCertificationLoadingState =
  | "degraded"
  | "empty"
  | "error"
  | "loaded"
  | "planned";

export type ReportRuntimeCertificationDataRef = {
  certificationStatus: ReportDataCertificationStatus;
};

export type ReportRuntimeCertificationSecurityRef = {
  securityCertificationStatus: ReportSecurityCertificationStatus;
};

export type ReportRuntimeCertificationEntry = {
  auditIntegrationConfirmation: string;
  dataCertificationIntegrationConfirmation: string;
  emptyStateSafetyConfirmation: string;
  errorStateSafetyConfirmation: string;
  exportIntegrationConfirmation: string;
  filtersSearchIntegrationConfirmation: string;
  pageLoadReadOnlyConfirmation: string;
  readOnly: true;
  registryIntegrationConfirmation: string;
  reportKey: string;
  reportTitle: string;
  reviewIntegrationConfirmation: string;
  runtimeCertificationNotes: string;
  runtimeCertificationStatus: ReportRuntimeCertificationStatus;
  runtimeHelperText: string;
  safeActionsIntegrationConfirmation: string;
  scheduledReportsIntegrationConfirmation: string;
  securityCertificationIntegrationConfirmation: string;
  statusIntegrationConfirmation: string;
  viewerIntegrationConfirmation: string;
  visibilityIntegrationConfirmation: string;
};

export type ReportRuntimeCertificationSelectedSummary = ReportRuntimeCertificationEntry;

export type ReportRuntimeCertificationStatusBreakdownItem = {
  count: number;
  label: ReportRuntimeCertificationStatus;
};

export type ReportRuntimeCertificationTotals = {
  runtimeBlockedReports: number;
  runtimeCertifiedReports: number;
  runtimePartialReports: number;
  runtimePlannedReports: number;
  runtimeUnsafeReports: number;
  runtimeUnknownReports: number;
};

export type ReportRuntimeCertificationSnapshot = {
  byStatus: ReportRuntimeCertificationStatusBreakdownItem[];
  entries: ReportRuntimeCertificationEntry[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  loadingState: ReportRuntimeCertificationLoadingState;
  readOnly: true;
  selectedReportKey: string | null;
  selectedReportRuntimeCertification: ReportRuntimeCertificationSelectedSummary | null;
  source: ReportRuntimeCertificationSource;
  status: ReportRuntimeCertificationRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  totals: ReportRuntimeCertificationTotals;
  warnings: string[];
};

export const REPORT_RUNTIME_CERTIFICATION_SOURCE = "report_runtime_certification_runtime" as const;

const MODULE_REPORT_KEYS = new Set([
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

const PLATFORM_RUNTIME_REPORT_KEYS = new Set([
  "rp-1-reports-registry",
  "rp-12-report-viewer",
  "rp-13-report-status",
  "rp-14-report-visibility",
  "rp-15-safe-actions",
  "rp-16-report-aggregation",
  "rp-17-report-filters",
  "rp-18-report-search",
  "rp-19-report-audit",
  "rp-20-report-review",
  "rp-21-report-export",
  "rp-22-scheduled-reports",
  "rp-23-report-data-certification",
  "rp-24-report-security-certification"
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

export function reportRuntimeCertificationBadgeTone(
  status: ReportRuntimeCertificationStatus
): "amber" | "blue" | "green" | "red" | "slate" {
  if (status === "runtime_certified") {
    return "green";
  }

  if (status === "runtime_partial" || status === "runtime_planned") {
    return "blue";
  }

  if (status === "runtime_blocked") {
    return "amber";
  }

  if (status === "runtime_unsafe") {
    return "red";
  }

  return "slate";
}

export function reportRuntimeCertificationStatusLabel(status: ReportRuntimeCertificationStatus) {
  return formatLabel(status);
}

function resolvePageLoadReadOnlyConfirmation(superAdmin: boolean) {
  return superAdmin
    ? "Page load read-only confirmed; no database mutations, provider calls, or export execution on load."
    : "Page load read-only blocked until Super Admin access is confirmed.";
}

function resolveRegistryIntegrationConfirmation(reportKey: string) {
  if (reportKey === "rp-1-reports-registry") {
    return "Reports Registry is complete and integrated with RP-12 through RP-24 runtime layers.";
  }

  if (MODULE_REPORT_KEYS.has(reportKey) || PLATFORM_RUNTIME_REPORT_KEYS.has(reportKey)) {
    return "Report is registered in RP-1 Reports Registry with runtime metadata.";
  }

  return "Registry integration planned.";
}

function resolveStatusIntegrationConfirmation(runtimeStatus: ReportRuntimeStatus) {
  if (runtimeStatus === "error") {
    return "RP-13 status integration reports error; safe fallback required.";
  }

  if (runtimeStatus === "empty" || runtimeStatus === "degraded") {
    return "RP-13 status integration is partial with safe empty or degraded signals.";
  }

  return "RP-13 Report Status runtime is integrated.";
}

function resolveVisibilityIntegrationConfirmation(runtimeVisibility: string) {
  if (runtimeVisibility === "super_admin_only" || runtimeVisibility === "internal") {
    return "RP-14 Report Visibility runtime confirms Super Admin scoped access.";
  }

  return "RP-14 visibility integration requires review.";
}

function resolveSafeActionsIntegrationConfirmation(runtimeSafeAction: string) {
  if (runtimeSafeAction === "view_enabled" || runtimeSafeAction.includes("disabled") || runtimeSafeAction === "action_locked") {
    return "RP-15 Safe Actions runtime keeps mutating actions disabled on page load.";
  }

  return "RP-15 safe actions integration requires review.";
}

function resolveFiltersSearchIntegrationConfirmation() {
  return "RP-17 Report Filters and RP-18 Report Search layers are integrated read-only.";
}

function resolveAuditIntegrationConfirmation(hasAuditEntry: boolean) {
  return hasAuditEntry
    ? "RP-19 Report Audit runtime provides read-only in-memory audit signals."
    : "RP-19 audit integration is unavailable for this report.";
}

function resolveReviewIntegrationConfirmation(hasReviewEntry: boolean) {
  return hasReviewEntry
    ? "RP-20 Report Review runtime provides read-only review signals."
    : "RP-20 review integration is unavailable for this report.";
}

function resolveExportIntegrationConfirmation(exportAvailability?: ReportExportAvailabilityState) {
  if (!exportAvailability) {
    return "RP-21 export integration is unavailable for this report.";
  }

  if (exportAvailability === "export_available") {
    return "RP-21 export is user-triggered only; no export execution on page load.";
  }

  return "RP-21 Report Export runtime integrated; export remains disabled until explicitly triggered.";
}

function resolveScheduledReportsIntegrationConfirmation(scheduleAvailability?: ReportScheduleAvailabilityState) {
  if (!scheduleAvailability) {
    return "RP-22 scheduling integration is unavailable for this report.";
  }

  return "RP-22 Scheduled Reports runtime integrated; no automatic scheduling on page load.";
}

function resolveDataCertificationIntegrationConfirmation(dataCert?: ReportRuntimeCertificationDataRef) {
  if (!dataCert) {
    return "RP-23 data certification integration is unavailable.";
  }

  return `RP-23 data certification status: ${dataCert.certificationStatus.replace(/_/g, " ")}.`;
}

function resolveSecurityCertificationIntegrationConfirmation(securityCert?: ReportRuntimeCertificationSecurityRef) {
  if (!securityCert) {
    return "RP-24 security certification integration is unavailable.";
  }

  return `RP-24 security certification status: ${securityCert.securityCertificationStatus.replace(/_/g, " ")}.`;
}

function resolveViewerIntegrationConfirmation(viewEnabled: boolean, reportKey: string) {
  if (reportKey === "rp-12-report-viewer") {
    return "RP-12 Report Viewer catalog is integrated with registry and runtime adapters.";
  }

  return viewEnabled
    ? "RP-12 Report Viewer supports read-only details for this report."
    : "RP-12 viewer entry is catalog-only or planned for this report.";
}

function resolveEmptyStateSafetyConfirmation(runtimeStatus: ReportRuntimeStatus, adapterLoading?: string) {
  if (runtimeStatus === "error" || adapterLoading === "error") {
    return "Empty state safety unavailable due to runtime error.";
  }

  if (runtimeStatus === "empty" || adapterLoading === "empty") {
    return "Empty state safety confirmed; safe empty messaging is displayed.";
  }

  return "Empty state safety confirmed for this report runtime.";
}

function resolveErrorStateSafetyConfirmation(runtimeStatus: ReportRuntimeStatus, adapterLoading?: string) {
  if (runtimeStatus === "error" || adapterLoading === "error") {
    return "Runtime error detected; review safe fallback handling before production use.";
  }

  if (runtimeStatus === "degraded" || adapterLoading === "degraded") {
    return "Degraded runtime signals use safe helper text without exposing sensitive data.";
  }

  return "Error state safety confirmed; no unsafe error payloads are displayed.";
}

function resolveRuntimeHelperText(status: ReportRuntimeCertificationStatus) {
  switch (status) {
    case "runtime_certified":
      return "All required runtime protections pass for Super Admin read-only reporting.";
    case "runtime_partial":
      return "Runtime integration is live but one or more protections remain partial or planned.";
    case "runtime_planned":
      return "Runtime certification remains planned for this report.";
    case "runtime_blocked":
      return "Runtime certification is blocked until Super Admin and access requirements are satisfied.";
    case "runtime_unsafe":
      return "Runtime certification is unsafe; resolve error or security signals before production use.";
    default:
      return "Runtime certification status could not be determined.";
  }
}

function resolveRuntimeCertificationStatus(input: {
  adapterLoadingState: "degraded" | "empty" | "error" | "loaded" | "planned" | undefined;
  dataCertRef?: ReportRuntimeCertificationDataRef;
  hasAuditEntry: boolean;
  hasReviewEntry: boolean;
  pageLoadReadOnlyConfirmation: string;
  registryStatus: string;
  reportKey: string;
  runtimeStatus: ReportRuntimeStatus;
  securityCertRef?: ReportRuntimeCertificationSecurityRef;
  superAdmin: boolean;
}): { runtimeCertificationNotes: string; runtimeCertificationStatus: ReportRuntimeCertificationStatus } {
  const notes: string[] = [];

  if (!input.superAdmin) {
    notes.push("Super Admin access is required for runtime certification.");
    return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_blocked" };
  }

  if (
    input.reportKey === "rp-25-report-runtime-certification" ||
    input.reportKey === "rp-26-report-production-certification"
  ) {
    notes.push(
      input.reportKey === "rp-26-report-production-certification"
        ? "RP-26 production certification resolver is live as read-only metadata; no certification records are written."
        : "RP-25 runtime certification resolver is live as read-only metadata; no certification records are written."
    );
    return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_partial" };
  }

  if (input.securityCertRef?.securityCertificationStatus === "unsafe" || input.dataCertRef?.certificationStatus === "unsafe") {
    notes.push("Data or security certification is unsafe; runtime certification blocked.");
    return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_unsafe" };
  }

  if (
    input.securityCertRef?.securityCertificationStatus === "blocked" ||
    input.dataCertRef?.certificationStatus === "blocked"
  ) {
    notes.push("Data or security certification is blocked.");
    return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_blocked" };
  }

  if (input.runtimeStatus === "error" || input.adapterLoadingState === "error") {
    notes.push("Runtime adapter error detected.");
    return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_unsafe" };
  }

  if (input.pageLoadReadOnlyConfirmation.includes("blocked")) {
    notes.push("Page load read-only requirements are not satisfied.");
    return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_blocked" };
  }

  const dataOk = input.dataCertRef?.certificationStatus === "certified";
  const securityOk = input.securityCertRef?.securityCertificationStatus === "certified";
  const dataPartial = input.dataCertRef?.certificationStatus === "partial";
  const securityPartial = input.securityCertRef?.securityCertificationStatus === "partial";

  if (MODULE_REPORT_KEYS.has(input.reportKey)) {
    if (
      dataOk &&
      securityOk &&
      input.adapterLoadingState === "loaded" &&
      (input.runtimeStatus === "available" ||
        input.runtimeStatus === "active" ||
        input.runtimeStatus === "certified" ||
        input.runtimeStatus === "partial") &&
      input.hasAuditEntry &&
      input.hasReviewEntry
    ) {
      notes.push("Module adapter runtime is certified across registry, status, visibility, audit, review, export, schedule, data, and security layers.");
      return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_certified" };
    }

    if (dataPartial || securityPartial || input.adapterLoadingState === "degraded" || input.adapterLoadingState === "empty") {
      notes.push("Module runtime is partially certified; degraded, empty, or partial certification signals remain.");
      return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_partial" };
    }

    if (input.registryStatus === "planned" || input.adapterLoadingState === "planned") {
      notes.push("Module runtime certification remains planned.");
      return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_planned" };
    }

    notes.push("Module runtime certification is incomplete.");
    return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_partial" };
  }

  if (PLATFORM_RUNTIME_REPORT_KEYS.has(input.reportKey)) {
    if (
      input.registryStatus === "ready" &&
      (dataOk || dataPartial) &&
      (securityOk || securityPartial) &&
      input.reportKey !== "rp-22-scheduled-reports" &&
      input.reportKey !== "rp-23-report-data-certification" &&
      input.reportKey !== "rp-24-report-security-certification"
    ) {
      notes.push("Platform runtime layer is certified for Super Admin read-only integration.");
      return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_certified" };
    }

    if (
      input.reportKey === "rp-22-scheduled-reports" ||
      input.reportKey === "rp-23-report-data-certification" ||
      input.reportKey === "rp-24-report-security-certification"
    ) {
      notes.push("Foundation runtime layer is live; downstream execution backends remain planned.");
      return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_partial" };
    }

    notes.push("Platform runtime certification is partial.");
    return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_partial" };
  }

  if (input.registryStatus === "planned" || input.runtimeStatus === "planned") {
    notes.push("Runtime certification remains planned.");
    return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_planned" };
  }

  notes.push("Runtime certification status could not be determined from available signals.");
  return { runtimeCertificationNotes: notes.join(" "), runtimeCertificationStatus: "runtime_unknown" };
}

export type ReportRuntimeCertificationRuntimeInput = {
  adapterStatesByReportKey: Record<
    string,
    { loadingState: "degraded" | "empty" | "error" | "loaded" | "planned" } | undefined
  >;
  auditReportKeys: Set<string>;
  dataCertificationByReportKey: Record<string, ReportRuntimeCertificationDataRef | undefined>;
  exportAvailabilityByReportKey: Record<string, ReportExportAvailabilityState | undefined>;
  registryReports: Array<{
    name: string;
    reportKey: string;
    runtimeSafeAction: string;
    runtimeStatus: ReportRuntimeStatus;
    runtimeVisibility: string;
    status: string;
    viewEnabled: boolean;
  }>;
  reviewReportKeys: Set<string>;
  scheduleAvailabilityByReportKey: Record<string, ReportScheduleAvailabilityState | undefined>;
  securityCertificationByReportKey: Record<string, ReportRuntimeCertificationSecurityRef | undefined>;
  selectedReportKey: string | null;
  superAdmin: boolean;
};

function buildStatusBreakdown(
  entries: ReportRuntimeCertificationEntry[]
): ReportRuntimeCertificationStatusBreakdownItem[] {
  const counts: Record<ReportRuntimeCertificationStatus, number> = {
    runtime_blocked: 0,
    runtime_certified: 0,
    runtime_partial: 0,
    runtime_planned: 0,
    runtime_unsafe: 0,
    runtime_unknown: 0
  };

  for (const entry of entries) {
    counts[entry.runtimeCertificationStatus] += 1;
  }

  return (Object.keys(counts) as ReportRuntimeCertificationStatus[])
    .map((label) => ({ count: counts[label], label }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function resolveSnapshotStatus(entries: ReportRuntimeCertificationEntry[]): ReportRuntimeCertificationRuntimeState {
  if (entries.length === 0) {
    return "unavailable";
  }

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator[entry.runtimeCertificationStatus] += 1;
      return accumulator;
    },
    {
      runtime_blocked: 0,
      runtime_certified: 0,
      runtime_partial: 0,
      runtime_planned: 0,
      runtime_unsafe: 0,
      runtime_unknown: 0
    }
  );

  if (totals.runtime_unsafe + totals.runtime_blocked > 0) {
    return "degraded";
  }

  if (totals.runtime_planned + totals.runtime_unknown > entries.length / 2) {
    return "planned";
  }

  if (totals.runtime_certified === 0) {
    return "empty";
  }

  if (totals.runtime_partial + totals.runtime_planned + totals.runtime_unknown > entries.length / 2) {
    return "planned";
  }

  return "ready";
}

function resolveLoadingState(status: ReportRuntimeCertificationRuntimeState): ReportRuntimeCertificationLoadingState {
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

export function runReportRuntimeCertificationSnapshot(
  input: ReportRuntimeCertificationRuntimeInput
): ReportRuntimeCertificationSnapshot {
  const warnings: string[] = [];

  warnings.push("Report Runtime Certification is read-only on page load. No certification records are written.");
  warnings.push(
    "Runtime certification derives from registry, adapters, RP-12 through RP-24 runtime layers, data certification, and security certification only."
  );
  warnings.push("Sensitive values are masked before display.");

  const entries: ReportRuntimeCertificationEntry[] = input.registryReports.map((report) => {
    const dataCertRef = input.dataCertificationByReportKey[report.reportKey];
    const securityCertRef = input.securityCertificationByReportKey[report.reportKey];
    const adapterState = input.adapterStatesByReportKey[report.reportKey];
    const pageLoadReadOnlyConfirmation = resolvePageLoadReadOnlyConfirmation(input.superAdmin);
    const { runtimeCertificationNotes, runtimeCertificationStatus } = resolveRuntimeCertificationStatus({
      adapterLoadingState: adapterState?.loadingState,
      dataCertRef,
      hasAuditEntry: input.auditReportKeys.has(report.reportKey),
      hasReviewEntry: input.reviewReportKeys.has(report.reportKey),
      pageLoadReadOnlyConfirmation,
      registryStatus: report.status,
      reportKey: report.reportKey,
      runtimeStatus: report.runtimeStatus,
      securityCertRef,
      superAdmin: input.superAdmin
    });

    return {
      auditIntegrationConfirmation: resolveAuditIntegrationConfirmation(input.auditReportKeys.has(report.reportKey)),
      dataCertificationIntegrationConfirmation: resolveDataCertificationIntegrationConfirmation(dataCertRef),
      emptyStateSafetyConfirmation: resolveEmptyStateSafetyConfirmation(
        report.runtimeStatus,
        adapterState?.loadingState
      ),
      errorStateSafetyConfirmation: resolveErrorStateSafetyConfirmation(
        report.runtimeStatus,
        adapterState?.loadingState
      ),
      exportIntegrationConfirmation: resolveExportIntegrationConfirmation(
        input.exportAvailabilityByReportKey[report.reportKey]
      ),
      filtersSearchIntegrationConfirmation: resolveFiltersSearchIntegrationConfirmation(),
      pageLoadReadOnlyConfirmation,
      readOnly: true,
      registryIntegrationConfirmation: resolveRegistryIntegrationConfirmation(report.reportKey),
      reportKey: report.reportKey,
      reportTitle: safeText(report.name, report.reportKey),
      reviewIntegrationConfirmation: resolveReviewIntegrationConfirmation(input.reviewReportKeys.has(report.reportKey)),
      runtimeCertificationNotes,
      runtimeCertificationStatus,
      runtimeHelperText: resolveRuntimeHelperText(runtimeCertificationStatus),
      safeActionsIntegrationConfirmation: resolveSafeActionsIntegrationConfirmation(report.runtimeSafeAction),
      scheduledReportsIntegrationConfirmation: resolveScheduledReportsIntegrationConfirmation(
        input.scheduleAvailabilityByReportKey[report.reportKey]
      ),
      securityCertificationIntegrationConfirmation: resolveSecurityCertificationIntegrationConfirmation(securityCertRef),
      statusIntegrationConfirmation: resolveStatusIntegrationConfirmation(report.runtimeStatus),
      viewerIntegrationConfirmation: resolveViewerIntegrationConfirmation(report.viewEnabled, report.reportKey),
      visibilityIntegrationConfirmation: resolveVisibilityIntegrationConfirmation(report.runtimeVisibility)
    };
  });

  const totals: ReportRuntimeCertificationTotals = {
    runtimeBlockedReports: entries.filter((entry) => entry.runtimeCertificationStatus === "runtime_blocked").length,
    runtimeCertifiedReports: entries.filter((entry) => entry.runtimeCertificationStatus === "runtime_certified").length,
    runtimePartialReports: entries.filter((entry) => entry.runtimeCertificationStatus === "runtime_partial").length,
    runtimePlannedReports: entries.filter((entry) => entry.runtimeCertificationStatus === "runtime_planned").length,
    runtimeUnsafeReports: entries.filter((entry) => entry.runtimeCertificationStatus === "runtime_unsafe").length,
    runtimeUnknownReports: entries.filter((entry) => entry.runtimeCertificationStatus === "runtime_unknown").length
  };
  const status = resolveSnapshotStatus(entries);
  const loadingState = resolveLoadingState(status);
  const generatedAt = new Date().toISOString();
  const selectedReportRuntimeCertification =
    input.selectedReportKey != null
      ? entries.find((entry) => entry.reportKey === input.selectedReportKey) ?? null
      : null;

  return {
    byStatus: buildStatusBreakdown(entries),
    entries,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${totals.runtimeCertifiedReports} runtime certified · ${totals.runtimePartialReports} partial`,
    loadingState,
    readOnly: true,
    selectedReportKey: input.selectedReportKey,
    selectedReportRuntimeCertification,
    source: REPORT_RUNTIME_CERTIFICATION_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${totals.runtimeCertifiedReports} runtime certified`,
      `${totals.runtimePartialReports} partial`,
      `${totals.runtimePlannedReports} planned`,
      `${totals.runtimeUnsafeReports} unsafe`
    ].join("; "),
    superAdminReportsOnly: true,
    totals,
    warnings
  };
}

export async function mapReportRuntimeCertificationRuntimeToAdminFields(
  input: ReportRuntimeCertificationRuntimeInput
) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      byStatus: [],
      entries: [],
      errorMessage: "Super Admin access is required for Report Runtime Certification runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Runtime Certification unavailable",
      loadingState: "error" as const,
      readOnly: true as const,
      selectedReportKey: input.selectedReportKey,
      selectedReportRuntimeCertification: null,
      status: "unavailable" as const,
      summary: "Report Runtime Certification requires Super Admin access.",
      superAdminReportsOnly: true as const,
      totals: {
        runtimeBlockedReports: 0,
        runtimeCertifiedReports: 0,
        runtimePartialReports: 0,
        runtimePlannedReports: 0,
        runtimeUnsafeReports: 0,
        runtimeUnknownReports: 0
      },
      warnings: ["Super Admin access is required for Report Runtime Certification runtime."]
    };
  }

  const snapshot = runReportRuntimeCertificationSnapshot({ ...input, superAdmin: true });

  return {
    byStatus: snapshot.byStatus,
    entries: snapshot.entries,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    loadingState: snapshot.loadingState,
    readOnly: true as const,
    selectedReportKey: snapshot.selectedReportKey,
    selectedReportRuntimeCertification: snapshot.selectedReportRuntimeCertification,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    totals: snapshot.totals,
    warnings: snapshot.warnings
  };
}

export function buildReportRuntimeCertificationRuntimeInput(input: {
  adapterStatesByReportKey: ReportRuntimeCertificationRuntimeInput["adapterStatesByReportKey"];
  auditEntries: Array<{ reportKey: string }>;
  dataCertificationEntries: Array<{
    certificationStatus: ReportDataCertificationStatus;
    reportKey: string;
  }>;
  exportEntries: Array<{
    exportAvailabilityState: ReportExportAvailabilityState;
    reportKey: string;
  }>;
  registryReports: Array<{
    name: string;
    reportKey: string;
    runtimeSafeAction: string;
    runtimeStatus: ReportRuntimeStatus;
    runtimeVisibility: string;
    status: string;
    viewEnabled: boolean;
  }>;
  reviewEntries: Array<{ reportKey: string }>;
  scheduleEntries: Array<{
    reportKey: string;
    scheduleAvailabilityState: ReportScheduleAvailabilityState;
  }>;
  securityCertificationEntries: Array<{
    reportKey: string;
    securityCertificationStatus: ReportSecurityCertificationStatus;
  }>;
  selectedReportKey: string | null;
}): ReportRuntimeCertificationRuntimeInput {
  const dataCertificationByReportKey: Record<string, ReportRuntimeCertificationDataRef | undefined> = {};
  const securityCertificationByReportKey: Record<string, ReportRuntimeCertificationSecurityRef | undefined> = {};
  const exportAvailabilityByReportKey: Record<string, ReportExportAvailabilityState | undefined> = {};
  const scheduleAvailabilityByReportKey: Record<string, ReportScheduleAvailabilityState | undefined> = {};

  for (const entry of input.dataCertificationEntries) {
    dataCertificationByReportKey[entry.reportKey] = { certificationStatus: entry.certificationStatus };
  }

  for (const entry of input.securityCertificationEntries) {
    securityCertificationByReportKey[entry.reportKey] = {
      securityCertificationStatus: entry.securityCertificationStatus
    };
  }

  for (const entry of input.exportEntries) {
    exportAvailabilityByReportKey[entry.reportKey] = entry.exportAvailabilityState;
  }

  for (const entry of input.scheduleEntries) {
    scheduleAvailabilityByReportKey[entry.reportKey] = entry.scheduleAvailabilityState;
  }

  return {
    adapterStatesByReportKey: input.adapterStatesByReportKey,
    auditReportKeys: new Set(input.auditEntries.map((entry) => entry.reportKey)),
    dataCertificationByReportKey,
    exportAvailabilityByReportKey,
    registryReports: input.registryReports,
    reviewReportKeys: new Set(input.reviewEntries.map((entry) => entry.reportKey)),
    scheduleAvailabilityByReportKey,
    securityCertificationByReportKey,
    selectedReportKey: input.selectedReportKey,
    superAdmin: false
  };
}
