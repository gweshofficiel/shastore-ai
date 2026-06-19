import "server-only";

import {
  getMarketingLifecycleDescription,
  getMarketingLifecycleLabel,
  type MarketingLifecycleActionDefinition
} from "@/src/lib/marketing/marketing-campaign-lifecycle-runtime";
import type { MarketingRegistryItemRecord } from "@/src/lib/marketing/marketing-registry-runtime";
import {
  getMarketingStatusBadgeTone,
  getMarketingStatusDescription,
  getMarketingStatusLabel,
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import {
  resolveMarketingPromotionSchedulingViewSafe,
  type MarketingPromotionSchedulingView
} from "@/src/lib/marketing/marketing-promotion-scheduling-runtime";
import type { MarketingType } from "@/src/lib/marketing/marketing-type-runtime";

type MarketingPromotionCampaignSource = {
  audienceLabel: string;
  endDate?: string | null;
  id: string;
  lifecycleActions?: MarketingLifecycleActionDefinition[];
  lifecycleDescription?: string;
  lifecycleLabel?: string;
  lifecycleState: MarketingStatus;
  name: string;
  revenueImpact: number;
  startDate?: string | null;
  status: MarketingStatus;
  statusBadgeTone: ReturnType<typeof getMarketingStatusBadgeTone>;
  statusDescription: string;
  statusLabel: string;
  targetAudienceSummary: string;
  type: MarketingType;
  typeDescription: string;
  usage: number;
};

export type MarketingPromotionIncentiveType = "fixed" | "percentage" | "plan_credit" | "upgrade_offer";

export type MarketingPromotionView = {
  description: string;
  incentiveLabel: string;
  incentiveType: MarketingPromotionIncentiveType;
  lifecycleDescription: string;
  lifecycleLabel: string;
  lifecycleState: MarketingStatus;
  metadataSummary: string;
  name: string;
  planScope: string;
  promotionDescription: string;
  promotionLabel: string;
  registryKey: string;
  revenueImpact: number;
  slug: string;
  status: MarketingStatus;
  statusBadgeTone: ReturnType<typeof getMarketingStatusBadgeTone>;
  statusDescription: string;
  statusLabel: string;
  targetAudienceSummary: string;
  usageCount: number;
} & MarketingPromotionSchedulingView;

export const MARKETING_PROMOTION_INCENTIVE_TYPES: readonly MarketingPromotionIncentiveType[] = [
  "upgrade_offer",
  "percentage",
  "fixed",
  "plan_credit"
] as const;

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,})/i;

const registryPromotionDisplayMap: Record<
  string,
  Pick<MarketingPromotionView, "incentiveLabel" | "incentiveType" | "planScope">
> = {
  "platform-promotion:annual-upgrade": {
    incentiveLabel: "Annual upgrade incentive",
    incentiveType: "upgrade_offer",
    planScope: "Growth, Pro"
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

function isValidMarketingPromotionIncentiveType(value: unknown): value is MarketingPromotionIncentiveType {
  return typeof value === "string" && MARKETING_PROMOTION_INCENTIVE_TYPES.includes(value as MarketingPromotionIncentiveType);
}

function parseMarketingPromotionIncentiveType(value: unknown): MarketingPromotionIncentiveType {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingPromotionIncentiveType(cleaned) ? cleaned : "upgrade_offer";
}

function sanitizePromotionDisplayValue(value: unknown, fallback: string) {
  const cleaned = text(value, 240);

  if (!cleaned || secretPattern.test(cleaned)) {
    return fallback;
  }

  return cleaned;
}

function metadataValue(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(metadata[key], 200);
    if (value) return value;
  }

  return "";
}

function buildMetadataSummary(metadata: Record<string, unknown>) {
  const summary = sanitizePromotionDisplayValue(
    metadataValue(metadata, ["metadata_summary", "summary", "public_summary"]),
    "Foundation promotion display only. No scheduling or discount application."
  );

  if (secretPattern.test(summary)) {
    return "Promotion metadata summary hidden for safety.";
  }

  return summary;
}

function attachMarketingPromotionScheduling(
  view: Omit<MarketingPromotionView, keyof MarketingPromotionSchedulingView> &
    Partial<MarketingPromotionSchedulingView>,
  params: {
    endDate?: string | null;
    metadata?: Record<string, unknown>;
    startDate?: string | null;
  }
): MarketingPromotionView {
  const scheduling = resolveMarketingPromotionSchedulingViewSafe({
    endsAt: params.endDate,
    metadata: params.metadata,
    startsAt: params.startDate
  });

  return {
    ...view,
    ...scheduling
  };
}

function toMarketingPromotionViewFromCampaign(
  campaign: MarketingPromotionCampaignSource & {
    description?: string;
    metadata?: Record<string, unknown>;
    slug?: string;
  }
): MarketingPromotionView | null {
  if (campaign.type !== "promotion") {
    return null;
  }

  const metadata = safeRecord(campaign.metadata);
  const registryKey = text(campaign.id, 160);
  const slug = text(campaign.slug, 160) || registryKey.split(":").pop() || "promotion";
  const mapped = registryPromotionDisplayMap[registryKey];
  const status = parseMarketingStatus(campaign.status) ?? "draft";
  const lifecycleState = parseMarketingStatus(campaign.lifecycleState) ?? status;
  const description = sanitizePromotionDisplayValue(
    campaign.description ?? metadataValue(metadata, ["description", "promotion_description"]),
    campaign.typeDescription || "Platform promotion foundation."
  );

  return attachMarketingPromotionScheduling(
    {
      description,
      incentiveLabel: sanitizePromotionDisplayValue(
        metadataValue(metadata, ["incentive_label", "promotion_incentive_label"]) || mapped?.incentiveLabel,
        "Platform promotion incentive"
      ),
      incentiveType: parseMarketingPromotionIncentiveType(
        metadataValue(metadata, ["incentive_type", "promotion_incentive_type"]) || mapped?.incentiveType
      ),
      lifecycleDescription:
        campaign.lifecycleDescription ?? getMarketingLifecycleDescription(lifecycleState),
      lifecycleLabel: campaign.lifecycleLabel ?? getMarketingLifecycleLabel(lifecycleState),
      lifecycleState,
      metadataSummary: buildMetadataSummary(metadata),
      name: sanitizePromotionDisplayValue(campaign.name, "Marketing promotion"),
      planScope: sanitizePromotionDisplayValue(
        metadataValue(metadata, ["plan_scope", "eligible_plans", "plan_eligibility"]),
        mapped?.planScope ?? "Internal review only"
      ),
      promotionDescription: description,
      promotionLabel: "Platform promotion",
      registryKey,
      revenueImpact: Math.max(0, campaign.revenueImpact),
      slug,
      status,
      statusBadgeTone: campaign.statusBadgeTone ?? getMarketingStatusBadgeTone(status),
      statusDescription: campaign.statusDescription ?? getMarketingStatusDescription(status),
      statusLabel: campaign.statusLabel ?? getMarketingStatusLabel(status),
      targetAudienceSummary: sanitizePromotionDisplayValue(
        campaign.targetAudienceSummary,
        campaign.audienceLabel || "Audience summary unavailable."
      ),
      usageCount: Math.max(0, Math.trunc(campaign.usage))
    },
    {
      endDate: campaign.endDate,
      metadata,
      startDate: campaign.startDate
    }
  );
}

function toMarketingPromotionViewFromRegistryItem(
  item: MarketingRegistryItemRecord,
  statusOverride?: MarketingStatus
): MarketingPromotionView | null {
  if (item.marketingType !== "promotion") {
    return null;
  }

  const status = statusOverride ?? item.status;

  return toMarketingPromotionViewFromCampaign(
    {
      audienceLabel: "",
      description: item.description,
      endDate: metadataValue(item.metadata, ["end_date", "ends_at", "schedule_end"]) || null,
      id: item.registryKey,
      lifecycleState: status,
      metadata: item.metadata,
      name: item.name,
      revenueImpact: item.revenueImpact,
      slug: item.slug,
      startDate: metadataValue(item.metadata, ["start_date", "starts_at", "schedule_start"]) || null,
      status,
      statusBadgeTone: getMarketingStatusBadgeTone(status),
      statusDescription: getMarketingStatusDescription(status),
      statusLabel: getMarketingStatusLabel(status),
      targetAudienceSummary: item.targetAudience,
      type: item.marketingType,
      typeDescription: "Platform plan promotion and upgrade incentive foundation.",
      usage: item.usageCount
    }
  );
}

export const MARKETING_PROMOTION_FALLBACK_VIEWS: readonly MarketingPromotionView[] = [
  attachMarketingPromotionScheduling(
    {
      description: "Platform promotion foundation for annual upgrade incentives.",
      incentiveLabel: "Annual upgrade incentive",
      incentiveType: "upgrade_offer",
      lifecycleDescription: getMarketingLifecycleDescription("draft"),
      lifecycleLabel: getMarketingLifecycleLabel("draft"),
      lifecycleState: "draft",
      metadataSummary: "Foundation promotion display only. No scheduling or discount application.",
      name: "Annual Upgrade Promotion",
      planScope: "Growth, Pro",
      promotionDescription: "Platform promotion foundation for annual upgrade incentives.",
      promotionLabel: "Platform promotion",
      registryKey: "platform-promotion:annual-upgrade",
      revenueImpact: 0,
      slug: "annual-upgrade",
      status: "draft",
      statusBadgeTone: "amber",
      statusDescription: getMarketingStatusDescription("draft"),
      statusLabel: getMarketingStatusLabel("draft"),
      targetAudienceSummary: "Monthly plan customers",
      usageCount: 0
    },
    {
      metadata: { section: "Platform promotions", source: "marketing_registry_fallback" }
    }
  )
];

export function buildMarketingPromotionViewsFromCampaigns(
  campaigns: MarketingPromotionCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map()
): MarketingPromotionView[] {
  const views: MarketingPromotionView[] = [];

  for (const campaign of campaigns) {
    const promotionView = toMarketingPromotionViewFromCampaign({
      ...campaign,
      description: undefined,
      endDate: campaign.endDate ?? null,
      lifecycleDescription: campaign.lifecycleDescription,
      lifecycleLabel: campaign.lifecycleLabel,
      metadata: metadataByRegistryKey.get(campaign.id),
      slug: campaign.id.split(":").pop(),
      startDate: campaign.startDate ?? null
    });

    if (promotionView) {
      views.push(promotionView);
    }
  }

  if (!views.length) {
    return [...MARKETING_PROMOTION_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingPromotionViewsFromRegistryItems(
  items: MarketingRegistryItemRecord[],
  statusByRegistryKey: Map<string, MarketingStatus> = new Map()
): MarketingPromotionView[] {
  const views: MarketingPromotionView[] = [];

  for (const item of items) {
    const promotionView = toMarketingPromotionViewFromRegistryItem(
      item,
      statusByRegistryKey.get(item.registryKey) ?? item.status
    );

    if (promotionView) {
      views.push(promotionView);
    }
  }

  if (!views.length) {
    return [...MARKETING_PROMOTION_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingPromotionViewsSafe(
  campaigns: MarketingPromotionCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map()
): { promotions: MarketingPromotionView[]; warning: string | null } {
  try {
    return {
      promotions: buildMarketingPromotionViewsFromCampaigns(campaigns, metadataByRegistryKey),
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-promotion-runtime] promotion view build failed", error);

    return {
      promotions: [...MARKETING_PROMOTION_FALLBACK_VIEWS],
      warning: message
    };
  }
}

export function getMarketingPromotionIncentiveTypeLabel(incentiveType: MarketingPromotionIncentiveType) {
  if (incentiveType === "plan_credit") return "Plan credit";
  if (incentiveType === "fixed") return "Fixed";
  if (incentiveType === "percentage") return "Percentage";
  return "Upgrade offer";
}

export function getMarketingPromotionBadgeTone(
  incentiveType: MarketingPromotionIncentiveType
): "amber" | "blue" | "green" {
  if (incentiveType === "plan_credit") return "amber";
  if (incentiveType === "fixed") return "green";
  return "blue";
}
