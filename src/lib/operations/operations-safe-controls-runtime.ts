import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsSafeControlsRuntimeSource = "operations_safe_controls_runtime";

export type OperationsSafeControlsGroupKey =
  | "backup-controls"
  | "cron-controls"
  | "database-controls"
  | "diagnostics-controls"
  | "disaster-recovery-controls"
  | "future-controls"
  | "monitoring-controls"
  | "queue-controls"
  | "storage-controls"
  | "worker-controls";

export type OperationsSafeControlType =
  | "auto_fix"
  | "create_backup"
  | "delete"
  | "export_report"
  | "failover"
  | "pause"
  | "purge"
  | "refresh_health"
  | "repair"
  | "restart"
  | "restore"
  | "resume"
  | "retry"
  | "rollback"
  | "run_diagnostics"
  | "start"
  | "stop"
  | "trigger_now";

export type OperationsSafeControlRiskLevel = "critical" | "high" | "low" | "medium";

export type OperationsSafeControlExecutionStatus =
  | "disabled"
  | "no_execution_available"
  | "read_only"
  | "requires_future_certification";

export type OperationsSafeControlsRuntimeStatus = "disabled" | "future_hook" | "registered" | "review_required";

export type OperationsSafeControlsReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsSafeControlsRuntimeItem = {
  controlKey: string;
  controlName: string;
  controlType: OperationsSafeControlType;
  disabledReason: string;
  enabled: false;
  executionStatus: OperationsSafeControlExecutionStatus;
  groupKey: OperationsSafeControlsGroupKey;
  metadataDetected: boolean;
  permissionScope: string;
  requiresAudit: boolean;
  requiresConfirmation: boolean;
  requiresReview: boolean;
  reviewStatus: OperationsSafeControlsReviewStatus;
  riskLevel: OperationsSafeControlRiskLevel;
  runtimeStatus: OperationsSafeControlsRuntimeStatus;
  targetRuntime: string;
  visibility: OperationsRegistryVisibility;
};

export type OperationsSafeControlsRuntimeGroup = {
  groupKey: OperationsSafeControlsGroupKey;
  controlCount: number;
  controls: OperationsSafeControlsRuntimeItem[];
  title: string;
};

export type OperationsSafeControlsRuntimeSummary = {
  disabledControls: number;
  groupCount: number;
  readOnly: true;
  registeredControls: number;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsSafeControlsRuntimeSource;
  status: "needs_attention" | "safe_controls_runtime_ready";
  summary: string;
  totalControls: number;
};

type AnyRecord = Record<string, unknown>;

type SafeControlDefinition = {
  controlKey: string;
  controlName: string;
  controlType: OperationsSafeControlType;
  groupKey: OperationsSafeControlsGroupKey;
  registryKey: string;
  requiresAudit: boolean;
  requiresConfirmation: boolean;
  requiresReview: boolean;
  riskLevel: OperationsSafeControlRiskLevel;
  targetRuntime: string;
};

export const OPERATIONS_SAFE_CONTROLS_RUNTIME_SOURCE = "operations_safe_controls_runtime" as const;

export const OPERATIONS_SAFE_CONTROL_DISABLED_REASON =
  "No execution available in OP-18; requires future certification." as const;

const SAFE_CONTROLS_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsSafeControlsGroupKey;
  title: string;
}> = [
  { groupKey: "queue-controls", title: "Queue Controls" },
  { groupKey: "worker-controls", title: "Worker Controls" },
  { groupKey: "cron-controls", title: "Cron Controls" },
  { groupKey: "storage-controls", title: "Storage Controls" },
  { groupKey: "database-controls", title: "Database Controls" },
  { groupKey: "backup-controls", title: "Backup Controls" },
  { groupKey: "disaster-recovery-controls", title: "Disaster Recovery Controls" },
  { groupKey: "diagnostics-controls", title: "Diagnostics Controls" },
  { groupKey: "monitoring-controls", title: "Monitoring Controls" },
  { groupKey: "future-controls", title: "Future Controls" }
];

const SAFE_CONTROL_TABLE_CANDIDATES = [
  "platform_safe_controls",
  "operations_safe_controls",
  "safe_control_registry",
  "control_registry_items"
] as const;

const SAFE_CONTROL_DEFINITIONS: readonly SafeControlDefinition[] = [
  {
    controlKey: "op-safe-control-queue-retry",
    controlName: "Retry",
    controlType: "retry",
    groupKey: "queue-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "high",
    targetRuntime: "operations_queue_runtime"
  },
  {
    controlKey: "op-safe-control-queue-pause",
    controlName: "Pause",
    controlType: "pause",
    groupKey: "queue-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: false,
    riskLevel: "medium",
    targetRuntime: "operations_queue_runtime"
  },
  {
    controlKey: "op-safe-control-queue-resume",
    controlName: "Resume",
    controlType: "resume",
    groupKey: "queue-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: false,
    riskLevel: "medium",
    targetRuntime: "operations_queue_runtime"
  },
  {
    controlKey: "op-safe-control-queue-purge",
    controlName: "Purge",
    controlType: "purge",
    groupKey: "queue-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "critical",
    targetRuntime: "operations_queue_runtime"
  },
  {
    controlKey: "op-safe-control-worker-start",
    controlName: "Start",
    controlType: "start",
    groupKey: "worker-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: false,
    riskLevel: "medium",
    targetRuntime: "operations_worker_runtime"
  },
  {
    controlKey: "op-safe-control-worker-stop",
    controlName: "Stop",
    controlType: "stop",
    groupKey: "worker-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "high",
    targetRuntime: "operations_worker_runtime"
  },
  {
    controlKey: "op-safe-control-worker-restart",
    controlName: "Restart",
    controlType: "restart",
    groupKey: "worker-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "high",
    targetRuntime: "operations_worker_runtime"
  },
  {
    controlKey: "op-safe-control-worker-retry",
    controlName: "Retry",
    controlType: "retry",
    groupKey: "worker-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "high",
    targetRuntime: "operations_worker_monitoring_runtime"
  },
  {
    controlKey: "op-safe-control-cron-trigger-now",
    controlName: "Trigger Now",
    controlType: "trigger_now",
    groupKey: "cron-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "high",
    targetRuntime: "operations_cron_runtime"
  },
  {
    controlKey: "op-safe-control-cron-pause",
    controlName: "Pause",
    controlType: "pause",
    groupKey: "cron-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: false,
    riskLevel: "medium",
    targetRuntime: "operations_cron_runtime"
  },
  {
    controlKey: "op-safe-control-cron-resume",
    controlName: "Resume",
    controlType: "resume",
    groupKey: "cron-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: false,
    riskLevel: "medium",
    targetRuntime: "operations_cron_runtime"
  },
  {
    controlKey: "op-safe-control-storage-refresh-health",
    controlName: "Refresh Health",
    controlType: "refresh_health",
    groupKey: "storage-controls",
    registryKey: "op-safe-controls",
    requiresAudit: false,
    requiresConfirmation: false,
    requiresReview: false,
    riskLevel: "low",
    targetRuntime: "operations_storage_runtime"
  },
  {
    controlKey: "op-safe-control-storage-repair",
    controlName: "Repair",
    controlType: "repair",
    groupKey: "storage-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "critical",
    targetRuntime: "operations_storage_runtime"
  },
  {
    controlKey: "op-safe-control-storage-delete",
    controlName: "Delete",
    controlType: "delete",
    groupKey: "storage-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "critical",
    targetRuntime: "operations_storage_metrics_runtime"
  },
  {
    controlKey: "op-safe-control-storage-export-report",
    controlName: "Export Report",
    controlType: "export_report",
    groupKey: "storage-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: false,
    requiresReview: false,
    riskLevel: "low",
    targetRuntime: "operations_storage_metrics_runtime"
  },
  {
    controlKey: "op-safe-control-database-repair",
    controlName: "Repair",
    controlType: "repair",
    groupKey: "database-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "critical",
    targetRuntime: "operations_database_runtime"
  },
  {
    controlKey: "op-safe-control-database-export-report",
    controlName: "Export Report",
    controlType: "export_report",
    groupKey: "database-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: false,
    requiresReview: false,
    riskLevel: "low",
    targetRuntime: "operations_database_runtime"
  },
  {
    controlKey: "op-safe-control-backup-create",
    controlName: "Create Backup",
    controlType: "create_backup",
    groupKey: "backup-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "high",
    targetRuntime: "operations_backup_runtime"
  },
  {
    controlKey: "op-safe-control-backup-restore",
    controlName: "Restore",
    controlType: "restore",
    groupKey: "backup-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "critical",
    targetRuntime: "operations_backup_runtime"
  },
  {
    controlKey: "op-safe-control-backup-delete",
    controlName: "Delete",
    controlType: "delete",
    groupKey: "backup-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "critical",
    targetRuntime: "operations_backup_runtime"
  },
  {
    controlKey: "op-safe-control-backup-export-report",
    controlName: "Export Report",
    controlType: "export_report",
    groupKey: "backup-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: false,
    requiresReview: false,
    riskLevel: "low",
    targetRuntime: "operations_backup_runtime"
  },
  {
    controlKey: "op-safe-control-dr-restore",
    controlName: "Restore",
    controlType: "restore",
    groupKey: "disaster-recovery-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "critical",
    targetRuntime: "operations_disaster_recovery_runtime"
  },
  {
    controlKey: "op-safe-control-dr-failover",
    controlName: "Failover",
    controlType: "failover",
    groupKey: "disaster-recovery-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "critical",
    targetRuntime: "operations_disaster_recovery_runtime"
  },
  {
    controlKey: "op-safe-control-dr-rollback",
    controlName: "Rollback",
    controlType: "rollback",
    groupKey: "disaster-recovery-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "critical",
    targetRuntime: "operations_disaster_recovery_runtime"
  },
  {
    controlKey: "op-safe-control-dr-export-report",
    controlName: "Export Report",
    controlType: "export_report",
    groupKey: "disaster-recovery-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: false,
    requiresReview: false,
    riskLevel: "low",
    targetRuntime: "operations_disaster_recovery_runtime"
  },
  {
    controlKey: "op-safe-control-diagnostics-run",
    controlName: "Run Diagnostics",
    controlType: "run_diagnostics",
    groupKey: "diagnostics-controls",
    registryKey: "op-safe-controls",
    requiresAudit: false,
    requiresConfirmation: false,
    requiresReview: false,
    riskLevel: "low",
    targetRuntime: "operations_diagnostics_runtime"
  },
  {
    controlKey: "op-safe-control-diagnostics-repair",
    controlName: "Repair",
    controlType: "repair",
    groupKey: "diagnostics-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "high",
    targetRuntime: "operations_diagnostics_runtime"
  },
  {
    controlKey: "op-safe-control-diagnostics-auto-fix",
    controlName: "Auto Fix",
    controlType: "auto_fix",
    groupKey: "diagnostics-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: true,
    requiresReview: true,
    riskLevel: "critical",
    targetRuntime: "operations_diagnostics_runtime"
  },
  {
    controlKey: "op-safe-control-diagnostics-export-report",
    controlName: "Export Report",
    controlType: "export_report",
    groupKey: "diagnostics-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: false,
    requiresReview: false,
    riskLevel: "low",
    targetRuntime: "operations_diagnostics_runtime"
  },
  {
    controlKey: "op-safe-control-monitoring-export-report",
    controlName: "Export Report",
    controlType: "export_report",
    groupKey: "monitoring-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: false,
    requiresReview: false,
    riskLevel: "low",
    targetRuntime: "operations_monitoring_events_runtime"
  },
  {
    controlKey: "op-safe-control-global-export-report",
    controlName: "Export Report",
    controlType: "export_report",
    groupKey: "monitoring-controls",
    registryKey: "op-safe-controls",
    requiresAudit: true,
    requiresConfirmation: false,
    requiresReview: false,
    riskLevel: "low",
    targetRuntime: "operations_safe_controls_runtime"
  }
] as const;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asRecords(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as AnyRecord[]) : [];
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const message = text(error.message).toLowerCase();
  return error.code === "42P01" || message.includes("does not exist") || message.includes("could not find the table");
}

function resolvePermissionScope(registryKey: string) {
  const registryEntry = getOperationsRegistryEntry(registryKey);
  return registryEntry?.permissions.join(", ") ?? "super_admin:read";
}

function resolveReviewStatus(metadataDetected: boolean): OperationsSafeControlsReviewStatus {
  return metadataDetected ? "clear" : "not_applicable";
}

function resolveExecutionStatus(): OperationsSafeControlExecutionStatus {
  return "no_execution_available";
}

function buildSafeControlRuntimeItem(
  definition: SafeControlDefinition,
  metadataDetected: boolean
): OperationsSafeControlsRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(definition.registryKey);

  return {
    controlKey: definition.controlKey,
    controlName: definition.controlName,
    controlType: definition.controlType,
    disabledReason: OPERATIONS_SAFE_CONTROL_DISABLED_REASON,
    enabled: false,
    executionStatus: resolveExecutionStatus(),
    groupKey: definition.groupKey,
    metadataDetected,
    permissionScope: resolvePermissionScope(definition.registryKey),
    requiresAudit: definition.requiresAudit,
    requiresConfirmation: definition.requiresConfirmation,
    requiresReview: definition.requiresReview,
    reviewStatus: resolveReviewStatus(metadataDetected),
    riskLevel: definition.riskLevel,
    runtimeStatus: metadataDetected ? "disabled" : "registered",
    targetRuntime: definition.targetRuntime,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildFutureControlItems(metadataDetected: boolean): OperationsSafeControlsRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /retry|restart|purge|delete|restore|backup|cron|worker|queue|control/i.test(hook))
    .map((hook, index) => ({
      controlKey: `op-future-safe-control-${index + 1}`,
      controlName: hook,
      controlType: "export_report" as const,
      disabledReason: OPERATIONS_SAFE_CONTROL_DISABLED_REASON,
      enabled: false as const,
      executionStatus: "requires_future_certification" as const,
      groupKey: "future-controls" as const,
      metadataDetected: Boolean(registryEntry),
      permissionScope: "super_admin:read",
      requiresAudit: true,
      requiresConfirmation: true,
      requiresReview: true,
      reviewStatus: "not_applicable" as const,
      riskLevel: "high" as const,
      runtimeStatus: "future_hook" as const,
      targetRuntime: "operations_registry_runtime",
      visibility: registryEntry?.visibility ?? "super_admin"
    }));
}

async function safeMetadataSelect(
  supabase: SupabaseClient<Database>,
  table: string,
  columns: string,
  limit: number
): Promise<{ rows: AnyRecord[]; tableDetected: boolean }> {
  try {
    const { data, error } = await supabase.from(table as never).select(columns).limit(limit);

    if (error) {
      if (isMissingTableError(error)) {
        return { rows: [], tableDetected: false };
      }

      console.warn(`[operations-safe-controls-runtime] read-only control registry select failed for ${table}`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-safe-controls-runtime] read-only control registry select crashed for ${table}`, error);
    return { rows: [], tableDetected: false };
  }
}

async function detectDedicatedSafeControlsTable(supabase: SupabaseClient<Database>) {
  for (const tableName of SAFE_CONTROL_TABLE_CANDIDATES) {
    const result = await safeMetadataSelect(
      supabase,
      tableName,
      "id, control_key, control_name, control_type, target_runtime, execution_status, created_at",
      1
    );

    if (result.tableDetected) {
      return {
        tableDetected: true,
        tableName
      };
    }
  }

  return {
    tableDetected: false,
    tableName: null as string | null
  };
}

export function operationsSafeControlsRuntimeStatusLabel(status: OperationsSafeControlsRuntimeStatus) {
  switch (status) {
    case "disabled":
      return "Disabled";
    case "future_hook":
      return "Future Hook";
    case "registered":
      return "Registered";
    case "review_required":
      return "Review Required";
  }
}

export function operationsSafeControlsRuntimeStatusBadgeTone(status: OperationsSafeControlsRuntimeStatus) {
  switch (status) {
    case "disabled":
    case "registered":
      return "slate" as const;
    case "review_required":
      return "amber" as const;
    case "future_hook":
      return "blue" as const;
  }
}

export function operationsSafeControlExecutionStatusLabel(status: OperationsSafeControlExecutionStatus) {
  switch (status) {
    case "disabled":
      return "Disabled";
    case "no_execution_available":
      return "No execution available in OP-18";
    case "read_only":
      return "Read-only";
    case "requires_future_certification":
      return "Requires future certification";
  }
}

export function operationsSafeControlRiskLevelTone(riskLevel: OperationsSafeControlRiskLevel) {
  switch (riskLevel) {
    case "critical":
      return "red" as const;
    case "high":
      return "amber" as const;
    case "medium":
      return "blue" as const;
    case "low":
      return "green" as const;
  }
}

export function getSafeControlRiskLevel(definitionKey: string): OperationsSafeControlRiskLevel {
  const definition = SAFE_CONTROL_DEFINITIONS.find((item) => item.controlKey === definitionKey);
  return definition?.riskLevel ?? "medium";
}

export function buildOperationsSafeControlsRuntimeGroups(
  controls: OperationsSafeControlsRuntimeItem[]
): OperationsSafeControlsRuntimeGroup[] {
  return SAFE_CONTROLS_GROUP_DEFINITIONS.map((group) => {
    const groupControls = controls.filter((control) => control.groupKey === group.groupKey);

    return {
      controlCount: groupControls.length,
      controls: groupControls,
      groupKey: group.groupKey,
      title: group.title
    };
  }).filter((group) => group.controlCount > 0);
}

export function getOperationsSafeControlsRuntimeSummary(
  controls: OperationsSafeControlsRuntimeItem[]
): OperationsSafeControlsRuntimeSummary {
  const operationalControls = controls.filter((control) => control.groupKey !== "future-controls");
  const disabledControls = controls.filter((control) => control.runtimeStatus === "disabled" || control.enabled === false).length;
  const registeredControls = operationalControls.filter((control) => control.metadataDetected).length;
  const status = registeredControls === operationalControls.length ? ("safe_controls_runtime_ready" as const) : ("needs_attention" as const);

  return {
    disabledControls,
    groupCount: buildOperationsSafeControlsRuntimeGroups(controls).length,
    readOnly: true,
    registeredControls,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_SAFE_CONTROLS_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${controls.length} registered controls`,
      `${disabledControls} disabled`,
      `${registeredControls} metadata ready`,
      "no execution available in OP-18"
    ].join("; "),
    totalControls: controls.length
  };
}

export async function loadOperationsSafeControlsRuntimeReadOnlySafe(params: {
  supabase: SupabaseClient<Database>;
}) {
  const dedicatedControlsTable = await detectDedicatedSafeControlsTable(params.supabase);
  const registryEntry = getOperationsRegistryEntry("op-safe-controls");
  const metadataDetected = Boolean(registryEntry || dedicatedControlsTable.tableDetected);
  const controlItems = [
    ...SAFE_CONTROL_DEFINITIONS.map((definition) => buildSafeControlRuntimeItem(definition, metadataDetected)),
    ...buildFutureControlItems(metadataDetected)
  ];
  const groups = buildOperationsSafeControlsRuntimeGroups(controlItems);
  const summary = getOperationsSafeControlsRuntimeSummary(controlItems);

  return {
    controlItems,
    groups,
    safeControlsRuntime: summary
  };
}

export function mapOperationsSafeControlsRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsSafeControlsRuntimeReadOnlySafe>>
) {
  return {
    controlItems: input.controlItems,
    groups: input.groups,
    safeControlsRuntime: input.safeControlsRuntime
  };
}
