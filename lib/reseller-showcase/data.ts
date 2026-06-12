import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  PublicResellerShowcase,
  ResellerDashboardStoreOption,
  ResellerProfile,
  ResellerShowcaseItem,
  ShowcaseThemeSettings
} from "@/lib/reseller-showcase/types";

export type ResellerDashboardData = {
  items: ResellerShowcaseItem[];
  profile: ResellerProfile | null;
  ready: boolean;
  stores: ResellerDashboardStoreOption[];
  themeSettings: ShowcaseThemeSettings | null;
};

export type ResellerReviewStatus = "approved" | "pending" | "rejected";

export type ResellerReview = {
  buyerDisplayName: string;
  createdAt: string | null;
  id: string;
  rating: number;
  reviewText: string;
  status: ResellerReviewStatus;
};

export type ResellerReviewsSummary = {
  approvedReviews: number;
  averageRating: number | null;
  pendingReviews: number;
  rejectedReviews: number;
  reviewCount: number;
  totalReviews: number;
};

export type ResellerReviewsData = {
  approved: ResellerReview[];
  futureHooks: string[];
  latest: ResellerReview[];
  pending: ResellerReview[];
  profile: ResellerProfile | null;
  ready: boolean;
  rejected: ResellerReview[];
  summary: ResellerReviewsSummary;
};

export type ResellerLevel = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export type ResellerTrustScore = "low" | "medium" | "high" | "excellent";

export type ResellerReputationMetric = {
  key: string;
  label: string;
  note: string;
  value: string | number;
};

export type ResellerReputation = {
  accountAgeDays: number;
  currentLevel: ResellerLevel;
  friendlyExplanation: string;
  futureHooks: string[];
  missingRequirements: string[];
  metrics: ResellerReputationMetric[];
  nextLevel: ResellerLevel | "Max level";
  progress: number;
  trustScore: ResellerTrustScore;
};

export type ResellerVerificationStatus = "expired" | "not_started" | "pending" | "rejected" | "verified";

export type ResellerVerificationKind = "business" | "email" | "identity" | "phone";

export type ResellerVerificationItem = {
  description: string;
  kind: ResellerVerificationKind;
  publicLabel: string;
  requirements: string[];
  status: ResellerVerificationStatus;
  title: string;
};

export type ResellerVerificationData = {
  futureHooks: string[];
  items: ResellerVerificationItem[];
  overallStatus: ResellerVerificationStatus;
  profile: ResellerProfile | null;
  publicBadges: Array<{
    kind: ResellerVerificationKind;
    label: string;
    status: ResellerVerificationStatus;
  }>;
  verifiedCount: number;
};

export type ResellerBadgeType =
  | "active_reseller"
  | "expert_placeholder"
  | "fast_delivery_placeholder"
  | "high_rating"
  | "new_seller"
  | "premium_creator"
  | "top_seller_placeholder"
  | "trusted_designer"
  | "verified_reseller";

export type ResellerBadgeStatus = "earned" | "expired" | "hidden" | "locked" | "pending";

export type ResellerBadge = {
  description: string;
  isPublicVisible: boolean;
  label: string;
  requirements: Array<{
    label: string;
    met: boolean;
    value: string | number;
  }>;
  slug: ResellerBadgeType;
  status: ResellerBadgeStatus;
};

export type ResellerBadgesData = {
  badges: ResellerBadge[];
  earnedBadges: ResellerBadge[];
  emptyState: string;
  futureHooks: string[];
  publicBadges: ResellerBadge[];
  summary: {
    earned: number;
    hidden: number;
    locked: number;
    pending: number;
    publicVisible: number;
  };
};

export type ResellerInventoryPlan = "Agency" | "Enterprise" | "Pro" | "Starter";

export type ResellerInventoryData = {
  allowedStoreListings: number;
  currentPlan: ResellerInventoryPlan;
  draftListingsCount: number;
  futureHooks: string[];
  isAtLimit: boolean;
  isNearLimit: boolean;
  planLimits: Array<{
    allowedStoreListings: number;
    name: ResellerInventoryPlan;
    note: string;
  }>;
  publishedListingsCount: number;
  remainingStoreListings: number;
  soldListingsCount: number;
  upgradeHint: string | null;
  usedStoreListings: number;
};

export type ResellerTemplateInventoryData = {
  allowedTemplates: number;
  currentPlan: ResellerInventoryPlan;
  draftTemplatesCount: number;
  futureHooks: string[];
  isAtLimit: boolean;
  isNearLimit: boolean;
  planLimits: Array<{
    allowedTemplates: number;
    name: ResellerInventoryPlan;
    note: string;
  }>;
  publishedTemplatesCount: number;
  remainingTemplates: number;
  soldTemplatesCount: number;
  upgradeHint: string | null;
  usedTemplates: number;
};

export type ResellerPlanVisibilityLevel = "basic" | "featured_ready" | "priority" | "private";

export type ResellerPlanDefinition = {
  allowedPortfolioItems: number;
  allowedStoreListings: number;
  allowedTemplates: number;
  featuredRequestAvailability: string;
  marketplaceVisibilityLevel: ResellerPlanVisibilityLevel;
  monthlyPricePlaceholder: string;
  name: ResellerInventoryPlan;
  publicProfileEnabled: boolean;
  supportLevelPlaceholder: string;
  teamMembersPlaceholder: number;
};

export type ResellerSubscriptionPlanEngineData = {
  billingStatus: "active" | "active_placeholder" | "canceled" | "expired_placeholder" | "incomplete" | "past_due" | "past_due_placeholder" | "trialing" | "unpaid";
  currentPlan: ResellerInventoryPlan;
  downgradeWarningPlaceholder: string;
  futureHooks: string[];
  inventory: ResellerInventoryData;
  planLimits: ResellerPlanDefinition[];
  portfolio: {
    allowedPortfolioItems: number;
    isOverLimit: boolean;
    remainingPortfolioItems: number;
    usedPortfolioItems: number;
  };
  renewalDatePlaceholder: string;
  templateInventory: ResellerTemplateInventoryData;
  upgradeCtaPlaceholder: string;
  enforcement: {
    overListingLimit: boolean;
    overPortfolioLimit: boolean;
    overTemplateLimit: boolean;
    subscriptionExpiredPlaceholder: boolean;
    upgradeRequiredMessage: string | null;
  };
};

export type ResellerAnalyticsRange = "30d" | "7d" | "all" | "month" | "today";

export type ResellerAnalyticsMetric = {
  key: string;
  label: string;
  note: string;
  value: string | number;
};

export type ResellerAnalyticsRow = {
  category: string;
  clicks: number;
  itemType: "listing" | "template" | "visibility";
  name: string;
  status: string;
  views: number;
};

export type ResellerAnalyticsData = {
  bestCategories: ResellerAnalyticsRow[];
  emptyStates: string[];
  filters: Array<{
    href: string;
    isActive: boolean;
    label: string;
    value: ResellerAnalyticsRange;
  }>;
  futureHooks: string[];
  leadPerformance: ResellerAnalyticsMetric[];
  listingPerformance: ResellerAnalyticsMetric[];
  overview: ResellerAnalyticsMetric[];
  profile: ResellerProfile | null;
  profilePerformance: ResellerAnalyticsMetric[];
  range: ResellerAnalyticsRange;
  ready: boolean;
  templatePerformance: ResellerAnalyticsMetric[];
  topListings: ResellerAnalyticsRow[];
  topTemplates: ResellerAnalyticsRow[];
  visibilityImpact: ResellerAnalyticsRow[];
  visibilityPerformance: ResellerAnalyticsMetric[];
};

export type ResellerLeadStatus =
  | "archived"
  | "contacted"
  | "interested"
  | "lost"
  | "negotiating"
  | "new"
  | "won_placeholder";

export type ResellerLeadSource =
  | "custom_buyer_request"
  | "listing_inquiry"
  | "public_profile_contact"
  | "template_inquiry";

export type ResellerLead = {
  contactMasked: string;
  createdAt: string | null;
  id: string;
  interestedItem: string;
  itemType: "custom request" | "store" | "template";
  lastActivity: string | null;
  leadName: string;
  nextAction: string;
  notes: string;
  requestedItem: string;
  source: ResellerLeadSource;
  status: ResellerLeadStatus;
  timeline: string[];
};

export type ResellerLeadsData = {
  emptyState: string;
  futureHooks: string[];
  leads: ResellerLead[];
  selectedLead: ResellerLead | null;
  sourceFoundation: Array<{
    label: string;
    value: ResellerLeadSource;
  }>;
  statusFoundation: ResellerLeadStatus[];
  summary: {
    activeLeads: number;
    archivedLeads: number;
    lostLeads: number;
    totalLeads: number;
    wonPlaceholders: number;
  };
};

export type ResellerMessageInboxKey =
  | "all"
  | "archived"
  | "custom_requests"
  | "lead_inquiries"
  | "listing_inquiries"
  | "template_inquiries"
  | "unread";

export type ResellerConversationStatus = "archived" | "open" | "read" | "unread";

export type ResellerConversation = {
  buyerDisplayName: string;
  contactMasked: string;
  createdAt: string | null;
  id: string;
  internalNotes: string;
  itemType: "custom request" | "store" | "template";
  lastActivity: string | null;
  lastMessagePreview: string;
  relatedItem: string;
  relatedLead: string;
  status: ResellerConversationStatus;
  timeline: string[];
  unreadCount: number;
};

export type ResellerMessagesData = {
  conversations: ResellerConversation[];
  emptyState: string;
  futureHooks: string[];
  inbox: Array<{
    count: number;
    key: ResellerMessageInboxKey;
    label: string;
  }>;
  selectedConversation: ResellerConversation | null;
};

export type ResellerNotificationCategory =
  | "future_delivery_placeholder"
  | "future_sale_placeholder"
  | "lead_activity"
  | "listing_updates"
  | "marketplace_visibility"
  | "new_message"
  | "review_received"
  | "subscription_status"
  | "template_updates"
  | "verification_status";

export type ResellerNotificationStatus = "archived" | "read" | "unread";

export type ResellerNotificationPriority = "high" | "low" | "normal";

export type ResellerNotification = {
  category: ResellerNotificationCategory;
  createdAt: string | null;
  id: string;
  priority: ResellerNotificationPriority;
  relatedItem: string;
  status: ResellerNotificationStatus;
  title: string;
};

export type ResellerNotificationsData = {
  categories: Array<{
    label: string;
    value: ResellerNotificationCategory;
  }>;
  emptyState: string;
  futureHooks: string[];
  notifications: ResellerNotification[];
  summary: {
    archived: number;
    highPriority: number;
    thisWeek: number;
    unread: number;
  };
};

export type ResellerBuyerRequestCategory =
  | "consultation"
  | "custom_store"
  | "custom_template"
  | "domain_email_setup_help"
  | "migration_help"
  | "redesign_request"
  | "setup_assistance";

export type ResellerBuyerRequestStatus =
  | "accepted_placeholder"
  | "archived"
  | "declined"
  | "in_discussion"
  | "new"
  | "reviewed";

export type ResellerBuyerRequest = {
  budgetRange: string;
  businessCategory: string;
  buyerDisplayName: string;
  category: ResellerBuyerRequestCategory;
  createdAt: string | null;
  description: string;
  id: string;
  preferredNiche: string;
  relatedConversation: string;
  relatedLead: string;
  requestedService: string;
  status: ResellerBuyerRequestStatus;
  timeline: string;
};

export type ResellerBuyerRequestsData = {
  categories: Array<{
    label: string;
    value: ResellerBuyerRequestCategory;
  }>;
  emptyState: string;
  futureHooks: string[];
  requests: ResellerBuyerRequest[];
  selectedRequest: ResellerBuyerRequest | null;
  statuses: ResellerBuyerRequestStatus[];
};

export type ResellerPreviewStatus =
  | "disabled"
  | "draft_preview"
  | "enabled"
  | "expired"
  | "public_preview"
  | "under_review";

export type ResellerPreviewItemType = "showcase" | "store" | "template";

export type ResellerPreviewItem = {
  createdAt: string | null;
  id: string;
  itemName: string;
  itemSlug: string;
  itemType: ResellerPreviewItemType;
  lastViewedPlaceholder: string;
  previewUrl: string;
  status: ResellerPreviewStatus;
  visibility: string;
};

export type ResellerPreviewsData = {
  emptyState: string;
  futureHooks: string[];
  previews: ResellerPreviewItem[];
  safetyNotes: string[];
  statuses: ResellerPreviewStatus[];
  summary: {
    disabled: number;
    enabled: number;
    publicPreview: number;
    underReview: number;
  };
};

export type ResellerPortfolioItemType =
  | "brand_setup"
  | "case_study"
  | "completed_store_design"
  | "landing_page"
  | "redesign_project"
  | "template_example";

export type ResellerPortfolioStatus = "archived" | "draft" | "hidden" | "published" | "under_review";

export type ResellerPortfolioItem = {
  beforeAfterPlaceholder: string;
  categoryNiche: string;
  createdAt: string | null;
  description: string;
  id: string;
  previewImagePlaceholder: string;
  previewUrl: string;
  publicVisibility: string;
  status: ResellerPortfolioStatus;
  title: string;
  toolsServicesUsed: string[];
  type: ResellerPortfolioItemType;
};

export type ResellerPortfolioData = {
  emptyState: string;
  futureHooks: string[];
  items: ResellerPortfolioItem[];
  publicItems: ResellerPortfolioItem[];
  selectedItem: ResellerPortfolioItem | null;
  statuses: ResellerPortfolioStatus[];
  types: Array<{
    label: string;
    value: ResellerPortfolioItemType;
  }>;
};

export type ResellerCategoryVisibility = "hidden" | "private" | "public";

export type ResellerCategory = {
  description: string;
  iconPlaceholder: string;
  name: string;
  slug: string;
  usedByListingsCount: number;
  usedByPortfolioCount: number;
  usedByTemplatesCount: number;
  visibility: ResellerCategoryVisibility;
};

export type ResellerCategoriesData = {
  categories: ResellerCategory[];
  emptyState: string;
  futureHooks: string[];
  publicCategories: ResellerCategory[];
  selectedCategory: ResellerCategory | null;
  visibilityOptions: ResellerCategoryVisibility[];
};

export type ResellerSearchOptimizationItemType = "portfolio" | "profile" | "store" | "template";

export type ResellerSearchOptimizationItem = {
  category: string;
  countryLanguageTargeting: string;
  id: string;
  isPublicEligible: boolean;
  itemName: string;
  itemType: ResellerSearchOptimizationItemType;
  keywordsTags: string[];
  lastUpdated: string | null;
  marketplaceTitle: string;
  missingImprovements: string[];
  optimizationScore: number;
  previewSnippet: string;
  shortDescription: string;
  targetAudience: string;
  visibilityStatus: string;
};

export type ResellerSearchOptimizationData = {
  emptyState: string;
  futureHooks: string[];
  items: ResellerSearchOptimizationItem[];
  selectedItem: ResellerSearchOptimizationItem | null;
  summary: {
    averageScore: number;
    hiddenWarnings: number;
    missingMetadataWarnings: number;
    optimizedItems: number;
    totalItems: number;
  };
};

export type ResellerTransferStatus =
  | "approved"
  | "cancelled"
  | "completed_placeholder"
  | "disputed"
  | "draft"
  | "pending_buyer"
  | "pending_review"
  | "ready_for_transfer";

export type ResellerTransferAuditEvent = {
  action: string;
  createdAt: string | null;
  note: string;
  status: ResellerTransferStatus;
};

export type ResellerOwnershipTransferRequest = {
  auditTimeline: ResellerTransferAuditEvent[];
  buyerPlaceholder: string;
  createdAt: string | null;
  notesPlaceholder: string;
  ownershipTimeline: string[];
  resellerId: string;
  storeDescription: string | null;
  storeId: string;
  storeName: string;
  transferId: string;
  transferStatus: ResellerTransferStatus;
  updatedAt: string | null;
};

export type ResellerOwnershipTransferData = {
  emptyState: string;
  futureHooks: string[];
  safetyNotes: string[];
  selectedTransfer: ResellerOwnershipTransferRequest | null;
  statusFoundation: ResellerTransferStatus[];
  storeOptions: ResellerDashboardStoreOption[];
  summary: {
    activeTransfers: number;
    cancelledTransfers: number;
    completedPlaceholders: number;
    disputedTransfers: number;
    pendingTransfers: number;
  };
  transfers: ResellerOwnershipTransferRequest[];
};

export type ResellerDeliveryStatus =
  | "buyer_invited"
  | "cancelled"
  | "delivered_placeholder"
  | "disputed"
  | "not_started"
  | "preparing"
  | "ready_to_handoff"
  | "waiting_buyer_claim";

export type ResellerDeliveryChecklistKey =
  | "buyer_instructions_prepared"
  | "demo_content_reviewed"
  | "domain_subdomain_note"
  | "pages_reviewed"
  | "products_reviewed"
  | "settings_reviewed"
  | "store_preview_checked";

export type ResellerDeliveryChecklistItem = {
  completed: boolean;
  description: string;
  key: ResellerDeliveryChecklistKey;
  label: string;
};

export type ResellerDeliveryTimelineEvent = {
  action: string;
  createdAt: string | null;
  note: string;
  status: ResellerDeliveryStatus;
};

export type ResellerStoreDeliveryRecord = {
  buyerPlaceholder: string;
  checklist: ResellerDeliveryChecklistItem[];
  createdAt: string | null;
  deliveryId: string;
  deliveryStatus: ResellerDeliveryStatus;
  resellerId: string;
  storeId: string;
  storeName: string;
  timeline: ResellerDeliveryTimelineEvent[];
  transferId: string;
  updatedAt: string | null;
};

export type ResellerStoreDeliveryData = {
  emptyState: string;
  futureHooks: string[];
  safetyNotes: string[];
  selectedDelivery: ResellerStoreDeliveryRecord | null;
  statusFoundation: ResellerDeliveryStatus[];
  summary: {
    activeDeliveries: number;
    cancelledDeliveries: number;
    deliveredPlaceholders: number;
    disputedDeliveries: number;
    pendingBuyerClaims: number;
    readyToHandoff: number;
  };
  transferOptions: ResellerOwnershipTransferRequest[];
  deliveries: ResellerStoreDeliveryRecord[];
};

export type ResellerDisputeCategory =
  | "communication_dispute"
  | "custom_request_dispute"
  | "delivery_dispute"
  | "marketplace_dispute"
  | "other"
  | "ownership_transfer_dispute"
  | "review_dispute";

export type ResellerDisputeStatus =
  | "awaiting_response"
  | "closed"
  | "escalated"
  | "open"
  | "rejected"
  | "resolved_placeholder"
  | "under_review";

export type ResellerDisputePriority = "high" | "low" | "normal" | "urgent";

export type ResellerDisputeTimelineEvent = {
  action: string;
  createdAt: string | null;
  note: string;
  status: ResellerDisputeStatus;
};

export type ResellerDisputeRecord = {
  buyerMaskedPlaceholder: string;
  category: ResellerDisputeCategory;
  createdAt: string | null;
  disputeId: string;
  evidencePlaceholder: string;
  internalNotesPlaceholder: string;
  priority: ResellerDisputePriority;
  relatedDelivery: string;
  relatedRequest: string;
  relatedReview: string;
  relatedTransfer: string;
  status: ResellerDisputeStatus;
  statusHistory: Array<{
    createdAt: string | null;
    status: ResellerDisputeStatus;
  }>;
  summary: string;
  timeline: ResellerDisputeTimelineEvent[];
  updatedAt: string | null;
};

export type ResellerDisputesData = {
  categories: Array<{
    label: string;
    value: ResellerDisputeCategory;
  }>;
  disputes: ResellerDisputeRecord[];
  emptyState: string;
  futureHooks: string[];
  priorityOptions: ResellerDisputePriority[];
  relatedOptions: {
    deliveries: ResellerStoreDeliveryRecord[];
    requests: ResellerBuyerRequest[];
    reviews: ResellerReview[];
    transfers: ResellerOwnershipTransferRequest[];
  };
  safetyNotes: string[];
  selectedDispute: ResellerDisputeRecord | null;
  statusFoundation: ResellerDisputeStatus[];
  summary: {
    awaitingResponse: number;
    closed: number;
    escalated: number;
    open: number;
    underReview: number;
  };
};

export type ResellerComplianceSectionKey =
  | "account_standing"
  | "buyer_protection_rules"
  | "delivery_rules"
  | "listing_quality_rules"
  | "marketplace_rules"
  | "prohibited_content"
  | "review_policy"
  | "template_quality_rules";

export type ResellerComplianceStatus =
  | "good_standing"
  | "needs_attention"
  | "restricted_placeholder"
  | "under_review"
  | "warning_placeholder";

export type ResellerComplianceSection = {
  description: string;
  key: ResellerComplianceSectionKey;
  lastReviewedAt: string | null;
  requirements: string[];
  status: ResellerComplianceStatus;
  title: string;
};

export type ResellerComplianceChecklistItem = {
  completed: boolean;
  description: string;
  key: string;
  label: string;
};

export type ResellerComplianceData = {
  accountStanding: {
    currentStanding: ResellerComplianceStatus;
    disputesCount: number;
    reviewsStatus: string;
    verificationStatus: ResellerVerificationStatus;
    warningsPlaceholder: number;
  };
  checklist: ResellerComplianceChecklistItem[];
  emptyState: string;
  futureHooks: string[];
  safetyNotes: string[];
  sections: ResellerComplianceSection[];
  statusFoundation: ResellerComplianceStatus[];
  summary: {
    goodStanding: number;
    needsAttention: number;
    restrictedPlaceholders: number;
    underReview: number;
    warningPlaceholders: number;
  };
};

export type PublicResellerProfile = {
  badges: ResellerBadge[];
  canonicalPath: string;
  contactLinkPlaceholder: string;
  country: string;
  futureHooks: string[];
  languages: string[];
  profileStatus: "not_available" | "published";
  publicAccountCode: string;
  publicCategories: ResellerCategory[];
  selectedCategory: ResellerCategory | null;
  portfolioItems: ResellerPortfolioItem[];
  ratingPlaceholder: string;
  reputation: ResellerReputation;
  reviews: ResellerReview[];
  reviewsSummary: ResellerReviewsSummary;
  resellerLevelPlaceholder: string;
  showcase: PublicResellerShowcase | null;
  storeListings: ResellerShowcaseItem[];
  templateListings: ResellerShowcaseItem[];
  trustBadges: string[];
  verification: ResellerVerificationData;
};

export const resellerInventoryPlanLimits: Record<ResellerInventoryPlan, number> = {
  Starter: 3,
  Pro: 15,
  Agency: 50,
  Enterprise: 250
};

export const resellerTemplateInventoryPlanLimits: Record<ResellerInventoryPlan, number> = {
  Starter: 2,
  Pro: 10,
  Agency: 35,
  Enterprise: 150
};

export const resellerPortfolioPlanLimits: Record<ResellerInventoryPlan, number> = {
  Starter: 3,
  Pro: 12,
  Agency: 40,
  Enterprise: 150
};

const publicMarketplaceStatuses = ["boosted_placeholder", "featured_ready", "public", "published"];

export function buildResellerPreviewUrl(profileSlug: string | null | undefined, itemSlug: string) {
  const safeProfileSlug = profileSlug?.trim() || "profile";
  const safeItemSlug = itemSlug.trim() || "preview";

  return `/resellers/${safeProfileSlug}?preview=${encodeURIComponent(safeItemSlug)}`;
}

export function isPreviewEnabledForPublicItem(item: ResellerShowcaseItem) {
  return Boolean(item.demo_url) && publicMarketplaceStatuses.includes(item.status);
}

export function resellerCategorySlug(value: string | null | undefined) {
  const slug = (value ?? "general-store")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);

  return slug || "general-store";
}

function resellerCategoryMatches(categorySlug: string | null | undefined, value: string | null | undefined) {
  return resellerCategorySlug(value) === resellerCategorySlug(categorySlug);
}

function isMissingResellerTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("reseller_") ||
    message.includes("showcase_theme_settings") ||
    message.includes("could not find the table")
  );
}

function isMissingReviewsTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("reseller_reviews") ||
    message.includes("could not find the table")
  );
}

function isMissingTemplateDraftsTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("template_drafts") ||
    message.includes("could not find the table")
  );
}

async function getDashboardUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function getResellerDashboardData(): Promise<ResellerDashboardData> {
  const supabase = await createClient();
  const user = await getDashboardUser();

  if (!user) {
    return { items: [], profile: null, ready: true, stores: [], themeSettings: null };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("reseller_profiles" as never)
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      items: [],
      profile: null,
      ready: !isMissingResellerTable(profileError),
      stores: [],
      themeSettings: null
    };
  }

  const profile = profileData as ResellerProfile | null;
  const [itemsResult, themeResult, storesResult] = await Promise.all([
    profile
      ? supabase
          .from("reseller_showcase_items" as never)
          .select("*")
          .eq("profile_id", profile.id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    profile
      ? supabase
          .from("showcase_theme_settings" as never)
          .select("*")
          .eq("profile_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("stores")
      .select("id, name, description")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
  ]);

  return {
    items: (itemsResult.data ?? []) as ResellerShowcaseItem[],
    profile,
    ready:
      !itemsResult.error &&
      !themeResult.error &&
      (!storesResult.error || !isMissingResellerTable(storesResult.error)),
    stores: (storesResult.data ?? []) as ResellerDashboardStoreOption[],
    themeSettings: (themeResult.data as ShowcaseThemeSettings | null) ?? null
  };
}

export async function getPublicResellerShowcase(
  slug: string
): Promise<PublicResellerShowcase | null> {
  const supabase = await createClient();
  const { data: profileData } = await supabase
    .from("reseller_profiles" as never)
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  const profile = profileData as ResellerProfile | null;

  if (!profile) {
    return null;
  }

  const [{ data: items }, { data: themeSettings }] = await Promise.all([
    supabase
      .from("reseller_showcase_items" as never)
      .select("*")
      .eq("profile_id", profile.id)
      .in("status" as never, publicMarketplaceStatuses as never)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("showcase_theme_settings" as never)
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle()
  ]);

  return {
    items: (items ?? []) as ResellerShowcaseItem[],
    profile,
    themeSettings: (themeSettings as ShowcaseThemeSettings | null) ?? null
  };
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysSince(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const elapsed = Date.now() - new Date(value).getTime();
  return Math.max(0, Math.floor(elapsed / 86_400_000));
}

function isTemplateListing(item: ResellerShowcaseItem) {
  return stringList(item.preview_images).some((image) => image.startsWith("template:"));
}

function isPublicMarketplaceStatus(status: ResellerShowcaseItem["status"]) {
  return publicMarketplaceStatuses.includes(status);
}

function normalizeAnalyticsRange(value: string | null | undefined): ResellerAnalyticsRange {
  if (value === "today" || value === "7d" || value === "30d" || value === "month" || value === "all") {
    return value;
  }

  return "30d";
}

function analyticsStatusLabel(status: ResellerShowcaseItem["status"]) {
  if (status === "published" || status === "public") {
    return "Public";
  }

  if (status === "featured_ready") {
    return "Featured-ready";
  }

  if (status === "boosted_placeholder") {
    return "Boosted placeholder";
  }

  if (status === "hidden" || status === "unpublished") {
    return "Hidden";
  }

  if (status === "private") {
    return "Private";
  }

  if (status === "under_review") {
    return "Under review";
  }

  return "Draft";
}

function analyticsRow(item: ResellerShowcaseItem, itemType: ResellerAnalyticsRow["itemType"]): ResellerAnalyticsRow {
  return {
    category: item.category ?? "Uncategorized",
    clicks: 0,
    itemType,
    name: item.title,
    status: analyticsStatusLabel(item.status),
    views: 0
  };
}

function analyticsMetric(key: string, label: string, value: string | number, note: string): ResellerAnalyticsMetric {
  return { key, label, note, value };
}

function isBadgeType(value: string): value is ResellerBadgeType {
  return [
    "active_reseller",
    "expert_placeholder",
    "fast_delivery_placeholder",
    "high_rating",
    "new_seller",
    "premium_creator",
    "top_seller_placeholder",
    "trusted_designer",
    "verified_reseller"
  ].includes(value);
}

async function getBadgeVisibilityOverrides(userId: string | null | undefined) {
  if (!userId) {
    return new Map<ResellerBadgeType, boolean>();
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("metadata, created_at")
        .eq("user_id", userId)
        .eq("entity_type", "reseller_badges")
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const overrides = new Map<ResellerBadgeType, boolean>();

  ((data ?? []) as unknown as Array<{ metadata?: Record<string, unknown> }>).forEach((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {};
    const badgeSlug = textValue(metadata.badge_slug).toLowerCase();

    if (isBadgeType(badgeSlug) && !overrides.has(badgeSlug)) {
      overrides.set(badgeSlug, textValue(metadata.public_visibility, "visible") !== "hidden");
    }
  });

  return overrides;
}

function badgeRequirement(label: string, value: string | number, met: boolean) {
  return { label, met, value };
}

function buildResellerBadges({
  dashboard,
  reputation,
  reviews,
  verification,
  visibilityOverrides
}: {
  dashboard: ResellerDashboardData;
  reputation: ResellerReputation;
  reviews: ResellerReviewsData;
  verification: ResellerVerificationData;
  visibilityOverrides: Map<ResellerBadgeType, boolean>;
}): ResellerBadgesData {
  const templateListingsCount = dashboard.items.filter(isTemplateListing).length;
  const listingsCount = dashboard.items.filter((item) => !isTemplateListing(item)).length;
  const approvedReviews = reviews.summary.approvedReviews;
  const ratingScore = reviews.summary.averageRating ?? 0;
  const hasVerification = verification.verifiedCount > 0;
  const accountAgeDays = reputation.accountAgeDays;
  const activityMet = Boolean(dashboard.profile) || listingsCount + templateListingsCount > 0;
  const salesCountPlaceholder = 0;

  const makeBadge = ({
    description,
    earned,
    label,
    pending = false,
    requirements,
    slug
  }: {
    description: string;
    earned: boolean;
    label: string;
    pending?: boolean;
    requirements: ResellerBadge["requirements"];
    slug: ResellerBadgeType;
  }): ResellerBadge => {
    const isPublicVisible = visibilityOverrides.get(slug) ?? true;
    const status: ResellerBadgeStatus = earned ? (isPublicVisible ? "earned" : "hidden") : pending ? "pending" : "locked";

    return {
      description,
      isPublicVisible,
      label,
      requirements,
      slug,
      status
    };
  };

  const badges = [
    makeBadge({
      description: "Trust badge for resellers with at least one verified foundation check.",
      earned: hasVerification,
      label: "Verified Reseller",
      requirements: [
        badgeRequirement("Verification status", `${verification.verifiedCount}/4 checks`, hasVerification),
        badgeRequirement("Activity placeholder", activityMet ? "active" : "not active", activityMet)
      ],
      slug: "verified_reseller"
    }),
    makeBadge({
      description: "Future sales-based badge placeholder. No fake sales are counted.",
      earned: false,
      label: "Top Seller placeholder",
      requirements: [
        badgeRequirement("Future sales count placeholder", salesCountPlaceholder, false),
        badgeRequirement("Review count", approvedReviews, approvedReviews >= 5)
      ],
      slug: "top_seller_placeholder"
    }),
    makeBadge({
      description: "Future delivery-speed badge placeholder. No real delivery metrics are connected yet.",
      earned: false,
      label: "Fast Delivery placeholder",
      requirements: [
        badgeRequirement("Delivery speed placeholder", "future metric", false),
        badgeRequirement("Activity placeholder", activityMet ? "active" : "not active", activityMet)
      ],
      slug: "fast_delivery_placeholder"
    }),
    makeBadge({
      description: "Quality badge for resellers with store/template activity and safe trust signals.",
      earned: listingsCount + templateListingsCount >= 2 && reputation.trustScore !== "low",
      label: "Trusted Designer",
      requirements: [
        badgeRequirement("Listings count", listingsCount, listingsCount >= 1),
        badgeRequirement("Templates count", templateListingsCount, templateListingsCount >= 1),
        badgeRequirement("Verification status", `${verification.verifiedCount}/4 checks`, hasVerification)
      ],
      slug: "trusted_designer"
    }),
    makeBadge({
      description: "Creator badge for resellers with multiple templates or strong public showcase activity.",
      earned: templateListingsCount >= 2 || listingsCount >= 3,
      label: "Premium Creator",
      pending: templateListingsCount + listingsCount > 0,
      requirements: [
        badgeRequirement("Templates count", templateListingsCount, templateListingsCount >= 2),
        badgeRequirement("Listings count", listingsCount, listingsCount >= 3)
      ],
      slug: "premium_creator"
    }),
    makeBadge({
      description: "Review quality badge based on approved public reviews only.",
      earned: ratingScore >= 4 && approvedReviews > 0,
      label: "High Rating",
      requirements: [
        badgeRequirement("Rating score", ratingScore ? `${ratingScore}/5` : "No rating", ratingScore >= 4),
        badgeRequirement("Review count", approvedReviews, approvedReviews > 0)
      ],
      slug: "high_rating"
    }),
    makeBadge({
      description: "Activity badge for resellers with profile or marketplace listing activity.",
      earned: activityMet,
      label: "Active Reseller",
      requirements: [
        badgeRequirement("Activity placeholder", activityMet ? "active" : "not active", activityMet),
        badgeRequirement("Listings count", listingsCount, listingsCount > 0),
        badgeRequirement("Templates count", templateListingsCount, templateListingsCount > 0)
      ],
      slug: "active_reseller"
    }),
    makeBadge({
      description: "Starter badge for new reseller accounts and early profile setup.",
      earned: Boolean(dashboard.profile) && accountAgeDays <= 30,
      label: "New Seller",
      requirements: [
        badgeRequirement("Activity placeholder", dashboard.profile ? "profile created" : "profile missing", Boolean(dashboard.profile)),
        badgeRequirement("Account age", `${accountAgeDays} days`, accountAgeDays <= 30)
      ],
      slug: "new_seller"
    }),
    makeBadge({
      description: "Future expertise badge placeholder for admin-approved specializations.",
      earned: false,
      label: "Expert placeholder",
      pending: reputation.currentLevel === "Gold" || reputation.currentLevel === "Platinum" || reputation.currentLevel === "Diamond",
      requirements: [
        badgeRequirement("Verification status", `${verification.verifiedCount}/4 checks`, verification.verifiedCount >= 2),
        badgeRequirement("Rating score", ratingScore ? `${ratingScore}/5` : "No rating", ratingScore >= 4.5),
        badgeRequirement("Future sales count placeholder", salesCountPlaceholder, false)
      ],
      slug: "expert_placeholder"
    })
  ];
  const earnedBadges = badges.filter((badge) => badge.status === "earned" || badge.status === "hidden");
  const publicBadges = badges.filter((badge) => badge.status === "earned" && badge.isPublicVisible);

  return {
    badges,
    earnedBadges,
    emptyState: "No badges earned yet. Complete verification, publish listings/templates, and collect approved reviews to unlock badges.",
    futureHooks: [
      "Automatic badge calculation",
      "Admin badge approval",
      "Sales-based badges",
      "Delivery-speed badges",
      "Dispute-safe badges",
      "Badge expiration"
    ],
    publicBadges,
    summary: {
      earned: earnedBadges.length,
      hidden: badges.filter((badge) => badge.status === "hidden").length,
      locked: badges.filter((badge) => badge.status === "locked").length,
      pending: badges.filter((badge) => badge.status === "pending").length,
      publicVisible: publicBadges.length
    }
  };
}

function previewItemType(item: ResellerShowcaseItem): ResellerPreviewItemType {
  if (isTemplateListing(item)) {
    return "template";
  }

  if (item.source_store_id) {
    return "store";
  }

  return "showcase";
}

function previewVisibilityLabel(status: ResellerShowcaseItem["status"]) {
  if (isPublicMarketplaceStatus(status)) {
    return "Public marketplace";
  }

  if (status === "private") {
    return "Private draft";
  }

  if (status === "hidden" || status === "unpublished") {
    return "Hidden";
  }

  if (status === "under_review") {
    return "Under review";
  }

  return "Draft";
}

function previewStatusForItem(item: ResellerShowcaseItem): ResellerPreviewStatus {
  if (item.status === "under_review") {
    return "under_review";
  }

  if (!item.demo_url) {
    return "disabled";
  }

  if (isPublicMarketplaceStatus(item.status)) {
    return "public_preview";
  }

  if (item.status === "private" || item.status === "hidden" || item.status === "unpublished") {
    return "draft_preview";
  }

  return "enabled";
}

function previewRowFromItem(item: ResellerShowcaseItem, profileSlug: string | null | undefined): ResellerPreviewItem {
  return {
    createdAt: item.created_at,
    id: item.id,
    itemName: item.title,
    itemSlug: item.slug,
    itemType: previewItemType(item),
    lastViewedPlaceholder: "Preview view tracking is a future hook.",
    previewUrl: buildResellerPreviewUrl(profileSlug, item.slug),
    status: previewStatusForItem(item),
    visibility: previewVisibilityLabel(item.status)
  };
}

function normalizePortfolioType(value: unknown): ResellerPortfolioItemType {
  const type = textValue(value).toLowerCase();

  if (
    type === "brand_setup" ||
    type === "case_study" ||
    type === "completed_store_design" ||
    type === "landing_page" ||
    type === "redesign_project" ||
    type === "template_example"
  ) {
    return type;
  }

  return "completed_store_design";
}

function normalizePortfolioStatus(value: unknown): ResellerPortfolioStatus {
  const status = textValue(value).toLowerCase();

  if (
    status === "archived" ||
    status === "draft" ||
    status === "hidden" ||
    status === "published" ||
    status === "under_review"
  ) {
    return status;
  }

  return "draft";
}

function optimizationVisibilityLabel(status: string | boolean | null | undefined) {
  if (typeof status === "boolean") {
    return status ? "public" : "private";
  }

  return textValue(status, "private");
}

function optimizationSnippet({
  category,
  description,
  title,
  visibility
}: {
  category: string;
  description: string;
  title: string;
  visibility: string;
}) {
  return `${title || "Untitled marketplace item"} · ${category || "Uncategorized"} · ${description || "No short description yet."} · ${visibility}`;
}

function optimizationScore({
  category,
  description,
  hasPreviewImage,
  isHiddenOrPrivate,
  tags,
  title
}: {
  category: string;
  description: string;
  hasPreviewImage: boolean;
  isHiddenOrPrivate: boolean;
  tags: string[];
  title: string;
}) {
  const missingImprovements = [
    title ? null : "Missing title",
    description ? null : "Missing description",
    category ? null : "Missing category",
    tags.length ? null : "Missing tags",
    hasPreviewImage ? null : "Missing preview image",
    isHiddenOrPrivate ? "Hidden/private visibility warning" : null
  ].filter(Boolean) as string[];
  const score = Math.max(0, Math.round(((6 - missingImprovements.length) / 6) * 100));

  return { missingImprovements, score };
}

function searchOptimizationRow({
  category,
  countryLanguageTargeting = "Country/language targeting placeholder",
  description,
  hasPreviewImage,
  id,
  isPublicEligible,
  itemName,
  itemType,
  lastUpdated,
  targetAudience = "Target audience placeholder",
  tags,
  title,
  visibilityStatus
}: {
  category: string;
  countryLanguageTargeting?: string;
  description: string;
  hasPreviewImage: boolean;
  id: string;
  isPublicEligible: boolean;
  itemName: string;
  itemType: ResellerSearchOptimizationItemType;
  lastUpdated: string | null;
  targetAudience?: string;
  tags: string[];
  title: string;
  visibilityStatus: string;
}): ResellerSearchOptimizationItem {
  const isHiddenOrPrivate = !isPublicEligible || ["hidden", "private", "draft", "unpublished"].includes(visibilityStatus);
  const { missingImprovements, score } = optimizationScore({
    category,
    description,
    hasPreviewImage,
    isHiddenOrPrivate,
    tags,
    title
  });

  return {
    category: category || "Uncategorized",
    countryLanguageTargeting,
    id,
    isPublicEligible,
    itemName,
    itemType,
    keywordsTags: tags,
    lastUpdated,
    marketplaceTitle: title || itemName,
    missingImprovements,
    optimizationScore: score,
    previewSnippet: optimizationSnippet({ category, description, title: title || itemName, visibility: visibilityStatus }),
    shortDescription: description || "Short description placeholder",
    targetAudience,
    visibilityStatus
  };
}

const resellerTransferStatuses: ResellerTransferStatus[] = [
  "draft",
  "pending_buyer",
  "pending_review",
  "approved",
  "ready_for_transfer",
  "completed_placeholder",
  "cancelled",
  "disputed"
];

function normalizeTransferStatus(value: unknown): ResellerTransferStatus {
  const status = textValue(value).toLowerCase();

  return resellerTransferStatuses.includes(status as ResellerTransferStatus)
    ? (status as ResellerTransferStatus)
    : "draft";
}

function transferAuditFromEvent(row: Record<string, unknown>): ResellerTransferAuditEvent {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    action: textValue(row.event_type, "transfer_created"),
    createdAt: textValue(row.created_at) || null,
    note: textValue(
      metadata.audit_note,
      "Ownership transfer audit placeholder. No store owner, workspace, account, RLS, wallet, payout, withdrawal, commission, or sales state changed."
    ),
    status: normalizeTransferStatus(metadata.transfer_status)
  };
}

function transferFromEvents(events: Record<string, unknown>[]): ResellerOwnershipTransferRequest {
  const latest = events[0] ?? {};
  const metadata =
    latest.metadata && typeof latest.metadata === "object" && !Array.isArray(latest.metadata)
      ? (latest.metadata as Record<string, unknown>)
      : {};
  const auditTimeline = events.map(transferAuditFromEvent);
  const createdAt = events[events.length - 1]?.created_at;
  const updatedAt = latest.created_at;
  const transferStatus = normalizeTransferStatus(metadata.transfer_status);

  return {
    auditTimeline,
    buyerPlaceholder: textValue(metadata.buyer_placeholder, "Buyer placeholder - private and never public"),
    createdAt: textValue(createdAt) || null,
    notesPlaceholder: textValue(
      metadata.notes_placeholder,
      "Internal transfer notes placeholder. No buyer private data or real ownership instructions are exposed publicly."
    ),
    ownershipTimeline: [
      "Transfer request drafted as an internal reseller workflow.",
      "Buyer claim and identity verification are future hooks only.",
      "Approval can be recorded as placeholder audit state only.",
      "Ready/completed states do not change store owner_id, workspace, account, or RLS.",
      "Actual store ownership migration remains disabled until a future transfer engine is approved."
    ],
    resellerId: textValue(metadata.reseller_id, "reseller-placeholder"),
    storeDescription: textValue(metadata.store_description) || null,
    storeId: textValue(metadata.store_id, "store-placeholder"),
    storeName: textValue(metadata.store_name, "Store placeholder"),
    transferId: textValue(metadata.transfer_id, String(latest.id ?? "transfer-placeholder")),
    transferStatus,
    updatedAt: textValue(updatedAt) || null
  };
}

const resellerDeliveryStatuses: ResellerDeliveryStatus[] = [
  "not_started",
  "preparing",
  "waiting_buyer_claim",
  "buyer_invited",
  "ready_to_handoff",
  "delivered_placeholder",
  "cancelled",
  "disputed"
];

const resellerDeliveryChecklistDefinitions: Array<Omit<ResellerDeliveryChecklistItem, "completed">> = [
  {
    description: "Confirm the reseller preview link or internal store preview is usable before handoff.",
    key: "store_preview_checked",
    label: "Store preview checked"
  },
  {
    description: "Review placeholder/demo content so the buyer knows what must be replaced later.",
    key: "demo_content_reviewed",
    label: "Demo content reviewed"
  },
  {
    description: "Check core pages and navigation before the buyer claim workflow exists.",
    key: "pages_reviewed",
    label: "Pages reviewed"
  },
  {
    description: "Review product/catalog placeholders without creating sales or orders.",
    key: "products_reviewed",
    label: "Products reviewed"
  },
  {
    description: "Review store settings without changing ownership, workspace, account, or RLS.",
    key: "settings_reviewed",
    label: "Settings reviewed"
  },
  {
    description: "Add a domain/subdomain handoff note without DNS automation.",
    key: "domain_subdomain_note",
    label: "Domain/subdomain note"
  },
  {
    description: "Prepare buyer instructions as private placeholder content only.",
    key: "buyer_instructions_prepared",
    label: "Buyer instructions prepared"
  }
];

function normalizeDeliveryStatus(value: unknown): ResellerDeliveryStatus {
  const status = textValue(value).toLowerCase();

  return resellerDeliveryStatuses.includes(status as ResellerDeliveryStatus)
    ? (status as ResellerDeliveryStatus)
    : "not_started";
}

function normalizeDeliveryChecklistKey(value: unknown): ResellerDeliveryChecklistKey | null {
  const key = textValue(value).toLowerCase();

  return resellerDeliveryChecklistDefinitions.some((item) => item.key === key)
    ? (key as ResellerDeliveryChecklistKey)
    : null;
}

function deliveryTimelineFromEvent(row: Record<string, unknown>): ResellerDeliveryTimelineEvent {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    action: textValue(row.event_type, "delivery_created"),
    createdAt: textValue(row.created_at) || null,
    note: textValue(
      metadata.timeline_note,
      "Store delivery workflow placeholder. No buyer account, ownership, workspace, RLS, wallet, payout, withdrawal, commission, or fake sale changed."
    ),
    status: normalizeDeliveryStatus(metadata.delivery_status)
  };
}

function deliveryFromEvents(events: Record<string, unknown>[]): ResellerStoreDeliveryRecord {
  const latest = events[0] ?? {};
  const metadata =
    latest.metadata && typeof latest.metadata === "object" && !Array.isArray(latest.metadata)
      ? (latest.metadata as Record<string, unknown>)
      : {};
  const completedChecklist = new Set<ResellerDeliveryChecklistKey>();

  events.forEach((event) => {
    const eventMetadata =
      event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : {};
    const checklistKey = normalizeDeliveryChecklistKey(eventMetadata.checklist_key);

    if (checklistKey && eventMetadata.checklist_completed !== false) {
      completedChecklist.add(checklistKey);
    }
  });

  const createdAt = events[events.length - 1]?.created_at;
  const updatedAt = latest.created_at;

  return {
    buyerPlaceholder: textValue(metadata.buyer_placeholder, "Buyer placeholder - private and never public"),
    checklist: resellerDeliveryChecklistDefinitions.map((item) => ({
      ...item,
      completed: completedChecklist.has(item.key)
    })),
    createdAt: textValue(createdAt) || null,
    deliveryId: textValue(metadata.delivery_id, String(latest.id ?? "delivery-placeholder")),
    deliveryStatus: normalizeDeliveryStatus(metadata.delivery_status),
    resellerId: textValue(metadata.reseller_id, "reseller-placeholder"),
    storeId: textValue(metadata.store_id, "store-placeholder"),
    storeName: textValue(metadata.store_name, "Store placeholder"),
    timeline: events.map(deliveryTimelineFromEvent),
    transferId: textValue(metadata.transfer_id, "transfer-placeholder"),
    updatedAt: textValue(updatedAt) || null
  };
}

const resellerDisputeCategories: ResellerDisputesData["categories"] = [
  { label: "Delivery dispute", value: "delivery_dispute" },
  { label: "Ownership transfer dispute", value: "ownership_transfer_dispute" },
  { label: "Review dispute", value: "review_dispute" },
  { label: "Custom request dispute", value: "custom_request_dispute" },
  { label: "Marketplace dispute", value: "marketplace_dispute" },
  { label: "Communication dispute", value: "communication_dispute" },
  { label: "Other", value: "other" }
];

const resellerDisputeStatuses: ResellerDisputeStatus[] = [
  "open",
  "under_review",
  "awaiting_response",
  "escalated",
  "resolved_placeholder",
  "rejected",
  "closed"
];

const resellerDisputePriorities: ResellerDisputePriority[] = ["low", "normal", "high", "urgent"];

function normalizeDisputeCategory(value: unknown): ResellerDisputeCategory {
  const category = textValue(value).toLowerCase();

  return resellerDisputeCategories.some((item) => item.value === category)
    ? (category as ResellerDisputeCategory)
    : "other";
}

function normalizeDisputeStatus(value: unknown): ResellerDisputeStatus {
  const status = textValue(value).toLowerCase();

  return resellerDisputeStatuses.includes(status as ResellerDisputeStatus)
    ? (status as ResellerDisputeStatus)
    : "open";
}

function normalizeDisputePriority(value: unknown): ResellerDisputePriority {
  const priority = textValue(value).toLowerCase();

  return resellerDisputePriorities.includes(priority as ResellerDisputePriority)
    ? (priority as ResellerDisputePriority)
    : "normal";
}

function disputeTimelineFromEvent(row: Record<string, unknown>): ResellerDisputeTimelineEvent {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    action: textValue(row.event_type, "dispute_created"),
    createdAt: textValue(row.created_at) || null,
    note: textValue(
      metadata.timeline_note,
      "Dispute workflow placeholder. No refund, ownership reversal, payment action, account suspension, wallet, payout, withdrawal, commission, or fake sale occurred."
    ),
    status: normalizeDisputeStatus(metadata.dispute_status)
  };
}

function disputeFromEvents(events: Record<string, unknown>[]): ResellerDisputeRecord {
  const latest = events[0] ?? {};
  const metadata =
    latest.metadata && typeof latest.metadata === "object" && !Array.isArray(latest.metadata)
      ? (latest.metadata as Record<string, unknown>)
      : {};
  const createdAt = events[events.length - 1]?.created_at;
  const updatedAt = latest.created_at;
  const timeline = events.map(disputeTimelineFromEvent);

  return {
    buyerMaskedPlaceholder: textValue(metadata.buyer_masked_placeholder, "Buyer masked placeholder"),
    category: normalizeDisputeCategory(metadata.dispute_category),
    createdAt: textValue(createdAt) || null,
    disputeId: textValue(metadata.dispute_id, String(latest.id ?? "dispute-placeholder")),
    evidencePlaceholder: textValue(
      metadata.evidence_placeholder,
      "Evidence placeholder only. File uploads are a future hook and no private buyer data is exposed."
    ),
    internalNotesPlaceholder: textValue(
      metadata.internal_notes_placeholder,
      "Private reseller-facing note placeholder. Internal admin notes are not exposed."
    ),
    priority: normalizeDisputePriority(metadata.priority),
    relatedDelivery: textValue(metadata.related_delivery, "delivery-placeholder"),
    relatedRequest: textValue(metadata.related_request, "request-placeholder"),
    relatedReview: textValue(metadata.related_review, "review-placeholder"),
    relatedTransfer: textValue(metadata.related_transfer, "transfer-placeholder"),
    status: normalizeDisputeStatus(metadata.dispute_status),
    statusHistory: timeline.map((event) => ({
      createdAt: event.createdAt,
      status: event.status
    })),
    summary: textValue(metadata.summary, "Dispute summary placeholder"),
    timeline,
    updatedAt: textValue(updatedAt) || null
  };
}

const resellerComplianceStatuses: ResellerComplianceStatus[] = [
  "good_standing",
  "needs_attention",
  "warning_placeholder",
  "under_review",
  "restricted_placeholder"
];

const resellerComplianceSectionDefinitions: Array<Omit<ResellerComplianceSection, "lastReviewedAt" | "status">> = [
  {
    description: "Core marketplace behavior, accurate representation, and private buyer handling.",
    key: "marketplace_rules",
    requirements: [
      "Keep reseller profile information accurate.",
      "Do not create fake traffic, fake sales, or fake buyer claims.",
      "Keep buyer data private and masked."
    ],
    title: "Marketplace rules"
  },
  {
    description: "Quality expectations for ready store listings and public marketplace visibility.",
    key: "listing_quality_rules",
    requirements: [
      "Use clear listing titles and descriptions.",
      "Keep previews available when a listing is public.",
      "Avoid prohibited or misleading content."
    ],
    title: "Listing quality rules"
  },
  {
    description: "Template descriptions, preview readiness, and future template quality checks.",
    key: "template_quality_rules",
    requirements: [
      "Describe template purpose clearly.",
      "Show meaningful preview material.",
      "Avoid copied, unsafe, or prohibited template content."
    ],
    title: "Template quality rules"
  },
  {
    description: "Digital handoff preparation requirements before future buyer claim workflows.",
    key: "delivery_rules",
    requirements: [
      "Prepare buyer instructions privately.",
      "Review demo content, products, pages, and settings.",
      "Do not transfer ownership until future migration is approved."
    ],
    title: "Delivery rules"
  },
  {
    description: "Buyer protection expectations for requests, disputes, reviews, and future claims.",
    key: "buyer_protection_rules",
    requirements: [
      "Do not expose buyer private contact data.",
      "Use disputes for disagreements instead of external pressure.",
      "Do not promise refunds or ownership changes from this dashboard."
    ],
    title: "Buyer protection rules"
  },
  {
    description: "Review handling guidance for public trust signals and future moderation.",
    key: "review_policy",
    requirements: [
      "Do not manipulate or fake reviews.",
      "Use dispute workflow for review disagreements.",
      "Respect pending/rejected review states."
    ],
    title: "Review policy"
  },
  {
    description: "Content that must not appear in profiles, listings, templates, or portfolio examples.",
    key: "prohibited_content",
    requirements: [
      "No illegal, misleading, harmful, or abusive content.",
      "No private client or buyer data in public examples.",
      "No prohibited payment, payout, or commission promises."
    ],
    title: "Prohibited content"
  },
  {
    description: "Private account standing summary for reseller/admin review only.",
    key: "account_standing",
    requirements: [
      "Keep verification and profile basics up to date.",
      "Resolve disputes through the private workflow.",
      "Maintain quality listings, templates, and deliveries."
    ],
    title: "Account standing"
  }
];

function normalizeComplianceStatus(value: unknown): ResellerComplianceStatus {
  const status = textValue(value).toLowerCase();

  return resellerComplianceStatuses.includes(status as ResellerComplianceStatus)
    ? (status as ResellerComplianceStatus)
    : "good_standing";
}

async function getComplianceReviewEvents(userId: string | null | undefined) {
  if (!userId) {
    return new Map<ResellerComplianceSectionKey, { lastReviewedAt: string | null; status: ResellerComplianceStatus }>();
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("metadata, created_at")
        .eq("user_id", userId)
        .eq("entity_type", "reseller_compliance")
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const reviews = new Map<ResellerComplianceSectionKey, { lastReviewedAt: string | null; status: ResellerComplianceStatus }>();

  ((data ?? []) as unknown as Array<{ created_at?: string; metadata?: Record<string, unknown> }>).forEach((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {};
    const sectionKey = textValue(metadata.section_key) as ResellerComplianceSectionKey;

    if (resellerComplianceSectionDefinitions.some((section) => section.key === sectionKey) && !reviews.has(sectionKey)) {
      reviews.set(sectionKey, {
        lastReviewedAt: textValue(row.created_at) || null,
        status: normalizeComplianceStatus(metadata.compliance_status)
      });
    }
  });

  return reviews;
}

function portfolioItemFromEvent(row: Record<string, unknown>, index: number): ResellerPortfolioItem {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const tools = Array.isArray(metadata.tools_services_used)
    ? metadata.tools_services_used.map((item) => String(item)).filter(Boolean).slice(0, 8)
    : textValue(metadata.tools_services_used)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8);
  const status = normalizePortfolioStatus(metadata.portfolio_status ?? metadata.status);

  return {
    beforeAfterPlaceholder: textValue(
      metadata.before_after_placeholder,
      "Before/after gallery placeholder. No private client assets are exposed."
    ),
    categoryNiche: textValue(metadata.category_niche ?? metadata.niche, "Niche placeholder"),
    createdAt: textValue(row.created_at) || null,
    description: textValue(
      metadata.description,
      "Portfolio showcase placeholder. Client private data, buyer data, and unpublished stores are not exposed."
    ),
    id: textValue(metadata.portfolio_reference, textValue(row.id, `portfolio-${index}`)),
    previewImagePlaceholder: textValue(metadata.preview_image_placeholder, "Portfolio preview image placeholder"),
    previewUrl: textValue(metadata.preview_url, "#"),
    publicVisibility: status === "published" ? "Visible on public profile" : "Private dashboard only",
    status,
    title: textValue(metadata.title, "Portfolio item placeholder"),
    toolsServicesUsed: tools.length ? tools : ["Store design", "Template setup", "Brand polish"],
    type: normalizePortfolioType(metadata.portfolio_type ?? metadata.type)
  };
}

function normalizeLeadStatus(value: unknown): ResellerLeadStatus {
  const status = textValue(value).toLowerCase();

  if (
    status === "archived" ||
    status === "contacted" ||
    status === "interested" ||
    status === "lost" ||
    status === "negotiating" ||
    status === "new" ||
    status === "won_placeholder"
  ) {
    return status;
  }

  return "new";
}

function normalizeLeadSource(value: unknown): ResellerLeadSource {
  const source = textValue(value).toLowerCase();

  if (
    source === "custom_buyer_request" ||
    source === "listing_inquiry" ||
    source === "public_profile_contact" ||
    source === "template_inquiry"
  ) {
    return source;
  }

  return "public_profile_contact";
}

function maskedContact(value: unknown) {
  const text = textValue(value);

  if (!text) {
    return "Masked contact";
  }

  const [name, domain] = text.split("@");
  if (domain && name) {
    return `${name.slice(0, 2)}***@${domain}`;
  }

  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function leadFromEvent(row: Record<string, unknown>, index: number): ResellerLead {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const status = normalizeLeadStatus(metadata.lead_status ?? metadata.status);
  const source = normalizeLeadSource(metadata.lead_source ?? metadata.source_type);
  const interestedItem = textValue(metadata.interested_item, "Lead interest placeholder");
  const itemType = textValue(metadata.item_type, "custom request");

  return {
    contactMasked: maskedContact(metadata.contact_masked ?? metadata.contact_reference),
    createdAt: textValue(row.created_at) || null,
    id: textValue(metadata.lead_reference, textValue(row.id, `lead-${index}`)),
    interestedItem,
    itemType:
      itemType === "store" || itemType === "template" || itemType === "custom request"
        ? itemType
        : "custom request",
    lastActivity: textValue(row.created_at) || null,
    leadName: textValue(metadata.lead_name, "Lead placeholder"),
    nextAction: textValue(metadata.next_action, "Follow up placeholder"),
    notes: textValue(metadata.notes, "No notes yet. Notes are placeholder-only in this phase."),
    requestedItem: textValue(metadata.requested_item, interestedItem),
    source,
    status,
    timeline: [
      textValue(row.event_type, "lead_placeholder_event"),
      "Messaging, conversion, order creation, and ownership transfer are future hooks only."
    ]
  };
}

function normalizeConversationStatus(value: unknown): ResellerConversationStatus {
  const status = textValue(value).toLowerCase();

  if (status === "archived" || status === "open" || status === "read" || status === "unread") {
    return status;
  }

  return "open";
}

function conversationFromEvent(row: Record<string, unknown>, index: number): ResellerConversation {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const itemType = textValue(metadata.item_type, "custom request");
  const timelineMessage = textValue(metadata.last_message_preview, "Message placeholder recorded.");

  return {
    buyerDisplayName: textValue(metadata.buyer_display_name, "Buyer placeholder"),
    contactMasked: maskedContact(metadata.contact_masked ?? metadata.contact_reference),
    createdAt: textValue(row.created_at) || null,
    id: textValue(metadata.conversation_reference, textValue(row.id, `conversation-${index}`)),
    internalNotes: textValue(metadata.internal_notes, "No internal notes yet. Notes are placeholder-only."),
    itemType:
      itemType === "store" || itemType === "template" || itemType === "custom request"
        ? itemType
        : "custom request",
    lastActivity: textValue(row.created_at) || null,
    lastMessagePreview: timelineMessage,
    relatedItem: textValue(metadata.related_item, "Related item placeholder"),
    relatedLead: textValue(metadata.related_lead, "Lead placeholder"),
    status: normalizeConversationStatus(metadata.conversation_status ?? metadata.status),
    timeline: [
      timelineMessage,
      "Real-time chat, external notifications, attachments, orders, and ownership transfer are future hooks only."
    ],
    unreadCount: Math.max(0, numberValue(metadata.unread_count))
  };
}

function normalizeNotificationCategory(value: unknown): ResellerNotificationCategory {
  const category = textValue(value).toLowerCase();

  if (
    category === "future_delivery_placeholder" ||
    category === "future_sale_placeholder" ||
    category === "lead_activity" ||
    category === "listing_updates" ||
    category === "marketplace_visibility" ||
    category === "new_message" ||
    category === "review_received" ||
    category === "subscription_status" ||
    category === "template_updates" ||
    category === "verification_status"
  ) {
    return category;
  }

  return "listing_updates";
}

function normalizeNotificationStatus(value: unknown): ResellerNotificationStatus {
  const status = textValue(value).toLowerCase();

  if (status === "archived" || status === "read" || status === "unread") {
    return status;
  }

  return "unread";
}

function normalizeNotificationPriority(value: unknown): ResellerNotificationPriority {
  const priority = textValue(value).toLowerCase();

  if (priority === "high" || priority === "low" || priority === "normal") {
    return priority;
  }

  return "normal";
}

function notificationFromEvent(row: Record<string, unknown>, index: number): ResellerNotification {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    category: normalizeNotificationCategory(metadata.notification_category ?? metadata.category),
    createdAt: textValue(row.created_at) || null,
    id: textValue(metadata.notification_reference, textValue(row.id, `notification-${index}`)),
    priority: normalizeNotificationPriority(metadata.priority),
    relatedItem: textValue(metadata.related_item, "Related item placeholder"),
    status: normalizeNotificationStatus(metadata.notification_status ?? metadata.status),
    title: textValue(metadata.title, "Reseller notification placeholder")
  };
}

function normalizeBuyerRequestCategory(value: unknown): ResellerBuyerRequestCategory {
  const category = textValue(value).toLowerCase();

  if (
    category === "consultation" ||
    category === "custom_store" ||
    category === "custom_template" ||
    category === "domain_email_setup_help" ||
    category === "migration_help" ||
    category === "redesign_request" ||
    category === "setup_assistance"
  ) {
    return category;
  }

  return "custom_store";
}

function normalizeBuyerRequestStatus(value: unknown): ResellerBuyerRequestStatus {
  const status = textValue(value).toLowerCase();

  if (
    status === "accepted_placeholder" ||
    status === "archived" ||
    status === "declined" ||
    status === "in_discussion" ||
    status === "new" ||
    status === "reviewed"
  ) {
    return status;
  }

  return "new";
}

function buyerRequestFromEvent(row: Record<string, unknown>, index: number): ResellerBuyerRequest {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    budgetRange: textValue(metadata.budget_range ?? metadata.budget_placeholder, "Budget placeholder"),
    businessCategory: textValue(metadata.business_category, "Business category placeholder"),
    buyerDisplayName: textValue(metadata.buyer_display_name, "Buyer placeholder"),
    category: normalizeBuyerRequestCategory(metadata.request_category ?? metadata.category),
    createdAt: textValue(row.created_at) || null,
    description: textValue(
      metadata.description,
      "Request description placeholder. Full buyer intake is a future hook."
    ),
    id: textValue(metadata.request_reference, textValue(row.id, `buyer-request-${index}`)),
    preferredNiche: textValue(metadata.preferred_niche, "Preferred niche placeholder"),
    relatedConversation: textValue(metadata.related_conversation, "Conversation placeholder"),
    relatedLead: textValue(metadata.related_lead, "Lead placeholder"),
    requestedService: textValue(metadata.requested_service, "Custom store/template request"),
    status: normalizeBuyerRequestStatus(metadata.request_status ?? metadata.status),
    timeline: textValue(metadata.timeline, "Timeline placeholder")
  };
}

function normalizeReviewStatus(value: unknown): ResellerReviewStatus {
  const status = textValue(value).toLowerCase();

  if (status === "approved" || status === "pending" || status === "rejected") {
    return status;
  }

  return "pending";
}

function normalizeReview(row: Record<string, unknown>, index: number): ResellerReview {
  const rating = Math.min(5, Math.max(0, numberValue(row.rating_score ?? row.rating)));

  return {
    buyerDisplayName: textValue(row.buyer_display_name, "Buyer"),
    createdAt: textValue(row.created_at) || null,
    id: textValue(row.id, `review-${index}`),
    rating,
    reviewText: textValue(row.review_text, "No review text provided."),
    status: normalizeReviewStatus(row.review_status ?? row.status)
  };
}

function reviewSummary(reviews: ResellerReview[]): ResellerReviewsSummary {
  const approved = reviews.filter((review) => review.status === "approved");
  const approvedRatingTotal = approved.reduce((total, review) => total + review.rating, 0);

  return {
    approvedReviews: approved.length,
    averageRating: approved.length ? Number((approvedRatingTotal / approved.length).toFixed(1)) : null,
    pendingReviews: reviews.filter((review) => review.status === "pending").length,
    rejectedReviews: reviews.filter((review) => review.status === "rejected").length,
    reviewCount: approved.length,
    totalReviews: reviews.length
  };
}

const resellerLevelThresholds: Array<{
  level: ResellerLevel;
  minimumScore: number;
  requirements: string[];
}> = [
  {
    level: "Bronze",
    minimumScore: 0,
    requirements: ["Create a public profile", "Publish at least one listing when ready"]
  },
  {
    level: "Silver",
    minimumScore: 25,
    requirements: ["Publish 3 listings", "Receive 2 approved reviews", "Keep rating near 4.0+"]
  },
  {
    level: "Gold",
    minimumScore: 50,
    requirements: ["Publish 6 listings", "Receive 5 approved reviews", "Keep rating near 4.3+"]
  },
  {
    level: "Platinum",
    minimumScore: 75,
    requirements: ["Publish 10 listings", "Receive 12 approved reviews", "Keep rating near 4.6+"]
  },
  {
    level: "Diamond",
    minimumScore: 95,
    requirements: ["Sustain excellent reviews, reliability, and marketplace activity"]
  }
];

function trustScoreFor(score: number): ResellerTrustScore {
  if (score >= 85) {
    return "excellent";
  }

  if (score >= 60) {
    return "high";
  }

  if (score >= 30) {
    return "medium";
  }

  return "low";
}

function reputationScore({
  accountAgeDays,
  averageRating,
  publishedListings,
  totalReviews
}: {
  accountAgeDays: number;
  averageRating: number | null;
  publishedListings: number;
  totalReviews: number;
}) {
  const listingScore = Math.min(30, publishedListings * 5);
  const reviewScore = Math.min(30, totalReviews * 4);
  const ratingScore = averageRating ? Math.min(25, averageRating * 5) : 0;
  const ageScore = Math.min(15, Math.floor(accountAgeDays / 7));

  return Math.round(listingScore + reviewScore + ratingScore + ageScore);
}

function levelForScore(score: number) {
  return resellerLevelThresholds.reduce((current, threshold) => {
    return score >= threshold.minimumScore ? threshold : current;
  }, resellerLevelThresholds[0]);
}

function nextLevelFor(level: ResellerLevel) {
  const currentIndex = resellerLevelThresholds.findIndex((threshold) => threshold.level === level);
  return resellerLevelThresholds[currentIndex + 1] ?? null;
}

function buildReputation({
  profile,
  reviewsSummary,
  storeListings,
  templateListings
}: {
  profile: ResellerProfile | null;
  reviewsSummary: ResellerReviewsSummary;
  storeListings: ResellerShowcaseItem[];
  templateListings: ResellerShowcaseItem[];
}): ResellerReputation {
  const publishedListings = storeListings.length + templateListings.length;
  const accountAgeDays = daysSince(profile?.created_at);
  const score = reputationScore({
    accountAgeDays,
    averageRating: reviewsSummary.averageRating,
    publishedListings,
    totalReviews: reviewsSummary.approvedReviews
  });
  const level = levelForScore(score);
  const nextLevel = nextLevelFor(level.level);
  const nextMinimum = nextLevel?.minimumScore ?? 100;
  const progress = nextLevel
    ? Math.min(99, Math.round((score / nextMinimum) * 100))
    : 100;
  const missingRequirements = nextLevel
    ? nextLevel.requirements
    : ["Max foundation level reached. Future eligibility can include verified sales and dispute history."];

  return {
    accountAgeDays,
    currentLevel: level.level,
    friendlyExplanation:
      publishedListings || reviewsSummary.approvedReviews
        ? "Level is derived from safe activity signals like published listings, approved reviews, rating, and account age."
        : "New reseller foundation. Start with a public profile and published listings to progress.",
    futureHooks: [
      "Auto level recalculation",
      "Verified sales count",
      "Review score weighting",
      "Dispute penalty",
      "Featured reseller eligibility"
    ],
    missingRequirements,
    metrics: [
      {
        key: "stores_listed",
        label: "Stores listed",
        note: "Published public store listings only.",
        value: storeListings.length
      },
      {
        key: "stores_sold",
        label: "Stores sold",
        note: "Verified sales count is a future placeholder. No fake sales are created.",
        value: "0 placeholder"
      },
      {
        key: "templates_listed",
        label: "Templates listed",
        note: "Published public template listings only.",
        value: templateListings.length
      },
      {
        key: "average_rating",
        label: "Average rating",
        note: "Approved reviews only.",
        value: reviewsSummary.averageRating ?? "No reviews yet"
      },
      {
        key: "total_reviews",
        label: "Total reviews",
        note: "Approved public review count.",
        value: reviewsSummary.approvedReviews
      },
      {
        key: "response_rate",
        label: "Response rate",
        note: "Future buyer contact response metric placeholder.",
        value: "Placeholder"
      },
      {
        key: "completion_rate",
        label: "Completion rate",
        note: "Future verified delivery/completion metric placeholder.",
        value: "Placeholder"
      },
      {
        key: "dispute_rate",
        label: "Dispute rate",
        note: "Future dispute penalty metric placeholder.",
        value: "Placeholder"
      },
      {
        key: "account_age",
        label: "Account age",
        note: "Derived from reseller profile creation date.",
        value: `${accountAgeDays} day${accountAgeDays === 1 ? "" : "s"}`
      }
    ],
    nextLevel: nextLevel?.level ?? "Max level",
    progress,
    trustScore: trustScoreFor(score)
  };
}

function verificationItems({
  emailVerified,
  hasBusinessProfile
}: {
  emailVerified: boolean;
  hasBusinessProfile: boolean;
}): ResellerVerificationItem[] {
  return [
    {
      description: "Confirms the reseller account email. No email address is displayed publicly from this check.",
      kind: "email",
      publicLabel: "Email verification",
      requirements: ["Confirm reseller account email"],
      status: emailVerified ? "verified" : "not_started",
      title: "Email"
    },
    {
      description: "Future phone OTP verification placeholder. Phone number remains private unless separately configured for public contact.",
      kind: "phone",
      publicLabel: "Phone verification",
      requirements: ["Future phone OTP workflow"],
      status: "not_started",
      title: "Phone"
    },
    {
      description: "Future identity review placeholder. Identity documents are never public.",
      kind: "identity",
      publicLabel: "Identity verification",
      requirements: ["Future identity document upload", "Future admin/KYC review"],
      status: "not_started",
      title: "Identity"
    },
    {
      description: "Future business verification placeholder for reseller business legitimacy.",
      kind: "business",
      publicLabel: "Business verification",
      requirements: ["Complete business settings", "Future business document upload"],
      status: hasBusinessProfile ? "pending" : "not_started",
      title: "Business"
    }
  ];
}

function buildVerificationData({
  emailVerified = false,
  hasBusinessProfile = false,
  profile
}: {
  emailVerified?: boolean;
  hasBusinessProfile?: boolean;
  profile: ResellerProfile | null;
}): ResellerVerificationData {
  const items = verificationItems({ emailVerified, hasBusinessProfile });
  const verifiedCount = items.filter((item) => item.status === "verified").length;
  const overallStatus: ResellerVerificationStatus =
    verifiedCount === items.length
      ? "verified"
      : items.some((item) => item.status === "pending")
        ? "pending"
        : "not_started";

  return {
    futureHooks: [
      "Email verification workflow",
      "Phone OTP workflow",
      "Identity document upload",
      "Business document upload",
      "Admin review",
      "Verification expiration",
      "Verified seller badge"
    ],
    items,
    overallStatus,
    profile,
    publicBadges: items.map((item) => ({
      kind: item.kind,
      label: item.publicLabel,
      status: item.status
    })),
    verifiedCount
  };
}

function resellerPlanFromConfig(): ResellerInventoryPlan {
  const configuredPlan = process.env.RESELLER_SUBSCRIPTION_PLAN ?? process.env.DEFAULT_RESELLER_PLAN;
  const normalized = configuredPlan?.trim().toLowerCase();

  if (normalized === "enterprise") {
    return "Enterprise";
  }

  if (normalized === "agency") {
    return "Agency";
  }

  if (normalized === "pro") {
    return "Pro";
  }

  return "Starter";
}

function resellerPlanFromBillingPlanId(value: string | null | undefined): ResellerInventoryPlan | null {
  if (value === "agency") {
    return "Agency";
  }

  if (value === "pro") {
    return "Pro";
  }

  if (value === "starter") {
    return "Starter";
  }

  return null;
}

function normalizeResellerBillingStatus(
  value: unknown
): ResellerSubscriptionPlanEngineData["billingStatus"] {
  if (
    value === "active" ||
    value === "trialing" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "incomplete" ||
    value === "unpaid"
  ) {
    return value;
  }

  return "active_placeholder";
}

function buildResellerInventoryData(dashboard: ResellerDashboardData): ResellerInventoryData {
  const currentPlan = resellerPlanFromConfig();
  const allowedStoreListings = resellerInventoryPlanLimits[currentPlan];
  const storeItems = dashboard.items.filter((item) => !isTemplateListing(item));
  const draftListingsCount = storeItems.filter((item) => item.status !== "published").length;
  const publishedListingsCount = storeItems.filter((item) => isPublicMarketplaceStatus(item.status)).length;
  const soldListingsCount = 0;
  const usedStoreListings = draftListingsCount + publishedListingsCount + soldListingsCount;
  const remainingStoreListings = Math.max(allowedStoreListings - usedStoreListings, 0);
  const usageRatio = allowedStoreListings > 0 ? usedStoreListings / allowedStoreListings : 1;
  const isAtLimit = remainingStoreListings === 0;
  const isNearLimit = !isAtLimit && usageRatio >= 0.8;

  return {
    allowedStoreListings,
    currentPlan,
    draftListingsCount,
    futureHooks: [
      "Sale completed consumes inventory",
      "Plan upgrade increases inventory",
      "Plan downgrade validates current usage",
      "Expired subscription freezes new listings",
      "Sold listing count sync",
      "Admin inventory override review"
    ],
    isAtLimit,
    isNearLimit,
    planLimits: [
      {
        allowedStoreListings: resellerInventoryPlanLimits.Starter,
        name: "Starter",
        note: "Entry inventory for testing reseller listings."
      },
      {
        allowedStoreListings: resellerInventoryPlanLimits.Pro,
        name: "Pro",
        note: "Higher active inventory for growing resellers."
      },
      {
        allowedStoreListings: resellerInventoryPlanLimits.Agency,
        name: "Agency",
        note: "Large catalog capacity for teams and studios."
      },
      {
        allowedStoreListings: resellerInventoryPlanLimits.Enterprise,
        name: "Enterprise",
        note: "Custom high-volume inventory foundation."
      }
    ],
    publishedListingsCount,
    remainingStoreListings,
    soldListingsCount,
    upgradeHint:
      isAtLimit || isNearLimit
        ? "Upgrade your reseller subscription plan to unlock more ready store listings."
        : null,
    usedStoreListings
  };
}

function applyResellerPlanToInventory(
  inventory: ResellerInventoryData,
  currentPlan: ResellerInventoryPlan
): ResellerInventoryData {
  const allowedStoreListings = resellerInventoryPlanLimits[currentPlan];
  const remainingStoreListings = Math.max(allowedStoreListings - inventory.usedStoreListings, 0);
  const usageRatio = allowedStoreListings > 0 ? inventory.usedStoreListings / allowedStoreListings : 1;

  return {
    ...inventory,
    allowedStoreListings,
    currentPlan,
    isAtLimit: remainingStoreListings === 0,
    isNearLimit: remainingStoreListings > 0 && usageRatio >= 0.8,
    remainingStoreListings,
    upgradeHint:
      remainingStoreListings === 0
        ? `Upgrade your reseller subscription to create more listings beyond the ${currentPlan} plan.`
        : usageRatio >= 0.8
          ? `You are close to the ${currentPlan} reseller listing limit.`
          : null
  };
}

function applyResellerPlanToTemplateInventory(
  inventory: ResellerTemplateInventoryData,
  currentPlan: ResellerInventoryPlan
): ResellerTemplateInventoryData {
  const allowedTemplates = resellerTemplateInventoryPlanLimits[currentPlan];
  const remainingTemplates = Math.max(allowedTemplates - inventory.usedTemplates, 0);
  const usageRatio = allowedTemplates > 0 ? inventory.usedTemplates / allowedTemplates : 1;

  return {
    ...inventory,
    allowedTemplates,
    currentPlan,
    isAtLimit: remainingTemplates === 0,
    isNearLimit: remainingTemplates > 0 && usageRatio >= 0.8,
    remainingTemplates,
    upgradeHint:
      remainingTemplates === 0
        ? `Upgrade your reseller subscription to publish more templates beyond the ${currentPlan} plan.`
        : usageRatio >= 0.8
          ? `You are close to the ${currentPlan} reseller template limit.`
          : null
  };
}

function buildResellerTemplateInventoryData(statuses: string[]): ResellerTemplateInventoryData {
  const currentPlan = resellerPlanFromConfig();
  const allowedTemplates = resellerTemplateInventoryPlanLimits[currentPlan];
  const publishedTemplatesCount = statuses.filter((status) => status === "published").length;
  const draftTemplatesCount = statuses.filter((status) => status !== "published").length;
  const soldTemplatesCount = 0;
  const usedTemplates = publishedTemplatesCount + draftTemplatesCount + soldTemplatesCount;
  const remainingTemplates = Math.max(allowedTemplates - usedTemplates, 0);
  const usageRatio = allowedTemplates > 0 ? usedTemplates / allowedTemplates : 1;
  const isAtLimit = remainingTemplates === 0;
  const isNearLimit = !isAtLimit && usageRatio >= 0.8;

  return {
    allowedTemplates,
    currentPlan,
    draftTemplatesCount,
    futureHooks: [
      "Template sold consumes inventory",
      "Plan upgrade increases template allowance",
      "Plan downgrade validates template usage",
      "Expired subscription freezes new template publishing",
      "Template sale count sync",
      "Admin template inventory review"
    ],
    isAtLimit,
    isNearLimit,
    planLimits: [
      {
        allowedTemplates: resellerTemplateInventoryPlanLimits.Starter,
        name: "Starter",
        note: "Small template catalog for early reseller testing."
      },
      {
        allowedTemplates: resellerTemplateInventoryPlanLimits.Pro,
        name: "Pro",
        note: "Expanded template allowance for active resellers."
      },
      {
        allowedTemplates: resellerTemplateInventoryPlanLimits.Agency,
        name: "Agency",
        note: "Larger template catalog capacity for studios."
      },
      {
        allowedTemplates: resellerTemplateInventoryPlanLimits.Enterprise,
        name: "Enterprise",
        note: "Custom high-volume template inventory foundation."
      }
    ],
    publishedTemplatesCount,
    remainingTemplates,
    soldTemplatesCount,
    upgradeHint:
      isAtLimit || isNearLimit
        ? "Upgrade your reseller subscription plan to unlock more templates."
        : null,
    usedTemplates
  };
}

export async function getResellerVerificationData(): Promise<ResellerVerificationData> {
  const [dashboard, user] = await Promise.all([
    getResellerDashboardData(),
    getDashboardUser()
  ]);

  return buildVerificationData({
    emailVerified: Boolean(user?.email_confirmed_at),
    hasBusinessProfile: Boolean(dashboard.profile),
    profile: dashboard.profile
  });
}

export async function getResellerBadgesData(): Promise<ResellerBadgesData> {
  const [dashboard, reviews, reputation, verification, user] = await Promise.all([
    getResellerDashboardData(),
    getResellerReviewsData(),
    getResellerReputationData(),
    getResellerVerificationData(),
    getDashboardUser()
  ]);
  const visibilityOverrides = await getBadgeVisibilityOverrides(user?.id);

  return buildResellerBadges({
    dashboard,
    reputation,
    reviews,
    verification,
    visibilityOverrides
  });
}

export async function getResellerInventoryData(): Promise<ResellerInventoryData> {
  const dashboard = await getResellerDashboardData();

  return buildResellerInventoryData(dashboard);
}

export async function getResellerTemplateInventoryData(): Promise<ResellerTemplateInventoryData> {
  const supabase = await createClient();
  const user = await getDashboardUser();

  if (!user) {
    return buildResellerTemplateInventoryData([]);
  }

  const { data, error } = await supabase
    .from("template_drafts" as never)
    .select("status")
    .eq("user_id", user.id);

  if (error) {
    return buildResellerTemplateInventoryData(isMissingTemplateDraftsTable(error) ? [] : []);
  }

  const statuses = ((data ?? []) as unknown as Array<{ status?: string }>).map((row) => row.status ?? "draft");

  return buildResellerTemplateInventoryData(statuses);
}

const resellerSubscriptionPlanDefinitions: ResellerPlanDefinition[] = [
  {
    allowedPortfolioItems: resellerPortfolioPlanLimits.Starter,
    allowedStoreListings: resellerInventoryPlanLimits.Starter,
    allowedTemplates: resellerTemplateInventoryPlanLimits.Starter,
    featuredRequestAvailability: "Not included",
    marketplaceVisibilityLevel: "basic",
    monthlyPricePlaceholder: "$19/mo placeholder",
    name: "Starter",
    publicProfileEnabled: true,
    supportLevelPlaceholder: "Community support placeholder",
    teamMembersPlaceholder: 1
  },
  {
    allowedPortfolioItems: resellerPortfolioPlanLimits.Pro,
    allowedStoreListings: resellerInventoryPlanLimits.Pro,
    allowedTemplates: resellerTemplateInventoryPlanLimits.Pro,
    featuredRequestAvailability: "Featured request placeholder",
    marketplaceVisibilityLevel: "featured_ready",
    monthlyPricePlaceholder: "$49/mo placeholder",
    name: "Pro",
    publicProfileEnabled: true,
    supportLevelPlaceholder: "Priority email support placeholder",
    teamMembersPlaceholder: 3
  },
  {
    allowedPortfolioItems: resellerPortfolioPlanLimits.Agency,
    allowedStoreListings: resellerInventoryPlanLimits.Agency,
    allowedTemplates: resellerTemplateInventoryPlanLimits.Agency,
    featuredRequestAvailability: "Featured + boost request placeholder",
    marketplaceVisibilityLevel: "priority",
    monthlyPricePlaceholder: "$149/mo placeholder",
    name: "Agency",
    publicProfileEnabled: true,
    supportLevelPlaceholder: "Agency support placeholder",
    teamMembersPlaceholder: 10
  },
  {
    allowedPortfolioItems: resellerPortfolioPlanLimits.Enterprise,
    allowedStoreListings: resellerInventoryPlanLimits.Enterprise,
    allowedTemplates: resellerTemplateInventoryPlanLimits.Enterprise,
    featuredRequestAvailability: "Custom marketplace program placeholder",
    marketplaceVisibilityLevel: "priority",
    monthlyPricePlaceholder: "Custom monthly placeholder",
    name: "Enterprise",
    publicProfileEnabled: true,
    supportLevelPlaceholder: "Dedicated success placeholder",
    teamMembersPlaceholder: 25
  }
];

export async function getResellerSubscriptionPlanEngineData(): Promise<ResellerSubscriptionPlanEngineData> {
  const supabase = await createClient();
  const user = await getDashboardUser();
  const [baseInventory, baseTemplateInventory, portfolioData, subscriptionResult] = await Promise.all([
    getResellerInventoryData(),
    getResellerTemplateInventoryData(),
    getResellerPortfolioData(),
    user
      ? supabase
          .from("user_subscriptions" as never)
          .select("plan_id, status, current_period_end")
          .eq("user_id" as never, user.id as never)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  const subscription = subscriptionResult.data as {
    current_period_end?: string | null;
    plan_id?: string | null;
    status?: string | null;
  } | null;
  const currentPlan = resellerPlanFromBillingPlanId(subscription?.plan_id) ?? baseInventory.currentPlan;
  const inventory = applyResellerPlanToInventory(baseInventory, currentPlan);
  const templateInventory = applyResellerPlanToTemplateInventory(baseTemplateInventory, currentPlan);
  const currentPlanDefinition =
    resellerSubscriptionPlanDefinitions.find((plan) => plan.name === currentPlan) ??
    resellerSubscriptionPlanDefinitions[0];
  const usedPortfolioItems = portfolioData.items.length;
  const allowedPortfolioItems = currentPlanDefinition.allowedPortfolioItems;
  const remainingPortfolioItems = Math.max(allowedPortfolioItems - usedPortfolioItems, 0);
  const overListingLimit = inventory.usedStoreListings > inventory.allowedStoreListings;
  const overTemplateLimit = templateInventory.usedTemplates > templateInventory.allowedTemplates;
  const overPortfolioLimit = usedPortfolioItems > allowedPortfolioItems;
  const subscriptionExpiredPlaceholder = false;
  const upgradeRequiredMessage =
    overListingLimit || overTemplateLimit || overPortfolioLimit || subscriptionExpiredPlaceholder
      ? "Upgrade or renew your reseller subscription placeholder to unlock additional marketplace capacity."
      : null;

  return {
    billingStatus: normalizeResellerBillingStatus(subscription?.status),
    currentPlan,
    downgradeWarningPlaceholder:
      "Downgrading will require all listings, templates, and portfolio items to fit within the lower plan limits before enforcement is enabled.",
    enforcement: {
      overListingLimit,
      overPortfolioLimit,
      overTemplateLimit,
      subscriptionExpiredPlaceholder,
      upgradeRequiredMessage
    },
    futureHooks: [
      "Stripe reseller subscription",
      "NOWPayments reseller subscription",
      "Plan upgrade",
      "Plan downgrade",
      "Expired subscription freeze",
      "Renewal notifications",
      "Invoice history"
    ],
    inventory,
    planLimits: resellerSubscriptionPlanDefinitions,
    portfolio: {
      allowedPortfolioItems,
      isOverLimit: overPortfolioLimit,
      remainingPortfolioItems,
      usedPortfolioItems
    },
    renewalDatePlaceholder: subscription?.current_period_end ?? "Next renewal date unavailable",
    templateInventory,
    upgradeCtaPlaceholder:
      "Upgrade CTA placeholder only. No payment, checkout, wallet, payout, withdrawal, commission, order, or ownership transfer is created."
  };
}

export async function getResellerAnalyticsData(
  rangeValue?: string | null
): Promise<ResellerAnalyticsData> {
  const range = normalizeAnalyticsRange(rangeValue);
  const dashboard = await getResellerDashboardData();
  const items = dashboard.items;
  const templateItems = items.filter(isTemplateListing);
  const listingItems = items.filter((item) => !isTemplateListing(item));
  const publicItems = items.filter((item) => isPublicMarketplaceStatus(item.status));
  const hiddenItems = items.filter((item) => item.status === "hidden" || item.status === "unpublished");
  const privateItems = items.filter((item) => item.status === "private");
  const underReviewItems = items.filter((item) => item.status === "under_review");
  const featuredReadyItems = items.filter((item) => item.status === "featured_ready");
  const boostedItems = items.filter((item) => item.status === "boosted_placeholder");
  const categories = new Map<string, number>();

  items.forEach((item) => {
    const category = item.category ?? "Uncategorized";
    categories.set(category, (categories.get(category) ?? 0) + 1);
  });

  return {
    bestCategories: Array.from(categories.entries()).map(([category, count]) => ({
      category,
      clicks: 0,
      itemType: "visibility",
      name: category,
      status: `${count} marketplace item${count === 1 ? "" : "s"}`,
      views: 0
    })),
    emptyStates: [
      "No profile views yet.",
      "No listing views yet.",
      "No template views yet.",
      "No leads yet."
    ],
    filters: [
      { href: "/reseller/dashboard/analytics?range=today", isActive: range === "today", label: "Today", value: "today" },
      { href: "/reseller/dashboard/analytics?range=7d", isActive: range === "7d", label: "7 days", value: "7d" },
      { href: "/reseller/dashboard/analytics?range=30d", isActive: range === "30d", label: "30 days", value: "30d" },
      { href: "/reseller/dashboard/analytics?range=month", isActive: range === "month", label: "Month", value: "month" },
      { href: "/reseller/dashboard/analytics?range=all", isActive: range === "all", label: "All time", value: "all" }
    ],
    futureHooks: [
      "Real view tracking",
      "Click tracking",
      "Lead tracking",
      "Conversion tracking",
      "Marketplace ranking analytics",
      "Export analytics report"
    ],
    leadPerformance: [
      analyticsMetric("leads", "Leads", 0, "Placeholder until lead tracking is connected."),
      analyticsMetric("contact_clicks", "Contact clicks", 0, "No buyer email or phone details are shown."),
      analyticsMetric("conversion_rate", "Conversion rate", "0%", "No fake sales or commission data is generated.")
    ],
    listingPerformance: [
      analyticsMetric("total_listings", "Store listings", listingItems.length, "Existing non-template reseller listings."),
      analyticsMetric("public_listings", "Public listings", listingItems.filter((item) => isPublicMarketplaceStatus(item.status)).length, "Visible on public profile when profile is published."),
      analyticsMetric("listing_views", "Listing views", 0, "Placeholder until marketplace listing view tracking is added.")
    ],
    overview: [
      analyticsMetric("profile_views", "Profile views", 0, "Placeholder aggregate only."),
      analyticsMetric("listing_views", "Listing views", 0, "Placeholder aggregate only."),
      analyticsMetric("template_views", "Template views", 0, "Placeholder aggregate only."),
      analyticsMetric("contact_clicks", "Contact clicks", 0, "Placeholder aggregate only."),
      analyticsMetric("leads", "Leads", 0, "Placeholder aggregate only."),
      analyticsMetric("conversion_rate", "Conversion rate", "0%", "Placeholder aggregate only.")
    ],
    profile: dashboard.profile,
    profilePerformance: [
      analyticsMetric("profile_status", "Profile status", dashboard.profile?.is_published ? "Live" : "Draft", "Profile visibility only."),
      analyticsMetric("public_items", "Public items", publicItems.length, "Public, featured-ready, boosted placeholder, and legacy published items."),
      analyticsMetric("profile_views", "Profile views", 0, "Placeholder until public profile view tracking is added.")
    ],
    range,
    ready: dashboard.ready,
    templatePerformance: [
      analyticsMetric("templates", "Templates", templateItems.length, "Template-backed marketplace items."),
      analyticsMetric("public_templates", "Public templates", templateItems.filter((item) => isPublicMarketplaceStatus(item.status)).length, "Template items visible publicly."),
      analyticsMetric("template_views", "Template views", 0, "Placeholder until template view tracking is added.")
    ],
    topListings: listingItems.slice(0, 6).map((item) => analyticsRow(item, "listing")),
    topTemplates: templateItems.slice(0, 6).map((item) => analyticsRow(item, "template")),
    visibilityImpact: [
      {
        category: "Visibility",
        clicks: 0,
        itemType: "visibility",
        name: "Public",
        status: `${publicItems.length} items`,
        views: 0
      },
      {
        category: "Visibility",
        clicks: 0,
        itemType: "visibility",
        name: "Hidden",
        status: `${hiddenItems.length} items`,
        views: 0
      },
      {
        category: "Visibility",
        clicks: 0,
        itemType: "visibility",
        name: "Private",
        status: `${privateItems.length} items`,
        views: 0
      },
      {
        category: "Visibility",
        clicks: 0,
        itemType: "visibility",
        name: "Under review",
        status: `${underReviewItems.length} items`,
        views: 0
      },
      {
        category: "Visibility",
        clicks: 0,
        itemType: "visibility",
        name: "Featured/boosted placeholder",
        status: `${featuredReadyItems.length + boostedItems.length} items`,
        views: 0
      }
    ],
    visibilityPerformance: [
      analyticsMetric("public", "Public", publicItems.length, "Items eligible for public profile display."),
      analyticsMetric("hidden_private", "Hidden/private", hiddenItems.length + privateItems.length, "Items kept out of public profile."),
      analyticsMetric("under_review", "Under review", underReviewItems.length, "Internal-only moderation placeholder."),
      analyticsMetric("featured_boosted", "Featured/boosted", featuredReadyItems.length + boostedItems.length, "Boosted remains placeholder-only with no payment.")
    ]
  };
}

export async function getResellerLeadsData(): Promise<ResellerLeadsData> {
  const user = await getDashboardUser();
  const statusFoundation: ResellerLeadStatus[] = [
    "new",
    "interested",
    "contacted",
    "negotiating",
    "won_placeholder",
    "lost",
    "archived"
  ];

  if (!user) {
    return {
      emptyState: "No leads yet. Future buyer inquiries will appear here as pre-sale interest records only.",
      futureHooks: [
        "Buyer inquiry form",
        "Messaging center",
        "Lead-to-order conversion",
        "Verified buyer tracking",
        "Custom store request",
        "CRM export"
      ],
      leads: [],
      selectedLead: null,
      sourceFoundation: [
        { label: "Public profile contact", value: "public_profile_contact" },
        { label: "Listing inquiry", value: "listing_inquiry" },
        { label: "Template inquiry", value: "template_inquiry" },
        { label: "Custom buyer request", value: "custom_buyer_request" }
      ],
      statusFoundation,
      summary: {
        activeLeads: 0,
        archivedLeads: 0,
        lostLeads: 0,
        totalLeads: 0,
        wonPlaceholders: 0
      }
    };
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("id, event_type, metadata, created_at")
        .eq("user_id", user.id)
        .eq("entity_type", "reseller_leads")
        .order("created_at", { ascending: false })
        .limit(25)
    : { data: [] };
  const leads = ((data ?? []) as unknown as Record<string, unknown>[]).map(leadFromEvent);

  return {
    emptyState: "No leads yet. Future buyer inquiries will appear here as pre-sale interest records only.",
    futureHooks: [
      "Buyer inquiry form",
      "Messaging center",
      "Lead-to-order conversion",
      "Verified buyer tracking",
      "Custom store request",
      "CRM export"
    ],
    leads,
    selectedLead: leads[0] ?? null,
    sourceFoundation: [
      { label: "Public profile contact", value: "public_profile_contact" },
      { label: "Listing inquiry", value: "listing_inquiry" },
      { label: "Template inquiry", value: "template_inquiry" },
      { label: "Custom buyer request", value: "custom_buyer_request" }
    ],
    statusFoundation,
    summary: {
      activeLeads: leads.filter((lead) => !["archived", "lost", "won_placeholder"].includes(lead.status)).length,
      archivedLeads: leads.filter((lead) => lead.status === "archived").length,
      lostLeads: leads.filter((lead) => lead.status === "lost").length,
      totalLeads: leads.length,
      wonPlaceholders: leads.filter((lead) => lead.status === "won_placeholder").length
    }
  };
}

export async function getResellerMessagesData(): Promise<ResellerMessagesData> {
  const user = await getDashboardUser();
  const emptyState = "No conversations yet. Future buyer message forms and lead inquiries will appear here privately.";
  const futureHooks = [
    "Real-time chat",
    "Buyer message form",
    "Email notification",
    "WhatsApp/SMS bridge",
    "File attachments",
    "Dispute escalation",
    "Lead-to-order conversion"
  ];

  if (!user) {
    return {
      conversations: [],
      emptyState,
      futureHooks,
      inbox: [
        { count: 0, key: "all", label: "All conversations" },
        { count: 0, key: "unread", label: "Unread" },
        { count: 0, key: "lead_inquiries", label: "Lead inquiries" },
        { count: 0, key: "listing_inquiries", label: "Listing inquiries" },
        { count: 0, key: "template_inquiries", label: "Template inquiries" },
        { count: 0, key: "custom_requests", label: "Custom requests" },
        { count: 0, key: "archived", label: "Archived" }
      ],
      selectedConversation: null
    };
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("id, event_type, metadata, created_at")
        .eq("user_id", user.id)
        .eq("entity_type", "reseller_messages")
        .order("created_at", { ascending: false })
        .limit(25)
    : { data: [] };
  const conversations = ((data ?? []) as unknown as Record<string, unknown>[]).map(conversationFromEvent);

  return {
    conversations,
    emptyState,
    futureHooks,
    inbox: [
      { count: conversations.length, key: "all", label: "All conversations" },
      { count: conversations.filter((conversation) => conversation.status === "unread" || conversation.unreadCount > 0).length, key: "unread", label: "Unread" },
      { count: conversations.filter((conversation) => conversation.relatedLead !== "Lead placeholder").length, key: "lead_inquiries", label: "Lead inquiries" },
      { count: conversations.filter((conversation) => conversation.itemType === "store").length, key: "listing_inquiries", label: "Listing inquiries" },
      { count: conversations.filter((conversation) => conversation.itemType === "template").length, key: "template_inquiries", label: "Template inquiries" },
      { count: conversations.filter((conversation) => conversation.itemType === "custom request").length, key: "custom_requests", label: "Custom requests" },
      { count: conversations.filter((conversation) => conversation.status === "archived").length, key: "archived", label: "Archived" }
    ],
    selectedConversation: conversations[0] ?? null
  };
}

export async function getResellerNotificationsData(): Promise<ResellerNotificationsData> {
  const user = await getDashboardUser();
  const categories: ResellerNotificationsData["categories"] = [
    { label: "Listing updates", value: "listing_updates" },
    { label: "Template updates", value: "template_updates" },
    { label: "Lead activity", value: "lead_activity" },
    { label: "New message", value: "new_message" },
    { label: "Review received", value: "review_received" },
    { label: "Verification status", value: "verification_status" },
    { label: "Subscription status", value: "subscription_status" },
    { label: "Marketplace visibility", value: "marketplace_visibility" },
    { label: "Future sale placeholder", value: "future_sale_placeholder" },
    { label: "Future delivery placeholder", value: "future_delivery_placeholder" }
  ];
  const futureHooks = [
    "Real notification creation from leads/messages/reviews",
    "Email notification bridge",
    "WhatsApp/SMS bridge",
    "Push notifications",
    "Notification preferences"
  ];
  const emptyState = "No reseller notifications yet. Future private platform alerts will appear here.";

  if (!user) {
    return {
      categories,
      emptyState,
      futureHooks,
      notifications: [],
      summary: { archived: 0, highPriority: 0, thisWeek: 0, unread: 0 }
    };
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("id, event_type, metadata, created_at")
        .eq("user_id", user.id)
        .eq("entity_type", "reseller_notifications")
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const notifications = ((data ?? []) as unknown as Record<string, unknown>[]).map(notificationFromEvent);
  const weekAgo = Date.now() - 7 * 86_400_000;

  return {
    categories,
    emptyState,
    futureHooks,
    notifications,
    summary: {
      archived: notifications.filter((notification) => notification.status === "archived").length,
      highPriority: notifications.filter((notification) => notification.priority === "high").length,
      thisWeek: notifications.filter((notification) =>
        notification.createdAt ? new Date(notification.createdAt).getTime() >= weekAgo : false
      ).length,
      unread: notifications.filter((notification) => notification.status === "unread").length
    }
  };
}

export async function getResellerBuyerRequestsData(): Promise<ResellerBuyerRequestsData> {
  const user = await getDashboardUser();
  const categories: ResellerBuyerRequestsData["categories"] = [
    { label: "Custom store", value: "custom_store" },
    { label: "Custom template", value: "custom_template" },
    { label: "Redesign request", value: "redesign_request" },
    { label: "Setup assistance", value: "setup_assistance" },
    { label: "Domain/email setup help", value: "domain_email_setup_help" },
    { label: "Migration help", value: "migration_help" },
    { label: "Consultation", value: "consultation" }
  ];
  const statuses: ResellerBuyerRequestStatus[] = [
    "new",
    "reviewed",
    "accepted_placeholder",
    "declined",
    "in_discussion",
    "archived"
  ];
  const futureHooks = [
    "Public request form",
    "Buyer account requests",
    "Convert request to lead",
    "Convert lead to order",
    "Custom quote",
    "Messaging integration",
    "Notification integration"
  ];
  const emptyState = "No buyer requests yet. Future private custom store/template requests will appear here.";

  if (!user) {
    return {
      categories,
      emptyState,
      futureHooks,
      requests: [],
      selectedRequest: null,
      statuses
    };
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("id, event_type, metadata, created_at")
        .eq("user_id", user.id)
        .eq("entity_type", "reseller_buyer_requests")
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const requests = ((data ?? []) as unknown as Record<string, unknown>[]).map(buyerRequestFromEvent);

  return {
    categories,
    emptyState,
    futureHooks,
    requests,
    selectedRequest: requests[0] ?? null,
    statuses
  };
}

export async function getResellerPreviewsData(): Promise<ResellerPreviewsData> {
  const dashboard = await getResellerDashboardData();
  const previews = dashboard.items.map((item) => previewRowFromItem(item, dashboard.profile?.slug));
  const statuses: ResellerPreviewStatus[] = [
    "disabled",
    "enabled",
    "draft_preview",
    "public_preview",
    "expired",
    "under_review"
  ];

  return {
    emptyState: "No reseller preview items yet. Create store listings, templates, or showcase items to manage safe preview links.",
    futureHooks: [
      "Preview analytics",
      "Expiring preview links",
      "Password-protected preview",
      "Buyer preview tracking",
      "Preview-to-lead conversion",
      "Preview-to-order conversion"
    ],
    previews,
    safetyNotes: [
      "Private drafts stay hidden from the public profile by default.",
      "Public profile preview buttons require both a public marketplace status and an enabled preview marker.",
      "Preview pages do not create checkout, purchase, ownership transfer, wallet, payout, withdrawal, commission, or fake sale flows.",
      "Preview URLs are generated as safe reseller profile preview links and do not expose buyer/private owner data."
    ],
    statuses,
    summary: {
      disabled: previews.filter((preview) => preview.status === "disabled").length,
      enabled: previews.filter((preview) => preview.status !== "disabled" && preview.status !== "expired").length,
      publicPreview: previews.filter((preview) => preview.status === "public_preview").length,
      underReview: previews.filter((preview) => preview.status === "under_review").length
    }
  };
}

const resellerPortfolioTypes: ResellerPortfolioData["types"] = [
  { label: "Completed store design", value: "completed_store_design" },
  { label: "Template example", value: "template_example" },
  { label: "Redesign project", value: "redesign_project" },
  { label: "Landing page", value: "landing_page" },
  { label: "Brand setup", value: "brand_setup" },
  { label: "Case study", value: "case_study" }
];

const resellerPortfolioStatuses: ResellerPortfolioStatus[] = [
  "draft",
  "published",
  "hidden",
  "under_review",
  "archived"
];

function emptyPortfolioData(items: ResellerPortfolioItem[] = []): ResellerPortfolioData {
  const publicItems = items.filter((item) => item.status === "published");

  return {
    emptyState: "No portfolio items yet. Create showcase-only examples to highlight previous work.",
    futureHooks: [
      "Portfolio media uploads",
      "Before/after gallery",
      "Case study builder",
      "Portfolio SEO",
      "Buyer inquiry from portfolio item"
    ],
    items,
    publicItems,
    selectedItem: items[0] ?? null,
    statuses: resellerPortfolioStatuses,
    types: resellerPortfolioTypes
  };
}

export async function getResellerPortfolioData(): Promise<ResellerPortfolioData> {
  const user = await getDashboardUser();

  if (!user) {
    return emptyPortfolioData();
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("id, event_type, metadata, created_at")
        .eq("user_id", user.id)
        .eq("entity_type", "reseller_portfolio")
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const items = ((data ?? []) as unknown as Record<string, unknown>[]).map(portfolioItemFromEvent);

  return emptyPortfolioData(items);
}

async function getPublicResellerPortfolioItems(userId: string | null | undefined) {
  if (!userId) {
    return [];
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("id, event_type, metadata, created_at")
        .eq("user_id", userId)
        .eq("entity_type", "reseller_portfolio")
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  return ((data ?? []) as unknown as Record<string, unknown>[])
    .map(portfolioItemFromEvent)
    .filter((item) => item.status === "published");
}

const resellerMarketplaceCategoryDefinitions = [
  { description: "Fashion stores, apparel brands, boutiques, and accessories.", iconPlaceholder: "Fashion icon placeholder", name: "Fashion" },
  { description: "Electronics, gadgets, devices, and tech storefronts.", iconPlaceholder: "Electronics icon placeholder", name: "Electronics" },
  { description: "Beauty, cosmetics, skincare, wellness, and salon brands.", iconPlaceholder: "Beauty icon placeholder", name: "Beauty" },
  { description: "Food, restaurants, cafes, grocery, and packaged products.", iconPlaceholder: "Food icon placeholder", name: "Food" },
  { description: "Service businesses, agencies, consultants, and appointments.", iconPlaceholder: "Services icon placeholder", name: "Services" },
  { description: "Digital products, downloads, courses, and software offers.", iconPlaceholder: "Digital products icon placeholder", name: "Digital Products" },
  { description: "Home decor, furniture, interiors, and household products.", iconPlaceholder: "Home and furniture icon placeholder", name: "Home & Furniture" },
  { description: "Fitness, gyms, coaching, supplements, and sports brands.", iconPlaceholder: "Fitness icon placeholder", name: "Fitness" },
  { description: "Education, schools, courses, tutors, and learning products.", iconPlaceholder: "Education icon placeholder", name: "Education" },
  { description: "Real estate listings, property services, and broker brands.", iconPlaceholder: "Real estate icon placeholder", name: "Real Estate" },
  { description: "Travel, tourism, booking, hotels, and destination brands.", iconPlaceholder: "Travel icon placeholder", name: "Travel" },
  { description: "Automotive, parts, rentals, dealerships, and vehicle services.", iconPlaceholder: "Automotive icon placeholder", name: "Automotive" },
  { description: "Kids, baby products, toys, family, and parenting brands.", iconPlaceholder: "Kids and baby icon placeholder", name: "Kids & Baby" },
  { description: "Jewelry, luxury accessories, handmade pieces, and gifts.", iconPlaceholder: "Jewelry icon placeholder", name: "Jewelry" },
  { description: "General purpose stores and mixed-category catalogs.", iconPlaceholder: "General store icon placeholder", name: "General Store" }
].map((category) => ({
  ...category,
  slug: resellerCategorySlug(category.name)
}));

function normalizeCategoryVisibility(value: unknown): ResellerCategoryVisibility {
  const visibility = textValue(value).toLowerCase();

  if (visibility === "hidden" || visibility === "private" || visibility === "public") {
    return visibility;
  }

  return "public";
}

async function getCategoryVisibilityOverrides(userId: string | null | undefined) {
  if (!userId) {
    return new Map<string, ResellerCategoryVisibility>();
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("metadata, created_at")
        .eq("user_id", userId)
        .eq("entity_type", "reseller_categories")
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const overrides = new Map<string, ResellerCategoryVisibility>();

  ((data ?? []) as unknown as Array<{ metadata?: Record<string, unknown> }>).forEach((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {};
    const slug = resellerCategorySlug(textValue(metadata.category_slug ?? metadata.slug));

    if (!overrides.has(slug)) {
      overrides.set(slug, normalizeCategoryVisibility(metadata.visibility));
    }
  });

  return overrides;
}

function buildResellerCategories({
  dashboardItems,
  portfolioItems,
  selectedCategorySlug,
  visibilityOverrides
}: {
  dashboardItems: ResellerShowcaseItem[];
  portfolioItems: ResellerPortfolioItem[];
  selectedCategorySlug?: string | null;
  visibilityOverrides: Map<string, ResellerCategoryVisibility>;
}): ResellerCategoriesData {
  const templateItems = dashboardItems.filter(isTemplateListing);
  const listingItems = dashboardItems.filter((item) => !isTemplateListing(item));
  const categories = resellerMarketplaceCategoryDefinitions.map((category) => {
    const slug = category.slug;

    return {
      description: category.description,
      iconPlaceholder: category.iconPlaceholder,
      name: category.name,
      slug,
      usedByListingsCount: listingItems.filter((item) => resellerCategoryMatches(slug, item.category)).length,
      usedByPortfolioCount: portfolioItems.filter((item) => resellerCategoryMatches(slug, item.categoryNiche)).length,
      usedByTemplatesCount: templateItems.filter((item) => resellerCategoryMatches(slug, item.category)).length,
      visibility: visibilityOverrides.get(slug) ?? "public"
    };
  });
  const publicCategories = categories.filter((category) => category.visibility === "public");
  const selectedCategory = selectedCategorySlug
    ? publicCategories.find((category) => category.slug === resellerCategorySlug(selectedCategorySlug)) ?? null
    : null;

  return {
    categories,
    emptyState: "No reseller categories available yet. Default marketplace categories are shown as discovery metadata.",
    futureHooks: [
      "Marketplace search filters",
      "Category SEO",
      "Featured category pages",
      "Category analytics",
      "Category-based recommendations"
    ],
    publicCategories,
    selectedCategory,
    visibilityOptions: ["public", "private", "hidden"]
  };
}

export async function getResellerCategoriesData(): Promise<ResellerCategoriesData> {
  const user = await getDashboardUser();
  const [dashboard, portfolioData, visibilityOverrides] = await Promise.all([
    getResellerDashboardData(),
    getResellerPortfolioData(),
    getCategoryVisibilityOverrides(user?.id)
  ]);

  return buildResellerCategories({
    dashboardItems: dashboard.items,
    portfolioItems: portfolioData.items,
    visibilityOverrides
  });
}

export async function getResellerSearchOptimizationData(): Promise<ResellerSearchOptimizationData> {
  const [dashboard, portfolioData] = await Promise.all([
    getResellerDashboardData(),
    getResellerPortfolioData()
  ]);
  const profile = dashboard.profile;
  const rows: ResellerSearchOptimizationItem[] = [];

  if (profile) {
    rows.push(
      searchOptimizationRow({
        category: "Reseller profile",
        description: textValue(profile.bio),
        hasPreviewImage: Boolean(profile.logo_url || profile.banner_url),
        id: profile.id,
        isPublicEligible: profile.is_published,
        itemName: profile.display_name,
        itemType: "profile",
        lastUpdated: profile.updated_at,
        tags: [
          profile.display_name,
          profile.theme_id,
          profile.website_url ? "website" : "",
          profile.instagram_url ? "instagram" : "",
          profile.tiktok_url ? "tiktok" : ""
        ].filter(Boolean),
        title: profile.display_name,
        visibilityStatus: optimizationVisibilityLabel(profile.is_published)
      })
    );
  }

  dashboard.items.forEach((item) => {
    const itemType: ResellerSearchOptimizationItemType = isTemplateListing(item) ? "template" : "store";
    const tags = stringList(item.features);

    rows.push(
      searchOptimizationRow({
        category: textValue(item.category),
        description: textValue(item.description),
        hasPreviewImage: Boolean(item.thumbnail_url || stringList(item.preview_images).length),
        id: item.id,
        isPublicEligible: isPublicMarketplaceStatus(item.status),
        itemName: item.title,
        itemType,
        lastUpdated: item.updated_at,
        tags,
        title: item.title,
        visibilityStatus: optimizationVisibilityLabel(item.status)
      })
    );
  });

  portfolioData.items.forEach((item) => {
    rows.push(
      searchOptimizationRow({
        category: item.categoryNiche,
        description: item.description,
        hasPreviewImage: !item.previewImagePlaceholder.toLowerCase().includes("placeholder"),
        id: item.id,
        isPublicEligible: item.status === "published",
        itemName: item.title,
        itemType: "portfolio",
        lastUpdated: item.createdAt,
        tags: item.toolsServicesUsed,
        title: item.title,
        visibilityStatus: item.status
      })
    );
  });

  const averageScore = rows.length
    ? Math.round(rows.reduce((total, item) => total + item.optimizationScore, 0) / rows.length)
    : 0;

  return {
    emptyState: "No search optimization items yet. Create a reseller profile, listings, templates, or portfolio items to optimize discovery metadata.",
    futureHooks: [
      "Marketplace search ranking",
      "AI metadata generator",
      "Keyword suggestions",
      "Featured search placement",
      "Analytics-based optimization",
      "Paid boost integration later"
    ],
    items: rows,
    selectedItem: rows[0] ?? null,
    summary: {
      averageScore,
      hiddenWarnings: rows.filter((item) => item.missingImprovements.includes("Hidden/private visibility warning")).length,
      missingMetadataWarnings: rows.reduce((total, item) => total + item.missingImprovements.length, 0),
      optimizedItems: rows.filter((item) => item.optimizationScore >= 80).length,
      totalItems: rows.length
    }
  };
}

export async function getResellerOwnershipTransferData(
  selectedTransferId?: string | null
): Promise<ResellerOwnershipTransferData> {
  const user = await getDashboardUser();
  const dashboard = await getResellerDashboardData();
  const futureHooks = [
    "Buyer claim workflow",
    "Ownership verification",
    "Store ownership migration",
    "Workspace migration",
    "Automated delivery",
    "Transfer approval engine",
    "Dispute resolution workflow"
  ];
  const safetyNotes = [
    "No store owner ID is changed in this phase.",
    "No workspace, account, or RLS policy is transferred or modified.",
    "Buyer information remains a private placeholder and is never shown publicly.",
    "Completed transfer remains a placeholder audit state only.",
    "No wallet, payout, withdrawal, commission, fake sale, or paid delivery system is created."
  ];

  if (!user) {
    return {
      emptyState: "No ownership transfer requests yet. Future transfer requests will appear here as private audit records only.",
      futureHooks,
      safetyNotes,
      selectedTransfer: null,
      statusFoundation: resellerTransferStatuses,
      storeOptions: [],
      summary: {
        activeTransfers: 0,
        cancelledTransfers: 0,
        completedPlaceholders: 0,
        disputedTransfers: 0,
        pendingTransfers: 0
      },
      transfers: []
    };
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("id, event_type, metadata, created_at")
        .eq("user_id", user.id)
        .eq("entity_type", "reseller_ownership_transfers")
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const grouped = new Map<string, Record<string, unknown>[]>();

  ((data ?? []) as unknown as Record<string, unknown>[]).forEach((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const transferId = textValue(metadata.transfer_id, String(row.id ?? "transfer-placeholder"));
    grouped.set(transferId, [...(grouped.get(transferId) ?? []), row]);
  });

  const transfers = Array.from(grouped.values()).map(transferFromEvents);
  const selectedTransfer =
    (selectedTransferId
      ? transfers.find((transfer) => transfer.transferId === selectedTransferId)
      : transfers[0]) ?? null;
  const pendingStatuses: ResellerTransferStatus[] = ["pending_buyer", "pending_review", "approved", "ready_for_transfer"];

  return {
    emptyState: "No ownership transfer requests yet. Create a transfer request placeholder from an owned store to start the audit lifecycle.",
    futureHooks,
    safetyNotes,
    selectedTransfer,
    statusFoundation: resellerTransferStatuses,
    storeOptions: dashboard.stores,
    summary: {
      activeTransfers: transfers.filter((transfer) => !["cancelled", "completed_placeholder"].includes(transfer.transferStatus)).length,
      cancelledTransfers: transfers.filter((transfer) => transfer.transferStatus === "cancelled").length,
      completedPlaceholders: transfers.filter((transfer) => transfer.transferStatus === "completed_placeholder").length,
      disputedTransfers: transfers.filter((transfer) => transfer.transferStatus === "disputed").length,
      pendingTransfers: transfers.filter((transfer) => pendingStatuses.includes(transfer.transferStatus)).length
    },
    transfers
  };
}

export async function getResellerStoreDeliveryData(): Promise<ResellerStoreDeliveryData> {
  const user = await getDashboardUser();
  const transferData = await getResellerOwnershipTransferData();
  const futureHooks = [
    "Buyer claim link",
    "Activation token",
    "Store handoff email",
    "Ownership migration",
    "Handoff certificate/PDF",
    "Delivery dispute escalation"
  ];
  const safetyNotes = [
    "Delivery here means digital store handoff workflow, not physical delivery agents.",
    "No store owner ID, workspace, buyer account, or RLS policy is changed.",
    "Buyer information remains placeholder-only and is never exposed publicly.",
    "Delivered remains a placeholder lifecycle state until future ownership migration is approved.",
    "No wallet, payout, withdrawal, commission, fake sale, or paid delivery system is created."
  ];

  if (!user) {
    return {
      deliveries: [],
      emptyState: "No delivery records yet. Future delivery handoff workflows will appear here as private reseller audit records only.",
      futureHooks,
      safetyNotes,
      selectedDelivery: null,
      statusFoundation: resellerDeliveryStatuses,
      summary: {
        activeDeliveries: 0,
        cancelledDeliveries: 0,
        deliveredPlaceholders: 0,
        disputedDeliveries: 0,
        pendingBuyerClaims: 0,
        readyToHandoff: 0
      },
      transferOptions: []
    };
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("id, event_type, metadata, created_at")
        .eq("user_id", user.id)
        .eq("entity_type", "reseller_store_deliveries")
        .order("created_at", { ascending: false })
        .limit(120)
    : { data: [] };
  const grouped = new Map<string, Record<string, unknown>[]>();

  ((data ?? []) as unknown as Record<string, unknown>[]).forEach((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const deliveryId = textValue(metadata.delivery_id, String(row.id ?? "delivery-placeholder"));
    grouped.set(deliveryId, [...(grouped.get(deliveryId) ?? []), row]);
  });

  const deliveries = Array.from(grouped.values()).map(deliveryFromEvents);
  const activeStatuses: ResellerDeliveryStatus[] = [
    "preparing",
    "waiting_buyer_claim",
    "buyer_invited",
    "ready_to_handoff"
  ];

  return {
    deliveries,
    emptyState: "No delivery records yet. Start preparation from a prepared transfer to create a private handoff workflow.",
    futureHooks,
    safetyNotes,
    selectedDelivery: deliveries[0] ?? null,
    statusFoundation: resellerDeliveryStatuses,
    summary: {
      activeDeliveries: deliveries.filter((delivery) => activeStatuses.includes(delivery.deliveryStatus)).length,
      cancelledDeliveries: deliveries.filter((delivery) => delivery.deliveryStatus === "cancelled").length,
      deliveredPlaceholders: deliveries.filter((delivery) => delivery.deliveryStatus === "delivered_placeholder").length,
      disputedDeliveries: deliveries.filter((delivery) => delivery.deliveryStatus === "disputed").length,
      pendingBuyerClaims: deliveries.filter((delivery) => delivery.deliveryStatus === "waiting_buyer_claim" || delivery.deliveryStatus === "buyer_invited").length,
      readyToHandoff: deliveries.filter((delivery) => delivery.deliveryStatus === "ready_to_handoff").length
    },
    transferOptions: transferData.transfers
  };
}

export async function getResellerDisputesData(
  selectedDisputeId?: string | null
): Promise<ResellerDisputesData> {
  const user = await getDashboardUser();
  const [transferData, deliveryData, requestData, reviewData] = await Promise.all([
    getResellerOwnershipTransferData(),
    getResellerStoreDeliveryData(),
    getResellerBuyerRequestsData(),
    getResellerReviewsData()
  ]);
  const futureHooks = [
    "Admin mediation",
    "Dispute evidence uploads",
    "Refund workflow integration",
    "Ownership rollback review",
    "Buyer claim investigation",
    "Dispute notifications"
  ];
  const safetyNotes = [
    "Disputes are private reseller workflow records and never public.",
    "Buyer data remains masked or placeholder-only.",
    "Internal admin notes are not exposed in this reseller view.",
    "No refund, ownership reversal, payment action, account suspension, wallet, payout, withdrawal, commission, or fake sale is executed.",
    "Delivery Center, Ownership Transfer, Reviews, and Buyer Requests remain separate systems."
  ];

  if (!user) {
    return {
      categories: resellerDisputeCategories,
      disputes: [],
      emptyState: "No disputes yet. Future disagreements will appear here as private workflow records only.",
      futureHooks,
      priorityOptions: resellerDisputePriorities,
      relatedOptions: {
        deliveries: [],
        requests: [],
        reviews: [],
        transfers: []
      },
      safetyNotes,
      selectedDispute: null,
      statusFoundation: resellerDisputeStatuses,
      summary: {
        awaitingResponse: 0,
        closed: 0,
        escalated: 0,
        open: 0,
        underReview: 0
      }
    };
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("monitoring_events" as never)
        .select("id, event_type, metadata, created_at")
        .eq("user_id", user.id)
        .eq("entity_type", "reseller_disputes")
        .order("created_at", { ascending: false })
        .limit(120)
    : { data: [] };
  const grouped = new Map<string, Record<string, unknown>[]>();

  ((data ?? []) as unknown as Record<string, unknown>[]).forEach((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const disputeId = textValue(metadata.dispute_id, String(row.id ?? "dispute-placeholder"));
    grouped.set(disputeId, [...(grouped.get(disputeId) ?? []), row]);
  });

  const disputes = Array.from(grouped.values()).map(disputeFromEvents);
  const selectedDispute =
    (selectedDisputeId
      ? disputes.find((dispute) => dispute.disputeId === selectedDisputeId)
      : disputes[0]) ?? null;

  return {
    categories: resellerDisputeCategories,
    disputes,
    emptyState: "No disputes yet. Create a private dispute placeholder to track a disagreement without financial or ownership actions.",
    futureHooks,
    priorityOptions: resellerDisputePriorities,
    relatedOptions: {
      deliveries: deliveryData.deliveries,
      requests: requestData.requests,
      reviews: reviewData.latest,
      transfers: transferData.transfers
    },
    safetyNotes,
    selectedDispute,
    statusFoundation: resellerDisputeStatuses,
    summary: {
      awaitingResponse: disputes.filter((dispute) => dispute.status === "awaiting_response").length,
      closed: disputes.filter((dispute) => dispute.status === "closed" || dispute.status === "resolved_placeholder" || dispute.status === "rejected").length,
      escalated: disputes.filter((dispute) => dispute.status === "escalated").length,
      open: disputes.filter((dispute) => dispute.status === "open").length,
      underReview: disputes.filter((dispute) => dispute.status === "under_review").length
    }
  };
}

export async function getResellerComplianceData(): Promise<ResellerComplianceData> {
  const user = await getDashboardUser();
  const [dashboard, verification, disputes, reviews, deliveries, reviewEvents] = await Promise.all([
    getResellerDashboardData(),
    getResellerVerificationData(),
    getResellerDisputesData(),
    getResellerReviewsData(),
    getResellerStoreDeliveryData(),
    getComplianceReviewEvents(user?.id)
  ]);
  const templateItems = dashboard.items.filter(isTemplateListing);
  const listingItems = dashboard.items.filter((item) => !isTemplateListing(item));
  const publicItems = dashboard.items.filter((item) => isPublicMarketplaceStatus(item.status));
  const listingsWithPreview = listingItems.filter((item) => isPreviewEnabledForPublicItem(item)).length;
  const templatesWithDescriptions = templateItems.filter((item) => Boolean(textValue(item.description))).length;
  const openDisputes = disputes.summary.open + disputes.summary.underReview + disputes.summary.awaitingResponse + disputes.summary.escalated;
  const warningPlaceholders = disputes.summary.escalated + reviews.summary.rejectedReviews;
  const currentStanding: ResellerComplianceStatus =
    openDisputes > 0 || warningPlaceholders > 0
      ? "needs_attention"
      : verification.overallStatus === "pending"
        ? "under_review"
        : "good_standing";
  const checklist: ResellerComplianceChecklistItem[] = [
    {
      completed: Boolean(dashboard.profile?.is_published && textValue(dashboard.profile?.display_name)),
      description: "Publish a reseller profile with core public identity details.",
      key: "public_profile_completed",
      label: "Public profile completed"
    },
    {
      completed: verification.overallStatus !== "not_started",
      description: "Start at least one verification flow before advanced marketplace trust features.",
      key: "verification_started",
      label: "Verification started"
    },
    {
      completed: listingItems.length === 0 || listingsWithPreview >= publicItems.filter((item) => !isTemplateListing(item)).length,
      description: "Public store listings should have safe preview links or preview imagery.",
      key: "listings_have_preview",
      label: "Listings have preview"
    },
    {
      completed: templateItems.length === 0 || templatesWithDescriptions === templateItems.length,
      description: "Templates should explain what the buyer can expect before future purchase flows.",
      key: "templates_have_descriptions",
      label: "Templates have descriptions"
    },
    {
      completed: true,
      description: "Prohibited content checks are guidance-only until future automated detection is approved.",
      key: "no_prohibited_content",
      label: "No prohibited content"
    },
    {
      completed: deliveries.deliveries.some((delivery) => delivery.deliveryStatus === "ready_to_handoff"),
      description: "Prepare at least one delivery workflow before future buyer claim handoff.",
      key: "delivery_process_prepared",
      label: "Delivery process prepared"
    },
    {
      completed: reviewEvents.has("buyer_protection_rules") || reviewEvents.has("marketplace_rules"),
      description: "Review dispute and buyer protection policy guidance.",
      key: "dispute_policy_reviewed",
      label: "Dispute policy reviewed"
    }
  ];
  const sections = resellerComplianceSectionDefinitions.map((section) => {
    const review = reviewEvents.get(section.key);
    const derivedStatus: ResellerComplianceStatus =
      section.key === "account_standing"
        ? currentStanding
        : section.key === "delivery_rules" && !checklist.find((item) => item.key === "delivery_process_prepared")?.completed
          ? "needs_attention"
          : review?.status ?? "good_standing";

    return {
      ...section,
      lastReviewedAt: review?.lastReviewedAt ?? null,
      status: derivedStatus
    };
  });

  return {
    accountStanding: {
      currentStanding,
      disputesCount: disputes.disputes.length,
      reviewsStatus: `${reviews.summary.approvedReviews} approved, ${reviews.summary.pendingReviews} pending, ${reviews.summary.rejectedReviews} rejected`,
      verificationStatus: verification.overallStatus,
      warningsPlaceholder: warningPlaceholders
    },
    checklist,
    emptyState: "No compliance review activity yet. Review SHASTORE marketplace rules to build your private compliance foundation.",
    futureHooks: [
      "Admin compliance review",
      "Automatic listing checks",
      "Prohibited content detection",
      "Policy violation warnings",
      "Account restrictions",
      "Appeal workflow"
    ],
    safetyNotes: [
      "Compliance data is private to reseller/admin workflows and is not shown on public profiles.",
      "This phase does not apply real penalties or automatic account suspension.",
      "No refunds, ownership reversals, wallet, payout, withdrawal, commission, or fake sale systems are created.",
      "Future public compliance badges must be separately approved before appearing publicly."
    ],
    sections,
    statusFoundation: resellerComplianceStatuses,
    summary: {
      goodStanding: sections.filter((section) => section.status === "good_standing").length,
      needsAttention: sections.filter((section) => section.status === "needs_attention").length,
      restrictedPlaceholders: sections.filter((section) => section.status === "restricted_placeholder").length,
      underReview: sections.filter((section) => section.status === "under_review").length,
      warningPlaceholders: sections.filter((section) => section.status === "warning_placeholder").length
    }
  };
}

async function getPublicResellerCategoriesData({
  portfolioItems,
  selectedCategorySlug,
  showcaseItems,
  userId
}: {
  portfolioItems: ResellerPortfolioItem[];
  selectedCategorySlug?: string | null;
  showcaseItems: ResellerShowcaseItem[];
  userId: string | null | undefined;
}) {
  const visibilityOverrides = await getCategoryVisibilityOverrides(userId);

  return buildResellerCategories({
    dashboardItems: showcaseItems,
    portfolioItems,
    selectedCategorySlug,
    visibilityOverrides
  });
}

async function getReviewsForProfile(profileId: string | null, approvedOnly: boolean) {
  if (!profileId) {
    return { ready: true, reviews: [] as ResellerReview[] };
  }

  const supabase = await createClient();
  let query = supabase
    .from("reseller_reviews" as never)
    .select("id, profile_id, rating_score, rating, review_status, status, buyer_display_name, review_text, created_at")
    .eq("profile_id" as never, profileId as never)
    .order("created_at" as never, { ascending: false });

  if (approvedOnly) {
    query = query.eq("review_status" as never, "approved" as never);
  }

  const { data, error } = await query;

  if (error) {
    return { ready: isMissingReviewsTable(error), reviews: [] as ResellerReview[] };
  }

  return {
    ready: true,
    reviews: ((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeReview)
  };
}

export async function getResellerReviewsData(): Promise<ResellerReviewsData> {
  const dashboard = await getResellerDashboardData();
  const { ready, reviews } = await getReviewsForProfile(dashboard.profile?.id ?? null, false);
  const approved = reviews.filter((review) => review.status === "approved");
  const pending = reviews.filter((review) => review.status === "pending");
  const rejected = reviews.filter((review) => review.status === "rejected");

  return {
    approved,
    futureHooks: [
      "Buyer verified purchase review",
      "Reseller reply",
      "Review moderation",
      "Rating calculation",
      "Review abuse reporting"
    ],
    latest: reviews.slice(0, 5),
    pending,
    profile: dashboard.profile,
    ready: dashboard.ready && ready,
    rejected,
    summary: reviewSummary(reviews)
  };
}

export async function getResellerReputationData(): Promise<ResellerReputation> {
  const [dashboard, reviewsData] = await Promise.all([
    getResellerDashboardData(),
    getResellerReviewsData()
  ]);
  const items = dashboard.items.filter((item) => item.status === "published");
  const templateListings = items.filter(isTemplateListing);
  const storeListings = items.filter((item) => !isTemplateListing(item));

  return buildReputation({
    profile: dashboard.profile,
    reviewsSummary: reviewsData.summary,
    storeListings,
    templateListings
  });
}

export async function getPublicResellerProfile(
  slug: string,
  selectedCategorySlug?: string | null
): Promise<PublicResellerProfile> {
  const showcase = await getPublicResellerShowcase(slug);
  const items = showcase?.items ?? [];
  const [{ reviews }, portfolioItems] = await Promise.all([
    getReviewsForProfile(showcase?.profile.id ?? null, true),
    getPublicResellerPortfolioItems(showcase?.profile.user_id)
  ]);
  const categoriesData = await getPublicResellerCategoriesData({
    portfolioItems,
    selectedCategorySlug,
    showcaseItems: items,
    userId: showcase?.profile.user_id
  });
  const selectedCategory = categoriesData.selectedCategory;
  const visibleItems = selectedCategory
    ? items.filter((item) => resellerCategoryMatches(selectedCategory.slug, item.category))
    : items;
  const visiblePortfolioItems = selectedCategory
    ? portfolioItems.filter((item) => resellerCategoryMatches(selectedCategory.slug, item.categoryNiche))
    : portfolioItems;
  const templateListings = visibleItems.filter(isTemplateListing);
  const storeListings = visibleItems.filter((item) => !isTemplateListing(item));
  const reviewsSummary = reviewSummary(reviews);
  const reputation = buildReputation({
    profile: showcase?.profile ?? null,
    reviewsSummary,
    storeListings,
    templateListings
  });
  const verification = buildVerificationData({
    emailVerified: false,
    hasBusinessProfile: Boolean(showcase?.profile),
    profile: showcase?.profile ?? null
  });
  const visibilityOverrides = await getBadgeVisibilityOverrides(showcase?.profile.user_id);
  const badgeData = buildResellerBadges({
    dashboard: {
      items,
      profile: showcase?.profile ?? null,
      ready: true,
      stores: [],
      themeSettings: showcase?.themeSettings ?? null
    },
    reputation,
    reviews: {
      approved: reviews,
      futureHooks: [],
      latest: reviews.slice(0, 5),
      pending: [],
      profile: showcase?.profile ?? null,
      ready: true,
      rejected: [],
      summary: reviewsSummary
    },
    verification,
    visibilityOverrides
  });

  return {
    badges: badgeData.publicBadges,
    canonicalPath: `/resellers/${slug}`,
    contactLinkPlaceholder: "#reseller-contact",
    country: "Country placeholder",
    futureHooks: [
      "Public reviews",
      "Reseller levels",
      "Verified badges",
      "Featured stores",
      "Buyer contact request",
      "Public marketplace search",
      "Auto level recalculation",
      "Verified sales count",
      "Review score weighting",
      "Dispute penalty",
      "Featured reseller eligibility"
    ],
    languages: ["Language placeholder"],
    portfolioItems: visiblePortfolioItems,
    profileStatus: showcase ? "published" : "not_available",
    publicCategories: categoriesData.publicCategories,
    selectedCategory,
    publicAccountCode: `RSL-${slug.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "PUBLIC"}`,
    ratingPlaceholder: reviewsSummary.averageRating ? `${reviewsSummary.averageRating}/5` : "No reviews yet",
    reputation,
    reviews,
    reviewsSummary,
    resellerLevelPlaceholder: reputation.currentLevel,
    showcase,
    storeListings,
    templateListings,
    trustBadges: ["Verified badge placeholder", "Trust score placeholder", "Response time placeholder"],
    verification
  };
}

export function resellerMigrationMessage() {
  return "Apply supabase/migrations/reseller-showcase-foundation-safe.sql to enable reseller showcase storage. The dashboard is showing safe empty states until then.";
}
