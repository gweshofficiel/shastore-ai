import "server-only";

import { revalidatePath } from "next/cache";
import { getAIVisualProviderAdapter } from "@/lib/storefront/ai-visual-provider";
import {
  attachGeneratedVisualAsset,
  createGeneratedAssetReference,
  uploadGeneratedAssetToR2
} from "@/lib/storefront/ai-visual-storage";
import {
  aiVisualQueueFromStoreData,
  claimAIVisualGenerationJob,
  isStaleProcessingJob,
  recoverStaleProcessingJobs,
  transitionAIVisualJobStatus,
  updateAIVisualWorkerStep,
  upsertAIVisualQueueJob,
  type AIVisualGenerationJob
} from "@/lib/storefront/ai-visual-queue";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AIVisualWorkerResultStatus =
  | "completed"
  | "failed"
  | "not_found"
  | "claim_conflict"
  | "no_pending_job";

export type AIVisualWorkerResult = {
  error: string | null;
  job: AIVisualGenerationJob | null;
  requestId: string | null;
  status: AIVisualWorkerResultStatus;
};

export type ProcessAIVisualWorkerJobInput = {
  requestedByUserId: string;
  requestId?: string | null;
  storeId: string;
  supabase?: SupabaseServerClient;
  workspaceId: string;
};

const PROVIDER_GENERATION_TIMEOUT_MS = 120_000;
const R2_UPLOAD_TIMEOUT_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asStoreData(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function firstPendingJob(
  jobs: Record<string, AIVisualGenerationJob>,
  requestId?: string | null
): AIVisualGenerationJob | null {
  if (requestId) {
    const job = jobs[requestId];
    return job?.status === "pending" ? job : null;
  }

  return Object.values(jobs)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .find((job) => job.status === "pending") ?? null;
}

function activeProcessingJob(
  jobs: Record<string, AIVisualGenerationJob>,
  requestId?: string | null
): AIVisualGenerationJob | null {
  if (requestId) {
    const job = jobs[requestId];
    return job?.status === "processing" && !isStaleProcessingJob(job) ? job : null;
  }

  return (
    Object.values(jobs).find((job) => job.status === "processing" && !isStaleProcessingJob(job)) ?? null
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${Math.round(ms / 1000)} seconds.`));
        }, ms);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function safeWorkerLog(level: "info" | "warn", message: string, job: AIVisualGenerationJob | null, error?: string | null) {
  const payload = {
    error: error ?? null,
    jobId: job?.jobId ?? null,
    requestId: job?.requestId ?? null,
    status: job?.status ?? null,
    storeId: job?.storeId ?? null
  };

  if (level === "warn") {
    console.warn(message, payload);
    return;
  }

  console.info(message, payload);
}

async function persistWorkerJob({
  job,
  storeData,
  supabase,
  workspaceId
}: {
  job: AIVisualGenerationJob;
  storeData: Record<string, unknown>;
  supabase: SupabaseServerClient;
  workspaceId: string;
}) {
  const { error } = await supabase
    .from("stores" as never)
    .update({
      store_data: upsertAIVisualQueueJob({ job, storeData }),
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, job.storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  return error;
}

async function persistRecoveredStaleJobs({
  jobs,
  storeData,
  supabase,
  storeId,
  workspaceId
}: {
  jobs: AIVisualGenerationJob[];
  storeData: Record<string, unknown>;
  supabase: SupabaseServerClient;
  storeId: string;
  workspaceId: string;
}) {
  let nextStoreData = storeData;

  for (const job of jobs) {
    nextStoreData = upsertAIVisualQueueJob({ job, storeData: nextStoreData });
  }

  const { error } = await supabase
    .from("stores" as never)
    .update({
      store_data: nextStoreData,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  return { error, storeData: nextStoreData };
}

function revalidateAIVisualDashboardPaths(storeId: string) {
  revalidatePath(`/dashboard/stores/${storeId}`);
  revalidatePath("/dashboard/ai-visual-assets");
}

async function finalizeFailedWorkerJob({
  error,
  job,
  stepKey,
  storeData,
  supabase,
  workspaceId,
  storeId
}: {
  error: string;
  job: AIVisualGenerationJob;
  stepKey: "generate" | "upload" | "attach" | "publish";
  storeData: Record<string, unknown>;
  supabase: SupabaseServerClient;
  workspaceId: string;
  storeId: string;
}): Promise<AIVisualWorkerResult> {
  const failedJob = transitionAIVisualJobStatus({
    error,
    job: updateAIVisualWorkerStep({
      error,
      job,
      key: stepKey,
      status: "failed"
    }),
    status: "failed"
  });
  const persistError = await persistWorkerJob({
    job: failedJob,
    storeData,
    supabase,
    workspaceId
  });

  if (persistError) {
    safeWorkerLog(
      "warn",
      "AI visual worker failed to persist terminal failed state.",
      failedJob,
      `${failedJob.error} (persist: ${persistError.message})`
    );

    return {
      error: `${failedJob.error} (failed to persist: ${persistError.message})`,
      job: failedJob,
      requestId: failedJob.requestId,
      status: "failed"
    };
  }

  revalidateAIVisualDashboardPaths(storeId);
  safeWorkerLog("warn", "AI visual worker failed.", failedJob, failedJob.error);

  return {
    error: failedJob.error,
    job: failedJob,
    requestId: failedJob.requestId,
    status: "failed"
  };
}

export async function processPendingAIVisualAssetJob({
  requestedByUserId,
  requestId = null,
  storeId,
  supabase: providedSupabase,
  workspaceId
}: ProcessAIVisualWorkerJobInput): Promise<AIVisualWorkerResult> {
  const supabase = providedSupabase ?? await createClient();
  const workerId = `manual-${requestedByUserId}`;
  const { data: storeRow, error: storeError } = await supabase
    .from("stores" as never)
    .select("id, store_data, updated_at")
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (storeError || !storeRow) {
    return {
      error: storeError?.message ?? "Store not found.",
      job: null,
      requestId,
      status: "not_found"
    };
  }

  const row = storeRow as { store_data?: unknown; updated_at?: string | null };
  let storeData = asStoreData(row.store_data);
  let queue = aiVisualQueueFromStoreData(storeData);
  const staleRecovery = recoverStaleProcessingJobs(queue.jobs);

  if (staleRecovery.recovered.length > 0) {
    queue = { ...queue, jobs: staleRecovery.jobs };
    const recoveryPersist = await persistRecoveredStaleJobs({
      jobs: staleRecovery.recovered,
      storeData,
      storeId,
      supabase,
      workspaceId
    });

    if (recoveryPersist.error) {
      return {
        error: recoveryPersist.error.message,
        job: staleRecovery.recovered[0] ?? null,
        requestId: staleRecovery.recovered[0]?.requestId ?? requestId,
        status: "failed"
      };
    }

    storeData = recoveryPersist.storeData;
    safeWorkerLog(
      "info",
      "AI visual worker recovered stale processing jobs.",
      staleRecovery.recovered[0] ?? null
    );
    revalidateAIVisualDashboardPaths(storeId);
  }

  const pendingJob = firstPendingJob(queue.jobs, requestId);

  if (!pendingJob) {
    const inFlight = activeProcessingJob(queue.jobs, requestId);

    if (inFlight) {
      return {
        error: `AI visual job ${inFlight.requestId} is still processing. Wait for it to finish or retry after 5 minutes.`,
        job: inFlight,
        requestId: inFlight.requestId,
        status: "no_pending_job"
      };
    }

    return {
      error: requestId ? "The requested AI visual job is not pending." : "No pending AI visual jobs found.",
      job: null,
      requestId,
      status: "no_pending_job"
    };
  }

  const claimedJob = claimAIVisualGenerationJob({
    claimedBy: workerId,
    job: pendingJob
  });

  if (!claimedJob) {
    return {
      error: "AI visual job was already claimed or is no longer pending.",
      job: pendingJob,
      requestId: pendingJob.requestId,
      status: "claim_conflict"
    };
  }

  const claimedStoreData = upsertAIVisualQueueJob({
    job: claimedJob,
    storeData
  });
  const { data: claimRows, error: claimError } = await supabase
    .from("stores" as never)
    .update({
      store_data: claimedStoreData,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("updated_at" as never, row.updated_at as never)
    .select("id");

  if (claimError || !Array.isArray(claimRows) || claimRows.length === 0) {
    return {
      error: claimError?.message ?? "AI visual job was claimed by another worker.",
      job: pendingJob,
      requestId: pendingJob.requestId,
      status: "claim_conflict"
    };
  }

  safeWorkerLog("info", "AI visual worker claimed job.", claimedJob);

  let workingJob = claimedJob;
  let workingStoreData: Record<string, unknown> = claimedStoreData;

  try {
    const provider = getAIVisualProviderAdapter();
    const providerResult = await withTimeout(
      provider.generate(claimedJob.request),
      PROVIDER_GENERATION_TIMEOUT_MS,
      "AI visual provider generation"
    );

    if (providerResult.error || providerResult.status === "skipped" || !providerResult.output) {
      return finalizeFailedWorkerJob({
        error: providerResult.error ?? "AI visual provider did not return a generated asset.",
        job: claimedJob,
        stepKey: "generate",
        storeData: claimedStoreData,
        storeId,
        supabase,
        workspaceId
      });
    }

    workingJob = updateAIVisualWorkerStep({
      job: claimedJob,
      key: "generate",
      status: "completed"
    });
    const uploadResult = await withTimeout(
      uploadGeneratedAssetToR2({
        job: workingJob,
        output: providerResult.output
      }),
      R2_UPLOAD_TIMEOUT_MS,
      "Cloudflare R2 upload"
    );

    if (uploadResult.error || !uploadResult.output?.publicUrl) {
      return finalizeFailedWorkerJob({
        error: uploadResult.error ?? "Generated asset upload did not return a public URL.",
        job: updateAIVisualWorkerStep({
          job: workingJob,
          key: "upload",
          status: "processing"
        }),
        stepKey: "upload",
        storeData: claimedStoreData,
        storeId,
        supabase,
        workspaceId
      });
    }

    const asset = createGeneratedAssetReference({
      job: workingJob,
      output: uploadResult.output
    });
    workingJob = updateAIVisualWorkerStep({
      error: null,
      job: workingJob,
      key: "upload",
      status: "completed"
    });
    const attachment = attachGeneratedVisualAsset({
      asset,
      slot: workingJob.slot,
      storeData: claimedStoreData,
      targetId: workingJob.attachTarget.entityId,
      targetType: workingJob.attachTarget.type
    });
    workingStoreData = attachment.storeData;
    const completedJob = transitionAIVisualJobStatus({
      asset: attachment.asset,
      job: updateAIVisualWorkerStep({
        job: updateAIVisualWorkerStep({
          job: workingJob,
          key: "attach",
          status: attachment.skipped ? "skipped" : "completed"
        }),
        key: "publish",
        status: "completed"
      }),
      publicUrl: attachment.asset.publicUrl ?? uploadResult.output.publicUrl ?? null,
      status: "completed"
    });
    const persistError = await persistWorkerJob({
      job: completedJob,
      storeData: workingStoreData,
      supabase,
      workspaceId
    });

    if (persistError) {
      return finalizeFailedWorkerJob({
        error: `Job completed locally but failed to persist: ${persistError.message}`,
        job: completedJob,
        stepKey: "publish",
        storeData: workingStoreData,
        storeId,
        supabase,
        workspaceId
      });
    }

    revalidateAIVisualDashboardPaths(storeId);
    safeWorkerLog("info", "AI visual worker completed job.", completedJob);

    return {
      error: null,
      job: completedJob,
      requestId: completedJob.requestId,
      status: "completed"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected AI visual worker error.";

    return finalizeFailedWorkerJob({
      error: `AI visual worker execution failed: ${message}`,
      job: workingJob,
      stepKey: workingJob.workerSteps.find((step) => step.status === "processing")?.key ?? "generate",
      storeData: workingStoreData,
      storeId,
      supabase,
      workspaceId
    });
  }
}
