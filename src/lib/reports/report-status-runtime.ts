import "server-only";

import { getAdminAccess } from "@/lib/admin-access";

export type ReportStatusSource = "report_status_runtime";

export type ReportRuntimeStatus =
  | "active"
  | "available"
  | "certified"
  | "degraded"
  | "empty"
  | "error"
  | "inactive"
  | "partial"
  | "planned";

export type ReportStatusBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type ReportStatusRuntimeState = "needs_attention" | "ready" | "unavailable";

export type ReportStatusEntry = {
  badgeTone: ReportStatusBadgeTone;
  description: string;
  readOnly: true;
  registryStatus: string;
  reportKey: string;
  roadmapPhase: string;
  runtimeStatus: ReportRuntimeStatus;
  title: string;
};

export type ReportStatusSnapshot = {
  countsByStatus: Record<ReportRuntimeStatus, number>;
  entries: ReportStatusEntry[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  readOnly: true;
  source: ReportStatusSource;
  status: ReportStatusRuntimeState;
  statusByReportKey: Record<string, ReportStatusEntry>;
  summary: string;
  warnings: string[];
};

export const REPORT_STATUS_SOURCE = "report_status_runtime" as const;

export const REPORT_RUNTIME_STATUSES: readonly ReportRuntimeStatus[] = [
  "planned",
  "inactive",
  "active",
  "available",
  "partial",
  "empty",
  "degraded",
  "error",
  "certified"
] as const;

const RUNTIME_MODULE_REPORT_KEYS = [
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
] as const;

type AdapterSnapshot = {
  errorMessage: string | null;
  loadingState: "empty" | "error" | "loaded";
  status: string;
  warnings: string[];
};

type RegistryReportSnapshot = {
  certificationState: string;
  name: string;
  reportKey: string;
  roadmapPhase: string;
  status: string;
};

export type ReportStatusRuntimeInput = {
  registry: {
    status: string;
    summary: string;
  };
  registryReports: RegistryReportSnapshot[];
  reportViewer: {
    catalog: Array<{
      reportKey: string;
      title: string;
      viewerState: string;
    }>;
    status: string;
  };
  runtimeModules: Record<string, AdapterSnapshot | undefined>;
};

function emptyCounts(): Record<ReportRuntimeStatus, number> {
  return {
    active: 0,
    available: 0,
    certified: 0,
    degraded: 0,
    empty: 0,
    error: 0,
    inactive: 0,
    partial: 0,
    planned: 0
  };
}

export function normalizeReportRuntimeStatus(value: unknown): ReportRuntimeStatus {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if ((REPORT_RUNTIME_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as ReportRuntimeStatus;
  }

  return "planned";
}

export function reportRuntimeStatusLabel(status: ReportRuntimeStatus | string) {
  return normalizeReportRuntimeStatus(status).replace(/_/g, " ");
}

export function reportRuntimeStatusDescription(status: ReportRuntimeStatus | string) {
  switch (normalizeReportRuntimeStatus(status)) {
    case "planned":
      return "Report runtime is planned or not connected yet. Registry metadata remains read-only.";
    case "inactive":
      return "Report entry is inactive in the registry and is not currently surfaced.";
    case "active":
      return "Report module is active in the registry with a connected read-only runtime adapter.";
    case "available":
      return "Report runtime loaded safely and metrics are available for the selected range.";
    case "partial":
      return "Report runtime loaded with safe partial data or non-blocking warnings.";
    case "empty":
      return "Report runtime is connected but no source data is available for the selected range.";
    case "degraded":
      return "Report runtime requires attention based on adapter, registry, or certification signals.";
    case "error":
      return "Report runtime failed to load safely. Details remain read-only without mutation.";
    case "certified":
      return "Report runtime is certified and operating within safe read-only boundaries.";
    default:
      return "Unknown report status mapped to a safe planned fallback.";
  }
}

export function reportRuntimeStatusBadgeTone(status: ReportRuntimeStatus | string): ReportStatusBadgeTone {
  switch (normalizeReportRuntimeStatus(status)) {
    case "certified":
    case "available":
      return "green";
    case "active":
      return "blue";
    case "partial":
    case "degraded":
      return "amber";
    case "error":
      return "red";
    case "empty":
    case "inactive":
    case "planned":
      return "slate";
    default:
      return "slate";
  }
}

function hasRuntimeAdapter(reportKey: string) {
  return (
    reportKey === "rp-1-reports-registry" ||
    reportKey === "rp-12-report-viewer" ||
    reportKey === "rp-13-report-status" ||
    RUNTIME_MODULE_REPORT_KEYS.includes(reportKey as (typeof RUNTIME_MODULE_REPORT_KEYS)[number])
  );
}

function reportPhaseNumber(reportKey: string) {
  return Number.parseInt(reportKey.match(/^rp-(\d+)/)?.[1] ?? "0", 10);
}

export function resolveReportRuntimeStatus(input: {
  adapter?: AdapterSnapshot;
  certificationState: string;
  registryStatus: string;
  reportKey: string;
  viewerState?: string;
}): ReportRuntimeStatus {
  const registryStatus = input.registryStatus.toLowerCase();
  const adapter = input.adapter;
  const viewerState = input.viewerState?.toLowerCase() ?? "";
  const certificationState = input.certificationState.toLowerCase();
  const runtimeConnected = hasRuntimeAdapter(input.reportKey);

  if (adapter?.errorMessage || adapter?.loadingState === "error" || viewerState === "error") {
    return "error";
  }

  if (registryStatus === "inactive") {
    return "inactive";
  }

  if (
    registryStatus === "planned" ||
    registryStatus === "placeholder" ||
    viewerState === "planned" ||
    certificationState === "planned"
  ) {
    return "planned";
  }

  if (!runtimeConnected && reportPhaseNumber(input.reportKey) >= 14) {
    return "planned";
  }

  if (adapter?.loadingState === "empty" || viewerState === "empty") {
    return "empty";
  }

  if (certificationState === "certified") {
    return "certified";
  }

  if (
    adapter?.status === "needs_attention" ||
    adapter?.status === "unavailable" ||
    registryStatus === "review" ||
    certificationState === "needs_attention"
  ) {
    return "degraded";
  }

  if (adapter && adapter.warnings.length > 0 && adapter.loadingState === "loaded") {
    return "partial";
  }

  if (adapter?.loadingState === "loaded" && adapter.status === "ready") {
    return "available";
  }

  if (input.reportKey === "rp-1-reports-registry") {
    return registryStatus === "review" ? "degraded" : "active";
  }

  if (input.reportKey === "rp-12-report-viewer") {
    return input.viewerState === "not_found" ? "degraded" : "active";
  }

  if (input.reportKey === "rp-13-report-status") {
    return "active";
  }

  if (runtimeConnected && (registryStatus === "ready" || registryStatus === "review")) {
    return "active";
  }

  return "planned";
}

function buildStatusEntry(
  report: RegistryReportSnapshot,
  input: ReportStatusRuntimeInput
): ReportStatusEntry {
  const adapter = input.runtimeModules[report.reportKey];
  const viewer = input.reportViewer.catalog.find((entry) => entry.reportKey === report.reportKey);
  const runtimeStatus = resolveReportRuntimeStatus({
    adapter,
    certificationState: report.certificationState,
    registryStatus: report.status,
    reportKey: report.reportKey,
    viewerState: viewer?.viewerState
  });

  return {
    badgeTone: reportRuntimeStatusBadgeTone(runtimeStatus),
    description: reportRuntimeStatusDescription(runtimeStatus),
    readOnly: true,
    registryStatus: report.status,
    reportKey: report.reportKey,
    roadmapPhase: report.roadmapPhase,
    runtimeStatus,
    title: report.name
  };
}

export function runReportStatusSnapshot(input: ReportStatusRuntimeInput): ReportStatusSnapshot {
  const warnings: string[] = [];
  const entries = input.registryReports.map((report) => buildStatusEntry(report, input));
  const statusByReportKey = Object.fromEntries(entries.map((entry) => [entry.reportKey, entry]));
  const countsByStatus = emptyCounts();

  for (const entry of entries) {
    countsByStatus[entry.runtimeStatus] += 1;
  }

  const degradedCount = countsByStatus.degraded + countsByStatus.error + countsByStatus.partial;
  const status: ReportStatusRuntimeState =
    entries.length === 0 ? "unavailable" : degradedCount > 0 ? "needs_attention" : "ready";

  if (countsByStatus.planned > 0) {
    warnings.push(`${countsByStatus.planned} report entries remain in planned status.`);
  }

  const generatedAt = new Date().toISOString();

  return {
    countsByStatus,
    entries,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${entries.length} report statuses resolved`,
    readOnly: true,
    source: REPORT_STATUS_SOURCE,
    status,
    statusByReportKey,
    summary: [
      `status ${status}`,
      `${entries.length} reports`,
      `${countsByStatus.available + countsByStatus.active + countsByStatus.certified} healthy`,
      `${degradedCount} need attention`
    ].join("; "),
    warnings
  };
}

export function getReportRuntimeStatusEntry(
  snapshot: Pick<ReportStatusSnapshot, "statusByReportKey">,
  reportKey: string
): ReportStatusEntry {
  return (
    snapshot.statusByReportKey[reportKey] ?? {
      badgeTone: reportRuntimeStatusBadgeTone("planned"),
      description: reportRuntimeStatusDescription("planned"),
      readOnly: true,
      registryStatus: "planned",
      reportKey,
      roadmapPhase: "Unknown",
      runtimeStatus: "planned",
      title: "Unknown report"
    }
  );
}

export async function mapReportStatusRuntimeToAdminFields(input: ReportStatusRuntimeInput) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      countsByStatus: emptyCounts(),
      entries: [],
      errorMessage: "Super Admin access is required for Report Status runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Status unavailable",
      readOnly: true as const,
      status: "unavailable" as const,
      statusByReportKey: {},
      summary: "Report Status requires Super Admin access.",
      warnings: ["Super Admin access is required for Report Status runtime."]
    };
  }

  const snapshot = runReportStatusSnapshot(input);

  return {
    countsByStatus: snapshot.countsByStatus,
    entries: snapshot.entries,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    readOnly: true as const,
    status: snapshot.status,
    statusByReportKey: snapshot.statusByReportKey,
    summary: snapshot.summary,
    warnings: snapshot.warnings
  };
}

export function buildReportStatusRuntimeInput(input: {
  aiReports: AdapterSnapshot;
  domainEmailReports: AdapterSnapshot;
  marketplaceReports: AdapterSnapshot;
  operationsReports: AdapterSnapshot;
  paymentReports: AdapterSnapshot;
  registry: ReportStatusRuntimeInput["registry"];
  registryReports: RegistryReportSnapshot[];
  reportViewer: ReportStatusRuntimeInput["reportViewer"];
  revenueReports: AdapterSnapshot;
  securityReports: AdapterSnapshot;
  storeReports: AdapterSnapshot;
  subscriptionReports: AdapterSnapshot;
  userReports: AdapterSnapshot;
}): ReportStatusRuntimeInput {
  return {
    registry: input.registry,
    registryReports: input.registryReports,
    reportViewer: input.reportViewer,
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

export function withReportRuntimeStatusFields<T extends Record<string, unknown>>(
  module: T,
  reportKey: string,
  statusByReportKey: Record<string, ReportStatusEntry>
) {
  const statusEntry = getReportRuntimeStatusEntry({ statusByReportKey }, reportKey);

  return {
    ...module,
    runtimeStatus: statusEntry.runtimeStatus,
    runtimeStatusDescription: statusEntry.description
  };
}
