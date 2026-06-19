import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMarketingTypeBadgeTone,
  getMarketingTypeDescription,
  getMarketingTypeLabel,
  getMarketingTypeSection,
  isValidMarketingType,
  parseMarketingType,
  type MarketingType,
  type MarketingTypeSection
} from "@/src/lib/marketing/marketing-type-runtime";
import {
  getMarketingStatusBadgeTone,
  getMarketingStatusDescription,
  getMarketingStatusLabel,
  isValidMarketingStatus,
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import {
  resolveMarketingAudienceView,
  type MarketingAudience
} from "@/src/lib/marketing/marketing-audience-runtime";
import {
  resolveMarketingCampaignLifecycleView,
  type MarketingLifecycleActionDefinition
} from "@/src/lib/marketing/marketing-campaign-lifecycle-runtime";

export type MarketingRegistryType = MarketingType;

export type MarketingRegistryStatus = MarketingStatus;

export type MarketingRegistrySection = MarketingTypeSection;

export type MarketingRegistryItemRecord = {
  createdAt: string | null;
  description: string;
  id: string;
  marketingType: MarketingType;
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
  audienceBadgeTone: ReturnType<typeof resolveMarketingAudienceView>["audienceBadgeTone"];
  audienceDescription: string;
  audienceKey: MarketingAudience | null;
  audienceLabel: string;
  endDate: string | null;
  id: string;
  lifecycleActions: MarketingLifecycleActionDefinition[];
  lifecycleDescription: string;
  lifecycleLabel: string;
  lifecycleState: MarketingRegistryStatus;
  name: string;
  revenueImpact: number;
  section: MarketingRegistrySection;
  startDate: string | null;
  status: MarketingRegistryStatus;
  statusBadgeTone: ReturnType<typeof getMarketingStatusBadgeTone>;
  statusDescription: string;
  statusLabel: string;
  targetAudience: string;
  targetAudienceSummary: string;
  type: MarketingType;
  typeBadgeTone: ReturnType<typeof getMarketingTypeBadgeTone>;
  typeDescription: string;
  typeLabel: string;
  usage: number;
};

export const MARKETING_REGISTRY_TYPES = [
  "coupon",
  "promotion",
  "gift_code",
  "referral",
  "affiliate",
  "campaign"
] as const satisfies readonly MarketingType[];

export const MARKETING_REGISTRY_STATUSES = [
  "draft",
  "active",
  "paused",
  "expired",
  "archived"
] as const satisfies readonly MarketingStatus[];

const registrySelect =
  "id, registry_key, slug, name, marketing_type, status, target_audience, description, revenue_impact, usage_count, metadata, created_at, updated_at";

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
  return isValidMarketingType(value);
}

export function isValidMarketingRegistryStatus(value: unknown): value is MarketingRegistryStatus {
  return isValidMarketingStatus(value);
}

export function parseMarketingRegistryStatus(value: unknown): MarketingRegistryStatus | null {
  return parseMarketingStatus(value);
}

export function parseMarketingRegistryType(value: unknown): MarketingRegistryType | null {
  return parseMarketingType(value);
}

export function sectionForMarketingRegistryType(type: MarketingRegistryType): MarketingRegistrySection {
  return getMarketingTypeSection(type);
}

export function parseMarketingRegistryItem(row: unknown): MarketingRegistryItemRecord | null {
  if (!row || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  const id = text(record.id, 120);
  const registryKey = text(record.registry_key, 160);
  const slug = text(record.slug, 160);
  const name = text(record.name, 200);
  const marketingType = parseMarketingType(record.marketing_type);
  const status = parseMarketingRegistryStatus(record.status);

  if (!id || !registryKey || !slug || !name || !marketingType || !status) {
    if (id && registryKey && !marketingType) {
      console.warn(
        `[marketing-registry-runtime] skipped registry item with invalid marketing_type: ${text(record.marketing_type, 80) || "empty"}`
      );
    }

    if (id && registryKey && marketingType && !status) {
      console.warn(
        `[marketing-registry-runtime] skipped registry item with invalid status: ${text(record.status, 80) || "empty"}`
      );
    }

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

  return getMarketingTypeSection(item.marketingType);
}

export function toMarketingRegistryCampaignView(
  item: MarketingRegistryItemRecord,
  statusOverride?: MarketingRegistryStatus
): MarketingRegistryCampaignView {
  const metadata = item.metadata;
  const resolvedStatus = statusOverride ?? item.status;
  const audience = resolveMarketingAudienceView({
    marketingType: item.marketingType,
    metadata,
    registryKey: item.registryKey,
    targetAudience: item.targetAudience
  });
  const lifecycle = resolveMarketingCampaignLifecycleView(resolvedStatus);

  return {
    audienceBadgeTone: audience.audienceBadgeTone,
    audienceDescription: audience.audienceDescription,
    audienceKey: audience.audienceKey,
    audienceLabel: audience.audienceLabel,
    endDate: text(metadata.end_date, 80) || null,
    id: item.registryKey,
    lifecycleActions: lifecycle.actions,
    lifecycleDescription: lifecycle.lifecycleDescription,
    lifecycleLabel: lifecycle.lifecycleLabel,
    lifecycleState: lifecycle.lifecycleState,
    name: item.name,
    revenueImpact: item.revenueImpact,
    section: resolveMarketingRegistrySection(item),
    startDate: text(metadata.start_date, 80) || null,
    status: resolvedStatus,
    statusBadgeTone: getMarketingStatusBadgeTone(resolvedStatus),
    statusDescription: getMarketingStatusDescription(resolvedStatus),
    statusLabel: getMarketingStatusLabel(resolvedStatus),
    targetAudience: audience.targetAudienceSummary,
    targetAudienceSummary: audience.targetAudienceSummary,
    type: item.marketingType,
    typeBadgeTone: getMarketingTypeBadgeTone(item.marketingType),
    typeDescription: getMarketingTypeDescription(item.marketingType),
    typeLabel: getMarketingTypeLabel(item.marketingType),
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

export type {
  MarketingAudience,
  MarketingAudienceBadgeTone,
  MarketingAudienceCatalogEntry,
  MarketingAudienceStats,
  MarketingAudienceView
} from "@/src/lib/marketing/marketing-audience-runtime";
export {
  assertValidMarketingAudience,
  countMarketingItemsByAudience,
  getMarketingAudienceBadgeTone,
  getMarketingAudienceDescription,
  getMarketingAudienceLabel,
  isValidMarketingAudience,
  listMarketingAudienceCatalog,
  MARKETING_AUDIENCES,
  parseMarketingAudience,
  resolveMarketingAudienceDescription,
  resolveMarketingAudienceKey,
  resolveMarketingAudienceLabel,
  resolveMarketingAudienceView,
  sanitizeMarketingAudienceSummary
} from "@/src/lib/marketing/marketing-audience-runtime";
export type {
  MarketingCampaignLifecycleView,
  MarketingLifecycleAction,
  MarketingLifecycleActionDefinition
} from "@/src/lib/marketing/marketing-campaign-lifecycle-runtime";
export {
  getMarketingLifecycleActionDescription,
  getMarketingLifecycleActionLabel,
  getMarketingLifecycleDescription,
  getMarketingLifecycleLabel,
  isMarketingLifecycleActionReady,
  listMarketingLifecycleActionsForStatus,
  MARKETING_LIFECYCLE_ACTIONS,
  resolveMarketingCampaignLifecycleView,
  resolveMarketingLifecycleActionReadiness,
  sanitizeMarketingLifecycleNote
} from "@/src/lib/marketing/marketing-campaign-lifecycle-runtime";
export type {
  MarketingCouponDiscountType,
  MarketingCouponView
} from "@/src/lib/marketing/marketing-coupon-runtime";
export {
  buildMarketingCouponViewsFromCampaigns,
  buildMarketingCouponViewsFromRegistryItems,
  buildMarketingCouponViewsSafe,
  getMarketingCouponBadgeTone,
  getMarketingCouponDiscountTypeLabel,
  MARKETING_COUPON_DISCOUNT_TYPES,
  MARKETING_COUPON_FALLBACK_VIEWS
} from "@/src/lib/marketing/marketing-coupon-runtime";
export type {
  MarketingPromotionIncentiveType,
  MarketingPromotionView
} from "@/src/lib/marketing/marketing-promotion-runtime";
export {
  buildMarketingPromotionViewsFromCampaigns,
  buildMarketingPromotionViewsFromRegistryItems,
  buildMarketingPromotionViewsSafe,
  getMarketingPromotionBadgeTone,
  getMarketingPromotionIncentiveTypeLabel,
  MARKETING_PROMOTION_FALLBACK_VIEWS,
  MARKETING_PROMOTION_INCENTIVE_TYPES
} from "@/src/lib/marketing/marketing-promotion-runtime";
export type {
  MarketingGiftCodeCreditType,
  MarketingGiftCodeView
} from "@/src/lib/marketing/marketing-gift-code-runtime";
export {
  buildMarketingGiftCodeViewsFromCampaigns,
  buildMarketingGiftCodeViewsFromRegistryItems,
  buildMarketingGiftCodeViewsSafe,
  getMarketingGiftCodeBadgeTone,
  getMarketingGiftCodeCreditTypeLabel,
  MARKETING_GIFT_CODE_CREDIT_TYPES,
  MARKETING_GIFT_CODE_FALLBACK_VIEWS
} from "@/src/lib/marketing/marketing-gift-code-runtime";
export type {
  MarketingGiftCodeRedemptionInput,
  MarketingGiftCodeRedemptionIssue,
  MarketingGiftCodeRedemptionIssueSeverity,
  MarketingGiftCodeRedemptionState,
  MarketingGiftCodeRedemptionView
} from "@/src/lib/marketing/marketing-gift-code-redemption-runtime";
export {
  getMarketingGiftCodeRedemptionBadgeTone,
  getMarketingGiftCodeRedemptionDescription,
  getMarketingGiftCodeRedemptionLabel,
  isMarketingGiftCodeRedemptionReady,
  isValidMarketingGiftCodeRedemptionState,
  listMarketingGiftCodeRedemptionIssues,
  MARKETING_GIFT_CODE_REDEMPTION_STATES,
  resolveMarketingGiftCodeRedemptionState,
  resolveMarketingGiftCodeRedemptionView,
  resolveMarketingGiftCodeRedemptionViewSafe
} from "@/src/lib/marketing/marketing-gift-code-redemption-runtime";
export type {
  MarketingGiftCodeCreditInput,
  MarketingGiftCodeCreditIssue,
  MarketingGiftCodeCreditIssueSeverity,
  MarketingGiftCodeCreditReadinessState,
  MarketingGiftCodeCreditView
} from "@/src/lib/marketing/marketing-gift-code-credit-runtime";
export {
  getMarketingGiftCodeCreditReadinessBadgeTone,
  getMarketingGiftCodeCreditReadinessDescription,
  getMarketingGiftCodeCreditReadinessLabel,
  isMarketingGiftCodeCreditReadinessReady,
  isValidMarketingGiftCodeCreditReadinessState,
  listMarketingGiftCodeCreditIssues,
  MARKETING_GIFT_CODE_CREDIT_READINESS_STATES,
  resolveMarketingGiftCodeCreditReadinessState,
  resolveMarketingGiftCodeCreditView,
  resolveMarketingGiftCodeCreditViewSafe
} from "@/src/lib/marketing/marketing-gift-code-credit-runtime";
export type {
  MarketingReferralProgramType,
  MarketingReferralView
} from "@/src/lib/marketing/marketing-referral-runtime";
export {
  buildMarketingReferralViewsFromCampaigns,
  buildMarketingReferralViewsFromRegistryItems,
  buildMarketingReferralViewsSafe,
  getMarketingReferralBadgeTone,
  getMarketingReferralProgramTypeLabel,
  MARKETING_REFERRAL_FALLBACK_VIEWS,
  MARKETING_REFERRAL_PROGRAM_TYPES
} from "@/src/lib/marketing/marketing-referral-runtime";
export type {
  MarketingReferralTrackingInput,
  MarketingReferralTrackingIssue,
  MarketingReferralTrackingIssueSeverity,
  MarketingReferralTrackingState,
  MarketingReferralTrackingSummaryRecord,
  MarketingReferralTrackingSummaryStatus,
  MarketingReferralTrackingView
} from "@/src/lib/marketing/marketing-referral-tracking-runtime";
export {
  getMarketingReferralTrackingBadgeTone,
  getMarketingReferralTrackingDescription,
  getMarketingReferralTrackingLabel,
  indexMarketingReferralTrackingSummariesByRegistryKey,
  isMarketingReferralTrackingReady,
  isValidMarketingReferralTrackingState,
  isValidMarketingReferralTrackingSummaryStatus,
  listMarketingReferralTrackingIssues,
  listMarketingReferralTrackingSummariesReadOnly,
  listMarketingReferralTrackingSummariesReadOnlySafe,
  MARKETING_REFERRAL_TRACKING_FALLBACK_SUMMARIES,
  MARKETING_REFERRAL_TRACKING_STATES,
  MARKETING_REFERRAL_TRACKING_SUMMARY_STATUSES,
  parseMarketingReferralTrackingSummary,
  parseMarketingReferralTrackingSummaryStatus,
  resolveMarketingReferralTrackingCounts,
  resolveMarketingReferralTrackingState,
  resolveMarketingReferralTrackingSummaryText,
  resolveMarketingReferralTrackingView,
  resolveMarketingReferralTrackingViewSafe
} from "@/src/lib/marketing/marketing-referral-tracking-runtime";
export type {
  MarketingPromotionScheduleState,
  MarketingPromotionSchedulingInput,
  MarketingPromotionSchedulingView
} from "@/src/lib/marketing/marketing-promotion-scheduling-runtime";
export {
  buildMarketingPromotionScheduleLabel,
  getMarketingPromotionScheduleBadgeTone,
  getMarketingPromotionScheduleDescription,
  getMarketingPromotionScheduleLabel,
  isValidMarketingPromotionScheduleState,
  resolveMarketingPromotionScheduleBounds,
  resolveMarketingPromotionScheduleState,
  resolveMarketingPromotionSchedulingView,
  resolveMarketingPromotionSchedulingViewSafe,
  resolveMarketingPromotionTimezoneDisplay
} from "@/src/lib/marketing/marketing-promotion-scheduling-runtime";
export type {
  MarketingPromotionAudienceInput,
  MarketingPromotionAudienceReadinessState,
  MarketingPromotionAudienceView
} from "@/src/lib/marketing/marketing-promotion-audience-runtime";
export {
  getMarketingPromotionAudienceReadinessBadgeTone,
  getMarketingPromotionAudienceReadinessDescription,
  getMarketingPromotionAudienceReadinessLabel,
  isValidMarketingPromotionAudienceReadinessState,
  resolveMarketingPromotionAudienceReadinessState,
  resolveMarketingPromotionAudienceView,
  resolveMarketingPromotionAudienceViewSafe
} from "@/src/lib/marketing/marketing-promotion-audience-runtime";
export type {
  MarketingPromotionMetricsSnapshot,
  MarketingPromotionMetricsSummary
} from "@/src/lib/marketing/marketing-promotion-metrics-runtime";
export {
  averageMarketingPromotionUsageCount,
  buildMarketingPromotionMetricsSummary,
  buildMarketingPromotionMetricsSummarySafe,
  countMarketingPromotionNeedsReview,
  countMarketingPromotionsByScheduleState,
  countMarketingPromotionsByStatus,
  MARKETING_PROMOTION_METRICS_FALLBACK_SUMMARY,
  sumMarketingPromotionRevenueImpact,
  sumMarketingPromotionUsageCount
} from "@/src/lib/marketing/marketing-promotion-metrics-runtime";
export type {
  MarketingCouponValidationInput,
  MarketingCouponValidationIssue,
  MarketingCouponValidationIssueSeverity,
  MarketingCouponValidationState,
  MarketingCouponValidationView
} from "@/src/lib/marketing/marketing-coupon-validation-runtime";
export {
  assertValidMarketingCouponValidationInput,
  getMarketingCouponValidationBadgeTone,
  getMarketingCouponValidationDescription,
  getMarketingCouponValidationLabel,
  isMarketingCouponValidationReady,
  isValidMarketingCouponValidationState,
  listMarketingCouponValidationIssues,
  resolveMarketingCouponValidationState,
  resolveMarketingCouponValidationView,
  resolveMarketingCouponValidationViewSafe
} from "@/src/lib/marketing/marketing-coupon-validation-runtime";
export type {
  MarketingCouponEligibilityInput,
  MarketingCouponEligibilityIssue,
  MarketingCouponEligibilityIssueSeverity,
  MarketingCouponEligibilityState,
  MarketingCouponEligibilityView
} from "@/src/lib/marketing/marketing-coupon-eligibility-runtime";
export {
  getMarketingCouponEligibilityBadgeTone,
  getMarketingCouponEligibilityDescription,
  getMarketingCouponEligibilityLabel,
  isMarketingCouponEligibilityReady,
  isValidMarketingCouponEligibilityState,
  listMarketingCouponEligibilityIssues,
  resolveMarketingCouponEligibilityState,
  resolveMarketingCouponEligibilityView,
  resolveMarketingCouponEligibilityViewSafe
} from "@/src/lib/marketing/marketing-coupon-eligibility-runtime";
export type {
  MarketingCouponUsageInput,
  MarketingCouponUsageSummaryRecord,
  MarketingCouponUsageTrackingSource,
  MarketingCouponUsageTrackingState,
  MarketingCouponUsageTrackingStatus,
  MarketingCouponUsageView
} from "@/src/lib/marketing/marketing-coupon-usage-runtime";
export {
  getMarketingCouponUsageTrackingBadgeTone,
  getMarketingCouponUsageTrackingDescription,
  getMarketingCouponUsageTrackingLabel,
  indexMarketingCouponUsageSummariesByRegistryKey,
  isValidMarketingCouponUsageTrackingStatus,
  listMarketingCouponUsageSummariesReadOnly,
  listMarketingCouponUsageSummariesReadOnlySafe,
  MARKETING_COUPON_USAGE_FALLBACK_SUMMARIES,
  MARKETING_COUPON_USAGE_TRACKING_STATUSES,
  parseMarketingCouponUsageSummary,
  parseMarketingCouponUsageTrackingStatus,
  resolveMarketingCouponUsageCount,
  resolveMarketingCouponUsageLimitLabel,
  resolveMarketingCouponUsageSummaryText,
  resolveMarketingCouponUsageTrackingSource,
  resolveMarketingCouponUsageTrackingState,
  resolveMarketingCouponUsageView,
  resolveMarketingCouponUsageViewSafe
} from "@/src/lib/marketing/marketing-coupon-usage-runtime";
export type {
  MarketingCouponAnalyticsCouponSnapshot,
  MarketingCouponAnalyticsSummary
} from "@/src/lib/marketing/marketing-coupon-analytics-runtime";
export {
  averageMarketingCouponUsageCount,
  buildMarketingCouponAnalyticsSummary,
  buildMarketingCouponAnalyticsSummarySafe,
  countMarketingCouponHighUsage,
  countMarketingCouponNeedsReview,
  countMarketingCouponsByStatus,
  MARKETING_COUPON_ANALYTICS_FALLBACK_SUMMARY,
  sumMarketingCouponUsageCount
} from "@/src/lib/marketing/marketing-coupon-analytics-runtime";
export type {
  MarketingStatus,
  MarketingStatusBadgeTone,
  MarketingStatusCatalogEntry,
  MarketingStatusOverview,
  MarketingStatusStats,
  MarketingPlatformActionEventType
} from "@/src/lib/marketing/marketing-status-runtime";
export {
  assertValidMarketingStatus,
  countMarketingItemsByStatus,
  countMarketingStatusOverview,
  getMarketingStatusBadgeTone,
  getMarketingStatusDescription,
  getMarketingStatusLabel,
  indexLatestMarketingPlatformActions,
  isMarketingPlatformActionEventType,
  isValidMarketingStatus,
  listMarketingStatusCatalog,
  MARKETING_PLATFORM_ACTION_EVENT_TYPES,
  MARKETING_STATUSES,
  parseMarketingStatus,
  resolveMarketingRegistryStatus,
  resolveMarketingStatusBadgeTone,
  resolveMarketingStatusDescription,
  resolveMarketingStatusFromPlatformAction,
  resolveMarketingStatusLabel
} from "@/src/lib/marketing/marketing-status-runtime";
export type {
  MarketingType,
  MarketingTypeBadgeTone,
  MarketingTypeCatalogEntry,
  MarketingTypeGroup,
  MarketingTypeSection,
  MarketingTypeStats
} from "@/src/lib/marketing/marketing-type-runtime";
export {
  assertValidMarketingType,
  countMarketingItemsByType,
  filterMarketingItemsByType,
  getMarketingTypeBadgeTone,
  getMarketingTypeDescription,
  getMarketingTypeLabel,
  getMarketingTypeSection,
  getMarketingTypeSectionLabel,
  groupMarketingRegistryItemsByType,
  isValidMarketingType,
  listMarketingTypeCatalog,
  MARKETING_TYPES,
  parseMarketingType,
  resolveMarketingTypeBadgeTone,
  resolveMarketingTypeLabel
} from "@/src/lib/marketing/marketing-type-runtime";
