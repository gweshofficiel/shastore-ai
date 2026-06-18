"use server";

import { revalidatePath } from "next/cache";
import { isValidMarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  applyMarketplaceApprovalAction,
  type MarketplaceApprovalAction
} from "@/src/lib/marketplace/marketplace-approval-runtime";
import { submitMarketplaceCreatorSubmission } from "@/src/lib/marketplace/marketplace-creator-submission-runtime";
import {
  assertValidMarketplaceItemVisibility,
  setMarketplaceItemVisibility,
  type MarketplaceItemVisibility
} from "@/src/lib/marketplace/marketplace-visibility-runtime";
import {
  setMarketplaceItemPricing,
  type MarketplaceBillingInterval,
  type MarketplaceCurrency,
  type MarketplacePricingMode
} from "@/src/lib/marketplace/marketplace-pricing-runtime";

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
  const itemId = cleanText(formData.get("itemId"));
  const itemType = cleanText(formData.get("itemType"));
  const submissionNote = cleanText(formData.get("submissionNote") || formData.get("approvalNote"));

  if (!itemId) {
    throw new Error("Missing marketplace item id.");
  }

  if (itemType && !isValidMarketplaceItemType(itemType)) {
    throw new Error("Invalid marketplace item type.");
  }

  await submitMarketplaceCreatorSubmission({
    itemId,
    submissionNote: submissionNote || null
  });
  revalidatePath("/admin/marketplace");
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

export async function updateMarketplaceItemPricing(formData: FormData) {
  const itemId = cleanText(formData.get("itemId"));
  const itemType = cleanText(formData.get("itemType"));
  const pricingMode = cleanText(formData.get("pricingMode")) as MarketplacePricingMode;
  const priceAmount = cleanText(formData.get("priceAmount"));
  const currency = cleanText(formData.get("currency")) as MarketplaceCurrency;
  const billingInterval = cleanText(formData.get("billingInterval")) as MarketplaceBillingInterval;
  const trialDays = cleanText(formData.get("trialDays"));

  if (!itemId) {
    throw new Error("Missing marketplace item id.");
  }

  if (itemType && !isValidMarketplaceItemType(itemType)) {
    throw new Error("Invalid marketplace item type.");
  }

  await setMarketplaceItemPricing(itemId, {
    billingInterval: billingInterval || null,
    currency: currency || null,
    priceAmount: priceAmount ? Number(priceAmount) : null,
    pricingMode,
    trialDays: trialDays ? Number(trialDays) : 0
  });
  revalidatePath("/admin/marketplace");
}
