import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  filterPublicMarketplaceAssets,
  type MarketplaceAssetPublicView,
  type MarketplaceAssetRecord,
  listMarketplaceAssetsForPublicCatalog
} from "@/src/lib/marketplace/marketplace-asset-runtime";
import {
  isPublicCreatorEligible,
  parseMarketplaceCreatorAccount
} from "@/src/lib/marketplace/marketplace-creator-runtime";
import {
  getItemTypeForSection,
  getMarketplaceItemTypeLabel,
  getMarketplaceSectionLabel,
  type MarketplaceItemType,
  type MarketplaceSection
} from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  listMarketplaceItemsForPublicCatalog,
  type MarketplaceItemRecord,
  type MarketplacePublicCatalogItemFilters
} from "@/src/lib/marketplace/marketplace-registry";
import type { MarketplacePricingMode } from "@/src/lib/marketplace/marketplace-pricing-runtime";
import { isPublicMarketplaceEligible } from "@/src/lib/marketplace/marketplace-visibility-runtime";

export type MarketplacePublicCatalogEntry = {
  billingInterval: "monthly" | "yearly" | null;
  creatorDisplayName: string | null;
  currency: "EUR" | "MAD" | "USD" | null;
  description: string | null;
  id: string;
  installCount: number;
  itemType: MarketplaceItemType;
  liveInstalls: number;
  priceAmount: number;
  pricingMode: MarketplacePricingMode;
  publicSlug: string;
  section: MarketplaceSection;
  sectionLabel: string;
  thumbnail: MarketplaceAssetPublicView | null;
  title: string;
  typeLabel: string;
  updatedAt: string | null;
};

export type MarketplacePublicCatalogFilters = {
  itemType?: MarketplaceItemType;
  limit?: number;
  section?: MarketplaceSection;
};

export type MarketplacePublicCatalogStats = {
  apps: number;
  plugins: number;
  services: number;
  templates: number;
  themes: number;
  totalItems: number;
};

export type MarketplacePublicCatalogListResult = {
  entries: MarketplacePublicCatalogEntry[];
  totalCount: number;
};

const creatorCatalogSelect = "id, display_name, creator_status, verification_status";

const secretKeyPattern = /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account)/i;

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

function requireCatalogClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role access is required for marketplace public catalog runtime.");
  }

  return admin;
}

export function sanitizePublicCatalogDescription(metadata: Record<string, unknown>) {
  const candidates = [metadata.public_description, metadata.description, metadata.summary];

  for (const candidate of candidates) {
    const cleaned = text(candidate, 2000);

    if (!cleaned || secretKeyPattern.test(cleaned)) {
      continue;
    }

    return cleaned;
  }

  return null;
}

export function isPublicCatalogItemEligible(item: Pick<MarketplaceItemRecord, "status" | "visibility">) {
  return isPublicMarketplaceEligible({ status: item.status, visibility: item.visibility });
}

export function resolvePublicCatalogThumbnail(
  assets: MarketplaceAssetRecord[],
  item: Pick<MarketplaceItemRecord, "status" | "visibility">
): MarketplaceAssetPublicView | null {
  const publicAssets = filterPublicMarketplaceAssets({
    assets,
    marketplaceStatus: item.status,
    marketplaceVisibility: item.visibility
  });

  return publicAssets.find((asset) => asset.assetType === "thumbnail") ?? publicAssets[0] ?? null;
}

export function toMarketplacePublicCatalogEntry(params: {
  assets: MarketplaceAssetRecord[];
  creatorDisplayName: string | null;
  item: MarketplaceItemRecord;
}): MarketplacePublicCatalogEntry | null {
  if (!isPublicCatalogItemEligible(params.item)) {
    return null;
  }

  const thumbnail = resolvePublicCatalogThumbnail(params.assets, params.item);

  return {
    billingInterval: params.item.pricing.billingInterval,
    creatorDisplayName: params.creatorDisplayName,
    currency: params.item.pricing.currency,
    description: sanitizePublicCatalogDescription(params.item.metadata),
    id: params.item.id,
    installCount: params.item.installCount,
    itemType: params.item.itemType,
    liveInstalls: params.item.liveInstalls,
    priceAmount: params.item.pricing.priceAmount,
    pricingMode: params.item.pricing.mode,
    publicSlug: params.item.slug,
    section: params.item.section,
    sectionLabel: getMarketplaceSectionLabel(params.item.section),
    thumbnail,
    title: params.item.name,
    typeLabel: getMarketplaceItemTypeLabel(params.item.itemType),
    updatedAt: params.item.updatedAt
  };
}

export async function loadPublicCreatorDisplayNames(creatorAccountIds: string[]) {
  const admin = requireCatalogClient();
  const cleanedIds = [...new Set(creatorAccountIds.map((id) => text(id, 120)).filter(Boolean))];
  const displayNames = new Map<string, string>();

  if (!cleanedIds.length) {
    return displayNames;
  }

  const { data, error } = await admin
    .from("marketplace_creator_accounts" as never)
    .select(creatorCatalogSelect as never)
    .in("id" as never, cleanedIds as never);

  if (error) {
    throw new Error(`Public marketplace creator names could not be loaded: ${error.message}`);
  }

  for (const row of Array.isArray(data) ? (data as unknown[]) : []) {
    const creator = parseMarketplaceCreatorAccount(row);

    if (!creator || !isPublicCreatorEligible(creator)) {
      continue;
    }

    displayNames.set(creator.id, creator.displayName);
  }

  return displayNames;
}

function groupAssetsByItemId(assets: MarketplaceAssetRecord[]) {
  return assets.reduce<Map<string, MarketplaceAssetRecord[]>>((map, asset) => {
    const existing = map.get(asset.marketplaceItemId) ?? [];
    existing.push(asset);
    map.set(asset.marketplaceItemId, existing);
    return map;
  }, new Map());
}

async function buildPublicCatalogEntries(
  items: MarketplaceItemRecord[],
  assets: MarketplaceAssetRecord[]
): Promise<MarketplacePublicCatalogEntry[]> {
  const creatorDisplayNames = await loadPublicCreatorDisplayNames(
    items.map((item) => item.creatorAccountId ?? "").filter(Boolean)
  );
  const assetsByItemId = groupAssetsByItemId(assets);

  return items
    .map((item) =>
      toMarketplacePublicCatalogEntry({
        assets: assetsByItemId.get(item.id) ?? [],
        creatorDisplayName: item.creatorAccountId
          ? creatorDisplayNames.get(item.creatorAccountId) ?? null
          : null,
        item
      })
    )
    .filter((entry): entry is MarketplacePublicCatalogEntry => Boolean(entry));
}

function toRegistryFilters(filters: MarketplacePublicCatalogFilters = {}): MarketplacePublicCatalogItemFilters {
  return {
    itemType: filters.itemType,
    limit: filters.limit,
    section: filters.section
  };
}

export async function listMarketplacePublicCatalog(
  filters: MarketplacePublicCatalogFilters = {}
): Promise<MarketplacePublicCatalogListResult> {
  const items = await listMarketplaceItemsForPublicCatalog(toRegistryFilters(filters));
  const assets = await listMarketplaceAssetsForPublicCatalog(items.map((item) => item.id));
  const entries = await buildPublicCatalogEntries(items, assets);

  return {
    entries,
    totalCount: entries.length
  };
}

export async function getMarketplacePublicCatalogEntryBySlug(
  slug: string
): Promise<MarketplacePublicCatalogEntry | null> {
  const cleanedSlug = text(slug, 160);

  if (!cleanedSlug) {
    return null;
  }

  const items = await listMarketplaceItemsForPublicCatalog({ limit: 1, slug: cleanedSlug });
  const item = items[0];

  if (!item) {
    return null;
  }

  const assets = await listMarketplaceAssetsForPublicCatalog([item.id]);
  const entries = await buildPublicCatalogEntries([item], assets);

  return entries[0] ?? null;
}

export async function getMarketplacePublicCatalogEntryByTypeAndSlug(
  itemType: MarketplaceItemType,
  slug: string
): Promise<MarketplacePublicCatalogEntry | null> {
  const entry = await getMarketplacePublicCatalogEntryBySlug(slug);

  if (!entry || entry.itemType !== itemType) {
    return null;
  }

  return entry;
}

export async function listMarketplacePublicCatalogBySection(
  section: MarketplaceSection,
  limit = 100
): Promise<MarketplacePublicCatalogListResult> {
  return listMarketplacePublicCatalog({ limit, section });
}

export async function getMarketplacePublicCatalogStats(): Promise<MarketplacePublicCatalogStats> {
  const items = await listMarketplaceItemsForPublicCatalog({ limit: 500 });

  return items.reduce<MarketplacePublicCatalogStats>(
    (stats, item) => {
      stats.totalItems += 1;

      if (item.itemType === "template") stats.templates += 1;
      if (item.itemType === "theme") stats.themes += 1;
      if (item.itemType === "plugin") stats.plugins += 1;
      if (item.itemType === "app") stats.apps += 1;
      if (item.itemType === "service") stats.services += 1;

      return stats;
    },
    {
      apps: 0,
      plugins: 0,
      services: 0,
      templates: 0,
      themes: 0,
      totalItems: 0
    }
  );
}

export function listMarketplacePublicCatalogSections() {
  return (["template_marketplace", "theme_marketplace", "plugin_marketplace", "app_marketplace", "service_marketplace"] as const).map(
    (section) => ({
      itemType: getItemTypeForSection(section),
      section,
      sectionLabel: getMarketplaceSectionLabel(section)
    })
  );
}

export function toPublicCatalogAssetViews(
  assets: MarketplaceAssetRecord[],
  item: Pick<MarketplaceItemRecord, "status" | "visibility">
): MarketplaceAssetPublicView[] {
  return filterPublicMarketplaceAssets({
    assets,
    marketplaceStatus: item.status,
    marketplaceVisibility: item.visibility
  });
}
