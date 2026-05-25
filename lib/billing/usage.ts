import type { SupabaseClient } from "@supabase/supabase-js";
import { countStoresForAuthUser } from "@/lib/stores/user-stores";

export type BillingUsageMetrics = {
  aiGenerationsUsed: number;
  domainsUsed: number;
  exportsUsed: number;
  landingsUsed: number;
  ordersUsed: number;
  projectsUsed: number;
  publishedStoresUsed: number;
  storageMbUsed: number | null;
  storesUsed: number;
  teamMembersUsed: number;
  templatesUsed: number;
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
    .eq("owner_user_id", userId)
    .eq("domain_type", "custom");

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

async function countTemplates(supabase: SupabaseClient, userId: string) {
  const [stores, landings] = await Promise.all([
    supabase
      .from("stores")
      .select("template_id")
      .or(`user_id.eq.${userId},owner_user_id.eq.${userId}`),
    supabase.from("landing_pages").select("template_id").eq("user_id", userId)
  ]);

  const templateIds = new Set<string>();

  if (!stores.error) {
    for (const store of (stores.data ?? []) as Array<{ template_id?: string | null }>) {
      if (store.template_id) {
        templateIds.add(store.template_id);
      }
    }
  } else if (!isMissingOptionalMetricTable(stores.error, "stores")) {
    console.warn("[billing-usage] fallback metric used", {
      label: "templates_stores",
      message: stores.error.message,
      table: "stores"
    });
  }

  if (!landings.error) {
    for (const landing of (landings.data ?? []) as Array<{ template_id?: string | null }>) {
      if (landing.template_id) {
        templateIds.add(landing.template_id);
      }
    }
  } else if (!isMissingOptionalMetricTable(landings.error, "landing_pages")) {
    console.warn("[billing-usage] fallback metric used", {
      label: "templates_landings",
      message: landings.error.message,
      table: "landing_pages"
    });
  }

  return templateIds.size;
}

async function countExports(supabase: SupabaseClient, userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("reseller_profiles" as never)
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    if (isMissingOptionalMetricTable(profileError, "reseller_profiles")) {
      return 0;
    }

    console.warn("[billing-usage] fallback metric used", {
      label: "exports_reseller_profile",
      message: profileError.message,
      table: "reseller_profiles"
    });
    return 0;
  }

  const resellerId = (profile as { id?: string | null } | null)?.id ?? null;

  if (!resellerId) {
    return 0;
  }

  return countOptionalMetric(
    "store_delivery_documents",
    "store_delivery_documents",
    supabase
      .from("store_delivery_documents" as never)
      .select("id", { count: "exact", head: true })
      .eq("reseller_id", resellerId)
  );
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
    aiGenerationsUsed,
    projectsUsed,
    landingsUsed,
    publishedStoresUsed,
    domainsUsed,
    commerceOrdersUsed,
    storeOrdersUsed,
    trafficUsed,
    exportsUsed,
    teamMembersUsed,
    templatesUsed
  ] = await Promise.all([
    countOptionalMetric(
      "generations",
      "generations",
      supabase
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
    ),
    countOptionalMetric(
      "projects",
      "projects",
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
    ),
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
    countTraffic(supabase, userId),
    countExports(supabase, userId),
    countOptionalMetric(
      "workspace_members",
      "workspace_members",
      supabase
        .from("workspace_members" as never)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", userId)
    ),
    countTemplates(supabase, userId)
  ]);

  const usage = {
    aiGenerationsUsed,
    domainsUsed,
    exportsUsed,
    landingsUsed,
    ordersUsed: commerceOrdersUsed + storeOrdersUsed,
    projectsUsed,
    publishedStoresUsed,
    storageMbUsed: null,
    storesUsed: stores.count ?? 0,
    teamMembersUsed,
    templatesUsed,
    trafficUsed
  };

  console.info("[billing-usage] usage counts loaded", {
    ...usage,
    storageTracked: false,
    userId
  });

  return usage;
}
