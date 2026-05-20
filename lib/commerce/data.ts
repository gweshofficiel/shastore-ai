import { createClient } from "@/lib/supabase/server";
import type {
  CommerceAnalyticsSummary,
  CommerceCustomer,
  CommerceDomainPublication,
  CommerceOrder,
  CommerceOrderStatus,
  CommercePaymentSettings
} from "@/lib/commerce/types";

const defaultPaymentSettings: Omit<
  CommercePaymentSettings,
  "id" | "user_id" | "created_at" | "updated_at"
> = {
  stripe_enabled: false,
  paypal_enabled: false,
  cod_enabled: true,
  whatsapp_orders_enabled: true,
  stripe_account_label: null,
  paypal_account_label: null
};

type DashboardUser = {
  id: string;
  email?: string;
};

export type CommerceTableState<T> = {
  items: T;
  ready: boolean;
};

function isMissingCommerceTable(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("commerce_") ||
    message.includes("analytics_events") ||
    message.includes("analytics_sessions") ||
    message.includes("could not find the table")
  );
}

async function getDashboardUser(): Promise<DashboardUser | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user ? { id: user.id, email: user.email ?? undefined } : null;
}

export async function getCommerceOrders({
  status = "all",
  query = ""
}: {
  status?: string;
  query?: string;
} = {}): Promise<CommerceTableState<CommerceOrder[]>> {
  const supabase = await createClient();
  const user = await getDashboardUser();

  if (!user) {
    return { items: [], ready: true };
  }

  let request = supabase
    .from("commerce_orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (["new", "confirmed", "shipped", "delivered", "canceled"].includes(status)) {
    request = request.eq("status", status as CommerceOrderStatus);
  }

  const { data, error } = await request;

  if (error) {
    return { items: [], ready: !isMissingCommerceTable(error) };
  }

  const normalizedQuery = query.trim().toLowerCase();
  const orders = ((data ?? []) as CommerceOrder[]).filter((order) => {
    if (!normalizedQuery) {
      return true;
    }
    return (
      order.id.toLowerCase().includes(normalizedQuery) ||
      (order.source_slug ?? "").toLowerCase().includes(normalizedQuery) ||
      JSON.stringify(order.customer_snapshot).toLowerCase().includes(normalizedQuery)
    );
  });

  return { items: orders, ready: true };
}

export async function getCommerceCustomers(): Promise<
  CommerceTableState<
    Array<
      CommerceCustomer & {
        orderCount: number;
        lastOrderAt: string | null;
        totalSpent: number;
      }
    >
  >
> {
  const supabase = await createClient();
  const user = await getDashboardUser();

  if (!user) {
    return { items: [], ready: true };
  }

  const [{ data: customers, error }, { data: orders }] = await Promise.all([
    supabase
      .from("commerce_customers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("commerce_orders")
      .select("customer_id, total_amount, created_at")
      .eq("user_id", user.id)
  ]);

  if (error) {
    return { items: [], ready: !isMissingCommerceTable(error) };
  }

  return {
    ready: true,
    items: ((customers ?? []) as CommerceCustomer[]).map((customer) => {
      const customerOrders =
        orders?.filter((order) => order.customer_id === customer.id) ?? [];
      return {
        ...customer,
        orderCount: customerOrders.length,
        lastOrderAt: customerOrders[0]?.created_at ?? null,
        totalSpent: customerOrders.reduce(
          (total, order) => total + Number(order.total_amount ?? 0),
          0
        )
      };
    })
  };
}

export async function getCommerceCustomerDetail(customerId: string): Promise<
  CommerceTableState<{
    customer: CommerceCustomer | null;
    orders: CommerceOrder[];
  }>
> {
  const supabase = await createClient();
  const user = await getDashboardUser();

  if (!user) {
    return { items: { customer: null, orders: [] }, ready: true };
  }

  const [{ data: customer, error }, { data: orders }] = await Promise.all([
    supabase
      .from("commerce_customers")
      .select("*")
      .eq("id", customerId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("commerce_orders")
      .select("*")
      .eq("customer_id", customerId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
  ]);

  if (error) {
    return {
      items: { customer: null, orders: [] },
      ready: !isMissingCommerceTable(error)
    };
  }

  return {
    ready: true,
    items: {
      customer: (customer as CommerceCustomer | null) ?? null,
      orders: (orders ?? []) as CommerceOrder[]
    }
  };
}

export async function getCommercePaymentSettings(): Promise<
  CommerceTableState<CommercePaymentSettings | null>
> {
  const supabase = await createClient();
  const user = await getDashboardUser();

  if (!user) {
    return { items: null, ready: true };
  }

  const { data, error } = await supabase
    .from("commerce_payment_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { items: null, ready: !isMissingCommerceTable(error) };
  }

  if (data) {
    return { items: data as CommercePaymentSettings, ready: true };
  }

  return {
    ready: true,
    items: {
      id: "default",
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...defaultPaymentSettings
    }
  };
}

export async function getCommerceAnalyticsSummary(): Promise<
  CommerceTableState<CommerceAnalyticsSummary>
> {
  const orders = await getCommerceOrders();
  const supabase = await createClient();
  const user = await getDashboardUser();
  const empty: CommerceAnalyticsSummary = {
    visitors: 0,
    pageViews: 0,
    whatsappClicks: 0,
    conversions: 0,
    orders: orders.items.length,
    salesEstimate: orders.items.reduce(
      (total, order) => total + Number(order.total_amount ?? 0),
      0
    ),
    conversionRate: 0,
    topSources: [],
    topProducts: []
  };

  if (!user) {
    return { items: empty, ready: true };
  }

  const { data, error } = await supabase
    .from("analytics_events")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    const fallback = await supabase
      .from("commerce_analytics_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (fallback.error) {
      return {
        items: empty,
        ready: orders.ready && !isMissingCommerceTable(error) && !isMissingCommerceTable(fallback.error)
      };
    }

    const events = fallback.data ?? [];
    const pageViews = events.filter((event) => event.event_type === "page_view").length;
    const visitors = new Set(
      events
        .filter((event) => event.visitor_id)
        .map((event) => event.visitor_id)
    ).size;
    const whatsappClicks = events.filter(
      (event) => event.event_type === "whatsapp_click"
    ).length;
    const conversions = events.filter((event) => event.event_type === "conversion").length;
    const sourceCounts = new Map<string, CommerceAnalyticsSummary["topSources"][number]>();

    for (const event of events) {
      const slug = String(event.source_slug ?? "unknown");
      const key = `${event.source_type}:${slug}`;
      const current = sourceCounts.get(key);
      sourceCounts.set(key, {
        sourceType: event.source_type,
        sourceSlug: slug,
        label: slug,
        count: (current?.count ?? 0) + 1
      });
    }

    return {
      ready: true,
      items: {
        ...empty,
        visitors,
        pageViews,
        whatsappClicks,
        conversions,
        conversionRate: pageViews ? Math.round((orders.items.length / pageViews) * 1000) / 10 : 0,
        topSources: [...sourceCounts.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      }
    };
  }

  const events = data ?? [];
  const pageViews = events.filter((event) => event.event_type === "page_view").length;
  const visitors = new Set(
    events
      .filter((event) => event.event_type === "visitor_session" && event.visitor_id)
      .map((event) => event.visitor_id)
  ).size;
  const whatsappClicks = events.filter(
    (event) => event.event_type === "whatsapp_click"
  ).length;
  const conversions = events.filter((event) => event.event_type === "conversion").length;
  const sourceCounts = new Map<string, CommerceAnalyticsSummary["topSources"][number]>();
  const productCounts = new Map<string, number>();

  for (const event of events) {
    if (event.event_type === "product_view" && event.product_name) {
      productCounts.set(
        event.product_name,
        (productCounts.get(event.product_name) ?? 0) + 1
      );
    }

    if (event.event_type !== "page_view") {
      continue;
    }

    const slug = String(event.source_slug ?? "unknown");
    const key = `${event.source_type}:${slug}`;
    const current = sourceCounts.get(key);
    sourceCounts.set(key, {
      sourceType: event.source_type,
      sourceSlug: slug,
      label: slug,
      count: (current?.count ?? 0) + 1
    });
  }

  for (const order of orders.items) {
    if (Array.isArray(order.products)) {
      for (const product of order.products) {
        if (product && typeof product === "object" && "name" in product) {
          const name = String(product.name || "Product");
          productCounts.set(name, (productCounts.get(name) ?? 0) + 1);
        }
      }
    }
  }

  return {
    ready: true,
    items: {
      ...empty,
      visitors,
      pageViews,
      whatsappClicks,
      conversions,
      conversionRate: pageViews ? Math.round((conversions / pageViews) * 1000) / 10 : 0,
      topSources: [...sourceCounts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topProducts: [...productCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    }
  };
}

export async function getCommerceDomainFoundation(): Promise<
  CommerceTableState<{
    commerceDomains: CommerceDomainPublication[];
    landingPublications: Array<{ id: string; url: string; status: string; published_at: string | null }>;
    storePublications: Array<{
      id: string;
      url: string;
      slug: string;
      status: string;
      hostname?: string | null;
      published_at?: string | null;
    }>;
  }>
> {
  const supabase = await createClient();
  const user = await getDashboardUser();

  if (!user) {
    return {
      ready: true,
      items: { commerceDomains: [], landingPublications: [], storePublications: [] }
    };
  }

  const [{ data: landingPublications }, { data: storePublications }, { data, error }] =
    await Promise.all([
      supabase
        .from("publications")
        .select("id, url, status, published_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("published_stores")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("commerce_domain_publications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    ]);

  return {
    ready: !error || !isMissingCommerceTable(error),
    items: {
      commerceDomains: error ? [] : ((data ?? []) as CommerceDomainPublication[]),
      landingPublications: landingPublications ?? [],
      storePublications: (storePublications ?? []) as Array<{
        id: string;
        url: string;
        slug: string;
        status: string;
        hostname?: string | null;
        published_at?: string | null;
      }>
    }
  };
}

export function commerceMigrationMessage() {
  return "Apply the unified commerce and analytics migrations to enable live commerce data. The dashboard is showing safe empty foundation states until then.";
}
