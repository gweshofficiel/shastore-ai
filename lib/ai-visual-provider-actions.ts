"use server";

import { revalidatePath } from "next/cache";
import {
  createAIVisualAssetRequest,
  planAIVisualAssetProviderRequest,
  requestKindForVisualAssetSlot,
  type AIVisualAssetRequest
} from "@/lib/storefront/ai-visual-assets";
import type { AIVisualPromptContext } from "@/lib/storefront/ai-visual-prompts";
import { getAIVisualProviderAdapter } from "@/lib/storefront/ai-visual-provider";
import {
  aiVisualQueueFromStoreData,
  createAIVisualGenerationJob,
  dispatchAIVisualGenerationJob,
  type AIVisualGenerationJob,
  upsertAIVisualQueueJob
} from "@/lib/storefront/ai-visual-queue";
import { updateGeneratedVisualAssetApproval } from "@/lib/storefront/ai-visual-storage";
import { processPendingAIVisualAssetJob } from "@/lib/storefront/ai-visual-worker";
import { sharedTemplateVisualAssetSlots } from "@/lib/storefront/template-blueprints";
import type { VisualAssetApprovalStatus, VisualAssetSlot } from "@/lib/storefront/visual-assets";
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

type ReviewableVisualApprovalStatus = Exclude<VisualAssetApprovalStatus, "generated">;

type AuthorizedAIVisualStoreContext =
  | {
      error: string;
      ok: false;
    }
  | {
      error: null;
      ok: true;
      storeData: Record<string, unknown>;
      storeName: string;
      storeSlug: string | null;
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
    .select("id, name, slug, store_name, store_data")
    .eq("id" as never, storeId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (storeError || !storeRow) {
    return { error: storeError?.message ?? "Store not found.", ok: false };
  }

  const storeRecord = storeRow as { name?: unknown; slug?: unknown; store_data?: unknown; store_name?: unknown };

  return {
    error: null,
    ok: true,
    storeData: asStoreData(storeRecord.store_data),
    storeName: textValue(storeRecord.store_name, 180) || textValue(storeRecord.name, 180) || "Store",
    storeSlug: textValue(storeRecord.slug, 180) || null,
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
  const dispatch = dispatchAIVisualGenerationJob(queuedJob);
  const nextStoreData = upsertAIVisualQueueJob({
    job: dispatch.job,
    storeData
  });

  const { error: updateError } = await supabase
    .from("stores" as never)
    .update({
      store_data: nextStoreData,
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
  const dispatch = dispatchAIVisualGenerationJob(queuedJob);
  const nextStoreData = upsertAIVisualQueueJob({
    job: dispatch.job,
    storeData: context.storeData
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
      ...defaultState,
      error: error.message,
      requestId,
      status: "failed"
    };
  }

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

