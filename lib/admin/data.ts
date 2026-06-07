import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBillingPlan } from "@/lib/billing/plans";
import { getAdminAccess } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { aiVisualQueueFromStoreData } from "@/lib/storefront/ai-visual-queue";
import { getAIVisualProviderRuntimeConfig } from "@/lib/storefront/ai-visual-provider";
import { getTemplateLibrary } from "@/lib/storefront/template-library";
import { templatePreviewSummary } from "@/lib/storefront/template-preview-summary";
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

export type AdminIntegrationsControl = {
  categories: string[];
  futureHooks: string[];
  integrations: Array<{
    category: string;
    configurationStatus: "configured" | "missing" | "partial";
    enabledStatus: "disabled" | "enabled" | "under_review";
    healthStatus: "healthy" | "missing_config" | "needs_review" | "placeholder" | "warning";
    key: string;
    lastChecked: string | null;
    mode: "live" | "test" | "sandbox" | "placeholder";
    name: string;
    secretStatus: "masked_configured" | "masked_partial" | "missing" | "no_secret_required";
  }>;
  overview: {
    configured: number;
    missing: number;
    partial: number;
    total: number;
    underReview: number;
    webhookFailures: number;
  };
  webhooks: Array<{
    name: string;
    provider: string;
    recentFailures: number;
    retryStatus: string;
    status: "configured" | "missing" | "placeholder";
  }>;
};

export type AdminAIControl = {
  failureMonitoring: Array<{
    count: number;
    label: string;
    note: string;
  }>;
  futureHooks: string[];
  jobs: Array<{
    assetUrl: string | null;
    completedAt: string | null;
    costEstimate: number;
    createdAt: string;
    errorSummary: string | null;
    id: string;
    jobType: string;
    ownerEmail: string;
    provider: string;
    status: string;
    storeId: string | null;
    storeName: string;
  }>;
  overview: {
    completedJobs: number;
    estimatedCost: number;
    failedJobs: number;
    pendingJobs: number;
    processingJobs: number;
    storesUsingAI: number;
    topAssetTypes: string;
    totalJobs: number;
  };
  providers: Array<{
    configurationStatus: "configured" | "disabled" | "missing";
    costTracking: string;
    healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
    name: string;
    provider: string;
    secretStatus: "masked_configured" | "missing" | "no_secret_required";
  }>;
  storeUsage: Array<{
    completed: number;
    estimatedCost: number;
    failed: number;
    lastActivity: string | null;
    ownerEmail: string;
    storeId: string;
    storeName: string;
    totalJobs: number;
  }>;
};

export type AdminPlatformWebsiteControl = {
  futureHooks: string[];
  landingStatus: Array<{
    label: string;
    ready: boolean;
    route: string;
  }>;
  pages: Array<{
    canonical: string;
    languages: Array<{
      language: "Arabic" | "English" | "French";
      status: "placeholder" | "ready";
    }>;
    lastUpdated: string | null;
    metaDescription: string;
    metaTitle: string;
    openGraph: string;
    previewHref: string | null;
    section: string;
    seoStatus: "needs_metadata" | "placeholder" | "ready";
    slug: string;
    status: "archived" | "draft" | "published";
    title: string;
  }>;
  overview: {
    archivedPages: number;
    draftPages: number;
    publishedPages: number;
    readyLandingPages: number;
    seoReadyPages: number;
    totalPages: number;
  };
};

export type AdminPlatformThemeControl = {
  branding: {
    accentColor: string;
    darkMode: "placeholder";
    favicon: string;
    lightMode: "placeholder";
    logo: string;
    primaryColor: string;
    secondaryColor: string;
    typography: string;
  };
  futureHooks: string[];
  previews: {
    adminDashboard: Array<{
      description: string;
      label: string;
      status: "placeholder" | "ready";
    }>;
    publicWebsite: Array<{
      description: string;
      label: string;
      status: "placeholder" | "ready";
    }>;
  };
  readiness: Array<{
    direction: "LTR" | "RTL";
    language: "Arabic" | "English" | "French";
    status: "placeholder" | "ready";
  }>;
  sections: Array<{
    description: string;
    label: string;
    status: "draft" | "placeholder" | "ready";
    value: string;
  }>;
};

export type AdminTemplateManagementControl = {
  futureHooks: string[];
  overview: {
    activeTemplates: number;
    archivedTemplates: number;
    draftTemplates: number;
    officialTemplates: number;
    resellerVisibleTemplates: number;
    totalTemplates: number;
  };
  templates: Array<{
    badges: {
      official: boolean;
      premium: boolean;
      recommended: boolean;
    };
    category: string;
    createdAt: string | null;
    domainEmailReadiness: "placeholder" | "ready";
    id: string;
    industry: string;
    installedVersionCount: number;
    lastUpdated: string | null;
    name: string;
    packageSummary: {
      aiVisualSupport: boolean;
      blogCount: number;
      categoriesCount: number;
      faqCount: number;
      pagesCount: number;
      productsCount: number;
    };
    packageVersion: number | null;
    previewHref: string;
    status: "active" | "archived" | "draft";
    updateAvailable: "placeholder";
    visibility: "internal" | "marketplace" | "owner" | "reseller";
  }>;
  visibility: {
    hiddenInternal: number;
    ownerVisible: number;
    resellerVisible: number;
  };
};

export type AdminMarketplaceControl = {
  futureHooks: string[];
  items: Array<{
    creator: string;
    id: string;
    installs: number;
    lastUpdated: string | null;
    name: string;
    priceType: "free" | "paid" | "premium" | "subscription";
    revenue: number;
    section: "App Marketplace" | "Plugin Marketplace" | "Service Marketplace" | "Template Marketplace" | "Theme Marketplace";
    status: "approved" | "archived" | "draft" | "pending_review" | "rejected";
    type: "app" | "plugin" | "service" | "template" | "theme";
    visibility: "internal" | "owner" | "public" | "reseller";
  }>;
  overview: {
    approvedItems: number;
    archivedItems: number;
    draftItems: number;
    pendingReviewItems: number;
    rejectedItems: number;
    totalItems: number;
  };
  sections: Array<{
    itemCount: number;
    name: "App Marketplace" | "Plugin Marketplace" | "Service Marketplace" | "Template Marketplace" | "Theme Marketplace";
    status: "placeholder" | "ready";
  }>;
};

export type AdminPlatformMarketingControl = {
  campaigns: Array<{
    endDate: string | null;
    id: string;
    name: string;
    revenueImpact: number;
    section: "Affiliate program" | "Campaigns" | "Gift codes" | "Platform coupons" | "Platform promotions" | "Referral program";
    startDate: string | null;
    status: "active" | "archived" | "draft" | "expired" | "paused";
    targetAudience: string;
    type: "affiliate" | "campaign" | "coupon" | "gift_code" | "promotion" | "referral";
    usage: number;
  }>;
  coupons: Array<{
    amount: string;
    code: string;
    discountType: "fixed" | "percentage" | "plan_credit";
    planEligibility: string;
    status: "active" | "archived" | "draft" | "expired" | "paused";
    usageLimit: string;
  }>;
  futureHooks: string[];
  giftCodes: Array<{
    code: string;
    creditAmount: number;
    planCredit: string;
    redemptionStatus: string;
    status: "active" | "archived" | "draft" | "expired" | "paused";
  }>;
  overview: {
    activeSections: number;
    archivedSections: number;
    draftSections: number;
    expiredSections: number;
    pausedSections: number;
    totalSections: number;
  };
  referralAffiliates: Array<{
    commission: number;
    payoutStatus: string;
    referredUsers: number;
    referrer: string;
    status: "active" | "archived" | "draft" | "expired" | "paused";
    type: "affiliate" | "referral";
  }>;
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

function envConfigurationStatus(names: string[]): AdminIntegrationsControl["integrations"][number]["configurationStatus"] {
  if (!names.length) {
    return "configured";
  }

  const configuredCount = names.filter((name) => Boolean(process.env[name])).length;

  if (configuredCount === names.length) {
    return "configured";
  }

  return configuredCount > 0 ? "partial" : "missing";
}

function integrationSecretStatus(
  names: string[]
): AdminIntegrationsControl["integrations"][number]["secretStatus"] {
  const status = envConfigurationStatus(names);

  if (!names.length) {
    return "no_secret_required";
  }

  if (status === "configured") {
    return "masked_configured";
  }

  return status === "partial" ? "masked_partial" : "missing";
}

function integrationMode(providerKey: string): AdminIntegrationsControl["integrations"][number]["mode"] {
  if (providerKey === "paypal") {
    return process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
  }

  if (["openai", "stripe", "resend", "cloudflare_r2"].includes(providerKey)) {
    return process.env.NODE_ENV === "production" ? "live" : "test";
  }

  return "placeholder";
}

function aiVisualJobCost(job: AnyRecord) {
  const providerPlan = isRecord(job.providerPlan) ? job.providerPlan : {};
  const explicitCost = numberValue(providerPlan.estimatedCostUsd ?? providerPlan.estimatedCost);

  if (explicitCost > 0) {
    return explicitCost;
  }

  const kind = text(job.kind);

  if (kind.includes("hero") || kind.includes("banner")) {
    return 0.08;
  }

  return text(job.status) === "completed" ? 0.04 : 0;
}

function safeAIErrorSummary(value: unknown) {
  const raw = text(value, "").replace(/\s+/g, " ").trim();

  if (!raw) {
    return null;
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .slice(0, 180);
}

function classifyAIError(value: string | null) {
  const error = (value ?? "").toLowerCase();

  if (!error) {
    return "provider_errors";
  }

  if (error.includes("r2") || error.includes("storage") || error.includes("bucket") || error.includes("upload")) {
    return "storage_errors";
  }

  if (error.includes("timeout") || error.includes("timed out")) {
    return "timeout_errors";
  }

  if (error.includes("prompt") || error.includes("invalid") || error.includes("moderation")) {
    return "invalid_prompt_errors";
  }

  return "provider_errors";
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

export async function getAdminIntegrationsControl(): Promise<AdminIntegrationsControl> {
  const { supabase } = await getAdminUsersBase();
  const [monitoringEvents, billingEvents] = await Promise.all([
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500),
    safeSelect(supabase, "billing_events", "event_type, provider, payload, processed_at, created_at", 500)
  ]);
  const definitions: Array<{
    category: string;
    key: string;
    name: string;
    requiredEnv: string[];
  }> = [
    {
      category: "AI Providers",
      key: "openai",
      name: "OpenAI",
      requiredEnv: ["OPENAI_API_KEY"]
    },
    {
      category: "Payment Providers",
      key: "stripe",
      name: "Stripe",
      requiredEnv: ["PLATFORM_BILLING_STRIPE_SECRET_KEY", "PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET"]
    },
    {
      category: "Payment Providers",
      key: "nowpayments",
      name: "NOWPayments",
      requiredEnv: ["NOWPAYMENTS_API_KEY", "NOWPAYMENTS_IPN_SECRET"]
    },
    {
      category: "Payment Providers",
      key: "paypal",
      name: "PayPal",
      requiredEnv: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_PARTNER_MERCHANT_ID"]
    },
    {
      category: "Payment Providers",
      key: "youcan_pay",
      name: "YouCan Pay",
      requiredEnv: ["YOUCAN_PAY_API_KEY", "YOUCAN_PAY_SECRET_KEY"]
    },
    {
      category: "Email Sending Providers",
      key: "resend",
      name: "Resend",
      requiredEnv: ["RESEND_API_KEY", "EMAIL_FROM"]
    },
    {
      category: "Storage Providers",
      key: "cloudflare_r2",
      name: "Cloudflare R2",
      requiredEnv: [
        "CLOUDFLARE_R2_ACCOUNT_ID",
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
        "CLOUDFLARE_R2_BUCKET",
        "CLOUDFLARE_R2_PUBLIC_URL"
      ]
    },
    {
      category: "Domain / Email / Hosting Providers",
      key: "domain_service",
      name: "Domain service",
      requiredEnv: ["HOSTINSH_API_KEY"]
    },
    {
      category: "Domain / Email / Hosting Providers",
      key: "email_service",
      name: "Email service",
      requiredEnv: ["RESEND_API_KEY"]
    },
    {
      category: "Domain / Email / Hosting Providers",
      key: "hosting_service",
      name: "Hosting service",
      requiredEnv: []
    },
    {
      category: "SMS / WhatsApp Providers",
      key: "whatsapp",
      name: "WhatsApp provider",
      requiredEnv: ["WHATSAPP_BUSINESS_API_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]
    },
    {
      category: "SMS / WhatsApp Providers",
      key: "sms",
      name: "SMS provider",
      requiredEnv: ["SMS_PROVIDER_API_KEY"]
    },
    {
      category: "Analytics Providers",
      key: "analytics",
      name: "Analytics provider",
      requiredEnv: ["NEXT_PUBLIC_GA_ID", "NEXT_PUBLIC_META_PIXEL_ID"]
    },
    {
      category: "Webhooks",
      key: "platform_webhooks",
      name: "Platform webhooks",
      requiredEnv: ["STRIPE_WEBHOOK_SECRET", "PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET", "NOWPAYMENTS_IPN_SECRET"]
    }
  ];
  const controlEvents = monitoringEvents
    .filter((event) => text(event.event_type).startsWith("admin_integration_"))
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
  const latestControlByIntegration = new Map<string, AnyRecord>();

  for (const event of controlEvents) {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    const integrationKey = text(metadata.integration_key);

    if (integrationKey && !latestControlByIntegration.has(integrationKey)) {
      latestControlByIntegration.set(integrationKey, event);
    }
  }

  const providerEventDates = new Map<string, string>();
  const providerFailures = new Map<string, number>();
  const recordProviderSignal = ({
    createdAt,
    failed,
    provider
  }: {
    createdAt: string;
    failed: boolean;
    provider: string;
  }) => {
    const key = provider.toLowerCase();

    if (!key) {
      return;
    }

    if (!providerEventDates.has(key) || dateValue(createdAt) > dateValue(providerEventDates.get(key))) {
      providerEventDates.set(key, createdAt);
    }

    if (failed) {
      providerFailures.set(key, (providerFailures.get(key) ?? 0) + 1);
    }
  };

  for (const event of monitoringEvents) {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    recordProviderSignal({
      createdAt: text(event.created_at),
      failed: text(event.event_status) === "failed",
      provider: text(metadata.provider, text(event.entity_type))
    });
  }

  for (const event of billingEvents) {
    recordProviderSignal({
      createdAt: text(event.processed_at) || text(event.created_at),
      failed: text(event.event_type).toLowerCase().includes("failed"),
      provider: text(event.provider)
    });
  }

  const integrations: AdminIntegrationsControl["integrations"] = definitions.map((definition) => {
    const configurationStatus = envConfigurationStatus(definition.requiredEnv);
    const controlEvent = latestControlByIntegration.get(definition.key);
    const controlType = text(controlEvent?.event_type);
    const providerLookupKeys = [
      definition.key,
      definition.name.toLowerCase(),
      definition.key.replace(/_/g, "")
    ];
    const lastChecked =
      text(controlEvent?.created_at) ||
      providerLookupKeys.map((key) => providerEventDates.get(key)).find(Boolean) ||
      null;
    const hasFailures = providerLookupKeys.some((key) => (providerFailures.get(key) ?? 0) > 0);
    const enabledStatus =
      controlType === "admin_integration_mark_review"
        ? "under_review"
        : configurationStatus === "missing"
          ? "disabled"
          : "enabled";
    const healthStatus =
      enabledStatus === "under_review"
        ? "needs_review"
        : configurationStatus === "missing"
          ? "missing_config"
          : configurationStatus === "partial" || hasFailures
            ? "warning"
            : definition.requiredEnv.length
              ? "healthy"
              : "placeholder";

    return {
      category: definition.category,
      configurationStatus,
      enabledStatus,
      healthStatus,
      key: definition.key,
      lastChecked,
      mode: integrationMode(definition.key),
      name: definition.name,
      secretStatus: integrationSecretStatus(definition.requiredEnv)
    };
  });
  const webhooks: AdminIntegrationsControl["webhooks"] = [
    {
      name: "Stripe billing webhook",
      provider: "Stripe",
      recentFailures: providerFailures.get("stripe") ?? 0,
      retryStatus: "retry_placeholder_only",
      status: envConfigured(["STRIPE_WEBHOOK_SECRET", "PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET"]) ? "configured" : "missing"
    },
    {
      name: "NOWPayments IPN",
      provider: "NOWPayments",
      recentFailures: providerFailures.get("nowpayments") ?? 0,
      retryStatus: "retry_placeholder_only",
      status: envConfigured(["NOWPAYMENTS_IPN_SECRET"]) ? "configured" : "missing"
    },
    {
      name: "Store payment webhooks",
      provider: "Store payments",
      recentFailures: providerFailures.get("store_payments") ?? 0,
      retryStatus: "retry_placeholder_only",
      status: "placeholder"
    },
    {
      name: "Domain/email/hosting webhooks",
      provider: "Domain & Hosting",
      recentFailures: providerFailures.get("domain_service") ?? 0,
      retryStatus: "retry_placeholder_only",
      status: "placeholder"
    }
  ];
  const categories = [...new Set(definitions.map((definition) => definition.category))];

  return {
    categories,
    futureHooks: [
      "Test connection",
      "Rotate secret",
      "Disable provider",
      "Enable provider",
      "Sync provider status",
      "Export integration report"
    ],
    integrations,
    overview: {
      configured: integrations.filter((integration) => integration.configurationStatus === "configured").length,
      missing: integrations.filter((integration) => integration.configurationStatus === "missing").length,
      partial: integrations.filter((integration) => integration.configurationStatus === "partial").length,
      total: integrations.length,
      underReview: integrations.filter((integration) => integration.enabledStatus === "under_review").length,
      webhookFailures: webhooks.reduce((total, webhook) => total + webhook.recentFailures, 0)
    },
    webhooks
  };
}

export async function getAdminAIControl(): Promise<AdminAIControl> {
  const { supabase, users } = await getAdminUsersBase();
  const owners = emailMap(users);
  const [stores, legacyQueues, legacyResults, monitoringEvents] = await Promise.all([
    safeSelect(supabase, "stores", "id, owner_user_id, user_id, name, store_name, slug, store_data, created_at"),
    safeSelect(
      supabase,
      "ai_generation_queue",
      "id, store_instance_id, owner_user_id, workflow_state, queue_status, attempts, max_attempts, completed_at, failed_at, error_message, created_at, updated_at",
      500
    ),
    safeSelect(
      supabase,
      "ai_generation_results",
      "id, store_instance_id, owner_user_id, result_status, cost_estimate, metadata, created_at, updated_at",
      500
    ),
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500)
  ]);
  const storeById = new Map(stores.map((store) => [text(store.id), store]));
  const jobs: AdminAIControl["jobs"] = [];

  for (const store of stores) {
    const storeId = text(store.id);
    const queue = aiVisualQueueFromStoreData(store.store_data);
    const ownerId = ownerUserId(store);
    const ownerEmail = owners.get(ownerId) ?? text(ownerId, "Unknown owner");
    const storeName = text(store.store_name, text(store.name, text(store.slug, "Untitled store")));

    for (const job of Object.values(queue.jobs) as AnyRecord[]) {
      const result = isRecord(job.result) ? job.result : {};
      const asset = isRecord(result.asset) ? result.asset : {};
      const errorSummary = safeAIErrorSummary(job.error);

      jobs.push({
        assetUrl: text(result.publicUrl) || text(asset.publicUrl) || text(asset.url) || null,
        completedAt: text(job.completedAt) || null,
        costEstimate: aiVisualJobCost(job),
        createdAt: text(job.createdAt, text(store.created_at)),
        errorSummary,
        id: text(job.jobId, text(job.requestId, `${storeId}-ai-visual-job`)),
        jobType: text(job.kind, text(job.slot, "ai_visual")),
        ownerEmail,
        provider: text(job.provider, "ai_visual_provider"),
        status: text(job.status, "pending"),
        storeId,
        storeName
      });
    }
  }

  for (const queue of legacyQueues) {
    const storeId = text(queue.store_instance_id);
    const store = storeById.get(storeId);
    const ownerId = text(queue.owner_user_id) || (store ? ownerUserId(store) : "");
    const ownerEmail = owners.get(ownerId) ?? text(ownerId, "Unknown owner");
    const status = text(queue.queue_status, text(queue.workflow_state, "waiting"));
    const errorSummary = safeAIErrorSummary(queue.error_message);

    jobs.push({
      assetUrl: null,
      completedAt: text(queue.completed_at) || text(queue.failed_at) || null,
      costEstimate: 0,
      createdAt: text(queue.created_at),
      errorSummary,
      id: text(queue.id),
      jobType: text(queue.workflow_state, "store_generation"),
      ownerEmail,
      provider: "workflow_placeholder",
      status,
      storeId: storeId || null,
      storeName: store ? text(store.store_name, text(store.name, "Untitled store")) : "AI workflow"
    });
  }

  for (const result of legacyResults) {
    const status = text(result.result_status);

    if (status !== "failed" && status !== "succeeded") {
      continue;
    }

    const storeId = text(result.store_instance_id);
    const store = storeById.get(storeId);
    const ownerId = text(result.owner_user_id) || (store ? ownerUserId(store) : "");
    const ownerEmail = owners.get(ownerId) ?? text(ownerId, "Unknown owner");
    const costEstimate = isRecord(result.cost_estimate)
      ? numberValue(result.cost_estimate.totalUsd ?? result.cost_estimate.estimatedUsd ?? result.cost_estimate.total)
      : 0;

    jobs.push({
      assetUrl: null,
      completedAt: text(result.updated_at) || null,
      costEstimate,
      createdAt: text(result.created_at),
      errorSummary: status === "failed" ? "Legacy AI generation result failed." : null,
      id: text(result.id),
      jobType: "legacy_ai_generation_result",
      ownerEmail,
      provider: "ai_result_placeholder",
      status: status === "succeeded" ? "completed" : "failed",
      storeId: storeId || null,
      storeName: store ? text(store.store_name, text(store.name, "Untitled store")) : "AI result"
    });
  }

  jobs.sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt));
  const jobsByStore = new Map<string, AdminAIControl["storeUsage"][number]>();

  for (const job of jobs) {
    if (!job.storeId) {
      continue;
    }

    const current = jobsByStore.get(job.storeId) ?? {
      completed: 0,
      estimatedCost: 0,
      failed: 0,
      lastActivity: null,
      ownerEmail: job.ownerEmail,
      storeId: job.storeId,
      storeName: job.storeName,
      totalJobs: 0
    };

    current.totalJobs += 1;
    current.completed += job.status === "completed" || job.status === "succeeded" ? 1 : 0;
    current.failed += job.status === "failed" ? 1 : 0;
    current.estimatedCost += job.costEstimate;
    current.lastActivity =
      !current.lastActivity || dateValue(job.createdAt) > dateValue(current.lastActivity)
        ? job.createdAt
        : current.lastActivity;
    jobsByStore.set(job.storeId, current);
  }

  const assetTypeCounts = countBy(jobs.map((job) => ({ jobType: job.jobType })), "jobType");
  const topAssetTypes = [...assetTypeCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([assetType, count]) => `${assetType} (${count})`)
    .join(", ") || "No AI assets yet";
  const failureCounts = new Map<string, number>([
    ["provider_errors", 0],
    ["storage_errors", 0],
    ["timeout_errors", 0],
    ["invalid_prompt_errors", 0]
  ]);

  for (const job of jobs.filter((item) => item.status === "failed")) {
    const key = classifyAIError(job.errorSummary);
    failureCounts.set(key, (failureCounts.get(key) ?? 0) + 1);
  }

  for (const event of monitoringEvents) {
    const eventType = text(event.event_type).toLowerCase();
    const entityType = text(event.entity_type).toLowerCase();

    if ((eventType.includes("ai") || entityType.includes("ai")) && text(event.event_status) === "failed") {
      failureCounts.set("provider_errors", (failureCounts.get("provider_errors") ?? 0) + 1);
    }
  }

  const runtime = getAIVisualProviderRuntimeConfig();
  const openAIConfigured = runtime.apiKeyConfigured && runtime.status === "configured";

  return {
    failureMonitoring: [
      { count: jobs.filter((job) => job.status === "failed").length, label: "Failed jobs", note: "Failed AI visual and legacy AI workflow jobs." },
      { count: failureCounts.get("provider_errors") ?? 0, label: "Provider errors", note: "Provider or generic AI failures from safe metadata." },
      { count: failureCounts.get("storage_errors") ?? 0, label: "Storage errors", note: "R2/storage/upload related failures." },
      { count: failureCounts.get("timeout_errors") ?? 0, label: "Timeout errors", note: "Jobs that timed out or exceeded processing limits." },
      { count: failureCounts.get("invalid_prompt_errors") ?? 0, label: "Invalid prompt/errors", note: "Prompt, moderation, or invalid request failures." }
    ],
    futureHooks: [
      "Pause AI provider",
      "Disable AI for store",
      "Retry failed job",
      "Export AI usage report",
      "Cost limit enforcement"
    ],
    jobs: jobs.slice(0, 100),
    overview: {
      completedJobs: jobs.filter((job) => job.status === "completed" || job.status === "succeeded").length,
      estimatedCost: jobs.reduce((total, job) => total + job.costEstimate, 0),
      failedJobs: jobs.filter((job) => job.status === "failed").length,
      pendingJobs: jobs.filter((job) => job.status === "pending" || job.status === "waiting").length,
      processingJobs: jobs.filter((job) => job.status === "processing" || job.status === "active").length,
      storesUsingAI: jobsByStore.size,
      topAssetTypes,
      totalJobs: jobs.length
    },
    providers: [
      {
        configurationStatus:
          runtime.status === "disabled" ? "disabled" : openAIConfigured ? "configured" : "missing",
        costTracking: "estimated_from_safe_job_metadata",
        healthStatus:
          runtime.status === "disabled"
            ? "placeholder"
            : openAIConfigured
              ? "healthy"
              : "missing_config",
        name: "OpenAI",
        provider: runtime.provider,
        secretStatus: openAIConfigured ? "masked_configured" : "missing"
      },
      {
        configurationStatus: "disabled",
        costTracking: "future_provider_placeholder",
        healthStatus: "placeholder",
        name: "Future AI providers",
        provider: "replicate/stability/custom",
        secretStatus: "no_secret_required"
      }
    ],
    storeUsage: [...jobsByStore.values()]
      .sort((left, right) => right.totalJobs - left.totalJobs)
      .slice(0, 50)
  };
}

export async function getAdminPlatformWebsiteControl(): Promise<AdminPlatformWebsiteControl> {
  const { supabase } = await getAdminUsersBase();
  const monitoringEvents = await safeSelect(
    supabase,
    "monitoring_events",
    "event_type, event_status, entity_type, metadata, created_at",
    300
  );
  const controlEvents = monitoringEvents
    .filter((event) => text(event.event_type).startsWith("admin_platform_page_"))
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
  const latestBySlug = new Map<string, AnyRecord>();

  for (const event of controlEvents) {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    const slug = text(metadata.slug);

    if (slug && !latestBySlug.has(slug)) {
      latestBySlug.set(slug, event);
    }
  }

  const pageDefinitions = [
    {
      canonical: "/",
      metaDescription: "SHASTORE AI helps sellers launch ecommerce storefronts with templates, AI visuals, billing, domains, and checkout foundations.",
      metaTitle: "SHASTORE AI - AI ecommerce storefront platform",
      openGraph: "Homepage OG placeholder",
      previewHref: "/",
      section: "Homepage",
      seoStatus: "ready" as const,
      slug: "/",
      status: "published" as const,
      title: "Homepage"
    },
    {
      canonical: "/pricing",
      metaDescription: "Simple SHASTORE AI plans for launching and scaling ecommerce stores.",
      metaTitle: "Pricing - SHASTORE AI",
      openGraph: "Pricing OG placeholder",
      previewHref: "/pricing",
      section: "Pricing Page",
      seoStatus: "ready" as const,
      slug: "/pricing",
      status: "published" as const,
      title: "Pricing Page"
    },
    {
      canonical: "/features",
      metaDescription: "Platform features overview placeholder for SHASTORE AI.",
      metaTitle: "Features - SHASTORE AI",
      openGraph: "Features OG placeholder",
      previewHref: null,
      section: "Features Page",
      seoStatus: "placeholder" as const,
      slug: "/features",
      status: "draft" as const,
      title: "Features Page"
    },
    {
      canonical: "/about",
      metaDescription: "About SHASTORE AI platform placeholder.",
      metaTitle: "About Us - SHASTORE AI",
      openGraph: "About OG placeholder",
      previewHref: null,
      section: "About Us",
      seoStatus: "placeholder" as const,
      slug: "/about",
      status: "draft" as const,
      title: "About Us"
    },
    {
      canonical: "/contact",
      metaDescription: "Contact SHASTORE AI platform placeholder.",
      metaTitle: "Contact Us - SHASTORE AI",
      openGraph: "Contact OG placeholder",
      previewHref: null,
      section: "Contact Us",
      seoStatus: "placeholder" as const,
      slug: "/contact",
      status: "draft" as const,
      title: "Contact Us"
    },
    {
      canonical: "/blog",
      metaDescription: "SHASTORE AI blog placeholder.",
      metaTitle: "Blog - SHASTORE AI",
      openGraph: "Blog OG placeholder",
      previewHref: null,
      section: "Blog",
      seoStatus: "placeholder" as const,
      slug: "/blog",
      status: "draft" as const,
      title: "Blog"
    },
    {
      canonical: "/affiliates",
      metaDescription: "SHASTORE AI affiliate program placeholder.",
      metaTitle: "Affiliates - SHASTORE AI",
      openGraph: "Affiliates OG placeholder",
      previewHref: null,
      section: "Affiliates Page",
      seoStatus: "placeholder" as const,
      slug: "/affiliates",
      status: "draft" as const,
      title: "Affiliates Page"
    },
    {
      canonical: "/reseller",
      metaDescription: "SHASTORE AI reseller program public entry point.",
      metaTitle: "Reseller Program - SHASTORE AI",
      openGraph: "Reseller OG placeholder",
      previewHref: "/reseller",
      section: "Reseller Program Page",
      seoStatus: "placeholder" as const,
      slug: "/reseller",
      status: "published" as const,
      title: "Reseller Program Page"
    },
    {
      canonical: "/careers",
      metaDescription: "SHASTORE AI careers placeholder.",
      metaTitle: "Careers - SHASTORE AI",
      openGraph: "Careers OG placeholder",
      previewHref: null,
      section: "Careers Page",
      seoStatus: "placeholder" as const,
      slug: "/careers",
      status: "draft" as const,
      title: "Careers Page"
    },
    {
      canonical: "/legal",
      metaDescription: "Platform legal pages placeholder for SHASTORE AI.",
      metaTitle: "Legal - SHASTORE AI",
      openGraph: "Legal OG placeholder",
      previewHref: null,
      section: "Legal Pages",
      seoStatus: "needs_metadata" as const,
      slug: "/legal",
      status: "draft" as const,
      title: "Legal Pages"
    }
  ];
  const pages: AdminPlatformWebsiteControl["pages"] = pageDefinitions.map((page) => {
    const event = latestBySlug.get(page.slug);
    const eventType = text(event?.event_type);
    const eventStatus =
      eventType === "admin_platform_page_mark_draft"
        ? "draft"
        : eventType === "admin_platform_page_mark_published"
          ? "published"
          : eventType === "admin_platform_page_archive"
            ? "archived"
            : page.status;

    return {
      ...page,
      languages: [
        { language: "Arabic", status: "placeholder" },
        { language: "English", status: page.status === "published" ? "ready" : "placeholder" },
        { language: "French", status: "placeholder" }
      ],
      lastUpdated: text(event?.created_at) || null,
      status: eventStatus
    };
  });
  const readySlugs = new Set(pages.filter((page) => page.status === "published").map((page) => page.slug));
  const landingStatus = [
    { label: "Homepage ready", ready: readySlugs.has("/"), route: "/" },
    { label: "Pricing ready", ready: readySlugs.has("/pricing"), route: "/pricing" },
    { label: "Features ready", ready: readySlugs.has("/features"), route: "/features" },
    { label: "Contact ready", ready: readySlugs.has("/contact"), route: "/contact" },
    { label: "Legal ready", ready: readySlugs.has("/legal"), route: "/legal" },
    { label: "Reseller page ready", ready: readySlugs.has("/reseller"), route: "/reseller" }
  ];

  return {
    futureHooks: [
      "Platform page editor",
      "Platform blog editor",
      "Landing page builder",
      "SEO generator",
      "Translation workflow",
      "Publish workflow"
    ],
    landingStatus,
    overview: {
      archivedPages: pages.filter((page) => page.status === "archived").length,
      draftPages: pages.filter((page) => page.status === "draft").length,
      publishedPages: pages.filter((page) => page.status === "published").length,
      readyLandingPages: landingStatus.filter((item) => item.ready).length,
      seoReadyPages: pages.filter((page) => page.seoStatus === "ready").length,
      totalPages: pages.length
    },
    pages
  };
}

export async function getAdminPlatformThemeControl(): Promise<AdminPlatformThemeControl> {
  const { supabase } = await getAdminUsersBase();
  const monitoringEvents = await safeSelect(
    supabase,
    "monitoring_events",
    "event_type, event_status, entity_type, metadata, created_at",
    100
  );
  const latestThemeAction = monitoringEvents
    .filter((event) => text(event.event_type).startsWith("admin_platform_theme_"))
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at))[0];
  const isDraftSaved = Boolean(latestThemeAction);
  const branding: AdminPlatformThemeControl["branding"] = {
    accentColor: "#f97316",
    darkMode: "placeholder",
    favicon: "Platform favicon placeholder",
    lightMode: "placeholder",
    logo: "SHASTORE AI",
    primaryColor: "#0f172a",
    secondaryColor: "#2563eb",
    typography: "Inter / system sans"
  };

  return {
    branding,
    futureHooks: [
      "Upload logo",
      "Upload favicon",
      "Theme preset manager",
      "White-label platform branding",
      "Reseller branding inheritance"
    ],
    previews: {
      adminDashboard: [
        {
          description: "Sidebar preview uses platform admin navigation styling only.",
          label: "Sidebar preview",
          status: "ready"
        },
        {
          description: "Card preview mirrors current Super Admin card surfaces.",
          label: "Card preview",
          status: "ready"
        },
        {
          description: "Badge preview uses existing AdminBadge tones.",
          label: "Badge preview",
          status: "ready"
        },
        {
          description: "Button preview is a placeholder for future admin button theming.",
          label: "Button preview",
          status: "placeholder"
        }
      ],
      publicWebsite: [
        {
          description: "Navbar preview mirrors SHASTORE platform marketing navigation.",
          label: "Navbar preview",
          status: "ready"
        },
        {
          description: "Hero preview shows platform public website direction, not a store template.",
          label: "Hero preview",
          status: "ready"
        },
        {
          description: "Button preview uses platform CTA colors.",
          label: "Button preview",
          status: "ready"
        },
        {
          description: "Footer preview is reserved until platform footer management is built.",
          label: "Footer preview",
          status: "placeholder"
        }
      ]
    },
    readiness: [
      { direction: "RTL", language: "Arabic", status: "placeholder" },
      { direction: "LTR", language: "English", status: "ready" },
      { direction: "LTR", language: "French", status: "placeholder" }
    ],
    sections: [
      {
        description: "Text/logo mark for SHASTORE SaaS interface and public platform website.",
        label: "Platform logo",
        status: isDraftSaved ? "draft" : "ready",
        value: branding.logo
      },
      {
        description: "Favicon placeholder only; upload workflow is not connected yet.",
        label: "Favicon",
        status: "placeholder",
        value: branding.favicon
      },
      {
        description: "Primary platform brand color for admin/public chrome.",
        label: "Primary color",
        status: "ready",
        value: branding.primaryColor
      },
      {
        description: "Secondary platform brand color for links and supporting CTAs.",
        label: "Secondary color",
        status: "ready",
        value: branding.secondaryColor
      },
      {
        description: "Accent color reserved for highlights and marketing moments.",
        label: "Accent color",
        status: "ready",
        value: branding.accentColor
      },
      {
        description: "Platform typography stack for SaaS UI and marketing pages.",
        label: "Typography",
        status: "ready",
        value: branding.typography
      },
      {
        description: "Dark mode is reserved and does not change live UI yet.",
        label: "Dark mode placeholder",
        status: "placeholder",
        value: branding.darkMode
      },
      {
        description: "Light mode is the current platform baseline.",
        label: "Light mode placeholder",
        status: "placeholder",
        value: branding.lightMode
      }
    ]
  };
}

export async function getAdminTemplateManagementControl(): Promise<AdminTemplateManagementControl> {
  const { supabase } = await getAdminUsersBase();
  const [library, stores, monitoringEvents] = await Promise.all([
    getTemplateLibrary(),
    safeSelect(supabase, "stores", "id, template_id, store_data, created_at, updated_at", 1000),
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500)
  ]);
  const templateEvents = monitoringEvents
    .filter((event) => text(event.event_type).startsWith("admin_template_"))
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
  const latestEventsByTemplate = new Map<string, AnyRecord[]>();

  for (const event of templateEvents) {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    const templateId = text(metadata.template_id);

    if (!templateId) {
      continue;
    }

    latestEventsByTemplate.set(templateId, [...(latestEventsByTemplate.get(templateId) ?? []), event]);
  }

  const installedVersionsByTemplate = new Map<string, Set<string>>();

  for (const store of stores) {
    const storeData = isRecord(store.store_data) ? store.store_data : {};
    const installed = isRecord(storeData.installedTemplatePackage) ? storeData.installedTemplatePackage : {};
    const installedTemplateId = text(installed.templateId, text(store.template_id));
    const version = text(installed.packageVersion, text(installed.packageId, "legacy"));

    if (installedTemplateId) {
      const versions = installedVersionsByTemplate.get(installedTemplateId) ?? new Set<string>();
      versions.add(version);
      installedVersionsByTemplate.set(installedTemplateId, versions);
    }
  }

  const templates: AdminTemplateManagementControl["templates"] = library.templates.map((template) => {
    const summary = templatePreviewSummary(template);
    const events = latestEventsByTemplate.get(template.id) ?? [];
    const latestStatusEvent = events.find((event) =>
      ["admin_template_activate", "admin_template_archive"].includes(text(event.event_type))
    );
    const latestVisibilityEvent = events.find((event) => text(event.event_type) === "admin_template_set_visibility");
    const latestOfficialEvent = events.find((event) => text(event.event_type) === "admin_template_mark_official");
    const latestRecommendedEvent = events.find((event) => text(event.event_type) === "admin_template_mark_recommended");
    const visibilityMetadata = isRecord(latestVisibilityEvent?.metadata) ? latestVisibilityEvent.metadata : {};
    const status =
      text(latestStatusEvent?.event_type) === "admin_template_archive"
        ? "archived"
        : template.is_active
          ? "active"
          : "draft";
    const visibility = ((): AdminTemplateManagementControl["templates"][number]["visibility"] => {
      const requested = text(visibilityMetadata.visibility);

      if (requested === "owner" || requested === "reseller" || requested === "marketplace" || requested === "internal") {
        return requested;
      }

      if (status === "archived") {
        return "internal";
      }

      return template.is_official ? "marketplace" : "owner";
    })();
    const official = template.is_official || Boolean(latestOfficialEvent);
    const recommended = template.is_recommended || Boolean(latestRecommendedEvent);

    return {
      badges: {
        official,
        premium: summary.hasPackage || summary.hasAIVisualSupport || template.package_enabled,
        recommended
      },
      category: text(template.category_key, text(template.category, "general")),
      createdAt: null,
      domainEmailReadiness: summary.hasPackage ? "ready" : "placeholder",
      id: template.id,
      industry: text(template.industry, text(template.niche_category, "general")),
      installedVersionCount: installedVersionsByTemplate.get(template.id)?.size ?? 0,
      lastUpdated: text(events[0]?.created_at) || null,
      name: template.name,
      packageSummary: {
        aiVisualSupport: summary.hasAIVisualSupport,
        blogCount: summary.blogArticleCount,
        categoriesCount: summary.categoryCount,
        faqCount: summary.faqCount,
        pagesCount: summary.customPageCount + summary.legalPageCount + summary.homepageSectionCount,
        productsCount: summary.productCount
      },
      packageVersion: summary.packageVersion ?? template.package_version ?? null,
      previewHref: `/templates/preview/${encodeURIComponent(template.id)}`,
      status,
      updateAvailable: "placeholder",
      visibility
    };
  });

  return {
    futureHooks: [
      "Create new template",
      "Upload template preview",
      "Approve marketplace template",
      "Publish template update",
      "Reseller exclusive templates"
    ],
    overview: {
      activeTemplates: templates.filter((template) => template.status === "active").length,
      archivedTemplates: templates.filter((template) => template.status === "archived").length,
      draftTemplates: templates.filter((template) => template.status === "draft").length,
      officialTemplates: templates.filter((template) => template.badges.official).length,
      resellerVisibleTemplates: templates.filter((template) => template.visibility === "reseller").length,
      totalTemplates: templates.length
    },
    templates,
    visibility: {
      hiddenInternal: templates.filter((template) => template.visibility === "internal").length,
      ownerVisible: templates.filter((template) => template.visibility === "owner" || template.visibility === "marketplace").length,
      resellerVisible: templates.filter((template) => template.visibility === "reseller").length
    }
  };
}

export async function getAdminMarketplaceControl(): Promise<AdminMarketplaceControl> {
  const { supabase } = await getAdminUsersBase();
  const [templateControl, monitoringEvents] = await Promise.all([
    getAdminTemplateManagementControl(),
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500)
  ]);
  const marketplaceEvents = monitoringEvents
    .filter((event) => text(event.event_type).startsWith("admin_marketplace_"))
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
  const latestEventByItem = new Map<string, AnyRecord>();

  for (const event of marketplaceEvents) {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    const itemId = text(metadata.item_id);

    if (itemId && !latestEventByItem.has(itemId)) {
      latestEventByItem.set(itemId, event);
    }
  }

  function statusFromEvent(
    itemId: string,
    fallback: AdminMarketplaceControl["items"][number]["status"]
  ): AdminMarketplaceControl["items"][number]["status"] {
    const eventType = text(latestEventByItem.get(itemId)?.event_type);

    if (eventType === "admin_marketplace_approve_item") {
      return "approved";
    }

    if (eventType === "admin_marketplace_reject_item") {
      return "rejected";
    }

    if (eventType === "admin_marketplace_mark_review") {
      return "pending_review";
    }

    if (eventType === "admin_marketplace_archive_item") {
      return "archived";
    }

    return fallback;
  }

  const templateItems: AdminMarketplaceControl["items"] = templateControl.templates.map((template) => {
    const itemId = `template:${template.id}`;
    const fallbackStatus =
      template.status === "archived" ? "archived" : template.status === "active" ? "approved" : "draft";
    const visibility =
      template.visibility === "marketplace"
        ? "public"
        : template.visibility === "internal"
          ? "internal"
          : template.visibility === "reseller"
            ? "reseller"
            : "owner";

    return {
      creator: template.badges.official ? "SHASTORE official" : "Existing template library",
      id: itemId,
      installs: template.installedVersionCount,
      lastUpdated: template.lastUpdated,
      name: template.name,
      priceType: template.badges.premium ? "premium" : "free",
      revenue: 0,
      section: "Template Marketplace",
      status: statusFromEvent(itemId, fallbackStatus),
      type: "template",
      visibility
    };
  });
  const placeholderItems: AdminMarketplaceControl["items"] = [
    {
      creator: "SHASTORE platform",
      id: "theme:platform-brand-pack",
      installs: 0,
      lastUpdated: null,
      name: "Platform Brand Theme Pack",
      priceType: "premium",
      revenue: 0,
      section: "Theme Marketplace",
      status: statusFromEvent("theme:platform-brand-pack", "draft"),
      type: "theme",
      visibility: "internal"
    },
    {
      creator: "SHASTORE platform",
      id: "plugin:loyalty-foundation",
      installs: 0,
      lastUpdated: null,
      name: "Loyalty Plugin Foundation",
      priceType: "subscription",
      revenue: 0,
      section: "Plugin Marketplace",
      status: statusFromEvent("plugin:loyalty-foundation", "pending_review"),
      type: "plugin",
      visibility: "internal"
    },
    {
      creator: "SHASTORE platform",
      id: "app:analytics-connector",
      installs: 0,
      lastUpdated: null,
      name: "Analytics Connector App",
      priceType: "paid",
      revenue: 0,
      section: "App Marketplace",
      status: statusFromEvent("app:analytics-connector", "draft"),
      type: "app",
      visibility: "internal"
    },
    {
      creator: "SHASTORE services",
      id: "service:store-launch-assistance",
      installs: 0,
      lastUpdated: null,
      name: "Store Launch Assistance",
      priceType: "paid",
      revenue: 0,
      section: "Service Marketplace",
      status: statusFromEvent("service:store-launch-assistance", "draft"),
      type: "service",
      visibility: "internal"
    }
  ];
  const items = [...templateItems, ...placeholderItems];
  const sectionNames: AdminMarketplaceControl["sections"][number]["name"][] = [
    "Template Marketplace",
    "Theme Marketplace",
    "Plugin Marketplace",
    "App Marketplace",
    "Service Marketplace"
  ];

  return {
    futureHooks: [
      "Creator accounts",
      "Marketplace payouts",
      "App/plugin installation",
      "Template sales",
      "Reseller-exclusive marketplace items",
      "Reviews and ratings",
      "Revenue sharing"
    ],
    items,
    overview: {
      approvedItems: items.filter((item) => item.status === "approved").length,
      archivedItems: items.filter((item) => item.status === "archived").length,
      draftItems: items.filter((item) => item.status === "draft").length,
      pendingReviewItems: items.filter((item) => item.status === "pending_review").length,
      rejectedItems: items.filter((item) => item.status === "rejected").length,
      totalItems: items.length
    },
    sections: sectionNames.map((name) => ({
      itemCount: items.filter((item) => item.section === name).length,
      name,
      status: name === "Template Marketplace" ? "ready" : "placeholder"
    }))
  };
}

export async function getAdminPlatformMarketingControl(): Promise<AdminPlatformMarketingControl> {
  const { supabase } = await getAdminUsersBase();
  const monitoringEvents = await safeSelect(
    supabase,
    "monitoring_events",
    "event_type, event_status, entity_type, metadata, created_at",
    500
  );
  const marketingEvents = monitoringEvents
    .filter((event) => text(event.event_type).startsWith("admin_platform_marketing_"))
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
  const latestEventByCampaign = new Map<string, AnyRecord>();

  for (const event of marketingEvents) {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    const campaignId = text(metadata.campaign_id);

    if (campaignId && !latestEventByCampaign.has(campaignId)) {
      latestEventByCampaign.set(campaignId, event);
    }
  }

  function campaignStatus(
    campaignId: string,
    fallback: AdminPlatformMarketingControl["campaigns"][number]["status"]
  ): AdminPlatformMarketingControl["campaigns"][number]["status"] {
    const eventType = text(latestEventByCampaign.get(campaignId)?.event_type);

    if (eventType === "admin_platform_marketing_activate_campaign") {
      return "active";
    }

    if (eventType === "admin_platform_marketing_archive_campaign") {
      return "archived";
    }

    if (eventType === "admin_platform_marketing_create_draft") {
      return "draft";
    }

    if (eventType === "admin_platform_marketing_pause_campaign") {
      return "paused";
    }

    return fallback;
  }

  const campaigns: AdminPlatformMarketingControl["campaigns"] = [
    {
      endDate: null,
      id: "platform-coupon:welcome-plan-credit",
      name: "Welcome Plan Credit",
      revenueImpact: 0,
      section: "Platform coupons",
      startDate: null,
      status: campaignStatus("platform-coupon:welcome-plan-credit", "draft"),
      targetAudience: "New SHASTORE platform subscribers",
      type: "coupon",
      usage: 0
    },
    {
      endDate: null,
      id: "platform-promotion:annual-upgrade",
      name: "Annual Upgrade Promotion",
      revenueImpact: 0,
      section: "Platform promotions",
      startDate: null,
      status: campaignStatus("platform-promotion:annual-upgrade", "draft"),
      targetAudience: "Monthly plan customers",
      type: "promotion",
      usage: 0
    },
    {
      endDate: null,
      id: "gift-code:launch-credit",
      name: "Launch Credit Gift Code",
      revenueImpact: 0,
      section: "Gift codes",
      startDate: null,
      status: campaignStatus("gift-code:launch-credit", "draft"),
      targetAudience: "Selected launch partners",
      type: "gift_code",
      usage: 0
    },
    {
      endDate: null,
      id: "referral:owner-invite",
      name: "Store Owner Referral Foundation",
      revenueImpact: 0,
      section: "Referral program",
      startDate: null,
      status: campaignStatus("referral:owner-invite", "draft"),
      targetAudience: "Existing store owners",
      type: "referral",
      usage: 0
    },
    {
      endDate: null,
      id: "affiliate:creator-partners",
      name: "Creator Affiliate Foundation",
      revenueImpact: 0,
      section: "Affiliate program",
      startDate: null,
      status: campaignStatus("affiliate:creator-partners", "draft"),
      targetAudience: "Creators, agencies, and future reseller partners",
      type: "affiliate",
      usage: 0
    },
    {
      endDate: null,
      id: "campaign:platform-announcements",
      name: "Platform Announcement Campaign",
      revenueImpact: 0,
      section: "Campaigns",
      startDate: null,
      status: campaignStatus("campaign:platform-announcements", "paused"),
      targetAudience: "All SHASTORE platform users",
      type: "campaign",
      usage: 0
    }
  ];

  return {
    campaigns,
    coupons: [
      {
        amount: "10%",
        code: "PLATFORM-WELCOME",
        discountType: "percentage",
        planEligibility: "Starter, Growth, Pro",
        status: campaignStatus("platform-coupon:welcome-plan-credit", "draft"),
        usageLimit: "Placeholder limit"
      },
      {
        amount: "1 month credit",
        code: "PLAN-CREDIT-DRAFT",
        discountType: "plan_credit",
        planEligibility: "Growth, Pro",
        status: campaignStatus("platform-promotion:annual-upgrade", "draft"),
        usageLimit: "Internal review only"
      }
    ],
    futureHooks: [
      "Platform coupon redemption",
      "Plan discount application",
      "Affiliate tracking",
      "Payout system",
      "Campaign email sending",
      "Campaign analytics"
    ],
    giftCodes: [
      {
        code: "GIFT-LAUNCH-CREDIT",
        creditAmount: 0,
        planCredit: "Platform subscription credit placeholder",
        redemptionStatus: "No redemption engine connected",
        status: campaignStatus("gift-code:launch-credit", "draft")
      }
    ],
    overview: {
      activeSections: campaigns.filter((campaign) => campaign.status === "active").length,
      archivedSections: campaigns.filter((campaign) => campaign.status === "archived").length,
      draftSections: campaigns.filter((campaign) => campaign.status === "draft").length,
      expiredSections: campaigns.filter((campaign) => campaign.status === "expired").length,
      pausedSections: campaigns.filter((campaign) => campaign.status === "paused").length,
      totalSections: campaigns.length
    },
    referralAffiliates: [
      {
        commission: 0,
        payoutStatus: "No payout system connected",
        referredUsers: 0,
        referrer: "Store Owner Referral Foundation",
        status: campaignStatus("referral:owner-invite", "draft"),
        type: "referral"
      },
      {
        commission: 0,
        payoutStatus: "Placeholder only",
        referredUsers: 0,
        referrer: "Creator Affiliate Foundation",
        status: campaignStatus("affiliate:creator-partners", "draft"),
        type: "affiliate"
      }
    ]
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
