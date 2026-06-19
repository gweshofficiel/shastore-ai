import "server-only";

import {
  resolveMarketingAudienceKey,
  sanitizeMarketingAudienceSummary
} from "@/src/lib/marketing/marketing-audience-runtime";
import {
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import {
  parseMarketingType,
  type MarketingType
} from "@/src/lib/marketing/marketing-type-runtime";

export type MarketingGiftCodeRedemptionState =
  | "already_used"
  | "expired"
  | "needs_review"
  | "not_redeemable"
  | "paused"
  | "redeemable"
  | "unknown";

export type MarketingGiftCodeRedemptionIssueSeverity = "blocker" | "review";

export type MarketingGiftCodeRedemptionIssue = {
  code: string;
  message: string;
  severity: MarketingGiftCodeRedemptionIssueSeverity;
  stateHint?: MarketingGiftCodeRedemptionState;
};

export type MarketingGiftCodeRedemptionView = {
  redemptionBadgeTone: "amber" | "blue" | "green" | "red";
  redemptionDescription: string;
  redemptionEngineStatus: string;
  redemptionIssues: MarketingGiftCodeRedemptionIssue[];
  redemptionLabel: string;
  redemptionReady: boolean;
  redemptionState: MarketingGiftCodeRedemptionState;
};

export type MarketingGiftCodeRedemptionInput = {
  code: string;
  creditAmount?: unknown;
  exists?: boolean;
  lifecycleState?: unknown;
  marketingType: unknown;
  metadata?: unknown;
  registryKey: string;
  slug: string;
  status: unknown;
  targetAudienceSummary: string;
  usageCount?: unknown;
};

export const MARKETING_GIFT_CODE_REDEMPTION_STATES: readonly MarketingGiftCodeRedemptionState[] = [
  "redeemable",
  "not_redeemable",
  "already_used",
  "expired",
  "paused",
  "needs_review",
  "unknown"
] as const;

const redeemableGiftCodeStatuses = new Set<MarketingStatus>(["active"]);

const blockedGiftCodeStatuses = new Set<MarketingStatus>(["archived", "draft", "expired", "paused"]);

const giftCodePattern = /^[A-Z0-9][A-Z0-9_-]{2,63}$/;

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

function parseRedemptionStateHint(value: unknown): MarketingGiftCodeRedemptionState | null {
  const cleaned = text(value, 40).toLowerCase();

  if (isValidMarketingGiftCodeRedemptionState(cleaned)) {
    return cleaned;
  }

  return null;
}

function inspectGiftCodeRedemptionExistence(params: {
  exists: boolean;
  registryKey: string;
}): MarketingGiftCodeRedemptionIssue[] {
  if (params.exists && params.registryKey) {
    return [];
  }

  return [
    {
      code: "gift_code_redemption_unknown",
      message: "Gift code registry item could not be resolved for redemption readiness.",
      severity: "blocker",
      stateHint: "unknown"
    }
  ];
}

function inspectGiftCodeRedemptionType(params: {
  marketingType: MarketingType | null;
  registryKey: string;
}): MarketingGiftCodeRedemptionIssue[] {
  if (params.marketingType === "gift_code") {
    return [];
  }

  return [
    {
      code: "gift_code_redemption_type_mismatch",
      message: "Registry item is not a gift code and cannot be evaluated for redemption readiness.",
      severity: "blocker",
      stateHint: "not_redeemable"
    }
  ];
}

function inspectGiftCodeRedemptionStatus(params: {
  lifecycleState: MarketingStatus | null;
  status: MarketingStatus | null;
}): MarketingGiftCodeRedemptionIssue[] {
  const issues: MarketingGiftCodeRedemptionIssue[] = [];

  if (params.status === "expired" || params.lifecycleState === "expired") {
    issues.push({
      code: "gift_code_redemption_expired",
      message: "Gift code lifecycle is expired. Redemption readiness only; no execution.",
      severity: "blocker",
      stateHint: "expired"
    });
  }

  if (params.status === "paused" || params.lifecycleState === "paused") {
    issues.push({
      code: "gift_code_redemption_paused",
      message: "Gift code is paused. Redemption readiness only; no execution.",
      severity: "blocker",
      stateHint: "paused"
    });
  }

  if (params.status === "archived" || params.lifecycleState === "archived") {
    issues.push({
      code: "gift_code_redemption_archived",
      message: "Gift code is archived and not redeemable.",
      severity: "blocker",
      stateHint: "not_redeemable"
    });
  }

  if (params.status === "draft" || params.lifecycleState === "draft") {
    issues.push({
      code: "gift_code_redemption_draft",
      message: "Gift code is still in draft and not redeemable yet.",
      severity: "blocker",
      stateHint: "not_redeemable"
    });
  }

  return issues;
}

function inspectGiftCodeRedemptionCodeDisplay(params: {
  code: string;
  registryKey: string;
  slug: string;
}): MarketingGiftCodeRedemptionIssue[] {
  const issues: MarketingGiftCodeRedemptionIssue[] = [];
  const code = text(params.code, 80);
  const slug = text(params.slug, 160);
  const registryKey = text(params.registryKey, 160);

  if (!code) {
    issues.push({
      code: "gift_code_redemption_code_missing",
      message: "Gift code display label is missing.",
      severity: "blocker",
      stateHint: "not_redeemable"
    });
    return issues;
  }

  if (secretPattern.test(code)) {
    issues.push({
      code: "gift_code_redemption_code_unsafe",
      message: "Gift code display label contains restricted content and requires review.",
      severity: "blocker",
      stateHint: "needs_review"
    });
  }

  if (!giftCodePattern.test(code) && !code.startsWith("GIFT-")) {
    issues.push({
      code: "gift_code_redemption_code_format",
      message: "Gift code display label uses a non-standard format and requires review.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  if (!slug && !registryKey) {
    issues.push({
      code: "gift_code_redemption_slug_missing",
      message: "Gift code slug is unavailable for redemption readiness.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  return issues;
}

function inspectGiftCodeRedemptionUsage(params: {
  metadata: Record<string, unknown> | null;
  usageCount: number;
}): MarketingGiftCodeRedemptionIssue[] {
  const issues: MarketingGiftCodeRedemptionIssue[] = [];
  const metadata = params.metadata ?? {};
  const metadataState = parseRedemptionStateHint(
    metadataValue(metadata, ["redemption_state", "redemption_readiness_state", "redemption_status"])
  );

  if (metadataState === "already_used") {
    issues.push({
      code: "gift_code_redemption_metadata_used",
      message: "Gift code metadata indicates prior redemption readiness as already used.",
      severity: "blocker",
      stateHint: "already_used"
    });
    return issues;
  }

  const redemptionLimit = safeNumber(metadataValue(metadata, ["redemption_limit", "usage_limit", "max_redemptions"]));
  const usageCount = Math.max(0, Math.trunc(params.usageCount));

  if (redemptionLimit > 0 && usageCount >= redemptionLimit) {
    issues.push({
      code: "gift_code_redemption_limit_reached",
      message: "Gift code usage count reached the configured redemption limit.",
      severity: "blocker",
      stateHint: "already_used"
    });
  }

  if (usageCount > 0 && redemptionLimit === 0) {
    issues.push({
      code: "gift_code_redemption_usage_recorded",
      message: "Gift code has recorded usage but no safe redemption limit is configured.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  return issues;
}

function inspectGiftCodeRedemptionAudience(params: {
  audienceKey: ReturnType<typeof resolveMarketingAudienceKey>;
  targetAudienceSummary: string;
}): MarketingGiftCodeRedemptionIssue[] {
  const summary = sanitizeMarketingAudienceSummary(params.targetAudienceSummary);

  if (summary === "Audience summary unavailable.") {
    return [
      {
        code: "gift_code_redemption_audience_missing",
        message: "Gift code audience summary is unavailable for redemption readiness.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  if (!params.audienceKey) {
    return [
      {
        code: "gift_code_redemption_audience_unclassified",
        message: "Gift code audience is descriptive only and not yet classified for redemption readiness.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  return [];
}

function inspectGiftCodeRedemptionMetadata(metadata: unknown): MarketingGiftCodeRedemptionIssue[] {
  const issues: MarketingGiftCodeRedemptionIssue[] = [];
  const record = safeRecord(metadata);

  if (record === null) {
    issues.push({
      code: "gift_code_redemption_metadata_malformed",
      message: "Gift code public metadata must be a safe object. No redemption is performed.",
      severity: "blocker",
      stateHint: "needs_review"
    });
    return issues;
  }

  for (const [key, value] of Object.entries(record)) {
    const cleanedKey = text(key, 120);

    if (!cleanedKey || forbiddenMetadataKeyPattern.test(cleanedKey)) {
      issues.push({
        code: "gift_code_redemption_metadata_forbidden_key",
        message: "Gift code metadata contains a restricted public key and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
      continue;
    }

    if (typeof value === "object" && value !== null) {
      issues.push({
        code: "gift_code_redemption_metadata_nested_value",
        message: "Gift code metadata contains nested values that are not display-safe yet.",
        severity: "review",
        stateHint: "needs_review"
      });
      continue;
    }

    const cleanedValue = text(value, 240);

    if (cleanedValue && secretPattern.test(cleanedValue)) {
      issues.push({
        code: "gift_code_redemption_metadata_secret_value",
        message: "Gift code metadata contains restricted content and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
    }
  }

  return issues;
}

export function listMarketingGiftCodeRedemptionIssues(
  input: MarketingGiftCodeRedemptionInput
): MarketingGiftCodeRedemptionIssue[] {
  const exists = input.exists ?? Boolean(text(input.registryKey, 160));
  const registryKey = text(input.registryKey, 160);
  const marketingType = parseMarketingType(input.marketingType);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;
  const metadata = safeRecord(input.metadata);
  const targetAudienceSummary = sanitizeMarketingAudienceSummary(input.targetAudienceSummary);
  const audienceKey = resolveMarketingAudienceKey({
    marketingType: marketingType ?? undefined,
    metadata: metadata ?? undefined,
    registryKey,
    targetAudience: targetAudienceSummary
  });
  const usageCount = safeNumber(input.usageCount);

  return [
    ...inspectGiftCodeRedemptionExistence({ exists, registryKey }),
    ...inspectGiftCodeRedemptionType({ marketingType, registryKey }),
    ...inspectGiftCodeRedemptionStatus({ lifecycleState, status }),
    ...inspectGiftCodeRedemptionCodeDisplay({
      code: input.code,
      registryKey,
      slug: input.slug
    }),
    ...inspectGiftCodeRedemptionUsage({ metadata, usageCount }),
    ...inspectGiftCodeRedemptionAudience({ audienceKey, targetAudienceSummary }),
    ...inspectGiftCodeRedemptionMetadata(input.metadata)
  ];
}

function pickStateHintFromIssues(
  issues: MarketingGiftCodeRedemptionIssue[]
): MarketingGiftCodeRedemptionState | null {
  const priority: MarketingGiftCodeRedemptionState[] = [
    "unknown",
    "expired",
    "paused",
    "already_used",
    "not_redeemable",
    "needs_review"
  ];

  for (const state of priority) {
    if (issues.some((issue) => issue.stateHint === state)) {
      return state;
    }
  }

  return null;
}

export function resolveMarketingGiftCodeRedemptionState(
  issues: MarketingGiftCodeRedemptionIssue[],
  params: {
    lifecycleState: MarketingStatus | null;
    status: MarketingStatus | null;
  }
): MarketingGiftCodeRedemptionState {
  const hintedState = pickStateHintFromIssues(issues);

  if (hintedState) {
    return hintedState;
  }

  if (issues.some((issue) => issue.severity === "review")) {
    return "needs_review";
  }

  const status = params.status;
  const lifecycleState = params.lifecycleState;

  if (status && redeemableGiftCodeStatuses.has(status) && (!lifecycleState || lifecycleState === "active")) {
    return "redeemable";
  }

  if (
    (status && blockedGiftCodeStatuses.has(status)) ||
    (lifecycleState && blockedGiftCodeStatuses.has(lifecycleState))
  ) {
    return "not_redeemable";
  }

  return "unknown";
}

export function getMarketingGiftCodeRedemptionLabel(state: MarketingGiftCodeRedemptionState) {
  if (state === "redeemable") return "Redeemable";
  if (state === "not_redeemable") return "Not redeemable";
  if (state === "already_used") return "Already used";
  if (state === "expired") return "Expired";
  if (state === "paused") return "Paused";
  if (state === "needs_review") return "Needs review";
  return "Unknown";
}

export function getMarketingGiftCodeRedemptionDescription(state: MarketingGiftCodeRedemptionState) {
  if (state === "redeemable") {
    return "Gift code passed redemption-readiness checks. No redemption execution, credit granting, or billing integration yet.";
  }

  if (state === "not_redeemable") {
    return "Gift code is not redeemable in its current lifecycle state. Redemption readiness only.";
  }

  if (state === "already_used") {
    return "Gift code redemption readiness indicates prior usage. No wallet or credit ledger changes occur.";
  }

  if (state === "expired") {
    return "Gift code is expired for redemption readiness. No checkout or billing enforcement occurs.";
  }

  if (state === "paused") {
    return "Gift code redemption is paused for readiness review. No redemption execution occurs.";
  }

  if (state === "needs_review") {
    return "Gift code is display-safe but requires Super Admin review before future redemption phases.";
  }

  return "Gift code redemption readiness could not be classified safely.";
}

export function getMarketingGiftCodeRedemptionBadgeTone(
  state: MarketingGiftCodeRedemptionState
): MarketingGiftCodeRedemptionView["redemptionBadgeTone"] {
  if (state === "redeemable") return "green";
  if (state === "already_used") return "blue";
  if (state === "paused") return "amber";
  if (state === "needs_review") return "amber";
  if (state === "expired") return "red";
  if (state === "not_redeemable") return "red";
  return "amber";
}

export function resolveMarketingGiftCodeRedemptionView(
  input: MarketingGiftCodeRedemptionInput
): MarketingGiftCodeRedemptionView {
  const redemptionIssues = listMarketingGiftCodeRedemptionIssues(input);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;
  const redemptionState = resolveMarketingGiftCodeRedemptionState(redemptionIssues, {
    lifecycleState,
    status
  });

  return {
    redemptionBadgeTone: getMarketingGiftCodeRedemptionBadgeTone(redemptionState),
    redemptionDescription: getMarketingGiftCodeRedemptionDescription(redemptionState),
    redemptionEngineStatus: "No redemption engine connected",
    redemptionIssues,
    redemptionLabel: getMarketingGiftCodeRedemptionLabel(redemptionState),
    redemptionReady: redemptionState === "redeemable",
    redemptionState
  };
}

export function resolveMarketingGiftCodeRedemptionViewSafe(
  input: MarketingGiftCodeRedemptionInput
): MarketingGiftCodeRedemptionView {
  try {
    return resolveMarketingGiftCodeRedemptionView(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-gift-code-redemption-runtime] redemption view failed", error);

    return {
      redemptionBadgeTone: "red",
      redemptionDescription: getMarketingGiftCodeRedemptionDescription("unknown"),
      redemptionEngineStatus: "No redemption engine connected",
      redemptionIssues: [
        {
          code: "gift_code_redemption_runtime_error",
          message: message || "Gift code redemption runtime failed safely.",
          severity: "blocker",
          stateHint: "unknown"
        }
      ],
      redemptionLabel: getMarketingGiftCodeRedemptionLabel("unknown"),
      redemptionReady: false,
      redemptionState: "unknown"
    };
  }
}

export function isMarketingGiftCodeRedemptionReady(input: MarketingGiftCodeRedemptionInput) {
  return resolveMarketingGiftCodeRedemptionViewSafe(input).redemptionReady;
}

export function isValidMarketingGiftCodeRedemptionState(
  value: unknown
): value is MarketingGiftCodeRedemptionState {
  return (
    typeof value === "string" &&
    MARKETING_GIFT_CODE_REDEMPTION_STATES.includes(value as MarketingGiftCodeRedemptionState)
  );
}
