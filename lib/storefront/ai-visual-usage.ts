import type { AIVisualGenerationJob, AIVisualJobLifecycleStatus } from "@/lib/storefront/ai-visual-queue";

export type AIVisualUsageStatus = AIVisualJobLifecycleStatus;

export type AIVisualUsageEvent = {
  assetType: string;
  createdAt: string;
  estimatedCost: number | null;
  jobId: string;
  provider: string;
  requestId: string;
  retryCount: number;
  slot: string;
  status: AIVisualUsageStatus;
  targetType: string;
  updatedAt: string;
};

export type AIVisualUsageState = {
  creditsReserved: number;
  dailyLimit: number;
  events: Record<string, AIVisualUsageEvent>;
  lastCreditCheckAt: string | null;
  retryLimit: number;
  schemaVersion: 1;
  updatedAt: string;
};

export type AIVisualUsageSummary = {
  cancelledToday: number;
  completedToday: number;
  dailyLimit: number;
  failedToday: number;
  remainingDailyAllowance: number;
  retryLimit: number;
  todayJobs: number;
  totalGeneratedAssets: number;
};

export const AI_VISUAL_DAILY_JOB_LIMIT = 30;
export const AI_VISUAL_RETRY_LIMIT = 2;
export const AI_VISUAL_ESTIMATED_COST = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function sameUtcDay(value: string | null | undefined, day = todayKey()) {
  return typeof value === "string" && value.slice(0, 10) === day;
}

export function aiVisualUsageFromStoreData(value: unknown): AIVisualUsageState {
  const storeData = isRecord(value) ? value : {};
  const usage = isRecord(storeData.aiVisualUsage) ? storeData.aiVisualUsage : {};
  const eventsInput = isRecord(usage.events) ? usage.events : {};
  const events: Record<string, AIVisualUsageEvent> = {};

  for (const [requestId, event] of Object.entries(eventsInput)) {
    if (!isRecord(event)) {
      continue;
    }

    const status = textValue(event.status) as AIVisualUsageStatus;

    events[requestId] = {
      assetType: textValue(event.assetType),
      createdAt: textValue(event.createdAt) || new Date().toISOString(),
      estimatedCost: typeof event.estimatedCost === "number" && Number.isFinite(event.estimatedCost)
        ? event.estimatedCost
        : null,
      jobId: textValue(event.jobId),
      provider: textValue(event.provider),
      requestId,
      retryCount: numberValue(event.retryCount),
      slot: textValue(event.slot),
      status: status === "pending" || status === "processing" || status === "completed" || status === "failed" || status === "cancelled" || status === "paused"
        ? status
        : "pending",
      targetType: textValue(event.targetType),
      updatedAt: textValue(event.updatedAt) || textValue(event.createdAt) || new Date().toISOString()
    };
  }

  return {
    creditsReserved: numberValue(usage.creditsReserved),
    dailyLimit: numberValue(usage.dailyLimit, AI_VISUAL_DAILY_JOB_LIMIT),
    events,
    lastCreditCheckAt: textValue(usage.lastCreditCheckAt) || null,
    retryLimit: numberValue(usage.retryLimit, AI_VISUAL_RETRY_LIMIT),
    schemaVersion: 1,
    updatedAt: textValue(usage.updatedAt) || new Date().toISOString()
  };
}

export function aiVisualUsageSummary(storeData: unknown): AIVisualUsageSummary {
  const usage = aiVisualUsageFromStoreData(storeData);
  const events = Object.values(usage.events);
  const today = todayKey();
  const todayEvents = events.filter((event) => sameUtcDay(event.createdAt, today));

  return {
    cancelledToday: todayEvents.filter((event) => event.status === "cancelled").length,
    completedToday: todayEvents.filter((event) => event.status === "completed").length,
    dailyLimit: usage.dailyLimit,
    failedToday: todayEvents.filter((event) => event.status === "failed").length,
    remainingDailyAllowance: Math.max(0, usage.dailyLimit - todayEvents.length),
    retryLimit: usage.retryLimit,
    todayJobs: todayEvents.length,
    totalGeneratedAssets: events.filter((event) => event.status === "completed").length
  };
}

export function canCreateAIVisualJobs(storeData: unknown, requestedJobs = 1) {
  const summary = aiVisualUsageSummary(storeData);

  if (summary.remainingDailyAllowance < requestedJobs) {
    return {
      allowed: false,
      message: `AI visual daily limit reached. ${summary.todayJobs}/${summary.dailyLimit} jobs have been created today.`,
      remaining: summary.remainingDailyAllowance
    };
  }

  return {
    allowed: true,
    message: null,
    remaining: summary.remainingDailyAllowance
  };
}

export function canRetryAIVisualJob(storeData: unknown, requestId: string) {
  const usage = aiVisualUsageFromStoreData(storeData);
  const event = usage.events[requestId];
  const retryCount = event?.retryCount ?? 0;

  if (retryCount >= usage.retryLimit) {
    return {
      allowed: false,
      message: `Retry limit reached for this AI visual job (${retryCount}/${usage.retryLimit}).`,
      retryCount,
      retryLimit: usage.retryLimit
    };
  }

  return {
    allowed: true,
    message: null,
    retryCount,
    retryLimit: usage.retryLimit
  };
}

function usageWithEvent(storeData: Record<string, unknown>, event: AIVisualUsageEvent) {
  const usage = aiVisualUsageFromStoreData(storeData);
  const nextUsage: AIVisualUsageState = {
    ...usage,
    events: {
      ...usage.events,
      [event.requestId]: event
    },
    updatedAt: new Date().toISOString()
  };

  return {
    ...storeData,
    aiVisualUsage: nextUsage
  };
}

export function trackAIVisualJobCreated({
  job,
  storeData
}: {
  job: AIVisualGenerationJob;
  storeData: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const usage = aiVisualUsageFromStoreData(storeData);
  const existing = usage.events[job.requestId];

  return usageWithEvent(storeData, {
    assetType: job.kind,
    createdAt: existing?.createdAt ?? job.createdAt,
    estimatedCost: existing?.estimatedCost ?? AI_VISUAL_ESTIMATED_COST,
    jobId: job.jobId,
    provider: job.provider,
    requestId: job.requestId,
    retryCount: existing?.retryCount ?? 0,
    slot: job.slot,
    status: job.status,
    targetType: job.attachTarget.type,
    updatedAt: now
  });
}

export function trackAIVisualJobStatus({
  job,
  storeData
}: {
  job: AIVisualGenerationJob;
  storeData: Record<string, unknown>;
}) {
  const usage = aiVisualUsageFromStoreData(storeData);
  const existing = usage.events[job.requestId];

  return usageWithEvent(storeData, {
    assetType: existing?.assetType ?? job.kind,
    createdAt: existing?.createdAt ?? job.createdAt,
    estimatedCost: existing?.estimatedCost ?? AI_VISUAL_ESTIMATED_COST,
    jobId: job.jobId,
    provider: job.provider,
    requestId: job.requestId,
    retryCount: existing?.retryCount ?? 0,
    slot: job.slot,
    status: job.status,
    targetType: existing?.targetType ?? job.attachTarget.type,
    updatedAt: new Date().toISOString()
  });
}

export function trackAIVisualJobRetry({
  job,
  storeData
}: {
  job: AIVisualGenerationJob;
  storeData: Record<string, unknown>;
}) {
  const usage = aiVisualUsageFromStoreData(storeData);
  const existing = usage.events[job.requestId];

  return usageWithEvent(storeData, {
    assetType: existing?.assetType ?? job.kind,
    createdAt: existing?.createdAt ?? job.createdAt,
    estimatedCost: existing?.estimatedCost ?? AI_VISUAL_ESTIMATED_COST,
    jobId: job.jobId,
    provider: job.provider,
    requestId: job.requestId,
    retryCount: (existing?.retryCount ?? 0) + 1,
    slot: job.slot,
    status: job.status,
    targetType: existing?.targetType ?? job.attachTarget.type,
    updatedAt: new Date().toISOString()
  });
}

export function reserveAIVisualCreditsHook({
  estimatedCost,
  storeData
}: {
  estimatedCost?: number | null;
  storeData: Record<string, unknown>;
}) {
  const usage = aiVisualUsageFromStoreData(storeData);

  return {
    ...storeData,
    aiVisualUsage: {
      ...usage,
      creditsReserved: usage.creditsReserved + (estimatedCost ?? 0),
      lastCreditCheckAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}
