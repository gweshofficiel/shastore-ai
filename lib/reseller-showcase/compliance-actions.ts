"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ResellerComplianceStatus } from "@/lib/reseller-showcase/data";

type CompliancePlaceholderAction =
  | "reseller_compliance_acknowledge_warning_placeholder"
  | "reseller_compliance_mark_rule_reviewed"
  | "reseller_compliance_request_review_placeholder"
  | "reseller_compliance_view_policy_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 360) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard/compliance")) {
    return "/reseller/dashboard/compliance";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function normalizeComplianceStatus(value: string): ResellerComplianceStatus {
  if (
    value === "good_standing" ||
    value === "needs_attention" ||
    value === "restricted_placeholder" ||
    value === "under_review" ||
    value === "warning_placeholder"
  ) {
    return value;
  }

  return "good_standing";
}

function statusForAction(
  action: CompliancePlaceholderAction,
  currentStatus: ResellerComplianceStatus
): ResellerComplianceStatus {
  if (action === "reseller_compliance_acknowledge_warning_placeholder") {
    return "needs_attention";
  }

  if (action === "reseller_compliance_request_review_placeholder") {
    return "under_review";
  }

  if (action === "reseller_compliance_view_policy_placeholder") {
    return currentStatus;
  }

  return "good_standing";
}

function noteForAction(action: CompliancePlaceholderAction) {
  if (action === "reseller_compliance_acknowledge_warning_placeholder") {
    return "Warning placeholder acknowledged. No real penalty, restriction, suspension, refund, or ownership action was applied.";
  }

  if (action === "reseller_compliance_request_review_placeholder") {
    return "Compliance review requested placeholder. Future admin review can evaluate this later.";
  }

  if (action === "reseller_compliance_view_policy_placeholder") {
    return "Policy viewed placeholder recorded for private reseller compliance tracking.";
  }

  return "Compliance rule reviewed placeholder recorded.";
}

async function recordComplianceAction(formData: FormData, action: CompliancePlaceholderAction) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));

  if (!user) {
    redirect("/login");
  }

  const sectionKey = cleanText(formData.get("sectionKey")) || "marketplace_rules";
  const sectionTitle = cleanText(formData.get("sectionTitle")) || "Marketplace rules";
  const currentStatus = normalizeComplianceStatus(cleanText(formData.get("currentStatus")));
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: null,
      entity_type: "reseller_compliance",
      event_status: "info",
      event_type: action,
      metadata: {
        compliance_note: noteForAction(action),
        compliance_status: statusForAction(action, currentStatus),
        privacy: "Private reseller/admin compliance tracking only. No public profile exposure, real penalty, automatic suspension, refund, ownership reversal, wallet, payout, withdrawal, commission, or fake sale was created.",
        section_key: sectionKey,
        section_title: sectionTitle,
        source: "reseller_dashboard_compliance"
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/compliance");
  redirect(withStatus(returnTo, "saved", action));
}

export async function markComplianceRuleReviewedPlaceholder(formData: FormData) {
  await recordComplianceAction(formData, "reseller_compliance_mark_rule_reviewed");
}

export async function viewCompliancePolicyPlaceholder(formData: FormData) {
  await recordComplianceAction(formData, "reseller_compliance_view_policy_placeholder");
}

export async function acknowledgeComplianceWarningPlaceholder(formData: FormData) {
  await recordComplianceAction(formData, "reseller_compliance_acknowledge_warning_placeholder");
}

export async function requestComplianceReviewPlaceholder(formData: FormData) {
  await recordComplianceAction(formData, "reseller_compliance_request_review_placeholder");
}
