import "server-only";

import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsDatabaseRuntimeSource = "operations_database_runtime";

export type OperationsDatabaseGroupKey =
  | "billing-tables"
  | "core-platform-tables"
  | "email-tables"
  | "future-database-hooks"
  | "marketplace-tables"
  | "notifications-tables"
  | "operations-tables"
  | "reports-tables"
  | "seo-tables"
  | "store-tables"
  | "supabase-runtime";

export type OperationsDatabaseProvider = "future_hook" | "operations_registry" | "supabase";

export type OperationsDatabaseHealthStatus =
  | "failed"
  | "healthy"
  | "not_configured"
  | "unknown"
  | "warning";

export type OperationsDatabaseRuntimeStatus =
  | "disabled"
  | "empty"
  | "failed"
  | "future_hook"
  | "healthy"
  | "no_metadata_detected"
  | "registered"
  | "review_required"
  | "warning";

export type OperationsDatabaseReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsDatabaseSafeControlKey =
  | "export_report"
  | "inspect"
  | "refresh_health"
  | "review_migrations"
  | "review_policies";

export type OperationsDatabaseSafeControl = {
  enabled: false;
  key: OperationsDatabaseSafeControlKey;
  label: string;
  note: string;
};

export type OperationsDatabaseRuntimeItem = {
  databaseKey: string;
  databaseName: string;
  errorCount: number;
  groupKey: OperationsDatabaseGroupKey;
  healthStatus: OperationsDatabaseHealthStatus;
  lastCheckedAt: string | null;
  lastFailureAt: string | null;
  metadataDetected: boolean;
  metadataSource: string | null;
  migrationCount: number;
  policyCount: number;
  provider: OperationsDatabaseProvider;
  registryKey: string;
  reviewStatus: OperationsDatabaseReviewStatus;
  runtimeStatus: OperationsDatabaseRuntimeStatus;
  safeControls: OperationsDatabaseSafeControl[];
  tableCount: number;
  visibility: OperationsRegistryVisibility;
  warningCount: number;
};

export type OperationsDatabaseRuntimeGroup = {
  groupKey: OperationsDatabaseGroupKey;
  itemCount: number;
  items: OperationsDatabaseRuntimeItem[];
  title: string;
};

export type OperationsDatabaseRuntimeSummary = {
  failedDatabaseTargets: number;
  groupCount: number;
  healthyDatabaseTargets: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsDatabaseRuntimeSource;
  status: "database_runtime_ready" | "needs_attention";
  summary: string;
  totalDatabaseTargets: number;
  warningDatabaseTargets: number;
};

type AnyRecord = Record<string, unknown>;

type DatabaseDefinition = {
  databaseKey: string;
  databaseName: string;
  groupKey: OperationsDatabaseGroupKey;
  metadataSource: string | null;
  probeTables: readonly string[];
  provider: OperationsDatabaseProvider;
  registryKey: string;
  requiresServiceRole?: boolean;
  requiresSupabaseConfig?: boolean;
};

export const OPERATIONS_DATABASE_RUNTIME_SOURCE = "operations_database_runtime" as const;

export const OPERATIONS_DATABASE_SAFE_CONTROLS: readonly OperationsDatabaseSafeControl[] = [
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No database inspection or schema scan runs during OP-7 page load."
  },
  {
    enabled: false,
    key: "refresh_health",
    label: "Refresh Health",
    note: "Read-only placeholder. No database health refresh runs during OP-7 page load."
  },
  {
    enabled: false,
    key: "review_policies",
    label: "Review Policies",
    note: "Read-only placeholder. No RLS or policy review mutation runs during OP-7 page load."
  },
  {
    enabled: false,
    key: "review_migrations",
    label: "Review Migrations",
    note: "Read-only placeholder. No migration execution runs during OP-7 page load."
  },
  {
    enabled: false,
    key: "export_report",
    label: "Export Report",
    note: "Read-only placeholder. No database export report is generated during OP-7 page load."
  }
] as const;

const DATABASE_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsDatabaseGroupKey;
  title: string;
}> = [
  { groupKey: "supabase-runtime", title: "Supabase Runtime" },
  { groupKey: "core-platform-tables", title: "Core Platform Tables" },
  { groupKey: "billing-tables", title: "Billing Tables" },
  { groupKey: "store-tables", title: "Store Tables" },
  { groupKey: "marketplace-tables", title: "Marketplace Tables" },
  { groupKey: "email-tables", title: "Email Tables" },
  { groupKey: "notifications-tables", title: "Notifications Tables" },
  { groupKey: "seo-tables", title: "SEO Tables" },
  { groupKey: "reports-tables", title: "Reports Tables" },
  { groupKey: "operations-tables", title: "Operations Tables" },
  { groupKey: "future-database-hooks", title: "Future Database Hooks" }
];

const DATABASE_DEFINITIONS: readonly DatabaseDefinition[] = [
  {
    databaseKey: "op-database-supabase-runtime",
    databaseName: "Supabase runtime",
    groupKey: "supabase-runtime",
    metadataSource: "environment_configuration",
    probeTables: [],
    provider: "supabase",
    registryKey: "op-database-health",
    requiresServiceRole: true,
    requiresSupabaseConfig: true
  },
  {
    databaseKey: "op-database-core-platform",
    databaseName: "Core platform tables",
    groupKey: "core-platform-tables",
    metadataSource: "certified_table_probes",
    probeTables: ["stores", "workspaces", "workspace_members"],
    provider: "supabase",
    registryKey: "op-database-health"
  },
  {
    databaseKey: "op-database-billing",
    databaseName: "Billing tables",
    groupKey: "billing-tables",
    metadataSource: "certified_table_probes",
    probeTables: ["billing_events", "user_subscriptions", "subscription_plans"],
    provider: "supabase",
    registryKey: "op-database-health"
  },
  {
    databaseKey: "op-database-store",
    databaseName: "Store tables",
    groupKey: "store-tables",
    metadataSource: "certified_table_probes",
    probeTables: ["store_orders", "store_customers", "inventory_movements"],
    provider: "supabase",
    registryKey: "op-database-health"
  },
  {
    databaseKey: "op-database-marketplace",
    databaseName: "Marketplace tables",
    groupKey: "marketplace-tables",
    metadataSource: "certified_table_probes",
    probeTables: ["marketplace_items", "marketplace_assets", "template_assets"],
    provider: "supabase",
    registryKey: "op-database-health"
  },
  {
    databaseKey: "op-database-email",
    databaseName: "Email tables",
    groupKey: "email-tables",
    metadataSource: "certified_table_probes",
    probeTables: ["email_event_logs", "email_registry_items"],
    provider: "supabase",
    registryKey: "op-database-health"
  },
  {
    databaseKey: "op-database-notifications",
    databaseName: "Notifications tables",
    groupKey: "notifications-tables",
    metadataSource: "certified_table_probes",
    probeTables: ["notification_registry_items"],
    provider: "supabase",
    registryKey: "op-database-health"
  },
  {
    databaseKey: "op-database-seo",
    databaseName: "SEO tables",
    groupKey: "seo-tables",
    metadataSource: "certified_table_probes",
    probeTables: ["platform_pages", "platform_page_blocks"],
    provider: "supabase",
    registryKey: "op-database-health"
  },
  {
    databaseKey: "op-database-reports",
    databaseName: "Reports tables",
    groupKey: "reports-tables",
    metadataSource: "reports_registry_runtime",
    probeTables: [],
    provider: "operations_registry",
    registryKey: "op-database-health"
  },
  {
    databaseKey: "op-database-operations",
    databaseName: "Operations tables",
    groupKey: "operations-tables",
    metadataSource: "certified_table_probes",
    probeTables: ["monitoring_events", "ai_generation_queue"],
    provider: "supabase",
    registryKey: "op-database-health"
  }
] as const;

const DATABASE_METADATA_TABLE_CANDIDATES = [
  "database_health_metadata",
  "platform_database_health",
  "database_registry_items"
] as const;

function text(value: unknown, maxLength = 500) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const message = text(error.message).toLowerCase();
  return error.code === "42P01" || message.includes("does not exist") || message.includes("could not find the table");
}

function buildSafeControls() {
  return OPERATIONS_DATABASE_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function countMigrationFilesSafe() {
  try {
    const migrationsDir = join(process.cwd(), "supabase", "migrations");
    return readdirSync(migrationsDir).filter((fileName) => fileName.endsWith(".sql")).length;
  } catch {
    return 0;
  }
}

function buildMonitoringDatabaseSnapshot(events: AnyRecord[]) {
  const databaseEvents = events.filter((event) => {
    const eventType = text(event.event_type).toLowerCase();
    const entityType = text(event.entity_type).toLowerCase();
    return (
      eventType.includes("database") ||
      eventType.includes("postgres") ||
      eventType.includes("supabase") ||
      entityType.includes("database")
    );
  });
  const failures = databaseEvents.filter((event) => {
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
    warningCount: databaseEvents.filter((event) => text(event.event_status).toLowerCase() === "warning").length
  };
}

function resolveReviewStatus(input: {
  errorCount: number;
  healthStatus: OperationsDatabaseHealthStatus;
  metadataDetected: boolean;
}): OperationsDatabaseReviewStatus {
  if (!input.metadataDetected) {
    return "not_applicable";
  }

  if (input.errorCount > 0 || input.healthStatus === "failed") {
    return "review_required";
  }

  return "clear";
}

function resolveHealthStatus(input: {
  errorCount: number;
  metadataDetected: boolean;
  tableCount: number;
  warningCount: number;
}): OperationsDatabaseHealthStatus {
  if (!input.metadataDetected) {
    return "not_configured";
  }

  if (input.errorCount > 0) {
    return "failed";
  }

  if (input.warningCount > 0) {
    return "warning";
  }

  if (input.tableCount > 0 || input.metadataDetected) {
    return "healthy";
  }

  return "unknown";
}

function resolveDatabaseRuntimeStatus(input: {
  forceDisabled?: boolean;
  forceFutureHook?: boolean;
  healthStatus: OperationsDatabaseHealthStatus;
  metadataDetected: boolean;
  reviewStatus: OperationsDatabaseReviewStatus;
  tableCount: number;
}): OperationsDatabaseRuntimeStatus {
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

  if (input.tableCount === 0 && input.healthStatus === "healthy") {
    return "registered";
  }

  if (input.tableCount === 0) {
    return "empty";
  }

  if (input.healthStatus === "healthy") {
    return "healthy";
  }

  return "registered";
}

async function probeTableExists(supabase: SupabaseClient<Database>, tableName: string) {
  try {
    const { error } = await supabase.from(tableName as never).select("id", { count: "exact", head: true });

    if (error) {
      if (isMissingTableError(error)) {
        return false;
      }

      console.warn(`[operations-database-runtime] read-only table probe failed for ${tableName}`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`[operations-database-runtime] read-only table probe crashed for ${tableName}`, error);
    return false;
  }
}

async function detectDedicatedDatabaseMetadataTable(supabase: SupabaseClient<Database>) {
  for (const tableName of DATABASE_METADATA_TABLE_CANDIDATES) {
    const detected = await probeTableExists(supabase, tableName);

    if (detected) {
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

async function buildTableProbeMap(supabase: SupabaseClient<Database>, tableNames: readonly string[]) {
  const uniqueTables = [...new Set(tableNames)];
  const entries = await Promise.all(
    uniqueTables.map(async (tableName) => [tableName, await probeTableExists(supabase, tableName)] as const)
  );

  return new Map(entries);
}

function buildDatabaseRuntimeItem(input: {
  definition: DatabaseDefinition;
  dedicatedMetadataTableDetected: boolean;
  migrationCount: number;
  monitoringSnapshot: ReturnType<typeof buildMonitoringDatabaseSnapshot>;
  serviceRoleConfigured: boolean;
  supabaseConfigured: boolean;
  tableProbeMap: Map<string, boolean>;
}): OperationsDatabaseRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const detectedTables = input.definition.probeTables.filter((tableName) => input.tableProbeMap.get(tableName));
  const tableCount = detectedTables.length;
  const configMetadataDetected = input.definition.requiresSupabaseConfig
    ? input.supabaseConfigured
    : input.definition.probeTables.length > 0
      ? tableCount > 0
      : Boolean(input.definition.metadataSource) || input.dedicatedMetadataTableDetected;
  const serviceRoleWarning = input.definition.requiresServiceRole && !input.serviceRoleConfigured ? 1 : 0;
  const metadataDetected =
    configMetadataDetected ||
    input.dedicatedMetadataTableDetected ||
    (input.definition.provider === "operations_registry" && Boolean(input.definition.metadataSource));
  const errorCount = input.definition.groupKey === "supabase-runtime" ? input.monitoringSnapshot.errorCount : 0;
  const warningCount =
    input.definition.groupKey === "supabase-runtime"
      ? input.monitoringSnapshot.warningCount + serviceRoleWarning
      : serviceRoleWarning;
  const healthStatus = resolveHealthStatus({
    errorCount,
    metadataDetected,
    tableCount,
    warningCount
  });
  const reviewStatus = resolveReviewStatus({
    errorCount,
    healthStatus,
    metadataDetected
  });

  return {
    databaseKey: input.definition.databaseKey,
    databaseName: input.definition.databaseName,
    errorCount,
    groupKey: input.definition.groupKey,
    healthStatus,
    lastCheckedAt: null,
    lastFailureAt: input.definition.groupKey === "supabase-runtime" ? input.monitoringSnapshot.lastFailureAt : null,
    metadataDetected,
    metadataSource: input.definition.metadataSource,
    migrationCount: input.definition.groupKey === "supabase-runtime" ? input.migrationCount : 0,
    policyCount: 0,
    provider: input.definition.provider,
    registryKey: input.definition.registryKey,
    reviewStatus,
    runtimeStatus: resolveDatabaseRuntimeStatus({
      healthStatus,
      metadataDetected,
      reviewStatus,
      tableCount
    }),
    safeControls: buildSafeControls(),
    tableCount,
    visibility: registryEntry?.visibility ?? "super_admin",
    warningCount
  };
}

function buildFutureDatabaseHookItems(): OperationsDatabaseRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /database|migration|policy|schema|repair|seed|ensure/i.test(hook))
    .map((hook, index) => ({
      databaseKey: `op-future-database-hook-${index + 1}`,
      databaseName: hook,
      errorCount: 0,
      groupKey: "future-database-hooks" as const,
      healthStatus: "unknown" as const,
      lastCheckedAt: null,
      lastFailureAt: null,
      metadataDetected: false,
      metadataSource: null,
      migrationCount: 0,
      policyCount: 0,
      provider: "future_hook" as const,
      registryKey: "op-future-hooks",
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      tableCount: 0,
      visibility: registryEntry?.visibility ?? "super_admin",
      warningCount: 0
    }));
}

export function operationsDatabaseRuntimeStatusLabel(status: OperationsDatabaseRuntimeStatus) {
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

export function operationsDatabaseRuntimeStatusBadgeTone(status: OperationsDatabaseRuntimeStatus) {
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

export function operationsDatabaseHealthStatusLabel(status: OperationsDatabaseHealthStatus) {
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

export function buildOperationsDatabaseRuntimeGroups(items: OperationsDatabaseRuntimeItem[]): OperationsDatabaseRuntimeGroup[] {
  return DATABASE_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsDatabaseRuntimeSummary(items: OperationsDatabaseRuntimeItem[]): OperationsDatabaseRuntimeSummary {
  const operationalTargets = items.filter((item) => item.groupKey !== "future-database-hooks");
  const healthyDatabaseTargets = operationalTargets.filter((item) => item.runtimeStatus === "healthy").length;
  const warningDatabaseTargets = operationalTargets.filter((item) => item.runtimeStatus === "warning").length;
  const failedDatabaseTargets = operationalTargets.filter(
    (item) => item.runtimeStatus === "failed" || item.reviewStatus === "review_required"
  ).length;
  const status =
    failedDatabaseTargets > 0 ||
    operationalTargets.some((item) => item.runtimeStatus === "no_metadata_detected") ||
    warningDatabaseTargets > 0
      ? ("needs_attention" as const)
      : ("database_runtime_ready" as const);

  return {
    failedDatabaseTargets,
    groupCount: buildOperationsDatabaseRuntimeGroups(items).length,
    healthyDatabaseTargets,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_DATABASE_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalTargets.length} database targets`,
      `${healthyDatabaseTargets} healthy`,
      `${failedDatabaseTargets} require review`
    ].join("; "),
    totalDatabaseTargets: items.length,
    warningDatabaseTargets
  };
}

export async function loadOperationsDatabaseRuntimeReadOnlySafe(params: {
  monitoringEvents: AnyRecord[];
  serviceRoleConfigured: boolean;
  supabase: SupabaseClient<Database>;
  supabaseConfigured: boolean;
}) {
  const dedicatedMetadataTable = await detectDedicatedDatabaseMetadataTable(params.supabase);
  const monitoringSnapshot = buildMonitoringDatabaseSnapshot(params.monitoringEvents);
  const migrationCount = countMigrationFilesSafe();
  const allProbeTables = DATABASE_DEFINITIONS.flatMap((definition) => [...definition.probeTables]);
  const tableProbeMap = await buildTableProbeMap(params.supabase, allProbeTables);

  const databaseItems = [
    ...DATABASE_DEFINITIONS.map((definition) =>
      buildDatabaseRuntimeItem({
        definition,
        dedicatedMetadataTableDetected: dedicatedMetadataTable.tableDetected,
        migrationCount,
        monitoringSnapshot,
        serviceRoleConfigured: params.serviceRoleConfigured,
        supabaseConfigured: params.supabaseConfigured,
        tableProbeMap
      })
    ),
    ...buildFutureDatabaseHookItems()
  ];

  const groups = buildOperationsDatabaseRuntimeGroups(databaseItems);
  const summary = getOperationsDatabaseRuntimeSummary(databaseItems);

  return {
    databaseItems,
    databaseRuntime: summary,
    groups,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsDatabaseRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsDatabaseRuntimeReadOnlySafe>>
) {
  return {
    databaseItems: input.databaseItems,
    databaseRuntime: input.databaseRuntime,
    groups: input.groups,
    safeControls: input.safeControls
  };
}
