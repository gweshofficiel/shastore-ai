import "server-only";

import {
  isValidMarketingCampaignEmailState,
  type MarketingCampaignEmailState
} from "@/src/lib/marketing/marketing-campaign-email-runtime";
import {
  isValidMarketingCampaignNotificationState,
  type MarketingCampaignNotificationState
} from "@/src/lib/marketing/marketing-campaign-notification-runtime";
import {
  isValidMarketingCampaignState,
  type MarketingCampaignState
} from "@/src/lib/marketing/marketing-campaign-runtime";
import {
  isValidMarketingStatus,
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";

export type MarketingCampaignAnalyticsSnapshot = {
  campaignState: MarketingCampaignState | unknown;
  emailState: MarketingCampaignEmailState | unknown;
  notificationState: MarketingCampaignNotificationState | unknown;
  revenueImpact: unknown;
  status: MarketingStatus | unknown;
  usageCount: unknown;
};

export type MarketingCampaignAnalyticsSummary = {
  activeCampaignItems: number;
  analyticsDescription: string;
  analyticsReady: boolean;
  archivedCampaignItems: number;
  averageUsageCount: number;
  draftCampaignItems: number;
  emailReadyCampaignCount: number;
  expiredCampaignItems: number;
  invalidCampaignCount: number;
  needsReviewCampaignCount: number;
  notificationReadyCampaignCount: number;
  pausedCampaignItems: number;
  totalCampaignItems: number;
  totalRevenueImpact: number;
  totalUsageCount: number;
};

export const MARKETING_CAMPAIGN_ANALYTICS_FALLBACK_SUMMARY: MarketingCampaignAnalyticsSummary = {
  activeCampaignItems: 0,
  analyticsDescription: "Campaign analytics foundation only. No external analytics integration connected.",
  analyticsReady: true,
  archivedCampaignItems: 0,
  averageUsageCount: 0,
  draftCampaignItems: 0,
  emailReadyCampaignCount: 0,
  expiredCampaignItems: 0,
  invalidCampaignCount: 0,
  needsReviewCampaignCount: 0,
  notificationReadyCampaignCount: 0,
  pausedCampaignItems: 0,
  totalCampaignItems: 1,
  totalRevenueImpact: 0,
  totalUsageCount: 0
};

function safeUsageCount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function safeRevenueImpact(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function parseCampaignStatus(value: unknown): MarketingStatus | null {
  if (isValidMarketingStatus(value)) return value;
  return parseMarketingStatus(value);
}

function parseCampaignReadinessState(value: unknown): MarketingCampaignState | null {
  return isValidMarketingCampaignState(value) ? value : null;
}

function parseCampaignEmailState(value: unknown): MarketingCampaignEmailState | null {
  return isValidMarketingCampaignEmailState(value) ? value : null;
}

function parseCampaignNotificationState(value: unknown): MarketingCampaignNotificationState | null {
  return isValidMarketingCampaignNotificationState(value) ? value : null;
}

function campaignNeedsReview(snapshot: MarketingCampaignAnalyticsSnapshot) {
  const campaignState = parseCampaignReadinessState(snapshot.campaignState);
  const emailState = parseCampaignEmailState(snapshot.emailState);
  const notificationState = parseCampaignNotificationState(snapshot.notificationState);

  return (
    campaignState === "needs_review" ||
    emailState === "needs_review" ||
    notificationState === "needs_review"
  );
}

function campaignInvalid(snapshot: MarketingCampaignAnalyticsSnapshot) {
  const campaignState = parseCampaignReadinessState(snapshot.campaignState);
  const emailState = parseCampaignEmailState(snapshot.emailState);
  const notificationState = parseCampaignNotificationState(snapshot.notificationState);

  return campaignState === "invalid" || emailState === "invalid" || notificationState === "invalid";
}

export function countMarketingCampaignsByStatus(
  campaigns: MarketingCampaignAnalyticsSnapshot[]
): Pick<
  MarketingCampaignAnalyticsSummary,
  | "activeCampaignItems"
  | "archivedCampaignItems"
  | "draftCampaignItems"
  | "expiredCampaignItems"
  | "pausedCampaignItems"
> {
  return {
    activeCampaignItems: campaigns.filter((campaign) => parseCampaignStatus(campaign.status) === "active").length,
    archivedCampaignItems: campaigns.filter((campaign) => parseCampaignStatus(campaign.status) === "archived").length,
    draftCampaignItems: campaigns.filter((campaign) => parseCampaignStatus(campaign.status) === "draft").length,
    expiredCampaignItems: campaigns.filter((campaign) => parseCampaignStatus(campaign.status) === "expired").length,
    pausedCampaignItems: campaigns.filter((campaign) => parseCampaignStatus(campaign.status) === "paused").length
  };
}

export function countMarketingCampaignEmailReady(campaigns: MarketingCampaignAnalyticsSnapshot[]) {
  return campaigns.filter((campaign) => parseCampaignEmailState(campaign.emailState) === "email_ready").length;
}

export function countMarketingCampaignNotificationReady(campaigns: MarketingCampaignAnalyticsSnapshot[]) {
  return campaigns.filter(
    (campaign) => parseCampaignNotificationState(campaign.notificationState) === "notification_ready"
  ).length;
}

export function countMarketingCampaignNeedsReview(campaigns: MarketingCampaignAnalyticsSnapshot[]) {
  return campaigns.filter((campaign) => campaignNeedsReview(campaign)).length;
}

export function countMarketingCampaignInvalid(campaigns: MarketingCampaignAnalyticsSnapshot[]) {
  return campaigns.filter((campaign) => campaignInvalid(campaign)).length;
}

export function sumMarketingCampaignUsageCount(campaigns: MarketingCampaignAnalyticsSnapshot[]) {
  return campaigns.reduce((total, campaign) => total + safeUsageCount(campaign.usageCount), 0);
}

export function averageMarketingCampaignUsageCount(campaigns: MarketingCampaignAnalyticsSnapshot[]) {
  if (!campaigns.length) return 0;
  return sumMarketingCampaignUsageCount(campaigns) / campaigns.length;
}

export function sumMarketingCampaignRevenueImpact(campaigns: MarketingCampaignAnalyticsSnapshot[]) {
  return campaigns.reduce((total, campaign) => total + safeRevenueImpact(campaign.revenueImpact), 0);
}

export function buildMarketingCampaignAnalyticsSummary(
  campaigns: MarketingCampaignAnalyticsSnapshot[]
): MarketingCampaignAnalyticsSummary {
  const statusCounts = countMarketingCampaignsByStatus(campaigns);
  const totalCampaignItems = campaigns.length;
  const totalUsageCount = sumMarketingCampaignUsageCount(campaigns);
  const totalRevenueImpact = sumMarketingCampaignRevenueImpact(campaigns);

  return {
    ...statusCounts,
    analyticsDescription:
      totalCampaignItems > 0
        ? "Read-only campaign analytics from registry status, readiness, email, notification, usage, and revenue impact foundations."
        : "Campaign analytics foundation only. No campaign rows available for summary.",
    analyticsReady: true,
    averageUsageCount: averageMarketingCampaignUsageCount(campaigns),
    emailReadyCampaignCount: countMarketingCampaignEmailReady(campaigns),
    invalidCampaignCount: countMarketingCampaignInvalid(campaigns),
    needsReviewCampaignCount: countMarketingCampaignNeedsReview(campaigns),
    notificationReadyCampaignCount: countMarketingCampaignNotificationReady(campaigns),
    totalCampaignItems,
    totalRevenueImpact,
    totalUsageCount
  };
}

export function buildMarketingCampaignAnalyticsSummarySafe(
  campaigns: MarketingCampaignAnalyticsSnapshot[] | null | undefined
): MarketingCampaignAnalyticsSummary {
  try {
    const snapshots = Array.isArray(campaigns) ? campaigns : [];

    if (!snapshots.length) {
      return {
        ...MARKETING_CAMPAIGN_ANALYTICS_FALLBACK_SUMMARY,
        analyticsDescription: "Campaign analytics fallback summary. No campaign rows were available safely."
      };
    }

    return buildMarketingCampaignAnalyticsSummary(snapshots);
  } catch (error) {
    console.error("[marketing-campaign-analytics-runtime] analytics summary failed", error);

    return {
      ...MARKETING_CAMPAIGN_ANALYTICS_FALLBACK_SUMMARY,
      analyticsDescription: "Campaign analytics runtime failed safely.",
      analyticsReady: false
    };
  }
}
