import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsWorkerMonitoringRuntimeSource = "operations_worker_monitoring_runtime";

export type OperationsWorkerMonitoringGroupKey =
  | "ai-worker-monitoring"
  | "cron-worker-monitoring"
  | "domain-email-worker-monitoring"
  | "email-worker-monitoring"
  | "future-worker-monitoring-hooks"
  | "queue-worker-monitoring"
  | "reports-worker-monitoring";

export type OperationsWorkerMonitoringRuntimeStatus =
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

export type OperationsWorkerMonitoringStatus = "failed" | "healthy" | "idle" | "unknown" | "warning";

export type OperationsWorkerMonitoringReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsWorkerMonitoringSafeControlKey =
  | "export_report"
  | "inspect_logs"
  | "pause_worker"
  | "restart_worker"
  | "retry_failed";

export type OperationsWorkerMonitoringSafeControl = {
  enabled: false;
  key: OperationsWorkerMonitoringSafeControlKey;
  label: string;
  note: string;
};

export type OperationsWorkerMonitoringRuntimeItem = {
  errorCount: number;
  failedRuns: number;
  groupKey: OperationsWorkerMonitoringGroupKey;
  lastFailureAt: string | null;
  lastRunAt: string | null;
  lastSeenAt: string | null;
  linkedQueue: string;
  metadataDetected: boolean;
  monitoringStatus: OperationsWorkerMonitoringStatus;
  reviewStatus: OperationsWorkerMonitoringReviewStatus;
  runtimeStatus: OperationsWorkerMonitoringRuntimeStatus;
  safeControls: OperationsWorkerMonitoringSafeControl[];
  safeSummary: string;
  totalRuns: number;
  visibility: OperationsRegistryVisibility;
  warningCount: number;
  workerMonitoringKey: string;
  workerName: string;
  workerType: string;
};

export type OperationsWorkerMonitoringRuntimeGroup = {
  groupKey: OperationsWorkerMonitoringGroupKey;
  itemCount: number;
  items: OperationsWorkerMonitoringRuntimeItem[];
  title: string;
};

export type OperationsWorkerMonitoringRuntimeSummary = {
  failedWorkers: number;
  groupCount: number;
  healthyWorkers: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsWorkerMonitoringRuntimeSource;
  status: "needs_attention" | "worker_monitoring_runtime_ready";
  summary: string;
  totalWorkers: number;
  warningWorkers: number;
};

type AnyRecord = Record<string, unknown>;

type WorkerMonitoringDefinition = {
  groupKey: OperationsWorkerMonitoringGroupKey;
  linkedQueue: string;
  matchesEvent: (eventType: string, entityType: string) => boolean;
  metadataSource: string | null;
  metadataTable: string | null;
  metadataColumns: string | null;
  registryKey: string;
  workerMonitoringKey: string;
  workerName: string;
  workerType: string;
};

export const OPERATIONS_WORKER_MONITORING_RUNTIME_SOURCE = "operations_worker_monitoring_runtime" as const;

export const OPERATIONS_WORKER_MONITORING_SAFE_CONTROLS: readonly OperationsWorkerMonitoringSafeControl[] = [
  {
    enabled: false,
    key: "inspect_logs",
    label: "Inspect Logs",
    note: "Read-only placeholder. No worker log inspection runs during OP-12 page load."
  },
  {
    enabled: false,
    key: "restart_worker",
    label: "Restart Worker",
    note: "Read-only placeholder. No worker restart runs during OP-12 page load."
  },
  {
    enabled: false,
    key: "retry_failed",
    label: "Retry Failed",
    note: "Read-only placeholder. No worker retry runs during OP-12 page load."
  },
  {
    enabled: false,
    key: "pause_worker",
    label: "Pause Worker",
    note: "Read-only placeholder. No worker pause runs during OP-12 page load."
  },
  {
    enabled: false,
    key: "export_report",
    label: "Export Report",
    note: "Read-only placeholder. No worker monitoring export or diagnostics run during OP-12 page load."
  }
] as const;

const WORKER_MONITORING_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsWorkerMonitoringGroupKey;
  title: string;
}> = [
  { groupKey: "email-worker-monitoring", title: "Email Worker Monitoring" },
  { groupKey: "ai-worker-monitoring", title: "AI Worker Monitoring" },
  { groupKey: "queue-worker-monitoring", title: "Queue Worker Monitoring" },
  { groupKey: "cron-worker-monitoring", title: "Cron Worker Monitoring" },
  { groupKey: "domain-email-worker-monitoring", title: "Domain & Email Worker Monitoring" },
  { groupKey: "reports-worker-monitoring", title: "Reports Worker Monitoring" },
  { groupKey: "future-worker-monitoring-hooks", title: "Future Worker Monitoring Hooks" }
];

const WORKER_MONITORING_DEFINITIONS: readonly WorkerMonitoringDefinition[] = [
  {
    groupKey: "email-worker-monitoring",
    linkedQueue: "Email event queue",
    matchesEvent: (eventType, entityType) =>
      matchesWorkerPattern(eventType, entityType, /email|mail|smtp|delivery|mailbox/i),
    metadataColumns: "id, status, created_at, updated_at",
    metadataSource: "email_event_logs",
    metadataTable: "email_event_logs",
    registryKey: "op-worker-health",
    workerMonitoringKey: "op-worker-monitoring-email",
    workerName: "Email worker monitoring",
    workerType: "email_worker"
  },
  {
    groupKey: "ai-worker-monitoring",
    linkedQueue: "AI generation queue",
    matchesEvent: (eventType, entityType) =>
      matchesWorkerPattern(eventType, entityType, /ai|generation|openai|visual|schema/i),
    metadataColumns: "id, queue_status, workflow_state, created_at, updated_at",
    metadataSource: "ai_generation_queue",
    metadataTable: "ai_generation_queue",
    registryKey: "op-worker-health",
    workerMonitoringKey: "op-worker-monitoring-ai",
    workerName: "AI worker monitoring",
    workerType: "ai_worker"
  },
  {
    groupKey: "queue-worker-monitoring",
    linkedQueue: "Queue processors",
    matchesEvent: (eventType, entityType) =>
      matchesWorkerPattern(eventType, entityType, /queue|worker|processor|retry|drain/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-worker-health",
    workerMonitoringKey: "op-worker-monitoring-queue",
    workerName: "Queue worker monitoring",
    workerType: "queue_worker"
  },
  {
    groupKey: "cron-worker-monitoring",
    linkedQueue: "Cron monitors",
    matchesEvent: (eventType, entityType) =>
      matchesWorkerPattern(eventType, entityType, /cron|schedule|sweep|monitor|sync/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-worker-health",
    workerMonitoringKey: "op-worker-monitoring-cron",
    workerName: "Cron worker monitoring",
    workerType: "cron_worker"
  },
  {
    groupKey: "domain-email-worker-monitoring",
    linkedQueue: "Domain & email workflow queue",
    matchesEvent: (eventType, entityType) =>
      matchesWorkerPattern(eventType, entityType, /domain|dns|hosting|ssl|mailbox|registr/i),
    metadataColumns: "id, status, created_at, updated_at",
    metadataSource: "domain_orders",
    metadataTable: "domain_orders",
    registryKey: "op-worker-health",
    workerMonitoringKey: "op-worker-monitoring-domain-email",
    workerName: "Domain & email worker monitoring",
    workerType: "domain_email_worker"
  },
  {
    groupKey: "reports-worker-monitoring",
    linkedQueue: "Reports runtime",
    matchesEvent: (eventType, entityType) =>
      matchesWorkerPattern(eventType, entityType, /report|export|analytics|dashboard/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-worker-health",
    workerMonitoringKey: "op-worker-monitoring-reports",
    workerName: "Reports worker monitoring",
    workerType: "reports_worker"
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
  return OPERATIONS_WORKER_MONITORING_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function matchesWorkerPattern(eventType: string, entityType: string, pattern: RegExp) {
  return pattern.test(`${eventType} ${entityType}`.toLowerCase());
}

function latestDate(values: Array<string | null>) {
  return (
    values
      .filter(Boolean)
      .sort((left, right) => dateValue(right ?? "") - dateValue(left ?? ""))[0] ?? null
  );
}

function resolveReviewStatus(failedRuns: number, metadataDetected: boolean): OperationsWorkerMonitoringReviewStatus {
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
}): OperationsWorkerMonitoringStatus {
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

function resolveWorkerMonitoringRuntimeStatus(input: {
  failedRuns: number;
  forceFutureHook?: boolean;
  metadataDetected: boolean;
  monitoringStatus: OperationsWorkerMonitoringStatus;
  reviewStatus: OperationsWorkerMonitoringReviewStatus;
  totalRuns: number;
  warningCount: number;
}): OperationsWorkerMonitoringRuntimeStatus {
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
    WORKER_MONITORING_DEFINITIONS.map((definition) => [definition.workerMonitoringKey, [] as AnyRecord[]])
  );
  const unmatched: AnyRecord[] = [];

  for (const row of rows) {
    const eventType = text(row.event_type).toLowerCase();
    const entityType = text(row.entity_type).toLowerCase();
    const definition = WORKER_MONITORING_DEFINITIONS.find((entry) => entry.matchesEvent(eventType, entityType));

    if (definition) {
      assignments.get(definition.workerMonitoringKey)?.push(row);
    } else {
      unmatched.push(row);
    }
  }

  if (unmatched.length) {
    assignments.get("op-worker-monitoring-queue")?.push(...unmatched);
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

      console.warn(`[operations-worker-monitoring-runtime] read-only ${tableName} select failed`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-worker-monitoring-runtime] read-only ${tableName} select crashed`, error);
    return { rows: [], tableDetected: false };
  }
}

function buildWorkerMonitoringRuntimeItem(input: {
  definition: WorkerMonitoringDefinition;
  metadataLoad: { rows: AnyRecord[]; tableDetected: boolean };
  monitoringRows: AnyRecord[];
  monitoringTableDetected: boolean;
}): OperationsWorkerMonitoringRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const eventCounts = countMonitoringEvents(input.monitoringRows);
  const metadataDetected =
    input.monitoringTableDetected ||
    input.metadataLoad.tableDetected ||
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
  const lastSeenAt = latestDate([lastRunAt, lastFailureAt]);
  const reviewStatus = resolveReviewStatus(failedRuns, metadataDetected);
  const monitoringStatus = resolveMonitoringStatus({
    errorCount,
    failedRuns,
    metadataDetected,
    totalRuns,
    warningCount
  });

  return {
    errorCount,
    failedRuns,
    groupKey: input.definition.groupKey,
    lastFailureAt,
    lastRunAt,
    lastSeenAt,
    linkedQueue: input.definition.linkedQueue,
    metadataDetected,
    monitoringStatus,
    reviewStatus,
    runtimeStatus: resolveWorkerMonitoringRuntimeStatus({
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
    totalRuns,
    visibility: registryEntry?.visibility ?? "super_admin",
    warningCount,
    workerMonitoringKey: input.definition.workerMonitoringKey,
    workerName: input.definition.workerName,
    workerType: input.definition.workerType
  };
}

function buildFutureWorkerMonitoringHookItems(): OperationsWorkerMonitoringRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /worker|restart|retry|monitor|log|export/i.test(hook))
    .map((hook, index) => ({
      errorCount: 0,
      failedRuns: 0,
      groupKey: "future-worker-monitoring-hooks" as const,
      lastFailureAt: null,
      lastRunAt: null,
      lastSeenAt: null,
      linkedQueue: "Reserved future hook",
      metadataDetected: false,
      monitoringStatus: "unknown" as const,
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      safeSummary: "Future worker monitoring hook placeholder",
      totalRuns: 0,
      visibility: registryEntry?.visibility ?? "super_admin",
      warningCount: 0,
      workerMonitoringKey: `op-future-worker-monitoring-hook-${index + 1}`,
      workerName: hook,
      workerType: "future_hook"
    }));
}

export function operationsWorkerMonitoringRuntimeStatusLabel(status: OperationsWorkerMonitoringRuntimeStatus) {
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

export function operationsWorkerMonitoringRuntimeStatusBadgeTone(status: OperationsWorkerMonitoringRuntimeStatus) {
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

export function buildOperationsWorkerMonitoringRuntimeGroups(
  items: OperationsWorkerMonitoringRuntimeItem[]
): OperationsWorkerMonitoringRuntimeGroup[] {
  return WORKER_MONITORING_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsWorkerMonitoringRuntimeSummary(
  items: OperationsWorkerMonitoringRuntimeItem[]
): OperationsWorkerMonitoringRuntimeSummary {
  const operationalWorkers = items.filter((item) => item.groupKey !== "future-worker-monitoring-hooks");
  const healthyWorkers = operationalWorkers.filter((item) => item.runtimeStatus === "healthy").length;
  const warningWorkers = operationalWorkers.filter(
    (item) => item.runtimeStatus === "warning" || item.monitoringStatus === "warning"
  ).length;
  const failedWorkers = operationalWorkers.filter(
    (item) =>
      item.runtimeStatus === "failed" ||
      item.runtimeStatus === "review_required" ||
      item.monitoringStatus === "failed"
  ).length;
  const status =
    failedWorkers > 0 || operationalWorkers.some((item) => item.runtimeStatus === "no_metadata_detected")
      ? ("needs_attention" as const)
      : ("worker_monitoring_runtime_ready" as const);

  return {
    failedWorkers,
    groupCount: buildOperationsWorkerMonitoringRuntimeGroups(items).length,
    healthyWorkers,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_WORKER_MONITORING_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalWorkers.length} worker monitors`,
      `${healthyWorkers} healthy`,
      `${warningWorkers} warning`,
      `${failedWorkers} require review`
    ].join("; "),
    totalWorkers: items.length,
    warningWorkers
  };
}

export async function loadOperationsWorkerMonitoringRuntimeReadOnlySafe(params: {
  supabase: SupabaseClient<Database>;
}) {
  const monitoringLoad = await safeMetadataSelect(
    params.supabase,
    "monitoring_events",
    "id, event_type, event_status, entity_type, created_at",
    500
  );
  const [emailMetadataLoad, aiMetadataLoad, domainMetadataLoad] = await Promise.all([
    safeMetadataSelect(params.supabase, "email_event_logs", "id, status, created_at, updated_at", 500),
    safeMetadataSelect(
      params.supabase,
      "ai_generation_queue",
      "id, queue_status, workflow_state, created_at, updated_at",
      500
    ),
    safeMetadataSelect(params.supabase, "domain_orders", "id, status, created_at, updated_at", 500)
  ]);
  const metadataByTable = new Map<string, { rows: AnyRecord[]; tableDetected: boolean }>([
    ["email_event_logs", emailMetadataLoad],
    ["ai_generation_queue", aiMetadataLoad],
    ["domain_orders", domainMetadataLoad],
    ["monitoring_events", monitoringLoad]
  ]);
  const partitionedEvents = partitionMonitoringEvents(monitoringLoad.rows);
  const workerMonitoringItems = [
    ...WORKER_MONITORING_DEFINITIONS.map((definition) =>
      buildWorkerMonitoringRuntimeItem({
        definition,
        metadataLoad: metadataByTable.get(definition.metadataTable ?? "") ?? { rows: [], tableDetected: false },
        monitoringRows: partitionedEvents.get(definition.workerMonitoringKey) ?? [],
        monitoringTableDetected: monitoringLoad.tableDetected
      })
    ),
    ...buildFutureWorkerMonitoringHookItems()
  ];
  const groups = buildOperationsWorkerMonitoringRuntimeGroups(workerMonitoringItems);
  const summary = getOperationsWorkerMonitoringRuntimeSummary(workerMonitoringItems);

  return {
    groups,
    safeControls: buildSafeControls(),
    workerMonitoring: summary,
    workerMonitoringItems
  };
}

export function mapOperationsWorkerMonitoringRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsWorkerMonitoringRuntimeReadOnlySafe>>
) {
  return {
    groups: input.groups,
    safeControls: input.safeControls,
    workerMonitoring: input.workerMonitoring,
    workerMonitoringItems: input.workerMonitoringItems
  };
}
