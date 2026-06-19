import "server-only";

import {
  type MarketingCampaignState
} from "@/src/lib/marketing/marketing-campaign-runtime";
import {
  parseMarketingStatus,
  type MarketingStatus
} from "@/src/lib/marketing/marketing-status-runtime";
import { parseMarketingType, type MarketingType } from "@/src/lib/marketing/marketing-type-runtime";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingCampaignEmailSummaryStatus =
  | "disabled"
  | "foundation"
  | "placeholder"
  | "ready";

export type MarketingCampaignEmailState =
  | "email_disabled"
  | "email_ready"
  | "invalid"
  | "needs_review"
  | "unknown";

export type MarketingCampaignMassSendState =
  | "invalid"
  | "mass_send_disabled"
  | "mass_send_ready"
  | "needs_review"
  | "unknown";

export type MarketingCampaignEmailSource = "fallback" | "registry" | "summary_table";

export type MarketingCampaignEmailIssueSeverity = "blocker" | "review";

export type MarketingCampaignEmailIssue = {
  code: string;
  message: string;
  severity: MarketingCampaignEmailIssueSeverity;
  stateHint?: MarketingCampaignEmailState;
};

export type MarketingCampaignEmailSummaryRecord = {
  campaignCode: string;
  createdAt: string | null;
  emailStatus: MarketingCampaignEmailSummaryStatus;
  emailSubjectLabel: string;
  emailSummary: string;
  emailTemplateLabel: string;
  id: string;
  massSendStatus: MarketingCampaignEmailSummaryStatus;
  metadata: Record<string, unknown>;
  registryKey: string;
  senderLabel: string;
  updatedAt: string | null;
};

export type MarketingCampaignEmailView = {
  emailBadgeTone: "amber" | "blue" | "green" | "red";
  emailDescription: string;
  emailEngineStatus: string;
  emailIssues: MarketingCampaignEmailIssue[];
  emailLabel: string;
  emailReady: boolean;
  emailSource: MarketingCampaignEmailSource;
  emailState: MarketingCampaignEmailState;
  emailSubjectLabel: string;
  emailSummary: string;
  emailTemplateLabel: string;
  massSendBadgeTone: "amber" | "blue" | "green" | "red";
  massSendDescription: string;
  massSendLabel: string;
  massSendReady: boolean;
  massSendState: MarketingCampaignMassSendState;
  senderLabel: string;
};

export type MarketingCampaignEmailInput = {
  campaignReady?: boolean;
  campaignState?: unknown;
  code: string;
  emailSummaryRecord?: MarketingCampaignEmailSummaryRecord | null;
  exists?: boolean;
  lifecycleState?: unknown;
  marketingType: unknown;
  metadata?: unknown;
  metadataSummary?: unknown;
  registryKey: string;
  slug: string;
  status: unknown;
};

export const MARKETING_CAMPAIGN_EMAIL_SUMMARY_STATUSES: readonly MarketingCampaignEmailSummaryStatus[] = [
  "foundation",
  "disabled",
  "placeholder",
  "ready"
] as const;

export const MARKETING_CAMPAIGN_EMAIL_STATES: readonly MarketingCampaignEmailState[] = [
  "email_ready",
  "email_disabled",
  "needs_review",
  "invalid",
  "unknown"
] as const;

export const MARKETING_CAMPAIGN_MASS_SEND_STATES: readonly MarketingCampaignMassSendState[] = [
  "mass_send_ready",
  "mass_send_disabled",
  "needs_review",
  "invalid",
  "unknown"
] as const;

export const MARKETING_CAMPAIGN_EMAIL_FALLBACK_SUMMARIES: readonly MarketingCampaignEmailSummaryRecord[] = [
  {
    campaignCode: "CAM-PLATFORM-ANNOUNCEMENTS",
    createdAt: null,
    emailStatus: "foundation",
    emailSubjectLabel: "Platform announcement placeholder",
    emailSummary: "Foundation email readiness summary. No email sending or mass send integration.",
    emailTemplateLabel: "Platform announcement template placeholder",
    id: "fallback-campaign-email-platform-announcements",
    massSendStatus: "foundation",
    metadata: { source: "marketing_campaign_email_fallback" },
    registryKey: "campaign:platform-announcements",
    senderLabel: "SHASTORE Platform",
    updatedAt: null
  }
];

const emailSummarySelect =
  "id, registry_key, campaign_code, email_subject_label, email_template_label, sender_label, email_status, mass_send_status, email_summary, metadata, created_at, updated_at";

const secretPattern =
  /(api[_-]?key|secret|token|password|credential|smtp|sendgrid|mailgun|ses|resend|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|@[a-z0-9._%+-]+\.[a-z]{2,}|ip_address|device_fingerprint|session_id)/i;

const forbiddenMetadataKeyPattern =
  /^(api[_-]?key|secret|token|password|credential|smtp|sendgrid|mailgun|ses|resend|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key|ip_address|device_fingerprint|cookie|session_id|recipient|recipients|email_list|customer_list|provider_config)$/i;

const readyEmailStatuses = new Set<MarketingStatus>(["active"]);

const registryEmailDisplayMap: Record<
  string,
  Pick<MarketingCampaignEmailSummaryRecord, "emailSubjectLabel" | "emailTemplateLabel" | "senderLabel">
> = {
  "campaign:platform-announcements": {
    emailSubjectLabel: "Platform announcement placeholder",
    emailTemplateLabel: "Platform announcement template placeholder",
    senderLabel: "SHASTORE Platform"
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
    throw new Error("Service-role admin access is required for marketing campaign email summaries.");
  }

  return admin;
}

function sanitizeEmailDisplayValue(value: unknown, fallback: string) {
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

export function isValidMarketingCampaignEmailSummaryStatus(
  value: unknown
): value is MarketingCampaignEmailSummaryStatus {
  return (
    typeof value === "string" &&
    MARKETING_CAMPAIGN_EMAIL_SUMMARY_STATUSES.includes(value as MarketingCampaignEmailSummaryStatus)
  );
}

export function parseMarketingCampaignEmailSummaryStatus(
  value: unknown
): MarketingCampaignEmailSummaryStatus | null {
  const cleaned = text(value, 40).toLowerCase();
  return isValidMarketingCampaignEmailSummaryStatus(cleaned) ? cleaned : null;
}

export function parseMarketingCampaignEmailSummary(row: unknown): MarketingCampaignEmailSummaryRecord | null {
  if (!row || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  const id = text(record.id, 120);
  const registryKey = text(record.registry_key, 160);
  const emailStatus = parseMarketingCampaignEmailSummaryStatus(record.email_status);
  const massSendStatus = parseMarketingCampaignEmailSummaryStatus(record.mass_send_status);

  if (!id || !registryKey || !emailStatus || !massSendStatus) {
    return null;
  }

  const mapped = registryEmailDisplayMap[registryKey];

  return {
    campaignCode: sanitizeEmailDisplayValue(record.campaign_code, ""),
    createdAt: text(record.created_at, 80) || null,
    emailStatus,
    emailSubjectLabel: sanitizeEmailDisplayValue(
      record.email_subject_label,
      mapped?.emailSubjectLabel ?? "Email subject unavailable"
    ),
    emailSummary: sanitizeEmailDisplayValue(
      record.email_summary,
      "Email readiness foundation only. No sending records exposed."
    ),
    emailTemplateLabel: sanitizeEmailDisplayValue(
      record.email_template_label,
      mapped?.emailTemplateLabel ?? "Email template unavailable"
    ),
    id,
    massSendStatus,
    metadata: safeRecord(record.metadata) ?? {},
    registryKey,
    senderLabel: sanitizeEmailDisplayValue(record.sender_label, mapped?.senderLabel ?? "Sender unavailable"),
    updatedAt: text(record.updated_at, 80) || null
  };
}

function inspectEmailType(params: { marketingType: MarketingType | null }): MarketingCampaignEmailIssue[] {
  if (params.marketingType === "campaign") {
    return [];
  }

  return [
    {
      code: "campaign_email_type_mismatch",
      message: "Registry item is not a campaign and cannot be evaluated for email readiness.",
      severity: "blocker",
      stateHint: "invalid"
    }
  ];
}

function inspectEmailLifecycle(params: {
  lifecycleState: MarketingStatus | null;
  status: MarketingStatus | null;
}): MarketingCampaignEmailIssue[] {
  const issues: MarketingCampaignEmailIssue[] = [];

  if (params.status === "expired" || params.lifecycleState === "expired") {
    issues.push({
      code: "campaign_email_expired",
      message: "Campaign lifecycle is expired. Email readiness only; no sending occurs.",
      severity: "blocker",
      stateHint: "email_disabled"
    });
  }

  if (params.status === "paused" || params.lifecycleState === "paused") {
    issues.push({
      code: "campaign_email_paused",
      message: "Campaign is paused. Email readiness only; no sending occurs.",
      severity: "blocker",
      stateHint: "email_disabled"
    });
  }

  if (params.status === "archived" || params.lifecycleState === "archived") {
    issues.push({
      code: "campaign_email_archived",
      message: "Campaign is archived and email delivery is disabled.",
      severity: "blocker",
      stateHint: "email_disabled"
    });
  }

  if (params.status === "draft" || params.lifecycleState === "draft") {
    issues.push({
      code: "campaign_email_draft",
      message: "Campaign is still in draft and email delivery is disabled.",
      severity: "blocker",
      stateHint: "email_disabled"
    });
  }

  return issues;
}

function inspectEmailSummaryRecord(params: {
  summary: MarketingCampaignEmailSummaryRecord | null | undefined;
}): MarketingCampaignEmailIssue[] {
  if (!params.summary) {
    return [
      {
        code: "campaign_email_summary_missing",
        message: "Email summary is unavailable. Registry foundation only.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  if (params.summary.emailStatus === "disabled") {
    return [
      {
        code: "campaign_email_summary_disabled",
        message: "Email summary is marked disabled for readiness review.",
        severity: "blocker",
        stateHint: "email_disabled"
      }
    ];
  }

  if (params.summary.emailStatus === "foundation" || params.summary.emailStatus === "placeholder") {
    return [
      {
        code: "campaign_email_summary_foundation",
        message: "Email summary is a foundation placeholder. No sending or mass send occurs.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  return [];
}

const campaignStateValues = new Set<MarketingCampaignState>([
  "campaign_ready",
  "campaign_disabled",
  "needs_review",
  "invalid",
  "unknown"
]);

function parseCampaignState(value: unknown): MarketingCampaignState | null {
  if (typeof value === "string" && campaignStateValues.has(value as MarketingCampaignState)) {
    return value as MarketingCampaignState;
  }

  return null;
}

function inspectEmailCampaignReadiness(params: {
  campaignReady: boolean;
  campaignState: MarketingCampaignState | null;
}): MarketingCampaignEmailIssue[] {
  if (params.campaignState === "invalid" || params.campaignState === "unknown") {
    return [
      {
        code: "campaign_email_campaign_unready",
        message: "Campaign readiness is not confirmed for email readiness.",
        severity: "review",
        stateHint: "needs_review"
      }
    ];
  }

  if (params.campaignState === "campaign_disabled" && !params.campaignReady) {
    return [
      {
        code: "campaign_email_campaign_disabled",
        message: "Campaign is disabled, so email readiness remains blocked.",
        severity: "blocker",
        stateHint: "email_disabled"
      }
    ];
  }

  return [];
}

function inspectEmailMetadata(metadata: unknown): MarketingCampaignEmailIssue[] {
  const issues: MarketingCampaignEmailIssue[] = [];
  const record = safeRecord(metadata);

  if (record === null) {
    issues.push({
      code: "campaign_email_metadata_malformed",
      message: "Campaign public metadata must be a safe object. No email sending is performed.",
      severity: "blocker",
      stateHint: "invalid"
    });
    return issues;
  }

  for (const [key, value] of Object.entries(record)) {
    const cleanedKey = text(key, 120);

    if (!cleanedKey || forbiddenMetadataKeyPattern.test(cleanedKey)) {
      issues.push({
        code: "campaign_email_metadata_forbidden_key",
        message: "Campaign metadata contains a restricted public key and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
      continue;
    }

    if (typeof value === "object" && value !== null) {
      issues.push({
        code: "campaign_email_metadata_nested_value",
        message: "Campaign metadata contains nested values that are not display-safe yet.",
        severity: "review",
        stateHint: "needs_review"
      });
      continue;
    }

    const cleanedValue = text(value, 240);

    if (cleanedValue && secretPattern.test(cleanedValue)) {
      issues.push({
        code: "campaign_email_metadata_secret_value",
        message: "Campaign metadata contains restricted content and requires review.",
        severity: "blocker",
        stateHint: "needs_review"
      });
    }
  }

  return issues;
}

export function listMarketingCampaignEmailIssues(input: MarketingCampaignEmailInput): MarketingCampaignEmailIssue[] {
  const marketingType = parseMarketingType(input.marketingType);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;
  const campaignState = parseCampaignState(input.campaignState);

  return [
    ...inspectEmailType({ marketingType }),
    ...inspectEmailLifecycle({ lifecycleState, status }),
    ...inspectEmailSummaryRecord({ summary: input.emailSummaryRecord }),
    ...inspectEmailCampaignReadiness({
      campaignReady: input.campaignReady === true,
      campaignState
    }),
    ...inspectEmailMetadata(input.metadata)
  ];
}

function pickEmailStateHintFromIssues(issues: MarketingCampaignEmailIssue[]): MarketingCampaignEmailState | null {
  const priority: MarketingCampaignEmailState[] = [
    "unknown",
    "invalid",
    "email_disabled",
    "needs_review"
  ];

  for (const state of priority) {
    if (issues.some((issue) => issue.stateHint === state)) {
      return state;
    }
  }

  return null;
}

export function resolveMarketingCampaignEmailState(
  issues: MarketingCampaignEmailIssue[],
  params: {
    campaignReady: boolean;
    lifecycleState: MarketingStatus | null;
    status: MarketingStatus | null;
    summary: MarketingCampaignEmailSummaryRecord | null | undefined;
  }
): MarketingCampaignEmailState {
  const hintedState = pickEmailStateHintFromIssues(issues);

  if (hintedState) {
    return hintedState;
  }

  if (issues.some((issue) => issue.severity === "review")) {
    return "needs_review";
  }

  if (
    params.summary?.emailStatus === "ready" &&
    params.campaignReady &&
    params.status &&
    readyEmailStatuses.has(params.status) &&
    (!params.lifecycleState || params.lifecycleState === "active")
  ) {
    return "email_ready";
  }

  return "unknown";
}

export function resolveMarketingCampaignMassSendState(
  issues: MarketingCampaignEmailIssue[],
  params: {
    emailState: MarketingCampaignEmailState;
    summary: MarketingCampaignEmailSummaryRecord | null | undefined;
  }
): MarketingCampaignMassSendState {
  if (params.emailState === "invalid") return "invalid";
  if (params.emailState === "unknown") return "unknown";
  if (params.emailState === "email_disabled") return "mass_send_disabled";
  if (params.emailState === "needs_review") return "needs_review";

  if (!params.summary) {
    return "needs_review";
  }

  if (params.summary.massSendStatus === "disabled") {
    return "mass_send_disabled";
  }

  if (params.summary.massSendStatus === "foundation" || params.summary.massSendStatus === "placeholder") {
    return "needs_review";
  }

  if (params.summary.massSendStatus === "ready" && params.emailState === "email_ready") {
    return "mass_send_ready";
  }

  if (issues.some((issue) => issue.severity === "review")) {
    return "needs_review";
  }

  return "unknown";
}

export function resolveMarketingCampaignEmailSubjectLabel(input: MarketingCampaignEmailInput) {
  const registryKey = text(input.registryKey, 160);
  const metadata = safeRecord(input.metadata) ?? {};
  const mapped = registryEmailDisplayMap[registryKey];

  return sanitizeEmailDisplayValue(
    input.emailSummaryRecord?.emailSubjectLabel ??
      metadataValue(metadata, ["email_subject_label", "email_subject", "subject_label"]) ??
      mapped?.emailSubjectLabel,
    "Email subject unavailable"
  );
}

export function resolveMarketingCampaignEmailTemplateLabel(input: MarketingCampaignEmailInput) {
  const registryKey = text(input.registryKey, 160);
  const metadata = safeRecord(input.metadata) ?? {};
  const mapped = registryEmailDisplayMap[registryKey];

  return sanitizeEmailDisplayValue(
    input.emailSummaryRecord?.emailTemplateLabel ??
      metadataValue(metadata, ["email_template_label", "email_template", "template_label"]) ??
      mapped?.emailTemplateLabel,
    "Email template unavailable"
  );
}

export function resolveMarketingCampaignEmailSenderLabel(input: MarketingCampaignEmailInput) {
  const registryKey = text(input.registryKey, 160);
  const metadata = safeRecord(input.metadata) ?? {};
  const mapped = registryEmailDisplayMap[registryKey];

  return sanitizeEmailDisplayValue(
    input.emailSummaryRecord?.senderLabel ??
      metadataValue(metadata, ["sender_label", "from_label", "sender_display"]) ??
      mapped?.senderLabel,
    "Sender unavailable"
  );
}

export function resolveMarketingCampaignEmailSummaryText(input: MarketingCampaignEmailInput) {
  if (input.emailSummaryRecord?.emailSummary) {
    return input.emailSummaryRecord.emailSummary;
  }

  return sanitizeEmailDisplayValue(
    input.metadataSummary,
    "Email readiness foundation only. No sending records exposed."
  );
}

export function resolveMarketingCampaignEmailSource(
  input: MarketingCampaignEmailInput
): MarketingCampaignEmailSource {
  if (input.emailSummaryRecord?.metadata.source === "marketing_campaign_email_fallback") {
    return "fallback";
  }

  if (input.emailSummaryRecord) {
    return "summary_table";
  }

  return "registry";
}

export function getMarketingCampaignEmailLabel(state: MarketingCampaignEmailState) {
  if (state === "email_ready") return "Email ready";
  if (state === "email_disabled") return "Email disabled";
  if (state === "needs_review") return "Needs review";
  if (state === "invalid") return "Invalid";
  return "Unknown";
}

export function getMarketingCampaignEmailDescription(state: MarketingCampaignEmailState) {
  if (state === "email_ready") {
    return "Campaign passed email-readiness checks. No email sending, provider integration, or mass send yet.";
  }

  if (state === "email_disabled") {
    return "Email is disabled in the current lifecycle state. Email readiness only.";
  }

  if (state === "needs_review") {
    return "Campaign is display-safe but requires Super Admin review before future email phases.";
  }

  if (state === "invalid") {
    return "Email display data failed readiness checks. No email jobs are created.";
  }

  return "Email readiness could not be classified safely.";
}

export function getMarketingCampaignEmailBadgeTone(
  state: MarketingCampaignEmailState
): MarketingCampaignEmailView["emailBadgeTone"] {
  if (state === "email_ready") return "green";
  if (state === "needs_review") return "amber";
  if (state === "email_disabled") return "blue";
  if (state === "invalid") return "red";
  return "amber";
}

export function getMarketingCampaignMassSendLabel(state: MarketingCampaignMassSendState) {
  if (state === "mass_send_ready") return "Mass send ready";
  if (state === "mass_send_disabled") return "Mass send disabled";
  if (state === "needs_review") return "Needs review";
  if (state === "invalid") return "Invalid";
  return "Unknown";
}

export function getMarketingCampaignMassSendDescription(state: MarketingCampaignMassSendState) {
  if (state === "mass_send_ready") {
    return "Mass send readiness checks passed. No mass send execution or provider integration yet.";
  }

  if (state === "mass_send_disabled") {
    return "Mass send is disabled. Readiness foundation only.";
  }

  if (state === "needs_review") {
    return "Mass send requires Super Admin review before future phases.";
  }

  if (state === "invalid") {
    return "Mass send readiness failed checks. No mass send records are created.";
  }

  return "Mass send readiness could not be classified safely.";
}

export function getMarketingCampaignMassSendBadgeTone(
  state: MarketingCampaignMassSendState
): MarketingCampaignEmailView["massSendBadgeTone"] {
  if (state === "mass_send_ready") return "green";
  if (state === "needs_review") return "amber";
  if (state === "mass_send_disabled") return "blue";
  if (state === "invalid") return "red";
  return "amber";
}

export function resolveMarketingCampaignEmailView(input: MarketingCampaignEmailInput): MarketingCampaignEmailView {
  const emailIssues = listMarketingCampaignEmailIssues(input);
  const status = parseMarketingStatus(input.status);
  const lifecycleState = parseMarketingStatus(input.lifecycleState) ?? status;
  const emailState = resolveMarketingCampaignEmailState(emailIssues, {
    campaignReady: input.campaignReady === true,
    lifecycleState,
    status,
    summary: input.emailSummaryRecord
  });
  const massSendState = resolveMarketingCampaignMassSendState(emailIssues, {
    emailState,
    summary: input.emailSummaryRecord
  });

  return {
    emailBadgeTone: getMarketingCampaignEmailBadgeTone(emailState),
    emailDescription: getMarketingCampaignEmailDescription(emailState),
    emailEngineStatus: "No email provider connected",
    emailIssues,
    emailLabel: getMarketingCampaignEmailLabel(emailState),
    emailReady: emailState === "email_ready",
    emailSource: resolveMarketingCampaignEmailSource(input),
    emailState,
    emailSubjectLabel: resolveMarketingCampaignEmailSubjectLabel(input),
    emailSummary: resolveMarketingCampaignEmailSummaryText(input),
    emailTemplateLabel: resolveMarketingCampaignEmailTemplateLabel(input),
    massSendBadgeTone: getMarketingCampaignMassSendBadgeTone(massSendState),
    massSendDescription: getMarketingCampaignMassSendDescription(massSendState),
    massSendLabel: getMarketingCampaignMassSendLabel(massSendState),
    massSendReady: massSendState === "mass_send_ready",
    massSendState,
    senderLabel: resolveMarketingCampaignEmailSenderLabel(input)
  };
}

export function resolveMarketingCampaignEmailViewSafe(
  input: MarketingCampaignEmailInput
): MarketingCampaignEmailView {
  try {
    return resolveMarketingCampaignEmailView(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-campaign-email-runtime] email view failed", error);

    return {
      emailBadgeTone: "red",
      emailDescription: getMarketingCampaignEmailDescription("unknown"),
      emailEngineStatus: "No email provider connected",
      emailIssues: [
        {
          code: "campaign_email_runtime_error",
          message: message || "Campaign email runtime failed safely.",
          severity: "blocker",
          stateHint: "unknown"
        }
      ],
      emailLabel: getMarketingCampaignEmailLabel("unknown"),
      emailReady: false,
      emailSource: "registry",
      emailState: "unknown",
      emailSubjectLabel: "Email subject unavailable",
      emailSummary: "Email readiness foundation only. No sending records exposed.",
      emailTemplateLabel: "Email template unavailable",
      massSendBadgeTone: "red",
      massSendDescription: getMarketingCampaignMassSendDescription("unknown"),
      massSendLabel: getMarketingCampaignMassSendLabel("unknown"),
      massSendReady: false,
      massSendState: "unknown",
      senderLabel: "Sender unavailable"
    };
  }
}

export function isMarketingCampaignEmailReady(input: MarketingCampaignEmailInput) {
  return resolveMarketingCampaignEmailViewSafe(input).emailReady;
}

export function isValidMarketingCampaignEmailState(
  value: unknown
): value is MarketingCampaignEmailState {
  return typeof value === "string" && MARKETING_CAMPAIGN_EMAIL_STATES.includes(value as MarketingCampaignEmailState);
}

export function isValidMarketingCampaignMassSendState(
  value: unknown
): value is MarketingCampaignMassSendState {
  return (
    typeof value === "string" &&
    MARKETING_CAMPAIGN_MASS_SEND_STATES.includes(value as MarketingCampaignMassSendState)
  );
}

export function indexMarketingCampaignEmailSummariesByRegistryKey(
  summaries: MarketingCampaignEmailSummaryRecord[]
): Map<string, MarketingCampaignEmailSummaryRecord> {
  return new Map(summaries.map((summary) => [summary.registryKey, summary]));
}

export async function listMarketingCampaignEmailSummariesReadOnly(): Promise<
  MarketingCampaignEmailSummaryRecord[]
> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketing_campaign_email_summaries" as never)
    .select(emailSummarySelect as never)
    .order("updated_at" as never, { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Marketing campaign email summaries could not be listed: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketingCampaignEmailSummary(row))
    .filter((summary): summary is MarketingCampaignEmailSummaryRecord => Boolean(summary));
}

export async function listMarketingCampaignEmailSummariesReadOnlySafe(): Promise<{
  source: "database" | "fallback";
  summaries: MarketingCampaignEmailSummaryRecord[];
  warning: string | null;
}> {
  try {
    const summaries = await listMarketingCampaignEmailSummariesReadOnly();

    if (!summaries.length) {
      return {
        source: "fallback",
        summaries: [...MARKETING_CAMPAIGN_EMAIL_FALLBACK_SUMMARIES],
        warning: "Marketing campaign email summary table is empty. Showing fallback email rows."
      };
    }

    return {
      source: "database",
      summaries,
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketing-campaign-email-runtime] read-only email summary load failed", error);

    return {
      source: "fallback",
      summaries: [...MARKETING_CAMPAIGN_EMAIL_FALLBACK_SUMMARIES],
      warning: message
    };
  }
}
