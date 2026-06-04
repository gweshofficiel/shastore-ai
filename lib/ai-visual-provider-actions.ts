"use server";

import { revalidatePath } from "next/cache";
import {
  createAIVisualAssetRequest,
  planAIVisualAssetProviderRequest,
  requestKindForVisualAssetSlot,
  type AIVisualAssetRequest
} from "@/lib/storefront/ai-visual-assets";
import { getAIVisualProviderAdapter } from "@/lib/storefront/ai-visual-provider";
import {
  createAIVisualGenerationJob,
  dispatchAIVisualGenerationJob,
  upsertAIVisualQueueJob
} from "@/lib/storefront/ai-visual-queue";
import { sharedTemplateVisualAssetSlots } from "@/lib/storefront/template-blueprints";
import type { VisualAssetSlot } from "@/lib/storefront/visual-assets";
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

const defaultState: AIVisualProviderRequestState = {
  error: null,
  jobId: null,
  ok: false,
  providerStatus: null,
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

function requestedSlot(value: unknown): VisualAssetSlot | null {
  const slot = textValue(value, 80);
  return sharedTemplateVisualAssetSlots.includes(slot as VisualAssetSlot)
    ? slot as VisualAssetSlot
    : null;
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
    .select("id, store_data")
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

  const request = createAIVisualAssetRequest({
    entityId,
    entityTitle,
    kind: requestKindForVisualAssetSlot(slot),
    metadata: {
      source: "server_action",
      workspaceId
    },
    requestedByUserId: user.id,
    slot,
    storeId,
    templateId
  });
  const provider = getAIVisualProviderAdapter();
  const pendingJob = provider.createPendingJob(request);
  const providerPlan = planAIVisualAssetProviderRequest(request);
  const storeData = asStoreData((storeRow as { store_data?: unknown }).store_data);
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

  return {
    error: null,
    jobId: pendingJob.jobId,
    ok: true,
    providerStatus: pendingJob.providerStatus,
    requestId: request.requestId,
    status: "pending"
  };
}

export type { AIVisualAssetRequest };

