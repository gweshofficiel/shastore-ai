import "server-only";

import {
  isValidMarketingPromotionAudienceReadinessState,
  type MarketingPromotionAudienceReadinessState
} from "@/src/lib/marketing/marketing-promotion-audience-runtime";
import {
  isValidMarketingPromotionScheduleState,
  type MarketingPromotionScheduleState
} from "@/src/lib/marketing/marketing-promotion-scheduling-runtime";
import {
  isValidMarketingStatus,
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";

export type MarketingPromotionMetricsSnapshot = {
  promotionAudienceReadinessState: MarketingPromotionAudienceReadinessState | unknown;
  revenueImpact: unknown;
  scheduleState: MarketingPromotionScheduleState | unknown;
  status: MarketingStatus | unknown;
  usageCount: unknown;
};

export type MarketingPromotionMetricsSummary = {
  activePromotionItems: number;
  archivedPromotionItems: number;
  averageUsageCount: number;
  draftPromotionItems: number;
  endedPromotionItems: number;
  expiredPromotionItems: number;
  invalidSchedulePromotionItems: number;
  livePromotionItems: number;
  metricsDescription: string;
  metricsReady: boolean;
  needsReviewPromotionCount: number;
  pausedPromotionItems: number;
  scheduledPromotionItems: number;
  totalPromotionItems: number;
  totalRevenueImpact: number;
  totalUsageCount: number;
};

export const MARKETING_PROMOTION_METRICS_FALLBACK_SUMMARY: MarketingPromotionMetricsSummary = {
  activePromotionItems: 0,
  archivedPromotionItems: 0,
  averageUsageCount: 0,
  draftPromotionItems: 1,
  endedPromotionItems: 0,
  expiredPromotionItems: 0,
  invalidSchedulePromotionItems: 0,
  livePromotionItems: 0,
  metricsDescription: "Promotion metrics foundation only. No checkout or billing metrics connected.",
  metricsReady: true,
  needsReviewPromotionCount: 0,
  pausedPromotionItems: 0,
  scheduledPromotionItems: 0,
  totalPromotionItems: 1,
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

function parsePromotionStatus(value: unknown): MarketingStatus | null {
  if (isValidMarketingStatus(value)) return value;
  return parseMarketingStatus(value);
}

function parsePromotionScheduleState(value: unknown): MarketingPromotionScheduleState | null {
  return isValidMarketingPromotionScheduleState(value) ? value : null;
}

function parsePromotionAudienceReadinessState(
  value: unknown
): MarketingPromotionAudienceReadinessState | null {
  return isValidMarketingPromotionAudienceReadinessState(value) ? value : null;
}

function promotionNeedsReview(snapshot: MarketingPromotionMetricsSnapshot) {
  const audienceState = parsePromotionAudienceReadinessState(snapshot.promotionAudienceReadinessState);
  const scheduleState = parsePromotionScheduleState(snapshot.scheduleState);

  return (
    audienceState === "custom" ||
    audienceState === "unclassified" ||
    audienceState === "unknown" ||
    scheduleState === "invalid_schedule" ||
    scheduleState === "unknown"
  );
}

export function countMarketingPromotionsByStatus(
  promotions: MarketingPromotionMetricsSnapshot[]
): Pick<
  MarketingPromotionMetricsSummary,
  | "activePromotionItems"
  | "archivedPromotionItems"
  | "draftPromotionItems"
  | "expiredPromotionItems"
  | "pausedPromotionItems"
> {
  return {
    activePromotionItems: promotions.filter((promotion) => parsePromotionStatus(promotion.status) === "active")
      .length,
    archivedPromotionItems: promotions.filter((promotion) => parsePromotionStatus(promotion.status) === "archived")
      .length,
    draftPromotionItems: promotions.filter((promotion) => parsePromotionStatus(promotion.status) === "draft").length,
    expiredPromotionItems: promotions.filter((promotion) => parsePromotionStatus(promotion.status) === "expired")
      .length,
    pausedPromotionItems: promotions.filter((promotion) => parsePromotionStatus(promotion.status) === "paused").length
  };
}

export function countMarketingPromotionsByScheduleState(
  promotions: MarketingPromotionMetricsSnapshot[]
): Pick<
  MarketingPromotionMetricsSummary,
  "endedPromotionItems" | "invalidSchedulePromotionItems" | "livePromotionItems" | "scheduledPromotionItems"
> {
  return {
    endedPromotionItems: promotions.filter(
      (promotion) => parsePromotionScheduleState(promotion.scheduleState) === "ended"
    ).length,
    invalidSchedulePromotionItems: promotions.filter(
      (promotion) => parsePromotionScheduleState(promotion.scheduleState) === "invalid_schedule"
    ).length,
    livePromotionItems: promotions.filter(
      (promotion) => parsePromotionScheduleState(promotion.scheduleState) === "live"
    ).length,
    scheduledPromotionItems: promotions.filter(
      (promotion) => parsePromotionScheduleState(promotion.scheduleState) === "scheduled"
    ).length
  };
}

export function countMarketingPromotionNeedsReview(promotions: MarketingPromotionMetricsSnapshot[]) {
  return promotions.filter((promotion) => promotionNeedsReview(promotion)).length;
}

export function sumMarketingPromotionUsageCount(promotions: MarketingPromotionMetricsSnapshot[]) {
  return promotions.reduce((total, promotion) => total + safeUsageCount(promotion.usageCount), 0);
}

export function averageMarketingPromotionUsageCount(promotions: MarketingPromotionMetricsSnapshot[]) {
  if (!promotions.length) return 0;
  return sumMarketingPromotionUsageCount(promotions) / promotions.length;
}

export function sumMarketingPromotionRevenueImpact(promotions: MarketingPromotionMetricsSnapshot[]) {
  return promotions.reduce((total, promotion) => total + safeRevenueImpact(promotion.revenueImpact), 0);
}

export function buildMarketingPromotionMetricsSummary(
  promotions: MarketingPromotionMetricsSnapshot[]
): MarketingPromotionMetricsSummary {
  const statusCounts = countMarketingPromotionsByStatus(promotions);
  const scheduleCounts = countMarketingPromotionsByScheduleState(promotions);
  const totalPromotionItems = promotions.length;
  const totalUsageCount = sumMarketingPromotionUsageCount(promotions);
  const totalRevenueImpact = sumMarketingPromotionRevenueImpact(promotions);

  return {
    ...statusCounts,
    ...scheduleCounts,
    averageUsageCount: averageMarketingPromotionUsageCount(promotions),
    metricsDescription:
      totalPromotionItems > 0
        ? "Read-only promotion metrics from registry, scheduling, audience, usage, and revenue impact foundations."
        : "Promotion metrics foundation only. No promotion rows available for summary.",
    metricsReady: true,
    needsReviewPromotionCount: countMarketingPromotionNeedsReview(promotions),
    totalPromotionItems,
    totalRevenueImpact,
    totalUsageCount
  };
}

export function buildMarketingPromotionMetricsSummarySafe(
  promotions: MarketingPromotionMetricsSnapshot[] | null | undefined
): MarketingPromotionMetricsSummary {
  try {
    const snapshots = Array.isArray(promotions) ? promotions : [];

    if (!snapshots.length) {
      return {
        ...MARKETING_PROMOTION_METRICS_FALLBACK_SUMMARY,
        metricsDescription: "Promotion metrics fallback summary. No promotion rows were available safely."
      };
    }

    return buildMarketingPromotionMetricsSummary(snapshots);
  } catch (error) {
    console.error("[marketing-promotion-metrics-runtime] metrics summary failed", error);

    return {
      ...MARKETING_PROMOTION_METRICS_FALLBACK_SUMMARY,
      metricsDescription: "Promotion metrics runtime failed safely.",
      metricsReady: false
    };
  }
}
