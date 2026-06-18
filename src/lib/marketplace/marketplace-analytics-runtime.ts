import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketplaceAnalyticsEventType =
  | "click"
  | "install_completed"
  | "install_started"
  | "purchase_completed"
  | "purchase_started"
  | "rating_created"
  | "review_created"
  | "view";

export type MarketplaceAnalyticsEventRecord = {
  accountId: string | null;
  createdAt: string | null;
  creatorAccountId: string | null;
  eventSource: string;
  eventType: MarketplaceAnalyticsEventType;
  id: string;
  marketplaceItemId: string | null;
  metadata: Record<string, unknown>;
  storeId: string | null;
};

export type MarketplaceAnalyticsEventCounts = {
  clicks: number;
  installCompleted: number;
  installStarted: number;
  purchaseCompleted: number;
  purchaseStarted: number;
  ratingCreated: number;
  reviewCreated: number;
  totalEvents: number;
  views: number;
};

export type MarketplaceAnalyticsFoundationCounts = {
  activeInstallations: number;
  completedTemplateSales: number;
  creatorAccounts: number;
  lockedRevenueShares: number;
  marketplaceItems: number;
  paidPurchases: number;
  payoutRequests: number;
  processedRevenueEvents: number;
  publishedReviews: number;
  purchases: number;
};

export type MarketplaceAnalyticsPayoutStateCounts = {
  approved: number;
  cancelled: number;
  draft: number;
  failed: number;
  paid: number;
  pendingReview: number;
  processing: number;
  rejected: number;
  total: number;
};

export type MarketplaceAnalyticsRatingsSummary = {
  averageRating: number;
  publishedReviewCount: number;
};

export type MarketplaceAnalyticsSummary = {
  available: boolean;
  eventCounts: MarketplaceAnalyticsEventCounts;
  foundationCounts: MarketplaceAnalyticsFoundationCounts;
  loadedAt: string | null;
  payoutStateCounts: MarketplaceAnalyticsPayoutStateCounts;
  ratingsSummary: MarketplaceAnalyticsRatingsSummary;
  sourceRuntime: string;
  warning: string | null;
};

export type RecordMarketplaceAnalyticsEventInput = {
  accountId?: string | null;
  creatorAccountId?: string | null;
  eventSource?: string;
  eventType: MarketplaceAnalyticsEventType;
  marketplaceItemId?: string | null;
  metadata?: Record<string, unknown>;
  storeId?: string | null;
};

export const MARKETPLACE_ANALYTICS_EVENT_TYPES: readonly MarketplaceAnalyticsEventType[] = [
  "view",
  "click",
  "purchase_started",
  "purchase_completed",
  "install_started",
  "install_completed",
  "review_created",
  "rating_created"
] as const;

export const MARKETPLACE_ANALYTICS_EVENT_SOURCES: readonly string[] = [
  "marketplace_analytics_runtime",
  "marketplace_app_plugin_installation_runtime",
  "marketplace_install_runtime",
  "marketplace_public_catalog_runtime",
  "marketplace_public_item_detail_runtime",
  "marketplace_purchase_runtime",
  "marketplace_reviews_runtime",
  "marketplace_template_sales_runtime"
] as const;

const analyticsEventSelect =
  "id, marketplace_item_id, creator_account_id, event_type, event_source, account_id, store_id, metadata, created_at";

const itemExistsSelect = "id, creator_account_id, status, visibility";

const secretKeyPattern =
  /(api[_-]?key|secret|token|password|credential|iban|payout|bank_account|card_number|cvv|cvc|private[_-]?key)/i;

const eventSourcePattern = /^[a-z0-9][a-z0-9_:-]{0,119}$/;

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

export function isValidMarketplaceAnalyticsEventType(
  value: unknown
): value is MarketplaceAnalyticsEventType {
  return MARKETPLACE_ANALYTICS_EVENT_TYPES.includes(value as MarketplaceAnalyticsEventType);
}

export function parseMarketplaceAnalyticsEventType(
  value: unknown
): MarketplaceAnalyticsEventType | null {
  const cleaned = text(value, 40);
  return isValidMarketplaceAnalyticsEventType(cleaned) ? cleaned : null;
}

export function isValidMarketplaceAnalyticsEventSource(value: unknown) {
  const cleaned = text(value, 120);
  return Boolean(cleaned && eventSourcePattern.test(cleaned));
}

export function sanitizeAnalyticsMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (secretKeyPattern.test(key)) continue;

    if (typeof value === "string" && /\bjavascript:/i.test(value)) continue;

    clean[key] = value;
  }

  clean.foundation_only = true;
  clean.subscription_billing = false;

  return clean;
}

export function validateAnalyticsMetadata(metadata: Record<string, unknown>) {
  const serialized = JSON.stringify(metadata);

  if (secretKeyPattern.test(serialized)) {
    throw new Error(
      "Analytics metadata must not contain secrets, payment data, payout credentials, or private keys."
    );
  }
}

export function parseMarketplaceAnalyticsEvent(value: unknown): MarketplaceAnalyticsEventRecord | null {
  const row = rowRecord(value);
  if (!row) return null;

  const id = text(row.id, 120);
  const eventType = parseMarketplaceAnalyticsEventType(row.event_type);
  const eventSource = text(row.event_source, 120);

  if (!id || !eventType || !isValidMarketplaceAnalyticsEventSource(eventSource)) {
    return null;
  }

  const metadata = sanitizeAnalyticsMetadata(safeRecord(row.metadata));

  try {
    validateAnalyticsMetadata(metadata);
  } catch {
    return null;
  }

  return {
    accountId: text(row.account_id, 120) || null,
    createdAt: text(row.created_at, 80) || null,
    creatorAccountId: text(row.creator_account_id, 120) || null,
    eventSource,
    eventType,
    id,
    marketplaceItemId: text(row.marketplace_item_id, 120) || null,
    metadata,
    storeId: text(row.store_id, 120) || null
  };
}

export function createEmptyMarketplaceAnalyticsEventCounts(): MarketplaceAnalyticsEventCounts {
  return {
    clicks: 0,
    installCompleted: 0,
    installStarted: 0,
    purchaseCompleted: 0,
    purchaseStarted: 0,
    ratingCreated: 0,
    reviewCreated: 0,
    totalEvents: 0,
    views: 0
  };
}

export function createEmptyMarketplaceAnalyticsFoundationCounts(): MarketplaceAnalyticsFoundationCounts {
  return {
    activeInstallations: 0,
    completedTemplateSales: 0,
    creatorAccounts: 0,
    lockedRevenueShares: 0,
    marketplaceItems: 0,
    paidPurchases: 0,
    payoutRequests: 0,
    processedRevenueEvents: 0,
    publishedReviews: 0,
    purchases: 0
  };
}

export function createEmptyMarketplaceAnalyticsPayoutStateCounts(): MarketplaceAnalyticsPayoutStateCounts {
  return {
    approved: 0,
    cancelled: 0,
    draft: 0,
    failed: 0,
    paid: 0,
    pendingReview: 0,
    processing: 0,
    rejected: 0,
    total: 0
  };
}

export function createEmptyMarketplaceAnalyticsRatingsSummary(): MarketplaceAnalyticsRatingsSummary {
  return {
    averageRating: 0,
    publishedReviewCount: 0
  };
}

export function createEmptyMarketplaceAnalyticsSummary(params?: {
  warning?: string | null;
}): MarketplaceAnalyticsSummary {
  return {
    available: false,
    eventCounts: createEmptyMarketplaceAnalyticsEventCounts(),
    foundationCounts: createEmptyMarketplaceAnalyticsFoundationCounts(),
    loadedAt: null,
    payoutStateCounts: createEmptyMarketplaceAnalyticsPayoutStateCounts(),
    ratingsSummary: createEmptyMarketplaceAnalyticsRatingsSummary(),
    sourceRuntime: "marketplace_analytics_runtime",
    warning: params?.warning ?? null
  };
}

export function aggregateMarketplaceAnalyticsEventCounts(
  events: Array<Pick<MarketplaceAnalyticsEventRecord, "eventType">>
): MarketplaceAnalyticsEventCounts {
  return events.reduce<MarketplaceAnalyticsEventCounts>(
    (counts, event) => {
      counts.totalEvents += 1;

      if (event.eventType === "view") counts.views += 1;
      if (event.eventType === "click") counts.clicks += 1;
      if (event.eventType === "purchase_started") counts.purchaseStarted += 1;
      if (event.eventType === "purchase_completed") counts.purchaseCompleted += 1;
      if (event.eventType === "install_started") counts.installStarted += 1;
      if (event.eventType === "install_completed") counts.installCompleted += 1;
      if (event.eventType === "review_created") counts.reviewCreated += 1;
      if (event.eventType === "rating_created") counts.ratingCreated += 1;

      return counts;
    },
    createEmptyMarketplaceAnalyticsEventCounts()
  );
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can access marketplace analytics administration.");
  }

  return access;
}

function requireAdminClient() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for marketplace analytics runtime.");
  }

  return admin;
}

async function countRows(table: string, filters?: Array<{ column: string; value: string }>) {
  const admin = requireAdminClient();
  let query = admin.from(table as never).select("id" as never, { count: "exact", head: true });

  for (const filter of filters ?? []) {
    query = query.eq(filter.column as never, filter.value as never);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Marketplace analytics count failed for ${table}: ${error.message}`);
  }

  return Math.max(0, count ?? 0);
}

async function loadMarketplaceItemForAnalytics(itemId: string) {
  const admin = requireAdminClient();
  const cleanedId = text(itemId, 120);

  if (!cleanedId) {
    return null;
  }

  const { data, error } = await admin
    .from("marketplace_items" as never)
    .select(itemExistsSelect as never)
    .eq("id" as never, cleanedId as never)
    .maybeSingle();

  if (error) {
    throw new Error(`Marketplace item could not be validated for analytics: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = rowRecord(data);

  return {
    creatorAccountId: text(row?.creator_account_id, 120) || null,
    id: text(row?.id, 120) || cleanedId,
    status: text(row?.status, 40),
    visibility: text(row?.visibility, 40)
  };
}

async function loadRecentAnalyticsEvents(params: {
  itemId?: string;
  limit?: number;
}) {
  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 500, 2000));
  let query = admin.from("marketplace_analytics_events" as never).select(analyticsEventSelect as never);

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace analytics events could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceAnalyticsEvent(row))
    .filter((event): event is MarketplaceAnalyticsEventRecord => Boolean(event));
}

async function loadRatingsSummary() {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_reviews" as never)
    .select("rating, review_status" as never)
    .eq("review_status" as never, "published" as never)
    .limit(2000);

  if (error) {
    throw new Error(`Marketplace ratings summary could not be loaded: ${error.message}`);
  }

  const ratings = (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseNumber(rowRecord(row)?.rating))
    .filter((rating): rating is number => rating !== null && rating >= 1 && rating <= 5);

  if (ratings.length === 0) {
    return createEmptyMarketplaceAnalyticsRatingsSummary();
  }

  const averageRating =
    Math.round((ratings.reduce((total, rating) => total + rating, 0) / ratings.length) * 100) / 100;

  return {
    averageRating,
    publishedReviewCount: ratings.length
  };
}

async function loadPayoutStateCounts() {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_payout_requests" as never)
    .select("payout_status" as never)
    .limit(2000);

  if (error) {
    throw new Error(`Marketplace payout state counts could not be loaded: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : []).reduce<MarketplaceAnalyticsPayoutStateCounts>(
    (counts, row) => {
      const status = text(rowRecord(row)?.payout_status, 40);
      counts.total += 1;

      if (status === "draft") counts.draft += 1;
      if (status === "pending_review") counts.pendingReview += 1;
      if (status === "approved") counts.approved += 1;
      if (status === "rejected") counts.rejected += 1;
      if (status === "processing") counts.processing += 1;
      if (status === "paid") counts.paid += 1;
      if (status === "cancelled") counts.cancelled += 1;
      if (status === "failed") counts.failed += 1;

      return counts;
    },
    createEmptyMarketplaceAnalyticsPayoutStateCounts()
  );
}

async function buildMarketplaceAnalyticsReadModel(params?: {
  itemId?: string;
  limit?: number;
}): Promise<MarketplaceAnalyticsSummary> {
  const [events, foundationCounts, payoutStateCounts, ratingsSummary] = await Promise.all([
    loadRecentAnalyticsEvents({ itemId: params?.itemId, limit: params?.limit ?? 500 }),
    buildFoundationCounts(),
    loadPayoutStateCounts(),
    loadRatingsSummary()
  ]);

  return {
    available: true,
    eventCounts: aggregateMarketplaceAnalyticsEventCounts(events),
    foundationCounts,
    loadedAt: new Date().toISOString(),
    payoutStateCounts,
    ratingsSummary,
    sourceRuntime: "marketplace_analytics_runtime",
    warning: null
  };
}

async function buildFoundationCounts(): Promise<MarketplaceAnalyticsFoundationCounts> {
  const [
    marketplaceItems,
    creatorAccounts,
    purchases,
    paidPurchases,
    completedTemplateSales,
    activeInstallations,
    publishedReviews,
    processedRevenueEvents,
    lockedRevenueShares,
    payoutRequests
  ] = await Promise.all([
    countRows("marketplace_items"),
    countRows("marketplace_creator_accounts"),
    countRows("marketplace_purchases"),
    countRows("marketplace_purchases", [{ column: "purchase_status", value: "paid" }]),
    countRows("marketplace_template_sales", [{ column: "sale_status", value: "completed" }]),
    countRows("marketplace_app_plugin_installations", [{ column: "installation_status", value: "active" }]),
    countRows("marketplace_reviews", [{ column: "review_status", value: "published" }]),
    countRows("marketplace_revenue_events", [{ column: "revenue_status", value: "processed" }]),
    countRows("marketplace_revenue_shares", [{ column: "share_status", value: "locked" }]),
    countRows("marketplace_payout_requests")
  ]);

  return {
    activeInstallations,
    completedTemplateSales,
    creatorAccounts,
    lockedRevenueShares,
    marketplaceItems,
    paidPurchases,
    payoutRequests,
    processedRevenueEvents,
    publishedReviews,
    purchases
  };
}

export async function loadMarketplaceAnalyticsReadModelSafe(params?: {
  itemId?: string;
  limit?: number;
}): Promise<MarketplaceAnalyticsSummary> {
  try {
    return await buildMarketplaceAnalyticsReadModel(params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[marketplace-analytics-runtime] read model load failed", error);

    return createEmptyMarketplaceAnalyticsSummary({
      warning: message
    });
  }
}

export async function getMarketplaceAnalyticsReadModel(params?: {
  itemId?: string;
  limit?: number;
}): Promise<MarketplaceAnalyticsSummary> {
  await requireSuperAdmin();
  return buildMarketplaceAnalyticsReadModel(params);
}

export async function getMarketplaceItemAnalyticsSummary(itemId: string) {
  await requireSuperAdmin();
  return buildMarketplaceAnalyticsReadModel({ itemId, limit: 500 });
}

export async function listMarketplaceAnalyticsEvents(params: {
  eventType?: MarketplaceAnalyticsEventType | MarketplaceAnalyticsEventType[];
  itemId?: string;
  limit?: number;
} = {}): Promise<MarketplaceAnalyticsEventRecord[]> {
  await requireSuperAdmin();

  const admin = requireAdminClient();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 2000));
  let query = admin.from("marketplace_analytics_events" as never).select(analyticsEventSelect as never);

  if (params.itemId) {
    query = query.eq("marketplace_item_id" as never, text(params.itemId, 120) as never);
  }

  if (params.eventType) {
    const types = Array.isArray(params.eventType) ? params.eventType : [params.eventType];
    query = query.in("event_type" as never, types as never);
  }

  const { data, error } = await query.order("created_at" as never, { ascending: false }).limit(limit);

  if (error) {
    throw new Error(`Marketplace analytics events could not be listed: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as unknown[]) : [])
    .map((row) => parseMarketplaceAnalyticsEvent(row))
    .filter((event): event is MarketplaceAnalyticsEventRecord => Boolean(event));
}

export async function recordMarketplaceAnalyticsEvent(input: RecordMarketplaceAnalyticsEventInput) {
  const access = await requireSuperAdmin();
  const eventType = parseMarketplaceAnalyticsEventType(input.eventType);

  if (!eventType) {
    throw new Error("Marketplace analytics event_type is invalid.");
  }

  const eventSource = text(input.eventSource, 120) || "marketplace_analytics_runtime";

  if (!isValidMarketplaceAnalyticsEventSource(eventSource)) {
    throw new Error("Marketplace analytics event_source is invalid.");
  }

  const marketplaceItemId = text(input.marketplaceItemId, 120) || null;
  let creatorAccountId = text(input.creatorAccountId, 120) || null;

  if (marketplaceItemId) {
    const item = await loadMarketplaceItemForAnalytics(marketplaceItemId);

    if (!item) {
      throw new Error("Marketplace item was not found for analytics tracking.");
    }

    if (!creatorAccountId && item.creatorAccountId) {
      creatorAccountId = item.creatorAccountId;
    }
  }

  const metadata = sanitizeAnalyticsMetadata({
    event_source: eventSource,
    event_type: eventType,
    foundation_only: true,
    source_runtime: "marketplace_analytics_runtime",
    subscription_billing: false,
    ...safeRecord(input.metadata)
  });

  validateAnalyticsMetadata(metadata);

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("marketplace_analytics_events" as never)
    .insert({
      account_id: text(input.accountId, 120) || null,
      creator_account_id: creatorAccountId,
      event_source: eventSource,
      event_type: eventType,
      marketplace_item_id: marketplaceItemId,
      metadata,
      store_id: text(input.storeId, 120) || null
    } as never)
    .select(analyticsEventSelect as never)
    .single();

  if (error) {
    throw new Error(`Marketplace analytics event could not be recorded: ${error.message}`);
  }

  const event = parseMarketplaceAnalyticsEvent(data);

  if (!event) {
    throw new Error("Recorded marketplace analytics event is invalid.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: event.id,
    entity_type: "admin_marketplace_management",
    event_status: "info",
    event_type: "admin_marketplace_record_analytics_event",
    metadata: {
      analytics_event_id: event.id,
      event_source: event.eventSource,
      event_type: event.eventType,
      marketplace_item_id: event.marketplaceItemId,
      note: "Super Admin marketplace analytics event foundation. Read models only. No subscription billing.",
      source_runtime: "marketplace_analytics_runtime"
    },
    store_id: event.storeId,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  return event;
}

export async function getMarketplaceAnalyticsEventStats(params: {
  itemId?: string;
  limit?: number;
} = {}) {
  await requireSuperAdmin();
  const events = await listMarketplaceAnalyticsEvents({
    itemId: params.itemId,
    limit: params.limit ?? 1000
  });

  return aggregateMarketplaceAnalyticsEventCounts(events);
}
