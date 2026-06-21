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

export type EmailBillingReadinessState =
  | "active"
  | "draft"
  | "invalid"
  | "missing_provider"
  | "missing_template"
  | "needs_review"
  | "placeholder"
  | "ready"
  | "unknown";

export type EmailBillingEmailRecord = {
  metadataSummary: string;
  name: string;
  previewState: EmailTemplatePreviewState | "unknown";
  previewStateLabel: string;
  providerKey: EmailProviderKey | null;
  readinessState: EmailBillingReadinessState;
  readinessStateLabel: string;
  status: EmailTemplateDisplayStatus;
  templateCategory: "billing";
  templateKey: string;
  validationState: EmailTemplateValidationState | "unknown";
  validationStateLabel: string;
  versionState: EmailTemplateVersionState | "unknown";
  versionStateLabel: string;
};

export type EmailBillingEmailStats = {
  activeBillingEmails: number;
  draftBillingEmails: number;
  invalidBillingEmails: number;
  missingProviderBillingEmails: number;
  missingTemplateBillingEmails: number;
  needsReviewBillingEmails: number;
  placeholderBillingEmails: number;
  readyBillingEmails: number;
  totalBillingEmails: number;
  unknownBillingEmails: number;
};

export const EMAIL_BILLING_READINESS_STATES: readonly EmailBillingReadinessState[] = [
  "ready",
  "active",
  "draft",
  "needs_review",
  "invalid",
  "missing_template",
  "missing_provider",
  "placeholder",
  "unknown"
] as const;

const readinessStateLabels: Record<EmailBillingReadinessState, string> = {
  active: "Active billing email",
  draft: "Draft billing email",
  invalid: "Invalid billing email foundation",
  missing_provider: "Missing provider readiness",
  missing_template: "Missing billing template",
  needs_review: "Billing email needs review",
  placeholder: "Billing email placeholder",
  ready: "Billing email ready",
  unknown: "Unknown billing email readiness"
};

const readinessStateDescriptions: Record<EmailBillingReadinessState, string> = {
  active:
    "Billing email template is active in registry foundation. No billing email sending or payment calls connected.",
  draft: "Billing email template is in draft foundation state. No billing email sending connected.",
  invalid: "Billing email foundation could not be validated safely.",
  missing_provider: "Platform email provider is not configured for billing email readiness.",
  missing_template: "No billing email template foundation was found in the registry.",
  needs_review: "Billing email foundation requires admin review. No sending connected.",
  placeholder: "Billing email placeholder foundation only. No execution connected.",
  ready: "Billing email readiness foundation looks complete. No billing email sending connected.",
  unknown: "Billing email readiness could not be resolved safely."
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

export function getEmailBillingReadinessStateLabel(state: EmailBillingReadinessState) {
  return readinessStateLabels[state];
}

export function getEmailBillingReadinessStateDescription(state: EmailBillingReadinessState) {
  return readinessStateDescriptions[state];
}

export function resolveEmailBillingReadinessStateSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailBillingReadinessState {
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

  if (
    registry.status === "active" &&
    (validation?.validationState === "valid" ||
      preview?.previewState === "preview_ready" ||
      version?.versionState === "published")
  ) {
    return "ready";
  }

  if (registry.status === "active") {
    return "active";
  }

  if (validation?.validationState === "placeholder" || preview?.previewState === "placeholder") {
    return "placeholder";
  }

  return "unknown";
}

function resolveBillingProviderKey(registry: EmailTemplateRegistryRecord): EmailProviderKey | null {
  if (registry.providerKey) {
    return registry.providerKey;
  }

  return resolvePlatformProviderReady() ? "resend" : null;
}

function buildBillingMetadataSummary(
  registry: EmailTemplateRegistryRecord,
  transactionalNote: string | null,
  readinessState: EmailBillingReadinessState
) {
  if (transactionalNote) {
    return `${transactionalNote} Billing email readiness foundation only.`;
  }

  if (registry.metadataSummary) {
    return registry.metadataSummary;
  }

  return readinessStateDescriptions[readinessState];
}

export function buildEmailBillingEmailRecordSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  transactionalNote?: string | null;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailBillingEmailRecord | null {
  try {
    if (params.registry.category !== "billing") {
      return null;
    }

    const templateKey = text(params.registry.templateKey, 160);
    if (!templateKey) {
      return null;
    }

    const previewState = params.preview?.previewState ?? "unknown";
    const versionState = params.version?.versionState ?? "unknown";
    const validationState = params.validation?.validationState ?? "unknown";
    const readinessState = resolveEmailBillingReadinessStateSafe(params);

    return {
      metadataSummary: buildBillingMetadataSummary(
        params.registry,
        text(params.transactionalNote, 500) || null,
        readinessState
      ),
      name: text(params.registry.name, 200) || templateKey,
      previewState,
      previewStateLabel:
        previewState === "unknown"
          ? "Unknown preview state"
          : getEmailTemplatePreviewStateLabel(previewState),
      providerKey: resolveBillingProviderKey(params.registry),
      readinessState,
      readinessStateLabel: getEmailBillingReadinessStateLabel(readinessState),
      status: params.registry.status,
      templateCategory: "billing",
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
    console.error("[email-billing-runtime] billing email record build failed", error);
    return null;
  }
}

export function buildEmailBillingEmailRecordsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailBillingEmailRecord[] {
  try {
    const items = Array.isArray(registryItems) ? registryItems : [];
    const templateRecords = buildEmailTemplateRegistryRecordsSafe(items, resolveTemplateStatus).filter(
      (record) => record.category === "billing"
    );
    const previewRecords = buildEmailTemplatePreviewRecordsSafe(templateRecords);
    const versionRecords = buildEmailTemplateVersionRecordsSafe(templateRecords);
    const validationRecords = buildEmailTemplateValidationRecordsSafe(templateRecords);
    const previewByKey = new Map(previewRecords.map((record) => [record.templateKey, record]));
    const versionByKey = new Map(versionRecords.map((record) => [record.templateKey, record]));
    const validationByKey = new Map(validationRecords.map((record) => [record.templateKey, record]));
    const providerReady = resolvePlatformProviderReady();

    const billingSection = filterEmailRegistryItemsByType(items, "transactional_section").find((item) => {
      const metadata = item.metadata ?? {};
      return text(metadata.section_key, 80) === "billing" || text(item.slug, 80) === "billing-emails";
    });
    const transactionalNote =
      text(billingSection?.metadata?.note, 500) ||
      text(billingSection?.description, 500) ||
      null;

    if (!templateRecords.length) {
      return [];
    }

    return templateRecords
      .map((registry) =>
        buildEmailBillingEmailRecordSafe({
          preview: previewByKey.get(registry.templateKey) ?? null,
          providerReady,
          registry,
          transactionalNote,
          validation: validationByKey.get(registry.templateKey) ?? null,
          version: versionByKey.get(registry.templateKey) ?? null
        })
      )
      .filter((record): record is EmailBillingEmailRecord => Boolean(record));
  } catch (error) {
    console.error("[email-billing-runtime] billing email records build failed", error);
    return [];
  }
}

export function buildEmailBillingEmailStatsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailBillingEmailStats {
  try {
    const records = buildEmailBillingEmailRecordsSafe(registryItems, resolveTemplateStatus);

    if (!records.length) {
      return {
        activeBillingEmails: 0,
        draftBillingEmails: 0,
        invalidBillingEmails: 0,
        missingProviderBillingEmails: 0,
        missingTemplateBillingEmails: 1,
        needsReviewBillingEmails: 0,
        placeholderBillingEmails: 0,
        readyBillingEmails: 0,
        totalBillingEmails: 0,
        unknownBillingEmails: 0
      };
    }

    return {
      activeBillingEmails: records.filter((record) => record.readinessState === "active").length,
      draftBillingEmails: records.filter((record) => record.readinessState === "draft").length,
      invalidBillingEmails: records.filter((record) => record.readinessState === "invalid").length,
      missingProviderBillingEmails: records.filter((record) => record.readinessState === "missing_provider")
        .length,
      missingTemplateBillingEmails: 0,
      needsReviewBillingEmails: records.filter((record) => record.readinessState === "needs_review").length,
      placeholderBillingEmails: records.filter((record) => record.readinessState === "placeholder").length,
      readyBillingEmails: records.filter((record) => record.readinessState === "ready").length,
      totalBillingEmails: records.length,
      unknownBillingEmails: records.filter((record) => record.readinessState === "unknown").length
    };
  } catch (error) {
    console.error("[email-billing-runtime] billing email stats build failed", error);

    return {
      activeBillingEmails: 0,
      draftBillingEmails: 0,
      invalidBillingEmails: 0,
      missingProviderBillingEmails: 0,
      missingTemplateBillingEmails: 0,
      needsReviewBillingEmails: 0,
      placeholderBillingEmails: 0,
      readyBillingEmails: 0,
      totalBillingEmails: 0,
      unknownBillingEmails: 0
    };
  }
}

export function listEmailBillingReadinessCatalog() {
  return EMAIL_BILLING_READINESS_STATES.map((readinessState) => ({
    description: getEmailBillingReadinessStateDescription(readinessState),
    label: getEmailBillingReadinessStateLabel(readinessState),
    readinessState
  }));
}
