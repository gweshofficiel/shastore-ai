import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPublishedTemplateVersion,
  type TemplateVersionRecord
} from "@/src/lib/templates/template-versions";
import {
  listTemplates,
  type TemplateRegistryRecord,
  type TemplateRegistryStatus,
  type TemplateRegistryVisibility
} from "@/src/lib/templates/template-registry";

export type MarketplaceTemplateBindingStatus = "bound" | "invalid" | "orphaned" | "unbound";

export type MarketplaceTemplateBindingRecord = {
  bindingStatus: MarketplaceTemplateBindingStatus;
  bindingUpdatedAt: string | null;
  linkedTemplateId: string | null;
  templateKey: string | null;
  templateName: string | null;
  templateSlug: string | null;
  templateStatus: TemplateRegistryStatus | null;
  templateVersion: string | null;
  templateVisibility: TemplateRegistryVisibility | null;
  verificationIssues: string[];
  verified: boolean;
};

export type MarketplaceTemplateBindingVerification = MarketplaceTemplateBindingRecord & {
  itemId: string;
  itemKey: string;
  itemName: string;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  publishedVersionNumber: string | null;
};

export type MarketplaceTemplateBindingStats = {
  boundTemplateItems: number;
  invalidTemplateItems: number;
  orphanedTemplateItems: number;
  totalTemplateItems: number;
  unboundTemplateItems: number;
  verifiedTemplateItems: number;
};

export const MARKETPLACE_TEMPLATE_BINDING_STATUSES: readonly MarketplaceTemplateBindingStatus[] = [
  "bound",
  "invalid",
  "orphaned",
  "unbound"
] as const;

const bindingItemSelect =
  "id, item_key, name, item_type, section, status, visibility, linked_template_id, template_version, template_binding_status, template_binding_updated_at";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rowRecord(value: unknown) {
  const candidate = value as unknown;
  return isRecord(candidate) ? candidate : null;
}

export function isValidMarketplaceTemplateBindingStatus(
  value: unknown
): value is MarketplaceTemplateBindingStatus {
  return MARKETPLACE_TEMPLATE_BINDING_STATUSES.includes(value as MarketplaceTemplateBindingStatus);
}

export function parseMarketplaceTemplateBindingStatus(
  value: unknown
): MarketplaceTemplateBindingStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceTemplateBindingStatus(cleaned) ? cleaned : null;
}

function parseTemplateStatus(value: unknown): TemplateRegistryStatus | null {
  const cleaned = text(value, 40);
  if (cleaned === "active" || cleaned === "archived" || cleaned === "draft") {
    return cleaned;
  }
  return null;
}

function parseTemplateVisibility(value: unknown): TemplateRegistryVisibility | null {
  const cleaned = text(value, 40);
  if (
    cleaned === "internal" ||
    cleaned === "marketplace" ||
    cleaned === "owner" ||
    cleaned === "reseller"
  ) {
    return cleaned;
  }
  return null;
}

function templateKeyFromMarketplaceItemKey(itemKey: string) {
  const cleaned = text(itemKey, 160);
  return cleaned.startsWith("template:") ? cleaned.slice("template:".length) : "";
}

function resolveBindingVersion(
  template: TemplateRegistryRecord,
  publishedVersion: TemplateVersionRecord | null,
  storedVersion: string | null
) {
  return storedVersion || publishedVersion?.versionNumber || template.version || "1";
}

export function evaluateMarketplaceTemplateBinding(params: {
  itemKey: string;
  itemType: string;
  linkedTemplateId: string | null;
  marketplaceStatus: string;
  marketplaceVisibility: string;
  storedBindingStatus: MarketplaceTemplateBindingStatus | null;
  template: TemplateRegistryRecord | null;
  templateVersion: string | null;
}): MarketplaceTemplateBindingRecord {
  if (params.itemType !== "template") {
    return {
      bindingStatus: "unbound",
      bindingUpdatedAt: null,
      linkedTemplateId: null,
      templateKey: null,
      templateName: null,
      templateSlug: null,
      templateStatus: null,
      templateVersion: null,
      templateVisibility: null,
      verificationIssues: [],
      verified: true
    };
  }

  const verificationIssues: string[] = [];

  if (!params.linkedTemplateId) {
    return {
      bindingStatus: "unbound",
      bindingUpdatedAt: null,
      linkedTemplateId: null,
      templateKey: templateKeyFromMarketplaceItemKey(params.itemKey) || null,
      templateName: null,
      templateSlug: null,
      templateStatus: null,
      templateVersion: null,
      templateVisibility: null,
      verificationIssues: ["Template marketplace item is missing linked_template_id."],
      verified: false
    };
  }

  if (!params.template) {
    return {
      bindingStatus: "orphaned",
      bindingUpdatedAt: null,
      linkedTemplateId: params.linkedTemplateId,
      templateKey: templateKeyFromMarketplaceItemKey(params.itemKey) || null,
      templateName: null,
      templateSlug: null,
      templateStatus: null,
      templateVersion: params.templateVersion,
      templateVisibility: null,
      verificationIssues: ["Linked template registry record was not found."],
      verified: false
    };
  }

  const expectedKey = templateKeyFromMarketplaceItemKey(params.itemKey);
  if (expectedKey && expectedKey !== params.template.templateKey) {
    verificationIssues.push("Marketplace item_key does not match linked template_key.");
  }

  if (params.template.status === "archived" && params.marketplaceStatus === "approved") {
    verificationIssues.push("Linked template is archived while marketplace item remains approved.");
  }

  if (params.template.status === "draft" && params.marketplaceVisibility === "public") {
    verificationIssues.push("Linked template is draft while marketplace item is public.");
  }

  if (
    params.marketplaceVisibility === "public" &&
    params.marketplaceStatus === "approved" &&
    params.template.visibility === "owner"
  ) {
    verificationIssues.push("Private owner-only template cannot back a public approved marketplace item.");
  }

  const bindingStatus: MarketplaceTemplateBindingStatus = verificationIssues.length
    ? "invalid"
    : "bound";

  return {
    bindingStatus,
    bindingUpdatedAt: null,
    linkedTemplateId: params.linkedTemplateId,
    templateKey: params.template.templateKey,
    templateName: params.template.name,
    templateSlug: params.template.slug,
    templateStatus: params.template.status,
    templateVersion: params.templateVersion ?? params.template.version,
    templateVisibility: params.template.visibility,
    verificationIssues,
    verified: verificationIssues.length === 0 && bindingStatus === "bound"
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace template binding runtime.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace template binding runtime.");
  }

  return admin;
}

async function loadMarketplaceTemplateBindingItem(itemId: string) {
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    throw new Error("Marketplace item id is required.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(bindingItemSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace template binding item could not be loaded: ${error.message}`);
  }

  if (!data) {
    throw new Error("Marketplace item was not found.");
  }

  const row = rowRecord(data);

  if (!row) {
    throw new Error("Marketplace template binding item record is invalid.");
  }

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const name = text(row.name, 240);
  const itemType = text(row.item_type, 40);

  if (!id || !itemKey || !name || itemType !== "template") {
    throw new Error("Marketplace template binding requires a template marketplace item.");
  }

  return {
    bindingStatus: parseMarketplaceTemplateBindingStatus(row.template_binding_status),
    bindingUpdatedAt: text(row.template_binding_updated_at, 80) || null,
    id,
    itemKey,
    linkedTemplateId: text(row.linked_template_id, 120) || null,
    name,
    status: text(row.status, 40),
    templateVersion: text(row.template_version, 40) || null,
    visibility: text(row.visibility, 40)
  };
}

async function findTemplateById(templateId: string, templates?: TemplateRegistryRecord[]) {
  const cleaned = text(templateId, 120);
  if (!cleaned) return null;
  const registry = templates ?? (await listTemplates());
  return registry.find((template) => template.id === cleaned) ?? null;
}

async function findTemplateByKey(templateKey: string, templates?: TemplateRegistryRecord[]) {
  const cleaned = text(templateKey, 120);
  if (!cleaned) return null;
  const registry = templates ?? (await listTemplates());
  return registry.find((template) => template.templateKey === cleaned) ?? null;
}

async function persistMarketplaceTemplateBinding(params: {
  bindingStatus: MarketplaceTemplateBindingStatus;
  itemId: string;
  linkedTemplateId: string | null;
  templateVersion: string | null;
}) {
  const admin = requireAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("marketplace_items" as never)
    .update({
      linked_template_id: params.linkedTemplateId,
      template_binding_status: params.bindingStatus,
      template_binding_updated_at: now,
      template_version: params.templateVersion
    } as never)
    .eq("id" as never, params.itemId as never);

  if (error) {
    throw new Error(`Marketplace template binding could not be saved: ${error.message}`);
  }

  return now;
}

async function recordMarketplaceTemplateBindingAudit(params: {
  binding: MarketplaceTemplateBindingVerification;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.binding.itemId,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_verify_template_binding",
    metadata: {
      binding_status: params.binding.bindingStatus,
      item_id: params.binding.itemId,
      item_key: params.binding.itemKey,
      item_name: params.binding.itemName,
      linked_template_id: params.binding.linkedTemplateId,
      note: "Super Admin marketplace template binding verification. Binding only. No template sales, installation, cloning, or purchases.",
      source_runtime: "marketplace_template_binding_runtime",
      template_key: params.binding.templateKey,
      template_version: params.binding.templateVersion,
      verification_issues: params.binding.verificationIssues,
      verified: params.binding.verified
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function validateMarketplaceTemplateReference(templateId: string) {
  await requireSuperAdmin();

  const template = await findTemplateById(templateId);

  if (!template) {
    throw new Error("Template registry record was not found.");
  }

  return template;
}

export async function verifyMarketplaceTemplateBinding(
  itemId: string,
  options: { writeAudit?: boolean } = {}
): Promise<MarketplaceTemplateBindingVerification> {
  const access = await requireSuperAdmin();
  const item = await loadMarketplaceTemplateBindingItem(itemId);
  const template = item.linkedTemplateId ? await findTemplateById(item.linkedTemplateId) : null;
  const publishedVersion = template ? await getPublishedTemplateVersion(template.id) : null;
  const evaluation = evaluateMarketplaceTemplateBinding({
    itemKey: item.itemKey,
    itemType: "template",
    linkedTemplateId: item.linkedTemplateId,
    marketplaceStatus: item.status,
    marketplaceVisibility: item.visibility,
    storedBindingStatus: item.bindingStatus,
    template,
    templateVersion: template
      ? resolveBindingVersion(template, publishedVersion, item.templateVersion)
      : item.templateVersion
  });

  const bindingUpdatedAt = await persistMarketplaceTemplateBinding({
    bindingStatus: evaluation.bindingStatus,
    itemId: item.id,
    linkedTemplateId: item.linkedTemplateId,
    templateVersion: evaluation.templateVersion
  });

  const verification: MarketplaceTemplateBindingVerification = {
    ...evaluation,
    bindingUpdatedAt,
    itemId: item.id,
    itemKey: item.itemKey,
    itemName: item.name,
    marketplaceStatus: item.status,
    marketplaceVisibility: item.visibility,
    publishedVersionNumber: publishedVersion?.versionNumber ?? null
  };

  if (options.writeAudit !== false) {
    await recordMarketplaceTemplateBindingAudit({
      binding: verification,
      userId: access.user.id
    });
  }

  return verification;
}

export async function bindMarketplaceTemplateItem(itemId: string, templateId: string) {
  const access = await requireSuperAdmin();
  const item = await loadMarketplaceTemplateBindingItem(itemId);
  const template = await validateMarketplaceTemplateReference(templateId);
  const publishedVersion = await getPublishedTemplateVersion(template.id);
  const templateVersion = resolveBindingVersion(template, publishedVersion, item.templateVersion);

  await persistMarketplaceTemplateBinding({
    bindingStatus: "bound",
    itemId: item.id,
    linkedTemplateId: template.id,
    templateVersion
  });

  const verification = await verifyMarketplaceTemplateBinding(item.id, { writeAudit: false });

  await recordMarketplaceTemplateBindingAudit({
    binding: verification,
    userId: access.user.id
  });

  return verification;
}

export async function getMarketplaceTemplateBindingSummary(
  itemId: string
): Promise<MarketplaceTemplateBindingVerification | null> {
  await requireSuperAdmin();

  try {
    const item = await loadMarketplaceTemplateBindingItem(itemId);
    const template = item.linkedTemplateId ? await findTemplateById(item.linkedTemplateId) : null;
    const publishedVersion = template ? await getPublishedTemplateVersion(template.id) : null;
    const evaluation = evaluateMarketplaceTemplateBinding({
      itemKey: item.itemKey,
      itemType: "template",
      linkedTemplateId: item.linkedTemplateId,
      marketplaceStatus: item.status,
      marketplaceVisibility: item.visibility,
      storedBindingStatus: item.bindingStatus,
      template,
      templateVersion: template
        ? resolveBindingVersion(template, publishedVersion, item.templateVersion)
        : item.templateVersion
    });

    return {
      ...evaluation,
      bindingUpdatedAt: item.bindingUpdatedAt,
      itemId: item.id,
      itemKey: item.itemKey,
      itemName: item.name,
      marketplaceStatus: item.status,
      marketplaceVisibility: item.visibility,
      publishedVersionNumber: publishedVersion?.versionNumber ?? null
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("requires a template marketplace item")) {
      return null;
    }

    throw error;
  }
}

export async function ensureMarketplaceTemplateBindings() {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const [templates, { data, error }] = await Promise.all([
    listTemplates(),
    admin
      .from("marketplace_items" as never)
      .select(bindingItemSelect as never)
      .eq("item_type" as never, "template" as never)
  ]);

  if (error) {
    throw new Error(`Marketplace template items could not be loaded: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => rowRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  for (const row of rows) {
    const id = text(row.id, 120);
    const itemKey = text(row.item_key, 160);
    let linkedTemplateId = text(row.linked_template_id, 120) || null;

    if (!id || !itemKey) continue;

    if (!linkedTemplateId) {
      const template = await findTemplateByKey(templateKeyFromMarketplaceItemKey(itemKey), templates);
      linkedTemplateId = template?.id ?? null;
    }

    const template = linkedTemplateId ? await findTemplateById(linkedTemplateId, templates) : null;
    const publishedVersion = template ? await getPublishedTemplateVersion(template.id) : null;
    const evaluation = evaluateMarketplaceTemplateBinding({
      itemKey,
      itemType: "template",
      linkedTemplateId,
      marketplaceStatus: text(row.status, 40),
      marketplaceVisibility: text(row.visibility, 40),
      storedBindingStatus: parseMarketplaceTemplateBindingStatus(row.template_binding_status),
      template,
      templateVersion: template
        ? resolveBindingVersion(template, publishedVersion, text(row.template_version, 40) || null)
        : text(row.template_version, 40) || null
    });

    await persistMarketplaceTemplateBinding({
      bindingStatus: evaluation.bindingStatus,
      itemId: id,
      linkedTemplateId,
      templateVersion: evaluation.templateVersion
    });
  }
}

export async function getMarketplaceTemplateBindingStats(): Promise<MarketplaceTemplateBindingStats> {
  await ensureMarketplaceTemplateBindings();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select("template_binding_status, template_binding_updated_at" as never)
    .eq("item_type" as never, "template" as never);

  if (error) {
    throw new Error(`Marketplace template binding stats could not be loaded: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => rowRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  return rows.reduce<MarketplaceTemplateBindingStats>(
    (stats, row) => {
      stats.totalTemplateItems += 1;
      const status = parseMarketplaceTemplateBindingStatus(row.template_binding_status) ?? "unbound";

      if (status === "bound") stats.boundTemplateItems += 1;
      if (status === "invalid") stats.invalidTemplateItems += 1;
      if (status === "orphaned") stats.orphanedTemplateItems += 1;
      if (status === "unbound") stats.unboundTemplateItems += 1;

      return stats;
    },
    {
      boundTemplateItems: 0,
      invalidTemplateItems: 0,
      orphanedTemplateItems: 0,
      totalTemplateItems: 0,
      unboundTemplateItems: 0,
      verifiedTemplateItems: 0
    }
  );
}
