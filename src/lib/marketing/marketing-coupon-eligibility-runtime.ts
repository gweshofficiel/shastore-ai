import "server-only";

import {
  resolveMarketingAudienceKey,
  sanitizeMarketingAudienceSummary
} from "@/src/lib/marketing/marketing-audience-runtime";
import {
  getMarketingLifecycleDescription,
  getMarketingLifecycleLabel,
  resolveMarketingCampaignLifecycleView
} from "@/src/lib/marketing/marketing-campaign-lifecycle-runtime";
import {
  isValidMarketingCouponValidationState,
  type MarketingCouponValidationState
} from "@/src/lib/marketing/marketing-coupon-validation-runtime";
import {
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import {
  parseMarketingType,
  type MarketingType
} from "@/src/lib/marketing/marketing-type-runtime";

export type MarketingCouponEligibilityState = "eligible" | "needs_review" | "not_eligible" | "unknown";

export type MarketingCouponEligibilityIssueSeverity = "blocker" | "review";

export type MarketingCouponEligibilityIssue = {
  code: string;
  message: string;
  severity: MarketingCouponEligibilityIssueSeverity;
};

export type MarketingCouponEligibilityView = {
  eligibilityBadgeTone: "amber" | "blue" | "green" | "red";
  eligibilityDescription: string;
  eligibilityIssues: MarketingCouponEligibilityIssue[];
  eligibilityLabel: string;
  eligibilityReady: boolean;
  eligibilityState: MarketingCouponEligibilityState;
};

export type MarketingCouponEligibilityInput = {
  exists?: boolean;
  lifecycleState?: unknown;
  marketingType: unknown;
  metadata?: unknown;
  registryKey: string;
  status: unknown;
  targetAudienceSummary: string;
  validationReady?: boolean;
  validationState?: unknown;
};

const legacyCouponRegistryKeys = new Set(["platform-promotion:annual-upgrade"]);

const displayableCouponStatuses = new Set<MarketingStatus>(["draft", "active", "paused"]);

const blockedCouponStatuses = new Set<MarketingStatus>(["expired", "archived"]);

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

function safeRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isLegacyCouponRegistryKey(registryKey: string) {
  return legacyCouponRegistryKeys.has(registryKey);
}

function parseValidationState(value: unknown): MarketingCouponValidationState | null {
  if (isValidMarketingCouponValidationState(value)) {
    return value;
  }

  return null;
}

function inspectMarketingCouponEligibilityExistence(params: {
  exists: boolean;
  registryKey: string;
}): MarketingCouponEligibilityIssue[] {
  if (params.exists && params.registryKey) {
    return [];
  }

  return [
    {
      code: "eligibility_coupon_unknown",
      message: "Coupon registry item could not be resolved for eligibility readiness.",
      severity: "review"
    }
  ];
}

function inspectMarketingCouponEligibilityType(params: {
  marketingType: MarketingType | null;
  registryKey: string;
}): MarketingCouponEligibilityIssue[] {
  if (params.marketingType === "coupon") {
    return [];
  }

  if (isLegacyCouponRegistryKey(params.registryKey)) {
    return [
      {
        code: "eligibility_legacy_coupon_display",
        message: "Legacy promotion-linked coupon display requires review before eligibility can be classified.",
        severity: "review"
      }
    ];
  }

  if (!params.marketingType) {
    return [
      {
        code: "eligibility_type_unknown",
        message: "Coupon marketing type is unknown for eligibility classification.",
        severity: "review"
      }
    ];
  }

  return [
    {
      code: "eligibility_type_not_coupon",
      message: `Coupon eligibility requires marketing type coupon, not ${params.marketingType}.`,
      severity: "blocker"
    }
  ];
}

function inspectMarketingCouponEligibilityStatus(status: MarketingStatus | null): MarketingCouponEligibilityIssue[] {
  if (!status) {
    return [
      {
        code: "eligibility_status_unknown",
        message: "Coupon status is unknown for eligibility classification.",
        severity: "review"
      }
    ];
  }

  if (blockedCouponStatuses.has(status)) {
    return [
      {
        code: "eligibility_status_blocked",
        message: `Coupon is ${status} and is not eligible for future runtime phases.`,
        severity: "blocker"
      }
    ];
  }

  if (status === "active") {
    return [];
  }

  if (displayableCouponStatuses.has(status)) {
    return [
      {
        code: "eligibility_status_display_only",
        message: `Coupon is ${status} and remains display-only. Eligibility enforcement is not connected.`,
        severity: "review"
      }
    ];
  }

  return [
    {
      code: "eligibility_status_unclassified",
      message: "Coupon status could not be classified for eligibility readiness.",
      severity: "review"
    }
  ];
}

function inspectMarketingCouponEligibilityValidation(params: {
  validationReady?: boolean;
  validationState: MarketingCouponValidationState | null;
}): MarketingCouponEligibilityIssue[] {
  if (!params.validationState) {
    return [
      {
        code: "eligibility_validation_unknown",
        message: "Coupon validation state is unknown for eligibility classification.",
        severity: "review"
      }
    ];
  }

  if (params.validationState === "invalid") {
    return [
      {
        code: "eligibility_validation_invalid",
        message: "Coupon failed validation-readiness checks and is not eligible yet.",
        severity: "blocker"
      }
    ];
  }

  if (params.validationState === "needs_review") {
    return [
      {
        code: "eligibility_validation_needs_review",
        message: "Coupon validation requires Super Admin review before eligibility can be confirmed.",
        severity: "review"
      }
    ];
  }

  if (params.validationReady === false) {
    return [
      {
        code: "eligibility_validation_not_ready",
        message: "Coupon validation readiness is incomplete for eligibility classification.",
        severity: "review"
      }
    ];
  }

  return [];
}

function inspectMarketingCouponEligibilityAudience(params: {
  audienceKey: ReturnType<typeof resolveMarketingAudienceKey>;
  targetAudienceSummary: string;
}): MarketingCouponEligibilityIssue[] {
  const summary = sanitizeMarketingAudienceSummary(params.targetAudienceSummary);

  if (summary === "Audience summary unavailable.") {
    return [
      {
        code: "eligibility_audience_missing",
        message: "Coupon target audience summary is unavailable for eligibility classification.",
        severity: "review"
      }
    ];
  }

  if (!params.audienceKey) {
    return [
      {
        code: "eligibility_audience_unclassified",
        message: "Coupon audience is descriptive only and not yet classified for eligibility readiness.",
        severity: "review"
      }
    ];
  }

  return [];
}

function inspectMarketingCouponEligibilityLifecycle(params: {
  lifecycleState: MarketingStatus | null;
  status: MarketingStatus | null;
}): MarketingCouponEligibilityIssue[] {
  const lifecycleState = params.lifecycleState ?? params.status;

  if (!lifecycleState) {
    return [
      {
        code: "eligibility_lifecycle_unknown",
        message: "Coupon lifecycle state is unknown for eligibility classification.",
        severity: "review"
      }
    ];
  }

  const lifecycle = resolveMarketingCampaignLifecycleView(lifecycleState);

  if (lifecycle.lifecycleState === "active") {
    return [];
  }

  if (blockedCouponStatuses.has(lifecycle.lifecycleState)) {
    return [
      {
        code: "eligibility_lifecycle_blocked",
        message: `${getMarketingLifecycleLabel(lifecycle.lifecycleState)} is not eligible for future runtime phases.`,
        severity: "blocker"
      }
    ];
  }

  return [
    {
      code: "eligibility_lifecycle_review",
      message: `${getMarketingLifecycleLabel(lifecycle.lifecycleState)} remains foundation-only. ${getMarketingLifecycleDescription(lifecycle.lifecycleState)}`,
      severity: "review"
    }
  ];
}

function inspectMarketingCouponEligibilityMetadata(metadata: unknown): MarketingCouponEligibilityIssue[] {
  const record = safeRecord(metadata);

  if (record === null) {
    return [
      {
        code: "eligibility_metadata_malformed",
        message: "Coupon public metadata is malformed for eligibility classification.",
        severity: "blocker"
      }
    ];
  }

  return [];
}

export function listMarketingCouponEligibilityIssues(
  input: MarketingCouponEligibilityInput
): MarketingCouponEligibilityIssue[] {
  const registryKey = text(input.registryKey, 160);
  const exists = input.exists ?? Boolean(registryKey);
  const marketingType = parseMarketingType(input.marketingType);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;
  const validationState = parseValidationState(input.validationState);
  const metadata = safeRecord(input.metadata);
  const targetAudienceSummary = sanitizeMarketingAudienceSummary(input.targetAudienceSummary);
  const audienceKey = resolveMarketingAudienceKey({
    marketingType: marketingType ?? undefined,
    metadata: metadata ?? undefined,
    registryKey,
    targetAudience: targetAudienceSummary
  });

  return [
    ...inspectMarketingCouponEligibilityExistence({ exists, registryKey }),
    ...inspectMarketingCouponEligibilityType({ marketingType, registryKey }),
    ...inspectMarketingCouponEligibilityStatus(status),
    ...inspectMarketingCouponEligibilityValidation({
      validationReady: input.validationReady,
      validationState
    }),
    ...inspectMarketingCouponEligibilityAudience({ audienceKey, targetAudienceSummary }),
    ...inspectMarketingCouponEligibilityLifecycle({ lifecycleState, status }),
    ...inspectMarketingCouponEligibilityMetadata(input.metadata)
  ];
}

export function resolveMarketingCouponEligibilityState(
  issues: MarketingCouponEligibilityIssue[],
  input: MarketingCouponEligibilityInput
): MarketingCouponEligibilityState {
  const registryKey = text(input.registryKey, 160);
  const exists = input.exists ?? Boolean(registryKey);
  const marketingType = parseMarketingType(input.marketingType);
  const status = parseMarketingStatus(input.status);
  const validationState = parseValidationState(input.validationState);

  if (!exists || !registryKey) {
    return "unknown";
  }

  if (!marketingType && !isLegacyCouponRegistryKey(registryKey)) {
    return "unknown";
  }

  if (!status && !validationState) {
    return "unknown";
  }

  if (issues.some((issue) => issue.severity === "blocker")) {
    return "not_eligible";
  }

  if (issues.some((issue) => issue.severity === "review")) {
    return "needs_review";
  }

  return "eligible";
}

export function getMarketingCouponEligibilityLabel(state: MarketingCouponEligibilityState) {
  if (state === "eligible") return "Eligible";
  if (state === "not_eligible") return "Not eligible";
  if (state === "needs_review") return "Needs review";
  return "Unknown";
}

export function getMarketingCouponEligibilityDescription(state: MarketingCouponEligibilityState) {
  if (state === "eligible") {
    return "Coupon passed eligibility-readiness checks. No checkout, billing, or redemption enforcement yet.";
  }

  if (state === "not_eligible") {
    return "Coupon is classified as not eligible for future runtime phases. No enforcement is applied.";
  }

  if (state === "needs_review") {
    return "Coupon eligibility requires Super Admin review. Classification is readiness-only.";
  }

  return "Coupon eligibility could not be classified safely. No customer or payment data is exposed.";
}

export function getMarketingCouponEligibilityBadgeTone(
  state: MarketingCouponEligibilityState
): MarketingCouponEligibilityView["eligibilityBadgeTone"] {
  if (state === "eligible") return "green";
  if (state === "not_eligible") return "red";
  if (state === "needs_review") return "amber";
  return "blue";
}

export function resolveMarketingCouponEligibilityView(
  input: MarketingCouponEligibilityInput
): MarketingCouponEligibilityView {
  const eligibilityIssues = listMarketingCouponEligibilityIssues(input);
  const eligibilityState = resolveMarketingCouponEligibilityState(eligibilityIssues, input);

  return {
    eligibilityBadgeTone: getMarketingCouponEligibilityBadgeTone(eligibilityState),
    eligibilityDescription: getMarketingCouponEligibilityDescription(eligibilityState),
    eligibilityIssues,
    eligibilityLabel: getMarketingCouponEligibilityLabel(eligibilityState),
    eligibilityReady: eligibilityState === "eligible",
    eligibilityState
  };
}

export function resolveMarketingCouponEligibilityViewSafe(
  input: MarketingCouponEligibilityInput
): MarketingCouponEligibilityView {
  try {
    return resolveMarketingCouponEligibilityView(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-coupon-eligibility-runtime] eligibility view failed", error);

    return {
      eligibilityBadgeTone: "blue",
      eligibilityDescription: getMarketingCouponEligibilityDescription("unknown"),
      eligibilityIssues: [
        {
          code: "eligibility_runtime_error",
          message: message || "Coupon eligibility runtime failed safely.",
          severity: "review"
        }
      ],
      eligibilityLabel: getMarketingCouponEligibilityLabel("unknown"),
      eligibilityReady: false,
      eligibilityState: "unknown"
    };
  }
}

export function isMarketingCouponEligibilityReady(input: MarketingCouponEligibilityInput) {
  return resolveMarketingCouponEligibilityViewSafe(input).eligibilityReady;
}

export function isValidMarketingCouponEligibilityState(
  value: unknown
): value is MarketingCouponEligibilityState {
  return (
    value === "eligible" ||
    value === "not_eligible" ||
    value === "needs_review" ||
    value === "unknown"
  );
}
