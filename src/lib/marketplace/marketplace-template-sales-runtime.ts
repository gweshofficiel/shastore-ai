import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseMarketplaceCurrency,
  type MarketplaceCurrency
} from "@/src/lib/marketplace/marketplace-pricing-runtime";
import {
  getMarketplacePurchaseById,
  parseMarketplacePurchase,
  type MarketplacePurchaseRecord
} from "@/src/lib/marketplace/marketplace-purchase-runtime";
import { listMarketplaceItemsForPublicCatalog } from "@/src/lib/marketplace/marketplace-registry";
import {
  evaluateMarketplaceTemplateBinding,
  parseMarketplaceTemplateBindingStatus,
  type MarketplaceTemplateBindingRecord
} from "@/src/lib/marketplace/marketplace-template-binding-runtime";
import { isPublicMarketplaceEligible } from "@/src/lib/marketplace/marketplace-visibility-runtime";
import { listTemplatesReadOnly } from "@/src/lib/templates/template-registry";

export type MarketplaceTemplateSaleStatus =
  | "cancelled"
  | "completed"
  | "failed"
  | "pending"
  | "refunded";

export type MarketplaceTemplateSaleRecord = {
  amount: number;
  buyerAccountId: string | null;
  createdAt: string | null;
  creatorAccountId: string | null;
  currency: MarketplaceCurrency;
  id: string;
  marketplaceItemId: string;
  marketplacePurchaseId: string;
  metadata: Record<string, unknown>;
  saleStatus: MarketplaceTemplateSaleStatus;
  templateId: string;
  updatedAt: string | null;
};

export type MarketplaceTemplateSaleEligibility = {
  amount: number;
  binding: MarketplaceTemplateBindingRecord;
  currency: MarketplaceCurrency;
  eligible: boolean;
  itemId: string;
  itemKey: string;
  itemName: string;
  marketplacePurchaseId: string;
  purchaseStatus: string;
  templateId: string;
  templateKey: string | null;
  templateName: string | null;
  verificationIssues: string[];
};

export type MarketplaceTemplateSaleStats = {
  cancelledSales: number;
  completedSales: number;
  failedSales: number;
  pendingSales: number;
  refundedSales: number;
  totalSales: number;
};

export const MARKETPLACE_TEMPLATE_SALE_STATUSES: readonly MarketplaceTemplateSaleStatus[] = [
  "pending",
  "completed",
  "failed",
  "cancelled",
  "refunded"
] as const;

const templateSaleSelect =
  "id, marketplace_purchase_id, marketplace_item_id, template_id, buyer_account_id, creator_account_id, sale_status, amount, currency, metadata, created_at, updated_at";

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

function templateKeyFromMarketplaceItemKey(itemKey: string) {
  const cleaned = text(itemKey, 160);
  return cleaned.startsWith("template:") ? cleaned.slice("template:".length) : "";
}

export function isValidMarketplaceTemplateSaleStatus(
  value: unknown
): value is MarketplaceTemplateSaleStatus {
  return MARKETPLACE_TEMPLATE_SALE_STATUSES.includes(value as MarketplaceTemplateSaleStatus);
}

export function parseMarketplaceTemplateSaleStatus(value: unknown): MarketplaceTemplateSaleStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceTemplateSaleStatus(cleaned) ? cleaned : null;
}

export function sanitizeTemplateSaleMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (secretKeyPattern.test(key)) continue;

    if (typeof value === "string" && /\bjavascript:/i.test(value)) continue;

    clean[key] = value;
  }

  clean.cloning_runtime = false;
  clean.delivery_runtime = false;
  clean.foundation_only = true;
  clean.payout_runtime = false;

  return clean;
}

export function validateTemplateSaleMetadata(metadata: Record<string, unknown>) {
  const serialized = JSON.stringify(metadata);

  if (secretKeyPattern.test(serialized)) {
    throw new Error("Template sale metadata must not contain secrets, card data, or payout credentials.");
  }
}

export function parseMarketplaceTemplateSale(value: unknown): MarketplaceTemplateSaleRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplacePurchaseId = text(row.marketplace_purchase_id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const templateId = text(row.template_id, 120);
  const saleStatus = parseMarketplaceTemplateSaleStatus(row.sale_status);
  const currency = parseMarketplaceCurrency(row.currency);
  const amount = roundMoney(Math.max(0, parseNumber(row.amount) ?? 0));

  if (!id || !marketplacePurchaseId || !marketplaceItemId || !templateId || !saleStatus || !currency) {
    return null;
  }

  const metadata = sanitizeTemplateSaleMetadata(safeRecord(row.metadata));

  try {
    validateTemplateSaleMetadata(metadata);
  } catch {
    return null;
  }

  return {
    amount,
    buyerAccountId: text(row.buyer_account_id, 120) || null,
    createdAt: text(row.created_at, 80) || null,
    creatorAccountId: text(row.creator_account_id, 120) || null,
    currency,
    id,
    marketplaceItemId,
    marketplacePurchaseId,
    metadata,
    saleStatus,
    templateId,
    updatedAt: text(row.updated_at, 80) || null
  };
}

export function evaluateMarketplaceTemplateSaleEligibility(params: {
  binding: MarketplaceTemplateBindingRecord;
  existingCompletedSale: MarketplaceTemplateSaleRecord | null;
  item: {
    id: string;
    itemKey: string;
    itemType: string;
    linkedTemplateId: string | null;
    name: string;
    status: string;
    visibility: string;
  };
  purchase: MarketplacePurchaseRecord;
}): MarketplaceTemplateSaleEligibility {
  const verificationIssues: string[] = [];

  if (params.purchase.purchaseStatus !== "paid") {
    verificationIssues.push("Marketplace purchase must be paid before creating a template sale.");
  }

  if (params.purchase.marketplaceItemId !== params.item.id) {
    verificationIssues.push("Marketplace purchase does not match the template marketplace item.");
  }

  if (params.item.itemType !== "template") {
    verificationIssues.push("Marketplace item must be a template.");
  }

  if (!isPublicMarketplaceEligible({
    status: params.item.status as "approved",
    visibility: params.item.visibility as "public"
  })) {
    verificationIssues.push("Template marketplace item must be approved and public.");
  }

  if (!params.item.linkedTemplateId) {
    verificationIssues.push("Template marketplace item is missing linked_template_id.");
  }

  if (!params.binding.verified || params.binding.bindingStatus !== "bound") {
    verificationIssues.push("Template marketplace item requires a verified template binding.");
    verificationIssues.push(...params.binding.verificationIssues);
  }

  if (params.binding.linkedTemplateId && params.item.linkedTemplateId !== params.binding.linkedTemplateId) {
    verificationIssues.push("Template binding does not match marketplace item linked_template_id.");
  }

  const amount = roundMoney(Math.max(0, params.purchase.amount));
  const currency = params.purchase.currency;

  if (params.existingCompletedSale) {
    verificationIssues.push("A completed template sale already exists for this marketplace purchase.");
  }

  const templateId = params.binding.linkedTemplateId ?? params.item.linkedTemplateId ?? "";

  if (!templateId) {
    verificationIssues.push("Template sale requires a linked template_id.");
  }

  return {
    amount,
    binding: params.binding,
    currency,
    eligible: verificationIssues.length === 0,
    itemId: params.item.id,
    itemKey: params.item.itemKey,
    itemName: params.item.name,
    marketplacePurchaseId: params.purchase.id,
    purchaseStatus: params.purchase.purchaseStatus,
    templateId,
    templateKey: params.binding.templateKey,
    templateName: params.binding.templateName,
    verificationIssues
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace template sales runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace template sales runtime.");
  }

  return admin;
}

async function loadTemplateMarketplaceItem(itemId: string) {
  const items = await listMarketplaceItemsForPublicCatalog({ itemId: text(itemId, 120), limit: 1 });
  const item = items[0];

  if (!item || item.itemType !== "template") {
    throw new Error("Public template marketplace item was not found.");
  }

  return item;
}

async function loadTemplateBindingForItem(item: Awaited<ReturnType<typeof loadTemplateMarketplaceItem>>) {
  const templateKey = templateKeyFromMarketplaceItemKey(item.itemKey);
  const templates = await listTemplatesReadOnly();
  const template = templateKey
    ? templates.find((entry) => entry.templateKey === templateKey) ?? null
    : null;

  return evaluateMarketplaceTemplateBinding({
    itemKey: item.itemKey,
    itemType: item.itemType,
    linkedTemplateId: item.linkedTemplateId,
    marketplaceStatus: item.status,
    marketplaceVisibility: item.visibility,
    storedBindingStatus: parseMarketplaceTemplateBindingStatus(item.templateBinding.bindingStatus),
    template,
    templateVersion: item.templateBinding.templateVersion
  });
}

async function getCompletedTemplateSaleForPurchase(purchaseId: string) {
  const sales = await listMarketplaceTemplateSales({
    limit: 1,
    marketplacePurchaseId: purchaseId,
    saleStatus: "completed"
  });

  return sales[0] ?? null;
}

async function recordMarketplaceTemplateSaleAudit(params: {
  eligibility: MarketplaceTemplateSaleEligibility;
  sale: MarketplaceTemplateSaleRecord;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.sale.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_create_template_sale_foundation",
    metadata: {
      amount: params.sale.amount,
      currency: params.sale.currency,
      item_id: params.eligibility.itemId,
      item_key: params.eligibility.itemKey,
      item_name: params.eligibility.itemName,
      marketplace_item_id: params.sale.marketplaceItemId,
      marketplace_purchase_id: params.sale.marketplacePurchaseId,
      note: "Super Admin marketplace template sale foundation. No cloning, delivery, or payouts.",
      sale_status: params.sale.saleStatus,
      source_runtime: "marketplace_template_sales_runtime",
      template_id: params.sale.templateId,
      template_key: params.eligibility.templateKey,
      template_name: params.eligibility.templateName,
      verification_issues: params.eligibility.verificationIssues
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplaceTemplateSales(params: {
  buyerAccountId?: string;
  itemId?: string;
  limit?: number;
  marketplacePurchaseId?: string;
  saleStatus?: MarketplaceTemplateSaleStatus | MarketplaceTemplateSaleStatus[];
  templateId?: string;
} = {}): Promise<MarketplaceTemplateSaleRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 2000));
  let query = admin.from("marketplace_template_sales" as never).select(templateSaleSelect as never);

  if (params.marketplacePurchaseId) {
    query = query.eq(
      "marketplace_purchase_id" as never,
      text(params.marketplacePurchaseId, 120) as never
    );
  }

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  if (params.templateId) {
    query = query.eq("template_id" as never, text(params.templateId, 120) as never);
  }

  if (params.buyerAccountId) {
    query = query.eq("buyer_account_id" as never, text(params.buyerAccountId, 120) as never);
  }

  if (params.saleStatus) {
    const statuses = Array.isArray(params.saleStatus) ? params.saleStatus : [params.saleStatus];
    query = query.in("sale_status" as never, statuses as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace template sales could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceTemplateSale(row))
    .filter((sale): sale is MarketplaceTemplateSaleRecord => Boolean(sale));
}

export async function getMarketplaceTemplateSaleById(
  saleId: string
): Promise<MarketplaceTemplateSaleRecord | null> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const cleanedId = text(saleId, 120);

  if (!cleanedId) return null;

  const { data, error } = await admin
    .from("marketplace_template_sales" as never)
    .select(templateSaleSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace template sale could not be loaded: ${error.message}`);
  }

  return parseMarketplaceTemplateSale(data);
}

export async function getMarketplaceTemplateSaleByPurchaseId(
  purchaseId: string
): Promise<MarketplaceTemplateSaleRecord | null> {
  const sales = await listMarketplaceTemplateSales({
    limit: 1,
    marketplacePurchaseId: purchaseId,
    saleStatus: "completed"
  });

  return sales[0] ?? null;
}

export async function getMarketplaceTemplateSaleStats(): Promise<MarketplaceTemplateSaleStats> {
  await requireSuperAdmin();

  const sales = await listMarketplaceTemplateSales({ limit: 2000 });

  return sales.reduce<MarketplaceTemplateSaleStats>(
    (stats, sale) => {
      if (sale.saleStatus === "pending") stats.pendingSales += 1;
      if (sale.saleStatus === "completed") stats.completedSales += 1;
      if (sale.saleStatus === "failed") stats.failedSales += 1;
      if (sale.saleStatus === "cancelled") stats.cancelledSales += 1;
      if (sale.saleStatus === "refunded") stats.refundedSales += 1;
      return stats;
    },
    {
      cancelledSales: 0,
      completedSales: 0,
      failedSales: 0,
      pendingSales: 0,
      refundedSales: 0,
      totalSales: sales.length
    }
  );
}

export async function inspectMarketplaceTemplateSaleEligibility(purchaseId: string) {
  await requireSuperAdmin();

  const purchase = await getMarketplacePurchaseById(purchaseId);

  if (!purchase) {
    throw new Error("Marketplace purchase was not found.");
  }

  const item = await loadTemplateMarketplaceItem(purchase.marketplaceItemId);
  const binding = await loadTemplateBindingForItem(item);
  const existingCompletedSale = await getCompletedTemplateSaleForPurchase(purchase.id);

  return evaluateMarketplaceTemplateSaleEligibility({
    binding,
    existingCompletedSale,
    item: {
      id: item.id,
      itemKey: item.itemKey,
      itemType: item.itemType,
      linkedTemplateId: item.linkedTemplateId,
      name: item.name,
      status: item.status,
      visibility: item.visibility
    },
    purchase
  });
}

export async function createMarketplaceTemplateSaleFromPurchase(purchaseId: string) {
  const access = await requireSuperAdmin();
  const eligibility = await inspectMarketplaceTemplateSaleEligibility(purchaseId);

  if (!eligibility.eligible) {
    throw new Error(eligibility.verificationIssues[0] ?? "Template sale eligibility failed.");
  }

  const purchase = await getMarketplacePurchaseById(purchaseId);

  if (!purchase) {
    throw new Error("Marketplace purchase was not found.");
  }

  const metadata = sanitizeTemplateSaleMetadata({
    foundation_only: true,
    item_key: eligibility.itemKey,
    item_name: eligibility.itemName,
    purchase_status: purchase.purchaseStatus,
    source_runtime: "marketplace_template_sales_runtime",
    template_binding_status: eligibility.binding.bindingStatus,
    template_key: eligibility.templateKey,
    template_name: eligibility.templateName
  });

  validateTemplateSaleMetadata(metadata);

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_template_sales" as never)
    .insert({
      amount: eligibility.amount,
      buyer_account_id: purchase.buyerAccountId,
      creator_account_id: purchase.creatorAccountId,
      currency: eligibility.currency,
      marketplace_item_id: eligibility.itemId,
      marketplace_purchase_id: purchase.id,
      metadata,
      sale_status: "completed",
      template_id: eligibility.templateId
    } as never)
    .select(templateSaleSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace template sale could not be created: ${error.message}`);
  }

  const sale = parseMarketplaceTemplateSale(data);

  if (!sale) {
    throw new Error("Created marketplace template sale record is invalid.");
  }

  await recordMarketplaceTemplateSaleAudit({
    eligibility,
    sale,
    userId: access.user.id
  });

  return sale;
}

export async function cancelMarketplaceTemplateSaleFoundation(saleId: string) {
  const access = await requireSuperAdmin();
  const sale = await getMarketplaceTemplateSaleById(saleId);

  if (!sale) {
    throw new Error("Marketplace template sale was not found.");
  }

  if (sale.saleStatus === "refunded") {
    throw new Error("Refunded template sales cannot be cancelled in foundation runtime.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_template_sales" as never)
    .update({ sale_status: "cancelled" } as never)
    .eq("id" as never, sale.id as never)
    .select(templateSaleSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace template sale could not be cancelled: ${error.message}`);
  }

  const updated = parseMarketplaceTemplateSale(data);

  if (!updated) {
    throw new Error("Cancelled marketplace template sale record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_cancel_template_sale_foundation",
    metadata: {
      marketplace_purchase_id: updated.marketplacePurchaseId,
      note: "Super Admin marketplace template sale foundation cancellation. No refund execution.",
      sale_status: updated.saleStatus,
      source_runtime: "marketplace_template_sales_runtime",
      template_id: updated.templateId
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}
