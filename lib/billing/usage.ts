import type { SupabaseClient } from "@supabase/supabase-js";
import { countStoresForAuthUser } from "@/lib/stores/user-stores";

export type BillingUsageMetrics = {
  domainsUsed: number;
  landingsUsed: number;
  ordersUsed: number;
  publishedStoresUsed: number;
  storageMbUsed: number | null;
  storesUsed: number;
  trafficUsed: number;
};

type CountResult = {
  count: number | null;
  error: { code?: string; message?: string } | null;
};

function isMissingOptionalMetricTable(error: CountResult["error"], table: string) {
  const message = (error?.message ?? "").toLowerCase();

  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes(table.toLowerCase()) ||
    message.includes("could not find the table")
  );
}

async function countOptionalMetric(
  label: string,
  table: string,
  query: PromiseLike<CountResult>
) {
  const { count, error } = await query;

  if (error) {
    if (isMissingOptionalMetricTable(error, table)) {
      console.info("[billing-usage] missing optional metric table", {
        label,
        table
      });
      return 0;
    }

    console.warn("[billing-usage] fallback metric used", {
      label,
      message: error.message,
      table
    });
    return 0;
  }

  return count ?? 0;
}

async function countStoreOrders(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("store_orders" as never)
    .select("id, owner_user_id, user_id")
    .or(`owner_user_id.eq.${userId},user_id.eq.${userId}`);

  if (error) {
    if (isMissingOptionalMetricTable(error, "store_orders")) {
      console.info("[billing-usage] missing optional metric table", {
        label: "store_orders",
        table: "store_orders"
      });
      return 0;
    }

    console.warn("[billing-usage] fallback metric used", {
      label: "store_orders",
      message: error.message,
      table: "store_orders"
    });
    return 0;
  }

  return new Set(
    ((data ?? []) as Array<{ id?: string | null }>).map((row) => row.id).filter(Boolean)
  ).size;
}

async function countDomains(supabase: SupabaseClient, userId: string) {
  const storeDomains = await supabase
    .from("store_domains" as never)
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", userId);

  if (!storeDomains.error) {
    return storeDomains.count ?? 0;
  }

  if (isMissingOptionalMetricTable(storeDomains.error, "store_domains")) {
    console.info("[billing-usage] missing optional metric table", {
      label: "domains",
      table: "store_domains"
    });
  } else {
    console.warn("[billing-usage] fallback metric used", {
      label: "domains",
      message: storeDomains.error.message,
      table: "store_domains"
    });
  }

  return countOptionalMetric(
    "published_store_custom_domains",
    "published_stores",
    supabase
      .from("published_stores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("custom_domain", "is", null)
  );
}

async function countTraffic(supabase: SupabaseClient, userId: string) {
  const [analyticsEvents, commerceAnalyticsEvents] = await Promise.all([
    countOptionalMetric(
      "analytics_page_views",
      "analytics_events",
      supabase
        .from("analytics_events" as never)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("event_type", "page_view")
    ),
    countOptionalMetric(
      "commerce_analytics_page_views",
      "commerce_analytics_events",
      supabase
        .from("commerce_analytics_events" as never)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("event_type", "page_view")
    )
  ]);

  return analyticsEvents + commerceAnalyticsEvents;
}

export async function getBillingUsageForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<BillingUsageMetrics> {
  const stores = await countStoresForAuthUser(supabase, userId);

  if (stores.error) {
    console.warn("[billing-usage] fallback metric used", {
      label: "stores",
      message: stores.error,
      table: "stores"
    });
  }

  const [
    landingsUsed,
    publishedStoresUsed,
    domainsUsed,
    commerceOrdersUsed,
    storeOrdersUsed,
    trafficUsed
  ] = await Promise.all([
    countOptionalMetric(
      "landing_pages",
      "landing_pages",
      supabase
        .from("landing_pages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
    ),
    countOptionalMetric(
      "published_stores",
      "published_stores",
      supabase
        .from("published_stores")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "published")
    ),
    countDomains(supabase, userId),
    countOptionalMetric(
      "commerce_orders",
      "commerce_orders",
      supabase
        .from("commerce_orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
    ),
    countStoreOrders(supabase, userId),
    countTraffic(supabase, userId)
  ]);

  const usage = {
    domainsUsed,
    landingsUsed,
    ordersUsed: commerceOrdersUsed + storeOrdersUsed,
    publishedStoresUsed,
    storageMbUsed: null,
    storesUsed: stores.count ?? 0,
    trafficUsed
  };

  console.info("[billing-usage] usage counts loaded", {
    ...usage,
    storageTracked: false,
    userId
  });

  return usage;
}
