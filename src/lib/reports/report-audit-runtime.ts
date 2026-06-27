import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";

export type ReportAuditSource = "report_audit_runtime";

export type ReportAuditCoverageState = "covered" | "partial" | "planned" | "unavailable";

export type ReportAuditAvailabilityState =
  | "available"
  | "degraded"
  | "empty"
  | "error"
  | "planned"
  | "unavailable";

export type ReportAuditRuntimeState = "degraded" | "empty" | "planned" | "ready" | "unavailable";

export type ReportAuditLoadingState = "degraded" | "empty" | "error" | "loaded" | "planned";

export type ReportAuditActivityItem = {
  activityAt: string;
  activityType: string;
  reportKey?: string;
  summary: string;
};

export type ReportAuditEntry = {
  auditAvailabilityState: ReportAuditAvailabilityState;
  auditCoverageState: ReportAuditCoverageState;
  auditGaps: string[];
  auditSourceDescription: string;
  lastExportState: string;
  lastGeneratedState: string;
  lastStatusChangeState: string;
  lastViewedState: string;
  latestSafeAuditEvent: string | null;
  readOnly: true;
  reportKey: string;
  reportTitle: string;
};

export type ReportAuditSelectedSummary = ReportAuditEntry;

export type ReportAuditCoverageBreakdownItem = {
  count: number;
  label: ReportAuditCoverageState;
};

export type ReportAuditTotals = {
  coveredReports: number;
  partialReports: number;
  plannedReports: number;
  unavailableReports: number;
};

export type ReportAuditSnapshot = {
  byCoverage: ReportAuditCoverageBreakdownItem[];
  entries: ReportAuditEntry[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  loadingState: ReportAuditLoadingState;
  readOnly: true;
  selectedReportAudit: ReportAuditSelectedSummary | null;
  selectedReportKey: string | null;
  source: ReportAuditSource;
  status: ReportAuditRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  totals: ReportAuditTotals;
  warnings: string[];
};

export const REPORT_AUDIT_SOURCE = "report_audit_runtime" as const;

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
  "rp-19-report-audit"
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

function isLiveGeneratedState(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    Boolean(normalized) &&
    !normalized.includes("not generated") &&
    !normalized.includes("placeholder") &&
    !normalized.includes("monitoring placeholder")
  );
}

export function reportAuditCoverageBadgeTone(
  coverage: ReportAuditCoverageState
): "amber" | "blue" | "green" | "red" | "slate" {
  if (coverage === "covered") {
    return "green";
  }

  if (coverage === "partial") {
    return "amber";
  }

  if (coverage === "planned") {
    return "blue";
  }

  return "red";
}

export function reportAuditCoverageLabel(coverage: ReportAuditCoverageState) {
  return formatLabel(coverage);
}

function resolveAuditAvailabilityState(input: {
  adapterLoadingState?: "empty" | "error" | "loaded";
  registryStatus: string;
  runtimeStatus: ReportRuntimeStatus;
}): ReportAuditAvailabilityState {
  if (input.registryStatus === "planned" || input.registryStatus === "inactive") {
    return "planned";
  }

  if (input.runtimeStatus === "planned" || input.runtimeStatus === "inactive") {
    return "planned";
  }

  if (input.adapterLoadingState === "error" || input.runtimeStatus === "error") {
    return "error";
  }

  if (input.adapterLoadingState === "empty" || input.runtimeStatus === "empty") {
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

function buildAuditSourceDescription(reportKey: string) {
  if (RUNTIME_MODULE_REPORT_KEYS.has(reportKey)) {
    return "Registry metadata, RP-12 viewer activity, RP-13 status resolver, and RP-2 through RP-11 adapter outputs (read-only, in-memory).";
  }

  if (PLATFORM_RUNTIME_REPORT_KEYS.has(reportKey)) {
    return "Registry metadata and RP-12 through RP-18 runtime resolver outputs (read-only, in-memory).";
  }

  if (reportKey === "rp-1-reports-registry") {
    return "Registry metadata and RP-1 registry resolver outputs (read-only, in-memory).";
  }

  return "Registry metadata and Reporting Center runtime resolver outputs (read-only, in-memory).";
}

function resolveLastViewedState(input: {
  aggregationActivity?: ReportAuditActivityItem;
  reportKey: string;
  selectedReportKey: string | null;
}) {
  if (input.selectedReportKey === input.reportKey) {
    return "Open in Report Viewer (current page view).";
  }

  if (input.aggregationActivity) {
    return `Referenced in recent safe activity at ${input.aggregationActivity.activityAt}.`;
  }

  return "No viewed state recorded.";
}

function resolveLastExportState(exportAvailabilityState: string) {
  return `${formatLabel(exportAvailabilityState)} · export mutations disabled in Reporting Center`;
}

function resolveLastStatusChangeState(runtimeStatus: ReportRuntimeStatus, description: string) {
  return `Current runtime status: ${formatLabel(runtimeStatus)} · ${safeText(description, "Status description unavailable.")}`;
}

function buildLatestSafeAuditEvent(items: ReportAuditActivityItem[]) {
  const latest = items[0];

  if (!latest) {
    return null;
  }

  const formatted = `${latest.activityType} · ${latest.activityAt} · ${latest.summary}`;
  return safeText(formatted) || null;
}

function resolveAuditCoverage(input: {
  adapterLoadingState?: "empty" | "error" | "loaded";
  exportAvailabilityState: string;
  hasAggregationActivity: boolean;
  hasViewerActivity: boolean;
  lastGeneratedState: string;
  registryStatus: string;
  reportKey: string;
  runtimeStatus: ReportRuntimeStatus;
}): { auditGaps: string[]; auditCoverageState: ReportAuditCoverageState } {
  const auditGaps: string[] = [];

  auditGaps.push("Persistent report audit tables are not written during RP-19 page load.");

  if (input.exportAvailabilityState === "unavailable" || input.exportAvailabilityState === "placeholder") {
    auditGaps.push("Export audit trail not implemented yet.");
  }

  if (input.registryStatus === "planned" || input.registryStatus === "inactive") {
    auditGaps.push("Registry entry remains planned.");
    return { auditCoverageState: "planned", auditGaps };
  }

  if (input.runtimeStatus === "planned" || input.runtimeStatus === "inactive") {
    auditGaps.push("Runtime status remains planned.");
    return { auditCoverageState: "planned", auditGaps };
  }

  if (input.adapterLoadingState === "error" || input.runtimeStatus === "error") {
    auditGaps.push("Runtime adapter reported an error state.");
    return { auditCoverageState: "unavailable", auditGaps };
  }

  const hasGenerated = isLiveGeneratedState(input.lastGeneratedState);
  const hasActivity = input.hasViewerActivity || input.hasAggregationActivity;

  if (RUNTIME_MODULE_REPORT_KEYS.has(input.reportKey)) {
    if (!input.hasViewerActivity) {
      auditGaps.push("No latest safe viewer activity recorded.");
    }

    if (input.adapterLoadingState === "empty") {
      auditGaps.push("Adapter loading state is empty.");
    }

    if (input.runtimeStatus === "partial" || input.runtimeStatus === "degraded") {
      auditGaps.push("Runtime status indicates partial or degraded coverage.");
    }
  }

  if (PLATFORM_RUNTIME_REPORT_KEYS.has(input.reportKey)) {
    if (!hasGenerated) {
      auditGaps.push("Platform runtime last generated state is not live yet.");
    }
  }

  if (input.reportKey === "rp-19-report-audit") {
    auditGaps.push("Dedicated audit persistence and export remain planned.");
  }

  if (input.registryStatus === "review" || input.runtimeStatus === "degraded") {
    if (hasGenerated || hasActivity) {
      return { auditCoverageState: "partial", auditGaps };
    }

    return { auditCoverageState: "unavailable", auditGaps };
  }

  if (hasGenerated && hasActivity && auditGaps.length <= 2) {
    return { auditCoverageState: "covered", auditGaps };
  }

  if (hasGenerated || hasActivity) {
    return { auditCoverageState: "partial", auditGaps };
  }

  if (input.runtimeStatus === "empty" || input.adapterLoadingState === "empty") {
    return { auditCoverageState: "partial", auditGaps };
  }

  return { auditCoverageState: "unavailable", auditGaps };
}

export type ReportAuditRuntimeInput = {
  adapterStatesByReportKey: Record<
    string,
    { errorMessage: string | null; lastGeneratedState: string; loadingState: "empty" | "error" | "loaded" } | undefined
  >;
  aggregationLatestActivity: ReportAuditActivityItem[];
  registryReports: Array<{
    exportAvailabilityState: string;
    lastGeneratedState: string;
    name: string;
    reportKey: string;
    status: string;
  }>;
  reportStatusByReportKey: Record<string, { description: string; runtimeStatus: ReportRuntimeStatus } | undefined>;
  reportViewerCatalog: Array<{
    latestSafeActivity: ReportAuditActivityItem[];
    lastGeneratedState: string;
    reportKey: string;
    title: string;
  }>;
  selectedReportKey: string | null;
};

function buildCoverageBreakdown(entries: ReportAuditEntry[]): ReportAuditCoverageBreakdownItem[] {
  const counts: Record<ReportAuditCoverageState, number> = {
    covered: 0,
    partial: 0,
    planned: 0,
    unavailable: 0
  };

  for (const entry of entries) {
    counts[entry.auditCoverageState] += 1;
  }

  return (Object.keys(counts) as ReportAuditCoverageState[])
    .map((label) => ({ count: counts[label], label }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function resolveSnapshotStatus(entries: ReportAuditEntry[]): ReportAuditRuntimeState {
  if (entries.length === 0) {
    return "unavailable";
  }

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator[entry.auditCoverageState] += 1;
      return accumulator;
    },
    { covered: 0, partial: 0, planned: 0, unavailable: 0 }
  );

  if (totals.unavailable > entries.length / 2) {
    return "degraded";
  }

  if (totals.planned > entries.length / 2) {
    return "planned";
  }

  if (totals.covered === 0 && totals.partial === 0) {
    return "empty";
  }

  if (totals.partial + totals.unavailable > entries.length / 2) {
    return "degraded";
  }

  return "ready";
}

function resolveLoadingState(status: ReportAuditRuntimeState): ReportAuditLoadingState {
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

export function runReportAuditSnapshot(input: ReportAuditRuntimeInput): ReportAuditSnapshot {
  const warnings: string[] = [];
  const aggregationByReportKey = new Map<string, ReportAuditActivityItem>();

  for (const item of input.aggregationLatestActivity) {
    const reportKey = item.reportKey ? safeText(item.reportKey) : "";

    if (reportKey && !aggregationByReportKey.has(reportKey)) {
      aggregationByReportKey.set(reportKey, item);
    }
  }

  warnings.push("Report Audit is read-only on page load. No audit rows are created or mutated.");
  warnings.push("Audit display derives from registry metadata and existing runtime resolver outputs only.");
  warnings.push("Sensitive values are masked before display.");

  const entries: ReportAuditEntry[] = input.registryReports.map((report) => {
    const statusEntry = input.reportStatusByReportKey[report.reportKey];
    const runtimeStatus = statusEntry?.runtimeStatus ?? "planned";
    const viewerEntry = input.reportViewerCatalog.find((entry) => entry.reportKey === report.reportKey);
    const adapterState = input.adapterStatesByReportKey[report.reportKey];
    const viewerActivity = viewerEntry?.latestSafeActivity ?? [];
    const aggregationActivity = aggregationByReportKey.get(report.reportKey);
    const lastGeneratedState = safeText(
      viewerEntry?.lastGeneratedState ?? adapterState?.lastGeneratedState ?? report.lastGeneratedState,
      "Last generated state unavailable."
    );
    const { auditCoverageState, auditGaps } = resolveAuditCoverage({
      adapterLoadingState: adapterState?.loadingState,
      exportAvailabilityState: report.exportAvailabilityState,
      hasAggregationActivity: Boolean(aggregationActivity),
      hasViewerActivity: viewerActivity.length > 0,
      lastGeneratedState,
      registryStatus: report.status,
      reportKey: report.reportKey,
      runtimeStatus
    });

    return {
      auditAvailabilityState: resolveAuditAvailabilityState({
        adapterLoadingState: adapterState?.loadingState,
        registryStatus: report.status,
        runtimeStatus
      }),
      auditCoverageState,
      auditGaps,
      auditSourceDescription: buildAuditSourceDescription(report.reportKey),
      lastExportState: resolveLastExportState(report.exportAvailabilityState),
      lastGeneratedState,
      lastStatusChangeState: resolveLastStatusChangeState(
        runtimeStatus,
        statusEntry?.description ?? "Status description unavailable."
      ),
      lastViewedState: resolveLastViewedState({
        aggregationActivity,
        reportKey: report.reportKey,
        selectedReportKey: input.selectedReportKey
      }),
      latestSafeAuditEvent: buildLatestSafeAuditEvent(viewerActivity),
      readOnly: true,
      reportKey: report.reportKey,
      reportTitle: safeText(report.name, report.reportKey)
    };
  });

  const totals: ReportAuditTotals = {
    coveredReports: entries.filter((entry) => entry.auditCoverageState === "covered").length,
    partialReports: entries.filter((entry) => entry.auditCoverageState === "partial").length,
    plannedReports: entries.filter((entry) => entry.auditCoverageState === "planned").length,
    unavailableReports: entries.filter((entry) => entry.auditCoverageState === "unavailable").length
  };
  const status = resolveSnapshotStatus(entries);
  const loadingState = resolveLoadingState(status);
  const generatedAt = new Date().toISOString();
  const selectedReportAudit =
    input.selectedReportKey != null
      ? entries.find((entry) => entry.reportKey === input.selectedReportKey) ?? null
      : null;

  return {
    byCoverage: buildCoverageBreakdown(entries),
    entries,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${totals.coveredReports} covered · ${totals.partialReports} partial`,
    loadingState,
    readOnly: true,
    selectedReportAudit,
    selectedReportKey: input.selectedReportKey,
    source: REPORT_AUDIT_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${totals.coveredReports} covered`,
      `${totals.partialReports} partial`,
      `${totals.plannedReports} planned`,
      `${totals.unavailableReports} unavailable`
    ].join("; "),
    superAdminReportsOnly: true,
    totals,
    warnings
  };
}

export async function mapReportAuditRuntimeToAdminFields(input: ReportAuditRuntimeInput) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      byCoverage: [],
      entries: [],
      errorMessage: "Super Admin access is required for Report Audit runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Audit unavailable",
      loadingState: "error" as const,
      readOnly: true as const,
      selectedReportAudit: null,
      selectedReportKey: input.selectedReportKey,
      status: "unavailable" as const,
      summary: "Report Audit requires Super Admin access.",
      superAdminReportsOnly: true as const,
      totals: {
        coveredReports: 0,
        partialReports: 0,
        plannedReports: 0,
        unavailableReports: 0
      },
      warnings: ["Super Admin access is required for Report Audit runtime."]
    };
  }

  const snapshot = runReportAuditSnapshot(input);

  return {
    byCoverage: snapshot.byCoverage,
    entries: snapshot.entries,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    loadingState: snapshot.loadingState,
    readOnly: true as const,
    selectedReportAudit: snapshot.selectedReportAudit,
    selectedReportKey: snapshot.selectedReportKey,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    totals: snapshot.totals,
    warnings: snapshot.warnings
  };
}

export function buildReportAuditRuntimeInput(input: {
  adapterStatesByReportKey: ReportAuditRuntimeInput["adapterStatesByReportKey"];
  aggregationLatestActivity: Array<{
    activityAt: string;
    activityType: string;
    reportKey: string;
    summary: string;
  }>;
  registryReports: Array<{
    exportAvailabilityState: string;
    lastGeneratedState: string;
    name: string;
    reportKey: string;
    status: string;
  }>;
  reportStatusByReportKey: ReportAuditRuntimeInput["reportStatusByReportKey"];
  reportViewerCatalog: Array<{
    latestSafeActivity: Array<{
      activityAt: string;
      activityType: string;
      summary: string;
    }>;
    lastGeneratedState: string;
    reportKey: string;
    title: string;
  }>;
  selectedReportKey: string | null;
}): ReportAuditRuntimeInput {
  return {
    adapterStatesByReportKey: input.adapterStatesByReportKey,
    aggregationLatestActivity: input.aggregationLatestActivity.map((item) => ({
      activityAt: safeText(item.activityAt, "Timestamp unavailable"),
      activityType: safeText(item.activityType, "activity"),
      reportKey: item.reportKey,
      summary: safeText(item.summary, "Safe activity summary unavailable.")
    })),
    registryReports: input.registryReports,
    reportStatusByReportKey: input.reportStatusByReportKey,
    reportViewerCatalog: input.reportViewerCatalog.map((entry) => ({
      lastGeneratedState: entry.lastGeneratedState,
      latestSafeActivity: entry.latestSafeActivity.map((item) => ({
        activityAt: safeText(item.activityAt, "Timestamp unavailable"),
        activityType: safeText(item.activityType, "activity"),
        summary: safeText(item.summary, "Safe activity summary unavailable.")
      })),
      reportKey: entry.reportKey,
      title: safeText(entry.title, entry.reportKey)
    })),
    selectedReportKey: input.selectedReportKey
  };
}
