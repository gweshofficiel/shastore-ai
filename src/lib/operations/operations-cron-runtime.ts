import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";
import type { OperationsQueueRuntimeItem } from "@/src/lib/operations/operations-queue-runtime";
import type { OperationsWorkerRuntimeItem } from "@/src/lib/operations/operations-worker-runtime";

export type OperationsCronRuntimeSource = "operations_cron_runtime";

export type OperationsCronGroupKey =
  | "backup-cron-jobs"
  | "billing-cron-jobs"
  | "email-cron-jobs"
  | "future-cron-hooks"
  | "monitoring-cron-jobs"
  | "notification-cron-jobs"
  | "reports-cron-jobs"
  | "seo-cron-jobs";

export type OperationsCronType =
  | "backup_monitor"
  | "billing_sync"
  | "email_retry"
  | "future_hook"
  | "monitoring_sweep"
  | "notification_retry"
  | "queue_monitor"
  | "reports_schedule"
  | "seo_refresh";

export type OperationsCronRuntimeStatus =
  | "disabled"
  | "empty"
  | "failed"
  | "future_hook"
  | "idle"
  | "no_table_detected"
  | "registered"
  | "review_required"
  | "scheduled";

export type OperationsCronReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsCronSafeControlKey = "inspect_runs" | "pause" | "reschedule" | "resume" | "trigger_now";

export type OperationsCronSafeControl = {
  enabled: false;
  key: OperationsCronSafeControlKey;
  label: string;
  note: string;
};

export type OperationsCronRuntimeItem = {
  cronKey: string;
  cronName: string;
  cronType: OperationsCronType;
  failedRuns: number;
  groupKey: OperationsCronGroupKey;
  lastFailureAt: string | null;
  lastRunAt: string | null;
  metadataSource: string | null;
  nextRunAt: string | null;
  nextRunLabel: string;
  registryKey: string;
  reviewStatus: OperationsCronReviewStatus;
  runtimeStatus: OperationsCronRuntimeStatus;
  safeControls: OperationsCronSafeControl[];
  scheduleExpression: string;
  tableDetected: boolean;
  timezone: string;
  totalRuns: number;
  visibility: OperationsRegistryVisibility;
};

export type OperationsCronRuntimeGroup = {
  groupKey: OperationsCronGroupKey;
  itemCount: number;
  items: OperationsCronRuntimeItem[];
  title: string;
};

export type OperationsCronRuntimeSummary = {
  activeCronJobs: number;
  failedCronJobs: number;
  groupCount: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsCronRuntimeSource;
  status: "cron_runtime_ready" | "needs_attention";
  summary: string;
  totalCronJobs: number;
};

type AnyRecord = Record<string, unknown>;

type CronDefinition = {
  cronKey: string;
  cronName: string;
  cronType: OperationsCronType;
  groupKey: OperationsCronGroupKey;
  metadataSource: string | null;
  nextRunLabel: string;
  queueKey?: string;
  registryKey: string;
  scheduleExpression: string;
  tableName: string | null;
  workerKey?: string;
};

export const OPERATIONS_CRON_RUNTIME_SOURCE = "operations_cron_runtime" as const;

export const OPERATIONS_CRON_SAFE_CONTROLS: readonly OperationsCronSafeControl[] = [
  {
    enabled: false,
    key: "trigger_now",
    label: "Trigger Now",
    note: "Read-only placeholder. No cron trigger is executed during OP-5 page load."
  },
  {
    enabled: false,
    key: "pause",
    label: "Pause",
    note: "Read-only placeholder. No cron pause is executed during OP-5 page load."
  },
  {
    enabled: false,
    key: "resume",
    label: "Resume",
    note: "Read-only placeholder. No cron resume is executed during OP-5 page load."
  },
  {
    enabled: false,
    key: "reschedule",
    label: "Reschedule",
    note: "Read-only placeholder. No cron reschedule is executed during OP-5 page load."
  },
  {
    enabled: false,
    key: "inspect_runs",
    label: "Inspect Runs",
    note: "Read-only placeholder. No cron run inspection is connected during OP-5 page load."
  }
] as const;

const CRON_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsCronGroupKey;
  title: string;
}> = [
  { groupKey: "email-cron-jobs", title: "Email Cron Jobs" },
  { groupKey: "notification-cron-jobs", title: "Notification Cron Jobs" },
  { groupKey: "seo-cron-jobs", title: "SEO Cron Jobs" },
  { groupKey: "reports-cron-jobs", title: "Reports Cron Jobs" },
  { groupKey: "billing-cron-jobs", title: "Billing Cron Jobs" },
  { groupKey: "backup-cron-jobs", title: "Backup Cron Jobs" },
  { groupKey: "monitoring-cron-jobs", title: "Monitoring Cron Jobs" },
  { groupKey: "future-cron-hooks", title: "Future Cron Hooks" }
];

const CRON_DEFINITIONS: readonly CronDefinition[] = [
  {
    cronKey: "op-cron-email-retry-monitor",
    cronName: "Email retry monitor",
    cronType: "email_retry",
    groupKey: "email-cron-jobs",
    metadataSource: "email_event_logs",
    nextRunLabel: "Future cron placeholder",
    queueKey: "op-email-queue",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Manual/store-triggered queue today",
    tableName: "email_event_logs"
  },
  {
    cronKey: "op-cron-notification-retry-monitor",
    cronName: "Notification retry monitor",
    cronType: "notification_retry",
    groupKey: "notification-cron-jobs",
    metadataSource: "notification_registry_runtime",
    nextRunLabel: "Future scheduler placeholder",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Registry metadata only",
    tableName: null
  },
  {
    cronKey: "op-cron-seo-sitemap-refresh",
    cronName: "SEO sitemap refresh monitor",
    cronType: "seo_refresh",
    groupKey: "seo-cron-jobs",
    metadataSource: "seo_registry_runtime",
    nextRunLabel: "Future scheduler placeholder",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Registry metadata only",
    tableName: null
  },
  {
    cronKey: "op-cron-reports-schedule-scan",
    cronName: "Reports schedule scan",
    cronType: "reports_schedule",
    groupKey: "reports-cron-jobs",
    metadataSource: "reports_registry_runtime",
    nextRunLabel: "Future scheduler placeholder",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Read-only scheduled reports metadata",
    tableName: null
  },
  {
    cronKey: "op-cron-billing-sync-monitor",
    cronName: "Billing sync monitor",
    cronType: "billing_sync",
    groupKey: "billing-cron-jobs",
    metadataSource: "monitoring_events",
    nextRunLabel: "Placeholder schedule",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Provider webhook driven",
    tableName: "monitoring_events"
  },
  {
    cronKey: "op-cron-backup-status-check",
    cronName: "Backup status check",
    cronType: "backup_monitor",
    groupKey: "backup-cron-jobs",
    metadataSource: "operations_registry_runtime",
    nextRunLabel: "Not scheduled",
    registryKey: "op-backup",
    scheduleExpression: "Backup scheduler not connected",
    tableName: null
  },
  {
    cronKey: "op-cron-system-monitoring-sweep",
    cronName: "System monitoring sweep",
    cronType: "monitoring_sweep",
    groupKey: "monitoring-cron-jobs",
    metadataSource: "monitoring_events",
    nextRunLabel: "Live event stream",
    registryKey: "op-monitoring-events",
    scheduleExpression: "Monitoring event stream driven",
    tableName: "monitoring_events"
  },
  {
    cronKey: "op-cron-ai-queue-monitor",
    cronName: "AI queue monitor",
    cronType: "queue_monitor",
    groupKey: "monitoring-cron-jobs",
    metadataSource: "ai_generation_queue",
    nextRunLabel: "Future worker schedule",
    queueKey: "op-ai-queue",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Worker/runtime driven",
    tableName: "ai_generation_queue"
  },
  {
    cronKey: "op-cron-domain-email-monitor",
    cronName: "Domain/email workflow monitor",
    cronType: "queue_monitor",
    groupKey: "monitoring-cron-jobs",
    metadataSource: "domains_hosting_workflow",
    nextRunLabel: "Future provider sync",
    queueKey: "op-domain-email-queue",
    registryKey: "op-cron-jobs",
    scheduleExpression: "Placeholder",
    tableName: null
  }
] as const;

const CRON_TABLE_CANDIDATES = ["cron_jobs", "platform_cron_jobs", "scheduled_jobs", "scheduled_cron_jobs"] as const;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function latestDate(rows: AnyRecord[], keys: string[]) {
  return (
    rows
      .flatMap((row) => keys.map((key) => text(row[key])).filter(Boolean))
      .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null
  );
}

function buildSafeControls() {
  return OPERATIONS_CRON_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function resolveReviewStatus(failedRuns: number, tableDetected: boolean): OperationsCronReviewStatus {
  if (!tableDetected && failedRuns === 0) {
    return "not_applicable";
  }

  if (failedRuns > 0) {
    return "review_required";
  }

  return "clear";
}

function resolveCronRuntimeStatus(input: {
  failedRuns: number;
  forceDisabled?: boolean;
  forceFutureHook?: boolean;
  hasSchedule: boolean;
  reviewStatus: OperationsCronReviewStatus;
  tableDetected: boolean;
  totalRuns: number;
}): OperationsCronRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

  if (input.forceDisabled) {
    return "disabled";
  }

  if (!input.tableDetected && input.totalRuns === 0 && !input.hasSchedule) {
    return "no_table_detected";
  }

  if (input.failedRuns > 0) {
    return "failed";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.totalRuns === 0 && input.hasSchedule) {
    return "scheduled";
  }

  if (input.totalRuns === 0) {
    return "empty";
  }

  if (input.totalRuns > 0) {
    return "idle";
  }

  return "registered";
}

async function safeCronTableSelect(
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

      console.warn(`[operations-cron-runtime] read-only cron metadata select failed for ${table}`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-cron-runtime] read-only cron metadata select crashed for ${table}`, error);
    return { rows: [], tableDetected: false };
  }
}

async function detectDedicatedCronTable(supabase: SupabaseClient<Database>) {
  for (const tableName of CRON_TABLE_CANDIDATES) {
    const result = await safeCronTableSelect(supabase, tableName, "id, name, schedule, created_at", 1);

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

function buildMonitoringSnapshot(events: AnyRecord[]) {
  const failures = events.filter((event) => {
    const eventStatus = text(event.event_status).toLowerCase();
    const eventType = text(event.event_type).toLowerCase();
    return eventStatus === "failed" || eventType.includes("failed") || eventType.includes("error");
  });

  return {
    failedRuns: failures.length,
    lastFailureAt: latestDate(failures, ["created_at"]),
    lastRunAt: latestDate(events, ["created_at"]),
    totalRuns: events.length
  };
}

function buildCronRuntimeItem(input: {
  definition: CronDefinition;
  dedicatedCronTableDetected: boolean;
  monitoringSnapshot: ReturnType<typeof buildMonitoringSnapshot>;
  queueItem: OperationsQueueRuntimeItem | null;
  sourceTableDetected: boolean;
  workerItem: OperationsWorkerRuntimeItem | null;
}): OperationsCronRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const queueFailedRuns = input.queueItem?.failedJobs ?? 0;
  const queueTotalRuns =
    (input.queueItem?.completedJobs ?? 0) +
    (input.queueItem?.failedJobs ?? 0) +
    (input.queueItem?.processingJobs ?? 0);
  const monitoringLinked = input.definition.metadataSource === "monitoring_events";
  const failedRuns = monitoringLinked ? input.monitoringSnapshot.failedRuns : queueFailedRuns;
  const totalRuns = monitoringLinked ? input.monitoringSnapshot.totalRuns : queueTotalRuns;
  const lastRunAt = monitoringLinked
    ? input.monitoringSnapshot.lastRunAt
    : input.queueItem?.lastJobAt ?? input.workerItem?.lastRunAt ?? null;
  const lastFailureAt = monitoringLinked
    ? input.monitoringSnapshot.lastFailureAt
    : input.queueItem?.lastFailureAt ?? input.workerItem?.lastFailureAt ?? null;
  const tableDetected = input.definition.tableName
    ? input.sourceTableDetected
    : input.dedicatedCronTableDetected || Boolean(input.definition.metadataSource);
  const reviewStatus = resolveReviewStatus(failedRuns, tableDetected);

  return {
    cronKey: input.definition.cronKey,
    cronName: input.definition.cronName,
    cronType: input.definition.cronType,
    failedRuns,
    groupKey: input.definition.groupKey,
    lastFailureAt,
    lastRunAt,
    metadataSource: input.definition.metadataSource,
    nextRunAt: null,
    nextRunLabel: input.definition.nextRunLabel,
    registryKey: input.definition.registryKey,
    reviewStatus,
    runtimeStatus: resolveCronRuntimeStatus({
      failedRuns,
      hasSchedule: Boolean(input.definition.scheduleExpression),
      reviewStatus,
      tableDetected,
      totalRuns
    }),
    safeControls: buildSafeControls(),
    scheduleExpression: input.definition.scheduleExpression,
    tableDetected,
    timezone: "UTC",
    totalRuns,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildFutureCronHookItems(): OperationsCronRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /cron|schedule|backup|restore/i.test(hook))
    .map((hook, index) => ({
      cronKey: `op-future-cron-hook-${index + 1}`,
      cronName: hook,
      cronType: "future_hook" as const,
      failedRuns: 0,
      groupKey: "future-cron-hooks" as const,
      lastFailureAt: null,
      lastRunAt: null,
      metadataSource: null,
      nextRunAt: null,
      nextRunLabel: "Not scheduled",
      registryKey: "op-future-hooks",
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      scheduleExpression: "Reserved future hook",
      tableDetected: false,
      timezone: "UTC",
      totalRuns: 0,
      visibility: registryEntry?.visibility ?? "super_admin"
    }));
}

export function operationsCronRuntimeStatusLabel(status: OperationsCronRuntimeStatus) {
  switch (status) {
    case "disabled":
      return "Disabled";
    case "empty":
      return "Empty";
    case "failed":
      return "Failed";
    case "future_hook":
      return "Future Hook";
    case "idle":
      return "Idle";
    case "no_table_detected":
      return "No Table Detected";
    case "registered":
      return "Registered";
    case "review_required":
      return "Review Required";
    case "scheduled":
      return "Scheduled";
  }
}

export function operationsCronRuntimeStatusBadgeTone(status: OperationsCronRuntimeStatus) {
  switch (status) {
    case "idle":
    case "registered":
    case "scheduled":
      return "green" as const;
    case "empty":
      return "blue" as const;
    case "failed":
    case "review_required":
      return "amber" as const;
    case "no_table_detected":
      return "red" as const;
    case "disabled":
    case "future_hook":
      return "slate" as const;
  }
}

export function buildOperationsCronRuntimeGroups(items: OperationsCronRuntimeItem[]): OperationsCronRuntimeGroup[] {
  return CRON_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsCronRuntimeSummary(items: OperationsCronRuntimeItem[]): OperationsCronRuntimeSummary {
  const operationalCronJobs = items.filter((item) => item.groupKey !== "future-cron-hooks");
  const activeCronJobs = operationalCronJobs.filter(
    (item) => item.runtimeStatus === "idle" || item.runtimeStatus === "scheduled"
  ).length;
  const failedCronJobs = operationalCronJobs.filter(
    (item) => item.runtimeStatus === "failed" || item.reviewStatus === "review_required"
  ).length;
  const status = failedCronJobs > 0 || operationalCronJobs.some((item) => item.runtimeStatus === "no_table_detected")
    ? ("needs_attention" as const)
    : ("cron_runtime_ready" as const);

  return {
    activeCronJobs,
    failedCronJobs,
    groupCount: buildOperationsCronRuntimeGroups(items).length,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_CRON_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalCronJobs.length} operational cron jobs`,
      `${activeCronJobs} active or scheduled`,
      `${failedCronJobs} require review`
    ].join("; "),
    totalCronJobs: items.length
  };
}

function mapLegacyCronStatus(
  runtimeStatus: OperationsCronRuntimeStatus
): "placeholder" | "ready" | "review" {
  switch (runtimeStatus) {
    case "failed":
    case "review_required":
      return "review";
    case "idle":
    case "scheduled":
    case "registered":
      return "ready";
    default:
      return "placeholder";
  }
}

export async function loadOperationsCronRuntimeReadOnlySafe(params: {
  monitoringEvents: AnyRecord[];
  queueRuntimeItems: OperationsQueueRuntimeItem[];
  supabase: SupabaseClient<Database>;
  workerRuntimeItems: OperationsWorkerRuntimeItem[];
}) {
  const dedicatedCronTable = await detectDedicatedCronTable(params.supabase);
  const monitoringSnapshot = buildMonitoringSnapshot(params.monitoringEvents);

  const [emailSource, aiSource, monitoringSource] = await Promise.all([
    safeCronTableSelect(params.supabase, "email_event_logs", "id, status, created_at, updated_at", 500),
    safeCronTableSelect(params.supabase, "ai_generation_queue", "id, queue_status, workflow_state, created_at, updated_at", 500),
    safeCronTableSelect(params.supabase, "monitoring_events", "event_type, event_status, created_at", 500)
  ]);

  const sourceDetectionByTable = new Map<string, boolean>([
    ["email_event_logs", emailSource.tableDetected],
    ["ai_generation_queue", aiSource.tableDetected],
    ["monitoring_events", monitoringSource.tableDetected],
    ["domains_hosting_workflow", true]
  ]);

  const queueByKey = new Map(params.queueRuntimeItems.map((item) => [item.queueKey, item] as const));
  const workerByKey = new Map(params.workerRuntimeItems.map((item) => [item.workerKey, item] as const));

  const cronJobs = [
    ...CRON_DEFINITIONS.map((definition) =>
      buildCronRuntimeItem({
        definition,
        dedicatedCronTableDetected: dedicatedCronTable.tableDetected,
        monitoringSnapshot,
        queueItem: definition.queueKey ? queueByKey.get(definition.queueKey) ?? null : null,
        sourceTableDetected: definition.tableName
          ? sourceDetectionByTable.get(definition.tableName) ?? false
          : dedicatedCronTable.tableDetected,
        workerItem: definition.workerKey ? workerByKey.get(definition.workerKey) ?? null : null
      })
    ),
    ...buildFutureCronHookItems()
  ];

  const groups = buildOperationsCronRuntimeGroups(cronJobs);
  const summary = getOperationsCronRuntimeSummary(cronJobs);

  return {
    cronJobs,
    cronRuntime: summary,
    groups,
    legacyCronJobs: cronJobs
      .filter((cron) => cron.groupKey !== "future-cron-hooks")
      .map((cron) => ({
        lastRun: cron.lastRunAt,
        name: cron.cronName,
        nextRun: cron.nextRunLabel,
        schedule: cron.scheduleExpression,
        status: mapLegacyCronStatus(cron.runtimeStatus)
      })),
    safeControls: buildSafeControls()
  };
}

export function mapOperationsCronRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsCronRuntimeReadOnlySafe>>
) {
  return {
    cronJobs: input.cronJobs,
    cronRuntime: input.cronRuntime,
    groups: input.groups,
    legacyCronJobs: input.legacyCronJobs,
    safeControls: input.safeControls
  };
}
