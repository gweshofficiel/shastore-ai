import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBillingPlan } from "@/lib/billing/plans";
import { getAdminAccess } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AnyRecord = Record<string, unknown>;

type AdminUser = {
  id: string;
  email: string;
  plan: string;
  status: string;
  createdAt: string | null;
  storesCount: number;
  landingsCount: number;
  ordersCount: number;
};

type AdminStore = {
  id: string;
  ownerEmail: string;
  name: string;
  status: string;
  template: string;
  publishedUrl: string | null;
  createdAt: string;
  ordersCount: number;
  viewsCount: number;
};

type AdminLanding = {
  id: string;
  ownerEmail: string;
  title: string;
  status: string;
  template: string;
  publishedUrl: string | null;
  createdAt: string;
  ordersCount: number;
  viewsCount: number;
};

type AdminOrder = {
  id: string;
  ownerEmail: string;
  sourceType: string;
  customer: string;
  paymentMethod: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
};

type AdminCustomer = {
  id: string;
  ownerEmail: string;
  name: string;
  phone: string | null;
  email: string | null;
  totalSpent: number;
  ordersCount: number;
};

type AdminSubscription = {
  userId: string;
  email: string;
  plan: string;
  planId: string;
  status: string;
  landingsUsed: number;
  landingLimit: string;
  storesUsed: number;
  storeLimit: string;
  domainsUsed: number;
  domainLimit: string;
  publishedStoresUsed: number;
  ordersUsed: number;
};

type AdminAnalytics = {
  visitors: number;
  orders: number;
  conversions: number;
  conversionRate: number;
  revenueEstimate: number;
  whatsappClicks: number;
  topStores: Array<{ label: string; count: number }>;
  topLandings: Array<{ label: string; count: number }>;
  topProducts: Array<{ label: string; count: number }>;
};

async function getAdminClient(): Promise<{
  supabase: SupabaseClient<Database>;
  serviceRoleConfigured: boolean;
}> {
  await getAdminAccess();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey) {
    return {
      serviceRoleConfigured: true,
      supabase: createServiceClient<Database>(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    };
  }

  return {
    serviceRoleConfigured: false,
    supabase: await createClient()
  };
}

function asRecords(data: unknown): AnyRecord[] {
  return Array.isArray(data) ? (data as AnyRecord[]) : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countBy(records: AnyRecord[], key: string) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const value = text(record[key]);
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

function sumBy(records: AnyRecord[], key: string) {
  return records.reduce((total, record) => total + numberValue(record[key]), 0);
}

function emailMap(users: Array<{ id: string; email: string }>) {
  return new Map(users.map((user) => [user.id, user.email]));
}

async function safeSelect(
  supabase: SupabaseClient<Database>,
  table: string,
  columns = "*",
  limit = 1000
) {
  const { data } = await supabase
    .from(table as never)
    .select(columns)
    .limit(limit);
  return asRecords(data);
}

async function safeCount(supabase: SupabaseClient<Database>, table: string) {
  const { count } = await supabase
    .from(table as never)
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function getAdminUsersBase() {
  const { supabase, serviceRoleConfigured } = await getAdminClient();
  let users: Array<{ id: string; email: string; createdAt: string | null }> = [];

  if (serviceRoleConfigured) {
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    users =
      data.users?.map((user) => ({
        createdAt: user.created_at ?? null,
        email: user.email ?? "No email",
        id: user.id
      })) ?? [];
  }

  if (!users.length) {
    const profiles = await safeSelect(supabase, "profiles", "id, email, created_at");
    users = profiles.map((profile) => ({
      createdAt: text(profile.created_at, "") || null,
      email: text(profile.email, "No email"),
      id: text(profile.id)
    }));
  }

  return { serviceRoleConfigured, supabase, users };
}

export async function getAdminOverview() {
  const { supabase } = await getAdminClient();
  const [users, stores, landings, orders, customers, analytics] = await Promise.all([
    safeCount(supabase, "profiles"),
    safeCount(supabase, "stores"),
    safeCount(supabase, "landing_pages"),
    safeSelect(supabase, "commerce_orders", "id, total_amount, total, status"),
    safeCount(supabase, "commerce_customers"),
    getAdminAnalytics()
  ]);
  const revenueEstimate = sumBy(orders, "total_amount") || sumBy(orders, "total");

  return {
    conversions: analytics.conversions,
    customers,
    landings,
    orders: orders.length,
    revenueEstimate,
    stores,
    users,
    visitors: analytics.visitors
  };
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const { supabase, users } = await getAdminUsersBase();
  const [stores, landings, orders, subscriptions] = await Promise.all([
    safeSelect(supabase, "stores", "user_id"),
    safeSelect(supabase, "landing_pages", "user_id"),
    safeSelect(supabase, "commerce_orders", "user_id"),
    safeSelect(supabase, "user_subscriptions", "user_id, plan_id, status")
  ]);
  const storeCounts = countBy(stores, "user_id");
  const landingCounts = countBy(landings, "user_id");
  const orderCounts = countBy(orders, "user_id");
  const subscriptionsByUser = new Map(subscriptions.map((row) => [text(row.user_id), row]));

  return users.map((user) => {
    const subscription = subscriptionsByUser.get(user.id);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    return {
      createdAt: user.createdAt,
      email: user.email,
      id: user.id,
      landingsCount: landingCounts.get(user.id) ?? 0,
      ordersCount: orderCounts.get(user.id) ?? 0,
      plan: plan.name,
      status: text(subscription?.status, "active"),
      storesCount: storeCounts.get(user.id) ?? 0
    };
  });
}

export async function getAdminStores(): Promise<AdminStore[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const [stores, publications, orders, events] = await Promise.all([
    safeSelect(supabase, "stores", "id, user_id, name, status, template_id, created_at"),
    safeSelect(supabase, "published_stores", "store_id, slug, url, status"),
    safeSelect(supabase, "commerce_orders", "source_id, source_type"),
    safeSelect(supabase, "analytics_events", "source_id, source_type, event_type")
  ]);
  const publicationByStore = new Map(publications.map((row) => [text(row.store_id), row]));
  const storeOrders = orders.filter((order) => order.source_type === "store");
  const storeViews = events.filter(
    (event) => event.source_type === "store" && event.event_type === "page_view"
  );
  const orderCounts = countBy(storeOrders, "source_id");
  const viewCounts = countBy(storeViews, "source_id");

  return stores.map((store) => {
    const publication = publicationByStore.get(text(store.id));
    const url = text(publication?.url) || (text(publication?.slug) ? `/store/${text(publication?.slug)}` : null);
    return {
      createdAt: text(store.created_at),
      id: text(store.id),
      name: text(store.name, "Untitled store"),
      ordersCount: orderCounts.get(text(store.id)) ?? 0,
      ownerEmail: owners.get(text(store.user_id)) ?? text(store.user_id, "Unknown owner"),
      publishedUrl: url,
      status: text(publication?.status, text(store.status, "draft")),
      template: text(store.template_id, "default"),
      viewsCount: viewCounts.get(text(store.id)) ?? 0
    };
  });
}

export async function getAdminLandings(): Promise<AdminLanding[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const [landings, publications, orders, events] = await Promise.all([
    safeSelect(supabase, "landing_pages", "id, user_id, product_name, status, template_id, slug, created_at"),
    safeSelect(supabase, "publications", "landing_page_id, url, status"),
    safeSelect(supabase, "commerce_orders", "source_id, source_type"),
    safeSelect(supabase, "analytics_events", "source_id, source_type, event_type")
  ]);
  const publicationByLanding = new Map(publications.map((row) => [text(row.landing_page_id), row]));
  const landingOrders = orders.filter((order) => order.source_type === "landing");
  const landingViews = events.filter(
    (event) => event.source_type === "landing" && event.event_type === "page_view"
  );
  const orderCounts = countBy(landingOrders, "source_id");
  const viewCounts = countBy(landingViews, "source_id");

  return landings.map((landing) => {
    const publication = publicationByLanding.get(text(landing.id));
    const url = text(publication?.url) || (text(landing.slug) ? `/l/${text(landing.slug)}` : null);
    return {
      createdAt: text(landing.created_at),
      id: text(landing.id),
      ordersCount: orderCounts.get(text(landing.id)) ?? 0,
      ownerEmail: owners.get(text(landing.user_id)) ?? text(landing.user_id, "Unknown owner"),
      publishedUrl: url,
      status: text(publication?.status, text(landing.status, "draft")),
      template: text(landing.template_id, "default"),
      title: text(landing.product_name, "Untitled landing"),
      viewsCount: viewCounts.get(text(landing.id)) ?? 0
    };
  });
}

export async function getAdminOrders(): Promise<AdminOrder[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const orders = await safeSelect(
    supabase,
    "commerce_orders",
    "id, user_id, source_type, customer_name, customer_phone, payment_method, status, total_amount, total, currency, created_at"
  );

  return orders.map((order) => ({
    createdAt: text(order.created_at),
    currency: text(order.currency, "USD"),
    customer: text(order.customer_name, text(order.customer_phone, "Unknown customer")),
    id: text(order.id),
    ownerEmail: owners.get(text(order.user_id)) ?? text(order.user_id, "Unknown owner"),
    paymentMethod: text(order.payment_method, "unknown"),
    sourceType: text(order.source_type, "unknown"),
    status: text(order.status, "new"),
    total: numberValue(order.total_amount) || numberValue(order.total)
  }));
}

export async function getAdminCustomers(): Promise<AdminCustomer[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const customers = await safeSelect(
    supabase,
    "commerce_customers",
    "id, user_id, name, phone, email, total_spent, order_count"
  );

  return customers.map((customer) => ({
    email: text(customer.email) || null,
    id: text(customer.id),
    name: text(customer.name, "Unknown customer"),
    ordersCount: numberValue(customer.order_count),
    ownerEmail: owners.get(text(customer.user_id)) ?? text(customer.user_id, "Unknown owner"),
    phone: text(customer.phone) || null,
    totalSpent: numberValue(customer.total_spent)
  }));
}

export async function getAdminSubscriptions(): Promise<AdminSubscription[]> {
  const { supabase, users } = await getAdminUsersBase();
  const [subscriptions, stores, publishedStores, landings, domains, orders] = await Promise.all([
    safeSelect(supabase, "user_subscriptions", "user_id, plan_id, status"),
    safeSelect(supabase, "stores", "user_id"),
    safeSelect(supabase, "published_stores", "user_id, status"),
    safeSelect(supabase, "landing_pages", "user_id"),
    safeSelect(supabase, "commerce_domain_publications", "user_id"),
    safeSelect(supabase, "commerce_orders", "user_id")
  ]);
  const subscriptionsByUser = new Map(subscriptions.map((row) => [text(row.user_id), row]));
  const storeCounts = countBy(stores, "user_id");
  const landingCounts = countBy(landings, "user_id");
  const domainCounts = countBy(domains, "user_id");
  const orderCounts = countBy(orders, "user_id");
  const publishedCounts = countBy(
    publishedStores.filter((row) => row.status === "published"),
    "user_id"
  );

  return users.map((user) => {
    const subscription = subscriptionsByUser.get(user.id);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    return {
      email: user.email,
      domainLimit: plan.domainLimit === null ? "Unlimited" : String(plan.domainLimit),
      domainsUsed: domainCounts.get(user.id) ?? 0,
      landingLimit: plan.landingLimit === null ? "Unlimited" : String(plan.landingLimit),
      landingsUsed: landingCounts.get(user.id) ?? 0,
      ordersUsed: orderCounts.get(user.id) ?? 0,
      plan: plan.name,
      planId: plan.id,
      publishedStoresUsed: publishedCounts.get(user.id) ?? 0,
      status: text(subscription?.status, "active"),
      storeLimit: plan.storeLimit === null ? "Unlimited" : String(plan.storeLimit),
      storesUsed: storeCounts.get(user.id) ?? 0,
      userId: user.id
    };
  });
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const { supabase } = await getAdminClient();
  const [orders, events] = await Promise.all([
    safeSelect(supabase, "commerce_orders", "id, total_amount, total, products, status"),
    safeSelect(
      supabase,
      "analytics_events",
      "source_type, source_slug, event_type, visitor_id, product_name"
    )
  ]);
  const pageViews = events.filter((event) => event.event_type === "page_view");
  const visitors = new Set(
    events.filter((event) => event.visitor_id).map((event) => text(event.visitor_id))
  ).size;
  const conversions = events.filter((event) => event.event_type === "conversion").length;
  const landingCounts = new Map<string, { label: string; count: number }>();
  const storeCounts = new Map<string, { label: string; count: number }>();
  const productCounts = new Map<string, { label: string; count: number }>();

  for (const event of pageViews) {
    const slug = text(event.source_slug, "unknown");
    const target = event.source_type === "store" ? storeCounts : landingCounts;
    const current = target.get(slug);
    target.set(slug, { label: slug, count: (current?.count ?? 0) + 1 });
  }

  for (const event of events) {
    if (event.event_type === "product_view" && text(event.product_name)) {
      const name = text(event.product_name);
      const current = productCounts.get(name);
      productCounts.set(name, { label: name, count: (current?.count ?? 0) + 1 });
    }
  }

  for (const order of orders) {
    const products = Array.isArray(order.products) ? order.products : [];
    for (const product of products) {
      if (product && typeof product === "object" && "name" in product) {
        const name = text((product as AnyRecord).name, "Product");
        const current = productCounts.get(name);
        productCounts.set(name, { label: name, count: (current?.count ?? 0) + 1 });
      }
    }
  }

  return {
    conversionRate: pageViews.length ? Math.round((conversions / pageViews.length) * 1000) / 10 : 0,
    conversions,
    orders: orders.length,
    revenueEstimate: sumBy(orders, "total_amount") || sumBy(orders, "total"),
    topLandings: [...landingCounts.values()]
      .filter((source) => source.label !== "unknown")
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topProducts: [...productCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    topStores: [...storeCounts.values()]
      .filter((source) => source.label !== "unknown")
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    visitors,
    whatsappClicks: events.filter((event) => event.event_type === "whatsapp_click").length
  };
}
