import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsAiQueueRuntimeSource = "operations_ai_queue_runtime";

export type OperationsAiQueueGroupKey =
  | "content-generation-queue"
  | "future-ai-queue-hooks"
  | "image-generation-queue"
  | "marketplace-ai-queue"
  | "reports-ai-queue"
  | "seo-ai-queue"
  | "video-generation-queue";

export type OperationsAiQueueRuntimeStatus =
  | "active"
  | "disabled"
  | "empty"
  | "future_hook"
  | "has_failed_jobs"
  | "has_pending_jobs"
  | "no_table_detected"
  | "registered"
  | "review_required";

export type OperationsAiQueueReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsAiQueueSafeControlKey = "cancel_pending" | "inspect" | "pause_queue" | "resume_queue" | "retry_failed";

export type OperationsAiQueueSafeControl = {
  enabled: false;
  key: OperationsAiQueueSafeControlKey;
  label: string;
  note: string;
};

export type OperationsAiQueueRuntimeItem = {
  aiQueueKey: string;
  cancelledJobs: number;
  completedJobs: number;
  failedJobs: number;
  groupKey: OperationsAiQueueGroupKey;
  lastFailureAt: string | null;
  lastJobAt: string | null;
  modelFamily: string;
  pendingJobs: number;
  processingJobs: number;
  provider: string;
  queueName: string;
  registryKey: string;
  reviewStatus: OperationsAiQueueReviewStatus;
  runtimeStatus: OperationsAiQueueRuntimeStatus;
  safeControls: OperationsAiQueueSafeControl[];
  tableDetected: boolean;
  totalJobs: number;
  visibility: OperationsRegistryVisibility;
};

export type OperationsAiQueueRuntimeGroup = {
  groupKey: OperationsAiQueueGroupKey;
  itemCount: number;
  items: OperationsAiQueueRuntimeItem[];
  title: string;
};

export type OperationsAiQueueRuntimeSummary = {
  activeQueues: number;
  failedQueues: number;
  groupCount: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsAiQueueRuntimeSource;
  status: "ai_queue_runtime_ready" | "needs_attention";
  summary: string;
  totalQueues: number;
};

type AnyRecord = Record<string, unknown>;

type AiQueueGroupDefinition = {
  aiQueueKey: string;
  groupKey: OperationsAiQueueGroupKey;
  matchesRow: (row: AnyRecord) => boolean;
  queueName: string;
  registryKey: string;
};

export const OPERATIONS_AI_QUEUE_RUNTIME_SOURCE = "operations_ai_queue_runtime" as const;

export const OPERATIONS_AI_QUEUE_SAFE_CONTROLS: readonly OperationsAiQueueSafeControl[] = [
  {
    enabled: false,
    key: "retry_failed",
    label: "Retry Failed",
    note: "Read-only placeholder. No AI retry is executed during OP-9 page load."
  },
  {
    enabled: false,
    key: "pause_queue",
    label: "Pause Queue",
    note: "Read-only placeholder. No AI queue pause runs during OP-9 page load."
  },
  {
    enabled: false,
    key: "resume_queue",
    label: "Resume Queue",
    note: "Read-only placeholder. No AI queue resume runs during OP-9 page load."
  },
  {
    enabled: false,
    key: "cancel_pending",
    label: "Cancel Pending",
    note: "Read-only placeholder. No AI job cancellation runs during OP-9 page load."
  },
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No prompt or output inspection runs during OP-9 page load."
  }
] as const;

const AI_QUEUE_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsAiQueueGroupKey;
  title: string;
}> = [
  { groupKey: "content-generation-queue", title: "Content Generation Queue" },
  { groupKey: "image-generation-queue", title: "Image Generation Queue" },
  { groupKey: "video-generation-queue", title: "Video Generation Queue" },
  { groupKey: "seo-ai-queue", title: "SEO AI Queue" },
  { groupKey: "reports-ai-queue", title: "Reports AI Queue" },
  { groupKey: "marketplace-ai-queue", title: "Marketplace AI Queue" },
  { groupKey: "future-ai-queue-hooks", title: "Future AI Queue Hooks" }
];

const AI_QUEUE_DEFINITIONS: readonly AiQueueGroupDefinition[] = [
  {
    aiQueueKey: "op-ai-queue-image",
    groupKey: "image-generation-queue",
    matchesRow: (row) => {
      const jobType = clip(row._jobType, 120).toLowerCase();
      const workflow = clip(row.workflow_state, 120).toLowerCase();
      return jobType.includes("image") || workflow.includes("image");
    },
    queueName: "Image generation queue",
    registryKey: "op-ai-queue"
  },
  {
    aiQueueKey: "op-ai-queue-video",
    groupKey: "video-generation-queue",
    matchesRow: (row) => {
      const jobType = clip(row._jobType, 120).toLowerCase();
      const workflow = clip(row.workflow_state, 120).toLowerCase();
      return jobType.includes("video") || workflow.includes("video");
    },
    queueName: "Video generation queue",
    registryKey: "op-ai-queue"
  },
  {
    aiQueueKey: "op-ai-queue-seo",
    groupKey: "seo-ai-queue",
    matchesRow: (row) => {
      const jobType = clip(row._jobType, 120).toLowerCase();
      const workflow = clip(row.workflow_state, 120).toLowerCase();
      return jobType.includes("seo") || workflow.includes("seo");
    },
    queueName: "SEO AI queue",
    registryKey: "op-ai-queue"
  },
  {
    aiQueueKey: "op-ai-queue-reports",
    groupKey: "reports-ai-queue",
    matchesRow: (row) => {
      const jobType = clip(row._jobType, 120).toLowerCase();
      const workflow = clip(row.workflow_state, 120).toLowerCase();
      return jobType.includes("report") || workflow.includes("report");
    },
    queueName: "Reports AI queue",
    registryKey: "op-ai-queue"
  },
  {
    aiQueueKey: "op-ai-queue-marketplace",
    groupKey: "marketplace-ai-queue",
    matchesRow: (row) => {
      const jobType = clip(row._jobType, 120).toLowerCase();
      const workflow = clip(row.workflow_state, 120).toLowerCase();
      return (
        jobType.includes("marketplace") ||
        jobType.includes("plugin") ||
        jobType.includes("template") ||
        workflow.includes("marketplace")
      );
    },
    queueName: "Marketplace AI queue",
    registryKey: "op-ai-queue"
  },
  {
    aiQueueKey: "op-ai-queue-content",
    groupKey: "content-generation-queue",
    matchesRow: (row) => {
      const jobType = clip(row._jobType, 120).toLowerCase();
      const workflow = clip(row.workflow_state, 120).toLowerCase();
      return (
        [
          "store_generation",
          "theme_generation",
          "sections_generation",
          "copy_generation",
          "branding_generation"
        ].includes(jobType) ||
        ["validating", "planning", "generating_schema", "mapping_to_builder", "saving_draft", "queued"].includes(
          workflow
        )
      );
    },
    queueName: "Content generation queue",
    registryKey: "op-ai-queue"
  }
] as const;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clip(value: unknown, maxLength = 500) {
  return text(value).slice(0, maxLength);
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
  return OPERATIONS_AI_QUEUE_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function sanitizeProvider(value: unknown) {
  const provider = clip(value, 80).toLowerCase();

  if (!provider) {
    return "not_configured";
  }

  if (
    provider.includes("secret") ||
    provider.includes("key") ||
    provider.includes("token") ||
    provider.includes("password") ||
    provider.includes("sk-")
  ) {
    return "masked_provider";
  }

  return provider;
}

function latestDate(rows: AnyRecord[], keys: string[]) {
  return (
    rows
      .flatMap((row) => keys.map((key) => text(row[key])).filter(Boolean))
      .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null
  );
}

function resolveReviewStatus(failedJobs: number, tableDetected: boolean): OperationsAiQueueReviewStatus {
  if (!tableDetected) {
    return "not_applicable";
  }

  if (failedJobs > 0) {
    return "review_required";
  }

  return "clear";
}

function resolveAiQueueRuntimeStatus(input: {
  failedJobs: number;
  forceDisabled?: boolean;
  forceFutureHook?: boolean;
  pendingJobs: number;
  reviewStatus: OperationsAiQueueReviewStatus;
  tableDetected: boolean;
  totalJobs: number;
}): OperationsAiQueueRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

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

function resolvePrimaryProvider(rows: AnyRecord[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const provider = sanitizeProvider(row._provider);

    if (provider === "not_configured" || provider === "masked_provider") {
      continue;
    }

    counts.set(provider, (counts.get(provider) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  return sorted[0]?.[0] ?? "not_configured";
}

function resolveModelFamily(rows: AnyRecord[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const jobType = clip(row._jobType, 120).toLowerCase();
    const provider = sanitizeProvider(row._provider);
    let family = "general_ai";

    if (jobType.includes("image")) {
      family = "image_generation";
    } else if (jobType.includes("video")) {
      family = "video_generation";
    } else if (jobType.includes("seo")) {
      family = "seo_generation";
    } else if (jobType.includes("report")) {
      family = "report_generation";
    } else if (
      jobType.includes("copy") ||
      jobType.includes("store") ||
      jobType.includes("theme") ||
      jobType.includes("sections") ||
      jobType.includes("branding")
    ) {
      family = "text_generation";
    } else if (provider !== "not_configured" && provider !== "masked_provider") {
      family = `${provider}_models`;
    }

    counts.set(family, (counts.get(family) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  return sorted[0]?.[0] ?? "not_configured";
}

function countJobsByStatus(rows: AnyRecord[]) {
  const completedJobs = rows.filter((row) =>
    ["succeeded", "completed", "ready"].includes(text(row.queue_status, text(row.workflow_state)).toLowerCase())
  ).length;
  const failedJobs = rows.filter(
    (row) => text(row.queue_status).toLowerCase() === "failed" || text(row.workflow_state).toLowerCase() === "failed"
  ).length;
  const pendingJobs = rows.filter((row) =>
    ["queued", "waiting", "pending", "blocked"].includes(text(row.queue_status, text(row.workflow_state)).toLowerCase())
  ).length;
  const processingJobs = rows.filter((row) =>
    ["running", "processing", "generating", "active"].includes(
      text(row.queue_status, text(row.workflow_state)).toLowerCase()
    ) ||
    ["validating", "planning", "generating_schema", "mapping_to_builder", "saving_draft"].includes(
      text(row.workflow_state).toLowerCase()
    )
  ).length;
  const cancelledJobs = rows.filter(
    (row) =>
      text(row.queue_status).toLowerCase() === "cancelled" || text(row.workflow_state).toLowerCase() === "cancelled"
  ).length;

  return {
    cancelledJobs,
    completedJobs,
    failedJobs,
    pendingJobs,
    processingJobs,
    totalJobs: rows.length
  };
}

function partitionAiQueueRows(rows: AnyRecord[]) {
  const assignments = new Map<string, AnyRecord[]>(
    AI_QUEUE_DEFINITIONS.map((definition) => [definition.aiQueueKey, [] as AnyRecord[]])
  );
  const unmatched: AnyRecord[] = [];

  for (const row of rows) {
    const definition = AI_QUEUE_DEFINITIONS.find((entry) => entry.matchesRow(row));

    if (definition) {
      assignments.get(definition.aiQueueKey)?.push(row);
    } else {
      unmatched.push(row);
    }
  }

  if (unmatched.length) {
    assignments.get("op-ai-queue-content")?.push(...unmatched);
  }

  return assignments;
}

function enrichQueueRowsWithJobMetadata(queueRows: AnyRecord[], jobRows: AnyRecord[]) {
  const jobsById = new Map(jobRows.map((row) => [text(row.id), row]));

  return queueRows.map((row) => {
    const job = jobsById.get(text(row.job_id));

    return {
      ...row,
      _jobType: text(job?.job_type),
      _provider: text(job?.provider)
    };
  });
}

function buildAiQueueRuntimeItem(input: {
  definition: AiQueueGroupDefinition;
  rows: AnyRecord[];
  tableDetected: boolean;
}): OperationsAiQueueRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const counts = countJobsByStatus(input.rows);
  const lastJobAt = latestDate(input.rows, ["completed_at", "failed_at", "updated_at", "created_at"]);
  const lastFailureAt = latestDate(
    input.rows.filter(
      (row) => text(row.queue_status).toLowerCase() === "failed" || text(row.workflow_state).toLowerCase() === "failed"
    ),
    ["failed_at", "updated_at", "created_at"]
  );
  const reviewStatus = resolveReviewStatus(counts.failedJobs, input.tableDetected);

  return {
    aiQueueKey: input.definition.aiQueueKey,
    cancelledJobs: counts.cancelledJobs,
    completedJobs: counts.completedJobs,
    failedJobs: counts.failedJobs,
    groupKey: input.definition.groupKey,
    lastFailureAt,
    lastJobAt,
    modelFamily: resolveModelFamily(input.rows),
    pendingJobs: counts.pendingJobs,
    processingJobs: counts.processingJobs,
    provider: resolvePrimaryProvider(input.rows),
    queueName: input.definition.queueName,
    registryKey: input.definition.registryKey,
    reviewStatus,
    runtimeStatus: resolveAiQueueRuntimeStatus({
      failedJobs: counts.failedJobs,
      pendingJobs: counts.pendingJobs,
      reviewStatus,
      tableDetected: input.tableDetected,
      totalJobs: counts.totalJobs
    }),
    safeControls: buildSafeControls(),
    tableDetected: input.tableDetected,
    totalJobs: counts.totalJobs,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildFutureAiQueueHookItems(): OperationsAiQueueRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /ai|queue|generation|retry|cancel|worker/i.test(hook))
    .map((hook, index) => ({
      aiQueueKey: `op-future-ai-queue-hook-${index + 1}`,
      cancelledJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      groupKey: "future-ai-queue-hooks" as const,
      lastFailureAt: null,
      lastJobAt: null,
      modelFamily: "future_hook",
      pendingJobs: 0,
      processingJobs: 0,
      provider: "future_hook",
      queueName: hook,
      registryKey: "op-future-hooks",
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      tableDetected: false,
      totalJobs: 0,
      visibility: registryEntry?.visibility ?? "super_admin"
    }));
}

async function safeAiQueueTableSelect(
  supabase: SupabaseClient<Database>,
  limit: number
): Promise<{ rows: AnyRecord[]; tableDetected: boolean }> {
  try {
    const { data, error } = await supabase
      .from("ai_generation_queue" as never)
      .select("id, job_id, workflow_state, queue_status, completed_at, failed_at, cancelled_at, created_at, updated_at")
      .limit(limit);

    if (error) {
      if (isMissingTableError(error)) {
        return { rows: [], tableDetected: false };
      }

      console.warn("[operations-ai-queue-runtime] read-only AI queue select failed", error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn("[operations-ai-queue-runtime] read-only AI queue select crashed", error);
    return { rows: [], tableDetected: false };
  }
}

async function safeAiJobMetadataSelect(
  supabase: SupabaseClient<Database>,
  jobIds: string[]
): Promise<{ rows: AnyRecord[]; tableDetected: boolean }> {
  const uniqueIds = [...new Set(jobIds.filter(Boolean))].slice(0, 200);

  if (!uniqueIds.length) {
    return { rows: [], tableDetected: false };
  }

  try {
    const { data, error } = await supabase
      .from("ai_generation_jobs" as never)
      .select("id, job_type, provider")
      .in("id", uniqueIds);

    if (error) {
      if (isMissingTableError(error)) {
        return { rows: [], tableDetected: false };
      }

      console.warn("[operations-ai-queue-runtime] read-only AI job metadata select failed", error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn("[operations-ai-queue-runtime] read-only AI job metadata select crashed", error);
    return { rows: [], tableDetected: false };
  }
}

export function operationsAiQueueRuntimeStatusLabel(status: OperationsAiQueueRuntimeStatus) {
  switch (status) {
    case "active":
      return "Active";
    case "disabled":
      return "Disabled";
    case "empty":
      return "Empty";
    case "future_hook":
      return "Future Hook";
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

export function operationsAiQueueRuntimeStatusBadgeTone(status: OperationsAiQueueRuntimeStatus) {
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
    case "future_hook":
      return "slate" as const;
  }
}

export function buildOperationsAiQueueRuntimeGroups(items: OperationsAiQueueRuntimeItem[]): OperationsAiQueueRuntimeGroup[] {
  return AI_QUEUE_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsAiQueueRuntimeSummary(items: OperationsAiQueueRuntimeItem[]): OperationsAiQueueRuntimeSummary {
  const operationalQueues = items.filter((item) => item.groupKey !== "future-ai-queue-hooks");
  const activeQueues = operationalQueues.filter((item) => item.runtimeStatus === "active").length;
  const failedQueues = operationalQueues.filter(
    (item) => item.runtimeStatus === "has_failed_jobs" || item.reviewStatus === "review_required"
  ).length;
  const status =
    failedQueues > 0 || operationalQueues.some((item) => item.runtimeStatus === "no_table_detected")
      ? ("needs_attention" as const)
      : ("ai_queue_runtime_ready" as const);

  return {
    activeQueues,
    failedQueues,
    groupCount: buildOperationsAiQueueRuntimeGroups(items).length,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_AI_QUEUE_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalQueues.length} AI queue groups`,
      `${activeQueues} active`,
      `${failedQueues} require review`
    ].join("; "),
    totalQueues: items.length
  };
}

export async function loadOperationsAiQueueRuntimeReadOnlySafe(params: { supabase: SupabaseClient<Database> }) {
  const aiLoad = await safeAiQueueTableSelect(params.supabase, 500);
  const jobIds = aiLoad.rows.map((row) => text(row.job_id)).filter(Boolean);
  const jobMetadataLoad = aiLoad.tableDetected ? await safeAiJobMetadataSelect(params.supabase, jobIds) : { rows: [], tableDetected: false };
  const enrichedRows = enrichQueueRowsWithJobMetadata(aiLoad.rows, jobMetadataLoad.rows);
  const partitionedRows = partitionAiQueueRows(enrichedRows);
  const aiQueues = [
    ...AI_QUEUE_DEFINITIONS.map((definition) =>
      buildAiQueueRuntimeItem({
        definition,
        rows: partitionedRows.get(definition.aiQueueKey) ?? [],
        tableDetected: aiLoad.tableDetected
      })
    ),
    ...buildFutureAiQueueHookItems()
  ];
  const groups = buildOperationsAiQueueRuntimeGroups(aiQueues);
  const summary = getOperationsAiQueueRuntimeSummary(aiQueues);

  return {
    aiQueueRuntime: summary,
    aiQueues,
    groups,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsAiQueueRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsAiQueueRuntimeReadOnlySafe>>
) {
  return {
    aiQueueRuntime: input.aiQueueRuntime,
    aiQueues: input.aiQueues,
    groups: input.groups,
    safeControls: input.safeControls
  };
}
