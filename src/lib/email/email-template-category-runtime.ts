import "server-only";

export type EmailTemplateCenterCategory =
  | "billing"
  | "campaign"
  | "domain_email_setup"
  | "order"
  | "placeholder"
  | "security"
  | "support"
  | "system"
  | "unknown"
  | "welcome";

export type EmailTemplateCategory = Extract<
  EmailTemplateCenterCategory,
  "billing" | "domain_email_setup" | "order" | "security" | "support" | "welcome"
>;

export type EmailTemplateCategoryBadgeTone = "amber" | "blue" | "green" | "red" | "slate";

export type EmailTemplateCategoryCatalogEntry = {
  badgeTone: EmailTemplateCategoryBadgeTone;
  category: EmailTemplateCenterCategory;
  description: string;
  label: string;
  registered: boolean;
};

export type EmailTemplateCategoryStats = {
  billingTemplates: number;
  campaignTemplates: number;
  domainEmailSetupTemplates: number;
  orderTemplates: number;
  placeholderTemplates: number;
  securityTemplates: number;
  supportTemplates: number;
  systemTemplates: number;
  totalTemplates: number;
  unknownTemplates: number;
  welcomeTemplates: number;
};

export type EmailTemplateCategoryGroup<T extends { category: EmailTemplateCategory }> = {
  category: EmailTemplateCategory;
  categoryLabel: string;
  description: string;
  items: T[];
};

export type EmailTemplateCategoryRegistryItem = {
  category: string;
  registryType: string;
};

export const EMAIL_TEMPLATE_REGISTERED_CATEGORIES: readonly EmailTemplateCategory[] = [
  "welcome",
  "billing",
  "order",
  "domain_email_setup",
  "support",
  "security"
] as const;

export const EMAIL_TEMPLATE_CENTER_CATEGORIES: readonly EmailTemplateCenterCategory[] = [
  "welcome",
  "billing",
  "order",
  "domain_email_setup",
  "support",
  "security",
  "campaign",
  "system",
  "placeholder",
  "unknown"
] as const;

const categoryLabels: Record<EmailTemplateCenterCategory, string> = {
  billing: "Billing",
  campaign: "Campaign",
  domain_email_setup: "Domain and email setup",
  order: "Order",
  placeholder: "Placeholder",
  security: "Security",
  support: "Support",
  system: "System",
  unknown: "Unknown",
  welcome: "Welcome"
};

const categoryDescriptions: Record<EmailTemplateCenterCategory, string> = {
  billing: "Platform billing and subscription notification email template foundation.",
  campaign: "Campaign email template classification foundation only. No campaign sending connected.",
  domain_email_setup: "Domain and professional email setup instruction template foundation.",
  order: "Platform order receipt and order notification template foundation.",
  placeholder: "Reserved placeholder template category. No template execution connected.",
  security: "Security alert and account notification template foundation.",
  support: "Support ticket and helpdesk notification template foundation.",
  system: "System notification template classification foundation only.",
  unknown: "Template category could not be resolved safely.",
  welcome: "Platform welcome and onboarding email template foundation."
};

const badgeToneByCategory: Record<EmailTemplateCenterCategory, EmailTemplateCategoryBadgeTone> = {
  billing: "amber",
  campaign: "blue",
  domain_email_setup: "green",
  order: "blue",
  placeholder: "slate",
  security: "red",
  support: "blue",
  system: "slate",
  unknown: "red",
  welcome: "green"
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

export function isValidEmailTemplateCenterCategory(value: unknown): value is EmailTemplateCenterCategory {
  return typeof value === "string" && EMAIL_TEMPLATE_CENTER_CATEGORIES.includes(value as EmailTemplateCenterCategory);
}

export function isValidEmailTemplateCategory(value: unknown): value is EmailTemplateCategory {
  return typeof value === "string" && EMAIL_TEMPLATE_REGISTERED_CATEGORIES.includes(value as EmailTemplateCategory);
}

export function parseEmailTemplateCenterCategory(value: unknown): EmailTemplateCenterCategory | null {
  const cleaned = text(value, 120);
  return isValidEmailTemplateCenterCategory(cleaned) ? cleaned : null;
}

export function parseEmailTemplateCategory(value: unknown): EmailTemplateCategory | null {
  const cleaned = text(value, 120);
  return isValidEmailTemplateCategory(cleaned) ? cleaned : null;
}

export function resolveEmailTemplateCenterCategorySafe(value: unknown): EmailTemplateCenterCategory {
  return parseEmailTemplateCenterCategory(value) ?? "unknown";
}

export function resolveEmailTemplateCategoryLabel(value: unknown) {
  return getEmailTemplateCategoryLabel(resolveEmailTemplateCenterCategorySafe(value));
}

export function resolveEmailTemplateCategoryBadgeTone(value: unknown): EmailTemplateCategoryBadgeTone {
  return getEmailTemplateCategoryBadgeTone(resolveEmailTemplateCenterCategorySafe(value));
}

export function resolveEmailTemplateCategoryDescription(value: unknown) {
  return getEmailTemplateCategoryDescription(resolveEmailTemplateCenterCategorySafe(value));
}

export function getEmailTemplateCategoryLabel(category: EmailTemplateCenterCategory) {
  return categoryLabels[category];
}

export function getEmailTemplateCategoryDescription(category: EmailTemplateCenterCategory) {
  return categoryDescriptions[category];
}

export function getEmailTemplateCategoryBadgeTone(category: EmailTemplateCenterCategory): EmailTemplateCategoryBadgeTone {
  return badgeToneByCategory[category];
}

export function isRegisteredEmailTemplateCategory(
  category: EmailTemplateCenterCategory
): category is EmailTemplateCategory {
  return isValidEmailTemplateCategory(category);
}

export function listEmailTemplateCategoryCatalog(): EmailTemplateCategoryCatalogEntry[] {
  return EMAIL_TEMPLATE_CENTER_CATEGORIES.map((category) => ({
    badgeTone: getEmailTemplateCategoryBadgeTone(category),
    category,
    description: getEmailTemplateCategoryDescription(category),
    label: getEmailTemplateCategoryLabel(category),
    registered: isRegisteredEmailTemplateCategory(category)
  }));
}

export function countEmailTemplateItemsByCategory(
  items: EmailTemplateCategoryRegistryItem[]
): EmailTemplateCategoryStats {
  const templateItems = items.filter((item) => item.registryType === "template");

  const counts = EMAIL_TEMPLATE_CENTER_CATEGORIES.reduce(
    (accumulator, category) => {
      accumulator[category] = 0;
      return accumulator;
    },
    {} as Record<EmailTemplateCenterCategory, number>
  );

  for (const item of templateItems) {
    const category = resolveEmailTemplateCenterCategorySafe(item.category);
    counts[category] += 1;
  }

  return {
    billingTemplates: counts.billing,
    campaignTemplates: counts.campaign,
    domainEmailSetupTemplates: counts.domain_email_setup,
    orderTemplates: counts.order,
    placeholderTemplates: counts.placeholder,
    securityTemplates: counts.security,
    supportTemplates: counts.support,
    systemTemplates: counts.system,
    totalTemplates: templateItems.length,
    unknownTemplates: counts.unknown,
    welcomeTemplates: counts.welcome
  };
}

export function buildEmailTemplateCategoryStatsSafe(
  items: EmailTemplateCategoryRegistryItem[] | null | undefined
): EmailTemplateCategoryStats {
  try {
    return countEmailTemplateItemsByCategory(Array.isArray(items) ? items : []);
  } catch (error) {
    console.error("[email-template-category-runtime] template category stats build failed", error);

    return {
      billingTemplates: 0,
      campaignTemplates: 0,
      domainEmailSetupTemplates: 0,
      orderTemplates: 0,
      placeholderTemplates: 0,
      securityTemplates: 0,
      supportTemplates: 0,
      systemTemplates: 0,
      totalTemplates: 0,
      unknownTemplates: 0,
      welcomeTemplates: 0
    };
  }
}

export function groupEmailTemplateRecordsByCategorySafe<T extends { category: EmailTemplateCategory }>(
  records: T[] | null | undefined
): EmailTemplateCategoryGroup<T>[] {
  try {
    const safeRecords = Array.isArray(records) ? records : [];

    return EMAIL_TEMPLATE_REGISTERED_CATEGORIES.map((category) => ({
      category,
      categoryLabel: getEmailTemplateCategoryLabel(category),
      description: getEmailTemplateCategoryDescription(category),
      items: safeRecords.filter((record) => record.category === category)
    }));
  } catch (error) {
    console.error("[email-template-category-runtime] template category grouping failed", error);
    return [];
  }
}

export function groupEmailTemplateRegistryItemsByCategorySafe(
  items: EmailTemplateCategoryRegistryItem[] | null | undefined
): Array<{
  category: EmailTemplateCenterCategory;
  categoryLabel: string;
  description: string;
  itemCount: number;
}> {
  try {
    const templateItems = (Array.isArray(items) ? items : []).filter(
      (item) => text(item.registryType, 80) === "template"
    );

    return EMAIL_TEMPLATE_CENTER_CATEGORIES.map((category) => ({
      category,
      categoryLabel: getEmailTemplateCategoryLabel(category),
      description: getEmailTemplateCategoryDescription(category),
      itemCount: templateItems.filter(
        (item) => resolveEmailTemplateCenterCategorySafe(item.category) === category
      ).length
    })).filter((group) => group.itemCount > 0 || isRegisteredEmailTemplateCategory(group.category));
  } catch (error) {
    console.error("[email-template-category-runtime] template registry category grouping failed", error);
    return [];
  }
}

// Backward-compatible alias used by template registry re-exports.
export const EMAIL_TEMPLATE_CATEGORIES = EMAIL_TEMPLATE_REGISTERED_CATEGORIES;
