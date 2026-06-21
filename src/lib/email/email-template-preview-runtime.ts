import "server-only";

import type { EmailTemplateRegistryRecord } from "@/src/lib/email/email-template-registry-runtime";
import type { EmailTemplateCategory } from "@/src/lib/email/email-template-category-runtime";
import type { EmailRegistryStatus } from "@/src/lib/email/email-status-runtime";
import { resolveEmailTemplateVersionStateSafe } from "@/src/lib/email/email-template-version-runtime";

export type EmailTemplatePreviewState =
  | "invalid"
  | "needs_review"
  | "placeholder"
  | "preview_ready"
  | "preview_unavailable"
  | "unknown";

export type EmailTemplatePreviewBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type EmailTemplatePreviewRecord = {
  bodyPreviewSummary: string | null;
  metadataSummary: string;
  previewLabel: string;
  previewState: EmailTemplatePreviewState;
  previewStateLabel: string;
  subjectPreview: string | null;
  templateKey: string;
  variablePlaceholdersSummary: string | null;
};

export type EmailTemplatePreviewStats = {
  invalidTemplates: number;
  needsReviewTemplates: number;
  placeholderTemplates: number;
  previewReadyTemplates: number;
  previewUnavailableTemplates: number;
  totalTemplates: number;
  unknownTemplates: number;
};

export type EmailTemplatePreviewSource = {
  category?: EmailTemplateCategory;
  description?: string;
  metadata?: Record<string, unknown>;
  metadataSummary?: string;
  name?: string;
  registryStatus?: EmailRegistryStatus;
  status?: "active" | "disabled" | "draft";
  templateKey?: string;
};

export const EMAIL_TEMPLATE_PREVIEW_STATES: readonly EmailTemplatePreviewState[] = [
  "preview_ready",
  "preview_unavailable",
  "needs_review",
  "invalid",
  "placeholder",
  "unknown"
] as const;

const previewStateLabels: Record<EmailTemplatePreviewState, string> = {
  invalid: "Invalid preview foundation",
  needs_review: "Preview needs review",
  placeholder: "Preview placeholder",
  preview_ready: "Preview ready",
  preview_unavailable: "Preview unavailable",
  unknown: "Unknown preview state"
};

const previewStateDescriptions: Record<EmailTemplatePreviewState, string> = {
  invalid: "Template preview foundation could not be resolved safely.",
  needs_review: "Template preview requires admin review. No preview rendering connected.",
  placeholder: "Reserved preview placeholder foundation only. No HTML rendering connected.",
  preview_ready: "Safe preview summary is available. No live preview rendering connected.",
  preview_unavailable: "Preview summary is not available for this template foundation state.",
  unknown: "Template preview state could not be resolved safely."
};

const badgeToneByPreviewState: Record<EmailTemplatePreviewState, EmailTemplatePreviewBadgeTone> = {
  invalid: "red",
  needs_review: "amber",
  placeholder: "slate",
  preview_ready: "green",
  preview_unavailable: "amber",
  unknown: "red"
};

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|provider[_-]?config|@[a-z0-9.-]+\.[a-z]{2,})/i;

const variablePlaceholdersByCategory: Record<EmailTemplateCategory, string> = {
  billing: "{{plan_name}}, {{billing_status}}, {{platform_name}} placeholders only.",
  domain_email_setup: "{{domain_name}}, {{setup_step}}, {{platform_name}} placeholders only.",
  order: "{{order_id}}, {{receipt_summary}}, {{platform_name}} placeholders only.",
  security: "{{alert_type}}, {{account_reference}}, {{platform_name}} placeholders only.",
  support: "{{ticket_id}}, {{ticket_status}}, {{platform_name}} placeholders only.",
  welcome: "{{platform_name}}, {{user_name}} placeholders only."
};

const defaultSubjectByCategory: Partial<Record<EmailTemplateCategory, string>> = {
  billing: "Billing notification preview foundation",
  domain_email_setup: "Domain and email setup preview foundation",
  order: "Order receipt preview foundation",
  security: "Security alert preview foundation",
  support: "Support update preview foundation",
  welcome: "Welcome email preview foundation"
};

const defaultBodySummaryByCategory: Record<EmailTemplateCategory, string> = {
  billing: "Billing notification email foundation summary. Variable placeholders only. No HTML rendering connected.",
  domain_email_setup: "Domain and email setup instruction foundation summary. Variable placeholders only.",
  order: "Order receipt placeholder foundation summary. Variable placeholders only.",
  security: "Security alert notification foundation summary. Variable placeholders only.",
  support: "Support ticket update foundation summary. Variable placeholders only.",
  welcome: "Platform welcome onboarding foundation summary. Variable placeholders only."
};

function text(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safePreviewText(value: unknown, maxLength = 240) {
  const cleaned = text(value, maxLength);
  if (!cleaned || secretPattern.test(cleaned)) return null;
  return cleaned;
}

export function isValidEmailTemplatePreviewState(value: unknown): value is EmailTemplatePreviewState {
  return typeof value === "string" && EMAIL_TEMPLATE_PREVIEW_STATES.includes(value as EmailTemplatePreviewState);
}

export function parseEmailTemplatePreviewState(value: unknown): EmailTemplatePreviewState | null {
  const cleaned = text(value, 80);
  return isValidEmailTemplatePreviewState(cleaned) ? cleaned : null;
}

export function getEmailTemplatePreviewStateLabel(state: EmailTemplatePreviewState) {
  return previewStateLabels[state];
}

export function getEmailTemplatePreviewStateDescription(state: EmailTemplatePreviewState) {
  return previewStateDescriptions[state];
}

export function getEmailTemplatePreviewBadgeTone(state: EmailTemplatePreviewState): EmailTemplatePreviewBadgeTone {
  return badgeToneByPreviewState[state];
}

export function sanitizeEmailTemplatePreviewContent(value: unknown, maxLength = 240) {
  return safePreviewText(value, maxLength);
}

export function resolveEmailTemplatePreviewStateSafe(source: EmailTemplatePreviewSource): EmailTemplatePreviewState {
  const templateKey = text(source.templateKey, 160);

  if (!templateKey) {
    return "invalid";
  }

  if (source.status === "disabled") {
    return "needs_review";
  }

  const versionState = resolveEmailTemplateVersionStateSafe({
    registryStatus: source.registryStatus,
    status: source.status,
    templateKey
  });

  if (
    versionState === "unversioned" ||
    source.registryStatus === "placeholder" ||
    /placeholder/i.test(text(source.name, 200)) ||
    /placeholder/i.test(templateKey)
  ) {
    return "placeholder";
  }

  if (source.status === "draft") {
    return "preview_unavailable";
  }

  if (source.status === "active") {
    return "preview_ready";
  }

  return "unknown";
}

export function resolveEmailTemplatePreviewLabelSafe(source: EmailTemplatePreviewSource) {
  const name = text(source.name, 200);
  return name ? `${name} preview foundation` : "Email template preview foundation";
}

export function resolveEmailTemplateSubjectPreviewSafe(source: EmailTemplatePreviewSource) {
  const metadata = source.metadata ?? {};
  const fromMetadata =
    safePreviewText(metadata.preview_subject, 160) ??
    safePreviewText(metadata.subject_preview, 160) ??
    safePreviewText(metadata.subject, 160);

  if (fromMetadata) {
    return fromMetadata;
  }

  const name = text(source.name, 200);
  if (name) {
    return `${name} — preview foundation`;
  }

  if (source.category) {
    return defaultSubjectByCategory[source.category] ?? null;
  }

  return null;
}

export function resolveEmailTemplateBodyPreviewSummarySafe(source: EmailTemplatePreviewSource) {
  const metadata = source.metadata ?? {};
  const fromMetadata =
    safePreviewText(metadata.body_preview_summary, 240) ??
    safePreviewText(metadata.preview_body_summary, 240) ??
    safePreviewText(metadata.preview_summary, 240);

  if (fromMetadata) {
    return fromMetadata;
  }

  if (source.description) {
    const cleanedDescription = safePreviewText(source.description, 240);
    if (cleanedDescription) {
      return `${cleanedDescription} Preview summary only. No HTML rendering connected.`;
    }
  }

  if (source.category) {
    return defaultBodySummaryByCategory[source.category];
  }

  return null;
}

export function resolveEmailTemplateVariablePlaceholdersSummarySafe(source: EmailTemplatePreviewSource) {
  const metadata = source.metadata ?? {};
  const fromMetadata =
    safePreviewText(metadata.variable_placeholders_summary, 240) ??
    safePreviewText(metadata.preview_variables, 240);

  if (fromMetadata) {
    return fromMetadata;
  }

  if (source.category) {
    return variablePlaceholdersByCategory[source.category];
  }

  return "{{platform_name}} placeholder only.";
}

export function buildEmailTemplatePreviewRecordSafe(
  record: EmailTemplateRegistryRecord | EmailTemplatePreviewSource
): EmailTemplatePreviewRecord | null {
  try {
    const templateKey = text(
      "templateKey" in record && record.templateKey
        ? record.templateKey
        : "id" in record
          ? record.id
          : "",
      160
    );

    if (!templateKey) {
      return null;
    }

    const source: EmailTemplatePreviewSource = {
      category: "category" in record ? record.category : undefined,
      description: "description" in record ? record.description : undefined,
      metadata: "metadata" in record && record.metadata ? (record.metadata as Record<string, unknown>) : undefined,
      metadataSummary: "metadataSummary" in record ? record.metadataSummary : undefined,
      name: "name" in record ? record.name : undefined,
      registryStatus: "registryStatus" in record ? record.registryStatus : undefined,
      status: "status" in record ? record.status : undefined,
      templateKey
    };

    const previewState = resolveEmailTemplatePreviewStateSafe(source);
    const subjectPreview = resolveEmailTemplateSubjectPreviewSafe(source);
    const bodyPreviewSummary = resolveEmailTemplateBodyPreviewSummarySafe(source);
    const variablePlaceholdersSummary = resolveEmailTemplateVariablePlaceholdersSummarySafe(source);

    return {
      bodyPreviewSummary:
        previewState === "preview_unavailable" || previewState === "invalid" ? null : bodyPreviewSummary,
      metadataSummary:
        text(source.metadataSummary, 500) || getEmailTemplatePreviewStateDescription(previewState),
      previewLabel: resolveEmailTemplatePreviewLabelSafe(source),
      previewState,
      previewStateLabel: getEmailTemplatePreviewStateLabel(previewState),
      subjectPreview:
        previewState === "preview_unavailable" || previewState === "invalid" ? null : subjectPreview,
      templateKey,
      variablePlaceholdersSummary:
        previewState === "preview_unavailable" || previewState === "invalid"
          ? null
          : variablePlaceholdersSummary
    };
  } catch (error) {
    console.error("[email-template-preview-runtime] template preview record build failed", error);
    return null;
  }
}

export function buildEmailTemplatePreviewRecordsSafe(
  records: EmailTemplateRegistryRecord[] | null | undefined
): EmailTemplatePreviewRecord[] {
  try {
    return (Array.isArray(records) ? records : [])
      .map((record) => buildEmailTemplatePreviewRecordSafe(record))
      .filter((record): record is EmailTemplatePreviewRecord => Boolean(record));
  } catch (error) {
    console.error("[email-template-preview-runtime] template preview records build failed", error);
    return [];
  }
}

export function buildEmailTemplatePreviewStatsSafe(
  records: EmailTemplateRegistryRecord[] | null | undefined
): EmailTemplatePreviewStats {
  try {
    const previewRecords = buildEmailTemplatePreviewRecordsSafe(records);

    return {
      invalidTemplates: previewRecords.filter((record) => record.previewState === "invalid").length,
      needsReviewTemplates: previewRecords.filter((record) => record.previewState === "needs_review").length,
      placeholderTemplates: previewRecords.filter((record) => record.previewState === "placeholder").length,
      previewReadyTemplates: previewRecords.filter((record) => record.previewState === "preview_ready").length,
      previewUnavailableTemplates: previewRecords.filter((record) => record.previewState === "preview_unavailable")
        .length,
      totalTemplates: previewRecords.length,
      unknownTemplates: previewRecords.filter((record) => record.previewState === "unknown").length
    };
  } catch (error) {
    console.error("[email-template-preview-runtime] template preview stats build failed", error);

    return {
      invalidTemplates: 0,
      needsReviewTemplates: 0,
      placeholderTemplates: 0,
      previewReadyTemplates: 0,
      previewUnavailableTemplates: 0,
      totalTemplates: 0,
      unknownTemplates: 0
    };
  }
}

export function listEmailTemplatePreviewCatalog() {
  return EMAIL_TEMPLATE_PREVIEW_STATES.map((previewState) => ({
    badgeTone: getEmailTemplatePreviewBadgeTone(previewState),
    description: getEmailTemplatePreviewStateDescription(previewState),
    label: getEmailTemplatePreviewStateLabel(previewState),
    previewState
  }));
}
