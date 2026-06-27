import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import {
  getReportRegistryEntry,
  type ReportsRegistryRuntimeContext
} from "@/src/lib/reports/reports-registry-runtime";
import type { ReportRuntimeStatus } from "@/src/lib/reports/report-status-runtime";
import type { ReportRuntimeVisibility } from "@/src/lib/reports/report-visibility-runtime";
import { VIEWABLE_REPORT_KEYS } from "@/src/lib/reports/report-viewer-runtime";

export type ReportSafeActionsSource = "report_safe_actions_runtime";

export type ReportRuntimeSafeAction =
  | "action_locked"
  | "certify_disabled"
  | "export_disabled"
  | "generate_disabled"
  | "planned_action"
  | "review_disabled"
  | "schedule_disabled"
  | "view_disabled"
  | "view_enabled";

export type ReportSafeActionBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type ReportSafeActionsRuntimeState = "needs_attention" | "ready" | "unavailable";

export type ReportSafeActionAvailability = {
  certify: ReportRuntimeSafeAction;
  export: ReportRuntimeSafeAction;
  generate: ReportRuntimeSafeAction;
  review: ReportRuntimeSafeAction;
  schedule: ReportRuntimeSafeAction;
  view: ReportRuntimeSafeAction;
};

export type ReportSafeActionsEntry = {
  actions: ReportSafeActionAvailability;
  badgeTone: ReportSafeActionBadgeTone;
  description: string;
  readOnly: true;
  registrySafeActionsAvailability: string;
  reportKey: string;
  roadmapPhase: string;
  runtimeSafeAction: ReportRuntimeSafeAction;
  superAdminOnly: true;
  title: string;
  viewEnabled: boolean;
};

export type ReportSafeActionsSnapshot = {
  actionsByReportKey: Record<string, ReportSafeActionsEntry>;
  countsBySafeAction: Record<ReportRuntimeSafeAction, number>;
  entries: ReportSafeActionsEntry[];
  errorMessage: string | null;
  generatedAt: string;
  lastGeneratedState: string;
  readOnly: true;
  source: ReportSafeActionsSource;
  status: ReportSafeActionsRuntimeState;
  summary: string;
  superAdminReportsOnly: true;
  warnings: string[];
};

export const REPORT_SAFE_ACTIONS_SOURCE = "report_safe_actions_runtime" as const;

export const REPORT_RUNTIME_SAFE_ACTIONS: readonly ReportRuntimeSafeAction[] = [
  "view_enabled",
  "view_disabled",
  "export_disabled",
  "generate_disabled",
  "schedule_disabled",
  "review_disabled",
  "certify_disabled",
  "action_locked",
  "planned_action"
] as const;

const LOCKED_MUTATING_ACTIONS = {
  certify: "certify_disabled" as const,
  export: "export_disabled" as const,
  generate: "generate_disabled" as const,
  review: "review_disabled" as const,
  schedule: "schedule_disabled" as const
};

type RegistryReportSnapshot = {
  name: string;
  reportKey: string;
  roadmapPhase: string;
  safeActionsAvailability: string;
  status: string;
};

export type ReportSafeActionsRuntimeInput = {
  registryReports: RegistryReportSnapshot[];
  statusByReportKey: Record<string, { runtimeStatus: ReportRuntimeStatus } | undefined>;
  visibilityByReportKey: Record<string, { runtimeVisibility: ReportRuntimeVisibility } | undefined>;
  viewerStateByReportKey: Record<string, string | undefined>;
};

function emptyCounts(): Record<ReportRuntimeSafeAction, number> {
  return {
    action_locked: 0,
    certify_disabled: 0,
    export_disabled: 0,
    generate_disabled: 0,
    planned_action: 0,
    review_disabled: 0,
    schedule_disabled: 0,
    view_disabled: 0,
    view_enabled: 0
  };
}

export function normalizeReportRuntimeSafeAction(value: unknown): ReportRuntimeSafeAction {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if ((REPORT_RUNTIME_SAFE_ACTIONS as readonly string[]).includes(normalized)) {
    return normalized as ReportRuntimeSafeAction;
  }

  return "action_locked";
}

export function reportRuntimeSafeActionLabel(action: ReportRuntimeSafeAction | string) {
  return normalizeReportRuntimeSafeAction(action).replace(/_/g, " ");
}

export function reportRuntimeSafeActionDescription(action: ReportRuntimeSafeAction | string) {
  switch (normalizeReportRuntimeSafeAction(action)) {
    case "view_enabled":
      return "Read-only viewer navigation is enabled for this report. No mutating actions are available.";
    case "view_disabled":
      return "Viewer navigation is disabled while registry metadata remains read-only.";
    case "export_disabled":
      return "Export remains disabled in this runtime phase.";
    case "generate_disabled":
      return "Report generation remains disabled in this runtime phase.";
    case "schedule_disabled":
      return "Scheduled reports remain disabled in this runtime phase.";
    case "review_disabled":
      return "Review actions remain disabled in this runtime phase.";
    case "certify_disabled":
      return "Certification mutations remain disabled in this runtime phase.";
    case "action_locked":
      return "All report actions are locked. Super Admin read-only metadata remains available.";
    case "planned_action":
      return "Actions are planned and remain disabled until a safe runtime surface is certified.";
    default:
      return "Unknown action state mapped to locked as a safe fallback.";
  }
}

export function reportRuntimeSafeActionBadgeTone(action: ReportRuntimeSafeAction | string): ReportSafeActionBadgeTone {
  switch (normalizeReportRuntimeSafeAction(action)) {
    case "view_enabled":
      return "green";
    case "view_disabled":
      return "slate";
    case "export_disabled":
    case "generate_disabled":
    case "schedule_disabled":
    case "review_disabled":
    case "certify_disabled":
      return "amber";
    case "planned_action":
      return "blue";
    case "action_locked":
      return "red";
    default:
      return "slate";
  }
}

function isViewableReportKey(reportKey: string) {
  return VIEWABLE_REPORT_KEYS.includes(reportKey as (typeof VIEWABLE_REPORT_KEYS)[number]);
}

function isRestrictedVisibility(runtimeVisibility?: ReportRuntimeVisibility) {
  return runtimeVisibility === "hidden" || runtimeVisibility === "disabled";
}

function isLockedRuntimeStatus(runtimeStatus?: ReportRuntimeStatus) {
  return runtimeStatus === "inactive" || runtimeStatus === "error";
}

function resolveViewAction(input: {
  registrySafeActionsAvailability: string;
  registryStatus: string;
  reportKey: string;
  runtimeStatus?: ReportRuntimeStatus;
  runtimeVisibility?: ReportRuntimeVisibility;
  viewerState?: string;
}): ReportRuntimeSafeAction {
  const registryStatus = input.registryStatus.toLowerCase();

  if (registryStatus === "inactive") {
    return "view_disabled";
  }

  if (isRestrictedVisibility(input.runtimeVisibility)) {
    return "view_disabled";
  }

  if (!isViewableReportKey(input.reportKey)) {
    return "view_disabled";
  }

  if (input.viewerState === "planned" || input.viewerState === "not_found" || input.viewerState === "error") {
    return "view_disabled";
  }

  if (input.viewerState === "available" || input.viewerState === "empty") {
    return "view_enabled";
  }

  if (registryStatus === "planned" || registryStatus === "placeholder") {
    return "view_disabled";
  }

  if (input.runtimeVisibility === "planned") {
    return "view_disabled";
  }

  if (isLockedRuntimeStatus(input.runtimeStatus)) {
    return "view_disabled";
  }

  if (input.registrySafeActionsAvailability === "available") {
    return "view_enabled";
  }

  if (input.registrySafeActionsAvailability === "placeholder") {
    return "view_disabled";
  }

  return "view_disabled";
}

function resolvePrimarySafeAction(input: {
  actions: ReportSafeActionAvailability;
  registrySafeActionsAvailability: string;
  registryStatus: string;
  runtimeVisibility?: ReportRuntimeVisibility;
}): ReportRuntimeSafeAction {
  const registryStatus = input.registryStatus.toLowerCase();

  if (
    registryStatus === "planned" ||
    registryStatus === "placeholder" ||
    input.registrySafeActionsAvailability === "placeholder" ||
    input.runtimeVisibility === "planned"
  ) {
    return "planned_action";
  }

  if (registryStatus === "inactive" || isRestrictedVisibility(input.runtimeVisibility)) {
    return "action_locked";
  }

  if (input.actions.view === "view_enabled") {
    return "view_enabled";
  }

  return "view_disabled";
}

function buildSafeActionsEntry(
  report: RegistryReportSnapshot,
  input: ReportSafeActionsRuntimeInput
): ReportSafeActionsEntry {
  const runtimeStatus = input.statusByReportKey[report.reportKey]?.runtimeStatus;
  const runtimeVisibility = input.visibilityByReportKey[report.reportKey]?.runtimeVisibility;
  const viewerState = input.viewerStateByReportKey[report.reportKey];
  const viewAction = resolveViewAction({
    registrySafeActionsAvailability: report.safeActionsAvailability,
    registryStatus: report.status,
    reportKey: report.reportKey,
    runtimeStatus,
    runtimeVisibility,
    viewerState
  });
  const actions: ReportSafeActionAvailability = {
    ...LOCKED_MUTATING_ACTIONS,
    view: viewAction
  };
  const runtimeSafeAction = resolvePrimarySafeAction({
    actions,
    registrySafeActionsAvailability: report.safeActionsAvailability,
    registryStatus: report.status,
    runtimeVisibility
  });

  return {
    actions,
    badgeTone: reportRuntimeSafeActionBadgeTone(runtimeSafeAction),
    description: reportRuntimeSafeActionDescription(runtimeSafeAction),
    readOnly: true,
    registrySafeActionsAvailability: report.safeActionsAvailability,
    reportKey: report.reportKey,
    roadmapPhase: report.roadmapPhase,
    runtimeSafeAction,
    superAdminOnly: true,
    title: report.name,
    viewEnabled: viewAction === "view_enabled"
  };
}

export function runReportSafeActionsSnapshot(input: ReportSafeActionsRuntimeInput): ReportSafeActionsSnapshot {
  const warnings: string[] = [];
  const entries = input.registryReports.map((report) => buildSafeActionsEntry(report, input));
  const actionsByReportKey = Object.fromEntries(entries.map((entry) => [entry.reportKey, entry]));
  const countsBySafeAction = emptyCounts();

  for (const entry of entries) {
    countsBySafeAction[entry.runtimeSafeAction] += 1;
  }

  const lockedCount = countsBySafeAction.action_locked + countsBySafeAction.planned_action;
  const status: ReportSafeActionsRuntimeState =
    entries.length === 0 ? "unavailable" : lockedCount > 0 ? "needs_attention" : "ready";

  warnings.push("Export, generate, schedule, review, and certify actions remain disabled on page load.");
  warnings.push("Reporting Center remains Super Admin only on page load.");

  if (countsBySafeAction.view_enabled > 0) {
    warnings.push(`${countsBySafeAction.view_enabled} reports allow read-only viewer navigation only.`);
  }

  const generatedAt = new Date().toISOString();

  return {
    actionsByReportKey,
    countsBySafeAction,
    entries,
    errorMessage: null,
    generatedAt,
    lastGeneratedState: `Generated ${generatedAt} · ${entries.length} safe action guards resolved`,
    readOnly: true,
    source: REPORT_SAFE_ACTIONS_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${entries.length} reports`,
      `${countsBySafeAction.view_enabled} view enabled`,
      `${lockedCount} locked or planned`
    ].join("; "),
    superAdminReportsOnly: true,
    warnings
  };
}

export function getReportRuntimeSafeActionsEntry(
  snapshot: Pick<ReportSafeActionsSnapshot, "actionsByReportKey">,
  reportKey: string
): ReportSafeActionsEntry {
  return (
    snapshot.actionsByReportKey[reportKey] ?? {
      actions: {
        ...LOCKED_MUTATING_ACTIONS,
        view: "view_disabled"
      },
      badgeTone: reportRuntimeSafeActionBadgeTone("action_locked"),
      description: reportRuntimeSafeActionDescription("action_locked"),
      readOnly: true,
      registrySafeActionsAvailability: "unavailable",
      reportKey,
      roadmapPhase: "Unknown",
      runtimeSafeAction: "action_locked",
      superAdminOnly: true,
      title: "Unknown report",
      viewEnabled: false
    }
  );
}

export async function mapReportSafeActionsRuntimeToAdminFields(input: ReportSafeActionsRuntimeInput) {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return {
      actionsByReportKey: {},
      countsBySafeAction: emptyCounts(),
      entries: [],
      errorMessage: "Super Admin access is required for Report Safe Actions runtime.",
      generatedAt: new Date().toISOString(),
      lastGeneratedState: "Report Safe Actions unavailable",
      readOnly: true as const,
      status: "unavailable" as const,
      summary: "Report Safe Actions requires Super Admin access.",
      superAdminReportsOnly: true as const,
      warnings: ["Super Admin access is required for Report Safe Actions runtime."]
    };
  }

  const snapshot = runReportSafeActionsSnapshot(input);

  return {
    actionsByReportKey: snapshot.actionsByReportKey,
    countsBySafeAction: snapshot.countsBySafeAction,
    entries: snapshot.entries,
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: snapshot.lastGeneratedState,
    readOnly: true as const,
    status: snapshot.status,
    summary: snapshot.summary,
    superAdminReportsOnly: true as const,
    warnings: snapshot.warnings
  };
}

export function buildReportSafeActionsRuntimeInput(input: {
  registryContext: ReportsRegistryRuntimeContext;
  registryReports: Array<{
    name: string;
    reportKey: string;
    roadmapPhase: string;
    status: string;
  }>;
  statusByReportKey: Record<string, { runtimeStatus: ReportRuntimeStatus } | undefined>;
  visibilityByReportKey: Record<string, { runtimeVisibility: ReportRuntimeVisibility } | undefined>;
  viewerStateByReportKey: Record<string, string | undefined>;
}): ReportSafeActionsRuntimeInput {
  return {
    registryReports: input.registryReports.map((report) => ({
      name: report.name,
      reportKey: report.reportKey,
      roadmapPhase: report.roadmapPhase,
      safeActionsAvailability:
        getReportRegistryEntry(report.reportKey, input.registryContext)?.safeActionsAvailability ?? "unavailable",
      status: report.status
    })),
    statusByReportKey: input.statusByReportKey,
    visibilityByReportKey: input.visibilityByReportKey,
    viewerStateByReportKey: input.viewerStateByReportKey
  };
}

export function withReportRuntimeSafeActionsFields<T extends Record<string, unknown>>(
  module: T,
  reportKey: string,
  actionsByReportKey: Record<string, ReportSafeActionsEntry>
) {
  const safeActionsEntry = getReportRuntimeSafeActionsEntry({ actionsByReportKey }, reportKey);

  return {
    ...module,
    runtimeSafeAction: safeActionsEntry.runtimeSafeAction,
    runtimeSafeActionDescription: safeActionsEntry.description,
    runtimeSafeActions: safeActionsEntry.actions,
    viewEnabled: safeActionsEntry.viewEnabled
  };
}
