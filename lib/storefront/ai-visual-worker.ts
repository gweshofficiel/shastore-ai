import "server-only";

import { revalidatePath } from "next/cache";
import { getAIVisualProviderAdapter } from "@/lib/storefront/ai-visual-provider";
import {
  attachGeneratedVisualAsset,
  createGeneratedAssetReference,
  planGeneratedAssetStorage
} from "@/lib/storefront/ai-visual-storage";
import {
  aiVisualQueueFromStoreData,
  claimAIVisualGenerationJob,
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
  const storeData = asStoreData(row.store_data);
  const queue = aiVisualQueueFromStoreData(storeData);
  const pendingJob = firstPendingJob(queue.jobs, requestId);

  if (!pendingJob) {
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

  const provider = getAIVisualProviderAdapter();
  const providerResult = await provider.generate(claimedJob.request);

  if (providerResult.error || providerResult.status === "skipped") {
    const failedJob = transitionAIVisualJobStatus({
      error: providerResult.error ?? "AI visual provider did not return a generated asset.",
      job: updateAIVisualWorkerStep({
        error: providerResult.error,
        job: claimedJob,
        key: "generate",
        status: "failed"
      }),
      status: "failed"
    });

    await persistWorkerJob({
      job: failedJob,
      storeData: claimedStoreData,
      supabase,
      workspaceId
    });
    safeWorkerLog("warn", "AI visual worker failed during provider execution.", failedJob, failedJob.error);

    return {
      error: failedJob.error,
      job: failedJob,
      requestId: failedJob.requestId,
      status: "failed"
    };
  }

  const uploadPlan = planGeneratedAssetStorage({
    job: claimedJob,
    output: null
  });
  const asset = createGeneratedAssetReference({
    job: claimedJob,
    output: {
      publicUrl: uploadPlan.publicUrl
    }
  });
  const uploadedJob = updateAIVisualWorkerStep({
    error: uploadPlan.publicUrl ? null : "R2 upload hook is prepared, but no provider asset was returned yet.",
    job: updateAIVisualWorkerStep({
      job: claimedJob,
      key: "generate",
      status: "completed"
    }),
    key: "upload",
    status: uploadPlan.publicUrl ? "completed" : "skipped"
  });
  const attachment = attachGeneratedVisualAsset({
    asset,
    slot: uploadedJob.slot,
    storeData: claimedStoreData,
    targetId: uploadedJob.attachTarget.entityId,
    targetType: uploadedJob.attachTarget.type
  });
  const attachStoreData = attachment.storeData;
  const completedJob = transitionAIVisualJobStatus({
    asset: attachment.asset,
    job: updateAIVisualWorkerStep({
      job: updateAIVisualWorkerStep({
        job: uploadedJob,
        key: "attach",
        status: attachment.skipped ? "skipped" : "completed"
      }),
      key: "publish",
      status: "completed"
    }),
    publicUrl: attachment.asset.publicUrl ?? null,
    status: "completed"
  });
  const persistError = await persistWorkerJob({
    job: completedJob,
    storeData: attachStoreData,
    supabase,
    workspaceId
  });

  if (persistError) {
    const failedJob = transitionAIVisualJobStatus({
      error: persistError.message,
      job: completedJob,
      status: "failed"
    });

    return {
      error: persistError.message,
      job: failedJob,
      requestId: failedJob.requestId,
      status: "failed"
    };
  }

  revalidatePath(`/dashboard/stores/${storeId}`);
  safeWorkerLog("info", "AI visual worker completed job.", completedJob);

  return {
    error: null,
    job: completedJob,
    requestId: completedJob.requestId,
    status: "completed"
  };
}

