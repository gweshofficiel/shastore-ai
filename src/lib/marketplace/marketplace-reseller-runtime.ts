import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseMarketplaceCreatorAccount,
  type MarketplaceCreatorAccountRecord
} from "@/src/lib/marketplace/marketplace-creator-runtime";
import {
  isValidMarketplaceItemType,
  type MarketplaceItemType
} from "@/src/lib/marketplace/marketplace-item-type-runtime";
import { listMarketplaceItemsForPublicCatalog } from "@/src/lib/marketplace/marketplace-registry";
import {
  calculateMarketplaceRevenue,
  getMarketplacePlatformFeeRate,
  type MarketplaceRevenueCalculation
} from "@/src/lib/marketplace/marketplace-revenue-runtime";
import { isPublicMarketplaceEligible } from "@/src/lib/marketplace/marketplace-visibility-runtime";

export type MarketplaceResellerStatus = "active" | "archived" | "draft" | "suspended";

export type MarketplaceResellerCommissionMode = "fixed" | "percentage";

export type MarketplaceResellerItemRecord = {
  commissionMode: MarketplaceResellerCommissionMode;
  commissionValue: number;
  createdAt: string | null;
  creatorAccountId: string | null;
  id: string;
  marketplaceItemId: string;
  metadata: Record<string, unknown>;
  resellerAccountId: string;
  resellerStatus: MarketplaceResellerStatus;
  updatedAt: string | null;
};

export type MarketplaceResellerItemEligibility = {
  commissionMode: MarketplaceResellerCommissionMode;
  commissionPreviewAmount: number;
  commissionValue: number;
  creatorAccountId: string | null;
  eligible: boolean;
  itemId: string;
  itemKey: string;
  itemName: string;
  itemType: MarketplaceItemType;
  marketplaceItemId: string;
  resellerAccountId: string;
  resellerDisplayName: string | null;
  resellerStatus: MarketplaceResellerStatus;
  revenueFoundation: MarketplaceRevenueCalculation;
  verificationIssues: string[];
};

export type MarketplaceResellerItemStats = {
  activeResellerItems: number;
  archivedResellerItems: number;
  draftResellerItems: number;
  fixedCommissionItems: number;
  percentageCommissionItems: number;
  suspendedResellerItems: number;
  totalResellerItems: number;
};

export type CreateMarketplaceResellerItemFoundationInput = {
  commissionMode: MarketplaceResellerCommissionMode;
  commissionValue: number;
  marketplaceItemId: string;
  metadata?: Record<string, unknown>;
  resellerAccountId: string;
  resellerStatus?: Extract<MarketplaceResellerStatus, "active" | "draft">;
};

export const MARKETPLACE_RESELLER_STATUSES: readonly MarketplaceResellerStatus[] = [
  "draft",
  "active",
  "suspended",
  "archived"
] as const;

export const MARKETPLACE_RESELLER_COMMISSION_MODES: readonly MarketplaceResellerCommissionMode[] = [
  "percentage",
  "fixed"
] as const;

export const MARKETPLACE_RESELLER_SUPPORTED_ITEM_TYPES: readonly MarketplaceItemType[] = [
  "template",
  "theme",
  "plugin",
  "app",
  "service"
] as const;

const creatorSelect =
  "id, account_id, user_id, display_name, public_slug, creator_type, creator_status, verification_status, bio, website_url, support_email, metadata, created_at, updated_at";

const resellerItemSelect =
  "id, reseller_account_id, marketplace_item_id, creator_account_id, reseller_status, commission_mode, commission_value, metadata, created_at, updated_at";

const secretKeyPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|withdrawal|withdraw)/i;

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

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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

export function isValidMarketplaceResellerStatus(value: unknown): value is MarketplaceResellerStatus {
  return MARKETPLACE_RESELLER_STATUSES.includes(value as MarketplaceResellerStatus);
}

export function isValidMarketplaceResellerCommissionMode(
  value: unknown
): value is MarketplaceResellerCommissionMode {
  return MARKETPLACE_RESELLER_COMMISSION_MODES.includes(value as MarketplaceResellerCommissionMode);
}

export function parseMarketplaceResellerStatus(value: unknown): MarketplaceResellerStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceResellerStatus(cleaned) ? cleaned : null;
}

export function parseMarketplaceResellerCommissionMode(
  value: unknown
): MarketplaceResellerCommissionMode | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceResellerCommissionMode(cleaned) ? cleaned : null;
}

export function isResellerSupportedMarketplaceItemType(value: unknown): value is MarketplaceItemType {
  return MARKETPLACE_RESELLER_SUPPORTED_ITEM_TYPES.includes(value as MarketplaceItemType);
}

export function sanitizeResellerMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (secretKeyPattern.test(key)) continue;

    if (typeof value === "string" && /\bjavascript:/i.test(value)) continue;

    clean[key] = value;
  }

  clean.foundation_only = true;
  clean.payout_runtime = false;
  clean.revenue_sharing_execution = false;
  clean.withdrawal_runtime = false;

  return clean;
}

export function validateResellerMetadata(metadata: Record<string, unknown>) {
  const serialized = JSON.stringify(metadata);

  if (secretKeyPattern.test(serialized)) {
    throw new Error(
      "Reseller metadata must not contain secrets, payment data, payout credentials, or withdrawal information."
    );
  }
}

export function parseMarketplaceResellerItem(value: unknown): MarketplaceResellerItemRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const resellerAccountId = text(row.reseller_account_id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const resellerStatus = parseMarketplaceResellerStatus(row.reseller_status);
  const commissionMode = parseMarketplaceResellerCommissionMode(row.commission_mode);
  const commissionValue = roundMoney(Math.max(0, parseNumber(row.commission_value) ?? 0));

  if (!id || !resellerAccountId || !marketplaceItemId || !resellerStatus || !commissionMode) {
    return null;
  }

  if (commissionMode === "percentage" && commissionValue > 100) {
    return null;
  }

  const metadata = sanitizeResellerMetadata(safeRecord(row.metadata));

  try {
    validateResellerMetadata(metadata);
  } catch {
    return null;
  }

  return {
    commissionMode,
    commissionValue,
    createdAt: text(row.created_at, 80) || null,
    creatorAccountId: text(row.creator_account_id, 120) || null,
    id,
    marketplaceItemId,
    metadata,
    resellerAccountId,
    resellerStatus,
    updatedAt: text(row.updated_at, 80) || null
  };
}

export function calculateResellerCommissionPreview(params: {
  commissionMode: MarketplaceResellerCommissionMode;
  commissionValue: number;
  revenueFoundation: MarketplaceRevenueCalculation;
}) {
  const commissionValue = roundMoney(Math.max(0, params.commissionValue));

  if (params.commissionMode === "percentage") {
    return roundMoney(params.revenueFoundation.grossAmount * (commissionValue / 100));
  }

  return commissionValue;
}

export function evaluateMarketplaceResellerItemEligibility(params: {
  commissionMode: MarketplaceResellerCommissionMode;
  commissionValue: number;
  creatorAccount: MarketplaceCreatorAccountRecord | null;
  existingActiveResellerItem: MarketplaceResellerItemRecord | null;
  item: {
    creatorAccountId: string | null;
    id: string;
    itemKey: string;
    itemType: string;
    metadata: Record<string, unknown>;
    name: string;
    pricing: {
      currency: string | null;
      mode: string;
      priceAmount: number;
    };
    status: string;
    visibility: string;
  };
  resellerAccount: MarketplaceCreatorAccountRecord | null;
  resellerStatus: MarketplaceResellerStatus;
}): MarketplaceResellerItemEligibility {
  const verificationIssues: string[] = [];

  if (!params.resellerAccount) {
    verificationIssues.push("Reseller account was not found.");
  } else {
    if (params.resellerStatus === "active" && params.resellerAccount.creatorStatus !== "active") {
      verificationIssues.push("Active reseller items require an active reseller account.");
    }

    if (params.resellerStatus === "active" && params.resellerAccount.creatorStatus === "suspended") {
      verificationIssues.push("Suspended reseller accounts cannot hold active reseller items.");
    }

    if (params.resellerStatus === "active" && params.resellerAccount.creatorStatus === "archived") {
      verificationIssues.push("Archived reseller accounts cannot hold active reseller items.");
    }

    if (params.resellerStatus === "draft" && params.resellerAccount.creatorStatus === "archived") {
      verificationIssues.push("Archived reseller accounts cannot hold reseller items.");
    }
  }

  if (!isValidMarketplaceItemType(params.item.itemType)) {
    verificationIssues.push("Marketplace item type is invalid.");
  } else if (!isResellerSupportedMarketplaceItemType(params.item.itemType)) {
    verificationIssues.push("Marketplace item type is not supported for reseller foundation.");
  }

  if (
    !isPublicMarketplaceEligible({
      status: params.item.status as "approved",
      visibility: params.item.visibility as "public"
    })
  ) {
    verificationIssues.push("Marketplace item must be approved and public for reseller foundation.");
  }

  if (params.item.creatorAccountId) {
    if (!params.creatorAccount) {
      verificationIssues.push("Linked creator account could not be validated.");
    } else if (params.creatorAccount.creatorStatus === "archived") {
      verificationIssues.push("Archived creator accounts cannot back reseller marketplace items.");
    }
  }

  if (!isValidMarketplaceResellerStatus(params.resellerStatus)) {
    verificationIssues.push("Reseller status is invalid.");
  }

  if (!isValidMarketplaceResellerCommissionMode(params.commissionMode)) {
    verificationIssues.push("Commission mode is invalid.");
  }

  const commissionValue = roundMoney(Math.max(0, params.commissionValue));

  if (commissionValue < 0) {
    verificationIssues.push("Commission value cannot be negative.");
  }

  if (params.commissionMode === "percentage" && commissionValue > 100) {
    verificationIssues.push("Percentage commission cannot exceed 100.");
  }

  if (params.existingActiveResellerItem) {
    verificationIssues.push("An active reseller record already exists for this reseller and marketplace item.");
  }

  const revenueFoundation = calculateMarketplaceRevenue(
    {
      billingInterval: null,
      currency: params.item.pricing.currency as "EUR" | "MAD" | "USD" | null,
      mode: params.item.pricing.mode as "free" | "paid" | "subscription",
      priceAmount: params.item.pricing.priceAmount,
      pricingUpdatedAt: null,
      trialDays: 0
    },
    getMarketplacePlatformFeeRate(params.item.metadata)
  );

  const commissionPreviewAmount = calculateResellerCommissionPreview({
    commissionMode: params.commissionMode,
    commissionValue,
    revenueFoundation
  });

  if (
    params.resellerAccount &&
    params.item.creatorAccountId &&
    params.resellerAccount.id === params.item.creatorAccountId &&
    params.resellerStatus === "active"
  ) {
    verificationIssues.push("Reseller account cannot be the same as the item creator for active reseller records.");
  }

  return {
    commissionMode: params.commissionMode,
    commissionPreviewAmount,
    commissionValue,
    creatorAccountId: params.item.creatorAccountId,
    eligible: verificationIssues.length === 0,
    itemId: params.item.id,
    itemKey: params.item.itemKey,
    itemName: params.item.name,
    itemType: params.item.itemType as MarketplaceItemType,
    marketplaceItemId: params.item.id,
    resellerAccountId: params.resellerAccount?.id ?? "",
    resellerDisplayName: params.resellerAccount?.displayName ?? null,
    resellerStatus: params.resellerStatus,
    revenueFoundation,
    verificationIssues
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace reseller runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace reseller runtime.");
  }

  return admin;
}

async function loadCreatorAccountById(creatorAccountId: string) {
  const admin = requireAdminClient();
  const cleanedId = text(creatorAccountId, 120);

  if (!cleanedId) {
    return null;
  }

  const { data, error } = await admin
    .from("marketplace_creator_accounts" as never)
    .select(creatorSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace creator account could not be loaded: ${error.message}`);
  }

  return parseMarketplaceCreatorAccount(data);
}

async function loadPublicMarketplaceItem(itemId: string) {
  const items = await listMarketplaceItemsForPublicCatalog({ itemId: text(itemId, 120), limit: 1 });
  const item = items[0];

  if (!item) {
    throw new Error("Public marketplace item was not found.");
  }

  return item;
}

async function getActiveResellerItemForPair(params: { itemId: string; resellerAccountId: string }) {
  const items = await listMarketplaceResellerItems({
    itemId: params.itemId,
    limit: 1,
    resellerAccountId: params.resellerAccountId,
    resellerStatus: "active"
  });

  return items[0] ?? null;
}

async function recordResellerItemAudit(params: {
  eligibility: MarketplaceResellerItemEligibility;
  note: string;
  record: MarketplaceResellerItemRecord;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.record.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_create_reseller_item_foundation",
    metadata: {
      commission_mode: params.record.commissionMode,
      commission_preview_amount: params.eligibility.commissionPreviewAmount,
      commission_value: params.record.commissionValue,
      creator_account_id: params.record.creatorAccountId,
      item_id: params.eligibility.itemId,
      item_key: params.eligibility.itemKey,
      item_name: params.eligibility.itemName,
      item_type: params.eligibility.itemType,
      marketplace_item_id: params.record.marketplaceItemId,
      note: params.note,
      reseller_account_id: params.record.resellerAccountId,
      reseller_display_name: params.eligibility.resellerDisplayName,
      reseller_status: params.record.resellerStatus,
      revenue_foundation_gross: params.eligibility.revenueFoundation.grossAmount,
      source_runtime: "marketplace_reseller_runtime",
      verification_issues: params.eligibility.verificationIssues
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplaceResellerItems(params: {
  creatorAccountId?: string;
  itemId?: string;
  limit?: number;
  resellerAccountId?: string;
  resellerStatus?: MarketplaceResellerStatus | MarketplaceResellerStatus[];
} = {}): Promise<MarketplaceResellerItemRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 2000));
  let query = admin.from("marketplace_reseller_items" as never).select(resellerItemSelect as never);

  if (params.resellerAccountId) {
    query = query.eq("reseller_account_id" as never, text(params.resellerAccountId, 120) as never);
  }

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  if (params.creatorAccountId) {
    query = query.eq("creator_account_id" as never, text(params.creatorAccountId, 120) as never);
  }

  if (params.resellerStatus) {
    const statuses = Array.isArray(params.resellerStatus) ? params.resellerStatus : [params.resellerStatus];
    query = query.in("reseller_status" as never, statuses as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace reseller items could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceResellerItem(row))
    .filter((record): record is MarketplaceResellerItemRecord => Boolean(record));
}

export async function getMarketplaceResellerItemById(
  resellerItemId: string
): Promise<MarketplaceResellerItemRecord | null> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reseller_items" as never)
    .select(resellerItemSelect as never)
    .eq("id" as never, text(resellerItemId, 120) as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace reseller item could not be loaded: ${error.message}`);
  }

  return data ? parseMarketplaceResellerItem(data) : null;
}

export async function getMarketplaceResellerItemStats(): Promise<MarketplaceResellerItemStats> {
  const items = await listMarketplaceResellerItems({ limit: 2000 });

  return items.reduce<MarketplaceResellerItemStats>(
    (stats, item) => {
      stats.totalResellerItems += 1;

      if (item.resellerStatus === "active") stats.activeResellerItems += 1;
      if (item.resellerStatus === "draft") stats.draftResellerItems += 1;
      if (item.resellerStatus === "suspended") stats.suspendedResellerItems += 1;
      if (item.resellerStatus === "archived") stats.archivedResellerItems += 1;
      if (item.commissionMode === "percentage") stats.percentageCommissionItems += 1;
      if (item.commissionMode === "fixed") stats.fixedCommissionItems += 1;

      return stats;
    },
    {
      activeResellerItems: 0,
      archivedResellerItems: 0,
      draftResellerItems: 0,
      fixedCommissionItems: 0,
      percentageCommissionItems: 0,
      suspendedResellerItems: 0,
      totalResellerItems: 0
    }
  );
}

export async function inspectMarketplaceResellerItemEligibility(
  input: CreateMarketplaceResellerItemFoundationInput
) {
  await requireSuperAdmin();

  const commissionMode = parseMarketplaceResellerCommissionMode(input.commissionMode);
  const resellerStatus = parseMarketplaceResellerStatus(input.resellerStatus ?? "draft") ?? "draft";

  if (!commissionMode) {
    throw new Error("Commission mode is invalid.");
  }

  if (resellerStatus !== "draft" && resellerStatus !== "active") {
    throw new Error("Reseller foundation records can only be created as draft or active.");
  }

  const resellerAccount = await loadCreatorAccountById(input.resellerAccountId);
  const item = await loadPublicMarketplaceItem(input.marketplaceItemId);
  const creatorAccount = item.creatorAccountId
    ? await loadCreatorAccountById(item.creatorAccountId)
    : null;
  const existingActiveResellerItem =
    resellerStatus === "active" && resellerAccount
      ? await getActiveResellerItemForPair({
          itemId: item.id,
          resellerAccountId: resellerAccount.id
        })
      : null;

  return evaluateMarketplaceResellerItemEligibility({
    commissionMode,
    commissionValue: input.commissionValue,
    creatorAccount,
    existingActiveResellerItem,
    item: {
      creatorAccountId: item.creatorAccountId,
      id: item.id,
      itemKey: item.itemKey,
      itemType: item.itemType,
      metadata: item.metadata,
      name: item.name,
      pricing: {
        currency: item.pricing.currency,
        mode: item.pricing.mode,
        priceAmount: item.pricing.priceAmount
      },
      status: item.status,
      visibility: item.visibility
    },
    resellerAccount,
    resellerStatus
  });
}

export async function createMarketplaceResellerItemFoundation(
  input: CreateMarketplaceResellerItemFoundationInput
) {
  const access = await requireSuperAdmin();
  const eligibility = await inspectMarketplaceResellerItemEligibility(input);

  if (!eligibility.eligible) {
    throw new Error(eligibility.verificationIssues[0] ?? "Marketplace reseller item eligibility failed.");
  }

  const metadata = sanitizeResellerMetadata({
    commission_preview_amount: eligibility.commissionPreviewAmount,
    foundation_only: true,
    item_key: eligibility.itemKey,
    item_name: eligibility.itemName,
    item_type: eligibility.itemType,
    payout_runtime: false,
    reseller_display_name: eligibility.resellerDisplayName,
    revenue_foundation_gross: eligibility.revenueFoundation.grossAmount,
    revenue_sharing_execution: false,
    source_runtime: "marketplace_reseller_runtime",
    withdrawal_runtime: false,
    ...safeRecord(input.metadata)
  });

  validateResellerMetadata(metadata);

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reseller_items" as never)
    .insert({
      commission_mode: eligibility.commissionMode,
      commission_value: eligibility.commissionValue,
      creator_account_id: eligibility.creatorAccountId,
      marketplace_item_id: eligibility.marketplaceItemId,
      metadata,
      reseller_account_id: eligibility.resellerAccountId,
      reseller_status: eligibility.resellerStatus
    } as never)
    .select(resellerItemSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace reseller item could not be created: ${error.message}`);
  }

  const record = parseMarketplaceResellerItem(data);

  if (!record) {
    throw new Error("Created marketplace reseller item record is invalid.");
  }

  await recordResellerItemAudit({
    eligibility,
    note: "Super Admin marketplace reseller foundation. No payouts, revenue sharing execution, or withdrawals.",
    record,
    userId: access.user.id
  });

  return record;
}

export async function suspendMarketplaceResellerItemFoundation(resellerItemId: string) {
  const access = await requireSuperAdmin();
  const record = await getMarketplaceResellerItemById(resellerItemId);

  if (!record) {
    throw new Error("Marketplace reseller item was not found.");
  }

  if (record.resellerStatus === "archived") {
    throw new Error("Archived reseller items cannot be suspended.");
  }

  if (record.resellerStatus === "suspended") {
    return record;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reseller_items" as never)
    .update({ reseller_status: "suspended" } as never)
    .eq("id" as never, record.id as never)
    .select(resellerItemSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace reseller item could not be suspended: ${error.message}`);
  }

  const updated = parseMarketplaceResellerItem(data);

  if (!updated) {
    throw new Error("Suspended marketplace reseller item record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_suspend_reseller_item_foundation",
    metadata: {
      marketplace_item_id: updated.marketplaceItemId,
      note: "Super Admin marketplace reseller suspension foundation. No payouts or withdrawals.",
      reseller_account_id: updated.resellerAccountId,
      reseller_status: updated.resellerStatus,
      source_runtime: "marketplace_reseller_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}

export async function archiveMarketplaceResellerItemFoundation(resellerItemId: string) {
  const access = await requireSuperAdmin();
  const record = await getMarketplaceResellerItemById(resellerItemId);

  if (!record) {
    throw new Error("Marketplace reseller item was not found.");
  }

  if (record.resellerStatus === "archived") {
    return record;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reseller_items" as never)
    .update({ reseller_status: "archived" } as never)
    .eq("id" as never, record.id as never)
    .select(resellerItemSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace reseller item could not be archived: ${error.message}`);
  }

  const updated = parseMarketplaceResellerItem(data);

  if (!updated) {
    throw new Error("Archived marketplace reseller item record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_archive_reseller_item_foundation",
    metadata: {
      marketplace_item_id: updated.marketplaceItemId,
      note: "Super Admin marketplace reseller archive foundation. No payouts or withdrawals.",
      reseller_account_id: updated.resellerAccountId,
      reseller_status: updated.resellerStatus,
      source_runtime: "marketplace_reseller_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}
