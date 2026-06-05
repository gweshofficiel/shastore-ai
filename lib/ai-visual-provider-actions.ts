"use server";

import { revalidatePath } from "next/cache";
import {
  createAIVisualAssetRequest,
  planAIVisualAssetProviderRequest,
  requestKindForVisualAssetSlot,
  type AIVisualAssetRequest
} from "@/lib/storefront/ai-visual-assets";
import type { AIVisualPromptContext } from "@/lib/storefront/ai-visual-prompts";
import { getAIVisualProviderAdapter, getAIVisualProviderRuntimeConfig } from "@/lib/storefront/ai-visual-provider";
import {
  canCreateAIVisualJobs,
  canRetryAIVisualJob,
  estimatedCreditsForAIVisualJob,
  reserveAIVisualCreditsHook,
  resolveAIVisualEntitlementPlan,
  type AIVisualPlanEntitlement,
  trackAIVisualJobCreated,
  trackAIVisualJobRetry,
  trackAIVisualJobStatus
} from "@/lib/storefront/ai-visual-usage";
import {
  recordAIVisualAuditLogSafe,
  type AIVisualAuditAction
} from "@/lib/storefront/ai-visual-audit";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import {
  aiVisualQueueFromStoreData,
  createAIVisualGenerationJob,
  createAIVisualWorkerSteps,
  dispatchAIVisualGenerationJob,
  transitionAIVisualJobStatus,
  type AIVisualGenerationJob,
  upsertAIVisualQueueJob
} from "@/lib/storefront/ai-visual-queue";
import { updateGeneratedVisualAssetApproval } from "@/lib/storefront/ai-visual-storage";
import { processPendingAIVisualAssetJob } from "@/lib/storefront/ai-visual-worker";
import {
  getTemplateBlueprintForTemplate,
  sharedTemplateVisualAssetSlots
} from "@/lib/storefront/template-blueprints";
import {
  generatedVisualAssetsFromStoreData,
  visualAssetApprovalStatus,
  type GeneratedVisualAssetTargetType,
  type VisualAssetApprovalStatus,
  type VisualAssetSlot
} from "@/lib/storefront/visual-assets";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";
import { assertStoreAccessInWorkspace } from "@/lib/workspaces/data-access";
import { createClient } from "@/lib/supabase/server";

export type AIVisualProviderRequestState = {
  error: string | null;
  jobId: string | null;
  ok: boolean;
  providerStatus: string | null;
  requestId: string | null;
  status: "idle" | "pending" | "failed";
};

export type AIVisualWorkerActionState = {
  error: string | null;
  jobId: string | null;
  ok: boolean;
  requestId: string | null;
  status: "idle" | "completed" | "failed" | "not_found" | "claim_conflict" | "no_pending_job";
};

export type AIVisualApprovalActionState = {
  error: string | null;
  ok: boolean;
  requestId: string | null;
  status: "idle" | "approved" | "rejected" | "disabled" | "failed";
};

export type AIVisualBulkPackageActionState = {
  error: string | null;
  maxJobs: number;
  ok: boolean;
  queued: number;
  requestIds: string[];
  skippedApproved: number;
  skippedActive: number;
  skippedUnsupported: number;
  status: "idle" | "queued" | "no_targets" | "failed";
};

export type AIVisualQueueControlActionState = {
  error: string | null;
  jobId: string | null;
  ok: boolean;
  processed: number;
  requestId: string | null;
  status: "idle" | "paused" | "resumed" | "cancelled" | "retried" | "processed" | "failed";
};

type ReviewableVisualApprovalStatus = Exclude<VisualAssetApprovalStatus, "generated">;

type AuthorizedAIVisualStoreContext =
  | {
      error: string;
      ok: false;
    }
  | {
      error: null;
      entitlement: AIVisualPlanEntitlement;
      ok: true;
      storeData: Record<string, unknown>;
      storeName: string;
      storeSlug: string | null;
      storeTemplateId: string | null;
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
      workspaceId: string;
    };

const defaultState: AIVisualProviderRequestState = {
  error: null,
  jobId: null,
  ok: false,
  providerStatus: null,
  requestId: null,
  status: "idle"
};

const defaultWorkerState: AIVisualWorkerActionState = {
  error: null,
  jobId: null,
  ok: false,
  requestId: null,
  status: "idle"
};

const defaultApprovalState: AIVisualApprovalActionState = {
  error: null,
  ok: false,
  requestId: null,
  status: "idle"
};

const AI_VISUAL_BULK_MAX_JOBS = 12;
const AI_VISUAL_BULK_CATEGORY_LIMIT = 4;
const AI_VISUAL_BULK_PRODUCT_LIMIT = 5;
const AI_VISUAL_MAX_PROCESS_PER_CLICK = 3;

const defaultBulkPackageState: AIVisualBulkPackageActionState = {
  error: null,
  maxJobs: AI_VISUAL_BULK_MAX_JOBS,
  ok: false,
  queued: 0,
  requestIds: [],
  skippedActive: 0,
  skippedApproved: 0,
  skippedUnsupported: 0,
  status: "idle"
};

const defaultQueueControlState: AIVisualQueueControlActionState = {
  error: null,
  jobId: null,
  ok: false,
  processed: 0,
  requestId: null,
  status: "idle"
};

function textValue(value: unknown, maxLength = 180) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asStoreData(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

async function buildAIVisualPromptContext({
  entityId,
  entityTitle,
  slot,
  storeId,
  storeName,
  supabase,
  workspaceId
}: {
  entityId: string | null;
  entityTitle: string;
  slot: VisualAssetSlot;
  storeId: string;
  storeName: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string;
}): Promise<AIVisualPromptContext> {
  const baseContext: AIVisualPromptContext = {
    brandName: storeName,
    categoryName: entityTitle,
    collectionName: entityTitle,
    marketingTheme: entityTitle,
    productName: entityTitle,
    slotType: slot,
    storeName
  };

  if (slot.startsWith("product.") && entityId) {
    const { data: product } = await supabase
      .from("store_products" as never)
      .select("id, title, name, description, category_id")
      .eq("id" as never, entityId as never)
      .eq("store_id" as never, storeId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .maybeSingle();
    const productRow: Record<string, unknown> = isRecord(product) ? product : {};
    const categoryId = textValue(productRow.category_id, 80) || null;
    let productCategory = "";

    if (categoryId) {
      const { data: category } = await supabase
        .from("store_categories" as never)
        .select("name")
        .eq("id" as never, categoryId as never)
        .eq("store_id" as never, storeId as never)
        .eq("workspace_id" as never, workspaceId as never)
        .maybeSingle();
      const categoryRow: Record<string, unknown> = isRecord(category) ? category : {};
      productCategory = textValue(categoryRow.name, 120);
    }

    return {
      ...baseContext,
      categoryName: productCategory || baseContext.categoryName,
      productCategory: productCategory || baseContext.categoryName,
      productDescription: textValue(productRow.description, 500),
      productName: textValue(productRow.title, 180) || textValue(productRow.name, 180) || entityTitle
    };
  }

  if (slot.startsWith("category.") && entityId) {
    const { data: category } = await supabase
      .from("store_categories" as never)
      .select("id, name, description")
      .eq("id" as never, entityId as never)
      .eq("store_id" as never, storeId as never)
      .eq("workspace_id" as never, workspaceId as never)
      .maybeSingle();
    const categoryRow: Record<string, unknown> = isRecord(category) ? category : {};

    return {
      ...baseContext,
      categoryDescription: textValue(categoryRow.description, 500),
      categoryName: textValue(categoryRow.name, 180) || entityTitle,
      productCategory: textValue(categoryRow.name, 180) || entityTitle
    };
  }

  return baseContext;
}

function requestedSlot(value: unknown): VisualAssetSlot | null {
  const slot = textValue(value, 80);
  return sharedTemplateVisualAssetSlots.includes(slot as VisualAssetSlot)
    ? slot as VisualAssetSlot
    : null;
}

function approvalStatusValue(value: unknown): ReviewableVisualApprovalStatus | null {
  return value === "approved" || value === "rejected" || value === "disabled" ? value : null;
}

async function loadAuthorizedAIVisualStore({
  storeId
}: {
  storeId: string;
}): Promise<AuthorizedAIVisualStoreContext> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sign in required to manage AI visual assets.", ok: false };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const subscriptionAccess = await getUserSubscriptionAccessForClient(supabase, user.id);
  const entitlement = resolveAIVisualEntitlementPlan({
    planId: subscriptionAccess.plan.id,
    status: subscriptionAccess.status
  });

  if (selection.activeWorkspaceRole !== "owner" && selection.activeWorkspaceRole !== "admin") {
    return { error: "Only workspace owners and admins can manage AI visual assets.", ok: false };
  }

  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    return { error: access.reason ?? "You do not have permission to edit this store.", ok: false };
  }

  const { data: storeRow, error: storeError } = await supabase
    .from("stores" as never)
    .select("id, name, slug, store_name, store_data, template_id")
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (storeError || !storeRow) {
    return { error: storeError?.message ?? "Store not found.", ok: false };
  }

  const storeRecord = storeRow as {
    name?: unknown;
    slug?: unknown;
    store_data?: unknown;
    store_name?: unknown;
    template_id?: unknown;
  };

  return {
    error: null,
    entitlement,
    ok: true,
    storeData: asStoreData(storeRecord.store_data),
    storeName: textValue(storeRecord.store_name, 180) || textValue(storeRecord.name, 180) || "Store",
    storeSlug: textValue(storeRecord.slug, 180) || null,
    storeTemplateId: textValue(storeRecord.template_id, 120) || null,
    supabase,
    userId: user.id,
    workspaceId
  };
}

function attachedAssetIdForJob(storeData: Record<string, unknown>, job: AIVisualGenerationJob) {
  const generatedVisualAssets = isRecord(storeData.generatedVisualAssets) ? storeData.generatedVisualAssets : {};
  const targetGroup = isRecord(generatedVisualAssets[job.attachTarget.type])
    ? generatedVisualAssets[job.attachTarget.type] as Record<string, unknown>
    : {};
  const entityAssets = isRecord(targetGroup[job.attachTarget.entityId ?? "template"])
    ? targetGroup[job.attachTarget.entityId ?? "template"] as Record<string, unknown>
    : {};
  const asset: Record<string, unknown> = isRecord(entityAssets[job.slot])
    ? entityAssets[job.slot] as Record<string, unknown>
    : {};

  return textValue(asset.assetId, 240);
}

type AIVisualBulkTarget = {
  entityId: string | null;
  entityTitle: string;
  slot: VisualAssetSlot;
  targetType: GeneratedVisualAssetTargetType;
};

function targetTypeForBulkSlot(slot: VisualAssetSlot): GeneratedVisualAssetTargetType {
  if (slot.startsWith("product.")) {
    return "product";
  }

  if (slot.startsWith("category.")) {
    return "category";
  }

  if (slot === "marketing.collection") {
    return "collection";
  }

  return "banner";
}

function activeGeneratedAssetForBulkTarget({
  storeData,
  target
}: {
  storeData: Record<string, unknown>;
  target: AIVisualBulkTarget;
}) {
  const generatedVisualAssets = generatedVisualAssetsFromStoreData(storeData);
  const targetGroup = generatedVisualAssets[target.targetType];
  const entityKey = target.entityId ?? "template";

  return targetGroup?.[entityKey]?.[target.slot] ?? null;
}

function hasApprovedVisualForBulkTarget({
  queue,
  storeData,
  target
}: {
  queue: ReturnType<typeof aiVisualQueueFromStoreData>;
  storeData: Record<string, unknown>;
  target: AIVisualBulkTarget;
}) {
  const activeAsset = activeGeneratedAssetForBulkTarget({ storeData, target });

  if (activeAsset && visualAssetApprovalStatus(activeAsset) === "approved") {
    return true;
  }

  return Object.values(queue.jobs).some((job) => (
    job.slot === target.slot &&
    job.attachTarget.type === target.targetType &&
    (job.attachTarget.entityId ?? "template") === (target.entityId ?? "template") &&
    job.result?.asset &&
    visualAssetApprovalStatus(job.result.asset) === "approved"
  ));
}

function hasActiveVisualJobForBulkTarget({
  queue,
  target
}: {
  queue: ReturnType<typeof aiVisualQueueFromStoreData>;
  target: AIVisualBulkTarget;
}) {
  return Object.values(queue.jobs).some((job) => (
    (job.status === "pending" || job.status === "processing" || job.status === "paused") &&
    job.slot === target.slot &&
    job.attachTarget.type === target.targetType &&
    (job.attachTarget.entityId ?? "template") === (target.entityId ?? "template")
  ));
}

function bulkTemplateTargetId(storeId: string, slot: VisualAssetSlot) {
  return `${storeId}-${slot}`;
}

function aiVisualGenerationReadiness({
  entitlement,
  estimatedCredits = 0,
  mode = "single",
  requestedJobs = 1,
  storeData
}: {
  entitlement: AIVisualPlanEntitlement;
  estimatedCredits?: number;
  mode?: "single" | "bulk" | "regenerate";
  requestedJobs?: number;
  storeData: Record<string, unknown>;
}) {
  const providerConfig = getAIVisualProviderRuntimeConfig();

  if (providerConfig.status !== "configured") {
    return {
      allowed: false,
      message: providerConfig.status === "missing_credentials"
        ? "AI visual provider missing. Add provider credentials before queueing generation jobs."
        : "AI visual provider is disabled. Enable a provider before queueing generation jobs.",
      remaining: 0
    };
  }

  if (mode === "bulk" && !entitlement.bulkPackageAvailable) {
    return {
      allowed: false,
      message: `${entitlement.name} plan does not include AI visual bulk packages. ${entitlement.upgradeHint ?? "Upgrade to unlock bulk generation."}`,
      remaining: 0
    };
  }

  if (mode === "regenerate" && !entitlement.regenerateAvailable) {
    return {
      allowed: false,
      message: `${entitlement.name} plan does not include AI visual regeneration. ${entitlement.upgradeHint ?? "Upgrade to unlock regeneration."}`,
      remaining: 0
    };
  }

  const limit = canCreateAIVisualJobs(storeData, requestedJobs, estimatedCredits, entitlement);

  if (!limit.allowed) {
    return limit;
  }

  return {
    allowed: true,
    message: null,
    remaining: limit.remaining
  };
}

function queueStoreData({
  jobs,
  pausedAt,
  pausedByUserId,
  storeData
}: {
  jobs: Record<string, AIVisualGenerationJob>;
  pausedAt: string | null;
  pausedByUserId: string | null;
  storeData: Record<string, unknown>;
}) {
  return {
    ...storeData,
    aiVisualAssetJobs: jobs,
    aiVisualAssetQueue: {
      jobs,
      pausedAt,
      pausedByUserId,
      schemaVersion: 1,
      updatedAt: new Date().toISOString()
    }
  };
}

async function persistAIVisualQueueStoreData({
  context,
  storeData,
  storeId
}: {
  context: Extract<AuthorizedAIVisualStoreContext, { ok: true }>;
  storeData: Record<string, unknown>;
  storeId: string;
}) {
  const { error } = await context.supabase
    .from("stores" as never)
    .update({
      store_data: storeData,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, context.workspaceId as never);

  if (!error) {
    revalidatePath(`/dashboard/stores/${storeId}`);
    revalidatePath("/dashboard/ai-visual-assets");
  }

  return error;
}

export async function requestAIVisualAssetGenerationAction(
  _prevState: AIVisualProviderRequestState = defaultState,
  formData: FormData
): Promise<AIVisualProviderRequestState> {
  const storeId = textValue(formData.get("storeId"), 80);
  const templateId = textValue(formData.get("templateId"), 120) || null;
  const slot = requestedSlot(formData.get("slot"));
  const entityTitle = textValue(formData.get("entityTitle"), 180);
  const entityId = textValue(formData.get("entityId"), 120) || null;

  if (!storeId || !slot || !entityTitle) {
    return {
      ...defaultState,
      error: "Store, visual slot, and entity title are required.",
      status: "failed"
    };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ...defaultState,
      error: "Sign in required to request visual asset generation.",
      status: "failed"
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const subscriptionAccess = await getUserSubscriptionAccessForClient(supabase, user.id);
  const entitlement = resolveAIVisualEntitlementPlan({
    planId: subscriptionAccess.plan.id,
    status: subscriptionAccess.status
  });

  if (selection.activeWorkspaceRole !== "owner" && selection.activeWorkspaceRole !== "admin") {
    return {
      ...defaultState,
      error: "Only workspace owners and admins can request visual asset generation.",
      status: "failed"
    };
  }

  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    return {
      ...defaultState,
      error: access.reason,
      status: "failed"
    };
  }

  const { data: storeRow, error: storeError } = await supabase
    .from("stores" as never)
    .select("id, name, store_name, store_data")
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (storeError || !storeRow) {
    return {
      ...defaultState,
      error: storeError?.message ?? "Store not found.",
      status: "failed"
    };
  }

  const storeRecord = storeRow as { name?: unknown; store_data?: unknown; store_name?: unknown };
  const storeName = textValue(storeRecord.store_name, 180) || textValue(storeRecord.name, 180) || entityTitle;
  const promptContext = await buildAIVisualPromptContext({
    entityId,
    entityTitle,
    slot,
    storeId,
    storeName,
    supabase,
    workspaceId
  });

  const request = createAIVisualAssetRequest({
    entityId,
    entityTitle,
    kind: requestKindForVisualAssetSlot(slot),
    metadata: {
      source: "server_action",
      workspaceId
    },
    promptContext,
    requestedByUserId: user.id,
    slot,
    storeId,
    templateId
  });
  const provider = getAIVisualProviderAdapter();
  const pendingJob = provider.createPendingJob(request);
  const providerPlan = planAIVisualAssetProviderRequest(request);
  const storeData = asStoreData(storeRecord.store_data);
  const queuedJob = createAIVisualGenerationJob({
    jobId: pendingJob.jobId,
    provider: pendingJob.provider,
    providerPlan,
    providerStatus: pendingJob.providerStatus,
    request,
    workspaceId
  });
  const readiness = aiVisualGenerationReadiness({
    entitlement,
    estimatedCredits: estimatedCreditsForAIVisualJob(queuedJob),
    requestedJobs: 1,
    storeData
  });

  if (!readiness.allowed) {
    return {
      ...defaultState,
      error: readiness.message,
      status: "failed"
    };
  }

  const queue = aiVisualQueueFromStoreData(storeData);
  const target: AIVisualBulkTarget = {
    entityId,
    entityTitle,
    slot,
    targetType: targetTypeForBulkSlot(slot)
  };

  if (hasActiveVisualJobForBulkTarget({ queue, target })) {
    return {
      ...defaultState,
      error: "An active AI visual job already exists for this slot and target.",
      status: "failed"
    };
  }

  const dispatch = dispatchAIVisualGenerationJob(queue.pausedAt
    ? {
        ...queuedJob,
        status: "paused"
      }
    : queuedJob);
  const nextStoreData = upsertAIVisualQueueJob({
    job: dispatch.job,
    storeData
  });
  const trackedStoreData = reserveAIVisualCreditsHook({
    job: dispatch.job,
    storeData: trackAIVisualJobCreated({
      job: dispatch.job,
      storeData: nextStoreData
    })
  });

  const { error: updateError } = await supabase
    .from("stores" as never)
    .update({
      store_data: trackedStoreData,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never);

  if (updateError) {
    return {
      ...defaultState,
      error: updateError.message,
      status: "failed"
    };
  }

  await recordAIVisualAuditLogSafe({
    actionType: "ai_visual.job_queued",
    actorUserId: user.id,
    job: dispatch.job,
    supabase
  });

  revalidatePath(`/dashboard/stores/${storeId}`);
  revalidatePath("/dashboard/ai-visual-assets");

  return {
    error: null,
    jobId: pendingJob.jobId,
    ok: true,
    providerStatus: pendingJob.providerStatus,
    requestId: request.requestId,
    status: "pending"
  };
}

export async function generateFullAIVisualPackageAction(
  _prevState: AIVisualBulkPackageActionState = defaultBulkPackageState,
  formData: FormData
): Promise<AIVisualBulkPackageActionState> {
  const storeId = textValue(formData.get("storeId"), 80);
  const formTemplateId = textValue(formData.get("templateId"), 120) || null;

  if (!storeId) {
    return {
      ...defaultBulkPackageState,
      error: "Store is required to generate a full visual package.",
      status: "failed"
    };
  }

  const context = await loadAuthorizedAIVisualStore({ storeId });

  if (!context.ok) {
    return {
      ...defaultBulkPackageState,
      error: context.error,
      status: "failed"
    };
  }

  const templateId = context.storeTemplateId ?? formTemplateId;
  const blueprint = getTemplateBlueprintForTemplate(templateId);
  const supportedSlots = new Set(blueprint.visualAssetSlots);
  const requestedTemplateSlots: VisualAssetSlot[] = [
    "hero.desktop",
    "category.image",
    "product.primary",
    "marketing.collection",
    "marketing.announcement",
    "marketing.flashSale",
    "marketing.seasonalSale"
  ];
  const unsupportedSlotCount = requestedTemplateSlots.filter((slot) => !supportedSlots.has(slot)).length;
  const [productsResult, categoriesResult] = await Promise.all([
    supportedSlots.has("product.primary")
      ? context.supabase
          .from("store_products" as never)
          .select("id, title, name")
          .eq("store_id" as never, storeId as never)
          .eq("workspace_id" as never, context.workspaceId as never)
          .order("created_at", { ascending: false })
          .limit(AI_VISUAL_BULK_PRODUCT_LIMIT)
      : Promise.resolve({ data: [], error: null }),
    supportedSlots.has("category.image")
      ? context.supabase
          .from("store_categories" as never)
          .select("id, name")
          .eq("store_id" as never, storeId as never)
          .eq("workspace_id" as never, context.workspaceId as never)
          .order("name", { ascending: true })
          .limit(AI_VISUAL_BULK_CATEGORY_LIMIT)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (productsResult.error || categoriesResult.error) {
    return {
      ...defaultBulkPackageState,
      error: productsResult.error?.message ?? categoriesResult.error?.message ?? "Bulk visual targets could not be loaded.",
      status: "failed"
    };
  }

  const targets: AIVisualBulkTarget[] = [];

  if (supportedSlots.has("hero.desktop")) {
    targets.push({
      entityId: bulkTemplateTargetId(storeId, "hero.desktop"),
      entityTitle: `${context.storeName} hero banner`,
      slot: "hero.desktop",
      targetType: "banner"
    });
  }

  for (const category of (categoriesResult.data ?? []) as Array<Record<string, unknown>>) {
    const id = textValue(category.id, 120);
    const name = textValue(category.name, 180);

    if (id && name) {
      targets.push({
        entityId: id,
        entityTitle: name,
        slot: "category.image",
        targetType: "category"
      });
    }
  }

  for (const product of (productsResult.data ?? []) as Array<Record<string, unknown>>) {
    const id = textValue(product.id, 120);
    const title = textValue(product.title, 180) || textValue(product.name, 180);

    if (id && title) {
      targets.push({
        entityId: id,
        entityTitle: title,
        slot: "product.primary",
        targetType: "product"
      });
    }
  }

  for (const slot of ["marketing.collection", "marketing.announcement", "marketing.flashSale", "marketing.seasonalSale"] as VisualAssetSlot[]) {
    if (supportedSlots.has(slot)) {
      targets.push({
        entityId: bulkTemplateTargetId(storeId, slot),
        entityTitle: `${context.storeName} ${slot.replace("marketing.", "").replace(/([A-Z])/g, " $1").toLowerCase()} banner`,
        slot,
        targetType: targetTypeForBulkSlot(slot)
      });
    }
  }

  const queue = aiVisualQueueFromStoreData(context.storeData);
  const readiness = aiVisualGenerationReadiness({
    entitlement: context.entitlement,
    mode: "bulk",
    requestedJobs: 0,
    storeData: context.storeData
  });

  if (!readiness.allowed) {
    return {
      ...defaultBulkPackageState,
      error: readiness.message,
      status: "failed"
    };
  }

  const provider = getAIVisualProviderAdapter();
  const bulkPackageId = `ai-visual-bulk-${storeId}-${Date.now()}`;
  let nextStoreData = context.storeData;
  let skippedActive = 0;
  let skippedApproved = 0;
  const requestIds: string[] = [];
  const queuedAuditJobs: AIVisualGenerationJob[] = [];

  for (const target of targets) {
    if (requestIds.length >= Math.min(AI_VISUAL_BULK_MAX_JOBS, context.entitlement.maxBulkJobsPerClick, readiness.remaining)) {
      break;
    }

    if (hasApprovedVisualForBulkTarget({ queue, storeData: nextStoreData, target })) {
      skippedApproved += 1;
      continue;
    }

    if (hasActiveVisualJobForBulkTarget({ queue, target })) {
      skippedActive += 1;
      continue;
    }

    const promptContext = await buildAIVisualPromptContext({
      entityId: target.entityId,
      entityTitle: target.entityTitle,
      slot: target.slot,
      storeId,
      storeName: context.storeName,
      supabase: context.supabase,
      workspaceId: context.workspaceId
    });
    const request = createAIVisualAssetRequest({
      entityId: target.entityId,
      entityTitle: target.entityTitle,
      kind: requestKindForVisualAssetSlot(target.slot),
      metadata: {
        bulkPackageId,
        bulkPackageIndex: requestIds.length,
        source: "bulk_package_action",
        templateBlueprintId: blueprint.id,
        workspaceId: context.workspaceId
      },
      promptContext,
      requestedByUserId: context.userId,
      requestId: `${bulkPackageId}-${requestIds.length + 1}-${target.slot.replace(/\./g, "-")}`,
      slot: target.slot,
      storeId,
      templateId
    });
    const pendingJob = provider.createPendingJob(request);
    const providerPlan = planAIVisualAssetProviderRequest(request);
    const queuedJob = createAIVisualGenerationJob({
      jobId: pendingJob.jobId,
      provider: pendingJob.provider,
      providerPlan,
      providerStatus: pendingJob.providerStatus,
      request,
      workspaceId: context.workspaceId
    });
    const targetReadiness = aiVisualGenerationReadiness({
      entitlement: context.entitlement,
      estimatedCredits: estimatedCreditsForAIVisualJob(queuedJob),
      mode: "bulk",
      requestedJobs: 1,
      storeData: nextStoreData
    });

    if (!targetReadiness.allowed) {
      break;
    }

    const dispatch = dispatchAIVisualGenerationJob(queue.pausedAt
      ? {
          ...queuedJob,
          status: "paused"
        }
      : queuedJob);
    nextStoreData = upsertAIVisualQueueJob({
      job: dispatch.job,
      storeData: nextStoreData
    });
    nextStoreData = reserveAIVisualCreditsHook({
      job: dispatch.job,
      storeData: trackAIVisualJobCreated({
        job: dispatch.job,
        storeData: nextStoreData
      })
    });
    requestIds.push(request.requestId);
    queuedAuditJobs.push(dispatch.job);
  }

  if (!requestIds.length) {
    return {
      ...defaultBulkPackageState,
      ok: true,
      skippedActive,
      skippedApproved,
      skippedUnsupported: unsupportedSlotCount,
      status: "no_targets"
    };
  }

  const { error } = await context.supabase
    .from("stores" as never)
    .update({
      store_data: nextStoreData,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, context.workspaceId as never);

  if (error) {
    return {
      ...defaultBulkPackageState,
      error: error.message,
      status: "failed"
    };
  }

  for (const job of queuedAuditJobs) {
    await recordAIVisualAuditLogSafe({
      actionType: "ai_visual.job_queued",
      actorUserId: context.userId,
      job,
      supabase: context.supabase
    });
  }

  revalidatePath(`/dashboard/stores/${storeId}`);
  revalidatePath("/dashboard/ai-visual-assets");

  return {
    error: null,
    maxJobs: Math.min(AI_VISUAL_BULK_MAX_JOBS, context.entitlement.maxBulkJobsPerClick),
    ok: true,
    queued: requestIds.length,
    requestIds,
    skippedActive,
    skippedApproved,
    skippedUnsupported: unsupportedSlotCount,
    status: "queued"
  };
}

export async function updateAIVisualAssetApprovalAction(
  _prevState: AIVisualApprovalActionState = defaultApprovalState,
  formData: FormData
): Promise<AIVisualApprovalActionState> {
  const storeId = textValue(formData.get("storeId"), 80);
  const requestId = textValue(formData.get("requestId"), 240);
  const approvalStatus = approvalStatusValue(formData.get("approvalStatus"));

  if (!storeId || !requestId || !approvalStatus) {
    return {
      ...defaultApprovalState,
      error: "Store, request, and approval status are required.",
      status: "failed"
    };
  }

  const context = await loadAuthorizedAIVisualStore({ storeId });

  if (!context.ok) {
    return {
      ...defaultApprovalState,
      error: context.error,
      requestId,
      status: "failed"
    };
  }

  const queue = aiVisualQueueFromStoreData(context.storeData);
  const job = queue.jobs[requestId];
  const asset = job?.result?.asset;

  if (!job || job.status !== "completed" || !asset) {
    return {
      ...defaultApprovalState,
      error: "Only completed AI visual jobs with generated assets can be reviewed.",
      requestId,
      status: "failed"
    };
  }

  const currentAttachedAssetId = attachedAssetIdForJob(context.storeData, job);
  const shouldUpdateAttachedAsset = approvalStatus === "approved" || currentAttachedAssetId === asset.assetId;
  const reviewedAsset = {
    ...asset,
    approvalStatus,
    approvedAt: approvalStatus === "approved" ? new Date().toISOString() : asset.approvedAt ?? null,
    disabledAt: approvalStatus === "disabled" ? new Date().toISOString() : asset.disabledAt ?? null,
    rejectedAt: approvalStatus === "rejected" ? new Date().toISOString() : asset.rejectedAt ?? null
  };
  const approvalUpdate = shouldUpdateAttachedAsset
    ? updateGeneratedVisualAssetApproval({
        asset: reviewedAsset,
        slot: job.slot,
        status: approvalStatus,
        storeData: context.storeData,
        targetId: job.attachTarget.entityId,
        targetType: job.attachTarget.type
      })
    : { asset: reviewedAsset, storeData: context.storeData };
  const reviewedJob = {
    ...job,
    result: {
      asset: approvalUpdate.asset,
      publicUrl: job.result?.publicUrl ?? approvalUpdate.asset.publicUrl ?? null
    },
    updatedAt: new Date().toISOString()
  };
  const nextStoreData = upsertAIVisualQueueJob({
    job: reviewedJob,
    storeData: approvalUpdate.storeData
  });
  const { error } = await context.supabase
    .from("stores" as never)
    .update({
      store_data: nextStoreData,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, context.workspaceId as never);

  if (error) {
    return {
      ...defaultApprovalState,
      error: error.message,
      requestId,
      status: "failed"
    };
  }

  const approvalAuditActions: Record<ReviewableVisualApprovalStatus, AIVisualAuditAction> = {
    approved: "ai_visual.visual_approved",
    disabled: "ai_visual.visual_disabled",
    rejected: "ai_visual.visual_rejected"
  };
  const approvalAuditAction = approvalAuditActions[approvalStatus];
  await recordAIVisualAuditLogSafe({
    actionType: approvalAuditAction,
    actorUserId: context.userId,
    extraMetadata: {
      approvalStatus
    },
    job: reviewedJob,
    status: approvalStatus,
    supabase: context.supabase
  });

  revalidatePath(`/dashboard/stores/${storeId}`);
  revalidatePath("/dashboard/ai-visual-assets");
  if (context.storeSlug) {
    revalidatePath(`/store/${context.storeSlug}`);
  }

  return {
    error: null,
    ok: true,
    requestId,
    status: approvalStatus
  };
}

export async function regenerateAIVisualAssetJobAction(
  _prevState: AIVisualProviderRequestState = defaultState,
  formData: FormData
): Promise<AIVisualProviderRequestState> {
  const storeId = textValue(formData.get("storeId"), 80);
  const requestId = textValue(formData.get("requestId"), 240);

  if (!storeId || !requestId) {
    return {
      ...defaultState,
      error: "Store and request are required to regenerate an AI visual.",
      status: "failed"
    };
  }

  const context = await loadAuthorizedAIVisualStore({ storeId });

  if (!context.ok) {
    return {
      ...defaultState,
      error: context.error,
      requestId,
      status: "failed"
    };
  }

  const queue = aiVisualQueueFromStoreData(context.storeData);
  const sourceJob = queue.jobs[requestId];

  if (!sourceJob) {
    return {
      ...defaultState,
      error: "AI visual job was not found.",
      requestId,
      status: "failed"
    };
  }

  const regeneratedRequestId = `${sourceJob.request.requestId}-regen-${Date.now()}`;
  const promptContext = await buildAIVisualPromptContext({
    entityId: sourceJob.request.entityId,
    entityTitle: sourceJob.request.entityTitle,
    slot: sourceJob.request.slot,
    storeId,
    storeName: context.storeName,
    supabase: context.supabase,
    workspaceId: context.workspaceId
  });
  const request = createAIVisualAssetRequest({
    entityId: sourceJob.request.entityId,
    entityTitle: sourceJob.request.entityTitle,
    kind: sourceJob.request.kind,
    metadata: {
      ...sourceJob.request.metadata,
      regeneratedFromRequestId: sourceJob.request.requestId,
      source: "regenerate_action",
      workspaceId: context.workspaceId
    },
    promptContext,
    requestedByUserId: context.userId,
    requestId: regeneratedRequestId,
    slot: sourceJob.request.slot,
    storeId,
    templateId: sourceJob.request.templateId
  });
  const provider = getAIVisualProviderAdapter();
  const pendingJob = provider.createPendingJob(request);
  const providerPlan = planAIVisualAssetProviderRequest(request);
  const queuedJob = createAIVisualGenerationJob({
    jobId: pendingJob.jobId,
    provider: pendingJob.provider,
    providerPlan,
    providerStatus: pendingJob.providerStatus,
    request,
    workspaceId: context.workspaceId
  });
  const readiness = aiVisualGenerationReadiness({
    entitlement: context.entitlement,
    estimatedCredits: estimatedCreditsForAIVisualJob(queuedJob),
    mode: "regenerate",
    requestedJobs: 1,
    storeData: context.storeData
  });

  if (!readiness.allowed) {
    return {
      ...defaultState,
      error: readiness.message,
      requestId,
      status: "failed"
    };
  }

  const queuePaused = Boolean(queue.pausedAt);
  const target: AIVisualBulkTarget = {
    entityId: sourceJob.request.entityId,
    entityTitle: sourceJob.request.entityTitle,
    slot: sourceJob.request.slot,
    targetType: sourceJob.attachTarget.type
  };

  if (hasActiveVisualJobForBulkTarget({ queue, target })) {
    return {
      ...defaultState,
      error: "An active AI visual job already exists for this slot and target.",
      requestId,
      status: "failed"
    };
  }

  const dispatch = dispatchAIVisualGenerationJob(queuePaused
    ? {
        ...queuedJob,
        status: "paused"
      }
    : queuedJob);
  const nextStoreData = upsertAIVisualQueueJob({
    job: dispatch.job,
    storeData: context.storeData
  });
  const trackedStoreData = reserveAIVisualCreditsHook({
    job: dispatch.job,
    storeData: trackAIVisualJobCreated({
      job: dispatch.job,
      storeData: nextStoreData
    })
  });
  const { error } = await context.supabase
    .from("stores" as never)
    .update({
      store_data: trackedStoreData,
      updated_at: new Date().toISOString()
    } as never)
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, context.workspaceId as never);

  if (error) {
    return {
      ...defaultState,
      error: error.message,
      requestId,
      status: "failed"
    };
  }

  await recordAIVisualAuditLogSafe({
    actionType: "ai_visual.visual_regenerated",
    actorUserId: context.userId,
    extraMetadata: {
      regeneratedRequestId
    },
    job: sourceJob,
    status: sourceJob.status,
    supabase: context.supabase
  });
  await recordAIVisualAuditLogSafe({
    actionType: "ai_visual.job_queued",
    actorUserId: context.userId,
    extraMetadata: {
      regeneratedFromRequestId: sourceJob.requestId
    },
    job: dispatch.job,
    supabase: context.supabase
  });

  revalidatePath(`/dashboard/stores/${storeId}`);
  revalidatePath("/dashboard/ai-visual-assets");

  return {
    error: null,
    jobId: pendingJob.jobId,
    ok: true,
    providerStatus: pendingJob.providerStatus,
    requestId: regeneratedRequestId,
    status: "pending"
  };
}

export async function processAIVisualAssetBatchAction(
  _prevState: AIVisualQueueControlActionState = defaultQueueControlState,
  formData: FormData
): Promise<AIVisualQueueControlActionState> {
  const storeId = textValue(formData.get("storeId"), 80);
  const requestedLimit = Number(formData.get("limit"));
  const limit = Math.min(
    AI_VISUAL_MAX_PROCESS_PER_CLICK,
    Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 1
  );

  if (!storeId) {
    return {
      ...defaultQueueControlState,
      error: "Store is required to process AI visual jobs.",
      status: "failed"
    };
  }

  const context = await loadAuthorizedAIVisualStore({ storeId });

  if (!context.ok) {
    return {
      ...defaultQueueControlState,
      error: context.error,
      status: "failed"
    };
  }

  const queue = aiVisualQueueFromStoreData(context.storeData);

  if (queue.pausedAt) {
    return {
      ...defaultQueueControlState,
      error: "AI visual queue is paused. Resume the queue before processing jobs.",
      status: "failed"
    };
  }

  let processed = 0;
  let lastResult: Awaited<ReturnType<typeof processPendingAIVisualAssetJob>> | null = null;

  for (let index = 0; index < limit; index += 1) {
    const result = await processPendingAIVisualAssetJob({
      requestedByUserId: context.userId,
      requestId: null,
      storeId,
      supabase: context.supabase,
      workspaceId: context.workspaceId
    });
    lastResult = result;

    if (result.status !== "completed") {
      break;
    }

    processed += 1;
  }

  return {
    error: lastResult?.status === "completed" || processed > 0 ? null : lastResult?.error ?? "No pending AI visual jobs found.",
    jobId: lastResult?.job?.jobId ?? null,
    ok: processed > 0,
    processed,
    requestId: lastResult?.requestId ?? null,
    status: processed > 0 ? "processed" : "failed"
  };
}

export async function pauseAIVisualQueueAction(
  _prevState: AIVisualQueueControlActionState = defaultQueueControlState,
  formData: FormData
): Promise<AIVisualQueueControlActionState> {
  const storeId = textValue(formData.get("storeId"), 80);

  if (!storeId) {
    return {
      ...defaultQueueControlState,
      error: "Store is required to pause the AI visual queue.",
      status: "failed"
    };
  }

  const context = await loadAuthorizedAIVisualStore({ storeId });

  if (!context.ok) {
    return {
      ...defaultQueueControlState,
      error: context.error,
      status: "failed"
    };
  }

  const timestamp = new Date().toISOString();
  const queue = aiVisualQueueFromStoreData(context.storeData);
  const jobs = Object.fromEntries(Object.entries(queue.jobs).map(([requestId, job]) => [
    requestId,
    job.status === "pending"
      ? {
          ...job,
          status: "paused" as const,
          updatedAt: timestamp
        }
      : job
  ])) as Record<string, AIVisualGenerationJob>;
  let nextStoreData: Record<string, unknown> = queueStoreData({
    jobs,
    pausedAt: timestamp,
    pausedByUserId: context.userId,
    storeData: context.storeData
  });
  for (const job of Object.values(jobs)) {
    if (job.status === "paused") {
      nextStoreData = trackAIVisualJobStatus({ job, storeData: nextStoreData });
    }
  }
  const error = await persistAIVisualQueueStoreData({ context, storeData: nextStoreData, storeId });

  if (error) {
    return {
      ...defaultQueueControlState,
      error: error.message,
      status: "failed"
    };
  }

  return {
    ...defaultQueueControlState,
    ok: true,
    status: "paused"
  };
}

export async function resumeAIVisualQueueAction(
  _prevState: AIVisualQueueControlActionState = defaultQueueControlState,
  formData: FormData
): Promise<AIVisualQueueControlActionState> {
  const storeId = textValue(formData.get("storeId"), 80);

  if (!storeId) {
    return {
      ...defaultQueueControlState,
      error: "Store is required to resume the AI visual queue.",
      status: "failed"
    };
  }

  const context = await loadAuthorizedAIVisualStore({ storeId });

  if (!context.ok) {
    return {
      ...defaultQueueControlState,
      error: context.error,
      status: "failed"
    };
  }

  const timestamp = new Date().toISOString();
  const queue = aiVisualQueueFromStoreData(context.storeData);
  const jobs = Object.fromEntries(Object.entries(queue.jobs).map(([requestId, job]) => [
    requestId,
    job.status === "paused"
      ? {
          ...job,
          status: "pending" as const,
          updatedAt: timestamp
        }
      : job
  ])) as Record<string, AIVisualGenerationJob>;
  let nextStoreData: Record<string, unknown> = queueStoreData({
    jobs,
    pausedAt: null,
    pausedByUserId: null,
    storeData: context.storeData
  });
  for (const job of Object.values(jobs)) {
    if (job.status === "pending") {
      nextStoreData = trackAIVisualJobStatus({ job, storeData: nextStoreData });
    }
  }
  const error = await persistAIVisualQueueStoreData({ context, storeData: nextStoreData, storeId });

  if (error) {
    return {
      ...defaultQueueControlState,
      error: error.message,
      status: "failed"
    };
  }

  return {
    ...defaultQueueControlState,
    ok: true,
    status: "resumed"
  };
}

export async function cancelPendingAIVisualJobAction(
  _prevState: AIVisualQueueControlActionState = defaultQueueControlState,
  formData: FormData
): Promise<AIVisualQueueControlActionState> {
  const storeId = textValue(formData.get("storeId"), 80);
  const requestId = textValue(formData.get("requestId"), 240);

  if (!storeId || !requestId) {
    return {
      ...defaultQueueControlState,
      error: "Store and request are required to cancel an AI visual job.",
      requestId: requestId || null,
      status: "failed"
    };
  }

  const context = await loadAuthorizedAIVisualStore({ storeId });

  if (!context.ok) {
    return {
      ...defaultQueueControlState,
      error: context.error,
      requestId,
      status: "failed"
    };
  }

  const queue = aiVisualQueueFromStoreData(context.storeData);
  const job = queue.jobs[requestId];

  if (!job || (job.status !== "pending" && job.status !== "paused")) {
    return {
      ...defaultQueueControlState,
      error: "Only pending or paused AI visual jobs can be cancelled.",
      requestId,
      status: "failed"
    };
  }

  const cancelledJob = transitionAIVisualJobStatus({
    error: "AI visual job cancelled by store owner/admin.",
    job,
    status: "cancelled"
  });
  const nextStoreData = trackAIVisualJobStatus({
    job: cancelledJob,
    storeData: upsertAIVisualQueueJob({
      job: cancelledJob,
      storeData: context.storeData
    })
  });
  const error = await persistAIVisualQueueStoreData({ context, storeData: nextStoreData, storeId });

  if (error) {
    return {
      ...defaultQueueControlState,
      error: error.message,
      requestId,
      status: "failed"
    };
  }

  await recordAIVisualAuditLogSafe({
    actionType: "ai_visual.job_cancelled",
    actorUserId: context.userId,
    errorMessage: cancelledJob.error,
    job: cancelledJob,
    supabase: context.supabase
  });

  return {
    ...defaultQueueControlState,
    jobId: cancelledJob.jobId,
    ok: true,
    requestId,
    status: "cancelled"
  };
}

export async function retryFailedAIVisualJobAction(
  _prevState: AIVisualQueueControlActionState = defaultQueueControlState,
  formData: FormData
): Promise<AIVisualQueueControlActionState> {
  const storeId = textValue(formData.get("storeId"), 80);
  const requestId = textValue(formData.get("requestId"), 240);

  if (!storeId || !requestId) {
    return {
      ...defaultQueueControlState,
      error: "Store and request are required to retry an AI visual job.",
      requestId: requestId || null,
      status: "failed"
    };
  }

  const context = await loadAuthorizedAIVisualStore({ storeId });

  if (!context.ok) {
    return {
      ...defaultQueueControlState,
      error: context.error,
      requestId,
      status: "failed"
    };
  }

  const queue = aiVisualQueueFromStoreData(context.storeData);
  const job = queue.jobs[requestId];

  if (!job || job.status !== "failed") {
    return {
      ...defaultQueueControlState,
      error: "Only failed AI visual jobs can be retried.",
      requestId,
      status: "failed"
    };
  }

  const readiness = aiVisualGenerationReadiness({
    entitlement: context.entitlement,
    estimatedCredits: estimatedCreditsForAIVisualJob(job),
    requestedJobs: 1,
    storeData: context.storeData
  });

  if (!readiness.allowed) {
    return {
      ...defaultQueueControlState,
      error: readiness.message,
      requestId,
      status: "failed"
    };
  }

  const retryLimit = canRetryAIVisualJob(context.storeData, requestId);

  if (!retryLimit.allowed) {
    return {
      ...defaultQueueControlState,
      error: retryLimit.message,
      requestId,
      status: "failed"
    };
  }

  const retriedJob: AIVisualGenerationJob = {
    ...job,
    attempts: 0,
    claimedAt: null,
    claimedBy: null,
    completedAt: null,
    error: null,
    result: null,
    status: queue.pausedAt ? "paused" : "pending",
    updatedAt: new Date().toISOString(),
    workerSteps: createAIVisualWorkerSteps()
  };
  const nextStoreData = reserveAIVisualCreditsHook({
    job: retriedJob,
    storeData: trackAIVisualJobRetry({
      job: retriedJob,
      storeData: upsertAIVisualQueueJob({
        job: retriedJob,
        storeData: context.storeData
      })
    })
  });
  const error = await persistAIVisualQueueStoreData({ context, storeData: nextStoreData, storeId });

  if (error) {
    return {
      ...defaultQueueControlState,
      error: error.message,
      requestId,
      status: "failed"
    };
  }

  await recordAIVisualAuditLogSafe({
    actionType: "ai_visual.job_retried",
    actorUserId: context.userId,
    job: retriedJob,
    supabase: context.supabase
  });

  return {
    ...defaultQueueControlState,
    jobId: retriedJob.jobId,
    ok: true,
    requestId,
    status: "retried"
  };
}

export async function triggerAIVisualAssetWorkerAction(
  _prevState: AIVisualWorkerActionState = defaultWorkerState,
  formData: FormData
): Promise<AIVisualWorkerActionState> {
  const storeId = textValue(formData.get("storeId"), 80);
  const requestId = textValue(formData.get("requestId"), 220) || null;

  if (!storeId) {
    return {
      ...defaultWorkerState,
      error: "Store is required to process AI visual jobs.",
      status: "failed"
    };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ...defaultWorkerState,
      error: "Sign in required to process AI visual jobs.",
      status: "failed"
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;

  if (selection.activeWorkspaceRole !== "owner" && selection.activeWorkspaceRole !== "admin") {
    return {
      ...defaultWorkerState,
      error: "Only workspace owners and admins can process AI visual jobs.",
      status: "failed"
    };
  }

  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    return {
      ...defaultWorkerState,
      error: access.reason,
      status: "failed"
    };
  }

  const result = await processPendingAIVisualAssetJob({
    requestedByUserId: user.id,
    requestId,
    storeId,
    supabase,
    workspaceId
  });

  revalidatePath("/dashboard/ai-visual-assets");

  return {
    error: result.error,
    jobId: result.job?.jobId ?? null,
    ok: result.status === "completed",
    requestId: result.requestId,
    status: result.status
  };
}

export type { AIVisualAssetRequest };

