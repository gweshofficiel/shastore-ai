import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsCronMonitoringRuntimeSource = "operations_cron_monitoring_runtime";

export type OperationsCronMonitoringGroupKey =
  | "backup-cron-monitoring"
  | "billing-cron-monitoring"
  | "email-cron-monitoring"
  | "future-cron-monitoring-hooks"
  | "notification-cron-monitoring"
  | "operations-cron-monitoring"
  | "reports-cron-monitoring"
  | "seo-cron-monitoring";

export type OperationsCronMonitoringRuntimeStatus =
  | "disabled"
  | "empty"
  | "failed"
  | "future_hook"
  | "healthy"
  | "idle"
  | "no_metadata_detected"
  | "registered"
  | "review_required"
  | "warning";

export type OperationsCronMonitoringStatus = "failed" | "healthy" | "idle" | "unknown" | "warning";

export type OperationsCronMonitoringReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsCronMonitoringSafeControlKey =
  | "export_report"
  | "inspect_runs"
  | "pause_cron"
  | "resume_cron"
  | "trigger_now";

export type OperationsCronMonitoringSafeControl = {
  enabled: false;
  key: OperationsCronMonitoringSafeControlKey;
  label: string;
  note: string;
};

export type OperationsCronMonitoringRuntimeItem = {
  cronMonitoringKey: string;
  cronName: string;
  cronType: string;
  errorCount: number;
  failedRuns: number;
  groupKey: OperationsCronMonitoringGroupKey;
  lastFailureAt: string | null;
  lastRunAt: string | null;
  metadataDetected: boolean;
  monitoringStatus: OperationsCronMonitoringStatus;
  nextRunAt: string | null;
  reviewStatus: OperationsCronMonitoringReviewStatus;
  runtimeStatus: OperationsCronMonitoringRuntimeStatus;
  safeControls: OperationsCronMonitoringSafeControl[];
  safeSummary: string;
  scheduleExpression: string;
  timezone: string;
  totalRuns: number;
  visibility: OperationsRegistryVisibility;
  warningCount: number;
};

export type OperationsCronMonitoringRuntimeGroup = {
  groupKey: OperationsCronMonitoringGroupKey;
  itemCount: number;
  items: OperationsCronMonitoringRuntimeItem[];
  title: string;
};

export type OperationsCronMonitoringRuntimeSummary = {
  failedCrons: number;
  groupCount: number;
  healthyCrons: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsCronMonitoringRuntimeSource;
  status: "cron_monitoring_runtime_ready" | "needs_attention";
  summary: string;
  totalCrons: number;
  warningCrons: number;
};

type AnyRecord = Record<string, unknown>;

type CronMonitoringDefinition = {
  cronMonitoringKey: string;
  cronName: string;
  cronType: string;
  groupKey: OperationsCronMonitoringGroupKey;
  matchesEvent: (eventType: string, entityType: string) => boolean;
  metadataColumns: string | null;
  metadataSource: string | null;
  metadataTable: string | null;
  registryKey: string;
  scheduleExpression: string;
  timezone: string;
};

export const OPERATIONS_CRON_MONITORING_RUNTIME_SOURCE = "operations_cron_monitoring_runtime" as const;

export const OPERATIONS_CRON_MONITORING_SAFE_CONTROLS: readonly OperationsCronMonitoringSafeControl[] = [
  {
    enabled: false,
    key: "inspect_runs",
    label: "Inspect Runs",
    note: "Read-only placeholder. No cron run inspection runs during OP-13 page load."
  },
  {
    enabled: false,
    key: "trigger_now",
    label: "Trigger Now",
    note: "Read-only placeholder. No cron trigger runs during OP-13 page load."
  },
  {
    enabled: false,
    key: "pause_cron",
    label: "Pause Cron",
    note: "Read-only placeholder. No cron pause runs during OP-13 page load."
  },
  {
    enabled: false,
    key: "resume_cron",
    label: "Resume Cron",
    note: "Read-only placeholder. No cron resume runs during OP-13 page load."
  },
  {
    enabled: false,
    key: "export_report",
    label: "Export Report",
    note: "Read-only placeholder. No cron monitoring export or diagnostics run during OP-13 page load."
  }
] as const;

const CRON_MONITORING_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsCronMonitoringGroupKey;
  title: string;
}> = [
  { groupKey: "email-cron-monitoring", title: "Email Cron Monitoring" },
  { groupKey: "notification-cron-monitoring", title: "Notification Cron Monitoring" },
  { groupKey: "seo-cron-monitoring", title: "SEO Cron Monitoring" },
  { groupKey: "reports-cron-monitoring", title: "Reports Cron Monitoring" },
  { groupKey: "billing-cron-monitoring", title: "Billing Cron Monitoring" },
  { groupKey: "backup-cron-monitoring", title: "Backup Cron Monitoring" },
  { groupKey: "operations-cron-monitoring", title: "Operations Cron Monitoring" },
  { groupKey: "future-cron-monitoring-hooks", title: "Future Cron Monitoring Hooks" }
];

const CRON_TABLE_CANDIDATES = ["cron_jobs", "platform_cron_jobs", "scheduled_jobs", "scheduled_cron_jobs"] as const;

const CRON_MONITORING_DEFINITIONS: readonly CronMonitoringDefinition[] = [
  {
    cronMonitoringKey: "op-cron-monitoring-email",
    cronName: "Email cron monitoring",
    cronType: "email_cron",
    groupKey: "email-cron-monitoring",
    matchesEvent: (eventType, entityType) =>
      matchesCronPattern(eventType, entityType, /email|mail|smtp|retry|delivery/i),
    metadataColumns: "id, status, created_at, updated_at",
    metadataSource: "email_event_logs",
    metadataTable: "email_event_logs",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Queue-driven read-only metadata",
    timezone: "UTC"
  },
  {
    cronMonitoringKey: "op-cron-monitoring-notification",
    cronName: "Notification cron monitoring",
    cronType: "notification_cron",
    groupKey: "notification-cron-monitoring",
    matchesEvent: (eventType, entityType) =>
      matchesCronPattern(eventType, entityType, /notification|alert|delivery|retry/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Registry metadata only",
    timezone: "UTC"
  },
  {
    cronMonitoringKey: "op-cron-monitoring-seo",
    cronName: "SEO cron monitoring",
    cronType: "seo_cron",
    groupKey: "seo-cron-monitoring",
    matchesEvent: (eventType, entityType) =>
      matchesCronPattern(eventType, entityType, /seo|sitemap|robots|meta|redirect/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Registry metadata only",
    timezone: "UTC"
  },
  {
    cronMonitoringKey: "op-cron-monitoring-reports",
    cronName: "Reports cron monitoring",
    cronType: "reports_cron",
    groupKey: "reports-cron-monitoring",
    matchesEvent: (eventType, entityType) =>
      matchesCronPattern(eventType, entityType, /report|export|analytics|schedule/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Scheduled reports metadata only",
    timezone: "UTC"
  },
  {
    cronMonitoringKey: "op-cron-monitoring-billing",
    cronName: "Billing cron monitoring",
    cronType: "billing_cron",
    groupKey: "billing-cron-monitoring",
    matchesEvent: (eventType, entityType) =>
      matchesCronPattern(eventType, entityType, /billing|invoice|subscription|payment|stripe|paypal|sync/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Provider webhook driven",
    timezone: "UTC"
  },
  {
    cronMonitoringKey: "op-cron-monitoring-backup",
    cronName: "Backup cron monitoring",
    cronType: "backup_cron",
    groupKey: "backup-cron-monitoring",
    matchesEvent: (eventType, entityType) =>
      matchesCronPattern(eventType, entityType, /backup|restore|disaster|recovery/i),
    metadataColumns: null,
    metadataSource: "operations_registry_runtime",
    metadataTable: null,
    registryKey: "op-backup",
    scheduleExpression: "Backup scheduler not connected",
    timezone: "UTC"
  },
  {
    cronMonitoringKey: "op-cron-monitoring-operations",
    cronName: "Operations cron monitoring",
    cronType: "operations_cron",
    groupKey: "operations-cron-monitoring",
    matchesEvent: (eventType, entityType) =>
      matchesCronPattern(eventType, entityType, /operation|queue|worker|monitor|cron|sweep|platform/i),
    metadataColumns: "id, queue_status, workflow_state, created_at, updated_at",
    metadataSource: "ai_generation_queue",
    metadataTable: "ai_generation_queue",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Monitoring event stream driven",
    timezone: "UTC"
  }
] as const;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  return OPERATIONS_CRON_MONITORING_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function matchesCronPattern(eventType: string, entityType: string, pattern: RegExp) {
  return pattern.test(`${eventType} ${entityType}`.toLowerCase());
}

function latestDate(values: Array<string | null>) {
  return (
    values
      .filter(Boolean)
      .sort((left, right) => dateValue(right ?? "") - dateValue(left ?? ""))[0] ?? null
  );
}

function resolveReviewStatus(failedRuns: number, metadataDetected: boolean): OperationsCronMonitoringReviewStatus {
  if (!metadataDetected) {
    return "not_applicable";
  }

  if (failedRuns > 0) {
    return "review_required";
  }

  return "clear";
}

function resolveMonitoringStatus(input: {
  errorCount: number;
  failedRuns: number;
  metadataDetected: boolean;
  totalRuns: number;
  warningCount: number;
}): OperationsCronMonitoringStatus {
  if (!input.metadataDetected && input.totalRuns === 0) {
    return "unknown";
  }

  if (input.failedRuns > 0 || input.errorCount > 0) {
    return "failed";
  }

  if (input.warningCount > 0) {
    return "warning";
  }

  if (input.totalRuns > 0) {
    return "healthy";
  }

  return "idle";
}

function resolveCronMonitoringRuntimeStatus(input: {
  failedRuns: number;
  forceFutureHook?: boolean;
  metadataDetected: boolean;
  monitoringStatus: OperationsCronMonitoringStatus;
  reviewStatus: OperationsCronMonitoringReviewStatus;
  totalRuns: number;
  warningCount: number;
}): OperationsCronMonitoringRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

  if (!input.metadataDetected) {
    return "no_metadata_detected";
  }

  if (input.failedRuns > 0) {
    return "failed";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.warningCount > 0 || input.monitoringStatus === "warning") {
    return "warning";
  }

  if (input.totalRuns === 0) {
    return "empty";
  }

  if (input.monitoringStatus === "healthy") {
    return "healthy";
  }

  if (input.monitoringStatus === "idle") {
    return "idle";
  }

  if (input.totalRuns > 0) {
    return "registered";
  }

  return "registered";
}

function buildSafeSummary(input: {
  errorCount: number;
  failedRuns: number;
  metadataDetected: boolean;
  metadataSource: string | null;
  totalRuns: number;
  warningCount: number;
}) {
  return [
    input.metadataDetected
      ? `metadata ${input.metadataSource ?? "detected"}`
      : "metadata not detected",
    `${input.totalRuns} runs`,
    `${input.failedRuns} failed`,
    `${input.warningCount} warning`,
    `${input.errorCount} error`
  ].join("; ");
}

function countMonitoringEvents(rows: AnyRecord[]) {
  const failedRuns = rows.filter((row) => {
    const status = text(row.event_status).toLowerCase();
    const eventType = text(row.event_type).toLowerCase();
    return status === "failed" || eventType.includes("failed") || eventType.includes("error");
  }).length;
  const warningCount = rows.filter((row) =>
    ["warning", "pending"].includes(text(row.event_status).toLowerCase())
  ).length;
  const errorCount = rows.filter((row) => text(row.event_type).toLowerCase().includes("error")).length;

  return {
    errorCount,
    failedRuns,
    totalRuns: rows.length,
    warningCount
  };
}

function partitionMonitoringEvents(rows: AnyRecord[]) {
  const assignments = new Map<string, AnyRecord[]>(
    CRON_MONITORING_DEFINITIONS.map((definition) => [definition.cronMonitoringKey, [] as AnyRecord[]])
  );
  const unmatched: AnyRecord[] = [];

  for (const row of rows) {
    const eventType = text(row.event_type).toLowerCase();
    const entityType = text(row.entity_type).toLowerCase();
    const definition = CRON_MONITORING_DEFINITIONS.find((entry) => entry.matchesEvent(eventType, entityType));

    if (definition) {
      assignments.get(definition.cronMonitoringKey)?.push(row);
    } else {
      unmatched.push(row);
    }
  }

  if (unmatched.length) {
    assignments.get("op-cron-monitoring-operations")?.push(...unmatched);
  }

  return assignments;
}

async function safeMetadataSelect(
  supabase: SupabaseClient<Database>,
  tableName: string,
  columns: string,
  limit: number
): Promise<{ rows: AnyRecord[]; tableDetected: boolean }> {
  try {
    const { data, error } = await supabase.from(tableName as never).select(columns).limit(limit);

    if (error) {
      if (isMissingTableError(error)) {
        return { rows: [], tableDetected: false };
      }

      console.warn(`[operations-cron-monitoring-runtime] read-only ${tableName} select failed`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-cron-monitoring-runtime] read-only ${tableName} select crashed`, error);
    return { rows: [], tableDetected: false };
  }
}

async function detectDedicatedCronTable(supabase: SupabaseClient<Database>) {
  for (const tableName of CRON_TABLE_CANDIDATES) {
    const load = await safeMetadataSelect(supabase, tableName, "id, status, created_at, updated_at", 1);

    if (load.tableDetected) {
      return {
        tableDetected: true,
        tableName
      };
    }
  }

  return {
    tableDetected: false,
    tableName: null
  };
}

function buildCronMonitoringRuntimeItem(input: {
  cronTableDetected: boolean;
  definition: CronMonitoringDefinition;
  metadataLoad: { rows: AnyRecord[]; tableDetected: boolean };
  monitoringRows: AnyRecord[];
  monitoringTableDetected: boolean;
}): OperationsCronMonitoringRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const eventCounts = countMonitoringEvents(input.monitoringRows);
  const metadataDetected =
    input.monitoringTableDetected ||
    input.metadataLoad.tableDetected ||
    input.cronTableDetected ||
    input.monitoringRows.length > 0 ||
    input.metadataLoad.rows.length > 0;
  const metadataActivity = input.metadataLoad.rows.length;
  const totalRuns = Math.max(eventCounts.totalRuns, metadataActivity > 0 ? metadataActivity : 0);
  const failedRuns = eventCounts.failedRuns;
  const warningCount = eventCounts.warningCount;
  const errorCount = eventCounts.errorCount;
  const lastRunAt = latestDate([
    ...input.monitoringRows.map((row) => text(row.created_at)).filter(Boolean),
    ...input.metadataLoad.rows.map((row) => text(row.updated_at, text(row.created_at))).filter(Boolean)
  ]);
  const failureRows = input.monitoringRows.filter((row) => text(row.event_status).toLowerCase() === "failed");
  const lastFailureAt = latestDate(failureRows.map((row) => text(row.created_at)).filter(Boolean));
  const reviewStatus = resolveReviewStatus(failedRuns, metadataDetected);
  const monitoringStatus = resolveMonitoringStatus({
    errorCount,
    failedRuns,
    metadataDetected,
    totalRuns,
    warningCount
  });

  return {
    cronMonitoringKey: input.definition.cronMonitoringKey,
    cronName: input.definition.cronName,
    cronType: input.definition.cronType,
    errorCount,
    failedRuns,
    groupKey: input.definition.groupKey,
    lastFailureAt,
    lastRunAt,
    metadataDetected,
    monitoringStatus,
    nextRunAt: null,
    reviewStatus,
    runtimeStatus: resolveCronMonitoringRuntimeStatus({
      failedRuns,
      metadataDetected,
      monitoringStatus,
      reviewStatus,
      totalRuns,
      warningCount
    }),
    safeControls: buildSafeControls(),
    safeSummary: buildSafeSummary({
      errorCount,
      failedRuns,
      metadataDetected,
      metadataSource: input.definition.metadataSource,
      totalRuns,
      warningCount
    }),
    scheduleExpression: input.definition.scheduleExpression,
    timezone: input.definition.timezone,
    totalRuns,
    visibility: registryEntry?.visibility ?? "super_admin",
    warningCount
  };
}

function buildFutureCronMonitoringHookItems(): OperationsCronMonitoringRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /cron|schedule|trigger|backup|monitor|export/i.test(hook))
    .map((hook, index) => ({
      cronMonitoringKey: `op-future-cron-monitoring-hook-${index + 1}`,
      cronName: hook,
      cronType: "future_hook",
      errorCount: 0,
      failedRuns: 0,
      groupKey: "future-cron-monitoring-hooks" as const,
      lastFailureAt: null,
      lastRunAt: null,
      metadataDetected: false,
      monitoringStatus: "unknown" as const,
      nextRunAt: null,
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      safeSummary: "Future cron monitoring hook placeholder",
      scheduleExpression: "Not scheduled",
      timezone: "UTC",
      totalRuns: 0,
      visibility: registryEntry?.visibility ?? "super_admin",
      warningCount: 0
    }));
}

export function operationsCronMonitoringRuntimeStatusLabel(status: OperationsCronMonitoringRuntimeStatus) {
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
    case "idle":
      return "Idle";
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

export function operationsCronMonitoringRuntimeStatusBadgeTone(status: OperationsCronMonitoringRuntimeStatus) {
  switch (status) {
    case "healthy":
    case "registered":
      return "green" as const;
    case "idle":
    case "empty":
      return "blue" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "failed":
    case "no_metadata_detected":
      return "red" as const;
    case "disabled":
    case "future_hook":
      return "slate" as const;
  }
}

export function buildOperationsCronMonitoringRuntimeGroups(
  items: OperationsCronMonitoringRuntimeItem[]
): OperationsCronMonitoringRuntimeGroup[] {
  return CRON_MONITORING_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsCronMonitoringRuntimeSummary(
  items: OperationsCronMonitoringRuntimeItem[]
): OperationsCronMonitoringRuntimeSummary {
  const operationalCrons = items.filter((item) => item.groupKey !== "future-cron-monitoring-hooks");
  const healthyCrons = operationalCrons.filter((item) => item.runtimeStatus === "healthy").length;
  const warningCrons = operationalCrons.filter(
    (item) => item.runtimeStatus === "warning" || item.monitoringStatus === "warning"
  ).length;
  const failedCrons = operationalCrons.filter(
    (item) =>
      item.runtimeStatus === "failed" ||
      item.runtimeStatus === "review_required" ||
      item.monitoringStatus === "failed"
  ).length;
  const status =
    failedCrons > 0 || operationalCrons.some((item) => item.runtimeStatus === "no_metadata_detected")
      ? ("needs_attention" as const)
      : ("cron_monitoring_runtime_ready" as const);

  return {
    failedCrons,
    groupCount: buildOperationsCronMonitoringRuntimeGroups(items).length,
    healthyCrons,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_CRON_MONITORING_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalCrons.length} cron monitors`,
      `${healthyCrons} healthy`,
      `${warningCrons} warning`,
      `${failedCrons} require review`
    ].join("; "),
    totalCrons: items.length,
    warningCrons
  };
}

export async function loadOperationsCronMonitoringRuntimeReadOnlySafe(params: {
  supabase: SupabaseClient<Database>;
}) {
  const [monitoringLoad, dedicatedCronTable, emailMetadataLoad, aiMetadataLoad] = await Promise.all([
    safeMetadataSelect(
      params.supabase,
      "monitoring_events",
      "id, event_type, event_status, entity_type, created_at",
      500
    ),
    detectDedicatedCronTable(params.supabase),
    safeMetadataSelect(params.supabase, "email_event_logs", "id, status, created_at, updated_at", 500),
    safeMetadataSelect(
      params.supabase,
      "ai_generation_queue",
      "id, queue_status, workflow_state, created_at, updated_at",
      500
    )
  ]);
  const metadataByTable = new Map<string, { rows: AnyRecord[]; tableDetected: boolean }>([
    ["email_event_logs", emailMetadataLoad],
    ["ai_generation_queue", aiMetadataLoad],
    ["monitoring_events", monitoringLoad]
  ]);
  const partitionedEvents = partitionMonitoringEvents(monitoringLoad.rows);
  const cronMonitoringItems = [
    ...CRON_MONITORING_DEFINITIONS.map((definition) =>
      buildCronMonitoringRuntimeItem({
        cronTableDetected: dedicatedCronTable.tableDetected,
        definition,
        metadataLoad: metadataByTable.get(definition.metadataTable ?? "") ?? { rows: [], tableDetected: false },
        monitoringRows: partitionedEvents.get(definition.cronMonitoringKey) ?? [],
        monitoringTableDetected: monitoringLoad.tableDetected
      })
    ),
    ...buildFutureCronMonitoringHookItems()
  ];
  const groups = buildOperationsCronMonitoringRuntimeGroups(cronMonitoringItems);
  const summary = getOperationsCronMonitoringRuntimeSummary(cronMonitoringItems);

  return {
    cronMonitoring: summary,
    cronMonitoringItems,
    groups,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsCronMonitoringRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsCronMonitoringRuntimeReadOnlySafe>>
) {
  return {
    cronMonitoring: input.cronMonitoring,
    cronMonitoringItems: input.cronMonitoringItems,
    groups: input.groups,
    safeControls: input.safeControls
  };
}
