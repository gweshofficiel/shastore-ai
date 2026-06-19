import "server-only";

import type { MarketingRegistryItemRecord } from "@/src/lib/marketing/marketing-registry-runtime";
import {
  getMarketingStatusBadgeTone,
  getMarketingStatusDescription,
  getMarketingStatusLabel,
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import {
  resolveMarketingCouponEligibilityViewSafe,
  type MarketingCouponEligibilityView
} from "@/src/lib/marketing/marketing-coupon-eligibility-runtime";
import {
  resolveMarketingCouponValidationViewSafe,
  type MarketingCouponValidationView
} from "@/src/lib/marketing/marketing-coupon-validation-runtime";
import type { MarketingType } from "@/src/lib/marketing/marketing-type-runtime";

type MarketingCouponCampaignSource = {
  audienceLabel: string;
  id: string;
  lifecycleState: MarketingStatus;
  name: string;
  revenueImpact: number;
  status: MarketingStatus;
  statusBadgeTone: ReturnType<typeof getMarketingStatusBadgeTone>;
  statusDescription: string;
  statusLabel: string;
  targetAudienceSummary: string;
  type: MarketingType;
  typeDescription: string;
  usage: number;
};

export type MarketingCouponDiscountType = "fixed" | "percentage" | "plan_credit";

export type MarketingCouponView = {
  amount: string;
  code: string;
  couponDescription: string;
  couponLabel: string;
  description: string;
  discountType: MarketingCouponDiscountType;
  metadataSummary: string;
  name: string;
  planEligibility: string;
  registryKey: string;
  revenueImpact: number;
  slug: string;
  status: MarketingStatus;
  statusBadgeTone: ReturnType<typeof getMarketingStatusBadgeTone>;
  statusDescription: string;
  statusLabel: string;
  targetAudienceSummary: string;
  usageCount: number;
  usageLimit: string;
} & MarketingCouponValidationView &
  MarketingCouponEligibilityView;

export const MARKETING_COUPON_DISCOUNT_TYPES: readonly MarketingCouponDiscountType[] = [
  "percentage",
  "fixed",
  "plan_credit"
] as const;

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,})/i;

const registryCouponDisplayMap: Record<
  string,
  Pick<MarketingCouponView, "amount" | "code" | "discountType" | "planEligibility" | "usageLimit">
> = {
  "platform-coupon:welcome-plan-credit": {
    amount: "10%",
    code: "PLATFORM-WELCOME",
    discountType: "percentage",
    planEligibility: "Starter, Growth, Pro",
    usageLimit: "Placeholder limit"
  },
  "platform-promotion:annual-upgrade": {
    amount: "1 month credit",
    code: "PLAN-CREDIT-DRAFT",
    discountType: "plan_credit",
    planEligibility: "Growth, Pro",
    usageLimit: "Internal review only"
  }
};

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

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isValidMarketingCouponDiscountType(value: unknown): value is MarketingCouponDiscountType {
  return typeof value === "string" && MARKETING_COUPON_DISCOUNT_TYPES.includes(value as MarketingCouponDiscountType);
}

function parseMarketingCouponDiscountType(value: unknown): MarketingCouponDiscountType {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingCouponDiscountType(cleaned) ? cleaned : "percentage";
}

function sanitizeCouponDisplayValue(value: unknown, fallback: string) {
  const cleaned = text(value, 200);

  if (!cleaned || secretPattern.test(cleaned)) {
    return fallback;
  }

  return cleaned;
}

function buildCouponCode(params: { metadata: Record<string, unknown>; registryKey: string; slug: string }) {
  const mapped = registryCouponDisplayMap[params.registryKey]?.code;
  if (mapped) return mapped;

  const metadataCode = sanitizeCouponDisplayValue(
    metadataValue(params.metadata, ["coupon_code", "code", "display_code"]),
    ""
  );

  if (metadataCode) return metadataCode;

  const slugCode = params.slug.replace(/-/g, "_").toUpperCase();
  return slugCode ? `COUPON-${slugCode}` : "COUPON-DRAFT";
}

function metadataValue(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(metadata[key], 200);
    if (value) return value;
  }

  return "";
}

function attachMarketingCouponRuntimeLayers(
  view: Omit<
    MarketingCouponView,
    keyof MarketingCouponValidationView | keyof MarketingCouponEligibilityView
  > &
    Partial<MarketingCouponValidationView> &
    Partial<MarketingCouponEligibilityView>,
  params: {
    exists?: boolean;
    lifecycleState?: MarketingStatus;
    marketingType: MarketingType;
    metadata?: Record<string, unknown>;
  }
): MarketingCouponView {
  const validation = resolveMarketingCouponValidationViewSafe({
    code: view.code,
    exists: params.exists,
    marketingType: params.marketingType,
    metadata: params.metadata,
    registryKey: view.registryKey,
    slug: view.slug,
    status: view.status,
    targetAudienceSummary: view.targetAudienceSummary
  });

  const eligibility = resolveMarketingCouponEligibilityViewSafe({
    exists: params.exists,
    lifecycleState: params.lifecycleState ?? view.status,
    marketingType: params.marketingType,
    metadata: params.metadata,
    registryKey: view.registryKey,
    status: view.status,
    targetAudienceSummary: view.targetAudienceSummary,
    validationReady: validation.validationReady,
    validationState: validation.validationState
  });

  return {
    ...view,
    ...validation,
    ...eligibility
  };
}

export const MARKETING_COUPON_FALLBACK_VIEWS: readonly MarketingCouponView[] = [
  attachMarketingCouponRuntimeLayers(
    {
      amount: "10%",
      code: "PLATFORM-WELCOME",
      couponDescription: "Platform coupon foundation for welcome plan credit.",
      couponLabel: "Platform coupon",
      description: "Platform coupon foundation for welcome plan credit.",
      discountType: "percentage",
      metadataSummary: "Foundation coupon display only. Validation-readiness checks only.",
      name: "Welcome Plan Credit",
      planEligibility: "Starter, Growth, Pro",
      registryKey: "platform-coupon:welcome-plan-credit",
      revenueImpact: 0,
      slug: "welcome-plan-credit",
      status: "draft",
      statusBadgeTone: "amber",
      statusDescription: getMarketingStatusDescription("draft"),
      statusLabel: getMarketingStatusLabel("draft"),
      targetAudienceSummary: "New SHASTORE platform subscribers",
      usageCount: 0,
      usageLimit: "Placeholder limit"
    },
    {
      exists: true,
      lifecycleState: "draft",
      marketingType: "coupon",
      metadata: { section: "Platform coupons", source: "marketing_registry_fallback" }
    }
  ),
  attachMarketingCouponRuntimeLayers(
    {
      amount: "1 month credit",
      code: "PLAN-CREDIT-DRAFT",
      couponDescription: "Legacy coupon-table display linked to annual upgrade promotion foundation.",
      couponLabel: "Plan credit coupon",
      description: "Legacy coupon-table display linked to annual upgrade promotion foundation.",
      discountType: "plan_credit",
      metadataSummary: "Legacy admin display row. No billing discount application.",
      name: "Annual Upgrade Promotion",
      planEligibility: "Growth, Pro",
      registryKey: "platform-promotion:annual-upgrade",
      revenueImpact: 0,
      slug: "annual-upgrade",
      status: "draft",
      statusBadgeTone: "amber",
      statusDescription: getMarketingStatusDescription("draft"),
      statusLabel: getMarketingStatusLabel("draft"),
      targetAudienceSummary: "Monthly plan customers",
      usageCount: 0,
      usageLimit: "Internal review only"
    },
    {
      exists: true,
      lifecycleState: "draft",
      marketingType: "promotion",
      metadata: { section: "Platform promotions", source: "marketing_registry_fallback" }
    }
  )
];

function buildMetadataSummary(metadata: Record<string, unknown>) {
  const summary = sanitizeCouponDisplayValue(
    metadataValue(metadata, ["metadata_summary", "summary", "public_summary"]),
    "Foundation coupon display only. Validation-readiness checks only."
  );

  if (secretPattern.test(summary)) {
    return "Coupon metadata summary hidden for safety.";
  }

  return summary;
}

function toMarketingCouponViewFromCampaign(
  campaign: MarketingCouponCampaignSource & {
    description?: string;
    metadata?: Record<string, unknown>;
    slug?: string;
  }
): MarketingCouponView | null {
  if (campaign.type !== "coupon" && campaign.id !== "platform-promotion:annual-upgrade") {
    return null;
  }

  const metadata = safeRecord(campaign.metadata);
  const registryKey = text(campaign.id, 160);
  const slug = text(campaign.slug, 160) || registryKey.split(":").pop() || "coupon";
  const mapped = registryCouponDisplayMap[registryKey];
  const status = parseMarketingStatus(campaign.status) ?? "draft";
  const description = sanitizeCouponDisplayValue(
    campaign.description ?? metadataValue(metadata, ["description", "coupon_description"]),
    campaign.typeDescription || "Platform coupon foundation."
  );

  return attachMarketingCouponRuntimeLayers(
    {
      amount: sanitizeCouponDisplayValue(
        metadataValue(metadata, ["amount", "amount_label", "discount_amount"]),
        mapped?.amount ?? "Placeholder amount"
      ),
      code: buildCouponCode({ metadata, registryKey, slug }),
      couponDescription: description,
      couponLabel: campaign.type === "coupon" ? "Platform coupon" : "Plan credit coupon",
      description,
      discountType: parseMarketingCouponDiscountType(
        metadataValue(metadata, ["discount_type", "coupon_discount_type"]) || mapped?.discountType
      ),
      metadataSummary: buildMetadataSummary(metadata),
      name: sanitizeCouponDisplayValue(campaign.name, "Marketing coupon"),
      planEligibility: sanitizeCouponDisplayValue(
        metadataValue(metadata, ["plan_eligibility", "eligible_plans"]),
        mapped?.planEligibility ?? "Internal review only"
      ),
      registryKey,
      revenueImpact: Math.max(0, campaign.revenueImpact),
      slug,
      status,
      statusBadgeTone: campaign.statusBadgeTone ?? getMarketingStatusBadgeTone(status),
      statusDescription: campaign.statusDescription ?? getMarketingStatusDescription(status),
      statusLabel: campaign.statusLabel ?? getMarketingStatusLabel(status),
      targetAudienceSummary: sanitizeCouponDisplayValue(
        campaign.targetAudienceSummary,
        campaign.audienceLabel || "Audience summary unavailable."
      ),
      usageCount: Math.max(0, Math.trunc(campaign.usage)),
      usageLimit: sanitizeCouponDisplayValue(
        metadataValue(metadata, ["usage_limit", "coupon_usage_limit"]),
        mapped?.usageLimit ?? "Placeholder limit"
      )
    },
    {
      exists: Boolean(registryKey),
      lifecycleState: campaign.lifecycleState ?? status,
      marketingType: campaign.type,
      metadata
    }
  );
}

function toMarketingCouponViewFromRegistryItem(
  item: MarketingRegistryItemRecord,
  statusOverride?: MarketingStatus
): MarketingCouponView | null {
  if (item.marketingType !== "coupon" && item.registryKey !== "platform-promotion:annual-upgrade") {
    return null;
  }

  const status = statusOverride ?? item.status;

  return toMarketingCouponViewFromCampaign({
    audienceLabel: "",
    description: item.description,
    id: item.registryKey,
    lifecycleState: status,
    metadata: item.metadata,
    name: item.name,
    revenueImpact: item.revenueImpact,
    slug: item.slug,
    status,
    statusBadgeTone: getMarketingStatusBadgeTone(status),
    statusDescription: getMarketingStatusDescription(status),
    statusLabel: getMarketingStatusLabel(status),
    targetAudienceSummary: item.targetAudience,
    type: item.marketingType,
    typeDescription: "Platform coupon foundation.",
    usage: item.usageCount
  });
}

export function buildMarketingCouponViewsFromCampaigns(
  campaigns: MarketingCouponCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map()
): MarketingCouponView[] {
  const views: MarketingCouponView[] = [];

  for (const campaign of campaigns) {
    const couponView = toMarketingCouponViewFromCampaign({
      ...campaign,
      description: undefined,
      metadata: metadataByRegistryKey.get(campaign.id),
      slug: campaign.id.split(":").pop()
    });

    if (couponView) {
      views.push(couponView);
    }
  }

  const promotionSupplement = campaigns.find((campaign) => campaign.id === "platform-promotion:annual-upgrade");

  if (
    promotionSupplement &&
    !views.some((view) => view.registryKey === "platform-promotion:annual-upgrade")
  ) {
    const supplementView = toMarketingCouponViewFromCampaign({
      ...promotionSupplement,
      description: undefined,
      metadata: metadataByRegistryKey.get("platform-promotion:annual-upgrade"),
      slug: "annual-upgrade"
    });

    if (supplementView) {
      views.push(supplementView);
    }
  }

  if (!views.length) {
    return [...MARKETING_COUPON_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingCouponViewsFromRegistryItems(
  items: MarketingRegistryItemRecord[],
  statusByRegistryKey: Map<string, MarketingStatus> = new Map()
): MarketingCouponView[] {
  const views: MarketingCouponView[] = [];

  for (const item of items) {
    const couponView = toMarketingCouponViewFromRegistryItem(
      item,
      statusByRegistryKey.get(item.registryKey) ?? item.status
    );

    if (couponView) {
      views.push(couponView);
    }
  }

  if (!views.length) {
    return [...MARKETING_COUPON_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingCouponViewsSafe(
  campaigns: MarketingCouponCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map()
): { coupons: MarketingCouponView[]; warning: string | null } {
  try {
    return {
      coupons: buildMarketingCouponViewsFromCampaigns(campaigns, metadataByRegistryKey),
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-coupon-runtime] coupon view build failed", error);

    return {
      coupons: [...MARKETING_COUPON_FALLBACK_VIEWS],
      warning: message
    };
  }
}

export function getMarketingCouponDiscountTypeLabel(discountType: MarketingCouponDiscountType) {
  if (discountType === "plan_credit") return "Plan credit";
  if (discountType === "fixed") return "Fixed";
  return "Percentage";
}

export function getMarketingCouponBadgeTone(discountType: MarketingCouponDiscountType): "amber" | "blue" | "green" {
  if (discountType === "plan_credit") return "amber";
  if (discountType === "fixed") return "green";
  return "blue";
}
