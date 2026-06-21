import "server-only";

import type { EmailTemplateRegistryRecord } from "@/src/lib/email/email-template-registry-runtime";
import {
  buildEmailTemplatePreviewRecordsSafe,
  type EmailTemplatePreviewRecord
} from "@/src/lib/email/email-template-preview-runtime";
import {
  buildEmailTemplateVersionRecordsSafe,
  type EmailTemplateVersionRecord
} from "@/src/lib/email/email-template-version-runtime";

export type EmailTemplateValidationState =
  | "invalid"
  | "missing_body"
  | "missing_subject"
  | "missing_variables"
  | "needs_review"
  | "placeholder"
  | "unsafe_content"
  | "unknown"
  | "valid";

export type EmailTemplateValidationBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type EmailTemplateValidationRecord = {
  issueLabels: string[];
  metadataSummary: string;
  templateKey: string;
  validationState: EmailTemplateValidationState;
  validationStateLabel: string;
  validationSummary: string;
};

export type EmailTemplateValidationStats = {
  invalidTemplates: number;
  missingBodyTemplates: number;
  missingSubjectTemplates: number;
  missingVariablesTemplates: number;
  needsReviewTemplates: number;
  placeholderTemplates: number;
  totalTemplates: number;
  unknownTemplates: number;
  unsafeContentTemplates: number;
  validTemplates: number;
};

export const EMAIL_TEMPLATE_VALIDATION_STATES: readonly EmailTemplateValidationState[] = [
  "valid",
  "needs_review",
  "invalid",
  "missing_subject",
  "missing_body",
  "unsafe_content",
  "missing_variables",
  "placeholder",
  "unknown"
] as const;

const validationStateLabels: Record<EmailTemplateValidationState, string> = {
  invalid: "Invalid template foundation",
  missing_body: "Missing body preview summary",
  missing_subject: "Missing subject preview",
  missing_variables: "Missing variable placeholders summary",
  needs_review: "Needs review",
  placeholder: "Placeholder validation",
  unsafe_content: "Unsafe content detected",
  unknown: "Unknown validation state",
  valid: "Valid readiness"
};

const validationStateDescriptions: Record<EmailTemplateValidationState, string> = {
  invalid: "Template validation foundation could not be resolved safely.",
  missing_body: "Safe body preview summary is missing for validation readiness.",
  missing_subject: "Safe subject preview is missing for validation readiness.",
  missing_variables: "Safe variable placeholder summary is missing for validation readiness.",
  needs_review: "Template validation requires admin review. No mutation connected.",
  placeholder: "Placeholder template validation foundation only.",
  unsafe_content: "Validation detected unsafe or secret-like content patterns in safe summaries.",
  unknown: "Template validation state could not be resolved safely.",
  valid: "Template passed safe read-only validation readiness checks."
};

const badgeToneByValidationState: Record<EmailTemplateValidationState, EmailTemplateValidationBadgeTone> = {
  invalid: "red",
  missing_body: "amber",
  missing_subject: "amber",
  missing_variables: "amber",
  needs_review: "amber",
  placeholder: "slate",
  unsafe_content: "red",
  unknown: "red",
  valid: "green"
};

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|provider[_-]?config|@[a-z0-9.-]+\.[a-z]{2,})/i;

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

function containsUnsafeContent(...values: Array<string | null | undefined>) {
  return values.some((value) => {
    const cleaned = text(value, 500);
    return cleaned ? secretPattern.test(cleaned) : false;
  });
}

export function isValidEmailTemplateValidationState(value: unknown): value is EmailTemplateValidationState {
  return typeof value === "string" && EMAIL_TEMPLATE_VALIDATION_STATES.includes(value as EmailTemplateValidationState);
}

export function parseEmailTemplateValidationState(value: unknown): EmailTemplateValidationState | null {
  const cleaned = text(value, 80);
  return isValidEmailTemplateValidationState(cleaned) ? cleaned : null;
}

export function getEmailTemplateValidationStateLabel(state: EmailTemplateValidationState) {
  return validationStateLabels[state];
}

export function getEmailTemplateValidationStateDescription(state: EmailTemplateValidationState) {
  return validationStateDescriptions[state];
}

export function getEmailTemplateValidationBadgeTone(state: EmailTemplateValidationState): EmailTemplateValidationBadgeTone {
  return badgeToneByValidationState[state];
}

export function validateEmailTemplateReadinessSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  registry: EmailTemplateRegistryRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): {
  issueLabels: string[];
  validationState: EmailTemplateValidationState;
} {
  const registry = params.registry;
  const preview = params.preview ?? null;
  const version = params.version ?? null;
  const issueLabels: string[] = [];

  const templateKey = text(registry?.templateKey ?? preview?.templateKey, 160);
  if (!templateKey || !registry) {
    issueLabels.push("Missing safe template key");
    return { issueLabels, validationState: "invalid" };
  }

  if (!registry.category) {
    issueLabels.push("Missing safe template category");
    return { issueLabels, validationState: "invalid" };
  }

  if (!registry.status) {
    issueLabels.push("Missing safe template status");
    return { issueLabels, validationState: "invalid" };
  }

  if (
    containsUnsafeContent(
      registry.metadataSummary,
      registry.description,
      preview?.metadataSummary,
      preview?.subjectPreview,
      preview?.bodyPreviewSummary,
      preview?.variablePlaceholdersSummary
    )
  ) {
    issueLabels.push("Unsafe or secret-like content pattern detected");
    return { issueLabels, validationState: "unsafe_content" };
  }

  if (
    preview?.previewState === "placeholder" ||
    version?.versionState === "unversioned" ||
    /placeholder/i.test(registry.name) ||
    /placeholder/i.test(registry.slug)
  ) {
    issueLabels.push("Placeholder template foundation");
    return { issueLabels, validationState: "placeholder" };
  }

  if (
    registry.status === "disabled" ||
    version?.versionState === "needs_review" ||
    preview?.previewState === "needs_review"
  ) {
    issueLabels.push("Template requires admin review");
    return { issueLabels, validationState: "needs_review" };
  }

  if (preview?.previewState === "invalid" || version?.versionState === "invalid") {
    issueLabels.push("Invalid template preview or version foundation");
    return { issueLabels, validationState: "invalid" };
  }

  if (preview?.previewState === "preview_unavailable" || registry.status === "draft") {
    issueLabels.push("Draft template preview unavailable");
    return { issueLabels, validationState: "needs_review" };
  }

  if (preview?.previewState === "preview_ready" || registry.status === "active") {
    if (!text(preview?.subjectPreview, 160)) {
      issueLabels.push("Missing safe subject preview");
      return { issueLabels, validationState: "missing_subject" };
    }

    if (!text(preview?.bodyPreviewSummary, 240)) {
      issueLabels.push("Missing safe body preview summary");
      return { issueLabels, validationState: "missing_body" };
    }

    if (!text(preview?.variablePlaceholdersSummary, 240)) {
      issueLabels.push("Missing safe variable placeholders summary");
      return { issueLabels, validationState: "missing_variables" };
    }

    return { issueLabels: ["Safe validation readiness checks passed"], validationState: "valid" };
  }

  if (preview?.previewState === "unknown" || version?.versionState === "unknown") {
    issueLabels.push("Template validation state unknown");
    return { issueLabels, validationState: "unknown" };
  }

  issueLabels.push("Template validation state could not be resolved");
  return { issueLabels, validationState: "unknown" };
}

export function buildEmailTemplateValidationRecordSafe(params: {
  preview: EmailTemplatePreviewRecord | null | undefined;
  registry: EmailTemplateRegistryRecord;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailTemplateValidationRecord | null {
  try {
    const { issueLabels, validationState } = validateEmailTemplateReadinessSafe(params);
    const templateKey = text(params.registry.templateKey, 160);

    if (!templateKey) {
      return null;
    }

    return {
      issueLabels,
      metadataSummary:
        text(params.registry.metadataSummary, 500) ||
        text(params.preview?.metadataSummary, 500) ||
        getEmailTemplateValidationStateDescription(validationState),
      templateKey,
      validationState,
      validationStateLabel: getEmailTemplateValidationStateLabel(validationState),
      validationSummary: getEmailTemplateValidationStateDescription(validationState)
    };
  } catch (error) {
    console.error("[email-template-validation-runtime] template validation record build failed", error);
    return null;
  }
}

export function buildEmailTemplateValidationRecordsSafe(
  registryRecords: EmailTemplateRegistryRecord[] | null | undefined
): EmailTemplateValidationRecord[] {
  try {
    const records = Array.isArray(registryRecords) ? registryRecords : [];
    const previewRecords = buildEmailTemplatePreviewRecordsSafe(records);
    const versionRecords = buildEmailTemplateVersionRecordsSafe(records);
    const previewByKey = new Map(previewRecords.map((record) => [record.templateKey, record]));
    const versionByKey = new Map(versionRecords.map((record) => [record.templateKey, record]));

    return records
      .map((registry) =>
        buildEmailTemplateValidationRecordSafe({
          preview: previewByKey.get(registry.templateKey) ?? null,
          registry,
          version: versionByKey.get(registry.templateKey) ?? null
        })
      )
      .filter((record): record is EmailTemplateValidationRecord => Boolean(record));
  } catch (error) {
    console.error("[email-template-validation-runtime] template validation records build failed", error);
    return [];
  }
}

export function buildEmailTemplateValidationStatsSafe(
  registryRecords: EmailTemplateRegistryRecord[] | null | undefined
): EmailTemplateValidationStats {
  try {
    const validationRecords = buildEmailTemplateValidationRecordsSafe(registryRecords);

    return {
      invalidTemplates: validationRecords.filter((record) => record.validationState === "invalid").length,
      missingBodyTemplates: validationRecords.filter((record) => record.validationState === "missing_body").length,
      missingSubjectTemplates: validationRecords.filter((record) => record.validationState === "missing_subject")
        .length,
      missingVariablesTemplates: validationRecords.filter((record) => record.validationState === "missing_variables")
        .length,
      needsReviewTemplates: validationRecords.filter((record) => record.validationState === "needs_review").length,
      placeholderTemplates: validationRecords.filter((record) => record.validationState === "placeholder").length,
      totalTemplates: validationRecords.length,
      unknownTemplates: validationRecords.filter((record) => record.validationState === "unknown").length,
      unsafeContentTemplates: validationRecords.filter((record) => record.validationState === "unsafe_content").length,
      validTemplates: validationRecords.filter((record) => record.validationState === "valid").length
    };
  } catch (error) {
    console.error("[email-template-validation-runtime] template validation stats build failed", error);

    return {
      invalidTemplates: 0,
      missingBodyTemplates: 0,
      missingSubjectTemplates: 0,
      missingVariablesTemplates: 0,
      needsReviewTemplates: 0,
      placeholderTemplates: 0,
      totalTemplates: 0,
      unknownTemplates: 0,
      unsafeContentTemplates: 0,
      validTemplates: 0
    };
  }
}

export function listEmailTemplateValidationCatalog() {
  return EMAIL_TEMPLATE_VALIDATION_STATES.map((validationState) => ({
    badgeTone: getEmailTemplateValidationBadgeTone(validationState),
    description: getEmailTemplateValidationStateDescription(validationState),
    label: getEmailTemplateValidationStateLabel(validationState),
    validationState
  }));
}
