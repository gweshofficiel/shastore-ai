import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingCouponUsageTrackingStatus =
  | "foundation"
  | "placeholder"
  | "tracked"
  | "untracked";

export type MarketingCouponUsageTrackingState = "placeholder" | "tracked" | "unknown" | "untracked";

export type MarketingCouponUsageTrackingSource = "fallback" | "registry" | "summary_table";

export type MarketingCouponUsageSummaryRecord = {
  couponCode: string;
  createdAt: string | null;
  id: string;
  metadata: Record<string, unknown>;
  registryKey: string;
  trackingStatus: MarketingCouponUsageTrackingStatus;
  updatedAt: string | null;
  usageCount: number;
  usageLimitLabel: string;
  usageSummary: string;
};

export type MarketingCouponUsageView = {
  usageSummary: string;
  usageTrackingBadgeTone: "amber" | "blue" | "green" | "red";
  usageTrackingDescription: string;
  usageTrackingLabel: string;
  usageTrackingSource: MarketingCouponUsageTrackingSource;
  usageTrackingState: MarketingCouponUsageTrackingState;
};

export type MarketingCouponUsageInput = {
  code: string;
  registryKey: string;
  usageCount: unknown;
  usageLimit: string;
  usageSummaryRecord?: MarketingCouponUsageSummaryRecord | null;
};

export const MARKETING_COUPON_USAGE_TRACKING_STATUSES: readonly MarketingCouponUsageTrackingStatus[] = [
  "untracked",
  "foundation",
  "placeholder",
  "tracked"
] as const;

export const MARKETING_COUPON_USAGE_FALLBACK_SUMMARIES: readonly MarketingCouponUsageSummaryRecord[] = [
  {
    couponCode: "PLATFORM-WELCOME",
    createdAt: null,
    id: "fallback-usage-platform-coupon-welcome-plan-credit",
    metadata: { source: "marketing_coupon_usage_fallback" },
    registryKey: "platform-coupon:welcome-plan-credit",
    trackingStatus: "foundation",
    updatedAt: null,
    usageCount: 0,
    usageLimitLabel: "Placeholder limit",
    usageSummary: "Foundation usage summary. No redemption tracking connected."
  },
  {
    couponCode: "PLAN-CREDIT-DRAFT",
    createdAt: null,
    id: "fallback-usage-platform-promotion-annual-upgrade",
    metadata: { source: "marketing_coupon_usage_fallback" },
    registryKey: "platform-promotion:annual-upgrade",
    trackingStatus: "foundation",
    updatedAt: null,
    usageCount: 0,
    usageLimitLabel: "Internal review only",
    usageSummary: "Legacy coupon usage summary placeholder. No billing discount application."
  }
];

const usageSummarySelect =
  "id, registry_key, coupon_code, usage_count, usage_limit_label, tracking_status, usage_summary, metadata, created_at, updated_at";

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

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeUsageCount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketing coupon usage summaries.");
  }

  return admin;
}

function sanitizeUsageDisplayValue(value: unknown, fallback: string) {
  const cleaned = text(value, 240);

  if (!cleaned || secretPattern.test(cleaned)) {
    return fallback;
  }

  return cleaned;
}

export function isValidMarketingCouponUsageTrackingStatus(
  value: unknown
): value is MarketingCouponUsageTrackingStatus {
  return typeof value === "string" && MARKETING_COUPON_USAGE_TRACKING_STATUSES.includes(value as MarketingCouponUsageTrackingStatus);
}

export function parseMarketingCouponUsageTrackingStatus(
  value: unknown
): MarketingCouponUsageTrackingStatus | null {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingCouponUsageTrackingStatus(cleaned) ? cleaned : null;
}

export function parseMarketingCouponUsageSummary(row: unknown): MarketingCouponUsageSummaryRecord | null {
  if (!row || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  const id = text(record.id, 120);
  const registryKey = text(record.registry_key, 160);
  const trackingStatus = parseMarketingCouponUsageTrackingStatus(record.tracking_status);

  if (!id || !registryKey || !trackingStatus) {
    return null;
  }

  return {
    couponCode: sanitizeUsageDisplayValue(record.coupon_code, ""),
    createdAt: text(record.created_at, 80) || null,
    id,
    metadata: safeRecord(record.metadata),
    registryKey,
    trackingStatus,
    updatedAt: text(record.updated_at, 80) || null,
    usageCount: safeUsageCount(record.usage_count),
    usageLimitLabel: sanitizeUsageDisplayValue(record.usage_limit_label, "Usage limit unavailable"),
    usageSummary: sanitizeUsageDisplayValue(
      record.usage_summary,
      "Usage tracking foundation only. No redemption records exposed."
    )
  };
}

export function resolveMarketingCouponUsageCount(input: MarketingCouponUsageInput) {
  if (input.usageSummaryRecord) {
    return input.usageSummaryRecord.usageCount;
  }

  return safeUsageCount(input.usageCount);
}

export function resolveMarketingCouponUsageLimitLabel(input: MarketingCouponUsageInput) {
  if (input.usageSummaryRecord?.usageLimitLabel) {
    return input.usageSummaryRecord.usageLimitLabel;
  }

  return sanitizeUsageDisplayValue(input.usageLimit, "Usage limit unavailable");
}

export function resolveMarketingCouponUsageSummaryText(input: MarketingCouponUsageInput) {
  if (input.usageSummaryRecord?.usageSummary) {
    return input.usageSummaryRecord.usageSummary;
  }

  const count = safeUsageCount(input.usageCount);

  if (count > 0) {
    return `${count} usage record${count === 1 ? "" : "s"} from registry foundation. No redemption engine connected.`;
  }

  return "Usage tracking foundation only. No redemption records exposed.";
}

export function resolveMarketingCouponUsageTrackingState(
  input: MarketingCouponUsageInput
): MarketingCouponUsageTrackingState {
  const summary = input.usageSummaryRecord;

  if (!summary) {
    const count = safeUsageCount(input.usageCount);
    return count > 0 ? "tracked" : "untracked";
  }

  if (summary.trackingStatus === "foundation" || summary.trackingStatus === "placeholder") {
    return "placeholder";
  }

  if (summary.trackingStatus === "tracked") {
    return "tracked";
  }

  if (summary.trackingStatus === "untracked") {
    return summary.usageCount > 0 ? "tracked" : "untracked";
  }

  return "unknown";
}

export function resolveMarketingCouponUsageTrackingSource(
  input: MarketingCouponUsageInput
): MarketingCouponUsageTrackingSource {
  if (input.usageSummaryRecord?.metadata.source === "marketing_coupon_usage_fallback") {
    return "fallback";
  }

  if (input.usageSummaryRecord) {
    return "summary_table";
  }

  return "registry";
}

export function getMarketingCouponUsageTrackingLabel(state: MarketingCouponUsageTrackingState) {
  if (state === "tracked") return "Tracked";
  if (state === "placeholder") return "Placeholder";
  if (state === "untracked") return "Untracked";
  return "Unknown";
}

export function getMarketingCouponUsageTrackingDescription(state: MarketingCouponUsageTrackingState) {
  if (state === "tracked") {
    return "Coupon usage count is available for Super Admin review. No checkout or billing enforcement.";
  }

  if (state === "placeholder") {
    return "Foundation usage summary only. No redemption or usage mutation on page load.";
  }

  if (state === "untracked") {
    return "Coupon usage is not yet tracked in the usage summary table. Registry count only.";
  }

  return "Coupon usage tracking could not be classified safely.";
}

export function getMarketingCouponUsageTrackingBadgeTone(
  state: MarketingCouponUsageTrackingState
): MarketingCouponUsageView["usageTrackingBadgeTone"] {
  if (state === "tracked") return "green";
  if (state === "placeholder") return "amber";
  if (state === "untracked") return "blue";
  return "red";
}

export function resolveMarketingCouponUsageView(input: MarketingCouponUsageInput): MarketingCouponUsageView {
  const usageTrackingState = resolveMarketingCouponUsageTrackingState(input);

  return {
    usageSummary: resolveMarketingCouponUsageSummaryText(input),
    usageTrackingBadgeTone: getMarketingCouponUsageTrackingBadgeTone(usageTrackingState),
    usageTrackingDescription: getMarketingCouponUsageTrackingDescription(usageTrackingState),
    usageTrackingLabel: getMarketingCouponUsageTrackingLabel(usageTrackingState),
    usageTrackingSource: resolveMarketingCouponUsageTrackingSource(input),
    usageTrackingState
  };
}

export function resolveMarketingCouponUsageViewSafe(input: MarketingCouponUsageInput): MarketingCouponUsageView {
  try {
    return resolveMarketingCouponUsageView(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-coupon-usage-runtime] usage view failed", error);

    return {
      usageSummary: "Usage tracking runtime failed safely. No customer or payment data is exposed.",
      usageTrackingBadgeTone: "red",
      usageTrackingDescription: getMarketingCouponUsageTrackingDescription("unknown"),
      usageTrackingLabel: getMarketingCouponUsageTrackingLabel("unknown"),
      usageTrackingSource: "registry",
      usageTrackingState: "unknown"
    };
  }
}

export function indexMarketingCouponUsageSummariesByRegistryKey(
  summaries: MarketingCouponUsageSummaryRecord[]
): Map<string, MarketingCouponUsageSummaryRecord> {
  return new Map(summaries.map((summary) => [summary.registryKey, summary]));
}

export async function listMarketingCouponUsageSummariesReadOnly(): Promise<MarketingCouponUsageSummaryRecord[]> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketing_coupon_usage_summaries" as never)
    .select(usageSummarySelect as never)
    .order("updated_at" as never, { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Marketing coupon usage summaries could not be listed: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketingCouponUsageSummary(row))
    .filter((summary): summary is MarketingCouponUsageSummaryRecord => Boolean(summary));
}

export async function listMarketingCouponUsageSummariesReadOnlySafe(): Promise<{
  source: "database" | "fallback";
  summaries: MarketingCouponUsageSummaryRecord[];
  warning: string | null;
}> {
  try {
    const summaries = await listMarketingCouponUsageSummariesReadOnly();

    if (!summaries.length) {
      return {
        source: "fallback",
        summaries: [...MARKETING_COUPON_USAGE_FALLBACK_SUMMARIES],
        warning: "Marketing coupon usage summary table is empty. Showing fallback usage rows."
      };
    }

    return {
      source: "database",
      summaries,
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-coupon-usage-runtime] read-only usage summary load failed", error);

    return {
      source: "fallback",
      summaries: [...MARKETING_COUPON_USAGE_FALLBACK_SUMMARIES],
      warning: message
    };
  }
}
