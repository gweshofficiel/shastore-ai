import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsDisasterRecoveryRuntimeSource = "operations_disaster_recovery_runtime";

export type OperationsDisasterRecoveryGroupKey =
  | "configuration-recovery"
  | "database-recovery"
  | "email-asset-recovery"
  | "future-recovery-hooks"
  | "marketplace-asset-recovery"
  | "platform-recovery"
  | "reports-recovery"
  | "storage-recovery";

export type OperationsDisasterRecoveryProvider =
  | "cloudflare_r2"
  | "future_hook"
  | "operations_registry"
  | "supabase";

export type OperationsDisasterRecoveryRuntimeStatus =
  | "available"
  | "disabled"
  | "empty"
  | "failed"
  | "future_hook"
  | "no_metadata_detected"
  | "registered"
  | "review_required"
  | "warning";

export type OperationsDisasterRecoveryStatus = "available" | "empty" | "failed" | "unknown" | "warning";

export type OperationsDisasterRecoveryReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsDisasterRecoverySafeControlKey =
  | "export_report"
  | "failover"
  | "restore"
  | "rollback"
  | "run_recovery_test"
  | "verify_recovery_plan";

export type OperationsDisasterRecoverySafeControl = {
  enabled: false;
  key: OperationsDisasterRecoverySafeControlKey;
  label: string;
  note: string;
};

export type OperationsDisasterRecoveryRuntimeItem = {
  backupDependencyLabel: string;
  errorCount: number;
  groupKey: OperationsDisasterRecoveryGroupKey;
  lastFailureAt: string | null;
  lastRecoveryTestAt: string | null;
  lastSuccessfulRecoveryAt: string | null;
  metadataDetected: boolean;
  metadataSource: string | null;
  provider: OperationsDisasterRecoveryProvider;
  recoveryKey: string;
  recoveryName: string;
  recoveryPointObjectiveLabel: string;
  recoveryScope: string;
  recoveryStatus: OperationsDisasterRecoveryStatus;
  recoveryTimeObjectiveLabel: string;
  recoveryType: string;
  reviewStatus: OperationsDisasterRecoveryReviewStatus;
  runtimeStatus: OperationsDisasterRecoveryRuntimeStatus;
  safeControls: OperationsDisasterRecoverySafeControl[];
  visibility: OperationsRegistryVisibility;
  warningCount: number;
};

export type OperationsDisasterRecoveryRuntimeGroup = {
  groupKey: OperationsDisasterRecoveryGroupKey;
  itemCount: number;
  items: OperationsDisasterRecoveryRuntimeItem[];
  title: string;
};

export type OperationsDisasterRecoveryRuntimeSummary = {
  availableRecoveries: number;
  failedRecoveries: number;
  groupCount: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsDisasterRecoveryRuntimeSource;
  status: "disaster_recovery_runtime_ready" | "needs_attention";
  summary: string;
  totalRecoveries: number;
  warningRecoveries: number;
};

type AnyRecord = Record<string, unknown>;

type DisasterRecoveryDefinition = {
  backupDependencyLabel: string;
  groupKey: OperationsDisasterRecoveryGroupKey;
  matchesMonitoringEvent: (eventType: string, entityType: string) => boolean;
  matchesRecoveryRecord: (recoveryType: string, recoveryKey: string) => boolean;
  metadataColumns: string | null;
  metadataSource: string | null;
  metadataTable: string | null;
  provider: OperationsDisasterRecoveryProvider;
  recoveryKey: string;
  recoveryName: string;
  recoveryPointObjectiveLabel: string;
  recoveryScope: string;
  recoveryTimeObjectiveLabel: string;
  recoveryType: string;
  registryKey: string;
};

type RecoveryAggregate = {
  lastFailureAt: string | null;
  lastRecoveryTestAt: string | null;
  lastSuccessfulRecoveryAt: string | null;
  recoveryEventCount: number;
};

export const OPERATIONS_DISASTER_RECOVERY_RUNTIME_SOURCE = "operations_disaster_recovery_runtime" as const;

export const OPERATIONS_DISASTER_RECOVERY_SAFE_CONTROLS: readonly OperationsDisasterRecoverySafeControl[] = [
  {
    enabled: false,
    key: "run_recovery_test",
    label: "Run Recovery Test",
    note: "Read-only placeholder. No recovery drill or recovery test runs during OP-16 page load."
  },
  {
    enabled: false,
    key: "restore",
    label: "Restore",
    note: "Read-only placeholder. No restore execution runs during OP-16 page load."
  },
  {
    enabled: false,
    key: "failover",
    label: "Failover",
    note: "Read-only placeholder. No failover execution runs during OP-16 page load."
  },
  {
    enabled: false,
    key: "rollback",
    label: "Rollback",
    note: "Read-only placeholder. No rollback execution runs during OP-16 page load."
  },
  {
    enabled: false,
    key: "verify_recovery_plan",
    label: "Verify Recovery Plan",
    note: "Read-only placeholder. No recovery plan verification runs during OP-16 page load."
  },
  {
    enabled: false,
    key: "export_report",
    label: "Export Report",
    note: "Read-only placeholder. No disaster recovery export or diagnostics run during OP-16 page load."
  }
] as const;

const DISASTER_RECOVERY_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsDisasterRecoveryGroupKey;
  title: string;
}> = [
  { groupKey: "database-recovery", title: "Database Recovery" },
  { groupKey: "storage-recovery", title: "Storage Recovery" },
  { groupKey: "reports-recovery", title: "Reports Recovery" },
  { groupKey: "marketplace-asset-recovery", title: "Marketplace Asset Recovery" },
  { groupKey: "email-asset-recovery", title: "Email Asset Recovery" },
  { groupKey: "configuration-recovery", title: "Configuration Recovery" },
  { groupKey: "platform-recovery", title: "Platform Recovery" },
  { groupKey: "future-recovery-hooks", title: "Future Recovery Hooks" }
];

const DISASTER_RECOVERY_TABLE_CANDIDATES = [
  "platform_disaster_recovery",
  "disaster_recovery_records",
  "recovery_records",
  "recovery_events",
  "dr_runbooks"
] as const;

const DISASTER_RECOVERY_DEFINITIONS: readonly DisasterRecoveryDefinition[] = [
  {
    backupDependencyLabel: "Database backup runtime dependency",
    groupKey: "database-recovery",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesRecoveryPattern(eventType, entityType, /database.?recover|pg.?recover|supabase.?recover|schema.?recover|restore.?test/i),
    matchesRecoveryRecord: (recoveryType, recoveryKey) =>
      /database|postgres|supabase|pg/i.test(`${recoveryType} ${recoveryKey}`),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    provider: "supabase",
    recoveryKey: "op-recovery-database",
    recoveryName: "Database recovery",
    recoveryPointObjectiveLabel: "Provider managed RPO",
    recoveryScope: "Primary database cluster",
    recoveryTimeObjectiveLabel: "Provider managed RTO",
    recoveryType: "database_recovery",
    registryKey: "op-disaster-recovery"
  },
  {
    backupDependencyLabel: "Storage backup runtime dependency",
    groupKey: "storage-recovery",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesRecoveryPattern(eventType, entityType, /storage.?recover|bucket.?recover|r2.?recover|object.?recover/i),
    matchesRecoveryRecord: (recoveryType, recoveryKey) =>
      /storage|bucket|r2|object/i.test(`${recoveryType} ${recoveryKey}`),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    provider: "cloudflare_r2",
    recoveryKey: "op-recovery-storage",
    recoveryName: "Storage recovery",
    recoveryPointObjectiveLabel: "Storage RPO not connected",
    recoveryScope: "Managed object storage",
    recoveryTimeObjectiveLabel: "Storage RTO not connected",
    recoveryType: "storage_recovery",
    registryKey: "op-disaster-recovery"
  },
  {
    backupDependencyLabel: "Reports backup runtime dependency",
    groupKey: "reports-recovery",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesRecoveryPattern(eventType, entityType, /report.?recover|export.?recover|analytics.?recover/i),
    matchesRecoveryRecord: (recoveryType, recoveryKey) =>
      /report|export|analytics/i.test(`${recoveryType} ${recoveryKey}`),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    provider: "operations_registry",
    recoveryKey: "op-recovery-reports",
    recoveryName: "Reports recovery",
    recoveryPointObjectiveLabel: "Report RPO not connected",
    recoveryScope: "Report export archives",
    recoveryTimeObjectiveLabel: "Report RTO not connected",
    recoveryType: "reports_recovery",
    registryKey: "op-disaster-recovery"
  },
  {
    backupDependencyLabel: "Marketplace asset backup dependency",
    groupKey: "marketplace-asset-recovery",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesRecoveryPattern(eventType, entityType, /marketplace.?recover|asset.?recover|catalog.?recover/i),
    matchesRecoveryRecord: (recoveryType, recoveryKey) =>
      /marketplace|asset|catalog/i.test(`${recoveryType} ${recoveryKey}`),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    provider: "operations_registry",
    recoveryKey: "op-recovery-marketplace-assets",
    recoveryName: "Marketplace asset recovery",
    recoveryPointObjectiveLabel: "Marketplace RPO not connected",
    recoveryScope: "Marketplace asset catalog",
    recoveryTimeObjectiveLabel: "Marketplace RTO not connected",
    recoveryType: "marketplace_asset_recovery",
    registryKey: "op-disaster-recovery"
  },
  {
    backupDependencyLabel: "Email asset backup dependency",
    groupKey: "email-asset-recovery",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesRecoveryPattern(eventType, entityType, /email.?recover|mail.?recover|attachment.?recover/i),
    matchesRecoveryRecord: (recoveryType, recoveryKey) => /email|mail|attachment/i.test(`${recoveryType} ${recoveryKey}`),
    metadataColumns: "id, status, created_at, updated_at",
    metadataSource: "email_event_logs",
    metadataTable: "email_event_logs",
    provider: "operations_registry",
    recoveryKey: "op-recovery-email-assets",
    recoveryName: "Email asset recovery",
    recoveryPointObjectiveLabel: "Email RPO not connected",
    recoveryScope: "Email asset archives",
    recoveryTimeObjectiveLabel: "Email RTO not connected",
    recoveryType: "email_asset_recovery",
    registryKey: "op-disaster-recovery"
  },
  {
    backupDependencyLabel: "Configuration snapshot dependency",
    groupKey: "configuration-recovery",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesRecoveryPattern(eventType, entityType, /config.?recover|settings.?recover|isolation.?recover|rollback/i),
    matchesRecoveryRecord: (recoveryType, recoveryKey) =>
      /config|configuration|settings|snapshot/i.test(`${recoveryType} ${recoveryKey}`),
    metadataColumns: "id, isolation_status, created_at",
    metadataSource: "store_template_isolation_snapshots",
    metadataTable: "store_template_isolation_snapshots",
    provider: "supabase",
    recoveryKey: "op-recovery-configuration",
    recoveryName: "Configuration recovery",
    recoveryPointObjectiveLabel: "Configuration snapshot RPO",
    recoveryScope: "Template isolation snapshots",
    recoveryTimeObjectiveLabel: "Configuration rollback RTO",
    recoveryType: "configuration_recovery",
    registryKey: "op-disaster-recovery"
  },
  {
    backupDependencyLabel: "Platform backup and monitoring dependency",
    groupKey: "platform-recovery",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesRecoveryPattern(
        eventType,
        entityType,
        /platform.?recover|operations.?recover|failover|disaster.?recover|incident.?recover|dr.?runbook/i
      ),
    matchesRecoveryRecord: (recoveryType, recoveryKey) =>
      /platform|operations|failover|incident|dr/i.test(`${recoveryType} ${recoveryKey}`),
    metadataColumns: null,
    metadataSource: "operations_registry_runtime",
    metadataTable: null,
    provider: "operations_registry",
    recoveryKey: "op-recovery-platform",
    recoveryName: "Platform recovery",
    recoveryPointObjectiveLabel: "Platform RPO not connected",
    recoveryScope: "Platform operations center",
    recoveryTimeObjectiveLabel: "Platform RTO not connected",
    recoveryType: "platform_recovery",
    registryKey: "op-disaster-recovery"
  }
] as const;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clip(value: string, maxLength: number) {
  return value.slice(0, maxLength);
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

function buildSafeControls() {
  return OPERATIONS_DISASTER_RECOVERY_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function matchesRecoveryPattern(eventType: string, entityType: string, pattern: RegExp) {
  return pattern.test(`${eventType} ${entityType}`.toLowerCase());
}

function latestDate(values: Array<string | null>) {
  return (
    values
      .filter(Boolean)
      .sort((left, right) => Date.parse(right ?? "") - Date.parse(left ?? ""))[0] ?? null
  );
}

function resolveSafeLabel(rawValue: unknown, fallback: string) {
  const value = clip(text(rawValue), 160).toLowerCase();

  if (!value) {
    return fallback;
  }

  if (/https?:\/\/|signed|token=|credential|secret|password|dump|\.sql\b|endpoint|api_key/i.test(value)) {
    return fallback;
  }

  if (value.includes("/") || value.includes("\\")) {
    return fallback;
  }

  return clip(text(rawValue), 80) || fallback;
}

function resolveReviewStatus(input: {
  errorCount: number;
  metadataDetected: boolean;
  recoveryStatus: OperationsDisasterRecoveryStatus;
}): OperationsDisasterRecoveryReviewStatus {
  if (!input.metadataDetected) {
    return "not_applicable";
  }

  if (input.errorCount > 0 || input.recoveryStatus === "failed") {
    return "review_required";
  }

  return "clear";
}

function resolveRecoveryStatus(input: {
  errorCount: number;
  metadataDetected: boolean;
  recoveryEventCount: number;
  warningCount: number;
}): OperationsDisasterRecoveryStatus {
  if (!input.metadataDetected && input.recoveryEventCount === 0) {
    return "unknown";
  }

  if (input.errorCount > 0) {
    return "failed";
  }

  if (input.warningCount > 0) {
    return "warning";
  }

  if (input.recoveryEventCount > 0) {
    return "available";
  }

  return "empty";
}

function resolveDisasterRecoveryRuntimeStatus(input: {
  forceFutureHook?: boolean;
  metadataDetected: boolean;
  recoveryEventCount: number;
  recoveryStatus: OperationsDisasterRecoveryStatus;
  reviewStatus: OperationsDisasterRecoveryReviewStatus;
}): OperationsDisasterRecoveryRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

  if (!input.metadataDetected) {
    return "no_metadata_detected";
  }

  if (input.recoveryStatus === "failed") {
    return "failed";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.recoveryStatus === "warning") {
    return "warning";
  }

  if (input.recoveryEventCount === 0) {
    return "empty";
  }

  if (input.recoveryStatus === "available") {
    return "available";
  }

  return "registered";
}

function buildMonitoringRecoverySnapshot(events: AnyRecord[]): RecoveryAggregate & {
  errorCount: number;
  warningCount: number;
} {
  const failures = events.filter((event) => {
    const eventStatus = text(event.event_status).toLowerCase();
    return eventStatus === "failed" || eventStatus.includes("error");
  });
  const successes = events.filter((event) => {
    const eventStatus = text(event.event_status).toLowerCase();
    return eventStatus === "success" || eventStatus === "completed" || eventStatus === "healthy";
  });
  const tests = events.filter((event) => /test|drill|verify|validation/i.test(text(event.event_type)));

  return {
    errorCount: failures.length,
    lastFailureAt: latestDate(failures.map((event) => text(event.created_at))),
    lastRecoveryTestAt: latestDate(tests.map((event) => text(event.created_at))),
    lastSuccessfulRecoveryAt: latestDate(successes.map((event) => text(event.created_at))),
    recoveryEventCount: events.length,
    warningCount: events.filter((event) => text(event.event_status).toLowerCase() === "warning").length
  };
}

function aggregateMetadataRows(rows: AnyRecord[]): RecoveryAggregate {
  const failures = rows.filter((row) => {
    const status = text(row.isolation_status) || text(row.status);
    return /failed|error/i.test(status);
  });
  const successes = rows.filter((row) => {
    const status = text(row.isolation_status) || text(row.status);
    return /success|safe|completed|healthy/i.test(status);
  });

  return {
    lastFailureAt: latestDate(failures.map((row) => text(row.created_at))),
    lastRecoveryTestAt: latestDate(rows.map((row) => text(row.updated_at) || text(row.created_at))),
    lastSuccessfulRecoveryAt: latestDate(successes.map((row) => text(row.created_at))),
    recoveryEventCount: rows.length
  };
}

function aggregateDedicatedRecoveryRows(rows: AnyRecord[], definition: DisasterRecoveryDefinition): RecoveryAggregate | null {
  const matchingRows = rows.filter((row) => {
    const recoveryType = text(row.recovery_type);
    const recoveryKey = text(row.recovery_key) || text(row.recovery_name);
    return definition.matchesRecoveryRecord(recoveryType, recoveryKey);
  });

  if (!matchingRows.length) {
    return null;
  }

  const failures = matchingRows.filter((row) => /failed|error/i.test(text(row.recovery_status)));

  return {
    lastFailureAt: latestDate(
      matchingRows.flatMap((row) => [text(row.last_failure_at), text(row.updated_at)])
    ),
    lastRecoveryTestAt: latestDate(matchingRows.map((row) => text(row.last_recovery_test_at))),
    lastSuccessfulRecoveryAt: latestDate(matchingRows.map((row) => text(row.last_successful_recovery_at))),
    recoveryEventCount: matchingRows.length
  };
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

      console.warn(
        `[operations-disaster-recovery-runtime] read-only recovery metadata select failed for ${table}`,
        error.message
      );
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-disaster-recovery-runtime] read-only recovery metadata select crashed for ${table}`, error);
    return { rows: [], tableDetected: false };
  }
}

async function detectDedicatedDisasterRecoveryTable(supabase: SupabaseClient<Database>) {
  for (const tableName of DISASTER_RECOVERY_TABLE_CANDIDATES) {
    const result = await safeMetadataSelect(
      supabase,
      tableName,
      "id, recovery_key, recovery_type, recovery_status, provider, recovery_scope, last_recovery_test_at, last_failure_at, last_successful_recovery_at, recovery_point_objective_label, recovery_time_objective_label, backup_dependency_label, created_at, updated_at",
      200
    );

    if (result.tableDetected) {
      return {
        rows: result.rows,
        tableDetected: true,
        tableName
      };
    }
  }

  return {
    rows: [] as AnyRecord[],
    tableDetected: false,
    tableName: null as string | null
  };
}

function partitionMonitoringEvents(rows: AnyRecord[]) {
  const partitioned = new Map<string, AnyRecord[]>();

  for (const definition of DISASTER_RECOVERY_DEFINITIONS) {
    partitioned.set(definition.recoveryKey, []);
  }

  for (const row of rows) {
    const eventType = text(row.event_type);
    const entityType = text(row.entity_type);

    for (const definition of DISASTER_RECOVERY_DEFINITIONS) {
      if (definition.matchesMonitoringEvent(eventType, entityType)) {
        partitioned.get(definition.recoveryKey)?.push(row);
      }
    }
  }

  return partitioned;
}

function resolveDedicatedLabels(
  definition: DisasterRecoveryDefinition,
  dedicatedRows: AnyRecord[]
): Pick<
  OperationsDisasterRecoveryRuntimeItem,
  "backupDependencyLabel" | "recoveryPointObjectiveLabel" | "recoveryScope" | "recoveryTimeObjectiveLabel"
> {
  const matchingRow = dedicatedRows.find((row) =>
    definition.matchesRecoveryRecord(text(row.recovery_type), text(row.recovery_key) || text(row.recovery_name))
  );

  return {
    backupDependencyLabel: resolveSafeLabel(matchingRow?.backup_dependency_label, definition.backupDependencyLabel),
    recoveryPointObjectiveLabel: resolveSafeLabel(
      matchingRow?.recovery_point_objective_label,
      definition.recoveryPointObjectiveLabel
    ),
    recoveryScope: resolveSafeLabel(matchingRow?.recovery_scope, definition.recoveryScope),
    recoveryTimeObjectiveLabel: resolveSafeLabel(
      matchingRow?.recovery_time_objective_label,
      definition.recoveryTimeObjectiveLabel
    )
  };
}

function buildDisasterRecoveryRuntimeItem(input: {
  dedicatedRecoveryRows: AnyRecord[];
  dedicatedRecoveryTableDetected: boolean;
  definition: DisasterRecoveryDefinition;
  metadataLoad: { rows: AnyRecord[]; tableDetected: boolean };
  monitoringRows: AnyRecord[];
  monitoringTableDetected: boolean;
}): OperationsDisasterRecoveryRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const monitoringSnapshot = buildMonitoringRecoverySnapshot(input.monitoringRows);
  const dedicatedAggregate = input.dedicatedRecoveryTableDetected
    ? aggregateDedicatedRecoveryRows(input.dedicatedRecoveryRows, input.definition)
    : null;
  const metadataAggregate =
    input.definition.metadataTable &&
    input.definition.metadataTable !== "monitoring_events" &&
    input.metadataLoad.tableDetected
      ? aggregateMetadataRows(input.metadataLoad.rows)
      : null;
  const aggregate = dedicatedAggregate ?? metadataAggregate ?? monitoringSnapshot;
  const metadataDetected = Boolean(
    dedicatedAggregate ||
      (input.definition.metadataTable &&
        input.definition.metadataTable !== "monitoring_events" &&
        input.metadataLoad.tableDetected) ||
      (input.definition.metadataTable === "monitoring_events" &&
        input.monitoringTableDetected &&
        input.monitoringRows.length > 0) ||
      (input.definition.metadataSource === "operations_registry_runtime" && registryEntry)
  );
  const recoveryEventCount = aggregate.recoveryEventCount;
  const recoveryStatus = resolveRecoveryStatus({
    errorCount: monitoringSnapshot.errorCount,
    metadataDetected,
    recoveryEventCount,
    warningCount: monitoringSnapshot.warningCount
  });
  const reviewStatus = resolveReviewStatus({
    errorCount: monitoringSnapshot.errorCount,
    metadataDetected,
    recoveryStatus
  });
  const runtimeStatus = resolveDisasterRecoveryRuntimeStatus({
    metadataDetected,
    recoveryEventCount,
    recoveryStatus,
    reviewStatus
  });
  const dedicatedLabels = resolveDedicatedLabels(input.definition, input.dedicatedRecoveryRows);

  return {
    ...dedicatedLabels,
    errorCount: monitoringSnapshot.errorCount,
    groupKey: input.definition.groupKey,
    lastFailureAt: aggregate.lastFailureAt ?? monitoringSnapshot.lastFailureAt,
    lastRecoveryTestAt: aggregate.lastRecoveryTestAt ?? monitoringSnapshot.lastRecoveryTestAt,
    lastSuccessfulRecoveryAt: aggregate.lastSuccessfulRecoveryAt ?? monitoringSnapshot.lastSuccessfulRecoveryAt,
    metadataDetected,
    metadataSource: input.definition.metadataSource,
    provider: input.definition.provider,
    recoveryKey: input.definition.recoveryKey,
    recoveryName: input.definition.recoveryName,
    recoveryStatus,
    recoveryType: input.definition.recoveryType,
    reviewStatus,
    runtimeStatus,
    safeControls: buildSafeControls(),
    visibility: registryEntry?.visibility ?? "super_admin",
    warningCount: monitoringSnapshot.warningCount
  };
}

function buildFutureRecoveryHookItems(): OperationsDisasterRecoveryRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /recover|restore|failover|rollback|disaster|dr runbook/i.test(hook))
    .map((hook, index) => ({
      backupDependencyLabel: "Not configured",
      errorCount: 0,
      groupKey: "future-recovery-hooks" as const,
      lastFailureAt: null,
      lastRecoveryTestAt: null,
      lastSuccessfulRecoveryAt: null,
      metadataDetected: false,
      metadataSource: null,
      provider: "future_hook" as const,
      recoveryKey: `op-future-recovery-hook-${index + 1}`,
      recoveryName: hook,
      recoveryPointObjectiveLabel: "Not configured",
      recoveryScope: "Future recovery hook",
      recoveryStatus: "unknown" as const,
      recoveryTimeObjectiveLabel: "Not configured",
      recoveryType: "future_hook",
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      visibility: registryEntry?.visibility ?? "super_admin",
      warningCount: 0
    }));
}

export function operationsDisasterRecoveryRuntimeStatusLabel(status: OperationsDisasterRecoveryRuntimeStatus) {
  switch (status) {
    case "available":
      return "Available";
    case "disabled":
      return "Disabled";
    case "empty":
      return "Empty";
    case "failed":
      return "Failed";
    case "future_hook":
      return "Future Hook";
    case "no_metadata_detected":
      return "No Metadata Detected";
    case "registered":
      return "Registered";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function operationsDisasterRecoveryRuntimeStatusBadgeTone(status: OperationsDisasterRecoveryRuntimeStatus) {
  switch (status) {
    case "available":
    case "registered":
      return "green" as const;
    case "empty":
    case "warning":
      return "blue" as const;
    case "failed":
    case "review_required":
      return "amber" as const;
    case "no_metadata_detected":
      return "red" as const;
    case "disabled":
    case "future_hook":
      return "slate" as const;
  }
}

export function operationsDisasterRecoveryStatusLabel(status: OperationsDisasterRecoveryStatus) {
  switch (status) {
    case "available":
      return "Available";
    case "empty":
      return "Empty";
    case "failed":
      return "Failed";
    case "unknown":
      return "Unknown";
    case "warning":
      return "Warning";
  }
}

export function buildOperationsDisasterRecoveryRuntimeGroups(
  items: OperationsDisasterRecoveryRuntimeItem[]
): OperationsDisasterRecoveryRuntimeGroup[] {
  return DISASTER_RECOVERY_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsDisasterRecoveryRuntimeSummary(
  items: OperationsDisasterRecoveryRuntimeItem[]
): OperationsDisasterRecoveryRuntimeSummary {
  const operationalRecoveries = items.filter((item) => item.groupKey !== "future-recovery-hooks");
  const availableRecoveries = operationalRecoveries.filter((item) => item.runtimeStatus === "available").length;
  const warningRecoveries = operationalRecoveries.filter((item) => item.runtimeStatus === "warning").length;
  const failedRecoveries = operationalRecoveries.filter(
    (item) =>
      item.runtimeStatus === "failed" ||
      item.runtimeStatus === "review_required" ||
      item.runtimeStatus === "no_metadata_detected"
  ).length;
  const status =
    failedRecoveries > 0 || warningRecoveries > 0
      ? ("needs_attention" as const)
      : ("disaster_recovery_runtime_ready" as const);

  return {
    availableRecoveries,
    failedRecoveries,
    groupCount: buildOperationsDisasterRecoveryRuntimeGroups(items).length,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_DISASTER_RECOVERY_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalRecoveries.length} recovery targets`,
      `${availableRecoveries} available`,
      `${warningRecoveries} warning`,
      `${failedRecoveries} require review`
    ].join("; "),
    totalRecoveries: items.length,
    warningRecoveries
  };
}

export async function loadOperationsDisasterRecoveryRuntimeReadOnlySafe(params: {
  supabase: SupabaseClient<Database>;
}) {
  const metadataTables = [
    ...new Set(
      DISASTER_RECOVERY_DEFINITIONS.map((definition) => definition.metadataTable).filter(
        (table): table is string => Boolean(table) && table !== "monitoring_events"
      )
    )
  ];
  const [monitoringLoad, dedicatedRecoveryTable, ...metadataLoads] = await Promise.all([
    safeMetadataSelect(
      params.supabase,
      "monitoring_events",
      "id, event_type, event_status, entity_type, created_at",
      500
    ),
    detectDedicatedDisasterRecoveryTable(params.supabase),
    ...metadataTables.map((table) => {
      const definition = DISASTER_RECOVERY_DEFINITIONS.find((item) => item.metadataTable === table);
      return safeMetadataSelect(params.supabase, table, definition?.metadataColumns ?? "id, created_at", 500);
    })
  ]);
  const metadataByTable = new Map<string, { rows: AnyRecord[]; tableDetected: boolean }>();

  metadataTables.forEach((table, index) => {
    metadataByTable.set(table, metadataLoads[index] ?? { rows: [], tableDetected: false });
  });

  const partitionedEvents = partitionMonitoringEvents(monitoringLoad.rows);
  const recoveryItems = [
    ...DISASTER_RECOVERY_DEFINITIONS.map((definition) =>
      buildDisasterRecoveryRuntimeItem({
        dedicatedRecoveryRows: dedicatedRecoveryTable.rows,
        dedicatedRecoveryTableDetected: dedicatedRecoveryTable.tableDetected,
        definition,
        metadataLoad: definition.metadataTable
          ? metadataByTable.get(definition.metadataTable) ?? { rows: [], tableDetected: false }
          : { rows: [], tableDetected: false },
        monitoringRows: partitionedEvents.get(definition.recoveryKey) ?? [],
        monitoringTableDetected: monitoringLoad.tableDetected
      })
    ),
    ...buildFutureRecoveryHookItems()
  ];
  const groups = buildOperationsDisasterRecoveryRuntimeGroups(recoveryItems);
  const summary = getOperationsDisasterRecoveryRuntimeSummary(recoveryItems);

  return {
    disasterRecovery: summary,
    groups,
    recoveryItems,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsDisasterRecoveryRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsDisasterRecoveryRuntimeReadOnlySafe>>
) {
  return {
    disasterRecovery: input.disasterRecovery,
    groups: input.groups,
    recoveryItems: input.recoveryItems,
    safeControls: input.safeControls
  };
}
