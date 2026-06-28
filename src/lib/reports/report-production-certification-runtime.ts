import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { ReportDataCertificationStatus } from "@/src/lib/reports/report-data-certification-runtime";
import type { ReportRuntimeCertificationEntry } from "@/src/lib/reports/report-runtime-certification-runtime";
import type { ReportRuntimeCertificationStatus } from "@/src/lib/reports/report-runtime-certification-runtime";
import type { ReportSecurityCertificationStatus } from "@/src/lib/reports/report-security-certification-runtime";

export type ReportProductionCertificationSource = "report_production_certification_runtime";

export type ReportProductionCertificationStatus =
  | "production_blocked"
  | "production_certified"
  | "production_partial"
  | "production_planned"
  | "production_unsafe"
  | "production_unknown";

export type ReportProductionCertificationRuntimeState =
  | "degraded"
  | "empty"
  | "planned"
  | "ready"
  | "unavailable";

export type ReportProductionCertificationLoadingState =
  | "degraded"
  | "empty"
  | "error"
  | "loaded"
  | "planned";

export type ReportProductionLayerRuntimeStatuses = {
  aggregationStatus: string;
  auditStatus: string;
  exportStatus: string;
  filtersStatus: string;
  registryStatus: string;
  reviewStatus: string;
  safeActionsStatus: string;
  scheduledReportsStatus: string;
  searchStatus: string;
  statusLayerStatus: string;
  viewerStatus: string;
  visibilityStatus: string;
};

export type ReportProductionCertificationEntry = {
  aggregationProductionConfirmation: string;
  auditProductionConfirmation: string;
  dataCertificationProductionConfirmation: string;
  exportProductionConfirmation: string;
  externalProviderCallPreventionConfirmation: string;
  filtersProductionConfirmation: string;
  pageLoadReadOnlyConfirmation: string;
  productionCertificationNotes: string;
  productionCertificationStatus: ReportProductionCertificationStatus;
  productionHelperText: string;
  providerCallPreventionConfirmation: string;
  readOnly: true;
  registryProductionConfirmation: string;
  reportKey: string;
  reportTitle: string;
  reviewProductionConfirmation: string;
  runtimeCertificationProductionConfirmation: string;
  safeActionsProductionConfirmation: string;
  scheduledReportsProductionConfirmation: string;
  searchProductionConfirmation: string;
  securityCertificationProductionConfirmation: string;
  sensitiveDataProtectionConfirmation: string;
  statusProductionConfirmation: string;
  viewerProductionConfirmation: string;
  visibilityProductionConfirmation: string;
};

export type ReportProductionCertificationSelectedSummary = ReportProductionCertificationEntry;

export type ReportProductionCertificationStatusBreakdownItem = {
  count: number;
  label: ReportProductionCertificationStatus;
};

export type ReportProductionCertificationTotals = {
  productionBlockedReports: number;
  productionCertifiedReports: number;
  productionPartialReports: number;
  productionPlannedReports: number;
  productionUnsafeReports: number;
  productionUnknownReports: number;
};

export type ReportProductionCertificationSnapshot = {
  byStatus: ReportProductionCertificationStatusBreakdownItem[];
  entries: ReportProductionCertificationEntry[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  loadingState: ReportProductionCertificationLoadingState;
  readOnly: true;
  reportsRuntimeProductionStatus: ReportProductionCertificationStatus;
  selectedReportKey: string | null;
  selectedReportProductionCertification: ReportProductionCertificationSelectedSummary | null;
  source: ReportProductionCertificationSource;
  status: ReportProductionCertificationRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  totals: ReportProductionCertificationTotals;
  warnings: string[];
};

export const REPORT_PRODUCTION_CERTIFICATION_SOURCE = "report_production_certification_runtime" as const;

const FOUNDATION_PRODUCTION_PARTIAL_KEYS = new Set([
  "rp-22-scheduled-reports",
  "rp-23-report-data-certification",
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

export function reportProductionCertificationBadgeTone(
  status: ReportProductionCertificationStatus
): "amber" | "blue" | "green" | "red" | "slate" {
  if (status === "production_certified") {
    return "green";
  }

  if (status === "production_partial" || status === "production_planned") {
    return "blue";
  }

  if (status === "production_blocked") {
    return "amber";
  }

  if (status === "production_unsafe") {
    return "red";
  }

  return "slate";
}

export function reportProductionCertificationStatusLabel(status: ReportProductionCertificationStatus) {
  return formatLabel(status);
}

function resolveLayerProductionConfirmation(
  layerLabel: string,
  layerStatus: string,
  healthyStatuses: string[]
) {
  if (healthyStatuses.includes(layerStatus)) {
    return `${layerLabel} runtime is integrated and read-only on page load.`;
  }

  if (layerStatus === "needs_attention" || layerStatus === "degraded" || layerStatus === "review") {
    return `${layerLabel} runtime is live with partial or review signals; no mutations on page load.`;
  }

  if (layerStatus === "empty" || layerStatus === "unavailable") {
    return `${layerLabel} runtime is partially available; read-only safeguards remain active.`;
  }

  return `${layerLabel} runtime integration requires review before full production certification.`;
}

function resolveAggregationProductionConfirmation(statuses: ReportProductionLayerRuntimeStatuses) {
  return resolveLayerProductionConfirmation("RP-16 Report Aggregation", statuses.aggregationStatus, [
    "ready",
    "available"
  ]);
}

function resolveFiltersProductionConfirmation(statuses: ReportProductionLayerRuntimeStatuses) {
  return resolveLayerProductionConfirmation("RP-17 Report Filters", statuses.filtersStatus, ["ready", "available"]);
}

function resolveSearchProductionConfirmation(statuses: ReportProductionLayerRuntimeStatuses) {
  return resolveLayerProductionConfirmation("RP-18 Report Search", statuses.searchStatus, ["ready", "available"]);
}

function resolveExternalProviderCallPreventionConfirmation(pageLoadReadOnlyConfirmation: string) {
  return pageLoadReadOnlyConfirmation.includes("blocked")
    ? "External provider calls are blocked until Super Admin read-only access is confirmed."
    : "No external provider calls occur during Reports page load.";
}

function resolveAiProviderCallPreventionConfirmation(pageLoadReadOnlyConfirmation: string) {
  return pageLoadReadOnlyConfirmation.includes("blocked")
    ? "AI provider calls are blocked until Super Admin read-only access is confirmed."
    : "No AI provider calls occur during Reports page load.";
}

function resolveProviderCallPreventionConfirmation(pageLoadReadOnlyConfirmation: string) {
  return `${resolveExternalProviderCallPreventionConfirmation(pageLoadReadOnlyConfirmation)} ${resolveAiProviderCallPreventionConfirmation(pageLoadReadOnlyConfirmation)}`.trim();
}

function resolveSensitiveDataProtectionConfirmation(pageLoadReadOnlyConfirmation: string) {
  return pageLoadReadOnlyConfirmation.includes("blocked")
    ? "Sensitive data protection requires Super Admin read-only access."
    : "Sensitive values are masked before display; no secrets, tokens, or private customer data are exposed.";
}

function parseDataCertStatus(notes: string): ReportDataCertificationStatus | null {
  const match = notes.match(/RP-23 data certification status: ([a-z_]+)/i);
  return match ? (match[1] as ReportDataCertificationStatus) : null;
}

function parseSecurityCertStatus(notes: string): ReportSecurityCertificationStatus | null {
  const match = notes.match(/RP-24 security certification status: ([a-z_]+)/i);
  return match ? (match[1] as ReportSecurityCertificationStatus) : null;
}

function resolveProductionHelperText(status: ReportProductionCertificationStatus) {
  switch (status) {
    case "production_certified":
      return "All required production checks pass for Super Admin read-only reporting.";
    case "production_partial":
      return "Production integration is live but one or more checks remain partial or foundation-only.";
    case "production_planned":
      return "Production certification remains planned for this report.";
    case "production_blocked":
      return "Production certification is blocked until Super Admin and access requirements are satisfied.";
    case "production_unsafe":
      return "Production certification is unsafe; resolve error, security, or runtime signals before production use.";
    default:
      return "Production certification status could not be determined.";
  }
}

function resolveProductionCertificationStatus(input: {
  dataCertStatus: ReportDataCertificationStatus | null;
  pageLoadReadOnlyConfirmation: string;
  reportKey: string;
  runtimeCertStatus: ReportRuntimeCertificationStatus;
  securityCertStatus: ReportSecurityCertificationStatus | null;
  superAdmin: boolean;
}): { productionCertificationNotes: string; productionCertificationStatus: ReportProductionCertificationStatus } {
  const notes: string[] = [];

  if (!input.superAdmin) {
    notes.push("Super Admin access is required for production certification.");
    return { productionCertificationNotes: notes.join(" "), productionCertificationStatus: "production_blocked" };
  }

  if (input.reportKey === "rp-26-report-production-certification") {
    notes.push(
      "RP-26 production certification resolver is live as read-only metadata; no certification records are written on page load."
    );
    return { productionCertificationNotes: notes.join(" "), productionCertificationStatus: "production_partial" };
  }

  if (
    input.runtimeCertStatus === "runtime_unsafe" ||
    input.dataCertStatus === "unsafe" ||
    input.securityCertStatus === "unsafe"
  ) {
    notes.push("Data, security, or runtime certification is unsafe; production certification blocked.");
    return { productionCertificationNotes: notes.join(" "), productionCertificationStatus: "production_unsafe" };
  }

  if (
    input.runtimeCertStatus === "runtime_blocked" ||
    input.dataCertStatus === "blocked" ||
    input.securityCertStatus === "blocked"
  ) {
    notes.push("Data, security, or runtime certification is blocked.");
    return { productionCertificationNotes: notes.join(" "), productionCertificationStatus: "production_blocked" };
  }

  if (input.pageLoadReadOnlyConfirmation.includes("blocked")) {
    notes.push("Page load read-only requirements are not satisfied.");
    return { productionCertificationNotes: notes.join(" "), productionCertificationStatus: "production_blocked" };
  }

  if (FOUNDATION_PRODUCTION_PARTIAL_KEYS.has(input.reportKey)) {
    notes.push("Foundation certification layer is live; downstream execution backends remain planned.");
    return { productionCertificationNotes: notes.join(" "), productionCertificationStatus: "production_partial" };
  }

  if (
    input.runtimeCertStatus === "runtime_certified" &&
    input.dataCertStatus === "certified" &&
    input.securityCertStatus === "certified"
  ) {
    notes.push(
      "Registry, adapters, viewer, status, visibility, safe actions, aggregation, filters, search, audit, review, export, schedule, data, security, and runtime layers pass production checks."
    );
    return { productionCertificationNotes: notes.join(" "), productionCertificationStatus: "production_certified" };
  }

  if (
    input.runtimeCertStatus === "runtime_partial" ||
    input.dataCertStatus === "partial" ||
    input.securityCertStatus === "partial"
  ) {
    notes.push("One or more certification layers remain partial.");
    return { productionCertificationNotes: notes.join(" "), productionCertificationStatus: "production_partial" };
  }

  if (
    input.runtimeCertStatus === "runtime_planned" ||
    input.dataCertStatus === "planned" ||
    input.securityCertStatus === "planned"
  ) {
    notes.push("Production certification remains planned.");
    return { productionCertificationNotes: notes.join(" "), productionCertificationStatus: "production_planned" };
  }

  notes.push("Production certification status could not be determined from available signals.");
  return { productionCertificationNotes: notes.join(" "), productionCertificationStatus: "production_unknown" };
}

function resolveReportsRuntimeProductionStatus(
  entries: ReportProductionCertificationEntry[]
): ReportProductionCertificationStatus {
  if (entries.length === 0) {
    return "production_unknown";
  }

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator[entry.productionCertificationStatus] += 1;
      return accumulator;
    },
    {
      production_blocked: 0,
      production_certified: 0,
      production_partial: 0,
      production_planned: 0,
      production_unsafe: 0,
      production_unknown: 0
    }
  );

  if (totals.production_unsafe > 0) {
    return "production_unsafe";
  }

  if (totals.production_blocked > 0) {
    return "production_blocked";
  }

  if (totals.production_certified === entries.length) {
    return "production_certified";
  }

  if (totals.production_certified > 0 && totals.production_partial + totals.production_planned === 0) {
    return "production_partial";
  }

  if (totals.production_partial > 0 || totals.production_certified > 0) {
    return "production_partial";
  }

  if (totals.production_planned + totals.production_unknown >= entries.length / 2) {
    return "production_planned";
  }

  return "production_unknown";
}

export type ReportProductionCertificationRuntimeInput = {
  layerRuntimeStatuses: ReportProductionLayerRuntimeStatuses;
  registryReports: Array<{
    name: string;
    reportKey: string;
    status: string;
  }>;
  runtimeCertificationByReportKey: Record<string, ReportRuntimeCertificationEntry | undefined>;
  selectedReportKey: string | null;
  superAdmin?: boolean;
};

function buildStatusBreakdown(
  entries: ReportProductionCertificationEntry[]
): ReportProductionCertificationStatusBreakdownItem[] {
  const counts: Record<ReportProductionCertificationStatus, number> = {
    production_blocked: 0,
    production_certified: 0,
    production_partial: 0,
    production_planned: 0,
    production_unsafe: 0,
    production_unknown: 0
  };

  for (const entry of entries) {
    counts[entry.productionCertificationStatus] += 1;
  }

  return (Object.keys(counts) as ReportProductionCertificationStatus[])
    .map((label) => ({ count: counts[label], label }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function resolveSnapshotStatus(entries: ReportProductionCertificationEntry[]): ReportProductionCertificationRuntimeState {
  if (entries.length === 0) {
    return "unavailable";
  }

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator[entry.productionCertificationStatus] += 1;
      return accumulator;
    },
    {
      production_blocked: 0,
      production_certified: 0,
      production_partial: 0,
      production_planned: 0,
      production_unsafe: 0,
      production_unknown: 0
    }
  );

  if (totals.production_unsafe + totals.production_blocked > 0) {
    return "degraded";
  }

  if (totals.production_planned + totals.production_unknown > entries.length / 2) {
    return "planned";
  }

  if (totals.production_certified === 0) {
    return "empty";
  }

  if (totals.production_partial + totals.production_planned + totals.production_unknown > entries.length / 2) {
    return "planned";
  }

  if (totals.production_certified === entries.length) {
    return "ready";
  }

  return "ready";
}

function resolveLoadingState(status: ReportProductionCertificationRuntimeState): ReportProductionCertificationLoadingState {
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

export function runReportProductionCertificationSnapshot(
  input: ReportProductionCertificationRuntimeInput
): ReportProductionCertificationSnapshot {
  const warnings: string[] = [];

  warnings.push("Report Production Certification is read-only on page load. No certification records are written.");
  warnings.push(
    "Production certification derives from RP-1 registry, RP-2 through RP-11 adapters, RP-12 through RP-25 runtime layers, and read-only resolver metadata only."
  );
  warnings.push(
    "No insert, update, delete, export execution, scheduled report execution, provider call, or AI provider call occurs during page load."
  );
  warnings.push("Sensitive values are masked before display.");

  const entries: ReportProductionCertificationEntry[] = input.registryReports.map((report) => {
    const runtimeEntry = input.runtimeCertificationByReportKey[report.reportKey];
    const pageLoadReadOnlyConfirmation =
      runtimeEntry?.pageLoadReadOnlyConfirmation ??
      (input.superAdmin !== false
        ? "Page load read-only confirmed; no database mutations, provider calls, or export execution on load."
        : "Page load read-only blocked until Super Admin access is confirmed.");
    const dataCertStatus = runtimeEntry
      ? parseDataCertStatus(runtimeEntry.dataCertificationIntegrationConfirmation)
      : null;
    const securityCertStatus = runtimeEntry
      ? parseSecurityCertStatus(runtimeEntry.securityCertificationIntegrationConfirmation)
      : null;
    const runtimeCertStatus = runtimeEntry?.runtimeCertificationStatus ?? "runtime_unknown";
    const { productionCertificationNotes, productionCertificationStatus } = resolveProductionCertificationStatus({
      dataCertStatus,
      pageLoadReadOnlyConfirmation,
      reportKey: report.reportKey,
      runtimeCertStatus,
      securityCertStatus,
      superAdmin: input.superAdmin !== false
    });

    return {
      aggregationProductionConfirmation: resolveAggregationProductionConfirmation(input.layerRuntimeStatuses),
      auditProductionConfirmation:
        runtimeEntry?.auditIntegrationConfirmation ??
        resolveLayerProductionConfirmation("RP-19 Report Audit", input.layerRuntimeStatuses.auditStatus, [
          "ready",
          "available"
        ]),
      dataCertificationProductionConfirmation:
        runtimeEntry?.dataCertificationIntegrationConfirmation ?? "RP-23 data certification integration is unavailable.",
      exportProductionConfirmation:
        runtimeEntry?.exportIntegrationConfirmation ?? "RP-21 export integration is unavailable for this report.",
      externalProviderCallPreventionConfirmation:
        resolveExternalProviderCallPreventionConfirmation(pageLoadReadOnlyConfirmation),
      filtersProductionConfirmation: resolveFiltersProductionConfirmation(input.layerRuntimeStatuses),
      pageLoadReadOnlyConfirmation,
      productionCertificationNotes,
      productionCertificationStatus,
      productionHelperText: resolveProductionHelperText(productionCertificationStatus),
      providerCallPreventionConfirmation: resolveProviderCallPreventionConfirmation(pageLoadReadOnlyConfirmation),
      readOnly: true,
      registryProductionConfirmation:
        runtimeEntry?.registryIntegrationConfirmation ?? "Registry integration planned.",
      reportKey: report.reportKey,
      reportTitle: safeText(report.name, report.reportKey),
      reviewProductionConfirmation:
        runtimeEntry?.reviewIntegrationConfirmation ??
        resolveLayerProductionConfirmation("RP-20 Report Review", input.layerRuntimeStatuses.reviewStatus, [
          "ready",
          "available"
        ]),
      runtimeCertificationProductionConfirmation: runtimeEntry
        ? `RP-25 runtime certification status: ${formatLabel(runtimeEntry.runtimeCertificationStatus)}.`
        : "RP-25 runtime certification integration is unavailable.",
      safeActionsProductionConfirmation:
        runtimeEntry?.safeActionsIntegrationConfirmation ??
        resolveLayerProductionConfirmation("RP-15 Safe Actions", input.layerRuntimeStatuses.safeActionsStatus, [
          "ready",
          "available"
        ]),
      scheduledReportsProductionConfirmation:
        runtimeEntry?.scheduledReportsIntegrationConfirmation ??
        resolveLayerProductionConfirmation(
          "RP-22 Scheduled Reports",
          input.layerRuntimeStatuses.scheduledReportsStatus,
          ["ready", "available"]
        ),
      searchProductionConfirmation: resolveSearchProductionConfirmation(input.layerRuntimeStatuses),
      securityCertificationProductionConfirmation:
        runtimeEntry?.securityCertificationIntegrationConfirmation ??
        "RP-24 security certification integration is unavailable.",
      sensitiveDataProtectionConfirmation: resolveSensitiveDataProtectionConfirmation(pageLoadReadOnlyConfirmation),
      statusProductionConfirmation:
        runtimeEntry?.statusIntegrationConfirmation ??
        resolveLayerProductionConfirmation("RP-13 Report Status", input.layerRuntimeStatuses.statusLayerStatus, [
          "ready",
          "available"
        ]),
      viewerProductionConfirmation:
        runtimeEntry?.viewerIntegrationConfirmation ??
        resolveLayerProductionConfirmation("RP-12 Report Viewer", input.layerRuntimeStatuses.viewerStatus, [
          "ready",
          "available"
        ]),
      visibilityProductionConfirmation:
        runtimeEntry?.visibilityIntegrationConfirmation ??
        resolveLayerProductionConfirmation("RP-14 Report Visibility", input.layerRuntimeStatuses.visibilityStatus, [
          "ready",
          "available"
        ])
    };
  });

  const totals: ReportProductionCertificationTotals = {
    productionBlockedReports: entries.filter((entry) => entry.productionCertificationStatus === "production_blocked")
      .length,
    productionCertifiedReports: entries.filter((entry) => entry.productionCertificationStatus === "production_certified")
      .length,
    productionPartialReports: entries.filter((entry) => entry.productionCertificationStatus === "production_partial")
      .length,
    productionPlannedReports: entries.filter((entry) => entry.productionCertificationStatus === "production_planned")
      .length,
    productionUnsafeReports: entries.filter((entry) => entry.productionCertificationStatus === "production_unsafe")
      .length,
    productionUnknownReports: entries.filter((entry) => entry.productionCertificationStatus === "production_unknown")
      .length
  };
  const status = resolveSnapshotStatus(entries);
  const loadingState = resolveLoadingState(status);
  const generatedAt = new Date().toISOString();
  const selectedReportProductionCertification =
    input.selectedReportKey != null
      ? entries.find((entry) => entry.reportKey === input.selectedReportKey) ?? null
      : null;
  const reportsRuntimeProductionStatus = resolveReportsRuntimeProductionStatus(entries);

  return {
    byStatus: buildStatusBreakdown(entries),
    entries,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${totals.productionCertifiedReports} production certified · ${totals.productionPartialReports} partial · Reports Runtime ${formatLabel(reportsRuntimeProductionStatus)}`,
    loadingState,
    readOnly: true,
    reportsRuntimeProductionStatus,
    selectedReportKey: input.selectedReportKey,
    selectedReportProductionCertification,
    source: REPORT_PRODUCTION_CERTIFICATION_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `Reports Runtime ${formatLabel(reportsRuntimeProductionStatus)}`,
      `${totals.productionCertifiedReports} production certified`,
      `${totals.productionPartialReports} partial`,
      `${totals.productionUnsafeReports} unsafe`
    ].join("; "),
    superAdminReportsOnly: true,
    totals,
    warnings
  };
}

export async function mapReportProductionCertificationRuntimeToAdminFields(
  input: ReportProductionCertificationRuntimeInput
) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      byStatus: [],
      entries: [],
      errorMessage: "Super Admin access is required for Report Production Certification runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Production Certification unavailable",
      loadingState: "error" as const,
      readOnly: true as const,
      reportsRuntimeProductionStatus: "production_blocked" as const,
      selectedReportKey: input.selectedReportKey,
      selectedReportProductionCertification: null,
      status: "unavailable" as const,
      summary: "Report Production Certification requires Super Admin access.",
      superAdminReportsOnly: true as const,
      totals: {
        productionBlockedReports: 0,
        productionCertifiedReports: 0,
        productionPartialReports: 0,
        productionPlannedReports: 0,
        productionUnsafeReports: 0,
        productionUnknownReports: 0
      },
      warnings: ["Super Admin access is required for Report Production Certification runtime."]
    };
  }

  const snapshot = runReportProductionCertificationSnapshot({ ...input, superAdmin: true });

  return {
    byStatus: snapshot.byStatus,
    entries: snapshot.entries,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    loadingState: snapshot.loadingState,
    readOnly: true as const,
    reportsRuntimeProductionStatus: snapshot.reportsRuntimeProductionStatus,
    selectedReportKey: snapshot.selectedReportKey,
    selectedReportProductionCertification: snapshot.selectedReportProductionCertification,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    totals: snapshot.totals,
    warnings: snapshot.warnings
  };
}

export function buildReportProductionCertificationRuntimeInput(input: {
  layerRuntimeStatuses: ReportProductionLayerRuntimeStatuses;
  registryReports: Array<{
    name: string;
    reportKey: string;
    status: string;
  }>;
  runtimeCertificationEntries: ReportRuntimeCertificationEntry[];
  selectedReportKey: string | null;
}) {
  const runtimeCertificationByReportKey = Object.fromEntries(
    input.runtimeCertificationEntries.map((entry) => [entry.reportKey, entry])
  );

  return {
    layerRuntimeStatuses: input.layerRuntimeStatuses,
    registryReports: input.registryReports,
    runtimeCertificationByReportKey,
    selectedReportKey: input.selectedReportKey
  } satisfies ReportProductionCertificationRuntimeInput;
}
