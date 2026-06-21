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

export type EmailOrderReadinessState =
  | "active"
  | "draft"
  | "invalid"
  | "missing_provider"
  | "missing_template"
  | "needs_review"
  | "placeholder"
  | "ready"
  | "unknown";

export type EmailOrderEmailRecord = {
  metadataSummary: string;
  name: string;
  previewState: EmailTemplatePreviewState | "unknown";
  previewStateLabel: string;
  providerKey: EmailProviderKey | null;
  readinessState: EmailOrderReadinessState;
  readinessStateLabel: string;
  status: EmailTemplateDisplayStatus;
  templateCategory: "order";
  templateKey: string;
  validationState: EmailTemplateValidationState | "unknown";
  validationStateLabel: string;
  versionState: EmailTemplateVersionState | "unknown";
  versionStateLabel: string;
};

export type EmailOrderEmailStats = {
  activeOrderEmails: number;
  draftOrderEmails: number;
  invalidOrderEmails: number;
  missingProviderOrderEmails: number;
  missingTemplateOrderEmails: number;
  needsReviewOrderEmails: number;
  placeholderOrderEmails: number;
  readyOrderEmails: number;
  totalOrderEmails: number;
  unknownOrderEmails: number;
};

export const EMAIL_ORDER_READINESS_STATES: readonly EmailOrderReadinessState[] = [
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

const readinessStateLabels: Record<EmailOrderReadinessState, string> = {
  active: "Active order email",
  draft: "Draft order email",
  invalid: "Invalid order email foundation",
  missing_provider: "Missing provider readiness",
  missing_template: "Missing order template",
  needs_review: "Order email needs review",
  placeholder: "Order email placeholder",
  ready: "Order email ready",
  unknown: "Unknown order email readiness"
};

const readinessStateDescriptions: Record<EmailOrderReadinessState, string> = {
  active:
    "Order email template is active in registry foundation. No order email sending or order calls connected.",
  draft: "Order email template is in draft foundation state. No order email sending connected.",
  invalid: "Order email foundation could not be validated safely.",
  missing_provider: "Platform email provider is not configured for order email readiness.",
  missing_template: "No order email template foundation was found in the registry.",
  needs_review: "Order email foundation requires admin review. No sending connected.",
  placeholder: "Order email placeholder foundation only. No execution connected.",
  ready: "Order email readiness foundation looks complete. No order email sending connected.",
  unknown: "Order email readiness could not be resolved safely."
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

export function getEmailOrderReadinessStateLabel(state: EmailOrderReadinessState) {
  return readinessStateLabels[state];
}

export function getEmailOrderReadinessStateDescription(state: EmailOrderReadinessState) {
  return readinessStateDescriptions[state];
}

export function resolveEmailOrderReadinessStateSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailOrderReadinessState {
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

function resolveOrderProviderKey(registry: EmailTemplateRegistryRecord): EmailProviderKey | null {
  if (registry.providerKey) {
    return registry.providerKey;
  }

  return resolvePlatformProviderReady() ? "resend" : null;
}

function buildOrderMetadataSummary(
  registry: EmailTemplateRegistryRecord,
  transactionalNote: string | null,
  readinessState: EmailOrderReadinessState
) {
  if (transactionalNote) {
    return `${transactionalNote} Order email readiness foundation only.`;
  }

  if (registry.metadataSummary) {
    return registry.metadataSummary;
  }

  return readinessStateDescriptions[readinessState];
}

export function buildEmailOrderEmailRecordSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailTemplateRegistryRecord;
  transactionalNote?: string | null;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailOrderEmailRecord | null {
  try {
    if (params.registry.category !== "order") {
      return null;
    }

    const templateKey = text(params.registry.templateKey, 160);
    if (!templateKey) {
      return null;
    }

    const previewState = params.preview?.previewState ?? "unknown";
    const versionState = params.version?.versionState ?? "unknown";
    const validationState = params.validation?.validationState ?? "unknown";
    const readinessState = resolveEmailOrderReadinessStateSafe(params);

    return {
      metadataSummary: buildOrderMetadataSummary(
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
      providerKey: resolveOrderProviderKey(params.registry),
      readinessState,
      readinessStateLabel: getEmailOrderReadinessStateLabel(readinessState),
      status: params.registry.status,
      templateCategory: "order",
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
    console.error("[email-order-runtime] order email record build failed", error);
    return null;
  }
}

export function buildEmailOrderEmailRecordsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailOrderEmailRecord[] {
  try {
    const items = Array.isArray(registryItems) ? registryItems : [];
    const templateRecords = buildEmailTemplateRegistryRecordsSafe(items, resolveTemplateStatus).filter(
      (record) => record.category === "order"
    );
    const previewRecords = buildEmailTemplatePreviewRecordsSafe(templateRecords);
    const versionRecords = buildEmailTemplateVersionRecordsSafe(templateRecords);
    const validationRecords = buildEmailTemplateValidationRecordsSafe(templateRecords);
    const previewByKey = new Map(previewRecords.map((record) => [record.templateKey, record]));
    const versionByKey = new Map(versionRecords.map((record) => [record.templateKey, record]));
    const validationByKey = new Map(validationRecords.map((record) => [record.templateKey, record]));
    const providerReady = resolvePlatformProviderReady();

    const orderSection = filterEmailRegistryItemsByType(items, "transactional_section").find((item) => {
      const metadata = item.metadata ?? {};
      return text(metadata.section_key, 80) === "order" || text(item.slug, 80) === "order-emails";
    });
    const transactionalNote =
      text(orderSection?.metadata?.note, 500) ||
      text(orderSection?.description, 500) ||
      null;

    if (!templateRecords.length) {
      return [];
    }

    return templateRecords
      .map((registry) =>
        buildEmailOrderEmailRecordSafe({
          preview: previewByKey.get(registry.templateKey) ?? null,
          providerReady,
          registry,
          transactionalNote,
          validation: validationByKey.get(registry.templateKey) ?? null,
          version: versionByKey.get(registry.templateKey) ?? null
        })
      )
      .filter((record): record is EmailOrderEmailRecord => Boolean(record));
  } catch (error) {
    console.error("[email-order-runtime] order email records build failed", error);
    return [];
  }
}

export function buildEmailOrderEmailStatsSafe(
  registryItems: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailOrderEmailStats {
  try {
    const records = buildEmailOrderEmailRecordsSafe(registryItems, resolveTemplateStatus);

    if (!records.length) {
      return {
        activeOrderEmails: 0,
        draftOrderEmails: 0,
        invalidOrderEmails: 0,
        missingProviderOrderEmails: 0,
        missingTemplateOrderEmails: 1,
        needsReviewOrderEmails: 0,
        placeholderOrderEmails: 0,
        readyOrderEmails: 0,
        totalOrderEmails: 0,
        unknownOrderEmails: 0
      };
    }

    return {
      activeOrderEmails: records.filter((record) => record.readinessState === "active").length,
      draftOrderEmails: records.filter((record) => record.readinessState === "draft").length,
      invalidOrderEmails: records.filter((record) => record.readinessState === "invalid").length,
      missingProviderOrderEmails: records.filter((record) => record.readinessState === "missing_provider")
        .length,
      missingTemplateOrderEmails: 0,
      needsReviewOrderEmails: records.filter((record) => record.readinessState === "needs_review").length,
      placeholderOrderEmails: records.filter((record) => record.readinessState === "placeholder").length,
      readyOrderEmails: records.filter((record) => record.readinessState === "ready").length,
      totalOrderEmails: records.length,
      unknownOrderEmails: records.filter((record) => record.readinessState === "unknown").length
    };
  } catch (error) {
    console.error("[email-order-runtime] order email stats build failed", error);

    return {
      activeOrderEmails: 0,
      draftOrderEmails: 0,
      invalidOrderEmails: 0,
      missingProviderOrderEmails: 0,
      missingTemplateOrderEmails: 0,
      needsReviewOrderEmails: 0,
      placeholderOrderEmails: 0,
      readyOrderEmails: 0,
      totalOrderEmails: 0,
      unknownOrderEmails: 0
    };
  }
}

export function listEmailOrderReadinessCatalog() {
  return EMAIL_ORDER_READINESS_STATES.map((readinessState) => ({
    description: getEmailOrderReadinessStateDescription(readinessState),
    label: getEmailOrderReadinessStateLabel(readinessState),
    readinessState
  }));
}
