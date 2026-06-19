import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidMarketingAffiliateTrackingState,
  type MarketingAffiliateTrackingState
} from "@/src/lib/marketing/marketing-affiliate-tracking-runtime";
import {
  isValidMarketingReferralTrackingState,
  type MarketingReferralTrackingState
} from "@/src/lib/marketing/marketing-referral-tracking-runtime";
import {
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import {
  parseMarketingType,
  type MarketingType
} from "@/src/lib/marketing/marketing-type-runtime";

export type MarketingCommissionSummaryStatus =
  | "disabled"
  | "foundation"
  | "placeholder"
  | "ready";

export type MarketingCommissionState =
  | "commission_disabled"
  | "commission_ready"
  | "invalid"
  | "needs_review"
  | "unknown";

export type MarketingCommissionSource = "fallback" | "registry" | "summary_table";

export type MarketingCommissionIssueSeverity = "blocker" | "review";

export type MarketingCommissionIssue = {
  code: string;
  message: string;
  severity: MarketingCommissionIssueSeverity;
  stateHint?: MarketingCommissionState;
};

export type MarketingCommissionSummaryRecord = {
  commissionModelLabel: string;
  commissionRateLabel: string;
  commissionStatus: MarketingCommissionSummaryStatus;
  commissionSummary: string;
  createdAt: string | null;
  estimatedCommissionDisplay: string;
  id: string;
  marketingType: "affiliate" | "referral";
  metadata: Record<string, unknown>;
  programCode: string;
  registryKey: string;
  trackedConversionsCount: number;
  updatedAt: string | null;
};

export type MarketingCommissionView = {
  commissionBadgeTone: "amber" | "blue" | "green" | "red";
  commissionDescription: string;
  commissionEngineStatus: string;
  commissionIssues: MarketingCommissionIssue[];
  commissionLabel: string;
  commissionModelLabel: string;
  commissionRateDisplay: string;
  commissionReady: boolean;
  commissionSource: MarketingCommissionSource;
  commissionState: MarketingCommissionState;
  commissionSummary: string;
  estimatedCommissionDisplay: string;
};

export type MarketingCommissionInput = {
  code: string;
  commissionSummaryRecord?: MarketingCommissionSummaryRecord | null;
  exists?: boolean;
  lifecycleState?: unknown;
  marketingType: unknown;
  metadata?: unknown;
  metadataSummary?: unknown;
  registryKey: string;
  revenueImpact?: unknown;
  slug: string;
  status: unknown;
  trackedConversionsCount?: unknown;
  trackingReady?: boolean;
  trackingState?: unknown;
  usageCount?: unknown;
};

export const MARKETING_COMMISSION_SUMMARY_STATUSES: readonly MarketingCommissionSummaryStatus[] = [
  "foundation",
  "disabled",
  "placeholder",
  "ready"
] as const;

export const MARKETING_COMMISSION_STATES: readonly MarketingCommissionState[] = [
  "commission_ready",
  "commission_disabled",
  "needs_review",
  "invalid",
  "unknown"
] as const;

export const MARKETING_COMMISSION_FALLBACK_SUMMARIES: readonly MarketingCommissionSummaryRecord[] = [
  {
    commissionModelLabel: "Referral invite commission",
    commissionRateLabel: "0% placeholder",
    commissionStatus: "foundation",
    commissionSummary: "Foundation commission summary. No commission settlement or payout integration.",
    createdAt: null,
    estimatedCommissionDisplay: "0.00 placeholder",
    id: "fallback-commission-referral-owner-invite",
    marketingType: "referral",
    metadata: { source: "marketing_commission_fallback" },
    programCode: "REF-OWNER-INVITE",
    registryKey: "referral:owner-invite",
    trackedConversionsCount: 0,
    updatedAt: null
  },
  {
    commissionModelLabel: "Creator partner commission",
    commissionRateLabel: "0% placeholder",
    commissionStatus: "foundation",
    commissionSummary: "Foundation commission summary. No commission settlement or payout integration.",
    createdAt: null,
    estimatedCommissionDisplay: "0.00 placeholder",
    id: "fallback-commission-affiliate-creator-partners",
    marketingType: "affiliate",
    metadata: { source: "marketing_commission_fallback" },
    programCode: "AFF-CREATOR-PARTNERS",
    registryKey: "affiliate:creator-partners",
    trackedConversionsCount: 0,
    updatedAt: null
  }
];

const commissionSummarySelect =
  "id, registry_key, program_code, marketing_type, commission_model_label, commission_rate_label, estimated_commission_display, tracked_conversions_count, commission_status, commission_summary, metadata, created_at, updated_at";

const programCodePattern = /^[A-Z0-9][A-Z0-9_-]{2,63}$/;

const forbiddenMetadataKeyPattern =
  /^(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|ip_address|device_fingerprint|cookie|session_id)$/i;

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,}|ip_address|device_fingerprint|session_id)/i;

const readyCommissionStatuses = new Set<MarketingStatus>(["active"]);

const registryCommissionModelMap: Record<string, Pick<MarketingCommissionSummaryRecord, "commissionModelLabel" | "commissionRateLabel">> = {
  "affiliate:creator-partners": {
    commissionModelLabel: "Creator partner commission",
    commissionRateLabel: "0% placeholder"
  },
  "referral:owner-invite": {
    commissionModelLabel: "Referral invite commission",
    commissionRateLabel: "0% placeholder"
  }
};

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
    throw new Error("Service-role admin access is required for marketing commission summaries.");
  }

  return admin;
}

function sanitizeCommissionDisplayValue(value: unknown, fallback: string) {
  const cleaned = text(value, 240);

  if (!cleaned || secretPattern.test(cleaned)) {
    return fallback;
  }

  return cleaned;
}

function metadataValue(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(metadata[key], 200);
    if (value) return value;
  }

  return "";
}

export function isValidMarketingCommissionSummaryStatus(
  value: unknown
): value is MarketingCommissionSummaryStatus {
  return (
    typeof value === "string" &&
    MARKETING_COMMISSION_SUMMARY_STATUSES.includes(value as MarketingCommissionSummaryStatus)
  );
}

export function parseMarketingCommissionSummaryStatus(
  value: unknown
): MarketingCommissionSummaryStatus | null {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingCommissionSummaryStatus(cleaned) ? cleaned : null;
}

function parseCommissionMarketingType(value: unknown): MarketingCommissionSummaryRecord["marketingType"] | null {
  const marketingType = parseMarketingType(value);
  if (marketingType === "referral" || marketingType === "affiliate") {
    return marketingType;
  }

  return null;
}

export function parseMarketingCommissionSummary(row: unknown): MarketingCommissionSummaryRecord | null {
  if (!row || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  const id = text(record.id, 120);
  const registryKey = text(record.registry_key, 160);
  const commissionStatus = parseMarketingCommissionSummaryStatus(record.commission_status);
  const marketingType = parseCommissionMarketingType(record.marketing_type);

  if (!id || !registryKey || !commissionStatus || !marketingType) {
    return null;
  }

  const mapped = registryCommissionModelMap[registryKey];

  return {
    commissionModelLabel: sanitizeCommissionDisplayValue(
      record.commission_model_label,
      mapped?.commissionModelLabel ?? "Platform commission model"
    ),
    commissionRateLabel: sanitizeCommissionDisplayValue(
      record.commission_rate_label,
      mapped?.commissionRateLabel ?? "Rate unavailable"
    ),
    commissionStatus,
    commissionSummary: sanitizeCommissionDisplayValue(
      record.commission_summary,
      "Commission readiness foundation only. No settlement records exposed."
    ),
    createdAt: text(record.created_at, 80) || null,
    estimatedCommissionDisplay: sanitizeCommissionDisplayValue(
      record.estimated_commission_display,
      "0.00 placeholder"
    ),
    id,
    marketingType,
    metadata: safeRecord(record.metadata) ?? {},
    programCode: sanitizeCommissionDisplayValue(record.program_code, ""),
    registryKey,
    trackedConversionsCount: safeCount(record.tracked_conversions_count),
    updatedAt: text(record.updated_at, 80) || null
  };
}

function inspectCommissionExistence(params: {
  exists: boolean;
  registryKey: string;
}): MarketingCommissionIssue[] {
  if (params.exists && params.registryKey) {
    return [];
  }

  return [
    {
      code: "commission_unknown",
      message: "Commission registry item could not be resolved for commission readiness.",
      severity: "blocker",
      stateHint: "unknown"
    }
  ];
}

function inspectCommissionType(params: {
  marketingType: MarketingType | null;
}): MarketingCommissionIssue[] {
  if (params.marketingType === "referral" || params.marketingType === "affiliate") {
    return [];
  }

  return [
    {
      code: "commission_type_mismatch",
      message: "Registry item is not a referral or affiliate program and cannot be evaluated for commission readiness.",
      severity: "blocker",
      stateHint: "invalid"
    }
  ];
}

function inspectCommissionStatus(params: {
  lifecycleState: MarketingStatus | null;
  status: MarketingStatus | null;
}): MarketingCommissionIssue[] {
  const issues: MarketingCommissionIssue[] = [];

  if (params.status === "expired" || params.lifecycleState === "expired") {
    issues.push({
      code: "commission_expired",
      message: "Program lifecycle is expired. Commission readiness only; no settlement occurs.",
      severity: "blocker",
      stateHint: "commission_disabled"
    });
  }

  if (params.status === "paused" || params.lifecycleState === "paused") {
    issues.push({
      code: "commission_paused",
      message: "Program is paused. Commission readiness only; no settlement occurs.",
      severity: "blocker",
      stateHint: "commission_disabled"
    });
  }

  if (params.status === "archived" || params.lifecycleState === "archived") {
    issues.push({
      code: "commission_archived",
      message: "Program is archived and commission is disabled.",
      severity: "blocker",
      stateHint: "commission_disabled"
    });
  }

  if (params.status === "draft" || params.lifecycleState === "draft") {
    issues.push({
      code: "commission_draft",
      message: "Program is still in draft and commission is disabled.",
      severity: "blocker",
      stateHint: "commission_disabled"
    });
  }

  return issues;
}

function inspectCommissionCodeDisplay(params: {
  code: string;
  slug: string;
}): MarketingCommissionIssue[] {
  const issues: MarketingCommissionIssue[] = [];
  const code = text(params.code, 80);
  const slug = text(params.slug, 160);

  if (!code) {
    issues.push({
      code: "commission_code_missing",
      message: "Program code display label is missing.",
      severity: "blocker",
      stateHint: "invalid"
    });
    return issues;
  }

  if (secretPattern.test(code)) {
    issues.push({
      code: "commission_code_unsafe",
      message: "Program code display label contains restricted content and requires review.",
      severity: "blocker",
      stateHint: "needs_review"
    });
  }

  if (!programCodePattern.test(code) && !code.startsWith("REF-") && !code.startsWith("AFF-")) {
    issues.push({
      code: "commission_code_format",
      message: "Program code display label uses a non-standard format and requires review.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  if (!slug) {
    issues.push({
      code: "commission_slug_missing",
      message: "Program slug is unavailable for commission readiness.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  return issues;
}

function inspectCommissionSummaryRecord(params: {
  marketingType: MarketingType | null;
  summary: MarketingCommissionSummaryRecord | null | undefined;
}): MarketingCommissionIssue[] {
  if (!params.summary) {
    return [
      {
        code: "commission_summary_missing",
        message: "Commission summary is unavailable. Registry foundation only.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  if (params.summary.marketingType !== params.marketingType) {
    return [
      {
        code: "commission_summary_type_mismatch",
        message: "Commission summary marketing type does not match the registry item.",
        severity: "blocker",
        stateHint: "invalid"
      }
    ];
  }

  if (params.summary.commissionStatus === "disabled") {
    return [
      {
        code: "commission_summary_disabled",
        message: "Commission summary is marked disabled for readiness review.",
        severity: "blocker",
        stateHint: "commission_disabled"
      }
    ];
  }

  if (params.summary.commissionStatus === "foundation" || params.summary.commissionStatus === "placeholder") {
    return [
      {
        code: "commission_summary_foundation",
        message: "Commission summary is a foundation placeholder. No settlement or payout occurs.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  return [];
}

function inspectCommissionTrackingReadiness(params: {
  trackingReady: boolean;
  trackingState: MarketingReferralTrackingState | MarketingAffiliateTrackingState | null;
}): MarketingCommissionIssue[] {
  if (params.trackingState === "invalid" || params.trackingState === "unknown") {
    return [
      {
        code: "commission_tracking_unready",
        message: "Tracking readiness is not confirmed for commission readiness.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  if (params.trackingState === "tracking_disabled" && !params.trackingReady) {
    return [
      {
        code: "commission_tracking_disabled",
        message: "Tracking is disabled, so commission readiness remains blocked.",
        severity: "blocker",
        stateHint: "commission_disabled"
      }
    ];
  }

  return [];
}

function inspectCommissionMetadata(metadata: unknown): MarketingCommissionIssue[] {
  const issues: MarketingCommissionIssue[] = [];
  const record = safeRecord(metadata);

  if (record === null) {
    issues.push({
      code: "commission_metadata_malformed",
      message: "Program public metadata must be a safe object. No commission settlement is performed.",
      severity: "blocker",
      stateHint: "invalid"
    });
    return issues;
  }

  for (const [key, value] of Object.entries(record)) {
    const cleanedKey = text(key, 120);

    if (!cleanedKey || forbiddenMetadataKeyPattern.test(cleanedKey)) {
      issues.push({
        code: "commission_metadata_forbidden_key",
        message: "Program metadata contains a restricted public key and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
      continue;
    }

    if (typeof value === "object" && value !== null) {
      issues.push({
        code: "commission_metadata_nested_value",
        message: "Program metadata contains nested values that are not display-safe yet.",
        severity: "review",
        stateHint: "needs_review"
      });
      continue;
    }

    const cleanedValue = text(value, 240);

    if (cleanedValue && secretPattern.test(cleanedValue)) {
      issues.push({
        code: "commission_metadata_secret_value",
        message: "Program metadata contains restricted content and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
    }
  }

  return issues;
}

function parseTrackingState(value: unknown): MarketingReferralTrackingState | MarketingAffiliateTrackingState | null {
  if (isValidMarketingReferralTrackingState(value)) {
    return value;
  }

  if (isValidMarketingAffiliateTrackingState(value)) {
    return value;
  }

  return null;
}

export function listMarketingCommissionIssues(input: MarketingCommissionInput): MarketingCommissionIssue[] {
  const exists = input.exists ?? Boolean(text(input.registryKey, 160));
  const registryKey = text(input.registryKey, 160);
  const marketingType = parseMarketingType(input.marketingType);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;
  const trackingState = parseTrackingState(input.trackingState);
  const trackingReady = input.trackingReady === true;

  return [
    ...inspectCommissionExistence({ exists, registryKey }),
    ...inspectCommissionType({ marketingType }),
    ...inspectCommissionStatus({ lifecycleState, status }),
    ...inspectCommissionCodeDisplay({ code: input.code, slug: input.slug }),
    ...inspectCommissionSummaryRecord({ marketingType, summary: input.commissionSummaryRecord }),
    ...inspectCommissionTrackingReadiness({ trackingReady, trackingState }),
    ...inspectCommissionMetadata(input.metadata)
  ];
}

function pickCommissionStateHintFromIssues(
  issues: MarketingCommissionIssue[]
): MarketingCommissionState | null {
  const priority: MarketingCommissionState[] = [
    "unknown",
    "invalid",
    "commission_disabled",
    "needs_review"
  ];

  for (const state of priority) {
    if (issues.some((issue) => issue.stateHint === state)) {
      return state;
    }
  }

  return null;
}

export function resolveMarketingCommissionState(
  issues: MarketingCommissionIssue[],
  params: {
    lifecycleState: MarketingStatus | null;
    status: MarketingStatus | null;
    summary: MarketingCommissionSummaryRecord | null | undefined;
    trackingReady: boolean;
  }
): MarketingCommissionState {
  const hintedState = pickCommissionStateHintFromIssues(issues);

  if (hintedState) {
    return hintedState;
  }

  if (issues.some((issue) => issue.severity === "review")) {
    return "needs_review";
  }

  if (
    params.summary?.commissionStatus === "ready" &&
    params.trackingReady &&
    params.status &&
    readyCommissionStatuses.has(params.status) &&
    (!params.lifecycleState || params.lifecycleState === "active")
  ) {
    return "commission_ready";
  }

  return "unknown";
}

export function resolveMarketingCommissionTrackedConversions(input: MarketingCommissionInput) {
  if (input.commissionSummaryRecord) {
    return input.commissionSummaryRecord.trackedConversionsCount;
  }

  return safeCount(input.trackedConversionsCount);
}

export function resolveMarketingCommissionModelLabel(input: MarketingCommissionInput) {
  const registryKey = text(input.registryKey, 160);
  const metadata = safeRecord(input.metadata) ?? {};
  const mapped = registryCommissionModelMap[registryKey];

  return sanitizeCommissionDisplayValue(
    input.commissionSummaryRecord?.commissionModelLabel ??
      metadataValue(metadata, ["commission_model_label", "commission_model"]) ??
      mapped?.commissionModelLabel,
    "Platform commission model"
  );
}

export function resolveMarketingCommissionRateDisplay(input: MarketingCommissionInput) {
  const registryKey = text(input.registryKey, 160);
  const metadata = safeRecord(input.metadata) ?? {};
  const mapped = registryCommissionModelMap[registryKey];

  return sanitizeCommissionDisplayValue(
    input.commissionSummaryRecord?.commissionRateLabel ??
      metadataValue(metadata, ["commission_rate_label", "commission_rate", "commission_rate_display"]) ??
      mapped?.commissionRateLabel,
    "Rate unavailable"
  );
}

export function resolveMarketingCommissionEstimatedDisplay(input: MarketingCommissionInput) {
  if (input.commissionSummaryRecord?.estimatedCommissionDisplay) {
    return input.commissionSummaryRecord.estimatedCommissionDisplay;
  }

  return "0.00 placeholder";
}

export function resolveMarketingCommissionSummaryText(input: MarketingCommissionInput) {
  if (input.commissionSummaryRecord?.commissionSummary) {
    return input.commissionSummaryRecord.commissionSummary;
  }

  const metadataSummary = sanitizeCommissionDisplayValue(
    input.metadataSummary,
    "Commission readiness foundation only. No settlement records exposed."
  );

  return metadataSummary;
}

export function resolveMarketingCommissionSource(
  input: MarketingCommissionInput
): MarketingCommissionSource {
  if (input.commissionSummaryRecord?.metadata.source === "marketing_commission_fallback") {
    return "fallback";
  }

  if (input.commissionSummaryRecord) {
    return "summary_table";
  }

  return "registry";
}

export function getMarketingCommissionLabel(state: MarketingCommissionState) {
  if (state === "commission_ready") return "Commission ready";
  if (state === "commission_disabled") return "Commission disabled";
  if (state === "needs_review") return "Needs review";
  if (state === "invalid") return "Invalid";
  return "Unknown";
}

export function getMarketingCommissionDescription(state: MarketingCommissionState) {
  if (state === "commission_ready") {
    return "Program passed commission-readiness checks. No commission settlement, payout execution, or billing integration yet.";
  }

  if (state === "commission_disabled") {
    return "Commission is disabled in the current lifecycle state. Commission readiness only.";
  }

  if (state === "needs_review") {
    return "Program is display-safe but requires Super Admin review before future commission phases.";
  }

  if (state === "invalid") {
    return "Commission display data failed readiness checks. No commission records are created.";
  }

  return "Commission readiness could not be classified safely.";
}

export function getMarketingCommissionBadgeTone(
  state: MarketingCommissionState
): MarketingCommissionView["commissionBadgeTone"] {
  if (state === "commission_ready") return "green";
  if (state === "needs_review") return "amber";
  if (state === "commission_disabled") return "blue";
  if (state === "invalid") return "red";
  return "amber";
}

export function resolveMarketingCommissionView(input: MarketingCommissionInput): MarketingCommissionView {
  const commissionIssues = listMarketingCommissionIssues(input);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;
  const commissionState = resolveMarketingCommissionState(commissionIssues, {
    lifecycleState,
    status,
    summary: input.commissionSummaryRecord,
    trackingReady: input.trackingReady === true
  });

  return {
    commissionBadgeTone: getMarketingCommissionBadgeTone(commissionState),
    commissionDescription: getMarketingCommissionDescription(commissionState),
    commissionEngineStatus: "No commission engine connected",
    commissionIssues,
    commissionLabel: getMarketingCommissionLabel(commissionState),
    commissionModelLabel: resolveMarketingCommissionModelLabel(input),
    commissionRateDisplay: resolveMarketingCommissionRateDisplay(input),
    commissionReady: commissionState === "commission_ready",
    commissionSource: resolveMarketingCommissionSource(input),
    commissionState,
    commissionSummary: resolveMarketingCommissionSummaryText(input),
    estimatedCommissionDisplay: resolveMarketingCommissionEstimatedDisplay(input)
  };
}

export function resolveMarketingCommissionViewSafe(input: MarketingCommissionInput): MarketingCommissionView {
  try {
    return resolveMarketingCommissionView(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-commission-runtime] commission view failed", error);

    return {
      commissionBadgeTone: "red",
      commissionDescription: getMarketingCommissionDescription("unknown"),
      commissionEngineStatus: "No commission engine connected",
      commissionIssues: [
        {
          code: "commission_runtime_error",
          message: message || "Commission runtime failed safely.",
          severity: "blocker",
          stateHint: "unknown"
        }
      ],
      commissionLabel: getMarketingCommissionLabel("unknown"),
      commissionModelLabel: "Platform commission model",
      commissionRateDisplay: "Rate unavailable",
      commissionReady: false,
      commissionSource: "registry",
      commissionState: "unknown",
      commissionSummary: "Commission readiness foundation only. No settlement records exposed.",
      estimatedCommissionDisplay: "0.00 placeholder"
    };
  }
}

export function isMarketingCommissionReady(input: MarketingCommissionInput) {
  return resolveMarketingCommissionViewSafe(input).commissionReady;
}

export function isValidMarketingCommissionState(value: unknown): value is MarketingCommissionState {
  return typeof value === "string" && MARKETING_COMMISSION_STATES.includes(value as MarketingCommissionState);
}

export function indexMarketingCommissionSummariesByRegistryKey(
  summaries: MarketingCommissionSummaryRecord[]
): Map<string, MarketingCommissionSummaryRecord> {
  return new Map(summaries.map((summary) => [summary.registryKey, summary]));
}

export async function listMarketingCommissionSummariesReadOnly(): Promise<MarketingCommissionSummaryRecord[]> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketing_commission_summaries" as never)
    .select(commissionSummarySelect as never)
    .order("updated_at" as never, { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Marketing commission summaries could not be listed: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketingCommissionSummary(row))
    .filter((summary): summary is MarketingCommissionSummaryRecord => Boolean(summary));
}

export async function listMarketingCommissionSummariesReadOnlySafe(): Promise<{
  source: "database" | "fallback";
  summaries: MarketingCommissionSummaryRecord[];
  warning: string | null;
}> {
  try {
    const summaries = await listMarketingCommissionSummariesReadOnly();

    if (!summaries.length) {
      return {
        source: "fallback",
        summaries: [...MARKETING_COMMISSION_FALLBACK_SUMMARIES],
        warning: "Marketing commission summary table is empty. Showing fallback commission rows."
      };
    }

    return {
      source: "database",
      summaries,
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-commission-runtime] read-only commission summary load failed", error);

    return {
      source: "fallback",
      summaries: [...MARKETING_COMMISSION_FALLBACK_SUMMARIES],
      warning: message
    };
  }
}
