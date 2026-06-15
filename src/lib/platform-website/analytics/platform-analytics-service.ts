import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformAnalyticsRange = "last_30_days" | "last_7_days" | "today";

export type PlatformAnalyticsMetric = {
  label: string;
  value: number;
};

export type PlatformAnalyticsSummary = {
  blog: {
    topCategories: PlatformAnalyticsMetric[];
    topPosts: PlatformAnalyticsMetric[];
    topTags: PlatformAnalyticsMetric[];
    totalViews: number;
  };
  cards: {
    blogViews: number;
    homepageViews: number;
    pricingViews: number;
    topLandingPage: string;
    topLocale: string;
  };
  pages: {
    topLocales: PlatformAnalyticsMetric[];
    topPages: PlatformAnalyticsMetric[];
    totalViews: number;
    uniqueVisitors: null;
    viewsByLocale: PlatformAnalyticsMetric[];
  };
  range: PlatformAnalyticsRange;
  traffic: {
    last24h: number;
    last30Days: number;
    last7Days: number;
    topReferrers: PlatformAnalyticsMetric[];
  };
};

type AnalyticsEventRow = {
  created_at?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
  event_type?: string | null;
  metadata?: unknown;
};

type TrackPlatformViewInput = {
  categorySlug?: string | null;
  contentId?: string | null;
  locale?: string | null;
  path: string;
  postSlug?: string | null;
  referrer?: string | null;
  routePath?: string | null;
  tagSlug?: string | null;
  title?: string | null;
};

const platformAnalyticsEventTypes = ["platform_page_view", "platform_blog_view"] as const;

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

function cleanReferrer(value: unknown) {
  const source = text(value, 500);

  if (!source) return null;

  try {
    const url = new URL(source);

    return url.hostname.slice(0, 120);
  } catch {
    return source.split("?")[0].slice(0, 120);
  }
}

function normalizeLocale(value: unknown) {
  const locale = text(value, 10);

  return locale === "ar" || locale === "fr" || locale === "en" ? locale : "en";
}

function startDateForRange(range: PlatformAnalyticsRange) {
  const date = new Date();

  if (range === "today") {
    date.setHours(0, 0, 0, 0);
    return date;
  }

  date.setDate(date.getDate() - (range === "last_7_days" ? 7 : 30));
  return date;
}

function increment(counts: Map<string, number>, label: string) {
  if (!label) return;
  counts.set(label, (counts.get(label) ?? 0) + 1);
}

function top(counts: Map<string, number>, limit = 5): PlatformAnalyticsMetric[] {
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function metadata(row: AnalyticsEventRow) {
  return isRecord(row.metadata) ? row.metadata : {};
}

function eventDate(row: AnalyticsEventRow) {
  const value = text(row.created_at, 80);
  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeRange(range: string | null | undefined): PlatformAnalyticsRange {
  return range === "today" || range === "last_7_days" || range === "last_30_days" ? range : "last_30_days";
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admin can view platform website analytics.");
  }
}

export async function trackPlatformPageView(input: TrackPlatformViewInput) {
  await recordMonitoringEventSafe({
    entityId: input.contentId ?? null,
    entityType: "platform_website_analytics",
    eventStatus: "success",
    eventType: "platform_page_view",
    metadata: {
      contentType: "platform_page",
      locale: normalizeLocale(input.locale),
      path: text(input.path, 240),
      referrer: cleanReferrer(input.referrer),
      routePath: text(input.routePath, 240),
      title: text(input.title, 180)
    },
    storeId: null,
    userId: null,
    workspaceId: null
  });
}

export async function trackPlatformBlogView(input: TrackPlatformViewInput) {
  await recordMonitoringEventSafe({
    entityId: input.contentId ?? null,
    entityType: "platform_website_analytics",
    eventStatus: "success",
    eventType: "platform_blog_view",
    metadata: {
      categorySlug: text(input.categorySlug, 120) || null,
      contentType: input.categorySlug ? "platform_blog_category" : input.tagSlug ? "platform_blog_tag" : input.postSlug ? "platform_blog_post" : "platform_blog_index",
      locale: normalizeLocale(input.locale),
      path: text(input.path, 240),
      postSlug: text(input.postSlug, 120) || null,
      referrer: cleanReferrer(input.referrer),
      tagSlug: text(input.tagSlug, 120) || null,
      title: text(input.title, 180)
    },
    storeId: null,
    userId: null,
    workspaceId: null
  });
}

export async function getPlatformAnalyticsSummary(rangeInput?: string | null): Promise<PlatformAnalyticsSummary> {
  await requireSuperAdmin();
  const range = normalizeRange(rangeInput);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const rangeStart = startDateForRange(range);
  const last24h = new Date();
  last24h.setHours(last24h.getHours() - 24);
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform analytics.");
  }

  const { data, error } = await admin
    .from("monitoring_events" as never)
    .select("event_type, entity_type, entity_id, metadata, created_at")
    .eq("entity_type" as never, "platform_website_analytics" as never)
    .gte("created_at" as never, thirtyDaysAgo.toISOString() as never)
    .order("created_at" as never, { ascending: false })
    .limit(10000);

  if (error) {
    throw new Error(`Platform analytics events could not be loaded: ${error.message}`);
  }

  const rawRows: unknown[] = Array.isArray(data) ? data as unknown[] : [];
  const events = rawRows
    .filter((row): row is AnalyticsEventRow => isRecord(row))
    .filter((row) => platformAnalyticsEventTypes.includes(text(row.event_type, 80) as typeof platformAnalyticsEventTypes[number]));
  const rangeEvents = events.filter((row) => {
    const date = eventDate(row);
    return date ? date >= rangeStart : false;
  });
  const pageEvents = rangeEvents.filter((row) => text(row.event_type, 80) === "platform_page_view");
  const blogEvents = rangeEvents.filter((row) => text(row.event_type, 80) === "platform_blog_view");
  const pageCounts = new Map<string, number>();
  const localeCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const postCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const row of rangeEvents) {
    const meta = metadata(row);
    increment(localeCounts, normalizeLocale(meta.locale));
    const referrer = text(meta.referrer, 120);
    if (referrer) increment(referrerCounts, referrer);
  }

  for (const row of pageEvents) {
    const meta = metadata(row);
    increment(pageCounts, text(meta.routePath, 240) || text(meta.path, 240) || "Unknown page");
  }

  for (const row of blogEvents) {
    const meta = metadata(row);
    const contentType = text(meta.contentType, 80);
    if (contentType === "platform_blog_post") increment(postCounts, text(meta.postSlug, 120) || text(meta.title, 180) || "Unknown post");
    if (contentType === "platform_blog_category") increment(categoryCounts, text(meta.categorySlug, 120) || text(meta.title, 180) || "Unknown category");
    if (contentType === "platform_blog_tag") increment(tagCounts, text(meta.tagSlug, 120) || text(meta.title, 180) || "Unknown tag");
  }

  const trafficCount = (since: Date) => events.filter((row) => {
    const date = eventDate(row);
    return date ? date >= since : false;
  }).length;
  const topPages = top(pageCounts);
  const topLocales = top(localeCounts);

  return {
    blog: {
      topCategories: top(categoryCounts),
      topPosts: top(postCounts),
      topTags: top(tagCounts),
      totalViews: blogEvents.length
    },
    cards: {
      blogViews: blogEvents.length,
      homepageViews: pageCounts.get("/") ?? 0,
      pricingViews: pageCounts.get("/pricing") ?? 0,
      topLandingPage: topPages[0]?.label ?? "No data",
      topLocale: topLocales[0]?.label ?? "No data"
    },
    pages: {
      topLocales,
      topPages,
      totalViews: pageEvents.length,
      uniqueVisitors: null,
      viewsByLocale: topLocales
    },
    range,
    traffic: {
      last24h: trafficCount(last24h),
      last30Days: events.length,
      last7Days: trafficCount(last7Days),
      topReferrers: top(referrerCounts)
    }
  };
}
