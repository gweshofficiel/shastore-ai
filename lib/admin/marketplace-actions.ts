"use server";

import { revalidatePath } from "next/cache";
import { isValidMarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  transitionMarketplaceItemStatus,
  type MarketplaceStatusTransition
} from "@/src/lib/marketplace/marketplace-status-runtime";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function runMarketplaceStatusAction(
  formData: FormData,
  transition: MarketplaceStatusTransition
) {
  const itemId = cleanText(formData.get("itemId"));
  const itemType = cleanText(formData.get("itemType"));

  if (!itemId) {
    throw new Error("Missing marketplace item id.");
  }

  if (itemType && !isValidMarketplaceItemType(itemType)) {
    throw new Error("Invalid marketplace item type.");
  }

  await transitionMarketplaceItemStatus(itemId, transition);
  revalidatePath("/admin/marketplace");
}

export async function approveMarketplaceItem(formData: FormData) {
  await runMarketplaceStatusAction(formData, "approve");
}

export async function rejectMarketplaceItem(formData: FormData) {
  await runMarketplaceStatusAction(formData, "reject");
}

export async function markMarketplaceItemUnderReview(formData: FormData) {
  await runMarketplaceStatusAction(formData, "pending_review");
}

export async function archiveMarketplaceItem(formData: FormData) {
  await runMarketplaceStatusAction(formData, "archive");
}
