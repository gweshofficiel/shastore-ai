"use server";

import { revalidatePath } from "next/cache";
import { isValidMarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";
import { submitMarketplaceCreatorSubmission } from "@/src/lib/marketplace/marketplace-creator-submission-runtime";
import {
  applyMarketplaceModerationAction,
  assertValidMarketplaceModerationAction,
  type MarketplaceModerationAction
} from "@/src/lib/marketplace/marketplace-moderation-runtime";
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

async function runMarketplaceModerationAction(
  formData: FormData,
  action: MarketplaceModerationAction
) {
  const itemId = cleanText(formData.get("itemId"));
  const itemType = cleanText(formData.get("itemType"));
  const moderationNote = cleanText(formData.get("moderationNote") || formData.get("approvalNote"));
  const moderationReason = cleanText(formData.get("moderationReason"));

  if (!itemId) {
    throw new Error("Missing marketplace item id.");
  }

  if (itemType && !isValidMarketplaceItemType(itemType)) {
    throw new Error("Invalid marketplace item type.");
  }

  assertValidMarketplaceModerationAction(action);

  await applyMarketplaceModerationAction({
    itemId,
    moderationAction: action,
    moderationNote: moderationNote || null,
    moderationReason: moderationReason || null
  });
  revalidatePath("/admin/marketplace");
}

export async function approveMarketplaceItem(formData: FormData) {
  await runMarketplaceModerationAction(formData, "approve");
}

export async function rejectMarketplaceItem(formData: FormData) {
  await runMarketplaceModerationAction(formData, "reject");
}

export async function requestMarketplaceItemChanges(formData: FormData) {
  await runMarketplaceModerationAction(formData, "request_changes");
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
  await runMarketplaceModerationAction(formData, "archive");
}

export async function restoreMarketplaceItemDraft(formData: FormData) {
  await runMarketplaceModerationAction(formData, "request_changes");
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
