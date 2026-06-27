import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import {
  getReportRegistryEntry,
  type ReportRegistryEntry,
  type ReportsRegistryRuntimeContext
} from "@/src/lib/reports/reports-registry-runtime";

export type ReportViewerSource = "report_viewer_runtime";

export type ReportViewerRuntimeStatus = "needs_attention" | "ready" | "unavailable";

export type ReportViewerLoadingState = "empty" | "error" | "loaded";

export type ReportViewerDetailState = "available" | "empty" | "error" | "not_found" | "planned";

export type ReportViewerActivityItem = {
  activityAt: string;
  activityType: string;
  dataAvailability: "available" | "planned";
  status: string;
  summary: string;
};

export type ReportViewerDetail = {
  category: string;
  certificationState: string;
  dataSourceDescription: string;
  emptyMessage: string | null;
  errorMessage: string | null;
  exportAvailabilityState: string;
  futureHooks: string[];
  lastGeneratedState: string;
  latestSafeActivity: ReportViewerActivityItem[];
  readOnly: true;
  reportId: string;
  reportKey: string;
  roadmapPhase: string;
  runtimeMetricsSummary: string;
  safeActionsState: string;
  status: string;
  title: string;
  viewerState: ReportViewerDetailState;
  visibility: string;
};

export type ReportViewerSnapshot = {
  catalog: ReportViewerDetail[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  loadingState: ReportViewerLoadingState;
  readOnly: true;
  selectedReport: ReportViewerDetail | null;
  selectedReportKey: string | null;
  source: ReportViewerSource;
  status: ReportViewerRuntimeStatus;
  summary: string;
  viewableReportCount: number;
  warnings: string[];
};

export const REPORT_VIEWER_SOURCE = "report_viewer_runtime" as const;

export const VIEWABLE_REPORT_KEYS = [
  "rp-1-reports-registry",
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

export type ViewableReportKey = (typeof VIEWABLE_REPORT_KEYS)[number];

type RuntimeModuleSnapshot = {
  errorMessage: string | null;
  lastGeneratedState: string;
  lastUpdatedAt: string | null;
  loadingState: "empty" | "error" | "loaded";
  status: string;
  summary: string;
};

type RegistryReportSnapshot = {
  category: string;
  certificationState: string;
  dataSourceDescription: string;
  exportAvailabilityState: string;
  futureHooks: string[];
  lastGenerated: string;
  name: string;
  reportId: string;
  reportKey: string;
  roadmapPhase: string;
  safeActionsAvailability: string;
  safeActionsLabel: string;
  status: string;
  visibility: string;
};

type ActivityRecord = Record<string, unknown>;

export type ReportViewerRuntimeInput = {
  aiReports: RuntimeModuleSnapshot & {
    latestAIActivity: ActivityRecord[];
  };
  domainEmailReports: RuntimeModuleSnapshot & {
    latestDomainActivity: ActivityRecord[];
    latestEmailActivity: ActivityRecord[];
  };
  marketplaceReports: RuntimeModuleSnapshot & {
    latestMarketplaceActivity: ActivityRecord[];
  };
  operationsReports: RuntimeModuleSnapshot & {
    latestOperationsActivity: ActivityRecord[];
  };
  paymentReports: RuntimeModuleSnapshot & {
    latestPaymentActivity: ActivityRecord[];
  };
  registry: {
    status: string;
    summary: string;
    totalEntries: number;
  };
  registryContext: ReportsRegistryRuntimeContext;
  registryReports: RegistryReportSnapshot[];
  revenueReports: RuntimeModuleSnapshot;
  securityReports: RuntimeModuleSnapshot & {
    latestSecurityActivity: ActivityRecord[];
  };
  selectedReportKey: string | null;
  storeReports: RuntimeModuleSnapshot;
  subscriptionReports: RuntimeModuleSnapshot;
  userReports: RuntimeModuleSnapshot;
};

function text(value: unknown, fallback = "") {
  const cleaned =
    typeof value === "string" && value.trim()
      ? maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, 160)
      : fallback;

  return cleaned;
}

function safeSummary(value: unknown) {
  return text(value, "Safe operational summary unavailable.");
}

function mapActivityItem(
  item: ActivityRecord,
  activityType: string,
  summaryKeys: string[]
): ReportViewerActivityItem {
  const summary =
    summaryKeys.map((key) => text(item[key])).find(Boolean) ||
    safeSummary("Activity recorded without a safe summary.");

  return {
    activityAt: text(item.activityAt, "Timestamp unavailable"),
    activityType: text(activityType, "activity"),
    dataAvailability: item.dataAvailability === "planned" ? "planned" : "available",
    status: text(item.status, "recorded"),
    summary: safeSummary(summary)
  };
}

function extractLatestActivity(reportKey: string, input: ReportViewerRuntimeInput): ReportViewerActivityItem[] {
  switch (reportKey) {
    case "rp-1-reports-registry":
      return input.registryReports
        .filter((report) => VIEWABLE_REPORT_KEYS.includes(report.reportKey as ViewableReportKey))
        .slice(0, 6)
        .map((report) => ({
          activityAt: text(report.lastGenerated, "Registry snapshot"),
          activityType: report.roadmapPhase,
          dataAvailability: "available" as const,
          status: report.status,
          summary: safeSummary(`${report.name} · ${report.category}`)
        }));
    case "rp-6-payment-reports":
      return input.paymentReports.latestPaymentActivity.slice(0, 6).map((item) =>
        mapActivityItem(item, text(item.provider, "payment"), ["amountLabel", "provider"])
      );
    case "rp-7-ai-reports":
      return input.aiReports.latestAIActivity.slice(0, 6).map((item) =>
        mapActivityItem(item, text(item.feature, "ai"), ["feature", "scopeLabel"])
      );
    case "rp-8-domain-email-reports":
      return [...input.domainEmailReports.latestDomainActivity, ...input.domainEmailReports.latestEmailActivity]
        .slice(0, 6)
        .map((item) => mapActivityItem(item, text(item.label, "domain-email"), ["label", "provider"]));
    case "rp-9-marketplace-reports":
      return input.marketplaceReports.latestMarketplaceActivity.slice(0, 6).map((item) =>
        mapActivityItem(item, text(item.activityType, "marketplace"), ["itemLabel", "activityType"])
      );
    case "rp-10-security-reports":
      return input.securityReports.latestSecurityActivity.slice(0, 6).map((item) =>
        mapActivityItem(item, text(item.activityType, "security"), ["summary", "category"])
      );
    case "rp-11-operations-reports":
      return input.operationsReports.latestOperationsActivity.slice(0, 6).map((item) =>
        mapActivityItem(item, text(item.activityType, "operations"), ["summary", "category"])
      );
    default:
      return [];
  }
}

function resolveRuntimeModule(reportKey: string, input: ReportViewerRuntimeInput): RuntimeModuleSnapshot | null {
  switch (reportKey) {
    case "rp-1-reports-registry":
      return {
        errorMessage: null,
        lastGeneratedState: `Live registry · ${input.registry.totalEntries} entries`,
        lastUpdatedAt: null,
        loadingState: "loaded",
        status: input.registry.status,
        summary: input.registry.summary
      };
    case "rp-2-revenue-reports":
      return input.revenueReports;
    case "rp-3-store-reports":
      return input.storeReports;
    case "rp-4-user-reports":
      return input.userReports;
    case "rp-5-subscription-reports":
      return input.subscriptionReports;
    case "rp-6-payment-reports":
      return input.paymentReports;
    case "rp-7-ai-reports":
      return input.aiReports;
    case "rp-8-domain-email-reports":
      return input.domainEmailReports;
    case "rp-9-marketplace-reports":
      return input.marketplaceReports;
    case "rp-10-security-reports":
      return input.securityReports;
    case "rp-11-operations-reports":
      return input.operationsReports;
    default:
      return null;
  }
}

function resolveViewerState(
  reportKey: string,
  module: RuntimeModuleSnapshot | null
): ReportViewerDetailState {
  if (!VIEWABLE_REPORT_KEYS.includes(reportKey as ViewableReportKey)) {
    return "not_found";
  }

  if (!module) {
    return "planned";
  }

  if (module.errorMessage) {
    return "error";
  }

  if (module.loadingState === "empty") {
    return "empty";
  }

  return "available";
}

function resolveEmptyMessage(viewerState: ReportViewerDetailState, title: string) {
  if (viewerState === "empty") {
    return `${title} has no runtime data for the selected range yet. The viewer remains read-only.`;
  }

  if (viewerState === "planned") {
    return `${title} runtime is planned. Registry metadata is available without generating data.`;
  }

  if (viewerState === "not_found") {
    return "This report key is not registered in the Reports Registry.";
  }

  return null;
}

function formatSafeActionsState(entry: ReportRegistryEntry) {
  if (entry.safeActionsAvailability === "available") {
    return "Safe actions available (read-only viewer on page load)";
  }

  if (entry.safeActionsAvailability === "placeholder") {
    return "Monitoring placeholders only";
  }

  return "Read-only";
}

function formatExportState(entry: ReportRegistryEntry) {
  if (entry.exportAvailabilityState === "export_ready") {
    return "Export ready (not enabled in viewer)";
  }

  if (entry.exportAvailabilityState === "placeholder") {
    return "Export reserved placeholder";
  }

  return "Export unavailable";
}

function buildRegistryDetail(reportKey: string, input: ReportViewerRuntimeInput): ReportViewerDetail | null {
  const registryEntry = getReportRegistryEntry(reportKey, input.registryContext);

  if (!registryEntry) {
    return null;
  }

  const adminReport = input.registryReports.find((report) => report.reportKey === reportKey);
  const runtimeModule = resolveRuntimeModule(reportKey, input);
  const viewerState = resolveViewerState(reportKey, runtimeModule);
  const latestSafeActivity = extractLatestActivity(reportKey, input);
  const runtimeMetricsSummary =
    runtimeModule?.summary ||
    (viewerState === "planned"
      ? "Runtime adapter not connected yet."
      : "No safe runtime metrics summary is available.");

  return {
    category: registryEntry.category,
    certificationState: registryEntry.certificationState,
    dataSourceDescription: registryEntry.dataSourceDescription,
    emptyMessage: resolveEmptyMessage(viewerState, registryEntry.title),
    errorMessage: runtimeModule?.errorMessage ?? null,
    exportAvailabilityState: formatExportState(registryEntry),
    futureHooks: [...registryEntry.futureHooks],
    lastGeneratedState: runtimeModule?.lastGeneratedState ?? registryEntry.lastGeneratedState,
    latestSafeActivity,
    readOnly: true,
    reportId: registryEntry.reportId,
    reportKey: registryEntry.reportKey,
    roadmapPhase: registryEntry.roadmapPhase,
    runtimeMetricsSummary: safeSummary(runtimeMetricsSummary),
    safeActionsState: adminReport?.safeActionsLabel ?? formatSafeActionsState(registryEntry),
    status: registryEntry.status,
    title: registryEntry.title,
    viewerState,
    visibility: registryEntry.visibility
  };
}

export function isViewableReportKey(reportKey: string): reportKey is ViewableReportKey {
  return VIEWABLE_REPORT_KEYS.includes(reportKey as ViewableReportKey);
}

export function buildReportViewerHref(range: string, reportKey: string) {
  const params = new URLSearchParams();

  if (range) {
    params.set("range", range);
  }

  params.set("view", reportKey);

  return `/admin/reports?${params.toString()}`;
}

export function runReportViewerSnapshot(input: ReportViewerRuntimeInput): ReportViewerSnapshot {
  const warnings: string[] = [];
  const catalog = VIEWABLE_REPORT_KEYS.map((reportKey) => buildRegistryDetail(reportKey, input)).filter(
    (detail): detail is ReportViewerDetail => detail !== null
  );

  const selectedReportKey = input.selectedReportKey?.trim() || null;
  const selectedReport =
    selectedReportKey && isViewableReportKey(selectedReportKey)
      ? catalog.find((detail) => detail.reportKey === selectedReportKey) ?? null
      : selectedReportKey
        ? ({
            category: "Unknown",
            certificationState: "planned",
            dataSourceDescription: "Report key not found in registry.",
            emptyMessage: "This report key is not available in the viewer catalog.",
            errorMessage: null,
            exportAvailabilityState: "Export unavailable",
            futureHooks: [],
            lastGeneratedState: "Not available",
            latestSafeActivity: [],
            readOnly: true,
            reportId: selectedReportKey,
            reportKey: selectedReportKey,
            roadmapPhase: "Unknown",
            runtimeMetricsSummary: "No runtime metrics available.",
            safeActionsState: "Read-only",
            status: "inactive",
            title: "Report not found",
            viewerState: "not_found",
            visibility: "super_admin"
          } satisfies ReportViewerDetail)
        : null;

  if (selectedReportKey && selectedReport?.viewerState === "not_found") {
    warnings.push(`Report key ${selectedReportKey} is not registered for viewer access.`);
  }

  const needsAttention = catalog.some(
    (detail) =>
      detail.viewerState === "error" ||
      detail.status === "review" ||
      detail.certificationState === "needs_attention"
  );

  const status: ReportViewerRuntimeStatus =
    catalog.length === 0 ? "unavailable" : needsAttention ? "needs_attention" : "ready";

  const generatedAt = new Date().toISOString();
  const lastGeneratedState = selectedReport
    ? `Viewer opened ${generatedAt} · ${selectedReport.title}`
    : `Viewer catalog generated ${generatedAt} · ${catalog.length} viewable reports`;

  return {
    catalog,
    errorMessage: selectedReport?.errorMessage ?? null,
    generatedAt,
    lastGeneratedState,
    loadingState: catalog.length ? "loaded" : "empty",
    readOnly: true,
    selectedReport,
    selectedReportKey,
    source: REPORT_VIEWER_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${catalog.length} viewable reports`,
      selectedReport ? `viewing ${selectedReport.reportKey}` : "catalog mode"
    ].join("; "),
    viewableReportCount: catalog.length,
    warnings
  };
}

export async function mapReportViewerRuntimeToAdminFields(input: ReportViewerRuntimeInput) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    const empty = runReportViewerSnapshot({
      ...input,
      selectedReportKey: null
    });

    return {
      catalog: [],
      errorMessage: "Super Admin access is required for Report Viewer runtime.",
      generatedAt: empty.generatedAt,
      lastGeneratedState: empty.lastGeneratedState,
      loadingState: "empty" as const,
      readOnly: true as const,
      selectedReport: null,
      selectedReportKey: input.selectedReportKey,
      status: "unavailable" as const,
      summary: "Report Viewer requires Super Admin access.",
      viewableReportCount: 0,
      warnings: ["Super Admin access is required for Report Viewer runtime."]
    };
  }

  const snapshot = runReportViewerSnapshot(input);

  return {
    catalog: snapshot.catalog,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    loadingState: snapshot.loadingState,
    readOnly: true as const,
    selectedReport: snapshot.selectedReport,
    selectedReportKey: snapshot.selectedReportKey,
    status: snapshot.status,
    summary: snapshot.summary,
    viewableReportCount: snapshot.viewableReportCount,
    warnings: snapshot.warnings
  };
}
