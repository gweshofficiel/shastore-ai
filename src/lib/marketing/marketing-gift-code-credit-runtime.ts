import "server-only";

import {
  isValidMarketingGiftCodeRedemptionState,
  type MarketingGiftCodeRedemptionState
} from "@/src/lib/marketing/marketing-gift-code-redemption-runtime";
import {
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import {
  parseMarketingType,
  type MarketingType
} from "@/src/lib/marketing/marketing-type-runtime";

type MarketingGiftCodeCreditType = "fixed_credit" | "platform_credit" | "subscription_credit";

const MARKETING_GIFT_CODE_CREDIT_TYPES: readonly MarketingGiftCodeCreditType[] = [
  "subscription_credit",
  "platform_credit",
  "fixed_credit"
] as const;

export type MarketingGiftCodeCreditReadinessState =
  | "already_used"
  | "expired"
  | "needs_review"
  | "not_ready"
  | "paused"
  | "ready"
  | "unknown";

export type MarketingGiftCodeCreditIssueSeverity = "blocker" | "review";

export type MarketingGiftCodeCreditIssue = {
  code: string;
  message: string;
  severity: MarketingGiftCodeCreditIssueSeverity;
  stateHint?: MarketingGiftCodeCreditReadinessState;
};

export type MarketingGiftCodeCreditView = {
  creditAmountDisplay: string;
  creditGrantingStatus: string;
  creditLabel: string;
  creditReadinessBadgeTone: "amber" | "blue" | "green" | "red";
  creditReadinessDescription: string;
  creditReadinessIssues: MarketingGiftCodeCreditIssue[];
  creditReadinessLabel: string;
  creditReadinessReady: boolean;
  creditReadinessState: MarketingGiftCodeCreditReadinessState;
  creditTypeLabel: string;
  creditUnitDisplay: string;
  redemptionReadinessLabel: string;
};

export type MarketingGiftCodeCreditInput = {
  creditAmount?: unknown;
  creditLabel?: unknown;
  creditType?: unknown;
  exists?: boolean;
  lifecycleState?: unknown;
  marketingType: unknown;
  metadata?: unknown;
  planCredit?: unknown;
  redemptionLabel?: unknown;
  redemptionReady?: boolean;
  redemptionState?: unknown;
  registryKey: string;
  status: unknown;
};

export const MARKETING_GIFT_CODE_CREDIT_READINESS_STATES: readonly MarketingGiftCodeCreditReadinessState[] = [
  "ready",
  "not_ready",
  "expired",
  "paused",
  "already_used",
  "needs_review",
  "unknown"
] as const;

const readyGiftCodeStatuses = new Set<MarketingStatus>(["active"]);

const blockedGiftCodeStatuses = new Set<MarketingStatus>(["archived", "draft", "expired", "paused"]);

const safeCurrencyPattern = /^[A-Z]{3}$/;

const forbiddenMetadataKeyPattern =
  /^(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key)$/i;

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,})/i;

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

function safeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function metadataValue(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(metadata[key], 200);
    if (value) return value;
  }

  return "";
}

function sanitizeCreditDisplayValue(value: unknown, fallback: string) {
  const cleaned = text(value, 240);

  if (!cleaned || secretPattern.test(cleaned)) {
    return fallback;
  }

  return cleaned;
}

function isValidMarketingGiftCodeCreditType(value: unknown): value is MarketingGiftCodeCreditType {
  return typeof value === "string" && MARKETING_GIFT_CODE_CREDIT_TYPES.includes(value as MarketingGiftCodeCreditType);
}

function getMarketingGiftCodeCreditTypeLabel(creditType: MarketingGiftCodeCreditType) {
  if (creditType === "platform_credit") return "Platform credit";
  if (creditType === "fixed_credit") return "Fixed credit";
  return "Subscription credit";
}

function parseCreditType(value: unknown): MarketingGiftCodeCreditType {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingGiftCodeCreditType(cleaned) ? cleaned : "subscription_credit";
}

function parseRedemptionState(value: unknown): MarketingGiftCodeRedemptionState | null {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingGiftCodeRedemptionState(cleaned) ? cleaned : null;
}

function buildCreditLabel(params: {
  creditLabel?: unknown;
  metadata: Record<string, unknown>;
  planCredit?: unknown;
}) {
  return sanitizeCreditDisplayValue(
    params.creditLabel ??
      params.planCredit ??
      metadataValue(params.metadata, ["credit_label", "plan_credit", "credit_description"]),
    "Platform credit placeholder"
  );
}

function buildCreditUnitDisplay(metadata: Record<string, unknown>, creditType: MarketingGiftCodeCreditType) {
  const currency = text(metadataValue(metadata, ["credit_currency", "currency", "unit"]), 12).toUpperCase();

  if (currency && safeCurrencyPattern.test(currency)) {
    return `${currency} placeholder`;
  }

  if (creditType === "fixed_credit") {
    return "Fixed credit unit placeholder";
  }

  if (creditType === "platform_credit") {
    return "Platform credit unit placeholder";
  }

  return "Subscription credit unit placeholder";
}

function buildCreditAmountDisplay(creditAmount: number, creditUnitDisplay: string) {
  const amount = safeNumber(creditAmount);

  if (amount <= 0) {
    return `0.00 placeholder (${creditUnitDisplay})`;
  }

  return `${amount.toFixed(2)} placeholder (${creditUnitDisplay})`;
}

function inspectGiftCreditExistence(params: {
  exists: boolean;
  registryKey: string;
}): MarketingGiftCodeCreditIssue[] {
  if (params.exists && params.registryKey) {
    return [];
  }

  return [
    {
      code: "gift_credit_unknown",
      message: "Gift credit registry item could not be resolved for credit readiness.",
      severity: "blocker",
      stateHint: "unknown"
    }
  ];
}

function inspectGiftCreditType(params: {
  creditType: MarketingGiftCodeCreditType;
  marketingType: MarketingType | null;
}): MarketingGiftCodeCreditIssue[] {
  if (params.marketingType !== "gift_code") {
    return [
      {
        code: "gift_credit_type_mismatch",
        message: "Registry item is not a gift code and cannot be evaluated for credit readiness.",
        severity: "blocker",
        stateHint: "not_ready"
      }
    ];
  }

  if (!isValidMarketingGiftCodeCreditType(params.creditType)) {
    return [
      {
        code: "gift_credit_type_invalid",
        message: "Gift credit type is not recognized for credit readiness.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  return [];
}

function inspectGiftCreditStatus(params: {
  lifecycleState: MarketingStatus | null;
  status: MarketingStatus | null;
}): MarketingGiftCodeCreditIssue[] {
  const issues: MarketingGiftCodeCreditIssue[] = [];

  if (params.status === "expired" || params.lifecycleState === "expired") {
    issues.push({
      code: "gift_credit_expired",
      message: "Gift credit lifecycle is expired. Credit readiness only; no granting occurs.",
      severity: "blocker",
      stateHint: "expired"
    });
  }

  if (params.status === "paused" || params.lifecycleState === "paused") {
    issues.push({
      code: "gift_credit_paused",
      message: "Gift credit is paused. Credit readiness only; no granting occurs.",
      severity: "blocker",
      stateHint: "paused"
    });
  }

  if (params.status === "archived" || params.lifecycleState === "archived") {
    issues.push({
      code: "gift_credit_archived",
      message: "Gift credit is archived and not ready for granting.",
      severity: "blocker",
      stateHint: "not_ready"
    });
  }

  if (params.status === "draft" || params.lifecycleState === "draft") {
    issues.push({
      code: "gift_credit_draft",
      message: "Gift credit is still in draft and not ready for granting.",
      severity: "blocker",
      stateHint: "not_ready"
    });
  }

  return issues;
}

function inspectGiftCreditAmount(params: {
  creditAmount: number;
  creditLabel: string;
  status: MarketingStatus | null;
}): MarketingGiftCodeCreditIssue[] {
  const issues: MarketingGiftCodeCreditIssue[] = [];
  const creditAmount = safeNumber(params.creditAmount);

  if (!params.creditLabel || params.creditLabel === "Platform credit placeholder") {
    issues.push({
      code: "gift_credit_label_placeholder",
      message: "Gift credit label is still using a placeholder value.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  if (creditAmount <= 0 && params.status === "active") {
    issues.push({
      code: "gift_credit_amount_zero",
      message: "Active gift credit has a zero placeholder amount and requires review.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  if (creditAmount <= 0 && params.status !== "active") {
    issues.push({
      code: "gift_credit_amount_placeholder",
      message: "Gift credit amount is a placeholder. No credit granting occurs.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  return issues;
}

function inspectGiftCreditRedemptionReadiness(params: {
  redemptionLabel: string;
  redemptionReady: boolean;
  redemptionState: MarketingGiftCodeRedemptionState | null;
}): MarketingGiftCodeCreditIssue[] {
  const issues: MarketingGiftCodeCreditIssue[] = [];

  if (params.redemptionState === "already_used") {
    issues.push({
      code: "gift_credit_redemption_already_used",
      message: "Gift code redemption readiness indicates prior usage. No credit ledger changes occur.",
      severity: "blocker",
      stateHint: "already_used"
    });
  }

  if (params.redemptionState === "needs_review") {
    issues.push({
      code: "gift_credit_redemption_needs_review",
      message: "Gift code redemption readiness requires review before credit readiness can be confirmed.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  if (params.redemptionState === "unknown") {
    issues.push({
      code: "gift_credit_redemption_unknown",
      message: "Gift code redemption readiness is unknown for credit readiness.",
      severity: "review",
      stateHint: "unknown"
    });
  }

  if (params.redemptionState === "not_redeemable" && !params.redemptionReady) {
    issues.push({
      code: "gift_credit_redemption_not_ready",
      message: "Gift code is not redeemable, so credit readiness remains blocked.",
      severity: "blocker",
      stateHint: "not_ready"
    });
  }

  if (!params.redemptionLabel) {
    issues.push({
      code: "gift_credit_redemption_label_missing",
      message: "Gift code redemption readiness label is unavailable.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  return issues;
}

function inspectGiftCreditMetadata(metadata: unknown): MarketingGiftCodeCreditIssue[] {
  const issues: MarketingGiftCodeCreditIssue[] = [];
  const record = safeRecord(metadata);

  if (record === null) {
    issues.push({
      code: "gift_credit_metadata_malformed",
      message: "Gift credit public metadata must be a safe object. No credit granting is performed.",
      severity: "blocker",
      stateHint: "needs_review"
    });
    return issues;
  }

  for (const [key, value] of Object.entries(record)) {
    const cleanedKey = text(key, 120);

    if (!cleanedKey || forbiddenMetadataKeyPattern.test(cleanedKey)) {
      issues.push({
        code: "gift_credit_metadata_forbidden_key",
        message: "Gift credit metadata contains a restricted public key and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
      continue;
    }

    if (typeof value === "object" && value !== null) {
      issues.push({
        code: "gift_credit_metadata_nested_value",
        message: "Gift credit metadata contains nested values that are not display-safe yet.",
        severity: "review",
        stateHint: "needs_review"
      });
      continue;
    }

    const cleanedValue = text(value, 240);

    if (cleanedValue && secretPattern.test(cleanedValue)) {
      issues.push({
        code: "gift_credit_metadata_secret_value",
        message: "Gift credit metadata contains restricted content and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
    }
  }

  return issues;
}

export function listMarketingGiftCodeCreditIssues(input: MarketingGiftCodeCreditInput): MarketingGiftCodeCreditIssue[] {
  const exists = input.exists ?? Boolean(text(input.registryKey, 160));
  const registryKey = text(input.registryKey, 160);
  const marketingType = parseMarketingType(input.marketingType);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;
  const metadata = safeRecord(input.metadata) ?? {};
  const creditType = parseCreditType(input.creditType);
  const creditLabel = buildCreditLabel({
    creditLabel: input.creditLabel,
    metadata,
    planCredit: input.planCredit
  });
  const creditAmount = safeNumber(input.creditAmount);
  const redemptionState = parseRedemptionState(input.redemptionState);
  const redemptionLabel = sanitizeCreditDisplayValue(input.redemptionLabel, "Unknown");
  const redemptionReady = input.redemptionReady === true;

  return [
    ...inspectGiftCreditExistence({ exists, registryKey }),
    ...inspectGiftCreditType({ creditType, marketingType }),
    ...inspectGiftCreditStatus({ lifecycleState, status }),
    ...inspectGiftCreditAmount({ creditAmount, creditLabel, status }),
    ...inspectGiftCreditRedemptionReadiness({
      redemptionLabel,
      redemptionReady,
      redemptionState
    }),
    ...inspectGiftCreditMetadata(input.metadata)
  ];
}

function pickCreditStateHintFromIssues(
  issues: MarketingGiftCodeCreditIssue[]
): MarketingGiftCodeCreditReadinessState | null {
  const priority: MarketingGiftCodeCreditReadinessState[] = [
    "unknown",
    "expired",
    "paused",
    "already_used",
    "not_ready",
    "needs_review"
  ];

  for (const state of priority) {
    if (issues.some((issue) => issue.stateHint === state)) {
      return state;
    }
  }

  return null;
}

export function resolveMarketingGiftCodeCreditReadinessState(
  issues: MarketingGiftCodeCreditIssue[],
  params: {
    lifecycleState: MarketingStatus | null;
    redemptionReady: boolean;
    redemptionState: MarketingGiftCodeRedemptionState | null;
    status: MarketingStatus | null;
  }
): MarketingGiftCodeCreditReadinessState {
  const hintedState = pickCreditStateHintFromIssues(issues);

  if (hintedState) {
    return hintedState;
  }

  if (issues.some((issue) => issue.severity === "review")) {
    return "needs_review";
  }

  if (
    params.redemptionState === "redeemable" &&
    params.redemptionReady &&
    params.status &&
    readyGiftCodeStatuses.has(params.status) &&
    (!params.lifecycleState || params.lifecycleState === "active")
  ) {
    return "ready";
  }

  if (
    (params.status && blockedGiftCodeStatuses.has(params.status)) ||
    (params.lifecycleState && blockedGiftCodeStatuses.has(params.lifecycleState))
  ) {
    return "not_ready";
  }

  return "unknown";
}

export function getMarketingGiftCodeCreditReadinessLabel(state: MarketingGiftCodeCreditReadinessState) {
  if (state === "ready") return "Ready";
  if (state === "not_ready") return "Not ready";
  if (state === "already_used") return "Already used";
  if (state === "expired") return "Expired";
  if (state === "paused") return "Paused";
  if (state === "needs_review") return "Needs review";
  return "Unknown";
}

export function getMarketingGiftCodeCreditReadinessDescription(state: MarketingGiftCodeCreditReadinessState) {
  if (state === "ready") {
    return "Gift credit passed credit-readiness checks. No credit granting, wallet transactions, or billing integration yet.";
  }

  if (state === "not_ready") {
    return "Gift credit is not ready for granting in its current lifecycle state. Credit readiness only.";
  }

  if (state === "already_used") {
    return "Gift credit readiness indicates prior usage. No wallet or credit ledger changes occur.";
  }

  if (state === "expired") {
    return "Gift credit is expired for credit readiness. No checkout or billing credit application occurs.";
  }

  if (state === "paused") {
    return "Gift credit granting is paused for readiness review. No credit granting occurs.";
  }

  if (state === "needs_review") {
    return "Gift credit is display-safe but requires Super Admin review before future credit granting phases.";
  }

  return "Gift credit readiness could not be classified safely.";
}

export function getMarketingGiftCodeCreditReadinessBadgeTone(
  state: MarketingGiftCodeCreditReadinessState
): MarketingGiftCodeCreditView["creditReadinessBadgeTone"] {
  if (state === "ready") return "green";
  if (state === "already_used") return "blue";
  if (state === "paused") return "amber";
  if (state === "needs_review") return "amber";
  if (state === "expired") return "red";
  if (state === "not_ready") return "red";
  return "amber";
}

export function resolveMarketingGiftCodeCreditView(input: MarketingGiftCodeCreditInput): MarketingGiftCodeCreditView {
  const metadata = safeRecord(input.metadata) ?? {};
  const creditType = parseCreditType(input.creditType);
  const creditLabel = buildCreditLabel({
    creditLabel: input.creditLabel,
    metadata,
    planCredit: input.planCredit
  });
  const creditUnitDisplay = buildCreditUnitDisplay(metadata, creditType);
  const creditAmount = safeNumber(input.creditAmount);
  const creditAmountDisplay = buildCreditAmountDisplay(creditAmount, creditUnitDisplay);
  const redemptionState = parseRedemptionState(input.redemptionState);
  const redemptionLabel = sanitizeCreditDisplayValue(input.redemptionLabel, "Unknown");
  const redemptionReady = input.redemptionReady === true;
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;
  const creditReadinessIssues = listMarketingGiftCodeCreditIssues(input);
  const creditReadinessState = resolveMarketingGiftCodeCreditReadinessState(creditReadinessIssues, {
    lifecycleState,
    redemptionReady,
    redemptionState,
    status
  });

  return {
    creditAmountDisplay,
    creditGrantingStatus: "No credit granting engine connected",
    creditLabel,
    creditReadinessBadgeTone: getMarketingGiftCodeCreditReadinessBadgeTone(creditReadinessState),
    creditReadinessDescription: getMarketingGiftCodeCreditReadinessDescription(creditReadinessState),
    creditReadinessIssues,
    creditReadinessLabel: getMarketingGiftCodeCreditReadinessLabel(creditReadinessState),
    creditReadinessReady: creditReadinessState === "ready",
    creditReadinessState,
    creditTypeLabel: getMarketingGiftCodeCreditTypeLabel(creditType),
    creditUnitDisplay,
    redemptionReadinessLabel: redemptionLabel
  };
}

export function resolveMarketingGiftCodeCreditViewSafe(
  input: MarketingGiftCodeCreditInput
): MarketingGiftCodeCreditView {
  try {
    return resolveMarketingGiftCodeCreditView(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-gift-code-credit-runtime] credit view failed", error);

    return {
      creditAmountDisplay: "0.00 placeholder (Unknown unit)",
      creditGrantingStatus: "No credit granting engine connected",
      creditLabel: "Platform credit placeholder",
      creditReadinessBadgeTone: "red",
      creditReadinessDescription: getMarketingGiftCodeCreditReadinessDescription("unknown"),
      creditReadinessIssues: [
        {
          code: "gift_credit_runtime_error",
          message: message || "Gift credit runtime failed safely.",
          severity: "blocker",
          stateHint: "unknown"
        }
      ],
      creditReadinessLabel: getMarketingGiftCodeCreditReadinessLabel("unknown"),
      creditReadinessReady: false,
      creditReadinessState: "unknown",
      creditTypeLabel: "Subscription credit",
      creditUnitDisplay: "Unknown unit placeholder",
      redemptionReadinessLabel: "Unknown"
    };
  }
}

export function isMarketingGiftCodeCreditReadinessReady(input: MarketingGiftCodeCreditInput) {
  return resolveMarketingGiftCodeCreditViewSafe(input).creditReadinessReady;
}

export function isValidMarketingGiftCodeCreditReadinessState(
  value: unknown
): value is MarketingGiftCodeCreditReadinessState {
  return (
    typeof value === "string" &&
    MARKETING_GIFT_CODE_CREDIT_READINESS_STATES.includes(value as MarketingGiftCodeCreditReadinessState)
  );
}
