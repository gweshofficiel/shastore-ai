import "server-only";

import {
  resolveMarketingAudienceView,
  type MarketingAudienceView
} from "@/src/lib/marketing/marketing-audience-runtime";
import {
  getMarketingLifecycleDescription,
  getMarketingLifecycleLabel,
  type MarketingLifecycleActionDefinition
} from "@/src/lib/marketing/marketing-campaign-lifecycle-runtime";
import {
  MARKETING_CAMPAIGN_EMAIL_FALLBACK_SUMMARIES,
  resolveMarketingCampaignEmailViewSafe,
  type MarketingCampaignEmailSummaryRecord,
  type MarketingCampaignEmailView
} from "@/src/lib/marketing/marketing-campaign-email-runtime";
import {
  MARKETING_CAMPAIGN_NOTIFICATION_FALLBACK_SUMMARIES,
  resolveMarketingCampaignNotificationViewSafe,
  type MarketingCampaignNotificationSummaryRecord,
  type MarketingCampaignNotificationView
} from "@/src/lib/marketing/marketing-campaign-notification-runtime";
import type { MarketingRegistryItemRecord } from "@/src/lib/marketing/marketing-registry-runtime";
import {
  getMarketingStatusBadgeTone,
  getMarketingStatusDescription,
  getMarketingStatusLabel,
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import type { MarketingType } from "@/src/lib/marketing/marketing-type-runtime";

type MarketingCampaignCampaignSource = {
  audienceLabel: string;
  endDate?: string | null;
  id: string;
  lifecycleActions?: MarketingLifecycleActionDefinition[];
  lifecycleDescription?: string;
  lifecycleLabel?: string;
  lifecycleState: MarketingStatus;
  name: string;
  revenueImpact: number;
  startDate?: string | null;
  status: MarketingStatus;
  statusBadgeTone: ReturnType<typeof getMarketingStatusBadgeTone>;
  statusDescription: string;
  statusLabel: string;
  targetAudienceSummary: string;
  type: MarketingType;
  typeDescription: string;
  usage: number;
};

export type MarketingCampaignProgramType =
  | "newsletter"
  | "onboarding_sequence"
  | "platform_announcement"
  | "product_update";

export type MarketingCampaignState =
  | "campaign_disabled"
  | "campaign_ready"
  | "invalid"
  | "needs_review"
  | "unknown";

export type MarketingCampaignIssueSeverity = "blocker" | "review";

export type MarketingCampaignIssue = {
  code: string;
  message: string;
  severity: MarketingCampaignIssueSeverity;
  stateHint?: MarketingCampaignState;
};

export type MarketingCampaignReadinessView = {
  campaignBadgeTone: "amber" | "blue" | "green" | "red";
  campaignDescription: string;
  campaignEngineStatus: string;
  campaignIssues: MarketingCampaignIssue[];
  campaignLabel: string;
  campaignReady: boolean;
  campaignState: MarketingCampaignState;
  campaignSummary: string;
};

export type MarketingCampaignView = {
  campaignProgramType: MarketingCampaignProgramType;
  campaignTypeLabel: string;
  code: string;
  deliveryStatus: string;
  description: string;
  endDateDisplay: string | null;
  lifecycleDescription: string;
  lifecycleLabel: string;
  lifecycleState: MarketingStatus;
  metadataSummary: string;
  name: string;
  registryKey: string;
  revenueImpact: number;
  slug: string;
  startDateDisplay: string | null;
  status: MarketingStatus;
  statusBadgeTone: ReturnType<typeof getMarketingStatusBadgeTone>;
  statusDescription: string;
  statusLabel: string;
  targetAudienceSummary: string;
  usageCount: number;
} & MarketingAudienceView &
  MarketingCampaignReadinessView &
  MarketingCampaignEmailView &
  MarketingCampaignNotificationView;

export const MARKETING_CAMPAIGN_PROGRAM_TYPES: readonly MarketingCampaignProgramType[] = [
  "platform_announcement",
  "onboarding_sequence",
  "newsletter",
  "product_update"
] as const;

export const MARKETING_CAMPAIGN_STATES: readonly MarketingCampaignState[] = [
  "campaign_ready",
  "campaign_disabled",
  "needs_review",
  "invalid",
  "unknown"
] as const;

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|smtp|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,}|ip_address|device_fingerprint|session_id)/i;

const forbiddenMetadataKeyPattern =
  /^(api[_-]?key|secret|token|password|credential|smtp|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|ip_address|device_fingerprint|cookie|session_id|recipient|recipients|email_list|customer_list)$/i;

const registryCampaignDisplayMap: Record<
  string,
  Pick<MarketingCampaignView, "campaignProgramType" | "code">
> = {
  "campaign:platform-announcements": {
    campaignProgramType: "platform_announcement",
    code: "CAM-PLATFORM-ANNOUNCEMENTS"
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

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isValidMarketingCampaignProgramType(value: unknown): value is MarketingCampaignProgramType {
  return typeof value === "string" && MARKETING_CAMPAIGN_PROGRAM_TYPES.includes(value as MarketingCampaignProgramType);
}

function parseMarketingCampaignProgramType(value: unknown): MarketingCampaignProgramType {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingCampaignProgramType(cleaned) ? cleaned : "platform_announcement";
}

function sanitizeCampaignDisplayValue(value: unknown, fallback: string) {
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

function buildCampaignDisplayCode(params: {
  metadata: Record<string, unknown>;
  registryKey: string;
  slug: string;
}) {
  const mapped = registryCampaignDisplayMap[params.registryKey]?.code;
  if (mapped) return mapped;

  const metadataCode = sanitizeCampaignDisplayValue(
    metadataValue(params.metadata, ["campaign_code", "code", "display_code"]),
    ""
  );

  if (metadataCode) return metadataCode;

  const slugCode = params.slug.replace(/-/g, "_").toUpperCase();
  return slugCode ? `CAM-${slugCode}` : "CAM-DRAFT";
}

function buildMetadataSummary(metadata: Record<string, unknown>) {
  const summary = sanitizeCampaignDisplayValue(
    metadataValue(metadata, ["metadata_summary", "summary", "public_summary"]),
    "Foundation campaign display only. No email sending, notification delivery, or mass send integration."
  );

  if (secretPattern.test(summary)) {
    return "Campaign metadata summary hidden for safety.";
  }

  return summary;
}

function sanitizeScheduleDisplay(value: unknown): string | null {
  const cleaned = text(value, 80);
  if (!cleaned || secretPattern.test(cleaned)) return null;
  return cleaned;
}

export function isValidMarketingCampaignState(value: unknown): value is MarketingCampaignState {
  return typeof value === "string" && MARKETING_CAMPAIGN_STATES.includes(value as MarketingCampaignState);
}

function inspectCampaignMetadata(metadata: unknown): MarketingCampaignIssue[] {
  const issues: MarketingCampaignIssue[] = [];

  if (metadata !== undefined && metadata !== null && (typeof metadata !== "object" || Array.isArray(metadata))) {
    issues.push({
      code: "campaign_metadata_malformed",
      message: "Campaign public metadata must be a safe object. No sending is performed.",
      severity: "blocker",
      stateHint: "invalid"
    });
    return issues;
  }

  const record = safeRecord(metadata);

  for (const [key, value] of Object.entries(record)) {
    const cleanedKey = text(key, 120);

    if (!cleanedKey || forbiddenMetadataKeyPattern.test(cleanedKey)) {
      issues.push({
        code: "campaign_metadata_forbidden_key",
        message: "Campaign metadata contains a restricted public key and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
      continue;
    }

    if (typeof value === "object" && value !== null) {
      issues.push({
        code: "campaign_metadata_nested_value",
        message: "Campaign metadata contains nested values that are not display-safe yet.",
        severity: "review",
        stateHint: "needs_review"
      });
      continue;
    }

    const cleanedValue = text(value, 240);

    if (cleanedValue && secretPattern.test(cleanedValue)) {
      issues.push({
        code: "campaign_metadata_secret_value",
        message: "Campaign metadata contains restricted content and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
    }
  }

  return issues;
}

function inspectCampaignLifecycle(params: {
  lifecycleState: MarketingStatus | null;
  status: MarketingStatus | null;
}): MarketingCampaignIssue[] {
  const issues: MarketingCampaignIssue[] = [];

  if (params.status === "expired" || params.lifecycleState === "expired") {
    issues.push({
      code: "campaign_expired",
      message: "Campaign lifecycle is expired. Display foundation only; no sending occurs.",
      severity: "blocker",
      stateHint: "campaign_disabled"
    });
  }

  if (params.status === "paused" || params.lifecycleState === "paused") {
    issues.push({
      code: "campaign_paused",
      message: "Campaign is paused. Display foundation only; no sending occurs.",
      severity: "blocker",
      stateHint: "campaign_disabled"
    });
  }

  if (params.status === "archived" || params.lifecycleState === "archived") {
    issues.push({
      code: "campaign_archived",
      message: "Campaign is archived and delivery is disabled.",
      severity: "blocker",
      stateHint: "campaign_disabled"
    });
  }

  if (params.status === "draft" || params.lifecycleState === "draft") {
    issues.push({
      code: "campaign_draft",
      message: "Campaign is still in draft and delivery is disabled.",
      severity: "blocker",
      stateHint: "campaign_disabled"
    });
  }

  return issues;
}

function inspectCampaignIdentity(params: {
  name: string;
  registryKey: string;
  slug: string;
}): MarketingCampaignIssue[] {
  const issues: MarketingCampaignIssue[] = [];

  if (!params.name) {
    issues.push({
      code: "campaign_name_missing",
      message: "Campaign name is unavailable for display.",
      severity: "blocker",
      stateHint: "invalid"
    });
  }

  if (!params.registryKey) {
    issues.push({
      code: "campaign_registry_missing",
      message: "Campaign registry key is unavailable.",
      severity: "blocker",
      stateHint: "unknown"
    });
  }

  if (!params.slug) {
    issues.push({
      code: "campaign_slug_missing",
      message: "Campaign slug is unavailable for display.",
      severity: "review",
      stateHint: "needs_review"
    });
  }

  if (params.name && secretPattern.test(params.name)) {
    issues.push({
      code: "campaign_name_unsafe",
      message: "Campaign name contains restricted content and requires review.",
      severity: "blocker",
      stateHint: "needs_review"
    });
  }

  return issues;
}

export function listMarketingCampaignIssues(input: {
  lifecycleState?: unknown;
  metadata?: unknown;
  name: string;
  registryKey: string;
  slug: string;
  status: unknown;
}): MarketingCampaignIssue[] {
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;

  return [
    ...inspectCampaignIdentity({
      name: text(input.name, 200),
      registryKey: text(input.registryKey, 160),
      slug: text(input.slug, 160)
    }),
    ...inspectCampaignLifecycle({ lifecycleState, status }),
    ...inspectCampaignMetadata(input.metadata)
  ];
}

function pickCampaignStateHintFromIssues(issues: MarketingCampaignIssue[]): MarketingCampaignState | null {
  const priority: MarketingCampaignState[] = ["unknown", "invalid", "campaign_disabled", "needs_review"];

  for (const state of priority) {
    if (issues.some((issue) => issue.stateHint === state)) {
      return state;
    }
  }

  return null;
}

export function resolveMarketingCampaignState(
  issues: MarketingCampaignIssue[],
  params: {
    lifecycleState: MarketingStatus | null;
    status: MarketingStatus | null;
  }
): MarketingCampaignState {
  const hintedState = pickCampaignStateHintFromIssues(issues);

  if (hintedState) {
    return hintedState;
  }

  if (issues.some((issue) => issue.severity === "review")) {
    return "needs_review";
  }

  if (
    params.status === "active" &&
    (!params.lifecycleState || params.lifecycleState === "active") &&
    !issues.some((issue) => issue.severity === "blocker")
  ) {
    return "campaign_ready";
  }

  return "unknown";
}

export function getMarketingCampaignLabel(state: MarketingCampaignState) {
  if (state === "campaign_ready") return "Campaign ready";
  if (state === "campaign_disabled") return "Campaign disabled";
  if (state === "needs_review") return "Needs review";
  if (state === "invalid") return "Invalid";
  return "Unknown";
}

export function getMarketingCampaignDescription(state: MarketingCampaignState) {
  if (state === "campaign_ready") {
    return "Campaign passed display-readiness checks. No email sending, notification delivery, or mass send integration yet.";
  }

  if (state === "campaign_disabled") {
    return "Campaign delivery is disabled in the current lifecycle state. Display foundation only.";
  }

  if (state === "needs_review") {
    return "Campaign is display-safe but requires Super Admin review before future sending phases.";
  }

  if (state === "invalid") {
    return "Campaign display data failed readiness checks. No campaign execution occurs.";
  }

  return "Campaign readiness could not be classified safely.";
}

export function getMarketingCampaignBadgeTone(
  state: MarketingCampaignState
): MarketingCampaignReadinessView["campaignBadgeTone"] {
  if (state === "campaign_ready") return "green";
  if (state === "needs_review") return "amber";
  if (state === "campaign_disabled") return "blue";
  if (state === "invalid") return "red";
  return "amber";
}

export function getMarketingCampaignProgramTypeLabel(programType: MarketingCampaignProgramType) {
  if (programType === "platform_announcement") return "Platform announcement";
  if (programType === "onboarding_sequence") return "Onboarding sequence";
  if (programType === "newsletter") return "Newsletter";
  return "Product update";
}

export function getMarketingCampaignProgramBadgeTone(
  programType: MarketingCampaignProgramType
): "amber" | "blue" | "green" {
  if (programType === "platform_announcement") return "green";
  if (programType === "onboarding_sequence") return "blue";
  return "amber";
}

function resolveMarketingCampaignReadinessView(input: {
  lifecycleState: MarketingStatus;
  metadata?: Record<string, unknown>;
  metadataSummary: string;
  name: string;
  registryKey: string;
  slug: string;
  status: MarketingStatus;
}): MarketingCampaignReadinessView {
  const campaignIssues = listMarketingCampaignIssues({
    lifecycleState: input.lifecycleState,
    metadata: input.metadata,
    name: input.name,
    registryKey: input.registryKey,
    slug: input.slug,
    status: input.status
  });
  const campaignState = resolveMarketingCampaignState(campaignIssues, {
    lifecycleState: input.lifecycleState,
    status: input.status
  });

  return {
    campaignBadgeTone: getMarketingCampaignBadgeTone(campaignState),
    campaignDescription: getMarketingCampaignDescription(campaignState),
    campaignEngineStatus: "No campaign sender connected",
    campaignIssues,
    campaignLabel: getMarketingCampaignLabel(campaignState),
    campaignReady: campaignState === "campaign_ready",
    campaignState,
    campaignSummary: input.metadataSummary
  };
}

function resolveMarketingCampaignReadinessViewSafe(input: {
  lifecycleState: MarketingStatus;
  metadata?: Record<string, unknown>;
  metadataSummary: string;
  name: string;
  registryKey: string;
  slug: string;
  status: MarketingStatus;
}): MarketingCampaignReadinessView {
  try {
    return resolveMarketingCampaignReadinessView(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-campaign-runtime] campaign readiness view failed", error);

    return {
      campaignBadgeTone: "red",
      campaignDescription: getMarketingCampaignDescription("unknown"),
      campaignEngineStatus: "No campaign sender connected",
      campaignIssues: [
        {
          code: "campaign_runtime_error",
          message: message || "Campaign runtime failed safely.",
          severity: "blocker",
          stateHint: "unknown"
        }
      ],
      campaignLabel: getMarketingCampaignLabel("unknown"),
      campaignReady: false,
      campaignState: "unknown",
      campaignSummary: "Foundation campaign display only. No email sending or notification delivery."
    };
  }
}

function attachMarketingCampaignAudience(
  view: Omit<
    MarketingCampaignView,
    | keyof MarketingAudienceView
    | keyof MarketingCampaignReadinessView
    | keyof MarketingCampaignEmailView
    | keyof MarketingCampaignNotificationView
  > &
    Partial<MarketingAudienceView>,
  params: {
    metadata?: Record<string, unknown>;
    registryKey: string;
    targetAudience: string;
  }
): Omit<
  MarketingCampaignView,
  keyof MarketingCampaignReadinessView | keyof MarketingCampaignEmailView | keyof MarketingCampaignNotificationView
> &
  MarketingAudienceView {
  const audience = resolveMarketingAudienceView({
    marketingType: "campaign",
    metadata: params.metadata,
    registryKey: params.registryKey,
    targetAudience: params.targetAudience
  });

  return {
    ...view,
    ...audience
  };
}

function attachMarketingCampaignNotificationLayer(
  view: Omit<MarketingCampaignView, keyof MarketingCampaignNotificationView> &
    Partial<MarketingCampaignNotificationView> &
    MarketingAudienceView &
    MarketingCampaignReadinessView &
    MarketingCampaignEmailView,
  params: {
    metadata?: Record<string, unknown>;
    notificationSummaryRecord?: MarketingCampaignNotificationSummaryRecord | null;
  }
): MarketingCampaignView {
  const notification = resolveMarketingCampaignNotificationViewSafe({
    campaignReady: view.campaignReady,
    code: view.code,
    emailReady: view.emailReady,
    exists: true,
    lifecycleState: view.lifecycleState,
    marketingType: "campaign",
    metadata: params.metadata,
    metadataSummary: view.metadataSummary,
    notificationSummaryRecord: params.notificationSummaryRecord,
    registryKey: view.registryKey,
    slug: view.slug,
    status: view.status
  });

  return {
    ...view,
    ...notification
  };
}

function attachMarketingCampaignEmailLayer(
  view: Omit<
    MarketingCampaignView,
    keyof MarketingCampaignEmailView | keyof MarketingCampaignNotificationView
  > &
    Partial<MarketingCampaignEmailView> &
    MarketingAudienceView &
    MarketingCampaignReadinessView,
  params: {
    emailSummaryRecord?: MarketingCampaignEmailSummaryRecord | null;
    metadata?: Record<string, unknown>;
  }
): Omit<MarketingCampaignView, keyof MarketingCampaignNotificationView> &
  MarketingAudienceView &
  MarketingCampaignReadinessView &
  MarketingCampaignEmailView {
  const email = resolveMarketingCampaignEmailViewSafe({
    campaignReady: view.campaignReady,
    campaignState: view.campaignState,
    code: view.code,
    emailSummaryRecord: params.emailSummaryRecord,
    exists: true,
    lifecycleState: view.lifecycleState,
    marketingType: "campaign",
    metadata: params.metadata,
    metadataSummary: view.metadataSummary,
    registryKey: view.registryKey,
    slug: view.slug,
    status: view.status
  });

  return {
    ...view,
    ...email,
    deliveryStatus: email.emailEngineStatus
  };
}

function attachMarketingCampaignReadinessLayer(
  view: Omit<
    MarketingCampaignView,
    | keyof MarketingCampaignReadinessView
    | keyof MarketingCampaignEmailView
    | keyof MarketingCampaignNotificationView
  > &
    Partial<MarketingCampaignReadinessView> &
    MarketingAudienceView,
  params: {
    metadata?: Record<string, unknown>;
  }
): Omit<
  MarketingCampaignView,
  keyof MarketingCampaignEmailView | keyof MarketingCampaignNotificationView
> &
  MarketingAudienceView &
  MarketingCampaignReadinessView {
  const readiness = resolveMarketingCampaignReadinessViewSafe({
    lifecycleState: view.lifecycleState,
    metadata: params.metadata,
    metadataSummary: view.metadataSummary,
    name: view.name,
    registryKey: view.registryKey,
    slug: view.slug,
    status: view.status
  });

  return {
    ...view,
    ...readiness,
    deliveryStatus: readiness.campaignEngineStatus
  };
}

function toMarketingCampaignViewFromCampaign(
  campaign: MarketingCampaignCampaignSource & {
    description?: string;
    metadata?: Record<string, unknown>;
    slug?: string;
  },
  emailSummariesByRegistryKey: Map<string, MarketingCampaignEmailSummaryRecord> = new Map(),
  notificationSummariesByRegistryKey: Map<string, MarketingCampaignNotificationSummaryRecord> = new Map()
): MarketingCampaignView | null {
  if (campaign.type !== "campaign") {
    return null;
  }

  const metadata = safeRecord(campaign.metadata);
  const registryKey = text(campaign.id, 160);
  const slug = text(campaign.slug, 160) || registryKey.split(":").pop() || "campaign";
  const mapped = registryCampaignDisplayMap[registryKey];
  const status = parseMarketingStatus(campaign.status) ?? "draft";
  const lifecycleState = parseMarketingStatus(campaign.lifecycleState) ?? status;
  const description = sanitizeCampaignDisplayValue(
    campaign.description ?? metadataValue(metadata, ["description", "campaign_description"]),
    campaign.typeDescription || "Platform campaign foundation."
  );
  const campaignProgramType = parseMarketingCampaignProgramType(
    metadataValue(metadata, ["campaign_program_type", "program_type"]) || mapped?.campaignProgramType
  );

  return attachMarketingCampaignNotificationLayer(
    attachMarketingCampaignEmailLayer(
      attachMarketingCampaignReadinessLayer(
        attachMarketingCampaignAudience(
          {
            campaignProgramType,
            campaignTypeLabel: "Platform campaign",
            code: buildCampaignDisplayCode({ metadata, registryKey, slug }),
            deliveryStatus: "No campaign sender connected",
            description,
            endDateDisplay: sanitizeScheduleDisplay(campaign.endDate ?? metadata.end_date),
            lifecycleDescription:
              campaign.lifecycleDescription ?? getMarketingLifecycleDescription(lifecycleState),
            lifecycleLabel: campaign.lifecycleLabel ?? getMarketingLifecycleLabel(lifecycleState),
            lifecycleState,
            metadataSummary: buildMetadataSummary(metadata),
            name: sanitizeCampaignDisplayValue(campaign.name, "Marketing campaign"),
            registryKey,
            revenueImpact: Math.max(0, campaign.revenueImpact),
            slug,
            startDateDisplay: sanitizeScheduleDisplay(campaign.startDate ?? metadata.start_date),
            status,
            statusBadgeTone: campaign.statusBadgeTone ?? getMarketingStatusBadgeTone(status),
            statusDescription: campaign.statusDescription ?? getMarketingStatusDescription(status),
            statusLabel: campaign.statusLabel ?? getMarketingStatusLabel(status),
            targetAudienceSummary: sanitizeCampaignDisplayValue(
              campaign.targetAudienceSummary,
              campaign.audienceLabel || "Audience summary unavailable."
            ),
            usageCount: Math.max(0, Math.trunc(campaign.usage))
          },
          {
            metadata,
            registryKey,
            targetAudience: campaign.targetAudienceSummary || campaign.audienceLabel || ""
          }
        ),
        { metadata }
      ),
      {
        emailSummaryRecord: emailSummariesByRegistryKey.get(registryKey) ?? null,
        metadata
      }
    ),
    {
      notificationSummaryRecord: notificationSummariesByRegistryKey.get(registryKey) ?? null,
      metadata
    }
  );
}

function toMarketingCampaignViewFromRegistryItem(
  item: MarketingRegistryItemRecord,
  statusOverride?: MarketingStatus,
  emailSummariesByRegistryKey: Map<string, MarketingCampaignEmailSummaryRecord> = new Map(),
  notificationSummariesByRegistryKey: Map<string, MarketingCampaignNotificationSummaryRecord> = new Map()
): MarketingCampaignView | null {
  if (item.marketingType !== "campaign") {
    return null;
  }

  const status = statusOverride ?? item.status;

  return toMarketingCampaignViewFromCampaign({
    audienceLabel: "",
    description: item.description,
    endDate: text(item.metadata.end_date, 80) || null,
    id: item.registryKey,
    lifecycleState: status,
    metadata: item.metadata,
    name: item.name,
    revenueImpact: item.revenueImpact,
    slug: item.slug,
    startDate: text(item.metadata.start_date, 80) || null,
    status,
    statusBadgeTone: getMarketingStatusBadgeTone(status),
    statusDescription: getMarketingStatusDescription(status),
    statusLabel: getMarketingStatusLabel(status),
    targetAudienceSummary: item.targetAudience,
    type: item.marketingType,
    typeDescription: "Platform campaign foundation.",
    usage: item.usageCount
  }, emailSummariesByRegistryKey, notificationSummariesByRegistryKey);
}

const fallbackEmailSummariesByRegistryKey = new Map(
  MARKETING_CAMPAIGN_EMAIL_FALLBACK_SUMMARIES.map((summary) => [summary.registryKey, summary])
);
const fallbackNotificationSummariesByRegistryKey = new Map(
  MARKETING_CAMPAIGN_NOTIFICATION_FALLBACK_SUMMARIES.map((summary) => [summary.registryKey, summary])
);

export const MARKETING_CAMPAIGN_FALLBACK_VIEWS: readonly MarketingCampaignView[] = [
  attachMarketingCampaignNotificationLayer(
    attachMarketingCampaignEmailLayer(
      attachMarketingCampaignReadinessLayer(
        attachMarketingCampaignAudience(
      {
        campaignProgramType: "platform_announcement",
        campaignTypeLabel: "Platform campaign",
        code: "CAM-PLATFORM-ANNOUNCEMENTS",
        deliveryStatus: "No campaign sender connected",
        description: "Campaign foundation for platform-wide announcements.",
        endDateDisplay: null,
        lifecycleDescription: getMarketingLifecycleDescription("paused"),
        lifecycleLabel: getMarketingLifecycleLabel("paused"),
        lifecycleState: "paused",
        metadataSummary:
          "Foundation campaign display only. No email sending, notification delivery, or mass send integration.",
        name: "Platform Announcement Campaign",
        registryKey: "campaign:platform-announcements",
        revenueImpact: 0,
        slug: "platform-announcements",
        startDateDisplay: null,
        status: "paused",
        statusBadgeTone: "blue",
        statusDescription: getMarketingStatusDescription("paused"),
        statusLabel: getMarketingStatusLabel("paused"),
        targetAudienceSummary: "All SHASTORE platform users",
        usageCount: 0
      },
      {
        metadata: { section: "Campaigns", source: "marketing_registry_fallback" },
        registryKey: "campaign:platform-announcements",
        targetAudience: "All SHASTORE platform users"
      }
    ),
    {
      metadata: { section: "Campaigns", source: "marketing_registry_fallback" }
    }
    ),
    {
      emailSummaryRecord: fallbackEmailSummariesByRegistryKey.get("campaign:platform-announcements") ?? null,
      metadata: { section: "Campaigns", source: "marketing_registry_fallback" }
    }
    ),
    {
      notificationSummaryRecord:
        fallbackNotificationSummariesByRegistryKey.get("campaign:platform-announcements") ?? null,
      metadata: { section: "Campaigns", source: "marketing_registry_fallback" }
    }
  )
];

export function buildMarketingCampaignViewsFromCampaigns(
  campaigns: MarketingCampaignCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map(),
  emailSummariesByRegistryKey: Map<string, MarketingCampaignEmailSummaryRecord> = new Map(),
  notificationSummariesByRegistryKey: Map<string, MarketingCampaignNotificationSummaryRecord> = new Map()
): MarketingCampaignView[] {
  const views: MarketingCampaignView[] = [];

  for (const campaign of campaigns) {
    const campaignView = toMarketingCampaignViewFromCampaign({
      ...campaign,
      description: undefined,
      endDate: campaign.endDate,
      lifecycleDescription: campaign.lifecycleDescription,
      lifecycleLabel: campaign.lifecycleLabel,
      metadata: metadataByRegistryKey.get(campaign.id),
      slug: campaign.id.split(":").pop(),
      startDate: campaign.startDate
    }, emailSummariesByRegistryKey, notificationSummariesByRegistryKey);

    if (campaignView) {
      views.push(campaignView);
    }
  }

  if (!views.length) {
    return [...MARKETING_CAMPAIGN_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingCampaignViewsFromRegistryItems(
  items: MarketingRegistryItemRecord[],
  statusByRegistryKey: Map<string, MarketingStatus> = new Map(),
  emailSummariesByRegistryKey: Map<string, MarketingCampaignEmailSummaryRecord> = new Map(),
  notificationSummariesByRegistryKey: Map<string, MarketingCampaignNotificationSummaryRecord> = new Map()
): MarketingCampaignView[] {
  const views: MarketingCampaignView[] = [];

  for (const item of items) {
    const campaignView = toMarketingCampaignViewFromRegistryItem(
      item,
      statusByRegistryKey.get(item.registryKey) ?? item.status,
      emailSummariesByRegistryKey,
      notificationSummariesByRegistryKey
    );

    if (campaignView) {
      views.push(campaignView);
    }
  }

  if (!views.length) {
    return [...MARKETING_CAMPAIGN_FALLBACK_VIEWS];
  }

  return views;
}

export function buildMarketingCampaignViewsSafe(
  campaigns: MarketingCampaignCampaignSource[],
  metadataByRegistryKey: Map<string, Record<string, unknown>> = new Map(),
  emailSummariesByRegistryKey: Map<string, MarketingCampaignEmailSummaryRecord> = new Map(),
  notificationSummariesByRegistryKey: Map<string, MarketingCampaignNotificationSummaryRecord> = new Map()
): { platformCampaigns: MarketingCampaignView[]; warning: string | null } {
  try {
    return {
      platformCampaigns: buildMarketingCampaignViewsFromCampaigns(
        campaigns,
        metadataByRegistryKey,
        emailSummariesByRegistryKey,
        notificationSummariesByRegistryKey
      ),
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-campaign-runtime] campaign view build failed", error);

    return {
      platformCampaigns: [...MARKETING_CAMPAIGN_FALLBACK_VIEWS],
      warning: message
    };
  }
}
