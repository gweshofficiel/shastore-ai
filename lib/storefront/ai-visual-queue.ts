import type {
  AIVisualAssetProviderPlan,
  AIVisualAssetRequest,
  AIVisualAssetRequestKind
} from "@/lib/storefront/ai-visual-assets";
import type {
  AIVisualProviderKey,
  AIVisualProviderStatus
} from "@/lib/storefront/ai-visual-provider";
import type {
  VisualAssetReference,
  VisualAssetSlot
} from "@/lib/storefront/visual-assets";

export type AIVisualJobLifecycleStatus = "pending" | "processing" | "completed" | "failed" | "cancelled" | "paused";

export type AIVisualWorkerStepKey = "generate" | "upload" | "attach" | "publish";

export type AIVisualWorkerStepStatus = "pending" | "processing" | "completed" | "failed" | "skipped";

export type AIVisualAttachTargetType = "product" | "category" | "banner" | "collection";

export type AIVisualAttachTarget = {
  entityId: string | null;
  slot: VisualAssetSlot;
  type: AIVisualAttachTargetType;
};

export type AIVisualWorkerStep = {
  completedAt: string | null;
  error: string | null;
  key: AIVisualWorkerStepKey;
  order: number;
  startedAt: string | null;
  status: AIVisualWorkerStepStatus;
};

export type AIVisualGenerationJob = {
  attachTarget: AIVisualAttachTarget;
  attempts: number;
  claimedAt: string | null;
  claimedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  error: string | null;
  jobId: string;
  kind: AIVisualAssetRequestKind;
  maxAttempts: number;
  provider: AIVisualProviderKey;
  providerPlan: AIVisualAssetProviderPlan;
  providerStatus: AIVisualProviderStatus;
  request: AIVisualAssetRequest;
  requestId: string;
  requestedByUserId: string | null;
  result: {
    asset: VisualAssetReference | null;
    publicUrl: string | null;
  } | null;
  slot: VisualAssetSlot;
  status: AIVisualJobLifecycleStatus;
  storage: AIVisualAssetRequest["storage"];
  storeId: string;
  templateId: string | null;
  updatedAt: string;
  workerSteps: AIVisualWorkerStep[];
  workspaceId: string;
};

export type AIVisualQueueState = {
  jobs: Record<string, AIVisualGenerationJob>;
  pausedAt: string | null;
  pausedByUserId: string | null;
  schemaVersion: 1;
  updatedAt: string;
};

export type AIVisualDispatchResult = {
  job: AIVisualGenerationJob;
  nextStep: AIVisualWorkerStep | null;
  providerExecutionAllowed: false;
  status: "queued" | "blocked" | "terminal";
};

export type AIVisualAttachmentPlan = {
  entityId: string | null;
  storeDataPath: string[];
  targetType: AIVisualAttachTargetType;
  visualAssetSlot: VisualAssetSlot;
};

const workerStepOrder: Array<{ key: AIVisualWorkerStepKey; order: number }> = [
  { key: "generate", order: 10 },
  { key: "upload", order: 20 },
  { key: "attach", order: 30 },
  { key: "publish", order: 40 }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nowIso() {
  return new Date().toISOString();
}

function attachTargetTypeForRequest(request: AIVisualAssetRequest): AIVisualAttachTargetType {
  if (request.kind === "product_image") {
    return "product";
  }

  if (request.kind === "category_image") {
    return "category";
  }

  if (request.kind === "collection_banner") {
    return "collection";
  }

  return "banner";
}

export function createAIVisualWorkerSteps(): AIVisualWorkerStep[] {
  return workerStepOrder.map((step) => ({
    completedAt: null,
    error: null,
    key: step.key,
    order: step.order,
    startedAt: null,
    status: "pending"
  }));
}

export function createAIVisualGenerationJob({
  jobId,
  provider,
  providerPlan,
  providerStatus,
  request,
  workspaceId
}: {
  jobId: string;
  provider: AIVisualProviderKey;
  providerPlan: AIVisualAssetProviderPlan;
  providerStatus: AIVisualProviderStatus;
  request: AIVisualAssetRequest;
  workspaceId: string;
}): AIVisualGenerationJob {
  const timestamp = nowIso();

  return {
    attachTarget: {
      entityId: request.entityId,
      slot: request.slot,
      type: attachTargetTypeForRequest(request)
    },
    attempts: 0,
    claimedAt: null,
    claimedBy: null,
    completedAt: null,
    createdAt: timestamp,
    error: null,
    jobId,
    kind: request.kind,
    maxAttempts: 3,
    provider,
    providerPlan,
    providerStatus,
    request,
    requestId: request.requestId,
    requestedByUserId: request.requestedByUserId,
    result: null,
    slot: request.slot,
    status: "pending",
    storage: request.storage,
    storeId: request.storeId,
    templateId: request.templateId,
    updatedAt: timestamp,
    workerSteps: createAIVisualWorkerSteps(),
    workspaceId
  };
}

export function transitionAIVisualJobStatus({
  asset,
  error,
  job,
  publicUrl,
  status
}: {
  asset?: VisualAssetReference | null;
  error?: string | null;
  job: AIVisualGenerationJob;
  publicUrl?: string | null;
  status: AIVisualJobLifecycleStatus;
}): AIVisualGenerationJob {
  const terminal = status === "completed" || status === "failed" || status === "cancelled";

  return {
    ...job,
    completedAt: terminal ? nowIso() : job.completedAt,
    error: error ?? null,
    result: status === "completed"
      ? {
          asset: asset ?? null,
          publicUrl: publicUrl ?? null
        }
      : job.result,
    status,
    updatedAt: nowIso()
  };
}

export const AI_VISUAL_STALE_PROCESSING_MS = 5 * 60 * 1000;

export function staleProcessingReferenceAt(job: AIVisualGenerationJob): number {
  const iso = job.claimedAt ?? job.updatedAt;
  return new Date(iso).getTime();
}

export function isStaleProcessingJob(
  job: AIVisualGenerationJob,
  maxAgeMs: number = AI_VISUAL_STALE_PROCESSING_MS
): boolean {
  if (job.status !== "processing") {
    return false;
  }

  return Date.now() - staleProcessingReferenceAt(job) > maxAgeMs;
}

export function recoverStaleProcessingJob(job: AIVisualGenerationJob): AIVisualGenerationJob {
  const limitMinutes = AI_VISUAL_STALE_PROCESSING_MS / 60_000;
  const elapsedMinutes = Math.max(
    1,
    Math.round((Date.now() - staleProcessingReferenceAt(job)) / 60_000)
  );
  const message = `AI visual job exceeded the ${limitMinutes}-minute processing limit (${elapsedMinutes} min in processing). The worker was interrupted, timed out, or did not finalize.`;

  if (job.attempts >= job.maxAttempts) {
    return transitionAIVisualJobStatus({
      error: `${message} Maximum attempts (${job.maxAttempts}) reached.`,
      job: updateAIVisualWorkerStep({
        error: message,
        job,
        key: "generate",
        status: "failed"
      }),
      status: "failed"
    });
  }

  const timestamp = nowIso();

  return {
    ...job,
    claimedAt: null,
    claimedBy: null,
    completedAt: null,
    error: null,
    status: "pending",
    updatedAt: timestamp,
    workerSteps: createAIVisualWorkerSteps()
  };
}

export function recoverStaleProcessingJobs(
  jobs: Record<string, AIVisualGenerationJob>
): {
  jobs: Record<string, AIVisualGenerationJob>;
  recovered: AIVisualGenerationJob[];
} {
  const recovered: AIVisualGenerationJob[] = [];
  const nextJobs = { ...jobs };

  for (const [requestId, job] of Object.entries(jobs)) {
    if (!isStaleProcessingJob(job)) {
      continue;
    }

    const recoveredJob = recoverStaleProcessingJob(job);
    nextJobs[requestId] = recoveredJob;
    recovered.push(recoveredJob);
  }

  return { jobs: nextJobs, recovered };
}

export function claimAIVisualGenerationJob({
  claimedBy,
  job
}: {
  claimedBy: string;
  job: AIVisualGenerationJob;
}): AIVisualGenerationJob | null {
  if (job.status !== "pending") {
    return null;
  }

  const timestamp = nowIso();

  return {
    ...job,
    attempts: job.attempts + 1,
    claimedAt: timestamp,
    claimedBy,
    status: "processing",
    updatedAt: timestamp,
    workerSteps: job.workerSteps.map((step) =>
      step.key === "generate"
        ? {
            ...step,
            startedAt: timestamp,
            status: "processing"
          }
        : step
    )
  };
}

export function updateAIVisualWorkerStep({
  error,
  job,
  key,
  status
}: {
  error?: string | null;
  job: AIVisualGenerationJob;
  key: AIVisualWorkerStepKey;
  status: AIVisualWorkerStepStatus;
}): AIVisualGenerationJob {
  const timestamp = nowIso();

  return {
    ...job,
    updatedAt: timestamp,
    workerSteps: job.workerSteps.map((step) =>
      step.key === key
        ? {
            ...step,
            completedAt: status === "completed" || status === "failed" || status === "skipped" ? timestamp : step.completedAt,
            error: error ?? null,
            startedAt: step.startedAt ?? timestamp,
            status
          }
        : step
    )
  };
}

export function dispatchAIVisualGenerationJob(job: AIVisualGenerationJob): AIVisualDispatchResult {
  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled" || job.status === "paused") {
    return {
      job,
      nextStep: null,
      providerExecutionAllowed: false,
      status: "terminal"
    };
  }

  if (job.providerPlan.canRunAutomatically || job.providerPlan.providerConnected) {
    return {
      job,
      nextStep: null,
      providerExecutionAllowed: false,
      status: "blocked"
    };
  }

  return {
    job,
    nextStep: job.workerSteps.find((step) => step.status === "pending") ?? null,
    providerExecutionAllowed: false,
    status: "queued"
  };
}

export function planAIVisualAssetAttachment(job: AIVisualGenerationJob): AIVisualAttachmentPlan {
  return {
    entityId: job.attachTarget.entityId,
    storeDataPath: [
      "generatedVisualAssets",
      job.attachTarget.type,
      job.attachTarget.entityId ?? "template",
      job.attachTarget.slot
    ],
    targetType: job.attachTarget.type,
    visualAssetSlot: job.attachTarget.slot
  };
}

export function aiVisualQueueFromStoreData(value: unknown): AIVisualQueueState {
  const storeData = isRecord(value) ? value : {};
  const queue = isRecord(storeData.aiVisualAssetQueue) ? storeData.aiVisualAssetQueue : {};
  const jobs = isRecord(queue.jobs) ? queue.jobs : isRecord(storeData.aiVisualAssetJobs) ? storeData.aiVisualAssetJobs : {};

  return {
    jobs: jobs as Record<string, AIVisualGenerationJob>,
    pausedAt: typeof queue.pausedAt === "string" ? queue.pausedAt : null,
    pausedByUserId: typeof queue.pausedByUserId === "string" ? queue.pausedByUserId : null,
    schemaVersion: 1,
    updatedAt: typeof queue.updatedAt === "string" ? queue.updatedAt : nowIso()
  };
}

export function upsertAIVisualQueueJob({
  job,
  storeData
}: {
  job: AIVisualGenerationJob;
  storeData: Record<string, unknown>;
}) {
  const queue = aiVisualQueueFromStoreData(storeData);
  const nextQueue: AIVisualQueueState = {
    jobs: {
      ...queue.jobs,
      [job.requestId]: job
    },
    pausedAt: queue.pausedAt,
    pausedByUserId: queue.pausedByUserId,
    schemaVersion: 1,
    updatedAt: nowIso()
  };

  return {
    ...storeData,
    aiVisualAssetJobs: nextQueue.jobs,
    aiVisualAssetQueue: nextQueue
  };
}

