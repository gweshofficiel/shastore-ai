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
import {
  MARKETING_COMMISSION_FALLBACK_SUMMARIES,
  resolveMarketingCommissionViewSafe,
  type MarketingCommissionSummaryRecord,
  type MarketingCommissionView
} from "@/src/lib/marketing/marketing-commission-runtime";
import type { MarketingRegistryItemRecord } from "@/src/lib/marketing/marketing-registry-runtime";
import {
  MARKETING_AFFILIATE_TRACKING_FALLBACK_SUMMARIES,
  resolveMarketingAffiliateTrackingViewSafe,
  type MarketingAffiliateTrackingSummaryRecord,
  type MarketingAffiliateTrackingView
} from "@/src/lib/marketing/marketing-affiliate-tracking-runtime";
import {
  getMarketingStatusBadgeTone,
  getMarketingStatusDescription,
  getMarketingStatusLabel,
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import type { MarketingType } from "@/src/lib/marketing/marketing-type-runtime";

type MarketingAffiliateCampaignSource = {
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

export type MarketingAffiliateProgramType = "agency_partner" | "creator_partner" | "platform_partner";

export type MarketingAffiliateView = {
  affiliateDescription: string;
  affiliateLabel: string;
  affiliateProgramType: MarketingAffiliateProgramType;
  code: string;
  commissionDisplay: string;
  description: string;
  lifecycleDescription: string;
  lifecycleLabel: string;
  lifecycleState: MarketingStatus;
  metadataSummary: string;
  name: string;
  payoutStatus: string;
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
} & MarketingAudienceView &
  MarketingAffiliateTrackingView &
  MarketingCommissionView;

export const MARKETING_AFFILIATE_PROGRAM_TYPES: readonly MarketingAffiliateProgramType[] = [
  "creator_partner",
  "agency_partner",
  "platform_partner"
] as const;

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,})/i;

const registryAffiliateDisplayMap: Record<
  string,
  Pick<MarketingAffiliateView, "affiliateProgramType" | "code">
> = {
  "affiliate:creator-partners": {
    affiliateProgramType: "creator_partner",
    code: "AFF-CREATOR-PARTNERS"
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

function isValidMarketingAffiliateProgramType(value: unknown): value is MarketingAffiliateProgramType {
  return typeof value === "string" && MARKETING_AFFILIATE_PROGRAM_TYPES.includes(value as MarketingAffiliateProgramType);
}

function parseMarketingAffiliateProgramType(value: unknown): MarketingAffiliateProgramType {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingAffiliateProgramType(cleaned) ? cleaned : "platform_partner";
}

function sanitizeAffiliateDisplayValue(value: unknown, fallback: string) {
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

function buildAffiliateDisplayCode(params: {
  metadata: Record<string, unknown>;
  registryKey: string;
  slug: string;
}) {
  const mapped = registryAffiliateDisplayMap[params.registryKey]?.code;
  if (mapped) return mapped;

  const metadataCode = sanitizeAffiliateDisplayValue(
    metadataValue(params.metadata, ["affiliate_code", "code", "display_code"]),
    ""
  );

  if (metadataCode) return metadataCode;

  const slugCode = params.slug.replace(/-/g, "_").toUpperCase();
  return slugCode ? `AFF-${slugCode}` : "AFF-DRAFT";
}

function buildMetadataSummary(metadata: Record<string, unknown>) {
  const summary = sanitizeAffiliateDisplayValue(
    metadataValue(metadata, ["metadata_summary", "summary", "public_summary"]),
    "Foundation affiliate display only. No tracking, commission, or payout integration."
  );

  if (secretPattern.test(summary)) {
    return "Affiliate metadata summary hidden for safety.";
  }

  return summary;
}

function attachMarketingAffiliateCommissionLayer(
  view: Omit<MarketingAffiliateView, keyof MarketingCommissionView> &
    Partial<MarketingCommissionView> &
    MarketingAudienceView &
    MarketingAffiliateTrackingView,
  params: {
    commissionSummaryRecord?: MarketingCommissionSummaryRecord | null;
  }
): MarketingAffiliateView {
  const commission = resolveMarketingCommissionViewSafe({
    code: view.code,
    commissionSummaryRecord: params.commissionSummaryRecord,
    exists: true,
    lifecycleState: view.lifecycleState,
    marketingType: "affiliate",
    metadata: undefined,
    metadataSummary: view.metadataSummary,
    registryKey: view.registryKey,
    revenueImpact: view.revenueImpact,
    slug: view.slug,
    status: view.status,
    trackedConversionsCount: view.trackedConversionsCount,
    trackingReady: view.trackingReady,
    trackingState: view.trackingState,
    usageCount: view.usageCount
  });

  return {
    ...view,
    ...commission,
    commissionDisplay: commission.estimatedCommissionDisplay
  };
}

function attachMarketingAffiliateTrackingLayer(
  view: Omit<
    MarketingAffiliateView,
    keyof MarketingAffiliateTrackingView | keyof MarketingCommissionView
  > &
    Partial<MarketingAffiliateTrackingView> &
    MarketingAudienceView,
  params: {
    exists?: boolean;
    lifecycleState?: MarketingStatus;
    marketingType: MarketingType;
    metadata?: Record<string, unknown>;
    trackingSummaryRecord?: MarketingAffiliateTrackingSummaryRecord | null;
  }
): Omit<MarketingAffiliateView, keyof MarketingCommissionView> &
  MarketingAudienceView &
  MarketingAffiliateTrackingView {
  const tracking = resolveMarketingAffiliateTrackingViewSafe({
    code: view.code,
    exists: params.exists,
    lifecycleState: params.lifecycleState ?? view.lifecycleState,
    marketingType: params.marketingType,
    metadata: params.metadata,
    registryKey: view.registryKey,
    revenueImpact: view.revenueImpact,
    slug: view.slug,
    status: view.status,
    trackingSummaryRecord: params.trackingSummaryRecord,
    usageCount: view.usageCount
  });

  return {
    ...view,
    ...tracking,
    trackingStatus: tracking.trackingEngineStatus
  };
}

function attachMarketingAffiliateAudience(
  view: Omit<
    MarketingAffiliateView,
    keyof MarketingAudienceView | keyof MarketingAffiliateTrackingView | keyof MarketingCommissionView
  > &
    Partial<MarketingAudienceView>,
  params: {
    metadata?: Record<string, unknown>;
    registryKey: string;
    targetAudience: string;
  }
): Omit<
  MarketingAffiliateView,
  keyof MarketingAffiliateTrackingView | keyof MarketingCommissionView
> &
  MarketingAudienceView {
  const audience = resolveMarketingAudienceView({
    marketingType: "affiliate",
    metadata: params.metadata,
    registryKey: params.registryKey,
    targetAudience: params.targetAudience
  });

  return {
    ...view,
    ...audience
  };
}

function toMarketingAffiliateViewFromCampaign(
  campaign: MarketingAffiliateCampaignSource & {
    description?: string;
    metadata?: Record<string, unknown>;
    slug?: string;
  },
  trackingSummariesByRegistryKey: Map<string, MarketingAffiliateTrackingSummaryRecord> = new Map(),
  commissionSummariesByRegistryKey: Map<string, MarketingCommissionSummaryRecord> = new Map()
): MarketingAffiliateView | null {
  if (campaign.type !== "affiliate") {
    return null;
  }

  const metadata = safeRecord(campaign.metadata);
  const registryKey = text(campaign.id, 160);
  const slug = text(campaign.slug, 160) || registryKey.split(":").pop() || "affiliate";
  const mapped = registryAffiliateDisplayMap[registryKey];
  const status = parseMarketingStatus(campaign.status) ?? "draft";
  const lifecycleState = parseMarketingStatus(campaign.lifecycleState) ?? status;
  const description = sanitizeAffiliateDisplayValue(
    campaign.description ?? metadataValue(metadata, ["description", "affiliate_description"]),
    campaign.typeDescription || "Platform affiliate program foundation."
  );
  const affiliateProgramType = parseMarketingAffiliateProgramType(
    metadataValue(metadata, ["affiliate_program_type", "program_type"]) || mapped?.affiliateProgramType
  );

  return attachMarketingAffiliateCommissionLayer(
    attachMarketingAffiliateTrackingLayer(
      attachMarketingAffiliateAudience(
        {
          affiliateDescription: description,
          affiliateLabel: "Platform affiliate program",
          affiliateProgramType,
          code: buildAffiliateDisplayCode({ metadata, registryKey, slug }),
          commissionDisplay: "0.00 placeholder",
          description,
          lifecycleDescription:
            campaign.lifecycleDescription ?? getMarketingLifecycleDescription(lifecycleState),
          lifecycleLabel: campaign.lifecycleLabel ?? getMarketingLifecycleLabel(lifecycleState),
          lifecycleState,
          metadataSummary: buildMetadataSummary(metadata),
          name: sanitizeAffiliateDisplayValue(campaign.name, "Marketing affiliate program"),
          payoutStatus: "No payout system connected",
          registryKey,
          revenueImpact: Math.max(0, campaign.revenueImpact),
          slug,
          status,
          statusBadgeTone: campaign.statusBadgeTone ?? getMarketingStatusBadgeTone(status),
          statusDescription: campaign.statusDescription ?? getMarketingStatusDescription(status),
          statusLabel: campaign.statusLabel ?? getMarketingStatusLabel(status),
          targetAudienceSummary: sanitizeAffiliateDisplayValue(
            campaign.targetAudienceSummary,
            campaign.audienceLabel || "Audience summary unavailable."
          ),
          trackingStatus: "No affiliate tracking connected",
          usageCount: Math.max(0, Math.trunc(campaign.usage))
        },
        {
          metadata,
          registryKey,
          targetAudience: campaign.targetAudienceSummary || campaign.audienceLabel || ""
        }
      ),
      {
        exists: true,
        lifecycleState,
        marketingType: "affiliate",
        metadata,
        trackingSummaryRecord: trackingSummariesByRegistryKey.get(registryKey) ?? null
      }
    ),
    {
      commissionSummaryRecord: commissionSummariesByRegistryKey.get(registryKey) ?? null
    }
  );
}

function toMarketingAffiliateViewFromRegistryItem(
  item: MarketingRegistryItemRecord,
  statusOverride?: MarketingStatus,
  trackingSummariesByRegistryKey: Map<string, MarketingAffiliateTrackingSummaryRecord> = new Map(),
  commissionSummariesByRegistryKey: Map<string, MarketingCommissionSummaryRecord> = new Map()
): MarketingAffiliateView | null {
  if (item.marketingType !== "affiliate") {
    return null;
  }

  const status = statusOverride ?? item.status;

  return toMarketingAffiliateViewFromCampaign(
    {
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
      typeDescription: "Platform affiliate program foundation.",
      usage: item.usageCount
    },
    trackingSummariesByRegistryKey,
    commissionSummariesByRegistryKey
  );
}

const fallbackAffiliateTrackingSummariesByRegistryKey = new Map(
  MARKETING_AFFILIATE_TRACKING_FALLBACK_SUMMARIES.map((summary) => [summary.registryKey, summary])
);
const fallbackAffiliateCommissionSummariesByRegistryKey = new Map(
  MARKETING_COMMISSION_FALLBACK_SUMMARIES.filter((summary) => summary.marketingType === "affiliate").map(
    (summary) => [summary.registryKey, summary]
  )
);

export const MARKETING_AFFILIATE_FALLBACK_VIEWS: readonly MarketingAffiliateView[] = [
  attachMarketingAffiliateCommissionLayer(
    attachMarketingAffiliateTrackingLayer(
    attachMarketingAffiliateAudience(
      {
        affiliateDescription: "Affiliate program foundation for creator partnerships.",
        affiliateLabel: "Platform affiliate program",
        affiliateProgramType: "creator_partner",
        code: "AFF-CREATOR-PARTNERS",
        commissionDisplay: "0.00 placeholder",
        description: "Affiliate program foundation for creator partnerships.",
        lifecycleDescription: getMarketingLifecycleDescription("draft"),
        lifecycleLabel: getMarketingLifecycleLabel("draft"),
        lifecycleState: "draft",
        metadataSummary: "Foundation affiliate display only. No tracking, commission, or payout integration.",
        name: "Creator Affiliate Foundation",
        payoutStatus: "No payout system connected",
        registryKey: "affiliate:creator-partners",
        revenueImpact: 0,
        slug: "creator-partners",
        status: "draft",
        statusBadgeTone: "amber",
        statusDescription: getMarketingStatusDescription("draft"),
        statusLabel: getMarketingStatusLabel("draft"),
        targetAudienceSummary: "Creators, agencies, and future reseller partners",
        trackingStatus: "No affiliate tracking connected",
        usageCount: 0
      },
      {
        metadata: { section: "Affiliate program", source: "marketing_registry_fallback" },
        registryKey: "affiliate:creator-partners",
        targetAudience: "Creators, agencies, and future reseller partners"
      }
    ),
    {
      exists: true,
      lifecycleState: "draft",
      marketingType: "affiliate",
      metadata: { section: "Affiliate program", source: "marketing_registry_fallback" },
      trackingSummaryRecord: fallbackAffiliateTrackingSummariesByRegistryKey.get("affiliate:creator-partners") ?? null
    }
    ),
    {
      commissionSummaryRecord: fallbackAffiliateCommissionSummariesByRegistryKey.get("affiliate:creator-partners") ?? null
    }
  )
];

export function buildMarketingAffiliateViewsFromCampaigns(
  campaigns: MarketingAffiliateCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map(),
  trackingSummariesByRegistryKey: Map<string, MarketingAffiliateTrackingSummaryRecord> = new Map(),
  commissionSummariesByRegistryKey: Map<string, MarketingCommissionSummaryRecord> = new Map()
): MarketingAffiliateView[] {
  const views: MarketingAffiliateView[] = [];

  for (const campaign of campaigns) {
    const affiliateView = toMarketingAffiliateViewFromCampaign(
      {
        ...campaign,
        description: undefined,
        lifecycleDescription: campaign.lifecycleDescription,
        lifecycleLabel: campaign.lifecycleLabel,
        metadata: metadataByRegistryKey.get(campaign.id),
        slug: campaign.id.split(":").pop()
      },
      trackingSummariesByRegistryKey,
      commissionSummariesByRegistryKey
    );

    if (affiliateView) {
      views.push(affiliateView);
    }
  }

  if (!views.length) {
    return [...MARKETING_AFFILIATE_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingAffiliateViewsFromRegistryItems(
  items: MarketingRegistryItemRecord[],
  statusByRegistryKey: Map<string, MarketingStatus> = new Map(),
  trackingSummariesByRegistryKey: Map<string, MarketingAffiliateTrackingSummaryRecord> = new Map(),
  commissionSummariesByRegistryKey: Map<string, MarketingCommissionSummaryRecord> = new Map()
): MarketingAffiliateView[] {
  const views: MarketingAffiliateView[] = [];

  for (const item of items) {
    const affiliateView = toMarketingAffiliateViewFromRegistryItem(
      item,
      statusByRegistryKey.get(item.registryKey) ?? item.status,
      trackingSummariesByRegistryKey,
      commissionSummariesByRegistryKey
    );

    if (affiliateView) {
      views.push(affiliateView);
    }
  }

  if (!views.length) {
    return [...MARKETING_AFFILIATE_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingAffiliateViewsSafe(
  campaigns: MarketingAffiliateCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map(),
  trackingSummariesByRegistryKey: Map<string, MarketingAffiliateTrackingSummaryRecord> = new Map(),
  commissionSummariesByRegistryKey: Map<string, MarketingCommissionSummaryRecord> = new Map()
): { affiliates: MarketingAffiliateView[]; warning: string | null } {
  try {
    return {
      affiliates: buildMarketingAffiliateViewsFromCampaigns(
        campaigns,
        metadataByRegistryKey,
        trackingSummariesByRegistryKey,
        commissionSummariesByRegistryKey
      ),
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-affiliate-runtime] affiliate view build failed", error);

    return {
      affiliates: [...MARKETING_AFFILIATE_FALLBACK_VIEWS],
      warning: message
    };
  }
}

export function getMarketingAffiliateProgramTypeLabel(programType: MarketingAffiliateProgramType) {
  if (programType === "creator_partner") return "Creator partner";
  if (programType === "agency_partner") return "Agency partner";
  return "Platform partner";
}

export function getMarketingAffiliateBadgeTone(
  programType: MarketingAffiliateProgramType
): "amber" | "blue" | "green" {
  if (programType === "creator_partner") return "green";
  if (programType === "agency_partner") return "blue";
  return "amber";
}
