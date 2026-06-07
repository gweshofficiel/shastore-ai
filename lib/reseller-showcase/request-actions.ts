"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ResellerBuyerRequestStatus } from "@/lib/reseller-showcase/data";

type BuyerRequestPlaceholderAction =
  | "reseller_buyer_request_accept_placeholder"
  | "reseller_buyer_request_archive_placeholder"
  | "reseller_buyer_request_convert_lead_placeholder"
  | "reseller_buyer_request_decline_placeholder"
  | "reseller_buyer_request_mark_reviewed_placeholder"
  | "reseller_buyer_request_open_message_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard/requests";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function statusForAction(action: BuyerRequestPlaceholderAction): ResellerBuyerRequestStatus {
  if (action === "reseller_buyer_request_accept_placeholder") {
    return "accepted_placeholder";
  }

  if (action === "reseller_buyer_request_archive_placeholder") {
    return "archived";
  }

  if (action === "reseller_buyer_request_decline_placeholder") {
    return "declined";
  }

  if (action === "reseller_buyer_request_open_message_placeholder") {
    return "in_discussion";
  }

  return "reviewed";
}

async function recordBuyerRequestAction(
  formData: FormData,
  action: BuyerRequestPlaceholderAction
) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));

  if (!user) {
    redirect("/login");
  }

  const requestReference = cleanText(formData.get("requestReference")) || "buyer-request-placeholder";
  const requestCategory = cleanText(formData.get("requestCategory")) || "custom_store";
  const requestedService = cleanText(formData.get("requestedService")) || "Custom store/template request";
  const businessCategory = cleanText(formData.get("businessCategory")) || "Business category placeholder";
  const budgetRange = cleanText(formData.get("budgetRange")) || "Budget placeholder";
  const timeline = cleanText(formData.get("timeline")) || "Timeline placeholder";
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: null,
      entity_type: "reseller_buyer_requests",
      event_status: "info",
      event_type: action,
      metadata: {
        budget_range: budgetRange,
        business_category: businessCategory,
        buyer_display_name: "Buyer placeholder",
        description: "Buyer request placeholder action recorded. No real order or payment was created.",
        preferred_niche: "Preferred niche placeholder",
        privacy: "Private reseller buyer request placeholder only. Buyer email/phone, public request visibility, real orders, payments, charges, ownership transfers, wallet, payout, withdrawal, commission, and fake sales are not created.",
        related_conversation:
          action === "reseller_buyer_request_open_message_placeholder"
            ? "Conversation placeholder"
            : "Conversation not created in this phase",
        related_lead:
          action === "reseller_buyer_request_convert_lead_placeholder"
            ? "Lead conversion placeholder"
            : "Lead not created in this phase",
        request_category: requestCategory,
        request_reference: requestReference,
        request_status: statusForAction(action),
        requested_service: requestedService,
        source: "reseller_dashboard_requests",
        timeline
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/requests");
  revalidatePath("/reseller/dashboard/leads");
  revalidatePath("/reseller/dashboard/messages");
  revalidatePath("/reseller/dashboard/notifications");
  redirect(withStatus(returnTo, "saved", action));
}

export async function markBuyerRequestReviewedPlaceholder(formData: FormData) {
  await recordBuyerRequestAction(formData, "reseller_buyer_request_mark_reviewed_placeholder");
}

export async function acceptBuyerRequestPlaceholder(formData: FormData) {
  await recordBuyerRequestAction(formData, "reseller_buyer_request_accept_placeholder");
}

export async function declineBuyerRequestPlaceholder(formData: FormData) {
  await recordBuyerRequestAction(formData, "reseller_buyer_request_decline_placeholder");
}

export async function archiveBuyerRequestPlaceholder(formData: FormData) {
  await recordBuyerRequestAction(formData, "reseller_buyer_request_archive_placeholder");
}

export async function convertBuyerRequestToLeadPlaceholder(formData: FormData) {
  await recordBuyerRequestAction(formData, "reseller_buyer_request_convert_lead_placeholder");
}

export async function openBuyerRequestMessagePlaceholder(formData: FormData) {
  await recordBuyerRequestAction(formData, "reseller_buyer_request_open_message_placeholder");
}
