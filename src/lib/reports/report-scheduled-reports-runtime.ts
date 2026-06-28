import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { ReportExportAvailabilityState } from "@/src/lib/reports/report-export-runtime";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";

export type ReportScheduledSource = "report_scheduled_reports_runtime";

export type ReportScheduleAvailabilityState =
  | "scheduling_available"
  | "scheduling_disabled"
  | "scheduling_locked"
  | "scheduling_planned"
  | "scheduling_unavailable";

export type ReportScheduleCoverageState = "partial" | "planned" | "unavailable";

export type ReportScheduleStatus = "disabled" | "inactive" | "locked" | "planned" | "unavailable";

export type ReportScheduledRuntimeState = "degraded" | "empty" | "planned" | "ready" | "unavailable";

export type ReportScheduledLoadingState = "degraded" | "empty" | "error" | "loaded" | "planned";

export type ReportScheduleExportRef = {
  exportAvailabilityState: ReportExportAvailabilityState;
};

export type ReportScheduledEntry = {
  deliveryTargetState: string;
  lastRunState: string;
  nextRunState: string;
  plannedIndicators: string[];
  readOnly: true;
  reportKey: string;
  reportTitle: string;
  scheduleAvailabilityState: ReportScheduleAvailabilityState;
  scheduleCoverageState: ReportScheduleCoverageState;
  scheduleFrequencyState: string;
  scheduleGaps: string[];
  scheduleHelperText: string;
  scheduleStatus: ReportScheduleStatus;
};

export type ReportScheduledSelectedSummary = ReportScheduledEntry;

export type ReportScheduleAvailabilityBreakdownItem = {
  count: number;
  label: ReportScheduleAvailabilityState;
};

export type ReportScheduleCoverageBreakdownItem = {
  count: number;
  label: ReportScheduleCoverageState;
};

export type ReportScheduledTotals = {
  schedulingAvailableReports: number;
  schedulingDisabledReports: number;
  schedulingLockedReports: number;
  schedulingPlannedReports: number;
  schedulingUnavailableReports: number;
};

export type ReportScheduledSnapshot = {
  byAvailability: ReportScheduleAvailabilityBreakdownItem[];
  byCoverage: ReportScheduleCoverageBreakdownItem[];
  entries: ReportScheduledEntry[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  loadingState: ReportScheduledLoadingState;
  readOnly: true;
  selectedReportKey: string | null;
  selectedReportSchedule: ReportScheduledSelectedSummary | null;
  source: ReportScheduledSource;
  status: ReportScheduledRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  totals: ReportScheduledTotals;
  warnings: string[];
};

export const REPORT_SCHEDULED_SOURCE = "report_scheduled_reports_runtime" as const;

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

const PLATFORM_RUNTIME_REPORT_KEYS = new Set([
  "rp-12-report-viewer",
  "rp-13-report-status",
  "rp-14-report-visibility",
  "rp-15-safe-actions",
  "rp-16-report-aggregation",
  "rp-17-report-filters",
  "rp-18-report-search",
  "rp-19-report-audit",
  "rp-20-report-review",
  "rp-21-report-export"
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

export function reportScheduleAvailabilityBadgeTone(
  availability: ReportScheduleAvailabilityState
): "amber" | "blue" | "green" | "red" | "slate" {
  if (availability === "scheduling_available") {
    return "green";
  }

  if (availability === "scheduling_disabled" || availability === "scheduling_planned") {
    return "blue";
  }

  if (availability === "scheduling_locked") {
    return "amber";
  }

  return "red";
}

export function reportScheduleAvailabilityLabel(availability: ReportScheduleAvailabilityState) {
  return formatLabel(availability);
}

export function reportScheduleCoverageBadgeTone(
  coverage: ReportScheduleCoverageState
): "amber" | "blue" | "green" | "red" | "slate" {
  if (coverage === "partial") {
    return "amber";
  }

  if (coverage === "planned") {
    return "blue";
  }

  return "red";
}

export function reportScheduleCoverageLabel(coverage: ReportScheduleCoverageState) {
  return formatLabel(coverage);
}

function resolveScheduleHelperText(availability: ReportScheduleAvailabilityState) {
  switch (availability) {
    case "scheduling_available":
      return "Scheduling metadata is available for this report. Create, update, and run actions remain disabled in RP-22.";
    case "scheduling_disabled":
      return "Scheduling is disabled until safe export summaries and runtime data are available for this report.";
    case "scheduling_planned":
      return "Scheduling remains planned. No cron jobs, queues, or delivery targets are created on page load.";
    case "scheduling_locked":
      return "Scheduling is locked until Super Admin access and report visibility requirements are satisfied.";
    case "scheduling_unavailable":
      return "Scheduling is unavailable due to runtime error or missing registry coverage.";
    default:
      return "Scheduling state unavailable.";
  }
}

function resolveScheduleAvailability(input: {
  exportRef?: ReportScheduleExportRef;
  registryStatus: string;
  reportKey: string;
  runtimeStatus: ReportRuntimeStatus;
  superAdmin: boolean;
}): ReportScheduleAvailabilityState {
  if (!input.superAdmin) {
    return "scheduling_locked";
  }

  if (input.reportKey === "rp-22-scheduled-reports") {
    return "scheduling_available";
  }

  if (PLATFORM_RUNTIME_REPORT_KEYS.has(input.reportKey)) {
    return "scheduling_planned";
  }

  if (input.registryStatus === "planned" || input.registryStatus === "inactive") {
    return "scheduling_planned";
  }

  if (input.runtimeStatus === "planned" || input.runtimeStatus === "inactive") {
    return "scheduling_planned";
  }

  if (input.runtimeStatus === "error" || input.exportRef?.exportAvailabilityState === "export_unavailable") {
    return "scheduling_unavailable";
  }

  if (input.exportRef?.exportAvailabilityState === "export_locked") {
    return "scheduling_locked";
  }

  if (!RUNTIME_MODULE_REPORT_KEYS.has(input.reportKey)) {
    return "scheduling_planned";
  }

  if (
    input.exportRef?.exportAvailabilityState === "export_disabled" ||
    input.runtimeStatus === "empty"
  ) {
    return "scheduling_disabled";
  }

  if (input.exportRef?.exportAvailabilityState === "export_available") {
    return "scheduling_planned";
  }

  if (input.exportRef?.exportAvailabilityState === "export_planned") {
    return "scheduling_planned";
  }

  return "scheduling_disabled";
}

function resolveScheduleStatus(availability: ReportScheduleAvailabilityState): ReportScheduleStatus {
  if (availability === "scheduling_available") {
    return "inactive";
  }

  if (availability === "scheduling_locked") {
    return "locked";
  }

  if (availability === "scheduling_unavailable") {
    return "unavailable";
  }

  if (availability === "scheduling_disabled") {
    return "disabled";
  }

  return "planned";
}

function resolveScheduleCoverage(input: {
  availability: ReportScheduleAvailabilityState;
  exportRef?: ReportScheduleExportRef;
  reportKey: string;
}): { plannedIndicators: string[]; scheduleCoverageState: ReportScheduleCoverageState; scheduleGaps: string[] } {
  const scheduleGaps: string[] = [
    "No scheduled report records are created during RP-22 page load.",
    "Cron jobs, queues, export execution, and email delivery remain disabled."
  ];
  const plannedIndicators: string[] = [];

  if (input.reportKey === "rp-22-scheduled-reports") {
    plannedIndicators.push("RP-22 scheduling foundation is live as read-only metadata.");
    scheduleGaps.push("Job runner and delivery backend remain planned.");
    return { plannedIndicators, scheduleCoverageState: "partial", scheduleGaps };
  }

  if (input.availability === "scheduling_unavailable") {
    scheduleGaps.push("Scheduling coverage is unavailable for this report.");
    return { plannedIndicators, scheduleCoverageState: "unavailable", scheduleGaps };
  }

  if (input.exportRef?.exportAvailabilityState === "export_available") {
    plannedIndicators.push("Safe export summaries are available; scheduled delivery remains planned.");
    scheduleGaps.push("Scheduled delivery requires RP-22 job backend.");
    return { plannedIndicators, scheduleCoverageState: "partial", scheduleGaps };
  }

  plannedIndicators.push("Scheduling backend is not enabled for this report yet.");
  return { plannedIndicators, scheduleCoverageState: "planned", scheduleGaps };
}

function resolveScheduleFrequencyState(availability: ReportScheduleAvailabilityState) {
  if (availability === "scheduling_available") {
    return "Frequency metadata only; no schedule frequency is persisted.";
  }

  return "Not configured; no schedule frequency is persisted in RP-22.";
}

function resolveNextRunState(availability: ReportScheduleAvailabilityState) {
  if (availability === "scheduling_available") {
    return "No next run scheduled; automatic execution remains disabled.";
  }

  return "No next run scheduled.";
}

function resolveLastRunState(availability: ReportScheduleAvailabilityState) {
  return availability === "scheduling_available"
    ? "No last run recorded; schedule execution remains disabled."
    : "No last run recorded.";
}

function resolveDeliveryTargetState(availability: ReportScheduleAvailabilityState) {
  return availability === "scheduling_available"
    ? "No delivery target configured; email and webhook delivery remain disabled."
    : "No delivery target configured.";
}

export type ReportScheduledRuntimeInput = {
  exportEntriesByReportKey: Record<string, ReportScheduleExportRef | undefined>;
  registryReports: Array<{
    name: string;
    reportKey: string;
    runtimeStatus: ReportRuntimeStatus;
    status: string;
  }>;
  selectedReportKey: string | null;
  superAdmin: boolean;
};

function buildAvailabilityBreakdown(
  entries: ReportScheduledEntry[]
): ReportScheduleAvailabilityBreakdownItem[] {
  const counts: Record<ReportScheduleAvailabilityState, number> = {
    scheduling_available: 0,
    scheduling_disabled: 0,
    scheduling_locked: 0,
    scheduling_planned: 0,
    scheduling_unavailable: 0
  };

  for (const entry of entries) {
    counts[entry.scheduleAvailabilityState] += 1;
  }

  return (Object.keys(counts) as ReportScheduleAvailabilityState[])
    .map((label) => ({ count: counts[label], label }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function buildCoverageBreakdown(entries: ReportScheduledEntry[]): ReportScheduleCoverageBreakdownItem[] {
  const counts: Record<ReportScheduleCoverageState, number> = {
    partial: 0,
    planned: 0,
    unavailable: 0
  };

  for (const entry of entries) {
    counts[entry.scheduleCoverageState] += 1;
  }

  return (Object.keys(counts) as ReportScheduleCoverageState[])
    .map((label) => ({ count: counts[label], label }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function resolveSnapshotStatus(entries: ReportScheduledEntry[]): ReportScheduledRuntimeState {
  if (entries.length === 0) {
    return "unavailable";
  }

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator[entry.scheduleAvailabilityState] += 1;
      return accumulator;
    },
    {
      scheduling_available: 0,
      scheduling_disabled: 0,
      scheduling_locked: 0,
      scheduling_planned: 0,
      scheduling_unavailable: 0
    }
  );

  if (totals.scheduling_unavailable + totals.scheduling_locked > entries.length / 2) {
    return "degraded";
  }

  if (totals.scheduling_planned + totals.scheduling_disabled > entries.length / 2) {
    return "planned";
  }

  if (totals.scheduling_available === 0) {
    return "empty";
  }

  return "ready";
}

function resolveLoadingState(status: ReportScheduledRuntimeState): ReportScheduledLoadingState {
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

export function runReportScheduledSnapshot(input: ReportScheduledRuntimeInput): ReportScheduledSnapshot {
  const warnings: string[] = [];

  warnings.push("Scheduled Reports is read-only on page load. No schedules, cron jobs, or queues are created.");
  warnings.push("Scheduling metadata derives from registry, RP-21 export signals, and runtime resolver outputs only.");
  warnings.push("Sensitive values are masked before display.");

  const entries: ReportScheduledEntry[] = input.registryReports.map((report) => {
    const exportRef = input.exportEntriesByReportKey[report.reportKey];
    const scheduleAvailabilityState = resolveScheduleAvailability({
      exportRef,
      registryStatus: report.status,
      reportKey: report.reportKey,
      runtimeStatus: report.runtimeStatus,
      superAdmin: input.superAdmin
    });
    const { plannedIndicators, scheduleCoverageState, scheduleGaps } = resolveScheduleCoverage({
      availability: scheduleAvailabilityState,
      exportRef,
      reportKey: report.reportKey
    });

    return {
      deliveryTargetState: resolveDeliveryTargetState(scheduleAvailabilityState),
      lastRunState: resolveLastRunState(scheduleAvailabilityState),
      nextRunState: resolveNextRunState(scheduleAvailabilityState),
      plannedIndicators,
      readOnly: true,
      reportKey: report.reportKey,
      reportTitle: safeText(report.name, report.reportKey),
      scheduleAvailabilityState,
      scheduleCoverageState,
      scheduleFrequencyState: resolveScheduleFrequencyState(scheduleAvailabilityState),
      scheduleGaps,
      scheduleHelperText: resolveScheduleHelperText(scheduleAvailabilityState),
      scheduleStatus: resolveScheduleStatus(scheduleAvailabilityState)
    };
  });

  const totals: ReportScheduledTotals = {
    schedulingAvailableReports: entries.filter(
      (entry) => entry.scheduleAvailabilityState === "scheduling_available"
    ).length,
    schedulingDisabledReports: entries.filter(
      (entry) => entry.scheduleAvailabilityState === "scheduling_disabled"
    ).length,
    schedulingLockedReports: entries.filter((entry) => entry.scheduleAvailabilityState === "scheduling_locked")
      .length,
    schedulingPlannedReports: entries.filter((entry) => entry.scheduleAvailabilityState === "scheduling_planned")
      .length,
    schedulingUnavailableReports: entries.filter(
      (entry) => entry.scheduleAvailabilityState === "scheduling_unavailable"
    ).length
  };
  const status = resolveSnapshotStatus(entries);
  const loadingState = resolveLoadingState(status);
  const generatedAt = new Date().toISOString();
  const selectedReportSchedule =
    input.selectedReportKey != null
      ? entries.find((entry) => entry.reportKey === input.selectedReportKey) ?? null
      : null;

  return {
    byAvailability: buildAvailabilityBreakdown(entries),
    byCoverage: buildCoverageBreakdown(entries),
    entries,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${totals.schedulingAvailableReports} scheduling available · ${totals.schedulingPlannedReports} planned`,
    loadingState,
    readOnly: true,
    selectedReportKey: input.selectedReportKey,
    selectedReportSchedule,
    source: REPORT_SCHEDULED_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${totals.schedulingAvailableReports} scheduling available`,
      `${totals.schedulingPlannedReports} planned`,
      `${totals.schedulingDisabledReports} disabled`,
      `${totals.schedulingUnavailableReports} unavailable`
    ].join("; "),
    superAdminReportsOnly: true,
    totals,
    warnings
  };
}

export async function mapReportScheduledRuntimeToAdminFields(input: ReportScheduledRuntimeInput) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      byAvailability: [],
      byCoverage: [],
      entries: [],
      errorMessage: "Super Admin access is required for Scheduled Reports runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Scheduled Reports unavailable",
      loadingState: "error" as const,
      readOnly: true as const,
      selectedReportKey: input.selectedReportKey,
      selectedReportSchedule: null,
      status: "unavailable" as const,
      summary: "Scheduled Reports requires Super Admin access.",
      superAdminReportsOnly: true as const,
      totals: {
        schedulingAvailableReports: 0,
        schedulingDisabledReports: 0,
        schedulingLockedReports: 0,
        schedulingPlannedReports: 0,
        schedulingUnavailableReports: 0
      },
      warnings: ["Super Admin access is required for Scheduled Reports runtime."]
    };
  }

  const snapshot = runReportScheduledSnapshot({ ...input, superAdmin: true });

  return {
    byAvailability: snapshot.byAvailability,
    byCoverage: snapshot.byCoverage,
    entries: snapshot.entries,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    loadingState: snapshot.loadingState,
    readOnly: true as const,
    selectedReportKey: snapshot.selectedReportKey,
    selectedReportSchedule: snapshot.selectedReportSchedule,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    totals: snapshot.totals,
    warnings: snapshot.warnings
  };
}

export function buildReportScheduledRuntimeInput(input: {
  exportEntries: Array<{
    exportAvailabilityState: ReportExportAvailabilityState;
    reportKey: string;
  }>;
  registryReports: Array<{
    name: string;
    reportKey: string;
    runtimeStatus: ReportRuntimeStatus;
    status: string;
  }>;
  selectedReportKey: string | null;
}): ReportScheduledRuntimeInput {
  const exportEntriesByReportKey: Record<string, ReportScheduleExportRef | undefined> = {};

  for (const entry of input.exportEntries) {
    exportEntriesByReportKey[entry.reportKey] = {
      exportAvailabilityState: entry.exportAvailabilityState
    };
  }

  return {
    exportEntriesByReportKey,
    registryReports: input.registryReports,
    selectedReportKey: input.selectedReportKey,
    superAdmin: false
  };
}
