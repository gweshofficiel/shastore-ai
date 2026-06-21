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

export type EmailSupportReadinessState =
  | "draft"
  | "invalid"
  | "missing_provider"
  | "missing_template"
  | "needs_review"
  | "placeholder"
  | "ready"
  | "unknown";

export type EmailSupportEmailRecord = {
  metadataSummary: string;
  name: string;
  previewState: EmailTemplatePreviewState | "unknown";
  previewStateLabel: string;
  providerKey: EmailProviderKey | null;
  readinessState: EmailSupportReadinessState;
  readinessStateLabel: string;
  status: EmailTemplateDisplayStatus;
  templateCategory: "support";
  templateKey: string;
  validationState: EmailTemplateValidationState | "unknown";
  validationStateLabel: string;
  versionState: EmailTemplateVersionState | "unknown";
  versionStateLabel: string;
};

export type EmailSupportEmailStats = {
  draftSupportEmails: number;
  invalidSupportEmails: number;
  missingProviderSupportEmails: number;
  missingTemplateSupportEmails: number;
  needsReviewSupportEmails: number;
  placeholderSupportEmails: number;
  readySupportEmails: number;
  totalSupportEmails: number;
  unknownSupportEmails: number;
};

export const EMAIL_SUPPORT_READINESS_STATES: readonly EmailSupportReadinessState[] = [
  "ready",
  "draft",
  "needs_review",
  "invalid",
  "missing_template",
  "missing_provider",
  "placeholder",
  "unknown"
] as const;

const readinessStateLabels: Record<EmailSupportReadinessState, string> = {
  draft: "Draft support email",
  invalid: "Invalid support email foundation",
  missing_provider: "Missing provider readiness",
  missing_template: "Missing support template",
  needs_review: "Support email needs review",
  placeholder: "Support email placeholder",
  ready: "Support email ready",
  unknown: "Unknown support email readiness"
};

const readinessStateDescriptions: Record<EmailSupportReadinessState, string> = {
  draft: "Support email template is in draft foundation state. No support email sending or ticket creation connected.",
  invalid: "Support email foundation could not be validated safely.",
  missing_provider: "Platform email provider is not configured for support email readiness.",
  missing_template: "No support email template foundation was found in the registry.",
  needs_review: "Support email foundation requires admin review. No sending connected.",
  placeholder: "Support email placeholder foundation only. No execution connected.",
  ready: "Support email readiness foundation looks complete. No support email sending or ticket creation connected.",
  unknown: "Support email readiness could not be resolved safely."
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

export function getEmailSupportReadinessStateLabel(state: EmailSupportReadinessState) {
  return readinessStateLabels[state];
}

export function getEmailSupportReadinessStateDescription(state: EmailSupportReadinessState) {
  return readinessStateDescriptions[state];
}

export function resolveEmailSupportReadinessStateSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailSupportReadinessState {
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

function resolveSupportProviderKey(registry: EmailTemplateRegistryRecord): EmailProviderKey | null {
  if (registry.providerKey) {
    return registry.providerKey;
  }

  return resolvePlatformProviderReady() ? "resend" : null;
}

function buildSupportMetadataSummary(
  registry: EmailTemplateRegistryRecord,
  transactionalNote: string | null,
  readinessState: EmailSupportReadinessState
) {
  if (transactionalNote) {
    return `${transactionalNote} Support email readiness foundation only.`;
  }

  if (registry.metadataSummary) {
    return registry.metadataSummary;
  }

  return readinessStateDescriptions[readinessState];
}

export function buildEmailSupportEmailRecordSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  transactionalNote?: string | null;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailSupportEmailRecord | null {
  try {
    if (params.registry.category !== "support") {
      return null;
    }

    const templateKey = text(params.registry.templateKey, 160);
    if (!templateKey) {
      return null;
    }

    const previewState = params.preview?.previewState ?? "unknown";
    const versionState = params.version?.versionState ?? "unknown";
    const validationState = params.validation?.validationState ?? "unknown";
    const readinessState = resolveEmailSupportReadinessStateSafe(params);

    return {
      metadataSummary: buildSupportMetadataSummary(
        params.registry,
        text(params.transactionalNote, 500) || null,
        readinessState
      ),
      name: text(params.registry.name, 200) || "Support email",
      previewState,
      previewStateLabel:
        previewState === "unknown"
          ? "Unknown preview state"
          : getEmailTemplatePreviewStateLabel(previewState),
      providerKey: resolveSupportProviderKey(params.registry),
      readinessState,
      readinessStateLabel: getEmailSupportReadinessStateLabel(readinessState),
      status: params.registry.status,
      templateCategory: "support",
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
    console.error("[email-support-runtime] support email record build failed", error);
    return null;
  }
}

export function buildEmailSupportEmailRecordsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailSupportEmailRecord[] {
  try {
    const items = Array.isArray(registryItems) ? registryItems : [];
    const templateRecords = buildEmailTemplateRegistryRecordsSafe(items, resolveTemplateStatus).filter(
      (record) => record.category === "support"
    );
    const previewRecords = buildEmailTemplatePreviewRecordsSafe(templateRecords);
    const versionRecords = buildEmailTemplateVersionRecordsSafe(templateRecords);
    const validationRecords = buildEmailTemplateValidationRecordsSafe(templateRecords);
    const previewByKey = new Map(previewRecords.map((record) => [record.templateKey, record]));
    const versionByKey = new Map(versionRecords.map((record) => [record.templateKey, record]));
    const validationByKey = new Map(validationRecords.map((record) => [record.templateKey, record]));
    const providerReady = resolvePlatformProviderReady();

    const supportSection = filterEmailRegistryItemsByType(items, "transactional_section").find((item) => {
      const metadata = item.metadata ?? {};
      return text(metadata.section_key, 80) === "support" || text(item.slug, 80) === "support-emails";
    });
    const transactionalNote =
      text(supportSection?.metadata?.note, 500) ||
      text(supportSection?.description, 500) ||
      null;

    if (!templateRecords.length) {
      return [];
    }

    return templateRecords
      .map((registry) =>
        buildEmailSupportEmailRecordSafe({
          preview: previewByKey.get(registry.templateKey) ?? null,
          providerReady,
          registry,
          transactionalNote,
          validation: validationByKey.get(registry.templateKey) ?? null,
          version: versionByKey.get(registry.templateKey) ?? null
        })
      )
      .filter((record): record is EmailSupportEmailRecord => Boolean(record));
  } catch (error) {
    console.error("[email-support-runtime] support email records build failed", error);
    return [];
  }
}

export function buildEmailSupportEmailStatsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailSupportEmailStats {
  try {
    const records = buildEmailSupportEmailRecordsSafe(registryItems, resolveTemplateStatus);

    if (!records.length) {
      return {
        draftSupportEmails: 0,
        invalidSupportEmails: 0,
        missingProviderSupportEmails: 0,
        missingTemplateSupportEmails: 1,
        needsReviewSupportEmails: 0,
        placeholderSupportEmails: 0,
        readySupportEmails: 0,
        totalSupportEmails: 0,
        unknownSupportEmails: 0
      };
    }

    return {
      draftSupportEmails: records.filter((record) => record.readinessState === "draft").length,
      invalidSupportEmails: records.filter((record) => record.readinessState === "invalid").length,
      missingProviderSupportEmails: records.filter((record) => record.readinessState === "missing_provider")
        .length,
      missingTemplateSupportEmails: 0,
      needsReviewSupportEmails: records.filter((record) => record.readinessState === "needs_review").length,
      placeholderSupportEmails: records.filter((record) => record.readinessState === "placeholder").length,
      readySupportEmails: records.filter((record) => record.readinessState === "ready").length,
      totalSupportEmails: records.length,
      unknownSupportEmails: records.filter((record) => record.readinessState === "unknown").length
    };
  } catch (error) {
    console.error("[email-support-runtime] support email stats build failed", error);

    return {
      draftSupportEmails: 0,
      invalidSupportEmails: 0,
      missingProviderSupportEmails: 0,
      missingTemplateSupportEmails: 0,
      needsReviewSupportEmails: 0,
      placeholderSupportEmails: 0,
      readySupportEmails: 0,
      totalSupportEmails: 0,
      unknownSupportEmails: 0
    };
  }
}

export function listEmailSupportReadinessCatalog() {
  return EMAIL_SUPPORT_READINESS_STATES.map((readinessState) => ({
    description: getEmailSupportReadinessStateDescription(readinessState),
    label: getEmailSupportReadinessStateLabel(readinessState),
    readinessState
  }));
}
