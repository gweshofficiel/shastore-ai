import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";
import type { OperationsQueueRuntimeItem } from "@/src/lib/operations/operations-queue-runtime";

export type OperationsWorkerRuntimeSource = "operations_worker_runtime";

export type OperationsWorkerGroupKey =
  | "ai-workers"
  | "cron-workers"
  | "domain-email-workers"
  | "email-workers"
  | "future-worker-hooks"
  | "queue-workers";

export type OperationsWorkerType =
  | "ai_generation"
  | "cron_monitor"
  | "domain_email_provider"
  | "email_delivery"
  | "future_hook"
  | "queue_processor";

export type OperationsWorkerRuntimeStatus =
  | "active"
  | "disabled"
  | "empty"
  | "failed"
  | "future_hook"
  | "idle"
  | "no_table_detected"
  | "registered"
  | "review_required";

export type OperationsWorkerReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsWorkerSafeControlKey = "inspect_logs" | "restart" | "retry" | "start" | "stop";

export type OperationsWorkerSafeControl = {
  enabled: false;
  key: OperationsWorkerSafeControlKey;
  label: string;
  note: string;
};

export type OperationsWorkerRuntimeItem = {
  failedRuns: number;
  groupKey: OperationsWorkerGroupKey;
  lastFailureAt: string | null;
  lastRunAt: string | null;
  lastSeenAt: string | null;
  linkedQueue: string;
  metadataSource: string | null;
  nextRunLabel: string;
  registryKey: string;
  reviewStatus: OperationsWorkerReviewStatus;
  runtimeStatus: OperationsWorkerRuntimeStatus;
  safeControls: OperationsWorkerSafeControl[];
  tableDetected: boolean;
  totalRuns: number;
  visibility: OperationsRegistryVisibility;
  workerKey: string;
  workerName: string;
  workerType: OperationsWorkerType;
};

export type OperationsWorkerRuntimeGroup = {
  groupKey: OperationsWorkerGroupKey;
  itemCount: number;
  items: OperationsWorkerRuntimeItem[];
  title: string;
};

export type OperationsWorkerRuntimeSummary = {
  activeWorkers: number;
  failedWorkers: number;
  groupCount: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsWorkerRuntimeSource;
  status: "needs_attention" | "worker_runtime_ready";
  summary: string;
  totalWorkers: number;
};

export type MonitoringWorkerSnapshot = {
  failedRuns: number;
  lastFailureAt: string | null;
  lastRunAt: string | null;
  sourceDetected: boolean;
  totalRuns: number;
};

type AnyRecord = Record<string, unknown>;

export const OPERATIONS_WORKER_RUNTIME_SOURCE = "operations_worker_runtime" as const;

export const OPERATIONS_WORKER_SAFE_CONTROLS: readonly OperationsWorkerSafeControl[] = [
  {
    enabled: false,
    key: "start",
    label: "Start",
    note: "Read-only placeholder. No worker start is executed during OP-4 page load."
  },
  {
    enabled: false,
    key: "stop",
    label: "Stop",
    note: "Read-only placeholder. No worker stop is executed during OP-4 page load."
  },
  {
    enabled: false,
    key: "restart",
    label: "Restart",
    note: "Read-only placeholder. No worker restart is executed during OP-4 page load."
  },
  {
    enabled: false,
    key: "retry",
    label: "Retry",
    note: "Read-only placeholder. No worker retry is executed during OP-4 page load."
  },
  {
    enabled: false,
    key: "inspect_logs",
    label: "Inspect Logs",
    note: "Read-only placeholder. No worker log inspection worker is connected during OP-4 page load."
  }
] as const;

const WORKER_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsWorkerGroupKey;
  title: string;
}> = [
  { groupKey: "email-workers", title: "Email Workers" },
  { groupKey: "ai-workers", title: "AI Workers" },
  { groupKey: "domain-email-workers", title: "Domain & Email Workers" },
  { groupKey: "queue-workers", title: "Queue Workers" },
  { groupKey: "cron-workers", title: "Cron Workers" },
  { groupKey: "future-worker-hooks", title: "Future Worker Hooks" }
];

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
  return OPERATIONS_WORKER_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function resolveReviewStatus(failedRuns: number, tableDetected: boolean): OperationsWorkerReviewStatus {
  if (!tableDetected) {
    return "not_applicable";
  }

  if (failedRuns > 0) {
    return "review_required";
  }

  return "clear";
}

function resolveWorkerRuntimeStatus(input: {
  failedRuns: number;
  forceDisabled?: boolean;
  forceFutureHook?: boolean;
  processingJobs: number;
  reviewStatus: OperationsWorkerReviewStatus;
  tableDetected: boolean;
  totalRuns: number;
}): OperationsWorkerRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

  if (input.forceDisabled) {
    return "disabled";
  }

  if (!input.tableDetected) {
    return "no_table_detected";
  }

  if (input.failedRuns > 0) {
    return "failed";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.totalRuns === 0) {
    return "empty";
  }

  if (input.processingJobs > 0) {
    return "active";
  }

  if (input.totalRuns > 0) {
    return "idle";
  }

  return "registered";
}

function resolveLastSeenAt(lastRunAt: string | null, lastFailureAt: string | null) {
  const timestamps = [lastRunAt, lastFailureAt].filter(Boolean) as string[];

  if (!timestamps.length) {
    return null;
  }

  return timestamps.sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;
}

async function safeWorkerMetadataSelect(
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

      console.warn(`[operations-worker-runtime] read-only worker metadata select failed for ${table}`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-worker-runtime] read-only worker metadata select crashed for ${table}`, error);
    return { rows: [], tableDetected: false };
  }
}

function buildQueueLinkedWorkerItem(input: {
  groupKey: OperationsWorkerGroupKey;
  linkedQueueKey: string;
  linkedQueueName: string;
  metadataSource: string | null;
  nextRunLabel: string;
  queueItem: OperationsQueueRuntimeItem | null;
  registryKey: string;
  tableDetected: boolean;
  workerKey: string;
  workerName: string;
  workerType: OperationsWorkerType;
}): OperationsWorkerRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.registryKey);
  const processingJobs = input.queueItem?.processingJobs ?? 0;
  const failedRuns = input.queueItem?.failedJobs ?? 0;
  const completedRuns = input.queueItem?.completedJobs ?? 0;
  const totalRuns = completedRuns + failedRuns + processingJobs;
  const lastRunAt = input.queueItem?.lastJobAt ?? null;
  const lastFailureAt = input.queueItem?.lastFailureAt ?? null;
  const reviewStatus = resolveReviewStatus(failedRuns, input.tableDetected);

  return {
    failedRuns,
    groupKey: input.groupKey,
    lastFailureAt,
    lastRunAt,
    lastSeenAt: resolveLastSeenAt(lastRunAt, lastFailureAt),
    linkedQueue: input.linkedQueueName,
    metadataSource: input.metadataSource,
    nextRunLabel: input.nextRunLabel,
    registryKey: input.registryKey,
    reviewStatus,
    runtimeStatus: resolveWorkerRuntimeStatus({
      failedRuns,
      processingJobs,
      reviewStatus,
      tableDetected: input.tableDetected,
      totalRuns
    }),
    safeControls: buildSafeControls(),
    tableDetected: input.tableDetected,
    totalRuns,
    visibility: registryEntry?.visibility ?? "super_admin",
    workerKey: input.workerKey,
    workerName: input.workerName,
    workerType: input.workerType
  };
}

function buildMonitoringWorkerItem(snapshot: MonitoringWorkerSnapshot): OperationsWorkerRuntimeItem {
  const registryEntry = getOperationsRegistryEntry("op-worker-tables");
  const reviewStatus = resolveReviewStatus(snapshot.failedRuns, snapshot.sourceDetected);

  return {
    failedRuns: snapshot.failedRuns,
    groupKey: "queue-workers",
    lastFailureAt: snapshot.lastFailureAt,
    lastRunAt: snapshot.lastRunAt,
    lastSeenAt: resolveLastSeenAt(snapshot.lastRunAt, snapshot.lastFailureAt),
    linkedQueue: "Monitoring event stream",
    metadataSource: "monitoring_events",
    nextRunLabel: "Live event stream",
    registryKey: "op-worker-tables",
    reviewStatus,
    runtimeStatus: resolveWorkerRuntimeStatus({
      failedRuns: snapshot.failedRuns,
      processingJobs: 0,
      reviewStatus,
      tableDetected: snapshot.sourceDetected,
      totalRuns: snapshot.totalRuns
    }),
    safeControls: buildSafeControls(),
    tableDetected: snapshot.sourceDetected,
    totalRuns: snapshot.totalRuns,
    visibility: registryEntry?.visibility ?? "super_admin",
    workerKey: "op-worker-monitoring-processor",
    workerName: "Monitoring event processor",
    workerType: "queue_processor"
  };
}

function buildCronWorkerItems(input: {
  aiQueueLastRun: string | null;
  aiQueueFailed: boolean;
  domainQueueFailed: boolean;
  domainQueueLastRun: string | null;
  emailQueueFailed: boolean;
  emailQueueLastRun: string | null;
  latestMonitoring: string | null;
}): OperationsWorkerRuntimeItem[] {
  const definitions = [
    {
      failedRuns: 0,
      lastRunAt: input.latestMonitoring,
      linkedQueue: "Billing sync monitor",
      nextRunLabel: "Provider webhook driven",
      workerKey: "op-worker-billing-sync-monitor",
      workerName: "Billing sync monitor worker"
    },
    {
      failedRuns: input.emailQueueFailed ? 1 : 0,
      lastRunAt: input.emailQueueLastRun,
      linkedQueue: "Email event queue",
      nextRunLabel: "Future cron placeholder",
      workerKey: "op-worker-email-retry-monitor",
      workerName: "Email retry monitor worker"
    },
    {
      failedRuns: input.aiQueueFailed ? 1 : 0,
      lastRunAt: input.aiQueueLastRun,
      linkedQueue: "AI generation queue",
      nextRunLabel: "Future worker schedule",
      workerKey: "op-worker-ai-queue-monitor",
      workerName: "AI queue monitor worker"
    },
    {
      failedRuns: input.domainQueueFailed ? 1 : 0,
      lastRunAt: input.domainQueueLastRun,
      linkedQueue: "Domain & Email Queue",
      nextRunLabel: "Future provider sync",
      workerKey: "op-worker-domain-email-monitor",
      workerName: "Domain/email workflow monitor worker"
    }
  ];

  return definitions.map((definition) => {
    const reviewStatus = resolveReviewStatus(definition.failedRuns, true);

    return {
      failedRuns: definition.failedRuns,
      groupKey: "cron-workers" as const,
      lastFailureAt: definition.failedRuns ? definition.lastRunAt : null,
      lastRunAt: definition.lastRunAt,
      lastSeenAt: definition.lastRunAt,
      linkedQueue: definition.linkedQueue,
      metadataSource: "cron_monitor_registry",
      nextRunLabel: definition.nextRunLabel,
      registryKey: "op-cron-jobs",
      reviewStatus,
      runtimeStatus: resolveWorkerRuntimeStatus({
        failedRuns: definition.failedRuns,
        forceDisabled: false,
        processingJobs: 0,
        reviewStatus,
        tableDetected: true,
        totalRuns: definition.lastRunAt ? 1 : 0
      }),
      safeControls: buildSafeControls(),
      tableDetected: true,
      totalRuns: definition.lastRunAt ? 1 : 0,
      visibility: "super_admin" as const,
      workerKey: definition.workerKey,
      workerName: definition.workerName,
      workerType: "cron_monitor" as const
    };
  });
}

function buildFutureWorkerHookItems(): OperationsWorkerRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /worker|restart|retry/i.test(hook))
    .map((hook, index) => ({
      failedRuns: 0,
      groupKey: "future-worker-hooks" as const,
      lastFailureAt: null,
      lastRunAt: null,
      lastSeenAt: null,
      linkedQueue: "Reserved future hook",
      metadataSource: null,
      nextRunLabel: "Not scheduled",
      registryKey: "op-future-hooks",
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      tableDetected: false,
      totalRuns: 0,
      visibility: registryEntry?.visibility ?? "super_admin",
      workerKey: `op-future-worker-hook-${index + 1}`,
      workerName: hook,
      workerType: "future_hook" as const
    }));
}

export function buildMonitoringWorkerSnapshot(events: AnyRecord[]): MonitoringWorkerSnapshot {
  const failures = events.filter((event) => {
    const eventStatus = text(event.event_status).toLowerCase();
    const eventType = text(event.event_type).toLowerCase();
    return eventStatus === "failed" || eventType.includes("failed") || eventType.includes("error");
  });
  const successes = events.filter((event) =>
    ["info", "success", "recorded"].includes(text(event.event_status))
  );
  const lastRunAt = latestDate(events, ["created_at"]);
  const lastFailureAt = latestDate(failures, ["created_at"]);

  return {
    failedRuns: failures.length,
    lastFailureAt,
    lastRunAt,
    sourceDetected: true,
    totalRuns: successes.length + failures.length
  };
}

export function operationsWorkerRuntimeStatusLabel(status: OperationsWorkerRuntimeStatus) {
  switch (status) {
    case "active":
      return "Active";
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
  }
}

export function operationsWorkerRuntimeStatusBadgeTone(status: OperationsWorkerRuntimeStatus) {
  switch (status) {
    case "active":
      return "green" as const;
    case "idle":
    case "registered":
      return "blue" as const;
    case "empty":
      return "slate" as const;
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

export function buildOperationsWorkerRuntimeGroups(items: OperationsWorkerRuntimeItem[]): OperationsWorkerRuntimeGroup[] {
  return WORKER_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsWorkerRuntimeSummary(items: OperationsWorkerRuntimeItem[]): OperationsWorkerRuntimeSummary {
  const operationalWorkers = items.filter((item) => item.groupKey !== "future-worker-hooks");
  const activeWorkers = operationalWorkers.filter((item) => item.runtimeStatus === "active").length;
  const failedWorkers = operationalWorkers.filter(
    (item) => item.runtimeStatus === "failed" || item.reviewStatus === "review_required"
  ).length;
  const status = failedWorkers > 0 || operationalWorkers.some((item) => item.runtimeStatus === "no_table_detected")
    ? ("needs_attention" as const)
    : ("worker_runtime_ready" as const);

  return {
    activeWorkers,
    failedWorkers,
    groupCount: buildOperationsWorkerRuntimeGroups(items).length,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_WORKER_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalWorkers.length} operational workers`,
      `${activeWorkers} active`,
      `${failedWorkers} require review`
    ].join("; "),
    totalWorkers: items.length
  };
}

function mapLegacyWorkerStatus(
  runtimeStatus: OperationsWorkerRuntimeStatus
): "idle" | "placeholder" | "running" | "warning" {
  switch (runtimeStatus) {
    case "active":
      return "running";
    case "failed":
    case "review_required":
      return "warning";
    case "future_hook":
    case "disabled":
    case "no_table_detected":
      return "placeholder";
    default:
      return "idle";
  }
}

export async function loadOperationsWorkerRuntimeReadOnlySafe(params: {
  monitoringEvents: AnyRecord[];
  queueRuntimeItems: OperationsQueueRuntimeItem[];
  supabase: SupabaseClient<Database>;
}) {
  const emailQueueItem = params.queueRuntimeItems.find((item) => item.queueKey === "op-email-queue") ?? null;
  const aiQueueItem = params.queueRuntimeItems.find((item) => item.queueKey === "op-ai-queue") ?? null;
  const domainEmailQueueItem =
    params.queueRuntimeItems.find((item) => item.queueKey === "op-domain-email-queue") ?? null;

  const emailMetadataLoad = await safeWorkerMetadataSelect(
    params.supabase,
    "email_event_logs",
    "id, status, sent_at, created_at, updated_at",
    500
  );
  const aiMetadataLoad = await safeWorkerMetadataSelect(
    params.supabase,
    "ai_generation_queue",
    "id, queue_status, workflow_state, completed_at, failed_at, created_at, updated_at",
    500
  );
  const monitoringMetadataLoad = await safeWorkerMetadataSelect(
    params.supabase,
    "monitoring_events",
    "event_type, event_status, created_at",
    500
  );

  const monitoringSnapshot = buildMonitoringWorkerSnapshot(
    monitoringMetadataLoad.tableDetected ? monitoringMetadataLoad.rows : params.monitoringEvents
  );

  const workers = [
    buildQueueLinkedWorkerItem({
      groupKey: "email-workers",
      linkedQueueKey: "op-email-queue",
      linkedQueueName: emailQueueItem?.queueName ?? "Email Queue",
      metadataSource: emailMetadataLoad.tableDetected ? "email_event_logs" : null,
      nextRunLabel: "Queue driven",
      queueItem: emailQueueItem,
      registryKey: "op-worker-tables",
      tableDetected: emailMetadataLoad.tableDetected,
      workerKey: "op-worker-email-delivery",
      workerName: "Email delivery worker",
      workerType: "email_delivery"
    }),
    buildQueueLinkedWorkerItem({
      groupKey: "ai-workers",
      linkedQueueKey: "op-ai-queue",
      linkedQueueName: aiQueueItem?.queueName ?? "AI Queue",
      metadataSource: aiMetadataLoad.tableDetected ? "ai_generation_queue" : null,
      nextRunLabel: "Runtime driven",
      queueItem: aiQueueItem,
      registryKey: "op-worker-tables",
      tableDetected: aiMetadataLoad.tableDetected,
      workerKey: "op-worker-ai-generation",
      workerName: "AI visual/generation worker",
      workerType: "ai_generation"
    }),
    buildQueueLinkedWorkerItem({
      groupKey: "domain-email-workers",
      linkedQueueKey: "op-domain-email-queue",
      linkedQueueName: domainEmailQueueItem?.queueName ?? "Domain & Email Queue",
      metadataSource: "domains_hosting_workflow",
      nextRunLabel: "Future provider sync",
      queueItem: domainEmailQueueItem,
      registryKey: "op-worker-tables",
      tableDetected: domainEmailQueueItem?.tableDetected ?? false,
      workerKey: "op-worker-domain-email-provider",
      workerName: "Domain/email provider worker",
      workerType: "domain_email_provider"
    }),
    buildMonitoringWorkerItem(monitoringSnapshot),
    ...buildCronWorkerItems({
      aiQueueFailed: (aiQueueItem?.failedJobs ?? 0) > 0,
      aiQueueLastRun: aiQueueItem?.lastJobAt ?? null,
      domainQueueFailed: (domainEmailQueueItem?.failedJobs ?? 0) > 0,
      domainQueueLastRun: domainEmailQueueItem?.lastJobAt ?? null,
      emailQueueFailed: (emailQueueItem?.failedJobs ?? 0) > 0,
      emailQueueLastRun: emailQueueItem?.lastJobAt ?? null,
      latestMonitoring: monitoringSnapshot.lastRunAt
    }),
    ...buildFutureWorkerHookItems()
  ];

  const groups = buildOperationsWorkerRuntimeGroups(workers);
  const summary = getOperationsWorkerRuntimeSummary(workers);

  return {
    groups,
    legacyWorkers: workers
      .filter((worker) => worker.groupKey !== "future-worker-hooks" && worker.groupKey !== "cron-workers")
      .map((worker) => ({
        failures: worker.failedRuns,
        lastRun: worker.lastRunAt,
        name: worker.workerName,
        nextRun: worker.nextRunLabel,
        status: mapLegacyWorkerStatus(worker.runtimeStatus)
      })),
    safeControls: buildSafeControls(),
    workerRuntime: summary,
    workers
  };
}

export function mapOperationsWorkerRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsWorkerRuntimeReadOnlySafe>>
) {
  return {
    groups: input.groups,
    legacyWorkers: input.legacyWorkers,
    safeControls: input.safeControls,
    workerRuntime: input.workerRuntime,
    workers: input.workers
  };
}
