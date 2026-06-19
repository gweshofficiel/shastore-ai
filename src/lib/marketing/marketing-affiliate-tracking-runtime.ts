import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import {
  parseMarketingType,
  type MarketingType
} from "@/src/lib/marketing/marketing-type-runtime";

export type MarketingAffiliateTrackingSummaryStatus =
  | "disabled"
  | "foundation"
  | "placeholder"
  | "ready";

export type MarketingAffiliateTrackingState =
  | "invalid"
  | "needs_review"
  | "tracking_disabled"
  | "tracking_ready"
  | "unknown";

export type MarketingAffiliateTrackingSource = "fallback" | "registry" | "summary_table";

export type MarketingAffiliateTrackingIssueSeverity = "blocker" | "review";

export type MarketingAffiliateTrackingIssue = {
  code: string;
  message: string;
  severity: MarketingAffiliateTrackingIssueSeverity;
  stateHint?: MarketingAffiliateTrackingState;
};

export type MarketingAffiliateTrackingSummaryRecord = {
  createdAt: string | null;
  id: string;
  metadata: Record<string, unknown>;
  affiliateCode: string;
  registryKey: string;
  trackedConversionsCount: number;
  trackedSignupsCount: number;
  trackedVisitsCount: number;
  trackingStatus: MarketingAffiliateTrackingSummaryStatus;
  trackingSummary: string;
  updatedAt: string | null;
};

export type MarketingAffiliateTrackingView = {
  trackedConversionsCount: number;
  trackedSignupsCount: number;
  trackedVisitsCount: number;
  trackingBadgeTone: "amber" | "blue" | "green" | "red";
  trackingDescription: string;
  trackingEngineStatus: string;
  trackingIssues: MarketingAffiliateTrackingIssue[];
  trackingLabel: string;
  trackingReady: boolean;
  trackingSource: MarketingAffiliateTrackingSource;
  trackingState: MarketingAffiliateTrackingState;
  trackingSummary: string;
};

export type MarketingAffiliateTrackingInput = {
  code: string;
  exists?: boolean;
  lifecycleState?: unknown;
  marketingType: unknown;
  metadata?: unknown;
  registryKey: string;
  revenueImpact?: unknown;
  slug: string;
  status: unknown;
  trackingSummaryRecord?: MarketingAffiliateTrackingSummaryRecord | null;
  usageCount?: unknown;
};

export const MARKETING_AFFILIATE_TRACKING_SUMMARY_STATUSES: readonly MarketingAffiliateTrackingSummaryStatus[] = [
  "foundation",
  "disabled",
  "placeholder",
  "ready"
] as const;

export const MARKETING_AFFILIATE_TRACKING_STATES: readonly MarketingAffiliateTrackingState[] = [
  "tracking_ready",
  "tracking_disabled",
  "needs_review",
  "invalid",
  "unknown"
] as const;

export const MARKETING_AFFILIATE_TRACKING_FALLBACK_SUMMARIES: readonly MarketingAffiliateTrackingSummaryRecord[] = [
  {
    createdAt: null,
    id: "fallback-tracking-affiliate-creator-partners",
    metadata: { source: "marketing_affiliate_tracking_fallback" },
    affiliateCode: "AFF-CREATOR-PARTNERS",
    registryKey: "affiliate:creator-partners",
    trackedConversionsCount: 0,
    trackedSignupsCount: 0,
    trackedVisitsCount: 0,
    trackingStatus: "foundation",
    trackingSummary: "Foundation tracking summary. No affiliate event tracking connected.",
    updatedAt: null
  }
];

const trackingSummarySelect =
  "id, registry_key, affiliate_code, tracked_visits_count, tracked_signups_count, tracked_conversions_count, tracking_status, tracking_summary, metadata, created_at, updated_at";

const affiliateCodePattern = /^[A-Z0-9][A-Z0-9_-]{2,63}$/;

const forbiddenMetadataKeyPattern =
  /^(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|ip_address|device_fingerprint|cookie|session_id)$/i;

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,}|ip_address|device_fingerprint|session_id)/i;

const readyReferralStatuses = new Set<MarketingStatus>(["active"]);

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

function safeCount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketing affiliate tracking summaries.");
  }

  return admin;
}

function sanitizeTrackingDisplayValue(value: unknown, fallback: string) {
  const cleaned = text(value, 240);

  if (!cleaned || secretPattern.test(cleaned)) {
    return fallback;
  }

  return cleaned;
}

export function isValidMarketingAffiliateTrackingSummaryStatus(
  value: unknown
): value is MarketingAffiliateTrackingSummaryStatus {
  return (
    typeof value === "string" &&
    MARKETING_AFFILIATE_TRACKING_SUMMARY_STATUSES.includes(value as MarketingAffiliateTrackingSummaryStatus)
  );
}

export function parseMarketingAffiliateTrackingSummaryStatus(
  value: unknown
): MarketingAffiliateTrackingSummaryStatus | null {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingAffiliateTrackingSummaryStatus(cleaned) ? cleaned : null;
}

export function parseMarketingAffiliateTrackingSummary(
  row: unknown
): MarketingAffiliateTrackingSummaryRecord | null {
  if (!row || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  const id = text(record.id, 120);
  const registryKey = text(record.registry_key, 160);
  const trackingStatus = parseMarketingAffiliateTrackingSummaryStatus(record.tracking_status);

  if (!id || !registryKey || !trackingStatus) {
    return null;
  }

  return {
    createdAt: text(record.created_at, 80) || null,
    id,
    metadata: safeRecord(record.metadata) ?? {},
    affiliateCode: sanitizeTrackingDisplayValue(record.affiliate_code, ""),
    registryKey,
    trackedConversionsCount: safeCount(record.tracked_conversions_count),
    trackedSignupsCount: safeCount(record.tracked_signups_count),
    trackedVisitsCount: safeCount(record.tracked_visits_count),
    trackingStatus,
    trackingSummary: sanitizeTrackingDisplayValue(
      record.tracking_summary,
      "Tracking readiness foundation only. No affiliate events exposed."
    ),
    updatedAt: text(record.updated_at, 80) || null
  };
}

function inspectReferralTrackingExistence(params: {
  exists: boolean;
  registryKey: string;
}): MarketingAffiliateTrackingIssue[] {
  if (params.exists && params.registryKey) {
    return [];
  }

  return [
    {
      code: "affiliate_tracking_unknown",
      message: "Referral registry item could not be resolved for tracking readiness.",
      severity: "blocker",
      stateHint: "unknown"
    }
  ];
}

function inspectReferralTrackingType(params: {
  marketingType: MarketingType | null;
}): MarketingAffiliateTrackingIssue[] {
  if (params.marketingType === "affiliate") {
    return [];
  }

  return [
    {
      code: "affiliate_tracking_type_mismatch",
      message: "Registry item is not a affiliate program and cannot be evaluated for tracking readiness.",
      severity: "blocker",
      stateHint: "invalid"
    }
  ];
}

function inspectReferralTrackingStatus(params: {
  lifecycleState: MarketingStatus | null;
  status: MarketingStatus | null;
}): MarketingAffiliateTrackingIssue[] {
  const issues: MarketingAffiliateTrackingIssue[] = [];

  if (params.status === "expired" || params.lifecycleState === "expired") {
    issues.push({
      code: "affiliate_tracking_expired",
      message: "Referral program lifecycle is expired. Tracking readiness only; no event tracking occurs.",
      severity: "blocker",
      stateHint: "tracking_disabled"
    });
  }

  if (params.status === "paused" || params.lifecycleState === "paused") {
    issues.push({
      code: "affiliate_tracking_paused",
      message: "Referral program is paused. Tracking readiness only; no event tracking occurs.",
      severity: "blocker",
      stateHint: "tracking_disabled"
    });
  }

  if (params.status === "archived" || params.lifecycleState === "archived") {
    issues.push({
      code: "affiliate_tracking_archived",
      message: "Referral program is archived and tracking is disabled.",
      severity: "blocker",
      stateHint: "tracking_disabled"
    });
  }

  if (params.status === "draft" || params.lifecycleState === "draft") {
    issues.push({
      code: "affiliate_tracking_draft",
      message: "Referral program is still in draft and tracking is disabled.",
      severity: "blocker",
      stateHint: "tracking_disabled"
    });
  }

  return issues;
}

function inspectReferralTrackingCodeDisplay(params: {
  code: string;
  slug: string;
}): MarketingAffiliateTrackingIssue[] {
  const issues: MarketingAffiliateTrackingIssue[] = [];
  const code = text(params.code, 80);
  const slug = text(params.slug, 160);

  if (!code) {
    issues.push({
      code: "affiliate_tracking_code_missing",
      message: "Referral code display label is missing.",
      severity: "blocker",
      stateHint: "invalid"
    });
    return issues;
  }

  if (secretPattern.test(code)) {
    issues.push({
      code: "affiliate_tracking_code_unsafe",
      message: "Referral code display label contains restricted content and requires review.",
      severity: "blocker",
      stateHint: "needs_review"
    });
  }

  if (!affiliateCodePattern.test(code) && !code.startsWith("AFF-")) {
    issues.push({
      code: "affiliate_tracking_code_format",
      message: "Referral code display label uses a non-standard format and requires review.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  if (!slug) {
    issues.push({
      code: "affiliate_tracking_slug_missing",
      message: "Referral slug is unavailable for tracking readiness.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  return issues;
}

function inspectReferralTrackingSummaryRecord(params: {
  summary: MarketingAffiliateTrackingSummaryRecord | null | undefined;
}): MarketingAffiliateTrackingIssue[] {
  if (!params.summary) {
    return [
      {
        code: "affiliate_tracking_summary_missing",
        message: "Referral tracking summary is unavailable. Registry counts only.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  if (params.summary.trackingStatus === "disabled") {
    return [
      {
        code: "affiliate_tracking_summary_disabled",
        message: "Referral tracking summary is marked disabled for readiness review.",
        severity: "blocker",
        stateHint: "tracking_disabled"
      }
    ];
  }

  if (params.summary.trackingStatus === "foundation" || params.summary.trackingStatus === "placeholder") {
    return [
      {
        code: "affiliate_tracking_summary_foundation",
        message: "Referral tracking summary is a foundation placeholder. No event tracking occurs.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  return [];
}

function inspectReferralTrackingMetadata(metadata: unknown): MarketingAffiliateTrackingIssue[] {
  const issues: MarketingAffiliateTrackingIssue[] = [];
  const record = safeRecord(metadata);

  if (record === null) {
    issues.push({
      code: "affiliate_tracking_metadata_malformed",
      message: "Referral public metadata must be a safe object. No tracking is performed.",
      severity: "blocker",
      stateHint: "invalid"
    });
    return issues;
  }

  for (const [key, value] of Object.entries(record)) {
    const cleanedKey = text(key, 120);

    if (!cleanedKey || forbiddenMetadataKeyPattern.test(cleanedKey)) {
      issues.push({
        code: "affiliate_tracking_metadata_forbidden_key",
        message: "Referral metadata contains a restricted public key and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
      continue;
    }

    if (typeof value === "object" && value !== null) {
      issues.push({
        code: "affiliate_tracking_metadata_nested_value",
        message: "Referral metadata contains nested values that are not display-safe yet.",
        severity: "review",
        stateHint: "needs_review"
      });
      continue;
    }

    const cleanedValue = text(value, 240);

    if (cleanedValue && secretPattern.test(cleanedValue)) {
      issues.push({
        code: "affiliate_tracking_metadata_secret_value",
        message: "Referral metadata contains restricted content and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
    }
  }

  return issues;
}

export function listMarketingAffiliateTrackingIssues(
  input: MarketingAffiliateTrackingInput
): MarketingAffiliateTrackingIssue[] {
  const exists = input.exists ?? Boolean(text(input.registryKey, 160));
  const registryKey = text(input.registryKey, 160);
  const marketingType = parseMarketingType(input.marketingType);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;

  return [
    ...inspectReferralTrackingExistence({ exists, registryKey }),
    ...inspectReferralTrackingType({ marketingType }),
    ...inspectReferralTrackingStatus({ lifecycleState, status }),
    ...inspectReferralTrackingCodeDisplay({ code: input.code, slug: input.slug }),
    ...inspectReferralTrackingSummaryRecord({ summary: input.trackingSummaryRecord }),
    ...inspectReferralTrackingMetadata(input.metadata)
  ];
}

function pickTrackingStateHintFromIssues(
  issues: MarketingAffiliateTrackingIssue[]
): MarketingAffiliateTrackingState | null {
  const priority: MarketingAffiliateTrackingState[] = [
    "unknown",
    "invalid",
    "tracking_disabled",
    "needs_review"
  ];

  for (const state of priority) {
    if (issues.some((issue) => issue.stateHint === state)) {
      return state;
    }
  }

  return null;
}

export function resolveMarketingAffiliateTrackingState(
  issues: MarketingAffiliateTrackingIssue[],
  params: {
    lifecycleState: MarketingStatus | null;
    status: MarketingStatus | null;
    summary: MarketingAffiliateTrackingSummaryRecord | null | undefined;
  }
): MarketingAffiliateTrackingState {
  const hintedState = pickTrackingStateHintFromIssues(issues);

  if (hintedState) {
    return hintedState;
  }

  if (issues.some((issue) => issue.severity === "review")) {
    return "needs_review";
  }

  if (
    params.summary?.trackingStatus === "ready" &&
    params.status &&
    readyReferralStatuses.has(params.status) &&
    (!params.lifecycleState || params.lifecycleState === "active")
  ) {
    return "tracking_ready";
  }

  return "unknown";
}

export function resolveMarketingAffiliateTrackingCounts(input: MarketingAffiliateTrackingInput) {
  if (input.trackingSummaryRecord) {
    return {
      trackedConversionsCount: input.trackingSummaryRecord.trackedConversionsCount,
      trackedSignupsCount: input.trackingSummaryRecord.trackedSignupsCount,
      trackedVisitsCount: input.trackingSummaryRecord.trackedVisitsCount
    };
  }

  const usageCount = safeCount(input.usageCount);

  return {
    trackedConversionsCount: 0,
    trackedSignupsCount: 0,
    trackedVisitsCount: usageCount
  };
}

export function resolveMarketingAffiliateTrackingSummaryText(input: MarketingAffiliateTrackingInput) {
  if (input.trackingSummaryRecord?.trackingSummary) {
    return input.trackingSummaryRecord.trackingSummary;
  }

  return "Tracking readiness foundation only. No affiliate events or customer lists exposed.";
}

export function resolveMarketingAffiliateTrackingSource(
  input: MarketingAffiliateTrackingInput
): MarketingAffiliateTrackingSource {
  if (input.trackingSummaryRecord?.metadata.source === "marketing_affiliate_tracking_fallback") {
    return "fallback";
  }

  if (input.trackingSummaryRecord) {
    return "summary_table";
  }

  return "registry";
}

export function getMarketingAffiliateTrackingLabel(state: MarketingAffiliateTrackingState) {
  if (state === "tracking_ready") return "Tracking ready";
  if (state === "tracking_disabled") return "Tracking disabled";
  if (state === "needs_review") return "Needs review";
  if (state === "invalid") return "Invalid";
  return "Unknown";
}

export function getMarketingAffiliateTrackingDescription(state: MarketingAffiliateTrackingState) {
  if (state === "tracking_ready") {
    return "Referral passed tracking-readiness checks. No visitor, signup, or conversion tracking execution yet.";
  }

  if (state === "tracking_disabled") {
    return "Referral tracking is disabled in the current lifecycle state. Tracking readiness only.";
  }

  if (state === "needs_review") {
    return "Referral is display-safe but requires Super Admin review before future tracking phases.";
  }

  if (state === "invalid") {
    return "Referral tracking display data failed readiness checks. No tracking events are created.";
  }

  return "Referral tracking readiness could not be classified safely.";
}

export function getMarketingAffiliateTrackingBadgeTone(
  state: MarketingAffiliateTrackingState
): MarketingAffiliateTrackingView["trackingBadgeTone"] {
  if (state === "tracking_ready") return "green";
  if (state === "needs_review") return "amber";
  if (state === "tracking_disabled") return "blue";
  if (state === "invalid") return "red";
  return "amber";
}

export function resolveMarketingAffiliateTrackingView(
  input: MarketingAffiliateTrackingInput
): MarketingAffiliateTrackingView {
  const trackingIssues = listMarketingAffiliateTrackingIssues(input);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;
  const trackingState = resolveMarketingAffiliateTrackingState(trackingIssues, {
    lifecycleState,
    status,
    summary: input.trackingSummaryRecord
  });
  const counts = resolveMarketingAffiliateTrackingCounts(input);

  return {
    ...counts,
    trackingBadgeTone: getMarketingAffiliateTrackingBadgeTone(trackingState),
    trackingDescription: getMarketingAffiliateTrackingDescription(trackingState),
    trackingEngineStatus: "No affiliate tracking engine connected",
    trackingIssues,
    trackingLabel: getMarketingAffiliateTrackingLabel(trackingState),
    trackingReady: trackingState === "tracking_ready",
    trackingSource: resolveMarketingAffiliateTrackingSource(input),
    trackingState,
    trackingSummary: resolveMarketingAffiliateTrackingSummaryText(input)
  };
}

export function resolveMarketingAffiliateTrackingViewSafe(
  input: MarketingAffiliateTrackingInput
): MarketingAffiliateTrackingView {
  try {
    return resolveMarketingAffiliateTrackingView(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-affiliate-tracking-runtime] tracking view failed", error);

    return {
      trackedConversionsCount: 0,
      trackedSignupsCount: 0,
      trackedVisitsCount: 0,
      trackingBadgeTone: "red",
      trackingDescription: getMarketingAffiliateTrackingDescription("unknown"),
      trackingEngineStatus: "No affiliate tracking engine connected",
      trackingIssues: [
        {
          code: "affiliate_tracking_runtime_error",
          message: message || "Referral tracking runtime failed safely.",
          severity: "blocker",
          stateHint: "unknown"
        }
      ],
      trackingLabel: getMarketingAffiliateTrackingLabel("unknown"),
      trackingReady: false,
      trackingSource: "registry",
      trackingState: "unknown",
      trackingSummary: "Tracking readiness foundation only. No affiliate events or customer lists exposed."
    };
  }
}

export function isMarketingAffiliateTrackingReady(input: MarketingAffiliateTrackingInput) {
  return resolveMarketingAffiliateTrackingViewSafe(input).trackingReady;
}

export function isValidMarketingAffiliateTrackingState(
  value: unknown
): value is MarketingAffiliateTrackingState {
  return (
    typeof value === "string" &&
    MARKETING_AFFILIATE_TRACKING_STATES.includes(value as MarketingAffiliateTrackingState)
  );
}

export function indexMarketingAffiliateTrackingSummariesByRegistryKey(
  summaries: MarketingAffiliateTrackingSummaryRecord[]
): Map<string, MarketingAffiliateTrackingSummaryRecord> {
  return new Map(summaries.map((summary) => [summary.registryKey, summary]));
}

export async function listMarketingAffiliateTrackingSummariesReadOnly(): Promise<
  MarketingAffiliateTrackingSummaryRecord[]
> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketing_affiliate_tracking_summaries" as never)
    .select(trackingSummarySelect as never)
    .order("updated_at" as never, { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Marketing affiliate tracking summaries could not be listed: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketingAffiliateTrackingSummary(row))
    .filter((summary): summary is MarketingAffiliateTrackingSummaryRecord => Boolean(summary));
}

export async function listMarketingAffiliateTrackingSummariesReadOnlySafe(): Promise<{
  source: "database" | "fallback";
  summaries: MarketingAffiliateTrackingSummaryRecord[];
  warning: string | null;
}> {
  try {
    const summaries = await listMarketingAffiliateTrackingSummariesReadOnly();

    if (!summaries.length) {
      return {
        source: "fallback",
        summaries: [...MARKETING_AFFILIATE_TRACKING_FALLBACK_SUMMARIES],
        warning: "Marketing affiliate tracking summary table is empty. Showing fallback tracking rows."
      };
    }

    return {
      source: "database",
      summaries,
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-affiliate-tracking-runtime] read-only tracking summary load failed", error);

    return {
      source: "fallback",
      summaries: [...MARKETING_AFFILIATE_TRACKING_FALLBACK_SUMMARIES],
      warning: message
    };
  }
}
