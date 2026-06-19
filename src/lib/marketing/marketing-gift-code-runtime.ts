import "server-only";

import {
  resolveMarketingAudienceView,
  type MarketingAudienceView
} from "@/src/lib/marketing/marketing-audience-runtime";
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
import type { MarketingType } from "@/src/lib/marketing/marketing-type-runtime";

type MarketingGiftCodeCampaignSource = {
  audienceLabel: string;
  id: string;
  lifecycleActions?: MarketingLifecycleActionDefinition[];
  lifecycleDescription?: string;
  lifecycleLabel?: string;
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

export type MarketingGiftCodeCreditType = "fixed_credit" | "platform_credit" | "subscription_credit";

export type MarketingGiftCodeView = {
  code: string;
  creditAmount: number;
  creditType: MarketingGiftCodeCreditType;
  description: string;
  giftCodeDescription: string;
  giftCodeLabel: string;
  lifecycleDescription: string;
  lifecycleLabel: string;
  lifecycleState: MarketingStatus;
  metadataSummary: string;
  name: string;
  planCredit: string;
  redemptionStatus: string;
  registryKey: string;
  revenueImpact: number;
  slug: string;
  status: MarketingStatus;
  statusBadgeTone: ReturnType<typeof getMarketingStatusBadgeTone>;
  statusDescription: string;
  statusLabel: string;
  targetAudienceSummary: string;
  usageCount: number;
} & MarketingAudienceView;

export const MARKETING_GIFT_CODE_CREDIT_TYPES: readonly MarketingGiftCodeCreditType[] = [
  "subscription_credit",
  "platform_credit",
  "fixed_credit"
] as const;

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,})/i;

const registryGiftCodeDisplayMap: Record<
  string,
  Pick<MarketingGiftCodeView, "code" | "creditAmount" | "creditType" | "planCredit">
> = {
  "gift-code:launch-credit": {
    code: "GIFT-LAUNCH-CREDIT",
    creditAmount: 0,
    creditType: "subscription_credit",
    planCredit: "Platform subscription credit placeholder"
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

function safeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function isValidMarketingGiftCodeCreditType(value: unknown): value is MarketingGiftCodeCreditType {
  return typeof value === "string" && MARKETING_GIFT_CODE_CREDIT_TYPES.includes(value as MarketingGiftCodeCreditType);
}

function parseMarketingGiftCodeCreditType(value: unknown): MarketingGiftCodeCreditType {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingGiftCodeCreditType(cleaned) ? cleaned : "subscription_credit";
}

function sanitizeGiftCodeDisplayValue(value: unknown, fallback: string) {
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

function buildGiftCodeDisplayCode(params: {
  metadata: Record<string, unknown>;
  registryKey: string;
  slug: string;
}) {
  const mapped = registryGiftCodeDisplayMap[params.registryKey]?.code;
  if (mapped) return mapped;

  const metadataCode = sanitizeGiftCodeDisplayValue(
    metadataValue(params.metadata, ["gift_code", "code", "display_code"]),
    ""
  );

  if (metadataCode) return metadataCode;

  const slugCode = params.slug.replace(/-/g, "_").toUpperCase();
  return slugCode ? `GIFT-${slugCode}` : "GIFT-DRAFT";
}

function buildMetadataSummary(metadata: Record<string, unknown>) {
  const summary = sanitizeGiftCodeDisplayValue(
    metadataValue(metadata, ["metadata_summary", "summary", "public_summary"]),
    "Foundation gift code display only. No redemption or credit granting."
  );

  if (secretPattern.test(summary)) {
    return "Gift code metadata summary hidden for safety.";
  }

  return summary;
}

function attachMarketingGiftCodeAudience(
  view: Omit<MarketingGiftCodeView, keyof MarketingAudienceView> & Partial<MarketingAudienceView>,
  params: {
    metadata?: Record<string, unknown>;
    registryKey: string;
    targetAudience: string;
  }
): MarketingGiftCodeView {
  const audience = resolveMarketingAudienceView({
    marketingType: "gift_code",
    metadata: params.metadata,
    registryKey: params.registryKey,
    targetAudience: params.targetAudience
  });

  return {
    ...view,
    ...audience
  };
}

function toMarketingGiftCodeViewFromCampaign(
  campaign: MarketingGiftCodeCampaignSource & {
    description?: string;
    metadata?: Record<string, unknown>;
    slug?: string;
  }
): MarketingGiftCodeView | null {
  if (campaign.type !== "gift_code") {
    return null;
  }

  const metadata = safeRecord(campaign.metadata);
  const registryKey = text(campaign.id, 160);
  const slug = text(campaign.slug, 160) || registryKey.split(":").pop() || "gift-code";
  const mapped = registryGiftCodeDisplayMap[registryKey];
  const status = parseMarketingStatus(campaign.status) ?? "draft";
  const lifecycleState = parseMarketingStatus(campaign.lifecycleState) ?? status;
  const description = sanitizeGiftCodeDisplayValue(
    campaign.description ?? metadataValue(metadata, ["description", "gift_code_description"]),
    campaign.typeDescription || "Platform gift code foundation."
  );
  const creditAmount = safeNumber(
    metadataValue(metadata, ["credit_amount", "amount"]) || (mapped?.creditAmount ?? campaign.revenueImpact)
  );

  return attachMarketingGiftCodeAudience(
    {
      code: buildGiftCodeDisplayCode({ metadata, registryKey, slug }),
      creditAmount,
      creditType: parseMarketingGiftCodeCreditType(
        metadataValue(metadata, ["credit_type", "gift_code_credit_type"]) || mapped?.creditType
      ),
      description,
      giftCodeDescription: description,
      giftCodeLabel: "Platform gift code",
      lifecycleDescription:
        campaign.lifecycleDescription ?? getMarketingLifecycleDescription(lifecycleState),
      lifecycleLabel: campaign.lifecycleLabel ?? getMarketingLifecycleLabel(lifecycleState),
      lifecycleState,
      metadataSummary: buildMetadataSummary(metadata),
      name: sanitizeGiftCodeDisplayValue(campaign.name, "Marketing gift code"),
      planCredit: sanitizeGiftCodeDisplayValue(
        metadataValue(metadata, ["plan_credit", "credit_label", "credit_description"]),
        mapped?.planCredit ?? "Platform credit placeholder"
      ),
      redemptionStatus: "No redemption engine connected",
      registryKey,
      revenueImpact: Math.max(0, campaign.revenueImpact),
      slug,
      status,
      statusBadgeTone: campaign.statusBadgeTone ?? getMarketingStatusBadgeTone(status),
      statusDescription: campaign.statusDescription ?? getMarketingStatusDescription(status),
      statusLabel: campaign.statusLabel ?? getMarketingStatusLabel(status),
      targetAudienceSummary: sanitizeGiftCodeDisplayValue(
        campaign.targetAudienceSummary,
        campaign.audienceLabel || "Audience summary unavailable."
      ),
      usageCount: Math.max(0, Math.trunc(campaign.usage))
    },
    {
      metadata,
      registryKey,
      targetAudience: campaign.targetAudienceSummary || campaign.audienceLabel || ""
    }
  );
}

function toMarketingGiftCodeViewFromRegistryItem(
  item: MarketingRegistryItemRecord,
  statusOverride?: MarketingStatus
): MarketingGiftCodeView | null {
  if (item.marketingType !== "gift_code") {
    return null;
  }

  const status = statusOverride ?? item.status;

  return toMarketingGiftCodeViewFromCampaign({
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
    typeDescription: "Platform credit gift code foundation.",
    usage: item.usageCount
  });
}

export const MARKETING_GIFT_CODE_FALLBACK_VIEWS: readonly MarketingGiftCodeView[] = [
  attachMarketingGiftCodeAudience(
    {
      code: "GIFT-LAUNCH-CREDIT",
      creditAmount: 0,
      creditType: "subscription_credit",
      description: "Gift code foundation for launch credit distribution.",
      giftCodeDescription: "Gift code foundation for launch credit distribution.",
      giftCodeLabel: "Platform gift code",
      lifecycleDescription: getMarketingLifecycleDescription("draft"),
      lifecycleLabel: getMarketingLifecycleLabel("draft"),
      lifecycleState: "draft",
      metadataSummary: "Foundation gift code display only. No redemption or credit granting.",
      name: "Launch Credit Gift Code",
      planCredit: "Platform subscription credit placeholder",
      redemptionStatus: "No redemption engine connected",
      registryKey: "gift-code:launch-credit",
      revenueImpact: 0,
      slug: "launch-credit",
      status: "draft",
      statusBadgeTone: "amber",
      statusDescription: getMarketingStatusDescription("draft"),
      statusLabel: getMarketingStatusLabel("draft"),
      targetAudienceSummary: "Selected launch partners",
      usageCount: 0
    },
    {
      metadata: { section: "Gift codes", source: "marketing_registry_fallback" },
      registryKey: "gift-code:launch-credit",
      targetAudience: "Selected launch partners"
    }
  )
];

export function buildMarketingGiftCodeViewsFromCampaigns(
  campaigns: MarketingGiftCodeCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map()
): MarketingGiftCodeView[] {
  const views: MarketingGiftCodeView[] = [];

  for (const campaign of campaigns) {
    const giftCodeView = toMarketingGiftCodeViewFromCampaign({
      ...campaign,
      description: undefined,
      lifecycleDescription: campaign.lifecycleDescription,
      lifecycleLabel: campaign.lifecycleLabel,
      metadata: metadataByRegistryKey.get(campaign.id),
      slug: campaign.id.split(":").pop()
    });

    if (giftCodeView) {
      views.push(giftCodeView);
    }
  }

  if (!views.length) {
    return [...MARKETING_GIFT_CODE_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingGiftCodeViewsFromRegistryItems(
  items: MarketingRegistryItemRecord[],
  statusByRegistryKey: Map<string, MarketingStatus> = new Map()
): MarketingGiftCodeView[] {
  const views: MarketingGiftCodeView[] = [];

  for (const item of items) {
    const giftCodeView = toMarketingGiftCodeViewFromRegistryItem(
      item,
      statusByRegistryKey.get(item.registryKey) ?? item.status
    );

    if (giftCodeView) {
      views.push(giftCodeView);
    }
  }

  if (!views.length) {
    return [...MARKETING_GIFT_CODE_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingGiftCodeViewsSafe(
  campaigns: MarketingGiftCodeCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map()
): { giftCodes: MarketingGiftCodeView[]; warning: string | null } {
  try {
    return {
      giftCodes: buildMarketingGiftCodeViewsFromCampaigns(campaigns, metadataByRegistryKey),
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-gift-code-runtime] gift code view build failed", error);

    return {
      giftCodes: [...MARKETING_GIFT_CODE_FALLBACK_VIEWS],
      warning: message
    };
  }
}

export function getMarketingGiftCodeCreditTypeLabel(creditType: MarketingGiftCodeCreditType) {
  if (creditType === "platform_credit") return "Platform credit";
  if (creditType === "fixed_credit") return "Fixed credit";
  return "Subscription credit";
}

export function getMarketingGiftCodeBadgeTone(
  creditType: MarketingGiftCodeCreditType
): "amber" | "blue" | "green" {
  if (creditType === "platform_credit") return "blue";
  if (creditType === "fixed_credit") return "green";
  return "amber";
}
