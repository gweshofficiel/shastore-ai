import "server-only";

import {
  filterPublicMarketplaceAssets,
  type MarketplaceAssetPublicView,
  type MarketplaceAssetRecord,
  listMarketplaceAssetsForPublicCatalog
} from "@/src/lib/marketplace/marketplace-asset-runtime";
import {
  getMarketplaceItemTypeLabel,
  getMarketplaceSectionLabel,
  type MarketplaceItemType,
  type MarketplaceSection
} from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  listMarketplaceItemsForPublicCatalog,
  type MarketplaceItemRecord
} from "@/src/lib/marketplace/marketplace-registry";
import type { MarketplacePricingMode } from "@/src/lib/marketplace/marketplace-pricing-runtime";
import {
  isPublicCatalogItemEligible,
  loadPublicCreatorDisplayNames,
  resolvePublicCatalogThumbnail,
  sanitizePublicCatalogDescription
} from "@/src/lib/marketplace/marketplace-public-catalog-runtime";

export type MarketplacePublicItemDetail = {
  billingInterval: "monthly" | "yearly" | null;
  createdAt: string | null;
  createdAtLabel: string | null;
  creatorDisplayName: string | null;
  currency: "EUR" | "MAD" | "USD" | null;
  demoMediaAssets: MarketplaceAssetPublicView[];
  description: string | null;
  documentationAssets: MarketplaceAssetPublicView[];
  galleryAssets: MarketplaceAssetPublicView[];
  id: string;
  installCount: number;
  itemType: MarketplaceItemType;
  liveInstalls: number;
  previewAssets: MarketplaceAssetPublicView[];
  priceAmount: number;
  pricingMode: MarketplacePricingMode;
  publicSlug: string;
  section: MarketplaceSection;
  sectionLabel: string;
  thumbnail: MarketplaceAssetPublicView | null;
  title: string;
  trialDays: number;
  typeLabel: string;
  updatedAt: string | null;
  updatedAtLabel: string | null;
};

export type MarketplacePublicItemDetailLookup = {
  itemId?: string;
  itemType?: MarketplaceItemType;
  slug?: string;
};

const publicDetailDateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function formatPublicMarketplaceDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  try {
    return publicDetailDateFormatter.format(parsed);
  } catch {
    return null;
  }
}

export function groupPublicItemDetailAssets(
  assets: MarketplaceAssetRecord[],
  item: Pick<MarketplaceItemRecord, "status" | "visibility">
) {
  const publicAssets = filterPublicMarketplaceAssets({
    assets,
    marketplaceStatus: item.status,
    marketplaceVisibility: item.visibility
  });

  return {
    demoMediaAssets: publicAssets.filter((asset) => asset.assetType === "demo_media"),
    documentationAssets: publicAssets.filter((asset) => asset.assetType === "documentation"),
    galleryAssets: publicAssets.filter((asset) => asset.assetType === "gallery_image"),
    previewAssets: publicAssets.filter((asset) => asset.assetType === "preview_file"),
    thumbnail: publicAssets.find((asset) => asset.assetType === "thumbnail") ?? null
  };
}

export function toMarketplacePublicItemDetail(params: {
  assets: MarketplaceAssetRecord[];
  creatorDisplayName: string | null;
  item: MarketplaceItemRecord;
}): MarketplacePublicItemDetail | null {
  if (!isPublicCatalogItemEligible(params.item)) {
    return null;
  }

  const groupedAssets = groupPublicItemDetailAssets(params.assets, params.item);
  const thumbnail = groupedAssets.thumbnail ?? resolvePublicCatalogThumbnail(params.assets, params.item);

  return {
    billingInterval: params.item.pricing.billingInterval,
    createdAt: params.item.createdAt,
    createdAtLabel: formatPublicMarketplaceDate(params.item.createdAt),
    creatorDisplayName: params.creatorDisplayName,
    currency: params.item.pricing.currency,
    demoMediaAssets: groupedAssets.demoMediaAssets,
    description: sanitizePublicCatalogDescription(params.item.metadata),
    documentationAssets: groupedAssets.documentationAssets,
    galleryAssets: groupedAssets.galleryAssets,
    id: params.item.id,
    installCount: Math.max(0, params.item.installCount),
    itemType: params.item.itemType,
    liveInstalls: Math.max(0, params.item.liveInstalls),
    previewAssets: groupedAssets.previewAssets,
    priceAmount: params.item.pricing.priceAmount,
    pricingMode: params.item.pricing.mode,
    publicSlug: params.item.slug,
    section: params.item.section,
    sectionLabel: getMarketplaceSectionLabel(params.item.section),
    thumbnail,
    title: params.item.name,
    trialDays: Math.max(0, params.item.pricing.trialDays),
    typeLabel: getMarketplaceItemTypeLabel(params.item.itemType),
    updatedAt: params.item.updatedAt,
    updatedAtLabel: formatPublicMarketplaceDate(params.item.updatedAt)
  };
}

async function loadMarketplacePublicItemDetail(
  lookup: MarketplacePublicItemDetailLookup
): Promise<MarketplacePublicItemDetail | null> {
  const cleanedSlug = lookup.slug ? text(lookup.slug, 160) : "";
  const cleanedItemId = lookup.itemId ? text(lookup.itemId, 120) : "";

  if (!cleanedSlug && !cleanedItemId) {
    return null;
  }

  const items = await listMarketplaceItemsForPublicCatalog({
    itemId: cleanedItemId || undefined,
    itemType: lookup.itemType,
    limit: 1,
    slug: cleanedSlug || undefined
  });
  const item = items[0];

  if (!item || !isPublicCatalogItemEligible(item)) {
    return null;
  }

  if (lookup.itemType && item.itemType !== lookup.itemType) {
    return null;
  }

  let assets: MarketplaceAssetRecord[] = [];
  let creatorDisplayName: string | null = null;

  try {
    assets = await listMarketplaceAssetsForPublicCatalog([item.id]);
  } catch (error) {
    console.error("[loadMarketplacePublicItemDetail] public assets unavailable", error);
  }

  if (item.creatorAccountId) {
    try {
      const creatorDisplayNames = await loadPublicCreatorDisplayNames([item.creatorAccountId]);
      creatorDisplayName = creatorDisplayNames.get(item.creatorAccountId) ?? null;
    } catch (error) {
      console.error("[loadMarketplacePublicItemDetail] public creator name unavailable", error);
    }
  }

  return toMarketplacePublicItemDetail({
    assets,
    creatorDisplayName,
    item
  });
}

export async function getMarketplacePublicItemDetailBySlug(
  slug: string
): Promise<MarketplacePublicItemDetail | null> {
  return loadMarketplacePublicItemDetail({ slug });
}

export async function getMarketplacePublicItemDetailByTypeAndSlug(
  itemType: MarketplaceItemType,
  slug: string
): Promise<MarketplacePublicItemDetail | null> {
  return loadMarketplacePublicItemDetail({ itemType, slug });
}

export async function getMarketplacePublicItemDetailById(
  itemId: string
): Promise<MarketplacePublicItemDetail | null> {
  return loadMarketplacePublicItemDetail({ itemId });
}

export async function getMarketplacePublicItemDetail(
  lookup: MarketplacePublicItemDetailLookup
): Promise<MarketplacePublicItemDetail | null> {
  return loadMarketplacePublicItemDetail(lookup);
}
