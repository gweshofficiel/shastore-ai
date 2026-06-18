import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidMarketplaceItemType,
  type MarketplaceItemType
} from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  parseMarketplaceCurrency,
  type MarketplaceCurrency
} from "@/src/lib/marketplace/marketplace-pricing-runtime";
import {
  parseMarketplacePurchase,
  type MarketplacePurchaseRecord
} from "@/src/lib/marketplace/marketplace-purchase-runtime";
import { listMarketplaceItemsForPublicCatalog } from "@/src/lib/marketplace/marketplace-registry";
import {
  calculateMarketplaceRevenue,
  getMarketplacePlatformFeeRate,
  MARKETPLACE_DEFAULT_PLATFORM_FEE_RATE,
  parseMarketplaceRevenueEvent,
  type MarketplaceRevenueCalculation
} from "@/src/lib/marketplace/marketplace-revenue-runtime";
import {
  calculateResellerCommissionPreview,
  parseMarketplaceResellerItem,
  type MarketplaceResellerItemRecord
} from "@/src/lib/marketplace/marketplace-reseller-runtime";
import { isPublicMarketplaceEligible } from "@/src/lib/marketplace/marketplace-visibility-runtime";

export type MarketplaceRevenueShareStatus =
  | "calculated"
  | "cancelled"
  | "locked"
  | "pending"
  | "refunded";

export type MarketplaceRevenueShareRecord = {
  createdAt: string | null;
  creatorAccountId: string | null;
  creatorShareAmount: number;
  currency: MarketplaceCurrency;
  grossAmount: number;
  id: string;
  marketplaceItemId: string;
  marketplacePurchaseId: string;
  metadata: Record<string, unknown>;
  platformShareAmount: number;
  resellerAccountId: string | null;
  resellerShareAmount: number;
  revenueEventId: string | null;
  shareStatus: MarketplaceRevenueShareStatus;
  updatedAt: string | null;
};

export type MarketplaceRevenueShareAllocation = {
  creatorAccountId: string | null;
  creatorShareAmount: number;
  currency: MarketplaceCurrency;
  grossAmount: number;
  platformFeeRate: number;
  platformShareAmount: number;
  resellerAccountId: string | null;
  resellerShareAmount: number;
  revenueFoundation: MarketplaceRevenueCalculation;
};

export type MarketplaceRevenueShareEligibility = {
  allocation: MarketplaceRevenueShareAllocation;
  eligible: boolean;
  fulfillmentVerified: boolean;
  itemId: string;
  itemKey: string;
  itemName: string;
  itemType: MarketplaceItemType;
  marketplacePurchaseId: string;
  purchaseStatus: string;
  resellerItem: MarketplaceResellerItemRecord | null;
  revenueEventId: string | null;
  verificationIssues: string[];
};

export type MarketplaceRevenueShareStats = {
  calculatedShares: number;
  cancelledShares: number;
  lockedShares: number;
  pendingShares: number;
  refundedShares: number;
  totalCreatorShareAmount: number;
  totalGrossAmount: number;
  totalPlatformShareAmount: number;
  totalResellerShareAmount: number;
  totalShares: number;
};

export const MARKETPLACE_REVENUE_SHARE_STATUSES: readonly MarketplaceRevenueShareStatus[] = [
  "pending",
  "calculated",
  "locked",
  "cancelled",
  "refunded"
] as const;

export const MARKETPLACE_REVENUE_SHARE_ACTIVE_STATUSES: readonly MarketplaceRevenueShareStatus[] = [
  "pending",
  "calculated",
  "locked"
] as const;

export const MARKETPLACE_REVENUE_SHARE_SUPPORTED_ITEM_TYPES: readonly MarketplaceItemType[] = [
  "template",
  "theme",
  "plugin",
  "app",
  "service"
] as const;

const purchaseSelect =
  "id, marketplace_item_id, buyer_account_id, creator_account_id, purchase_status, pricing_mode, amount, currency, payment_provider, external_payment_id, metadata, created_at, updated_at";

const revenueEventSelect =
  "id, marketplace_item_id, buyer_account_id, creator_account_id, pricing_mode, gross_amount, platform_fee_amount, creator_revenue_amount, net_amount, currency, revenue_status, source, external_payment_id, metadata, created_at, updated_at";

const resellerItemSelect =
  "id, reseller_account_id, marketplace_item_id, creator_account_id, reseller_status, commission_mode, commission_value, metadata, created_at, updated_at";

const revenueShareSelect =
  "id, marketplace_purchase_id, marketplace_item_id, revenue_event_id, creator_account_id, reseller_account_id, gross_amount, platform_share_amount, creator_share_amount, reseller_share_amount, currency, share_status, metadata, created_at, updated_at";

const secretKeyPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|withdrawal|withdraw|private[_-]?key)/i;

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

export function isValidMarketplaceRevenueShareStatus(
  value: unknown
): value is MarketplaceRevenueShareStatus {
  return MARKETPLACE_REVENUE_SHARE_STATUSES.includes(value as MarketplaceRevenueShareStatus);
}

export function parseMarketplaceRevenueShareStatus(
  value: unknown
): MarketplaceRevenueShareStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceRevenueShareStatus(cleaned) ? cleaned : null;
}

export function isRevenueShareSupportedMarketplaceItemType(value: unknown): value is MarketplaceItemType {
  return MARKETPLACE_REVENUE_SHARE_SUPPORTED_ITEM_TYPES.includes(value as MarketplaceItemType);
}

export function sanitizeRevenueShareMetadata(metadata: Record<string, unknown>) {
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

export function validateRevenueShareMetadata(metadata: Record<string, unknown>) {
  const serialized = JSON.stringify(metadata);

  if (secretKeyPattern.test(serialized)) {
    throw new Error(
      "Revenue share metadata must not contain secrets, payment data, payout credentials, or private keys."
    );
  }
}

export function parseMarketplaceRevenueShare(value: unknown): MarketplaceRevenueShareRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplacePurchaseId = text(row.marketplace_purchase_id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const shareStatus = parseMarketplaceRevenueShareStatus(row.share_status);
  const currency = parseMarketplaceCurrency(row.currency);
  const grossAmount = roundMoney(Math.max(0, parseNumber(row.gross_amount) ?? 0));
  const platformShareAmount = roundMoney(Math.max(0, parseNumber(row.platform_share_amount) ?? 0));
  const creatorShareAmount = roundMoney(Math.max(0, parseNumber(row.creator_share_amount) ?? 0));
  const resellerShareAmount = roundMoney(Math.max(0, parseNumber(row.reseller_share_amount) ?? 0));

  if (!id || !marketplacePurchaseId || !marketplaceItemId || !shareStatus || !currency) {
    return null;
  }

  if (platformShareAmount + creatorShareAmount + resellerShareAmount > grossAmount) {
    return null;
  }

  const metadata = sanitizeRevenueShareMetadata(safeRecord(row.metadata));

  try {
    validateRevenueShareMetadata(metadata);
  } catch {
    return null;
  }

  return {
    createdAt: text(row.created_at, 80) || null,
    creatorAccountId: text(row.creator_account_id, 120) || null,
    creatorShareAmount,
    currency,
    grossAmount,
    id,
    marketplaceItemId,
    marketplacePurchaseId,
    metadata,
    platformShareAmount,
    resellerAccountId: text(row.reseller_account_id, 120) || null,
    resellerShareAmount,
    revenueEventId: text(row.revenue_event_id, 120) || null,
    shareStatus,
    updatedAt: text(row.updated_at, 80) || null
  };
}

export function calculateMarketplaceRevenueShareAllocation(params: {
  creatorAccountId: string | null;
  grossAmount: number;
  currency: MarketplaceCurrency;
  itemMetadata: Record<string, unknown>;
  pricingMode: string;
  resellerItem: MarketplaceResellerItemRecord | null;
}): MarketplaceRevenueShareAllocation {
  const grossAmount = roundMoney(Math.max(0, params.grossAmount));
  const platformFeeRate = getMarketplacePlatformFeeRate(params.itemMetadata);

  const revenueFoundation = calculateMarketplaceRevenue(
    {
      billingInterval: null,
      currency: params.currency,
      mode: params.pricingMode as "free" | "paid" | "subscription",
      priceAmount: grossAmount,
      pricingUpdatedAt: null,
      trialDays: 0
    },
    platformFeeRate
  );

  if (grossAmount === 0 || params.pricingMode === "free") {
    return {
      creatorAccountId: params.creatorAccountId,
      creatorShareAmount: 0,
      currency: params.currency,
      grossAmount: 0,
      platformFeeRate,
      platformShareAmount: 0,
      resellerAccountId: params.resellerItem?.resellerAccountId ?? null,
      resellerShareAmount: 0,
      revenueFoundation
    };
  }

  const platformShareAmount = roundMoney(grossAmount * platformFeeRate);
  const distributableAmount = roundMoney(Math.max(0, grossAmount - platformShareAmount));

  let resellerShareAmount = 0;
  let resellerAccountId: string | null = null;

  if (params.resellerItem && params.resellerItem.resellerStatus === "active") {
    resellerAccountId = params.resellerItem.resellerAccountId;
    resellerShareAmount = calculateResellerCommissionPreview({
      commissionMode: params.resellerItem.commissionMode,
      commissionValue: params.resellerItem.commissionValue,
      revenueFoundation: {
        ...revenueFoundation,
        grossAmount
      }
    });
    resellerShareAmount = roundMoney(Math.min(resellerShareAmount, distributableAmount));
  }

  const creatorShareAmount = roundMoney(Math.max(0, distributableAmount - resellerShareAmount));

  return {
    creatorAccountId: params.creatorAccountId,
    creatorShareAmount,
    currency: params.currency,
    grossAmount,
    platformFeeRate,
    platformShareAmount,
    resellerAccountId,
    resellerShareAmount,
    revenueFoundation
  };
}

export function validateMarketplaceRevenueShareAllocation(allocation: MarketplaceRevenueShareAllocation) {
  if (allocation.grossAmount < 0) {
    throw new Error("Marketplace revenue share gross_amount cannot be negative.");
  }

  if (allocation.platformShareAmount < 0) {
    throw new Error("Marketplace revenue share platform_share_amount cannot be negative.");
  }

  if (allocation.creatorShareAmount < 0) {
    throw new Error("Marketplace revenue share creator_share_amount cannot be negative.");
  }

  if (allocation.resellerShareAmount < 0) {
    throw new Error("Marketplace revenue share reseller_share_amount cannot be negative.");
  }

  const totalShares = roundMoney(
    allocation.platformShareAmount + allocation.creatorShareAmount + allocation.resellerShareAmount
  );

  if (totalShares > allocation.grossAmount) {
    throw new Error("Marketplace revenue share totals cannot exceed gross_amount.");
  }

  if (!parseMarketplaceCurrency(allocation.currency)) {
    throw new Error("Marketplace revenue share currency is invalid.");
  }
}

export function evaluateMarketplaceRevenueShareEligibility(params: {
  allocation: MarketplaceRevenueShareAllocation;
  existingActiveShare: MarketplaceRevenueShareRecord | null;
  fulfillmentVerified: boolean;
  item: {
    creatorAccountId: string | null;
    id: string;
    itemKey: string;
    itemType: string;
    name: string;
    status: string;
    visibility: string;
  };
  purchase: MarketplacePurchaseRecord;
  resellerItem: MarketplaceResellerItemRecord | null;
  revenueEventId: string | null;
}): MarketplaceRevenueShareEligibility {
  const verificationIssues: string[] = [];

  if (params.purchase.purchaseStatus !== "paid") {
    verificationIssues.push("Marketplace purchase must be paid before calculating revenue shares.");
  }

  if (params.purchase.marketplaceItemId !== params.item.id) {
    verificationIssues.push("Marketplace purchase does not match the marketplace item.");
  }

  if (!isValidMarketplaceItemType(params.item.itemType)) {
    verificationIssues.push("Marketplace item type is invalid.");
  } else if (!isRevenueShareSupportedMarketplaceItemType(params.item.itemType)) {
    verificationIssues.push("Marketplace item type is not supported for revenue sharing.");
  }

  if (
    !isPublicMarketplaceEligible({
      status: params.item.status as "approved",
      visibility: params.item.visibility as "public"
    })
  ) {
    verificationIssues.push("Marketplace item must be approved and public for revenue sharing.");
  }

  if (roundMoney(params.purchase.amount) !== params.allocation.grossAmount) {
    verificationIssues.push("Revenue share gross_amount must match the paid marketplace purchase amount.");
  }

  if (params.purchase.currency !== params.allocation.currency) {
    verificationIssues.push("Revenue share currency must match the marketplace purchase currency.");
  }

  try {
    validateMarketplaceRevenueShareAllocation(params.allocation);
  } catch (error) {
    verificationIssues.push(
      error instanceof Error ? error.message : "Revenue share allocation validation failed."
    );
  }

  if (!params.fulfillmentVerified) {
    verificationIssues.push("Marketplace purchase fulfillment could not be verified for revenue sharing.");
  }

  if (params.existingActiveShare) {
    verificationIssues.push("An active revenue share record already exists for this marketplace purchase.");
  }

  const creatorAccountId =
    params.purchase.creatorAccountId ?? params.item.creatorAccountId ?? params.allocation.creatorAccountId;

  if (creatorAccountId && params.allocation.creatorAccountId && creatorAccountId !== params.allocation.creatorAccountId) {
    verificationIssues.push("Creator account does not match marketplace purchase creator.");
  }

  if (params.resellerItem && params.allocation.resellerShareAmount > 0) {
    if (params.resellerItem.resellerStatus !== "active") {
      verificationIssues.push("Reseller share requires an active reseller marketplace record.");
    }

    if (
      params.allocation.resellerAccountId &&
      params.resellerItem.resellerAccountId !== params.allocation.resellerAccountId
    ) {
      verificationIssues.push("Reseller account does not match active reseller marketplace record.");
    }
  }

  return {
    allocation: {
      ...params.allocation,
      creatorAccountId: creatorAccountId ?? params.allocation.creatorAccountId
    },
    eligible: verificationIssues.length === 0,
    fulfillmentVerified: params.fulfillmentVerified,
    itemId: params.item.id,
    itemKey: params.item.itemKey,
    itemName: params.item.name,
    itemType: params.item.itemType as MarketplaceItemType,
    marketplacePurchaseId: params.purchase.id,
    purchaseStatus: params.purchase.purchaseStatus,
    resellerItem: params.resellerItem,
    revenueEventId: params.revenueEventId,
    verificationIssues
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace revenue sharing runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace revenue sharing runtime.");
  }

  return admin;
}

async function loadPurchaseById(purchaseId: string) {
  const admin = requireAdminClient();
  const cleanedId = text(purchaseId, 120);

  if (!cleanedId) {
    return null;
  }

  const { data, error } = await admin
    .from("marketplace_purchases" as never)
    .select(purchaseSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace purchase could not be loaded: ${error.message}`);
  }

  return parseMarketplacePurchase(data);
}

async function loadPublicMarketplaceItem(itemId: string) {
  const items = await listMarketplaceItemsForPublicCatalog({ itemId: text(itemId, 120), limit: 1 });
  const item = items[0];

  if (!item) {
    throw new Error("Public marketplace item was not found.");
  }

  return item;
}

async function loadActiveResellerItemForMarketplaceItem(itemId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reseller_items" as never)
    .select(resellerItemSelect as never)
    .eq("marketplace_item_id" as never, text(itemId, 120) as never)
    .eq("reseller_status" as never, "active" as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Active reseller marketplace record could not be loaded: ${error.message}`);
  }

  return data ? parseMarketplaceResellerItem(data) : null;
}

async function verifyPurchaseFulfillment(params: {
  itemType: MarketplaceItemType;
  purchaseId: string;
}) {
  const admin = requireAdminClient();

  if (params.itemType === "template") {
    const { data, error } = await admin
      .from("marketplace_template_sales" as never)
      .select("id, sale_status" as never)
      .eq("marketplace_purchase_id" as never, text(params.purchaseId, 120) as never)
      .eq("sale_status" as never, "completed" as never)
      .maybeSingle();

    if (error) {
      throw new Error(`Template sale fulfillment could not be verified: ${error.message}`);
    }

    return Boolean(data);
  }

  if (params.itemType === "app" || params.itemType === "plugin") {
    const { data, error } = await admin
      .from("marketplace_app_plugin_installations" as never)
      .select("id, installation_status" as never)
      .eq("marketplace_purchase_id" as never, text(params.purchaseId, 120) as never)
      .in("installation_status" as never, ["installed", "active"] as never)
      .maybeSingle();

    if (error) {
      throw new Error(`App or plugin installation fulfillment could not be verified: ${error.message}`);
    }

    return Boolean(data);
  }

  return true;
}

async function findRevenueEventForPurchase(params: {
  purchase: MarketplacePurchaseRecord;
}) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_revenue_events" as never)
    .select(revenueEventSelect as never)
    .eq("marketplace_item_id" as never, params.purchase.marketplaceItemId as never)
    .in("revenue_status" as never, ["pending", "processed"] as never)
    .order("created_at" as never, { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Marketplace revenue event lookup failed: ${error.message}`);
  }

  const events = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceRevenueEvent(row))
    .filter((event): event is NonNullable<ReturnType<typeof parseMarketplaceRevenueEvent>> => Boolean(event));

  const byExternalPayment = params.purchase.externalPaymentId
    ? events.find((event) => event.externalPaymentId === params.purchase.externalPaymentId)
    : null;

  if (byExternalPayment) {
    return byExternalPayment.id;
  }

  const byAmount = events.find(
    (event) =>
      roundMoney(event.grossAmount) === roundMoney(params.purchase.amount) &&
      event.currency === params.purchase.currency &&
      (!params.purchase.buyerAccountId || event.buyerAccountId === params.purchase.buyerAccountId)
  );

  return byAmount?.id ?? null;
}

async function getActiveRevenueShareForPurchase(purchaseId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_revenue_shares" as never)
    .select(revenueShareSelect as never)
    .eq("marketplace_purchase_id" as never, text(purchaseId, 120) as never)
    .in("share_status" as never, [...MARKETPLACE_REVENUE_SHARE_ACTIVE_STATUSES] as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Active marketplace revenue share lookup failed: ${error.message}`);
  }

  return data ? parseMarketplaceRevenueShare(data) : null;
}

async function recordRevenueShareAudit(params: {
  eligibility: MarketplaceRevenueShareEligibility;
  note: string;
  share: MarketplaceRevenueShareRecord;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.share.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_create_revenue_share_foundation",
    metadata: {
      creator_share_amount: params.share.creatorShareAmount,
      gross_amount: params.share.grossAmount,
      item_id: params.eligibility.itemId,
      item_key: params.eligibility.itemKey,
      item_name: params.eligibility.itemName,
      item_type: params.eligibility.itemType,
      marketplace_item_id: params.share.marketplaceItemId,
      marketplace_purchase_id: params.share.marketplacePurchaseId,
      note: params.note,
      platform_fee_rate: params.eligibility.allocation.platformFeeRate,
      platform_share_amount: params.share.platformShareAmount,
      reseller_share_amount: params.share.resellerShareAmount,
      revenue_event_id: params.share.revenueEventId,
      share_status: params.share.shareStatus,
      source_runtime: "marketplace_revenue_sharing_runtime",
      verification_issues: params.eligibility.verificationIssues
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplaceRevenueShares(params: {
  creatorAccountId?: string;
  itemId?: string;
  limit?: number;
  marketplacePurchaseId?: string;
  resellerAccountId?: string;
  shareStatus?: MarketplaceRevenueShareStatus | MarketplaceRevenueShareStatus[];
} = {}): Promise<MarketplaceRevenueShareRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 2000));
  let query = admin.from("marketplace_revenue_shares" as never).select(revenueShareSelect as never);

  if (params.marketplacePurchaseId) {
    query = query.eq(
      "marketplace_purchase_id" as never,
      text(params.marketplacePurchaseId, 120) as never
    );
  }

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  if (params.creatorAccountId) {
    query = query.eq("creator_account_id" as never, text(params.creatorAccountId, 120) as never);
  }

  if (params.resellerAccountId) {
    query = query.eq("reseller_account_id" as never, text(params.resellerAccountId, 120) as never);
  }

  if (params.shareStatus) {
    const statuses = Array.isArray(params.shareStatus) ? params.shareStatus : [params.shareStatus];
    query = query.in("share_status" as never, statuses as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace revenue shares could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceRevenueShare(row))
    .filter((share): share is MarketplaceRevenueShareRecord => Boolean(share));
}

export async function getMarketplaceRevenueShareById(
  shareId: string
): Promise<MarketplaceRevenueShareRecord | null> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_revenue_shares" as never)
    .select(revenueShareSelect as never)
    .eq("id" as never, text(shareId, 120) as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace revenue share could not be loaded: ${error.message}`);
  }

  return data ? parseMarketplaceRevenueShare(data) : null;
}

export async function getMarketplaceRevenueShareByPurchaseId(
  purchaseId: string
): Promise<MarketplaceRevenueShareRecord | null> {
  const shares = await listMarketplaceRevenueShares({
    limit: 1,
    marketplacePurchaseId: purchaseId
  });

  return shares[0] ?? null;
}

export async function getMarketplaceRevenueShareStats(): Promise<MarketplaceRevenueShareStats> {
  const shares = await listMarketplaceRevenueShares({ limit: 2000 });

  return shares.reduce<MarketplaceRevenueShareStats>(
    (stats, share) => {
      stats.totalShares += 1;
      stats.totalGrossAmount = roundMoney(stats.totalGrossAmount + share.grossAmount);
      stats.totalPlatformShareAmount = roundMoney(stats.totalPlatformShareAmount + share.platformShareAmount);
      stats.totalCreatorShareAmount = roundMoney(stats.totalCreatorShareAmount + share.creatorShareAmount);
      stats.totalResellerShareAmount = roundMoney(stats.totalResellerShareAmount + share.resellerShareAmount);

      if (share.shareStatus === "pending") stats.pendingShares += 1;
      if (share.shareStatus === "calculated") stats.calculatedShares += 1;
      if (share.shareStatus === "locked") stats.lockedShares += 1;
      if (share.shareStatus === "cancelled") stats.cancelledShares += 1;
      if (share.shareStatus === "refunded") stats.refundedShares += 1;

      return stats;
    },
    {
      calculatedShares: 0,
      cancelledShares: 0,
      lockedShares: 0,
      pendingShares: 0,
      refundedShares: 0,
      totalCreatorShareAmount: 0,
      totalGrossAmount: 0,
      totalPlatformShareAmount: 0,
      totalResellerShareAmount: 0,
      totalShares: 0
    }
  );
}

export async function inspectMarketplaceRevenueShareEligibility(purchaseId: string) {
  await requireSuperAdmin();

  const purchase = await loadPurchaseById(purchaseId);

  if (!purchase) {
    throw new Error("Marketplace purchase was not found.");
  }

  const item = await loadPublicMarketplaceItem(purchase.marketplaceItemId);
  const currency = parseMarketplaceCurrency(purchase.currency);

  if (!currency) {
    throw new Error("Marketplace purchase currency is invalid.");
  }

  const resellerItem = await loadActiveResellerItemForMarketplaceItem(item.id);
  const allocation = calculateMarketplaceRevenueShareAllocation({
    creatorAccountId: purchase.creatorAccountId ?? item.creatorAccountId,
    grossAmount: purchase.amount,
    currency,
    itemMetadata: item.metadata,
    pricingMode: purchase.pricingMode,
    resellerItem
  });

  const fulfillmentVerified = await verifyPurchaseFulfillment({
    itemType: item.itemType,
    purchaseId: purchase.id
  });

  const existingActiveShare = await getActiveRevenueShareForPurchase(purchase.id);
  const revenueEventId = await findRevenueEventForPurchase({ purchase });

  return evaluateMarketplaceRevenueShareEligibility({
    allocation,
    existingActiveShare,
    fulfillmentVerified,
    item: {
      creatorAccountId: item.creatorAccountId,
      id: item.id,
      itemKey: item.itemKey,
      itemType: item.itemType,
      name: item.name,
      status: item.status,
      visibility: item.visibility
    },
    purchase,
    resellerItem,
    revenueEventId
  });
}

export async function createMarketplaceRevenueShareFromPurchase(purchaseId: string) {
  const access = await requireSuperAdmin();
  const eligibility = await inspectMarketplaceRevenueShareEligibility(purchaseId);

  if (!eligibility.eligible) {
    throw new Error(eligibility.verificationIssues[0] ?? "Marketplace revenue share eligibility failed.");
  }

  const metadata = sanitizeRevenueShareMetadata({
    default_platform_fee_rate: MARKETPLACE_DEFAULT_PLATFORM_FEE_RATE,
    foundation_only: true,
    item_key: eligibility.itemKey,
    item_name: eligibility.itemName,
    item_type: eligibility.itemType,
    payout_runtime: false,
    platform_fee_rate: eligibility.allocation.platformFeeRate,
    purchase_status: eligibility.purchaseStatus,
    revenue_sharing_execution: false,
    source_runtime: "marketplace_revenue_sharing_runtime",
    withdrawal_runtime: false
  });

  validateRevenueShareMetadata(metadata);

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_revenue_shares" as never)
    .insert({
      creator_account_id: eligibility.allocation.creatorAccountId,
      creator_share_amount: eligibility.allocation.creatorShareAmount,
      currency: eligibility.allocation.currency,
      gross_amount: eligibility.allocation.grossAmount,
      marketplace_item_id: eligibility.itemId,
      marketplace_purchase_id: eligibility.marketplacePurchaseId,
      metadata,
      platform_share_amount: eligibility.allocation.platformShareAmount,
      reseller_account_id: eligibility.allocation.resellerAccountId,
      reseller_share_amount: eligibility.allocation.resellerShareAmount,
      revenue_event_id: eligibility.revenueEventId,
      share_status: "calculated"
    } as never)
    .select(revenueShareSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace revenue share could not be created: ${error.message}`);
  }

  const share = parseMarketplaceRevenueShare(data);

  if (!share) {
    throw new Error("Created marketplace revenue share record is invalid.");
  }

  await recordRevenueShareAudit({
    eligibility,
    note: "Super Admin marketplace revenue share foundation. Allocation only. No payouts, withdrawals, or money transfer.",
    share,
    userId: access.user.id
  });

  return share;
}

export async function lockMarketplaceRevenueShareFoundation(shareId: string) {
  const access = await requireSuperAdmin();
  const share = await getMarketplaceRevenueShareById(shareId);

  if (!share) {
    throw new Error("Marketplace revenue share was not found.");
  }

  if (share.shareStatus === "locked") {
    return share;
  }

  if (share.shareStatus !== "calculated" && share.shareStatus !== "pending") {
    throw new Error("Only calculated or pending revenue shares can be locked.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_revenue_shares" as never)
    .update({ share_status: "locked" } as never)
    .eq("id" as never, share.id as never)
    .select(revenueShareSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace revenue share could not be locked: ${error.message}`);
  }

  const updated = parseMarketplaceRevenueShare(data);

  if (!updated) {
    throw new Error("Locked marketplace revenue share record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_lock_revenue_share_foundation",
    metadata: {
      marketplace_purchase_id: updated.marketplacePurchaseId,
      note: "Super Admin marketplace revenue share lock foundation. No payout execution.",
      share_status: updated.shareStatus,
      source_runtime: "marketplace_revenue_sharing_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}

export async function cancelMarketplaceRevenueShareFoundation(shareId: string) {
  const access = await requireSuperAdmin();
  const share = await getMarketplaceRevenueShareById(shareId);

  if (!share) {
    throw new Error("Marketplace revenue share was not found.");
  }

  if (share.shareStatus === "cancelled") {
    return share;
  }

  if (share.shareStatus === "refunded") {
    throw new Error("Refunded revenue shares cannot be cancelled.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_revenue_shares" as never)
    .update({ share_status: "cancelled" } as never)
    .eq("id" as never, share.id as never)
    .select(revenueShareSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace revenue share could not be cancelled: ${error.message}`);
  }

  const updated = parseMarketplaceRevenueShare(data);

  if (!updated) {
    throw new Error("Cancelled marketplace revenue share record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_cancel_revenue_share_foundation",
    metadata: {
      marketplace_purchase_id: updated.marketplacePurchaseId,
      note: "Super Admin marketplace revenue share cancellation foundation. No payout execution.",
      share_status: updated.shareStatus,
      source_runtime: "marketplace_revenue_sharing_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}

export async function refundMarketplaceRevenueShareFoundation(shareId: string) {
  const access = await requireSuperAdmin();
  const share = await getMarketplaceRevenueShareById(shareId);

  if (!share) {
    throw new Error("Marketplace revenue share was not found.");
  }

  if (share.shareStatus === "refunded") {
    return share;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_revenue_shares" as never)
    .update({ share_status: "refunded" } as never)
    .eq("id" as never, share.id as never)
    .select(revenueShareSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace revenue share could not be refunded: ${error.message}`);
  }

  const updated = parseMarketplaceRevenueShare(data);

  if (!updated) {
    throw new Error("Refunded marketplace revenue share record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_refund_revenue_share_foundation",
    metadata: {
      marketplace_purchase_id: updated.marketplacePurchaseId,
      note: "Super Admin marketplace revenue share refund foundation. Status only. No money transfer.",
      share_status: updated.shareStatus,
      source_runtime: "marketplace_revenue_sharing_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}
