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

type MarketingReferralCampaignSource = {
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

export type MarketingReferralProgramType = "owner_invite" | "partner_invite" | "platform_invite";

export type MarketingReferralView = {
  code: string;
  commissionDisplay: string;
  description: string;
  lifecycleDescription: string;
  lifecycleLabel: string;
  lifecycleState: MarketingStatus;
  metadataSummary: string;
  name: string;
  payoutStatus: string;
  referralDescription: string;
  referralLabel: string;
  referralProgramType: MarketingReferralProgramType;
  registryKey: string;
  revenueImpact: number;
  slug: string;
  status: MarketingStatus;
  statusBadgeTone: ReturnType<typeof getMarketingStatusBadgeTone>;
  statusDescription: string;
  statusLabel: string;
  targetAudienceSummary: string;
  trackingStatus: string;
  usageCount: number;
} & MarketingAudienceView;

export const MARKETING_REFERRAL_PROGRAM_TYPES: readonly MarketingReferralProgramType[] = [
  "owner_invite",
  "partner_invite",
  "platform_invite"
] as const;

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,})/i;

const registryReferralDisplayMap: Record<
  string,
  Pick<MarketingReferralView, "code" | "referralProgramType">
> = {
  "referral:owner-invite": {
    code: "REF-OWNER-INVITE",
    referralProgramType: "owner_invite"
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

function isValidMarketingReferralProgramType(value: unknown): value is MarketingReferralProgramType {
  return typeof value === "string" && MARKETING_REFERRAL_PROGRAM_TYPES.includes(value as MarketingReferralProgramType);
}

function parseMarketingReferralProgramType(value: unknown): MarketingReferralProgramType {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingReferralProgramType(cleaned) ? cleaned : "platform_invite";
}

function sanitizeReferralDisplayValue(value: unknown, fallback: string) {
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

function buildReferralDisplayCode(params: {
  metadata: Record<string, unknown>;
  registryKey: string;
  slug: string;
}) {
  const mapped = registryReferralDisplayMap[params.registryKey]?.code;
  if (mapped) return mapped;

  const metadataCode = sanitizeReferralDisplayValue(
    metadataValue(params.metadata, ["referral_code", "code", "display_code"]),
    ""
  );

  if (metadataCode) return metadataCode;

  const slugCode = params.slug.replace(/-/g, "_").toUpperCase();
  return slugCode ? `REF-${slugCode}` : "REF-DRAFT";
}

function buildMetadataSummary(metadata: Record<string, unknown>) {
  const summary = sanitizeReferralDisplayValue(
    metadataValue(metadata, ["metadata_summary", "summary", "public_summary"]),
    "Foundation referral display only. No tracking, commission, or payout integration."
  );

  if (secretPattern.test(summary)) {
    return "Referral metadata summary hidden for safety.";
  }

  return summary;
}

function attachMarketingReferralAudience(
  view: Omit<MarketingReferralView, keyof MarketingAudienceView> & Partial<MarketingAudienceView>,
  params: {
    metadata?: Record<string, unknown>;
    registryKey: string;
    targetAudience: string;
  }
): MarketingReferralView {
  const audience = resolveMarketingAudienceView({
    marketingType: "referral",
    metadata: params.metadata,
    registryKey: params.registryKey,
    targetAudience: params.targetAudience
  });

  return {
    ...view,
    ...audience
  };
}

function toMarketingReferralViewFromCampaign(
  campaign: MarketingReferralCampaignSource & {
    description?: string;
    metadata?: Record<string, unknown>;
    slug?: string;
  }
): MarketingReferralView | null {
  if (campaign.type !== "referral") {
    return null;
  }

  const metadata = safeRecord(campaign.metadata);
  const registryKey = text(campaign.id, 160);
  const slug = text(campaign.slug, 160) || registryKey.split(":").pop() || "referral";
  const mapped = registryReferralDisplayMap[registryKey];
  const status = parseMarketingStatus(campaign.status) ?? "draft";
  const lifecycleState = parseMarketingStatus(campaign.lifecycleState) ?? status;
  const description = sanitizeReferralDisplayValue(
    campaign.description ?? metadataValue(metadata, ["description", "referral_description"]),
    campaign.typeDescription || "Platform referral program foundation."
  );
  const referralProgramType = parseMarketingReferralProgramType(
    metadataValue(metadata, ["referral_program_type", "program_type"]) || mapped?.referralProgramType
  );

  return attachMarketingReferralAudience(
    {
      code: buildReferralDisplayCode({ metadata, registryKey, slug }),
      commissionDisplay: "0.00 placeholder",
      description,
      lifecycleDescription:
        campaign.lifecycleDescription ?? getMarketingLifecycleDescription(lifecycleState),
      lifecycleLabel: campaign.lifecycleLabel ?? getMarketingLifecycleLabel(lifecycleState),
      lifecycleState,
      metadataSummary: buildMetadataSummary(metadata),
      name: sanitizeReferralDisplayValue(campaign.name, "Marketing referral program"),
      payoutStatus: "No payout system connected",
      referralDescription: description,
      referralLabel: "Platform referral program",
      referralProgramType,
      registryKey,
      revenueImpact: Math.max(0, campaign.revenueImpact),
      slug,
      status,
      statusBadgeTone: campaign.statusBadgeTone ?? getMarketingStatusBadgeTone(status),
      statusDescription: campaign.statusDescription ?? getMarketingStatusDescription(status),
      statusLabel: campaign.statusLabel ?? getMarketingStatusLabel(status),
      targetAudienceSummary: sanitizeReferralDisplayValue(
        campaign.targetAudienceSummary,
        campaign.audienceLabel || "Audience summary unavailable."
      ),
      trackingStatus: "No referral tracking connected",
      usageCount: Math.max(0, Math.trunc(campaign.usage))
    },
    {
      metadata,
      registryKey,
      targetAudience: campaign.targetAudienceSummary || campaign.audienceLabel || ""
    }
  );
}

function toMarketingReferralViewFromRegistryItem(
  item: MarketingRegistryItemRecord,
  statusOverride?: MarketingStatus
): MarketingReferralView | null {
  if (item.marketingType !== "referral") {
    return null;
  }

  const status = statusOverride ?? item.status;

  return toMarketingReferralViewFromCampaign({
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
    typeDescription: "Platform referral program foundation.",
    usage: item.usageCount
  });
}

export const MARKETING_REFERRAL_FALLBACK_VIEWS: readonly MarketingReferralView[] = [
  attachMarketingReferralAudience(
    {
      code: "REF-OWNER-INVITE",
      commissionDisplay: "0.00 placeholder",
      description: "Referral program foundation for store owner invites.",
      lifecycleDescription: getMarketingLifecycleDescription("draft"),
      lifecycleLabel: getMarketingLifecycleLabel("draft"),
      lifecycleState: "draft",
      metadataSummary: "Foundation referral display only. No tracking, commission, or payout integration.",
      name: "Store Owner Referral Foundation",
      payoutStatus: "No payout system connected",
      referralDescription: "Referral program foundation for store owner invites.",
      referralLabel: "Platform referral program",
      referralProgramType: "owner_invite",
      registryKey: "referral:owner-invite",
      revenueImpact: 0,
      slug: "owner-invite",
      status: "draft",
      statusBadgeTone: "amber",
      statusDescription: getMarketingStatusDescription("draft"),
      statusLabel: getMarketingStatusLabel("draft"),
      targetAudienceSummary: "Existing store owners",
      trackingStatus: "No referral tracking connected",
      usageCount: 0
    },
    {
      metadata: { section: "Referral program", source: "marketing_registry_fallback" },
      registryKey: "referral:owner-invite",
      targetAudience: "Existing store owners"
    }
  )
];

export function buildMarketingReferralViewsFromCampaigns(
  campaigns: MarketingReferralCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map()
): MarketingReferralView[] {
  const views: MarketingReferralView[] = [];

  for (const campaign of campaigns) {
    const referralView = toMarketingReferralViewFromCampaign({
      ...campaign,
      description: undefined,
      lifecycleDescription: campaign.lifecycleDescription,
      lifecycleLabel: campaign.lifecycleLabel,
      metadata: metadataByRegistryKey.get(campaign.id),
      slug: campaign.id.split(":").pop()
    });

    if (referralView) {
      views.push(referralView);
    }
  }

  if (!views.length) {
    return [...MARKETING_REFERRAL_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingReferralViewsFromRegistryItems(
  items: MarketingRegistryItemRecord[],
  statusByRegistryKey: Map<string, MarketingStatus> = new Map()
): MarketingReferralView[] {
  const views: MarketingReferralView[] = [];

  for (const item of items) {
    const referralView = toMarketingReferralViewFromRegistryItem(
      item,
      statusByRegistryKey.get(item.registryKey) ?? item.status
    );

    if (referralView) {
      views.push(referralView);
    }
  }

  if (!views.length) {
    return [...MARKETING_REFERRAL_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingReferralViewsSafe(
  campaigns: MarketingReferralCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map()
): { referrals: MarketingReferralView[]; warning: string | null } {
  try {
    return {
      referrals: buildMarketingReferralViewsFromCampaigns(campaigns, metadataByRegistryKey),
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-referral-runtime] referral view build failed", error);

    return {
      referrals: [...MARKETING_REFERRAL_FALLBACK_VIEWS],
      warning: message
    };
  }
}

export function getMarketingReferralProgramTypeLabel(programType: MarketingReferralProgramType) {
  if (programType === "owner_invite") return "Owner invite";
  if (programType === "partner_invite") return "Partner invite";
  return "Platform invite";
}

export function getMarketingReferralBadgeTone(
  programType: MarketingReferralProgramType
): "amber" | "blue" | "green" {
  if (programType === "owner_invite") return "green";
  if (programType === "partner_invite") return "blue";
  return "amber";
}
