import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidMarketplaceItemType, type MarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";

export type MarketplaceAssetType =
  | "demo_media"
  | "documentation"
  | "gallery_image"
  | "preview_file"
  | "thumbnail";

export type MarketplaceAssetStatus = "active" | "archived" | "draft" | "hidden";

export type MarketplaceStorageProvider = "cloudflare-r2" | "external-url" | "supabase-storage";

export type MarketplaceAssetRecord = {
  assetStatus: MarketplaceAssetStatus;
  assetType: MarketplaceAssetType;
  assetUrl: string | null;
  createdAt: string | null;
  fileName: string;
  fileSize: number;
  id: string;
  marketplaceItemId: string;
  metadata: Record<string, unknown>;
  mimeType: string;
  sortOrder: number;
  storageKey: string;
  storageProvider: MarketplaceStorageProvider;
  updatedAt: string | null;
};

export type MarketplaceAssetPublicView = {
  assetType: MarketplaceAssetType;
  assetUrl: string | null;
  fileName: string;
  fileSize: number;
  id: string;
  mimeType: string;
  sortOrder: number;
};

export type MarketplaceItemAssetsInspection = {
  activeAssetCount: number;
  assetCount: number;
  assets: Array<{
    assetStatus: MarketplaceAssetStatus;
    assetType: MarketplaceAssetType;
    fileName: string;
    fileSize: number;
    hasPublicUrl: boolean;
    id: string;
    mimeType: string;
    sortOrder: number;
    storageProvider: MarketplaceStorageProvider;
  }>;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  publicEligible: boolean;
  publicEligibleAssetCount: number;
  verificationIssues: string[];
  verified: boolean;
};

export type MarketplaceAssetStats = {
  activeAssets: number;
  archivedAssets: number;
  draftAssets: number;
  hiddenAssets: number;
  totalAssets: number;
  totalLinkedItems: number;
};

export const MARKETPLACE_ASSET_TYPES: readonly MarketplaceAssetType[] = [
  "thumbnail",
  "gallery_image",
  "preview_file",
  "documentation",
  "demo_media"
] as const;

export const MARKETPLACE_ASSET_STATUSES: readonly MarketplaceAssetStatus[] = [
  "draft",
  "active",
  "hidden",
  "archived"
] as const;

export const MARKETPLACE_STORAGE_PROVIDERS: readonly MarketplaceStorageProvider[] = [
  "supabase-storage",
  "cloudflare-r2",
  "external-url"
] as const;

const assetSelect =
  "id, marketplace_item_id, asset_type, asset_url, storage_key, storage_provider, file_name, mime_type, file_size, sort_order, asset_status, metadata, created_at, updated_at";

const marketplaceItemAssetSelect = "id, item_key, name, item_type, section, status, visibility";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rowRecord(value: unknown) {
  const candidate = value as unknown;
  return isRecord(candidate) ? candidate : null;
}

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function isValidMarketplaceAssetType(value: unknown): value is MarketplaceAssetType {
  return MARKETPLACE_ASSET_TYPES.includes(value as MarketplaceAssetType);
}

export function parseMarketplaceAssetType(value: unknown): MarketplaceAssetType | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceAssetType(cleaned) ? cleaned : null;
}

export function isValidMarketplaceAssetStatus(value: unknown): value is MarketplaceAssetStatus {
  return MARKETPLACE_ASSET_STATUSES.includes(value as MarketplaceAssetStatus);
}

export function parseMarketplaceAssetStatus(value: unknown): MarketplaceAssetStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceAssetStatus(cleaned) ? cleaned : null;
}

export function isValidMarketplaceStorageProvider(value: unknown): value is MarketplaceStorageProvider {
  return MARKETPLACE_STORAGE_PROVIDERS.includes(value as MarketplaceStorageProvider);
}

export function parseMarketplaceStorageProvider(value: unknown): MarketplaceStorageProvider | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceStorageProvider(cleaned) ? cleaned : null;
}

export function sanitizeAssetMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (secretKeyPattern.test(key)) continue;

    if (typeof value === "string" && /\bjavascript:/i.test(value)) continue;

    clean[key] = value;
  }

  clean.foundation_only = true;
  clean.purchase_runtime = false;
  clean.install_runtime = false;

  return clean;
}

export function validateAssetMetadata(metadata: Record<string, unknown>) {
  const serialized = JSON.stringify(metadata);

  if (secretKeyPattern.test(serialized)) {
    throw new Error("Asset metadata must not contain secrets or payout credentials.");
  }
}

export function parseMarketplaceAsset(value: unknown): MarketplaceAssetRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const assetType = parseMarketplaceAssetType(row.asset_type);
  const assetStatus = parseMarketplaceAssetStatus(row.asset_status);
  const storageKey = text(row.storage_key, 500);
  const storageProvider = parseMarketplaceStorageProvider(row.storage_provider) ?? "supabase-storage";
  const fileName = text(row.file_name, 240);
  const mimeType = text(row.mime_type, 120);
  const fileSize = Math.max(0, parseNumber(row.file_size) ?? 0);
  const sortOrder = Math.max(0, parseNumber(row.sort_order) ?? 0);

  if (!id || !marketplaceItemId || !assetType || !assetStatus || !storageKey || !fileName || !mimeType) {
    return null;
  }

  const metadata = sanitizeAssetMetadata(safeRecord(row.metadata));

  try {
    validateAssetMetadata(metadata);
  } catch {
    return null;
  }

  return {
    assetStatus,
    assetType,
    assetUrl: text(row.asset_url, 2000) || null,
    createdAt: text(row.created_at, 80) || null,
    fileName,
    fileSize,
    id,
    marketplaceItemId,
    metadata,
    mimeType,
    sortOrder,
    storageKey,
    storageProvider,
    updatedAt: text(row.updated_at, 80) || null
  };
}

export function isPublicMarketplaceItemEligible(marketplaceStatus: string, marketplaceVisibility: string) {
  return marketplaceStatus === "approved" && marketplaceVisibility === "public";
}

export function isPublicMarketplaceAssetEligible(params: {
  asset: MarketplaceAssetRecord;
  marketplaceStatus: string;
  marketplaceVisibility: string;
}) {
  if (!isPublicMarketplaceItemEligible(params.marketplaceStatus, params.marketplaceVisibility)) {
    return false;
  }

  return params.asset.assetStatus === "active";
}

export function toMarketplaceAssetPublicView(asset: MarketplaceAssetRecord): MarketplaceAssetPublicView | null {
  if (asset.assetStatus !== "active") return null;

  return {
    assetType: asset.assetType,
    assetUrl: asset.assetUrl,
    fileName: asset.fileName,
    fileSize: asset.fileSize,
    id: asset.id,
    mimeType: asset.mimeType,
    sortOrder: asset.sortOrder
  };
}

export function filterPublicMarketplaceAssets(params: {
  assets: MarketplaceAssetRecord[];
  marketplaceStatus: string;
  marketplaceVisibility: string;
}): MarketplaceAssetPublicView[] {
  if (!isPublicMarketplaceItemEligible(params.marketplaceStatus, params.marketplaceVisibility)) {
    return [];
  }

  return params.assets
    .filter((asset) => asset.assetStatus === "active")
    .sort((left, right) => left.sortOrder - right.sortOrder || left.fileName.localeCompare(right.fileName))
    .map((asset) => toMarketplaceAssetPublicView(asset))
    .filter((asset): asset is MarketplaceAssetPublicView => Boolean(asset));
}

export function evaluateMarketplaceItemAssetsInspection(params: {
  assets: MarketplaceAssetRecord[];
  itemType: string;
  marketplaceStatus: string;
  marketplaceVisibility: string;
}): MarketplaceItemAssetsInspection {
  const verificationIssues: string[] = [];
  const itemType = text(params.itemType, 40);

  if (itemType && !isValidMarketplaceItemType(itemType)) {
    verificationIssues.push("Marketplace item type is invalid for asset inspection.");
  }

  const sortedAssets = [...params.assets].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.fileName.localeCompare(right.fileName)
  );
  const activeAssets = sortedAssets.filter((asset) => asset.assetStatus === "active");
  const publicItemEligible = isPublicMarketplaceItemEligible(
    params.marketplaceStatus,
    params.marketplaceVisibility
  );
  const publicEligibleAssets = publicItemEligible
    ? activeAssets.filter((asset) => Boolean(asset.assetUrl) || asset.storageProvider === "external-url")
    : [];
  const publicEligible = publicItemEligible && publicEligibleAssets.length > 0;

  if (publicItemEligible && !activeAssets.length) {
    verificationIssues.push("Public approved marketplace items should include at least one active asset.");
  }

  if (publicItemEligible && activeAssets.length && !publicEligibleAssets.length) {
    verificationIssues.push("Active assets on public items must expose a safe public URL.");
  }

  for (const asset of sortedAssets) {
    if (asset.assetStatus === "active" && !asset.assetUrl && asset.storageProvider !== "external-url") {
      verificationIssues.push(`Active asset "${asset.fileName}" is missing a public asset_url.`);
    }
  }

  const hiddenOrDraftOnPublicItem =
    publicItemEligible && sortedAssets.some((asset) => asset.assetStatus === "draft" || asset.assetStatus === "hidden");

  if (hiddenOrDraftOnPublicItem) {
    verificationIssues.push("Draft or hidden assets remain registered on a public marketplace item.");
  }

  return {
    activeAssetCount: activeAssets.length,
    assetCount: sortedAssets.length,
    assets: sortedAssets.map((asset) => ({
      assetStatus: asset.assetStatus,
      assetType: asset.assetType,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      hasPublicUrl: Boolean(asset.assetUrl),
      id: asset.id,
      mimeType: asset.mimeType,
      sortOrder: asset.sortOrder,
      storageProvider: asset.storageProvider
    })),
    marketplaceStatus: params.marketplaceStatus,
    marketplaceVisibility: params.marketplaceVisibility,
    publicEligible,
    publicEligibleAssetCount: publicEligibleAssets.length,
    verificationIssues,
    verified: verificationIssues.length === 0
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace asset runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace asset runtime.");
  }

  return admin;
}

async function loadMarketplaceItemForAsset(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(marketplaceItemAssetSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace item could not be loaded for asset registration: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace item record is invalid.");
  }

  const id = text(row.id, 120);
  const itemType = text(row.item_type, 40);

  if (!id || !isValidMarketplaceItemType(itemType)) {
    throw new Error("Marketplace item type is invalid for asset registration.");
  }

  return {
    id,
    itemKey: text(row.item_key, 160),
    itemType: itemType as MarketplaceItemType,
    marketplaceStatus: text(row.status, 40) || "draft",
    marketplaceVisibility: text(row.visibility, 40) || "private",
    name: text(row.name, 240),
    section: text(row.section, 60)
  };
}

async function recordMarketplaceAssetAudit(params: {
  asset: MarketplaceAssetRecord;
  inspection: MarketplaceItemAssetsInspection;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.asset.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_verify_item_asset",
    metadata: {
      asset_status: params.asset.assetStatus,
      asset_type: params.asset.assetType,
      marketplace_item_id: params.asset.marketplaceItemId,
      note: "Super Admin marketplace asset verification. No purchases, installs, or payouts.",
      public_eligible: params.inspection.publicEligible,
      source_runtime: "marketplace_asset_runtime",
      storage_provider: params.asset.storageProvider,
      verification_issues: params.inspection.verificationIssues,
      verified: params.inspection.verified
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplaceAssets(params: {
  itemId?: string;
  limit?: number;
  assetStatus?: MarketplaceAssetStatus | MarketplaceAssetStatus[];
  assetType?: MarketplaceAssetType | MarketplaceAssetType[];
} = {}): Promise<MarketplaceAssetRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 5000));
  let query = admin.from("marketplace_assets" as never).select(assetSelect as never);

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  if (params.assetStatus) {
    const statuses = Array.isArray(params.assetStatus) ? params.assetStatus : [params.assetStatus];
    query = query.in("asset_status" as never, statuses as never);
  }

  if (params.assetType) {
    const types = Array.isArray(params.assetType) ? params.assetType : [params.assetType];
    query = query.in("asset_type" as never, types as never);
  }

  const { data, error } = await query
    .order("sort_order" as never, { ascending: true })
    .order("created_at" as never, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Marketplace assets could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceAsset(row))
    .filter((asset): asset is MarketplaceAssetRecord => Boolean(asset));
}

export async function getMarketplaceAssetById(assetId: string): Promise<MarketplaceAssetRecord | null> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const cleanedId = text(assetId, 120);

  if (!cleanedId) return null;

  const { data, error } = await admin
    .from("marketplace_assets" as never)
    .select(assetSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace asset could not be loaded: ${error.message}`);
  }

  return parseMarketplaceAsset(data);
}

export async function getMarketplaceAssetsForItem(itemId: string): Promise<MarketplaceAssetRecord[]> {
  return listMarketplaceAssets({ itemId, limit: 1000 });
}

export async function getMarketplaceAssetStats(): Promise<MarketplaceAssetStats> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const assets = await listMarketplaceAssets({ limit: 5000 });
  const { data: items, error } = await admin
    .from("marketplace_assets" as never)
    .select("marketplace_item_id" as never);

  if (error) {
    throw new Error(`Marketplace asset-linked items could not be counted: ${error.message}`);
  }

  const linkedItemIds = new Set(
    (Array.isArray(items) ? (items as unknown[]) : [])
      .map((row) => text(rowRecord(row)?.marketplace_item_id, 120))
      .filter(Boolean)
  );

  return assets.reduce<MarketplaceAssetStats>(
    (stats, asset) => {
      if (asset.assetStatus === "active") stats.activeAssets += 1;
      if (asset.assetStatus === "draft") stats.draftAssets += 1;
      if (asset.assetStatus === "hidden") stats.hiddenAssets += 1;
      if (asset.assetStatus === "archived") stats.archivedAssets += 1;
      return stats;
    },
    {
      activeAssets: 0,
      archivedAssets: 0,
      draftAssets: 0,
      hiddenAssets: 0,
      totalAssets: assets.length,
      totalLinkedItems: linkedItemIds.size
    }
  );
}

export type RegisterMarketplaceAssetInput = {
  assetStatus?: MarketplaceAssetStatus;
  assetType: MarketplaceAssetType;
  assetUrl?: string | null;
  fileName: string;
  fileSize?: number;
  marketplaceItemId: string;
  metadata?: Record<string, unknown>;
  mimeType: string;
  sortOrder?: number;
  storageKey: string;
  storageProvider?: MarketplaceStorageProvider;
};

export async function registerMarketplaceAsset(input: RegisterMarketplaceAssetInput) {
  const access = await requireSuperAdmin();
  await loadMarketplaceItemForAsset(input.marketplaceItemId);

  const assetType = parseMarketplaceAssetType(input.assetType);
  const assetStatus = parseMarketplaceAssetStatus(input.assetStatus ?? "draft") ?? "draft";
  const storageProvider = parseMarketplaceStorageProvider(input.storageProvider ?? "supabase-storage") ?? "supabase-storage";
  const storageKey = text(input.storageKey, 500);
  const fileName = text(input.fileName, 240);
  const mimeType = text(input.mimeType, 120);
  const assetUrl = text(input.assetUrl, 2000) || null;
  const metadata = sanitizeAssetMetadata(safeRecord(input.metadata));

  if (!assetType) {
    throw new Error("Marketplace asset type is invalid.");
  }

  if (!storageKey) {
    throw new Error("Marketplace asset storage_key is required.");
  }

  if (!fileName || !mimeType) {
    throw new Error("Marketplace asset file metadata is invalid.");
  }

  validateAssetMetadata(metadata);

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_assets" as never)
    .insert({
      asset_status: assetStatus,
      asset_type: assetType,
      asset_url: assetUrl,
      file_name: fileName,
      file_size: Math.max(0, input.fileSize ?? 0),
      marketplace_item_id: text(input.marketplaceItemId, 120),
      metadata,
      mime_type: mimeType,
      sort_order: Math.max(0, input.sortOrder ?? 0),
      storage_key: storageKey,
      storage_provider: storageProvider
    } as never)
    .select(assetSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace asset could not be registered: ${error.message}`);
  }

  const asset = parseMarketplaceAsset(data);

  if (!asset) {
    throw new Error("Registered marketplace asset is invalid.");
  }

  const item = await loadMarketplaceItemForAsset(asset.marketplaceItemId);
  const inspection = evaluateMarketplaceItemAssetsInspection({
    assets: [asset],
    itemType: item.itemType,
    marketplaceStatus: item.marketplaceStatus,
    marketplaceVisibility: item.marketplaceVisibility
  });

  await recordMarketplaceAssetAudit({
    asset,
    inspection,
    userId: access.user.id
  });

  return asset;
}

export async function verifyMarketplaceItemAssets(itemId: string) {
  const access = await requireSuperAdmin();
  const item = await loadMarketplaceItemForAsset(itemId);
  const assets = await getMarketplaceAssetsForItem(itemId);
  const inspection = evaluateMarketplaceItemAssetsInspection({
    assets,
    itemType: item.itemType,
    marketplaceStatus: item.marketplaceStatus,
    marketplaceVisibility: item.marketplaceVisibility
  });

  if (assets[0]) {
    await recordMarketplaceAssetAudit({
      asset: assets[0],
      inspection,
      userId: access.user.id
    });
  }

  return inspection;
}
