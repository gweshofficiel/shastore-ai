import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingRegistryType =
  | "affiliate"
  | "campaign"
  | "coupon"
  | "gift_code"
  | "promotion"
  | "referral";

export type MarketingRegistryStatus = "active" | "archived" | "draft" | "expired" | "paused";

export type MarketingRegistrySection =
  | "Affiliate program"
  | "Campaigns"
  | "Gift codes"
  | "Platform coupons"
  | "Platform promotions"
  | "Referral program";

export type MarketingRegistryItemRecord = {
  createdAt: string | null;
  description: string;
  id: string;
  marketingType: MarketingRegistryType;
  metadata: Record<string, unknown>;
  name: string;
  registryKey: string;
  revenueImpact: number;
  slug: string;
  status: MarketingRegistryStatus;
  targetAudience: string;
  updatedAt: string | null;
  usageCount: number;
};

export type MarketingRegistryCampaignView = {
  endDate: string | null;
  id: string;
  name: string;
  revenueImpact: number;
  section: MarketingRegistrySection;
  startDate: string | null;
  status: MarketingRegistryStatus;
  targetAudience: string;
  type: MarketingRegistryType;
  usage: number;
};

export const MARKETING_REGISTRY_TYPES: readonly MarketingRegistryType[] = [
  "coupon",
  "promotion",
  "gift_code",
  "referral",
  "affiliate",
  "campaign"
] as const;

export const MARKETING_REGISTRY_STATUSES: readonly MarketingRegistryStatus[] = [
  "draft",
  "active",
  "paused",
  "expired",
  "archived"
] as const;

const registrySelect =
  "id, registry_key, slug, name, marketing_type, status, target_audience, description, revenue_impact, usage_count, metadata, created_at, updated_at";

const sectionByType: Record<MarketingRegistryType, MarketingRegistrySection> = {
  affiliate: "Affiliate program",
  campaign: "Campaigns",
  coupon: "Platform coupons",
  gift_code: "Gift codes",
  promotion: "Platform promotions",
  referral: "Referral program"
};

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for the marketing registry.");
  }

  return admin;
}

export function isValidMarketingRegistryType(value: unknown): value is MarketingRegistryType {
  return typeof value === "string" && MARKETING_REGISTRY_TYPES.includes(value as MarketingRegistryType);
}

export function isValidMarketingRegistryStatus(value: unknown): value is MarketingRegistryStatus {
  return typeof value === "string" && MARKETING_REGISTRY_STATUSES.includes(value as MarketingRegistryStatus);
}

export function parseMarketingRegistryType(value: unknown): MarketingRegistryType | null {
  const cleaned = text(value, 80);
  return isValidMarketingRegistryType(cleaned) ? cleaned : null;
}

export function parseMarketingRegistryStatus(value: unknown): MarketingRegistryStatus | null {
  const cleaned = text(value, 80);
  return isValidMarketingRegistryStatus(cleaned) ? cleaned : null;
}

export function sectionForMarketingRegistryType(type: MarketingRegistryType): MarketingRegistrySection {
  return sectionByType[type];
}

export function parseMarketingRegistryItem(row: unknown): MarketingRegistryItemRecord | null {
  if (!row || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  const id = text(record.id, 120);
  const registryKey = text(record.registry_key, 160);
  const slug = text(record.slug, 160);
  const name = text(record.name, 200);
  const marketingType = parseMarketingRegistryType(record.marketing_type);
  const status = parseMarketingRegistryStatus(record.status);

  if (!id || !registryKey || !slug || !name || !marketingType || !status) {
    return null;
  }

  return {
    createdAt: text(record.created_at, 80) || null,
    description: text(record.description, 2000),
    id,
    marketingType,
    metadata: safeRecord(record.metadata),
    name,
    registryKey,
    revenueImpact: Math.max(0, safeNumber(record.revenue_impact)),
    slug,
    status,
    targetAudience: text(record.target_audience, 500),
    updatedAt: text(record.updated_at, 80) || null,
    usageCount: Math.max(0, Math.trunc(safeNumber(record.usage_count))),
  };
}

export function resolveMarketingRegistrySection(item: MarketingRegistryItemRecord): MarketingRegistrySection {
  const metadataSection = text(item.metadata.section, 120);

  if (
    metadataSection === "Affiliate program" ||
    metadataSection === "Campaigns" ||
    metadataSection === "Gift codes" ||
    metadataSection === "Platform coupons" ||
    metadataSection === "Platform promotions" ||
    metadataSection === "Referral program"
  ) {
    return metadataSection;
  }

  return sectionForMarketingRegistryType(item.marketingType);
}

export function toMarketingRegistryCampaignView(
  item: MarketingRegistryItemRecord,
  statusOverride?: MarketingRegistryStatus
): MarketingRegistryCampaignView {
  const metadata = item.metadata;

  return {
    endDate: text(metadata.end_date, 80) || null,
    id: item.registryKey,
    name: item.name,
    revenueImpact: item.revenueImpact,
    section: resolveMarketingRegistrySection(item),
    startDate: text(metadata.start_date, 80) || null,
    status: statusOverride ?? item.status,
    targetAudience: item.targetAudience,
    type: item.marketingType,
    usage: item.usageCount
  };
}

export const MARKETING_REGISTRY_FALLBACK_ITEMS: readonly MarketingRegistryItemRecord[] = [
  {
    createdAt: null,
    description: "Platform coupon foundation for welcome plan credit.",
    id: "fallback-platform-coupon-welcome-plan-credit",
    marketingType: "coupon",
    metadata: { section: "Platform coupons", source: "marketing_registry_fallback" },
    name: "Welcome Plan Credit",
    registryKey: "platform-coupon:welcome-plan-credit",
    revenueImpact: 0,
    slug: "welcome-plan-credit",
    status: "draft",
    targetAudience: "New SHASTORE platform subscribers",
    updatedAt: null,
    usageCount: 0
  },
  {
    createdAt: null,
    description: "Platform promotion foundation for annual upgrade incentives.",
    id: "fallback-platform-promotion-annual-upgrade",
    marketingType: "promotion",
    metadata: { section: "Platform promotions", source: "marketing_registry_fallback" },
    name: "Annual Upgrade Promotion",
    registryKey: "platform-promotion:annual-upgrade",
    revenueImpact: 0,
    slug: "annual-upgrade",
    status: "draft",
    targetAudience: "Monthly plan customers",
    updatedAt: null,
    usageCount: 0
  },
  {
    createdAt: null,
    description: "Gift code foundation for launch credit distribution.",
    id: "fallback-gift-code-launch-credit",
    marketingType: "gift_code",
    metadata: { section: "Gift codes", source: "marketing_registry_fallback" },
    name: "Launch Credit Gift Code",
    registryKey: "gift-code:launch-credit",
    revenueImpact: 0,
    slug: "launch-credit",
    status: "draft",
    targetAudience: "Selected launch partners",
    updatedAt: null,
    usageCount: 0
  },
  {
    createdAt: null,
    description: "Referral program foundation for store owner invites.",
    id: "fallback-referral-owner-invite",
    marketingType: "referral",
    metadata: { section: "Referral program", source: "marketing_registry_fallback" },
    name: "Store Owner Referral Foundation",
    registryKey: "referral:owner-invite",
    revenueImpact: 0,
    slug: "owner-invite",
    status: "draft",
    targetAudience: "Existing store owners",
    updatedAt: null,
    usageCount: 0
  },
  {
    createdAt: null,
    description: "Affiliate program foundation for creator partnerships.",
    id: "fallback-affiliate-creator-partners",
    marketingType: "affiliate",
    metadata: { section: "Affiliate program", source: "marketing_registry_fallback" },
    name: "Creator Affiliate Foundation",
    registryKey: "affiliate:creator-partners",
    revenueImpact: 0,
    slug: "creator-partners",
    status: "draft",
    targetAudience: "Creators, agencies, and future reseller partners",
    updatedAt: null,
    usageCount: 0
  },
  {
    createdAt: null,
    description: "Campaign foundation for platform-wide announcements.",
    id: "fallback-campaign-platform-announcements",
    marketingType: "campaign",
    metadata: { section: "Campaigns", source: "marketing_registry_fallback" },
    name: "Platform Announcement Campaign",
    registryKey: "campaign:platform-announcements",
    revenueImpact: 0,
    slug: "platform-announcements",
    status: "paused",
    targetAudience: "All SHASTORE platform users",
    updatedAt: null,
    usageCount: 0
  }
];

export async function listMarketingRegistryItemsReadOnly(): Promise<MarketingRegistryItemRecord[]> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketing_registry_items" as never)
    .select(registrySelect as never)
    .order("updated_at" as never, { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Marketing registry items could not be listed: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketingRegistryItem(row))
    .filter((item): item is MarketingRegistryItemRecord => Boolean(item));
}

export async function listMarketingRegistryItemsReadOnlySafe(): Promise<{
  items: MarketingRegistryItemRecord[];
  source: "database" | "fallback";
  warning: string | null;
}> {
  try {
    const items = await listMarketingRegistryItemsReadOnly();

    if (!items.length) {
      return {
        items: [...MARKETING_REGISTRY_FALLBACK_ITEMS],
        source: "fallback",
        warning: "Marketing registry table is empty. Showing fallback registry rows."
      };
    }

    return {
      items,
      source: "database",
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-registry-runtime] read-only registry load failed", error);

    return {
      items: [...MARKETING_REGISTRY_FALLBACK_ITEMS],
      source: "fallback",
      warning: message
    };
  }
}
