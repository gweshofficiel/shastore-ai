import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidMarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  parseMarketplaceCurrency,
  parseMarketplacePricingMode,
  type MarketplaceCurrency,
  type MarketplacePricingMode,
  type MarketplacePricingRecord
} from "@/src/lib/marketplace/marketplace-pricing-runtime";
import { listMarketplaceItemsForPublicCatalog } from "@/src/lib/marketplace/marketplace-registry";
import {
  calculateMarketplaceRevenue,
  getMarketplacePlatformFeeRate,
  type MarketplaceRevenueCalculation
} from "@/src/lib/marketplace/marketplace-revenue-runtime";
import { isPublicMarketplaceEligible } from "@/src/lib/marketplace/marketplace-visibility-runtime";

export type MarketplacePurchaseStatus =
  | "cancelled"
  | "draft"
  | "failed"
  | "paid"
  | "pending_payment"
  | "refunded";

export type MarketplacePaymentProvider = "internal" | "manual" | "none" | "stripe_foundation";

export type MarketplacePurchaseRecord = {
  amount: number;
  buyerAccountId: string | null;
  createdAt: string | null;
  creatorAccountId: string | null;
  currency: MarketplaceCurrency;
  externalPaymentId: string | null;
  id: string;
  marketplaceItemId: string;
  metadata: Record<string, unknown>;
  paymentProvider: MarketplacePaymentProvider;
  pricingMode: MarketplacePricingMode;
  purchaseStatus: MarketplacePurchaseStatus;
  updatedAt: string | null;
};

export type MarketplacePurchaseEligibility = {
  amount: number;
  currency: MarketplaceCurrency;
  eligible: boolean;
  itemId: string;
  itemKey: string;
  itemName: string;
  itemType: string;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  pricingMode: MarketplacePricingMode;
  revenueFoundation: MarketplaceRevenueCalculation;
  verificationIssues: string[];
};

export type MarketplacePurchaseStats = {
  cancelledPurchases: number;
  draftPurchases: number;
  failedPurchases: number;
  paidPurchases: number;
  pendingPaymentPurchases: number;
  refundedPurchases: number;
  totalPurchases: number;
};

export type CreateMarketplacePurchaseFoundationInput = {
  buyerAccountId?: string | null;
  externalPaymentId?: string | null;
  marketplaceItemId: string;
  metadata?: Record<string, unknown>;
  paymentProvider?: MarketplacePaymentProvider;
  purchaseStatus?: Extract<MarketplacePurchaseStatus, "draft" | "pending_payment">;
};

export const MARKETPLACE_PURCHASE_STATUSES: readonly MarketplacePurchaseStatus[] = [
  "draft",
  "pending_payment",
  "paid",
  "failed",
  "cancelled",
  "refunded"
] as const;

export const MARKETPLACE_PAYMENT_PROVIDERS: readonly MarketplacePaymentProvider[] = [
  "none",
  "internal",
  "manual",
  "stripe_foundation"
] as const;

const purchaseSelect =
  "id, marketplace_item_id, buyer_account_id, creator_account_id, purchase_status, pricing_mode, amount, currency, payment_provider, external_payment_id, metadata, created_at, updated_at";

const secretKeyPattern = /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc)/i;

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

export function isValidMarketplacePurchaseStatus(value: unknown): value is MarketplacePurchaseStatus {
  return MARKETPLACE_PURCHASE_STATUSES.includes(value as MarketplacePurchaseStatus);
}

export function parseMarketplacePurchaseStatus(value: unknown): MarketplacePurchaseStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplacePurchaseStatus(cleaned) ? cleaned : null;
}

export function isValidMarketplacePaymentProvider(value: unknown): value is MarketplacePaymentProvider {
  return MARKETPLACE_PAYMENT_PROVIDERS.includes(value as MarketplacePaymentProvider);
}

export function parseMarketplacePaymentProvider(value: unknown): MarketplacePaymentProvider | null {
  const cleaned = text(value, 40);
  return isValidMarketplacePaymentProvider(cleaned) ? cleaned : null;
}

export function sanitizePurchaseMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (secretKeyPattern.test(key)) continue;

    if (typeof value === "string" && /\bjavascript:/i.test(value)) continue;

    clean[key] = value;
  }

  clean.foundation_only = true;
  clean.install_runtime = false;
  clean.payout_runtime = false;
  clean.purchase_capture = false;

  return clean;
}

export function validatePurchaseMetadata(metadata: Record<string, unknown>) {
  const serialized = JSON.stringify(metadata);

  if (secretKeyPattern.test(serialized)) {
    throw new Error("Purchase metadata must not contain secrets, card data, or payout credentials.");
  }
}

export function parseMarketplacePurchase(value: unknown): MarketplacePurchaseRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const purchaseStatus = parseMarketplacePurchaseStatus(row.purchase_status);
  const pricingMode = parseMarketplacePricingMode(row.pricing_mode);
  const currency = parseMarketplaceCurrency(row.currency);
  const paymentProvider = parseMarketplacePaymentProvider(row.payment_provider) ?? "none";
  const amount = roundMoney(Math.max(0, parseNumber(row.amount) ?? 0));

  if (!id || !marketplaceItemId || !purchaseStatus || !pricingMode || !currency) {
    return null;
  }

  if (pricingMode === "free" && amount > 0) return null;
  if (pricingMode !== "free" && amount <= 0 && purchaseStatus !== "draft") return null;

  const metadata = sanitizePurchaseMetadata(safeRecord(row.metadata));

  try {
    validatePurchaseMetadata(metadata);
  } catch {
    return null;
  }

  return {
    amount,
    buyerAccountId: text(row.buyer_account_id, 120) || null,
    createdAt: text(row.created_at, 80) || null,
    creatorAccountId: text(row.creator_account_id, 120) || null,
    currency,
    externalPaymentId: text(row.external_payment_id, 240) || null,
    id,
    marketplaceItemId,
    metadata,
    paymentProvider,
    pricingMode,
    purchaseStatus,
    updatedAt: text(row.updated_at, 80) || null
  };
}

export function evaluateMarketplacePurchaseEligibility(params: {
  item: {
    creatorAccountId: string | null;
    id: string;
    itemKey: string;
    itemType: string;
    metadata: Record<string, unknown>;
    name: string;
    pricing: MarketplacePricingRecord;
    status: string;
    visibility: string;
  };
}): MarketplacePurchaseEligibility {
  const verificationIssues: string[] = [];
  const publicEligible = isPublicMarketplaceEligible({
    status: params.item.status as "approved",
    visibility: params.item.visibility as "public"
  });

  if (!publicEligible) {
    verificationIssues.push("Only approved public marketplace items can enter purchase foundation.");
  }

  if (params.item.status !== "approved") {
    verificationIssues.push("Marketplace item must be approved.");
  }

  if (params.item.visibility !== "public") {
    verificationIssues.push("Marketplace item must be public.");
  }

  if (!isValidMarketplaceItemType(params.item.itemType)) {
    verificationIssues.push("Marketplace item type is invalid.");
  }

  const revenueFoundation = calculateMarketplaceRevenue(
    params.item.pricing,
    getMarketplacePlatformFeeRate(params.item.metadata)
  );
  const amount = roundMoney(Math.max(0, params.item.pricing.priceAmount));
  const currency = params.item.pricing.currency ?? "USD";

  if (params.item.pricing.mode === "free" && amount > 0) {
    verificationIssues.push("Free marketplace items must have amount = 0.");
  }

  if (params.item.pricing.mode !== "free" && amount <= 0) {
    verificationIssues.push("Paid marketplace items must have amount greater than 0.");
  }

  if (revenueFoundation.currency !== currency) {
    verificationIssues.push("Purchase currency must match item pricing currency.");
  }

  return {
    amount,
    currency,
    eligible: verificationIssues.length === 0,
    itemId: params.item.id,
    itemKey: params.item.itemKey,
    itemName: params.item.name,
    itemType: params.item.itemType,
    marketplaceStatus: params.item.status,
    marketplaceVisibility: params.item.visibility,
    pricingMode: params.item.pricing.mode,
    revenueFoundation,
    verificationIssues
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace purchase runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace purchase runtime.");
  }

  return admin;
}

async function loadMarketplacePurchaseItem(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const items = await listMarketplaceItemsForPublicCatalog({ itemId: cleanedId, limit: 1 });
  const item = items[0];

  if (!item) {
    throw new Error("Marketplace item is not publicly purchasable.");
  }

  return {
    creatorAccountId: item.creatorAccountId,
    id: item.id,
    itemKey: item.itemKey,
    itemType: item.itemType,
    metadata: item.metadata,
    name: item.name,
    pricing: item.pricing,
    status: item.status,
    visibility: item.visibility
  };
}

async function recordMarketplacePurchaseAudit(params: {
  eligibility: MarketplacePurchaseEligibility;
  purchase: MarketplacePurchaseRecord;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.purchase.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_create_purchase_foundation",
    metadata: {
      amount: params.purchase.amount,
      buyer_account_id: params.purchase.buyerAccountId,
      creator_account_id: params.purchase.creatorAccountId,
      currency: params.purchase.currency,
      item_id: params.eligibility.itemId,
      item_key: params.eligibility.itemKey,
      item_name: params.eligibility.itemName,
      item_type: params.eligibility.itemType,
      marketplace_item_id: params.purchase.marketplaceItemId,
      note: "Super Admin marketplace purchase foundation record. No payment capture, delivery, installs, or payouts.",
      payment_provider: params.purchase.paymentProvider,
      pricing_mode: params.purchase.pricingMode,
      purchase_status: params.purchase.purchaseStatus,
      revenue_foundation: {
        creator_revenue_amount: params.eligibility.revenueFoundation.creatorRevenueAmount,
        gross_amount: params.eligibility.revenueFoundation.grossAmount,
        platform_fee_amount: params.eligibility.revenueFoundation.platformFeeAmount
      },
      source_runtime: "marketplace_purchase_runtime",
      verification_issues: params.eligibility.verificationIssues
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplacePurchases(params: {
  buyerAccountId?: string;
  itemId?: string;
  limit?: number;
  purchaseStatus?: MarketplacePurchaseStatus | MarketplacePurchaseStatus[];
} = {}): Promise<MarketplacePurchaseRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 2000));
  let query = admin.from("marketplace_purchases" as never).select(purchaseSelect as never);

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  if (params.buyerAccountId) {
    query = query.eq("buyer_account_id" as never, text(params.buyerAccountId, 120) as never);
  }

  if (params.purchaseStatus) {
    const statuses = Array.isArray(params.purchaseStatus) ? params.purchaseStatus : [params.purchaseStatus];
    query = query.in("purchase_status" as never, statuses as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace purchases could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplacePurchase(row))
    .filter((purchase): purchase is MarketplacePurchaseRecord => Boolean(purchase));
}

export async function getMarketplacePurchaseById(
  purchaseId: string
): Promise<MarketplacePurchaseRecord | null> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const cleanedId = text(purchaseId, 120);

  if (!cleanedId) return null;

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

export async function getMarketplacePurchaseStats(): Promise<MarketplacePurchaseStats> {
  await requireSuperAdmin();

  const purchases = await listMarketplacePurchases({ limit: 2000 });

  return purchases.reduce<MarketplacePurchaseStats>(
    (stats, purchase) => {
      if (purchase.purchaseStatus === "draft") stats.draftPurchases += 1;
      if (purchase.purchaseStatus === "pending_payment") stats.pendingPaymentPurchases += 1;
      if (purchase.purchaseStatus === "paid") stats.paidPurchases += 1;
      if (purchase.purchaseStatus === "failed") stats.failedPurchases += 1;
      if (purchase.purchaseStatus === "cancelled") stats.cancelledPurchases += 1;
      if (purchase.purchaseStatus === "refunded") stats.refundedPurchases += 1;
      return stats;
    },
    {
      cancelledPurchases: 0,
      draftPurchases: 0,
      failedPurchases: 0,
      paidPurchases: 0,
      pendingPaymentPurchases: 0,
      refundedPurchases: 0,
      totalPurchases: purchases.length
    }
  );
}

export async function createMarketplacePurchaseFoundation(
  input: CreateMarketplacePurchaseFoundationInput
) {
  const access = await requireSuperAdmin();
  const item = await loadMarketplacePurchaseItem(input.marketplaceItemId);
  const eligibility = evaluateMarketplacePurchaseEligibility({ item });

  if (!eligibility.eligible) {
    throw new Error(eligibility.verificationIssues[0] ?? "Marketplace item is not purchasable.");
  }

  const purchaseStatus =
    input.purchaseStatus ??
    (eligibility.pricingMode === "free" ? ("draft" as const) : ("pending_payment" as const));
  const paymentProvider = parseMarketplacePaymentProvider(input.paymentProvider ?? "none") ?? "none";
  const buyerAccountId = text(input.buyerAccountId, 120) || null;
  const externalPaymentId = text(input.externalPaymentId, 240) || null;
  const metadata = sanitizePurchaseMetadata({
    ...safeRecord(input.metadata),
    billing_interval: item.pricing.billingInterval,
    foundation_only: true,
    item_key: item.itemKey,
    item_name: item.name,
    item_type: item.itemType,
    revenue_foundation: {
      creator_revenue_amount: eligibility.revenueFoundation.creatorRevenueAmount,
      gross_amount: eligibility.revenueFoundation.grossAmount,
      platform_fee_amount: eligibility.revenueFoundation.platformFeeAmount,
      platform_fee_rate: eligibility.revenueFoundation.platformFeeRate
    },
    source_runtime: "marketplace_purchase_runtime",
    trial_days: item.pricing.trialDays
  });

  validatePurchaseMetadata(metadata);

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_purchases" as never)
    .insert({
      amount: eligibility.amount,
      buyer_account_id: buyerAccountId,
      creator_account_id: item.creatorAccountId,
      currency: eligibility.currency,
      external_payment_id: externalPaymentId,
      marketplace_item_id: item.id,
      metadata,
      payment_provider: paymentProvider,
      pricing_mode: eligibility.pricingMode,
      purchase_status: purchaseStatus
    } as never)
    .select(purchaseSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace purchase foundation could not be created: ${error.message}`);
  }

  const purchase = parseMarketplacePurchase(data);

  if (!purchase) {
    throw new Error("Created marketplace purchase foundation record is invalid.");
  }

  await recordMarketplacePurchaseAudit({
    eligibility,
    purchase,
    userId: access.user.id
  });

  return purchase;
}

export async function cancelMarketplacePurchaseFoundation(purchaseId: string) {
  const access = await requireSuperAdmin();
  const purchase = await getMarketplacePurchaseById(purchaseId);

  if (!purchase) {
    throw new Error("Marketplace purchase was not found.");
  }

  if (purchase.purchaseStatus === "paid" || purchase.purchaseStatus === "refunded") {
    throw new Error("Paid or refunded marketplace purchases cannot be cancelled in foundation runtime.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_purchases" as never)
    .update({ purchase_status: "cancelled" } as never)
    .eq("id" as never, purchase.id as never)
    .select(purchaseSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace purchase could not be cancelled: ${error.message}`);
  }

  const updated = parseMarketplacePurchase(data);

  if (!updated) {
    throw new Error("Cancelled marketplace purchase record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_cancel_purchase_foundation",
    metadata: {
      marketplace_item_id: updated.marketplaceItemId,
      note: "Super Admin marketplace purchase foundation cancellation. No refund execution.",
      purchase_status: updated.purchaseStatus,
      source_runtime: "marketplace_purchase_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}

export async function inspectMarketplacePurchaseEligibility(itemId: string) {
  await requireSuperAdmin();
  const item = await loadMarketplacePurchaseItem(itemId);
  return evaluateMarketplacePurchaseEligibility({ item });
}
