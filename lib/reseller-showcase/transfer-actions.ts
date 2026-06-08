"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ResellerTransferStatus } from "@/lib/reseller-showcase/data";

type TransferPlaceholderAction =
  | "reseller_transfer_approve_placeholder"
  | "reseller_transfer_cancel"
  | "reseller_transfer_create"
  | "reseller_transfer_mark_ready_placeholder"
  | "reseller_transfer_view_timeline_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 260) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard/transfers")) {
    return "/reseller/dashboard/transfers";
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

function statusForAction(
  action: TransferPlaceholderAction,
  currentStatus: ResellerTransferStatus
): ResellerTransferStatus {
  if (action === "reseller_transfer_approve_placeholder") {
    return "approved";
  }

  if (action === "reseller_transfer_cancel") {
    return "cancelled";
  }

  if (action === "reseller_transfer_mark_ready_placeholder") {
    return "ready_for_transfer";
  }

  if (action === "reseller_transfer_view_timeline_placeholder") {
    return currentStatus;
  }

  return "draft";
}

function normalizeTransferStatus(value: string): ResellerTransferStatus {
  if (
    value === "approved" ||
    value === "cancelled" ||
    value === "completed_placeholder" ||
    value === "disputed" ||
    value === "draft" ||
    value === "pending_buyer" ||
    value === "pending_review" ||
    value === "ready_for_transfer"
  ) {
    return value;
  }

  return "draft";
}

function auditNoteForAction(action: TransferPlaceholderAction) {
  if (action === "reseller_transfer_approve_placeholder") {
    return "Transfer approved placeholder recorded. Store owner_id, workspace, account, and RLS were not changed.";
  }

  if (action === "reseller_transfer_cancel") {
    return "Transfer cancelled placeholder recorded. No buyer claim, sale, payout, or ownership change occurred.";
  }

  if (action === "reseller_transfer_mark_ready_placeholder") {
    return "Transfer marked ready placeholder recorded. Future migration remains disabled.";
  }

  if (action === "reseller_transfer_view_timeline_placeholder") {
    return "Transfer timeline viewed placeholder recorded for private reseller audit.";
  }

  return "Transfer request created placeholder recorded. No ownership transfer occurred.";
}

async function recordTransferAction(formData: FormData, action: TransferPlaceholderAction) {
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
    redirectWithError("Create your reseller profile before preparing transfer requests.", returnTo);
  }

  const requestedStoreId = cleanText(formData.get("storeId"));
  const transferId =
    cleanText(formData.get("transferId")) ||
    `transfer-${Date.now().toString(36)}-${user.id.slice(0, 6)}`;
  const storeQuery = requestedStoreId
    ? await supabase
        .from("stores")
        .select("id, name, description")
        .eq("id", requestedStoreId)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null, error: null };
  const store = storeQuery.data as { description: string | null; id: string; name: string } | null;

  if (action === "reseller_transfer_create" && !store) {
    redirectWithError("Select an owned store before creating a transfer request placeholder.", returnTo);
  }

  const storeId = (store?.id ?? cleanText(formData.get("storeId"))) || "store-placeholder";
  const storeName = (store?.name ?? cleanText(formData.get("storeName"))) || "Store placeholder";
  const storeDescription =
    (store?.description ?? cleanText(formData.get("storeDescription"), 500)) || "Store description placeholder";
  const buyerPlaceholder = cleanText(formData.get("buyerPlaceholder")) || "Buyer placeholder";
  const currentStatus = normalizeTransferStatus(cleanText(formData.get("transferStatus")));
  const notesPlaceholder =
    cleanText(formData.get("notesPlaceholder"), 700) ||
    "Private internal transfer notes placeholder. Buyer private information is not stored or exposed.";
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: transferId,
      entity_type: "reseller_ownership_transfers",
      event_status: "info",
      event_type: action,
      metadata: {
        audit_note: auditNoteForAction(action),
        buyer_placeholder: buyerPlaceholder,
        notes_placeholder: notesPlaceholder,
        ownership_safety:
          "No store owner_id change, no workspace transfer, no account transfer, no RLS modification, no real ownership transfer, no wallet, no payout, no withdrawal, no commission, and no fake sale occurred.",
        reseller_id: profile.id,
        source: "reseller_dashboard_transfers",
        store_description: storeDescription,
        store_id: storeId,
        store_name: storeName,
        transfer_id: transferId,
        transfer_status: statusForAction(action, currentStatus)
      },
      store_id: storeId === "store-placeholder" ? null : storeId,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/transfers");
  revalidatePath(`/reseller/dashboard/transfers/${transferId}`);
  redirect(withStatus(returnTo, "saved", action));
}

export async function createTransferRequestPlaceholder(formData: FormData) {
  await recordTransferAction(formData, "reseller_transfer_create");
}

export async function cancelTransferPlaceholder(formData: FormData) {
  await recordTransferAction(formData, "reseller_transfer_cancel");
}

export async function viewTransferTimelinePlaceholder(formData: FormData) {
  await recordTransferAction(formData, "reseller_transfer_view_timeline_placeholder");
}

export async function markTransferReadyPlaceholder(formData: FormData) {
  await recordTransferAction(formData, "reseller_transfer_mark_ready_placeholder");
}

export async function approveTransferPlaceholder(formData: FormData) {
  await recordTransferAction(formData, "reseller_transfer_approve_placeholder");
}
