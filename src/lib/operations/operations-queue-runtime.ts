import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsQueueRuntimeSource = "operations_queue_runtime";

export type OperationsQueueGroupKey =
  | "ai-queue"
  | "domain-email-queue"
  | "email-queue"
  | "future-queue-hooks";

export type OperationsQueueRuntimeStatus =
  | "active"
  | "disabled"
  | "empty"
  | "has_failed_jobs"
  | "has_pending_jobs"
  | "no_table_detected"
  | "registered"
  | "review_required";

export type OperationsQueueReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsQueueSafeControlKey = "inspect" | "pause" | "purge" | "resume" | "retry";

export type OperationsQueueSafeControl = {
  enabled: false;
  key: OperationsQueueSafeControlKey;
  label: string;
  note: string;
};

export type OperationsQueueRuntimeItem = {
  completedJobs: number;
  failedJobs: number;
  groupKey: OperationsQueueGroupKey;
  lastFailureAt: string | null;
  lastJobAt: string | null;
  pendingJobs: number;
  processingJobs: number;
  queueKey: string;
  queueName: string;
  registryKey: string;
  reviewStatus: OperationsQueueReviewStatus;
  runtimeStatus: OperationsQueueRuntimeStatus;
  safeControls: OperationsQueueSafeControl[];
  tableDetected: boolean;
  tableName: string | null;
  totalJobs: number;
  visibility: OperationsRegistryVisibility;
};

export type OperationsQueueRuntimeGroup = {
  groupKey: OperationsQueueGroupKey;
  itemCount: number;
  items: OperationsQueueRuntimeItem[];
  title: string;
};

export type OperationsQueueRuntimeSummary = {
  activeQueues: number;
  failedQueues: number;
  groupCount: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsQueueRuntimeSource;
  status: "needs_attention" | "queue_runtime_ready";
  summary: string;
  totalQueues: number;
};

export type DomainEmailQueueSnapshot = {
  completedJobs: number;
  failedJobs: number;
  lastFailureAt: string | null;
  lastJobAt: string | null;
  pendingJobs: number;
  processingJobs: number;
  sourceDetected: boolean;
  totalJobs: number;
};

type AnyRecord = Record<string, unknown>;

export const OPERATIONS_QUEUE_RUNTIME_SOURCE = "operations_queue_runtime" as const;

export const OPERATIONS_QUEUE_SAFE_CONTROLS: readonly OperationsQueueSafeControl[] = [
  {
    enabled: false,
    key: "retry",
    label: "Retry",
    note: "Read-only placeholder. No queue retry is executed during OP-3 page load."
  },
  {
    enabled: false,
    key: "pause",
    label: "Pause",
    note: "Read-only placeholder. No queue pause action is available during OP-3 page load."
  },
  {
    enabled: false,
    key: "resume",
    label: "Resume",
    note: "Read-only placeholder. No queue resume action is available during OP-3 page load."
  },
  {
    enabled: false,
    key: "purge",
    label: "Purge",
    note: "Read-only placeholder. No queue purge action is available during OP-3 page load."
  },
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No queue inspection worker is connected during OP-3 page load."
  }
] as const;

const QUEUE_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsQueueGroupKey;
  registryKey: string;
  tableName: string | null;
  title: string;
}> = [
  {
    groupKey: "email-queue",
    registryKey: "op-email-queue",
    tableName: "email_event_logs",
    title: "Email Queue"
  },
  {
    groupKey: "ai-queue",
    registryKey: "op-ai-queue",
    tableName: "ai_generation_queue",
    title: "AI Queue"
  },
  {
    groupKey: "domain-email-queue",
    registryKey: "op-domain-email-queue",
    tableName: null,
    title: "Domain & Email Queue"
  },
  {
    groupKey: "future-queue-hooks",
    registryKey: "op-future-hooks",
    tableName: null,
    title: "Future Queue Hooks"
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
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") as AnyRecord[] : [];
}

function latestDate(rows: AnyRecord[], keys: string[]) {
  return (
    rows
      .flatMap((row) => keys.map((key) => text(row[key])).filter(Boolean))
      .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null
  );
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const message = text(error.message).toLowerCase();
  return error.code === "42P01" || message.includes("does not exist") || message.includes("could not find the table");
}

async function safeQueueTableSelect(
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

      console.warn(`[operations-queue-runtime] read-only queue select failed for ${table}`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-queue-runtime] read-only queue select crashed for ${table}`, error);
    return { rows: [], tableDetected: false };
  }
}

function buildSafeControls() {
  return OPERATIONS_QUEUE_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function resolveReviewStatus(failedJobs: number, pendingJobs: number, tableDetected: boolean): OperationsQueueReviewStatus {
  if (!tableDetected) {
    return "not_applicable";
  }

  if (failedJobs > 0) {
    return "review_required";
  }

  if (pendingJobs > 0) {
    return "clear";
  }

  return "clear";
}

function resolveQueueRuntimeStatus(input: {
  failedJobs: number;
  forceDisabled?: boolean;
  pendingJobs: number;
  reviewStatus: OperationsQueueReviewStatus;
  tableDetected: boolean;
  totalJobs: number;
}): OperationsQueueRuntimeStatus {
  if (input.forceDisabled) {
    return "disabled";
  }

  if (!input.tableDetected) {
    return "no_table_detected";
  }

  if (input.failedJobs > 0) {
    return "has_failed_jobs";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.pendingJobs > 0) {
    return "has_pending_jobs";
  }

  if (input.totalJobs === 0) {
    return "empty";
  }

  if (input.totalJobs > 0) {
    return "active";
  }

  return "registered";
}

function buildEmailQueueRuntimeItem(rows: AnyRecord[], tableDetected: boolean): OperationsQueueRuntimeItem {
  const registryEntry = getOperationsRegistryEntry("op-email-queue");
  const completedJobs = rows.filter((row) => text(row.status) === "sent").length;
  const failedJobs = rows.filter((row) => text(row.status) === "failed").length;
  const pendingJobs = rows.filter((row) =>
    ["pending", "queued", "retry_pending"].includes(text(row.status))
  ).length;
  const processingJobs = rows.filter((row) => text(row.status) === "processing").length;
  const totalJobs = rows.length;
  const lastJobAt = latestDate(rows, ["sent_at", "created_at", "updated_at"]);
  const lastFailureAt = latestDate(
    rows.filter((row) => text(row.status) === "failed"),
    ["updated_at", "created_at", "sent_at"]
  );

  return {
    completedJobs,
    failedJobs,
    groupKey: "email-queue",
    lastFailureAt,
    lastJobAt,
    pendingJobs,
    processingJobs,
    queueKey: "op-email-queue",
    queueName: registryEntry?.title ?? "Email Queue",
    registryKey: "op-email-queue",
    reviewStatus: resolveReviewStatus(failedJobs, pendingJobs, tableDetected),
    runtimeStatus: resolveQueueRuntimeStatus({
      failedJobs,
      pendingJobs,
      reviewStatus: resolveReviewStatus(failedJobs, pendingJobs, tableDetected),
      tableDetected,
      totalJobs
    }),
    safeControls: buildSafeControls(),
    tableDetected,
    tableName: "email_event_logs",
    totalJobs,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildAiQueueRuntimeItem(rows: AnyRecord[], tableDetected: boolean): OperationsQueueRuntimeItem {
  const registryEntry = getOperationsRegistryEntry("op-ai-queue");
  const completedJobs = rows.filter((row) =>
    ["succeeded", "completed", "ready"].includes(text(row.queue_status, text(row.workflow_state)))
  ).length;
  const failedJobs = rows.filter(
    (row) => text(row.queue_status) === "failed" || text(row.workflow_state) === "failed"
  ).length;
  const pendingJobs = rows.filter((row) =>
    ["queued", "waiting", "pending"].includes(text(row.queue_status, text(row.workflow_state)))
  ).length;
  const processingJobs = rows.filter((row) =>
    ["running", "processing", "generating"].includes(text(row.queue_status, text(row.workflow_state)))
  ).length;
  const totalJobs = rows.length;
  const lastJobAt = latestDate(rows, ["completed_at", "failed_at", "updated_at", "created_at"]);
  const lastFailureAt = latestDate(
    rows.filter((row) => text(row.queue_status) === "failed" || text(row.workflow_state) === "failed"),
    ["failed_at", "updated_at", "created_at"]
  );

  return {
    completedJobs,
    failedJobs,
    groupKey: "ai-queue",
    lastFailureAt,
    lastJobAt,
    pendingJobs,
    processingJobs,
    queueKey: "op-ai-queue",
    queueName: registryEntry?.title ?? "AI Queue",
    registryKey: "op-ai-queue",
    reviewStatus: resolveReviewStatus(failedJobs, pendingJobs, tableDetected),
    runtimeStatus: resolveQueueRuntimeStatus({
      failedJobs,
      pendingJobs,
      reviewStatus: resolveReviewStatus(failedJobs, pendingJobs, tableDetected),
      tableDetected,
      totalJobs
    }),
    safeControls: buildSafeControls(),
    tableDetected,
    tableName: "ai_generation_queue",
    totalJobs,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildDomainEmailQueueRuntimeItem(snapshot: DomainEmailQueueSnapshot | null): OperationsQueueRuntimeItem {
  const registryEntry = getOperationsRegistryEntry("op-domain-email-queue");
  const tableDetected = snapshot?.sourceDetected ?? false;
  const completedJobs = snapshot?.completedJobs ?? 0;
  const failedJobs = snapshot?.failedJobs ?? 0;
  const pendingJobs = snapshot?.pendingJobs ?? 0;
  const processingJobs = snapshot?.processingJobs ?? 0;
  const totalJobs = snapshot?.totalJobs ?? 0;
  const lastJobAt = snapshot?.lastJobAt ?? null;
  const lastFailureAt = snapshot?.lastFailureAt ?? null;

  return {
    completedJobs,
    failedJobs,
    groupKey: "domain-email-queue",
    lastFailureAt,
    lastJobAt,
    pendingJobs,
    processingJobs,
    queueKey: "op-domain-email-queue",
    queueName: registryEntry?.title ?? "Domain & Email Queue",
    registryKey: "op-domain-email-queue",
    reviewStatus: resolveReviewStatus(failedJobs, pendingJobs, tableDetected),
    runtimeStatus: resolveQueueRuntimeStatus({
      failedJobs,
      pendingJobs,
      reviewStatus: resolveReviewStatus(failedJobs, pendingJobs, tableDetected),
      tableDetected,
      totalJobs
    }),
    safeControls: buildSafeControls(),
    tableDetected,
    tableName: null,
    totalJobs,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildFutureQueueHookItems(): OperationsQueueRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /queue|retry|worker/i.test(hook))
    .map((hook, index) => ({
      completedJobs: 0,
      failedJobs: 0,
      groupKey: "future-queue-hooks" as const,
      lastFailureAt: null,
      lastJobAt: null,
      pendingJobs: 0,
      processingJobs: 0,
      queueKey: `op-future-queue-hook-${index + 1}`,
      queueName: hook,
      registryKey: "op-future-hooks",
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "disabled" as const,
      safeControls: buildSafeControls(),
      tableDetected: false,
      tableName: null,
      totalJobs: 0,
      visibility: registryEntry?.visibility ?? "super_admin"
    }));
}

export function operationsQueueRuntimeStatusLabel(status: OperationsQueueRuntimeStatus) {
  switch (status) {
    case "active":
      return "Active";
    case "disabled":
      return "Disabled";
    case "empty":
      return "Empty";
    case "has_failed_jobs":
      return "Has Failed Jobs";
    case "has_pending_jobs":
      return "Has Pending Jobs";
    case "no_table_detected":
      return "No Table Detected";
    case "registered":
      return "Registered";
    case "review_required":
      return "Review Required";
  }
}

export function operationsQueueRuntimeStatusBadgeTone(status: OperationsQueueRuntimeStatus) {
  switch (status) {
    case "active":
    case "registered":
      return "green" as const;
    case "empty":
    case "has_pending_jobs":
      return "blue" as const;
    case "has_failed_jobs":
    case "review_required":
      return "amber" as const;
    case "no_table_detected":
      return "red" as const;
    case "disabled":
      return "slate" as const;
  }
}

export function buildDomainEmailQueueSnapshot(input: {
  domainOrders: Array<{ createdAt: string | null; status?: string | null }>;
  emailOrders: Array<{ createdAt: string | null; status?: string | null }>;
  overview: {
    connectedDomains: number;
    dnsPending: number;
    emailMailboxDrafts: number;
    failedOperations: number;
    pendingDomainOrders: number;
    readyForRegistration: number;
    sslPending: number;
  };
  sourceDetected: boolean;
}): DomainEmailQueueSnapshot {
  const pendingJobs =
    input.overview.pendingDomainOrders +
    input.overview.dnsPending +
    input.overview.sslPending +
    input.overview.emailMailboxDrafts;
  const processingJobs = input.overview.readyForRegistration;
  const completedJobs = input.overview.connectedDomains;
  const failedJobs = input.overview.failedOperations;
  const totalJobs = pendingJobs + processingJobs + completedJobs + failedJobs;
  const allOrders = [...input.domainOrders, ...input.emailOrders];
  const failedOrders = allOrders.filter((order) => text(order.status).toLowerCase().includes("fail"));
  const lastJobAt =
    allOrders
      .map((order) => order.createdAt)
      .filter(Boolean)
      .sort((left, right) => dateValue(right ?? "") - dateValue(left ?? ""))[0] ?? null;
  const lastFailureAt =
    failedOrders
      .map((order) => order.createdAt)
      .filter(Boolean)
      .sort((left, right) => dateValue(right ?? "") - dateValue(left ?? ""))[0] ?? null;

  return {
    completedJobs,
    failedJobs,
    lastFailureAt,
    lastJobAt,
    pendingJobs,
    processingJobs,
    sourceDetected: input.sourceDetected,
    totalJobs
  };
}

export function buildOperationsQueueRuntimeGroups(items: OperationsQueueRuntimeItem[]): OperationsQueueRuntimeGroup[] {
  return QUEUE_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsQueueRuntimeSummary(items: OperationsQueueRuntimeItem[]): OperationsQueueRuntimeSummary {
  const operationalQueues = items.filter((item) => item.groupKey !== "future-queue-hooks");
  const activeQueues = operationalQueues.filter((item) => item.runtimeStatus === "active").length;
  const failedQueues = operationalQueues.filter(
    (item) => item.runtimeStatus === "has_failed_jobs" || item.reviewStatus === "review_required"
  ).length;
  const status = failedQueues > 0 || operationalQueues.some((item) => item.runtimeStatus === "no_table_detected")
    ? ("needs_attention" as const)
    : ("queue_runtime_ready" as const);

  return {
    activeQueues,
    failedQueues,
    groupCount: buildOperationsQueueRuntimeGroups(items).length,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_QUEUE_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalQueues.length} operational queues`,
      `${activeQueues} active`,
      `${failedQueues} require review`
    ].join("; "),
    totalQueues: items.length
  };
}

export async function loadOperationsQueueRuntimeReadOnlySafe(params: {
  domainEmailSnapshot?: DomainEmailQueueSnapshot | null;
  supabase: SupabaseClient<Database>;
}) {
  const [emailLoad, aiLoad] = await Promise.all([
    safeQueueTableSelect(
      params.supabase,
      "email_event_logs",
      "id, status, sent_at, created_at, updated_at, next_retry_at",
      500
    ),
    safeQueueTableSelect(
      params.supabase,
      "ai_generation_queue",
      "id, workflow_state, queue_status, attempts, max_attempts, completed_at, failed_at, created_at, updated_at",
      500
    )
  ]);

  const queues = [
    buildEmailQueueRuntimeItem(emailLoad.rows, emailLoad.tableDetected),
    buildAiQueueRuntimeItem(aiLoad.rows, aiLoad.tableDetected),
    buildDomainEmailQueueRuntimeItem(params.domainEmailSnapshot ?? null),
    ...buildFutureQueueHookItems()
  ];

  const groups = buildOperationsQueueRuntimeGroups(queues);
  const summary = getOperationsQueueRuntimeSummary(queues);

  return {
    groups,
    legacyQueues: queues
      .filter((queue) => queue.groupKey !== "future-queue-hooks")
      .map((queue) => ({
        completed: queue.completedJobs,
        failed: queue.failedJobs,
        lastProcessed: queue.lastJobAt,
        name: queue.queueName,
        pending: queue.pendingJobs,
        processing: queue.processingJobs
      })),
    queueRuntime: summary,
    queues,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsQueueRuntimeToAdminFields(input: Awaited<ReturnType<typeof loadOperationsQueueRuntimeReadOnlySafe>>) {
  return {
    groups: input.groups,
    legacyQueues: input.legacyQueues,
    queueRuntime: input.queueRuntime,
    queues: input.queues,
    safeControls: input.safeControls
  };
}
