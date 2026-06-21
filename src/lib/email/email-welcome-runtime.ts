import "server-only";

import { filterEmailRegistryItemsByType } from "@/src/lib/email/email-type-runtime";
import {
  resolveEmailProviderStatusSafe,
  type EmailProviderKey
} from "@/src/lib/email/email-provider-runtime";
import {
  buildEmailTemplateRegistryRecordsSafe,
  type EmailTemplateRegistryItem,
  type EmailTemplateRegistryRecord
} from "@/src/lib/email/email-template-registry-runtime";
import {
  buildEmailTemplatePreviewRecordsSafe,
  getEmailTemplatePreviewStateLabel,
  type EmailTemplatePreviewRecord,
  type EmailTemplatePreviewState
} from "@/src/lib/email/email-template-preview-runtime";
import type { EmailTemplateDisplayStatus } from "@/src/lib/email/email-status-runtime";
import {
  buildEmailTemplateValidationRecordsSafe,
  getEmailTemplateValidationStateLabel,
  type EmailTemplateValidationRecord,
  type EmailTemplateValidationState
} from "@/src/lib/email/email-template-validation-runtime";
import {
  buildEmailTemplateVersionRecordsSafe,
  getEmailTemplateVersionStateLabel,
  type EmailTemplateVersionRecord,
  type EmailTemplateVersionState
} from "@/src/lib/email/email-template-version-runtime";

export type EmailWelcomeReadinessState =
  | "draft"
  | "invalid"
  | "missing_provider"
  | "missing_template"
  | "needs_review"
  | "placeholder"
  | "ready"
  | "unknown";

export type EmailWelcomeEmailRecord = {
  metadataSummary: string;
  name: string;
  previewState: EmailTemplatePreviewState | "unknown";
  previewStateLabel: string;
  providerKey: EmailProviderKey | null;
  readinessState: EmailWelcomeReadinessState;
  readinessStateLabel: string;
  status: EmailTemplateDisplayStatus;
  templateCategory: "welcome";
  templateKey: string;
  validationState: EmailTemplateValidationState | "unknown";
  validationStateLabel: string;
  versionState: EmailTemplateVersionState | "unknown";
  versionStateLabel: string;
};

export type EmailWelcomeEmailStats = {
  draftWelcomeEmails: number;
  invalidWelcomeEmails: number;
  missingProviderWelcomeEmails: number;
  missingTemplateWelcomeEmails: number;
  needsReviewWelcomeEmails: number;
  placeholderWelcomeEmails: number;
  readyWelcomeEmails: number;
  totalWelcomeEmails: number;
  unknownWelcomeEmails: number;
};

export const EMAIL_WELCOME_READINESS_STATES: readonly EmailWelcomeReadinessState[] = [
  "ready",
  "draft",
  "needs_review",
  "invalid",
  "missing_template",
  "missing_provider",
  "placeholder",
  "unknown"
] as const;

const readinessStateLabels: Record<EmailWelcomeReadinessState, string> = {
  draft: "Draft welcome email",
  invalid: "Invalid welcome email foundation",
  missing_provider: "Missing provider readiness",
  missing_template: "Missing welcome template",
  needs_review: "Welcome email needs review",
  placeholder: "Welcome email placeholder",
  ready: "Welcome email ready",
  unknown: "Unknown welcome email readiness"
};

const readinessStateDescriptions: Record<EmailWelcomeReadinessState, string> = {
  draft: "Welcome email template is in draft foundation state. No welcome email sending connected.",
  invalid: "Welcome email foundation could not be validated safely.",
  missing_provider: "Platform email provider is not configured for welcome email readiness.",
  missing_template: "No welcome email template foundation was found in the registry.",
  needs_review: "Welcome email foundation requires admin review. No sending connected.",
  placeholder: "Welcome email placeholder foundation only. No execution connected.",
  ready: "Welcome email readiness foundation looks complete. No welcome email sending connected.",
  unknown: "Welcome email readiness could not be resolved safely."
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

function resolvePlatformProviderReady() {
  const resendStatus = resolveEmailProviderStatusSafe("resend");
  return resendStatus.configurationStatus === "configured" && resendStatus.healthStatus === "healthy";
}

export function getEmailWelcomeReadinessStateLabel(state: EmailWelcomeReadinessState) {
  return readinessStateLabels[state];
}

export function getEmailWelcomeReadinessStateDescription(state: EmailWelcomeReadinessState) {
  return readinessStateDescriptions[state];
}

export function resolveEmailWelcomeReadinessStateSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailWelcomeReadinessState {
  const { preview, providerReady, registry, validation, version } = params;

  if (/placeholder/i.test(registry.name) || /placeholder/i.test(registry.templateKey)) {
    return "placeholder";
  }

  if (validation?.validationState === "invalid") {
    return "invalid";
  }

  if (
    registry.status === "disabled" ||
    validation?.validationState === "needs_review" ||
    preview?.previewState === "needs_review" ||
    version?.versionState === "needs_review"
  ) {
    return "needs_review";
  }

  if (registry.status === "draft" || preview?.previewState === "preview_unavailable") {
    return "draft";
  }

  if (!providerReady) {
    return "missing_provider";
  }

  if (validation?.validationState === "valid" && registry.status === "active") {
    return "ready";
  }

  if (preview?.previewState === "preview_ready" && registry.status === "active" && providerReady) {
    return "ready";
  }

  if (validation?.validationState === "placeholder" || preview?.previewState === "placeholder") {
    return "placeholder";
  }

  return "unknown";
}

function resolveWelcomeProviderKey(registry: EmailTemplateRegistryRecord): EmailProviderKey | null {
  if (registry.providerKey) {
    return registry.providerKey;
  }

  return resolvePlatformProviderReady() ? "resend" : null;
}

function buildWelcomeMetadataSummary(
  registry: EmailTemplateRegistryRecord,
  transactionalNote: string | null,
  readinessState: EmailWelcomeReadinessState
) {
  if (transactionalNote) {
    return `${transactionalNote} Welcome email readiness foundation only.`;
  }

  if (registry.metadataSummary) {
    return registry.metadataSummary;
  }

  return readinessStateDescriptions[readinessState];
}

export function buildEmailWelcomeEmailRecordSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  transactionalNote?: string | null;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailWelcomeEmailRecord | null {
  try {
    if (params.registry.category !== "welcome") {
      return null;
    }

    const templateKey = text(params.registry.templateKey, 160);
    if (!templateKey) {
      return null;
    }

    const previewState = params.preview?.previewState ?? "unknown";
    const versionState = params.version?.versionState ?? "unknown";
    const validationState = params.validation?.validationState ?? "unknown";
    const readinessState = resolveEmailWelcomeReadinessStateSafe(params);

    return {
      metadataSummary: buildWelcomeMetadataSummary(
        params.registry,
        text(params.transactionalNote, 500) || null,
        readinessState
      ),
      name: text(params.registry.name, 200) || "Platform welcome email",
      previewState,
      previewStateLabel:
        previewState === "unknown"
          ? "Unknown preview state"
          : getEmailTemplatePreviewStateLabel(previewState),
      providerKey: resolveWelcomeProviderKey(params.registry),
      readinessState,
      readinessStateLabel: getEmailWelcomeReadinessStateLabel(readinessState),
      status: params.registry.status,
      templateCategory: "welcome",
      templateKey,
      validationState,
      validationStateLabel:
        validationState === "unknown"
          ? "Unknown validation state"
          : getEmailTemplateValidationStateLabel(validationState),
      versionState,
      versionStateLabel:
        versionState === "unknown"
          ? "Unknown version state"
          : getEmailTemplateVersionStateLabel(versionState)
    };
  } catch (error) {
    console.error("[email-welcome-runtime] welcome email record build failed", error);
    return null;
  }
}

export function buildEmailWelcomeEmailRecordsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailWelcomeEmailRecord[] {
  try {
    const items = Array.isArray(registryItems) ? registryItems : [];
    const templateRecords = buildEmailTemplateRegistryRecordsSafe(items, resolveTemplateStatus).filter(
      (record) => record.category === "welcome"
    );
    const previewRecords = buildEmailTemplatePreviewRecordsSafe(templateRecords);
    const versionRecords = buildEmailTemplateVersionRecordsSafe(templateRecords);
    const validationRecords = buildEmailTemplateValidationRecordsSafe(templateRecords);
    const previewByKey = new Map(previewRecords.map((record) => [record.templateKey, record]));
    const versionByKey = new Map(versionRecords.map((record) => [record.templateKey, record]));
    const validationByKey = new Map(validationRecords.map((record) => [record.templateKey, record]));
    const providerReady = resolvePlatformProviderReady();

    const welcomeSection = filterEmailRegistryItemsByType(items, "transactional_section").find((item) => {
      const metadata = item.metadata ?? {};
      return text(metadata.section_key, 80) === "welcome" || text(item.slug, 80) === "welcome-emails";
    });
    const transactionalNote =
      text(welcomeSection?.metadata?.note, 500) ||
      text(welcomeSection?.description, 500) ||
      null;

    if (!templateRecords.length) {
      return [];
    }

    return templateRecords
      .map((registry) =>
        buildEmailWelcomeEmailRecordSafe({
          preview: previewByKey.get(registry.templateKey) ?? null,
          providerReady,
          registry,
          transactionalNote,
          validation: validationByKey.get(registry.templateKey) ?? null,
          version: versionByKey.get(registry.templateKey) ?? null
        })
      )
      .filter((record): record is EmailWelcomeEmailRecord => Boolean(record));
  } catch (error) {
    console.error("[email-welcome-runtime] welcome email records build failed", error);
    return [];
  }
}

export function buildEmailWelcomeEmailStatsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailWelcomeEmailStats {
  try {
    const records = buildEmailWelcomeEmailRecordsSafe(registryItems, resolveTemplateStatus);

    if (!records.length) {
      return {
        draftWelcomeEmails: 0,
        invalidWelcomeEmails: 0,
        missingProviderWelcomeEmails: 0,
        missingTemplateWelcomeEmails: 1,
        needsReviewWelcomeEmails: 0,
        placeholderWelcomeEmails: 0,
        readyWelcomeEmails: 0,
        totalWelcomeEmails: 0,
        unknownWelcomeEmails: 0
      };
    }

    return {
      draftWelcomeEmails: records.filter((record) => record.readinessState === "draft").length,
      invalidWelcomeEmails: records.filter((record) => record.readinessState === "invalid").length,
      missingProviderWelcomeEmails: records.filter((record) => record.readinessState === "missing_provider")
        .length,
      missingTemplateWelcomeEmails: 0,
      needsReviewWelcomeEmails: records.filter((record) => record.readinessState === "needs_review").length,
      placeholderWelcomeEmails: records.filter((record) => record.readinessState === "placeholder").length,
      readyWelcomeEmails: records.filter((record) => record.readinessState === "ready").length,
      totalWelcomeEmails: records.length,
      unknownWelcomeEmails: records.filter((record) => record.readinessState === "unknown").length
    };
  } catch (error) {
    console.error("[email-welcome-runtime] welcome email stats build failed", error);

    return {
      draftWelcomeEmails: 0,
      invalidWelcomeEmails: 0,
      missingProviderWelcomeEmails: 0,
      missingTemplateWelcomeEmails: 0,
      needsReviewWelcomeEmails: 0,
      placeholderWelcomeEmails: 0,
      readyWelcomeEmails: 0,
      totalWelcomeEmails: 0,
      unknownWelcomeEmails: 0
    };
  }
}

export function listEmailWelcomeReadinessCatalog() {
  return EMAIL_WELCOME_READINESS_STATES.map((readinessState) => ({
    description: getEmailWelcomeReadinessStateDescription(readinessState),
    label: getEmailWelcomeReadinessStateLabel(readinessState),
    readinessState
  }));
}
