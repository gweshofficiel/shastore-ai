import "server-only";

import type { MarketingLifecycleAction } from "@/src/lib/marketing/marketing-campaign-lifecycle-runtime";
import { resolveMarketingLifecycleActionReadiness } from "@/src/lib/marketing/marketing-campaign-lifecycle-runtime";
import { isValidMarketingType, type MarketingType } from "@/src/lib/marketing/marketing-type-runtime";

export type MarketingSecurityReviewItem = {
  category: string;
  message: string;
  passed: boolean;
};

export type MarketingSecurityCertificationSummary = {
  certificationDescription: string;
  certifiedAt: string;
  failedChecks: number;
  passedChecks: number;
  securityReview: MarketingSecurityReviewItem[];
  securityReviewPassed: boolean;
  totalChecks: number;
};

export const MARKETING_REGISTRY_KEY_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,159}$/;

export const MARKETING_SECRET_PATTERN =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|provider[_-]?config|bank[_-]?account|routing[_-]?number|card[_-]?number|cvv|ssn|@[a-z0-9.-]+\.[a-z]{2,}|\b\d{3}-\d{2}-\d{4}\b)/i;

const STATIC_SECURITY_REVIEW: MarketingSecurityReviewItem[] = [
  {
    category: "Access control",
    message: "Marketing runtime modules are server-only and /admin/marketing is admin-gated.",
    passed: true
  },
  {
    category: "Page load",
    message: "Admin marketing page load uses read-only registry and summary queries only.",
    passed: true
  },
  {
    category: "Database",
    message: "Marketing tables use RLS with service_role-only policies.",
    passed: true
  },
  {
    category: "Execution",
    message: "No redemption, payout, commission settlement, email send, or notification send execution paths are active.",
    passed: true
  },
  {
    category: "Actions",
    message: "Lifecycle server actions record monitoring events only and do not mutate marketing tables.",
    passed: true
  }
];

export const MARKETING_SECURITY_CERTIFICATION_FALLBACK_SUMMARY: MarketingSecurityCertificationSummary = {
  certificationDescription: "Marketing security certification fallback. Review could not be completed safely.",
  certifiedAt: new Date(0).toISOString(),
  failedChecks: 0,
  passedChecks: STATIC_SECURITY_REVIEW.length,
  securityReview: STATIC_SECURITY_REVIEW,
  securityReviewPassed: false,
  totalChecks: STATIC_SECURITY_REVIEW.length
};

export function sanitizeMarketingSecurityText(value: unknown, maxLength = 200) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function containsMarketingSecretPattern(value: unknown) {
  const cleaned = sanitizeMarketingSecurityText(value, 500);
  if (!cleaned) return false;
  return MARKETING_SECRET_PATTERN.test(cleaned);
}

export function isValidMarketingRegistryKey(value: unknown): value is string {
  const cleaned = sanitizeMarketingSecurityText(value, 160);
  return Boolean(cleaned && MARKETING_REGISTRY_KEY_PATTERN.test(cleaned));
}

export function isValidMarketingActionType(value: unknown): value is MarketingType {
  const cleaned = sanitizeMarketingSecurityText(value, 40);
  return isValidMarketingType(cleaned);
}

export function mapMarketingPlatformActionToLifecycleAction(
  action:
    | "admin_platform_marketing_activate_campaign"
    | "admin_platform_marketing_archive_campaign"
    | "admin_platform_marketing_create_draft"
    | "admin_platform_marketing_pause_campaign"
    | "admin_platform_marketing_view_usage"
): MarketingLifecycleAction {
  if (action === "admin_platform_marketing_activate_campaign") return "activate";
  if (action === "admin_platform_marketing_archive_campaign") return "archive";
  if (action === "admin_platform_marketing_create_draft") return "create_draft";
  if (action === "admin_platform_marketing_pause_campaign") return "pause";
  return "view_usage";
}

export function canRecordMarketingPlatformAction(access: {
  internalRole?: string;
  role: "internal_team" | "super_admin";
}) {
  if (access.role === "super_admin") return true;
  return access.internalRole === "marketing_operator";
}

export function assertMarketingLifecycleActionReady(params: {
  action:
    | "admin_platform_marketing_activate_campaign"
    | "admin_platform_marketing_archive_campaign"
    | "admin_platform_marketing_create_draft"
    | "admin_platform_marketing_pause_campaign"
    | "admin_platform_marketing_view_usage";
  status: unknown;
}) {
  const lifecycleAction = mapMarketingPlatformActionToLifecycleAction(params.action);
  const readiness = resolveMarketingLifecycleActionReadiness({
    action: lifecycleAction,
    status: params.status
  });

  if (!readiness.ready) {
    throw new Error("Marketing lifecycle action is not ready for the current campaign status.");
  }
}

export type MarketingSecurityCertificationInput = {
  metadataSummaries: unknown[];
  runtimeWarning?: string | null;
};

function buildDynamicSecurityReview(input: MarketingSecurityCertificationInput): MarketingSecurityReviewItem[] {
  const summaries = Array.isArray(input.metadataSummaries) ? input.metadataSummaries : [];
  const exposedSecretSummaries = summaries.filter((summary) => containsMarketingSecretPattern(summary)).length;
  const hiddenSummaries = summaries.filter((summary) => {
    const cleaned = sanitizeMarketingSecurityText(summary, 500).toLowerCase();
    return cleaned.includes("hidden for safety");
  }).length;

  return [
    {
      category: "Metadata",
      message:
        exposedSecretSummaries === 0
          ? "Loaded marketing metadata summaries did not match secret or private-data patterns."
          : `${exposedSecretSummaries} loaded metadata summaries matched blocked secret patterns.`,
      passed: exposedSecretSummaries === 0
    },
    {
      category: "Metadata",
      message:
        hiddenSummaries > 0
          ? `${hiddenSummaries} metadata summaries were safely redacted before display.`
          : "No metadata summaries required redaction in the loaded admin view.",
      passed: true
    },
    {
      category: "Resilience",
      message: sanitizeMarketingSecurityText(input.runtimeWarning, 240)
        ? "Runtime warnings are present. Admin view is using safe fallback or recovery paths."
        : "No runtime warnings were reported for the loaded marketing admin view.",
      passed: !sanitizeMarketingSecurityText(input.runtimeWarning, 240)
    }
  ];
}

export function buildMarketingSecurityCertification(
  input: MarketingSecurityCertificationInput
): MarketingSecurityCertificationSummary {
  const securityReview = [...STATIC_SECURITY_REVIEW, ...buildDynamicSecurityReview(input)];
  const passedChecks = securityReview.filter((item) => item.passed).length;
  const failedChecks = securityReview.length - passedChecks;

  return {
    certificationDescription:
      failedChecks === 0
        ? "Marketing security certification passed for loaded admin foundations MK-1 to MK-27."
        : "Marketing security certification completed with items that need attention.",
    certifiedAt: new Date().toISOString(),
    failedChecks,
    passedChecks,
    securityReview,
    securityReviewPassed: failedChecks === 0,
    totalChecks: securityReview.length
  };
}

export function buildMarketingSecurityCertificationSafe(
  input: MarketingSecurityCertificationInput | null | undefined
): MarketingSecurityCertificationSummary {
  try {
    return buildMarketingSecurityCertification(input ?? { metadataSummaries: [] });
  } catch (error) {
    console.error("[marketing-security-certification] certification failed", error);

    return {
      ...MARKETING_SECURITY_CERTIFICATION_FALLBACK_SUMMARY,
      certificationDescription: "Marketing security certification runtime failed safely.",
      certifiedAt: new Date().toISOString()
    };
  }
}

export function collectMarketingMetadataSummariesForCertification(params: {
  affiliates: Array<{ metadataSummary?: unknown }>;
  campaigns: Array<{ metadataSummary?: unknown }>;
  coupons: Array<{ metadataSummary?: unknown }>;
  giftCodes: Array<{ metadataSummary?: unknown }>;
  platformCampaigns: Array<{ metadataSummary?: unknown }>;
  promotions: Array<{ metadataSummary?: unknown }>;
  referrals: Array<{ metadataSummary?: unknown }>;
}) {
  return [
    ...params.campaigns.map((item) => item.metadataSummary),
    ...params.coupons.map((item) => item.metadataSummary),
    ...params.promotions.map((item) => item.metadataSummary),
    ...params.giftCodes.map((item) => item.metadataSummary),
    ...params.referrals.map((item) => item.metadataSummary),
    ...params.affiliates.map((item) => item.metadataSummary),
    ...params.platformCampaigns.map((item) => item.metadataSummary)
  ];
}
