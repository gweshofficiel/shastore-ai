"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ResellerDisputeStatus } from "@/lib/reseller-showcase/data";

type DisputePlaceholderAction =
  | "reseller_dispute_add_note_placeholder"
  | "reseller_dispute_close_placeholder"
  | "reseller_dispute_create"
  | "reseller_dispute_escalate_placeholder"
  | "reseller_dispute_request_review_placeholder"
  | "reseller_dispute_upload_evidence_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 420) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard/disputes")) {
    return "/reseller/dashboard/disputes";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function redirectWithError(message: string, returnTo: string): never {
  redirect(withStatus(returnTo, "error", message));
}

function normalizeDisputeStatus(value: string): ResellerDisputeStatus {
  if (
    value === "awaiting_response" ||
    value === "closed" ||
    value === "escalated" ||
    value === "open" ||
    value === "rejected" ||
    value === "resolved_placeholder" ||
    value === "under_review"
  ) {
    return value;
  }

  return "open";
}

function statusForAction(
  action: DisputePlaceholderAction,
  currentStatus: ResellerDisputeStatus
): ResellerDisputeStatus {
  if (action === "reseller_dispute_close_placeholder") {
    return "closed";
  }

  if (action === "reseller_dispute_escalate_placeholder") {
    return "escalated";
  }

  if (action === "reseller_dispute_request_review_placeholder") {
    return "under_review";
  }

  if (action === "reseller_dispute_create") {
    return "open";
  }

  return currentStatus;
}

function timelineNoteForAction(action: DisputePlaceholderAction) {
  if (action === "reseller_dispute_add_note_placeholder") {
    return "Private dispute note placeholder added. Internal admin notes are not exposed.";
  }

  if (action === "reseller_dispute_close_placeholder") {
    return "Dispute closed placeholder. No refund, ownership reversal, payment action, or account suspension occurred.";
  }

  if (action === "reseller_dispute_escalate_placeholder") {
    return "Dispute escalation placeholder recorded for future admin mediation.";
  }

  if (action === "reseller_dispute_request_review_placeholder") {
    return "Dispute review requested placeholder recorded.";
  }

  if (action === "reseller_dispute_upload_evidence_placeholder") {
    return "Evidence upload placeholder recorded. No file upload or private buyer data exposure occurred.";
  }

  return "Dispute created placeholder. Tracking workflow only; no financial or ownership action occurred.";
}

async function recordDisputeAction(formData: FormData, action: DisputePlaceholderAction) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("reseller_profiles" as never)
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileData as { id?: string } | null;

  if (!profile?.id) {
    redirectWithError("Create your reseller profile before managing disputes.", returnTo);
  }

  const disputeId =
    cleanText(formData.get("disputeId")) ||
    `dispute-${Date.now().toString(36)}-${user.id.slice(0, 6)}`;
  const currentStatus = normalizeDisputeStatus(cleanText(formData.get("disputeStatus")));
  const category = cleanText(formData.get("category")) || "other";
  const priority = cleanText(formData.get("priority")) || "normal";
  const relatedTransfer = cleanText(formData.get("relatedTransfer")) || "transfer-placeholder";
  const relatedDelivery = cleanText(formData.get("relatedDelivery")) || "delivery-placeholder";
  const relatedRequest = cleanText(formData.get("relatedRequest")) || "request-placeholder";
  const relatedReview = cleanText(formData.get("relatedReview")) || "review-placeholder";
  const summary = cleanText(formData.get("summary"), 700) || "Dispute summary placeholder";
  const internalNotes =
    cleanText(formData.get("internalNotes"), 900) ||
    "Private reseller note placeholder. Internal admin notes are not exposed.";
  const evidence =
    cleanText(formData.get("evidencePlaceholder"), 700) ||
    "Evidence placeholder only. Uploads are future hooks.";
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: disputeId,
      entity_type: "reseller_disputes",
      event_status: "info",
      event_type: action,
      metadata: {
        buyer_masked_placeholder: "Buyer masked placeholder",
        dispute_category: category,
        dispute_id: disputeId,
        dispute_safety:
          "Dispute workflow tracking only. No refund execution, ownership reversal, payment action, account suspension, wallet, payout, withdrawal, commission, fake sale, or buyer private data exposure occurred.",
        dispute_status: statusForAction(action, currentStatus),
        evidence_placeholder: evidence,
        internal_notes_placeholder: internalNotes,
        priority,
        related_delivery: relatedDelivery,
        related_request: relatedRequest,
        related_review: relatedReview,
        related_transfer: relatedTransfer,
        reseller_id: profile.id,
        source: "reseller_dashboard_disputes",
        summary,
        timeline_note: timelineNoteForAction(action)
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/disputes");
  revalidatePath(`/reseller/dashboard/disputes/${disputeId}`);
  redirect(withStatus(returnTo, "saved", action));
}

export async function createDisputePlaceholder(formData: FormData) {
  await recordDisputeAction(formData, "reseller_dispute_create");
}

export async function addDisputeNotePlaceholder(formData: FormData) {
  await recordDisputeAction(formData, "reseller_dispute_add_note_placeholder");
}

export async function uploadDisputeEvidencePlaceholder(formData: FormData) {
  await recordDisputeAction(formData, "reseller_dispute_upload_evidence_placeholder");
}

export async function requestDisputeReviewPlaceholder(formData: FormData) {
  await recordDisputeAction(formData, "reseller_dispute_request_review_placeholder");
}

export async function closeDisputePlaceholder(formData: FormData) {
  await recordDisputeAction(formData, "reseller_dispute_close_placeholder");
}

export async function escalateDisputePlaceholder(formData: FormData) {
  await recordDisputeAction(formData, "reseller_dispute_escalate_placeholder");
}
