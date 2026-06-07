"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type DomainHostingAction =
  | "admin_domain_clear_review"
  | "admin_domain_mark_review"
  | "admin_domain_timeline_viewed"
  | "admin_email_clear_review"
  | "admin_email_mark_review";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordDomainHostingAction(formData: FormData, action: DomainHostingAction) {
  const access = await getAdminAccess();
  const storeId = cleanText(formData.get("storeId"));
  const targetId = cleanText(formData.get("targetId"));
  const targetType = cleanText(formData.get("targetType")) || "domain";

  if (!storeId || !targetId) {
    throw new Error("Missing domain hosting target.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for domain hosting controls.");
  }

  const { data } = await admin
    .from("stores" as never)
    .select("store_data")
    .eq("id" as never, storeId as never)
    .maybeSingle();
  const storeRow: Record<string, unknown> = isRecord(data) ? data : {};
  const storeData = isRecord(storeRow.store_data) ? storeRow.store_data : {};
  const reviews = isRecord(storeData.adminDomainHostingReviews)
    ? storeData.adminDomainHostingReviews
    : {};
  const isClear = action === "admin_domain_clear_review" || action === "admin_email_clear_review";
  const reviewState = {
    action,
    clearedAt: isClear ? new Date().toISOString() : null,
    markedAt: isClear ? null : new Date().toISOString(),
    source: "super_admin_domain_hosting_control_center",
    status: isClear ? "clear" : "under_review",
    targetType
  };

  await admin
    .from("stores" as never)
    .update({
      store_data: {
        ...storeData,
        adminDomainHostingReviews: {
          ...reviews,
          [targetId]: reviewState
        }
      }
    } as never)
    .eq("id" as never, storeId as never);

  await admin.from("monitoring_events" as never).insert({
    entity_id: storeId,
    entity_type: "admin_domain_hosting_control",
    event_status: "info",
    event_type: action,
    metadata: {
      note: "Placeholder admin control only. No provider API was called.",
      source: "super_admin_domain_hosting_control_center",
      target_id: targetId,
      target_type: targetType
    },
    store_id: storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/domains-hosting");
  revalidatePath("/admin/domains");
  revalidatePath("/dashboard/domains");
}

export async function markDomainUnderReview(formData: FormData) {
  await recordDomainHostingAction(formData, "admin_domain_mark_review");
}

export async function clearDomainReview(formData: FormData) {
  await recordDomainHostingAction(formData, "admin_domain_clear_review");
}

export async function markEmailUnderReview(formData: FormData) {
  await recordDomainHostingAction(formData, "admin_email_mark_review");
}

export async function clearEmailReview(formData: FormData) {
  await recordDomainHostingAction(formData, "admin_email_clear_review");
}

export async function viewInternalTimeline(formData: FormData) {
  await recordDomainHostingAction(formData, "admin_domain_timeline_viewed");
}
