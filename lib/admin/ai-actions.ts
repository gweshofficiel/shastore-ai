"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAiAuditLog } from "@/src/lib/ai/audit/ai-audit-log";
import type { AiAuditEventType } from "@/src/lib/ai/audit/ai-audit-types";

type AIAdminAction =
  | "admin_ai_job_clear_review"
  | "admin_ai_job_details_viewed"
  | "admin_ai_job_mark_review"
  | "admin_ai_public_asset_viewed";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordAIAdminAction(formData: FormData, action: AIAdminAction) {
  const access = await getAdminAccess();
  const jobId = cleanText(formData.get("jobId"));
  const storeId = cleanText(formData.get("storeId"));
  const provider = cleanText(formData.get("provider"));
  const status = cleanText(formData.get("status"));

  if (!jobId) {
    throw new Error("Missing AI job id.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for AI controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_ai_control",
    event_status: "info",
    event_type: action,
    metadata: {
      job_id: jobId,
      note: "Placeholder AI governance action only. No AI provider API was called and no raw provider response was exposed.",
      provider,
      source: "super_admin_ai_control_center",
      status
    },
    store_id: storeId || null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  const eventTypeByAction: Partial<Record<AIAdminAction, AiAuditEventType>> = {
    admin_ai_job_clear_review: "ai_asset_review_cleared",
    admin_ai_job_mark_review: "ai_asset_review_marked"
  };
  const eventType = eventTypeByAction[action];

  if (eventType) {
    await recordAiAuditLog({
      eventType,
      jobId,
      providerKey: provider || null,
      safeSummary: {
        action,
        source: "super_admin_ai_control_center",
        status
      },
      status: "success",
      storeId: storeId || null,
      userId: access.user.id
    });
  }

  revalidatePath("/admin/ai");
}

export async function markAIJobUnderReview(formData: FormData) {
  await recordAIAdminAction(formData, "admin_ai_job_mark_review");
}

export async function clearAIJobReview(formData: FormData) {
  await recordAIAdminAction(formData, "admin_ai_job_clear_review");
}

export async function viewAIJobDetails(formData: FormData) {
  await recordAIAdminAction(formData, "admin_ai_job_details_viewed");
}

export async function viewAIPublicAsset(formData: FormData) {
  await recordAIAdminAction(formData, "admin_ai_public_asset_viewed");
}
