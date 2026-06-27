import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import {
  getReportRegistryEntry,
  type ReportsRegistryRuntimeContext
} from "@/src/lib/reports/reports-registry-runtime";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";

export type ReportVisibilitySource = "report_visibility_runtime";

export type ReportRuntimeVisibility =
  | "disabled"
  | "hidden"
  | "internal"
  | "planned"
  | "restricted"
  | "super_admin_only";

export type ReportVisibilityBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type ReportVisibilityRuntimeState = "needs_attention" | "ready" | "unavailable";

export type ReportVisibilityEntry = {
  badgeTone: ReportVisibilityBadgeTone;
  description: string;
  readOnly: true;
  registryVisibility: string;
  reportKey: string;
  roadmapPhase: string;
  runtimeVisibility: ReportRuntimeVisibility;
  superAdminOnly: true;
  title: string;
};

export type ReportVisibilitySnapshot = {
  countsByVisibility: Record<ReportRuntimeVisibility, number>;
  entries: ReportVisibilityEntry[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  readOnly: true;
  source: ReportVisibilitySource;
  status: ReportVisibilityRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  visibilityByReportKey: Record<string, ReportVisibilityEntry>;
  warnings: string[];
};

export const REPORT_VISIBILITY_SOURCE = "report_visibility_runtime" as const;

export const REPORT_RUNTIME_VISIBILITIES: readonly ReportRuntimeVisibility[] = [
  "super_admin_only",
  "internal",
  "restricted",
  "hidden",
  "planned",
  "disabled"
] as const;

type RegistryReportSnapshot = {
  certificationState: string;
  name: string;
  registryVisibility: string;
  reportKey: string;
  roadmapPhase: string;
  status: string;
};

export type ReportVisibilityRuntimeInput = {
  registryReports: RegistryReportSnapshot[];
  statusByReportKey: Record<string, { runtimeStatus: ReportRuntimeStatus } | undefined>;
};

function emptyCounts(): Record<ReportRuntimeVisibility, number> {
  return {
    disabled: 0,
    hidden: 0,
    internal: 0,
    planned: 0,
    restricted: 0,
    super_admin_only: 0
  };
}

export function normalizeReportRuntimeVisibility(value: unknown): ReportRuntimeVisibility {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if ((REPORT_RUNTIME_VISIBILITIES as readonly string[]).includes(normalized)) {
    return normalized as ReportRuntimeVisibility;
  }

  return "super_admin_only";
}

export function reportRuntimeVisibilityLabel(visibility: ReportRuntimeVisibility | string) {
  return normalizeReportRuntimeVisibility(visibility).replace(/_/g, " ");
}

export function reportRuntimeVisibilityDescription(visibility: ReportRuntimeVisibility | string) {
  switch (normalizeReportRuntimeVisibility(visibility)) {
    case "super_admin_only":
      return "Visible only to Super Admin in the Reporting Center. No broader role exposure is applied.";
    case "internal":
      return "Internal Super Admin reporting visibility with read-only registry metadata.";
    case "restricted":
      return "Internal report visibility with review or degraded runtime signals. Super Admin access only.";
    case "hidden":
      return "Hidden from standard registry surfacing. Super Admin read-only metadata remains available.";
    case "planned":
      return "Visibility is planned and not yet assigned to a live runtime surface.";
    case "disabled":
      return "Report visibility is disabled while registry metadata remains read-only.";
    default:
      return "Unknown visibility mapped to Super Admin only as a safe fallback.";
  }
}

export function reportRuntimeVisibilityBadgeTone(
  visibility: ReportRuntimeVisibility | string
): ReportVisibilityBadgeTone {
  switch (normalizeReportRuntimeVisibility(visibility)) {
    case "super_admin_only":
      return "blue";
    case "internal":
      return "green";
    case "restricted":
      return "amber";
    case "hidden":
    case "disabled":
      return "slate";
    case "planned":
      return "red";
    default:
      return "blue";
  }
}

function reportPhaseNumber(reportKey: string) {
  return Number.parseInt(reportKey.match(/^rp-(\d+)/)?.[1] ?? "0", 10);
}

function isRestrictedRuntimeStatus(runtimeStatus?: ReportRuntimeStatus) {
  return runtimeStatus === "degraded" || runtimeStatus === "partial" || runtimeStatus === "error";
}

export function resolveReportRuntimeVisibility(input: {
  certificationState: string;
  registryStatus: string;
  registryVisibility: string;
  reportKey: string;
  runtimeStatus?: ReportRuntimeStatus;
}): ReportRuntimeVisibility {
  const registryStatus = input.registryStatus.toLowerCase();
  const registryVisibility = input.registryVisibility.toLowerCase();
  const certificationState = input.certificationState.toLowerCase();

  if (registryStatus === "inactive") {
    return "disabled";
  }

  if (registryVisibility === "hidden") {
    return "hidden";
  }

  if (
    registryStatus === "planned" ||
    registryStatus === "placeholder" ||
    certificationState === "planned" ||
    (reportPhaseNumber(input.reportKey) >= 15 && input.reportKey !== "rp-14-report-visibility")
  ) {
    return "planned";
  }

  if (registryVisibility === "super_admin" || input.reportKey === "rp-14-report-visibility") {
    return "super_admin_only";
  }

  if (registryVisibility === "internal") {
    if (registryStatus === "review" || isRestrictedRuntimeStatus(input.runtimeStatus)) {
      return "restricted";
    }

    return "internal";
  }

  return "super_admin_only";
}

function buildVisibilityEntry(
  report: RegistryReportSnapshot,
  input: ReportVisibilityRuntimeInput
): ReportVisibilityEntry {
  const runtimeStatus = input.statusByReportKey[report.reportKey]?.runtimeStatus;
  const runtimeVisibility = resolveReportRuntimeVisibility({
    certificationState: report.certificationState,
    registryStatus: report.status,
    registryVisibility: report.registryVisibility,
    reportKey: report.reportKey,
    runtimeStatus
  });

  return {
    badgeTone: reportRuntimeVisibilityBadgeTone(runtimeVisibility),
    description: reportRuntimeVisibilityDescription(runtimeVisibility),
    readOnly: true,
    registryVisibility: report.registryVisibility,
    reportKey: report.reportKey,
    roadmapPhase: report.roadmapPhase,
    runtimeVisibility,
    superAdminOnly: true,
    title: report.name
  };
}

export function runReportVisibilitySnapshot(input: ReportVisibilityRuntimeInput): ReportVisibilitySnapshot {
  const warnings: string[] = [];
  const entries = input.registryReports.map((report) => buildVisibilityEntry(report, input));
  const visibilityByReportKey = Object.fromEntries(entries.map((entry) => [entry.reportKey, entry]));
  const countsByVisibility = emptyCounts();

  for (const entry of entries) {
    countsByVisibility[entry.runtimeVisibility] += 1;
  }

  const restrictedCount = countsByVisibility.restricted + countsByVisibility.hidden + countsByVisibility.disabled;
  const status: ReportVisibilityRuntimeState =
    entries.length === 0 ? "unavailable" : restrictedCount > 0 ? "needs_attention" : "ready";

  if (countsByVisibility.planned > 0) {
    warnings.push(`${countsByVisibility.planned} report entries remain in planned visibility.`);
  }

  warnings.push("Reporting Center remains Super Admin only on page load.");

  const generatedAt = new Date().toISOString();

  return {
    countsByVisibility,
    entries,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${entries.length} report visibility values resolved`,
    readOnly: true,
    source: REPORT_VISIBILITY_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${entries.length} reports`,
      `${countsByVisibility.super_admin_only + countsByVisibility.internal} visible`,
      `${restrictedCount} restricted or limited`
    ].join("; "),
    superAdminReportsOnly: true,
    visibilityByReportKey,
    warnings
  };
}

export function getReportRuntimeVisibilityEntry(
  snapshot: Pick<ReportVisibilitySnapshot, "visibilityByReportKey">,
  reportKey: string
): ReportVisibilityEntry {
  return (
    snapshot.visibilityByReportKey[reportKey] ?? {
      badgeTone: reportRuntimeVisibilityBadgeTone("super_admin_only"),
      description: reportRuntimeVisibilityDescription("super_admin_only"),
      readOnly: true,
      registryVisibility: "super_admin",
      reportKey,
      roadmapPhase: "Unknown",
      runtimeVisibility: "super_admin_only",
      superAdminOnly: true,
      title: "Unknown report"
    }
  );
}

export async function mapReportVisibilityRuntimeToAdminFields(input: ReportVisibilityRuntimeInput) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      countsByVisibility: emptyCounts(),
      entries: [],
      errorMessage: "Super Admin access is required for Report Visibility runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Visibility unavailable",
      readOnly: true as const,
      status: "unavailable" as const,
      summary: "Report Visibility requires Super Admin access.",
      superAdminReportsOnly: true as const,
      visibilityByReportKey: {},
      warnings: ["Super Admin access is required for Report Visibility runtime."]
    };
  }

  const snapshot = runReportVisibilitySnapshot(input);

  return {
    countsByVisibility: snapshot.countsByVisibility,
    entries: snapshot.entries,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    readOnly: true as const,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    visibilityByReportKey: snapshot.visibilityByReportKey,
    warnings: snapshot.warnings
  };
}

export function buildReportVisibilityRuntimeInput(input: {
  registryContext: ReportsRegistryRuntimeContext;
  registryReports: Array<{
    certificationState: string;
    name: string;
    reportKey: string;
    roadmapPhase: string;
    status: string;
  }>;
  statusByReportKey: Record<string, { runtimeStatus: ReportRuntimeStatus } | undefined>;
}): ReportVisibilityRuntimeInput {
  return {
    registryReports: input.registryReports.map((report) => ({
      certificationState: report.certificationState,
      name: report.name,
      registryVisibility: getReportRegistryEntry(report.reportKey, input.registryContext)?.visibility ?? "super_admin",
      reportKey: report.reportKey,
      roadmapPhase: report.roadmapPhase,
      status: report.status
    })),
    statusByReportKey: input.statusByReportKey
  };
}

export function withReportRuntimeVisibilityFields<T extends Record<string, unknown>>(
  module: T,
  reportKey: string,
  visibilityByReportKey: Record<string, ReportVisibilityEntry>
) {
  const visibilityEntry = getReportRuntimeVisibilityEntry({ visibilityByReportKey }, reportKey);

  return {
    ...module,
    runtimeVisibility: visibilityEntry.runtimeVisibility,
    runtimeVisibilityDescription: visibilityEntry.description
  };
}
