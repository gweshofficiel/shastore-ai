import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidMarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  parseMarketplaceCurrency,
  parseMarketplacePricingRecord,
  type MarketplaceCurrency,
  type MarketplacePricingMode,
  type MarketplacePricingRecord
} from "@/src/lib/marketplace/marketplace-pricing-runtime";

export type MarketplaceRevenueStatus =
  | "cancelled"
  | "failed"
  | "pending"
  | "processed"
  | "refunded";

export type MarketplaceRevenueSource =
  | "marketplace_purchase_foundation"
  | "marketplace_revenue_runtime"
  | "marketplace_subscription_foundation";

export type MarketplaceRevenueCalculation = {
  creatorRevenueAmount: number;
  currency: MarketplaceCurrency;
  grossAmount: number;
  netAmount: number;
  platformFeeAmount: number;
  platformFeeRate: number;
  pricingMode: MarketplacePricingMode;
};

export type MarketplaceRevenueEventRecord = {
  buyerAccountId: string | null;
  createdAt: string | null;
  creatorAccountId: string | null;
  creatorRevenueAmount: number;
  currency: MarketplaceCurrency;
  externalPaymentId: string | null;
  grossAmount: number;
  id: string;
  marketplaceItemId: string;
  metadata: Record<string, unknown>;
  netAmount: number;
  platformFeeAmount: number;
  pricingMode: MarketplacePricingMode;
  revenueStatus: MarketplaceRevenueStatus;
  source: string;
  updatedAt: string | null;
};

export type MarketplaceRevenueEventInput = {
  buyerAccountId?: string | null;
  creatorAccountId?: string | null;
  externalPaymentId?: string | null;
  metadata?: Record<string, unknown>;
  revenueStatus?: MarketplaceRevenueStatus;
  source?: MarketplaceRevenueSource | string;
};

export type MarketplaceRevenueStats = {
  cancelledEvents: number;
  failedEvents: number;
  pendingEvents: number;
  processedEvents: number;
  refundedEvents: number;
  totalCreatorRevenueProcessed: number;
  totalGrossProcessed: number;
  totalPlatformFeesProcessed: number;
};

export type MarketplaceItemRevenueSummary = {
  calculated: MarketplaceRevenueCalculation;
  eventCount: number;
  processedEventCount: number;
  recentEvents: MarketplaceRevenueEventRecord[];
  recordedAmount: number;
  recordedCurrency: MarketplaceCurrency | null;
};

export const MARKETPLACE_REVENUE_STATUSES: readonly MarketplaceRevenueStatus[] = [
  "pending",
  "processed",
  "failed",
  "refunded",
  "cancelled"
] as const;

/** Safe default marketplace platform fee (15%). Not a secret; isolated from subscription billing. */
export const MARKETPLACE_DEFAULT_PLATFORM_FEE_RATE = 0.15;

const revenueEventSelect =
  "id, marketplace_item_id, buyer_account_id, creator_account_id, pricing_mode, gross_amount, platform_fee_amount, creator_revenue_amount, net_amount, currency, revenue_status, source, external_payment_id, metadata, created_at, updated_at";

const itemPricingSelect =
  "id, item_key, name, item_type, metadata, pricing_mode, pricing_type, price_amount, currency, billing_interval, trial_days, pricing_updated_at, revenue_amount, revenue_currency";

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

export function isValidMarketplaceRevenueStatus(value: unknown): value is MarketplaceRevenueStatus {
  return MARKETPLACE_REVENUE_STATUSES.includes(value as MarketplaceRevenueStatus);
}

export function parseMarketplaceRevenueStatus(value: unknown): MarketplaceRevenueStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceRevenueStatus(cleaned) ? cleaned : null;
}

export function getMarketplacePlatformFeeRate(metadata?: Record<string, unknown>) {
  const configured = parseNumber(metadata?.marketplace_platform_fee_rate);

  if (configured !== null && configured >= 0 && configured <= 1) {
    return configured;
  }

  return MARKETPLACE_DEFAULT_PLATFORM_FEE_RATE;
}

export function calculateMarketplaceRevenue(
  pricing: MarketplacePricingRecord,
  platformFeeRate = MARKETPLACE_DEFAULT_PLATFORM_FEE_RATE
): MarketplaceRevenueCalculation {
  const currency = pricing.currency ?? "USD";
  const feeRate = Math.max(0, Math.min(platformFeeRate, 1));

  if (pricing.mode === "free") {
    return {
      creatorRevenueAmount: 0,
      currency,
      grossAmount: 0,
      netAmount: 0,
      platformFeeAmount: 0,
      platformFeeRate: feeRate,
      pricingMode: "free"
    };
  }

  const grossAmount = roundMoney(Math.max(0, pricing.priceAmount));
  const platformFeeAmount = roundMoney(grossAmount * feeRate);
  const creatorRevenueAmount = roundMoney(grossAmount - platformFeeAmount);

  return {
    creatorRevenueAmount,
    currency,
    grossAmount,
    netAmount: creatorRevenueAmount,
    platformFeeAmount,
    platformFeeRate: feeRate,
    pricingMode: pricing.mode
  };
}

export function validateMarketplaceRevenueCalculation(
  calculation: MarketplaceRevenueCalculation,
  expectedCurrency?: MarketplaceCurrency | null
) {
  if (calculation.grossAmount < 0) {
    throw new Error("Marketplace gross_amount cannot be negative.");
  }

  if (calculation.platformFeeAmount < 0) {
    throw new Error("Marketplace platform_fee_amount cannot be negative.");
  }

  if (calculation.creatorRevenueAmount < 0) {
    throw new Error("Marketplace creator_revenue_amount cannot be negative.");
  }

  if (calculation.netAmount < 0) {
    throw new Error("Marketplace net_amount cannot be negative.");
  }

  if (calculation.platformFeeAmount > calculation.grossAmount) {
    throw new Error("Marketplace platform_fee_amount cannot exceed gross_amount.");
  }

  if (calculation.netAmount !== calculation.creatorRevenueAmount) {
    throw new Error("Marketplace net_amount must equal creator_revenue_amount.");
  }

  if (!parseMarketplaceCurrency(calculation.currency)) {
    throw new Error("Marketplace revenue currency is invalid.");
  }

  if (expectedCurrency && calculation.currency !== expectedCurrency) {
    throw new Error("Marketplace revenue currency must match item pricing currency.");
  }

  if (calculation.pricingMode === "free" && calculation.grossAmount > 0) {
    throw new Error("Free marketplace items cannot produce paid revenue.");
  }

  if (calculation.pricingMode !== "free" && calculation.grossAmount <= 0) {
    throw new Error("Paid marketplace revenue requires gross_amount greater than 0.");
  }
}

export function parseMarketplaceRevenueEvent(value: unknown): MarketplaceRevenueEventRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const pricingMode = text(row.pricing_mode, 40) as MarketplacePricingMode;
  const revenueStatus = parseMarketplaceRevenueStatus(row.revenue_status);
  const currency = parseMarketplaceCurrency(row.currency);

  if (!id || !marketplaceItemId || !revenueStatus || !currency) {
    return null;
  }

  if (!["free", "paid", "subscription"].includes(pricingMode)) {
    return null;
  }

  const grossAmount = roundMoney(Math.max(0, parseNumber(row.gross_amount) ?? 0));
  const platformFeeAmount = roundMoney(Math.max(0, parseNumber(row.platform_fee_amount) ?? 0));
  const creatorRevenueAmount = roundMoney(Math.max(0, parseNumber(row.creator_revenue_amount) ?? 0));
  const netAmount = roundMoney(Math.max(0, parseNumber(row.net_amount) ?? 0));

  if (platformFeeAmount > grossAmount) return null;
  if (netAmount !== creatorRevenueAmount) return null;
  if (pricingMode !== "free" && grossAmount <= 0) return null;
  if (pricingMode === "free" && grossAmount > 0) return null;

  return {
    buyerAccountId: text(row.buyer_account_id, 120) || null,
    createdAt: text(row.created_at, 80) || null,
    creatorAccountId: text(row.creator_account_id, 120) || null,
    creatorRevenueAmount,
    currency,
    externalPaymentId: text(row.external_payment_id, 240) || null,
    grossAmount,
    id,
    marketplaceItemId,
    metadata: safeRecord(row.metadata),
    netAmount,
    platformFeeAmount,
    pricingMode,
    revenueStatus,
    source: text(row.source, 120) || "marketplace_revenue_runtime",
    updatedAt: text(row.updated_at, 80) || null
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace revenue runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace revenue runtime.");
  }

  return admin;
}

async function loadMarketplaceRevenueItem(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(itemPricingSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace revenue item could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace revenue item record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);
  const pricing = parseMarketplacePricingRecord(row);

  if (!id || !itemKey || !name || !pricing) {
    throw new Error("Marketplace revenue item record is invalid.");
  }

  if (!isValidMarketplaceItemType(itemType)) {
    throw new Error("Marketplace item type is invalid.");
  }

  return {
    id,
    itemKey,
    itemType,
    metadata: safeRecord(row.metadata),
    name,
    pricing,
    recordedAmount: Math.max(0, parseNumber(row.revenue_amount) ?? 0),
    recordedCurrency: parseMarketplaceCurrency(row.revenue_currency)
  };
}

async function recordMarketplaceRevenueAudit(params: {
  event: MarketplaceRevenueEventRecord;
  item: {
    id: string;
    itemKey: string;
    itemType: string;
    name: string;
  };
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.event.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_record_revenue_event",
    metadata: {
      creator_revenue_amount: params.event.creatorRevenueAmount,
      currency: params.event.currency,
      gross_amount: params.event.grossAmount,
      item_id: params.item.id,
      item_key: params.item.itemKey,
      item_name: params.item.name,
      item_type: params.item.itemType,
      marketplace_item_id: params.event.marketplaceItemId,
      note: "Super Admin marketplace revenue runtime foundation event. Isolated from platform subscription billing. No payouts or purchase runtime.",
      platform_fee_amount: params.event.platformFeeAmount,
      pricing_mode: params.event.pricingMode,
      revenue_event_id: params.event.id,
      revenue_status: params.event.revenueStatus,
      source: params.event.source,
      source_runtime: "super_admin_marketplace_revenue_runtime"
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

async function syncMarketplaceItemRecordedRevenue(itemId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_revenue_events" as never)
    .select("gross_amount, currency, revenue_status" as never)
    .eq("marketplace_item_id" as never, itemId as never)
    .eq("revenue_status" as never, "processed" as never);

  if (error) {
    throw new Error(`Marketplace item revenue could not be aggregated: ${error.message}`);
  }

  const processed = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => rowRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  const totalGross = roundMoney(
    processed.reduce((sum, row) => sum + Math.max(0, parseNumber(row.gross_amount) ?? 0), 0)
  );
  const currency = parseMarketplaceCurrency(processed.at(-1)?.currency) ?? "USD";

  await admin
    .from("marketplace_items" as never)
    .update({
      revenue_amount: totalGross,
      revenue_currency: currency
    } as never)
    .eq("id" as never, itemId as never);
}

export async function listMarketplaceRevenueEvents(params: {
  itemId?: string;
  limit?: number;
  revenueStatus?: MarketplaceRevenueStatus | MarketplaceRevenueStatus[];
} = {}): Promise<MarketplaceRevenueEventRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 1000));
  let query = admin.from("marketplace_revenue_events" as never).select(revenueEventSelect as never);

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  if (params.revenueStatus) {
    const statuses = Array.isArray(params.revenueStatus) ? params.revenueStatus : [params.revenueStatus];
    query = query.in("revenue_status" as never, statuses as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace revenue events could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceRevenueEvent(row))
    .filter((event): event is MarketplaceRevenueEventRecord => Boolean(event));
}

export async function getMarketplaceRevenueStats(): Promise<MarketplaceRevenueStats> {
  const events = await listMarketplaceRevenueEvents({ limit: 1000 });

  return events.reduce<MarketplaceRevenueStats>(
    (stats, event) => {
      if (event.revenueStatus === "pending") stats.pendingEvents += 1;
      if (event.revenueStatus === "failed") stats.failedEvents += 1;
      if (event.revenueStatus === "refunded") stats.refundedEvents += 1;
      if (event.revenueStatus === "cancelled") stats.cancelledEvents += 1;

      if (event.revenueStatus === "processed") {
        stats.processedEvents += 1;
        stats.totalGrossProcessed = roundMoney(stats.totalGrossProcessed + event.grossAmount);
        stats.totalPlatformFeesProcessed = roundMoney(
          stats.totalPlatformFeesProcessed + event.platformFeeAmount
        );
        stats.totalCreatorRevenueProcessed = roundMoney(
          stats.totalCreatorRevenueProcessed + event.creatorRevenueAmount
        );
      }

      return stats;
    },
    {
      cancelledEvents: 0,
      failedEvents: 0,
      pendingEvents: 0,
      processedEvents: 0,
      refundedEvents: 0,
      totalCreatorRevenueProcessed: 0,
      totalGrossProcessed: 0,
      totalPlatformFeesProcessed: 0
    }
  );
}

export async function getMarketplaceItemRevenueSummary(
  itemId: string
): Promise<MarketplaceItemRevenueSummary> {
  await requireSuperAdmin();

  const item = await loadMarketplaceRevenueItem(itemId);
  const platformFeeRate = getMarketplacePlatformFeeRate(item.metadata);
  const calculated = calculateMarketplaceRevenue(item.pricing, platformFeeRate);

  validateMarketplaceRevenueCalculation(calculated, item.pricing.currency);

  const events = await listMarketplaceRevenueEvents({ itemId: item.id, limit: 20 });

  return {
    calculated,
    eventCount: events.length,
    processedEventCount: events.filter((event) => event.revenueStatus === "processed").length,
    recentEvents: events.slice(0, 5),
    recordedAmount: item.recordedAmount,
    recordedCurrency: item.recordedCurrency ?? calculated.currency
  };
}

export async function recordMarketplaceRevenueEvent(
  itemId: string,
  input: MarketplaceRevenueEventInput = {}
): Promise<MarketplaceRevenueEventRecord> {
  const access = await requireSuperAdmin();
  const item = await loadMarketplaceRevenueItem(itemId);
  const platformFeeRate = getMarketplacePlatformFeeRate(item.metadata);
  const calculated = calculateMarketplaceRevenue(item.pricing, platformFeeRate);

  validateMarketplaceRevenueCalculation(calculated, item.pricing.currency);

  if (calculated.pricingMode === "free") {
    throw new Error("Free marketplace items cannot create paid revenue events.");
  }

  const revenueStatus = input.revenueStatus
    ? parseMarketplaceRevenueStatus(input.revenueStatus)
    : "pending";

  if (!revenueStatus) {
    throw new Error("Marketplace revenue status is invalid.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_revenue_events" as never)
    .insert({
      buyer_account_id: text(input.buyerAccountId, 120) || null,
      creator_account_id: text(input.creatorAccountId, 120) || null,
      creator_revenue_amount: calculated.creatorRevenueAmount,
      currency: calculated.currency,
      external_payment_id: text(input.externalPaymentId, 240) || null,
      gross_amount: calculated.grossAmount,
      marketplace_item_id: item.id,
      metadata: {
        billing_interval: item.pricing.billingInterval,
        foundation_only: true,
        item_key: item.itemKey,
        item_type: item.itemType,
        platform_fee_rate: platformFeeRate,
        pricing_mode: calculated.pricingMode,
        source_runtime: "marketplace_revenue_runtime",
        ...safeRecord(input.metadata)
      },
      net_amount: calculated.netAmount,
      platform_fee_amount: calculated.platformFeeAmount,
      pricing_mode: calculated.pricingMode,
      revenue_status: revenueStatus,
      source: text(input.source, 120) || "marketplace_revenue_runtime"
    } as never)
    .select(revenueEventSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace revenue event could not be recorded: ${error.message}`);
  }

  const event = parseMarketplaceRevenueEvent(data);

  if (!event) {
    throw new Error("Marketplace revenue event returned an invalid record.");
  }

  if (revenueStatus === "processed") {
    await syncMarketplaceItemRecordedRevenue(item.id);
  }

  await recordMarketplaceRevenueAudit({
    event,
    item,
    userId: access.user.id
  });

  return event;
}
