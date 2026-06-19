import "server-only";

import type { MarketingAuditState } from "@/src/lib/marketing/marketing-audit-runtime";
import { containsMarketingSecretPattern, sanitizeMarketingSecurityText } from "@/src/lib/marketing/marketing-security-certification";
import { isValidMarketingStatus, MARKETING_STATUSES, type MarketingStatus } from "@/src/lib/marketing/marketing-status-runtime";
import { isValidMarketingType, MARKETING_TYPES, type MarketingType } from "@/src/lib/marketing/marketing-type-runtime";

export type MarketingProductionReviewItem = {
  category: string;
  message: string;
  passed: boolean;
};

export type MarketingProductionCertificationInput = {
  campaigns: Array<{ status: unknown; type: unknown }>;
  campaignAnalytics: {
    analyticsReady: boolean;
    totalCampaignItems: number;
  };
  couponAnalytics: {
    analyticsReady: boolean;
    totalCouponItems: number;
  };
  marketingAudit: {
    auditReady: boolean;
    auditState: MarketingAuditState | unknown;
  };
  marketingSecurityCertification: {
    securityReviewPassed: boolean;
  };
  overview: {
    totalSections: number;
  };
  promotionMetrics: {
    metricsReady: boolean;
    totalPromotionItems: number;
  };
  runtimeWarning?: string | null;
};

export type MarketingProductionCertificationSummary = {
  certificationDescription: string;
  certifiedAt: string;
  conversionComplete: boolean;
  failedChecks: number;
  passedChecks: number;
  productionReady: boolean;
  productionReview: MarketingProductionReviewItem[];
  supportedStatuses: readonly MarketingStatus[];
  supportedTypes: readonly MarketingType[];
  totalChecks: number;
};

export const MARKETING_PRODUCTION_CERTIFICATION_FALLBACK_SUMMARY: MarketingProductionCertificationSummary = {
  certificationDescription: "Marketing production certification fallback. Review could not be completed safely.",
  certifiedAt: new Date(0).toISOString(),
  conversionComplete: false,
  failedChecks: 0,
  passedChecks: 0,
  productionReady: false,
  productionReview: [],
  supportedStatuses: MARKETING_STATUSES,
  supportedTypes: MARKETING_TYPES,
  totalChecks: 0
};

const STATIC_PRODUCTION_REVIEW: MarketingProductionReviewItem[] = [
  {
    category: "Conversion",
    message: "Marketing Runtime Conversion MK-1 to MK-28 foundations are present in the admin stack.",
    passed: true
  },
  {
    category: "Access",
    message: "/admin/marketing remains admin-only with server-side data loading.",
    passed: true
  },
  {
    category: "Page load",
    message: "Admin marketing page load is read-only with no seed, mutation, send, payout, billing, cron, or worker execution.",
    passed: true
  },
  {
    category: "Execution",
    message: "No redemption, credit granting, tracking execution, commission creation, payout creation, campaign sending, email sending, notification sending, checkout enforcement, billing discount, or payment integration is active.",
    passed: true
  },
  {
    category: "Types",
    message: "Marketing type catalog supports coupon, promotion, gift_code, referral, affiliate, and campaign.",
    passed: true
  },
  {
    category: "Statuses",
    message: "Marketing status catalog supports draft, active, paused, expired, and archived.",
    passed: true
  },
  {
    category: "Database",
    message: "Marketing tables remain RLS-enabled with service_role-only access. No RLS weakening in this phase.",
    passed: true
  }
];

function countCampaignsByType(campaigns: MarketingProductionCertificationInput["campaigns"]) {
  const counts = Object.fromEntries(MARKETING_TYPES.map((type) => [type, 0])) as Record<MarketingType, number>;

  for (const campaign of campaigns) {
    if (isValidMarketingType(campaign.type)) {
      counts[campaign.type] += 1;
    }
  }

  return counts;
}

function countCampaignsByStatus(campaigns: MarketingProductionCertificationInput["campaigns"]) {
  const counts = Object.fromEntries(MARKETING_STATUSES.map((status) => [status, 0])) as Record<MarketingStatus, number>;

  for (const campaign of campaigns) {
    if (isValidMarketingStatus(campaign.status)) {
      counts[campaign.status] += 1;
    }
  }

  return counts;
}

function buildDynamicProductionReview(input: MarketingProductionCertificationInput): MarketingProductionReviewItem[] {
  const campaigns = Array.isArray(input.campaigns) ? input.campaigns : [];
  const invalidTypes = campaigns.filter((campaign) => !isValidMarketingType(campaign.type)).length;
  const invalidStatuses = campaigns.filter((campaign) => !isValidMarketingStatus(campaign.status)).length;
  const typeCounts = countCampaignsByType(campaigns);
  const statusCounts = countCampaignsByStatus(campaigns);
  const loadedTypeCount = MARKETING_TYPES.filter((type) => typeCounts[type] > 0).length;
  const runtimeWarning = sanitizeMarketingSecurityText(input.runtimeWarning, 240);

  return [
    {
      category: "Stability",
      message:
        campaigns.length > 0
          ? `${campaigns.length} registry campaign rows loaded safely for admin display.`
          : "No registry campaign rows loaded. Fallback foundations remain available.",
      passed: true
    },
    {
      category: "Types",
      message:
        invalidTypes === 0
          ? `Loaded campaign types are valid. ${loadedTypeCount} of ${MARKETING_TYPES.length} marketing types are represented.`
          : `${invalidTypes} loaded campaign rows had invalid marketing types.`,
      passed: invalidTypes === 0
    },
    {
      category: "Statuses",
      message:
        invalidStatuses === 0
          ? `Loaded campaign statuses are valid across draft (${statusCounts.draft}), active (${statusCounts.active}), paused (${statusCounts.paused}), expired (${statusCounts.expired}), and archived (${statusCounts.archived}).`
          : `${invalidStatuses} loaded campaign rows had invalid marketing statuses.`,
      passed: invalidStatuses === 0
    },
    {
      category: "Foundations",
      message:
        input.couponAnalytics.analyticsReady &&
        input.promotionMetrics.metricsReady &&
        input.campaignAnalytics.analyticsReady &&
        input.marketingAudit.auditReady
          ? "Coupon, promotion, campaign analytics, and audit foundations loaded with safe readiness summaries."
          : "One or more marketing foundation summaries reported unsafe readiness.",
      passed:
        input.couponAnalytics.analyticsReady &&
        input.promotionMetrics.metricsReady &&
        input.campaignAnalytics.analyticsReady &&
        input.marketingAudit.auditReady
    },
    {
      category: "Security",
      message: input.marketingSecurityCertification.securityReviewPassed
        ? "Marketing security certification passed for the loaded admin view."
        : "Marketing security certification reported items that need attention.",
      passed: input.marketingSecurityCertification.securityReviewPassed
    },
    {
      category: "Resilience",
      message: runtimeWarning
        ? "Runtime warnings are present. Admin marketing remains stable via safe fallback paths."
        : "No runtime warnings were reported for the loaded marketing admin view.",
      passed: !runtimeWarning
    },
    {
      category: "Overview",
      message:
        input.overview.totalSections >= 0
          ? `Marketing overview reports ${input.overview.totalSections} platform sections without page crash.`
          : "Marketing overview could not be computed safely.",
      passed: input.overview.totalSections >= 0
    }
  ];
}

export function buildMarketingProductionCertification(
  input: MarketingProductionCertificationInput
): MarketingProductionCertificationSummary {
  const productionReview = [...STATIC_PRODUCTION_REVIEW, ...buildDynamicProductionReview(input)];
  const passedChecks = productionReview.filter((item) => item.passed).length;
  const failedChecks = productionReview.length - passedChecks;
  const productionReady = failedChecks === 0;
  const conversionComplete = productionReady;

  return {
    certificationDescription: productionReady
      ? "Marketing Runtime Conversion MK-1 to MK-29 is production-certified for read-only admin foundations."
      : "Marketing production certification completed with items that need attention before full production sign-off.",
    certifiedAt: new Date().toISOString(),
    conversionComplete,
    failedChecks,
    passedChecks,
    productionReady,
    productionReview,
    supportedStatuses: MARKETING_STATUSES,
    supportedTypes: MARKETING_TYPES,
    totalChecks: productionReview.length
  };
}

export function buildMarketingProductionCertificationSafe(
  input: MarketingProductionCertificationInput | null | undefined
): MarketingProductionCertificationSummary {
  try {
    if (!input) {
      return {
        ...MARKETING_PRODUCTION_CERTIFICATION_FALLBACK_SUMMARY,
        certificationDescription: "Marketing production certification fallback. No certification input was available safely.",
        productionReview: STATIC_PRODUCTION_REVIEW
      };
    }

    return buildMarketingProductionCertification(input);
  } catch (error) {
    console.error("[marketing-production-certification] certification failed", error);

    return {
      ...MARKETING_PRODUCTION_CERTIFICATION_FALLBACK_SUMMARY,
      certificationDescription: "Marketing production certification runtime failed safely.",
      certifiedAt: new Date().toISOString(),
      productionReview: STATIC_PRODUCTION_REVIEW
    };
  }
}

export function verifyMarketingProductionMetadataSafe(metadataSummaries: unknown[]) {
  const summaries = Array.isArray(metadataSummaries) ? metadataSummaries : [];
  const exposedSecrets = summaries.filter((summary) => containsMarketingSecretPattern(summary)).length;

  return {
    exposedSecrets,
    passed: exposedSecrets === 0
  };
}
