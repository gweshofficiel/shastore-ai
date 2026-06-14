import "server-only";

import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";
import type {
  AiAuditEventType,
  AiAuditStatus
} from "@/src/lib/ai/audit/ai-audit-types";
import { getAIUsageAnalyticsSnapshot } from "@/src/lib/ai/analytics/ai-usage-analytics";
import { getAICostAnalyticsSnapshot } from "@/src/lib/ai/costs/ai-cost-analytics";
import { getAIErrorCenterSnapshot } from "@/src/lib/ai/errors/error-service";
import { getAIQueueMonitoringSnapshot } from "@/src/lib/ai/queue/ai-queue-monitoring";
import type {
  AIQueueDateRange,
  AIQueueJob,
  AIQueueJobStatus
} from "@/src/lib/ai/queue/ai-queue-types";
import { sanitizeOpenAIJobError, type OpenAIJobRecord } from "@/src/lib/ai/runtime/openai-job-model";

export type OpenAIObservabilityHook =
  | "job_created"
  | "job_started"
  | "openai_call_started"
  | "openai_call_completed"
  | "asset_stored"
  | "job_completed"
  | "job_failed"
  | "timeout_detected";

export type OpenAITokenUsage = {
  input: number;
  output: number;
  total: number;
};

export type OpenAIStorageStatus = "not_applicable" | "pending" | "stored" | "failed" | "unknown";

export type OpenAIObservabilityMetadata = {
  asset_type: string | null;
  completed_at: string | null;
  cost_estimate: number | null;
  duration_ms: number | null;
  error_code: string | null;
  job_id: string;
  model: string | null;
  provider: "openai";
  retry_count: number | null;
  safe_error_message: string | null;
  started_at: string | null;
  status: string;
  storage_status: OpenAIStorageStatus;
  store_id: string | null;
  token_usage: OpenAITokenUsage | null;
};

export type OpenAIObservabilityFilters = {
  assetType?: string | null;
  dateRange?: AIQueueDateRange | null;
  status?: AIQueueJobStatus | "all" | null;
  storeId?: string | null;
};

export type OpenAIObservabilitySnapshot = {
  assetTypes: string[];
  averageDurationMs: number | null;
  averageDurationText: string;
  costCoverageStatus: string;
  errorCount: number;
  failureRate: number;
  generatedAt: string;
  recentErrors: Array<{
    errorCode: string | null;
    jobId: string | null;
    message: string | null;
    observedAt: string;
    storeId: string | null;
  }>;
  recentExecutions: OpenAIObservabilityMetadata[];
  statusOptions: Array<AIQueueJobStatus | "all">;
  storageFailed: number;
  storageStored: number;
  stores: Array<{ id: string; name: string }>;
  successRate: number;
  totalExecutions: number;
};

const auditEventByHook: Record<OpenAIObservabilityHook, AiAuditEventType> = {
  asset_stored: "openai_asset_stored",
  job_completed: "openai_job_completed",
  job_created: "openai_job_created",
  job_failed: "openai_job_failed",
  job_started: "openai_job_running",
  openai_call_completed: "openai_call_completed",
  openai_call_started: "openai_call_started",
  timeout_detected: "openai_timeout_detected"
};

const auditStatusByHook: Record<OpenAIObservabilityHook, AiAuditStatus> = {
  asset_stored: "success",
  job_completed: "success",
  job_created: "started",
  job_failed: "failed",
  job_started: "started",
  openai_call_completed: "success",
  openai_call_started: "started",
  timeout_detected: "failed"
};

function isOpenAIProvider(provider: string | null | undefined) {
  const normalized = provider?.toLowerCase() ?? "";

  return normalized === "openai" || normalized === "openai-image" || normalized.includes("openai");
}

function timestamp(value: string | null | undefined) {
  return value ? Date.parse(value) || 0 : 0;
}

function durationText(ms: number | null) {
  if (!ms || ms < 0) {
    return "Not available";
  }

  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }

  return `${seconds}s`;
}

function rate(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function storageStatusForJob(job: AIQueueJob): OpenAIStorageStatus {
  const error = job.errorMessage?.toLowerCase() ?? "";

  if (job.status === "completed") {
    return "stored";
  }

  if (error.includes("r2") || error.includes("storage") || error.includes("upload")) {
    return "failed";
  }

  if (job.status === "queued" || job.status === "running" || job.status === "retry_pending") {
    return "pending";
  }

  return "unknown";
}

function metadataFromQueueJob(job: AIQueueJob): OpenAIObservabilityMetadata {
  return {
    asset_type: job.assetType,
    completed_at: job.completedAt,
    cost_estimate: null,
    duration_ms: job.durationMs,
    error_code: job.status === "failed" || job.status === "timeout" ? "openai_runtime_failure" : null,
    job_id: job.jobId,
    model: job.provider === "openai-image" ? "gpt-image-1" : null,
    provider: "openai",
    retry_count: null,
    safe_error_message: sanitizeOpenAIJobError(job.errorMessage),
    started_at: job.startedAt,
    status: job.staleState !== "fresh" ? "timeout" : job.status,
    storage_status: storageStatusForJob(job),
    store_id: job.storeId,
    token_usage: null
  };
}

function safeSummaryForMetadata(metadata: OpenAIObservabilityMetadata, hook: OpenAIObservabilityHook) {
  return {
    assetType: metadata.asset_type,
    costEstimatePresent: metadata.cost_estimate !== null,
    durationMs: metadata.duration_ms,
    hook,
    model: metadata.model,
    retryCount: metadata.retry_count,
    status: metadata.status,
    storageStatus: metadata.storage_status,
    tokenUsagePresent: metadata.token_usage !== null
  };
}

export async function recordOpenAIObservabilityHook({
  errorCode = null,
  hook,
  job,
  metadata,
  workspaceId = null
}: {
  errorCode?: string | null;
  hook: OpenAIObservabilityHook;
  job: OpenAIJobRecord;
  metadata?: Partial<OpenAIObservabilityMetadata>;
  workspaceId?: string | null;
}) {
  const safeMetadata: OpenAIObservabilityMetadata = {
    asset_type: metadata?.asset_type ?? job.asset_type,
    completed_at: metadata?.completed_at ?? job.completed_at,
    cost_estimate: metadata?.cost_estimate ?? job.cost_estimate,
    duration_ms: metadata?.duration_ms ?? null,
    error_code: errorCode,
    job_id: job.job_id,
    model: metadata?.model ?? job.model,
    provider: "openai",
    retry_count: metadata?.retry_count ?? null,
    safe_error_message: sanitizeOpenAIJobError(metadata?.safe_error_message ?? job.error_summary),
    started_at: metadata?.started_at ?? job.started_at,
    status: metadata?.status ?? job.status,
    storage_status: metadata?.storage_status ?? "unknown",
    store_id: metadata?.store_id ?? job.store_id,
    token_usage: metadata?.token_usage ?? null
  };

  await recordAiAuditLog({
    assetType: safeMetadata.asset_type,
    errorCode,
    errorMessage: hook === "job_failed" || hook === "timeout_detected" ? safeMetadata.safe_error_message : null,
    eventType: auditEventByHook[hook],
    jobId: safeMetadata.job_id,
    providerKey: "openai",
    safeSummary: safeSummaryForMetadata(safeMetadata, hook),
    status: auditStatusByHook[hook],
    storeId: safeMetadata.store_id,
    userId: job.owner_id,
    workspaceId
  });
}

export async function getOpenAIObservabilitySnapshot(
  filters: OpenAIObservabilityFilters = {}
): Promise<OpenAIObservabilitySnapshot> {
  const [
    queueSnapshot,
    usageSnapshot,
    costSnapshot,
    errorSnapshot
  ] = await Promise.all([
    getAIQueueMonitoringSnapshot({
      assetType: filters.assetType,
      dateRange: filters.dateRange,
      provider: "openai-image",
      status: filters.status,
      storeId: filters.storeId
    }),
    getAIUsageAnalyticsSnapshot({
      assetType: filters.assetType,
      dateRange: filters.dateRange === "24h" ? "today" : filters.dateRange === "7d" ? "last_7_days" : filters.dateRange === "30d" ? "last_30_days" : "all_time",
      provider: "openai-image",
      status: filters.status,
      storeId: filters.storeId
    }),
    getAICostAnalyticsSnapshot({
      assetType: filters.assetType,
      dateRange: filters.dateRange === "24h" ? "today" : filters.dateRange === "7d" ? "last_7_days" : filters.dateRange === "30d" ? "last_30_days" : "all_time",
      provider: "openai-image",
      status: filters.status,
      storeId: filters.storeId
    }),
    getAIErrorCenterSnapshot({
      dateRange: filters.dateRange ?? "7d",
      errorGroup: "all",
      provider: "openai-image",
      severity: "all",
      storeId: filters.storeId ?? "all"
    })
  ]);
  const recentExecutions = queueSnapshot.jobs
    .filter((job) => isOpenAIProvider(job.provider))
    .map(metadataFromQueueJob)
    .sort((left, right) => timestamp(right.started_at ?? right.completed_at) - timestamp(left.started_at ?? left.completed_at))
    .slice(0, 25);
  const completed = recentExecutions.filter((item) => item.status === "completed").length;
  const failed = recentExecutions.filter((item) => item.status === "failed" || item.status === "timeout").length;
  const durations = recentExecutions
    .map((item) => item.duration_ms)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const averageDurationMs = durations.length
    ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length)
    : null;

  return {
    assetTypes: usageSnapshot.assetTypes.filter(Boolean),
    averageDurationMs,
    averageDurationText: durationText(averageDurationMs),
    costCoverageStatus: costSnapshot.summary.costDataCoverageStatus,
    errorCount: errorSnapshot.errors.length,
    failureRate: rate(failed, recentExecutions.length),
    generatedAt: new Date().toISOString(),
    recentErrors: errorSnapshot.errors
      .filter((error) => isOpenAIProvider(error.provider))
      .slice(0, 8)
      .map((error) => ({
        errorCode: error.errorCode,
        jobId: error.jobId,
        message: sanitizeOpenAIJobError(error.errorMessage),
        observedAt: error.lastSeenAt,
        storeId: error.storeId
      })),
    recentExecutions,
    statusOptions: ["all", "queued", "running", "completed", "failed", "cancelled", "timeout", "retry_pending"],
    storageFailed: recentExecutions.filter((item) => item.storage_status === "failed").length,
    storageStored: recentExecutions.filter((item) => item.storage_status === "stored").length,
    stores: usageSnapshot.stores,
    successRate: rate(completed, recentExecutions.length),
    totalExecutions: recentExecutions.length
  };
}
