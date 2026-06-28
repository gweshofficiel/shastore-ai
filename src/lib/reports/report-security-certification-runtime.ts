import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { ReportDataCertificationStatus } from "@/src/lib/reports/report-data-certification-runtime";
import type { ReportExportAvailabilityState } from "@/src/lib/reports/report-export-runtime";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";

export type ReportSecurityCertificationSource = "report_security_certification_runtime";

export type ReportSecurityCertificationStatus =
  | "blocked"
  | "certified"
  | "partial"
  | "planned"
  | "unsafe"
  | "unknown";

export type ReportSecurityCertificationRuntimeState =
  | "degraded"
  | "empty"
  | "planned"
  | "ready"
  | "unavailable";

export type ReportSecurityCertificationLoadingState =
  | "degraded"
  | "empty"
  | "error"
  | "loaded"
  | "planned";

export type ReportSecurityDataCertificationRef = {
  certificationStatus: ReportDataCertificationStatus;
  readOnlyConfirmation: string;
  sensitiveDataMaskingConfirmation: string;
};

export type ReportSecuritySafeActionsRef = {
  actions: {
    certify: string;
    export: string;
    generate: string;
    review: string;
    schedule: string;
    view: string;
  };
  runtimeSafeAction: string;
};

export type ReportSecurityCertificationEntry = {
  accessControlConfirmation: string;
  aiProviderCallPrevention: string;
  externalProviderCallPrevention: string;
  mutationPrevention: string;
  ownershipIsolationConfirmation: string;
  pageLoadReadOnlyConfirmation: string;
  providerSecretMaskingConfirmation: string;
  readOnly: true;
  reportKey: string;
  reportTitle: string;
  rlsSafetyConfirmation: string;
  securityCertificationNotes: string;
  securityCertificationStatus: ReportSecurityCertificationStatus;
  sensitiveDataMaskingConfirmation: string;
  superAdminOnlyConfirmation: string;
};

export type ReportSecurityCertificationSelectedSummary = ReportSecurityCertificationEntry;

export type ReportSecurityCertificationStatusBreakdownItem = {
  count: number;
  label: ReportSecurityCertificationStatus;
};

export type ReportSecurityCertificationTotals = {
  blockedReports: number;
  certifiedReports: number;
  partialReports: number;
  plannedReports: number;
  unsafeReports: number;
  unknownReports: number;
};

export type ReportSecurityCertificationSnapshot = {
  byStatus: ReportSecurityCertificationStatusBreakdownItem[];
  entries: ReportSecurityCertificationEntry[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  loadingState: ReportSecurityCertificationLoadingState;
  readOnly: true;
  selectedReportKey: string | null;
  selectedReportSecurityCertification: ReportSecurityCertificationSelectedSummary | null;
  source: ReportSecurityCertificationSource;
  status: ReportSecurityCertificationRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  totals: ReportSecurityCertificationTotals;
  warnings: string[];
};

export const REPORT_SECURITY_CERTIFICATION_SOURCE = "report_security_certification_runtime" as const;

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
  "rp-23-report-data-certification"
]);

const FUTURE_CERTIFICATION_REPORT_KEYS = new Set([
  "rp-25-report-runtime-certification",
  "rp-26-report-production-certification"
]);

const MUTATION_ENABLED_ACTIONS = new Set([
  "action_enabled",
  "certify_enabled",
  "export_enabled",
  "generate_enabled",
  "review_enabled",
  "schedule_enabled"
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

export function reportSecurityCertificationBadgeTone(
  status: ReportSecurityCertificationStatus
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

export function reportSecurityCertificationStatusLabel(status: ReportSecurityCertificationStatus) {
  return formatLabel(status);
}

function resolveAccessControlConfirmation(input: {
  registryVisibility: string;
  runtimeVisibility: string;
  superAdmin: boolean;
}) {
  if (!input.superAdmin) {
    return "Access control blocked until Super Admin access is confirmed.";
  }

  if (input.registryVisibility === "owner" || input.registryVisibility === "hidden") {
    return "Access control restricted; report is not exposed to Super Admin reporting scope.";
  }

  if (input.runtimeVisibility === "owner_visible" || input.runtimeVisibility === "restricted") {
    return "Access control partial; runtime visibility requires Super Admin review.";
  }

  return "Access control confirmed; Reporting Center remains Super Admin scoped.";
}

function resolveSuperAdminOnlyConfirmation(input: {
  registryVisibility: string;
  runtimeVisibility: string;
  superAdmin: boolean;
}) {
  if (!input.superAdmin) {
    return "Super Admin only access is not confirmed for this session.";
  }

  if (
    input.registryVisibility === "super_admin" &&
    (input.runtimeVisibility === "super_admin_only" || input.runtimeVisibility === "internal")
  ) {
    return "Super Admin only access confirmed for registry and runtime visibility.";
  }

  if (input.registryVisibility === "internal") {
    return "Super Admin only access confirmed; registry visibility is internal.";
  }

  return "Super Admin only access is partial or unverified for this report.";
}

function resolveRlsSafetyConfirmation(superAdmin: boolean) {
  return superAdmin
    ? "RLS safety confirmed; no RLS policy changes and no bypass on page load."
    : "RLS safety blocked until Super Admin access is confirmed.";
}

function resolveOwnershipIsolationConfirmation(superAdmin: boolean) {
  return superAdmin
    ? "Ownership isolation confirmed; no ownership changes or bypass on page load."
    : "Ownership isolation blocked until Super Admin access is confirmed.";
}

function resolveSensitiveDataMaskingConfirmation(
  superAdmin: boolean,
  dataCertRef?: ReportSecurityDataCertificationRef
) {
  if (!superAdmin) {
    return "Sensitive data masking blocked until Super Admin access is confirmed.";
  }

  return (
    dataCertRef?.sensitiveDataMaskingConfirmation ??
    "Sensitive data masking confirmed via safe diagnostics before display."
  );
}

function resolveProviderSecretMaskingConfirmation(superAdmin: boolean) {
  return superAdmin
    ? "Provider secrets, API keys, tokens, and webhook signatures are masked before display."
    : "Provider secret masking blocked until Super Admin access is confirmed.";
}

function resolvePageLoadReadOnlyConfirmation(
  superAdmin: boolean,
  dataCertRef?: ReportSecurityDataCertificationRef
) {
  if (!superAdmin) {
    return "Page load read-only confirmation blocked until Super Admin access is confirmed.";
  }

  return (
    dataCertRef?.readOnlyConfirmation ??
    "Page load read-only confirmed; no inserts, updates, deletes, or provider calls on page load."
  );
}

function resolveExternalProviderCallPrevention(reportKey: string, superAdmin: boolean) {
  if (!superAdmin) {
    return "External provider call prevention blocked until Super Admin access is confirmed.";
  }

  if (MODULE_REPORT_KEYS.has(reportKey)) {
    return "External provider call prevention confirmed; adapters use approved read-only admin data sources only.";
  }

  return "External provider call prevention confirmed; platform runtimes derive in-memory metadata only on page load.";
}

function resolveAiProviderCallPrevention(reportKey: string, superAdmin: boolean) {
  if (!superAdmin) {
    return "AI provider call prevention blocked until Super Admin access is confirmed.";
  }

  if (reportKey === "rp-7-ai-reports") {
    return "AI provider call prevention confirmed; AI report adapter reads usage metadata only on page load.";
  }

  return "AI provider call prevention confirmed; no AI provider calls on page load.";
}

function resolveMutationPrevention(safeActionsRef?: ReportSecuritySafeActionsRef) {
  if (!safeActionsRef) {
    return "Mutation prevention planned; safe action guards unavailable.";
  }

  const mutatingValues = [
    safeActionsRef.runtimeSafeAction,
    safeActionsRef.actions.certify,
    safeActionsRef.actions.export,
    safeActionsRef.actions.generate,
    safeActionsRef.actions.review,
    safeActionsRef.actions.schedule
  ];

  if (mutatingValues.some((value) => MUTATION_ENABLED_ACTIONS.has(value))) {
    return "Mutation prevention failed; unsafe mutating actions are exposed.";
  }

  return "Mutation prevention confirmed; generate, schedule, certify, review, and export actions remain disabled on page load.";
}

function hasUnsafeMutations(safeActionsRef?: ReportSecuritySafeActionsRef) {
  if (!safeActionsRef) {
    return false;
  }

  return [
    safeActionsRef.runtimeSafeAction,
    safeActionsRef.actions.certify,
    safeActionsRef.actions.export,
    safeActionsRef.actions.generate,
    safeActionsRef.actions.review,
    safeActionsRef.actions.schedule
  ].some((value) => MUTATION_ENABLED_ACTIONS.has(value));
}

function resolveSecurityCertificationStatus(input: {
  adapterLoadingState: "degraded" | "empty" | "error" | "loaded" | "planned" | undefined;
  dataCertRef?: ReportSecurityDataCertificationRef;
  exportAvailabilityState?: ReportExportAvailabilityState;
  pageLoadReadOnlyConfirmation: string;
  registryStatus: string;
  registryVisibility: string;
  reportKey: string;
  runtimeStatus: ReportRuntimeStatus;
  runtimeVisibility: string;
  safeActionsRef?: ReportSecuritySafeActionsRef;
  superAdmin: boolean;
  superAdminOnlyConfirmation: string;
}): { securityCertificationNotes: string; securityCertificationStatus: ReportSecurityCertificationStatus } {
  const notes: string[] = [];

  if (!input.superAdmin) {
    notes.push("Super Admin access is required for security certification.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "blocked" };
  }

  if (hasUnsafeMutations(input.safeActionsRef)) {
    notes.push("Unsafe mutating actions detected; security certification blocked.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "unsafe" };
  }

  if (input.dataCertRef?.certificationStatus === "unsafe") {
    notes.push("Data certification is unsafe; security certification is blocked.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "unsafe" };
  }

  if (input.dataCertRef?.certificationStatus === "blocked") {
    notes.push("Data certification is blocked; security certification is blocked.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "blocked" };
  }

  if (
    input.registryVisibility === "owner" ||
    input.runtimeVisibility === "owner_visible" ||
    input.runtimeVisibility === "restricted"
  ) {
    notes.push("Report visibility is not Super Admin scoped.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "blocked" };
  }

  if (FUTURE_CERTIFICATION_REPORT_KEYS.has(input.reportKey)) {
    notes.push("Future security certification phase; protections remain planned.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "planned" };
  }

  if (input.reportKey === "rp-24-report-security-certification") {
    notes.push("RP-24 security certification resolver is live as read-only metadata; no security records are written.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "partial" };
  }

  if (input.runtimeStatus === "error" || input.adapterLoadingState === "error") {
    notes.push("Runtime adapter error detected; security fallback requires review.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "unsafe" };
  }

  if (input.pageLoadReadOnlyConfirmation.includes("blocked")) {
    notes.push("Page load read-only requirements are not satisfied.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "blocked" };
  }

  if (input.superAdminOnlyConfirmation.includes("partial") || input.superAdminOnlyConfirmation.includes("not confirmed")) {
    notes.push("Super Admin only access is not fully confirmed.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "partial" };
  }

  if (
    input.reportKey === "rp-22-scheduled-reports" ||
    input.reportKey === "rp-23-report-data-certification"
  ) {
    notes.push("Security foundation layer is read-only; downstream execution backends remain planned.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "partial" };
  }

  if (MODULE_REPORT_KEYS.has(input.reportKey)) {
    if (
      input.adapterLoadingState === "loaded" &&
      input.dataCertRef?.certificationStatus === "certified" &&
      input.superAdminOnlyConfirmation.includes("confirmed")
    ) {
      notes.push("Module adapter security certified for Super Admin read-only access with masking and mutation prevention.");
      return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "certified" };
    }

    if (
      input.adapterLoadingState === "degraded" ||
      input.adapterLoadingState === "empty" ||
      input.dataCertRef?.certificationStatus === "partial"
    ) {
      notes.push("Module adapter security is partial; degraded runtime or data certification signals remain.");
      return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "partial" };
    }

    if (input.registryStatus === "planned" || input.adapterLoadingState === "planned") {
      notes.push("Module adapter security certification remains planned.");
      return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "planned" };
    }

    notes.push("Module adapter security certification is incomplete.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "partial" };
  }

  if (PLATFORM_RUNTIME_REPORT_KEYS.has(input.reportKey)) {
    if (input.registryStatus === "ready") {
      notes.push("Platform runtime security certified for Super Admin read-only metadata with access control and masking.");
      return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "certified" };
    }

    notes.push("Platform runtime security certification is partial.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "partial" };
  }

  if (input.registryStatus === "planned" || input.runtimeStatus === "planned") {
    notes.push("Security certification remains planned.");
    return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "planned" };
  }

  notes.push("Security certification status could not be determined from available runtime signals.");
  return { securityCertificationNotes: notes.join(" "), securityCertificationStatus: "unknown" };
}

export type ReportSecurityCertificationRuntimeInput = {
  adapterStatesByReportKey: Record<
    string,
    { loadingState: "degraded" | "empty" | "error" | "loaded" | "planned" } | undefined
  >;
  dataCertificationByReportKey: Record<string, ReportSecurityDataCertificationRef | undefined>;
  exportEntriesByReportKey: Record<string, { exportAvailabilityState: ReportExportAvailabilityState } | undefined>;
  registryReports: Array<{
    name: string;
    registryVisibility: string;
    reportKey: string;
    runtimeSafeAction: string;
    runtimeSafeActions: ReportSecuritySafeActionsRef["actions"];
    runtimeStatus: ReportRuntimeStatus;
    runtimeVisibility: string;
    status: string;
  }>;
  selectedReportKey: string | null;
  superAdmin: boolean;
};

function buildStatusBreakdown(
  entries: ReportSecurityCertificationEntry[]
): ReportSecurityCertificationStatusBreakdownItem[] {
  const counts: Record<ReportSecurityCertificationStatus, number> = {
    blocked: 0,
    certified: 0,
    partial: 0,
    planned: 0,
    unsafe: 0,
    unknown: 0
  };

  for (const entry of entries) {
    counts[entry.securityCertificationStatus] += 1;
  }

  return (Object.keys(counts) as ReportSecurityCertificationStatus[])
    .map((label) => ({ count: counts[label], label }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function resolveSnapshotStatus(entries: ReportSecurityCertificationEntry[]): ReportSecurityCertificationRuntimeState {
  if (entries.length === 0) {
    return "unavailable";
  }

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator[entry.securityCertificationStatus] += 1;
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

function resolveLoadingState(status: ReportSecurityCertificationRuntimeState): ReportSecurityCertificationLoadingState {
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

export function runReportSecurityCertificationSnapshot(
  input: ReportSecurityCertificationRuntimeInput
): ReportSecurityCertificationSnapshot {
  const warnings: string[] = [];

  warnings.push("Report Security Certification is read-only on page load. No security records are written.");
  warnings.push(
    "Security certification derives from registry, visibility, safe actions, data certification, and runtime resolver outputs only."
  );
  warnings.push("Sensitive values are masked before display.");

  const entries: ReportSecurityCertificationEntry[] = input.registryReports.map((report) => {
    const dataCertRef = input.dataCertificationByReportKey[report.reportKey];
    const adapterState = input.adapterStatesByReportKey[report.reportKey];
    const safeActionsRef: ReportSecuritySafeActionsRef = {
      actions: report.runtimeSafeActions,
      runtimeSafeAction: report.runtimeSafeAction
    };
    const accessControlConfirmation = resolveAccessControlConfirmation({
      registryVisibility: report.registryVisibility,
      runtimeVisibility: report.runtimeVisibility,
      superAdmin: input.superAdmin
    });
    const superAdminOnlyConfirmation = resolveSuperAdminOnlyConfirmation({
      registryVisibility: report.registryVisibility,
      runtimeVisibility: report.runtimeVisibility,
      superAdmin: input.superAdmin
    });
    const pageLoadReadOnlyConfirmation = resolvePageLoadReadOnlyConfirmation(input.superAdmin, dataCertRef);
    const { securityCertificationNotes, securityCertificationStatus } = resolveSecurityCertificationStatus({
      adapterLoadingState: adapterState?.loadingState,
      dataCertRef,
      exportAvailabilityState: input.exportEntriesByReportKey[report.reportKey]?.exportAvailabilityState,
      pageLoadReadOnlyConfirmation,
      registryStatus: report.status,
      registryVisibility: report.registryVisibility,
      reportKey: report.reportKey,
      runtimeStatus: report.runtimeStatus,
      runtimeVisibility: report.runtimeVisibility,
      safeActionsRef,
      superAdmin: input.superAdmin,
      superAdminOnlyConfirmation
    });

    return {
      accessControlConfirmation,
      aiProviderCallPrevention: resolveAiProviderCallPrevention(report.reportKey, input.superAdmin),
      externalProviderCallPrevention: resolveExternalProviderCallPrevention(report.reportKey, input.superAdmin),
      mutationPrevention: resolveMutationPrevention(safeActionsRef),
      ownershipIsolationConfirmation: resolveOwnershipIsolationConfirmation(input.superAdmin),
      pageLoadReadOnlyConfirmation,
      providerSecretMaskingConfirmation: resolveProviderSecretMaskingConfirmation(input.superAdmin),
      readOnly: true,
      reportKey: report.reportKey,
      reportTitle: safeText(report.name, report.reportKey),
      rlsSafetyConfirmation: resolveRlsSafetyConfirmation(input.superAdmin),
      securityCertificationNotes,
      securityCertificationStatus,
      sensitiveDataMaskingConfirmation: resolveSensitiveDataMaskingConfirmation(input.superAdmin, dataCertRef),
      superAdminOnlyConfirmation
    };
  });

  const totals: ReportSecurityCertificationTotals = {
    blockedReports: entries.filter((entry) => entry.securityCertificationStatus === "blocked").length,
    certifiedReports: entries.filter((entry) => entry.securityCertificationStatus === "certified").length,
    partialReports: entries.filter((entry) => entry.securityCertificationStatus === "partial").length,
    plannedReports: entries.filter((entry) => entry.securityCertificationStatus === "planned").length,
    unsafeReports: entries.filter((entry) => entry.securityCertificationStatus === "unsafe").length,
    unknownReports: entries.filter((entry) => entry.securityCertificationStatus === "unknown").length
  };
  const status = resolveSnapshotStatus(entries);
  const loadingState = resolveLoadingState(status);
  const generatedAt = new Date().toISOString();
  const selectedReportSecurityCertification =
    input.selectedReportKey != null
      ? entries.find((entry) => entry.reportKey === input.selectedReportKey) ?? null
      : null;

  return {
    byStatus: buildStatusBreakdown(entries),
    entries,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${totals.certifiedReports} security certified · ${totals.partialReports} partial`,
    loadingState,
    readOnly: true,
    selectedReportKey: input.selectedReportKey,
    selectedReportSecurityCertification,
    source: REPORT_SECURITY_CERTIFICATION_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${totals.certifiedReports} security certified`,
      `${totals.partialReports} partial`,
      `${totals.plannedReports} planned`,
      `${totals.unsafeReports} unsafe`
    ].join("; "),
    superAdminReportsOnly: true,
    totals,
    warnings
  };
}

export async function mapReportSecurityCertificationRuntimeToAdminFields(
  input: ReportSecurityCertificationRuntimeInput
) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      byStatus: [],
      entries: [],
      errorMessage: "Super Admin access is required for Report Security Certification runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Security Certification unavailable",
      loadingState: "error" as const,
      readOnly: true as const,
      selectedReportKey: input.selectedReportKey,
      selectedReportSecurityCertification: null,
      status: "unavailable" as const,
      summary: "Report Security Certification requires Super Admin access.",
      superAdminReportsOnly: true as const,
      totals: {
        blockedReports: 0,
        certifiedReports: 0,
        partialReports: 0,
        plannedReports: 0,
        unsafeReports: 0,
        unknownReports: 0
      },
      warnings: ["Super Admin access is required for Report Security Certification runtime."]
    };
  }

  const snapshot = runReportSecurityCertificationSnapshot({ ...input, superAdmin: true });

  return {
    byStatus: snapshot.byStatus,
    entries: snapshot.entries,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    loadingState: snapshot.loadingState,
    readOnly: true as const,
    selectedReportKey: snapshot.selectedReportKey,
    selectedReportSecurityCertification: snapshot.selectedReportSecurityCertification,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    totals: snapshot.totals,
    warnings: snapshot.warnings
  };
}

export function buildReportSecurityCertificationRuntimeInput(input: {
  adapterStatesByReportKey: ReportSecurityCertificationRuntimeInput["adapterStatesByReportKey"];
  dataCertificationEntries: Array<{
    certificationStatus: ReportDataCertificationStatus;
    readOnlyConfirmation: string;
    reportKey: string;
    sensitiveDataMaskingConfirmation: string;
  }>;
  exportEntries: Array<{
    exportAvailabilityState: ReportExportAvailabilityState;
    reportKey: string;
  }>;
  registryReports: Array<{
    name: string;
    registryVisibility: string;
    reportKey: string;
    runtimeSafeAction: string;
    runtimeSafeActions: ReportSecuritySafeActionsRef["actions"];
    runtimeStatus: ReportRuntimeStatus;
    runtimeVisibility: string;
    status: string;
  }>;
  selectedReportKey: string | null;
}): ReportSecurityCertificationRuntimeInput {
  const dataCertificationByReportKey: Record<string, ReportSecurityDataCertificationRef | undefined> = {};
  const exportEntriesByReportKey: Record<
    string,
    { exportAvailabilityState: ReportExportAvailabilityState } | undefined
  > = {};

  for (const entry of input.dataCertificationEntries) {
    dataCertificationByReportKey[entry.reportKey] = {
      certificationStatus: entry.certificationStatus,
      readOnlyConfirmation: entry.readOnlyConfirmation,
      sensitiveDataMaskingConfirmation: entry.sensitiveDataMaskingConfirmation
    };
  }

  for (const entry of input.exportEntries) {
    exportEntriesByReportKey[entry.reportKey] = {
      exportAvailabilityState: entry.exportAvailabilityState
    };
  }

  return {
    adapterStatesByReportKey: input.adapterStatesByReportKey,
    dataCertificationByReportKey,
    exportEntriesByReportKey,
    registryReports: input.registryReports,
    selectedReportKey: input.selectedReportKey,
    superAdmin: false
  };
}
