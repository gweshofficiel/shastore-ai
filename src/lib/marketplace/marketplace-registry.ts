import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertValidItemTypeSectionPair,
  assertValidMarketplaceItemType,
  countMarketplaceItemsByType,
  filterMarketplaceItemsBySection,
  filterMarketplaceItemsByType,
  getItemTypeForSection,
  getMarketplaceSectionLabel,
  getSectionForItemType,
  MARKETPLACE_SECTIONS,
  parseMarketplaceItemType,
  parseMarketplaceSection,
  type MarketplaceItemType,
  type MarketplaceItemTypeStats,
  type MarketplaceSection,
  validateItemTypeSectionPair
} from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  assertValidMarketplaceItemStatus,
  countMarketplaceItemsByStatus,
  parseMarketplaceItemStatus,
  type MarketplaceItemStatus
} from "@/src/lib/marketplace/marketplace-status-runtime";
import {
  assertValidMarketplaceItemVisibility,
  normalizeMarketplaceItemVisibility,
  parseMarketplaceItemVisibility,
  type MarketplaceItemVisibility
} from "@/src/lib/marketplace/marketplace-visibility-runtime";
import {
  parseMarketplaceApprovalAction,
  type MarketplaceApprovalMetadata
} from "@/src/lib/marketplace/marketplace-approval-runtime";
import {
  parseMarketplacePricingRecord,
  pricingTypeForMode,
  type MarketplacePricingRecord
} from "@/src/lib/marketplace/marketplace-pricing-runtime";
import { listTemplates } from "@/src/lib/templates/template-registry";

export type {
  MarketplaceItemType,
  MarketplaceItemTypeCatalogEntry,
  MarketplaceItemTypeStats,
  MarketplaceSection
} from "@/src/lib/marketplace/marketplace-item-type-runtime";
export {
  getItemTypeForSection,
  getMarketplaceItemTypeLabel,
  getMarketplaceSectionLabel,
  getSectionForItemType,
  isValidMarketplaceItemType,
  listMarketplaceItemTypeCatalog,
  MARKETPLACE_ITEM_TYPES,
  MARKETPLACE_SECTIONS,
  parseMarketplaceItemType,
  validateItemTypeSectionPair
} from "@/src/lib/marketplace/marketplace-item-type-runtime";
export type { MarketplaceItemStatus, MarketplaceStatusStats } from "@/src/lib/marketplace/marketplace-status-runtime";
export {
  approveMarketplaceItemStatus,
  archiveMarketplaceItemStatus,
  assertValidMarketplaceItemStatus,
  countMarketplaceItemsByStatus,
  getMarketplaceItemStatus,
  isValidMarketplaceItemStatus,
  markMarketplaceItemPendingReview,
  MARKETPLACE_ITEM_STATUSES,
  parseMarketplaceItemStatus,
  rejectMarketplaceItemStatus,
  setMarketplaceItemDraft,
  transitionMarketplaceItemStatus
} from "@/src/lib/marketplace/marketplace-status-runtime";
export type { MarketplaceItemVisibility, MarketplaceVisibilityStats } from "@/src/lib/marketplace/marketplace-visibility-runtime";
export {
  assertValidMarketplaceItemVisibility,
  canExposeMarketplaceItemPublicly,
  countMarketplaceItemsByVisibility,
  filterPublicMarketplaceEligibleItems,
  getMarketplaceItemVisibility,
  isPublicMarketplaceEligible,
  isValidMarketplaceItemVisibility,
  MARKETPLACE_ITEM_VISIBILITIES,
  normalizeMarketplaceItemVisibility,
  parseMarketplaceItemVisibility,
  setMarketplaceItemVisibility
} from "@/src/lib/marketplace/marketplace-visibility-runtime";
export type {
  MarketplaceApprovalAction,
  MarketplaceApprovalMetadata,
  MarketplaceApprovalResult
} from "@/src/lib/marketplace/marketplace-approval-runtime";
export {
  applyMarketplaceApprovalAction,
  approveMarketplaceItemApproval,
  archiveMarketplaceItemApproval,
  assertValidMarketplaceApprovalAction,
  canApplyMarketplaceApprovalAction,
  getAvailableMarketplaceApprovalActions,
  getMarketplaceApprovalTargetStatus,
  isValidMarketplaceApprovalAction,
  MARKETPLACE_APPROVAL_ACTIONS,
  parseMarketplaceApprovalAction,
  rejectMarketplaceItemApproval,
  restoreMarketplaceItemToDraft,
  submitMarketplaceItemForReview
} from "@/src/lib/marketplace/marketplace-approval-runtime";
export type {
  MarketplaceBillingInterval,
  MarketplaceCurrency,
  MarketplacePricingMode,
  MarketplacePricingRecord
} from "@/src/lib/marketplace/marketplace-pricing-runtime";
export {
  getMarketplaceItemPricing,
  isValidMarketplaceBillingInterval,
  isValidMarketplaceCurrency,
  isValidMarketplacePricingMode,
  MARKETPLACE_BILLING_INTERVALS,
  MARKETPLACE_CURRENCIES,
  MARKETPLACE_PRICING_MODES,
  parseMarketplaceBillingInterval,
  parseMarketplaceCurrency,
  parseMarketplacePricingMode,
  parseMarketplacePricingRecord,
  setMarketplaceItemPricing,
  validateMarketplacePricingInput
} from "@/src/lib/marketplace/marketplace-pricing-runtime";
export type {
  MarketplaceItemRevenueSummary,
  MarketplaceRevenueCalculation,
  MarketplaceRevenueEventRecord,
  MarketplaceRevenueStats,
  MarketplaceRevenueStatus
} from "@/src/lib/marketplace/marketplace-revenue-runtime";
export {
  calculateMarketplaceRevenue,
  getMarketplaceItemRevenueSummary,
  getMarketplacePlatformFeeRate,
  getMarketplaceRevenueStats,
  listMarketplaceRevenueEvents,
  MARKETPLACE_DEFAULT_PLATFORM_FEE_RATE,
  MARKETPLACE_REVENUE_STATUSES,
  parseMarketplaceRevenueEvent,
  parseMarketplaceRevenueStatus,
  recordMarketplaceRevenueEvent,
  validateMarketplaceRevenueCalculation
} from "@/src/lib/marketplace/marketplace-revenue-runtime";

export type MarketplaceSourceType = "creator" | "partner" | "platform" | "reseller";

export type MarketplacePricingType = "free" | "paid" | "premium" | "subscription";

export type MarketplaceItemRecord = {
  approval: MarketplaceApprovalMetadata;
  createdAt: string | null;
  creatorSource: string | null;
  currency: string | null;
  id: string;
  installCount: number;
  itemKey: string;
  itemType: MarketplaceItemType;
  linkedAppId: string | null;
  linkedPluginId: string | null;
  linkedServiceId: string | null;
  linkedTemplateId: string | null;
  linkedThemeId: string | null;
  metadata: Record<string, unknown>;
  name: string;
  priceAmount: number | null;
  pricing: MarketplacePricingRecord;
  pricingType: MarketplacePricingType;
  revenueAmount: number;
  revenueCurrency: string | null;
  section: MarketplaceSection;
  slug: string;
  sourceType: MarketplaceSourceType;
  status: MarketplaceItemStatus;
  updatedAt: string | null;
  visibility: MarketplaceItemVisibility;
};

export type MarketplaceItemFilters = {
  itemType?: MarketplaceItemType | MarketplaceItemType[];
  limit?: number;
  section?: MarketplaceSection | MarketplaceSection[];
  status?: MarketplaceItemStatus | MarketplaceItemStatus[];
  visibility?: MarketplaceItemVisibility | MarketplaceItemVisibility[];
};

export type MarketplaceRegistryStats = {
  approvedItems: number;
  archivedItems: number;
  draftItems: number;
  pendingReviewItems: number;
  rejectedItems: number;
  totalItems: number;
};

export type MarketplaceSectionSummary = {
  itemCount: number;
  readiness: "placeholder" | "ready";
  section: MarketplaceSection;
  sectionLabel: string;
};

const itemSelect =
  "id, item_key, slug, name, item_type, section, creator_source, source_type, status, visibility, pricing_mode, pricing_type, price_amount, currency, billing_interval, trial_days, pricing_updated_at, install_count, revenue_amount, revenue_currency, metadata, linked_template_id, linked_theme_id, linked_plugin_id, linked_app_id, linked_service_id, approved_by, approved_at, rejected_by, rejected_at, reviewed_by, reviewed_at, approval_note, approval_action, approval_updated_at, created_at, updated_at";

function parseApprovalMetadataFromRow(row: Record<string, unknown>): MarketplaceApprovalMetadata {
  return {
    approvalAction: parseMarketplaceApprovalAction(row.approval_action),
    approvalNote: text(row.approval_note, 2000) || null,
    approvalUpdatedAt: text(row.approval_updated_at, 80) || null,
    approvedAt: text(row.approved_at, 80) || null,
    approvedBy: text(row.approved_by, 120) || null,
    rejectedAt: text(row.rejected_at, 80) || null,
    rejectedBy: text(row.rejected_by, 120) || null,
    reviewedAt: text(row.reviewed_at, 80) || null,
    reviewedBy: text(row.reviewed_by, 120) || null
  };
}

export type MarketplaceSectionItems = {
  itemCount: number;
  itemType: MarketplaceItemType;
  items: MarketplaceItemRecord[];
  section: MarketplaceSection;
  sectionLabel: string;
};

const placeholderSeeds: Array<{
  creator_source: string;
  item_key: string;
  item_type: MarketplaceItemType;
  name: string;
  pricing_type: MarketplacePricingType;
  section: MarketplaceSection;
  slug: string;
  status: MarketplaceItemStatus;
  visibility: MarketplaceItemVisibility;
}> = [
  {
    creator_source: "SHASTORE platform",
    item_key: "theme:platform-brand-pack",
    item_type: "theme",
    name: "Platform Brand Theme Pack",
    pricing_type: "premium",
    section: "theme_marketplace",
    slug: "platform-brand-theme-pack",
    status: "draft",
    visibility: "internal"
  },
  {
    creator_source: "SHASTORE platform",
    item_key: "plugin:loyalty-foundation",
    item_type: "plugin",
    name: "Loyalty Plugin Foundation",
    pricing_type: "subscription",
    section: "plugin_marketplace",
    slug: "loyalty-plugin-foundation",
    status: "pending_review",
    visibility: "internal"
  },
  {
    creator_source: "SHASTORE platform",
    item_key: "app:analytics-connector",
    item_type: "app",
    name: "Analytics Connector App",
    pricing_type: "paid",
    section: "app_marketplace",
    slug: "analytics-connector-app",
    status: "draft",
    visibility: "internal"
  },
  {
    creator_source: "SHASTORE services",
    item_key: "service:store-launch-assistance",
    item_type: "service",
    name: "Store Launch Assistance",
    pricing_type: "paid",
    section: "service_marketplace",
    slug: "store-launch-assistance",
    status: "draft",
    visibility: "internal"
  }
];

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

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function rowRecord(value: unknown) {
  const candidate = value as unknown;
  return isRecord(candidate) ? candidate : null;
}

function parseItemType(value: unknown): MarketplaceItemType | null {
  return parseMarketplaceItemType(value);
}

function parseSection(value: unknown): MarketplaceSection | null {
  return parseMarketplaceSection(value);
}

function parseSourceType(value: unknown): MarketplaceSourceType {
  const cleaned = text(value, 40);
  if (cleaned === "creator") return "creator";
  if (cleaned === "reseller") return "reseller";
  if (cleaned === "partner") return "partner";
  return "platform";
}

function parseStatus(value: unknown): MarketplaceItemStatus | null {
  return parseMarketplaceItemStatus(value);
}

function parseVisibility(value: unknown): MarketplaceItemVisibility | null {
  return parseMarketplaceItemVisibility(value);
}

function parsePricingType(value: unknown): MarketplacePricingType {
  const cleaned = text(value, 40);
  if (cleaned === "paid") return "paid";
  if (cleaned === "premium") return "premium";
  if (cleaned === "subscription") return "subscription";
  return "free";
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseRecord(value: unknown): MarketplaceItemRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const itemKey = text(row.item_key, 160);
  const slug = text(row.slug, 160);
  const name = text(row.name, 240);

  if (!id || !itemKey || !slug || !name) return null;

  const itemType = parseItemType(row.item_type);
  const section = parseSection(row.section);

  if (!itemType || !section || !validateItemTypeSectionPair(itemType, section)) {
    return null;
  }

  const status = parseStatus(row.status);

  if (!status) {
    return null;
  }

  const visibility = parseVisibility(row.visibility);

  if (!visibility) {
    return null;
  }

  const pricing = parseMarketplacePricingRecord(row);

  if (!pricing) {
    return null;
  }

  return {
    approval: parseApprovalMetadataFromRow(row),
    createdAt: text(row.created_at, 80) || null,
    creatorSource: text(row.creator_source, 240) || null,
    currency: text(row.currency, 12) || null,
    id,
    installCount: Math.max(0, parseNumber(row.install_count) ?? 0),
    itemKey,
    itemType,
    linkedAppId: text(row.linked_app_id, 120) || null,
    linkedPluginId: text(row.linked_plugin_id, 120) || null,
    linkedServiceId: text(row.linked_service_id, 120) || null,
    linkedTemplateId: text(row.linked_template_id, 120) || null,
    linkedThemeId: text(row.linked_theme_id, 120) || null,
    metadata: safeRecord(row.metadata),
    name,
    priceAmount: pricing.priceAmount,
    pricing,
    pricingType: parsePricingType(row.pricing_type),
    revenueAmount: Math.max(0, parseNumber(row.revenue_amount) ?? 0),
    revenueCurrency: text(row.revenue_currency, 12) || null,
    section,
    slug,
    sourceType: parseSourceType(row.source_type),
    status,
    updatedAt: text(row.updated_at, 80) || null,
    visibility,
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access the marketplace registry.");
  }
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for the marketplace registry.");
  }

  return admin;
}

async function loadExistingItemKeys() {
  const admin = requireAdminClient();
  const { data, error } = await admin.from("marketplace_items" as never).select("item_key" as never);

  if (error) {
    throw new Error(`Marketplace registry could not be inspected: ${error.message}`);
  }

  return new Set(
    (Array.isArray(data) ? (data as unknown[]) : [])
      .map((row) => text(rowRecord(row)?.item_key, 160))
      .filter(Boolean)
  );
}

async function seedMissingPlaceholderItems() {
  const admin = requireAdminClient();
  const existingKeys = await loadExistingItemKeys();
  const missing = placeholderSeeds.filter((item) => !existingKeys.has(item.item_key));

  if (!missing.length) return;

  for (const item of missing) {
    assertValidMarketplaceItemType(item.item_type);
    assertValidItemTypeSectionPair(item.item_type, item.section);
    assertValidMarketplaceItemStatus(item.status);
    assertValidMarketplaceItemVisibility(item.visibility);
  }

  const { error } = await admin.from("marketplace_items" as never).insert(
    missing.map((item) => ({
      billing_interval: item.pricing_type === "subscription" ? "monthly" : null,
      creator_source: item.creator_source,
      currency: item.pricing_type === "free" ? "USD" : "USD",
      item_key: item.item_key,
      item_type: item.item_type,
      metadata: { source: "marketplace_registry_seed" },
      name: item.name,
      price_amount:
        item.pricing_type === "free"
          ? 0
          : item.pricing_type === "subscription"
            ? 9.99
            : 19.99,
      pricing_mode: pricingTypeForMode(
        item.pricing_type === "subscription"
          ? "subscription"
          : item.pricing_type === "free"
            ? "free"
            : "paid"
      ),
      pricing_type: item.pricing_type,
      section: item.section,
      slug: item.slug,
      source_type: "platform",
      status: item.status,
      visibility: item.visibility
    })) as never
  );

  if (error) {
    throw new Error(`Marketplace placeholder items could not be seeded: ${error.message}`);
  }
}

async function seedMissingTemplateItems() {
  const admin = requireAdminClient();
  const [existingKeys, templates] = await Promise.all([loadExistingItemKeys(), listTemplates()]);
  const missing = templates
    .map((template) => {
      const itemKey = `template:${template.templateKey}`;

      if (existingKeys.has(itemKey)) return null;

      const isPremium = template.badges.some((badge) => badge.toLowerCase() === "premium");

      return {
        creator_source: template.isOfficial ? "SHASTORE official" : "Existing template library",
        item_key: itemKey,
        item_type: "template" as const,
        linked_template_id: template.id,
        metadata: {
          source: "marketplace_registry_seed",
          templateKey: template.templateKey,
          templateRegistryId: template.id
        },
        name: template.name,
        price_amount: isPremium ? 29.99 : 0,
        pricing_mode: isPremium ? "paid" : "free",
        pricing_type: isPremium ? ("premium" as const) : ("free" as const),
        currency: "USD",
        section: "template_marketplace" as const,
        slug: template.slug,
        source_type: "platform" as const,
        status:
          template.status === "archived"
            ? ("archived" as const)
            : template.status === "active"
              ? ("approved" as const)
              : ("draft" as const),
        visibility: normalizeMarketplaceItemVisibility(template.visibility) ?? "internal"
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!missing.length) return;

  for (const item of missing) {
    assertValidMarketplaceItemType(item.item_type);
    assertValidItemTypeSectionPair(item.item_type, item.section);
    assertValidMarketplaceItemStatus(item.status);
    assertValidMarketplaceItemVisibility(item.visibility);
  }

  const { error } = await admin.from("marketplace_items" as never).insert(missing as never);

  if (error) {
    throw new Error(`Marketplace template items could not be seeded: ${error.message}`);
  }
}

export async function ensureMarketplaceRegistry() {
  await requireSuperAdmin();
  await seedMissingPlaceholderItems();
  await seedMissingTemplateItems();
}

export async function listMarketplaceItems(
  filters: MarketplaceItemFilters = {}
): Promise<MarketplaceItemRecord[]> {
  await ensureMarketplaceRegistry();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(filters.limit ?? 500, 1000));
  let query = admin.from("marketplace_items" as never).select(itemSelect as never);

  if (filters.section) {
    const sections = Array.isArray(filters.section) ? filters.section : [filters.section];
    query = query.in("section" as never, sections as never);
  }

  if (filters.itemType) {
    const types = Array.isArray(filters.itemType) ? filters.itemType : [filters.itemType];
    const validatedTypes = types.map((itemType) => assertValidMarketplaceItemType(itemType));
    query = query.in("item_type" as never, validatedTypes as never);
  }

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    const validatedStatuses = statuses.map((status) => assertValidMarketplaceItemStatus(status));
    query = query.in("status" as never, validatedStatuses as never);
  }

  if (filters.visibility) {
    const visibilities = Array.isArray(filters.visibility) ? filters.visibility : [filters.visibility];
    const validatedVisibilities = visibilities.map((visibility) =>
      assertValidMarketplaceItemVisibility(visibility)
    );
    query = query.in("visibility" as never, validatedVisibilities as never);
  }

  const { data, error } = await query.order("updated_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace items could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseRecord(row))
    .filter((item): item is MarketplaceItemRecord => Boolean(item));
}

export async function getMarketplaceItemByKey(itemKey: string): Promise<MarketplaceItemRecord | null> {
  await ensureMarketplaceRegistry();

  const cleanedKey = text(itemKey, 160);
  if (!cleanedKey) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(itemSelect as never)
    .eq("item_key" as never, cleanedKey as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace item could not be loaded: ${error.message}`);
  }

  return parseRecord(data);
}

export async function getMarketplaceItemBySlug(slug: string): Promise<MarketplaceItemRecord | null> {
  await ensureMarketplaceRegistry();

  const cleanedSlug = text(slug, 160);
  if (!cleanedSlug) return null;

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(itemSelect as never)
    .eq("slug" as never, cleanedSlug as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace item could not be loaded: ${error.message}`);
  }

  return parseRecord(data);
}

export async function getMarketplaceRegistryStats(): Promise<MarketplaceRegistryStats> {
  const items = await listMarketplaceItems();

  return countMarketplaceItemsByStatus(items);
}

export async function listMarketplaceSections(): Promise<MarketplaceSectionSummary[]> {
  const items = await listMarketplaceItems();

  return MARKETPLACE_SECTIONS.map((section) => {
    const sectionItems = filterMarketplaceItemsBySection(items, section);

    return {
      itemCount: sectionItems.length,
      readiness: section === "template_marketplace" ? "ready" : "placeholder",
      section,
      sectionLabel: getMarketplaceSectionLabel(section)
    };
  });
}

export async function listMarketplaceItemsByType(
  itemType: MarketplaceItemType
): Promise<MarketplaceItemRecord[]> {
  await ensureMarketplaceRegistry();
  assertValidMarketplaceItemType(itemType);

  const items = await listMarketplaceItems({
    itemType,
    section: getSectionForItemType(itemType)
  });

  return filterMarketplaceItemsByType(items, itemType);
}

export async function listMarketplaceItemsBySection(
  section: MarketplaceSection
): Promise<MarketplaceItemRecord[]> {
  await ensureMarketplaceRegistry();

  const parsedSection = parseMarketplaceSection(section);

  if (!parsedSection) {
    throw new Error("Marketplace section is invalid.");
  }

  const items = await listMarketplaceItems({
    itemType: getItemTypeForSection(parsedSection),
    section: parsedSection
  });

  return filterMarketplaceItemsBySection(items, parsedSection);
}

export async function getMarketplaceItemTypeStats(): Promise<MarketplaceItemTypeStats> {
  const items = await listMarketplaceItems();

  return countMarketplaceItemsByType(items);
}

export async function listMarketplaceSectionItemGroups(): Promise<MarketplaceSectionItems[]> {
  const items = await listMarketplaceItems();

  return MARKETPLACE_SECTIONS.map((section) => {
    const sectionItems = filterMarketplaceItemsBySection(items, section);

    return {
      itemCount: sectionItems.length,
      itemType: getItemTypeForSection(section),
      items: sectionItems,
      section,
      sectionLabel: getMarketplaceSectionLabel(section)
    };
  });
}

export function toAdminMarketplaceSectionName(
  section: MarketplaceSection
): "App Marketplace" | "Plugin Marketplace" | "Service Marketplace" | "Template Marketplace" | "Theme Marketplace" {
  return getMarketplaceSectionLabel(section) as
    | "App Marketplace"
    | "Plugin Marketplace"
    | "Service Marketplace"
    | "Template Marketplace"
    | "Theme Marketplace";
}
