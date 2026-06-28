import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsStorageRuntimeSource = "operations_storage_runtime";

export type OperationsStorageGroupKey =
  | "backup-storage"
  | "email-assets-storage"
  | "future-storage-hooks"
  | "marketplace-assets-storage"
  | "product-images-storage"
  | "report-exports-storage"
  | "template-assets-storage"
  | "theme-assets-storage";

export type OperationsStorageProvider =
  | "cloudflare_r2"
  | "future_hook"
  | "operations_registry"
  | "supabase_storage";

export type OperationsStorageHealthStatus =
  | "failed"
  | "healthy"
  | "not_configured"
  | "unknown"
  | "warning";

export type OperationsStorageRuntimeStatus =
  | "disabled"
  | "empty"
  | "failed"
  | "future_hook"
  | "healthy"
  | "no_metadata_detected"
  | "registered"
  | "review_required"
  | "warning";

export type OperationsStorageReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsStorageSafeControlKey = "cleanup" | "export_report" | "inspect" | "refresh_health" | "repair";

export type OperationsStorageSafeControl = {
  enabled: false;
  key: OperationsStorageSafeControlKey;
  label: string;
  note: string;
};

export type OperationsStorageRuntimeItem = {
  bucketName: string | null;
  errorCount: number;
  groupKey: OperationsStorageGroupKey;
  healthStatus: OperationsStorageHealthStatus;
  lastCheckedAt: string | null;
  lastFailureAt: string | null;
  metadataDetected: boolean;
  metadataSource: string | null;
  provider: OperationsStorageProvider;
  registryKey: string;
  reviewStatus: OperationsStorageReviewStatus;
  runtimeStatus: OperationsStorageRuntimeStatus;
  safeControls: OperationsStorageSafeControl[];
  storageKey: string;
  storageName: string;
  totalObjects: number;
  totalSizeBytes: number;
  visibility: OperationsRegistryVisibility;
  warningCount: number;
};

export type OperationsStorageRuntimeGroup = {
  groupKey: OperationsStorageGroupKey;
  itemCount: number;
  items: OperationsStorageRuntimeItem[];
  title: string;
};

export type OperationsStorageRuntimeSummary = {
  failedStorageTargets: number;
  groupCount: number;
  healthyStorageTargets: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsStorageRuntimeSource;
  status: "needs_attention" | "storage_runtime_ready";
  summary: string;
  totalStorageTargets: number;
  warningStorageTargets: number;
};

type AnyRecord = Record<string, unknown>;

type StorageDefinition = {
  bucketEnvVar?: string;
  configEnvVars?: readonly string[];
  groupKey: OperationsStorageGroupKey;
  metadataSource: string | null;
  provider: OperationsStorageProvider;
  registryKey: string;
  storageKey: string;
  storageName: string;
};

export const OPERATIONS_STORAGE_RUNTIME_SOURCE = "operations_storage_runtime" as const;

export const OPERATIONS_STORAGE_SAFE_CONTROLS: readonly OperationsStorageSafeControl[] = [
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No storage inspection or bucket listing runs during OP-6 page load."
  },
  {
    enabled: false,
    key: "refresh_health",
    label: "Refresh Health",
    note: "Read-only placeholder. No storage health refresh or provider scan runs during OP-6 page load."
  },
  {
    enabled: false,
    key: "repair",
    label: "Repair",
    note: "Read-only placeholder. No storage repair action is available during OP-6 page load."
  },
  {
    enabled: false,
    key: "cleanup",
    label: "Cleanup",
    note: "Read-only placeholder. No storage cleanup action is available during OP-6 page load."
  },
  {
    enabled: false,
    key: "export_report",
    label: "Export Report",
    note: "Read-only placeholder. No storage export report is generated during OP-6 page load."
  }
] as const;

const STORAGE_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsStorageGroupKey;
  title: string;
}> = [
  { groupKey: "product-images-storage", title: "Product Images Storage" },
  { groupKey: "template-assets-storage", title: "Template Assets Storage" },
  { groupKey: "theme-assets-storage", title: "Theme Assets Storage" },
  { groupKey: "marketplace-assets-storage", title: "Marketplace Assets Storage" },
  { groupKey: "email-assets-storage", title: "Email Assets Storage" },
  { groupKey: "report-exports-storage", title: "Report Exports Storage" },
  { groupKey: "backup-storage", title: "Backup Storage" },
  { groupKey: "future-storage-hooks", title: "Future Storage Hooks" }
];

const R2_CONFIG_ENV_VARS = [
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET"
] as const;

const STORAGE_DEFINITIONS: readonly StorageDefinition[] = [
  {
    bucketEnvVar: "CLOUDFLARE_R2_BUCKET",
    configEnvVars: R2_CONFIG_ENV_VARS,
    groupKey: "product-images-storage",
    metadataSource: "environment_configuration",
    provider: "cloudflare_r2",
    registryKey: "op-storage-health",
    storageKey: "op-storage-product-images",
    storageName: "Product images storage"
  },
  {
    groupKey: "template-assets-storage",
    metadataSource: "operations_registry_runtime",
    provider: "operations_registry",
    registryKey: "op-storage-metrics",
    storageKey: "op-storage-template-assets",
    storageName: "Template assets storage"
  },
  {
    groupKey: "theme-assets-storage",
    metadataSource: "operations_registry_runtime",
    provider: "operations_registry",
    registryKey: "op-storage-metrics",
    storageKey: "op-storage-theme-assets",
    storageName: "Theme assets storage"
  },
  {
    groupKey: "marketplace-assets-storage",
    metadataSource: "operations_registry_runtime",
    provider: "operations_registry",
    registryKey: "op-storage-metrics",
    storageKey: "op-storage-marketplace-assets",
    storageName: "Marketplace assets storage"
  },
  {
    groupKey: "email-assets-storage",
    metadataSource: "operations_registry_runtime",
    provider: "operations_registry",
    registryKey: "op-storage-metrics",
    storageKey: "op-storage-email-assets",
    storageName: "Email assets storage"
  },
  {
    groupKey: "report-exports-storage",
    metadataSource: "operations_registry_runtime",
    provider: "operations_registry",
    registryKey: "op-storage-metrics",
    storageKey: "op-storage-report-exports",
    storageName: "Report exports storage"
  },
  {
    groupKey: "backup-storage",
    metadataSource: "operations_registry_runtime",
    provider: "operations_registry",
    registryKey: "op-backup",
    storageKey: "op-storage-backup",
    storageName: "Backup storage"
  }
] as const;

const STORAGE_METADATA_TABLE_CANDIDATES = [
  "storage_health_metadata",
  "platform_storage_health",
  "storage_registry_items"
] as const;

function text(value: unknown, maxLength = 500) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function asRecords(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") as AnyRecord[] : [];
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const message = text(error.message).toLowerCase();
  return error.code === "42P01" || message.includes("does not exist") || message.includes("could not find the table");
}

function buildSafeControls() {
  return OPERATIONS_STORAGE_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function resolveEnvConfigurationStatus(names: readonly string[]) {
  if (!names.length) {
    return "configured" as const;
  }

  const configuredCount = names.filter((name) => Boolean(process.env[name])).length;

  if (configuredCount === names.length) {
    return "configured" as const;
  }

  return configuredCount > 0 ? ("partial" as const) : ("missing" as const);
}

function resolveBucketName(envVar?: string) {
  if (!envVar) {
    return null;
  }

  const bucketName = text(process.env[envVar], 160);
  return bucketName || null;
}

function buildMonitoringStorageSnapshot(events: AnyRecord[]) {
  const storageEvents = events.filter((event) => {
    const eventType = text(event.event_type).toLowerCase();
    const entityType = text(event.entity_type).toLowerCase();
    return eventType.includes("storage") || entityType.includes("storage") || eventType.includes("r2");
  });
  const failures = storageEvents.filter((event) => {
    const eventStatus = text(event.event_status).toLowerCase();
    return eventStatus === "failed" || eventStatus.includes("error");
  });

  return {
    errorCount: failures.length,
    lastFailureAt:
      failures
        .map((event) => text(event.created_at))
        .filter(Boolean)
        .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null,
    warningCount: storageEvents.filter((event) => text(event.event_status).toLowerCase() === "warning").length
  };
}

function resolveReviewStatus(input: {
  errorCount: number;
  healthStatus: OperationsStorageHealthStatus;
  metadataDetected: boolean;
}): OperationsStorageReviewStatus {
  if (!input.metadataDetected) {
    return "not_applicable";
  }

  if (input.errorCount > 0 || input.healthStatus === "failed") {
    return "review_required";
  }

  if (input.healthStatus === "warning") {
    return "clear";
  }

  return "clear";
}

function resolveHealthStatus(input: {
  configStatus: "configured" | "missing" | "partial";
  errorCount: number;
  metadataDetected: boolean;
}): OperationsStorageHealthStatus {
  if (!input.metadataDetected) {
    return "not_configured";
  }

  if (input.errorCount > 0) {
    return "failed";
  }

  if (input.configStatus === "partial") {
    return "warning";
  }

  if (input.configStatus === "missing") {
    return "not_configured";
  }

  return "healthy";
}

function resolveStorageRuntimeStatus(input: {
  forceDisabled?: boolean;
  forceFutureHook?: boolean;
  healthStatus: OperationsStorageHealthStatus;
  metadataDetected: boolean;
  reviewStatus: OperationsStorageReviewStatus;
}): OperationsStorageRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

  if (input.forceDisabled) {
    return "disabled";
  }

  if (!input.metadataDetected) {
    return "no_metadata_detected";
  }

  if (input.healthStatus === "failed") {
    return "failed";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.healthStatus === "warning") {
    return "warning";
  }

  if (input.healthStatus === "healthy") {
    return "healthy";
  }

  if (input.healthStatus === "not_configured") {
    return "registered";
  }

  return "empty";
}

async function safeStorageMetadataSelect(
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

      console.warn(`[operations-storage-runtime] read-only storage metadata select failed for ${table}`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-storage-runtime] read-only storage metadata select crashed for ${table}`, error);
    return { rows: [], tableDetected: false };
  }
}

async function detectDedicatedStorageMetadataTable(supabase: SupabaseClient<Database>) {
  for (const tableName of STORAGE_METADATA_TABLE_CANDIDATES) {
    const result = await safeStorageMetadataSelect(supabase, tableName, "id, storage_key, created_at", 1);

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

function buildStorageRuntimeItem(input: {
  definition: StorageDefinition;
  dedicatedMetadataTableDetected: boolean;
  monitoringSnapshot: ReturnType<typeof buildMonitoringStorageSnapshot>;
}): OperationsStorageRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const configStatus = input.definition.configEnvVars
    ? resolveEnvConfigurationStatus(input.definition.configEnvVars)
    : "configured";
  const metadataDetected = input.definition.configEnvVars
    ? configStatus !== "missing"
    : Boolean(input.definition.metadataSource) || input.dedicatedMetadataTableDetected;
  const errorCount = input.definition.provider === "cloudflare_r2" ? input.monitoringSnapshot.errorCount : 0;
  const warningCount =
    input.definition.provider === "cloudflare_r2"
      ? input.monitoringSnapshot.warningCount + (configStatus === "partial" ? 1 : 0)
      : configStatus === "partial"
        ? 1
        : 0;
  const healthStatus = resolveHealthStatus({
    configStatus,
    errorCount,
    metadataDetected
  });
  const reviewStatus = resolveReviewStatus({
    errorCount,
    healthStatus,
    metadataDetected
  });

  return {
    bucketName: resolveBucketName(input.definition.bucketEnvVar),
    errorCount,
    groupKey: input.definition.groupKey,
    healthStatus,
    lastCheckedAt: null,
    lastFailureAt: input.definition.provider === "cloudflare_r2" ? input.monitoringSnapshot.lastFailureAt : null,
    metadataDetected,
    metadataSource: input.definition.metadataSource,
    provider: input.definition.provider,
    registryKey: input.definition.registryKey,
    reviewStatus,
    runtimeStatus: resolveStorageRuntimeStatus({
      healthStatus,
      metadataDetected,
      reviewStatus
    }),
    safeControls: buildSafeControls(),
    storageKey: input.definition.storageKey,
    storageName: input.definition.storageName,
    totalObjects: 0,
    totalSizeBytes: 0,
    visibility: registryEntry?.visibility ?? "super_admin",
    warningCount
  };
}

function buildFutureStorageHookItems(): OperationsStorageRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /storage|backup|restore|export logs/i.test(hook))
    .map((hook, index) => ({
      bucketName: null,
      errorCount: 0,
      groupKey: "future-storage-hooks" as const,
      healthStatus: "unknown" as const,
      lastCheckedAt: null,
      lastFailureAt: null,
      metadataDetected: false,
      metadataSource: null,
      provider: "future_hook" as const,
      registryKey: "op-future-hooks",
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      storageKey: `op-future-storage-hook-${index + 1}`,
      storageName: hook,
      totalObjects: 0,
      totalSizeBytes: 0,
      visibility: registryEntry?.visibility ?? "super_admin",
      warningCount: 0
    }));
}

export function operationsStorageRuntimeStatusLabel(status: OperationsStorageRuntimeStatus) {
  switch (status) {
    case "disabled":
      return "Disabled";
    case "empty":
      return "Empty";
    case "failed":
      return "Failed";
    case "future_hook":
      return "Future Hook";
    case "healthy":
      return "Healthy";
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

export function operationsStorageRuntimeStatusBadgeTone(status: OperationsStorageRuntimeStatus) {
  switch (status) {
    case "healthy":
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

export function operationsStorageHealthStatusLabel(status: OperationsStorageHealthStatus) {
  switch (status) {
    case "failed":
      return "Failed";
    case "healthy":
      return "Healthy";
    case "not_configured":
      return "Not configured";
    case "unknown":
      return "Unknown";
    case "warning":
      return "Warning";
  }
}

export function buildOperationsStorageRuntimeGroups(items: OperationsStorageRuntimeItem[]): OperationsStorageRuntimeGroup[] {
  return STORAGE_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsStorageRuntimeSummary(items: OperationsStorageRuntimeItem[]): OperationsStorageRuntimeSummary {
  const operationalTargets = items.filter((item) => item.groupKey !== "future-storage-hooks");
  const healthyStorageTargets = operationalTargets.filter((item) => item.runtimeStatus === "healthy").length;
  const warningStorageTargets = operationalTargets.filter((item) => item.runtimeStatus === "warning").length;
  const failedStorageTargets = operationalTargets.filter(
    (item) => item.runtimeStatus === "failed" || item.reviewStatus === "review_required"
  ).length;
  const status =
    failedStorageTargets > 0 ||
    operationalTargets.some((item) => item.runtimeStatus === "no_metadata_detected") ||
    warningStorageTargets > 0
      ? ("needs_attention" as const)
      : ("storage_runtime_ready" as const);

  return {
    failedStorageTargets,
    groupCount: buildOperationsStorageRuntimeGroups(items).length,
    healthyStorageTargets,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_STORAGE_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalTargets.length} storage targets`,
      `${healthyStorageTargets} healthy`,
      `${failedStorageTargets} require review`
    ].join("; "),
    totalStorageTargets: items.length,
    warningStorageTargets
  };
}

export async function loadOperationsStorageRuntimeReadOnlySafe(params: {
  monitoringEvents: AnyRecord[];
  supabase: SupabaseClient<Database>;
}) {
  const dedicatedMetadataTable = await detectDedicatedStorageMetadataTable(params.supabase);
  const monitoringSnapshot = buildMonitoringStorageSnapshot(params.monitoringEvents);

  const storageItems = [
    ...STORAGE_DEFINITIONS.map((definition) =>
      buildStorageRuntimeItem({
        definition,
        dedicatedMetadataTableDetected: dedicatedMetadataTable.tableDetected,
        monitoringSnapshot
      })
    ),
    ...buildFutureStorageHookItems()
  ];

  const groups = buildOperationsStorageRuntimeGroups(storageItems);
  const summary = getOperationsStorageRuntimeSummary(storageItems);

  return {
    groups,
    safeControls: buildSafeControls(),
    storageItems,
    storageRuntime: summary
  };
}

export function mapOperationsStorageRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsStorageRuntimeReadOnlySafe>>
) {
  return {
    groups: input.groups,
    safeControls: input.safeControls,
    storageItems: input.storageItems,
    storageRuntime: input.storageRuntime
  };
}
