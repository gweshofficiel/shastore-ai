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
  isPublicMarketplaceEligible,
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
export type {
  MarketplaceInstallEventRecord,
  MarketplaceInstallStats,
  MarketplaceInstallStatus,
  MarketplaceItemInstallSummary
} from "@/src/lib/marketplace/marketplace-install-runtime";
export {
  getMarketplaceInstallStats,
  getMarketplaceItemInstallSummary,
  isInstallCountableMarketplaceItemType,
  isPublicInstallEligible,
  listMarketplaceInstallEvents,
  MARKETPLACE_INSTALL_COUNTABLE_TYPES,
  MARKETPLACE_INSTALL_STATUSES,
  parseMarketplaceInstallEvent,
  parseMarketplaceInstallStatus,
  recordMarketplaceInstallEvent,
  transitionMarketplaceInstallStatus
} from "@/src/lib/marketplace/marketplace-install-runtime";
export type {
  MarketplaceTemplateBindingRecord,
  MarketplaceTemplateBindingStats,
  MarketplaceTemplateBindingStatus,
  MarketplaceTemplateBindingVerification
} from "@/src/lib/marketplace/marketplace-template-binding-runtime";
export {
  bindMarketplaceTemplateItem,
  ensureMarketplaceTemplateBindings,
  evaluateMarketplaceTemplateBinding,
  getMarketplaceTemplateBindingStats,
  getMarketplaceTemplateBindingSummary,
  MARKETPLACE_TEMPLATE_BINDING_STATUSES,
  parseMarketplaceTemplateBindingStatus,
  validateMarketplaceTemplateReference,
  verifyMarketplaceTemplateBinding
} from "@/src/lib/marketplace/marketplace-template-binding-runtime";
import {
  parseMarketplaceTemplateBindingStatus,
  type MarketplaceTemplateBindingStatus
} from "@/src/lib/marketplace/marketplace-template-binding-runtime";
import { ensureMarketplaceTemplateBindings } from "@/src/lib/marketplace/marketplace-template-binding-runtime";
export type {
  MarketplaceThemeBindingRecord,
  MarketplaceThemeBindingStats,
  MarketplaceThemeBindingStatus,
  MarketplaceThemeBindingVerification
} from "@/src/lib/marketplace/marketplace-theme-binding-runtime";
export {
  bindMarketplaceThemeItem,
  ensureMarketplaceThemeBindings,
  evaluateMarketplaceThemeBinding,
  getMarketplaceThemeBindingStats,
  getMarketplaceThemeBindingSummary,
  MARKETPLACE_THEME_BINDING_STATUSES,
  parseMarketplaceThemeBindingStatus,
  validateMarketplaceThemeReference,
  verifyMarketplaceThemeBinding
} from "@/src/lib/marketplace/marketplace-theme-binding-runtime";
import {
  parseMarketplaceThemeBindingStatus,
  type MarketplaceThemeBindingStatus
} from "@/src/lib/marketplace/marketplace-theme-binding-runtime";
import { ensureMarketplaceThemeBindings } from "@/src/lib/marketplace/marketplace-theme-binding-runtime";
import { ensureMarketplacePluginBindings } from "@/src/lib/marketplace/marketplace-plugin-runtime";
export type {
  MarketplacePluginBindingRecord,
  MarketplacePluginBindingStats,
  MarketplacePluginBindingStatus,
  MarketplacePluginInspection
} from "@/src/lib/marketplace/marketplace-plugin-runtime";
export {
  ensureMarketplacePluginBindings,
  evaluateMarketplacePluginBinding,
  getMarketplacePluginBindingStats,
  getMarketplacePluginInspection,
  isValidMarketplacePluginBindingStatus,
  isValidPluginKey,
  listMarketplacePluginBindings,
  MARKETPLACE_PLUGIN_BINDING_STATUSES,
  parseMarketplacePluginBindingStatus,
  pluginKeyFromMarketplaceItemKey,
  sanitizePluginManifest,
  validatePluginManifest,
  verifyMarketplacePluginBinding
} from "@/src/lib/marketplace/marketplace-plugin-runtime";
import { ensureMarketplaceAppBindings } from "@/src/lib/marketplace/marketplace-app-runtime";
export type {
  MarketplaceAppBindingRecord,
  MarketplaceAppBindingStats,
  MarketplaceAppBindingStatus,
  MarketplaceAppInspection
} from "@/src/lib/marketplace/marketplace-app-runtime";
export {
  appKeyFromMarketplaceItemKey,
  ensureMarketplaceAppBindings,
  evaluateMarketplaceAppBinding,
  getMarketplaceAppBindingStats,
  getMarketplaceAppInspection,
  isValidAppKey,
  isValidMarketplaceAppBindingStatus,
  listMarketplaceAppBindings,
  MARKETPLACE_APP_BINDING_STATUSES,
  parseMarketplaceAppBindingStatus,
  sanitizeAppManifest,
  validateAppManifest,
  verifyMarketplaceAppBinding
} from "@/src/lib/marketplace/marketplace-app-runtime";
import { ensureMarketplaceServiceBindings } from "@/src/lib/marketplace/marketplace-service-runtime";
export type {
  MarketplaceServiceBindingRecord,
  MarketplaceServiceBindingStats,
  MarketplaceServiceBindingStatus,
  MarketplaceServiceInspection
} from "@/src/lib/marketplace/marketplace-service-runtime";
export {
  ensureMarketplaceServiceBindings,
  evaluateMarketplaceServiceBinding,
  getMarketplaceServiceBindingStats,
  getMarketplaceServiceInspection,
  isValidMarketplaceServiceBindingStatus,
  isValidServiceKey,
  listMarketplaceServiceBindings,
  MARKETPLACE_SERVICE_BINDING_STATUSES,
  parseMarketplaceServiceBindingStatus,
  sanitizeServiceRequirements,
  serviceKeyFromMarketplaceItemKey,
  validateServiceRequirements,
  verifyMarketplaceServiceBinding
} from "@/src/lib/marketplace/marketplace-service-runtime";
import { ensureMarketplaceCreatorFoundation } from "@/src/lib/marketplace/marketplace-creator-runtime";
export type {
  MarketplaceCreatorAccountRecord,
  MarketplaceCreatorAccountStats,
  MarketplaceCreatorInspection,
  MarketplaceCreatorStatus,
  MarketplaceCreatorType,
  MarketplaceCreatorVerificationStatus,
  MarketplaceItemCreatorInspection
} from "@/src/lib/marketplace/marketplace-creator-runtime";
export {
  ensureMarketplaceCreatorAccounts,
  ensureMarketplaceCreatorFoundation,
  ensureMarketplaceCreatorItemLinks,
  evaluateMarketplaceCreatorAccount,
  evaluateMarketplaceItemCreatorLink,
  getMarketplaceCreatorAccountById,
  getMarketplaceCreatorAccountStats,
  getMarketplaceCreatorInspection,
  isPublicCreatorEligible,
  isValidCreatorPublicSlug,
  isValidMarketplaceCreatorStatus,
  isValidMarketplaceCreatorType,
  isValidMarketplaceCreatorVerificationStatus,
  listMarketplaceCreatorAccounts,
  MARKETPLACE_CREATOR_STATUSES,
  MARKETPLACE_CREATOR_TYPES,
  MARKETPLACE_CREATOR_VERIFICATION_STATUSES,
  parseMarketplaceCreatorAccount,
  parseMarketplaceCreatorStatus,
  parseMarketplaceCreatorType,
  parseMarketplaceCreatorVerificationStatus,
  sanitizeCreatorMetadata,
  validateCreatorMetadata,
  verifyMarketplaceCreatorAccount
} from "@/src/lib/marketplace/marketplace-creator-runtime";
export type {
  MarketplaceCreatorSubmissionInspection,
  MarketplaceCreatorSubmissionRecord,
  MarketplaceCreatorSubmissionResult,
  MarketplaceSubmissionStatus
} from "@/src/lib/marketplace/marketplace-creator-submission-runtime";
export {
  evaluateMarketplaceCreatorSubmissionInspection,
  getLatestMarketplaceCreatorSubmission,
  isValidMarketplaceSubmissionStatus,
  MARKETPLACE_SUBMISSION_STATUSES,
  parseMarketplaceCreatorSubmission,
  parseMarketplaceSubmissionStatus,
  sanitizeSubmissionMetadata,
  submitMarketplaceCreatorSubmission,
  validateMarketplaceCreatorSubmission,
  validateSubmissionMetadata
} from "@/src/lib/marketplace/marketplace-creator-submission-runtime";
export type {
  MarketplaceModerationAction,
  MarketplaceModerationEventRecord,
  MarketplaceModerationInspection,
  MarketplaceModerationResult
} from "@/src/lib/marketplace/marketplace-moderation-runtime";
export {
  applyMarketplaceModerationAction,
  assertMarketplaceModerationTransition,
  assertValidMarketplaceModerationAction,
  canApplyMarketplaceModerationAction,
  evaluateMarketplaceModerationInspection,
  getAvailableMarketplaceModerationActions,
  getLatestMarketplaceModerationEvent,
  getMarketplaceModerationTargetStatus,
  isValidMarketplaceModerationAction,
  MARKETPLACE_MODERATION_ACTIONS,
  parseMarketplaceModerationAction,
  parseMarketplaceModerationEvent,
  sanitizeModerationMetadata
} from "@/src/lib/marketplace/marketplace-moderation-runtime";
import {
  parseMarketplaceModerationAction,
  type MarketplaceModerationAction
} from "@/src/lib/marketplace/marketplace-moderation-runtime";
export type {
  MarketplaceAssetPublicView,
  MarketplaceAssetRecord,
  MarketplaceAssetStats,
  MarketplaceAssetStatus,
  MarketplaceAssetType,
  MarketplaceItemAssetsInspection,
  MarketplaceStorageProvider
} from "@/src/lib/marketplace/marketplace-asset-runtime";
export {
  evaluateMarketplaceItemAssetsInspection,
  filterPublicMarketplaceAssets,
  getMarketplaceAssetById,
  getMarketplaceAssetStats,
  getMarketplaceAssetsForItem,
  isPublicMarketplaceAssetEligible,
  isPublicMarketplaceItemEligible,
  isValidMarketplaceAssetStatus,
  isValidMarketplaceAssetType,
  isValidMarketplaceStorageProvider,
  listMarketplaceAssets,
  MARKETPLACE_ASSET_STATUSES,
  MARKETPLACE_ASSET_TYPES,
  MARKETPLACE_STORAGE_PROVIDERS,
  parseMarketplaceAsset,
  parseMarketplaceAssetStatus,
  parseMarketplaceAssetType,
  parseMarketplaceStorageProvider,
  registerMarketplaceAsset,
  sanitizeAssetMetadata,
  toMarketplaceAssetPublicView,
  validateAssetMetadata,
  verifyMarketplaceItemAssets,
  listMarketplaceAssetsForPublicCatalog
} from "@/src/lib/marketplace/marketplace-asset-runtime";
import { listThemePresets } from "@/src/lib/platform-theme/platform-theme-presets";

export type MarketplaceSourceType = "creator" | "partner" | "platform" | "reseller";

export type MarketplacePricingType = "free" | "paid" | "premium" | "subscription";

export type MarketplaceModerationMetadata = {
  moderatedAt: string | null;
  moderatedBy: string | null;
  moderationAction: MarketplaceModerationAction | null;
  moderationNote: string | null;
  moderationReason: string | null;
  moderationUpdatedAt: string | null;
};

export type MarketplaceItemRecord = {
  approval: MarketplaceApprovalMetadata;
  createdAt: string | null;
  creatorAccountId: string | null;
  creatorSource: string | null;
  currency: string | null;
  id: string;
  installCount: number;
  installCountUpdatedAt: string | null;
  itemKey: string;
  itemType: MarketplaceItemType;
  linkedAppId: string | null;
  linkedPluginId: string | null;
  linkedServiceId: string | null;
  linkedTemplateId: string | null;
  linkedThemeId: string | null;
  liveInstalls: number;
  metadata: Record<string, unknown>;
  moderation: MarketplaceModerationMetadata;
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
  submissionNote: string | null;
  submissionStatus: string | null;
  submissionUpdatedAt: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  templateBinding: {
    bindingStatus: MarketplaceTemplateBindingStatus | null;
    bindingUpdatedAt: string | null;
    templateVersion: string | null;
  };
  themeBinding: {
    bindingStatus: MarketplaceThemeBindingStatus | null;
    bindingUpdatedAt: string | null;
    themeVersion: string | null;
  };
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
  "id, item_key, slug, name, item_type, section, creator_source, creator_account_id, source_type, status, visibility, pricing_mode, pricing_type, price_amount, currency, billing_interval, trial_days, pricing_updated_at, install_count, live_installs, install_count_updated_at, revenue_amount, revenue_currency, linked_template_id, template_version, template_binding_status, template_binding_updated_at, linked_theme_id, theme_version, theme_binding_status, theme_binding_updated_at, metadata, linked_plugin_id, linked_app_id, linked_service_id, submitted_by, submitted_at, submission_note, submission_status, submission_updated_at, approved_by, approved_at, rejected_by, rejected_at, reviewed_by, reviewed_at, approval_note, approval_action, approval_updated_at, moderated_by, moderated_at, moderation_action, moderation_reason, moderation_note, moderation_updated_at, created_at, updated_at";

const itemSelectWithoutModeration =
  "id, item_key, slug, name, item_type, section, creator_source, creator_account_id, source_type, status, visibility, pricing_mode, pricing_type, price_amount, currency, billing_interval, trial_days, pricing_updated_at, install_count, live_installs, install_count_updated_at, revenue_amount, revenue_currency, linked_template_id, template_version, template_binding_status, template_binding_updated_at, linked_theme_id, theme_version, theme_binding_status, theme_binding_updated_at, metadata, linked_plugin_id, linked_app_id, linked_service_id, submitted_by, submitted_at, submission_note, submission_status, submission_updated_at, approved_by, approved_at, rejected_by, rejected_at, reviewed_by, reviewed_at, approval_note, approval_action, approval_updated_at, created_at, updated_at";

const itemSelectWithoutSubmissionAndModeration =
  "id, item_key, slug, name, item_type, section, creator_source, creator_account_id, source_type, status, visibility, pricing_mode, pricing_type, price_amount, currency, billing_interval, trial_days, pricing_updated_at, install_count, live_installs, install_count_updated_at, revenue_amount, revenue_currency, linked_template_id, template_version, template_binding_status, template_binding_updated_at, linked_theme_id, theme_version, theme_binding_status, theme_binding_updated_at, metadata, linked_plugin_id, linked_app_id, linked_service_id, approved_by, approved_at, rejected_by, rejected_at, reviewed_by, reviewed_at, approval_note, approval_action, approval_updated_at, created_at, updated_at";

const itemSelectCore =
  "id, item_key, slug, name, item_type, section, creator_source, source_type, status, visibility, pricing_mode, pricing_type, price_amount, currency, billing_interval, trial_days, pricing_updated_at, install_count, live_installs, install_count_updated_at, revenue_amount, revenue_currency, linked_template_id, template_version, template_binding_status, template_binding_updated_at, linked_theme_id, theme_version, theme_binding_status, theme_binding_updated_at, metadata, linked_plugin_id, linked_app_id, linked_service_id, approved_by, approved_at, rejected_by, rejected_at, reviewed_by, reviewed_at, approval_note, approval_action, approval_updated_at, created_at, updated_at";

const marketplaceItemSelectTiers = [
  itemSelect,
  itemSelectWithoutModeration,
  itemSelectWithoutSubmissionAndModeration,
  itemSelectCore
] as const;

function isMarketplaceSchemaDriftError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("does not exist") ||
    normalized.includes("unknown column") ||
    normalized.includes("could not find") ||
    (normalized.includes("column") && normalized.includes("not found"))
  );
}

async function queryMarketplaceItemRows(params: {
  buildQuery: (select: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  context: string;
}) {
  let lastMessage = "Marketplace items could not be loaded.";

  for (const select of marketplaceItemSelectTiers) {
    const { data, error } = await params.buildQuery(select);

    if (!error) {
      if (select !== itemSelect) {
        console.warn(
          `[marketplace-registry] ${params.context} loaded with reduced marketplace schema select. Apply pending MP-14/15/16 migrations for full metadata.`
        );
      }

      if (Array.isArray(data)) {
        return data as unknown[];
      }

      return data ? [data] : [];
    }

    lastMessage = error.message;

    if (!isMarketplaceSchemaDriftError(error.message)) {
      throw new Error(`Marketplace items could not be loaded: ${error.message}`);
    }

    console.warn(
      `[marketplace-registry] ${params.context} select fallback after schema drift: ${error.message}`
    );
  }

  throw new Error(`Marketplace items could not be loaded: ${lastMessage}`);
}

function applyMarketplaceItemFilters(
  query: ReturnType<ReturnType<typeof requireAdminClient>["from"]>,
  filters: MarketplaceItemFilters
) {
  let filteredQuery = query;

  if (filters.section) {
    const sections = Array.isArray(filters.section) ? filters.section : [filters.section];
    filteredQuery = filteredQuery.in("section" as never, sections as never);
  }

  if (filters.itemType) {
    const types = Array.isArray(filters.itemType) ? filters.itemType : [filters.itemType];
    const validatedTypes = types.map((itemType) => assertValidMarketplaceItemType(itemType));
    filteredQuery = filteredQuery.in("item_type" as never, validatedTypes as never);
  }

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    const validatedStatuses = statuses.map((status) => assertValidMarketplaceItemStatus(status));
    filteredQuery = filteredQuery.in("status" as never, validatedStatuses as never);
  }

  if (filters.visibility) {
    const visibilities = Array.isArray(filters.visibility) ? filters.visibility : [filters.visibility];
    const validatedVisibilities = visibilities.map((visibility) =>
      assertValidMarketplaceItemVisibility(visibility)
    );
    filteredQuery = filteredQuery.in("visibility" as never, validatedVisibilities as never);
  }

  return filteredQuery;
}

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

function parseModerationMetadataFromRow(row: Record<string, unknown>): MarketplaceModerationMetadata {
  return {
    moderatedAt: text(row.moderated_at, 80) || null,
    moderatedBy: text(row.moderated_by, 120) || null,
    moderationAction: parseMarketplaceModerationAction(row.moderation_action),
    moderationNote: text(row.moderation_note, 2000) || null,
    moderationReason: text(row.moderation_reason, 500) || null,
    moderationUpdatedAt: text(row.moderation_updated_at, 80) || null
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
    creatorAccountId: text(row.creator_account_id, 120) || null,
    creatorSource: text(row.creator_source, 240) || null,
    currency: text(row.currency, 12) || null,
    id,
    installCount: Math.max(0, parseNumber(row.install_count) ?? 0),
    installCountUpdatedAt: text(row.install_count_updated_at, 80) || null,
    itemKey,
    itemType,
    linkedAppId: text(row.linked_app_id, 120) || null,
    linkedPluginId: text(row.linked_plugin_id, 120) || null,
    linkedServiceId: text(row.linked_service_id, 120) || null,
    linkedTemplateId: text(row.linked_template_id, 120) || null,
    linkedThemeId: text(row.linked_theme_id, 120) || null,
    liveInstalls: Math.max(0, parseNumber(row.live_installs) ?? 0),
    metadata: safeRecord(row.metadata),
    moderation: parseModerationMetadataFromRow(row),
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
    submissionNote: text(row.submission_note, 2000) || null,
    submissionStatus: text(row.submission_status, 40) || null,
    submissionUpdatedAt: text(row.submission_updated_at, 80) || null,
    submittedAt: text(row.submitted_at, 80) || null,
    submittedBy: text(row.submitted_by, 120) || null,
    templateBinding: {
      bindingStatus: parseMarketplaceTemplateBindingStatus(row.template_binding_status),
      bindingUpdatedAt: text(row.template_binding_updated_at, 80) || null,
      templateVersion: text(row.template_version, 40) || null
    },
    themeBinding: {
      bindingStatus: parseMarketplaceThemeBindingStatus(row.theme_binding_status),
      bindingUpdatedAt: text(row.theme_binding_updated_at, 80) || null,
      themeVersion: text(row.theme_version, 40) || null
    },
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
        template_binding_status: "bound" as const,
        template_version: template.version,
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

async function seedMissingThemeItems() {
  const admin = requireAdminClient();
  const [existingKeys, presets] = await Promise.all([loadExistingItemKeys(), listThemePresets(false)]);
  const missing = presets
    .map((preset) => {
      const itemKey = `theme:${preset.presetKey}`;

      if (existingKeys.has(itemKey)) return null;

      const isPremium = preset.presetKey === "bold";

      return {
        creator_source: preset.isSystem ? "SHASTORE official" : "Platform theme library",
        item_key: itemKey,
        item_type: "theme" as const,
        linked_theme_id: preset.id,
        metadata: {
          presetKey: preset.presetKey,
          source: "marketplace_registry_seed",
          themePresetId: preset.id
        },
        name: preset.name,
        price_amount: isPremium ? 14.99 : 0,
        pricing_mode: isPremium ? "paid" : "free",
        pricing_type: isPremium ? ("premium" as const) : ("free" as const),
        currency: "USD",
        section: "theme_marketplace" as const,
        slug: preset.presetKey,
        source_type: "platform" as const,
        status: preset.status === "archived" ? ("archived" as const) : ("draft" as const),
        theme_binding_status: "bound" as const,
        theme_version: preset.updatedAt?.slice(0, 10) ?? "1",
        visibility: "internal" as const
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
    throw new Error(`Marketplace theme items could not be seeded: ${error.message}`);
  }
}

export async function ensureMarketplaceRegistry() {
  await requireSuperAdmin();
  await seedMissingPlaceholderItems();
  await seedMissingTemplateItems();
  await seedMissingThemeItems();
  await ensureMarketplaceTemplateBindings();
  await ensureMarketplaceThemeBindings();
  await ensureMarketplacePluginBindings();
  await ensureMarketplaceAppBindings();
  await ensureMarketplaceServiceBindings();

  try {
    await ensureMarketplaceCreatorFoundation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isMarketplaceSchemaDriftError(message)) {
      console.warn(`[marketplace-registry] Creator foundation skipped pending schema: ${message}`);
      return;
    }

    throw error;
  }
}

export async function listMarketplaceItems(
  filters: MarketplaceItemFilters = {}
): Promise<MarketplaceItemRecord[]> {
  await ensureMarketplaceRegistry();

  return listMarketplaceItemsReadOnly(filters);
}

export async function listMarketplaceItemsReadOnly(
  filters: MarketplaceItemFilters = {}
): Promise<MarketplaceItemRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(filters.limit ?? 500, 1000));
  const rows = await queryMarketplaceItemRows({
    context: "listMarketplaceItemsReadOnly",
    buildQuery: (select) =>
      applyMarketplaceItemFilters(admin.from("marketplace_items" as never).select(select as never), filters)
        .order("updated_at" as never, { ascending: false })
        .limit(limit)
  });

  return rows
    .map((row) => parseRecord(row))
    .filter((item): item is MarketplaceItemRecord => Boolean(item));
}

export type MarketplacePublicCatalogItemFilters = {
  itemId?: string;
  itemType?: MarketplaceItemType | MarketplaceItemType[];
  limit?: number;
  section?: MarketplaceSection | MarketplaceSection[];
  slug?: string;
};

export async function listMarketplaceItemsForPublicCatalog(
  filters: MarketplacePublicCatalogItemFilters = {}
): Promise<MarketplaceItemRecord[]> {
  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const cleanedSlug = filters.slug ? text(filters.slug, 160) : "";
  const cleanedItemId = filters.itemId ? text(filters.itemId, 120) : "";

  const rows = await queryMarketplaceItemRows({
    context: "listMarketplaceItemsForPublicCatalog",
    buildQuery: (select) => {
      let query = admin
        .from("marketplace_items" as never)
        .select(select as never)
        .eq("status" as never, "approved" as never)
        .eq("visibility" as never, "public" as never);

      if (filters.section) {
        const sections = Array.isArray(filters.section) ? filters.section : [filters.section];
        query = query.in("section" as never, sections as never);
      }

      if (filters.itemType) {
        const types = Array.isArray(filters.itemType) ? filters.itemType : [filters.itemType];
        const validatedTypes = types.map((itemType) => assertValidMarketplaceItemType(itemType));
        query = query.in("item_type" as never, validatedTypes as never);
      }

      if (cleanedSlug) {
        query = query.eq("slug" as never, cleanedSlug as never);
      }

      if (cleanedItemId) {
        query = query.eq("id" as never, cleanedItemId as never);
      }

      return query.order("updated_at" as never, { ascending: false }).limit(limit);
    }
  });

  return rows
    .map((row) => parseRecord(row))
    .filter((item): item is MarketplaceItemRecord => Boolean(item))
    .filter((item) => isPublicMarketplaceEligible({ status: item.status, visibility: item.visibility }));
}

export async function getMarketplaceItemByKey(itemKey: string): Promise<MarketplaceItemRecord | null> {
  await ensureMarketplaceRegistry();

  const cleanedKey = text(itemKey, 160);
  if (!cleanedKey) return null;

  const admin = requireAdminClient();
  const rows = await queryMarketplaceItemRows({
    context: "getMarketplaceItemByKey",
    buildQuery: (select) =>
      admin
        .from("marketplace_items" as never)
        .select(select as never)
        .eq("item_key" as never, cleanedKey as never)
        .maybeSingle()
  });

  return parseRecord(rows[0] ?? null);
}

export async function getMarketplaceItemBySlug(slug: string): Promise<MarketplaceItemRecord | null> {
  await ensureMarketplaceRegistry();

  const cleanedSlug = text(slug, 160);
  if (!cleanedSlug) return null;

  const admin = requireAdminClient();
  const rows = await queryMarketplaceItemRows({
    context: "getMarketplaceItemBySlug",
    buildQuery: (select) =>
      admin
        .from("marketplace_items" as never)
        .select(select as never)
        .eq("slug" as never, cleanedSlug as never)
        .maybeSingle()
  });

  return parseRecord(rows[0] ?? null);
}

export async function getMarketplaceRegistryStats(): Promise<MarketplaceRegistryStats> {
  const items = await listMarketplaceItems();

  return countMarketplaceItemsByStatus(items);
}

export async function getMarketplaceRegistryStatsReadOnly(): Promise<MarketplaceRegistryStats> {
  const items = await listMarketplaceItemsReadOnly();

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

  return buildMarketplaceSectionItemGroups(items);
}

export async function listMarketplaceSectionItemGroupsReadOnly(): Promise<MarketplaceSectionItems[]> {
  const items = await listMarketplaceItemsReadOnly();

  return buildMarketplaceSectionItemGroups(items);
}

function buildMarketplaceSectionItemGroups(items: MarketplaceItemRecord[]): MarketplaceSectionItems[] {
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

export function createEmptyMarketplaceSectionItemGroups(): MarketplaceSectionItems[] {
  return buildMarketplaceSectionItemGroups([]);
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

export type {
  MarketplacePublicCatalogEntry,
  MarketplacePublicCatalogFilters,
  MarketplacePublicCatalogListResult,
  MarketplacePublicCatalogStats
} from "@/src/lib/marketplace/marketplace-public-catalog-runtime";
export {
  getMarketplacePublicCatalogEntryBySlug,
  getMarketplacePublicCatalogEntryByTypeAndSlug,
  getMarketplacePublicCatalogStats,
  isPublicCatalogItemEligible,
  listMarketplacePublicCatalog,
  listMarketplacePublicCatalogBySection,
  listMarketplacePublicCatalogSections,
  resolvePublicCatalogThumbnail,
  sanitizePublicCatalogDescription,
  toMarketplacePublicCatalogEntry,
  toPublicCatalogAssetViews
} from "@/src/lib/marketplace/marketplace-public-catalog-runtime";
export type {
  MarketplacePublicItemDetail,
  MarketplacePublicItemDetailLookup
} from "@/src/lib/marketplace/marketplace-public-item-detail-runtime";
export {
  formatPublicMarketplaceDate,
  getMarketplacePublicItemDetail,
  getMarketplacePublicItemDetailById,
  getMarketplacePublicItemDetailBySlug,
  getMarketplacePublicItemDetailByTypeAndSlug,
  groupPublicItemDetailAssets,
  toMarketplacePublicItemDetail
} from "@/src/lib/marketplace/marketplace-public-item-detail-runtime";
export type {
  CreateMarketplacePurchaseFoundationInput,
  MarketplacePaymentProvider,
  MarketplacePurchaseEligibility,
  MarketplacePurchaseRecord,
  MarketplacePurchaseStats,
  MarketplacePurchaseStatus
} from "@/src/lib/marketplace/marketplace-purchase-runtime";
export {
  cancelMarketplacePurchaseFoundation,
  createMarketplacePurchaseFoundation,
  evaluateMarketplacePurchaseEligibility,
  getMarketplacePurchaseById,
  getMarketplacePurchaseStats,
  inspectMarketplacePurchaseEligibility,
  isValidMarketplacePaymentProvider,
  isValidMarketplacePurchaseStatus,
  listMarketplacePurchases,
  MARKETPLACE_PAYMENT_PROVIDERS,
  MARKETPLACE_PURCHASE_STATUSES,
  parseMarketplacePaymentProvider,
  parseMarketplacePurchase,
  parseMarketplacePurchaseStatus,
  sanitizePurchaseMetadata,
  validatePurchaseMetadata
} from "@/src/lib/marketplace/marketplace-purchase-runtime";
export type {
  MarketplaceTemplateSaleEligibility,
  MarketplaceTemplateSaleRecord,
  MarketplaceTemplateSaleStats,
  MarketplaceTemplateSaleStatus
} from "@/src/lib/marketplace/marketplace-template-sales-runtime";
export {
  cancelMarketplaceTemplateSaleFoundation,
  createMarketplaceTemplateSaleFromPurchase,
  evaluateMarketplaceTemplateSaleEligibility,
  getMarketplaceTemplateSaleById,
  getMarketplaceTemplateSaleByPurchaseId,
  getMarketplaceTemplateSaleStats,
  inspectMarketplaceTemplateSaleEligibility,
  isValidMarketplaceTemplateSaleStatus,
  listMarketplaceTemplateSales,
  MARKETPLACE_TEMPLATE_SALE_STATUSES,
  parseMarketplaceTemplateSale,
  parseMarketplaceTemplateSaleStatus,
  sanitizeTemplateSaleMetadata,
  validateTemplateSaleMetadata
} from "@/src/lib/marketplace/marketplace-template-sales-runtime";
export type {
  CreateMarketplaceAppPluginInstallationInput,
  MarketplaceAppPluginInstallationEligibility,
  MarketplaceAppPluginInstallationRecord,
  MarketplaceAppPluginInstallationStats,
  MarketplaceAppPluginInstallationStatus,
  MarketplaceAppPluginInstallationType
} from "@/src/lib/marketplace/marketplace-app-plugin-installation-runtime";
export {
  createMarketplaceAppPluginInstallationFromPurchase,
  disableMarketplaceAppPluginInstallationFoundation,
  evaluateMarketplaceAppPluginInstallationEligibility,
  getMarketplaceAppPluginInstallationById,
  getMarketplaceAppPluginInstallationByPurchaseId,
  getMarketplaceAppPluginInstallationStats,
  inspectMarketplaceAppPluginInstallationEligibility,
  isValidMarketplaceAppPluginInstallationStatus,
  isValidMarketplaceAppPluginInstallationType,
  listMarketplaceAppPluginInstallations,
  MARKETPLACE_APP_PLUGIN_INSTALLATION_STATUSES,
  MARKETPLACE_APP_PLUGIN_INSTALLATION_TYPES,
  parseMarketplaceAppPluginInstallation,
  parseMarketplaceAppPluginInstallationStatus,
  parseMarketplaceAppPluginInstallationType,
  sanitizeAppPluginInstallationMetadata,
  uninstallMarketplaceAppPluginInstallationFoundation,
  validateAppPluginInstallationMetadata
} from "@/src/lib/marketplace/marketplace-app-plugin-installation-runtime";
export type {
  CreateMarketplaceResellerItemFoundationInput,
  MarketplaceResellerCommissionMode,
  MarketplaceResellerItemEligibility,
  MarketplaceResellerItemRecord,
  MarketplaceResellerItemStats,
  MarketplaceResellerStatus
} from "@/src/lib/marketplace/marketplace-reseller-runtime";
export {
  archiveMarketplaceResellerItemFoundation,
  calculateResellerCommissionPreview,
  createMarketplaceResellerItemFoundation,
  evaluateMarketplaceResellerItemEligibility,
  getMarketplaceResellerItemById,
  getMarketplaceResellerItemStats,
  inspectMarketplaceResellerItemEligibility,
  isResellerSupportedMarketplaceItemType,
  isValidMarketplaceResellerCommissionMode,
  isValidMarketplaceResellerStatus,
  listMarketplaceResellerItems,
  MARKETPLACE_RESELLER_COMMISSION_MODES,
  MARKETPLACE_RESELLER_STATUSES,
  MARKETPLACE_RESELLER_SUPPORTED_ITEM_TYPES,
  parseMarketplaceResellerCommissionMode,
  parseMarketplaceResellerItem,
  parseMarketplaceResellerStatus,
  sanitizeResellerMetadata,
  suspendMarketplaceResellerItemFoundation,
  validateResellerMetadata
} from "@/src/lib/marketplace/marketplace-reseller-runtime";
export type {
  CreateMarketplaceReviewInput,
  MarketplacePublicReview,
  MarketplaceReviewAggregate,
  MarketplaceReviewEligibility,
  MarketplaceReviewRecord,
  MarketplaceReviewStats,
  MarketplaceReviewStatus
} from "@/src/lib/marketplace/marketplace-reviews-runtime";
export {
  archiveMarketplaceReviewFoundation,
  calculateMarketplaceReviewAggregate,
  createMarketplaceReviewFromPurchase,
  evaluateMarketplaceReviewEligibility,
  flagMarketplaceReviewFoundation,
  getMarketplacePublicReviewAggregate,
  getMarketplaceReviewById,
  getMarketplaceReviewStats,
  hideMarketplaceReviewFoundation,
  inspectMarketplaceReviewEligibility,
  isPublicMarketplaceReviewEligible,
  isReviewSupportedMarketplaceItemType,
  isValidMarketplaceReviewRating,
  isValidMarketplaceReviewStatus,
  listMarketplacePublicReviews,
  listMarketplaceReviews,
  MARKETPLACE_REVIEW_STATUSES,
  MARKETPLACE_REVIEW_SUPPORTED_ITEM_TYPES,
  parseMarketplaceReview,
  parseMarketplaceReviewRating,
  parseMarketplaceReviewStatus,
  publishMarketplaceReviewFoundation,
  sanitizeReviewMetadata,
  sanitizeReviewText,
  toMarketplacePublicReview,
  validateReviewMetadata
} from "@/src/lib/marketplace/marketplace-reviews-runtime";
export type {
  MarketplaceRevenueShareAllocation,
  MarketplaceRevenueShareEligibility,
  MarketplaceRevenueShareRecord,
  MarketplaceRevenueShareStats,
  MarketplaceRevenueShareStatus
} from "@/src/lib/marketplace/marketplace-revenue-sharing-runtime";
export {
  calculateMarketplaceRevenueShareAllocation,
  cancelMarketplaceRevenueShareFoundation,
  createMarketplaceRevenueShareFromPurchase,
  evaluateMarketplaceRevenueShareEligibility,
  getMarketplaceRevenueShareById,
  getMarketplaceRevenueShareByPurchaseId,
  getMarketplaceRevenueShareStats,
  inspectMarketplaceRevenueShareEligibility,
  isRevenueShareSupportedMarketplaceItemType,
  isValidMarketplaceRevenueShareStatus,
  listMarketplaceRevenueShares,
  lockMarketplaceRevenueShareFoundation,
  MARKETPLACE_REVENUE_SHARE_ACTIVE_STATUSES,
  MARKETPLACE_REVENUE_SHARE_STATUSES,
  MARKETPLACE_REVENUE_SHARE_SUPPORTED_ITEM_TYPES,
  parseMarketplaceRevenueShare,
  parseMarketplaceRevenueShareStatus,
  refundMarketplaceRevenueShareFoundation,
  sanitizeRevenueShareMetadata,
  validateMarketplaceRevenueShareAllocation,
  validateRevenueShareMetadata
} from "@/src/lib/marketplace/marketplace-revenue-sharing-runtime";
export type {
  CreateMarketplacePayoutRequestInput,
  MarketplacePayoutBalanceSummary,
  MarketplacePayoutMethod,
  MarketplacePayoutRecipientType,
  MarketplacePayoutRequestEligibility,
  MarketplacePayoutRequestRecord,
  MarketplacePayoutRequestStats,
  MarketplacePayoutStatus
} from "@/src/lib/marketplace/marketplace-payouts-runtime";
export {
  approveMarketplacePayoutRequestFoundation,
  cancelMarketplacePayoutRequestFoundation,
  createMarketplacePayoutRequestFoundation,
  evaluateMarketplacePayoutRequestEligibility,
  getMarketplacePayoutBalanceSummary,
  getMarketplacePayoutRequestById,
  getMarketplacePayoutRequestStats,
  inspectMarketplacePayoutRequestEligibility,
  isValidMarketplacePayoutMethod,
  isValidMarketplacePayoutStatus,
  listMarketplacePayoutRequests,
  markMarketplacePayoutFailedFoundation,
  markMarketplacePayoutPaidFoundation,
  markMarketplacePayoutProcessingFoundation,
  MARKETPLACE_PAYOUT_ACTIVE_STATUSES,
  MARKETPLACE_PAYOUT_METHODS,
  MARKETPLACE_PAYOUT_STATUSES,
  parseMarketplacePayoutMethod,
  parseMarketplacePayoutRequest,
  parseMarketplacePayoutStatus,
  rejectMarketplacePayoutRequestFoundation,
  resolveMarketplacePayoutRecipientType,
  sanitizePayoutMetadata,
  submitMarketplacePayoutRequestForReview,
  validatePayoutMetadata
} from "@/src/lib/marketplace/marketplace-payouts-runtime";
export type {
  MarketplaceAnalyticsEventCounts,
  MarketplaceAnalyticsEventRecord,
  MarketplaceAnalyticsEventType,
  MarketplaceAnalyticsFoundationCounts,
  MarketplaceAnalyticsPayoutStateCounts,
  MarketplaceAnalyticsRatingsSummary,
  MarketplaceAnalyticsSummary,
  RecordMarketplaceAnalyticsEventInput
} from "@/src/lib/marketplace/marketplace-analytics-runtime";
export {
  aggregateMarketplaceAnalyticsEventCounts,
  createEmptyMarketplaceAnalyticsEventCounts,
  createEmptyMarketplaceAnalyticsFoundationCounts,
  createEmptyMarketplaceAnalyticsPayoutStateCounts,
  createEmptyMarketplaceAnalyticsRatingsSummary,
  createEmptyMarketplaceAnalyticsSummary,
  getMarketplaceAnalyticsEventStats,
  getMarketplaceAnalyticsReadModel,
  getMarketplaceItemAnalyticsSummary,
  isValidMarketplaceAnalyticsEventSource,
  isValidMarketplaceAnalyticsEventType,
  listMarketplaceAnalyticsEvents,
  loadMarketplaceAnalyticsReadModelSafe,
  MARKETPLACE_ANALYTICS_EVENT_SOURCES,
  MARKETPLACE_ANALYTICS_EVENT_TYPES,
  parseMarketplaceAnalyticsEvent,
  parseMarketplaceAnalyticsEventType,
  recordMarketplaceAnalyticsEvent,
  sanitizeAnalyticsMetadata,
  validateAnalyticsMetadata
} from "@/src/lib/marketplace/marketplace-analytics-runtime";
