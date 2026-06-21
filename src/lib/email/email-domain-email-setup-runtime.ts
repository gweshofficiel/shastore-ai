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

export type EmailDomainEmailSetupReadinessState =
  | "draft"
  | "invalid"
  | "missing_provider"
  | "missing_template"
  | "needs_review"
  | "placeholder"
  | "ready"
  | "unknown";

export type EmailDomainEmailSetupEmailRecord = {
  metadataSummary: string;
  name: string;
  previewState: EmailTemplatePreviewState | "unknown";
  previewStateLabel: string;
  providerKey: EmailProviderKey | null;
  readinessState: EmailDomainEmailSetupReadinessState;
  readinessStateLabel: string;
  status: EmailTemplateDisplayStatus;
  templateCategory: "domain_email_setup";
  templateKey: string;
  validationState: EmailTemplateValidationState | "unknown";
  validationStateLabel: string;
  versionState: EmailTemplateVersionState | "unknown";
  versionStateLabel: string;
};

export type EmailDomainEmailSetupEmailStats = {
  draftDomainEmailSetupEmails: number;
  invalidDomainEmailSetupEmails: number;
  missingProviderDomainEmailSetupEmails: number;
  missingTemplateDomainEmailSetupEmails: number;
  needsReviewDomainEmailSetupEmails: number;
  placeholderDomainEmailSetupEmails: number;
  readyDomainEmailSetupEmails: number;
  totalDomainEmailSetupEmails: number;
  unknownDomainEmailSetupEmails: number;
};

export const EMAIL_DOMAIN_EMAIL_SETUP_READINESS_STATES: readonly EmailDomainEmailSetupReadinessState[] = [
  "ready",
  "draft",
  "needs_review",
  "invalid",
  "missing_template",
  "missing_provider",
  "placeholder",
  "unknown"
] as const;

const readinessStateLabels: Record<EmailDomainEmailSetupReadinessState, string> = {
  draft: "Draft domain and email setup email",
  invalid: "Invalid domain and email setup foundation",
  missing_provider: "Missing provider readiness",
  missing_template: "Missing domain and email setup template",
  needs_review: "Domain and email setup needs review",
  placeholder: "Domain and email setup placeholder",
  ready: "Domain and email setup ready",
  unknown: "Unknown domain and email setup readiness"
};

const readinessStateDescriptions: Record<EmailDomainEmailSetupReadinessState, string> = {
  draft:
    "Domain and email setup template is in draft foundation state. No setup email sending or domain provisioning connected.",
  invalid: "Domain and email setup foundation could not be validated safely.",
  missing_provider: "Platform email provider is not configured for domain and email setup readiness.",
  missing_template: "No domain and email setup template foundation was found in the registry.",
  needs_review: "Domain and email setup foundation requires admin review. No sending connected.",
  placeholder: "Domain and email setup placeholder foundation only. No execution connected.",
  ready:
    "Domain and email setup readiness foundation looks complete. No setup email sending or domain provisioning connected.",
  unknown: "Domain and email setup readiness could not be resolved safely."
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

export function getEmailDomainEmailSetupReadinessStateLabel(state: EmailDomainEmailSetupReadinessState) {
  return readinessStateLabels[state];
}

export function getEmailDomainEmailSetupReadinessStateDescription(state: EmailDomainEmailSetupReadinessState) {
  return readinessStateDescriptions[state];
}

export function resolveEmailDomainEmailSetupReadinessStateSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailDomainEmailSetupReadinessState {
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

function resolveDomainEmailSetupProviderKey(registry: EmailTemplateRegistryRecord): EmailProviderKey | null {
  if (registry.providerKey) {
    return registry.providerKey;
  }

  return resolvePlatformProviderReady() ? "resend" : null;
}

function buildDomainEmailSetupMetadataSummary(
  registry: EmailTemplateRegistryRecord,
  transactionalNote: string | null,
  readinessState: EmailDomainEmailSetupReadinessState
) {
  if (transactionalNote) {
    return `${transactionalNote} Domain and email setup readiness foundation only.`;
  }

  if (registry.metadataSummary) {
    return registry.metadataSummary;
  }

  return readinessStateDescriptions[readinessState];
}

export function buildEmailDomainEmailSetupEmailRecordSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  transactionalNote?: string | null;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailDomainEmailSetupEmailRecord | null {
  try {
    if (params.registry.category !== "domain_email_setup") {
      return null;
    }

    const templateKey = text(params.registry.templateKey, 160);
    if (!templateKey) {
      return null;
    }

    const previewState = params.preview?.previewState ?? "unknown";
    const versionState = params.version?.versionState ?? "unknown";
    const validationState = params.validation?.validationState ?? "unknown";
    const readinessState = resolveEmailDomainEmailSetupReadinessStateSafe(params);

    return {
      metadataSummary: buildDomainEmailSetupMetadataSummary(
        params.registry,
        text(params.transactionalNote, 500) || null,
        readinessState
      ),
      name: text(params.registry.name, 200) || "Domain and email setup instructions",
      previewState,
      previewStateLabel:
        previewState === "unknown"
          ? "Unknown preview state"
          : getEmailTemplatePreviewStateLabel(previewState),
      providerKey: resolveDomainEmailSetupProviderKey(params.registry),
      readinessState,
      readinessStateLabel: getEmailDomainEmailSetupReadinessStateLabel(readinessState),
      status: params.registry.status,
      templateCategory: "domain_email_setup",
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
    console.error("[email-domain-email-setup-runtime] domain email setup record build failed", error);
    return null;
  }
}

export function buildEmailDomainEmailSetupEmailRecordsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailDomainEmailSetupEmailRecord[] {
  try {
    const items = Array.isArray(registryItems) ? registryItems : [];
    const templateRecords = buildEmailTemplateRegistryRecordsSafe(items, resolveTemplateStatus).filter(
      (record) => record.category === "domain_email_setup"
    );
    const previewRecords = buildEmailTemplatePreviewRecordsSafe(templateRecords);
    const versionRecords = buildEmailTemplateVersionRecordsSafe(templateRecords);
    const validationRecords = buildEmailTemplateValidationRecordsSafe(templateRecords);
    const previewByKey = new Map(previewRecords.map((record) => [record.templateKey, record]));
    const versionByKey = new Map(versionRecords.map((record) => [record.templateKey, record]));
    const validationByKey = new Map(validationRecords.map((record) => [record.templateKey, record]));
    const providerReady = resolvePlatformProviderReady();

    const setupSection = filterEmailRegistryItemsByType(items, "transactional_section").find((item) => {
      const metadata = item.metadata ?? {};
      return (
        text(metadata.section_key, 80) === "domain_email_setup" ||
        text(item.slug, 80) === "domain-email-setup-emails"
      );
    });
    const transactionalNote =
      text(setupSection?.metadata?.note, 500) ||
      text(setupSection?.description, 500) ||
      null;

    if (!templateRecords.length) {
      return [];
    }

    return templateRecords
      .map((registry) =>
        buildEmailDomainEmailSetupEmailRecordSafe({
          preview: previewByKey.get(registry.templateKey) ?? null,
          providerReady,
          registry,
          transactionalNote,
          validation: validationByKey.get(registry.templateKey) ?? null,
          version: versionByKey.get(registry.templateKey) ?? null
        })
      )
      .filter((record): record is EmailDomainEmailSetupEmailRecord => Boolean(record));
  } catch (error) {
    console.error("[email-domain-email-setup-runtime] domain email setup records build failed", error);
    return [];
  }
}

export function buildEmailDomainEmailSetupEmailStatsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailDomainEmailSetupEmailStats {
  try {
    const records = buildEmailDomainEmailSetupEmailRecordsSafe(registryItems, resolveTemplateStatus);

    if (!records.length) {
      return {
        draftDomainEmailSetupEmails: 0,
        invalidDomainEmailSetupEmails: 0,
        missingProviderDomainEmailSetupEmails: 0,
        missingTemplateDomainEmailSetupEmails: 1,
        needsReviewDomainEmailSetupEmails: 0,
        placeholderDomainEmailSetupEmails: 0,
        readyDomainEmailSetupEmails: 0,
        totalDomainEmailSetupEmails: 0,
        unknownDomainEmailSetupEmails: 0
      };
    }

    return {
      draftDomainEmailSetupEmails: records.filter((record) => record.readinessState === "draft").length,
      invalidDomainEmailSetupEmails: records.filter((record) => record.readinessState === "invalid").length,
      missingProviderDomainEmailSetupEmails: records.filter(
        (record) => record.readinessState === "missing_provider"
      ).length,
      missingTemplateDomainEmailSetupEmails: 0,
      needsReviewDomainEmailSetupEmails: records.filter((record) => record.readinessState === "needs_review")
        .length,
      placeholderDomainEmailSetupEmails: records.filter((record) => record.readinessState === "placeholder")
        .length,
      readyDomainEmailSetupEmails: records.filter((record) => record.readinessState === "ready").length,
      totalDomainEmailSetupEmails: records.length,
      unknownDomainEmailSetupEmails: records.filter((record) => record.readinessState === "unknown").length
    };
  } catch (error) {
    console.error("[email-domain-email-setup-runtime] domain email setup stats build failed", error);

    return {
      draftDomainEmailSetupEmails: 0,
      invalidDomainEmailSetupEmails: 0,
      missingProviderDomainEmailSetupEmails: 0,
      missingTemplateDomainEmailSetupEmails: 0,
      needsReviewDomainEmailSetupEmails: 0,
      placeholderDomainEmailSetupEmails: 0,
      readyDomainEmailSetupEmails: 0,
      totalDomainEmailSetupEmails: 0,
      unknownDomainEmailSetupEmails: 0
    };
  }
}

export function listEmailDomainEmailSetupReadinessCatalog() {
  return EMAIL_DOMAIN_EMAIL_SETUP_READINESS_STATES.map((readinessState) => ({
    description: getEmailDomainEmailSetupReadinessStateDescription(readinessState),
    label: getEmailDomainEmailSetupReadinessStateLabel(readinessState),
    readinessState
  }));
}
