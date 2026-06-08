"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ResellerDeliveryStatus } from "@/lib/reseller-showcase/data";

type DeliveryPlaceholderAction =
  | "reseller_delivery_cancel"
  | "reseller_delivery_checklist_complete"
  | "reseller_delivery_prepare_buyer_instructions"
  | "reseller_delivery_start_preparation"
  | "reseller_delivery_ready_handoff_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 320) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard/deliveries")) {
    return "/reseller/dashboard/deliveries";
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

function normalizeDeliveryStatus(value: string): ResellerDeliveryStatus {
  if (
    value === "buyer_invited" ||
    value === "cancelled" ||
    value === "delivered_placeholder" ||
    value === "disputed" ||
    value === "not_started" ||
    value === "preparing" ||
    value === "ready_to_handoff" ||
    value === "waiting_buyer_claim"
  ) {
    return value;
  }

  return "not_started";
}

function statusForAction(
  action: DeliveryPlaceholderAction,
  currentStatus: ResellerDeliveryStatus
): ResellerDeliveryStatus {
  if (action === "reseller_delivery_cancel") {
    return "cancelled";
  }

  if (action === "reseller_delivery_prepare_buyer_instructions") {
    return "buyer_invited";
  }

  if (action === "reseller_delivery_ready_handoff_placeholder") {
    return "ready_to_handoff";
  }

  if (action === "reseller_delivery_checklist_complete") {
    return currentStatus === "not_started" ? "preparing" : currentStatus;
  }

  return "preparing";
}

function timelineNoteForAction(action: DeliveryPlaceholderAction) {
  if (action === "reseller_delivery_cancel") {
    return "Delivery cancelled placeholder recorded. No ownership, workspace, account, RLS, wallet, payout, withdrawal, commission, or fake sale changed.";
  }

  if (action === "reseller_delivery_checklist_complete") {
    return "Delivery checklist item completed as a private handoff audit record.";
  }

  if (action === "reseller_delivery_prepare_buyer_instructions") {
    return "Buyer instructions prepared placeholder recorded. No buyer account, email, token, or claim link was created.";
  }

  if (action === "reseller_delivery_ready_handoff_placeholder") {
    return "Delivery marked ready for handoff placeholder. Future ownership migration remains disabled.";
  }

  return "Delivery preparation started placeholder. No real ownership transfer occurred.";
}

async function recordDeliveryAction(formData: FormData, action: DeliveryPlaceholderAction) {
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
    redirectWithError("Create your reseller profile before preparing store deliveries.", returnTo);
  }

  const transferId = cleanText(formData.get("transferId")) || "transfer-placeholder";
  const deliveryId =
    cleanText(formData.get("deliveryId")) ||
    `delivery-${Date.now().toString(36)}-${user.id.slice(0, 6)}`;
  const storeId = cleanText(formData.get("storeId")) || "store-placeholder";
  const storeName = cleanText(formData.get("storeName")) || "Store placeholder";
  const buyerPlaceholder = cleanText(formData.get("buyerPlaceholder")) || "Buyer placeholder";
  const checklistKey = cleanText(formData.get("checklistKey"));
  const currentStatus = normalizeDeliveryStatus(cleanText(formData.get("deliveryStatus")));

  if (action === "reseller_delivery_start_preparation" && transferId === "transfer-placeholder") {
    redirectWithError("Select a transfer before starting delivery preparation.", returnTo);
  }

  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: deliveryId,
      entity_type: "reseller_store_deliveries",
      event_status: "info",
      event_type: action,
      metadata: {
        buyer_placeholder: buyerPlaceholder,
        checklist_completed: action === "reseller_delivery_checklist_complete" ? true : undefined,
        checklist_key: checklistKey || undefined,
        delivery_id: deliveryId,
        delivery_safety:
          "Digital store handoff workflow only. No store owner_id change, workspace transfer, buyer account creation, RLS modification, real ownership transfer, wallet, payout, withdrawal, commission, or fake sale occurred.",
        delivery_status: statusForAction(action, currentStatus),
        reseller_id: profile.id,
        source: "reseller_dashboard_deliveries",
        store_id: storeId,
        store_name: storeName,
        timeline_note: timelineNoteForAction(action),
        transfer_id: transferId
      },
      store_id: storeId === "store-placeholder" ? null : storeId,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/deliveries");
  redirect(withStatus(returnTo, "saved", action));
}

export async function startDeliveryPreparationPlaceholder(formData: FormData) {
  await recordDeliveryAction(formData, "reseller_delivery_start_preparation");
}

export async function markDeliveryChecklistItemCompletePlaceholder(formData: FormData) {
  await recordDeliveryAction(formData, "reseller_delivery_checklist_complete");
}

export async function prepareBuyerInstructionsPlaceholder(formData: FormData) {
  await recordDeliveryAction(formData, "reseller_delivery_prepare_buyer_instructions");
}

export async function markDeliveryReadyForHandoffPlaceholder(formData: FormData) {
  await recordDeliveryAction(formData, "reseller_delivery_ready_handoff_placeholder");
}

export async function cancelDeliveryPlaceholder(formData: FormData) {
  await recordDeliveryAction(formData, "reseller_delivery_cancel");
}
