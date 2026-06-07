import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBillingPlan } from "@/lib/billing/plans";
import { getAdminAccess } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AnyRecord = Record<string, unknown>;

export type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  plan: string;
  planId: string;
  status: string;
  accountStatus: string;
  governanceStatus: "suspended" | null;
  createdAt: string | null;
  lastLoginAt: string | null;
  workspaceCount: number;
  storesCount: number;
  landingsCount: number;
  ordersCount: number;
  recentActivity: Array<{
    createdAt: string;
    label: string;
  }>;
  stores: Array<{
    createdAt: string;
    id: string;
    name: string;
    status: string;
  }>;
  subscription: {
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
    planId: string;
    planName: string;
    status: string;
  };
  workspaces: Array<{
    createdAt: string | null;
    id: string;
    role: string;
    status: string;
  }>;
};

export type AdminUserDetail = AdminUser & {
  recentOrders: Array<{
    createdAt: string;
    currency: string;
    id: string;
    sourceType: string;
    status: string;
    total: number;
  }>;
  stores: Array<{
    createdAt: string;
    id: string;
    name: string;
    status: string;
  }>;
};

export type AdminStoreHealthKey =
  | "domain_not_connected"
  | "missing_legal_pages"
  | "missing_products"
  | "no_payment_method"
  | "no_shipping_settings"
  | "publish_blocked"
  | "publish_ready";

export type AdminStore = {
  id: string;
  slug: string | null;
  workspaceId: string | null;
  ownerId: string | null;
  ownerEmail: string;
  name: string;
  status: string;
  storeStatus: string;
  plan: string;
  publicationStatus: string;
  template: string;
  publishedUrl: string | null;
  createdAt: string;
  productsCount: number;
  ordersCount: number;
  revenue: number;
  viewsCount: number;
  health: Array<{
    key: AdminStoreHealthKey;
    label: string;
    status: "blocked" | "ready" | "warning";
  }>;
  workspaceMembers: Array<{
    email: string;
    role: string;
    status: string;
    userId: string;
  }>;
};

export type AdminSeller = {
  userId: string;
  email: string;
  fullName: string | null;
  status: "active" | "suspended" | "under_review";
  plan: string;
  planId: string;
  storesOwned: number;
  publishedStores: number;
  productsCount: number;
  ordersCount: number;
  customersCount: number;
  revenue: number;
  governanceStatus: "active" | "suspended" | "under_review";
  subscription: {
    planId: string;
    planName: string;
    status: string;
  };
  stores: Array<{
    createdAt: string;
    id: string;
    name: string;
    slug: string | null;
    status: string;
  }>;
  recentOrders: Array<{
    createdAt: string;
    currency: string;
    id: string;
    source: string;
    status: string;
    storeId: string;
    total: number;
  }>;
};

export type AdminReseller = {
  userId: string;
  email: string;
  fullName: string | null;
  status: "active" | "suspended" | "pending_verification" | "verified";
  governanceStatus: "active" | "suspended" | "pending_review";
  verificationStatus: "pending_verification" | "verified";
  createdAt: string | null;
  storesCreated: number;
  storesSold: number;
  customersReferred: number;
  commissionsPlaceholder: string;
  profile: {
    displayName: string | null;
    id: string | null;
    isPublished: boolean;
    slug: string | null;
  };
  ownedStores: Array<{
    createdAt: string;
    id: string;
    name: string;
    slug: string | null;
    status: string;
  }>;
  transferredStores: Array<{
    buyerEmail: string | null;
    id: string;
    name: string;
    status: string;
    transferredAt: string | null;
  }>;
  commissionSummary: {
    note: string;
    total: number;
  };
};

export type AdminPaymentProviderControl = {
  providers: Array<{
    configurationStatus: "configured" | "missing" | "partial";
    enabledStatus: "disabled" | "enabled" | "placeholder_disabled" | "under_review";
    environmentMode: "live" | "test" | "sandbox" | "placeholder";
    healthStatus: "healthy" | "missing_config" | "needs_review" | "warning";
    key: string;
    lastEvent: string | null;
    name: string;
    warnings: Array<"live_mode_not_verified" | "provider_not_configured" | "test_mode" | "webhook_missing">;
    webhookStatus: "configured" | "missing" | "not_applicable" | "placeholder";
  }>;
  storePaymentAdoption: {
    codStores: number;
    manualStores: number;
    missingPaymentMethodStores: number;
    paypalStores: number;
    stripeStores: number;
    totalStores: number;
  };
  paymentSetupRisks: Array<{
    id: string;
    name: string;
    ownerEmail: string;
    reason: string;
    slug: string | null;
  }>;
  webhookMonitoring: {
    failedEvents: number;
    recentEvents: Array<{
      createdAt: string;
      eventStatus: string;
      eventType: string;
      provider: string;
    }>;
    totalEvents: number;
  };
};

export type AdminDomainsHostingControl = {
  overview: {
    connectedDomains: number;
    dnsPending: number;
    domainDrafts: number;
    emailMailboxDrafts: number;
    failedOperations: number;
    pendingDomainOrders: number;
    readyForRegistration: number;
    sslPending: number;
  };
  domainOrders: Array<{
    createdAt: string;
    customerDueCents: number;
    domain: string;
    extension: string;
    id: string;
    nextStep: string;
    ownerEmail: string;
    planCreditUsedCents: number;
    status: string;
    storeId: string;
    storeName: string;
  }>;
  emailOrders: Array<{
    activationStatus: string;
    createdAt: string;
    dnsStatus: string;
    domain: string;
    id: string;
    mailboxAddress: string;
    mailboxPlan: string;
    ownerEmail: string;
    status: string;
    storeId: string;
    storeName: string;
  }>;
  sslStatuses: Array<{
    dnsStatus: string;
    domain: string;
    id: string;
    primaryDomainStatus: string;
    sslStatus: string;
    storeName: string;
  }>;
  providerHealth: Array<{
    service: string;
    status: "placeholder" | "ready" | "review";
    note: string;
  }>;
  hostingPlaceholder: {
    orders: string;
    providerHook: string;
    provisioning: string;
  };
  platformBalance: {
    note: string;
    status: string;
  };
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
  billingProvider: string;
  billingReview: boolean;
  createdAt: string | null;
  failedPayments: number;
  landingsUsed: number;
  landingLimit: string;
  manualOverrideActive: boolean;
  nextBillingDate: string | null;
  previousPlanId: string | null;
  storesUsed: number;
  storeLimit: string;
  domainsUsed: number;
  domainLimit: string;
  publishedStoresUsed: number;
  ordersUsed: number;
  warningBadges: Array<"limit_exceeded" | "manual_override_active" | "payment_failed" | "subscription_cancelled">;
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

export type AdminPlatformHealth = {
  failedMonitoringEvents: number;
  label: "Needs review" | "Stable";
  openSupportTickets: number;
  recentSecurityEvents: number;
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

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

function ownerUserId(record: AnyRecord) {
  return text(record.owner_user_id) || text(record.user_id);
}

function governanceStatus(storeData: unknown, fallback: string) {
  if (!storeData || typeof storeData !== "object" || Array.isArray(storeData)) {
    return fallback;
  }

  const governance = (storeData as Record<string, unknown>).adminGovernance;

  if (!governance || typeof governance !== "object" || Array.isArray(governance)) {
    return fallback;
  }

  const status = text((governance as AnyRecord).status);

  return status === "suspended" || status === "under_review" ? status : fallback;
}

function countStoresByOwner(records: AnyRecord[]) {
  const counts = new Map<string, number>();

  for (const record of records) {
    const ownerId = ownerUserId(record);

    if (ownerId) {
      counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
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

function dateValue(value: unknown) {
  const timestamp = Date.parse(text(value));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function userGovernanceStatus(value: unknown): "suspended" | null {
  if (!isRecord(value)) {
    return null;
  }

  const governance = value.adminGovernance;

  if (!isRecord(governance)) {
    return null;
  }

  return text(governance.status) === "suspended" ? "suspended" : null;
}

function adminGovernanceStatus(value: unknown): "suspended" | "under_review" | null {
  if (!isRecord(value)) {
    return null;
  }

  const governance = value.adminGovernance;

  if (!isRecord(governance)) {
    return null;
  }

  const status = text(governance.status);

  return status === "suspended" || status === "under_review" ? status : null;
}

function resellerGovernance(value: unknown): {
  governanceStatus: AdminReseller["governanceStatus"];
  verificationStatus: AdminReseller["verificationStatus"];
} {
  if (!isRecord(value) || !isRecord(value.adminGovernance)) {
    return {
      governanceStatus: "active",
      verificationStatus: "pending_verification"
    };
  }

  const governance = value.adminGovernance;
  const status = text(governance.status);
  const verificationStatus = text(governance.verificationStatus);

  return {
    governanceStatus:
      status === "suspended" ? "suspended" : status === "pending_review" ? "pending_review" : "active",
    verificationStatus: verificationStatus === "verified" ? "verified" : "pending_verification"
  };
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
  let users: Array<{
    createdAt: string | null;
    email: string;
    fullName: string | null;
    id: string;
    lastLoginAt: string | null;
  }> = [];

  if (serviceRoleConfigured) {
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    users =
      data.users?.map((user) => {
        const metadata = isRecord(user.user_metadata) ? user.user_metadata : {};

        return {
          createdAt: user.created_at ?? null,
          email: user.email ?? "No email",
          fullName: text(metadata.full_name) || text(metadata.name) || null,
          id: user.id,
          lastLoginAt: user.last_sign_in_at ?? null
        };
      }) ?? [];
  }

  if (!users.length) {
    const profiles = await safeSelect(supabase, "profiles", "id, email, full_name, created_at");
    users = profiles.map((profile) => ({
      createdAt: text(profile.created_at, "") || null,
      email: text(profile.email, "No email"),
      fullName: text(profile.full_name) || null,
      id: text(profile.id),
      lastLoginAt: null
    }));
  }

  return { serviceRoleConfigured, supabase, users };
}

export async function getAdminOverview() {
  const { supabase } = await getAdminClient();
  const [{ users }, stores, landings, orders, customers, analytics] = await Promise.all([
    getAdminUsersBase(),
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
    users: users.length,
    visitors: analytics.visitors
  };
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const { supabase, users } = await getAdminUsersBase();
  const [stores, landings, orders, subscriptions, workspaceMembers, accountProfiles, billingEvents] = await Promise.all([
    safeSelect(supabase, "stores", "id, user_id, owner_user_id, workspace_id, name, store_name, status, created_at"),
    safeSelect(supabase, "landing_pages", "user_id"),
    safeSelect(supabase, "commerce_orders", "user_id"),
    safeSelect(
      supabase,
      "user_subscriptions",
      "user_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, limits_snapshot"
    ),
    safeSelect(supabase, "workspace_members", "workspace_id, user_id, role, status, created_at"),
    safeSelect(supabase, "account_profiles", "user_id, display_name, account_id, account_type"),
    safeSelect(supabase, "billing_events", "user_id, event_type, processed_at, created_at")
  ]);
  const storeCounts = countStoresByOwner(stores);
  const landingCounts = countBy(landings, "user_id");
  const orderCounts = countBy(orders, "user_id");
  const subscriptionsByUser = new Map(subscriptions.map((row) => [text(row.user_id), row]));
  const accountProfilesByUser = new Map(
    accountProfiles
      .filter((profile) => text(profile.account_type, "user") === "user")
      .map((profile) => [text(profile.user_id), profile])
  );
  const workspacesByUser = new Map<string, AnyRecord[]>();
  for (const member of workspaceMembers) {
    const userId = text(member.user_id);

    if (!userId) {
      continue;
    }

    workspacesByUser.set(userId, [...(workspacesByUser.get(userId) ?? []), member]);
  }
  const activityByUser = new Map<string, AnyRecord[]>();
  for (const event of billingEvents) {
    const userId = text(event.user_id);

    if (!userId) {
      continue;
    }

    activityByUser.set(userId, [...(activityByUser.get(userId) ?? []), event]);
  }

  return users.map((user) => {
    const subscription = subscriptionsByUser.get(user.id);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    const governanceStatus = userGovernanceStatus(subscription?.limits_snapshot);
    const subscriptionStatus = text(subscription?.status, "active");
    const profile = accountProfilesByUser.get(user.id);
    const workspaces = workspacesByUser.get(user.id) ?? [];
    const workspaceIds = new Set(workspaces.map((workspace) => text(workspace.workspace_id)).filter(Boolean));
    const accountStatus = governanceStatus ?? (subscriptionStatus === "incomplete" ? "suspended" : subscriptionStatus);
    const userStores = stores
      .filter((store) => ownerUserId(store) === user.id)
      .map((store) => ({
        createdAt: text(store.created_at),
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        status: text(store.status, "draft")
      }));

    return {
      accountStatus,
      createdAt: user.createdAt,
      email: user.email,
      fullName: user.fullName ?? (text(profile?.display_name) || null),
      governanceStatus,
      id: user.id,
      landingsCount: landingCounts.get(user.id) ?? 0,
      lastLoginAt: user.lastLoginAt,
      ordersCount: orderCounts.get(user.id) ?? 0,
      plan: plan.name,
      planId: plan.id,
      recentActivity: (activityByUser.get(user.id) ?? [])
        .sort(
          (left, right) =>
            dateValue(right.processed_at ?? right.created_at) -
            dateValue(left.processed_at ?? left.created_at)
        )
        .slice(0, 5)
        .map((event) => ({
          createdAt: text(event.processed_at) || text(event.created_at),
          label: text(event.event_type, "billing_event")
        })),
      status: subscriptionStatus,
      stores: userStores,
      storesCount: storeCounts.get(user.id) ?? 0,
      subscription: {
        cancelAtPeriodEnd: subscription?.cancel_at_period_end === true,
        currentPeriodEnd: text(subscription?.current_period_end) || null,
        currentPeriodStart: text(subscription?.current_period_start) || null,
        planId: plan.id,
        planName: plan.name,
        status: subscriptionStatus
      },
      workspaceCount: workspaceIds.size,
      workspaces: workspaces.map((workspace) => ({
        createdAt: text(workspace.created_at) || null,
        id: text(workspace.workspace_id),
        role: text(workspace.role, "member"),
        status: text(workspace.status, "active")
      }))
    };
  });
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const users = await getAdminUsers();
  const user = users.find((candidate) => candidate.id === userId);

  if (!user) {
    return null;
  }

  const { supabase } = await getAdminClient();
  const [stores, orders] = await Promise.all([
    safeSelect(supabase, "stores", "id, user_id, owner_user_id, name, store_name, status, created_at"),
    safeSelect(
      supabase,
      "commerce_orders",
      "id, user_id, source_type, status, total_amount, total, currency, created_at"
    )
  ]);

  return {
    ...user,
    recentOrders: orders
      .filter((order) => text(order.user_id) === userId)
      .slice(0, 10)
      .map((order) => ({
        createdAt: text(order.created_at),
        currency: text(order.currency, "USD"),
        id: text(order.id),
        sourceType: text(order.source_type, "unknown"),
        status: text(order.status, "new"),
        total: numberValue(order.total_amount) || numberValue(order.total)
      })),
    stores: stores
      .filter((store) => ownerUserId(store) === userId)
      .map((store) => ({
        createdAt: text(store.created_at),
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        status: text(store.status, "draft")
      }))
  };
}

export async function getAdminStores(): Promise<AdminStore[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const [
    stores,
    publications,
    commerceOrders,
    storeOrders,
    events,
    products,
    paymentMethods,
    providerConnections,
    shippingProfiles,
    shippingZones,
    shippingMethods,
    legalPages,
    storeDomains,
    subscriptions,
    workspaceMembers
  ] = await Promise.all([
    safeSelect(
      supabase,
      "stores",
      "id, user_id, owner_user_id, workspace_id, name, store_name, slug, status, store_data, template_id, created_at, delivery_enabled, pickup_enabled, delivery_notes"
    ),
    safeSelect(supabase, "published_stores", "store_id, slug, url, status, custom_domain"),
    safeSelect(supabase, "commerce_orders", "source_id, source_type, total_amount, total"),
    safeSelect(supabase, "store_orders", "store_id, total, total_amount"),
    safeSelect(supabase, "analytics_events", "source_id, source_type, event_type"),
    safeSelect(supabase, "store_products", "store_id, status"),
    safeSelect(supabase, "store_payment_methods", "store_id, is_enabled"),
    safeSelect(supabase, "store_payment_provider_connections", "store_id, connection_status, charges_enabled, paypal_status"),
    safeSelect(supabase, "shipping_profiles", "store_id"),
    safeSelect(supabase, "shipping_zones", "store_id, enabled"),
    safeSelect(supabase, "shipping_methods", "store_id, enabled"),
    safeSelect(supabase, "store_pages", "store_id, page_type, status"),
    safeSelect(supabase, "store_domains", "store_id, hostname, status, verification_status"),
    safeSelect(supabase, "user_subscriptions", "user_id, plan_id, status"),
    safeSelect(supabase, "workspace_members", "workspace_id, user_id, role, status")
  ]);
  const publicationByStore = new Map(publications.map((row) => [text(row.store_id), row]));
  const commerceStoreOrders = commerceOrders.filter((order) => order.source_type === "store");
  const storeViews = events.filter(
    (event) => event.source_type === "store" && event.event_type === "page_view"
  );
  const commerceOrderCounts = countBy(commerceStoreOrders, "source_id");
  const directOrderCounts = countBy(storeOrders, "store_id");
  const viewCounts = countBy(storeViews, "source_id");
  const productCounts = countBy(products, "store_id");
  const subscriptionByUser = new Map(subscriptions.map((row) => [text(row.user_id), row]));
  const membersByWorkspace = new Map<string, AnyRecord[]>();
  for (const member of workspaceMembers) {
    const workspaceId = text(member.workspace_id);
    if (!workspaceId) {
      continue;
    }
    membersByWorkspace.set(workspaceId, [...(membersByWorkspace.get(workspaceId) ?? []), member]);
  }

  return stores.map((store) => {
    const publication = publicationByStore.get(text(store.id));
    const ownerId = ownerUserId(store);
    const workspaceId = text(store.workspace_id) || null;
    const url = text(publication?.url) || (text(publication?.slug) ? `/store/${text(publication?.slug)}` : null);
    const storeId = text(store.id);
    const storeProducts = products.filter((product) => text(product.store_id) === storeId);
    const activeProductCount = storeProducts.filter((product) => text(product.status) === "active").length;
    const storePaymentMethods = paymentMethods.filter((method) => text(method.store_id) === storeId);
    const storeProviderConnections = providerConnections.filter((connection) => text(connection.store_id) === storeId);
    const hasPaymentMethod =
      storePaymentMethods.some((method) => method.is_enabled === true) ||
      storeProviderConnections.some(
        (connection) =>
          text(connection.connection_status) === "connected" ||
          connection.charges_enabled === true ||
          text(connection.paypal_status) === "connected"
      );
    const hasShipping =
      store.delivery_enabled === true ||
      store.pickup_enabled === true ||
      text(store.delivery_notes).length > 0 ||
      shippingProfiles.some((profile) => text(profile.store_id) === storeId) ||
      shippingZones.some((zone) => text(zone.store_id) === storeId && zone.enabled !== false) ||
      shippingMethods.some((method) => text(method.store_id) === storeId && method.enabled !== false);
    const requiredLegalPages = new Set(["privacy", "returns", "shipping", "terms"]);
    for (const page of legalPages) {
      if (text(page.store_id) === storeId && text(page.status) !== "archived") {
        requiredLegalPages.delete(text(page.page_type));
      }
    }
    const hasCustomDomain =
      text(publication?.custom_domain).length > 0 ||
      storeDomains.some(
        (domain) =>
          text(domain.store_id) === storeId &&
          (text(domain.status) === "verified" || text(domain.verification_status) === "verified")
      );
    const orderCount = (commerceOrderCounts.get(storeId) ?? 0) + (directOrderCounts.get(storeId) ?? 0);
    const storeRevenue =
      sumBy(commerceStoreOrders.filter((order) => text(order.source_id) === storeId), "total_amount") ||
      sumBy(commerceStoreOrders.filter((order) => text(order.source_id) === storeId), "total");
    const directRevenue =
      sumBy(storeOrders.filter((order) => text(order.store_id) === storeId), "total_amount") ||
      sumBy(storeOrders.filter((order) => text(order.store_id) === storeId), "total");
    const blockingHealth = [
      activeProductCount ? null : "missing_products",
      hasPaymentMethod ? null : "no_payment_method",
      hasShipping ? null : "no_shipping_settings",
      requiredLegalPages.size ? "missing_legal_pages" : null
    ].filter(Boolean);
    const health: AdminStore["health"] = [
      {
        key: "missing_products",
        label: activeProductCount ? "Products ready" : "Missing products",
        status: activeProductCount ? "ready" : "blocked"
      },
      {
        key: "no_payment_method",
        label: hasPaymentMethod ? "Payment configured" : "No payment method",
        status: hasPaymentMethod ? "ready" : "blocked"
      },
      {
        key: "no_shipping_settings",
        label: hasShipping ? "Shipping configured" : "No shipping settings",
        status: hasShipping ? "ready" : "blocked"
      },
      {
        key: "missing_legal_pages",
        label: requiredLegalPages.size ? "Missing legal pages" : "Legal pages ready",
        status: requiredLegalPages.size ? "blocked" : "ready"
      },
      {
        key: "domain_not_connected",
        label: hasCustomDomain ? "Domain connected" : "Domain not connected",
        status: hasCustomDomain ? "ready" : "warning"
      },
      {
        key: blockingHealth.length ? "publish_blocked" : "publish_ready",
        label: blockingHealth.length ? "Publish blocked" : "Publish ready",
        status: blockingHealth.length ? "blocked" : "ready"
      }
    ];
    const subscription = subscriptionByUser.get(ownerId);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    const workspaceMemberRows = workspaceId ? membersByWorkspace.get(workspaceId) ?? [] : [];
    const storeStatus = text(store.status, "draft");
    const adminStatus = governanceStatus(store.store_data, storeStatus);

    return {
      createdAt: text(store.created_at),
      health,
      id: storeId,
      name: text(store.store_name, text(store.name, "Untitled store")),
      ordersCount: orderCount,
      ownerEmail: owners.get(ownerId) ?? text(ownerId, "Unknown owner"),
      ownerId: ownerId || null,
      plan: plan.name,
      productsCount: productCounts.get(storeId) ?? 0,
      publicationStatus: text(publication?.status, "not_published"),
      publishedUrl: url,
      revenue: storeRevenue + directRevenue,
      slug: text(store.slug) || text(publication?.slug) || null,
      status: adminStatus,
      storeStatus,
      template: text(store.template_id, "default"),
      viewsCount: viewCounts.get(storeId) ?? 0,
      workspaceId,
      workspaceMembers: workspaceMemberRows.map((member) => ({
        email: owners.get(text(member.user_id)) ?? text(member.user_id, "Unknown member"),
        role: text(member.role, "member"),
        status: text(member.status, "active"),
        userId: text(member.user_id)
      }))
    };
  });
}

export async function getAdminSellers(): Promise<AdminSeller[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const namesByUser = new Map(users.map((user) => [user.id, user.fullName]));
  const [
    stores,
    publications,
    products,
    commerceOrders,
    storeOrders,
    storeCustomers,
    commerceCustomers,
    subscriptions
  ] = await Promise.all([
    safeSelect(
      supabase,
      "stores",
      "id, user_id, owner_user_id, name, store_name, slug, status, store_data, created_at"
    ),
    safeSelect(supabase, "published_stores", "store_id, status"),
    safeSelect(supabase, "store_products", "store_id"),
    safeSelect(
      supabase,
      "commerce_orders",
      "id, user_id, source_id, source_type, status, total_amount, total, currency, created_at"
    ),
    safeSelect(
      supabase,
      "store_orders",
      "id, store_id, owner_user_id, user_id, status, total_amount, total, currency, created_at"
    ),
    safeSelect(supabase, "customers", "id, store_id"),
    safeSelect(supabase, "commerce_customers", "id, user_id"),
    safeSelect(supabase, "user_subscriptions", "user_id, plan_id, status, limits_snapshot")
  ]);
  const sellerIds = new Set(stores.map(ownerUserId).filter(Boolean));
  const storesBySeller = new Map<string, AnyRecord[]>();

  for (const store of stores) {
    const sellerId = ownerUserId(store);

    if (!sellerId) {
      continue;
    }

    storesBySeller.set(sellerId, [...(storesBySeller.get(sellerId) ?? []), store]);
  }

  const publicationsByStore = new Map(publications.map((publication) => [text(publication.store_id), publication]));
  const productsByStore = countBy(products, "store_id");
  const storeCustomersByStore = countBy(storeCustomers, "store_id");
  const commerceCustomersByUser = countBy(commerceCustomers, "user_id");
  const subscriptionByUser = new Map(subscriptions.map((subscription) => [text(subscription.user_id), subscription]));

  return [...sellerIds].map((sellerId) => {
    const sellerStores = storesBySeller.get(sellerId) ?? [];
    const storeIds = new Set(sellerStores.map((store) => text(store.id)).filter(Boolean));
    const subscription = subscriptionByUser.get(sellerId);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    const sellerGovernance = adminGovernanceStatus(subscription?.limits_snapshot);
    const storeGovernance = sellerStores
      .map((store) => adminGovernanceStatus(store.store_data))
      .find((status) => status === "suspended" || status === "under_review");
    const subscriptionStatus = text(subscription?.status, "active");
    const sellerStatus =
      sellerGovernance ??
      storeGovernance ??
      (subscriptionStatus === "incomplete" ? "suspended" : "active");
    const sellerCommerceOrders = commerceOrders.filter(
      (order) =>
        (order.source_type === "store" && storeIds.has(text(order.source_id))) ||
        text(order.user_id) === sellerId
    );
    const sellerStoreOrders = storeOrders.filter(
      (order) => storeIds.has(text(order.store_id)) || text(order.owner_user_id) === sellerId
    );
    const recentOrders = [
      ...sellerCommerceOrders.map((order) => ({
        createdAt: text(order.created_at),
        currency: text(order.currency, "USD"),
        id: text(order.id),
        source: text(order.source_type, "commerce"),
        status: text(order.status, "new"),
        storeId: text(order.source_id),
        total: numberValue(order.total_amount) || numberValue(order.total)
      })),
      ...sellerStoreOrders.map((order) => ({
        createdAt: text(order.created_at),
        currency: text(order.currency, "USD"),
        id: text(order.id),
        source: "store_order",
        status: text(order.status, "new"),
        storeId: text(order.store_id),
        total: numberValue(order.total_amount) || numberValue(order.total)
      }))
    ]
      .sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt))
      .slice(0, 5);

    return {
      customersCount:
        [...storeIds].reduce((total, storeId) => total + (storeCustomersByStore.get(storeId) ?? 0), 0) +
        (commerceCustomersByUser.get(sellerId) ?? 0),
      email: owners.get(sellerId) ?? text(sellerId, "Unknown seller"),
      fullName: namesByUser.get(sellerId) ?? null,
      governanceStatus: sellerStatus,
      ordersCount: sellerCommerceOrders.length + sellerStoreOrders.length,
      plan: plan.name,
      planId: plan.id,
      productsCount: [...storeIds].reduce((total, storeId) => total + (productsByStore.get(storeId) ?? 0), 0),
      publishedStores: sellerStores.filter(
        (store) => text(publicationsByStore.get(text(store.id))?.status) === "published"
      ).length,
      recentOrders,
      revenue:
        (sumBy(sellerCommerceOrders, "total_amount") || sumBy(sellerCommerceOrders, "total")) +
        (sumBy(sellerStoreOrders, "total_amount") || sumBy(sellerStoreOrders, "total")),
      status: sellerStatus,
      stores: sellerStores.map((store) => ({
        createdAt: text(store.created_at),
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        slug: text(store.slug) || null,
        status: governanceStatus(store.store_data, text(store.status, "draft"))
      })),
      storesOwned: sellerStores.length,
      subscription: {
        planId: plan.id,
        planName: plan.name,
        status: subscriptionStatus
      },
      userId: sellerId
    };
  });
}

export async function getAdminResellers(): Promise<AdminReseller[]> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const namesByUser = new Map(users.map((user) => [user.id, user.fullName]));
  const createdByUser = new Map(users.map((user) => [user.id, user.createdAt]));
  const [
    resellerProfiles,
    accountProfiles,
    stores,
    subscriptions,
    purchaseRequests,
    provisionedStores,
    storeTransfers
  ] = await Promise.all([
    safeSelect(
      supabase,
      "reseller_profiles",
      "id, user_id, slug, display_name, is_published, created_at"
    ),
    safeSelect(supabase, "account_profiles", "user_id, account_type, display_name, created_at"),
    safeSelect(
      supabase,
      "stores",
      "id, user_id, owner_user_id, name, store_name, slug, status, store_data, created_at"
    ),
    safeSelect(supabase, "user_subscriptions", "user_id, status, limits_snapshot"),
    safeSelect(supabase, "store_purchase_requests", "id, reseller_id, buyer_email, request_status, created_at"),
    safeSelect(
      supabase,
      "provisioned_stores",
      "id, reseller_id, buyer_email, provisioned_store_name, provisioning_status, ownership_status, created_at"
    ),
    safeSelect(supabase, "store_transfers", "id, reseller_id, buyer_email, transfer_status, transferred_at, created_at")
  ]);
  const profileById = new Map(resellerProfiles.map((profile) => [text(profile.id), profile]));
  const profilesByUser = new Map(resellerProfiles.map((profile) => [text(profile.user_id), profile]));
  const accountProfilesByUser = new Map(
    accountProfiles
      .filter((profile) => text(profile.account_type) === "reseller")
      .map((profile) => [text(profile.user_id), profile])
  );
  const resellerIds = new Set<string>();

  for (const profile of resellerProfiles) {
    const userId = text(profile.user_id);

    if (userId) {
      resellerIds.add(userId);
    }
  }

  for (const profile of accountProfilesByUser.keys()) {
    if (profile) {
      resellerIds.add(profile);
    }
  }

  for (const request of purchaseRequests) {
    const profile = profileById.get(text(request.reseller_id));
    const userId = text(profile?.user_id);

    if (userId) {
      resellerIds.add(userId);
    }
  }

  const storesByOwner = new Map<string, AnyRecord[]>();
  for (const store of stores) {
    const ownerId = ownerUserId(store);

    if (!ownerId) {
      continue;
    }

    storesByOwner.set(ownerId, [...(storesByOwner.get(ownerId) ?? []), store]);
  }

  const subscriptionsByUser = new Map(subscriptions.map((subscription) => [text(subscription.user_id), subscription]));

  return [...resellerIds].map((userId) => {
    const profile = profilesByUser.get(userId);
    const accountProfile = accountProfilesByUser.get(userId);
    const resellerProfileId = text(profile?.id);
    const governance = resellerGovernance(subscriptionsByUser.get(userId)?.limits_snapshot);
    const ownedStores = storesByOwner.get(userId) ?? [];
    const resellerRequests = purchaseRequests.filter((request) => text(request.reseller_id) === resellerProfileId);
    const resellerProvisionedStores = provisionedStores.filter(
      (store) => text(store.reseller_id) === resellerProfileId
    );
    const resellerTransfers = storeTransfers.filter((transfer) => text(transfer.reseller_id) === resellerProfileId);
    const referredCustomers = new Set(
      resellerRequests
        .map((request) => text(request.buyer_email).toLowerCase())
        .filter(Boolean)
    );
    const transferredStores = [
      ...resellerProvisionedStores.map((store) => ({
        buyerEmail: text(store.buyer_email) || null,
        id: text(store.id),
        name: text(store.provisioned_store_name, "Provisioned store"),
        status: text(store.provisioning_status, text(store.ownership_status, "draft")),
        transferredAt: null
      })),
      ...resellerTransfers.map((transfer) => ({
        buyerEmail: text(transfer.buyer_email) || null,
        id: text(transfer.id),
        name: "Store transfer",
        status: text(transfer.transfer_status, "preparing"),
        transferredAt: text(transfer.transferred_at) || null
      }))
    ];
    const storesSold = Math.max(
      resellerRequests.filter((request) => text(request.request_status) === "delivered").length,
      resellerProvisionedStores.filter((store) => text(store.provisioning_status) === "delivered").length,
      resellerTransfers.filter((transfer) => text(transfer.transferred_at)).length
    );
    const status: AdminReseller["status"] =
      governance.governanceStatus === "suspended"
        ? "suspended"
        : governance.verificationStatus === "verified"
          ? "verified"
          : "pending_verification";

    return {
      commissionSummary: {
        note: "Commission payouts are not implemented in this phase.",
        total: 0
      },
      commissionsPlaceholder: "Coming later",
      createdAt: text(profile?.created_at) || text(accountProfile?.created_at) || (createdByUser.get(userId) ?? null),
      customersReferred: referredCustomers.size,
      email: owners.get(userId) ?? text(userId, "Unknown reseller"),
      fullName: namesByUser.get(userId) ?? (text(accountProfile?.display_name) || text(profile?.display_name) || null),
      governanceStatus: governance.governanceStatus,
      ownedStores: ownedStores.map((store) => ({
        createdAt: text(store.created_at),
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        slug: text(store.slug) || null,
        status: governanceStatus(store.store_data, text(store.status, "draft"))
      })),
      profile: {
        displayName: text(profile?.display_name) || text(accountProfile?.display_name) || null,
        id: resellerProfileId || null,
        isPublished: profile?.is_published === true,
        slug: text(profile?.slug) || null
      },
      status,
      storesCreated: ownedStores.length + resellerProvisionedStores.length,
      storesSold,
      transferredStores,
      userId,
      verificationStatus: governance.verificationStatus
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
  const [subscriptions, stores, publishedStores, landings, domains, orders, invoices, billingEvents] = await Promise.all([
    safeSelect(
      supabase,
      "user_subscriptions",
      "user_id, plan_id, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, created_at, limits_snapshot"
    ),
    safeSelect(supabase, "stores", "user_id, owner_user_id"),
    safeSelect(supabase, "published_stores", "user_id, status"),
    safeSelect(supabase, "landing_pages", "user_id"),
    safeSelect(supabase, "commerce_domain_publications", "user_id"),
    safeSelect(supabase, "commerce_orders", "user_id"),
    safeSelect(supabase, "invoices", "user_id, provider, status, created_at"),
    safeSelect(supabase, "billing_events", "user_id, provider, event_type, created_at, processed_at")
  ]);
  const subscriptionsByUser = new Map(subscriptions.map((row) => [text(row.user_id), row]));
  const storeCounts = countStoresByOwner(stores);
  const landingCounts = countBy(landings, "user_id");
  const domainCounts = countBy(domains, "user_id");
  const orderCounts = countBy(orders, "user_id");
  const publishedCounts = countBy(
    publishedStores.filter((row) => row.status === "published"),
    "user_id"
  );
  const invoicesByUser = new Map<string, AnyRecord[]>();
  for (const invoice of invoices) {
    const userId = text(invoice.user_id);

    if (!userId) {
      continue;
    }

    invoicesByUser.set(userId, [...(invoicesByUser.get(userId) ?? []), invoice]);
  }
  const billingEventsByUser = new Map<string, AnyRecord[]>();
  for (const event of billingEvents) {
    const userId = text(event.user_id);

    if (!userId) {
      continue;
    }

    billingEventsByUser.set(userId, [...(billingEventsByUser.get(userId) ?? []), event]);
  }

  return users.map((user) => {
    const subscription = subscriptionsByUser.get(user.id);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    const metadata = isRecord(subscription?.limits_snapshot) ? subscription.limits_snapshot : {};
    const adminBilling = isRecord(metadata.adminBilling) ? metadata.adminBilling : {};
    const userInvoices = invoicesByUser.get(user.id) ?? [];
    const userEvents = billingEventsByUser.get(user.id) ?? [];
    const failedPayments =
      userInvoices.filter((invoice) => ["failed", "uncollectible", "void"].includes(text(invoice.status))).length +
      userEvents.filter((event) => text(event.event_type).toLowerCase().includes("payment_failed")).length;
    const billingProvider =
      text(userInvoices[0]?.provider) ||
      text(userEvents[0]?.provider) ||
      (text(subscription?.stripe_subscription_id) || text(subscription?.stripe_customer_id) ? "stripe" : "manual");
    const storesUsed = storeCounts.get(user.id) ?? 0;
    const domainsUsed = domainCounts.get(user.id) ?? 0;
    const limitExceeded =
      (plan.storeLimit !== null && storesUsed > plan.storeLimit) ||
      (plan.domainLimit !== null && domainsUsed > plan.domainLimit);
    const status = text(subscription?.status, "active");
    const manualOverrideActive = adminBilling.manualOverrideActive === true;
    const billingReview = adminBilling.reviewStatus === "review";
    const warningBadges: AdminSubscription["warningBadges"] = [
      failedPayments > 0 ? "payment_failed" : null,
      status === "canceled" || status === "cancelled" ? "subscription_cancelled" : null,
      limitExceeded ? "limit_exceeded" : null,
      manualOverrideActive ? "manual_override_active" : null
    ].filter(Boolean) as AdminSubscription["warningBadges"];

    return {
      billingProvider,
      billingReview,
      createdAt: text(subscription?.created_at) || user.createdAt,
      email: user.email,
      failedPayments,
      domainLimit: plan.domainLimit === null ? "Unlimited" : String(plan.domainLimit),
      domainsUsed,
      landingLimit: plan.landingLimit === null ? "Unlimited" : String(plan.landingLimit),
      landingsUsed: landingCounts.get(user.id) ?? 0,
      manualOverrideActive,
      nextBillingDate: text(subscription?.current_period_end) || null,
      ordersUsed: orderCounts.get(user.id) ?? 0,
      plan: plan.name,
      planId: plan.id,
      previousPlanId: text(adminBilling.previousPlanId) || null,
      publishedStoresUsed: publishedCounts.get(user.id) ?? 0,
      status,
      storeLimit: plan.storeLimit === null ? "Unlimited" : String(plan.storeLimit),
      storesUsed,
      userId: user.id,
      warningBadges
    };
  });
}

function envConfigured(names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

function providerMode(providerKey: string): AdminPaymentProviderControl["providers"][number]["environmentMode"] {
  if (providerKey === "paypal") {
    return process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
  }

  if (providerKey === "stripe") {
    return process.env.NODE_ENV === "production" ? "live" : "test";
  }

  return "placeholder";
}

function providerWarningList({
  configured,
  mode,
  webhookConfigured
}: {
  configured: boolean;
  mode: AdminPaymentProviderControl["providers"][number]["environmentMode"];
  webhookConfigured: boolean | null;
}) {
  const warnings: AdminPaymentProviderControl["providers"][number]["warnings"] = [];

  if (!configured) {
    warnings.push("provider_not_configured");
  }

  if (webhookConfigured === false) {
    warnings.push("webhook_missing");
  }

  if (mode === "test" || mode === "sandbox") {
    warnings.push("test_mode");
  }

  if (mode === "live" && webhookConfigured !== true) {
    warnings.push("live_mode_not_verified");
  }

  return warnings;
}

function recordsFromStoreData(storeData: unknown, key: string): AnyRecord[] {
  if (!isRecord(storeData) || !isRecord(storeData[key])) {
    return [];
  }

  return Object.values(storeData[key]).filter(isRecord);
}

function centsValue(value: unknown) {
  return Math.max(0, Math.round(numberValue(value)));
}

export async function getAdminPaymentProviderControl(): Promise<AdminPaymentProviderControl> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const [
    stores,
    methods,
    connections,
    monitoringEvents,
    billingEvents
  ] = await Promise.all([
    safeSelect(supabase, "stores", "id, owner_user_id, user_id, name, store_name, slug"),
    safeSelect(supabase, "store_payment_methods", "store_id, method, is_enabled"),
    safeSelect(supabase, "store_payment_provider_connections", "store_id, provider, connection_status, config_status, charges_enabled, paypal_status"),
    safeSelect(
      supabase,
      "monitoring_events",
      "event_type, event_status, entity_type, metadata, created_at",
      500
    ),
    safeSelect(supabase, "billing_events", "event_type, provider, payload, processed_at, created_at", 500)
  ]);
  const paymentProviderEvents = monitoringEvents.filter((event) => {
    const eventType = text(event.event_type).toLowerCase();
    const entityType = text(event.entity_type).toLowerCase();

    return entityType.includes("payment") || eventType.includes("payment") || eventType.includes("webhook");
  });
  const billingWebhookEvents = billingEvents.filter((event) => {
    const eventType = text(event.event_type).toLowerCase();

    return eventType.includes("webhook") || eventType.includes("invoice") || eventType.includes("payment");
  });
  const recentEvents = [
    ...paymentProviderEvents.map((event) => ({
      createdAt: text(event.created_at),
      eventStatus: text(event.event_status, "info"),
      eventType: text(event.event_type, "payment_event"),
      provider: text(isRecord(event.metadata) ? event.metadata.provider : null, "store")
    })),
    ...billingWebhookEvents.map((event) => ({
      createdAt: text(event.processed_at) || text(event.created_at),
      eventStatus: text(event.event_type).toLowerCase().includes("failed") ? "failed" : "success",
      eventType: text(event.event_type, "billing_event"),
      provider: text(event.provider, "billing")
    }))
  ].sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt));
  const controlEvents = billingEvents
    .filter((event) => text(event.event_type).startsWith("admin_payment_provider_"))
    .sort((left, right) => dateValue(right.processed_at ?? right.created_at) - dateValue(left.processed_at ?? left.created_at));
  const latestControlByProvider = new Map<string, AnyRecord>();
  for (const event of controlEvents) {
    const payload = isRecord(event.payload) ? event.payload : {};
    const providerKey = text(payload.providerKey);

    if (providerKey && !latestControlByProvider.has(providerKey)) {
      latestControlByProvider.set(providerKey, event);
    }
  }
  const providerDefinitions = [
    {
      key: "stripe",
      name: "Stripe",
      configured: envConfigured(["PLATFORM_BILLING_STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY", "STORE_PAYMENTS_STRIPE_SECRET_KEY", "STRIPE_CONNECT_SECRET_KEY"]),
      webhookConfigured: envConfigured(["PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET"])
    },
    {
      key: "nowpayments",
      name: "NOWPayments",
      configured: envConfigured(["NOWPAYMENTS_API_KEY", "NOWPAYMENTS_IPN_SECRET"]),
      webhookConfigured: envConfigured(["NOWPAYMENTS_IPN_SECRET"])
    },
    {
      key: "paypal",
      name: "PayPal",
      configured: envConfigured(["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_PARTNER_MERCHANT_ID"]),
      webhookConfigured: null
    },
    {
      key: "youcan_pay",
      name: "YouCan Pay",
      configured: envConfigured(["YOUCAN_PAY_API_KEY", "YOUCAN_PAY_SECRET_KEY"]),
      webhookConfigured: null
    },
    {
      key: "bank_transfer",
      name: "Bank Transfer",
      configured: true,
      webhookConfigured: null
    },
    {
      key: "manual_payments",
      name: "Manual Payments",
      configured: true,
      webhookConfigured: null
    }
  ];
  const providers: AdminPaymentProviderControl["providers"] = providerDefinitions.map((provider) => {
    const mode = providerMode(provider.key);
    const warnings = providerWarningList({
      configured: provider.configured,
      mode,
      webhookConfigured: provider.webhookConfigured
    });
    const controlEvent = latestControlByProvider.get(provider.key);
    const controlType = text(controlEvent?.event_type);
    const enabledStatus =
      controlType === "admin_payment_provider_mark_review"
        ? "under_review"
        : controlType === "admin_payment_provider_disable"
          ? "placeholder_disabled"
          : provider.configured
            ? "enabled"
            : "disabled";
    const providerEvents = recentEvents.filter((event) => event.provider === provider.key || event.provider === provider.name.toLowerCase());
    const hasFailures = providerEvents.some((event) => event.eventStatus === "failed");

    return {
      configurationStatus: provider.configured ? "configured" : "missing",
      enabledStatus,
      environmentMode: mode,
      healthStatus:
        enabledStatus === "under_review"
          ? "needs_review"
          : !provider.configured
            ? "missing_config"
            : hasFailures || warnings.length
              ? "warning"
              : "healthy",
      key: provider.key,
      lastEvent: providerEvents[0]?.eventType ?? null,
      name: provider.name,
      warnings,
      webhookStatus:
        provider.webhookConfigured === null
          ? "not_applicable"
          : provider.webhookConfigured
            ? "configured"
            : "missing"
    };
  });
  const enabledMethods = methods.filter((method) => method.is_enabled === true);
  const stripeStores = new Set(
    connections
      .filter(
        (connection) =>
          text(connection.provider) === "stripe" &&
          (text(connection.connection_status) === "connected" || connection.charges_enabled === true)
      )
      .map((connection) => text(connection.store_id))
      .filter(Boolean)
  );
  const paypalStores = new Set(
    connections
      .filter(
        (connection) =>
          text(connection.provider) === "paypal" &&
          (text(connection.connection_status) === "connected" || text(connection.paypal_status) === "connected")
      )
      .map((connection) => text(connection.store_id))
      .filter(Boolean)
  );
  const codStores = new Set(
    enabledMethods
      .filter((method) => text(method.method) === "cod")
      .map((method) => text(method.store_id))
      .filter(Boolean)
  );
  const manualStores = new Set(
    enabledMethods
      .filter((method) => ["cod", "whatsapp"].includes(text(method.method)))
      .map((method) => text(method.store_id))
      .filter(Boolean)
  );
  const storesWithPayment = new Set([
    ...stripeStores,
    ...paypalStores,
    ...manualStores,
    ...enabledMethods.map((method) => text(method.store_id)).filter(Boolean)
  ]);
  const paymentSetupRisks = stores
    .filter((store) => !storesWithPayment.has(text(store.id)))
    .slice(0, 25)
    .map((store) => ({
      id: text(store.id),
      name: text(store.store_name, text(store.name, "Untitled store")),
      ownerEmail: owners.get(ownerUserId(store)) ?? text(ownerUserId(store), "Unknown owner"),
      reason: "No enabled payment method or connected provider found.",
      slug: text(store.slug) || null
    }));

  return {
    paymentSetupRisks,
    providers,
    storePaymentAdoption: {
      codStores: codStores.size,
      manualStores: manualStores.size,
      missingPaymentMethodStores: paymentSetupRisks.length,
      paypalStores: paypalStores.size,
      stripeStores: stripeStores.size,
      totalStores: stores.length
    },
    webhookMonitoring: {
      failedEvents: recentEvents.filter((event) => event.eventStatus === "failed").length,
      recentEvents: recentEvents.slice(0, 20),
      totalEvents: recentEvents.length
    }
  };
}

export async function getAdminDomainsHostingControl(): Promise<AdminDomainsHostingControl> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const [stores, storeDomains] = await Promise.all([
    safeSelect(supabase, "stores", "id, owner_user_id, user_id, name, store_name, slug, store_data, created_at"),
    safeSelect(
      supabase,
      "store_domains",
      "id, store_id, store_instance_id, owner_user_id, hostname, domain_type, status, verification_status, dns_status, ssl_status, is_primary, primary_domain, created_at"
    )
  ]);
  const storeById = new Map(stores.map((store) => [text(store.id), store]));
  const domainOrders: AdminDomainsHostingControl["domainOrders"] = [];
  const emailOrders: AdminDomainsHostingControl["emailOrders"] = [];

  for (const store of stores) {
    const storeId = text(store.id);
    const ownerId = ownerUserId(store);
    const ownerEmail = owners.get(ownerId) ?? text(ownerId, "Unknown owner");
    const storeName = text(store.store_name, text(store.name, "Untitled store"));
    const storeData = store.store_data;

    for (const draft of recordsFromStoreData(storeData, "domainOrderDrafts")) {
      const domain = text(draft.selectedDomain);

      domainOrders.push({
        createdAt: text(draft.createdAt),
        customerDueCents: centsValue(draft.customerDueCents ?? draft.customerDue),
        domain,
        extension: text(draft.extension, domain.includes(".") ? `.${domain.split(".").pop()}` : "unknown"),
        id: text(draft.id, `${storeId}-domain-draft-${domain}`),
        nextStep: text(isRecord(draft.paymentPreparation) ? draft.paymentPreparation.nextStep : null, "Prepare payment or registration workflow"),
        ownerEmail,
        planCreditUsedCents: centsValue(draft.creditUsedCents ?? draft.creditUsed),
        status: text(draft.status, "draft"),
        storeId,
        storeName
      });
    }

    for (const workflow of recordsFromStoreData(storeData, "domainRegistrationWorkflows")) {
      const domain = text(workflow.domain);
      const dnsSetup = isRecord(workflow.dnsSetup) ? workflow.dnsSetup : {};
      const sslSetup = isRecord(workflow.sslSetup) ? workflow.sslSetup : {};

      domainOrders.push({
        createdAt: text(workflow.createdAt),
        customerDueCents: centsValue(workflow.customerDueCents ?? workflow.customerDue),
        domain,
        extension: domain.includes(".") ? `.${domain.split(".").pop()}` : "unknown",
        id: text(workflow.id, `${storeId}-domain-workflow-${domain}`),
        nextStep: text(dnsSetup.status) === "verified" ? "Request SSL placeholder" : "Verify DNS placeholder",
        ownerEmail,
        planCreditUsedCents: 0,
        status: text(workflow.status, "ready_for_registration"),
        storeId,
        storeName
      });

      if (text(sslSetup.status) || text(dnsSetup.status)) {
        // Registration workflows also represent DNS/SSL placeholders before a store_domains row exists.
      }
    }

    for (const draft of [
      ...recordsFromStoreData(storeData, "professionalEmailMailboxDrafts"),
      ...recordsFromStoreData(storeData, "professionalEmailOrderDrafts")
    ]) {
      const emailDnsSetup = isRecord(draft.emailDnsSetup) ? draft.emailDnsSetup : {};
      const mailboxPlan = isRecord(draft.mailboxPlan) ? draft.mailboxPlan : {};

      emailOrders.push({
        activationStatus: text(draft.activationStatus, text(draft.status, "draft")),
        createdAt: text(draft.createdAt),
        dnsStatus: text(emailDnsSetup.status, "dns_pending"),
        domain: text(draft.domain),
        id: text(draft.id, `${storeId}-email-${text(draft.mailboxAddress, text(draft.emailAddress))}`),
        mailboxAddress: text(draft.mailboxAddress, text(draft.emailAddress, "Not prepared")),
        mailboxPlan: text(mailboxPlan.label, text(draft.mailboxType, "Mailbox draft")),
        ownerEmail,
        status: text(draft.status, "draft"),
        storeId,
        storeName
      });
    }
  }

  const sslStatuses: AdminDomainsHostingControl["sslStatuses"] = storeDomains.map((domain) => {
    const store = storeById.get(text(domain.store_id)) ?? storeById.get(text(domain.store_instance_id));

    return {
      dnsStatus: text(domain.dns_status, text(domain.verification_status, "pending")),
      domain: text(domain.hostname, text(domain.primary_domain, "Unknown domain")),
      id: text(domain.id),
      primaryDomainStatus: domain.is_primary === true ? "primary" : "secondary",
      sslStatus: text(domain.ssl_status, "pending"),
      storeName: store ? text(store.store_name, text(store.name, "Untitled store")) : "Unknown store"
    };
  });
  const workflowSslStatuses = stores.flatMap((store) =>
    recordsFromStoreData(store.store_data, "domainRegistrationWorkflows").map((workflow) => {
      const dnsSetup = isRecord(workflow.dnsSetup) ? workflow.dnsSetup : {};
      const sslSetup = isRecord(workflow.sslSetup) ? workflow.sslSetup : {};

      return {
        dnsStatus: text(dnsSetup.status, "not_started"),
        domain: text(workflow.domain, "Pending domain"),
        id: text(workflow.id, `${text(store.id)}-workflow-ssl`),
        primaryDomainStatus: "workflow placeholder",
        sslStatus: text(sslSetup.status, "ssl_pending"),
        storeName: text(store.store_name, text(store.name, "Untitled store"))
      };
    })
  );
  const allSslStatuses = [...sslStatuses, ...workflowSslStatuses];
  const failedDomainOperations = domainOrders.filter((order) => order.status.includes("failed")).length;
  const failedEmailOperations = emailOrders.filter(
    (order) => order.status.includes("failed") || order.activationStatus.includes("failed")
  ).length;

  return {
    domainOrders,
    emailOrders,
    hostingPlaceholder: {
      orders: "No hosting orders are provisioned in this phase.",
      providerHook: "Hosting provider hook is reserved for future implementation.",
      provisioning: "No real hosting provisioning runs from Super Admin."
    },
    overview: {
      connectedDomains: storeDomains.filter(
        (domain) =>
          text(domain.status) === "active" ||
          text(domain.verification_status) === "verified" ||
          text(domain.dns_status) === "verified"
      ).length,
      dnsPending:
        storeDomains.filter((domain) => ["pending", "verifying", "not_configured"].includes(text(domain.dns_status))).length +
        workflowSslStatuses.filter((status) => status.dnsStatus !== "verified").length,
      domainDrafts: stores.reduce(
        (total, store) => total + recordsFromStoreData(store.store_data, "domainOrderDrafts").length,
        0
      ),
      emailMailboxDrafts: emailOrders.length,
      failedOperations: failedDomainOperations + failedEmailOperations + storeDomains.filter((domain) =>
        [text(domain.status), text(domain.verification_status), text(domain.dns_status), text(domain.ssl_status)].includes("failed")
      ).length,
      pendingDomainOrders: domainOrders.filter((order) => order.status === "draft" || order.status.includes("pending")).length,
      readyForRegistration: domainOrders.filter((order) => order.status === "ready_for_registration").length,
      sslPending: allSslStatuses.filter((status) => !["active", "ssl_active", "ready"].includes(status.sslStatus)).length
    },
    platformBalance: {
      note: "Internal Super Admin placeholder only. No provider balance API is connected.",
      status: "blocked_until_future_provider_balance_check"
    },
    providerHealth: [
      { service: "Domain service health", status: "placeholder", note: "No registrar API is called in this phase." },
      { service: "Email service health", status: "placeholder", note: "Mailbox provider checks are reserved." },
      { service: "SSL service health", status: "placeholder", note: "SSL issuance checks are placeholders only." },
      { service: "Hosting service health", status: "placeholder", note: "Hosting provisioning is not implemented yet." }
    ],
    sslStatuses: allSslStatuses
  };
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

export async function getAdminPlatformHealth(): Promise<AdminPlatformHealth> {
  const { supabase } = await getAdminClient();
  const [monitoringEvents, securityEvents, supportTickets] = await Promise.all([
    safeSelect(supabase, "monitoring_events", "event_status, event_type"),
    safeSelect(supabase, "security_audit_logs", "action"),
    safeSelect(supabase, "support_tickets", "status")
  ]);
  const failedMonitoringEvents = monitoringEvents.filter(
    (event) =>
      text(event.event_status) === "failed" ||
      text(event.event_type).toLowerCase().includes("error") ||
      text(event.event_type).toLowerCase().includes("failed")
  ).length;
  const openSupportTickets = supportTickets.filter((ticket) => {
    const status = text(ticket.status).toLowerCase();
    return status !== "resolved" && status !== "closed";
  }).length;

  return {
    failedMonitoringEvents,
    label: failedMonitoringEvents || openSupportTickets ? "Needs review" : "Stable",
    openSupportTickets,
    recentSecurityEvents: securityEvents.length
  };
}
