import "server-only";

import type { MarketingCouponEligibilityState } from "@/src/lib/marketing/marketing-coupon-eligibility-runtime";
import {
  isValidMarketingCouponEligibilityState
} from "@/src/lib/marketing/marketing-coupon-eligibility-runtime";
import type { MarketingCouponValidationState } from "@/src/lib/marketing/marketing-coupon-validation-runtime";
import {
  isValidMarketingCouponValidationState
} from "@/src/lib/marketing/marketing-coupon-validation-runtime";
import {
  isValidMarketingStatus,
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";

export type MarketingCouponAnalyticsCouponSnapshot = {
  eligibilityState: MarketingCouponEligibilityState | unknown;
  status: MarketingStatus | unknown;
  usageCount: unknown;
  validationState: MarketingCouponValidationState | unknown;
};

export type MarketingCouponAnalyticsSummary = {
  activeCouponItems: number;
  analyticsDescription: string;
  analyticsReady: boolean;
  archivedCouponItems: number;
  averageUsageCount: number;
  draftCouponItems: number;
  expiredCouponItems: number;
  highUsageCouponCount: number;
  needsReviewCouponCount: number;
  pausedCouponItems: number;
  totalCouponItems: number;
  totalUsageCount: number;
};

export const MARKETING_COUPON_ANALYTICS_FALLBACK_SUMMARY: MarketingCouponAnalyticsSummary = {
  activeCouponItems: 0,
  analyticsDescription: "Coupon analytics foundation only. No redemption or billing analytics connected.",
  analyticsReady: true,
  archivedCouponItems: 0,
  averageUsageCount: 0,
  draftCouponItems: 2,
  expiredCouponItems: 0,
  highUsageCouponCount: 0,
  needsReviewCouponCount: 2,
  pausedCouponItems: 0,
  totalCouponItems: 2,
  totalUsageCount: 0
};

function safeUsageCount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function parseCouponStatus(value: unknown): MarketingStatus | null {
  if (isValidMarketingStatus(value)) return value;
  return parseMarketingStatus(value);
}

function parseCouponValidationState(value: unknown): MarketingCouponValidationState | null {
  return isValidMarketingCouponValidationState(value) ? value : null;
}

function parseCouponEligibilityState(value: unknown): MarketingCouponEligibilityState | null {
  return isValidMarketingCouponEligibilityState(value) ? value : null;
}

function couponNeedsReview(snapshot: MarketingCouponAnalyticsCouponSnapshot) {
  const validationState = parseCouponValidationState(snapshot.validationState);
  const eligibilityState = parseCouponEligibilityState(snapshot.eligibilityState);

  return validationState === "needs_review" || eligibilityState === "needs_review";
}

export function countMarketingCouponsByStatus(
  coupons: MarketingCouponAnalyticsCouponSnapshot[]
): Pick<
  MarketingCouponAnalyticsSummary,
  "activeCouponItems" | "archivedCouponItems" | "draftCouponItems" | "expiredCouponItems" | "pausedCouponItems"
> {
  return {
    activeCouponItems: coupons.filter((coupon) => parseCouponStatus(coupon.status) === "active").length,
    archivedCouponItems: coupons.filter((coupon) => parseCouponStatus(coupon.status) === "archived").length,
    draftCouponItems: coupons.filter((coupon) => parseCouponStatus(coupon.status) === "draft").length,
    expiredCouponItems: coupons.filter((coupon) => parseCouponStatus(coupon.status) === "expired").length,
    pausedCouponItems: coupons.filter((coupon) => parseCouponStatus(coupon.status) === "paused").length
  };
}

export function countMarketingCouponNeedsReview(coupons: MarketingCouponAnalyticsCouponSnapshot[]) {
  return coupons.filter((coupon) => couponNeedsReview(coupon)).length;
}

export function countMarketingCouponHighUsage(coupons: MarketingCouponAnalyticsCouponSnapshot[]) {
  return coupons.filter((coupon) => safeUsageCount(coupon.usageCount) > 0).length;
}

export function sumMarketingCouponUsageCount(coupons: MarketingCouponAnalyticsCouponSnapshot[]) {
  return coupons.reduce((total, coupon) => total + safeUsageCount(coupon.usageCount), 0);
}

export function averageMarketingCouponUsageCount(coupons: MarketingCouponAnalyticsCouponSnapshot[]) {
  if (!coupons.length) return 0;
  return sumMarketingCouponUsageCount(coupons) / coupons.length;
}

export function buildMarketingCouponAnalyticsSummary(
  coupons: MarketingCouponAnalyticsCouponSnapshot[]
): MarketingCouponAnalyticsSummary {
  const statusCounts = countMarketingCouponsByStatus(coupons);
  const totalCouponItems = coupons.length;
  const totalUsageCount = sumMarketingCouponUsageCount(coupons);

  return {
    ...statusCounts,
    analyticsDescription:
      totalCouponItems > 0
        ? "Read-only coupon analytics summary from registry, validation, eligibility, and usage foundations."
        : "Coupon analytics foundation only. No coupon rows available for summary.",
    analyticsReady: true,
    averageUsageCount: averageMarketingCouponUsageCount(coupons),
    highUsageCouponCount: countMarketingCouponHighUsage(coupons),
    needsReviewCouponCount: countMarketingCouponNeedsReview(coupons),
    totalCouponItems,
    totalUsageCount
  };
}

export function buildMarketingCouponAnalyticsSummarySafe(
  coupons: MarketingCouponAnalyticsCouponSnapshot[] | null | undefined
): MarketingCouponAnalyticsSummary {
  try {
    const snapshots = Array.isArray(coupons) ? coupons : [];

    if (!snapshots.length) {
      return {
        ...MARKETING_COUPON_ANALYTICS_FALLBACK_SUMMARY,
        analyticsDescription: "Coupon analytics fallback summary. No coupon rows were available safely."
      };
    }

    return buildMarketingCouponAnalyticsSummary(snapshots);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-coupon-analytics-runtime] analytics summary failed", error);

    return {
      ...MARKETING_COUPON_ANALYTICS_FALLBACK_SUMMARY,
      analyticsDescription: message || "Coupon analytics runtime failed safely.",
      analyticsReady: false
    };
  }
}
