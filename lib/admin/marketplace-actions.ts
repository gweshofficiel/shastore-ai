"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type MarketplaceAction =
  | "admin_marketplace_approve_item"
  | "admin_marketplace_archive_item"
  | "admin_marketplace_mark_review"
  | "admin_marketplace_reject_item";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordMarketplaceAction(formData: FormData, action: MarketplaceAction) {
  const access = await getAdminAccess();
  const itemId = cleanText(formData.get("itemId"));
  const itemName = cleanText(formData.get("itemName"));
  const itemType = cleanText(formData.get("itemType"));

  if (!itemId) {
    throw new Error("Missing marketplace item id.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: action,
    metadata: {
      item_id: itemId,
      item_name: itemName,
      item_type: itemType,
      note: "Placeholder marketplace approval action only. No marketplace payment, app/plugin installation, deletion, or public exposure was performed.",
      source: "super_admin_marketplace_management_center"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/marketplace");
}

export async function approveMarketplaceItem(formData: FormData) {
  await recordMarketplaceAction(formData, "admin_marketplace_approve_item");
}

export async function rejectMarketplaceItem(formData: FormData) {
  await recordMarketplaceAction(formData, "admin_marketplace_reject_item");
}

export async function markMarketplaceItemUnderReview(formData: FormData) {
  await recordMarketplaceAction(formData, "admin_marketplace_mark_review");
}

export async function archiveMarketplaceItem(formData: FormData) {
  await recordMarketplaceAction(formData, "admin_marketplace_archive_item");
}
