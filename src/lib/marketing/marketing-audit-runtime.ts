import "server-only";

export type MarketingAuditState = "audit_ready" | "incomplete" | "invalid" | "needs_review" | "unknown";

export type MarketingAuditBadgeTone = "amber" | "blue" | "green" | "red";

export type MarketingAuditItemSnapshot = {
  hasRequiredFields: boolean;
  invalid: boolean;
  needsReview: boolean;
  registryKey: string;
  riskyMetadata: boolean;
  updatedAt: string | null;
};

export type MarketingAuditRegistrySnapshot = {
  name: unknown;
  registryKey: unknown;
  slug?: unknown;
  updatedAt?: unknown;
};

export type MarketingAuditCouponSnapshot = {
  code?: unknown;
  eligibilityState?: unknown;
  metadataSummary?: unknown;
  name?: unknown;
  registryKey?: unknown;
  validationState?: unknown;
};

export type MarketingAuditPromotionSnapshot = {
  metadataSummary?: unknown;
  name?: unknown;
  promotionAudienceReadinessState?: unknown;
  registryKey?: unknown;
  scheduleState?: unknown;
};

export type MarketingAuditGiftCodeSnapshot = {
  code?: unknown;
  creditReadinessState?: unknown;
  metadataSummary?: unknown;
  name?: unknown;
  redemptionState?: unknown;
  registryKey?: unknown;
};

export type MarketingAuditReferralSnapshot = {
  commissionState?: unknown;
  metadataSummary?: unknown;
  name?: unknown;
  registryKey?: unknown;
  trackingState?: unknown;
};

export type MarketingAuditAffiliateSnapshot = {
  commissionState?: unknown;
  metadataSummary?: unknown;
  name?: unknown;
  registryKey?: unknown;
  trackingState?: unknown;
};

export type MarketingAuditPlatformCampaignSnapshot = {
  campaignState?: unknown;
  emailState?: unknown;
  metadataSummary?: unknown;
  name?: unknown;
  notificationState?: unknown;
  registryKey?: unknown;
};

export type MarketingAuditLoadInput = {
  affiliates: MarketingAuditAffiliateSnapshot[];
  coupons: MarketingAuditCouponSnapshot[];
  giftCodes: MarketingAuditGiftCodeSnapshot[];
  platformCampaigns: MarketingAuditPlatformCampaignSnapshot[];
  promotions: MarketingAuditPromotionSnapshot[];
  referrals: MarketingAuditReferralSnapshot[];
  registryItems: MarketingAuditRegistrySnapshot[];
  runtimeWarning?: string | null;
};

export type MarketingAuditSummary = {
  auditBadgeTone: MarketingAuditBadgeTone;
  auditDescription: string;
  auditLabel: string;
  auditReady: boolean;
  auditState: MarketingAuditState;
  auditSummary: string;
  invalidItemCount: number;
  lastUpdatedDisplay: string | null;
  missingRequiredRuntimeFieldsCount: number;
  needsReviewCount: number;
  reviewedStatus: string;
  riskyMetadataCount: number;
  totalMarketingItems: number;
};

export const MARKETING_AUDIT_FALLBACK_SUMMARY: MarketingAuditSummary = {
  auditBadgeTone: "amber",
  auditDescription: "Marketing audit foundation only. No automatic audit logging or backfill connected.",
  auditLabel: "Unknown",
  auditReady: true,
  auditState: "unknown",
  auditSummary: "Audit readiness fallback summary.",
  invalidItemCount: 0,
  lastUpdatedDisplay: null,
  missingRequiredRuntimeFieldsCount: 0,
  needsReviewCount: 0,
  reviewedStatus: "Unknown audit state",
  riskyMetadataCount: 0,
  totalMarketingItems: 0
};

function safeText(value: unknown, maxLength = 240) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function hasNonEmptyText(value: unknown) {
  return safeText(value).length > 0;
}

function isRiskyMetadataSummary(value: unknown) {
  const summary = safeText(value).toLowerCase();
  if (!summary) return false;
  return summary.includes("hidden for safety") || summary.includes("requires review");
}

function formatSafeLastUpdatedDisplay(value: unknown) {
  const trimmed = safeText(value, 80);
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function parseNeedsReviewState(value: unknown) {
  return safeText(value) === "needs_review";
}

function parseInvalidState(value: unknown) {
  return safeText(value) === "invalid";
}

function promotionNeedsReview(snapshot: MarketingAuditPromotionSnapshot) {
  const audienceState = safeText(snapshot.promotionAudienceReadinessState);
  const scheduleState = safeText(snapshot.scheduleState);

  return (
    audienceState === "custom" ||
    audienceState === "unclassified" ||
    audienceState === "unknown" ||
    scheduleState === "invalid_schedule" ||
    scheduleState === "unknown"
  );
}

function promotionInvalid(snapshot: MarketingAuditPromotionSnapshot) {
  return safeText(snapshot.scheduleState) === "invalid_schedule";
}

function platformCampaignNeedsReview(snapshot: MarketingAuditPlatformCampaignSnapshot) {
  return (
    parseNeedsReviewState(snapshot.campaignState) ||
    parseNeedsReviewState(snapshot.emailState) ||
    parseNeedsReviewState(snapshot.notificationState)
  );
}

function platformCampaignInvalid(snapshot: MarketingAuditPlatformCampaignSnapshot) {
  return (
    parseInvalidState(snapshot.campaignState) ||
    parseInvalidState(snapshot.emailState) ||
    parseInvalidState(snapshot.notificationState)
  );
}

function referralOrAffiliateNeedsReview(snapshot: MarketingAuditReferralSnapshot | MarketingAuditAffiliateSnapshot) {
  return parseNeedsReviewState(snapshot.trackingState) || parseNeedsReviewState(snapshot.commissionState);
}

function referralOrAffiliateInvalid(snapshot: MarketingAuditReferralSnapshot | MarketingAuditAffiliateSnapshot) {
  return parseInvalidState(snapshot.trackingState) || parseInvalidState(snapshot.commissionState);
}

function buildRegistryAuditSnapshot(item: MarketingAuditRegistrySnapshot): MarketingAuditItemSnapshot {
  const registryKey = safeText(item.registryKey);
  const name = safeText(item.name);
  const slug = safeText(item.slug);

  return {
    hasRequiredFields: Boolean(registryKey && name && slug),
    invalid: false,
    needsReview: false,
    registryKey: registryKey || "unknown-registry-item",
    riskyMetadata: false,
    updatedAt: formatSafeLastUpdatedDisplay(item.updatedAt)
  };
}

function buildCouponAuditSnapshot(coupon: MarketingAuditCouponSnapshot): MarketingAuditItemSnapshot {
  const registryKey = safeText(coupon.registryKey);
  const validationState = safeText(coupon.validationState);
  const eligibilityState = safeText(coupon.eligibilityState);

  return {
    hasRequiredFields: Boolean(registryKey && hasNonEmptyText(coupon.name) && hasNonEmptyText(coupon.code)),
    invalid: validationState === "invalid",
    needsReview: validationState === "needs_review" || eligibilityState === "needs_review",
    registryKey: registryKey || "unknown-coupon",
    riskyMetadata: isRiskyMetadataSummary(coupon.metadataSummary),
    updatedAt: null
  };
}

function buildPromotionAuditSnapshot(promotion: MarketingAuditPromotionSnapshot): MarketingAuditItemSnapshot {
  const registryKey = safeText(promotion.registryKey);

  return {
    hasRequiredFields: Boolean(registryKey && hasNonEmptyText(promotion.name)),
    invalid: promotionInvalid(promotion),
    needsReview: promotionNeedsReview(promotion),
    registryKey: registryKey || "unknown-promotion",
    riskyMetadata: isRiskyMetadataSummary(promotion.metadataSummary),
    updatedAt: null
  };
}

function buildGiftCodeAuditSnapshot(giftCode: MarketingAuditGiftCodeSnapshot): MarketingAuditItemSnapshot {
  const registryKey = safeText(giftCode.registryKey);
  const redemptionState = safeText(giftCode.redemptionState);
  const creditReadinessState = safeText(giftCode.creditReadinessState);

  return {
    hasRequiredFields: Boolean(registryKey && hasNonEmptyText(giftCode.name) && hasNonEmptyText(giftCode.code)),
    invalid: false,
    needsReview: redemptionState === "needs_review" || creditReadinessState === "needs_review",
    registryKey: registryKey || "unknown-gift-code",
    riskyMetadata: isRiskyMetadataSummary(giftCode.metadataSummary),
    updatedAt: null
  };
}

function buildReferralAuditSnapshot(referral: MarketingAuditReferralSnapshot): MarketingAuditItemSnapshot {
  const registryKey = safeText(referral.registryKey);

  return {
    hasRequiredFields: Boolean(registryKey && hasNonEmptyText(referral.name)),
    invalid: referralOrAffiliateInvalid(referral),
    needsReview: referralOrAffiliateNeedsReview(referral),
    registryKey: registryKey || "unknown-referral",
    riskyMetadata: isRiskyMetadataSummary(referral.metadataSummary),
    updatedAt: null
  };
}

function buildAffiliateAuditSnapshot(affiliate: MarketingAuditAffiliateSnapshot): MarketingAuditItemSnapshot {
  const registryKey = safeText(affiliate.registryKey);

  return {
    hasRequiredFields: Boolean(registryKey && hasNonEmptyText(affiliate.name)),
    invalid: referralOrAffiliateInvalid(affiliate),
    needsReview: referralOrAffiliateNeedsReview(affiliate),
    registryKey: registryKey || "unknown-affiliate",
    riskyMetadata: isRiskyMetadataSummary(affiliate.metadataSummary),
    updatedAt: null
  };
}

function buildPlatformCampaignAuditSnapshot(
  campaign: MarketingAuditPlatformCampaignSnapshot
): MarketingAuditItemSnapshot {
  const registryKey = safeText(campaign.registryKey);

  return {
    hasRequiredFields: Boolean(registryKey && hasNonEmptyText(campaign.name)),
    invalid: platformCampaignInvalid(campaign),
    needsReview: platformCampaignNeedsReview(campaign),
    registryKey: registryKey || "unknown-platform-campaign",
    riskyMetadata: isRiskyMetadataSummary(campaign.metadataSummary),
    updatedAt: null
  };
}

export function collectMarketingAuditSnapshots(input: MarketingAuditLoadInput): MarketingAuditItemSnapshot[] {
  const registryItems = Array.isArray(input.registryItems) ? input.registryItems : [];
  const coupons = Array.isArray(input.coupons) ? input.coupons : [];
  const promotions = Array.isArray(input.promotions) ? input.promotions : [];
  const giftCodes = Array.isArray(input.giftCodes) ? input.giftCodes : [];
  const referrals = Array.isArray(input.referrals) ? input.referrals : [];
  const affiliates = Array.isArray(input.affiliates) ? input.affiliates : [];
  const platformCampaigns = Array.isArray(input.platformCampaigns) ? input.platformCampaigns : [];

  return [
    ...registryItems.map(buildRegistryAuditSnapshot),
    ...coupons.map(buildCouponAuditSnapshot),
    ...promotions.map(buildPromotionAuditSnapshot),
    ...giftCodes.map(buildGiftCodeAuditSnapshot),
    ...referrals.map(buildReferralAuditSnapshot),
    ...affiliates.map(buildAffiliateAuditSnapshot),
    ...platformCampaigns.map(buildPlatformCampaignAuditSnapshot)
  ];
}

function resolveLatestUpdatedDisplay(snapshots: MarketingAuditItemSnapshot[]) {
  const datedSnapshots = snapshots
    .map((snapshot) => snapshot.updatedAt)
    .filter((value): value is string => Boolean(value));

  if (!datedSnapshots.length) return null;

  return datedSnapshots.sort((left, right) => right.localeCompare(left))[0] ?? null;
}

export function resolveMarketingAuditState(params: {
  invalidItemCount: number;
  missingRequiredRuntimeFieldsCount: number;
  needsReviewCount: number;
  runtimeWarning?: string | null;
  totalMarketingItems: number;
}): MarketingAuditState {
  if (params.totalMarketingItems <= 0) {
    return "incomplete";
  }

  if (params.invalidItemCount > 0) {
    return "invalid";
  }

  if (params.missingRequiredRuntimeFieldsCount > 0) {
    return "incomplete";
  }

  if (params.needsReviewCount > 0 || safeText(params.runtimeWarning).length > 0) {
    return "needs_review";
  }

  return "audit_ready";
}

export function getMarketingAuditLabel(state: MarketingAuditState) {
  if (state === "audit_ready") return "Audit ready";
  if (state === "needs_review") return "Needs review";
  if (state === "invalid") return "Invalid";
  if (state === "incomplete") return "Incomplete";
  return "Unknown";
}

export function getMarketingAuditBadgeTone(state: MarketingAuditState): MarketingAuditBadgeTone {
  if (state === "audit_ready") return "green";
  if (state === "needs_review") return "amber";
  if (state === "invalid") return "red";
  if (state === "incomplete") return "blue";
  return "amber";
}

export function getMarketingAuditDescription(state: MarketingAuditState) {
  if (state === "audit_ready") {
    return "Read-only audit readiness from loaded marketing foundations. No automatic audit logging during admin page load.";
  }

  if (state === "needs_review") {
    return "Some marketing items or runtime warnings need admin review before audit readiness is fully green.";
  }

  if (state === "invalid") {
    return "One or more marketing items report invalid readiness states in the loaded admin view.";
  }

  if (state === "incomplete") {
    return "Some marketing items are missing required registry fields or no auditable rows were loaded safely.";
  }

  return "Audit readiness could not be classified safely from the loaded marketing data.";
}

function resolveReviewedStatus(state: MarketingAuditState) {
  if (state === "audit_ready") return "Foundation reviewed";
  if (state === "needs_review") return "Foundation needs review";
  if (state === "invalid") return "Invalid items present";
  if (state === "incomplete") return "Incomplete foundation";
  return "Unknown audit state";
}

export function buildMarketingAuditSummary(input: MarketingAuditLoadInput): MarketingAuditSummary {
  const snapshots = collectMarketingAuditSnapshots(input);
  const totalMarketingItems = snapshots.length;
  const needsReviewCount = snapshots.filter((snapshot) => snapshot.needsReview).length;
  const invalidItemCount = snapshots.filter((snapshot) => snapshot.invalid).length;
  const riskyMetadataCount = snapshots.filter((snapshot) => snapshot.riskyMetadata).length;
  const missingRequiredRuntimeFieldsCount = snapshots.filter((snapshot) => !snapshot.hasRequiredFields).length;
  const auditState = resolveMarketingAuditState({
    invalidItemCount,
    missingRequiredRuntimeFieldsCount,
    needsReviewCount,
    runtimeWarning: input.runtimeWarning,
    totalMarketingItems
  });

  return {
    auditBadgeTone: getMarketingAuditBadgeTone(auditState),
    auditDescription: getMarketingAuditDescription(auditState),
    auditLabel: getMarketingAuditLabel(auditState),
    auditReady: true,
    auditState,
    auditSummary: `Audit readiness across ${totalMarketingItems} loaded marketing item views.`,
    invalidItemCount,
    lastUpdatedDisplay: resolveLatestUpdatedDisplay(snapshots),
    missingRequiredRuntimeFieldsCount,
    needsReviewCount,
    reviewedStatus: resolveReviewedStatus(auditState),
    riskyMetadataCount,
    totalMarketingItems
  };
}

export function buildMarketingAuditSummarySafe(
  input: MarketingAuditLoadInput | null | undefined
): MarketingAuditSummary {
  try {
    if (!input) {
      return {
        ...MARKETING_AUDIT_FALLBACK_SUMMARY,
        auditDescription: "Marketing audit fallback summary. No audit input was available safely."
      };
    }

    return buildMarketingAuditSummary(input);
  } catch (error) {
    console.error("[marketing-audit-runtime] audit summary failed", error);

    return {
      ...MARKETING_AUDIT_FALLBACK_SUMMARY,
      auditDescription: "Marketing audit runtime failed safely.",
      auditReady: false,
      auditState: "unknown"
    };
  }
}
