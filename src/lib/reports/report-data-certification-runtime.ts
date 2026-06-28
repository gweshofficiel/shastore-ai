import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { ReportAuditCoverageState } from "@/src/lib/reports/report-audit-runtime";
import type { ReportExportAvailabilityState } from "@/src/lib/reports/report-export-runtime";
import type { ReportReviewCoverageState } from "@/src/lib/reports/report-review-runtime";
import type { ReportScheduleAvailabilityState } from "@/src/lib/reports/report-scheduled-reports-runtime";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";

export type ReportDataCertificationSource = "report_data_certification_runtime";

export type ReportDataCertificationStatus =
  | "blocked"
  | "certified"
  | "partial"
  | "planned"
  | "unsafe"
  | "unknown";

export type ReportDataSourceAvailability = "available" | "partial" | "planned" | "unavailable";

export type ReportRuntimeAdapterHealth =
  | "degraded"
  | "empty"
  | "error"
  | "healthy"
  | "not_applicable"
  | "planned";

export type ReportDataCertificationRuntimeState =
  | "degraded"
  | "empty"
  | "planned"
  | "ready"
  | "unavailable";

export type ReportDataCertificationLoadingState =
  | "degraded"
  | "empty"
  | "error"
  | "loaded"
  | "planned";

export type ReportDataCertificationAuditRef = {
  auditCoverageState: ReportAuditCoverageState;
  auditGaps: string[];
};

export type ReportDataCertificationReviewRef = {
  certificationReadinessSignal: string;
  reviewCoverageState: ReportReviewCoverageState;
  reviewGaps: string[];
};

export type ReportDataCertificationExportRef = {
  exportAvailabilityState: ReportExportAvailabilityState;
};

export type ReportDataCertificationScheduleRef = {
  scheduleAvailabilityState: ReportScheduleAvailabilityState;
  scheduleGaps: string[];
};

export type ReportDataCertificationEntry = {
  aggregationSafetyConfirmation: string;
  certificationNotes: string;
  certificationStatus: ReportDataCertificationStatus;
  dataSourceAvailability: ReportDataSourceAvailability;
  dataSourceName: string;
  emptyStateSafetyConfirmation: string;
  readOnly: true;
  readOnlyConfirmation: string;
  reportKey: string;
  reportTitle: string;
  runtimeAdapterHealth: ReportRuntimeAdapterHealth;
  sensitiveDataMaskingConfirmation: string;
};

export type ReportDataCertificationSelectedSummary = ReportDataCertificationEntry;

export type ReportDataCertificationStatusBreakdownItem = {
  count: number;
  label: ReportDataCertificationStatus;
};

export type ReportDataCertificationTotals = {
  blockedReports: number;
  certifiedReports: number;
  partialReports: number;
  plannedReports: number;
  unsafeReports: number;
  unknownReports: number;
};

export type ReportDataCertificationSnapshot = {
  byStatus: ReportDataCertificationStatusBreakdownItem[];
  entries: ReportDataCertificationEntry[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  loadingState: ReportDataCertificationLoadingState;
  readOnly: true;
  selectedReportCertification: ReportDataCertificationSelectedSummary | null;
  selectedReportKey: string | null;
  source: ReportDataCertificationSource;
  status: ReportDataCertificationRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  totals: ReportDataCertificationTotals;
  warnings: string[];
};

export const REPORT_DATA_CERTIFICATION_SOURCE = "report_data_certification_runtime" as const;

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
  "rp-22-scheduled-reports"
]);

const FUTURE_CERTIFICATION_REPORT_KEYS = new Set([
  "rp-24-report-security-certification",
  "rp-25-report-runtime-certification",
  "rp-26-report-production-certification"
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

export function reportDataCertificationBadgeTone(
  status: ReportDataCertificationStatus
): "amber" | "blue" | "green" | "red" | "slate" {
  if (status === "certified") {
    return "green";
  }

  if (status === "partial" || status === "planned") {
    return "blue";
  }

  if (status === "blocked") {
    return "amber";
  }

  if (status === "unsafe") {
    return "red";
  }

  return "slate";
}

export function reportDataCertificationStatusLabel(status: ReportDataCertificationStatus) {
  return formatLabel(status);
}

function resolveDataSourceName(input: {
  category: string;
  dataSourceDescription: string;
  reportKey: string;
  title: string;
}) {
  if (input.reportKey === "rp-1-reports-registry") {
    return "Reports Registry runtime metadata";
  }

  if (input.reportKey === "rp-23-report-data-certification") {
    return "Report Data Certification runtime resolver";
  }

  if (MODULE_REPORT_KEYS.has(input.reportKey)) {
    return `${input.category} adapter (${input.title})`;
  }

  if (PLATFORM_RUNTIME_REPORT_KEYS.has(input.reportKey)) {
    return `${input.title} runtime resolver`;
  }

  if (FUTURE_CERTIFICATION_REPORT_KEYS.has(input.reportKey)) {
    return "Certification layer reserved";
  }

  const description = safeText(input.dataSourceDescription);

  if (description) {
    return description.slice(0, 80);
  }

  return `${input.category} data source`;
}

function resolveRuntimeAdapterHealth(input: {
  adapterErrorMessage: string | null;
  adapterLoadingState: "degraded" | "empty" | "error" | "loaded" | "planned" | undefined;
  reportKey: string;
}): ReportRuntimeAdapterHealth {
  if (!MODULE_REPORT_KEYS.has(input.reportKey)) {
    return "not_applicable";
  }

  if (input.adapterLoadingState === "loaded") {
    return "healthy";
  }

  if (input.adapterLoadingState === "degraded") {
    return "degraded";
  }

  if (input.adapterLoadingState === "empty") {
    return "empty";
  }

  if (input.adapterLoadingState === "error" || input.adapterErrorMessage) {
    return "error";
  }

  return "planned";
}

function resolveDataSourceAvailability(input: {
  adapterHealth: ReportRuntimeAdapterHealth;
  registryStatus: string;
  reportKey: string;
  runtimeStatus: ReportRuntimeStatus;
}): ReportDataSourceAvailability {
  if (FUTURE_CERTIFICATION_REPORT_KEYS.has(input.reportKey)) {
    return "planned";
  }

  if (input.registryStatus === "planned" || input.registryStatus === "inactive") {
    return "planned";
  }

  if (input.runtimeStatus === "error") {
    return "unavailable";
  }

  if (MODULE_REPORT_KEYS.has(input.reportKey)) {
    if (input.adapterHealth === "healthy") {
      return "available";
    }

    if (input.adapterHealth === "degraded" || input.adapterHealth === "empty") {
      return "partial";
    }

    if (input.adapterHealth === "error") {
      return "unavailable";
    }

    return "planned";
  }

  if (PLATFORM_RUNTIME_REPORT_KEYS.has(input.reportKey) || input.reportKey === "rp-23-report-data-certification") {
    return "available";
  }

  return "planned";
}

function resolveReadOnlyConfirmation(input: {
  runtimeSafeAction: string;
  superAdmin: boolean;
}): string {
  if (!input.superAdmin) {
    return "Read-only blocked until Super Admin access is confirmed.";
  }

  if (
    input.runtimeSafeAction === "action_enabled" ||
    input.runtimeSafeAction === "generate_enabled"
  ) {
    return "Read-only blocked; unsafe generate actions are not allowed on page load.";
  }

  return "Read-only confirmed on page load; no inserts, updates, deletes, or provider calls.";
}

function resolveSensitiveDataMaskingConfirmation(superAdmin: boolean) {
  return superAdmin
    ? "Sensitive data masking confirmed via safe diagnostics before display."
    : "Sensitive data masking blocked until Super Admin access is confirmed.";
}

function resolveAggregationSafetyConfirmation(auditRef?: ReportDataCertificationAuditRef) {
  if (!auditRef) {
    return "Aggregation safety planned; audit signals unavailable.";
  }

  if (auditRef.auditCoverageState === "covered") {
    return "Aggregation safety confirmed; audit coverage is complete.";
  }

  if (auditRef.auditCoverageState === "partial") {
    return "Aggregation safety partial; limited audit coverage recorded.";
  }

  if (auditRef.auditCoverageState === "planned") {
    return "Aggregation safety planned; runtime metadata only.";
  }

  return "Aggregation safety unavailable; audit coverage missing.";
}

function resolveEmptyStateSafetyConfirmation(input: {
  adapterHealth: ReportRuntimeAdapterHealth;
  runtimeStatus: ReportRuntimeStatus;
}) {
  if (input.runtimeStatus === "error") {
    return "Empty state safety unavailable; runtime error without safe fallback.";
  }

  if (input.runtimeStatus === "empty" || input.adapterHealth === "empty") {
    return "Empty state safety confirmed; safe empty messaging is displayed.";
  }

  if (input.runtimeStatus === "degraded" || input.adapterHealth === "degraded") {
    return "Empty state safety partial; degraded signals use safe helper text.";
  }

  if (input.runtimeStatus === "planned" || input.runtimeStatus === "inactive") {
    return "Empty state safety planned; no runtime data loaded yet.";
  }

  return "Empty state safety confirmed; runtime handles empty and partial states.";
}

function resolveCertificationStatus(input: {
  adapterHealth: ReportRuntimeAdapterHealth;
  auditRef?: ReportDataCertificationAuditRef;
  dataSourceAvailability: ReportDataSourceAvailability;
  dataSourceDescription: string;
  exportRef?: ReportDataCertificationExportRef;
  readOnlyConfirmation: string;
  registryStatus: string;
  reportKey: string;
  reviewRef?: ReportDataCertificationReviewRef;
  runtimeStatus: ReportRuntimeStatus;
  runtimeVisibility: string;
  scheduleRef?: ReportDataCertificationScheduleRef;
  superAdmin: boolean;
}): { certificationNotes: string; certificationStatus: ReportDataCertificationStatus } {
  const notes: string[] = [];

  if (!input.superAdmin) {
    notes.push("Super Admin access is required for data certification.");
    return { certificationNotes: notes.join(" "), certificationStatus: "blocked" };
  }

  if (input.runtimeVisibility === "hidden" || input.runtimeVisibility === "restricted") {
    notes.push("Report visibility is restricted; certification is blocked.");
    return { certificationNotes: notes.join(" "), certificationStatus: "blocked" };
  }

  if (FUTURE_CERTIFICATION_REPORT_KEYS.has(input.reportKey)) {
    notes.push("Future certification phase; data source not enabled yet.");
    return { certificationNotes: notes.join(" "), certificationStatus: "planned" };
  }

  if (input.readOnlyConfirmation.includes("blocked")) {
    notes.push("Read-only requirements are not satisfied.");
    return { certificationNotes: notes.join(" "), certificationStatus: "blocked" };
  }

  if (input.runtimeStatus === "error" || input.adapterHealth === "error") {
    notes.push("Runtime adapter error detected; data access is not production-safe.");
    return { certificationNotes: notes.join(" "), certificationStatus: "unsafe" };
  }

  if (
    !dataSourceDescriptionKnown({
      dataSourceDescription: input.dataSourceDescription,
      reportKey: input.reportKey
    })
  ) {
    notes.push("Data source metadata is missing or unknown.");
    return { certificationNotes: notes.join(" "), certificationStatus: "unknown" };
  }

  if (input.reportKey === "rp-23-report-data-certification") {
    notes.push("RP-23 certification resolver is live as read-only metadata; no certification records are written.");
    return { certificationNotes: notes.join(" "), certificationStatus: "partial" };
  }

  if (input.reportKey === "rp-22-scheduled-reports") {
    notes.push("Scheduling foundation is read-only; job runner and delivery backend remain planned.");
    return { certificationNotes: notes.join(" "), certificationStatus: "partial" };
  }

  if (MODULE_REPORT_KEYS.has(input.reportKey)) {
    const auditOk =
      input.auditRef?.auditCoverageState === "covered" || input.auditRef?.auditCoverageState === "partial";
    const reviewOk =
      input.reviewRef?.reviewCoverageState === "reviewed" ||
      input.reviewRef?.reviewCoverageState === "partial" ||
      input.reviewRef?.certificationReadinessSignal === "ready_for_certification" ||
      input.reviewRef?.certificationReadinessSignal === "certified";
    const exportOk =
      input.exportRef?.exportAvailabilityState === "export_available" ||
      input.exportRef?.exportAvailabilityState === "export_disabled";

    if (
      input.adapterHealth === "healthy" &&
      (input.runtimeStatus === "available" ||
        input.runtimeStatus === "active" ||
        input.runtimeStatus === "certified" ||
        input.runtimeStatus === "partial") &&
      auditOk &&
      reviewOk &&
      exportOk
    ) {
      notes.push("Module adapter uses approved read-only sources with masking, empty states, and safe fallbacks.");
      return { certificationNotes: notes.join(" "), certificationStatus: "certified" };
    }

    if (input.adapterHealth === "degraded" || input.adapterHealth === "empty" || input.runtimeStatus === "degraded") {
      notes.push("Module adapter is partially certified; degraded or empty runtime signals remain.");
      return { certificationNotes: notes.join(" "), certificationStatus: "partial" };
    }

    if (input.registryStatus === "planned" || input.adapterHealth === "planned") {
      notes.push("Module adapter certification remains planned.");
      return { certificationNotes: notes.join(" "), certificationStatus: "planned" };
    }

    notes.push("Module adapter certification is incomplete; review audit, review, and export signals.");
    return { certificationNotes: notes.join(" "), certificationStatus: "partial" };
  }

  if (PLATFORM_RUNTIME_REPORT_KEYS.has(input.reportKey)) {
    const scheduleOk =
      input.reportKey !== "rp-22-scheduled-reports" ||
      input.scheduleRef?.scheduleAvailabilityState === "scheduling_available" ||
      input.scheduleRef?.scheduleAvailabilityState === "scheduling_planned";

    if (
      input.dataSourceAvailability === "available" &&
      input.registryStatus === "ready" &&
      scheduleOk
    ) {
      notes.push("Platform runtime derives read-only metadata from approved registry and resolver outputs only.");
      return { certificationNotes: notes.join(" "), certificationStatus: "certified" };
    }

    notes.push("Platform runtime certification is partial; additional runtime phases may remain planned.");
    return { certificationNotes: notes.join(" "), certificationStatus: "partial" };
  }

  if (input.registryStatus === "planned" || input.runtimeStatus === "planned") {
    notes.push("Report data certification remains planned.");
    return { certificationNotes: notes.join(" "), certificationStatus: "planned" };
  }

  notes.push("Certification status could not be determined from available runtime signals.");
  return { certificationNotes: notes.join(" "), certificationStatus: "unknown" };
}

function dataSourceDescriptionKnown(input: {
  dataSourceDescription: string;
  reportKey: string;
}) {
  if (PLATFORM_RUNTIME_REPORT_KEYS.has(input.reportKey) || MODULE_REPORT_KEYS.has(input.reportKey)) {
    return Boolean(safeText(input.dataSourceDescription));
  }

  return Boolean(safeText(input.dataSourceDescription)) && !input.dataSourceDescription.includes("reserved for RP-");
}

export type ReportDataCertificationRuntimeInput = {
  adapterStatesByReportKey: Record<
    string,
    { errorMessage: string | null; loadingState: "degraded" | "empty" | "error" | "loaded" | "planned" } | undefined
  >;
  auditEntriesByReportKey: Record<string, ReportDataCertificationAuditRef | undefined>;
  exportEntriesByReportKey: Record<string, ReportDataCertificationExportRef | undefined>;
  registryReports: Array<{
    category: string;
    dataSourceDescription: string;
    name: string;
    reportKey: string;
    runtimeSafeAction: string;
    runtimeStatus: ReportRuntimeStatus;
    runtimeVisibility: string;
    status: string;
  }>;
  reviewEntriesByReportKey: Record<string, ReportDataCertificationReviewRef | undefined>;
  scheduleEntriesByReportKey: Record<string, ReportDataCertificationScheduleRef | undefined>;
  selectedReportKey: string | null;
  superAdmin: boolean;
};

function buildStatusBreakdown(
  entries: ReportDataCertificationEntry[]
): ReportDataCertificationStatusBreakdownItem[] {
  const counts: Record<ReportDataCertificationStatus, number> = {
    blocked: 0,
    certified: 0,
    partial: 0,
    planned: 0,
    unsafe: 0,
    unknown: 0
  };

  for (const entry of entries) {
    counts[entry.certificationStatus] += 1;
  }

  return (Object.keys(counts) as ReportDataCertificationStatus[])
    .map((label) => ({ count: counts[label], label }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function resolveSnapshotStatus(entries: ReportDataCertificationEntry[]): ReportDataCertificationRuntimeState {
  if (entries.length === 0) {
    return "unavailable";
  }

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator[entry.certificationStatus] += 1;
      return accumulator;
    },
    { blocked: 0, certified: 0, partial: 0, planned: 0, unsafe: 0, unknown: 0 }
  );

  if (totals.unsafe + totals.blocked > 0) {
    return "degraded";
  }

  if (totals.planned + totals.unknown > entries.length / 2) {
    return "planned";
  }

  if (totals.certified === 0) {
    return "empty";
  }

  if (totals.partial + totals.planned + totals.unknown > entries.length / 2) {
    return "planned";
  }

  return "ready";
}

function resolveLoadingState(status: ReportDataCertificationRuntimeState): ReportDataCertificationLoadingState {
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

export function runReportDataCertificationSnapshot(
  input: ReportDataCertificationRuntimeInput
): ReportDataCertificationSnapshot {
  const warnings: string[] = [];

  warnings.push("Report Data Certification is read-only on page load. No certification records are written.");
  warnings.push(
    "Certification derives from registry metadata, adapters, status, visibility, audit, review, export, and schedule signals only."
  );
  warnings.push("Sensitive values are masked before display.");

  const entries: ReportDataCertificationEntry[] = input.registryReports.map((report) => {
    const adapterState = input.adapterStatesByReportKey[report.reportKey];
    const adapterHealth = resolveRuntimeAdapterHealth({
      adapterErrorMessage: adapterState?.errorMessage ?? null,
      adapterLoadingState: adapterState?.loadingState,
      reportKey: report.reportKey
    });
    const dataSourceAvailability = resolveDataSourceAvailability({
      adapterHealth,
      registryStatus: report.status,
      reportKey: report.reportKey,
      runtimeStatus: report.runtimeStatus
    });
    const readOnlyConfirmation = resolveReadOnlyConfirmation({
      runtimeSafeAction: report.runtimeSafeAction,
      superAdmin: input.superAdmin
    });
    const auditRef = input.auditEntriesByReportKey[report.reportKey];
    const reviewRef = input.reviewEntriesByReportKey[report.reportKey];
    const exportRef = input.exportEntriesByReportKey[report.reportKey];
    const scheduleRef = input.scheduleEntriesByReportKey[report.reportKey];
    const { certificationNotes, certificationStatus } = resolveCertificationStatus({
      adapterHealth,
      auditRef,
      dataSourceAvailability,
      dataSourceDescription: report.dataSourceDescription,
      exportRef,
      readOnlyConfirmation,
      registryStatus: report.status,
      reportKey: report.reportKey,
      reviewRef,
      runtimeStatus: report.runtimeStatus,
      runtimeVisibility: report.runtimeVisibility,
      scheduleRef,
      superAdmin: input.superAdmin
    });

    return {
      aggregationSafetyConfirmation: resolveAggregationSafetyConfirmation(auditRef),
      certificationNotes,
      certificationStatus,
      dataSourceAvailability,
      dataSourceName: resolveDataSourceName({
        category: report.category,
        dataSourceDescription: report.dataSourceDescription,
        reportKey: report.reportKey,
        title: report.name
      }),
      emptyStateSafetyConfirmation: resolveEmptyStateSafetyConfirmation({
        adapterHealth,
        runtimeStatus: report.runtimeStatus
      }),
      readOnly: true,
      readOnlyConfirmation,
      reportKey: report.reportKey,
      reportTitle: safeText(report.name, report.reportKey),
      runtimeAdapterHealth: adapterHealth,
      sensitiveDataMaskingConfirmation: resolveSensitiveDataMaskingConfirmation(input.superAdmin)
    };
  });

  const totals: ReportDataCertificationTotals = {
    blockedReports: entries.filter((entry) => entry.certificationStatus === "blocked").length,
    certifiedReports: entries.filter((entry) => entry.certificationStatus === "certified").length,
    partialReports: entries.filter((entry) => entry.certificationStatus === "partial").length,
    plannedReports: entries.filter((entry) => entry.certificationStatus === "planned").length,
    unsafeReports: entries.filter((entry) => entry.certificationStatus === "unsafe").length,
    unknownReports: entries.filter((entry) => entry.certificationStatus === "unknown").length
  };
  const status = resolveSnapshotStatus(entries);
  const loadingState = resolveLoadingState(status);
  const generatedAt = new Date().toISOString();
  const selectedReportCertification =
    input.selectedReportKey != null
      ? entries.find((entry) => entry.reportKey === input.selectedReportKey) ?? null
      : null;

  return {
    byStatus: buildStatusBreakdown(entries),
    entries,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${totals.certifiedReports} certified · ${totals.partialReports} partial`,
    loadingState,
    readOnly: true,
    selectedReportCertification,
    selectedReportKey: input.selectedReportKey,
    source: REPORT_DATA_CERTIFICATION_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${totals.certifiedReports} certified`,
      `${totals.partialReports} partial`,
      `${totals.plannedReports} planned`,
      `${totals.unsafeReports} unsafe`
    ].join("; "),
    superAdminReportsOnly: true,
    totals,
    warnings
  };
}

export async function mapReportDataCertificationRuntimeToAdminFields(
  input: ReportDataCertificationRuntimeInput
) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      byStatus: [],
      entries: [],
      errorMessage: "Super Admin access is required for Report Data Certification runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Data Certification unavailable",
      loadingState: "error" as const,
      readOnly: true as const,
      selectedReportCertification: null,
      selectedReportKey: input.selectedReportKey,
      status: "unavailable" as const,
      summary: "Report Data Certification requires Super Admin access.",
      superAdminReportsOnly: true as const,
      totals: {
        blockedReports: 0,
        certifiedReports: 0,
        partialReports: 0,
        plannedReports: 0,
        unsafeReports: 0,
        unknownReports: 0
      },
      warnings: ["Super Admin access is required for Report Data Certification runtime."]
    };
  }

  const snapshot = runReportDataCertificationSnapshot({ ...input, superAdmin: true });

  return {
    byStatus: snapshot.byStatus,
    entries: snapshot.entries,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    loadingState: snapshot.loadingState,
    readOnly: true as const,
    selectedReportCertification: snapshot.selectedReportCertification,
    selectedReportKey: snapshot.selectedReportKey,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    totals: snapshot.totals,
    warnings: snapshot.warnings
  };
}

export function buildReportDataCertificationRuntimeInput(input: {
  adapterStatesByReportKey: ReportDataCertificationRuntimeInput["adapterStatesByReportKey"];
  auditEntries: Array<{
    auditCoverageState: ReportAuditCoverageState;
    auditGaps: string[];
    reportKey: string;
  }>;
  exportEntries: Array<{
    exportAvailabilityState: ReportExportAvailabilityState;
    reportKey: string;
  }>;
  registryReports: Array<{
    category: string;
    dataSourceDescription: string;
    name: string;
    reportKey: string;
    runtimeSafeAction: string;
    runtimeStatus: ReportRuntimeStatus;
    runtimeVisibility: string;
    status: string;
  }>;
  reviewEntries: Array<{
    certificationReadinessSignal: string;
    reportKey: string;
    reviewCoverageState: ReportReviewCoverageState;
    reviewGaps: string[];
  }>;
  scheduleEntries: Array<{
    reportKey: string;
    scheduleAvailabilityState: ReportScheduleAvailabilityState;
    scheduleGaps: string[];
  }>;
  selectedReportKey: string | null;
}): ReportDataCertificationRuntimeInput {
  const auditEntriesByReportKey: Record<string, ReportDataCertificationAuditRef | undefined> = {};
  const reviewEntriesByReportKey: Record<string, ReportDataCertificationReviewRef | undefined> = {};
  const exportEntriesByReportKey: Record<string, ReportDataCertificationExportRef | undefined> = {};
  const scheduleEntriesByReportKey: Record<string, ReportDataCertificationScheduleRef | undefined> = {};

  for (const entry of input.auditEntries) {
    auditEntriesByReportKey[entry.reportKey] = {
      auditCoverageState: entry.auditCoverageState,
      auditGaps: entry.auditGaps
    };
  }

  for (const entry of input.reviewEntries) {
    reviewEntriesByReportKey[entry.reportKey] = {
      certificationReadinessSignal: entry.certificationReadinessSignal,
      reviewCoverageState: entry.reviewCoverageState,
      reviewGaps: entry.reviewGaps
    };
  }

  for (const entry of input.exportEntries) {
    exportEntriesByReportKey[entry.reportKey] = {
      exportAvailabilityState: entry.exportAvailabilityState
    };
  }

  for (const entry of input.scheduleEntries) {
    scheduleEntriesByReportKey[entry.reportKey] = {
      scheduleAvailabilityState: entry.scheduleAvailabilityState,
      scheduleGaps: entry.scheduleGaps
    };
  }

  return {
    adapterStatesByReportKey: input.adapterStatesByReportKey,
    auditEntriesByReportKey,
    exportEntriesByReportKey,
    registryReports: input.registryReports,
    reviewEntriesByReportKey,
    scheduleEntriesByReportKey,
    selectedReportKey: input.selectedReportKey,
    superAdmin: false
  };
}
