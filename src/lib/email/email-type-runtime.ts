import "server-only";

export type EmailRegistryType =
  | "campaign_scope"
  | "future_hook"
  | "provider"
  | "queue_summary"
  | "template"
  | "transactional_section";

export type EmailRegistryTypeSection =
  | "Campaign scope"
  | "Future hooks"
  | "Providers"
  | "Queue summary"
  | "Templates"
  | "Transactional sections";

export type EmailRegistryTypeBadgeTone = "amber" | "blue" | "green" | "red";

export type EmailRegistryTypeCatalogEntry = {
  badgeTone: EmailRegistryTypeBadgeTone;
  description: string;
  label: string;
  section: EmailRegistryTypeSection;
  sectionLabel: string;
  type: EmailRegistryType;
};

export type EmailRegistryTypeStats = {
  campaignScopeItems: number;
  futureHookItems: number;
  providerItems: number;
  queueSummaryItems: number;
  templateItems: number;
  totalItems: number;
  transactionalSectionItems: number;
};

export type EmailRegistryTypeGroup<T extends { registryType: EmailRegistryType }> = {
  items: T[];
  section: EmailRegistryTypeSection;
  sectionLabel: string;
  type: EmailRegistryType;
  typeLabel: string;
};

export const EMAIL_REGISTRY_TYPES: readonly EmailRegistryType[] = [
  "provider",
  "template",
  "transactional_section",
  "queue_summary",
  "campaign_scope",
  "future_hook"
] as const;

const typeLabels: Record<EmailRegistryType, string> = {
  campaign_scope: "Campaign scope",
  future_hook: "Future hook",
  provider: "Provider",
  queue_summary: "Queue summary",
  template: "Template",
  transactional_section: "Transactional section"
};

const typeDescriptions: Record<EmailRegistryType, string> = {
  campaign_scope: "Read-only campaign email scope foundation for platform and store summaries.",
  future_hook: "Reserved placeholder hook for future email center actions.",
  provider: "Shared platform email provider foundation without secret exposure.",
  queue_summary: "Read-only queue summary foundation. Counts come from email event logs.",
  template: "Platform transactional email template foundation.",
  transactional_section: "Grouped transactional email section foundation for the Email Center."
};

const sectionByType: Record<EmailRegistryType, EmailRegistryTypeSection> = {
  campaign_scope: "Campaign scope",
  future_hook: "Future hooks",
  provider: "Providers",
  queue_summary: "Queue summary",
  template: "Templates",
  transactional_section: "Transactional sections"
};

const badgeToneByType: Record<EmailRegistryType, EmailRegistryTypeBadgeTone> = {
  campaign_scope: "amber",
  future_hook: "blue",
  provider: "green",
  queue_summary: "blue",
  template: "blue",
  transactional_section: "green"
};

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

export function isValidEmailRegistryType(value: unknown): value is EmailRegistryType {
  return typeof value === "string" && EMAIL_REGISTRY_TYPES.includes(value as EmailRegistryType);
}

export function parseEmailRegistryType(value: unknown): EmailRegistryType | null {
  const cleaned = text(value, 80);
  return isValidEmailRegistryType(cleaned) ? cleaned : null;
}

export function assertValidEmailRegistryType(value: unknown): EmailRegistryType {
  const registryType = parseEmailRegistryType(value);

  if (!registryType) {
    throw new Error(
      "Email registry type must be provider, template, transactional_section, queue_summary, campaign_scope, or future_hook."
    );
  }

  return registryType;
}

export function getEmailRegistryTypeLabel(type: EmailRegistryType) {
  return typeLabels[type];
}

export function getEmailRegistryTypeDescription(type: EmailRegistryType) {
  return typeDescriptions[type];
}

export function getEmailRegistryTypeBadgeTone(type: EmailRegistryType): EmailRegistryTypeBadgeTone {
  return badgeToneByType[type];
}

export function getEmailRegistryTypeSection(type: EmailRegistryType): EmailRegistryTypeSection {
  return sectionByType[type];
}

export function getEmailRegistryTypeSectionLabel(type: EmailRegistryType) {
  return sectionByType[type];
}

export function resolveEmailRegistryTypeLabel(value: unknown) {
  const registryType = parseEmailRegistryType(value);
  return registryType ? getEmailRegistryTypeLabel(registryType) : "Unknown type";
}

export function resolveEmailRegistryTypeBadgeTone(value: unknown): EmailRegistryTypeBadgeTone {
  const registryType = parseEmailRegistryType(value);
  return registryType ? getEmailRegistryTypeBadgeTone(registryType) : "red";
}

export function resolveEmailRegistryTypeDescription(value: unknown) {
  const registryType = parseEmailRegistryType(value);
  return registryType ? getEmailRegistryTypeDescription(registryType) : "Email registry type could not be resolved safely.";
}

export function listEmailRegistryTypeCatalog(): EmailRegistryTypeCatalogEntry[] {
  return EMAIL_REGISTRY_TYPES.map((type) => {
    const section = getEmailRegistryTypeSection(type);

    return {
      badgeTone: getEmailRegistryTypeBadgeTone(type),
      description: getEmailRegistryTypeDescription(type),
      label: getEmailRegistryTypeLabel(type),
      section,
      sectionLabel: section,
      type
    };
  });
}

export function countEmailRegistryItemsByType<T extends { registryType: EmailRegistryType }>(
  items: T[]
): EmailRegistryTypeStats {
  return {
    campaignScopeItems: items.filter((item) => item.registryType === "campaign_scope").length,
    futureHookItems: items.filter((item) => item.registryType === "future_hook").length,
    providerItems: items.filter((item) => item.registryType === "provider").length,
    queueSummaryItems: items.filter((item) => item.registryType === "queue_summary").length,
    templateItems: items.filter((item) => item.registryType === "template").length,
    totalItems: items.length,
    transactionalSectionItems: items.filter((item) => item.registryType === "transactional_section").length
  };
}

export function filterEmailRegistryItemsByType<T extends { registryType: EmailRegistryType }>(
  items: T[],
  type: EmailRegistryType
): T[] {
  return items.filter((item) => item.registryType === type);
}

export function groupEmailRegistryItemsByType<T extends { registryType: EmailRegistryType }>(
  items: T[]
): EmailRegistryTypeGroup<T>[] {
  return EMAIL_REGISTRY_TYPES.map((type) => {
    const groupedItems = filterEmailRegistryItemsByType(items, type);
    const section = getEmailRegistryTypeSection(type);

    return {
      items: groupedItems,
      section,
      sectionLabel: section,
      type,
      typeLabel: getEmailRegistryTypeLabel(type)
    };
  });
}

export function buildEmailRegistryTypeStatsSafe(
  items: Array<{ registryType: EmailRegistryType | unknown }> | null | undefined
): EmailRegistryTypeStats {
  try {
    const snapshots = Array.isArray(items)
      ? items.filter((item): item is { registryType: EmailRegistryType } =>
          isValidEmailRegistryType(item.registryType)
        )
      : [];

    return countEmailRegistryItemsByType(snapshots);
  } catch (error) {
    console.error("[email-type-runtime] type stats failed", error);

    return {
      campaignScopeItems: 0,
      futureHookItems: 0,
      providerItems: 0,
      queueSummaryItems: 0,
      templateItems: 0,
      totalItems: 0,
      transactionalSectionItems: 0
    };
  }
}
