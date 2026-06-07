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

export type PublicResellerProfile = {
  canonicalPath: string;
  contactLinkPlaceholder: string;
  country: string;
  futureHooks: string[];
  languages: string[];
  profileStatus: "not_available" | "published";
  publicAccountCode: string;
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

const publicMarketplaceStatuses = ["boosted_placeholder", "featured_ready", "public", "published"];

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

export async function getPublicResellerProfile(slug: string): Promise<PublicResellerProfile> {
  const showcase = await getPublicResellerShowcase(slug);
  const items = showcase?.items ?? [];
  const templateListings = items.filter(isTemplateListing);
  const storeListings = items.filter((item) => !isTemplateListing(item));
  const { reviews } = await getReviewsForProfile(showcase?.profile.id ?? null, true);
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

  return {
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
    profileStatus: showcase ? "published" : "not_available",
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
