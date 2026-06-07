"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ReviewPlaceholderAction =
  | "reseller_review_mark_reviewed_placeholder"
  | "reseller_review_reply_placeholder"
  | "reseller_review_report_placeholder"
  | "reseller_review_viewed";

function cleanText(value: FormDataEntryValue | null, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard/reviews";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

async function recordReviewAction(formData: FormData, action: ReviewPlaceholderAction) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));

  if (!user) {
    redirect("/login");
  }

  const reviewReference = cleanText(formData.get("reviewReference")) || "review-placeholder";
  const profileSlug = cleanText(formData.get("profileSlug"));
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: null,
      entity_type: "reseller_reviews",
      event_status: "info",
      event_type: action,
      metadata: {
        note: "Placeholder reseller review action only. No buyer private data, order data, checkout dependency, payout, wallet, withdrawal, or public review mutation was performed.",
        profile_slug: profileSlug || null,
        review_reference: reviewReference,
        source: "reseller_dashboard_reviews"
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/reviews");

  if (profileSlug) {
    revalidatePath(`/resellers/${profileSlug}`);
  }

  redirect(withStatus(returnTo, "saved", action));
}

export async function viewResellerReview(formData: FormData) {
  await recordReviewAction(formData, "reseller_review_viewed");
}

export async function markResellerReviewReviewedPlaceholder(formData: FormData) {
  await recordReviewAction(formData, "reseller_review_mark_reviewed_placeholder");
}

export async function replyResellerReviewPlaceholder(formData: FormData) {
  await recordReviewAction(formData, "reseller_review_reply_placeholder");
}

export async function reportResellerReviewPlaceholder(formData: FormData) {
  await recordReviewAction(formData, "reseller_review_report_placeholder");
}
