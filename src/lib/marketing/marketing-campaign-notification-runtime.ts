import "server-only";

import {
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import { parseMarketingType, type MarketingType } from "@/src/lib/marketing/marketing-type-runtime";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingCampaignNotificationSummaryStatus =
  | "disabled"
  | "foundation"
  | "placeholder"
  | "ready";

export type MarketingCampaignNotificationState =
  | "invalid"
  | "needs_review"
  | "notification_disabled"
  | "notification_ready"
  | "unknown";

export type MarketingCampaignNotificationSource = "fallback" | "registry" | "summary_table";

export type MarketingCampaignNotificationIssueSeverity = "blocker" | "review";

export type MarketingCampaignNotificationIssue = {
  code: string;
  message: string;
  severity: MarketingCampaignNotificationIssueSeverity;
  stateHint?: MarketingCampaignNotificationState;
};

export type MarketingCampaignNotificationSummaryRecord = {
  campaignCode: string;
  createdAt: string | null;
  id: string;
  metadata: Record<string, unknown>;
  notificationChannelLabel: string;
  notificationStatus: MarketingCampaignNotificationSummaryStatus;
  notificationSummary: string;
  notificationTemplateLabel: string;
  registryKey: string;
  updatedAt: string | null;
};

export type MarketingCampaignNotificationView = {
  notificationBadgeTone: "amber" | "blue" | "green" | "red";
  notificationChannelLabel: string;
  notificationDescription: string;
  notificationEngineStatus: string;
  notificationIssues: MarketingCampaignNotificationIssue[];
  notificationLabel: string;
  notificationReady: boolean;
  notificationSource: MarketingCampaignNotificationSource;
  notificationState: MarketingCampaignNotificationState;
  notificationSummary: string;
  notificationTemplateLabel: string;
};

export type MarketingCampaignNotificationInput = {
  campaignReady?: boolean;
  code: string;
  emailReady?: boolean;
  exists?: boolean;
  lifecycleState?: unknown;
  marketingType: unknown;
  metadata?: unknown;
  metadataSummary?: unknown;
  notificationSummaryRecord?: MarketingCampaignNotificationSummaryRecord | null;
  registryKey: string;
  slug: string;
  status: unknown;
};

export const MARKETING_CAMPAIGN_NOTIFICATION_SUMMARY_STATUSES: readonly MarketingCampaignNotificationSummaryStatus[] =
  ["foundation", "disabled", "placeholder", "ready"] as const;

export const MARKETING_CAMPAIGN_NOTIFICATION_STATES: readonly MarketingCampaignNotificationState[] = [
  "notification_ready",
  "notification_disabled",
  "needs_review",
  "invalid",
  "unknown"
] as const;

export const MARKETING_CAMPAIGN_NOTIFICATION_FALLBACK_SUMMARIES: readonly MarketingCampaignNotificationSummaryRecord[] =
  [
    {
      campaignCode: "CAM-PLATFORM-ANNOUNCEMENTS",
      createdAt: null,
      id: "fallback-campaign-notification-platform-announcements",
      metadata: { source: "marketing_campaign_notification_fallback" },
      notificationChannelLabel: "In-app notification",
      notificationStatus: "foundation",
      notificationSummary:
        "Foundation notification readiness summary. No notification sending or provider integration.",
      notificationTemplateLabel: "Platform announcement notification placeholder",
      registryKey: "campaign:platform-announcements",
      updatedAt: null
    }
  ];

const notificationSummarySelect =
  "id, registry_key, campaign_code, notification_channel_label, notification_template_label, notification_status, notification_summary, metadata, created_at, updated_at";

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|smtp|sendgrid|mailgun|twilio|whatsapp|sms|push|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,}|\+?\d{7,15}|ip_address|device_fingerprint|session_id)/i;

const forbiddenMetadataKeyPattern =
  /^(api[_-]?key|secret|token|password|credential|smtp|sendgrid|mailgun|twilio|whatsapp|sms|push|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|ip_address|device_fingerprint|cookie|session_id|recipient|recipients|email_list|customer_list|phone|phone_number|provider_config)$/i;

const readyNotificationStatuses = new Set<MarketingStatus>(["active"]);

const registryNotificationDisplayMap: Record<
  string,
  Pick<MarketingCampaignNotificationSummaryRecord, "notificationChannelLabel" | "notificationTemplateLabel">
> = {
  "campaign:platform-announcements": {
    notificationChannelLabel: "In-app notification",
    notificationTemplateLabel: "Platform announcement notification placeholder"
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

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketing campaign notification summaries.");
  }

  return admin;
}

function sanitizeNotificationDisplayValue(value: unknown, fallback: string) {
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

export function isValidMarketingCampaignNotificationSummaryStatus(
  value: unknown
): value is MarketingCampaignNotificationSummaryStatus {
  return (
    typeof value === "string" &&
    MARKETING_CAMPAIGN_NOTIFICATION_SUMMARY_STATUSES.includes(
      value as MarketingCampaignNotificationSummaryStatus
    )
  );
}

export function parseMarketingCampaignNotificationSummaryStatus(
  value: unknown
): MarketingCampaignNotificationSummaryStatus | null {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingCampaignNotificationSummaryStatus(cleaned) ? cleaned : null;
}

export function parseMarketingCampaignNotificationSummary(
  row: unknown
): MarketingCampaignNotificationSummaryRecord | null {
  if (!row || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  const id = text(record.id, 120);
  const registryKey = text(record.registry_key, 160);
  const notificationStatus = parseMarketingCampaignNotificationSummaryStatus(record.notification_status);

  if (!id || !registryKey || !notificationStatus) {
    return null;
  }

  const mapped = registryNotificationDisplayMap[registryKey];

  return {
    campaignCode: sanitizeNotificationDisplayValue(record.campaign_code, ""),
    createdAt: text(record.created_at, 80) || null,
    id,
    metadata: safeRecord(record.metadata) ?? {},
    notificationChannelLabel: sanitizeNotificationDisplayValue(
      record.notification_channel_label,
      mapped?.notificationChannelLabel ?? "Notification channel unavailable"
    ),
    notificationStatus,
    notificationSummary: sanitizeNotificationDisplayValue(
      record.notification_summary,
      "Notification readiness foundation only. No sending records exposed."
    ),
    notificationTemplateLabel: sanitizeNotificationDisplayValue(
      record.notification_template_label,
      mapped?.notificationTemplateLabel ?? "Notification template unavailable"
    ),
    registryKey,
    updatedAt: text(record.updated_at, 80) || null
  };
}

function inspectNotificationType(params: { marketingType: MarketingType | null }): MarketingCampaignNotificationIssue[] {
  if (params.marketingType === "campaign") {
    return [];
  }

  return [
    {
      code: "campaign_notification_type_mismatch",
      message: "Registry item is not a campaign and cannot be evaluated for notification readiness.",
      severity: "blocker",
      stateHint: "invalid"
    }
  ];
}

function inspectNotificationLifecycle(params: {
  lifecycleState: MarketingStatus | null;
  status: MarketingStatus | null;
}): MarketingCampaignNotificationIssue[] {
  const issues: MarketingCampaignNotificationIssue[] = [];

  if (params.status === "expired" || params.lifecycleState === "expired") {
    issues.push({
      code: "campaign_notification_expired",
      message: "Campaign lifecycle is expired. Notification readiness only; no sending occurs.",
      severity: "blocker",
      stateHint: "notification_disabled"
    });
  }

  if (params.status === "paused" || params.lifecycleState === "paused") {
    issues.push({
      code: "campaign_notification_paused",
      message: "Campaign is paused. Notification readiness only; no sending occurs.",
      severity: "blocker",
      stateHint: "notification_disabled"
    });
  }

  if (params.status === "archived" || params.lifecycleState === "archived") {
    issues.push({
      code: "campaign_notification_archived",
      message: "Campaign is archived and notification delivery is disabled.",
      severity: "blocker",
      stateHint: "notification_disabled"
    });
  }

  if (params.status === "draft" || params.lifecycleState === "draft") {
    issues.push({
      code: "campaign_notification_draft",
      message: "Campaign is still in draft and notification delivery is disabled.",
      severity: "blocker",
      stateHint: "notification_disabled"
    });
  }

  return issues;
}

function inspectNotificationSummaryRecord(params: {
  summary: MarketingCampaignNotificationSummaryRecord | null | undefined;
}): MarketingCampaignNotificationIssue[] {
  if (!params.summary) {
    return [
      {
        code: "campaign_notification_summary_missing",
        message: "Notification summary is unavailable. Registry foundation only.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  if (params.summary.notificationStatus === "disabled") {
    return [
      {
        code: "campaign_notification_summary_disabled",
        message: "Notification summary is marked disabled for readiness review.",
        severity: "blocker",
        stateHint: "notification_disabled"
      }
    ];
  }

  if (params.summary.notificationStatus === "foundation" || params.summary.notificationStatus === "placeholder") {
    return [
      {
        code: "campaign_notification_summary_foundation",
        message: "Notification summary is a foundation placeholder. No sending or provider integration occurs.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  return [];
}

function inspectNotificationCampaignReadiness(params: {
  campaignReady: boolean;
}): MarketingCampaignNotificationIssue[] {
  if (params.campaignReady) {
    return [];
  }

  return [
    {
      code: "campaign_notification_campaign_unready",
      message: "Campaign readiness is not confirmed for notification readiness.",
      severity: "review",
      stateHint: "needs_review"
    }
  ];
}

function inspectNotificationEmailReadiness(params: { emailReady: boolean }): MarketingCampaignNotificationIssue[] {
  if (params.emailReady) {
    return [];
  }

  return [
    {
      code: "campaign_notification_email_unready",
      message: "Email readiness is not confirmed for notification readiness.",
      severity: "review",
      stateHint: "needs_review"
    }
  ];
}

function inspectNotificationMetadata(metadata: unknown): MarketingCampaignNotificationIssue[] {
  const issues: MarketingCampaignNotificationIssue[] = [];

  if (metadata !== undefined && metadata !== null && (typeof metadata !== "object" || Array.isArray(metadata))) {
    issues.push({
      code: "campaign_notification_metadata_malformed",
      message: "Campaign public metadata must be a safe object. No notification sending is performed.",
      severity: "blocker",
      stateHint: "invalid"
    });
    return issues;
  }

  const record = safeRecord(metadata);

  for (const [key, value] of Object.entries(record ?? {})) {
    const cleanedKey = text(key, 120);

    if (!cleanedKey || forbiddenMetadataKeyPattern.test(cleanedKey)) {
      issues.push({
        code: "campaign_notification_metadata_forbidden_key",
        message: "Campaign metadata contains a restricted public key and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
      continue;
    }

    if (typeof value === "object" && value !== null) {
      issues.push({
        code: "campaign_notification_metadata_nested_value",
        message: "Campaign metadata contains nested values that are not display-safe yet.",
        severity: "review",
        stateHint: "needs_review"
      });
      continue;
    }

    const cleanedValue = text(value, 240);

    if (cleanedValue && secretPattern.test(cleanedValue)) {
      issues.push({
        code: "campaign_notification_metadata_secret_value",
        message: "Campaign metadata contains restricted content and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
    }
  }

  return issues;
}

export function listMarketingCampaignNotificationIssues(
  input: MarketingCampaignNotificationInput
): MarketingCampaignNotificationIssue[] {
  const marketingType = parseMarketingType(input.marketingType);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;

  return [
    ...inspectNotificationType({ marketingType }),
    ...inspectNotificationLifecycle({ lifecycleState, status }),
    ...inspectNotificationSummaryRecord({ summary: input.notificationSummaryRecord }),
    ...inspectNotificationCampaignReadiness({ campaignReady: input.campaignReady === true }),
    ...inspectNotificationEmailReadiness({ emailReady: input.emailReady === true }),
    ...inspectNotificationMetadata(input.metadata)
  ];
}

function pickNotificationStateHintFromIssues(
  issues: MarketingCampaignNotificationIssue[]
): MarketingCampaignNotificationState | null {
  const priority: MarketingCampaignNotificationState[] = [
    "unknown",
    "invalid",
    "notification_disabled",
    "needs_review"
  ];

  for (const state of priority) {
    if (issues.some((issue) => issue.stateHint === state)) {
      return state;
    }
  }

  return null;
}

export function resolveMarketingCampaignNotificationState(
  issues: MarketingCampaignNotificationIssue[],
  params: {
    campaignReady: boolean;
    emailReady: boolean;
    lifecycleState: MarketingStatus | null;
    status: MarketingStatus | null;
    summary: MarketingCampaignNotificationSummaryRecord | null | undefined;
  }
): MarketingCampaignNotificationState {
  const hintedState = pickNotificationStateHintFromIssues(issues);

  if (hintedState) {
    return hintedState;
  }

  if (issues.some((issue) => issue.severity === "review")) {
    return "needs_review";
  }

  if (
    params.summary?.notificationStatus === "ready" &&
    params.campaignReady &&
    params.emailReady &&
    params.status &&
    readyNotificationStatuses.has(params.status) &&
    (!params.lifecycleState || params.lifecycleState === "active")
  ) {
    return "notification_ready";
  }

  return "unknown";
}

export function resolveMarketingCampaignNotificationChannelLabel(input: MarketingCampaignNotificationInput) {
  const registryKey = text(input.registryKey, 160);
  const metadata = safeRecord(input.metadata) ?? {};
  const mapped = registryNotificationDisplayMap[registryKey];

  return sanitizeNotificationDisplayValue(
    input.notificationSummaryRecord?.notificationChannelLabel ??
      metadataValue(metadata, ["notification_channel_label", "notification_channel", "channel_label"]) ??
      mapped?.notificationChannelLabel,
    "Notification channel unavailable"
  );
}

export function resolveMarketingCampaignNotificationTemplateLabel(input: MarketingCampaignNotificationInput) {
  const registryKey = text(input.registryKey, 160);
  const metadata = safeRecord(input.metadata) ?? {};
  const mapped = registryNotificationDisplayMap[registryKey];

  return sanitizeNotificationDisplayValue(
    input.notificationSummaryRecord?.notificationTemplateLabel ??
      metadataValue(metadata, ["notification_template_label", "notification_template", "template_label"]) ??
      mapped?.notificationTemplateLabel,
    "Notification template unavailable"
  );
}

export function resolveMarketingCampaignNotificationSummaryText(input: MarketingCampaignNotificationInput) {
  if (input.notificationSummaryRecord?.notificationSummary) {
    return input.notificationSummaryRecord.notificationSummary;
  }

  return sanitizeNotificationDisplayValue(
    input.metadataSummary,
    "Notification readiness foundation only. No sending records exposed."
  );
}

export function resolveMarketingCampaignNotificationSource(
  input: MarketingCampaignNotificationInput
): MarketingCampaignNotificationSource {
  if (input.notificationSummaryRecord?.metadata.source === "marketing_campaign_notification_fallback") {
    return "fallback";
  }

  if (input.notificationSummaryRecord) {
    return "summary_table";
  }

  return "registry";
}

export function getMarketingCampaignNotificationLabel(state: MarketingCampaignNotificationState) {
  if (state === "notification_ready") return "Notification ready";
  if (state === "notification_disabled") return "Notification disabled";
  if (state === "needs_review") return "Needs review";
  if (state === "invalid") return "Invalid";
  return "Unknown";
}

export function getMarketingCampaignNotificationDescription(state: MarketingCampaignNotificationState) {
  if (state === "notification_ready") {
    return "Campaign passed notification-readiness checks. No notification sending or provider integration yet.";
  }

  if (state === "notification_disabled") {
    return "Notifications are disabled in the current lifecycle state. Readiness foundation only.";
  }

  if (state === "needs_review") {
    return "Campaign is display-safe but requires Super Admin review before future notification phases.";
  }

  if (state === "invalid") {
    return "Notification display data failed readiness checks. No notification jobs are created.";
  }

  return "Notification readiness could not be classified safely.";
}

export function getMarketingCampaignNotificationBadgeTone(
  state: MarketingCampaignNotificationState
): MarketingCampaignNotificationView["notificationBadgeTone"] {
  if (state === "notification_ready") return "green";
  if (state === "needs_review") return "amber";
  if (state === "notification_disabled") return "blue";
  if (state === "invalid") return "red";
  return "amber";
}

export function resolveMarketingCampaignNotificationView(
  input: MarketingCampaignNotificationInput
): MarketingCampaignNotificationView {
  const notificationIssues = listMarketingCampaignNotificationIssues(input);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;
  const notificationState = resolveMarketingCampaignNotificationState(notificationIssues, {
    campaignReady: input.campaignReady === true,
    emailReady: input.emailReady === true,
    lifecycleState,
    status,
    summary: input.notificationSummaryRecord
  });

  return {
    notificationBadgeTone: getMarketingCampaignNotificationBadgeTone(notificationState),
    notificationChannelLabel: resolveMarketingCampaignNotificationChannelLabel(input),
    notificationDescription: getMarketingCampaignNotificationDescription(notificationState),
    notificationEngineStatus: "No notification provider connected",
    notificationIssues,
    notificationLabel: getMarketingCampaignNotificationLabel(notificationState),
    notificationReady: notificationState === "notification_ready",
    notificationSource: resolveMarketingCampaignNotificationSource(input),
    notificationState,
    notificationSummary: resolveMarketingCampaignNotificationSummaryText(input),
    notificationTemplateLabel: resolveMarketingCampaignNotificationTemplateLabel(input)
  };
}

export function resolveMarketingCampaignNotificationViewSafe(
  input: MarketingCampaignNotificationInput
): MarketingCampaignNotificationView {
  try {
    return resolveMarketingCampaignNotificationView(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-campaign-notification-runtime] notification view failed", error);

    return {
      notificationBadgeTone: "red",
      notificationChannelLabel: "Notification channel unavailable",
      notificationDescription: getMarketingCampaignNotificationDescription("unknown"),
      notificationEngineStatus: "No notification provider connected",
      notificationIssues: [
        {
          code: "campaign_notification_runtime_error",
          message: message || "Campaign notification runtime failed safely.",
          severity: "blocker",
          stateHint: "unknown"
        }
      ],
      notificationLabel: getMarketingCampaignNotificationLabel("unknown"),
      notificationReady: false,
      notificationSource: "registry",
      notificationState: "unknown",
      notificationSummary: "Notification readiness foundation only. No sending records exposed.",
      notificationTemplateLabel: "Notification template unavailable"
    };
  }
}

export function isMarketingCampaignNotificationReady(input: MarketingCampaignNotificationInput) {
  return resolveMarketingCampaignNotificationViewSafe(input).notificationReady;
}

export function isValidMarketingCampaignNotificationState(
  value: unknown
): value is MarketingCampaignNotificationState {
  return (
    typeof value === "string" &&
    MARKETING_CAMPAIGN_NOTIFICATION_STATES.includes(value as MarketingCampaignNotificationState)
  );
}

export function indexMarketingCampaignNotificationSummariesByRegistryKey(
  summaries: MarketingCampaignNotificationSummaryRecord[]
): Map<string, MarketingCampaignNotificationSummaryRecord> {
  return new Map(summaries.map((summary) => [summary.registryKey, summary]));
}

export async function listMarketingCampaignNotificationSummariesReadOnly(): Promise<
  MarketingCampaignNotificationSummaryRecord[]
> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketing_campaign_notification_summaries" as never)
    .select(notificationSummarySelect as never)
    .order("updated_at" as never, { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Marketing campaign notification summaries could not be listed: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketingCampaignNotificationSummary(row))
    .filter((summary): summary is MarketingCampaignNotificationSummaryRecord => Boolean(summary));
}

export async function listMarketingCampaignNotificationSummariesReadOnlySafe(): Promise<{
  source: "database" | "fallback";
  summaries: MarketingCampaignNotificationSummaryRecord[];
  warning: string | null;
}> {
  try {
    const summaries = await listMarketingCampaignNotificationSummariesReadOnly();

    if (!summaries.length) {
      return {
        source: "fallback",
        summaries: [...MARKETING_CAMPAIGN_NOTIFICATION_FALLBACK_SUMMARIES],
        warning: "Marketing campaign notification summary table is empty. Showing fallback notification rows."
      };
    }

    return {
      source: "database",
      summaries,
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-campaign-notification-runtime] read-only notification summary load failed", error);

    return {
      source: "fallback",
      summaries: [...MARKETING_CAMPAIGN_NOTIFICATION_FALLBACK_SUMMARIES],
      warning: message
    };
  }
}
