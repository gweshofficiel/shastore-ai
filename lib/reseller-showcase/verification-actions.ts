"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ResellerVerificationKind } from "@/lib/reseller-showcase/data";

type VerificationPlaceholderAction =
  | "reseller_verification_requirements_viewed"
  | "reseller_verification_resubmit_placeholder"
  | "reseller_verification_start_placeholder"
  | "reseller_verification_submit_placeholder";

const verificationKinds = new Set<ResellerVerificationKind>(["business", "email", "identity", "phone"]);

function cleanText(value: FormDataEntryValue | null, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanKind(value: FormDataEntryValue | null): ResellerVerificationKind {
  const kind = cleanText(value);
  return verificationKinds.has(kind as ResellerVerificationKind) ? (kind as ResellerVerificationKind) : "email";
}

async function recordVerificationAction(formData: FormData, action: VerificationPlaceholderAction) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const kind = cleanKind(formData.get("verificationKind"));
  const profileSlug = cleanText(formData.get("profileSlug"));
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: null,
      entity_type: "reseller_verification",
      event_status: "info",
      event_type: action,
      metadata: {
        note: "Placeholder reseller verification action only. No KYC provider, document upload, wallet, payout, withdrawal, or public private-data exposure was performed.",
        profile_slug: profileSlug || null,
        source: "reseller_dashboard_verification",
        verification_kind: kind
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/verification");
  revalidatePath("/reseller/dashboard");
  revalidatePath("/reseller/dashboard/showcase");

  if (profileSlug) {
    revalidatePath(`/resellers/${profileSlug}`);
  }

  redirect(`/reseller/dashboard/verification?saved=${encodeURIComponent(action)}`);
}

export async function startVerificationPlaceholder(formData: FormData) {
  await recordVerificationAction(formData, "reseller_verification_start_placeholder");
}

export async function submitVerificationPlaceholder(formData: FormData) {
  await recordVerificationAction(formData, "reseller_verification_submit_placeholder");
}

export async function viewVerificationRequirements(formData: FormData) {
  await recordVerificationAction(formData, "reseller_verification_requirements_viewed");
}

export async function resubmitVerificationPlaceholder(formData: FormData) {
  await recordVerificationAction(formData, "reseller_verification_resubmit_placeholder");
}
