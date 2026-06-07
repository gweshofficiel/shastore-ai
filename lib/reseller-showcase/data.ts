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

export type PublicResellerProfile = {
  canonicalPath: string;
  contactLinkPlaceholder: string;
  country: string;
  futureHooks: string[];
  languages: string[];
  profileStatus: "not_available" | "published";
  publicAccountCode: string;
  ratingPlaceholder: string;
  reviews: ResellerReview[];
  reviewsSummary: ResellerReviewsSummary;
  resellerLevelPlaceholder: string;
  showcase: PublicResellerShowcase | null;
  storeListings: ResellerShowcaseItem[];
  templateListings: ResellerShowcaseItem[];
  trustBadges: string[];
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

export async function getPublicResellerProfile(slug: string): Promise<PublicResellerProfile> {
  const showcase = await getPublicResellerShowcase(slug);
  const items = showcase?.items ?? [];
  const templateListings = items.filter(isTemplateListing);
  const storeListings = items.filter((item) => !isTemplateListing(item));
  const { reviews } = await getReviewsForProfile(showcase?.profile.id ?? null, true);
  const reviewsSummary = reviewSummary(reviews);

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
      "Public marketplace search"
    ],
    languages: ["Language placeholder"],
    profileStatus: showcase ? "published" : "not_available",
    publicAccountCode: `RSL-${slug.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "PUBLIC"}`,
    ratingPlaceholder: reviewsSummary.averageRating ? `${reviewsSummary.averageRating}/5` : "No reviews yet",
    reviews,
    reviewsSummary,
    resellerLevelPlaceholder: "Level placeholder",
    showcase,
    storeListings,
    templateListings,
    trustBadges: ["Verified badge placeholder", "Trust score placeholder", "Response time placeholder"]
  };
}

export function resellerMigrationMessage() {
  return "Apply supabase/migrations/reseller-showcase-foundation-safe.sql to enable reseller showcase storage. The dashboard is showing safe empty states until then.";
}
