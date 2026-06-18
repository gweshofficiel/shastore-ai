import "server-only";

import { getAccountRoleForUser, isConfiguredSuperAdminEmail } from "@/lib/account-roles";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isValidMarketplaceItemType,
  type MarketplaceItemType
} from "@/src/lib/marketplace/marketplace-item-type-runtime";
import {
  parseMarketplacePurchase,
  type MarketplacePurchaseRecord
} from "@/src/lib/marketplace/marketplace-purchase-runtime";
import { listMarketplaceItemsForPublicCatalog } from "@/src/lib/marketplace/marketplace-registry";
import { isPublicMarketplaceEligible } from "@/src/lib/marketplace/marketplace-visibility-runtime";

export type MarketplaceReviewStatus = "archived" | "draft" | "flagged" | "hidden" | "published";

export type MarketplaceReviewRecord = {
  createdAt: string | null;
  id: string;
  marketplaceItemId: string;
  marketplacePurchaseId: string;
  metadata: Record<string, unknown>;
  rating: number;
  reviewBody: string;
  reviewStatus: MarketplaceReviewStatus;
  reviewTitle: string;
  reviewerAccountId: string | null;
  updatedAt: string | null;
};

export type MarketplacePublicReview = {
  createdAt: string | null;
  id: string;
  rating: number;
  reviewBody: string;
  reviewTitle: string;
};

export type MarketplaceReviewEligibility = {
  eligible: boolean;
  fulfillmentVerified: boolean;
  itemId: string;
  itemKey: string;
  itemName: string;
  itemType: MarketplaceItemType;
  marketplaceItemId: string;
  marketplacePurchaseId: string;
  purchaseStatus: string;
  rating: number;
  reviewerAccountId: string | null;
  reviewStatus: MarketplaceReviewStatus;
  verificationIssues: string[];
};

export type MarketplaceReviewAggregate = {
  averageRating: number;
  publishedReviewCount: number;
  ratingCounts: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
};

export type MarketplaceReviewStats = {
  archivedReviews: number;
  draftReviews: number;
  flaggedReviews: number;
  hiddenReviews: number;
  publishedReviews: number;
  totalReviews: number;
};

export type CreateMarketplaceReviewInput = {
  marketplacePurchaseId: string;
  metadata?: Record<string, unknown>;
  rating: number;
  reviewBody: string;
  reviewStatus?: Extract<MarketplaceReviewStatus, "draft" | "published">;
  reviewTitle: string;
};

export const MARKETPLACE_REVIEW_STATUSES: readonly MarketplaceReviewStatus[] = [
  "draft",
  "published",
  "hidden",
  "flagged",
  "archived"
] as const;

export const MARKETPLACE_REVIEW_SUPPORTED_ITEM_TYPES: readonly MarketplaceItemType[] = [
  "template",
  "theme",
  "plugin",
  "app",
  "service"
] as const;

const purchaseSelect =
  "id, marketplace_item_id, buyer_account_id, creator_account_id, purchase_status, pricing_mode, amount, currency, payment_provider, external_payment_id, metadata, created_at, updated_at";

const reviewSelect =
  "id, marketplace_item_id, marketplace_purchase_id, reviewer_account_id, rating, review_title, review_body, review_status, metadata, created_at, updated_at";

const publicReviewSelect =
  "id, marketplace_item_id, rating, review_title, review_body, review_status, created_at";

const secretKeyPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|moderation_note|internal_note)/i;

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

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rowRecord(value: unknown) {
  const candidate = value as unknown;
  return isRecord(candidate) ? candidate : null;
}

function safeRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

export function isValidMarketplaceReviewStatus(value: unknown): value is MarketplaceReviewStatus {
  return MARKETPLACE_REVIEW_STATUSES.includes(value as MarketplaceReviewStatus);
}

export function parseMarketplaceReviewStatus(value: unknown): MarketplaceReviewStatus | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceReviewStatus(cleaned) ? cleaned : null;
}

export function isReviewSupportedMarketplaceItemType(value: unknown): value is MarketplaceItemType {
  return MARKETPLACE_REVIEW_SUPPORTED_ITEM_TYPES.includes(value as MarketplaceItemType);
}

export function isValidMarketplaceReviewRating(value: unknown) {
  const rating = parseNumber(value);
  return rating !== null && Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export function parseMarketplaceReviewRating(value: unknown) {
  const rating = parseNumber(value);

  if (rating === null || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null;
  }

  return rating;
}

export function sanitizeReviewText(value: unknown, maxLength: number) {
  return text(value, maxLength);
}

export function sanitizeReviewMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (secretKeyPattern.test(key)) continue;

    if (typeof value === "string") {
      if (/\bjavascript:/i.test(value)) continue;
      if (/<script/i.test(value)) continue;
    }

    clean[key] = value;
  }

  clean.foundation_only = true;
  clean.payout_runtime = false;
  clean.revenue_sharing_execution = false;

  return clean;
}

export function validateReviewMetadata(metadata: Record<string, unknown>) {
  const serialized = JSON.stringify(metadata);

  if (secretKeyPattern.test(serialized)) {
    throw new Error(
      "Review metadata must not contain secrets, payment data, payout credentials, or internal moderation notes."
    );
  }
}

export function parseMarketplaceReview(value: unknown): MarketplaceReviewRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const marketplaceItemId = text(row.marketplace_item_id, 120);
  const marketplacePurchaseId = text(row.marketplace_purchase_id, 120);
  const reviewStatus = parseMarketplaceReviewStatus(row.review_status);
  const rating = parseMarketplaceReviewRating(row.rating);
  const reviewTitle = sanitizeReviewText(row.review_title, 200);
  const reviewBody = sanitizeReviewText(row.review_body, 5000);

  if (!id || !marketplaceItemId || !marketplacePurchaseId || !reviewStatus || rating === null) {
    return null;
  }

  const metadata = sanitizeReviewMetadata(safeRecord(row.metadata));

  try {
    validateReviewMetadata(metadata);
  } catch {
    return null;
  }

  return {
    createdAt: text(row.created_at, 80) || null,
    id,
    marketplaceItemId,
    marketplacePurchaseId,
    metadata,
    rating,
    reviewBody,
    reviewStatus,
    reviewTitle,
    reviewerAccountId: text(row.reviewer_account_id, 120) || null,
    updatedAt: text(row.updated_at, 80) || null
  };
}

export function toMarketplacePublicReview(review: MarketplaceReviewRecord): MarketplacePublicReview | null {
  if (review.reviewStatus !== "published") {
    return null;
  }

  return {
    createdAt: review.createdAt,
    id: review.id,
    rating: review.rating,
    reviewBody: review.reviewBody,
    reviewTitle: review.reviewTitle
  };
}

export function isPublicMarketplaceReviewEligible(params: {
  itemStatus: string;
  itemVisibility: string;
  reviewStatus: MarketplaceReviewStatus;
}) {
  return (
    params.reviewStatus === "published" &&
    isPublicMarketplaceEligible({
      status: params.itemStatus as "approved",
      visibility: params.itemVisibility as "public"
    })
  );
}

export function calculateMarketplaceReviewAggregate(
  reviews: Array<Pick<MarketplaceReviewRecord, "rating" | "reviewStatus">>
): MarketplaceReviewAggregate {
  const published = reviews.filter((review) => review.reviewStatus === "published");
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const review of published) {
    if (review.rating >= 1 && review.rating <= 5) {
      ratingCounts[review.rating as 1 | 2 | 3 | 4 | 5] += 1;
    }
  }

  const publishedReviewCount = published.length;
  const averageRating =
    publishedReviewCount === 0
      ? 0
      : Math.round(
          (published.reduce((total, review) => total + review.rating, 0) / publishedReviewCount) * 100
        ) / 100;

  return {
    averageRating,
    publishedReviewCount,
    ratingCounts
  };
}

export function evaluateMarketplaceReviewEligibility(params: {
  actorIsSuperAdmin: boolean;
  existingPublishedReview: MarketplaceReviewRecord | null;
  fulfillmentVerified: boolean;
  item: {
    id: string;
    itemKey: string;
    itemType: string;
    name: string;
    status: string;
    visibility: string;
  };
  purchase: MarketplacePurchaseRecord;
  rating: number;
  reviewStatus: MarketplaceReviewStatus;
  reviewerAccountId: string | null;
}): MarketplaceReviewEligibility {
  const verificationIssues: string[] = [];

  if (params.purchase.purchaseStatus !== "paid") {
    verificationIssues.push("Marketplace purchase must be paid before creating a review.");
  }

  if (params.purchase.marketplaceItemId !== params.item.id) {
    verificationIssues.push("Marketplace purchase does not match the marketplace item.");
  }

  if (!isValidMarketplaceItemType(params.item.itemType)) {
    verificationIssues.push("Marketplace item type is invalid.");
  } else if (!isReviewSupportedMarketplaceItemType(params.item.itemType)) {
    verificationIssues.push("Marketplace item type is not supported for reviews.");
  }

  if (
    !isPublicMarketplaceEligible({
      status: params.item.status as "approved",
      visibility: params.item.visibility as "public"
    })
  ) {
    verificationIssues.push("Marketplace item must be approved and public for reviews.");
  }

  if (!isValidMarketplaceReviewRating(params.rating)) {
    verificationIssues.push("Review rating must be an integer between 1 and 5.");
  }

  if (!isValidMarketplaceReviewStatus(params.reviewStatus)) {
    verificationIssues.push("Review status is invalid.");
  }

  if (params.reviewStatus !== "draft" && params.reviewStatus !== "published") {
    verificationIssues.push("Reviews can only be created as draft or published.");
  }

  if (!params.actorIsSuperAdmin) {
    if (!params.purchase.buyerAccountId || params.reviewerAccountId !== params.purchase.buyerAccountId) {
      verificationIssues.push("Only the marketplace purchase buyer can create a review for this purchase.");
    }
  } else if (params.purchase.buyerAccountId && params.reviewerAccountId !== params.purchase.buyerAccountId) {
    verificationIssues.push("Reviewer account must match the marketplace purchase buyer.");
  }

  if (!params.fulfillmentVerified) {
    verificationIssues.push("Marketplace purchase fulfillment could not be verified for this item type.");
  }

  if (params.existingPublishedReview && params.reviewStatus === "published") {
    verificationIssues.push("A published review already exists for this marketplace purchase.");
  }

  return {
    eligible: verificationIssues.length === 0,
    fulfillmentVerified: params.fulfillmentVerified,
    itemId: params.item.id,
    itemKey: params.item.itemKey,
    itemName: params.item.name,
    itemType: params.item.itemType as MarketplaceItemType,
    marketplaceItemId: params.item.id,
    marketplacePurchaseId: params.purchase.id,
    purchaseStatus: params.purchase.purchaseStatus,
    rating: params.rating,
    reviewerAccountId: params.reviewerAccountId,
    reviewStatus: params.reviewStatus,
    verificationIssues
  };
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace review administration.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace reviews runtime.");
  }

  return admin;
}

async function resolveReviewActor() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication is required to create marketplace reviews.");
  }

  const accountRole = await getAccountRoleForUser(supabase, user.id);
  const isSuperAdmin =
    isConfiguredSuperAdminEmail(user.email) &&
    accountRole?.role === "super_admin" &&
    accountRole.status === "active";

  return { isSuperAdmin, user };
}

async function loadPurchaseById(purchaseId: string) {
  const admin = requireAdminClient();
  const cleanedId = text(purchaseId, 120);

  if (!cleanedId) {
    return null;
  }

  const { data, error } = await admin
    .from("marketplace_purchases" as never)
    .select(purchaseSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace purchase could not be loaded: ${error.message}`);
  }

  return parseMarketplacePurchase(data);
}

async function loadPublicMarketplaceItem(itemId: string) {
  const items = await listMarketplaceItemsForPublicCatalog({ itemId: text(itemId, 120), limit: 1 });
  const item = items[0];

  if (!item) {
    throw new Error("Public marketplace item was not found.");
  }

  return item;
}

async function verifyPurchaseFulfillment(params: {
  itemType: MarketplaceItemType;
  purchaseId: string;
}) {
  const admin = requireAdminClient();

  if (params.itemType === "template") {
    const { data, error } = await admin
      .from("marketplace_template_sales" as never)
      .select("id, sale_status" as never)
      .eq("marketplace_purchase_id" as never, text(params.purchaseId, 120) as never)
      .eq("sale_status" as never, "completed" as never)
      .maybeSingle();

    if (error) {
      throw new Error(`Template sale fulfillment could not be verified: ${error.message}`);
    }

    return Boolean(data);
  }

  if (params.itemType === "app" || params.itemType === "plugin") {
    const { data, error } = await admin
      .from("marketplace_app_plugin_installations" as never)
      .select("id, installation_status" as never)
      .eq("marketplace_purchase_id" as never, text(params.purchaseId, 120) as never)
      .in("installation_status" as never, ["installed", "active"] as never)
      .maybeSingle();

    if (error) {
      throw new Error(`App or plugin installation fulfillment could not be verified: ${error.message}`);
    }

    return Boolean(data);
  }

  return true;
}

async function getPublishedReviewForPurchase(purchaseId: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reviews" as never)
    .select(reviewSelect as never)
    .eq("marketplace_purchase_id" as never, text(purchaseId, 120) as never)
    .eq("review_status" as never, "published" as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Published marketplace review lookup failed: ${error.message}`);
  }

  return data ? parseMarketplaceReview(data) : null;
}

async function recordReviewAudit(params: {
  eligibility: MarketplaceReviewEligibility;
  note: string;
  review: MarketplaceReviewRecord;
  userId: string;
}) {
  const admin = requireAdminClient();

  await admin.from("monitoring_events" as never).insert({
    entity_id: params.review.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_create_review_foundation",
    metadata: {
      item_id: params.eligibility.itemId,
      item_key: params.eligibility.itemKey,
      item_name: params.eligibility.itemName,
      item_type: params.eligibility.itemType,
      marketplace_item_id: params.review.marketplaceItemId,
      marketplace_purchase_id: params.review.marketplacePurchaseId,
      note: params.note,
      rating: params.review.rating,
      review_status: params.review.reviewStatus,
      source_runtime: "marketplace_reviews_runtime",
      verification_issues: params.eligibility.verificationIssues
    },
    store_id: null,
    user_id: params.userId,
    workspace_id: null
  } as never);
}

export async function listMarketplaceReviews(params: {
  itemId?: string;
  limit?: number;
  marketplacePurchaseId?: string;
  reviewerAccountId?: string;
  reviewStatus?: MarketplaceReviewStatus | MarketplaceReviewStatus[];
} = {}): Promise<MarketplaceReviewRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 2000));
  let query = admin.from("marketplace_reviews" as never).select(reviewSelect as never);

  if (params.marketplacePurchaseId) {
    query = query.eq(
      "marketplace_purchase_id" as never,
      text(params.marketplacePurchaseId, 120) as never
    );
  }

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  if (params.reviewerAccountId) {
    query = query.eq("reviewer_account_id" as never, text(params.reviewerAccountId, 120) as never);
  }

  if (params.reviewStatus) {
    const statuses = Array.isArray(params.reviewStatus) ? params.reviewStatus : [params.reviewStatus];
    query = query.in("review_status" as never, statuses as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace reviews could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceReview(row))
    .filter((review): review is MarketplaceReviewRecord => Boolean(review));
}

export async function getMarketplaceReviewById(reviewId: string): Promise<MarketplaceReviewRecord | null> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reviews" as never)
    .select(reviewSelect as never)
    .eq("id" as never, text(reviewId, 120) as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace review could not be loaded: ${error.message}`);
  }

  return data ? parseMarketplaceReview(data) : null;
}

export async function getMarketplaceReviewStats(): Promise<MarketplaceReviewStats> {
  const reviews = await listMarketplaceReviews({ limit: 2000 });

  return reviews.reduce<MarketplaceReviewStats>(
    (stats, review) => {
      stats.totalReviews += 1;

      if (review.reviewStatus === "published") stats.publishedReviews += 1;
      if (review.reviewStatus === "draft") stats.draftReviews += 1;
      if (review.reviewStatus === "hidden") stats.hiddenReviews += 1;
      if (review.reviewStatus === "flagged") stats.flaggedReviews += 1;
      if (review.reviewStatus === "archived") stats.archivedReviews += 1;

      return stats;
    },
    {
      archivedReviews: 0,
      draftReviews: 0,
      flaggedReviews: 0,
      hiddenReviews: 0,
      publishedReviews: 0,
      totalReviews: 0
    }
  );
}

export async function inspectMarketplaceReviewEligibility(input: CreateMarketplaceReviewInput) {
  const actor = await resolveReviewActor();
  const purchase = await loadPurchaseById(input.marketplacePurchaseId);

  if (!purchase) {
    throw new Error("Marketplace purchase was not found.");
  }

  const item = await loadPublicMarketplaceItem(purchase.marketplaceItemId);
  const reviewStatus = parseMarketplaceReviewStatus(input.reviewStatus ?? "draft") ?? "draft";
  const rating = parseMarketplaceReviewRating(input.rating);

  if (rating === null) {
    throw new Error("Review rating must be an integer between 1 and 5.");
  }

  if (reviewStatus !== "draft" && reviewStatus !== "published") {
    throw new Error("Reviews can only be created as draft or published.");
  }

  const reviewerAccountId = actor.isSuperAdmin
    ? purchase.buyerAccountId ?? actor.user.id
    : actor.user.id;

  if (!actor.isSuperAdmin) {
    if (!purchase.buyerAccountId || purchase.buyerAccountId !== actor.user.id) {
      throw new Error("Only the marketplace purchase buyer can create a review for this purchase.");
    }
  }

  const fulfillmentVerified = await verifyPurchaseFulfillment({
    itemType: item.itemType,
    purchaseId: purchase.id
  });

  const existingPublishedReview =
    reviewStatus === "published" ? await getPublishedReviewForPurchase(purchase.id) : null;

  return evaluateMarketplaceReviewEligibility({
    actorIsSuperAdmin: actor.isSuperAdmin,
    existingPublishedReview,
    fulfillmentVerified,
    item: {
      id: item.id,
      itemKey: item.itemKey,
      itemType: item.itemType,
      name: item.name,
      status: item.status,
      visibility: item.visibility
    },
    purchase,
    rating,
    reviewStatus,
    reviewerAccountId
  });
}

export async function createMarketplaceReviewFromPurchase(input: CreateMarketplaceReviewInput) {
  const actor = await resolveReviewActor();
  const eligibility = await inspectMarketplaceReviewEligibility(input);

  if (!eligibility.eligible) {
    throw new Error(eligibility.verificationIssues[0] ?? "Marketplace review eligibility failed.");
  }

  const reviewTitle = sanitizeReviewText(input.reviewTitle, 200);
  const reviewBody = sanitizeReviewText(input.reviewBody, 5000);

  if (!reviewTitle) {
    throw new Error("Review title is required.");
  }

  if (!reviewBody) {
    throw new Error("Review body is required.");
  }

  const metadata = sanitizeReviewMetadata({
    foundation_only: true,
    item_key: eligibility.itemKey,
    item_name: eligibility.itemName,
    item_type: eligibility.itemType,
    payout_runtime: false,
    purchase_status: eligibility.purchaseStatus,
    revenue_sharing_execution: false,
    source_runtime: "marketplace_reviews_runtime",
    ...safeRecord(input.metadata)
  });

  validateReviewMetadata(metadata);

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reviews" as never)
    .insert({
      marketplace_item_id: eligibility.marketplaceItemId,
      marketplace_purchase_id: eligibility.marketplacePurchaseId,
      metadata,
      rating: eligibility.rating,
      review_body: reviewBody,
      review_status: eligibility.reviewStatus,
      review_title: reviewTitle,
      reviewer_account_id: eligibility.reviewerAccountId
    } as never)
    .select(reviewSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace review could not be created: ${error.message}`);
  }

  const review = parseMarketplaceReview(data);

  if (!review) {
    throw new Error("Created marketplace review record is invalid.");
  }

  await recordReviewAudit({
    eligibility,
    note: "Marketplace review foundation. No payouts or revenue sharing execution.",
    review,
    userId: actor.user.id
  });

  return review;
}

export async function listMarketplacePublicReviews(params: {
  itemId: string;
  limit?: number;
}): Promise<MarketplacePublicReview[]> {
  const item = await loadPublicMarketplaceItem(params.itemId);
  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));

  const { data, error } = await admin
    .from("marketplace_reviews" as never)
    .select(publicReviewSelect as never)
    .eq("marketplace_item_id" as never, item.id as never)
    .eq("review_status" as never, "published" as never)
    .order("created_at" as never, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Public marketplace reviews could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceReview(row))
    .filter((review): review is MarketplaceReviewRecord => Boolean(review))
    .filter((review) =>
      isPublicMarketplaceReviewEligible({
        itemStatus: item.status,
        itemVisibility: item.visibility,
        reviewStatus: review.reviewStatus
      })
    )
    .map((review) => toMarketplacePublicReview(review))
    .filter((review): review is MarketplacePublicReview => Boolean(review));
}

export async function getMarketplacePublicReviewAggregate(
  itemId: string
): Promise<MarketplaceReviewAggregate> {
  const item = await loadPublicMarketplaceItem(itemId);
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reviews" as never)
    .select("rating, review_status" as never)
    .eq("marketplace_item_id" as never, item.id as never)
    .eq("review_status" as never, "published" as never);

  if (error) {
    throw new Error(`Marketplace review aggregate could not be loaded: ${error.message}`);
  }

  const reviews = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => {
      const record = rowRecord(row);
      const rating = parseMarketplaceReviewRating(record?.rating);
      const reviewStatus = parseMarketplaceReviewStatus(record?.review_status);

      if (rating === null || !reviewStatus) {
        return null;
      }

      return { rating, reviewStatus };
    })
    .filter((review): review is { rating: number; reviewStatus: MarketplaceReviewStatus } => Boolean(review))
    .filter((review) =>
      isPublicMarketplaceReviewEligible({
        itemStatus: item.status,
        itemVisibility: item.visibility,
        reviewStatus: review.reviewStatus
      })
    );

  return calculateMarketplaceReviewAggregate(reviews);
}

export async function publishMarketplaceReviewFoundation(reviewId: string) {
  const access = await requireSuperAdmin();
  const review = await getMarketplaceReviewById(reviewId);

  if (!review) {
    throw new Error("Marketplace review was not found.");
  }

  if (review.reviewStatus === "published") {
    return review;
  }

  if (review.reviewStatus !== "draft") {
    throw new Error("Only draft reviews can be published in foundation runtime.");
  }

  const existingPublished = await getPublishedReviewForPurchase(review.marketplacePurchaseId);

  if (existingPublished && existingPublished.id !== review.id) {
    throw new Error("A published review already exists for this marketplace purchase.");
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reviews" as never)
    .update({ review_status: "published" } as never)
    .eq("id" as never, review.id as never)
    .select(reviewSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace review could not be published: ${error.message}`);
  }

  const updated = parseMarketplaceReview(data);

  if (!updated) {
    throw new Error("Published marketplace review record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_publish_review_foundation",
    metadata: {
      marketplace_item_id: updated.marketplaceItemId,
      marketplace_purchase_id: updated.marketplacePurchaseId,
      note: "Super Admin marketplace review publish foundation.",
      review_status: updated.reviewStatus,
      source_runtime: "marketplace_reviews_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}

export async function hideMarketplaceReviewFoundation(reviewId: string) {
  const access = await requireSuperAdmin();
  const review = await getMarketplaceReviewById(reviewId);

  if (!review) {
    throw new Error("Marketplace review was not found.");
  }

  if (review.reviewStatus === "hidden") {
    return review;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reviews" as never)
    .update({ review_status: "hidden" } as never)
    .eq("id" as never, review.id as never)
    .select(reviewSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace review could not be hidden: ${error.message}`);
  }

  const updated = parseMarketplaceReview(data);

  if (!updated) {
    throw new Error("Hidden marketplace review record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_hide_review_foundation",
    metadata: {
      marketplace_item_id: updated.marketplaceItemId,
      note: "Super Admin marketplace review hide foundation.",
      review_status: updated.reviewStatus,
      source_runtime: "marketplace_reviews_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}

export async function flagMarketplaceReviewFoundation(reviewId: string) {
  const access = await requireSuperAdmin();
  const review = await getMarketplaceReviewById(reviewId);

  if (!review) {
    throw new Error("Marketplace review was not found.");
  }

  if (review.reviewStatus === "flagged") {
    return review;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reviews" as never)
    .update({ review_status: "flagged" } as never)
    .eq("id" as never, review.id as never)
    .select(reviewSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace review could not be flagged: ${error.message}`);
  }

  const updated = parseMarketplaceReview(data);

  if (!updated) {
    throw new Error("Flagged marketplace review record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_flag_review_foundation",
    metadata: {
      marketplace_item_id: updated.marketplaceItemId,
      note: "Super Admin marketplace review flag foundation.",
      review_status: updated.reviewStatus,
      source_runtime: "marketplace_reviews_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}

export async function archiveMarketplaceReviewFoundation(reviewId: string) {
  const access = await requireSuperAdmin();
  const review = await getMarketplaceReviewById(reviewId);

  if (!review) {
    throw new Error("Marketplace review was not found.");
  }

  if (review.reviewStatus === "archived") {
    return review;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reviews" as never)
    .update({ review_status: "archived" } as never)
    .eq("id" as never, review.id as never)
    .select(reviewSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace review could not be archived: ${error.message}`);
  }

  const updated = parseMarketplaceReview(data);

  if (!updated) {
    throw new Error("Archived marketplace review record is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: updated.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_archive_review_foundation",
    metadata: {
      marketplace_item_id: updated.marketplaceItemId,
      note: "Super Admin marketplace review archive foundation.",
      review_status: updated.reviewStatus,
      source_runtime: "marketplace_reviews_runtime"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return updated;
}
