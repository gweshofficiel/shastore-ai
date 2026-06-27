import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { ReportRuntimeSafeAction } from "@/src/lib/reports/report-safe-actions-runtime";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";
import type { ReportRuntimeVisibility } from "@/src/lib/reports/report-visibility-runtime";

export type ReportAggregationSource = "report_aggregation_runtime";

export type ReportAggregationLoadingState = "degraded" | "empty" | "error" | "loaded";

export type ReportAggregationRuntimeState = "needs_attention" | "ready" | "unavailable";

export type ReportAggregationBreakdownItem = {
  count: number;
  label: string;
};

export type ReportAggregationLatestActivity = {
  activityAt: string;
  activityType: string;
  readOnly: true;
  reportKey: string;
  summary: string;
  title: string;
};

export type ReportAggregationTotals = {
  availableReports: number;
  certifiedReports: number;
  degradedReports: number;
  emptyReports: number;
  partialReports: number;
  plannedReports: number;
  reportsWithEmptyState: number;
  reportsWithLockedActions: number;
  reportsWithRuntimeData: number;
  totalRegisteredReports: number;
};

export type ReportAggregationSnapshot = {
  byCategory: ReportAggregationBreakdownItem[];
  byRegistryStatus: ReportAggregationBreakdownItem[];
  byRuntimeStatus: ReportAggregationBreakdownItem[];
  byRuntimeVisibility: ReportAggregationBreakdownItem[];
  bySafeAction: ReportAggregationBreakdownItem[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  latestSafeActivity: ReportAggregationLatestActivity[];
  latestSafeActivitySummary: string;
  loadingState: ReportAggregationLoadingState;
  readOnly: true;
  source: ReportAggregationSource;
  status: ReportAggregationRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  totals: ReportAggregationTotals;
  warnings: string[];
};

export const REPORT_AGGREGATION_SOURCE = "report_aggregation_runtime" as const;

type AdapterSnapshot = {
  errorMessage: string | null;
  loadingState: "empty" | "error" | "loaded";
  status: string;
};

type RegistryReportSnapshot = {
  category: string;
  name: string;
  reportKey: string;
  status: string;
};

type ViewerActivityItem = {
  activityAt: string;
  activityType: string;
  summary: string;
};

type ViewerCatalogEntry = {
  latestSafeActivity: ViewerActivityItem[];
  reportKey: string;
  title: string;
};

export type ReportAggregationRuntimeInput = {
  registryReports: RegistryReportSnapshot[];
  registryTotalEntries: number;
  reportSafeActionsByReportKey: Record<
    string,
    { runtimeSafeAction: ReportRuntimeSafeAction; viewEnabled: boolean } | undefined
  >;
  reportStatusByReportKey: Record<string, { runtimeStatus: ReportRuntimeStatus } | undefined>;
  reportVisibilityByReportKey: Record<string, { runtimeVisibility: ReportRuntimeVisibility } | undefined>;
  reportViewerCatalog: ViewerCatalogEntry[];
  runtimeModules: Record<string, AdapterSnapshot | undefined>;
};

function emptyTotals(): ReportAggregationTotals {
  return {
    availableReports: 0,
    certifiedReports: 0,
    degradedReports: 0,
    emptyReports: 0,
    partialReports: 0,
    plannedReports: 0,
    reportsWithEmptyState: 0,
    reportsWithLockedActions: 0,
    reportsWithRuntimeData: 0,
    totalRegisteredReports: 0
  };
}

function countBreakdown(
  entries: Array<{ key: string; count: number }>
): ReportAggregationBreakdownItem[] {
  return entries
    .filter((entry) => entry.count > 0)
    .map((entry) => ({ count: entry.count, label: entry.key.replace(/_/g, " ") }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function groupCount(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = value.trim() || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].map(([key, count]) => ({ count, key }));
}

function isAvailableRuntimeStatus(runtimeStatus: ReportRuntimeStatus) {
  return runtimeStatus === "available" || runtimeStatus === "active" || runtimeStatus === "certified";
}

function isLockedSafeAction(runtimeSafeAction: ReportRuntimeSafeAction, viewEnabled: boolean) {
  return (
    !viewEnabled ||
    runtimeSafeAction === "action_locked" ||
    runtimeSafeAction === "planned_action" ||
    runtimeSafeAction === "view_disabled"
  );
}

function safeActivitySummary(value: string) {
  const masked = maskSensitiveText(value);
  return masked.length > 160 ? `${masked.slice(0, 157)}...` : masked;
}

function buildLatestSafeActivity(input: ReportAggregationRuntimeInput): ReportAggregationLatestActivity[] {
  const items: ReportAggregationLatestActivity[] = [];

  for (const entry of input.reportViewerCatalog) {
    const latest = entry.latestSafeActivity[0];

    if (!latest) {
      continue;
    }

    items.push({
      activityAt: latest.activityAt,
      activityType: latest.activityType,
      readOnly: true,
      reportKey: entry.reportKey,
      summary: safeActivitySummary(latest.summary),
      title: entry.title
    });
  }

  return items
    .sort((left, right) => right.activityAt.localeCompare(left.activityAt))
    .slice(0, 8);
}

export function runReportAggregationSnapshot(input: ReportAggregationRuntimeInput): ReportAggregationSnapshot {
  const warnings: string[] = [];
  const totals = emptyTotals();
  const runtimeStatuses: string[] = [];
  const runtimeVisibilities: string[] = [];
  const registryStatuses: string[] = [];
  const categories: string[] = [];
  const safeActions: string[] = [];

  totals.totalRegisteredReports = input.registryTotalEntries || input.registryReports.length;

  for (const report of input.registryReports) {
    const runtimeStatus = input.reportStatusByReportKey[report.reportKey]?.runtimeStatus ?? "planned";
    const runtimeVisibility =
      input.reportVisibilityByReportKey[report.reportKey]?.runtimeVisibility ?? "super_admin_only";
    const safeActionsEntry = input.reportSafeActionsByReportKey[report.reportKey];
    const runtimeSafeAction = safeActionsEntry?.runtimeSafeAction ?? "action_locked";
    const viewEnabled = safeActionsEntry?.viewEnabled ?? false;
    const adapter = input.runtimeModules[report.reportKey];

    runtimeStatuses.push(runtimeStatus);
    runtimeVisibilities.push(runtimeVisibility);
    registryStatuses.push(report.status);
    categories.push(report.category);
    safeActions.push(runtimeSafeAction);

    if (isAvailableRuntimeStatus(runtimeStatus)) {
      totals.availableReports += 1;
    }

    if (runtimeStatus === "planned") {
      totals.plannedReports += 1;
    }

    if (runtimeStatus === "empty") {
      totals.emptyReports += 1;
    }

    if (runtimeStatus === "partial") {
      totals.partialReports += 1;
    }

    if (runtimeStatus === "degraded" || runtimeStatus === "error") {
      totals.degradedReports += 1;
    }

    if (runtimeStatus === "certified") {
      totals.certifiedReports += 1;
    }

    if (adapter?.loadingState === "loaded" && runtimeStatus !== "empty" && runtimeStatus !== "error") {
      totals.reportsWithRuntimeData += 1;
    }

    if (runtimeStatus === "empty" || adapter?.loadingState === "empty") {
      totals.reportsWithEmptyState += 1;
    }

    if (isLockedSafeAction(runtimeSafeAction, viewEnabled)) {
      totals.reportsWithLockedActions += 1;
    }
  }

  const latestSafeActivity = buildLatestSafeActivity(input);
  const latestSafeActivitySummary =
    latestSafeActivity.length > 0
      ? `${latestSafeActivity.length} recent safe activity entries across viewable reports`
      : "No latest safe activity is available across viewable reports yet.";

  const loadingState: ReportAggregationLoadingState =
    input.registryReports.length === 0
      ? "empty"
      : totals.degradedReports > 0 || totals.partialReports > 0
        ? "degraded"
        : "loaded";

  const status: ReportAggregationRuntimeState =
    input.registryReports.length === 0
      ? "unavailable"
      : totals.degradedReports > 0 || totals.partialReports > 0 || totals.plannedReports > 0
        ? "needs_attention"
        : "ready";

  if (totals.plannedReports > 0) {
    warnings.push(`${totals.plannedReports} registered reports remain in planned runtime status.`);
  }

  if (totals.reportsWithEmptyState > 0) {
    warnings.push(`${totals.reportsWithEmptyState} reports currently surface empty runtime states.`);
  }

  warnings.push("Aggregation is computed in memory only. No aggregation records are persisted.");

  const generatedAt = new Date().toISOString();

  return {
    byCategory: countBreakdown(groupCount(categories)),
    byRegistryStatus: countBreakdown(groupCount(registryStatuses)),
    byRuntimeStatus: countBreakdown(groupCount(runtimeStatuses)),
    byRuntimeVisibility: countBreakdown(groupCount(runtimeVisibilities)),
    bySafeAction: countBreakdown(groupCount(safeActions)),
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${totals.totalRegisteredReports} registered reports aggregated`,
    latestSafeActivity,
    latestSafeActivitySummary,
    loadingState,
    readOnly: true,
    source: REPORT_AGGREGATION_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${totals.totalRegisteredReports} registered`,
      `${totals.availableReports} available`,
      `${totals.reportsWithRuntimeData} with runtime data`,
      `${totals.reportsWithLockedActions} locked actions`
    ].join("; "),
    superAdminReportsOnly: true,
    totals,
    warnings
  };
}

export async function mapReportAggregationRuntimeToAdminFields(input: ReportAggregationRuntimeInput) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      byCategory: [],
      byRegistryStatus: [],
      byRuntimeStatus: [],
      byRuntimeVisibility: [],
      bySafeAction: [],
      errorMessage: "Super Admin access is required for Report Aggregation runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Aggregation unavailable",
      latestSafeActivity: [],
      latestSafeActivitySummary: "Report Aggregation requires Super Admin access.",
      loadingState: "error" as const,
      readOnly: true as const,
      status: "unavailable" as const,
      summary: "Report Aggregation requires Super Admin access.",
      superAdminReportsOnly: true as const,
      totals: emptyTotals(),
      warnings: ["Super Admin access is required for Report Aggregation runtime."]
    };
  }

  const snapshot = runReportAggregationSnapshot(input);

  return {
    byCategory: snapshot.byCategory,
    byRegistryStatus: snapshot.byRegistryStatus,
    byRuntimeStatus: snapshot.byRuntimeStatus,
    byRuntimeVisibility: snapshot.byRuntimeVisibility,
    bySafeAction: snapshot.bySafeAction,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    latestSafeActivity: snapshot.latestSafeActivity,
    latestSafeActivitySummary: snapshot.latestSafeActivitySummary,
    loadingState: snapshot.loadingState,
    readOnly: true as const,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    totals: snapshot.totals,
    warnings: snapshot.warnings
  };
}

export function buildReportAggregationRuntimeInput(input: {
  aiReports: AdapterSnapshot;
  domainEmailReports: AdapterSnapshot;
  marketplaceReports: AdapterSnapshot;
  operationsReports: AdapterSnapshot;
  paymentReports: AdapterSnapshot;
  registryReports: RegistryReportSnapshot[];
  registryTotalEntries: number;
  reportSafeActionsByReportKey: ReportAggregationRuntimeInput["reportSafeActionsByReportKey"];
  reportStatusByReportKey: ReportAggregationRuntimeInput["reportStatusByReportKey"];
  reportVisibilityByReportKey: ReportAggregationRuntimeInput["reportVisibilityByReportKey"];
  reportViewerCatalog: ViewerCatalogEntry[];
  revenueReports: AdapterSnapshot;
  securityReports: AdapterSnapshot;
  storeReports: AdapterSnapshot;
  subscriptionReports: AdapterSnapshot;
  userReports: AdapterSnapshot;
}): ReportAggregationRuntimeInput {
  return {
    registryReports: input.registryReports,
    registryTotalEntries: input.registryTotalEntries,
    reportSafeActionsByReportKey: input.reportSafeActionsByReportKey,
    reportStatusByReportKey: input.reportStatusByReportKey,
    reportVisibilityByReportKey: input.reportVisibilityByReportKey,
    reportViewerCatalog: input.reportViewerCatalog,
    runtimeModules: {
      "rp-2-revenue-reports": input.revenueReports,
      "rp-3-store-reports": input.storeReports,
      "rp-4-user-reports": input.userReports,
      "rp-5-subscription-reports": input.subscriptionReports,
      "rp-6-payment-reports": input.paymentReports,
      "rp-7-ai-reports": input.aiReports,
      "rp-8-domain-email-reports": input.domainEmailReports,
      "rp-9-marketplace-reports": input.marketplaceReports,
      "rp-10-security-reports": input.securityReports,
      "rp-11-operations-reports": input.operationsReports
    }
  };
}
