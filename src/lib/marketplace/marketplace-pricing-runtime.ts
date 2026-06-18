import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidMarketplaceItemType } from "@/src/lib/marketplace/marketplace-item-type-runtime";

export type MarketplacePricingMode = "free" | "paid" | "subscription";

export type MarketplaceBillingInterval = "monthly" | "yearly";

export type MarketplaceCurrency = "EUR" | "MAD" | "USD";

export type MarketplacePricingRecord = {
  billingInterval: MarketplaceBillingInterval | null;
  currency: MarketplaceCurrency | null;
  mode: MarketplacePricingMode;
  priceAmount: number;
  pricingUpdatedAt: string | null;
  trialDays: number;
};

export type MarketplacePricingInput = {
  billingInterval?: MarketplaceBillingInterval | null;
  currency?: MarketplaceCurrency | null;
  priceAmount?: number | null;
  pricingMode: MarketplacePricingMode;
  trialDays?: number | null;
};

export type MarketplacePricingUpdateResult = MarketplacePricingRecord & {
  itemId: string;
  itemKey: string;
  itemName: string;
  itemType: string;
  previousPricing: MarketplacePricingRecord;
};

export const MARKETPLACE_PRICING_MODES: readonly MarketplacePricingMode[] = [
  "free",
  "paid",
  "subscription"
] as const;

export const MARKETPLACE_BILLING_INTERVALS: readonly MarketplaceBillingInterval[] = [
  "monthly",
  "yearly"
] as const;

export const MARKETPLACE_CURRENCIES: readonly MarketplaceCurrency[] = ["USD", "EUR", "MAD"] as const;

const legacyPricingTypeToMode: Record<string, MarketplacePricingMode> = {
  free: "free",
  paid: "paid",
  premium: "paid",
  subscription: "subscription"
};

const pricingSelect =
  "id, item_key, name, item_type, pricing_mode, pricing_type, price_amount, currency, billing_interval, trial_days, pricing_updated_at";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rowRecord(value: unknown) {
  const candidate = value as unknown;
  return isRecord(candidate) ? candidate : null;
}

export function isValidMarketplacePricingMode(value: unknown): value is MarketplacePricingMode {
  return MARKETPLACE_PRICING_MODES.includes(value as MarketplacePricingMode);
}

export function isValidMarketplaceBillingInterval(
  value: unknown
): value is MarketplaceBillingInterval {
  return MARKETPLACE_BILLING_INTERVALS.includes(value as MarketplaceBillingInterval);
}

export function isValidMarketplaceCurrency(value: unknown): value is MarketplaceCurrency {
  return MARKETPLACE_CURRENCIES.includes(value as MarketplaceCurrency);
}

export function normalizeMarketplacePricingMode(value: unknown): MarketplacePricingMode | null {
  const cleaned = text(value, 40);
  if (isValidMarketplacePricingMode(cleaned)) return cleaned;
  return legacyPricingTypeToMode[cleaned] ?? null;
}

export function parseMarketplacePricingMode(value: unknown): MarketplacePricingMode | null {
  return normalizeMarketplacePricingMode(value);
}

export function parseMarketplaceBillingInterval(
  value: unknown
): MarketplaceBillingInterval | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceBillingInterval(cleaned) ? cleaned : null;
}

export function parseMarketplaceCurrency(value: unknown): MarketplaceCurrency | null {
  const cleaned = text(value, 12).toUpperCase();
  return isValidMarketplaceCurrency(cleaned) ? cleaned : null;
}

export function pricingTypeForMode(mode: MarketplacePricingMode): "free" | "paid" | "subscription" {
  if (mode === "subscription") return "subscription";
  if (mode === "paid") return "paid";
  return "free";
}

export function validateMarketplacePricingInput(input: MarketplacePricingInput): {
  billingInterval: MarketplaceBillingInterval | null;
  currency: MarketplaceCurrency;
  priceAmount: number;
  pricingMode: MarketplacePricingMode;
  trialDays: number;
} {
  const pricingMode = parseMarketplacePricingMode(input.pricingMode);

  if (!pricingMode) {
    throw new Error("Marketplace pricing mode must be free, paid, or subscription.");
  }

  const trialDays = Math.max(0, Math.floor(parseNumber(input.trialDays) ?? 0));
  const currency = parseMarketplaceCurrency(input.currency) ?? "USD";
  const billingInterval = parseMarketplaceBillingInterval(input.billingInterval);
  const rawAmount = parseNumber(input.priceAmount);

  if (pricingMode === "free") {
    if (rawAmount !== null && rawAmount !== 0) {
      throw new Error("Free marketplace items must have price_amount = 0.");
    }

    if (billingInterval) {
      throw new Error("Free marketplace items must not have a billing interval.");
    }

    return {
      billingInterval: null,
      currency,
      priceAmount: 0,
      pricingMode,
      trialDays
    };
  }

  if (pricingMode === "paid") {
    if (!rawAmount || rawAmount <= 0) {
      throw new Error("Paid marketplace items must have price_amount greater than 0.");
    }

    if (billingInterval) {
      throw new Error("Paid marketplace items must not have a billing interval.");
    }

    return {
      billingInterval: null,
      currency,
      priceAmount: rawAmount,
      pricingMode,
      trialDays
    };
  }

  if (!rawAmount || rawAmount <= 0) {
    throw new Error("Subscription marketplace items must have price_amount greater than 0.");
  }

  if (!billingInterval) {
    throw new Error("Subscription marketplace items require monthly or yearly billing interval.");
  }

  return {
    billingInterval,
    currency,
    priceAmount: rawAmount,
    pricingMode,
    trialDays
  };
}

export function parseMarketplacePricingRecord(row: Record<string, unknown>): MarketplacePricingRecord | null {
  const mode =
    parseMarketplacePricingMode(row.pricing_mode) ??
    normalizeMarketplacePricingMode(row.pricing_type);

  if (!mode) return null;

  const priceAmount = Math.max(0, parseNumber(row.price_amount) ?? 0);
  const billingInterval = parseMarketplaceBillingInterval(row.billing_interval);
  const currency = parseMarketplaceCurrency(row.currency);

  if (mode === "free" && priceAmount !== 0) return null;
  if (mode === "paid" && priceAmount <= 0) return null;
  if (mode === "subscription" && (priceAmount <= 0 || !billingInterval)) return null;

  return {
    billingInterval: mode === "subscription" ? billingInterval : null,
    currency,
    mode,
    priceAmount: mode === "free" ? 0 : priceAmount,
    pricingUpdatedAt: text(row.pricing_updated_at, 80) || null,
    trialDays: Math.max(0, Math.floor(parseNumber(row.trial_days) ?? 0))
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can manage marketplace pricing.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace pricing runtime.");
  }

  return admin;
}

async function loadMarketplacePricingRow(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(pricingSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace pricing could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace pricing record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);
  const pricing = parseMarketplacePricingRecord(row);

  if (!id || !itemKey || !name || !pricing) {
    throw new Error("Marketplace pricing record is invalid.");
  }

  if (!isValidMarketplaceItemType(itemType)) {
    throw new Error("Marketplace item type is invalid.");
  }

  return { id, itemKey, itemType, name, pricing };
}

async function recordMarketplacePricingAudit(params: {
  item: {
    id: string;
    itemKey: string;
    itemType: string;
    name: string;
  };
  previousPricing: MarketplacePricingRecord;
  pricing: MarketplacePricingRecord;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.item.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_set_pricing",
    metadata: {
      billing_interval: params.pricing.billingInterval,
      currency: params.pricing.currency,
      item_id: params.item.id,
      item_key: params.item.itemKey,
      item_name: params.item.name,
      item_type: params.item.itemType,
      note: "Super Admin marketplace pricing runtime update. Pricing only. No payment processing, install execution, or public storefront exposure.",
      previous_pricing: params.previousPricing,
      price_amount: params.pricing.priceAmount,
      pricing_mode: params.pricing.mode,
      source: "super_admin_marketplace_pricing_runtime",
      trial_days: params.pricing.trialDays
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function getMarketplaceItemPricing(
  itemId: string
): Promise<MarketplacePricingRecord | null> {
  await requireSuperAdmin();

  try {
    const item = await loadMarketplacePricingRow(itemId);
    return item.pricing;
  } catch (error) {
    if (error instanceof Error && error.message === "Marketplace item was not found.") {
      return null;
    }

    throw error;
  }
}

export async function setMarketplaceItemPricing(
  itemId: string,
  input: MarketplacePricingInput
): Promise<MarketplacePricingUpdateResult> {
  const access = await requireSuperAdmin();
  const item = await loadMarketplacePricingRow(itemId);
  const validated = validateMarketplacePricingInput(input);
  const now = new Date().toISOString();

  const nextPricing: MarketplacePricingRecord = {
    billingInterval: validated.billingInterval,
    currency: validated.currency,
    mode: validated.pricingMode,
    priceAmount: validated.priceAmount,
    pricingUpdatedAt: now,
    trialDays: validated.trialDays
  };

  const isUnchanged =
    item.pricing.mode === nextPricing.mode &&
    item.pricing.priceAmount === nextPricing.priceAmount &&
    item.pricing.currency === nextPricing.currency &&
    item.pricing.billingInterval === nextPricing.billingInterval &&
    item.pricing.trialDays === nextPricing.trialDays;

  if (isUnchanged) {
    return {
      ...item.pricing,
      itemId: item.id,
      itemKey: item.itemKey,
      itemName: item.name,
      itemType: item.itemType,
      previousPricing: item.pricing
    };
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .update({
      billing_interval: nextPricing.billingInterval,
      currency: nextPricing.currency,
      price_amount: nextPricing.priceAmount,
      pricing_mode: nextPricing.mode,
      pricing_type: pricingTypeForMode(nextPricing.mode),
      pricing_updated_at: now,
      trial_days: nextPricing.trialDays
    } as never)
    .eq("id" as never, item.id as never)
    .select(pricingSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace pricing could not be updated: ${error.message}`);
  }

  const row = rowRecord(data);
  const pricing = row ? parseMarketplacePricingRecord(row) : null;

  if (!pricing) {
    throw new Error("Marketplace pricing update returned an invalid record.");
  }

  await recordMarketplacePricingAudit({
    item,
    previousPricing: item.pricing,
    pricing,
    userId: access.user.id
  });

  return {
    ...pricing,
    itemId: item.id,
    itemKey: item.itemKey,
    itemName: item.name,
    itemType: item.itemType,
    previousPricing: item.pricing
  };
}
