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

export type AIVisualCreditReservationStatus = "reserved" | "completed" | "released";

export type AIVisualCreditReservation = {
  completedAt: string | null;
  cost: number;
  createdAt: string;
  jobId: string;
  releasedAt: string | null;
  requestId: string;
  status: AIVisualCreditReservationStatus;
};

export type AIVisualCreditState = {
  active: boolean;
  availableCredits: number | null;
  balance: number | null;
  reservations: Record<string, AIVisualCreditReservation>;
  reservedCredits: number;
  schemaVersion: 1;
  updatedAt: string;
};

export type AIVisualUsageSummary = {
  bulkPackageAvailable: boolean;
  cancelledToday: number;
  completedToday: number;
  creditsActive: boolean;
  creditsAvailable: number | null;
  creditsReserved: number;
  dailyLimit: number;
  failedToday: number;
  maxBulkJobsPerClick: number;
  monthlyLimit: number;
  planId: AIVisualEntitlementPlanId;
  planName: string;
  priorityProcessing: boolean;
  regenerateAvailable: boolean;
  remainingDailyAllowance: number;
  remainingMonthlyAllowance: number;
  retryLimit: number;
  todayJobs: number;
  totalGeneratedAssets: number;
  upgradeHint: string | null;
};

export type AIVisualEntitlementPlanId =
  | "free"
  | "trial"
  | "basic"
  | "pro"
  | "business"
  | "enterprise"
  | "unknown";

export type AIVisualPlanEntitlement = {
  bulkPackageAvailable: boolean;
  dailyImageLimit: number;
  id: AIVisualEntitlementPlanId;
  maxBulkJobsPerClick: number;
  monthlyImageLimit: number;
  name: string;
  priorityProcessing: boolean;
  regenerateAvailable: boolean;
  upgradeHint: string | null;
};

export const AI_VISUAL_DAILY_JOB_LIMIT = 30;
export const AI_VISUAL_RETRY_LIMIT = 2;

export const aiVisualCreditRules = {
  bulkPackageBase: 0,
  categoryImage: 1,
  heroBanner: 3,
  productImage: 1,
  promoBanner: 2
} as const;

export const aiVisualPlanEntitlementRules: Record<AIVisualEntitlementPlanId, AIVisualPlanEntitlement> = {
  basic: {
    bulkPackageAvailable: true,
    dailyImageLimit: 12,
    id: "basic",
    maxBulkJobsPerClick: 6,
    monthlyImageLimit: 150,
    name: "Basic",
    priorityProcessing: false,
    regenerateAvailable: true,
    upgradeHint: "Upgrade to Pro for larger bulk packages and priority processing."
  },
  business: {
    bulkPackageAvailable: true,
    dailyImageLimit: 50,
    id: "business",
    maxBulkJobsPerClick: 15,
    monthlyImageLimit: 1000,
    name: "Business",
    priorityProcessing: true,
    regenerateAvailable: true,
    upgradeHint: "Enterprise AI visual limits can be configured later."
  },
  enterprise: {
    bulkPackageAvailable: true,
    dailyImageLimit: 200,
    id: "enterprise",
    maxBulkJobsPerClick: 30,
    monthlyImageLimit: 5000,
    name: "Enterprise",
    priorityProcessing: true,
    regenerateAvailable: true,
    upgradeHint: null
  },
  free: {
    bulkPackageAvailable: false,
    dailyImageLimit: 3,
    id: "free",
    maxBulkJobsPerClick: 1,
    monthlyImageLimit: 20,
    name: "Free",
    priorityProcessing: false,
    regenerateAvailable: false,
    upgradeHint: "Upgrade to Basic to unlock bulk packages and regenerations."
  },
  pro: {
    bulkPackageAvailable: true,
    dailyImageLimit: 25,
    id: "pro",
    maxBulkJobsPerClick: 12,
    monthlyImageLimit: 500,
    name: "Pro",
    priorityProcessing: true,
    regenerateAvailable: true,
    upgradeHint: "Upgrade to Business for higher monthly AI visual limits."
  },
  trial: {
    bulkPackageAvailable: false,
    dailyImageLimit: 5,
    id: "trial",
    maxBulkJobsPerClick: 2,
    monthlyImageLimit: 30,
    name: "Trial",
    priorityProcessing: false,
    regenerateAvailable: false,
    upgradeHint: "Choose a paid plan to unlock bulk packages and regenerations."
  },
  unknown: {
    bulkPackageAvailable: false,
    dailyImageLimit: 2,
    id: "unknown",
    maxBulkJobsPerClick: 1,
    monthlyImageLimit: 10,
    name: "Limited",
    priorityProcessing: false,
    regenerateAvailable: false,
    upgradeHint: "Upgrade or refresh billing status to unlock AI visual generation limits."
  }
};

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

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function sameUtcDay(value: string | null | undefined, day = todayKey()) {
  return typeof value === "string" && value.slice(0, 10) === day;
}

function sameUtcMonth(value: string | null | undefined, month = monthKey()) {
  return typeof value === "string" && value.slice(0, 7) === month;
}

export function resolveAIVisualEntitlementPlan({
  planId,
  status
}: {
  planId?: string | null;
  status?: string | null;
} = {}): AIVisualPlanEntitlement {
  if (status === "trialing") {
    return aiVisualPlanEntitlementRules.trial;
  }

  if (planId === "starter" || planId === "basic") {
    return aiVisualPlanEntitlementRules.basic;
  }

  if (planId === "pro") {
    return aiVisualPlanEntitlementRules.pro;
  }

  if (planId === "agency" || planId === "business") {
    return aiVisualPlanEntitlementRules.business;
  }

  if (planId === "enterprise") {
    return aiVisualPlanEntitlementRules.enterprise;
  }

  if (planId === "free") {
    return aiVisualPlanEntitlementRules.free;
  }

  return aiVisualPlanEntitlementRules.unknown;
}

export function estimatedCreditsForAIVisualJob(job: Pick<AIVisualGenerationJob, "kind">) {
  if (job.kind === "product_image") {
    return aiVisualCreditRules.productImage;
  }

  if (job.kind === "category_image") {
    return aiVisualCreditRules.categoryImage;
  }

  if (job.kind === "hero_banner") {
    return aiVisualCreditRules.heroBanner;
  }

  return aiVisualCreditRules.promoBanner;
}

export function aiVisualCreditsFromStoreData(value: unknown): AIVisualCreditState {
  const storeData = isRecord(value) ? value : {};
  const credits = isRecord(storeData.aiVisualCredits) ? storeData.aiVisualCredits : {};
  const reservationsInput = isRecord(credits.reservations) ? credits.reservations : {};
  const reservations: Record<string, AIVisualCreditReservation> = {};

  for (const [requestId, reservation] of Object.entries(reservationsInput)) {
    if (!isRecord(reservation)) {
      continue;
    }

    const status = textValue(reservation.status);

    reservations[requestId] = {
      completedAt: textValue(reservation.completedAt) || null,
      cost: numberValue(reservation.cost),
      createdAt: textValue(reservation.createdAt) || new Date().toISOString(),
      jobId: textValue(reservation.jobId),
      releasedAt: textValue(reservation.releasedAt) || null,
      requestId,
      status: status === "reserved" || status === "completed" || status === "released" ? status : "reserved"
    };
  }

  const reservedCredits = Object.values(reservations)
    .filter((reservation) => reservation.status === "reserved")
    .reduce((total, reservation) => total + reservation.cost, 0);
  const balance = typeof credits.balance === "number" && Number.isFinite(credits.balance)
    ? credits.balance
    : null;

  return {
    active: credits.active === true && balance !== null,
    availableCredits: balance === null ? null : Math.max(0, balance - reservedCredits),
    balance,
    reservations,
    reservedCredits,
    schemaVersion: 1,
    updatedAt: textValue(credits.updatedAt) || new Date().toISOString()
  };
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

export function aiVisualUsageSummary(
  storeData: unknown,
  entitlement: AIVisualPlanEntitlement = aiVisualPlanEntitlementRules.unknown
): AIVisualUsageSummary {
  const usage = aiVisualUsageFromStoreData(storeData);
  const credits = aiVisualCreditsFromStoreData(storeData);
  const events = Object.values(usage.events);
  const today = todayKey();
  const month = monthKey();
  const todayEvents = events.filter((event) => sameUtcDay(event.createdAt, today));
  const monthEvents = events.filter((event) => sameUtcMonth(event.createdAt, month));
  const dailyLimit = entitlement.dailyImageLimit;
  const monthlyLimit = entitlement.monthlyImageLimit;

  return {
    bulkPackageAvailable: entitlement.bulkPackageAvailable,
    cancelledToday: todayEvents.filter((event) => event.status === "cancelled").length,
    completedToday: todayEvents.filter((event) => event.status === "completed").length,
    creditsActive: credits.active,
    creditsAvailable: credits.availableCredits,
    creditsReserved: credits.reservedCredits,
    dailyLimit,
    failedToday: todayEvents.filter((event) => event.status === "failed").length,
    maxBulkJobsPerClick: entitlement.maxBulkJobsPerClick,
    monthlyLimit,
    planId: entitlement.id,
    planName: entitlement.name,
    priorityProcessing: entitlement.priorityProcessing,
    regenerateAvailable: entitlement.regenerateAvailable,
    remainingDailyAllowance: Math.max(0, dailyLimit - todayEvents.length),
    remainingMonthlyAllowance: Math.max(0, monthlyLimit - monthEvents.length),
    retryLimit: usage.retryLimit,
    todayJobs: todayEvents.length,
    totalGeneratedAssets: events.filter((event) => event.status === "completed").length,
    upgradeHint: entitlement.upgradeHint
  };
}

export function canCreateAIVisualJobs(
  storeData: unknown,
  requestedJobs = 1,
  estimatedCredits = 0,
  entitlement: AIVisualPlanEntitlement = aiVisualPlanEntitlementRules.unknown
) {
  const credits = aiVisualCreditsFromStoreData(storeData);
  const summary = aiVisualUsageSummary(storeData, entitlement);

  if (summary.remainingDailyAllowance < requestedJobs) {
    return {
      allowed: false,
      message: `AI visual daily limit reached. ${summary.todayJobs}/${summary.dailyLimit} jobs have been created today.`,
      remaining: summary.remainingDailyAllowance
    };
  }

  if (summary.remainingMonthlyAllowance < requestedJobs) {
    return {
      allowed: false,
      message: `${summary.planName} monthly AI visual limit reached. Upgrade to increase your monthly allowance.`,
      remaining: summary.remainingDailyAllowance
    };
  }

  if (credits.active && (credits.availableCredits ?? 0) < estimatedCredits) {
    return {
      allowed: false,
      message: `Not enough AI visual credits. ${estimatedCredits} credits required, ${credits.availableCredits ?? 0} available.`,
      remaining: 0
    };
  }

  return {
    allowed: true,
    message: null,
    remaining: credits.active
      ? Math.min(summary.remainingDailyAllowance, summary.remainingMonthlyAllowance)
      : summary.remainingDailyAllowance
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

  const nextStoreData = {
    ...storeData,
    aiVisualUsage: nextUsage
  };

  return updateCreditReservationForEvent(nextStoreData, event);
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
    estimatedCost: existing?.estimatedCost ?? estimatedCreditsForAIVisualJob(job),
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
    estimatedCost: existing?.estimatedCost ?? estimatedCreditsForAIVisualJob(job),
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
    estimatedCost: existing?.estimatedCost ?? estimatedCreditsForAIVisualJob(job),
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
  job,
  storeData
}: {
  job?: AIVisualGenerationJob;
  storeData: Record<string, unknown>;
}) {
  const usage = aiVisualUsageFromStoreData(storeData);
  const credits = aiVisualCreditsFromStoreData(storeData);
  const estimatedCost = job ? estimatedCreditsForAIVisualJob(job) : 0;
  const now = new Date().toISOString();
  const nextCredits: AIVisualCreditState = credits.active && job
    ? {
        ...credits,
        reservations: {
          ...credits.reservations,
          [job.requestId]: {
            completedAt: null,
            cost: estimatedCost,
            createdAt: now,
            jobId: job.jobId,
            releasedAt: null,
            requestId: job.requestId,
            status: "reserved"
          }
        },
        availableCredits: credits.balance === null ? null : Math.max(0, credits.balance - credits.reservedCredits - estimatedCost),
        reservedCredits: credits.reservedCredits + estimatedCost,
        updatedAt: now
      }
    : credits;

  return {
    ...storeData,
    aiVisualCredits: nextCredits,
    aiVisualUsage: {
      ...usage,
      creditsReserved: usage.creditsReserved + estimatedCost,
      lastCreditCheckAt: now,
      updatedAt: now
    }
  };
}

function updateCreditReservationForEvent(
  storeData: Record<string, unknown>,
  event: AIVisualUsageEvent
) {
  const credits = aiVisualCreditsFromStoreData(storeData);

  if (!credits.active) {
    return storeData;
  }

  const reservation = credits.reservations[event.requestId];

  if (!reservation) {
    return storeData;
  }

  const now = new Date().toISOString();
  const nextReservation: AIVisualCreditReservation =
    event.status === "completed"
      ? {
          ...reservation,
          completedAt: reservation.completedAt ?? now,
          status: "completed"
        }
      : event.status === "failed" || event.status === "cancelled"
        ? {
            ...reservation,
            releasedAt: reservation.releasedAt ?? now,
            status: "released"
          }
        : reservation;

  if (nextReservation === reservation) {
    return storeData;
  }

  const reservations = {
    ...credits.reservations,
    [event.requestId]: nextReservation
  };
  const reservedCredits = Object.values(reservations)
    .filter((item) => item.status === "reserved")
    .reduce((total, item) => total + item.cost, 0);

  return {
    ...storeData,
    aiVisualCredits: {
      ...credits,
      availableCredits: credits.balance === null ? null : Math.max(0, credits.balance - reservedCredits),
      reservations,
      reservedCredits,
      updatedAt: now
    }
  };
}
