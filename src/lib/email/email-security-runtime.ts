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

export type EmailSecurityReadinessState =
  | "draft"
  | "invalid"
  | "missing_provider"
  | "missing_template"
  | "needs_review"
  | "placeholder"
  | "ready"
  | "unknown";

export type EmailSecurityEmailRecord = {
  metadataSummary: string;
  name: string;
  previewState: EmailTemplatePreviewState | "unknown";
  previewStateLabel: string;
  providerKey: EmailProviderKey | null;
  readinessState: EmailSecurityReadinessState;
  readinessStateLabel: string;
  status: EmailTemplateDisplayStatus;
  templateCategory: "security";
  templateKey: string;
  validationState: EmailTemplateValidationState | "unknown";
  validationStateLabel: string;
  versionState: EmailTemplateVersionState | "unknown";
  versionStateLabel: string;
};

export type EmailSecurityEmailStats = {
  draftSecurityEmails: number;
  invalidSecurityEmails: number;
  missingProviderSecurityEmails: number;
  missingTemplateSecurityEmails: number;
  needsReviewSecurityEmails: number;
  placeholderSecurityEmails: number;
  readySecurityEmails: number;
  totalSecurityEmails: number;
  unknownSecurityEmails: number;
};

export const EMAIL_SECURITY_READINESS_STATES: readonly EmailSecurityReadinessState[] = [
  "ready",
  "draft",
  "needs_review",
  "invalid",
  "missing_template",
  "missing_provider",
  "placeholder",
  "unknown"
] as const;

const readinessStateLabels: Record<EmailSecurityReadinessState, string> = {
  draft: "Draft security email",
  invalid: "Invalid security email foundation",
  missing_provider: "Missing provider readiness",
  missing_template: "Missing security template",
  needs_review: "Security email needs review",
  placeholder: "Security email placeholder",
  ready: "Security email ready",
  unknown: "Unknown security email readiness"
};

const readinessStateDescriptions: Record<EmailSecurityReadinessState, string> = {
  draft:
    "Security email template is in draft foundation state. No security email sending, OTP sending, or password reset sending connected.",
  invalid: "Security email foundation could not be validated safely.",
  missing_provider: "Platform email provider is not configured for security email readiness.",
  missing_template: "No security email template foundation was found in the registry.",
  needs_review: "Security email foundation requires admin review. No sending connected.",
  placeholder: "Security email placeholder foundation only. No execution connected.",
  ready:
    "Security email readiness foundation looks complete. No security email sending, OTP sending, or password reset sending connected.",
  unknown: "Security email readiness could not be resolved safely."
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

export function getEmailSecurityReadinessStateLabel(state: EmailSecurityReadinessState) {
  return readinessStateLabels[state];
}

export function getEmailSecurityReadinessStateDescription(state: EmailSecurityReadinessState) {
  return readinessStateDescriptions[state];
}

export function resolveEmailSecurityReadinessStateSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailSecurityReadinessState {
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

function resolveSecurityProviderKey(registry: EmailTemplateRegistryRecord): EmailProviderKey | null {
  if (registry.providerKey) {
    return registry.providerKey;
  }

  return resolvePlatformProviderReady() ? "resend" : null;
}

function buildSecurityMetadataSummary(
  registry: EmailTemplateRegistryRecord,
  transactionalNote: string | null,
  readinessState: EmailSecurityReadinessState
) {
  if (transactionalNote) {
    return `${transactionalNote} Security email readiness foundation only.`;
  }

  if (registry.metadataSummary) {
    return registry.metadataSummary;
  }

  return readinessStateDescriptions[readinessState];
}

export function buildEmailSecurityEmailRecordSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  transactionalNote?: string | null;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailSecurityEmailRecord | null {
  try {
    if (params.registry.category !== "security") {
      return null;
    }

    const templateKey = text(params.registry.templateKey, 160);
    if (!templateKey) {
      return null;
    }

    const previewState = params.preview?.previewState ?? "unknown";
    const versionState = params.version?.versionState ?? "unknown";
    const validationState = params.validation?.validationState ?? "unknown";
    const readinessState = resolveEmailSecurityReadinessStateSafe(params);

    return {
      metadataSummary: buildSecurityMetadataSummary(
        params.registry,
        text(params.transactionalNote, 500) || null,
        readinessState
      ),
      name: text(params.registry.name, 200) || "Security email",
      previewState,
      previewStateLabel:
        previewState === "unknown"
          ? "Unknown preview state"
          : getEmailTemplatePreviewStateLabel(previewState),
      providerKey: resolveSecurityProviderKey(params.registry),
      readinessState,
      readinessStateLabel: getEmailSecurityReadinessStateLabel(readinessState),
      status: params.registry.status,
      templateCategory: "security",
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
    console.error("[email-security-runtime] security email record build failed", error);
    return null;
  }
}

export function buildEmailSecurityEmailRecordsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailSecurityEmailRecord[] {
  try {
    const items = Array.isArray(registryItems) ? registryItems : [];
    const templateRecords = buildEmailTemplateRegistryRecordsSafe(items, resolveTemplateStatus).filter(
      (record) => record.category === "security"
    );
    const previewRecords = buildEmailTemplatePreviewRecordsSafe(templateRecords);
    const versionRecords = buildEmailTemplateVersionRecordsSafe(templateRecords);
    const validationRecords = buildEmailTemplateValidationRecordsSafe(templateRecords);
    const previewByKey = new Map(previewRecords.map((record) => [record.templateKey, record]));
    const versionByKey = new Map(versionRecords.map((record) => [record.templateKey, record]));
    const validationByKey = new Map(validationRecords.map((record) => [record.templateKey, record]));
    const providerReady = resolvePlatformProviderReady();

    const securitySection = filterEmailRegistryItemsByType(items, "transactional_section").find((item) => {
      const metadata = item.metadata ?? {};
      return text(metadata.section_key, 80) === "security" || text(item.slug, 80) === "security-emails";
    });
    const transactionalNote =
      text(securitySection?.metadata?.note, 500) ||
      text(securitySection?.description, 500) ||
      null;

    if (!templateRecords.length) {
      return [];
    }

    return templateRecords
      .map((registry) =>
        buildEmailSecurityEmailRecordSafe({
          preview: previewByKey.get(registry.templateKey) ?? null,
          providerReady,
          registry,
          transactionalNote,
          validation: validationByKey.get(registry.templateKey) ?? null,
          version: versionByKey.get(registry.templateKey) ?? null
        })
      )
      .filter((record): record is EmailSecurityEmailRecord => Boolean(record));
  } catch (error) {
    console.error("[email-security-runtime] security email records build failed", error);
    return [];
  }
}

export function buildEmailSecurityEmailStatsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailSecurityEmailStats {
  try {
    const records = buildEmailSecurityEmailRecordsSafe(registryItems, resolveTemplateStatus);

    if (!records.length) {
      return {
        draftSecurityEmails: 0,
        invalidSecurityEmails: 0,
        missingProviderSecurityEmails: 0,
        missingTemplateSecurityEmails: 1,
        needsReviewSecurityEmails: 0,
        placeholderSecurityEmails: 0,
        readySecurityEmails: 0,
        totalSecurityEmails: 0,
        unknownSecurityEmails: 0
      };
    }

    return {
      draftSecurityEmails: records.filter((record) => record.readinessState === "draft").length,
      invalidSecurityEmails: records.filter((record) => record.readinessState === "invalid").length,
      missingProviderSecurityEmails: records.filter((record) => record.readinessState === "missing_provider")
        .length,
      missingTemplateSecurityEmails: 0,
      needsReviewSecurityEmails: records.filter((record) => record.readinessState === "needs_review").length,
      placeholderSecurityEmails: records.filter((record) => record.readinessState === "placeholder").length,
      readySecurityEmails: records.filter((record) => record.readinessState === "ready").length,
      totalSecurityEmails: records.length,
      unknownSecurityEmails: records.filter((record) => record.readinessState === "unknown").length
    };
  } catch (error) {
    console.error("[email-security-runtime] security email stats build failed", error);

    return {
      draftSecurityEmails: 0,
      invalidSecurityEmails: 0,
      missingProviderSecurityEmails: 0,
      missingTemplateSecurityEmails: 0,
      needsReviewSecurityEmails: 0,
      placeholderSecurityEmails: 0,
      readySecurityEmails: 0,
      totalSecurityEmails: 0,
      unknownSecurityEmails: 0
    };
  }
}

export function listEmailSecurityReadinessCatalog() {
  return EMAIL_SECURITY_READINESS_STATES.map((readinessState) => ({
    description: getEmailSecurityReadinessStateDescription(readinessState),
    label: getEmailSecurityReadinessStateLabel(readinessState),
    readinessState
  }));
}
