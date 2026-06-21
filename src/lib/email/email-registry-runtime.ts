import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  filterEmailRegistryItemsByType,
  parseEmailRegistryType,
  type EmailRegistryType
} from "@/src/lib/email/email-type-runtime";
import {
  buildEmailProviderViewsSafe,
  type EmailRegistryProviderView
} from "@/src/lib/email/email-provider-runtime";
import {
  mapRegistryStatusToCampaignScopeStatus,
  mapRegistryStatusToTransactionalStatus,
  parseEmailRegistryStatus,
  type EmailCampaignScopeStatus,
  type EmailRegistryStatus,
  type EmailTemplateDisplayStatus,
  type EmailTransactionalSectionStatus
} from "@/src/lib/email/email-status-runtime";

export type { EmailRegistryType } from "@/src/lib/email/email-type-runtime";
export type {
  EmailCampaignScopeStatus,
  EmailRegistryStatus,
  EmailTemplateDisplayStatus,
  EmailTransactionalSectionStatus
} from "@/src/lib/email/email-status-runtime";

import {
  buildEmailTemplateRegistryViewsSafe,
  type EmailRegistryTemplateView
} from "@/src/lib/email/email-template-registry-runtime";

export type EmailRegistryItemRecord = {
  category: string;
  createdAt: string | null;
  description: string;
  id: string;
  metadata: Record<string, unknown>;
  name: string;
  providerKey: string;
  registryKey: string;
  registryType: EmailRegistryType;
  slug: string;
  status: EmailRegistryStatus;
  updatedAt: string | null;
  usageCount: number;
};

export type { EmailProviderKey, EmailRegistryProviderView } from "@/src/lib/email/email-provider-runtime";
export type {
  EmailRegistryTemplateView,
  EmailTemplateCategory,
  EmailTemplateLanguage
} from "@/src/lib/email/email-template-registry-runtime";

export type EmailRegistryTransactionalSectionView = {
  key: string;
  name: string;
  note: string;
  status: EmailTransactionalSectionStatus;
};

export type EmailRegistryCampaignScopeView = {
  lastActivity: string | null;
  name: string;
  note: string;
  status: EmailCampaignScopeStatus;
  total: number;
};

const registrySelect =
  "id, registry_key, slug, name, registry_type, status, category, provider_key, description, usage_count, metadata, created_at, updated_at";

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

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for the email registry.");
  }

  return admin;
}

function sanitizeRegistryMetadata(metadata: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const cleanedKey = text(key, 80);
    if (!cleanedKey || secretPattern.test(cleanedKey)) continue;

    if (typeof value === "string") {
      const cleanedValue = text(value, 240);
      if (!cleanedValue || secretPattern.test(cleanedValue)) continue;
      sanitized[cleanedKey] = cleanedValue;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[cleanedKey] = value;
    }
  }

  return sanitized;
}

export function parseEmailRegistryItem(row: unknown): EmailRegistryItemRecord | null {
  if (!row || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  const id = text(record.id, 120);
  const registryKey = text(record.registry_key, 160);
  const slug = text(record.slug, 160);
  const name = text(record.name, 200);
  const registryType = parseEmailRegistryType(record.registry_type);
  const status = parseEmailRegistryStatus(record.status);

  if (!id || !registryKey || !slug || !name || !registryType || !status) {
    if (id && registryKey && !registryType) {
      console.warn(
        `[email-registry-runtime] skipped registry item with invalid registry_type: ${text(record.registry_type, 80) || "empty"}`
      );
    }

    if (id && registryKey && registryType && !status) {
      console.warn(
        `[email-registry-runtime] skipped registry item with invalid status: ${text(record.status, 80) || "empty"}`
      );
    }
    return null;
  }

  return {
    category: text(record.category, 120),
    createdAt: text(record.created_at, 80) || null,
    description: text(record.description, 2000),
    id,
    metadata: sanitizeRegistryMetadata(safeRecord(record.metadata)),
    name,
    providerKey: text(record.provider_key, 80),
    registryKey,
    registryType,
    slug,
    status,
    updatedAt: text(record.updated_at, 80) || null,
    usageCount: Math.max(0, Math.trunc(safeNumber(record.usage_count)))
  };
}

export { filterEmailRegistryItemsByType };

export function buildEmailRegistryMetadataSummary(item: EmailRegistryItemRecord) {
  if (item.description) return item.description;
  return "Email registry foundation only.";
}

export function buildEmailRegistryProvidersView(items: EmailRegistryItemRecord[]): EmailRegistryProviderView[] {
  return buildEmailProviderViewsSafe(items);
}

export function buildEmailRegistryTemplatesView(
  items: EmailRegistryItemRecord[],
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailRegistryTemplateView[] {
  return buildEmailTemplateRegistryViewsSafe(items, resolveTemplateStatus);
}

export function buildEmailRegistryTransactionalSectionsView(
  items: EmailRegistryItemRecord[]
): EmailRegistryTransactionalSectionView[] {
  return filterEmailRegistryItemsByType(items, "transactional_section").map((item) => ({
    key: text(item.metadata.section_key, 80) || item.slug,
    name: item.name,
    note: text(item.metadata.note, 500) || item.description || "Email transactional section foundation only.",
    status: mapRegistryStatusToTransactionalStatus(item.status)
  }));
}

export function buildEmailRegistryFutureHooksView(items: EmailRegistryItemRecord[]) {
  return filterEmailRegistryItemsByType(items, "future_hook").map((item) => item.name);
}

export function buildEmailRegistryCampaignMonitoringView(
  items: EmailRegistryItemRecord[],
  resolveCampaignTotals: (slug: string) => { lastActivity: string | null; total: number }
): EmailRegistryCampaignScopeView[] {
  return filterEmailRegistryItemsByType(items, "campaign_scope").map((item) => {
    const totals = resolveCampaignTotals(item.slug);

    return {
      lastActivity: totals.lastActivity,
      name: item.name,
      note: text(item.metadata.note, 500) || item.description || "Email campaign scope foundation only.",
      status: mapRegistryStatusToCampaignScopeStatus(item.status),
      total: totals.total
    };
  });
}

export const EMAIL_REGISTRY_FALLBACK_ITEMS: readonly EmailRegistryItemRecord[] = [
  {
    category: "provider",
    createdAt: null,
    description: "Primary platform email provider foundation.",
    id: "fallback-provider-resend",
    metadata: { source: "email_registry_fallback" },
    name: "Resend",
    providerKey: "resend",
    registryKey: "provider:resend",
    registryType: "provider",
    slug: "resend",
    status: "configured",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "provider",
    createdAt: null,
    description: "SMTP provider placeholder foundation only.",
    id: "fallback-provider-smtp-placeholder",
    metadata: { source: "email_registry_fallback" },
    name: "SMTP placeholder",
    providerKey: "smtp",
    registryKey: "provider:smtp-placeholder",
    registryType: "provider",
    slug: "smtp-placeholder",
    status: "placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "provider",
    createdAt: null,
    description: "Reserved placeholder for future email providers.",
    id: "fallback-provider-future-placeholder",
    metadata: { source: "email_registry_fallback" },
    name: "Future providers placeholder",
    providerKey: "future",
    registryKey: "provider:future-placeholder",
    registryType: "provider",
    slug: "future-placeholder",
    status: "placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "welcome",
    createdAt: null,
    description: "Platform welcome email template foundation.",
    id: "fallback-template-welcome-platform-user",
    metadata: { language: "English", source: "email_registry_fallback", template_id: "welcome:platform-user" },
    name: "Platform welcome email",
    providerKey: "",
    registryKey: "template:welcome-platform-user",
    registryType: "template",
    slug: "welcome-platform-user",
    status: "draft",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "billing",
    createdAt: null,
    description: "Subscription activated billing email template foundation.",
    id: "fallback-template-billing-subscription-activated",
    metadata: { language: "English", source: "email_registry_fallback", template_id: "billing:subscription-activated" },
    name: "Subscription activated",
    providerKey: "",
    registryKey: "template:billing-subscription-activated",
    registryType: "template",
    slug: "billing-subscription-activated",
    status: "active",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "billing",
    createdAt: null,
    description: "Payment failed billing email template foundation.",
    id: "fallback-template-billing-payment-failed",
    metadata: { language: "English", source: "email_registry_fallback", template_id: "billing:payment-failed" },
    name: "Payment failed",
    providerKey: "",
    registryKey: "template:billing-payment-failed",
    registryType: "template",
    slug: "billing-payment-failed",
    status: "active",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "order",
    createdAt: null,
    description: "Platform order receipt placeholder template foundation.",
    id: "fallback-template-order-platform-receipt-placeholder",
    metadata: { language: "English", source: "email_registry_fallback", template_id: "order:platform-receipt-placeholder" },
    name: "Platform order receipt placeholder",
    providerKey: "",
    registryKey: "template:order-platform-receipt-placeholder",
    registryType: "template",
    slug: "order-platform-receipt-placeholder",
    status: "draft",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "domain_email_setup",
    createdAt: null,
    description: "Domain and email setup instructions template foundation.",
    id: "fallback-template-domain-email-setup-instructions",
    metadata: { language: "English", source: "email_registry_fallback", template_id: "domain-email:setup-instructions" },
    name: "Domain and email setup instructions",
    providerKey: "",
    registryKey: "template:domain-email-setup-instructions",
    registryType: "template",
    slug: "domain-email-setup-instructions",
    status: "draft",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "support",
    createdAt: null,
    description: "Support ticket update email template foundation.",
    id: "fallback-template-support-ticket-update",
    metadata: { language: "English", source: "email_registry_fallback", template_id: "support:ticket-update" },
    name: "Support ticket update",
    providerKey: "",
    registryKey: "template:support-ticket-update",
    registryType: "template",
    slug: "support-ticket-update",
    status: "draft",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "security",
    createdAt: null,
    description: "Security account alert email template foundation.",
    id: "fallback-template-security-account-alert",
    metadata: { language: "English", source: "email_registry_fallback", template_id: "security:account-alert" },
    name: "Security account alert",
    providerKey: "",
    registryKey: "template:security-account-alert",
    registryType: "template",
    slug: "security-account-alert",
    status: "draft",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "welcome",
    createdAt: null,
    description: "Platform onboarding email foundation only.",
    id: "fallback-transactional-welcome-emails",
    metadata: { note: "Platform onboarding email foundation only.", section_key: "welcome", source: "email_registry_fallback" },
    name: "Welcome emails",
    providerKey: "",
    registryKey: "transactional:welcome-emails",
    registryType: "transactional_section",
    slug: "welcome-emails",
    status: "draft",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "billing",
    createdAt: null,
    description: "Uses existing billing notification email templates when provider is configured.",
    id: "fallback-transactional-billing-emails",
    metadata: {
      note: "Uses existing billing notification email templates when provider is configured.",
      section_key: "billing",
      source: "email_registry_fallback"
    },
    name: "Billing emails",
    providerKey: "",
    registryKey: "transactional:billing-emails",
    registryType: "transactional_section",
    slug: "billing-emails",
    status: "active",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "order",
    createdAt: null,
    description: "Store order emails remain managed by Store Owner email systems.",
    id: "fallback-transactional-order-emails",
    metadata: { note: "Store order emails remain managed by Store Owner email systems.", section_key: "order", source: "email_registry_fallback" },
    name: "Order emails",
    providerKey: "",
    registryKey: "transactional:order-emails",
    registryType: "transactional_section",
    slug: "order-emails",
    status: "placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "domain_email_setup",
    createdAt: null,
    description: "Professional Email mailbox setup remains in Domains & Hosting.",
    id: "fallback-transactional-domain-email-setup-emails",
    metadata: {
      note: "Professional Email mailbox setup remains in Domains & Hosting.",
      section_key: "domain_email_setup",
      source: "email_registry_fallback"
    },
    name: "Domain/email setup emails",
    providerKey: "",
    registryKey: "transactional:domain-email-setup-emails",
    registryType: "transactional_section",
    slug: "domain-email-setup-emails",
    status: "draft",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "support",
    createdAt: null,
    description: "Support notification email templates are reserved placeholders.",
    id: "fallback-transactional-support-emails",
    metadata: {
      note: "Support notification email templates are reserved placeholders.",
      section_key: "support",
      source: "email_registry_fallback"
    },
    name: "Support emails",
    providerKey: "",
    registryKey: "transactional:support-emails",
    registryType: "transactional_section",
    slug: "support-emails",
    status: "draft",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "security",
    createdAt: null,
    description: "Security alert email templates are reserved placeholders.",
    id: "fallback-transactional-security-emails",
    metadata: {
      note: "Security alert email templates are reserved placeholders.",
      section_key: "security",
      source: "email_registry_fallback"
    },
    name: "Security emails",
    providerKey: "",
    registryKey: "transactional:security-emails",
    registryType: "transactional_section",
    slug: "security-emails",
    status: "draft",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "queue",
    createdAt: null,
    description: "Read-only queue summary foundation. Counts are computed from email event logs.",
    id: "fallback-queue-summary-foundation",
    metadata: { source: "email_registry_fallback" },
    name: "Email queue summary foundation",
    providerKey: "",
    registryKey: "queue-summary:foundation",
    registryType: "queue_summary",
    slug: "queue-summary-foundation",
    status: "monitoring",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "campaign",
    createdAt: null,
    description: "Platform campaign email sending is reserved for a future safe queue.",
    id: "fallback-campaign-scope-platform-campaigns",
    metadata: { note: "Platform campaign email sending is reserved for a future safe queue.", source: "email_registry_fallback" },
    name: "Platform campaigns",
    providerKey: "",
    registryKey: "campaign-scope:platform-campaigns",
    registryType: "campaign_scope",
    slug: "platform-campaigns",
    status: "placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "campaign",
    createdAt: null,
    description: "Read-only summary only. Store Owner campaigns are not edited in Super Admin Email Center.",
    id: "fallback-campaign-scope-store-owner-campaigns",
    metadata: {
      note: "Read-only summary only. Store Owner campaigns are not edited in Super Admin Email Center.",
      source: "email_registry_fallback"
    },
    name: "Store Owner campaigns summary",
    providerKey: "",
    registryKey: "campaign-scope:store-owner-campaigns",
    registryType: "campaign_scope",
    slug: "store-owner-campaigns",
    status: "monitoring",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "future_hook",
    createdAt: null,
    description: "Reserved placeholder for future template editing.",
    id: "fallback-future-hook-edit-template",
    metadata: { source: "email_registry_fallback" },
    name: "Edit template",
    providerKey: "",
    registryKey: "future-hook:edit-template",
    registryType: "future_hook",
    slug: "edit-template",
    status: "reserved_placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "future_hook",
    createdAt: null,
    description: "Reserved placeholder for future test email sending.",
    id: "fallback-future-hook-send-test-email",
    metadata: { source: "email_registry_fallback" },
    name: "Send test email",
    providerKey: "",
    registryKey: "future-hook:send-test-email",
    registryType: "future_hook",
    slug: "send-test-email",
    status: "reserved_placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "future_hook",
    createdAt: null,
    description: "Reserved placeholder for future retry execution.",
    id: "fallback-future-hook-retry-failed-email",
    metadata: { source: "email_registry_fallback" },
    name: "Retry failed email",
    providerKey: "",
    registryKey: "future-hook:retry-failed-email",
    registryType: "future_hook",
    slug: "retry-failed-email",
    status: "reserved_placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "future_hook",
    createdAt: null,
    description: "Reserved placeholder for future email log export.",
    id: "fallback-future-hook-export-email-logs",
    metadata: { source: "email_registry_fallback" },
    name: "Export email logs",
    providerKey: "",
    registryKey: "future-hook:export-email-logs",
    registryType: "future_hook",
    slug: "export-email-logs",
    status: "reserved_placeholder",
    updatedAt: null,
    usageCount: 0
  },
  {
    category: "future_hook",
    createdAt: null,
    description: "Reserved placeholder for future provider health check execution.",
    id: "fallback-future-hook-provider-health-check",
    metadata: { source: "email_registry_fallback" },
    name: "Provider health check",
    providerKey: "",
    registryKey: "future-hook:provider-health-check",
    registryType: "future_hook",
    slug: "provider-health-check",
    status: "reserved_placeholder",
    updatedAt: null,
    usageCount: 0
  }
];

export async function listEmailRegistryItemsReadOnly(): Promise<EmailRegistryItemRecord[]> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("email_registry_items" as never)
    .select(registrySelect as never)
    .order("updated_at" as never, { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Email registry items could not be listed: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseEmailRegistryItem(row))
    .filter((item): item is EmailRegistryItemRecord => Boolean(item));
}

export async function listEmailRegistryItemsReadOnlySafe(): Promise<{
  items: EmailRegistryItemRecord[];
  source: "database" | "fallback";
  warning: string | null;
}> {
  try {
    const items = await listEmailRegistryItemsReadOnly();

    if (!items.length) {
      return {
        items: [...EMAIL_REGISTRY_FALLBACK_ITEMS],
        source: "fallback",
        warning: "Email registry table is empty. Showing fallback registry rows."
      };
    }

    return {
      items,
      source: "database",
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email-registry-runtime] read-only registry load failed", error);

    return {
      items: [...EMAIL_REGISTRY_FALLBACK_ITEMS],
      source: "fallback",
      warning: message
    };
  }
}

export function buildEmailRegistryViewsSafe(params: {
  items: EmailRegistryItemRecord[] | null | undefined;
  resolveCampaignTotals: (slug: string) => { lastActivity: string | null; total: number };
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus;
}) {
  try {
    const items = Array.isArray(params.items) && params.items.length ? params.items : [...EMAIL_REGISTRY_FALLBACK_ITEMS];

    return {
      campaignMonitoring: buildEmailRegistryCampaignMonitoringView(items, params.resolveCampaignTotals),
      futureHooks: buildEmailRegistryFutureHooksView(items),
      providers: buildEmailRegistryProvidersView(items),
      templates: buildEmailRegistryTemplatesView(items, params.resolveTemplateStatus),
      transactionalSections: buildEmailRegistryTransactionalSectionsView(items),
      warning: null as string | null
    };
  } catch (error) {
    console.error("[email-registry-runtime] registry view build failed", error);

    const fallbackItems = [...EMAIL_REGISTRY_FALLBACK_ITEMS];

    return {
      campaignMonitoring: buildEmailRegistryCampaignMonitoringView(fallbackItems, params.resolveCampaignTotals),
      futureHooks: buildEmailRegistryFutureHooksView(fallbackItems),
      providers: buildEmailRegistryProvidersView(fallbackItems),
      templates: buildEmailRegistryTemplatesView(fallbackItems, params.resolveTemplateStatus),
      transactionalSections: buildEmailRegistryTransactionalSectionsView(fallbackItems),
      warning: "Email registry views failed safely. Showing fallback registry rows."
    };
  }
}

export type {
  EmailRegistryTypeBadgeTone,
  EmailRegistryTypeCatalogEntry,
  EmailRegistryTypeGroup,
  EmailRegistryTypeSection,
  EmailRegistryTypeStats
} from "@/src/lib/email/email-type-runtime";
export {
  assertValidEmailRegistryType,
  buildEmailRegistryTypeStatsSafe,
  countEmailRegistryItemsByType,
  EMAIL_REGISTRY_TYPES,
  getEmailRegistryTypeBadgeTone,
  getEmailRegistryTypeDescription,
  getEmailRegistryTypeLabel,
  getEmailRegistryTypeSection,
  getEmailRegistryTypeSectionLabel,
  groupEmailRegistryItemsByType,
  isValidEmailRegistryType,
  listEmailRegistryTypeCatalog,
  parseEmailRegistryType,
  resolveEmailRegistryTypeBadgeTone,
  resolveEmailRegistryTypeDescription,
  resolveEmailRegistryTypeLabel
} from "@/src/lib/email/email-type-runtime";
export type {
  EmailCenterStatus,
  EmailQueueLogStatus,
  EmailQueueStatusSummary,
  EmailRegistryStatusStats,
  EmailStatusBadgeTone,
  EmailStatusCatalogEntry
} from "@/src/lib/email/email-status-runtime";
export {
  assertValidEmailRegistryStatus,
  buildEmailQueueStatusSummaryFromLogsSafe,
  buildEmailRegistryStatusStatsSafe,
  countEmailRegistryItemsByStatus,
  EMAIL_CENTER_STATUSES,
  EMAIL_QUEUE_LOG_STATUSES,
  EMAIL_REGISTRY_STATUSES,
  getEmailStatusBadgeTone,
  getEmailStatusDescription,
  getEmailStatusLabel,
  groupEmailRegistryItemsByStatus,
  isValidEmailCenterStatus,
  isValidEmailQueueLogStatus,
  isValidEmailRegistryStatus,
  listEmailStatusCatalog,
  mapRegistryStatusToCampaignScopeStatus,
  mapRegistryStatusToTemplateStatus,
  mapRegistryStatusToTransactionalStatus,
  parseEmailCenterStatus,
  parseEmailQueueLogStatus,
  parseEmailRegistryStatus,
  resolveEmailStatusBadgeTone,
  resolveEmailStatusDescription,
  resolveEmailStatusLabel
} from "@/src/lib/email/email-status-runtime";
export type {
  EmailProviderCatalogEntry,
  EmailProviderConfigurationStatus,
  EmailProviderHealthStatus,
  EmailProviderRuntimeRecord,
  EmailProviderSecretStatus,
  EmailProviderStats,
  EmailProviderType
} from "@/src/lib/email/email-provider-runtime";
export {
  buildEmailProviderRuntimeRecordsSafe,
  buildEmailProviderStatsSafe,
  buildEmailProviderViewsSafe,
  EMAIL_PROVIDER_KEYS,
  getEmailProviderDescription,
  getEmailProviderHealthLabel,
  getEmailProviderLabel,
  getEmailProviderType,
  isValidEmailProviderKey,
  listEmailProviderCatalog,
  parseEmailProviderKey,
  resolveEmailProviderStatusSafe
} from "@/src/lib/email/email-provider-runtime";
export type {
  EmailProviderHealthBadgeTone,
  EmailProviderHealthRecord,
  EmailProviderHealthRegistryItem,
  EmailProviderHealthState,
  EmailProviderHealthStats
} from "@/src/lib/email/email-provider-health-runtime";
export {
  buildEmailProviderHealthRecordsSafe,
  buildEmailProviderHealthStatsSafe,
  EMAIL_PROVIDER_HEALTH_STATES,
  getEmailProviderHealthBadgeTone,
  getEmailProviderHealthStateDescription,
  getEmailProviderHealthStateLabel,
  isValidEmailProviderHealthState,
  listEmailProviderHealthCatalog,
  parseEmailProviderHealthState,
  resolveEmailProviderHealthStateSafe,
  resolveEmailProviderLastCheckedLabelSafe
} from "@/src/lib/email/email-provider-health-runtime";
export type {
  EmailTemplateRegistryRecord,
  EmailTemplateRegistryStats
} from "@/src/lib/email/email-template-registry-runtime";
export {
  buildEmailTemplateRegistryRecordsSafe,
  buildEmailTemplateRegistryStatsSafe,
  buildEmailTemplateRegistryViewsSafe,
  EMAIL_TEMPLATE_LANGUAGES,
  isValidEmailTemplateLanguage,
  parseEmailTemplateLanguage
} from "@/src/lib/email/email-template-registry-runtime";
export type {
  EmailTemplateCategoryBadgeTone,
  EmailTemplateCategoryCatalogEntry,
  EmailTemplateCategoryGroup,
  EmailTemplateCategoryStats,
  EmailTemplateCenterCategory
} from "@/src/lib/email/email-template-category-runtime";
export {
  buildEmailTemplateCategoryStatsSafe,
  EMAIL_TEMPLATE_CATEGORIES,
  EMAIL_TEMPLATE_CENTER_CATEGORIES,
  EMAIL_TEMPLATE_REGISTERED_CATEGORIES,
  getEmailTemplateCategoryBadgeTone,
  getEmailTemplateCategoryDescription,
  getEmailTemplateCategoryLabel,
  groupEmailTemplateRecordsByCategorySafe,
  groupEmailTemplateRegistryItemsByCategorySafe,
  isRegisteredEmailTemplateCategory,
  isValidEmailTemplateCategory,
  isValidEmailTemplateCenterCategory,
  listEmailTemplateCategoryCatalog,
  parseEmailTemplateCategory,
  parseEmailTemplateCenterCategory,
  resolveEmailTemplateCategoryBadgeTone,
  resolveEmailTemplateCategoryDescription,
  resolveEmailTemplateCategoryLabel,
  resolveEmailTemplateCenterCategorySafe
} from "@/src/lib/email/email-template-category-runtime";
export type {
  EmailTemplateVersionBadgeTone,
  EmailTemplateVersionRecord,
  EmailTemplateVersionState,
  EmailTemplateVersionStats
} from "@/src/lib/email/email-template-version-runtime";
export {
  buildEmailTemplateVersionRecordsSafe,
  buildEmailTemplateVersionStatsSafe,
  EMAIL_TEMPLATE_VERSION_STATES,
  getEmailTemplateVersionBadgeTone,
  getEmailTemplateVersionStateDescription,
  getEmailTemplateVersionStateLabel,
  isValidEmailTemplateVersionState,
  listEmailTemplateVersionCatalog,
  parseEmailTemplateVersionState,
  resolveEmailTemplateLastUpdatedLabelSafe,
  resolveEmailTemplateVersionStateSafe
} from "@/src/lib/email/email-template-version-runtime";
export type {
  EmailTemplatePreviewBadgeTone,
  EmailTemplatePreviewRecord,
  EmailTemplatePreviewState,
  EmailTemplatePreviewStats
} from "@/src/lib/email/email-template-preview-runtime";
export {
  buildEmailTemplatePreviewRecordsSafe,
  buildEmailTemplatePreviewStatsSafe,
  EMAIL_TEMPLATE_PREVIEW_STATES,
  getEmailTemplatePreviewBadgeTone,
  getEmailTemplatePreviewStateDescription,
  getEmailTemplatePreviewStateLabel,
  isValidEmailTemplatePreviewState,
  listEmailTemplatePreviewCatalog,
  parseEmailTemplatePreviewState,
  resolveEmailTemplatePreviewStateSafe,
  sanitizeEmailTemplatePreviewContent
} from "@/src/lib/email/email-template-preview-runtime";
export type {
  EmailTemplateValidationBadgeTone,
  EmailTemplateValidationRecord,
  EmailTemplateValidationState,
  EmailTemplateValidationStats
} from "@/src/lib/email/email-template-validation-runtime";
export {
  buildEmailTemplateValidationRecordsSafe,
  buildEmailTemplateValidationStatsSafe,
  EMAIL_TEMPLATE_VALIDATION_STATES,
  getEmailTemplateValidationBadgeTone,
  getEmailTemplateValidationStateDescription,
  getEmailTemplateValidationStateLabel,
  isValidEmailTemplateValidationState,
  listEmailTemplateValidationCatalog,
  parseEmailTemplateValidationState,
  validateEmailTemplateReadinessSafe
} from "@/src/lib/email/email-template-validation-runtime";
export type {
  EmailWelcomeEmailRecord,
  EmailWelcomeEmailStats,
  EmailWelcomeReadinessState
} from "@/src/lib/email/email-welcome-runtime";
export {
  buildEmailWelcomeEmailRecordsSafe,
  buildEmailWelcomeEmailStatsSafe,
  EMAIL_WELCOME_READINESS_STATES,
  getEmailWelcomeReadinessStateDescription,
  getEmailWelcomeReadinessStateLabel,
  listEmailWelcomeReadinessCatalog,
  resolveEmailWelcomeReadinessStateSafe
} from "@/src/lib/email/email-welcome-runtime";
