"use server";

import { revalidatePath } from "next/cache";
import { isValidMarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  applyMarketplaceApprovalAction,
  type MarketplaceApprovalAction
} from "@/src/lib/marketplace/marketplace-approval-runtime";
import {
  assertValidMarketplaceItemVisibility,
  setMarketplaceItemVisibility,
  type MarketplaceItemVisibility
} from "@/src/lib/marketplace/marketplace-visibility-runtime";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function runMarketplaceApprovalAction(
  formData: FormData,
  action: MarketplaceApprovalAction
) {
  const itemId = cleanText(formData.get("itemId"));
  const itemType = cleanText(formData.get("itemType"));
  const approvalNote = cleanText(formData.get("approvalNote"));

  if (!itemId) {
    throw new Error("Missing marketplace item id.");
  }

  if (itemType && !isValidMarketplaceItemType(itemType)) {
    throw new Error("Invalid marketplace item type.");
  }

  await applyMarketplaceApprovalAction(itemId, action, approvalNote || null);
  revalidatePath("/admin/marketplace");
}

export async function approveMarketplaceItem(formData: FormData) {
  await runMarketplaceApprovalAction(formData, "approve");
}

export async function rejectMarketplaceItem(formData: FormData) {
  await runMarketplaceApprovalAction(formData, "reject");
}

export async function markMarketplaceItemUnderReview(formData: FormData) {
  await runMarketplaceApprovalAction(formData, "submit_for_review");
}

export async function archiveMarketplaceItem(formData: FormData) {
  await runMarketplaceApprovalAction(formData, "archive");
}

export async function restoreMarketplaceItemDraft(formData: FormData) {
  await runMarketplaceApprovalAction(formData, "restore_to_draft");
}

export async function updateMarketplaceItemVisibility(formData: FormData) {
  const itemId = cleanText(formData.get("itemId"));
  const itemType = cleanText(formData.get("itemType"));
  const visibility = cleanText(formData.get("visibility")) as MarketplaceItemVisibility;

  if (!itemId) {
    throw new Error("Missing marketplace item id.");
  }

  if (itemType && !isValidMarketplaceItemType(itemType)) {
    throw new Error("Invalid marketplace item type.");
  }

  assertValidMarketplaceItemVisibility(visibility);
  await setMarketplaceItemVisibility(itemId, visibility);
  revalidatePath("/admin/marketplace");
}
