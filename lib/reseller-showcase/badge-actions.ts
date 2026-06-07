"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ResellerBadgeType } from "@/lib/reseller-showcase/data";

type BadgePlaceholderAction =
  | "reseller_badge_hide_public"
  | "reseller_badge_request_review_placeholder"
  | "reseller_badge_show_public"
  | "reseller_badge_view_requirements_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard/badges";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function publicVisibilityForAction(action: BadgePlaceholderAction) {
  return action === "reseller_badge_hide_public" ? "hidden" : "visible";
}

async function recordBadgeAction(formData: FormData, action: BadgePlaceholderAction) {
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
    .select("slug")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileData as { slug?: string } | null;
  const badgeSlug = cleanText(formData.get("badgeSlug")) as ResellerBadgeType | "";
  const badgeLabel = cleanText(formData.get("badgeLabel")) || "Badge placeholder";
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: null,
      entity_type: "reseller_badges",
      event_status: "info",
      event_type: action,
      metadata: {
        badge_label: badgeLabel,
        badge_slug: badgeSlug || "active_reseller",
        privacy: "Reseller badge visibility/review placeholder only. No buyer private data, real orders, payments, ownership transfer, wallet, payout, withdrawal, commission, fake sale, or sales metric was created.",
        public_visibility: publicVisibilityForAction(action),
        source: "reseller_dashboard_badges"
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard");
  revalidatePath("/reseller/dashboard/badges");
  revalidatePath("/reseller/dashboard/showcase");
  if (profile?.slug) {
    revalidatePath(`/resellers/${profile.slug}`);
  }
  redirect(withStatus(returnTo, "saved", action));
}

export async function showBadgeOnPublicProfilePlaceholder(formData: FormData) {
  await recordBadgeAction(formData, "reseller_badge_show_public");
}

export async function hideBadgeOnPublicProfilePlaceholder(formData: FormData) {
  await recordBadgeAction(formData, "reseller_badge_hide_public");
}

export async function viewBadgeRequirementsPlaceholder(formData: FormData) {
  await recordBadgeAction(formData, "reseller_badge_view_requirements_placeholder");
}

export async function requestBadgeReviewPlaceholder(formData: FormData) {
  await recordBadgeAction(formData, "reseller_badge_request_review_placeholder");
}
