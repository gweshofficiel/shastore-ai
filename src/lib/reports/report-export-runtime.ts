import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { ReportFilterQuery } from "@/src/lib/reports/report-filters-runtime";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";
import { VIEWABLE_REPORT_KEYS } from "@/src/lib/reports/report-viewer-runtime";

export type ReportExportSource = "report_export_runtime";

export type ReportExportAvailabilityState =
  | "export_available"
  | "export_disabled"
  | "export_locked"
  | "export_planned"
  | "export_unavailable";

export type ReportExportFormat = "csv" | "json";

export type ReportExportRuntimeState = "degraded" | "empty" | "planned" | "ready" | "unavailable";

export type ReportExportLoadingState = "degraded" | "empty" | "error" | "loaded" | "planned";

export type ReportExportAuditReadyMetadata = {
  exportSource: typeof REPORT_EXPORT_SOURCE;
  exportedAt: string;
  format: ReportExportFormat;
  range: string;
  reportKey: string;
  safeFieldsOnly: true;
  superAdminOnly: true;
};

export type ReportExportEntry = {
  exportAvailabilityState: ReportExportAvailabilityState;
  exportCsvHref: string | null;
  exportHelperText: string;
  exportJsonHref: string | null;
  readOnly: true;
  reportKey: string;
  reportTitle: string;
};

export type ReportExportSelectedSummary = ReportExportEntry;

export type ReportExportAvailabilityBreakdownItem = {
  count: number;
  label: ReportExportAvailabilityState;
};

export type ReportExportTotals = {
  exportAvailableReports: number;
  exportDisabledReports: number;
  exportLockedReports: number;
  exportPlannedReports: number;
  exportUnavailableReports: number;
};

export type ReportExportSnapshot = {
  byAvailability: ReportExportAvailabilityBreakdownItem[];
  entries: ReportExportEntry[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  loadingState: ReportExportLoadingState;
  readOnly: true;
  selectedReportExport: ReportExportSelectedSummary | null;
  selectedReportKey: string | null;
  source: ReportExportSource;
  status: ReportExportRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  totals: ReportExportTotals;
  warnings: string[];
};

export type ReportExportValidationResult =
  | {
      auditReadyMetadata: ReportExportAuditReadyMetadata;
      available: true;
      payload: Record<string, unknown>;
    }
  | {
      available: false;
      errorMessage: string;
      status: 400 | 403 | 404 | 409;
    };

export const REPORT_EXPORT_SOURCE = "report_export_runtime" as const;

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
  "rp-20-report-review"
]);

function safeText(value: unknown, fallback = "") {
  const normalized =
    typeof value === "string" && value.trim()
      ? maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, 160)
      : fallback;

  return normalized;
}

function sanitizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const output: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      output[key] = entry;
    } else if (typeof entry === "string") {
      output[key] = safeText(entry);
    } else if (typeof entry === "boolean") {
      output[key] = entry;
    } else if (Array.isArray(entry)) {
      output[key] = entry.map((item) =>
        typeof item === "object" && item !== null ? sanitizeRecord(item) : safeText(String(item))
      );
    } else if (typeof entry === "object" && entry !== null) {
      output[key] = sanitizeRecord(entry);
    }
  }

  return output;
}

export function reportExportAvailabilityBadgeTone(
  availability: ReportExportAvailabilityState
): "amber" | "blue" | "green" | "red" | "slate" {
  if (availability === "export_available") {
    return "green";
  }

  if (availability === "export_disabled" || availability === "export_planned") {
    return "blue";
  }

  if (availability === "export_locked") {
    return "amber";
  }

  return "red";
}

export function reportExportAvailabilityLabel(availability: ReportExportAvailabilityState) {
  return availability.replace(/_/g, " ");
}

function isExportReadyRuntimeStatus(runtimeStatus: ReportRuntimeStatus) {
  return (
    runtimeStatus === "available" ||
    runtimeStatus === "active" ||
    runtimeStatus === "certified" ||
    runtimeStatus === "partial"
  );
}

function resolveExportHelperText(availability: ReportExportAvailabilityState) {
  switch (availability) {
    case "export_available":
      return "Safe sanitized summary export is available. Use Export JSON or Export CSV to download explicitly.";
    case "export_disabled":
      return "Export is disabled until runtime data is loaded and safe summary fields are available.";
    case "export_planned":
      return "Export remains planned for this report type. No file is generated on page load.";
    case "export_locked":
      return "Export is locked until Super Admin access and report visibility requirements are satisfied.";
    case "export_unavailable":
      return "Export is unavailable due to runtime error or missing registry coverage.";
    default:
      return "Export state unavailable.";
  }
}

const FILTER_QUERY_KEYS = [
  "category",
  "status",
  "visibility",
  "certification",
  "action",
  "availability",
  "type",
  "q"
] as const;

export function buildReportExportHref(input: {
  filters?: ReportFilterQuery;
  format: ReportExportFormat;
  range: string;
  reportKey: string;
}) {
  const params = new URLSearchParams();
  const filters = input.filters ?? emptyExportFilters();

  params.set("format", input.format);
  params.set("range", input.range);
  params.set("reportKey", input.reportKey);

  for (const key of FILTER_QUERY_KEYS) {
    const value = filters[key];

    if (value) {
      params.set(key, value);
    }
  }

  return `/admin/reports/export?${params.toString()}`;
}

function emptyExportFilters(): ReportFilterQuery {
  return {
    action: null,
    availability: null,
    category: null,
    certification: null,
    q: null,
    status: null,
    type: null,
    visibility: null
  };
}

function resolveExportAvailability(input: {
  adapterLoadingState?: "empty" | "error" | "loaded";
  registryStatus: string;
  reportKey: string;
  runtimeStatus: ReportRuntimeStatus;
  superAdmin: boolean;
}): ReportExportAvailabilityState {
  if (!input.superAdmin) {
    return "export_locked";
  }

  if (input.reportKey === "rp-1-reports-registry") {
    return "export_available";
  }

  if (input.reportKey === "rp-21-report-export") {
    return "export_available";
  }

  if (PLATFORM_RUNTIME_REPORT_KEYS.has(input.reportKey)) {
    return "export_planned";
  }

  if (input.registryStatus === "planned" || input.registryStatus === "inactive") {
    return "export_planned";
  }

  if (input.runtimeStatus === "planned" || input.runtimeStatus === "inactive") {
    return "export_planned";
  }

  if (input.runtimeStatus === "error" || input.adapterLoadingState === "error") {
    return "export_unavailable";
  }

  if (!RUNTIME_MODULE_REPORT_KEYS.has(input.reportKey)) {
    return "export_planned";
  }

  if (input.adapterLoadingState === "empty" || input.runtimeStatus === "empty") {
    return "export_disabled";
  }

  if (!isExportReadyRuntimeStatus(input.runtimeStatus)) {
    return "export_disabled";
  }

  if (input.adapterLoadingState === "loaded") {
    return "export_available";
  }

  return "export_disabled";
}

export type ReportExportRuntimeInput = {
  adapterLoadingStateByReportKey: Record<string, "empty" | "error" | "loaded" | undefined>;
  filters: ReportFilterQuery;
  moduleSnapshots: ReportExportModuleSnapshots;
  registryReports: Array<{
    category: string;
    name: string;
    reportKey: string;
    roadmapPhase: string;
    runtimeStatus: ReportRuntimeStatus;
    status: string;
  }>;
  range: string;
  selectedReportKey: string | null;
  superAdmin: boolean;
};

export type ReportExportModuleSnapshots = {
  aggregation?: {
    generatedAt: string;
    summary: string;
    totals: Record<string, number>;
  };
  aiReports?: ReportExportModuleSnapshot;
  domainEmailReports?: ReportExportModuleSnapshot;
  marketplaceReports?: ReportExportModuleSnapshot;
  operationsReports?: ReportExportModuleSnapshot;
  paymentReports?: ReportExportModuleSnapshot;
  revenueReports?: ReportExportModuleSnapshot;
  securityReports?: ReportExportModuleSnapshot;
  storeReports?: ReportExportModuleSnapshot;
  subscriptionReports?: ReportExportModuleSnapshot;
  userReports?: ReportExportModuleSnapshot;
};

export type ReportExportModuleSnapshot = {
  breakdowns?: Array<Record<string, unknown>>;
  errorMessage: string | null;
  generatedAt: string;
  loadingState: "empty" | "error" | "loaded";
  metrics: Record<string, number>;
  rangeLabel: string;
  selectedRange: string;
  status: string;
  summary: string;
  warnings: string[];
};

function buildAvailabilityBreakdown(
  entries: ReportExportEntry[]
): ReportExportAvailabilityBreakdownItem[] {
  const counts: Record<ReportExportAvailabilityState, number> = {
    export_available: 0,
    export_disabled: 0,
    export_locked: 0,
    export_planned: 0,
    export_unavailable: 0
  };

  for (const entry of entries) {
    counts[entry.exportAvailabilityState] += 1;
  }

  return (Object.keys(counts) as ReportExportAvailabilityState[])
    .map((label) => ({ count: counts[label], label }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function resolveSnapshotStatus(entries: ReportExportEntry[]): ReportExportRuntimeState {
  if (entries.length === 0) {
    return "unavailable";
  }

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator[entry.exportAvailabilityState] += 1;
      return accumulator;
    },
    {
      export_available: 0,
      export_disabled: 0,
      export_locked: 0,
      export_planned: 0,
      export_unavailable: 0
    }
  );

  if (totals.export_unavailable + totals.export_locked > entries.length / 2) {
    return "degraded";
  }

  if (totals.export_planned > entries.length / 2) {
    return "planned";
  }

  if (totals.export_available === 0) {
    return "empty";
  }

  return "ready";
}

function resolveLoadingState(status: ReportExportRuntimeState): ReportExportLoadingState {
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

export function runReportExportSnapshot(input: ReportExportRuntimeInput): ReportExportSnapshot {
  const warnings: string[] = [];

  warnings.push("Report Export is read-only on page load. Files download only after explicit Export action.");
  warnings.push("Exports include sanitized summaries and aggregated metrics only.");
  warnings.push("Sensitive values are masked before export output.");

  const entries: ReportExportEntry[] = input.registryReports.map((report) => {
    const exportAvailabilityState = resolveExportAvailability({
      adapterLoadingState: input.adapterLoadingStateByReportKey[report.reportKey],
      registryStatus: report.status,
      reportKey: report.reportKey,
      runtimeStatus: report.runtimeStatus,
      superAdmin: input.superAdmin
    });
    const exportAvailable = exportAvailabilityState === "export_available";

    return {
      exportAvailabilityState,
      exportCsvHref: exportAvailable
        ? buildReportExportHref({
            filters: input.filters,
            format: "csv",
            range: input.range,
            reportKey: report.reportKey
          })
        : null,
      exportHelperText: resolveExportHelperText(exportAvailabilityState),
      exportJsonHref: exportAvailable
        ? buildReportExportHref({
            filters: input.filters,
            format: "json",
            range: input.range,
            reportKey: report.reportKey
          })
        : null,
      readOnly: true,
      reportKey: report.reportKey,
      reportTitle: safeText(report.name, report.reportKey)
    };
  });

  const totals: ReportExportTotals = {
    exportAvailableReports: entries.filter((entry) => entry.exportAvailabilityState === "export_available").length,
    exportDisabledReports: entries.filter((entry) => entry.exportAvailabilityState === "export_disabled").length,
    exportLockedReports: entries.filter((entry) => entry.exportAvailabilityState === "export_locked").length,
    exportPlannedReports: entries.filter((entry) => entry.exportAvailabilityState === "export_planned").length,
    exportUnavailableReports: entries.filter((entry) => entry.exportAvailabilityState === "export_unavailable").length
  };
  const status = resolveSnapshotStatus(entries);
  const loadingState = resolveLoadingState(status);
  const generatedAt = new Date().toISOString();
  const selectedReportExport =
    input.selectedReportKey != null
      ? entries.find((entry) => entry.reportKey === input.selectedReportKey) ?? null
      : null;

  return {
    byAvailability: buildAvailabilityBreakdown(entries),
    entries,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${totals.exportAvailableReports} export available`,
    loadingState,
    readOnly: true,
    selectedReportExport,
    selectedReportKey: input.selectedReportKey,
    source: REPORT_EXPORT_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${totals.exportAvailableReports} export available`,
      `${totals.exportDisabledReports} disabled`,
      `${totals.exportPlannedReports} planned`
    ].join("; "),
    superAdminReportsOnly: true,
    totals,
    warnings
  };
}

export async function mapReportExportRuntimeToAdminFields(input: ReportExportRuntimeInput) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      byAvailability: [],
      entries: [],
      errorMessage: "Super Admin access is required for Report Export runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Export unavailable",
      loadingState: "error" as const,
      readOnly: true as const,
      selectedReportExport: null,
      selectedReportKey: input.selectedReportKey,
      status: "unavailable" as const,
      summary: "Report Export requires Super Admin access.",
      superAdminReportsOnly: true as const,
      totals: {
        exportAvailableReports: 0,
        exportDisabledReports: 0,
        exportLockedReports: 0,
        exportPlannedReports: 0,
        exportUnavailableReports: 0
      },
      warnings: ["Super Admin access is required for Report Export runtime."]
    };
  }

  const snapshot = runReportExportSnapshot({ ...input, superAdmin: true });

  return {
    byAvailability: snapshot.byAvailability,
    entries: snapshot.entries,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    loadingState: snapshot.loadingState,
    readOnly: true as const,
    selectedReportExport: snapshot.selectedReportExport,
    selectedReportKey: snapshot.selectedReportKey,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    totals: snapshot.totals,
    warnings: snapshot.warnings
  };
}

function moduleSnapshotPayload(
  reportKey: string,
  title: string,
  snapshot: ReportExportModuleSnapshot | undefined
) {
  if (!snapshot) {
    return null;
  }

  return {
    breakdowns: (snapshot.breakdowns ?? []).map((item) => sanitizeRecord(item)),
    errorMessage: snapshot.errorMessage ? safeText(snapshot.errorMessage) : null,
    generatedAt: snapshot.generatedAt,
    loadingState: snapshot.loadingState,
    metrics: sanitizeRecord(snapshot.metrics),
    rangeLabel: safeText(snapshot.rangeLabel),
    reportKey,
    selectedRange: snapshot.selectedRange,
    status: safeText(snapshot.status),
    summary: safeText(snapshot.summary),
    title: safeText(title),
    warnings: snapshot.warnings.map((warning) => safeText(warning))
  };
}

export function buildSanitizedReportExportPayload(input: {
  exportSnapshot: ReportExportSnapshot;
  moduleSnapshots: ReportExportModuleSnapshots;
  range: string;
  registryReports: ReportExportRuntimeInput["registryReports"];
  reportKey: string;
}): Record<string, unknown> | null {
  const entry = input.exportSnapshot.entries.find((item) => item.reportKey === input.reportKey);

  if (!entry || entry.exportAvailabilityState !== "export_available") {
    return null;
  }

  if (input.reportKey === "rp-1-reports-registry") {
    return {
      reports: input.registryReports.map((report) => ({
        category: safeText(report.category),
        reportKey: report.reportKey,
        roadmapPhase: safeText(report.roadmapPhase),
        runtimeStatus: report.runtimeStatus,
        status: safeText(report.status),
        title: safeText(report.name, report.reportKey)
      })),
      selectedRange: input.range,
      summary: safeText(`Registry export with ${input.registryReports.length} entries`)
    };
  }

  if (input.reportKey === "rp-21-report-export") {
    return {
      exports: input.exportSnapshot.entries.map((exportEntry) => ({
        exportAvailabilityState: exportEntry.exportAvailabilityState,
        exportHelperText: exportEntry.exportHelperText,
        reportKey: exportEntry.reportKey,
        reportTitle: exportEntry.reportTitle
      })),
      selectedRange: input.range,
      summary: safeText("Report Export runtime catalog")
    };
  }

  const report = input.registryReports.find((item) => item.reportKey === input.reportKey);
  const title = safeText(report?.name, input.reportKey);

  switch (input.reportKey) {
    case "rp-2-revenue-reports":
      return moduleSnapshotPayload(input.reportKey, title, input.moduleSnapshots.revenueReports);
    case "rp-3-store-reports":
      return moduleSnapshotPayload(input.reportKey, title, input.moduleSnapshots.storeReports);
    case "rp-4-user-reports":
      return moduleSnapshotPayload(input.reportKey, title, input.moduleSnapshots.userReports);
    case "rp-5-subscription-reports":
      return moduleSnapshotPayload(input.reportKey, title, input.moduleSnapshots.subscriptionReports);
    case "rp-6-payment-reports":
      return moduleSnapshotPayload(input.reportKey, title, input.moduleSnapshots.paymentReports);
    case "rp-7-ai-reports":
      return moduleSnapshotPayload(input.reportKey, title, input.moduleSnapshots.aiReports);
    case "rp-8-domain-email-reports":
      return moduleSnapshotPayload(input.reportKey, title, input.moduleSnapshots.domainEmailReports);
    case "rp-9-marketplace-reports":
      return moduleSnapshotPayload(input.reportKey, title, input.moduleSnapshots.marketplaceReports);
    case "rp-10-security-reports":
      return moduleSnapshotPayload(input.reportKey, title, input.moduleSnapshots.securityReports);
    case "rp-11-operations-reports":
      return moduleSnapshotPayload(input.reportKey, title, input.moduleSnapshots.operationsReports);
    default:
      return null;
  }
}

export function validateReportExportRequest(input: {
  exportSnapshot: ReportExportSnapshot;
  format: ReportExportFormat | null;
  moduleSnapshots: ReportExportModuleSnapshots;
  range: string;
  registryReports: ReportExportRuntimeInput["registryReports"];
  reportKey: string | null;
  superAdmin: boolean;
}): ReportExportValidationResult {
  if (!input.superAdmin) {
    return {
      available: false,
      errorMessage: "Super Admin access is required to export reports.",
      status: 403
    };
  }

  if (!input.reportKey) {
    return {
      available: false,
      errorMessage: "A reportKey query parameter is required.",
      status: 400
    };
  }

  if (!input.format || (input.format !== "csv" && input.format !== "json")) {
    return {
      available: false,
      errorMessage: "Supported export formats are csv and json.",
      status: 400
    };
  }

  const entry = input.exportSnapshot.entries.find((item) => item.reportKey === input.reportKey);

  if (!entry) {
    return {
      available: false,
      errorMessage: "The requested report is not registered for export.",
      status: 404
    };
  }

  if (entry.exportAvailabilityState !== "export_available") {
    return {
      available: false,
      errorMessage: entry.exportHelperText,
      status: 409
    };
  }

  const payload = buildSanitizedReportExportPayload({
    exportSnapshot: input.exportSnapshot,
    moduleSnapshots: input.moduleSnapshots,
    range: input.range,
    registryReports: input.registryReports,
    reportKey: input.reportKey
  });

  if (!payload) {
    return {
      available: false,
      errorMessage: "Safe export payload is unavailable for this report.",
      status: 409
    };
  }

  const exportedAt = new Date().toISOString();

  return {
    auditReadyMetadata: {
      exportSource: REPORT_EXPORT_SOURCE,
      exportedAt,
      format: input.format,
      range: input.range,
      reportKey: input.reportKey,
      safeFieldsOnly: true,
      superAdminOnly: true
    },
    available: true,
    payload: {
      auditReadyMetadata: {
        exportSource: REPORT_EXPORT_SOURCE,
        exportedAt,
        format: input.format,
        range: input.range,
        reportKey: input.reportKey,
        safeFieldsOnly: true,
        superAdminOnly: true
      },
      report: payload
    }
  };
}

function csvValue(value: string | number | null | undefined) {
  const raw = String(value ?? "");

  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replaceAll("\"", "\"\"")}"`;
  }

  return raw;
}

function flattenExportRows(payload: Record<string, unknown>, reportKey: string) {
  const report = payload.report;

  if (Array.isArray(report)) {
    return report.flatMap((item) =>
      typeof item === "object" && item !== null
        ? Object.entries(item as Record<string, unknown>).map(([field, value]) => ({
            field,
            report_key: reportKey,
            value: typeof value === "number" ? value : safeText(String(value))
          }))
        : []
    );
  }

  if (!report || typeof report !== "object") {
    return [];
  }

  const rows: Array<{ field: string; report_key: string; value: string | number }> = [];

  for (const [key, value] of Object.entries(report as Record<string, unknown>)) {
    if (typeof value === "number") {
      rows.push({ field: key, report_key: reportKey, value });
    } else if (typeof value === "string") {
      rows.push({ field: key, report_key: reportKey, value: safeText(value) });
    } else if (Array.isArray(value)) {
      rows.push({
        field: key,
        report_key: reportKey,
        value: safeText(JSON.stringify(value.map((item) => sanitizeRecord(item))))
      });
    } else if (typeof value === "object" && value !== null) {
      rows.push({
        field: key,
        report_key: reportKey,
        value: safeText(JSON.stringify(sanitizeRecord(value)))
      });
    }
  }

  return rows;
}

export function reportExportPayloadToCsv(payload: Record<string, unknown>, reportKey: string) {
  const rows = flattenExportRows(payload, reportKey);
  const headers = ["report_key", "field", "value"];
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header as keyof typeof row])).join(","))
  ];

  return lines.join("\n");
}

export function buildReportExportRuntimeInput(input: {
  adapterLoadingStateByReportKey: Record<string, "empty" | "error" | "loaded" | undefined>;
  filters: ReportFilterQuery;
  moduleSnapshots: ReportExportModuleSnapshots;
  registryReports: Array<{
    category: string;
    name: string;
    reportKey: string;
    roadmapPhase: string;
    runtimeStatus: ReportRuntimeStatus;
    status: string;
  }>;
  range: string;
  selectedReportKey: string | null;
}): ReportExportRuntimeInput {
  return {
    adapterLoadingStateByReportKey: input.adapterLoadingStateByReportKey,
    filters: input.filters,
    moduleSnapshots: input.moduleSnapshots,
    registryReports: input.registryReports,
    range: input.range,
    selectedReportKey: input.selectedReportKey,
    superAdmin: false
  };
}

export function isReportExportViewableKey(reportKey: string) {
  return VIEWABLE_REPORT_KEYS.includes(reportKey as (typeof VIEWABLE_REPORT_KEYS)[number]);
}
