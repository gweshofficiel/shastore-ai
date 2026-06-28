import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsBackupRuntimeSource = "operations_backup_runtime";

export type OperationsBackupGroupKey =
  | "configuration-backups"
  | "database-backups"
  | "email-asset-backups"
  | "future-backup-hooks"
  | "marketplace-asset-backups"
  | "reports-backups"
  | "storage-backups";

export type OperationsBackupProvider =
  | "cloudflare_r2"
  | "future_hook"
  | "operations_registry"
  | "supabase";

export type OperationsBackupRuntimeStatus =
  | "available"
  | "disabled"
  | "empty"
  | "failed"
  | "future_hook"
  | "no_metadata_detected"
  | "registered"
  | "review_required"
  | "warning";

export type OperationsBackupStatus = "available" | "empty" | "failed" | "unknown" | "warning";

export type OperationsBackupReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsBackupSafeControlKey =
  | "create_backup"
  | "delete_backup"
  | "download_backup"
  | "export_report"
  | "restore_backup"
  | "verify_backup";

export type OperationsBackupSafeControl = {
  enabled: false;
  key: OperationsBackupSafeControlKey;
  label: string;
  note: string;
};

export type OperationsBackupRuntimeItem = {
  backupCount: number;
  backupKey: string;
  backupName: string;
  backupStatus: OperationsBackupStatus;
  backupType: string;
  errorCount: number;
  groupKey: OperationsBackupGroupKey;
  lastBackupAt: string | null;
  lastFailureAt: string | null;
  lastVerifiedAt: string | null;
  metadataDetected: boolean;
  metadataSource: string | null;
  provider: OperationsBackupProvider;
  retentionPolicyLabel: string;
  reviewStatus: OperationsBackupReviewStatus;
  runtimeStatus: OperationsBackupRuntimeStatus;
  safeControls: OperationsBackupSafeControl[];
  storageLocationLabel: string;
  totalSizeBytes: number;
  visibility: OperationsRegistryVisibility;
  warningCount: number;
};

export type OperationsBackupRuntimeGroup = {
  groupKey: OperationsBackupGroupKey;
  itemCount: number;
  items: OperationsBackupRuntimeItem[];
  title: string;
};

export type OperationsBackupRuntimeSummary = {
  availableBackups: number;
  failedBackups: number;
  groupCount: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsBackupRuntimeSource;
  status: "backup_runtime_ready" | "needs_attention";
  summary: string;
  totalBackups: number;
  warningBackups: number;
};

type AnyRecord = Record<string, unknown>;

type BackupDefinition = {
  backupKey: string;
  backupName: string;
  backupType: string;
  groupKey: OperationsBackupGroupKey;
  locationLabel: string;
  matchesBackupRecord: (backupType: string, backupKey: string) => boolean;
  matchesMonitoringEvent: (eventType: string, entityType: string) => boolean;
  metadataColumns: string | null;
  metadataSource: string | null;
  metadataTable: string | null;
  provider: OperationsBackupProvider;
  registryKey: string;
  retentionPolicyLabel: string;
};

type BackupAggregate = {
  backupCount: number;
  lastBackupAt: string | null;
  lastFailureAt: string | null;
  lastVerifiedAt: string | null;
  totalSizeBytes: number;
};

export const OPERATIONS_BACKUP_RUNTIME_SOURCE = "operations_backup_runtime" as const;

export const OPERATIONS_BACKUP_SAFE_CONTROLS: readonly OperationsBackupSafeControl[] = [
  {
    enabled: false,
    key: "create_backup",
    label: "Create Backup",
    note: "Read-only placeholder. No backup creation runs during OP-15 page load."
  },
  {
    enabled: false,
    key: "restore_backup",
    label: "Restore Backup",
    note: "Read-only placeholder. No backup restore runs during OP-15 page load."
  },
  {
    enabled: false,
    key: "verify_backup",
    label: "Verify Backup",
    note: "Read-only placeholder. No backup verification job runs during OP-15 page load."
  },
  {
    enabled: false,
    key: "download_backup",
    label: "Download",
    note: "Read-only placeholder. No backup download or signed URL generation runs during OP-15 page load."
  },
  {
    enabled: false,
    key: "delete_backup",
    label: "Delete",
    note: "Read-only placeholder. No backup delete runs during OP-15 page load."
  },
  {
    enabled: false,
    key: "export_report",
    label: "Export Report",
    note: "Read-only placeholder. No backup export or diagnostics run during OP-15 page load."
  }
] as const;

const BACKUP_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsBackupGroupKey;
  title: string;
}> = [
  { groupKey: "database-backups", title: "Database Backups" },
  { groupKey: "storage-backups", title: "Storage Backups" },
  { groupKey: "reports-backups", title: "Reports Backups" },
  { groupKey: "marketplace-asset-backups", title: "Marketplace Asset Backups" },
  { groupKey: "email-asset-backups", title: "Email Asset Backups" },
  { groupKey: "configuration-backups", title: "Configuration Backups" },
  { groupKey: "future-backup-hooks", title: "Future Backup Hooks" }
];

const BACKUP_TABLE_CANDIDATES = [
  "platform_backups",
  "backup_records",
  "backup_snapshots",
  "storage_backups",
  "database_backups"
] as const;

const BACKUP_DEFINITIONS: readonly BackupDefinition[] = [
  {
    backupKey: "op-backup-database",
    backupName: "Database backups",
    backupType: "database_backup",
    groupKey: "database-backups",
    locationLabel: "Supabase managed backup storage",
    matchesBackupRecord: (backupType, backupKey) =>
      /database|postgres|supabase|pg/i.test(`${backupType} ${backupKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesBackupPattern(eventType, entityType, /database.?backup|pg.?dump|supabase.?backup|schema.?backup/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    provider: "supabase",
    registryKey: "op-backup",
    retentionPolicyLabel: "Provider managed retention"
  },
  {
    backupKey: "op-backup-storage",
    backupName: "Storage backups",
    backupType: "storage_backup",
    groupKey: "storage-backups",
    locationLabel: "Managed object storage backups",
    matchesBackupRecord: (backupType, backupKey) =>
      /storage|bucket|r2|object/i.test(`${backupType} ${backupKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesBackupPattern(eventType, entityType, /storage.?backup|bucket.?backup|r2.?backup|object.?backup/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    provider: "cloudflare_r2",
    registryKey: "op-backup",
    retentionPolicyLabel: "Storage retention policy not connected"
  },
  {
    backupKey: "op-backup-reports",
    backupName: "Reports backups",
    backupType: "reports_backup",
    groupKey: "reports-backups",
    locationLabel: "Report export backup storage",
    matchesBackupRecord: (backupType, backupKey) =>
      /report|export|analytics/i.test(`${backupType} ${backupKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesBackupPattern(eventType, entityType, /report.?backup|export.?backup|analytics.?archive/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    provider: "operations_registry",
    registryKey: "op-backup",
    retentionPolicyLabel: "Report retention policy not connected"
  },
  {
    backupKey: "op-backup-marketplace-assets",
    backupName: "Marketplace asset backups",
    backupType: "marketplace_asset_backup",
    groupKey: "marketplace-asset-backups",
    locationLabel: "Marketplace asset backup storage",
    matchesBackupRecord: (backupType, backupKey) =>
      /marketplace|asset|catalog/i.test(`${backupType} ${backupKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesBackupPattern(eventType, entityType, /marketplace.?backup|asset.?backup|catalog.?archive/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    provider: "operations_registry",
    registryKey: "op-backup",
    retentionPolicyLabel: "Marketplace retention policy not connected"
  },
  {
    backupKey: "op-backup-email-assets",
    backupName: "Email asset backups",
    backupType: "email_asset_backup",
    groupKey: "email-asset-backups",
    locationLabel: "Email asset backup storage",
    matchesBackupRecord: (backupType, backupKey) => /email|mail|attachment/i.test(`${backupType} ${backupKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesBackupPattern(eventType, entityType, /email.?backup|mail.?backup|attachment.?archive/i),
    metadataColumns: "id, status, created_at, updated_at",
    metadataSource: "email_event_logs",
    metadataTable: "email_event_logs",
    provider: "operations_registry",
    registryKey: "op-backup",
    retentionPolicyLabel: "Email retention policy not connected"
  },
  {
    backupKey: "op-backup-configuration",
    backupName: "Configuration backups",
    backupType: "configuration_backup",
    groupKey: "configuration-backups",
    locationLabel: "Configuration snapshot storage",
    matchesBackupRecord: (backupType, backupKey) =>
      /config|configuration|settings|snapshot/i.test(`${backupType} ${backupKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesBackupPattern(eventType, entityType, /config.?backup|settings.?snapshot|isolation.?snapshot/i),
    metadataColumns: "id, isolation_status, created_at",
    metadataSource: "store_template_isolation_snapshots",
    metadataTable: "store_template_isolation_snapshots",
    provider: "supabase",
    registryKey: "op-backup",
    retentionPolicyLabel: "Configuration snapshot retention"
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
  return OPERATIONS_BACKUP_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function matchesBackupPattern(eventType: string, entityType: string, pattern: RegExp) {
  return pattern.test(`${eventType} ${entityType}`.toLowerCase());
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function latestDate(values: Array<string | null>) {
  return (
    values
      .filter(Boolean)
      .sort((left, right) => Date.parse(right ?? "") - Date.parse(left ?? ""))[0] ?? null
  );
}

function resolveSafeStorageLocationLabel(rawValue: unknown, fallback: string) {
  const value = clip(text(rawValue), 160).toLowerCase();

  if (!value) {
    return fallback;
  }

  if (/https?:\/\/|signed|token=|credential|secret|password|dump|\.sql\b|\/users\/|\/private\//i.test(value)) {
    return fallback;
  }

  if (value.includes("/") || value.includes("\\")) {
    return fallback;
  }

  return clip(text(rawValue), 80) || fallback;
}

function resolveReviewStatus(input: {
  backupStatus: OperationsBackupStatus;
  errorCount: number;
  metadataDetected: boolean;
}): OperationsBackupReviewStatus {
  if (!input.metadataDetected) {
    return "not_applicable";
  }

  if (input.errorCount > 0 || input.backupStatus === "failed") {
    return "review_required";
  }

  return "clear";
}

function resolveBackupStatus(input: {
  backupCount: number;
  errorCount: number;
  metadataDetected: boolean;
  warningCount: number;
}): OperationsBackupStatus {
  if (!input.metadataDetected && input.backupCount === 0) {
    return "unknown";
  }

  if (input.errorCount > 0) {
    return "failed";
  }

  if (input.warningCount > 0) {
    return "warning";
  }

  if (input.backupCount > 0) {
    return "available";
  }

  return "empty";
}

function resolveBackupRuntimeStatus(input: {
  backupCount: number;
  backupStatus: OperationsBackupStatus;
  forceFutureHook?: boolean;
  metadataDetected: boolean;
  reviewStatus: OperationsBackupReviewStatus;
}): OperationsBackupRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

  if (!input.metadataDetected) {
    return "no_metadata_detected";
  }

  if (input.backupStatus === "failed") {
    return "failed";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.backupStatus === "warning") {
    return "warning";
  }

  if (input.backupCount === 0) {
    return "empty";
  }

  if (input.backupStatus === "available") {
    return "available";
  }

  return "registered";
}

function buildMonitoringBackupSnapshot(events: AnyRecord[]) {
  const failures = events.filter((event) => {
    const eventStatus = text(event.event_status).toLowerCase();
    return eventStatus === "failed" || eventStatus.includes("error");
  });
  const successes = events.filter((event) => {
    const eventStatus = text(event.event_status).toLowerCase();
    return eventStatus === "success" || eventStatus === "completed" || eventStatus === "healthy";
  });

  return {
    backupCount: successes.length || events.length,
    errorCount: failures.length,
    lastBackupAt: latestDate(
      successes.length
        ? successes.map((event) => text(event.created_at))
        : events.map((event) => text(event.created_at))
    ),
    lastFailureAt: latestDate(failures.map((event) => text(event.created_at))),
    lastVerifiedAt: latestDate(
      events
        .filter((event) => /verify|verified|validation/i.test(text(event.event_type)))
        .map((event) => text(event.created_at))
    ),
    totalSizeBytes: 0,
    warningCount: events.filter((event) => text(event.event_status).toLowerCase() === "warning").length
  };
}

function aggregateMetadataRows(rows: AnyRecord[]): BackupAggregate {
  const failures = rows.filter((row) => {
    const status = text(row.isolation_status) || text(row.status);
    return /failed|error/i.test(status);
  });

  return {
    backupCount: rows.length,
    lastBackupAt: latestDate(rows.map((row) => text(row.created_at))),
    lastFailureAt: latestDate(failures.map((row) => text(row.created_at))),
    lastVerifiedAt: latestDate(rows.map((row) => text(row.updated_at) || text(row.created_at))),
    totalSizeBytes: rows.reduce((total, row) => total + numberValue(row.total_size_bytes) + numberValue(row.file_size), 0)
  };
}

function aggregateDedicatedBackupRows(rows: AnyRecord[], definition: BackupDefinition): BackupAggregate | null {
  const matchingRows = rows.filter((row) => {
    const backupType = text(row.backup_type);
    const backupKey = text(row.backup_key) || text(row.backup_name) || text(row.metric_key);
    return definition.matchesBackupRecord(backupType, backupKey);
  });

  if (!matchingRows.length) {
    return null;
  }

  const failures = matchingRows.filter((row) => /failed|error/i.test(text(row.backup_status)));

  return {
    backupCount: matchingRows.reduce((total, row) => total + Math.max(numberValue(row.backup_count), 1), 0),
    lastBackupAt: latestDate(
      matchingRows.flatMap((row) => [text(row.last_backup_at), text(row.created_at), text(row.updated_at)])
    ),
    lastFailureAt: latestDate(failures.flatMap((row) => [text(row.last_failure_at), text(row.updated_at)])),
    lastVerifiedAt: latestDate(matchingRows.map((row) => text(row.last_verified_at))),
    totalSizeBytes: matchingRows.reduce((total, row) => total + numberValue(row.total_size_bytes), 0)
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

      console.warn(`[operations-backup-runtime] read-only backup metadata select failed for ${table}`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-backup-runtime] read-only backup metadata select crashed for ${table}`, error);
    return { rows: [], tableDetected: false };
  }
}

async function detectDedicatedBackupTable(supabase: SupabaseClient<Database>) {
  for (const tableName of BACKUP_TABLE_CANDIDATES) {
    const result = await safeMetadataSelect(
      supabase,
      tableName,
      "id, backup_key, backup_type, backup_status, provider, storage_location_label, last_backup_at, last_verified_at, last_failure_at, backup_count, total_size_bytes, retention_policy_label, created_at, updated_at",
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

  for (const definition of BACKUP_DEFINITIONS) {
    partitioned.set(definition.backupKey, []);
  }

  for (const row of rows) {
    const eventType = text(row.event_type);
    const entityType = text(row.entity_type);

    for (const definition of BACKUP_DEFINITIONS) {
      if (definition.matchesMonitoringEvent(eventType, entityType)) {
        partitioned.get(definition.backupKey)?.push(row);
      }
    }
  }

  return partitioned;
}

function resolveRetentionPolicyLabel(definition: BackupDefinition, dedicatedRows: AnyRecord[]) {
  const matchingRow = dedicatedRows.find((row) =>
    definition.matchesBackupRecord(text(row.backup_type), text(row.backup_key) || text(row.backup_name))
  );
  const label = text(matchingRow?.retention_policy_label);

  return label ? resolveSafeStorageLocationLabel(label, definition.retentionPolicyLabel) : definition.retentionPolicyLabel;
}

function buildBackupRuntimeItem(input: {
  dedicatedBackupRows: AnyRecord[];
  dedicatedBackupTableDetected: boolean;
  definition: BackupDefinition;
  metadataLoad: { rows: AnyRecord[]; tableDetected: boolean };
  monitoringRows: AnyRecord[];
  monitoringTableDetected: boolean;
}): OperationsBackupRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const monitoringSnapshot = buildMonitoringBackupSnapshot(input.monitoringRows);
  const dedicatedAggregate = input.dedicatedBackupTableDetected
    ? aggregateDedicatedBackupRows(input.dedicatedBackupRows, input.definition)
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
  const backupCount = aggregate.backupCount;
  const backupStatus = resolveBackupStatus({
    backupCount,
    errorCount: monitoringSnapshot.errorCount,
    metadataDetected,
    warningCount: monitoringSnapshot.warningCount
  });
  const reviewStatus = resolveReviewStatus({
    backupStatus,
    errorCount: monitoringSnapshot.errorCount,
    metadataDetected
  });
  const runtimeStatus = resolveBackupRuntimeStatus({
    backupCount,
    backupStatus,
    metadataDetected,
    reviewStatus
  });
  const dedicatedLocationRow = input.dedicatedBackupRows.find((row) =>
    input.definition.matchesBackupRecord(text(row.backup_type), text(row.backup_key) || text(row.backup_name))
  );

  return {
    backupCount,
    backupKey: input.definition.backupKey,
    backupName: input.definition.backupName,
    backupStatus,
    backupType: input.definition.backupType,
    errorCount: monitoringSnapshot.errorCount,
    groupKey: input.definition.groupKey,
    lastBackupAt: aggregate.lastBackupAt,
    lastFailureAt: aggregate.lastFailureAt ?? monitoringSnapshot.lastFailureAt,
    lastVerifiedAt: aggregate.lastVerifiedAt ?? monitoringSnapshot.lastVerifiedAt,
    metadataDetected,
    metadataSource: input.definition.metadataSource,
    provider: input.definition.provider,
    retentionPolicyLabel: resolveRetentionPolicyLabel(input.definition, input.dedicatedBackupRows),
    reviewStatus,
    runtimeStatus,
    safeControls: buildSafeControls(),
    storageLocationLabel: resolveSafeStorageLocationLabel(
      dedicatedLocationRow?.storage_location_label,
      input.definition.locationLabel
    ),
    totalSizeBytes: aggregate.totalSizeBytes,
    visibility: registryEntry?.visibility ?? "super_admin",
    warningCount: monitoringSnapshot.warningCount
  };
}

function buildFutureBackupHookItems(): OperationsBackupRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /backup|restore|archive|snapshot|disaster/i.test(hook))
    .map((hook, index) => ({
      backupCount: 0,
      backupKey: `op-future-backup-hook-${index + 1}`,
      backupName: hook,
      backupStatus: "unknown" as const,
      backupType: "future_hook",
      errorCount: 0,
      groupKey: "future-backup-hooks" as const,
      lastBackupAt: null,
      lastFailureAt: null,
      lastVerifiedAt: null,
      metadataDetected: false,
      metadataSource: null,
      provider: "future_hook" as const,
      retentionPolicyLabel: "Not configured",
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      storageLocationLabel: "Future backup hook",
      totalSizeBytes: 0,
      visibility: registryEntry?.visibility ?? "super_admin",
      warningCount: 0
    }));
}

export function operationsBackupRuntimeStatusLabel(status: OperationsBackupRuntimeStatus) {
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

export function operationsBackupRuntimeStatusBadgeTone(status: OperationsBackupRuntimeStatus) {
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

export function operationsBackupStatusLabel(status: OperationsBackupStatus) {
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

export function formatBackupBytes(bytes: number) {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function buildOperationsBackupRuntimeGroups(items: OperationsBackupRuntimeItem[]): OperationsBackupRuntimeGroup[] {
  return BACKUP_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsBackupRuntimeSummary(items: OperationsBackupRuntimeItem[]): OperationsBackupRuntimeSummary {
  const operationalBackups = items.filter((item) => item.groupKey !== "future-backup-hooks");
  const availableBackups = operationalBackups.filter((item) => item.runtimeStatus === "available").length;
  const warningBackups = operationalBackups.filter((item) => item.runtimeStatus === "warning").length;
  const failedBackups = operationalBackups.filter(
    (item) =>
      item.runtimeStatus === "failed" ||
      item.runtimeStatus === "review_required" ||
      item.runtimeStatus === "no_metadata_detected"
  ).length;
  const status =
    failedBackups > 0 || warningBackups > 0 ? ("needs_attention" as const) : ("backup_runtime_ready" as const);

  return {
    availableBackups,
    failedBackups,
    groupCount: buildOperationsBackupRuntimeGroups(items).length,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_BACKUP_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalBackups.length} backup targets`,
      `${availableBackups} available`,
      `${warningBackups} warning`,
      `${failedBackups} require review`
    ].join("; "),
    totalBackups: items.length,
    warningBackups
  };
}

export async function loadOperationsBackupRuntimeReadOnlySafe(params: { supabase: SupabaseClient<Database> }) {
  const metadataTables = [
    ...new Set(
      BACKUP_DEFINITIONS.map((definition) => definition.metadataTable).filter(
        (table): table is string => Boolean(table) && table !== "monitoring_events"
      )
    )
  ];
  const [monitoringLoad, dedicatedBackupTable, ...metadataLoads] = await Promise.all([
    safeMetadataSelect(
      params.supabase,
      "monitoring_events",
      "id, event_type, event_status, entity_type, created_at",
      500
    ),
    detectDedicatedBackupTable(params.supabase),
    ...metadataTables.map((table) => {
      const definition = BACKUP_DEFINITIONS.find((item) => item.metadataTable === table);
      return safeMetadataSelect(params.supabase, table, definition?.metadataColumns ?? "id, created_at", 500);
    })
  ]);
  const metadataByTable = new Map<string, { rows: AnyRecord[]; tableDetected: boolean }>();

  metadataTables.forEach((table, index) => {
    metadataByTable.set(table, metadataLoads[index] ?? { rows: [], tableDetected: false });
  });

  const partitionedEvents = partitionMonitoringEvents(monitoringLoad.rows);
  const backupItems = [
    ...BACKUP_DEFINITIONS.map((definition) =>
      buildBackupRuntimeItem({
        dedicatedBackupRows: dedicatedBackupTable.rows,
        dedicatedBackupTableDetected: dedicatedBackupTable.tableDetected,
        definition,
        metadataLoad: definition.metadataTable
          ? metadataByTable.get(definition.metadataTable) ?? { rows: [], tableDetected: false }
          : { rows: [], tableDetected: false },
        monitoringRows: partitionedEvents.get(definition.backupKey) ?? [],
        monitoringTableDetected: monitoringLoad.tableDetected
      })
    ),
    ...buildFutureBackupHookItems()
  ];
  const groups = buildOperationsBackupRuntimeGroups(backupItems);
  const summary = getOperationsBackupRuntimeSummary(backupItems);

  return {
    backupItems,
    backupRuntime: summary,
    groups,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsBackupRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsBackupRuntimeReadOnlySafe>>
) {
  return {
    backupItems: input.backupItems,
    backupRuntime: input.backupRuntime,
    groups: input.groups,
    safeControls: input.safeControls
  };
}
