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
      .eq("status", "published")
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
