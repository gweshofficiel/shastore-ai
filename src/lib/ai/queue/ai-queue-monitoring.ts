import "server-only";
import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { aiVisualQueueFromStoreData } from "@/lib/storefront/ai-visual-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";
import type {
  AIQueueFilters,
  AIQueueJob,
  AIQueueJobStatus,
  AIQueueMonitoringSnapshot,
  AIQueueStaleState,
  AIQueueSummary
} from "@/src/lib/ai/queue/ai-queue-types";
import { normalizeOpenAIJobStatus } from "@/src/lib/ai/runtime/openai-job-status";

type QueryResult = PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
}>;

type SelectTable = {
  select: (columns: string) => {
    limit: (limit: number) => QueryResult;
  };
};

type AdminClient = {
  from: (table: string) => unknown;
};

const MAX_QUEUE_ROWS = 750;
const MAX_RECENT_JOBS = 200;
const STALE_QUEUED_MS = 30 * 60 * 1000;
const STALE_RUNNING_MS = 10 * 60 * 1000;

function requireSuperAdmin(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access AI queue monitoring.");
  }
}

function table(client: AdminClient, tableName: string) {
  return client.from(tableName) as SelectTable;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim()
    ? maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, 500)
    : fallback;
}

function nullableText(value: unknown, maxLength = 500) {
  const cleaned = text(value).slice(0, maxLength);

  return cleaned || null;
}

function dateText(value: unknown) {
  const cleaned = text(value, "");

  return Number.isFinite(Date.parse(cleaned)) ? cleaned : null;
}

function timestamp(value: string | null) {
  return value ? Date.parse(value) || 0 : 0;
}

function durationText(ms: number | null) {
  if (!ms || ms < 0) {
    return "Not available";
  }

  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function normalizeStatus(value: string, attempts = 0, maxAttempts = 0): AIQueueJobStatus {
  const status = value.toLowerCase();

  if ((status === "failed" || status.includes("error")) && maxAttempts > attempts) {
    return "retry_pending";
  }

  const normalized = normalizeOpenAIJobStatus(status);

  if (normalized === "queued" && attempts > 0) {
    return "retry_pending";
  }

  return normalized;
}

function staleStateForJob(job: Pick<AIQueueJob, "createdAt" | "startedAt" | "status">): AIQueueStaleState {
  const now = Date.now();

  if (job.status === "queued" || job.status === "retry_pending") {
    const reference = timestamp(job.createdAt);

    return reference > 0 && now - reference > STALE_QUEUED_MS ? "stale_queue" : "fresh";
  }

  if (job.status === "running") {
    const reference = timestamp(job.startedAt) || timestamp(job.createdAt);

    return reference > 0 && now - reference > STALE_RUNNING_MS ? "stale_running" : "fresh";
  }

  return "fresh";
}

function withComputedFields(job: Omit<AIQueueJob, "durationMs" | "durationText" | "staleState">): AIQueueJob {
  const durationMs = job.completedAt
    ? timestamp(job.completedAt) - (timestamp(job.startedAt) || timestamp(job.createdAt))
    : null;
  const base = {
    ...job,
    durationMs: durationMs && durationMs > 0 ? durationMs : null,
    durationText: durationText(durationMs && durationMs > 0 ? durationMs : null),
    staleState: "fresh" as AIQueueStaleState
  };

  return {
    ...base,
    staleState: staleStateForJob(base)
  };
}

async function safeRead(client: AdminClient, tableName: string, columns: string) {
  const { data, error } = await table(client, tableName)
    .select(columns)
    .limit(MAX_QUEUE_ROWS);

  if (error) {
    return [];
  }

  return data ?? [];
}

function storeName(row: Record<string, unknown> | undefined, fallback = "Unknown store") {
  if (!row) {
    return fallback;
  }

  return text(row.store_name, text(row.name, text(row.slug, fallback)));
}

function visualJobsFromStores(stores: unknown[]): AIQueueJob[] {
  const jobs: AIQueueJob[] = [];

  for (const row of stores) {
    if (!isRecord(row)) {
      continue;
    }

    const queue = aiVisualQueueFromStoreData(row.store_data);
    const rowStoreId = text(row.id);

    for (const job of Object.values(queue.jobs)) {
      const status = normalizeStatus(job.status, job.attempts, job.maxAttempts);

      jobs.push(withComputedFields({
        assetType: text(job.kind, text(job.slot, "ai_visual")),
        completedAt: dateText(job.completedAt),
        createdAt: dateText(job.createdAt) ?? dateText(row.created_at),
        errorMessage: nullableText(job.error, 240),
        jobId: text(job.jobId, text(job.requestId, `${rowStoreId}:ai_visual_job`)),
        provider: text(job.provider, "ai_visual_provider"),
        source: "store_visual_queue",
        startedAt: dateText(job.claimedAt),
        status,
        storeId: text(job.storeId, rowStoreId) || null,
        storeName: storeName(row),
        userId: nullableText(job.requestedByUserId, 80) ?? nullableText(row.owner_user_id, 80) ?? nullableText(row.user_id, 80)
      }));
    }
  }

  return jobs;
}

function legacyQueueJobs(rows: unknown[], storeById: Map<string, Record<string, unknown>>): AIQueueJob[] {
  return rows
    .filter(isRecord)
    .map((row) => {
      const attempts = typeof row.attempts === "number" ? row.attempts : 0;
      const maxAttempts = typeof row.max_attempts === "number" ? row.max_attempts : 0;
      const status = normalizeStatus(text(row.queue_status, text(row.workflow_state)), attempts, maxAttempts);
      const storeId = text(row.store_instance_id);
      const store = storeById.get(storeId);

      return withComputedFields({
        assetType: "store_generation",
        completedAt: dateText(row.completed_at) ?? dateText(row.failed_at) ?? dateText(row.cancelled_at),
        createdAt: dateText(row.created_at),
        errorMessage: nullableText(row.error_message, 240),
        jobId: text(row.job_id, text(row.id, "ai_generation_queue")),
        provider: "workflow_placeholder",
        source: "ai_generation_queue",
        startedAt: dateText(row.locked_at),
        status,
        storeId: storeId || null,
        storeName: storeName(store, "AI workflow"),
        userId: nullableText(row.owner_user_id, 80)
      });
    });
}

function legacyResultJobs(rows: unknown[], storeById: Map<string, Record<string, unknown>>): AIQueueJob[] {
  return rows
    .filter(isRecord)
    .map((row) => {
      const status = normalizeStatus(text(row.result_status, "unknown"));
      const storeId = text(row.store_instance_id);
      const store = storeById.get(storeId);

      return withComputedFields({
        assetType: "legacy_ai_generation_result",
        completedAt: dateText(row.updated_at),
        createdAt: dateText(row.created_at),
        errorMessage: status === "failed" ? "Legacy AI generation result failed." : null,
        jobId: text(row.id, "ai_generation_result"),
        provider: "ai_result_placeholder",
        source: "ai_generation_result",
        startedAt: null,
        status,
        storeId: storeId || null,
        storeName: storeName(store, "AI result"),
        userId: nullableText(row.owner_user_id, 80)
      });
    });
}

function filterStart(range: AIQueueFilters["dateRange"]) {
  if (!range || range === "all") {
    return null;
  }

  const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
  return Date.now() - hours * 60 * 60 * 1000;
}

function filterJobs(jobs: AIQueueJob[], filters: AIQueueFilters) {
  const start = filterStart(filters.dateRange);

  return jobs
    .filter((job) => !filters.status || filters.status === "all" || job.status === filters.status)
    .filter((job) => !filters.provider || filters.provider === "all" || job.provider === filters.provider)
    .filter((job) => !filters.assetType || filters.assetType === "all" || job.assetType === filters.assetType)
    .filter((job) => !filters.storeId || filters.storeId === "all" || job.storeId === filters.storeId)
    .filter((job) => {
      if (!start) {
        return true;
      }

      const createdAt = timestamp(job.createdAt);
      return createdAt > 0 && createdAt >= start;
    });
}

function queueSummary(jobs: AIQueueJob[]): AIQueueSummary {
  const completedDurations = jobs
    .filter((job) => job.status === "completed" && job.durationMs)
    .map((job) => job.durationMs as number);
  const averageProcessingTimeMs = completedDurations.length
    ? Math.round(completedDurations.reduce((total, duration) => total + duration, 0) / completedDurations.length)
    : null;
  const queuedJobs = jobs
    .filter((job) => job.status === "queued" || job.status === "retry_pending")
    .sort((left, right) => timestamp(left.createdAt) - timestamp(right.createdAt));

  return {
    averageProcessingTimeMs,
    averageProcessingTimeText: durationText(averageProcessingTimeMs),
    cancelled: jobs.filter((job) => job.status === "cancelled").length,
    completed: jobs.filter((job) => job.status === "completed").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    oldestQueuedJob: queuedJobs[0]?.createdAt ?? null,
    queued: jobs.filter((job) => job.status === "queued").length,
    retryPending: jobs.filter((job) => job.status === "retry_pending").length,
    running: jobs.filter((job) => job.status === "running").length,
    timeout: jobs.filter((job) => job.status === "timeout" || job.staleState !== "fresh").length,
    totalJobs: jobs.length
  };
}

async function auditQueueMonitoring({
  access,
  jobs,
  summary
}: {
  access: Awaited<ReturnType<typeof getAdminAccess>>;
  jobs: AIQueueJob[];
  summary: AIQueueSummary;
}) {
  await recordAiAuditLog({
    eventType: "ai_queue_monitor_viewed",
    safeSummary: {
      filteredJobs: jobs.length,
      staleJobs: jobs.filter((job) => job.staleState !== "fresh").length,
      totalJobs: summary.totalJobs
    },
    status: "success",
    userId: access.user.id
  });

  for (const job of jobs.filter((candidate) => candidate.staleState !== "fresh").slice(0, 10)) {
    await recordAiAuditLog({
      assetType: job.assetType,
      eventType: "ai_stale_job_detected",
      jobId: job.jobId,
      providerKey: job.provider,
      safeSummary: {
        source: job.source,
        staleState: job.staleState,
        status: job.status
      },
      status: "blocked",
      storeId: job.storeId,
      userId: access.user.id
    });
  }
}

export async function getAIQueueMonitoringSnapshot(
  filters: AIQueueFilters = {},
  options: { audit?: boolean } = {}
): Promise<AIQueueMonitoringSnapshot> {
  const access = await getAdminAccess();
  requireSuperAdmin(access);

  const admin = createAdminClient();

  if (!admin) {
    return {
      generatedAt: new Date().toISOString(),
      jobs: [],
      summary: queueSummary([])
    };
  }

  const [stores, queueRows, resultRows] = await Promise.all([
    safeRead(admin, "stores", "id, owner_user_id, user_id, name, store_name, slug, store_data, created_at"),
    safeRead(admin, "ai_generation_queue", "id, generation_id, job_id, store_instance_id, owner_user_id, workflow_state, queue_status, attempts, max_attempts, scheduled_for, locked_at, completed_at, failed_at, cancelled_at, error_message, created_at, updated_at"),
    safeRead(admin, "ai_generation_results", "id, store_instance_id, owner_user_id, result_status, created_at, updated_at")
  ]);
  const storeById = new Map(
    stores
      .filter(isRecord)
      .map((store) => [text(store.id), store])
  );
  const allJobs = [
    ...visualJobsFromStores(stores),
    ...legacyQueueJobs(queueRows, storeById),
    ...legacyResultJobs(resultRows, storeById)
  ].sort((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt));
  const filteredJobs = filterJobs(allJobs, filters).slice(0, MAX_RECENT_JOBS);
  const summary = queueSummary(filterJobs(allJobs, filters));
  const snapshot = {
    generatedAt: new Date().toISOString(),
    jobs: filteredJobs,
    summary
  };

  if (options.audit) {
    await auditQueueMonitoring({
      access,
      jobs: filteredJobs,
      summary
    });
  }

  return snapshot;
}
