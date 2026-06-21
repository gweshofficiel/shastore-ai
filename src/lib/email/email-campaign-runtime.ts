import "server-only";

import { filterEmailRegistryItemsByType } from "@/src/lib/email/email-type-runtime";
import {
  resolveEmailProviderStatusSafe,
  type EmailProviderKey
} from "@/src/lib/email/email-provider-runtime";
import {
  buildEmailTemplateRegistryRecordsSafe,
  type EmailTemplateRegistryItem
} from "@/src/lib/email/email-template-registry-runtime";
import {
  buildEmailTemplatePreviewRecordsSafe,
  type EmailTemplatePreviewRecord
} from "@/src/lib/email/email-template-preview-runtime";
import type { EmailTemplateDisplayStatus } from "@/src/lib/email/email-status-runtime";
import {
  buildEmailTemplateValidationRecordsSafe,
  type EmailTemplateValidationRecord
} from "@/src/lib/email/email-template-validation-runtime";
import {
  buildEmailTemplateVersionRecordsSafe,
  type EmailTemplateVersionRecord
} from "@/src/lib/email/email-template-version-runtime";

type EmailCampaignRegistryItem = {
  category?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  name?: string | null;
  providerKey?: string | null;
  registryKey?: string | null;
  registryType: "campaign_scope" | "future_hook" | "provider" | "queue_summary" | "template" | "transactional_section";
  slug?: string | null;
  status?: string | null;
};

export type EmailCampaignReadinessState =
  | "campaign_ready"
  | "disabled"
  | "draft"
  | "invalid"
  | "missing_provider"
  | "missing_template"
  | "needs_review"
  | "unknown";

export type EmailCampaignEmailRecord = {
  campaignEmailLabel: string;
  campaignScopeLabel: string;
  metadataSummary: string;
  providerKey: EmailProviderKey | null;
  readinessState: EmailCampaignReadinessState;
  readinessStateLabel: string;
  templateKey: string;
};

export type EmailCampaignEmailStats = {
  campaignReadyCampaignEmails: number;
  disabledCampaignEmails: number;
  draftCampaignEmails: number;
  invalidCampaignEmails: number;
  missingProviderCampaignEmails: number;
  missingTemplateCampaignEmails: number;
  needsReviewCampaignEmails: number;
  totalCampaignEmails: number;
  unknownCampaignEmails: number;
};

export const EMAIL_CAMPAIGN_READINESS_STATES: readonly EmailCampaignReadinessState[] = [
  "campaign_ready",
  "draft",
  "needs_review",
  "invalid",
  "missing_template",
  "missing_provider",
  "disabled",
  "unknown"
] as const;

const readinessStateLabels: Record<EmailCampaignReadinessState, string> = {
  campaign_ready: "Campaign email ready",
  disabled: "Campaign email disabled",
  draft: "Draft campaign email",
  invalid: "Invalid campaign email foundation",
  missing_provider: "Missing provider readiness",
  missing_template: "Missing campaign template",
  needs_review: "Campaign email needs review",
  unknown: "Unknown campaign email readiness"
};

const readinessStateDescriptions: Record<EmailCampaignReadinessState, string> = {
  campaign_ready:
    "Campaign email readiness foundation looks complete. No campaign sending, mass sending, or queue execution connected.",
  disabled: "Campaign email scope is disabled in registry foundation. No campaign sending connected.",
  draft: "Campaign email scope is in draft foundation state. No campaign sending connected.",
  invalid: "Campaign email foundation could not be validated safely.",
  missing_provider: "Platform email provider is not configured for campaign email readiness.",
  missing_template: "No campaign email template foundation was found in the registry.",
  needs_review: "Campaign email foundation requires admin review. No campaign sending connected.",
  unknown: "Campaign email readiness could not be resolved safely."
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

export function getEmailCampaignReadinessStateLabel(state: EmailCampaignReadinessState) {
  return readinessStateLabels[state];
}

export function getEmailCampaignReadinessStateDescription(state: EmailCampaignReadinessState) {
  return readinessStateDescriptions[state];
}

export function resolveEmailCampaignReadinessStateSafe(params: {
  campaignTemplateCount: number;
  isCampaignScope: boolean;
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registryStatus: string;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailCampaignReadinessState {
  const { campaignTemplateCount, isCampaignScope, preview, providerReady, registryStatus, validation, version } =
    params;

  if (registryStatus === "disabled") {
    return "disabled";
  }

  if (validation?.validationState === "invalid") {
    return "invalid";
  }

  if (registryStatus === "placeholder") {
    return "needs_review";
  }

  if (
    validation?.validationState === "needs_review" ||
    preview?.previewState === "needs_review" ||
    version?.versionState === "needs_review"
  ) {
    return "needs_review";
  }

  if (registryStatus === "draft" || preview?.previewState === "preview_unavailable") {
    return "draft";
  }

  if (!providerReady) {
    return "missing_provider";
  }

  if (isCampaignScope) {
    if (
      registryStatus === "monitoring" ||
      registryStatus === "active" ||
      registryStatus === "configured" ||
      registryStatus === "healthy"
    ) {
      return "campaign_ready";
    }

    return "unknown";
  }

  if (campaignTemplateCount === 0) {
    return "missing_template";
  }

  if (
    registryStatus === "monitoring" ||
    registryStatus === "active" ||
    registryStatus === "configured" ||
    registryStatus === "healthy"
  ) {
    return "campaign_ready";
  }

  return "unknown";
}

function resolveCampaignProviderKey(
  registry: EmailCampaignRegistryItem,
  linkedTemplateItem: EmailCampaignRegistryItem | null
): EmailProviderKey | null {
  const linkedProviderKey = text(linkedTemplateItem?.providerKey, 40);
  if (linkedProviderKey === "resend" || linkedProviderKey === "smtp" || linkedProviderKey === "future") {
    return linkedProviderKey;
  }

  const providerKey = text(registry.providerKey, 40);
  if (providerKey === "resend" || providerKey === "smtp" || providerKey === "future") {
    return providerKey;
  }

  return resolvePlatformProviderReady() ? "resend" : null;
}

function buildCampaignMetadataSummary(
  registry: EmailCampaignRegistryItem,
  scopeNote: string | null,
  readinessState: EmailCampaignReadinessState,
  campaignTotal: number
) {
  const note = scopeNote || text(registry.description, 500);
  const totalSummary =
    campaignTotal > 0
      ? `Read-only campaign summary count ${campaignTotal}.`
      : "Read-only campaign summary foundation only.";

  if (note) {
    return `${note} ${totalSummary} Campaign email readiness foundation only.`;
  }

  return `${readinessStateDescriptions[readinessState]} ${totalSummary}`;
}

function resolveCampaignTemplateItems(items: EmailCampaignRegistryItem[]) {
  return items.filter(
    (item) => item.registryType === "template" && text(item.category, 80) === "campaign"
  );
}

function resolveCampaignTemplateKey(item: EmailCampaignRegistryItem | null) {
  if (!item) return "";

  const metadata =
    item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : null;

  return (
    text(metadata?.template_id, 160) ||
    text(item.slug, 160) ||
    text(item.registryKey, 160) ||
    ""
  );
}

function resolveLinkedCampaignTemplate(
  registry: EmailCampaignRegistryItem,
  templateItems: EmailCampaignRegistryItem[]
) {
  const slug = text(registry.slug, 160);
  const registryKey = text(registry.registryKey, 160);

  return (
    templateItems.find(
      (item) =>
        text(item.slug, 160) === slug ||
        text(item.registryKey, 160) === registryKey ||
        text(item.slug, 160) === registryKey
    ) ?? templateItems[0] ??
    null
  );
}

export function buildEmailCampaignEmailRecordSafe(params: {
  campaignTemplateCount: number;
  campaignTotal: number;
  preview: EmailTemplatePreviewRecord | null | undefined;
  providerReady: boolean;
  registry: EmailCampaignRegistryItem;
  linkedTemplateItem: EmailCampaignRegistryItem | null;
  validation: EmailTemplateValidationRecord | null | undefined;
  version: EmailTemplateVersionRecord | null | undefined;
}): EmailCampaignEmailRecord | null {
  try {
    if (params.registry.registryType !== "campaign_scope") {
      return null;
    }

    const campaignEmailLabel = text(params.registry.name, 200) || "Campaign email";
    const campaignScopeLabel = campaignEmailLabel;
    const templateKey =
      resolveCampaignTemplateKey(params.linkedTemplateItem) ||
      text(params.registry.slug, 160) ||
      text(params.registry.registryKey, 160) ||
      "campaign-scope";
    const registryStatus = text(params.registry.status, 80) || "unknown";
    const readinessState = resolveEmailCampaignReadinessStateSafe({
      campaignTemplateCount: params.campaignTemplateCount,
      isCampaignScope: params.registry.registryType === "campaign_scope",
      preview: params.preview,
      providerReady: params.providerReady,
      registryStatus,
      validation: params.validation,
      version: params.version
    });

    return {
      campaignEmailLabel,
      campaignScopeLabel,
      metadataSummary: buildCampaignMetadataSummary(
        params.registry,
        text(params.registry.metadata?.note, 500) || null,
        readinessState,
        params.campaignTotal
      ),
      providerKey: resolveCampaignProviderKey(params.registry, params.linkedTemplateItem),
      readinessState,
      readinessStateLabel: getEmailCampaignReadinessStateLabel(readinessState),
      templateKey
    };
  } catch (error) {
    console.error("[email-campaign-runtime] campaign email record build failed", error);
    return null;
  }
}

export function buildEmailCampaignEmailRecordsSafe(
  registryItems: EmailCampaignRegistryItem[] | null | undefined,
  resolveCampaignTotals?: (slug: string) => { lastActivity: string | null; total: number },
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailCampaignEmailRecord[] {
  try {
    const items = Array.isArray(registryItems) ? registryItems : [];
    const templateItems = items.filter((item) => item.registryType === "template");
    const campaignTemplateItems = resolveCampaignTemplateItems(items);
    const templateRecords = buildEmailTemplateRegistryRecordsSafe(
      templateItems as EmailTemplateRegistryItem[],
      resolveTemplateStatus
    );
    const previewRecords = buildEmailTemplatePreviewRecordsSafe(templateRecords);
    const versionRecords = buildEmailTemplateVersionRecordsSafe(templateRecords);
    const validationRecords = buildEmailTemplateValidationRecordsSafe(templateRecords);
    const previewByKey = new Map(previewRecords.map((record) => [record.templateKey, record]));
    const versionByKey = new Map(versionRecords.map((record) => [record.templateKey, record]));
    const validationByKey = new Map(validationRecords.map((record) => [record.templateKey, record]));
    const providerReady = resolvePlatformProviderReady();
    const campaignScopes = filterEmailRegistryItemsByType(items, "campaign_scope");

    if (!campaignScopes.length) {
      return [];
    }

    return campaignScopes
      .map((registry) => {
        const slug = text(registry.slug, 160);
        const totals = resolveCampaignTotals?.(slug) ?? { lastActivity: null, total: 0 };
        const linkedTemplateItem = resolveLinkedCampaignTemplate(registry, campaignTemplateItems);
        const templateKey = resolveCampaignTemplateKey(linkedTemplateItem) || slug;

        return buildEmailCampaignEmailRecordSafe({
          campaignTemplateCount: campaignTemplateItems.length,
          campaignTotal: totals.total,
          preview: templateKey ? previewByKey.get(templateKey) ?? null : null,
          providerReady,
          registry,
          linkedTemplateItem,
          validation: templateKey ? validationByKey.get(templateKey) ?? null : null,
          version: templateKey ? versionByKey.get(templateKey) ?? null : null
        });
      })
      .filter((record): record is EmailCampaignEmailRecord => Boolean(record));
  } catch (error) {
    console.error("[email-campaign-runtime] campaign email records build failed", error);
    return [];
  }
}

export function buildEmailCampaignEmailStatsSafe(
  registryItems: EmailCampaignRegistryItem[] | null | undefined,
  resolveCampaignTotals?: (slug: string) => { lastActivity: string | null; total: number },
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailCampaignEmailStats {
  try {
    const records = buildEmailCampaignEmailRecordsSafe(
      registryItems,
      resolveCampaignTotals,
      resolveTemplateStatus
    );

    if (!records.length) {
      return {
        campaignReadyCampaignEmails: 0,
        disabledCampaignEmails: 0,
        draftCampaignEmails: 0,
        invalidCampaignEmails: 0,
        missingProviderCampaignEmails: 0,
        missingTemplateCampaignEmails: 0,
        needsReviewCampaignEmails: 0,
        totalCampaignEmails: 0,
        unknownCampaignEmails: 0
      };
    }

    return {
      campaignReadyCampaignEmails: records.filter((record) => record.readinessState === "campaign_ready").length,
      disabledCampaignEmails: records.filter((record) => record.readinessState === "disabled").length,
      draftCampaignEmails: records.filter((record) => record.readinessState === "draft").length,
      invalidCampaignEmails: records.filter((record) => record.readinessState === "invalid").length,
      missingProviderCampaignEmails: records.filter((record) => record.readinessState === "missing_provider")
        .length,
      missingTemplateCampaignEmails: records.filter((record) => record.readinessState === "missing_template")
        .length,
      needsReviewCampaignEmails: records.filter((record) => record.readinessState === "needs_review").length,
      totalCampaignEmails: records.length,
      unknownCampaignEmails: records.filter((record) => record.readinessState === "unknown").length
    };
  } catch (error) {
    console.error("[email-campaign-runtime] campaign email stats build failed", error);

    return {
      campaignReadyCampaignEmails: 0,
      disabledCampaignEmails: 0,
      draftCampaignEmails: 0,
      invalidCampaignEmails: 0,
      missingProviderCampaignEmails: 0,
      missingTemplateCampaignEmails: 0,
      needsReviewCampaignEmails: 0,
      totalCampaignEmails: 0,
      unknownCampaignEmails: 0
    };
  }
}

export function listEmailCampaignReadinessCatalog() {
  return EMAIL_CAMPAIGN_READINESS_STATES.map((readinessState) => ({
    description: getEmailCampaignReadinessStateDescription(readinessState),
    label: getEmailCampaignReadinessStateLabel(readinessState),
    readinessState
  }));
}
