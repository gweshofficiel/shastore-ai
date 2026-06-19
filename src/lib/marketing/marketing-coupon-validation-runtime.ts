import "server-only";

import {
  resolveMarketingAudienceKey,
  sanitizeMarketingAudienceSummary
} from "@/src/lib/marketing/marketing-audience-runtime";
import {
  isValidMarketingStatus,
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import {
  parseMarketingType,
  type MarketingType
} from "@/src/lib/marketing/marketing-type-runtime";

export type MarketingCouponValidationState = "invalid" | "needs_review" | "valid";

export type MarketingCouponValidationIssueSeverity = "error" | "warning";

export type MarketingCouponValidationIssue = {
  code: string;
  message: string;
  severity: MarketingCouponValidationIssueSeverity;
};

export type MarketingCouponValidationView = {
  validationBadgeTone: "amber" | "blue" | "green" | "red";
  validationDescription: string;
  validationIssues: MarketingCouponValidationIssue[];
  validationLabel: string;
  validationReady: boolean;
  validationState: MarketingCouponValidationState;
};

export type MarketingCouponValidationInput = {
  code: string;
  exists?: boolean;
  marketingType: unknown;
  metadata?: unknown;
  registryKey: string;
  slug: string;
  status: unknown;
  targetAudienceSummary: string;
};

const legacyCouponRegistryKeys = new Set(["platform-promotion:annual-upgrade"]);

const forbiddenMetadataKeyPattern =
  /^(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key)$/i;

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,})/i;

const slugPattern = /^[a-z0-9][a-z0-9_-]{0,159}$/;

const registryKeyPattern = /^[a-z0-9][a-z0-9:_-]{0,159}$/;

const couponCodePattern = /^[A-Z0-9][A-Z0-9_-]{2,63}$/;

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

function inspectMarketingCouponMetadata(metadata: unknown): MarketingCouponValidationIssue[] {
  const issues: MarketingCouponValidationIssue[] = [];
  const record = safeRecord(metadata);

  if (record === null) {
    issues.push({
      code: "metadata_malformed",
      message: "Coupon public metadata must be a safe object. No validation or redemption is performed.",
      severity: "error"
    });
    return issues;
  }

  for (const [key, value] of Object.entries(record)) {
    const cleanedKey = text(key, 120);

    if (!cleanedKey || forbiddenMetadataKeyPattern.test(cleanedKey)) {
      issues.push({
        code: "metadata_forbidden_key",
        message: "Coupon metadata contains a restricted public key and requires review.",
        severity: "error"
      });
      continue;
    }

    if (typeof value === "object" && value !== null) {
      issues.push({
        code: "metadata_nested_value",
        message: "Coupon metadata contains nested values that are not display-safe yet.",
        severity: "warning"
      });
      continue;
    }

    const cleanedValue = text(value, 500);

    if (cleanedValue && secretPattern.test(cleanedValue)) {
      issues.push({
        code: "metadata_secret_value",
        message: "Coupon metadata contains values that must not be exposed publicly.",
        severity: "error"
      });
    }
  }

  return issues;
}

function inspectMarketingCouponType(params: {
  marketingType: MarketingType | null;
  registryKey: string;
}): MarketingCouponValidationIssue[] {
  if (params.marketingType === "coupon") {
    return [];
  }

  if (isLegacyCouponRegistryKey(params.registryKey)) {
    return [
      {
        code: "legacy_coupon_display",
        message: "Legacy coupon-table display is linked to a promotion foundation row and needs review.",
        severity: "warning"
      }
    ];
  }

  if (!params.marketingType) {
    return [
      {
        code: "coupon_type_missing",
        message: "Coupon marketing type is missing or invalid.",
        severity: "error"
      }
    ];
  }

  return [
    {
      code: "coupon_type_mismatch",
      message: `Coupon display is linked to marketing type "${params.marketingType}" instead of coupon.`,
      severity: "error"
    }
  ];
}

function inspectMarketingCouponStatus(status: MarketingStatus | null): MarketingCouponValidationIssue[] {
  if (!status) {
    return [
      {
        code: "coupon_status_invalid",
        message: "Coupon status must be draft, active, paused, expired, or archived.",
        severity: "error"
      }
    ];
  }

  if (status !== "active") {
    return [
      {
        code: "coupon_status_review",
        message: `Coupon is ${status} and remains display-only until future validation phases.`,
        severity: "warning"
      }
    ];
  }

  return [];
}

function inspectMarketingCouponCodeDisplay(params: {
  code: string;
  registryKey: string;
  slug: string;
}): MarketingCouponValidationIssue[] {
  const issues: MarketingCouponValidationIssue[] = [];
  const registryKey = text(params.registryKey, 160);
  const slug = text(params.slug, 160);
  const code = text(params.code, 80);

  if (!registryKey || !registryKeyPattern.test(registryKey)) {
    issues.push({
      code: "coupon_registry_missing",
      message: "Coupon registry key is missing or malformed.",
      severity: "error"
    });
  }

  if (!slug || !slugPattern.test(slug)) {
    issues.push({
      code: "coupon_slug_invalid",
      message: "Coupon slug is missing or not display-safe.",
      severity: "warning"
    });
  }

  if (!code) {
    issues.push({
      code: "coupon_code_missing",
      message: "Coupon code is missing from the display runtime.",
      severity: "error"
    });
    return issues;
  }

  if (secretPattern.test(code)) {
    issues.push({
      code: "coupon_code_unsafe",
      message: "Coupon code contains values that must not be exposed publicly.",
      severity: "error"
    });
  }

  if (!couponCodePattern.test(code)) {
    issues.push({
      code: "coupon_code_format",
      message: "Coupon code format should be reviewed before future validation phases.",
      severity: "warning"
    });
  }

  if (code === "COUPON-DRAFT" && !isLegacyCouponRegistryKey(registryKey)) {
    issues.push({
      code: "coupon_code_placeholder",
      message: "Coupon code is still using a placeholder draft label.",
      severity: "warning"
    });
  }

  return issues;
}

function inspectMarketingCouponAudience(params: {
  audienceKey: ReturnType<typeof resolveMarketingAudienceKey>;
  targetAudienceSummary: string;
}): MarketingCouponValidationIssue[] {
  const summary = sanitizeMarketingAudienceSummary(params.targetAudienceSummary);

  if (summary === "Audience summary unavailable.") {
    return [
      {
        code: "coupon_audience_missing",
        message: "Coupon audience summary is unavailable.",
        severity: "warning"
      }
    ];
  }

  if (!params.audienceKey) {
    return [
      {
        code: "coupon_audience_unclassified",
        message: "Coupon audience is descriptive only and not yet classified for validation readiness.",
        severity: "warning"
      }
    ];
  }

  return [];
}

export function listMarketingCouponValidationIssues(
  input: MarketingCouponValidationInput
): MarketingCouponValidationIssue[] {
  const exists = input.exists ?? Boolean(text(input.registryKey, 160));
  const registryKey = text(input.registryKey, 160);
  const marketingType = parseMarketingType(input.marketingType);
  const status = parseMarketingStatus(input.status);
  const metadata = safeRecord(input.metadata);
  const targetAudienceSummary = sanitizeMarketingAudienceSummary(input.targetAudienceSummary);
  const audienceKey = resolveMarketingAudienceKey({
    marketingType: marketingType ?? undefined,
    metadata: metadata ?? undefined,
    registryKey,
    targetAudience: targetAudienceSummary
  });

  const issues: MarketingCouponValidationIssue[] = [];

  if (!exists) {
    issues.push({
      code: "coupon_missing",
      message: "Coupon registry item could not be resolved for validation readiness.",
      severity: "error"
    });
  }

  issues.push(
    ...inspectMarketingCouponType({ marketingType, registryKey }),
    ...inspectMarketingCouponStatus(status),
    ...inspectMarketingCouponCodeDisplay({
      code: input.code,
      registryKey,
      slug: input.slug
    }),
    ...inspectMarketingCouponAudience({ audienceKey, targetAudienceSummary }),
    ...inspectMarketingCouponMetadata(input.metadata)
  );

  return issues;
}

export function resolveMarketingCouponValidationState(
  issues: MarketingCouponValidationIssue[]
): MarketingCouponValidationState {
  if (issues.some((issue) => issue.severity === "error")) {
    return "invalid";
  }

  if (issues.some((issue) => issue.severity === "warning")) {
    return "needs_review";
  }

  return "valid";
}

export function getMarketingCouponValidationLabel(state: MarketingCouponValidationState) {
  if (state === "invalid") return "Invalid";
  if (state === "needs_review") return "Needs review";
  return "Valid";
}

export function getMarketingCouponValidationDescription(state: MarketingCouponValidationState) {
  if (state === "invalid") {
    return "Coupon display data failed validation-readiness checks. No redemption or billing changes occur.";
  }

  if (state === "needs_review") {
    return "Coupon is display-safe but requires Super Admin review before future validation phases.";
  }

  return "Coupon passed display/runtime validation-readiness checks. No redemption or billing integration yet.";
}

export function getMarketingCouponValidationBadgeTone(
  state: MarketingCouponValidationState
): MarketingCouponValidationView["validationBadgeTone"] {
  if (state === "invalid") return "red";
  if (state === "needs_review") return "amber";
  return "green";
}

export function resolveMarketingCouponValidationView(
  input: MarketingCouponValidationInput
): MarketingCouponValidationView {
  const validationIssues = listMarketingCouponValidationIssues(input);
  const validationState = resolveMarketingCouponValidationState(validationIssues);

  return {
    validationBadgeTone: getMarketingCouponValidationBadgeTone(validationState),
    validationDescription: getMarketingCouponValidationDescription(validationState),
    validationIssues,
    validationLabel: getMarketingCouponValidationLabel(validationState),
    validationReady: validationState !== "invalid",
    validationState
  };
}

export function resolveMarketingCouponValidationViewSafe(
  input: MarketingCouponValidationInput
): MarketingCouponValidationView {
  try {
    return resolveMarketingCouponValidationView(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-coupon-validation-runtime] validation view failed", error);

    return {
      validationBadgeTone: "red",
      validationDescription: getMarketingCouponValidationDescription("invalid"),
      validationIssues: [
        {
          code: "coupon_validation_runtime_error",
          message: message || "Coupon validation runtime failed safely.",
          severity: "error"
        }
      ],
      validationLabel: getMarketingCouponValidationLabel("invalid"),
      validationReady: false,
      validationState: "invalid"
    };
  }
}

export function isMarketingCouponValidationReady(input: MarketingCouponValidationInput) {
  return resolveMarketingCouponValidationViewSafe(input).validationReady;
}

export function isValidMarketingCouponValidationState(
  value: unknown
): value is MarketingCouponValidationState {
  return value === "valid" || value === "needs_review" || value === "invalid";
}

export function assertValidMarketingCouponValidationInput(params: {
  marketingType: unknown;
  registryKey: unknown;
  status: unknown;
}) {
  const registryKey = text(params.registryKey, 160);

  if (!registryKey) {
    throw new Error("Coupon validation requires a registry key.");
  }

  if (!parseMarketingType(params.marketingType) && !isLegacyCouponRegistryKey(registryKey)) {
    throw new Error("Coupon validation requires a safe marketing type.");
  }

  if (!isValidMarketingStatus(text(params.status, 80)) && !parseMarketingStatus(params.status)) {
    throw new Error("Coupon validation requires a safe marketing status.");
  }
}
