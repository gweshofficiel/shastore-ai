import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsStorageMetricsRuntimeSource = "operations_storage_metrics_runtime";

export type OperationsStorageMetricsGroupKey =
  | "backup-storage-metrics"
  | "email-assets-metrics"
  | "future-storage-metrics-hooks"
  | "marketplace-assets-metrics"
  | "product-images-metrics"
  | "report-export-metrics"
  | "template-assets-metrics"
  | "theme-assets-metrics";

export type OperationsStorageMetricsProvider =
  | "cloudflare_r2"
  | "future_hook"
  | "operations_registry"
  | "supabase_storage";

export type OperationsStorageMetricsRuntimeStatus =
  | "disabled"
  | "empty"
  | "failed"
  | "future_hook"
  | "measured"
  | "no_metrics_detected"
  | "registered"
  | "review_required"
  | "warning";

export type OperationsStorageMetricsReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsStorageMetricsSafeControlKey =
  | "cleanup"
  | "export_report"
  | "inspect_objects"
  | "refresh_metrics"
  | "repair";

export type OperationsStorageMetricsSafeControl = {
  enabled: false;
  key: OperationsStorageMetricsSafeControlKey;
  label: string;
  note: string;
};

export type OperationsStorageMetricsRuntimeItem = {
  backupObjects: number;
  bucketName: string | null;
  documentObjects: number;
  errorCount: number;
  exportObjects: number;
  groupKey: OperationsStorageMetricsGroupKey;
  imageObjects: number;
  lastFailureAt: string | null;
  lastMeasuredAt: string | null;
  metricsDetected: boolean;
  metadataSource: string | null;
  provider: OperationsStorageMetricsProvider;
  reviewStatus: OperationsStorageMetricsReviewStatus;
  runtimeStatus: OperationsStorageMetricsRuntimeStatus;
  safeControls: OperationsStorageMetricsSafeControl[];
  storageMetricKey: string;
  storageName: string;
  totalObjects: number;
  totalSizeBytes: number;
  visibility: OperationsRegistryVisibility;
  warningCount: number;
};

export type OperationsStorageMetricsRuntimeGroup = {
  groupKey: OperationsStorageMetricsGroupKey;
  itemCount: number;
  items: OperationsStorageMetricsRuntimeItem[];
  title: string;
};

export type OperationsStorageMetricsRuntimeSummary = {
  failedMetrics: number;
  groupCount: number;
  measuredMetrics: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsStorageMetricsRuntimeSource;
  status: "needs_attention" | "storage_metrics_runtime_ready";
  summary: string;
  totalMetrics: number;
  warningMetrics: number;
};

type AnyRecord = Record<string, unknown>;

type StorageMetricsDefinition = {
  bucketEnvVar?: string;
  bucketNameFallback?: string;
  groupKey: OperationsStorageMetricsGroupKey;
  matchesMonitoringEvent: (eventType: string, entityType: string) => boolean;
  metadataColumns: string | null;
  metadataSource: string | null;
  metadataTable: string | null;
  provider: OperationsStorageMetricsProvider;
  registryKey: string;
  storageMetricKey: string;
  storageName: string;
};

type MetadataAggregate = {
  backupObjects: number;
  documentObjects: number;
  exportObjects: number;
  imageObjects: number;
  lastMeasuredAt: string | null;
  totalObjects: number;
  totalSizeBytes: number;
};

export const OPERATIONS_STORAGE_METRICS_RUNTIME_SOURCE = "operations_storage_metrics_runtime" as const;

export const OPERATIONS_STORAGE_METRICS_SAFE_CONTROLS: readonly OperationsStorageMetricsSafeControl[] = [
  {
    enabled: false,
    key: "refresh_metrics",
    label: "Refresh Metrics",
    note: "Read-only placeholder. No storage metric refresh or bucket scan runs during OP-14 page load."
  },
  {
    enabled: false,
    key: "inspect_objects",
    label: "Inspect Objects",
    note: "Read-only placeholder. No object listing or bucket inspection runs during OP-14 page load."
  },
  {
    enabled: false,
    key: "cleanup",
    label: "Cleanup",
    note: "Read-only placeholder. No storage cleanup action is available during OP-14 page load."
  },
  {
    enabled: false,
    key: "repair",
    label: "Repair",
    note: "Read-only placeholder. No storage repair action is available during OP-14 page load."
  },
  {
    enabled: false,
    key: "export_report",
    label: "Export Report",
    note: "Read-only placeholder. No storage metrics export or diagnostics run during OP-14 page load."
  }
] as const;

const STORAGE_METRICS_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsStorageMetricsGroupKey;
  title: string;
}> = [
  { groupKey: "product-images-metrics", title: "Product Images Metrics" },
  { groupKey: "template-assets-metrics", title: "Template Assets Metrics" },
  { groupKey: "theme-assets-metrics", title: "Theme Assets Metrics" },
  { groupKey: "marketplace-assets-metrics", title: "Marketplace Assets Metrics" },
  { groupKey: "email-assets-metrics", title: "Email Assets Metrics" },
  { groupKey: "report-export-metrics", title: "Report Export Metrics" },
  { groupKey: "backup-storage-metrics", title: "Backup Storage Metrics" },
  { groupKey: "future-storage-metrics-hooks", title: "Future Storage Metrics Hooks" }
];

const STORAGE_METRICS_TABLE_CANDIDATES = [
  "storage_metrics",
  "platform_storage_metrics",
  "storage_usage_metrics",
  "storage_metric_snapshots"
] as const;

const STORAGE_METRICS_DEFINITIONS: readonly StorageMetricsDefinition[] = [
  {
    bucketEnvVar: "CLOUDFLARE_R2_BUCKET",
    bucketNameFallback: "product-images",
    groupKey: "product-images-metrics",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesStorageMetricsPattern(eventType, entityType, /product.?image|gallery|upload|r2|storage.?metric/i),
    metadataColumns: "id, file_size, image_role, content_type, created_at, updated_at",
    metadataSource: "product_images",
    metadataTable: "product_images",
    provider: "cloudflare_r2",
    registryKey: "op-storage-metrics",
    storageMetricKey: "op-storage-metrics-product-images",
    storageName: "Product images metrics"
  },
  {
    groupKey: "template-assets-metrics",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesStorageMetricsPattern(eventType, entityType, /template.?asset|template.?storage|package.?file/i),
    metadataColumns: "id, file_size, asset_type, mime_type, created_at, updated_at",
    metadataSource: "template_assets",
    metadataTable: "template_assets",
    provider: "supabase_storage",
    registryKey: "op-storage-metrics",
    storageMetricKey: "op-storage-metrics-template-assets",
    storageName: "Template assets metrics"
  },
  {
    groupKey: "theme-assets-metrics",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesStorageMetricsPattern(eventType, entityType, /theme.?asset|platform.?theme|brand.?image|favicon/i),
    metadataColumns: "id, file_size, asset_type, mime_type, created_at, updated_at",
    metadataSource: "platform_theme_assets",
    metadataTable: "platform_theme_assets",
    provider: "supabase_storage",
    registryKey: "op-storage-metrics",
    storageMetricKey: "op-storage-metrics-theme-assets",
    storageName: "Theme assets metrics"
  },
  {
    groupKey: "marketplace-assets-metrics",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesStorageMetricsPattern(eventType, entityType, /marketplace.?asset|gallery.?image|preview.?file/i),
    metadataColumns: "id, file_size, asset_type, mime_type, created_at, updated_at",
    metadataSource: "marketplace_assets",
    metadataTable: "marketplace_assets",
    provider: "supabase_storage",
    registryKey: "op-storage-metrics",
    storageMetricKey: "op-storage-metrics-marketplace-assets",
    storageName: "Marketplace assets metrics"
  },
  {
    groupKey: "email-assets-metrics",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesStorageMetricsPattern(eventType, entityType, /email.?asset|mail.?asset|attachment|smtp/i),
    metadataColumns: "id, status, created_at, updated_at",
    metadataSource: "email_event_logs",
    metadataTable: "email_event_logs",
    provider: "operations_registry",
    registryKey: "op-storage-metrics",
    storageMetricKey: "op-storage-metrics-email-assets",
    storageName: "Email assets metrics"
  },
  {
    groupKey: "report-export-metrics",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesStorageMetricsPattern(eventType, entityType, /report.?export|export.?storage|analytics.?export/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    provider: "operations_registry",
    registryKey: "op-storage-metrics",
    storageMetricKey: "op-storage-metrics-report-exports",
    storageName: "Report export metrics"
  },
  {
    groupKey: "backup-storage-metrics",
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesStorageMetricsPattern(eventType, entityType, /backup.?storage|backup.?metric|restore|disaster/i),
    metadataColumns: null,
    metadataSource: "operations_registry_runtime",
    metadataTable: null,
    provider: "operations_registry",
    registryKey: "op-backup",
    storageMetricKey: "op-storage-metrics-backup",
    storageName: "Backup storage metrics"
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
  return OPERATIONS_STORAGE_METRICS_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function matchesStorageMetricsPattern(eventType: string, entityType: string, pattern: RegExp) {
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

function isImageMime(value: string) {
  return /^image\//i.test(value) || /screenshot|preview_image|thumbnail|gallery_image|logo|favicon|og_image|brand_image/i.test(value);
}

function isDocumentMime(value: string) {
  return /pdf|document|documentation|text\/plain|application\/pdf|package_file/i.test(value);
}

function isExportMime(value: string) {
  return /export|report|csv|spreadsheet|analytics/i.test(value);
}

function isBackupMime(value: string) {
  return /backup|restore|archive|snapshot/i.test(value);
}

function aggregateMetadataRows(rows: AnyRecord[], definition: StorageMetricsDefinition): MetadataAggregate {
  let imageObjects = 0;
  let documentObjects = 0;
  let exportObjects = 0;
  let backupObjects = 0;
  let totalSizeBytes = 0;

  for (const row of rows) {
    const mimeType = text(row.mime_type) || text(row.content_type) || text(row.asset_type) || text(row.status);
    const fileSize = numberValue(row.file_size) || numberValue(row.total_size_bytes) || numberValue(row.size_bytes);

    totalSizeBytes += fileSize;

    if (isImageMime(mimeType)) {
      imageObjects += 1;
    }

    if (isDocumentMime(mimeType)) {
      documentObjects += 1;
    }

    if (isExportMime(mimeType)) {
      exportObjects += 1;
    }

    if (isBackupMime(mimeType)) {
      backupObjects += 1;
    }
  }

  return {
    backupObjects,
    documentObjects,
    exportObjects,
    imageObjects,
    lastMeasuredAt: latestDate(rows.flatMap((row) => [text(row.updated_at), text(row.created_at), text(row.measured_at)])),
    totalObjects: rows.length,
    totalSizeBytes
  };
}

function aggregateDedicatedMetricsRows(rows: AnyRecord[], storageMetricKey: string): MetadataAggregate | null {
  const matchingRows = rows.filter((row) => {
    const key = text(row.storage_metric_key) || text(row.storage_key) || text(row.metric_key);
    return !key || key === storageMetricKey || key.includes(storageMetricKey.replace("op-storage-metrics-", ""));
  });

  if (!matchingRows.length) {
    return null;
  }

  const totals = matchingRows.reduce<MetadataAggregate>(
    (accumulator, row) => ({
      backupObjects: accumulator.backupObjects + numberValue(row.backup_objects),
      documentObjects: accumulator.documentObjects + numberValue(row.document_objects),
      exportObjects: accumulator.exportObjects + numberValue(row.export_objects),
      imageObjects: accumulator.imageObjects + numberValue(row.image_objects),
      lastMeasuredAt: latestDate([
        accumulator.lastMeasuredAt,
        text(row.measured_at),
        text(row.last_measured_at),
        text(row.updated_at),
        text(row.created_at)
      ]),
      totalObjects: accumulator.totalObjects + numberValue(row.total_objects),
      totalSizeBytes: accumulator.totalSizeBytes + numberValue(row.total_size_bytes)
    }),
    {
      backupObjects: 0,
      documentObjects: 0,
      exportObjects: 0,
      imageObjects: 0,
      lastMeasuredAt: null,
      totalObjects: 0,
      totalSizeBytes: 0
    }
  );

  return totals.totalObjects > 0 || totals.totalSizeBytes > 0 ? totals : null;
}

function buildMonitoringMetricsSnapshot(events: AnyRecord[]) {
  const failures = events.filter((event) => {
    const eventStatus = text(event.event_status).toLowerCase();
    return eventStatus === "failed" || eventStatus.includes("error");
  });

  return {
    errorCount: failures.length,
    lastFailureAt: latestDate(failures.map((event) => text(event.created_at))),
    warningCount: events.filter((event) => text(event.event_status).toLowerCase() === "warning").length
  };
}

function resolveBucketName(definition: StorageMetricsDefinition) {
  if (definition.bucketEnvVar) {
    const envBucket = clip(text(process.env[definition.bucketEnvVar]), 160);
    if (envBucket) {
      return envBucket;
    }
  }

  return definition.bucketNameFallback ?? null;
}

function resolveReviewStatus(input: {
  errorCount: number;
  metricsDetected: boolean;
}): OperationsStorageMetricsReviewStatus {
  if (!input.metricsDetected) {
    return "not_applicable";
  }

  if (input.errorCount > 0) {
    return "review_required";
  }

  return "clear";
}

function resolveStorageMetricsRuntimeStatus(input: {
  errorCount: number;
  forceFutureHook?: boolean;
  metricsDetected: boolean;
  reviewStatus: OperationsStorageMetricsReviewStatus;
  totalObjects: number;
  warningCount: number;
}): OperationsStorageMetricsRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

  if (!input.metricsDetected) {
    return "no_metrics_detected";
  }

  if (input.errorCount > 0) {
    return "failed";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.warningCount > 0) {
    return "warning";
  }

  if (input.totalObjects === 0 && input.metricsDetected) {
    return "empty";
  }

  if (input.totalObjects > 0) {
    return "measured";
  }

  return "registered";
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

      console.warn(`[operations-storage-metrics-runtime] read-only metadata select failed for ${table}`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-storage-metrics-runtime] read-only metadata select crashed for ${table}`, error);
    return { rows: [], tableDetected: false };
  }
}

async function detectDedicatedStorageMetricsTable(supabase: SupabaseClient<Database>) {
  for (const tableName of STORAGE_METRICS_TABLE_CANDIDATES) {
    const result = await safeMetadataSelect(
      supabase,
      tableName,
      "id, storage_metric_key, storage_key, bucket_name, total_objects, total_size_bytes, image_objects, document_objects, export_objects, backup_objects, measured_at, created_at, updated_at",
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

  for (const definition of STORAGE_METRICS_DEFINITIONS) {
    partitioned.set(definition.storageMetricKey, []);
  }

  for (const row of rows) {
    const eventType = text(row.event_type);
    const entityType = text(row.entity_type);

    for (const definition of STORAGE_METRICS_DEFINITIONS) {
      if (definition.matchesMonitoringEvent(eventType, entityType)) {
        partitioned.get(definition.storageMetricKey)?.push(row);
      }
    }
  }

  return partitioned;
}

function buildStorageMetricsRuntimeItem(input: {
  dedicatedMetricsRows: AnyRecord[];
  dedicatedMetricsTableDetected: boolean;
  definition: StorageMetricsDefinition;
  metadataLoad: { rows: AnyRecord[]; tableDetected: boolean };
  monitoringRows: AnyRecord[];
  monitoringTableDetected: boolean;
}): OperationsStorageMetricsRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const monitoringSnapshot = buildMonitoringMetricsSnapshot(input.monitoringRows);
  const dedicatedAggregate = input.dedicatedMetricsTableDetected
    ? aggregateDedicatedMetricsRows(input.dedicatedMetricsRows, input.definition.storageMetricKey)
    : null;
  const metadataAggregate =
    input.definition.metadataTable && input.metadataLoad.tableDetected
      ? aggregateMetadataRows(input.metadataLoad.rows, input.definition)
      : null;
  const aggregate = dedicatedAggregate ?? metadataAggregate;
  const metricsDetected = Boolean(
    dedicatedAggregate ||
      (input.definition.metadataTable && input.metadataLoad.tableDetected) ||
      (input.definition.metadataTable === "monitoring_events" && input.monitoringTableDetected && input.monitoringRows.length > 0) ||
      (input.definition.metadataSource === "operations_registry_runtime" && registryEntry)
  );
  const totalObjects = aggregate?.totalObjects ?? (input.monitoringRows.length > 0 ? input.monitoringRows.length : 0);
  const totalSizeBytes = aggregate?.totalSizeBytes ?? 0;
  const reviewStatus = resolveReviewStatus({
    errorCount: monitoringSnapshot.errorCount,
    metricsDetected
  });
  const runtimeStatus = resolveStorageMetricsRuntimeStatus({
    errorCount: monitoringSnapshot.errorCount,
    metricsDetected,
    reviewStatus,
    totalObjects,
    warningCount: monitoringSnapshot.warningCount
  });

  return {
    backupObjects: aggregate?.backupObjects ?? 0,
    bucketName: resolveBucketName(input.definition),
    documentObjects: aggregate?.documentObjects ?? 0,
    errorCount: monitoringSnapshot.errorCount,
    exportObjects: aggregate?.exportObjects ?? 0,
    groupKey: input.definition.groupKey,
    imageObjects: aggregate?.imageObjects ?? 0,
    lastFailureAt: monitoringSnapshot.lastFailureAt,
    lastMeasuredAt: aggregate?.lastMeasuredAt ?? latestDate(input.monitoringRows.map((row) => text(row.created_at))),
    metricsDetected,
    metadataSource: input.definition.metadataSource,
    provider: input.definition.provider,
    reviewStatus,
    runtimeStatus,
    safeControls: buildSafeControls(),
    storageMetricKey: input.definition.storageMetricKey,
    storageName: input.definition.storageName,
    totalObjects,
    totalSizeBytes,
    visibility: registryEntry?.visibility ?? "super_admin",
    warningCount: monitoringSnapshot.warningCount
  };
}

function buildFutureStorageMetricsHookItems(): OperationsStorageMetricsRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /storage|metric|usage|bucket|backup|export logs/i.test(hook))
    .map((hook, index) => ({
      backupObjects: 0,
      bucketName: null,
      documentObjects: 0,
      errorCount: 0,
      exportObjects: 0,
      groupKey: "future-storage-metrics-hooks" as const,
      imageObjects: 0,
      lastFailureAt: null,
      lastMeasuredAt: null,
      metricsDetected: false,
      metadataSource: null,
      provider: "future_hook" as const,
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      storageMetricKey: `op-future-storage-metrics-hook-${index + 1}`,
      storageName: hook,
      totalObjects: 0,
      totalSizeBytes: 0,
      visibility: registryEntry?.visibility ?? "super_admin",
      warningCount: 0
    }));
}

export function operationsStorageMetricsRuntimeStatusLabel(status: OperationsStorageMetricsRuntimeStatus) {
  switch (status) {
    case "disabled":
      return "Disabled";
    case "empty":
      return "Empty";
    case "failed":
      return "Failed";
    case "future_hook":
      return "Future Hook";
    case "measured":
      return "Measured";
    case "no_metrics_detected":
      return "No Metrics Detected";
    case "registered":
      return "Registered";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function operationsStorageMetricsRuntimeStatusBadgeTone(status: OperationsStorageMetricsRuntimeStatus) {
  switch (status) {
    case "measured":
    case "registered":
      return "green" as const;
    case "empty":
    case "warning":
      return "blue" as const;
    case "failed":
    case "review_required":
      return "amber" as const;
    case "no_metrics_detected":
      return "red" as const;
    case "disabled":
    case "future_hook":
      return "slate" as const;
  }
}

export function formatStorageMetricsBytes(bytes: number) {
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

export function buildOperationsStorageMetricsRuntimeGroups(
  items: OperationsStorageMetricsRuntimeItem[]
): OperationsStorageMetricsRuntimeGroup[] {
  return STORAGE_METRICS_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsStorageMetricsRuntimeSummary(
  items: OperationsStorageMetricsRuntimeItem[]
): OperationsStorageMetricsRuntimeSummary {
  const operationalMetrics = items.filter((item) => item.groupKey !== "future-storage-metrics-hooks");
  const measuredMetrics = operationalMetrics.filter((item) => item.runtimeStatus === "measured").length;
  const warningMetrics = operationalMetrics.filter((item) => item.runtimeStatus === "warning").length;
  const failedMetrics = operationalMetrics.filter(
    (item) =>
      item.runtimeStatus === "failed" ||
      item.runtimeStatus === "review_required" ||
      item.runtimeStatus === "no_metrics_detected"
  ).length;
  const status =
    failedMetrics > 0 || warningMetrics > 0 ? ("needs_attention" as const) : ("storage_metrics_runtime_ready" as const);

  return {
    failedMetrics,
    groupCount: buildOperationsStorageMetricsRuntimeGroups(items).length,
    measuredMetrics,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_STORAGE_METRICS_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalMetrics.length} storage metrics`,
      `${measuredMetrics} measured`,
      `${warningMetrics} warning`,
      `${failedMetrics} require review`
    ].join("; "),
    totalMetrics: items.length,
    warningMetrics
  };
}

export async function loadOperationsStorageMetricsRuntimeReadOnlySafe(params: {
  supabase: SupabaseClient<Database>;
}) {
  const metadataTables = [...new Set(STORAGE_METRICS_DEFINITIONS.map((definition) => definition.metadataTable).filter(Boolean))] as string[];
  const [monitoringLoad, dedicatedMetricsTable, ...metadataLoads] = await Promise.all([
    safeMetadataSelect(
      params.supabase,
      "monitoring_events",
      "id, event_type, event_status, entity_type, created_at",
      500
    ),
    detectDedicatedStorageMetricsTable(params.supabase),
    ...metadataTables.map((table) => {
      const definition = STORAGE_METRICS_DEFINITIONS.find((item) => item.metadataTable === table);
      return safeMetadataSelect(params.supabase, table, definition?.metadataColumns ?? "id, created_at", 500);
    })
  ]);
  const metadataByTable = new Map<string, { rows: AnyRecord[]; tableDetected: boolean }>();

  metadataTables.forEach((table, index) => {
    metadataByTable.set(table, metadataLoads[index] ?? { rows: [], tableDetected: false });
  });

  const partitionedEvents = partitionMonitoringEvents(monitoringLoad.rows);
  const storageMetricsItems = [
    ...STORAGE_METRICS_DEFINITIONS.map((definition) =>
      buildStorageMetricsRuntimeItem({
        dedicatedMetricsRows: dedicatedMetricsTable.rows,
        dedicatedMetricsTableDetected: dedicatedMetricsTable.tableDetected,
        definition,
        metadataLoad: definition.metadataTable
          ? metadataByTable.get(definition.metadataTable) ?? { rows: [], tableDetected: false }
          : { rows: [], tableDetected: false },
        monitoringRows: partitionedEvents.get(definition.storageMetricKey) ?? [],
        monitoringTableDetected: monitoringLoad.tableDetected
      })
    ),
    ...buildFutureStorageMetricsHookItems()
  ];
  const groups = buildOperationsStorageMetricsRuntimeGroups(storageMetricsItems);
  const summary = getOperationsStorageMetricsRuntimeSummary(storageMetricsItems);

  return {
    groups,
    safeControls: buildSafeControls(),
    storageMetrics: summary,
    storageMetricsItems
  };
}

export function mapOperationsStorageMetricsRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsStorageMetricsRuntimeReadOnlySafe>>
) {
  return {
    groups: input.groups,
    safeControls: input.safeControls,
    storageMetrics: input.storageMetrics,
    storageMetricsItems: input.storageMetricsItems
  };
}
