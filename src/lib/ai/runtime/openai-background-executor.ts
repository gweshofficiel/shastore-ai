import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  aiVisualQueueFromStoreData,
  isStaleProcessingJob,
  type AIVisualGenerationJob
} from "@/lib/storefront/ai-visual-queue";
import { processPendingAIVisualAssetJob } from "@/lib/storefront/ai-visual-worker";
import { estimatedCreditsForAIVisualJob } from "@/lib/storefront/ai-visual-usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";
import type { AiAuditEventType, AiAuditStatus } from "@/src/lib/ai/audit/ai-audit-types";
import {
  deductReservedOpenAICredits,
  refundReservedOpenAICredits,
  releaseOpenAICreditReservation,
  reserveOpenAICredits
} from "@/src/lib/ai/credits/openai-credit-service";
import type { OpenAIJobCreditStatus } from "@/src/lib/ai/credits/openai-credit-types";
import {
  createJob,
  failJob,
  markTimeout,
  startJob,
  completeJob,
  type OpenAIJobRecord
} from "@/src/lib/ai/runtime/openai-job-model";
import { recordOpenAIObservabilityHook } from "@/src/lib/ai/runtime/openai-observability";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type StoreRow = {
  id?: string | null;
  owner_user_id?: string | null;
  store_data?: unknown;
  updated_at?: string | null;
  user_id?: string | null;
  workspace_id?: string | null;
};

type ExecutorCandidate = {
  job: AIVisualGenerationJob;
  queuePaused: boolean;
  storeId: string;
  storeUpdatedAt: string | null;
  workspaceId: string | null;
};

export type OpenAIExecutorJobOutcome =
  | "completed"
  | "failed"
  | "skipped"
  | "timeout";

export type OpenAIExecutorJobSummary = {
  creditStatus: OpenAIJobCreditStatus | null;
  durationMs: number | null;
  errorSummary: string | null;
  jobId: string;
  outcome: OpenAIExecutorJobOutcome;
  provider: string;
  requestId: string | null;
  status: string;
  storeId: string | null;
};

export type OpenAIExecutorRunSummary = {
  completedAt: string;
  durationMs: number;
  jobs: OpenAIExecutorJobSummary[];
  jobsCompleted: number;
  jobsFailed: number;
  jobsScanned: number;
  jobsSkipped: number;
  jobsStarted: number;
  jobsTimedOut: number;
  maxJobs: number;
  maxRuntimeMs: number;
  runId: string;
  startedAt: string;
};

export type OpenAIExecutorRunOptions = {
  maxJobs?: number;
  maxRuntimeMs?: number;
  requestedByUserId?: string | null;
  staleRunningMs?: number;
};

const DEFAULT_MAX_JOBS_PER_RUN = 3;
const HARD_MAX_JOBS_PER_RUN = 5;
const DEFAULT_MAX_RUNTIME_MS = 4 * 60 * 1000;
const DEFAULT_STALE_RUNNING_MS = 10 * 60 * 1000;
const MAX_STORE_SCAN_ROWS = 750;

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function clampPositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function safeError(value: unknown) {
  return createJob({
    error_summary: typeof value === "string" ? value : value instanceof Error ? value.message : "Unknown executor error.",
    job_id: "openai-executor-error"
  }).error_summary;
}

function executorJobRecord(candidate: ExecutorCandidate, status?: string): OpenAIJobRecord {
  const job = candidate.job;

  return createJob({
    asset_type: job.kind,
    completed_at: job.completedAt,
    cost_estimate: null,
    created_at: job.createdAt,
    error_summary: job.error,
    job_id: job.jobId,
    model: job.provider === "openai-image" ? "gpt-image-1" : null,
    owner_id: job.requestedByUserId,
    provider: "openai-image",
    started_at: job.claimedAt,
    status: status ?? job.status,
    store_id: candidate.storeId
  });
}

async function recordExecutorAudit({
  assetType = null,
  errorCode = null,
  errorMessage = null,
  eventType,
  job = null,
  runId,
  safeSummary,
  status,
  storeId = null,
  userId = null,
  workspaceId = null
}: {
  assetType?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  eventType: AiAuditEventType;
  job?: OpenAIJobRecord | null;
  runId: string;
  safeSummary?: Record<string, unknown>;
  status: AiAuditStatus;
  storeId?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
}) {
  await recordAiAuditLog({
    assetType: assetType ?? job?.asset_type ?? null,
    errorCode,
    errorMessage,
    eventType,
    jobId: job?.job_id ?? null,
    providerKey: job?.provider ?? "openai",
    safeSummary: {
      runId,
      ...(safeSummary ?? {})
    },
    status,
    storeId: storeId ?? job?.store_id ?? null,
    userId: userId ?? job?.owner_id ?? null,
    workspaceId
  });
}

async function readStoreRows() {
  const admin = createAdminClient();

  if (!admin) {
    return { error: "Supabase admin client is not configured.", rows: [] as StoreRow[] };
  }

  const { data, error } = await admin
    .from("stores" as never)
    .select("id, workspace_id, owner_user_id, user_id, store_data, updated_at")
    .limit(MAX_STORE_SCAN_ROWS);

  if (error) {
    return { error: error.message, rows: [] as StoreRow[] };
  }

  return {
    error: null,
    rows: (data ?? []).filter(isRecord) as StoreRow[]
  };
}

function openAIVisualCandidates(rows: StoreRow[]): ExecutorCandidate[] {
  const candidates: ExecutorCandidate[] = [];

  for (const row of rows) {
    const storeId = text(row.id, 120);
    const storeData = isRecord(row.store_data) ? row.store_data : {};
    const queue = aiVisualQueueFromStoreData(storeData);

    if (!storeId) {
      continue;
    }

    for (const job of Object.values(queue.jobs)) {
      if (job.provider !== "openai-image") {
        continue;
      }

      candidates.push({
        job,
        queuePaused: Boolean(queue.pausedAt),
        storeId,
        storeUpdatedAt: text(row.updated_at, 80) || null,
        workspaceId: text(job.workspaceId, 120) || text(row.workspace_id, 120) || null
      });
    }
  }

  return candidates.sort((left, right) => left.job.createdAt.localeCompare(right.job.createdAt));
}

function skippedJobSummary(candidate: ExecutorCandidate, errorSummary: string): OpenAIExecutorJobSummary {
  return {
    creditStatus: null,
    durationMs: null,
    errorSummary: safeError(errorSummary),
    jobId: candidate.job.jobId,
    outcome: "skipped",
    provider: candidate.job.provider,
    requestId: candidate.job.requestId,
    status: candidate.job.status,
    storeId: candidate.storeId
  };
}

function creditInputForCandidate(candidate: ExecutorCandidate) {
  return {
    amount: estimatedCreditsForAIVisualJob(candidate.job),
    assetType: candidate.job.kind,
    jobId: candidate.job.jobId,
    storeId: candidate.storeId,
    userId: candidate.job.requestedByUserId,
    workspaceId: candidate.workspaceId
  };
}

export async function runOpenAIBackgroundExecutor(
  options: OpenAIExecutorRunOptions = {}
): Promise<OpenAIExecutorRunSummary> {
  const runStartedAt = nowIso();
  const runStartedMs = Date.now();
  const runId = `openai-executor-${runStartedMs}`;
  const maxJobs = clampPositiveInteger(options.maxJobs, DEFAULT_MAX_JOBS_PER_RUN, HARD_MAX_JOBS_PER_RUN);
  const maxRuntimeMs = clampPositiveInteger(options.maxRuntimeMs, DEFAULT_MAX_RUNTIME_MS, DEFAULT_MAX_RUNTIME_MS);
  const staleRunningMs = clampPositiveInteger(options.staleRunningMs, DEFAULT_STALE_RUNNING_MS, DEFAULT_STALE_RUNNING_MS);
  const deadline = runStartedMs + maxRuntimeMs;
  const summary: OpenAIExecutorRunSummary = {
    completedAt: runStartedAt,
    durationMs: 0,
    jobs: [],
    jobsCompleted: 0,
    jobsFailed: 0,
    jobsScanned: 0,
    jobsSkipped: 0,
    jobsStarted: 0,
    jobsTimedOut: 0,
    maxJobs,
    maxRuntimeMs,
    runId,
    startedAt: runStartedAt
  };

  await recordExecutorAudit({
    eventType: "openai_executor_started",
    runId,
    safeSummary: {
      maxJobs,
      maxRuntimeMs,
      manualTrigger: true
    },
    status: "started",
    userId: options.requestedByUserId ?? null
  });

  const { error: readError, rows } = await readStoreRows();

  if (readError) {
    summary.jobsFailed += 1;
    summary.jobs.push({
      creditStatus: null,
      durationMs: null,
      errorSummary: safeError(readError),
      jobId: "openai-executor-scan",
      outcome: "failed",
      provider: "openai",
      requestId: null,
      status: "failed",
      storeId: null
    });
    summary.completedAt = nowIso();
    summary.durationMs = Date.now() - runStartedMs;

    await recordExecutorAudit({
      errorCode: "openai_executor_scan_failed",
      errorMessage: safeError(readError),
      eventType: "openai_executor_finished",
      runId,
      safeSummary: summary,
      status: "failed",
      userId: options.requestedByUserId ?? null
    });

    return summary;
  }

  const candidates = openAIVisualCandidates(rows);

  for (const candidate of candidates) {
    if (summary.jobsStarted >= maxJobs || Date.now() >= deadline) {
      break;
    }

    summary.jobsScanned += 1;

    if (!candidate.workspaceId) {
      summary.jobsSkipped += 1;
      summary.jobs.push(skippedJobSummary(candidate, "OpenAI executor skipped job without workspace context."));
      continue;
    }

    if (candidate.queuePaused) {
      summary.jobsSkipped += 1;
      summary.jobs.push(skippedJobSummary(candidate, "OpenAI executor skipped paused queue."));
      continue;
    }

    if (candidate.job.status === "processing" && isStaleProcessingJob(candidate.job, staleRunningMs)) {
      const timeoutJob = markTimeout(
        executorJobRecord(candidate, "running"),
        { error_summary: "OpenAI executor detected stale running job and skipped reprocessing." }
      );
      summary.jobsTimedOut += 1;
      summary.jobsSkipped += 1;
      summary.jobs.push({
      creditStatus: "released",
        durationMs: null,
        errorSummary: timeoutJob.error_summary,
        jobId: timeoutJob.job_id,
        outcome: "timeout",
        provider: timeoutJob.provider,
        requestId: candidate.job.requestId,
        status: timeoutJob.status,
        storeId: timeoutJob.store_id
      });

      await recordExecutorAudit({
        errorCode: "openai_executor_stale_running",
        errorMessage: timeoutJob.error_summary,
        eventType: "openai_job_failed",
        job: timeoutJob,
        runId,
        safeSummary: {
          staleRunningMs,
          storeUpdatedAt: candidate.storeUpdatedAt
        },
        status: "failed",
        workspaceId: candidate.workspaceId
      });
      await recordOpenAIObservabilityHook({
        errorCode: "openai_executor_stale_running",
        hook: "timeout_detected",
        job: timeoutJob,
        metadata: {
          safe_error_message: timeoutJob.error_summary,
          storage_status: "unknown"
        },
        workspaceId: candidate.workspaceId
      });
      continue;
    }

    if (candidate.job.status !== "pending") {
      summary.jobsSkipped += 1;
      summary.jobs.push(skippedJobSummary(candidate, "OpenAI executor only processes queued jobs."));
      continue;
    }

    const queuedJob = executorJobRecord(candidate, "queued");
    const runningJob = startJob(queuedJob);
    const jobStartedMs = Date.now();
    const creditInput = creditInputForCandidate(candidate);
    const reservation = await reserveOpenAICredits(creditInput);

    if (!reservation.ok) {
      summary.jobsSkipped += 1;
      summary.jobs.push({
        creditStatus: reservation.creditStatus,
        durationMs: null,
        errorSummary: reservation.error,
        jobId: candidate.job.jobId,
        outcome: "skipped",
        provider: candidate.job.provider,
        requestId: candidate.job.requestId,
        status: "blocked",
        storeId: candidate.storeId
      });
      continue;
    }

    if (reservation.creditStatus === "charged") {
      summary.jobsSkipped += 1;
      summary.jobs.push({
        creditStatus: "charged",
        durationMs: null,
        errorSummary: "OpenAI executor skipped an already charged job.",
        jobId: candidate.job.jobId,
        outcome: "skipped",
        provider: candidate.job.provider,
        requestId: candidate.job.requestId,
        status: "already_charged",
        storeId: candidate.storeId
      });
      continue;
    }

    summary.jobsStarted += 1;

    await recordExecutorAudit({
      eventType: "openai_job_locked",
      job: runningJob,
      runId,
      safeSummary: {
        lockStrategy: "store_data_optimistic_worker_claim",
        requestId: candidate.job.requestId
      },
      status: "started",
      workspaceId: candidate.workspaceId
    });
    await recordExecutorAudit({
      eventType: "openai_job_running",
      job: runningJob,
      runId,
      safeSummary: {
        requestId: candidate.job.requestId
      },
      status: "started",
      workspaceId: candidate.workspaceId
    });
    await recordOpenAIObservabilityHook({
      hook: "job_started",
      job: runningJob,
      metadata: {
        retry_count: candidate.job.attempts,
        storage_status: "pending"
      },
      workspaceId: candidate.workspaceId
    });
    await recordOpenAIObservabilityHook({
      hook: "openai_call_started",
      job: runningJob,
      metadata: {
        retry_count: candidate.job.attempts,
        storage_status: "pending"
      },
      workspaceId: candidate.workspaceId
    });

    const result = await processPendingAIVisualAssetJob({
      requestedByUserId: options.requestedByUserId ?? "openai-background-executor",
      requestId: candidate.job.requestId,
      storeId: candidate.storeId,
      supabase: createAdminClient() as unknown as SupabaseServerClient,
      workspaceId: candidate.workspaceId
    });
    const durationMs = Date.now() - jobStartedMs;
    await recordOpenAIObservabilityHook({
      hook: result.status === "completed" ? "openai_call_completed" : "job_failed",
      job: runningJob,
      metadata: {
        duration_ms: durationMs,
        retry_count: candidate.job.attempts,
        safe_error_message: result.error,
        status: result.status,
        storage_status: result.status === "completed" ? "stored" : "unknown"
      },
      workspaceId: candidate.workspaceId
    });

    if (result.status === "completed" && result.job) {
      const completedJob = completeJob(executorJobRecord({ ...candidate, job: result.job }, "running"));
      const deduction = await deductReservedOpenAICredits(creditInput);
      summary.jobsCompleted += 1;
      summary.jobs.push({
        creditStatus: deduction.creditStatus,
        durationMs,
        errorSummary: null,
        jobId: completedJob.job_id,
        outcome: "completed",
        provider: completedJob.provider,
        requestId: result.requestId,
        status: completedJob.status,
        storeId: completedJob.store_id
      });

      await recordExecutorAudit({
        eventType: "openai_job_completed",
        job: completedJob,
        runId,
        safeSummary: {
          durationMs,
          requestId: result.requestId
        },
        status: "success",
        workspaceId: candidate.workspaceId
      });
      await recordOpenAIObservabilityHook({
        hook: "asset_stored",
        job: completedJob,
        metadata: {
          cost_estimate: creditInput.amount,
          duration_ms: durationMs,
          retry_count: result.job.attempts,
          storage_status: "stored"
        },
        workspaceId: candidate.workspaceId
      });
      await recordOpenAIObservabilityHook({
        hook: "job_completed",
        job: completedJob,
        metadata: {
          cost_estimate: creditInput.amount,
          duration_ms: durationMs,
          retry_count: result.job.attempts,
          storage_status: "stored"
        },
        workspaceId: candidate.workspaceId
      });
      continue;
    }

    if (result.status === "failed") {
      const refund = await refundReservedOpenAICredits(creditInput);
      const failedJob = failJob(
        executorJobRecord({ ...candidate, job: result.job ?? candidate.job }, "running"),
        { error_summary: result.error ?? "OpenAI executor job failed." }
      );
      summary.jobsFailed += 1;
      summary.jobs.push({
        creditStatus: refund.creditStatus,
        durationMs,
        errorSummary: failedJob.error_summary,
        jobId: failedJob.job_id,
        outcome: "failed",
        provider: failedJob.provider,
        requestId: result.requestId,
        status: failedJob.status,
        storeId: failedJob.store_id
      });

      await recordExecutorAudit({
        errorCode: "openai_executor_job_failed",
        errorMessage: failedJob.error_summary,
        eventType: "openai_job_failed",
        job: failedJob,
        runId,
        safeSummary: {
          durationMs,
          requestId: result.requestId,
          workerStatus: result.status
        },
        status: "failed",
        workspaceId: candidate.workspaceId
      });
      await recordOpenAIObservabilityHook({
        errorCode: "openai_executor_job_failed",
        hook: "job_failed",
        job: failedJob,
        metadata: {
          duration_ms: durationMs,
          retry_count: result.job?.attempts ?? candidate.job.attempts,
          safe_error_message: failedJob.error_summary,
          storage_status: failedJob.error_summary?.toLowerCase().includes("upload") || failedJob.error_summary?.toLowerCase().includes("r2")
            ? "failed"
            : "unknown"
        },
        workspaceId: candidate.workspaceId
      });
      continue;
    }

    summary.jobsSkipped += 1;
    const release = await releaseOpenAICreditReservation(creditInput);
    summary.jobs.push({
      creditStatus: release.creditStatus,
      durationMs,
      errorSummary: safeError(result.error ?? "OpenAI executor worker skipped job."),
      jobId: candidate.job.jobId,
      outcome: "skipped",
      provider: candidate.job.provider,
      requestId: result.requestId,
      status: result.status,
      storeId: candidate.storeId
    });
  }

  summary.completedAt = nowIso();
  summary.durationMs = Date.now() - runStartedMs;

  await recordExecutorAudit({
    eventType: "openai_executor_finished",
    runId,
    safeSummary: {
      durationMs: summary.durationMs,
      jobsCompleted: summary.jobsCompleted,
      jobsFailed: summary.jobsFailed,
      jobsScanned: summary.jobsScanned,
      jobsSkipped: summary.jobsSkipped,
      jobsStarted: summary.jobsStarted,
      jobsTimedOut: summary.jobsTimedOut
    },
    status: summary.jobsFailed > 0 ? "failed" : "success",
    userId: options.requestedByUserId ?? null
  });

  return summary;
}
