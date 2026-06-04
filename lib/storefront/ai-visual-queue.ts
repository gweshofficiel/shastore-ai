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

export type AIVisualJobLifecycleStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

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

export function dispatchAIVisualGenerationJob(job: AIVisualGenerationJob): AIVisualDispatchResult {
  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
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
    schemaVersion: 1,
    updatedAt: nowIso()
  };

  return {
    ...storeData,
    aiVisualAssetJobs: nextQueue.jobs,
    aiVisualAssetQueue: nextQueue
  };
}

