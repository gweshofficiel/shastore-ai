import "server-only";

import { filterEmailRegistryItemsByType, type EmailRegistryType } from "@/src/lib/email/email-type-runtime";
import { isValidEmailProviderKey, type EmailProviderKey } from "@/src/lib/email/email-provider-runtime";
import {
  getEmailStatusLabel,
  mapRegistryStatusToTemplateStatus,
  type EmailRegistryStatus,
  type EmailTemplateDisplayStatus
} from "@/src/lib/email/email-status-runtime";

export type EmailTemplateCategory =
  | "billing"
  | "domain_email_setup"
  | "order"
  | "security"
  | "support"
  | "welcome";

export type EmailTemplateLanguage = "Arabic" | "English" | "French";

export type EmailRegistryTemplateView = {
  category: EmailTemplateCategory;
  id: string;
  language: EmailTemplateLanguage;
  lastUpdated: string | null;
  name: string;
  status: EmailTemplateDisplayStatus;
};

export type EmailTemplateRegistryItem = {
  category: string;
  description: string;
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

export type EmailTemplateRegistryRecord = EmailRegistryTemplateView & {
  categoryLabel: string;
  description: string;
  metadataSummary: string;
  providerKey: EmailProviderKey | null;
  registryKey: string;
  registryStatus: EmailRegistryStatus;
  registryStatusLabel: string;
  slug: string;
  templateKey: string;
  usageCount: number;
};

export type EmailTemplateRegistryStats = {
  activeTemplates: number;
  billingTemplates: number;
  disabledTemplates: number;
  domainEmailSetupTemplates: number;
  draftTemplates: number;
  orderTemplates: number;
  securityTemplates: number;
  supportTemplates: number;
  totalTemplates: number;
  welcomeTemplates: number;
};

export const EMAIL_TEMPLATE_CATEGORIES: readonly EmailTemplateCategory[] = [
  "welcome",
  "billing",
  "order",
  "domain_email_setup",
  "support",
  "security"
] as const;

export const EMAIL_TEMPLATE_LANGUAGES: readonly EmailTemplateLanguage[] = [
  "English",
  "Arabic",
  "French"
] as const;

const categoryLabels: Record<EmailTemplateCategory, string> = {
  billing: "Billing",
  domain_email_setup: "Domain and email setup",
  order: "Order",
  security: "Security",
  support: "Support",
  welcome: "Welcome"
};

const categoryDescriptions: Record<EmailTemplateCategory, string> = {
  billing: "Platform billing and subscription notification email template foundation.",
  domain_email_setup: "Domain and professional email setup instruction template foundation.",
  order: "Platform order receipt and order notification template foundation.",
  security: "Security alert and account notification template foundation.",
  support: "Support ticket and helpdesk notification template foundation.",
  welcome: "Platform welcome and onboarding email template foundation."
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

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function sanitizeTemplateMetadata(metadata: Record<string, unknown>) {
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

function resolveSafeProviderKey(value: unknown): EmailProviderKey | null {
  const cleaned = text(value, 80);
  return cleaned && isValidEmailProviderKey(cleaned) ? cleaned : null;
}

export function isValidEmailTemplateCategory(value: unknown): value is EmailTemplateCategory {
  return typeof value === "string" && EMAIL_TEMPLATE_CATEGORIES.includes(value as EmailTemplateCategory);
}

export function parseEmailTemplateCategory(value: unknown): EmailTemplateCategory | null {
  const cleaned = text(value, 120);
  return isValidEmailTemplateCategory(cleaned) ? cleaned : null;
}

export function isValidEmailTemplateLanguage(value: unknown): value is EmailTemplateLanguage {
  return typeof value === "string" && EMAIL_TEMPLATE_LANGUAGES.includes(value as EmailTemplateLanguage);
}

export function parseEmailTemplateLanguage(value: unknown): EmailTemplateLanguage | null {
  const cleaned = text(value, 80);
  return isValidEmailTemplateLanguage(cleaned) ? cleaned : null;
}

export function getEmailTemplateCategoryLabel(category: EmailTemplateCategory) {
  return categoryLabels[category];
}

export function getEmailTemplateCategoryDescription(category: EmailTemplateCategory) {
  return categoryDescriptions[category];
}

export function listEmailTemplateCategoryCatalog() {
  return EMAIL_TEMPLATE_CATEGORIES.map((category) => ({
    category,
    description: getEmailTemplateCategoryDescription(category),
    label: getEmailTemplateCategoryLabel(category)
  }));
}

function buildTemplateMetadataSummary(item: EmailTemplateRegistryItem) {
  const metadata = sanitizeTemplateMetadata(safeRecord(item.metadata));
  const source = text(metadata.source, 120);

  if (source) {
    return `Registry source: ${source}. Email template foundation only.`;
  }

  if (item.description) {
    return item.description;
  }

  const category = parseEmailTemplateCategory(item.category);
  return category ? categoryDescriptions[category] : "Email template foundation only.";
}

function resolveTemplateDisplayStatus(
  templateId: string,
  fallback: EmailTemplateDisplayStatus,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
) {
  return resolveTemplateStatus ? resolveTemplateStatus(templateId, fallback) : fallback;
}

export function buildEmailTemplateRegistryRecordSafe(
  item: EmailTemplateRegistryItem,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailTemplateRegistryRecord | null {
  try {
    const category = parseEmailTemplateCategory(item.category);
    if (!category) return null;

    const metadata = sanitizeTemplateMetadata(safeRecord(item.metadata));
    const templateKey = text(metadata.template_id, 160) || text(item.slug, 160) || text(item.registryKey, 160);
    const language = parseEmailTemplateLanguage(metadata.language) ?? "English";
    const fallbackStatus = mapRegistryStatusToTemplateStatus(item.status);
    const status = resolveTemplateDisplayStatus(templateKey, fallbackStatus, resolveTemplateStatus);

    return {
      category,
      categoryLabel: getEmailTemplateCategoryLabel(category),
      description: text(item.description, 2000) || categoryDescriptions[category],
      id: templateKey,
      language,
      lastUpdated: text(item.updatedAt, 80) || null,
      metadataSummary: buildTemplateMetadataSummary(item),
      name: text(item.name, 200) || templateKey,
      providerKey: resolveSafeProviderKey(item.providerKey),
      registryKey: text(item.registryKey, 160) || templateKey,
      registryStatus: item.status,
      registryStatusLabel: getEmailStatusLabel(item.status),
      slug: text(item.slug, 160) || templateKey,
      status,
      templateKey,
      usageCount: Math.max(0, Math.trunc(Number.isFinite(item.usageCount) ? item.usageCount : 0))
    };
  } catch (error) {
    console.error("[email-template-registry-runtime] template record build failed", error);
    return null;
  }
}

export function buildEmailTemplateRegistryViewsSafe(
  items: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailRegistryTemplateView[] {
  try {
    return buildEmailTemplateRegistryRecordsSafe(items, resolveTemplateStatus).map((record) => ({
      category: record.category,
      id: record.id,
      language: record.language,
      lastUpdated: record.lastUpdated,
      name: record.name,
      status: record.status
    }));
  } catch (error) {
    console.error("[email-template-registry-runtime] template view build failed", error);
    return [];
  }
}

export function buildEmailTemplateRegistryRecordsSafe(
  items: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailTemplateRegistryRecord[] {
  try {
    const templateItems = filterEmailRegistryItemsByType(
      Array.isArray(items) ? items : [],
      "template"
    );

    return templateItems
      .map((item) => buildEmailTemplateRegistryRecordSafe(item, resolveTemplateStatus))
      .filter((record): record is EmailTemplateRegistryRecord => Boolean(record));
  } catch (error) {
    console.error("[email-template-registry-runtime] template registry records build failed", error);
    return [];
  }
}

export function buildEmailTemplateRegistryStatsSafe(
  items: EmailTemplateRegistryItem[] | null | undefined,
  resolveTemplateStatus?: (templateId: string, fallback: EmailTemplateDisplayStatus) => EmailTemplateDisplayStatus
): EmailTemplateRegistryStats {
  try {
    const records = buildEmailTemplateRegistryRecordsSafe(items, resolveTemplateStatus);

    return {
      activeTemplates: records.filter((record) => record.status === "active").length,
      billingTemplates: records.filter((record) => record.category === "billing").length,
      disabledTemplates: records.filter((record) => record.status === "disabled").length,
      domainEmailSetupTemplates: records.filter((record) => record.category === "domain_email_setup").length,
      draftTemplates: records.filter((record) => record.status === "draft").length,
      orderTemplates: records.filter((record) => record.category === "order").length,
      securityTemplates: records.filter((record) => record.category === "security").length,
      supportTemplates: records.filter((record) => record.category === "support").length,
      totalTemplates: records.length,
      welcomeTemplates: records.filter((record) => record.category === "welcome").length
    };
  } catch (error) {
    console.error("[email-template-registry-runtime] template registry stats build failed", error);

    return {
      activeTemplates: 0,
      billingTemplates: 0,
      disabledTemplates: 0,
      domainEmailSetupTemplates: 0,
      draftTemplates: 0,
      orderTemplates: 0,
      securityTemplates: 0,
      supportTemplates: 0,
      totalTemplates: 0,
      welcomeTemplates: 0
    };
  }
}
