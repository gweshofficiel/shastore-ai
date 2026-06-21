import "server-only";

import type { EmailTemplateRegistryRecord } from "@/src/lib/email/email-template-registry-runtime";
import type {
  EmailRegistryStatus,
  EmailTemplateDisplayStatus
} from "@/src/lib/email/email-status-runtime";

export type EmailTemplateVersionState =
  | "draft_available"
  | "invalid"
  | "needs_review"
  | "published"
  | "unknown"
  | "unversioned"
  | "versioned";

export type EmailTemplateVersionBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type EmailTemplateVersionRecord = {
  currentVersionLabel: string | null;
  draftVersionLabel: string | null;
  lastUpdatedLabel: string;
  metadataSummary: string;
  publishedVersionLabel: string | null;
  templateKey: string;
  versionState: EmailTemplateVersionState;
  versionStateLabel: string;
};

export type EmailTemplateVersionStats = {
  draftAvailableTemplates: number;
  invalidTemplates: number;
  needsReviewTemplates: number;
  publishedTemplates: number;
  totalTemplates: number;
  unknownTemplates: number;
  unversionedTemplates: number;
  versionedTemplates: number;
};

export type EmailTemplateVersionSource = {
  lastUpdated?: string | null;
  metadata?: Record<string, unknown>;
  metadataSummary?: string;
  registryStatus?: EmailRegistryStatus;
  status?: EmailTemplateDisplayStatus;
  templateKey?: string;
};

export const EMAIL_TEMPLATE_VERSION_STATES: readonly EmailTemplateVersionState[] = [
  "versioned",
  "unversioned",
  "draft_available",
  "published",
  "needs_review",
  "invalid",
  "unknown"
] as const;

const versionStateLabels: Record<EmailTemplateVersionState, string> = {
  draft_available: "Draft available",
  invalid: "Invalid foundation",
  needs_review: "Needs review",
  published: "Published foundation",
  unknown: "Unknown",
  unversioned: "Unversioned",
  versioned: "Versioned foundation"
};

const versionStateDescriptions: Record<EmailTemplateVersionState, string> = {
  draft_available: "Draft template foundation is available. No version publishing connected.",
  invalid: "Template version foundation could not be resolved from registry data.",
  needs_review: "Template version foundation requires admin review. No rollback execution connected.",
  published: "Published template foundation state from registry metadata only.",
  unknown: "Template version state could not be resolved safely.",
  unversioned: "Template foundation exists without version tracking metadata.",
  versioned: "Template foundation is version-tracked at registry level only."
};

const badgeToneByVersionState: Record<EmailTemplateVersionState, EmailTemplateVersionBadgeTone> = {
  draft_available: "amber",
  invalid: "red",
  needs_review: "amber",
  published: "green",
  unknown: "red",
  unversioned: "slate",
  versioned: "blue"
};

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|sb_secret|smtp|provider[_-]?config|@[a-z0-9.-]+\.[a-z]{2,})/i;

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

function safeVersionLabel(value: unknown) {
  const cleaned = text(value, 80);
  if (!cleaned || secretPattern.test(cleaned)) return null;
  return cleaned;
}

export function isValidEmailTemplateVersionState(value: unknown): value is EmailTemplateVersionState {
  return typeof value === "string" && EMAIL_TEMPLATE_VERSION_STATES.includes(value as EmailTemplateVersionState);
}

export function parseEmailTemplateVersionState(value: unknown): EmailTemplateVersionState | null {
  const cleaned = text(value, 80);
  return isValidEmailTemplateVersionState(cleaned) ? cleaned : null;
}

export function getEmailTemplateVersionStateLabel(state: EmailTemplateVersionState) {
  return versionStateLabels[state];
}

export function getEmailTemplateVersionStateDescription(state: EmailTemplateVersionState) {
  return versionStateDescriptions[state];
}

export function getEmailTemplateVersionBadgeTone(state: EmailTemplateVersionState): EmailTemplateVersionBadgeTone {
  return badgeToneByVersionState[state];
}

export function resolveEmailTemplateVersionStateSafe(source: EmailTemplateVersionSource): EmailTemplateVersionState {
  const templateKey = text(source.templateKey, 160);

  if (!templateKey) {
    return "invalid";
  }

  if (source.status === "disabled") {
    return "needs_review";
  }

  if (source.status === "active") {
    return "published";
  }

  if (source.status === "draft") {
    return source.registryStatus === "placeholder" ? "unversioned" : "draft_available";
  }

  if (source.registryStatus === "placeholder" || source.registryStatus === "reserved_placeholder") {
    return "unversioned";
  }

  if (templateKey) {
    return "versioned";
  }

  return "unknown";
}

export function resolveEmailTemplateLastUpdatedLabelSafe(lastUpdated?: string | null) {
  const updatedAt = text(lastUpdated, 80);

  if (updatedAt) {
    return `Registry reference only (${updatedAt.slice(0, 10)})`;
  }

  return "Not version-tracked live";
}

export function resolveEmailTemplateVersionLabelsSafe(
  source: EmailTemplateVersionSource,
  versionState: EmailTemplateVersionState
) {
  const metadata = source.metadata ?? {};
  const currentFromMetadata = safeVersionLabel(metadata.current_version_label);
  const draftFromMetadata = safeVersionLabel(metadata.draft_version_label);
  const publishedFromMetadata = safeVersionLabel(metadata.published_version_label);

  const draftVersionLabel =
    draftFromMetadata ??
    (versionState === "draft_available" || versionState === "unversioned"
      ? "Draft foundation available"
      : null);

  const publishedVersionLabel =
    publishedFromMetadata ??
    (versionState === "published" || versionState === "versioned"
      ? "Published foundation"
      : null);

  const currentVersionLabel =
    currentFromMetadata ??
    (versionState === "published"
      ? "Current published foundation"
      : versionState === "draft_available"
        ? "Current draft foundation"
        : versionState === "versioned"
          ? "Current registry foundation"
          : versionState === "needs_review"
            ? "Review required foundation"
            : null);

  return {
    currentVersionLabel,
    draftVersionLabel,
    publishedVersionLabel
  };
}

export function buildEmailTemplateVersionRecordSafe(
  record: EmailTemplateRegistryRecord | EmailTemplateVersionSource
): EmailTemplateVersionRecord | null {
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

    const source: EmailTemplateVersionSource = {
      lastUpdated: "lastUpdated" in record ? record.lastUpdated : undefined,
      metadata: "metadata" in record && record.metadata ? (record.metadata as Record<string, unknown>) : undefined,
      metadataSummary: "metadataSummary" in record ? record.metadataSummary : undefined,
      registryStatus: "registryStatus" in record ? record.registryStatus : undefined,
      status: "status" in record ? record.status : undefined,
      templateKey
    };

    const versionState = resolveEmailTemplateVersionStateSafe(source);
    const labels = resolveEmailTemplateVersionLabelsSafe(source, versionState);

    return {
      ...labels,
      lastUpdatedLabel: resolveEmailTemplateLastUpdatedLabelSafe(source.lastUpdated),
      metadataSummary:
        text(source.metadataSummary, 500) ||
        getEmailTemplateVersionStateDescription(versionState),
      templateKey,
      versionState,
      versionStateLabel: getEmailTemplateVersionStateLabel(versionState)
    };
  } catch (error) {
    console.error("[email-template-version-runtime] template version record build failed", error);
    return null;
  }
}

export function buildEmailTemplateVersionRecordsSafe(
  records: EmailTemplateRegistryRecord[] | null | undefined
): EmailTemplateVersionRecord[] {
  try {
    return (Array.isArray(records) ? records : [])
      .map((record) => buildEmailTemplateVersionRecordSafe(record))
      .filter((record): record is EmailTemplateVersionRecord => Boolean(record));
  } catch (error) {
    console.error("[email-template-version-runtime] template version records build failed", error);
    return [];
  }
}

export function buildEmailTemplateVersionStatsSafe(
  records: EmailTemplateRegistryRecord[] | null | undefined
): EmailTemplateVersionStats {
  try {
    const versionRecords = buildEmailTemplateVersionRecordsSafe(records);

    return {
      draftAvailableTemplates: versionRecords.filter((record) => record.versionState === "draft_available").length,
      invalidTemplates: versionRecords.filter((record) => record.versionState === "invalid").length,
      needsReviewTemplates: versionRecords.filter((record) => record.versionState === "needs_review").length,
      publishedTemplates: versionRecords.filter((record) => record.versionState === "published").length,
      totalTemplates: versionRecords.length,
      unknownTemplates: versionRecords.filter((record) => record.versionState === "unknown").length,
      unversionedTemplates: versionRecords.filter((record) => record.versionState === "unversioned").length,
      versionedTemplates: versionRecords.filter((record) => record.versionState === "versioned").length
    };
  } catch (error) {
    console.error("[email-template-version-runtime] template version stats build failed", error);

    return {
      draftAvailableTemplates: 0,
      invalidTemplates: 0,
      needsReviewTemplates: 0,
      publishedTemplates: 0,
      totalTemplates: 0,
      unknownTemplates: 0,
      unversionedTemplates: 0,
      versionedTemplates: 0
    };
  }
}

export function listEmailTemplateVersionCatalog() {
  return EMAIL_TEMPLATE_VERSION_STATES.map((versionState) => ({
    badgeTone: getEmailTemplateVersionBadgeTone(versionState),
    description: getEmailTemplateVersionStateDescription(versionState),
    label: getEmailTemplateVersionStateLabel(versionState),
    versionState
  }));
}
