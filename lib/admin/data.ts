import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { planLimitsConfig } from "@/lib/billing/plan-limits";
import { getBillingPlan } from "@/lib/billing/plans";
import { getAdminAccess } from "@/lib/admin-access";
import {
  internalTeamRoleMeta,
  internalTeamRoles,
  normalizeInternalTeamRole,
  type InternalTeamInvitationRow,
  type InternalTeamMemberRow
} from "@/lib/admin/internal-team-runtime";
import { createClient } from "@/lib/supabase/server";
import { aiVisualQueueFromStoreData } from "@/lib/storefront/ai-visual-queue";
import { getAIVisualProviderRuntimeConfig } from "@/lib/storefront/ai-visual-provider";
import { getHttpApiReadiness } from "@/lib/domains/httpapi-client";
import {
  buildDefaultDomainDnsRecords,
  type DomainDnsRuntimeRecord
} from "@/lib/domains/dns-records";
import { extractHttpApiErrorMessage } from "@/lib/domains/httpapi-registration";
import { getTemplateLibrary } from "@/lib/storefront/template-library";
import { templatePreviewSummary } from "@/lib/storefront/template-preview-summary";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import type { Database } from "@/types/database";

type AnyRecord = Record<string, unknown>;

export type AdminUser = {
  activeSubscriptionLabel: string;
  id: string;
  email: string;
  emailMasked: string;
  fullName: string | null;
  isHighRisk: boolean;
  plan: string;
  planId: string;
  primaryRole: string;
  reviewedAt: string | null;
  riskStatus: "clear" | "high_risk" | "reviewed";
  securitySignals: Array<{
    createdAt: string;
    label: string;
    severity: "high" | "low" | "medium";
  }>;
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
  ownerType: "owner" | "unknown";
  name: string;
  status: string;
  storeStatus: string;
  plan: string;
  planId: string;
  subscriptionStatus: string;
  publicationStatus: string;
  template: string;
  publishedUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
  hasDomain: boolean;
  domainStatus: string;
  domains: Array<{
    hostname: string;
    status: string;
    verificationStatus: string;
  }>;
  productsCount: number;
  ordersCount: number;
  revenue: number;
  viewsCount: number;
  riskStatus: "clear" | "high_risk" | "reviewed";
  reviewedAt: string | null;
  riskSignals: Array<{
    createdAt: string | null;
    label: string;
    severity: "high" | "low" | "medium";
  }>;
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
  createdAt: string | null;
  roleType: string;
  accountStatus: string;
  plan: string;
  planId: string;
  storesOwned: number;
  publishedStores: number;
  productsCount: number;
  ordersCount: number;
  customersCount: number;
  revenue: number;
  governanceStatus: "active" | "suspended" | "under_review";
  riskStatus: "clear" | "high_risk" | "reviewed";
  reviewedAt: string | null;
  riskSignals: Array<{
    createdAt: string | null;
    label: string;
    severity: "high" | "low" | "medium";
  }>;
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
    workspaceId: string | null;
  }>;
  workspaceIds: string[];
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
  plan: string;
  planId: string;
  subscriptionStatus: string;
  workspaceIds: string[];
  storesCreated: number;
  storesSold: number;
  customersReferred: number;
  commissionsPlaceholder: string;
  commissionStatus: string;
  riskStatus: "clear" | "high_risk" | "reviewed";
  reviewedAt: string | null;
  riskSignals: Array<{
    createdAt: string | null;
    label: string;
    severity: "high" | "low" | "medium";
  }>;
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
    workspaceId: string | null;
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
    configChecks: Array<{
      label: string;
      status: "configured" | "missing" | "not_applicable";
    }>;
    connectedStoresCount: number;
    docsUrl: string | null;
    enabledStatus: "disabled" | "enabled" | "placeholder_disabled" | "under_review";
    environmentMode: "live" | "test" | "sandbox" | "placeholder";
    healthStatus: "healthy" | "missing_config" | "needs_review" | "warning";
    key: string;
    lastCheckedAt: string | null;
    lastEvent: string | null;
    name: string;
    scope: "manual_offline" | "platform_billing" | "store_payments";
    warnings: Array<"live_mode_not_verified" | "provider_not_configured" | "test_mode" | "webhook_missing">;
    webhookStatus: "configured" | "missing" | "not_applicable" | "placeholder";
  }>;
  storePaymentAdoption: {
    codStores: number;
    manualStores: number;
    missingPaymentMethodStores: number;
    stripePendingStores: number;
    stripeRestrictedStores: number;
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
    dnsConfigured: number;
    dnsFailed: number;
    dnsPending: number;
    dnsVerified: number;
    domainDrafts: number;
    emailMailboxDrafts: number;
    failedOperations: number;
    pendingDomainOrders: number;
    readyForRegistration: number;
    sslPending: number;
  };
  domainOrders: Array<{
    adminContactId: string | null;
    autoRenew: string | null;
    billingContactId: string | null;
    createdAt: string;
    customerDueCents: number;
    domain: string;
    domainOrderId: string | null;
    dnsRecords: DomainDnsRuntimeRecord[];
    extension: string;
    id: string;
    nameserverCount: number;
    nameservers: string[];
    nextStep: string;
    ownerEmail: string;
    planCreditUsedCents: number;
    provider: string | null;
    providerCustomerId: string | null;
    providerEntityId: string | null;
    providerErrorMessage: string | null;
    providerOrderId: string | null;
    providerResponse: unknown;
    providerStatusSyncedAt: string | null;
    registrantContactId: string | null;
    registrationYears: number | null;
    status: string;
    storeId: string;
    storeName: string;
    techContactId: string | null;
    timelineEvents: Array<{
      label: string;
      providerError: string | null;
      providerMessage: string | null;
      providerOrderId: string | null;
      status: "failed" | "info" | "pending" | "success";
      timestamp: string | null;
    }>;
    updatedAt: string;
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
    createdAt: string;
    dnsStatus: string;
    domain: string;
    id: string;
    ownerEmail: string;
    primaryDomainStatus: string;
    provider: string | null;
    sslStatus: string;
    storeId: string;
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

export type AdminEmailControl = {
  campaignMonitoring: Array<{
    lastActivity: string | null;
    name: string;
    note: string;
    status: "monitoring" | "placeholder";
    total: number;
  }>;
  failedEmails: Array<{
    createdAt: string;
    emailType: string;
    errorSummary: string;
    id: string;
    recipientMasked: string;
  }>;
  futureHooks: string[];
  overview: {
    activeTemplates: number;
    failedEmails: number;
    providersConfigured: number;
    queuedEmails: number;
    sentEmails: number;
    totalTemplates: number;
  };
  providers: Array<{
    configurationStatus: "configured" | "missing" | "partial";
    healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
    name: string;
    provider: "future" | "resend" | "smtp";
    secretStatus: "masked_configured" | "masked_partial" | "missing" | "no_secret_required";
  }>;
  queue: {
    cancelled: number;
    failed: number;
    queued: number;
    retryPending: number;
    sent: number;
  };
  templates: Array<{
    category: "billing" | "domain_email_setup" | "order" | "security" | "support" | "welcome";
    id: string;
    language: "Arabic" | "English" | "French";
    lastUpdated: string | null;
    name: string;
    status: "active" | "disabled" | "draft";
  }>;
  transactionalSections: Array<{
    key: string;
    name: string;
    note: string;
    status: "active" | "draft" | "placeholder";
  }>;
};

export type AdminNotificationControl = {
  channels: Array<{
    configuredStatus: "configured" | "missing" | "placeholder";
    healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
    key: "email" | "in_app" | "push" | "sms" | "system_alerts" | "whatsapp";
    name: string;
    secretStatus: "masked_configured" | "masked_partial" | "missing" | "no_secret_required";
  }>;
  futureHooks: string[];
  logs: Array<{
    channel: "email" | "in_app" | "system_alert";
    createdAt: string;
    errorSummary: string | null;
    id: string;
    recipientMasked: string;
    status: "cancelled" | "failed" | "queued" | "read" | "retry_pending" | "sent" | "unread";
    storeOrUser: string;
    type: string;
  }>;
  overview: {
    failed: number;
    queued: number;
    reviewedFailures: number;
    sent: number;
    totalNotifications: number;
    unread: number;
  };
  providerStatus: Array<{
    configuredStatus: "configured" | "missing" | "placeholder";
    healthStatus: "healthy" | "missing_config" | "placeholder" | "warning";
    provider: string;
    secretStatus: "masked_configured" | "masked_partial" | "missing" | "no_secret_required";
  }>;
  types: Array<{
    count: number;
    key: "ai_visuals" | "billing" | "domains" | "email_setup" | "security" | "store_publishing" | "support" | "system_health";
    label: string;
  }>;
};

export type AdminSEOControl = {
  analyticsReadiness: Array<{
    name: string;
    note: string;
    status: "configured" | "missing" | "placeholder";
  }>;
  futureHooks: string[];
  overview: {
    canonicalReady: number;
    indexedPagesPlaceholder: string;
    languageReady: number;
    missingMetaDescriptions: number;
    missingMetaTitles: number;
    robotsStatus: "ready" | "warning";
    sitemapStatus: "ready" | "warning";
    structuredDataStatus: "placeholder" | "ready";
  };
  pages: Array<{
    canonicalStatus: "missing" | "ready";
    languageStatus: "placeholder" | "ready";
    lastUpdated: string | null;
    metaDescriptionStatus: "missing" | "ready";
    metaTitleStatus: "missing" | "ready";
    openGraphStatus: "placeholder" | "ready";
    page: string;
    slug: string;
  }>;
  robots: {
    allowedPaths: string[];
    blockedPaths: string[];
    environmentWarning: string;
    status: "ready" | "warning";
  };
  sitemap: {
    excludedRoutes: string[];
    includedRoutes: string[];
    lastGenerated: string;
    status: "ready" | "warning";
  };
  structuredData: Array<{
    name: string;
    note: string;
    status: "placeholder" | "ready";
  }>;
};

export type AdminReportingControl = {
  categories: Array<{
    description: string;
    name:
      | "AI Reports"
      | "Domain & Email Reports"
      | "Marketplace Reports"
      | "Operations Reports"
      | "Payment Reports"
      | "Revenue Reports"
      | "Security Reports"
      | "Store Reports"
      | "Subscription Reports"
      | "User Reports";
    status: "ready" | "review" | "placeholder";
  }>;
  dateFilters: Array<{
    active: boolean;
    href: string;
    label: "Today" | "7 days" | "30 days" | "Month" | "Year";
    value: "today" | "7d" | "30d" | "month" | "year";
  }>;
  futureHooks: string[];
  overview: {
    activeStores: number;
    activeUsers: number;
    aiUsage: number;
    domainOrders: number;
    failedPayments: number;
    paidSubscriptions: number;
    securityEvents: number;
    supportTickets: number;
    totalRevenueEstimate: number;
  };
  reports: Array<{
    category: AdminReportingControl["categories"][number]["name"];
    exportPlaceholder: string;
    lastGenerated: string;
    name: string;
    reportId: string;
    status: "ready" | "review" | "placeholder";
    visibility: "internal" | "owner";
  }>;
  selectedRange: "today" | "7d" | "30d" | "month" | "year";
  sources: string[];
};

export type AdminAdvancedSecurityControl = {
  events: Array<{
    browser: string;
    createdAt: string;
    device: string;
    eventType: string;
    id: string;
    ipMasked: string;
    severity: "critical" | "high" | "low" | "medium";
    status: "blocked" | "failed" | "recorded" | "reviewed" | "watching";
    storeId: string | null;
    summary: string;
    userId: string | null;
  }>;
  futureHooks: string[];
  overview: {
    deniedAccessEvents: number;
    failedLogins: number;
    highRiskStores: number;
    highRiskUsers: number;
    rateLimitEvents: number;
    suspiciousEvents: number;
    totalLoginEvents: number;
  };
  riskScores: Array<{
    count: number;
    description: string;
    level: "critical" | "high" | "low" | "medium";
  }>;
  sections: Array<{
    name:
      | "Abuse Detection"
      | "Audit Logs"
      | "Device Monitoring"
      | "Fraud Detection"
      | "IP Monitoring"
      | "Login Monitoring"
      | "Rate Limits"
      | "Risk Score Engine";
    note: string;
    status: "monitoring" | "placeholder" | "review";
  }>;
};

export type AdminOperationsControl = {
  backupRecovery: Array<{
    name: string;
    note: string;
    status: "placeholder" | "ready" | "review";
  }>;
  cronJobs: Array<{
    lastRun: string | null;
    name: string;
    nextRun: string;
    schedule: string;
    status: "placeholder" | "ready" | "review";
  }>;
  databaseStorage: Array<{
    metric: string;
    note: string;
    status: "configured" | "missing" | "placeholder" | "ready" | "review";
    value: string;
  }>;
  futureHooks: string[];
  overview: {
    aiQueueHealth: "healthy" | "missing_config" | "needs_review" | "placeholder";
    cronHealth: "healthy" | "needs_review" | "placeholder";
    databaseHealth: "healthy" | "missing_config" | "needs_review";
    domainEmailQueueHealth: "healthy" | "needs_review" | "placeholder";
    emailQueueHealth: "healthy" | "missing_config" | "needs_review" | "placeholder";
    queueHealth: "healthy" | "needs_review" | "placeholder";
    storageHealth: "healthy" | "missing_config" | "needs_review" | "placeholder";
    workerHealth: "healthy" | "needs_review" | "placeholder";
  };
  queues: Array<{
    completed: number;
    failed: number;
    lastProcessed: string | null;
    name: string;
    pending: number;
    processing: number;
  }>;
  sections: Array<{
    name:
      | "Backups"
      | "Cron Jobs"
      | "Database Health"
      | "Disaster Recovery"
      | "Queues"
      | "Storage Health"
      | "System Monitoring"
      | "Workers";
    note: string;
    status: "monitoring" | "placeholder" | "review";
  }>;
  workers: Array<{
    failures: number;
    lastRun: string | null;
    name: string;
    nextRun: string;
    status: "idle" | "placeholder" | "running" | "warning";
  }>;
};

export type AdminInternalTeamControl = {
  accessSafety: Array<{
    name: string;
    note: string;
    status: "enforced" | "runtime";
  }>;
  invitations: Array<{
    acceptedAt: string | null;
    createdAt: string | null;
    email: string;
    emailStatus: string;
    expiresAt: string | null;
    id: string;
    invitedAt: string | null;
    lastSentAt: string | null;
    name: string;
    role: string;
    roleKey: string;
    status: "accepted" | "cancelled" | "expired" | "pending";
  }>;
  members: Array<{
    acceptedAt: string | null;
    assignedArea: string;
    createdAt: string | null;
    email: string;
    id: string;
    invitedAt: string | null;
    lastActiveAt: string | null;
    name: string;
    permissionsSummary: string;
    role: string;
    roleKey: string;
    status: "active" | "suspended";
    userId: string | null;
  }>;
  overview: {
    activeStaff: number;
    finalSuperAdminProtected: "enforced";
    pendingInvites: number;
    permissionGroups: number;
    roles: number;
    suspendedStaff: number;
  };
  permissionGroups: Array<{
    description: string;
    key: string;
    label: string;
  }>;
  roles: Array<{
    accessLevel: "full" | "limited" | "read_only" | "specialized";
    assignedArea: string;
    key: string;
    name: string;
    permissionsSummary: string;
  }>;
};

export type AdminPlatformSettingsControl = {
  currencies: Array<{
    code: "AED" | "EUR" | "MAD" | "SAR" | "USD";
    isDefault: boolean;
    name: string;
    status: "enabled" | "placeholder_disabled";
  }>;
  defaultLimits: Array<{
    description: string;
    key: string;
    value: string;
  }>;
  featureFlags: Array<{
    key: string;
    note: string;
    status: "placeholder";
  }>;
  futureHooks: string[];
  general: Array<{
    key: string;
    label: string;
    note: string;
    value: string;
  }>;
  languages: Array<{
    code: "ar" | "en" | "fr";
    direction: "LTR" | "RTL";
    name: string;
    readiness: "ready" | "placeholder";
  }>;
  legalPolicies: Array<{
    name: string;
    note: string;
    status: "placeholder" | "ready";
  }>;
  maintenanceModes: Array<{
    name: string;
    note: string;
    status: "off_placeholder";
    warning: string;
  }>;
  overview: {
    currencies: number;
    defaultCurrency: string;
    defaultLanguage: string;
    languages: number;
    maintenanceModes: number;
    sections: number;
    storeSettingsTouched: 0;
  };
  regionalSettings: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  safety: Array<{
    name: string;
    note: string;
    status: "enforced";
  }>;
  sections: Array<{
    name:
      | "Currencies"
      | "Default limits"
      | "Feature flags placeholder"
      | "General settings"
      | "Languages"
      | "Legal/platform policies"
      | "Maintenance mode"
      | "Regional settings"
      | "Taxes"
      | "Timezones";
    note: string;
    status: "placeholder" | "ready";
  }>;
  taxes: Array<{
    key: string;
    label: string;
    note: string;
    value: string;
  }>;
  timezones: Array<{
    isDefault: boolean;
    label: string;
    value: string;
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
  subscriptionId: string;
  userId: string;
  email: string;
  plan: string;
  planId: string;
  status: string;
  billingProvider: string;
  billingCycle: string;
  billingReview: boolean;
  amount: number;
  currency: string;
  createdAt: string | null;
  currentPeriodEnd: string | null;
  currentPeriodStart: string | null;
  cancelAtPeriodEnd: boolean;
  cancellationDate: string | null;
  failedPayments: number;
  landingsUsed: number;
  landingLimit: string;
  manualOverrideActive: boolean;
  nextBillingDate: string | null;
  previousPlanId: string | null;
  providerSubscriptionId: string | null;
  providerUrl: string | null;
  renewalStatus: string;
  stores: Array<{
    id: string;
    name: string;
    slug: string | null;
    status: string;
    workspaceId: string | null;
  }>;
  workspaceIds: string[];
  storesUsed: number;
  storeLimit: string;
  domainsUsed: number;
  domainLimit: string;
  publishedStoresUsed: number;
  ordersUsed: number;
  invoices: Array<{
    createdAt: string | null;
    provider: string;
    status: string;
  }>;
  lastBillingEvent: {
    createdAt: string | null;
    eventType: string;
    provider: string;
  } | null;
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

function storeGovernanceRisk(storeData: unknown): {
  reviewedAt: string | null;
  riskStatus: AdminStore["riskStatus"];
} {
  if (!isRecord(storeData) || !isRecord(storeData.adminGovernance)) {
    return {
      reviewedAt: null,
      riskStatus: "clear"
    };
  }

  const governance = storeData.adminGovernance;
  const riskStatus = text(governance.riskStatus);
  const status = text(governance.status);
  const reviewedAt = text(governance.reviewedAt) || null;

  if (riskStatus === "high_risk") {
    return { reviewedAt, riskStatus: "high_risk" };
  }

  if (riskStatus === "reviewed" || reviewedAt || status === "reviewed") {
    return { reviewedAt, riskStatus: "reviewed" };
  }

  return { reviewedAt, riskStatus: "clear" };
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

function maskEmail(value: string) {
  const [localPart = "", domain = ""] = value.split("@");

  if (!domain) {
    return value ? `${value.slice(0, 4)}...` : "No email";
  }

  const visibleLocal = localPart.length <= 2 ? localPart.slice(0, 1) : `${localPart.slice(0, 2)}...${localPart.slice(-1)}`;
  const [domainName = "", ...domainRest] = domain.split(".");
  const maskedDomain = domainRest.length
    ? `${domainName.slice(0, 1)}...${domainName.slice(-1)}.${domainRest.join(".")}`
    : domain;

  return `${visibleLocal}@${maskedDomain}`;
}

function securitySignalSeverity(action: string): "high" | "low" | "medium" {
  const lowered = action.toLowerCase();

  if (lowered.includes("high") || lowered.includes("risk") || lowered.includes("failed") || lowered.includes("suspend")) {
    return "high";
  }

  if (lowered.includes("warning") || lowered.includes("review")) {
    return "medium";
  }

  return "low";
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

function sellerGovernanceRisk(value: unknown): {
  reviewedAt: string | null;
  riskStatus: AdminSeller["riskStatus"];
} {
  if (!isRecord(value) || !isRecord(value.adminGovernance)) {
    return {
      reviewedAt: null,
      riskStatus: "clear"
    };
  }

  const governance = value.adminGovernance;
  const riskStatus = text(governance.riskStatus);
  const status = text(governance.status);
  const reviewedAt = text(governance.reviewedAt) || null;

  if (riskStatus === "high_risk") {
    return { reviewedAt, riskStatus: "high_risk" };
  }

  if (riskStatus === "reviewed" || reviewedAt || status === "reviewed") {
    return { reviewedAt, riskStatus: "reviewed" };
  }

  return { reviewedAt, riskStatus: "clear" };
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

function resellerGovernanceRisk(value: unknown): {
  reviewedAt: string | null;
  riskStatus: AdminReseller["riskStatus"];
} {
  if (!isRecord(value) || !isRecord(value.adminGovernance)) {
    return {
      reviewedAt: null,
      riskStatus: "clear"
    };
  }

  const governance = value.adminGovernance;
  const riskStatus = text(governance.riskStatus);
  const status = text(governance.status);
  const reviewedAt = text(governance.reviewedAt) || null;

  if (riskStatus === "high_risk") {
    return { reviewedAt, riskStatus: "high_risk" };
  }

  if (riskStatus === "reviewed" || reviewedAt || status === "reviewed") {
    return { reviewedAt, riskStatus: "reviewed" };
  }

  return { reviewedAt, riskStatus: "clear" };
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
  const [
    stores,
    landings,
    orders,
    subscriptions,
    workspaceMembers,
    accountProfiles,
    billingEvents,
    accountRoles,
    monitoringEvents,
    securityAuditLogs
  ] = await Promise.all([
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
    safeSelect(supabase, "billing_events", "user_id, event_type, processed_at, created_at"),
    safeSelect(supabase, "account_roles", "user_id, role, status, updated_at"),
    safeSelect(
      supabase,
      "monitoring_events",
      "user_id, entity_id, event_type, event_status, entity_type, metadata, created_at",
      5000
    ),
    safeSelect(supabase, "security_audit_logs", "user_id, action, reason, created_at", 5000)
  ]);
  const storeCounts = countStoresByOwner(stores);
  const landingCounts = countBy(landings, "user_id");
  const orderCounts = countBy(orders, "user_id");
  const subscriptionsByUser = new Map(subscriptions.map((row) => [text(row.user_id), row]));
  const rolesByUser = new Map(accountRoles.map((row) => [text(row.user_id), row]));
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
  const monitoringByUser = new Map<string, AnyRecord[]>();
  for (const event of monitoringEvents) {
    const userId = text(event.entity_type) === "admin_user" ? text(event.entity_id) : text(event.user_id);

    if (!userId) {
      continue;
    }

    monitoringByUser.set(userId, [...(monitoringByUser.get(userId) ?? []), event]);
  }
  const securityByUser = new Map<string, AnyRecord[]>();
  for (const event of securityAuditLogs) {
    const userId = text(event.user_id);

    if (!userId) {
      continue;
    }

    securityByUser.set(userId, [...(securityByUser.get(userId) ?? []), event]);
  }

  return users.map((user) => {
    const subscription = subscriptionsByUser.get(user.id);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    const governanceStatus = userGovernanceStatus(subscription?.limits_snapshot);
    const subscriptionStatus = text(subscription?.status, "active");
    const role = rolesByUser.get(user.id);
    const roleStatus = text(role?.status);
    const profile = accountProfilesByUser.get(user.id);
    const workspaces = workspacesByUser.get(user.id) ?? [];
    const workspaceIds = new Set(workspaces.map((workspace) => text(workspace.workspace_id)).filter(Boolean));
    const monitoring = (monitoringByUser.get(user.id) ?? [])
      .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
    const latestRiskEvent = monitoring.find((event) => {
      const eventType = text(event.event_type);
      return (
        eventType === "admin_user_mark_high_risk" ||
        eventType === "admin_user_clear_risk" ||
        eventType === "admin_user_mark_reviewed"
      );
    });
    const riskEventType = text(latestRiskEvent?.event_type);
    const riskStatus =
      riskEventType === "admin_user_mark_high_risk"
        ? "high_risk"
        : riskEventType === "admin_user_mark_reviewed"
          ? "reviewed"
          : "clear";
    const securitySignals = [
      ...(securityByUser.get(user.id) ?? []).map((event) => ({
        createdAt: text(event.created_at),
        label: text(event.action, text(event.reason, "security_audit")),
        severity: securitySignalSeverity(`${text(event.action)} ${text(event.reason)}`)
      })),
      ...monitoring
        .filter((event) => text(event.entity_type) === "admin_user")
        .map((event) => ({
          createdAt: text(event.created_at),
          label: text(event.event_type, "admin_user_event"),
          severity: securitySignalSeverity(text(event.event_type))
        }))
    ]
      .filter((signal) => signal.createdAt)
      .sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt))
      .slice(0, 5);
    const accountStatus =
      roleStatus === "suspended" || roleStatus === "disabled" || roleStatus === "pending"
        ? roleStatus
        : governanceStatus ?? (subscriptionStatus === "incomplete" ? "suspended" : subscriptionStatus);
    const userStores = stores
      .filter((store) => ownerUserId(store) === user.id)
      .map((store) => ({
        createdAt: text(store.created_at),
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        status: text(store.status, "draft")
      }));

    return {
      activeSubscriptionLabel: `${plan.name} · ${subscriptionStatus}`,
      accountStatus,
      createdAt: user.createdAt,
      email: user.email,
      emailMasked: maskEmail(user.email),
      fullName: user.fullName ?? (text(profile?.display_name) || null),
      governanceStatus,
      id: user.id,
      isHighRisk: riskStatus === "high_risk",
      landingsCount: landingCounts.get(user.id) ?? 0,
      lastLoginAt: user.lastLoginAt,
      ordersCount: orderCounts.get(user.id) ?? 0,
      plan: plan.name,
      planId: plan.id,
      primaryRole: text(role?.role, "unknown"),
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
      reviewedAt: riskStatus === "reviewed" ? text(latestRiskEvent?.created_at) || null : null,
      riskStatus,
      securitySignals,
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
    workspaceMembers,
    monitoringEvents,
    securityAuditLogs
  ] = await Promise.all([
    safeSelect(
      supabase,
      "stores",
      "id, user_id, owner_user_id, workspace_id, name, store_name, slug, status, store_data, template_id, created_at, updated_at, delivery_enabled, pickup_enabled, delivery_notes"
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
    safeSelect(supabase, "workspace_members", "workspace_id, user_id, role, status"),
    safeSelect(supabase, "monitoring_events", "entity_id, entity_type, event_type, event_status, metadata, created_at", 1000),
    safeSelect(supabase, "security_audit_logs", "user_id, action, reason, metadata, created_at", 1000)
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
    const storeDomainRows = storeDomains.filter((domain) => text(domain.store_id) === storeId);
    const hasCustomDomain =
      text(publication?.custom_domain).length > 0 ||
      storeDomainRows.some(
        (domain) =>
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
    const planId = text(subscription?.plan_id, "free");
    const subscriptionStatus = text(subscription?.status, "none");
    const plan = getBillingPlan(planId);
    const workspaceMemberRows = workspaceId ? membersByWorkspace.get(workspaceId) ?? [] : [];
    const storeStatus = text(store.status, "draft");
    const adminStatus = governanceStatus(store.store_data, storeStatus);
    const risk = storeGovernanceRisk(store.store_data);
    const monitoringSignals = monitoringEvents
      .filter((event) => {
        const metadata = isRecord(event.metadata) ? event.metadata : {};
        return text(event.entity_id) === storeId || text(metadata.store_id) === storeId;
      })
      .slice(0, 3)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.event_type, "Monitoring event"),
        severity: text(event.event_status) === "warning" || text(event.event_type).includes("risk") ? "high" as const : "medium" as const
      }));
    const securitySignals = securityAuditLogs
      .filter((event) => {
        const metadata = isRecord(event.metadata) ? event.metadata : {};
        return text(metadata.store_id) === storeId || text(event.reason).includes(storeId);
      })
      .slice(0, 2)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.action, "Security audit"),
        severity: securitySignalSeverity(text(event.action))
      }));
    const riskSignals = [
      ...(risk.riskStatus === "high_risk"
        ? [{
            createdAt: risk.reviewedAt,
            label: "Marked high risk by Super Admin",
            severity: "high" as const
          }]
        : []),
      ...monitoringSignals,
      ...securitySignals
    ];

    return {
      createdAt: text(store.created_at),
      domainStatus: hasCustomDomain ? "connected" : storeDomainRows.length ? "pending" : "not_connected",
      domains: storeDomainRows.map((domain) => ({
        hostname: text(domain.hostname, "Unknown domain"),
        status: text(domain.status, "pending"),
        verificationStatus: text(domain.verification_status, "pending")
      })),
      health,
      hasDomain: hasCustomDomain,
      id: storeId,
      name: text(store.store_name, text(store.name, "Untitled store")),
      ordersCount: orderCount,
      ownerEmail: owners.get(ownerId) ?? text(ownerId, "Unknown owner"),
      ownerId: ownerId || null,
      ownerType: ownerId ? "owner" : "unknown",
      plan: plan.name,
      planId,
      productsCount: productCounts.get(storeId) ?? 0,
      publicationStatus: text(publication?.status, "not_published"),
      publishedUrl: url,
      revenue: storeRevenue + directRevenue,
      reviewedAt: risk.reviewedAt,
      riskSignals,
      riskStatus: risk.riskStatus,
      slug: text(store.slug) || text(publication?.slug) || null,
      status: adminStatus,
      storeStatus,
      subscriptionStatus,
      template: text(store.template_id, "default"),
      updatedAt: text(store.updated_at) || null,
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
  const createdByUser = new Map(users.map((user) => [user.id, user.createdAt]));
  const [
    stores,
    publications,
    products,
    commerceOrders,
    storeOrders,
    storeCustomers,
    commerceCustomers,
    subscriptions,
    workspaceMembers,
    accountRoles,
    monitoringEvents,
    securityAuditLogs
  ] = await Promise.all([
    safeSelect(
      supabase,
      "stores",
      "id, user_id, owner_user_id, workspace_id, name, store_name, slug, status, store_data, created_at"
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
    safeSelect(supabase, "user_subscriptions", "user_id, plan_id, status, limits_snapshot"),
    safeSelect(supabase, "workspace_members", "workspace_id, user_id, role, status"),
    safeSelect(supabase, "account_roles", "user_id, role, status"),
    safeSelect(supabase, "monitoring_events", "entity_id, entity_type, event_type, event_status, metadata, user_id, created_at", 1000),
    safeSelect(supabase, "security_audit_logs", "user_id, action, reason, metadata, created_at", 1000)
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
  const accountRoleByUser = new Map(accountRoles.map((role) => [text(role.user_id), role]));
  const workspaceMembershipsByUser = new Map<string, AnyRecord[]>();
  for (const member of workspaceMembers) {
    const userId = text(member.user_id);
    if (!userId) {
      continue;
    }
    workspaceMembershipsByUser.set(userId, [...(workspaceMembershipsByUser.get(userId) ?? []), member]);
  }

  return [...sellerIds].map((sellerId) => {
    const sellerStores = storesBySeller.get(sellerId) ?? [];
    const storeIds = new Set(sellerStores.map((store) => text(store.id)).filter(Boolean));
    const subscription = subscriptionByUser.get(sellerId);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    const sellerGovernance = adminGovernanceStatus(subscription?.limits_snapshot);
    const sellerRisk = sellerGovernanceRisk(subscription?.limits_snapshot);
    const storeGovernance = sellerStores
      .map((store) => adminGovernanceStatus(store.store_data))
      .find((status) => status === "suspended" || status === "under_review");
    const subscriptionStatus = text(subscription?.status, "active");
    const accountRole = accountRoleByUser.get(sellerId);
    const accountStatus = text(accountRole?.status, "active");
    const sellerStatus =
      sellerGovernance ??
      storeGovernance ??
      (accountStatus === "suspended" || accountStatus === "disabled"
        ? "suspended"
        : subscriptionStatus === "incomplete"
          ? "suspended"
          : accountStatus === "pending"
            ? "under_review"
            : "active");
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
    const workspaceIds = [
      ...new Set([
        ...sellerStores.map((store) => text(store.workspace_id)).filter(Boolean),
        ...(workspaceMembershipsByUser.get(sellerId) ?? []).map((member) => text(member.workspace_id)).filter(Boolean)
      ])
    ];
    const monitoringSignals = monitoringEvents
      .filter((event) => {
        const metadata = isRecord(event.metadata) ? event.metadata : {};
        return text(event.user_id) === sellerId || text(event.entity_id) === sellerId || text(metadata.seller_id) === sellerId;
      })
      .slice(0, 3)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.event_type, "Monitoring event"),
        severity: text(event.event_status) === "warning" || text(event.event_type).includes("risk") ? "high" as const : "medium" as const
      }));
    const securitySignals = securityAuditLogs
      .filter((event) => text(event.user_id) === sellerId)
      .slice(0, 2)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.action, "Security audit"),
        severity: securitySignalSeverity(text(event.action))
      }));
    const riskSignals = [
      ...(sellerRisk.riskStatus === "high_risk"
        ? [{
            createdAt: sellerRisk.reviewedAt,
            label: "Marked high risk by Super Admin",
            severity: "high" as const
          }]
        : []),
      ...monitoringSignals,
      ...securitySignals
    ];

    return {
      accountStatus,
      createdAt: createdByUser.get(sellerId) ?? null,
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
      reviewedAt: sellerRisk.reviewedAt,
      riskSignals,
      riskStatus: sellerRisk.riskStatus,
      roleType: text(accountRole?.role, "owner"),
      status: sellerStatus,
      stores: sellerStores.map((store) => ({
        createdAt: text(store.created_at),
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        slug: text(store.slug) || null,
        status: governanceStatus(store.store_data, text(store.status, "draft")),
        workspaceId: text(store.workspace_id) || null
      })),
      storesOwned: sellerStores.length,
      subscription: {
        planId: plan.id,
        planName: plan.name,
        status: subscriptionStatus
      },
      userId: sellerId,
      workspaceIds
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
    storeTransfers,
    workspaceMembers,
    accountRoles,
    affiliateOrders,
    monitoringEvents,
    securityAuditLogs
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
      "id, user_id, owner_user_id, workspace_id, name, store_name, slug, status, store_data, created_at"
    ),
    safeSelect(supabase, "user_subscriptions", "user_id, plan_id, status, limits_snapshot"),
    safeSelect(supabase, "store_purchase_requests", "id, reseller_id, buyer_email, request_status, created_at"),
    safeSelect(
      supabase,
      "provisioned_stores",
      "id, reseller_id, buyer_email, provisioned_store_name, provisioning_status, ownership_status, created_at"
    ),
    safeSelect(supabase, "store_transfers", "id, reseller_id, buyer_email, transfer_status, transferred_at, created_at"),
    safeSelect(supabase, "workspace_members", "workspace_id, user_id, role, status"),
    safeSelect(supabase, "account_roles", "user_id, role, status"),
    safeSelect(supabase, "store_affiliate_orders", "store_id, commission_amount, status", 1000),
    safeSelect(supabase, "monitoring_events", "entity_id, entity_type, event_type, event_status, metadata, user_id, created_at", 1000),
    safeSelect(supabase, "security_audit_logs", "user_id, action, reason, metadata, created_at", 1000)
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
  const accountRoleByUser = new Map(accountRoles.map((role) => [text(role.user_id), role]));
  const workspaceMembershipsByUser = new Map<string, AnyRecord[]>();
  for (const member of workspaceMembers) {
    const userId = text(member.user_id);
    if (!userId) {
      continue;
    }
    workspaceMembershipsByUser.set(userId, [...(workspaceMembershipsByUser.get(userId) ?? []), member]);
  }

  return [...resellerIds].map((userId) => {
    const profile = profilesByUser.get(userId);
    const accountProfile = accountProfilesByUser.get(userId);
    const resellerProfileId = text(profile?.id);
    const subscription = subscriptionsByUser.get(userId);
    const governance = resellerGovernance(subscription?.limits_snapshot);
    const risk = resellerGovernanceRisk(subscription?.limits_snapshot);
    const ownedStores = storesByOwner.get(userId) ?? [];
    const ownedStoreIds = new Set(ownedStores.map((store) => text(store.id)).filter(Boolean));
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
    const planId = text(subscription?.plan_id, "free");
    const plan = getBillingPlan(planId);
    const subscriptionStatus = text(subscription?.status, "none");
    const accountRole = accountRoleByUser.get(userId);
    const accountStatus = text(accountRole?.status, "active");
    const accountSuspended = accountStatus === "suspended" || accountStatus === "disabled";
    const status: AdminReseller["status"] =
      governance.governanceStatus === "suspended" || accountSuspended
        ? "suspended"
        : governance.verificationStatus === "verified"
          ? "verified"
          : "pending_verification";
    const resellerAffiliateOrders = affiliateOrders.filter((order) => ownedStoreIds.has(text(order.store_id)));
    const commissionTotal = resellerAffiliateOrders.reduce((total, order) => total + numberValue(order.commission_amount), 0);
    const commissionStatuses = new Set(resellerAffiliateOrders.map((order) => text(order.status, "pending")));
    const commissionStatus =
      resellerAffiliateOrders.length === 0
        ? "not_available"
        : commissionStatuses.has("pending")
          ? "pending"
          : commissionStatuses.has("approved")
            ? "approved"
            : commissionStatuses.has("paid")
              ? "paid"
              : "mixed";
    const workspaceIds = [
      ...new Set([
        ...ownedStores.map((store) => text(store.workspace_id)).filter(Boolean),
        ...(workspaceMembershipsByUser.get(userId) ?? []).map((member) => text(member.workspace_id)).filter(Boolean)
      ])
    ];
    const monitoringSignals = monitoringEvents
      .filter((event) => {
        const metadata = isRecord(event.metadata) ? event.metadata : {};
        return text(event.user_id) === userId || text(event.entity_id) === userId || text(metadata.reseller_id) === userId;
      })
      .slice(0, 3)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.event_type, "Monitoring event"),
        severity: text(event.event_status) === "warning" || text(event.event_type).includes("risk") ? "high" as const : "medium" as const
      }));
    const securitySignals = securityAuditLogs
      .filter((event) => text(event.user_id) === userId)
      .slice(0, 2)
      .map((event) => ({
        createdAt: text(event.created_at) || null,
        label: text(event.action, "Security audit"),
        severity: securitySignalSeverity(text(event.action))
      }));
    const riskSignals = [
      ...(risk.riskStatus === "high_risk"
        ? [{
            createdAt: risk.reviewedAt,
            label: "Marked high risk by Super Admin",
            severity: "high" as const
          }]
        : []),
      ...monitoringSignals,
      ...securitySignals
    ];

    return {
      commissionSummary: {
        note: resellerAffiliateOrders.length
          ? `Affiliate commission records found with ${commissionStatus} status.`
          : "No commission records found.",
        total: commissionTotal
      },
      commissionStatus,
      commissionsPlaceholder: resellerAffiliateOrders.length ? `$${commissionTotal.toFixed(2)}` : "No commission records",
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
        status: governanceStatus(store.store_data, text(store.status, "draft")),
        workspaceId: text(store.workspace_id) || null
      })),
      plan: plan.name,
      planId,
      profile: {
        displayName: text(profile?.display_name) || text(accountProfile?.display_name) || null,
        id: resellerProfileId || null,
        isPublished: profile?.is_published === true,
        slug: text(profile?.slug) || null
      },
      reviewedAt: risk.reviewedAt,
      riskSignals,
      riskStatus: risk.riskStatus,
      status,
      storesCreated: ownedStores.length + resellerProvisionedStores.length,
      storesSold,
      subscriptionStatus,
      transferredStores,
      userId,
      verificationStatus: governance.verificationStatus,
      workspaceIds
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
      "id, user_id, plan_id, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end, created_at, limits_snapshot"
    ),
    safeSelect(supabase, "stores", "id, user_id, owner_user_id, workspace_id, name, store_name, slug, status, store_data"),
    safeSelect(supabase, "published_stores", "user_id, status"),
    safeSelect(supabase, "landing_pages", "user_id"),
    safeSelect(supabase, "commerce_domain_publications", "user_id"),
    safeSelect(supabase, "commerce_orders", "user_id"),
    safeSelect(supabase, "invoices", "user_id, provider, status, created_at"),
    safeSelect(supabase, "billing_events", "user_id, provider, event_type, created_at, processed_at")
  ]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const storeCounts = countStoresByOwner(stores);
  const storesByOwner = new Map<string, AnyRecord[]>();
  for (const store of stores) {
    const ownerId = ownerUserId(store);

    if (!ownerId) {
      continue;
    }

    storesByOwner.set(ownerId, [...(storesByOwner.get(ownerId) ?? []), store]);
  }
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

  return subscriptions.map((subscription) => {
    const userId = text(subscription.user_id);
    const user = usersById.get(userId);
    const plan = getBillingPlan(text(subscription?.plan_id, "free"));
    const metadata = isRecord(subscription?.limits_snapshot) ? subscription.limits_snapshot : {};
    const adminBilling = isRecord(metadata.adminBilling) ? metadata.adminBilling : {};
    const billingCycle = text(metadata.billingCycle, plan.id === "free" ? "not_available" : "monthly");
    const currency = text(metadata.currency, "USD").toUpperCase();
    const userInvoices = invoicesByUser.get(userId) ?? [];
    const userEvents = billingEventsByUser.get(userId) ?? [];
    const failedPayments =
      userInvoices.filter((invoice) => ["failed", "uncollectible", "void"].includes(text(invoice.status))).length +
      userEvents.filter((event) => text(event.event_type).toLowerCase().includes("payment_failed")).length;
    const billingProvider =
      text(userInvoices[0]?.provider) ||
      text(userEvents[0]?.provider) ||
      (text(subscription?.stripe_subscription_id) || text(subscription?.stripe_customer_id) ? "stripe" : "manual");
    const ownedStores = storesByOwner.get(userId) ?? [];
    const workspaceIds = [
      ...new Set(ownedStores.map((store) => text(store.workspace_id)).filter(Boolean))
    ];
    const storesUsed = storeCounts.get(userId) ?? 0;
    const domainsUsed = domainCounts.get(userId) ?? 0;
    const limitExceeded =
      (plan.storeLimit !== null && storesUsed > plan.storeLimit) ||
      (plan.domainLimit !== null && domainsUsed > plan.domainLimit);
    const status = text(subscription?.status, "active");
    const manualOverrideActive = adminBilling.manualOverrideActive === true;
    const billingReview = adminBilling.reviewStatus === "review";
    const currentPeriodEnd = text(subscription?.current_period_end) || null;
    const currentPeriodStart = text(subscription?.current_period_start) || null;
    const cancelAtPeriodEnd = subscription?.cancel_at_period_end === true;
    const providerSubscriptionId = text(subscription?.stripe_subscription_id) || null;
    const providerUrl =
      billingProvider === "stripe" && providerSubscriptionId
        ? `https://dashboard.stripe.com/subscriptions/${providerSubscriptionId}`
        : null;
    const renewalStatus =
      cancelAtPeriodEnd || status === "canceled" || status === "cancelled"
        ? "cancels_at_period_end"
        : ["active", "trialing"].includes(status)
          ? "renews"
          : "not_available";
    const warningBadges: AdminSubscription["warningBadges"] = [
      failedPayments > 0 ? "payment_failed" : null,
      status === "canceled" || status === "cancelled" ? "subscription_cancelled" : null,
      limitExceeded ? "limit_exceeded" : null,
      manualOverrideActive ? "manual_override_active" : null
    ].filter(Boolean) as AdminSubscription["warningBadges"];

    return {
      amount: plan.priceCents / 100,
      billingProvider,
      billingCycle,
      billingReview,
      cancelAtPeriodEnd,
      cancellationDate: cancelAtPeriodEnd ? currentPeriodEnd : null,
      createdAt: text(subscription?.created_at) || user?.createdAt || null,
      currency,
      currentPeriodEnd,
      currentPeriodStart,
      email: user?.email ?? text(userId, "Unknown owner"),
      failedPayments,
      domainLimit: plan.domainLimit === null ? "Unlimited" : String(plan.domainLimit),
      domainsUsed,
      invoices: userInvoices.slice(0, 5).map((invoice) => ({
        createdAt: text(invoice.created_at) || null,
        provider: text(invoice.provider, "not_available"),
        status: text(invoice.status, "not_available")
      })),
      landingLimit: plan.landingLimit === null ? "Unlimited" : String(plan.landingLimit),
      landingsUsed: landingCounts.get(userId) ?? 0,
      lastBillingEvent: userEvents.length
        ? {
            createdAt: text(userEvents[0].processed_at) || text(userEvents[0].created_at) || null,
            eventType: text(userEvents[0].event_type, "billing_event"),
            provider: text(userEvents[0].provider, "admin")
          }
        : null,
      manualOverrideActive,
      nextBillingDate: currentPeriodEnd,
      ordersUsed: orderCounts.get(userId) ?? 0,
      plan: plan.name,
      planId: plan.id,
      previousPlanId: text(adminBilling.previousPlanId) || null,
      providerSubscriptionId,
      providerUrl,
      publishedStoresUsed: publishedCounts.get(userId) ?? 0,
      renewalStatus,
      status,
      storeLimit: plan.storeLimit === null ? "Unlimited" : String(plan.storeLimit),
      stores: ownedStores.map((store) => ({
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        slug: text(store.slug) || null,
        status: governanceStatus(store.store_data, text(store.status, "draft")),
        workspaceId: text(store.workspace_id) || null
      })),
      storesUsed,
      subscriptionId: text(subscription.id, userId),
      userId,
      warningBadges,
      workspaceIds
    };
  });
}

function envConfigured(names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

function envConfigurationChecks(names: Array<{ label: string; names: string[] }>): AdminPaymentProviderControl["providers"][number]["configChecks"] {
  return names.map((entry) => ({
    label: entry.label,
    status: !entry.names.length
      ? "not_applicable"
      : entry.names.some((name) => Boolean(process.env[name]))
        ? "configured"
        : "missing"
  }));
}

function configurationStatusFromChecks(
  checks: AdminPaymentProviderControl["providers"][number]["configChecks"]
): AdminPaymentProviderControl["providers"][number]["configurationStatus"] {
  const applicable = checks.filter((check) => check.status !== "not_applicable");

  if (!applicable.length || applicable.every((check) => check.status === "configured")) {
    return "configured";
  }

  return applicable.some((check) => check.status === "configured") ? "partial" : "missing";
}

function providerMode(providerKey: string): AdminPaymentProviderControl["providers"][number]["environmentMode"] {
  if (providerKey.includes("paypal")) {
    return process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
  }

  if (providerKey.includes("stripe")) {
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

function recordFromStoreDataById(storeData: unknown, key: string, id: string) {
  return recordsFromStoreData(storeData, key).find((record) => text(record.id) === id) ?? null;
}

function firstTextValue(record: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = text(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function nestedRecord(value: unknown, key: string): AnyRecord | null {
  return isRecord(value) && isRecord(value[key]) ? value[key] : null;
}

function providerRegistrationResponse(providerRawResponse: unknown) {
  return nestedRecord(providerRawResponse, "registration") ?? responseRecord(providerRawResponse);
}

function responseRecord(value: unknown): AnyRecord {
  return isRecord(value) ? value : {};
}

function nameserverListFromWorkflow(workflow: AnyRecord) {
  const registrationResponse = nestedRecord(workflow.providerRawResponse, "registration");
  const candidates = [
    workflow.nameservers,
    workflow.nameServers,
    workflow.providerNameservers,
    registrationResponse?.nameservers,
    registrationResponse?.ns
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map((value) => text(value)).filter(Boolean);
    }
  }

  return [];
}

function providerErrorFromWorkflow(workflow: AnyRecord) {
  const registrationError = isRecord(workflow.registrationError) ? workflow.registrationError : {};
  const directMessage = text(registrationError.message);

  return directMessage || extractHttpApiErrorMessage(workflow.providerRawResponse);
}

const sensitiveProviderResponseKeys = new Set([
  "address-line-1",
  "address-line-2",
  "address-line-3",
  "address1",
  "api-key",
  "api_key",
  "authorization",
  "auth",
  "city",
  "company",
  "country",
  "email",
  "name",
  "phone",
  "phone-cc",
  "state",
  "token",
  "zipcode",
  "zip"
]);

function sanitizedProviderResponse(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizedProviderResponse(item));
  }

  if (typeof value === "string") {
    return value
      .replace(/api-key=([^&\s]+)/gi, "api-key=[redacted]")
      .replace(/authorization=([^&\s]+)/gi, "authorization=[redacted]")
      .replace(/token=([^&\s]+)/gi, "token=[redacted]");
  }

  if (!isRecord(value)) {
    return value ?? null;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      sensitiveProviderResponseKeys.has(key.toLowerCase())
        ? "[redacted]"
        : sanitizedProviderResponse(nestedValue)
    ])
  );
}

function timelineEvent({
  label,
  providerError = null,
  providerMessage = null,
  providerOrderId = null,
  status,
  timestamp = null
}: {
  label: string;
  providerError?: string | null;
  providerMessage?: string | null;
  providerOrderId?: string | null;
  status: "failed" | "info" | "pending" | "success";
  timestamp?: string | null;
}) {
  return {
    label,
    providerError,
    providerMessage,
    providerOrderId,
    status,
    timestamp
  };
}

function domainTimelineFromDraft({
  draft,
  providerMessage
}: {
  draft: AnyRecord;
  providerMessage?: string | null;
}) {
  const createdAt = text(draft.createdAt) || null;

  return [
    timelineEvent({
      label: "Draft created",
      providerMessage: providerMessage ?? (text(draft.paymentPreparationStatus) || null),
      status: "success",
      timestamp: createdAt
    }),
    timelineEvent({
      label: "Availability checked",
      providerMessage: providerMessage ?? "Domain availability confirmed before draft creation.",
      status: "success",
      timestamp: createdAt
    }),
    timelineEvent({
      label: "Waiting provider balance / locked processing",
      providerMessage: text(draft.platformBalanceSafetyStatus) || null,
      status: "info",
      timestamp: createdAt
    })
  ];
}

function idText(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function contactCreateId(contactCreateResponse: unknown) {
  const direct = idText(contactCreateResponse);

  if (direct) {
    return direct;
  }

  return firstTextValue(responseRecord(contactCreateResponse), ["contactid", "contact-id", "entityid", "id"]);
}

function workflowTimelineEvents({
  contactCreateResponse,
  dnsSetup,
  draft,
  preview,
  providerErrorMessage,
  providerOrderId,
  registrationResponse,
  sslSetup,
  workflow
}: {
  contactCreateResponse: unknown;
  dnsSetup: AnyRecord;
  draft: AnyRecord | null;
  preview: AnyRecord | null;
  providerErrorMessage: string | null;
  providerOrderId: string | null;
  registrationResponse: AnyRecord;
  sslSetup: AnyRecord;
  workflow: AnyRecord;
}) {
  const status = text(workflow.status);
  const workflowCreatedAt = text(workflow.createdAt) || null;
  const orderId = providerOrderId;
  const providerStatus = firstTextValue(registrationResponse, ["status", "actionstatus", "actionStatus"]);
  const contactId = contactCreateId(contactCreateResponse);
  const dnsStatus = text(dnsSetup.status);
  const sslStatus = text(sslSetup.status);
  const events = [
    ...domainTimelineFromDraft({
      draft: draft ?? workflow,
      providerMessage: null
    })
  ];

  if (preview) {
    events.push(
      timelineEvent({
        label: "Checkout preview prepared",
        providerMessage: text(preview.status) || null,
        status: "success",
        timestamp: text(preview.createdAt) || null
      })
    );
  }

  events.push(
    timelineEvent({
      label: "Registration submitted",
      providerMessage: text(workflow.registrationStatus, status) || null,
      providerOrderId: orderId,
      status: "success",
      timestamp: workflowCreatedAt
    })
  );

  if (contactId || (isRecord(contactCreateResponse) && Object.keys(contactCreateResponse).length > 0)) {
    events.push(
      timelineEvent({
        label: "Provider contact created",
        providerMessage: contactId ? `Contact ID ${contactId}` : null,
        providerOrderId: orderId,
        status: contactId ? "success" : "info",
        timestamp: workflowCreatedAt
      })
    );
  }

  if (orderId || isRecord(registrationResponse)) {
    events.push(
      timelineEvent({
        label: "Provider order submitted",
        providerMessage: providerStatus,
        providerOrderId: orderId,
        status: providerErrorMessage ? "failed" : "success",
        timestamp: workflowCreatedAt
      })
    );
  }

  if (["registration_completed", "awaiting_dns", "ssl_pending", "ssl_active"].includes(status) && !providerErrorMessage) {
    events.push(
      timelineEvent({
        label: "Provider accepted",
        providerMessage: providerStatus ?? "Registration accepted by provider.",
        providerOrderId: orderId,
        status: "success",
        timestamp: workflowCreatedAt
      })
    );
  }

  if (providerErrorMessage || status === "registration_failed") {
    events.push(
      timelineEvent({
        label: "Provider failed",
        providerError: providerErrorMessage,
        providerOrderId: orderId,
        status: "failed",
        timestamp: workflowCreatedAt
      })
    );
  }

  if (["ready_for_registration", "registration_pending", "registration_processing"].includes(status)) {
    events.push(
      timelineEvent({
        label: "Waiting provider balance / locked processing",
        providerMessage: text(workflow.paymentConfirmationStatus) || null,
        providerOrderId: orderId,
        status: status === "registration_processing" ? "pending" : "info",
        timestamp: workflowCreatedAt
      })
    );
  }

  if (dnsStatus || ["awaiting_dns", "ssl_pending", "ssl_active"].includes(status)) {
    events.push(
      timelineEvent({
        label: "DNS pending",
        providerMessage: dnsStatus || null,
        providerOrderId: orderId,
        status: dnsStatus === "verified" ? "success" : "pending",
        timestamp: text(workflow.updatedAt) || workflowCreatedAt
      })
    );
  }

  if (sslStatus || ["ssl_pending", "ssl_active"].includes(status)) {
    events.push(
      timelineEvent({
        label: "SSL pending",
        providerMessage: sslStatus || null,
        providerOrderId: orderId,
        status: sslStatus === "ssl_active" ? "success" : "pending",
        timestamp: text(workflow.updatedAt) || workflowCreatedAt
      })
    );
  }

  if (status === "ssl_active" || sslStatus === "ssl_active") {
    events.push(
      timelineEvent({
        label: "Connected to store",
        providerMessage: text(workflow.status) || null,
        providerOrderId: orderId,
        status: "success",
        timestamp: text(workflow.updatedAt) || workflowCreatedAt
      })
    );
  }

  return events;
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

function safeEmailSummary(value: unknown) {
  return (
    safeAIErrorSummary(value)
      ?.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
      .slice(0, 180) ?? "No error summary recorded."
  );
}

function maskedEmail(value: unknown) {
  const raw = text(value);
  const [local, domain] = raw.split("@");

  if (!local || !domain) {
    return raw ? "[masked-recipient]" : "Unknown recipient";
  }

  const visibleLocal = local.slice(0, 2);
  const domainParts = domain.split(".");
  const domainName = domainParts[0] ?? "";
  const extension = domainParts.slice(1).join(".");

  return `${visibleLocal}${"*".repeat(Math.max(2, local.length - 2))}@${domainName.slice(0, 1)}***${extension ? `.${extension}` : ""}`;
}

function maskedIP(value: unknown) {
  const raw = text(value);

  if (!raw) {
    return "IP not recorded";
  }

  if (raw.includes(":")) {
    const parts = raw.split(":").filter(Boolean);
    return `${parts.slice(0, 2).join(":")}:****`;
  }

  const parts = raw.split(".");

  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }

  return "[masked-ip]";
}

function safeSecuritySummary(value: unknown) {
  const raw = text(value, "").replace(/\s+/g, " ").trim();

  if (!raw) {
    return "No safe summary recorded.";
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[redacted-token]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
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
    safeSelect(
      supabase,
      "store_payment_provider_connections",
      "store_id, provider, connection_mode, connection_status, config_status, charges_enabled, payouts_enabled, paypal_status, last_sync_at, environment, publishable_key, public_key"
    ),
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
  const enabledMethods = methods.filter((method) => method.is_enabled === true);
  const connectedStoreCountsByProvider = new Map<string, number>();
  const configuredStoreCountsByProvider = new Map<string, number>();
  const latestSyncByProvider = new Map<string, string>();

  for (const connection of connections) {
    const provider = text(connection.provider);
    const storeId = text(connection.store_id);

    if (!provider || !storeId) {
      continue;
    }

    if (
      text(connection.connection_status) === "connected" ||
      text(connection.config_status) === "configured" ||
      text(connection.paypal_status) === "connected"
    ) {
      configuredStoreCountsByProvider.set(provider, (configuredStoreCountsByProvider.get(provider) ?? 0) + 1);
    }

    if (
      text(connection.connection_status) === "connected" ||
      (text(connection.config_status) === "configured" && (text(connection.publishable_key) || text(connection.public_key)))
    ) {
      connectedStoreCountsByProvider.set(provider, (connectedStoreCountsByProvider.get(provider) ?? 0) + 1);
    }

    const lastSyncAt = text(connection.last_sync_at);
    const currentLatest = latestSyncByProvider.get(provider);

    if (lastSyncAt && (!currentLatest || dateValue(lastSyncAt) > dateValue(currentLatest))) {
      latestSyncByProvider.set(provider, lastSyncAt);
    }
  }

  const enabledMethodCounts = new Map<string, number>();
  for (const method of enabledMethods) {
    const methodName = text(method.method);

    if (methodName) {
      enabledMethodCounts.set(methodName, (enabledMethodCounts.get(methodName) ?? 0) + 1);
    }
  }

  const providerDefinitions = [
    {
      checks: [
        { label: "Platform secret key", names: ["PLATFORM_BILLING_STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY"] },
        { label: "Platform webhook secret", names: ["PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET"] },
        { label: "Platform publishable key", names: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_PUBLISHABLE_KEY"] }
      ],
      connectedStoresCount: 0,
      docsUrl: "https://docs.stripe.com/billing",
      key: "stripe_platform",
      name: "Stripe Platform Billing",
      scope: "platform_billing" as const,
      webhookConfigured: envConfigured(["PLATFORM_BILLING_STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET"])
    },
    {
      checks: [
        { label: "Store payments secret key", names: ["STRIPE_SECRET_KEY"] },
        { label: "Stripe Connect client ID", names: ["STRIPE_CONNECT_CLIENT_ID"] }
      ],
      connectedStoresCount: Math.max(
        connectedStoreCountsByProvider.get("stripe") ?? 0,
        configuredStoreCountsByProvider.get("stripe") ?? 0
      ),
      docsUrl: "https://docs.stripe.com/connect",
      key: "stripe_store",
      name: "Stripe Store Payments",
      scope: "store_payments" as const,
      webhookConfigured: envConfigured(["STRIPE_WEBHOOK_SECRET"])
    },
    {
      checks: [
        { label: "NOWPayments API key", names: ["NOWPAYMENTS_API_KEY"] },
        { label: "NOWPayments IPN secret", names: ["NOWPAYMENTS_IPN_SECRET"] }
      ],
      connectedStoresCount: 0,
      docsUrl: "https://nowpayments.io/payment-integration",
      key: "nowpayments",
      name: "NOWPayments",
      scope: "platform_billing" as const,
      webhookConfigured: envConfigured(["NOWPAYMENTS_IPN_SECRET"])
    },
    {
      checks: [
        { label: "PayPal client ID", names: ["PAYPAL_CLIENT_ID"] },
        { label: "PayPal client secret", names: ["PAYPAL_CLIENT_SECRET"] },
        { label: "PayPal webhook ID", names: ["PAYPAL_WEBHOOK_ID"] }
      ],
      connectedStoresCount: 0,
      docsUrl: "https://developer.paypal.com/docs/api/orders/v2/",
      key: "paypal_platform",
      name: "PayPal Platform Billing",
      scope: "platform_billing" as const,
      webhookConfigured: envConfigured(["PAYPAL_WEBHOOK_ID"])
    },
    {
      checks: [
        { label: "PayPal client ID", names: ["PAYPAL_CLIENT_ID"] },
        { label: "PayPal client secret", names: ["PAYPAL_CLIENT_SECRET"] },
        { label: "PayPal partner merchant ID", names: ["PAYPAL_PARTNER_MERCHANT_ID"] }
      ],
      connectedStoresCount: Math.max(
        connectedStoreCountsByProvider.get("paypal") ?? 0,
        configuredStoreCountsByProvider.get("paypal") ?? 0
      ),
      docsUrl: "https://developer.paypal.com/docs/multiparty/",
      key: "paypal",
      name: "PayPal Store Payments",
      scope: "store_payments" as const,
      webhookConfigured: null
    },
    {
      checks: [
        { label: "YouCan Pay public key", names: ["YOUCANPAY_PUBLIC_KEY"] },
        { label: "YouCan Pay private key", names: ["YOUCANPAY_PRIVATE_KEY"] },
        { label: "YouCan Pay sandbox mode", names: ["YOUCANPAY_SANDBOX"] }
      ],
      connectedStoresCount: Math.max(
        connectedStoreCountsByProvider.get("youcan_pay") ?? 0,
        configuredStoreCountsByProvider.get("youcan_pay") ?? 0
      ),
      docsUrl: null,
      key: "youcan_pay",
      name: "YouCan Pay",
      scope: "store_payments" as const,
      webhookConfigured: null
    },
    {
      checks: [{ label: "Store-level instructions", names: [] }],
      connectedStoresCount: enabledMethodCounts.get("bank_transfer") ?? 0,
      docsUrl: null,
      key: "bank_transfer",
      name: "Bank Transfer",
      scope: "manual_offline" as const,
      webhookConfigured: null
    },
    {
      checks: [{ label: "Store-level manual methods", names: [] }],
      connectedStoresCount:
        (enabledMethodCounts.get("cod") ?? 0) +
        (enabledMethodCounts.get("cash_on_delivery") ?? 0) +
        (enabledMethodCounts.get("whatsapp") ?? 0) +
        (enabledMethodCounts.get("whatsapp_order") ?? 0),
      docsUrl: null,
      key: "manual_payments",
      name: "Manual Payments",
      scope: "manual_offline" as const,
      webhookConfigured: null
    }
  ];
  const providers: AdminPaymentProviderControl["providers"] = providerDefinitions.map((provider) => {
    const configChecks = envConfigurationChecks(provider.checks);
    const configurationStatus = configurationStatusFromChecks(configChecks);
    const configured = configurationStatus === "configured";
    const mode = providerMode(provider.key);
    const warnings = providerWarningList({
      configured,
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
          : configured || provider.connectedStoresCount > 0
            ? "enabled"
            : "disabled";
    const providerEvents = recentEvents.filter((event) => {
      const eventProvider = event.provider.toLowerCase();

      return eventProvider === provider.key ||
        provider.key.includes(eventProvider) ||
        eventProvider.includes(provider.key.split("_")[0] ?? provider.key);
    });
    const hasFailures = providerEvents.some((event) => event.eventStatus === "failed");
    const lastCheckedAt =
      latestSyncByProvider.get(provider.key.replace("_store", "").replace("_platform", "")) ??
      text(controlEvent?.processed_at) ??
      text(controlEvent?.created_at) ??
      providerEvents[0]?.createdAt ??
      null;

    return {
      configurationStatus,
      configChecks,
      connectedStoresCount: provider.connectedStoresCount,
      docsUrl: provider.docsUrl,
      enabledStatus,
      environmentMode: mode,
      healthStatus:
        enabledStatus === "under_review"
          ? "needs_review"
          : !configured && provider.connectedStoresCount === 0
            ? "missing_config"
            : hasFailures || warnings.length
              ? "warning"
              : "healthy",
      key: provider.key,
      lastCheckedAt,
      lastEvent: providerEvents[0]?.eventType ?? null,
      name: provider.name,
      scope: provider.scope,
      warnings,
      webhookStatus:
        provider.webhookConfigured === null
          ? "not_applicable"
          : provider.webhookConfigured
            ? "configured"
            : "missing"
    };
  });
  const storesWithSavedPaymentMethods = new Set(
    methods.map((method) => text(method.store_id)).filter(Boolean)
  );
  const storesWithImplicitCod = new Set(
    stores
      .map((store) => text(store.id))
      .filter((storeId) => storeId && !storesWithSavedPaymentMethods.has(storeId))
  );
  const stripeStores = new Set(
    connections
      .filter(
        (connection) =>
          text(connection.provider) === "stripe" &&
          text(connection.connection_status) === "connected" &&
          connection.charges_enabled === true &&
          connection.payouts_enabled === true
      )
      .map((connection) => text(connection.store_id))
      .filter(Boolean)
  );
  const stripePendingStores = new Set(
    connections
      .filter(
        (connection) =>
          text(connection.provider) === "stripe" &&
          text(connection.connection_status) === "pending"
      )
      .map((connection) => text(connection.store_id))
      .filter(Boolean)
  );
  const stripeRestrictedStores = new Set(
    connections
      .filter(
        (connection) =>
          text(connection.provider) === "stripe" &&
          text(connection.connection_status) === "restricted"
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
    [
      ...enabledMethods
        .filter((method) => text(method.method) === "cod")
        .map((method) => text(method.store_id))
        .filter(Boolean),
      ...storesWithImplicitCod
    ]
  );
  const externalMethodRisks = enabledMethods
    .filter((method) => {
      const storeId = text(method.store_id);
      const methodName = text(method.method);

      if (methodName === "paypal") {
        return !paypalStores.has(storeId);
      }

      if (methodName === "youcan_pay") {
        return !connections.some(
          (connection) =>
            text(connection.store_id) === storeId &&
            text(connection.provider) === "youcan_pay" &&
            text(connection.config_status) === "configured"
        );
      }

      return false;
    })
    .map((method) => {
      const store = stores.find((candidate) => text(candidate.id) === text(method.store_id));
      return {
        id: text(method.store_id),
        name: text(store?.store_name, text(store?.name, "Untitled store")),
        ownerEmail: owners.get(ownerUserId(store ?? {})) ?? text(ownerUserId(store ?? {}), "Unknown owner"),
        reason: `${text(method.method).replace(/_/g, " ")} enabled but provider connection is not ready.`,
        slug: text(store?.slug) || null
      };
    });
  const manualStores = new Set(
    [
      ...enabledMethods
        .filter((method) => ["cod", "whatsapp"].includes(text(method.method)))
        .map((method) => text(method.store_id))
        .filter(Boolean),
      ...storesWithImplicitCod
    ]
  );
  const storesWithPayment = new Set([
    ...stripeStores,
    ...paypalStores,
    ...manualStores,
    ...enabledMethods
      .map((method) => text(method.store_id))
      .filter(Boolean)
  ]);
  const paymentSetupRisks = [
    ...externalMethodRisks,
    ...stores
      .filter((store) => !storesWithPayment.has(text(store.id)))
      .map((store) => ({
        id: text(store.id),
        name: text(store.store_name, text(store.name, "Untitled store")),
        ownerEmail: owners.get(ownerUserId(store)) ?? text(ownerUserId(store), "Unknown owner"),
        reason: "No enabled payment method or connected provider found.",
        slug: text(store.slug) || null
      }))
  ].slice(0, 25);

  return {
    paymentSetupRisks,
    providers,
    storePaymentAdoption: {
      codStores: codStores.size,
      manualStores: manualStores.size,
      missingPaymentMethodStores: paymentSetupRisks.length,
      paypalStores: paypalStores.size,
      stripePendingStores: stripePendingStores.size,
      stripeRestrictedStores: stripeRestrictedStores.size,
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
      key: "paypal_platform",
      name: "PayPal Platform Billing",
      requiredEnv: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"]
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
      requiredEnv: ["YOUCANPAY_PUBLIC_KEY", "YOUCANPAY_PRIVATE_KEY", "YOUCANPAY_SANDBOX"]
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
      requiredEnv: ["HTTPAPI_BASE_URL", "HTTPAPI_RESELLER_ID", "HTTPAPI_API_KEY"]
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

export async function getAdminEmailControl(): Promise<AdminEmailControl> {
  const { supabase } = await getAdminUsersBase();
  const [emailLogs, storeMarketingMessages, monitoringEvents] = await Promise.all([
    safeSelect(
      supabase,
      "email_event_logs",
      "id, recipient, subject, template_key, status, error_message, last_error, created_at",
      500
    ),
    safeSelect(supabase, "store_marketing_messages", "id, type, status, updated_at, created_at", 500),
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500)
  ]);
  const adminEmailEvents = monitoringEvents
    .filter((event) => text(event.event_type).startsWith("admin_email_"))
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at));
  const latestEventByTemplate = new Map<string, AnyRecord>();

  for (const event of adminEmailEvents) {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    const templateId = text(metadata.template_id);

    if (templateId && !latestEventByTemplate.has(templateId)) {
      latestEventByTemplate.set(templateId, event);
    }
  }

  function templateStatus(
    templateId: string,
    fallback: AdminEmailControl["templates"][number]["status"]
  ): AdminEmailControl["templates"][number]["status"] {
    const eventType = text(latestEventByTemplate.get(templateId)?.event_type);

    if (eventType === "admin_email_disable_template") {
      return "disabled";
    }

    return fallback;
  }

  const queue = {
    cancelled: emailLogs.filter((log) => text(log.status) === "cancelled").length,
    failed: emailLogs.filter((log) => text(log.status) === "failed").length,
    queued: emailLogs.filter((log) => ["pending", "queued"].includes(text(log.status))).length,
    retryPending: emailLogs.filter((log) => text(log.status) === "retry_pending").length,
    sent: emailLogs.filter((log) => text(log.status) === "sent").length
  };
  const templates: AdminEmailControl["templates"] = [
    {
      category: "welcome",
      id: "welcome:platform-user",
      language: "English",
      lastUpdated: null,
      name: "Platform welcome email",
      status: templateStatus("welcome:platform-user", "draft")
    },
    {
      category: "billing",
      id: "billing:subscription-activated",
      language: "English",
      lastUpdated: null,
      name: "Subscription activated",
      status: templateStatus("billing:subscription-activated", "active")
    },
    {
      category: "billing",
      id: "billing:payment-failed",
      language: "English",
      lastUpdated: null,
      name: "Payment failed",
      status: templateStatus("billing:payment-failed", "active")
    },
    {
      category: "order",
      id: "order:platform-receipt-placeholder",
      language: "English",
      lastUpdated: null,
      name: "Platform order receipt placeholder",
      status: templateStatus("order:platform-receipt-placeholder", "draft")
    },
    {
      category: "domain_email_setup",
      id: "domain-email:setup-instructions",
      language: "English",
      lastUpdated: null,
      name: "Domain and email setup instructions",
      status: templateStatus("domain-email:setup-instructions", "draft")
    },
    {
      category: "support",
      id: "support:ticket-update",
      language: "English",
      lastUpdated: null,
      name: "Support ticket update",
      status: templateStatus("support:ticket-update", "draft")
    },
    {
      category: "security",
      id: "security:account-alert",
      language: "English",
      lastUpdated: null,
      name: "Security account alert",
      status: templateStatus("security:account-alert", "draft")
    }
  ];
  const failedEmails = emailLogs
    .filter((log) => text(log.status) === "failed")
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at))
    .slice(0, 25)
    .map((log) => ({
      createdAt: text(log.created_at, new Date(0).toISOString()),
      emailType: text(log.template_key) || text(log.subject, "Unknown email"),
      errorSummary: safeEmailSummary(log.last_error || log.error_message),
      id: text(log.id) || `failed-email:${text(log.created_at)}`,
      recipientMasked: maskedEmail(log.recipient)
    }));
  const latestStoreMarketingActivity = storeMarketingMessages
    .map((message) => text(message.updated_at) || text(message.created_at))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;
  const providers: AdminEmailControl["providers"] = [
    {
      configurationStatus:
        process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend"
          ? envConfigurationStatus(["RESEND_API_KEY", "EMAIL_FROM"])
          : "missing",
      healthStatus:
        process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend" &&
        process.env.RESEND_API_KEY?.trim() &&
        process.env.EMAIL_FROM?.trim()
          ? "healthy"
          : "missing_config",
      name: "Resend",
      provider: "resend",
      secretStatus:
        process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend"
          ? integrationSecretStatus(["RESEND_API_KEY", "EMAIL_FROM"])
          : "missing"
    },
    {
      configurationStatus: envConfigurationStatus(["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]),
      healthStatus: envConfigurationStatus(["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]) === "configured" ? "warning" : "placeholder",
      name: "SMTP placeholder",
      provider: "smtp",
      secretStatus: integrationSecretStatus(["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"])
    },
    {
      configurationStatus: "missing",
      healthStatus: "placeholder",
      name: "Future providers placeholder",
      provider: "future",
      secretStatus: "no_secret_required"
    }
  ];

  return {
    campaignMonitoring: [
      {
        lastActivity: null,
        name: "Platform campaigns",
        note: "Platform campaign email sending is reserved for a future safe queue.",
        status: "placeholder",
        total: adminEmailEvents.filter((event) => text(event.event_type) === "admin_email_template_preview").length
      },
      {
        lastActivity: latestStoreMarketingActivity,
        name: "Store Owner campaigns summary",
        note: "Read-only summary only. Store Owner campaigns are not edited in Super Admin Email Center.",
        status: "monitoring",
        total: storeMarketingMessages.length
      }
    ],
    failedEmails,
    futureHooks: [
      "Edit template",
      "Send test email",
      "Retry failed email",
      "Export email logs",
      "Provider health check"
    ],
    overview: {
      activeTemplates: templates.filter((template) => template.status === "active").length,
      failedEmails: queue.failed,
      providersConfigured: providers.filter((provider) => provider.configurationStatus === "configured").length,
      queuedEmails: queue.queued + queue.retryPending,
      sentEmails: queue.sent,
      totalTemplates: templates.length
    },
    providers,
    queue,
    templates,
    transactionalSections: [
      {
        key: "welcome",
        name: "Welcome emails",
        note: "Platform onboarding email foundation only.",
        status: "draft"
      },
      {
        key: "billing",
        name: "Billing emails",
        note: "Uses existing billing notification email templates when provider is configured.",
        status: "active"
      },
      {
        key: "order",
        name: "Order emails",
        note: "Store order emails remain managed by Store Owner email systems.",
        status: "placeholder"
      },
      {
        key: "domain_email_setup",
        name: "Domain/email setup emails",
        note: "Professional Email mailbox setup remains in Domains & Hosting.",
        status: "draft"
      },
      {
        key: "support",
        name: "Support emails",
        note: "Support notification email templates are reserved placeholders.",
        status: "draft"
      },
      {
        key: "security",
        name: "Security emails",
        note: "Security alert email templates are reserved placeholders.",
        status: "draft"
      }
    ]
  };
}

export async function getAdminNotificationControl(): Promise<AdminNotificationControl> {
  const { supabase } = await getAdminUsersBase();
  const [notifications, emailLogs, monitoringEvents] = await Promise.all([
    safeSelect(supabase, "notifications", "id, user_id, workspace_id, store_id, type, title, status, read_at, created_at", 500),
    safeSelect(
      supabase,
      "email_event_logs",
      "id, recipient, template_key, status, error_message, last_error, created_at",
      500
    ),
    safeSelect(supabase, "monitoring_events", "id, event_type, event_status, entity_type, metadata, store_id, user_id, created_at", 500)
  ]);
  const adminReviewEvents = monitoringEvents.filter(
    (event) => text(event.event_type) === "admin_notification_mark_reviewed"
  );

  function notificationTypeBucket(value: string): AdminNotificationControl["types"][number]["key"] {
    const lower = value.toLowerCase();

    if (lower.includes("billing") || lower.includes("payment") || lower.includes("subscription") || lower.includes("invoice")) {
      return "billing";
    }

    if (lower.includes("security") || lower.includes("login") || lower.includes("access")) {
      return "security";
    }

    if (lower.includes("domain")) {
      return "domains";
    }

    if (lower.includes("email") || lower.includes("mailbox")) {
      return "email_setup";
    }

    if (lower.includes("ai")) {
      return "ai_visuals";
    }

    if (lower.includes("publish") || lower.includes("launch")) {
      return "store_publishing";
    }

    if (lower.includes("support") || lower.includes("ticket")) {
      return "support";
    }

    return "system_health";
  }

  function notificationStatus(value: unknown, readAt?: unknown): AdminNotificationControl["logs"][number]["status"] {
    const status = text(value).toLowerCase();

    if (status === "failed") {
      return "failed";
    }

    if (status === "queued" || status === "pending") {
      return "queued";
    }

    if (status === "retry_pending") {
      return "retry_pending";
    }

    if (status === "cancelled" || status === "canceled") {
      return "cancelled";
    }

    if (status === "sent") {
      return "sent";
    }

    if (status === "read" || readAt) {
      return "read";
    }

    return "unread";
  }

  const inAppLogs: AdminNotificationControl["logs"] = notifications.map((notification) => ({
    channel: "in_app",
    createdAt: text(notification.created_at, new Date(0).toISOString()),
    errorSummary: null,
    id: text(notification.id) || `notification:${text(notification.created_at)}`,
    recipientMasked: text(notification.user_id)
      ? `user:${text(notification.user_id).slice(0, 8)}...`
      : text(notification.workspace_id)
        ? `workspace:${text(notification.workspace_id).slice(0, 8)}...`
        : "platform recipient",
    status: notificationStatus(notification.status, notification.read_at),
    storeOrUser:
      text(notification.store_id) ||
      text(notification.user_id) ||
      text(notification.workspace_id) ||
      "platform",
    type: text(notification.type, "system")
  }));
  const emailChannelLogs: AdminNotificationControl["logs"] = emailLogs.map((log) => ({
    channel: "email",
    createdAt: text(log.created_at, new Date(0).toISOString()),
    errorSummary: text(log.status) === "failed" ? safeEmailSummary(log.last_error || log.error_message) : null,
    id: text(log.id) || `email:${text(log.created_at)}`,
    recipientMasked: maskedEmail(log.recipient),
    status: notificationStatus(log.status),
    storeOrUser: "email_event_logs",
    type: text(log.template_key, "email")
  }));
  const systemAlertLogs: AdminNotificationControl["logs"] = monitoringEvents
    .filter((event) => ["failed", "warning"].includes(text(event.event_status)))
    .map((event) => {
      const metadata = isRecord(event.metadata) ? event.metadata : {};

      return {
        channel: "system_alert" as const,
        createdAt: text(event.created_at, new Date(0).toISOString()),
        errorSummary: safeEmailSummary(metadata.error || metadata.message || metadata.note || event.event_type),
        id: text(event.id) || `monitoring:${text(event.created_at)}`,
        recipientMasked: "platform admins",
        status: text(event.event_status) === "failed" ? "failed" as const : "queued" as const,
        storeOrUser: text(event.store_id) || text(event.user_id) || text(event.entity_type, "platform"),
        type: text(event.event_type, "system_alert")
      };
    });
  const logs = [...inAppLogs, ...emailChannelLogs, ...systemAlertLogs]
    .sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt))
    .slice(0, 100);
  const typeCounts = new Map<AdminNotificationControl["types"][number]["key"], number>();

  for (const log of logs) {
    const key = notificationTypeBucket(log.type);
    typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1);
  }

  const channels: AdminNotificationControl["channels"] = [
    {
      configuredStatus: "configured",
      healthStatus: "healthy",
      key: "in_app",
      name: "In-app",
      secretStatus: "no_secret_required"
    },
    {
      configuredStatus:
        process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend" &&
        envConfigurationStatus(["RESEND_API_KEY", "EMAIL_FROM"]) === "configured"
          ? "configured"
          : "missing",
      healthStatus:
        process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend" &&
        envConfigurationStatus(["RESEND_API_KEY", "EMAIL_FROM"]) === "configured"
          ? "healthy"
          : "missing_config",
      key: "email",
      name: "Email",
      secretStatus:
        process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend"
          ? integrationSecretStatus(["RESEND_API_KEY", "EMAIL_FROM"])
          : "missing"
    },
    {
      configuredStatus: "placeholder",
      healthStatus: "placeholder",
      key: "sms",
      name: "SMS placeholder",
      secretStatus: integrationSecretStatus(["SMS_PROVIDER_API_KEY"])
    },
    {
      configuredStatus: "placeholder",
      healthStatus: "placeholder",
      key: "whatsapp",
      name: "WhatsApp placeholder",
      secretStatus: integrationSecretStatus(["WHATSAPP_PROVIDER_TOKEN"])
    },
    {
      configuredStatus: "placeholder",
      healthStatus: "placeholder",
      key: "push",
      name: "Push placeholder",
      secretStatus: "no_secret_required"
    },
    {
      configuredStatus: "configured",
      healthStatus: monitoringEvents.some((event) => text(event.event_status) === "failed") ? "warning" : "healthy",
      key: "system_alerts",
      name: "System alerts",
      secretStatus: "no_secret_required"
    }
  ];
  const providerStatus: AdminNotificationControl["providerStatus"] = [
    {
      configuredStatus: channels.find((channel) => channel.key === "email")?.configuredStatus ?? "missing",
      healthStatus: channels.find((channel) => channel.key === "email")?.healthStatus ?? "missing_config",
      provider: "Email provider",
      secretStatus: channels.find((channel) => channel.key === "email")?.secretStatus ?? "missing"
    },
    {
      configuredStatus: "placeholder",
      healthStatus: "placeholder",
      provider: "SMS provider",
      secretStatus: integrationSecretStatus(["SMS_PROVIDER_API_KEY"])
    },
    {
      configuredStatus: "placeholder",
      healthStatus: "placeholder",
      provider: "WhatsApp provider",
      secretStatus: integrationSecretStatus(["WHATSAPP_PROVIDER_TOKEN"])
    },
    {
      configuredStatus: "placeholder",
      healthStatus: "placeholder",
      provider: "Push provider",
      secretStatus: "no_secret_required"
    }
  ];

  return {
    channels,
    futureHooks: [
      "Retry failed notification",
      "Configure channels",
      "Send test notification",
      "Export notification logs",
      "Notification template editor"
    ],
    logs,
    overview: {
      failed: logs.filter((log) => log.status === "failed").length,
      queued: logs.filter((log) => log.status === "queued" || log.status === "retry_pending").length,
      reviewedFailures: adminReviewEvents.length,
      sent: logs.filter((log) => log.status === "sent" || log.status === "read").length,
      totalNotifications: logs.length,
      unread: logs.filter((log) => log.status === "unread").length
    },
    providerStatus,
    types: [
      { count: typeCounts.get("billing") ?? 0, key: "billing", label: "Billing" },
      { count: typeCounts.get("security") ?? 0, key: "security", label: "Security" },
      { count: typeCounts.get("domains") ?? 0, key: "domains", label: "Domains" },
      { count: typeCounts.get("email_setup") ?? 0, key: "email_setup", label: "Email setup" },
      { count: typeCounts.get("ai_visuals") ?? 0, key: "ai_visuals", label: "AI visuals" },
      { count: typeCounts.get("store_publishing") ?? 0, key: "store_publishing", label: "Store publishing" },
      { count: typeCounts.get("support") ?? 0, key: "support", label: "Support" },
      { count: typeCounts.get("system_health") ?? 0, key: "system_health", label: "System health" }
    ]
  };
}

export async function getAdminSEOControl(): Promise<AdminSEOControl> {
  const platformWebsite = await getAdminPlatformWebsiteControl();
  const pages: AdminSEOControl["pages"] = platformWebsite.pages.map((page) => {
    const metaTitleStatus = page.metaTitle.trim() ? "ready" : "missing";
    const metaDescriptionStatus = page.metaDescription.trim() ? "ready" : "missing";
    const canonicalStatus = page.canonical.trim() ? "ready" : "missing";
    const openGraphStatus = page.openGraph.trim() && !page.openGraph.toLowerCase().includes("placeholder")
      ? "ready"
      : "placeholder";
    const languageStatus = page.languages.some((language) => language.status === "ready") ? "ready" : "placeholder";

    return {
      canonicalStatus,
      languageStatus,
      lastUpdated: page.lastUpdated,
      metaDescriptionStatus,
      metaTitleStatus,
      openGraphStatus,
      page: page.title,
      slug: page.slug
    };
  });
  const includedRoutes = ["/", "/pricing", "/reseller", "/l/[slug]", "/store/[slug]", "/store/[slug]/product/[productId]", "/store/[slug]/category/[categorySlug]", "/store/[slug]/pages/[pageSlug]"];
  const blockedPaths = ["/admin/", "/api/", "/dashboard/", "/store/*/account", "/store/*/cart", "/store/*/compare", "/store/*/order/", "/store/*/receipt/", "/store/*/track", "/store/*/wishlist"];
  const isProduction = process.env.NODE_ENV === "production";
  const sitemapStatus = includedRoutes.length ? "ready" : "warning";
  const robotsStatus = blockedPaths.includes("/admin/") && blockedPaths.includes("/api/") ? "ready" : "warning";
  const structuredData: AdminSEOControl["structuredData"] = [
    {
      name: "Organization schema",
      note: "Platform organization schema is represented by root metadata and reserved for JSON-LD hardening.",
      status: "ready"
    },
    {
      name: "Website schema",
      note: "Root platform website metadata is ready; explicit Website JSON-LD remains a future enhancement.",
      status: "ready"
    },
    {
      name: "Breadcrumb schema",
      note: "Reserved for public platform and store route breadcrumbs.",
      status: "placeholder"
    },
    {
      name: "Product schema placeholder",
      note: "Store product structured data belongs to Store Owner SEO and storefront runtime.",
      status: "placeholder"
    },
    {
      name: "FAQ schema placeholder",
      note: "Reserved for platform FAQ and store FAQ pages without duplicating Store Owner SEO.",
      status: "placeholder"
    }
  ];

  return {
    analyticsReadiness: [
      {
        name: "Google Analytics placeholder",
        note: "Platform GA readiness placeholder only. Store Owner analytics remain separate.",
        status: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? "configured" : "placeholder"
      },
      {
        name: "Search Console placeholder",
        note: "Search Console verification and indexing data are not connected in this phase.",
        status: "placeholder"
      },
      {
        name: "Indexing warnings placeholder",
        note: isProduction ? "Production indexing warnings can attach here." : "Non-production environment should be reviewed before indexing.",
        status: isProduction ? "placeholder" : "missing"
      }
    ],
    futureHooks: [
      "SEO editor",
      "AI SEO generator",
      "Sitemap regeneration",
      "Search Console integration",
      "SEO audit export"
    ],
    overview: {
      canonicalReady: pages.filter((page) => page.canonicalStatus === "ready").length,
      indexedPagesPlaceholder: "Search Console not connected",
      languageReady: pages.filter((page) => page.languageStatus === "ready").length,
      missingMetaDescriptions: pages.filter((page) => page.metaDescriptionStatus === "missing").length,
      missingMetaTitles: pages.filter((page) => page.metaTitleStatus === "missing").length,
      robotsStatus,
      sitemapStatus,
      structuredDataStatus: structuredData.every((item) => item.status === "ready") ? "ready" : "placeholder"
    },
    pages,
    robots: {
      allowedPaths: ["/", "/l/", "/store/"],
      blockedPaths,
      environmentWarning: isProduction
        ? "Production robots allow public routes and block admin/dashboard/private routes."
        : "Non-production environment: confirm deployment URL and indexing before launch.",
      status: robotsStatus
    },
    sitemap: {
      excludedRoutes: ["/admin/*", "/api/*", "/dashboard/*", "/store/*/account", "/store/*/cart", "/store/*/checkout", "/store/*/order/*"],
      includedRoutes,
      lastGenerated: "Generated dynamically by app/sitemap.ts",
      status: sitemapStatus
    },
    structuredData
  };
}

export async function getAdminReportingControl(
  range: AdminReportingControl["selectedRange"] = "30d"
): Promise<AdminReportingControl> {
  const selectedRange: AdminReportingControl["selectedRange"] =
    range === "today" || range === "7d" || range === "30d" || range === "month" || range === "year"
      ? range
      : "30d";
  const [
    analytics,
    users,
    stores,
    subscriptions,
    domainsHosting,
    aiControl,
    marketplace,
    platformHealth
  ] = await Promise.all([
    getAdminAnalytics(),
    getAdminUsers(),
    getAdminStores(),
    getAdminSubscriptions(),
    getAdminDomainsHostingControl(),
    getAdminAIControl(),
    getAdminMarketplaceControl(),
    getAdminPlatformHealth()
  ]);
  const categories: AdminReportingControl["categories"] = [
    {
      description: "Revenue estimates from existing commerce and analytics aggregates.",
      name: "Revenue Reports",
      status: "ready"
    },
    {
      description: "Store health, publishing, products, views, and revenue rollups.",
      name: "Store Reports",
      status: "ready"
    },
    {
      description: "User account, plan, governance, and workspace rollups.",
      name: "User Reports",
      status: "ready"
    },
    {
      description: "Subscription plan, payment health, limits, and lifecycle rollups.",
      name: "Subscription Reports",
      status: "ready"
    },
    {
      description: "Payment provider and failed payment monitoring placeholders.",
      name: "Payment Reports",
      status: "review"
    },
    {
      description: "AI job usage, failures, stores using AI, and estimated costs.",
      name: "AI Reports",
      status: "ready"
    },
    {
      description: "Domain drafts, DNS/SSL, email mailbox drafts, and future hosting rollups.",
      name: "Domain & Email Reports",
      status: "ready"
    },
    {
      description: "Marketplace item, approval, visibility, and revenue placeholder rollups.",
      name: "Marketplace Reports",
      status: "ready"
    },
    {
      description: "Security events and audit monitoring from existing logs.",
      name: "Security Reports",
      status: "ready"
    },
    {
      description: "Support tickets, monitoring events, platform health, and operational review.",
      name: "Operations Reports",
      status: platformHealth.label === "Needs review" ? "review" : "ready"
    }
  ];
  const reports: AdminReportingControl["reports"] = [
    {
      category: "Revenue Reports",
      exportPlaceholder: "CSV/PDF export reserved",
      lastGenerated: "Live aggregate",
      name: "Platform revenue estimate",
      reportId: "revenue:platform-estimate",
      status: "ready",
      visibility: "internal"
    },
    {
      category: "Store Reports",
      exportPlaceholder: "CSV export reserved",
      lastGenerated: "Live aggregate",
      name: "Store activity and health",
      reportId: "stores:activity-health",
      status: "ready",
      visibility: "internal"
    },
    {
      category: "User Reports",
      exportPlaceholder: "CSV export reserved",
      lastGenerated: "Live aggregate",
      name: "User growth and governance",
      reportId: "users:growth-governance",
      status: "ready",
      visibility: "internal"
    },
    {
      category: "Subscription Reports",
      exportPlaceholder: "CSV/PDF export reserved",
      lastGenerated: "Live aggregate",
      name: "Subscription plan health",
      reportId: "subscriptions:plan-health",
      status: "ready",
      visibility: "internal"
    },
    {
      category: "Payment Reports",
      exportPlaceholder: "Provider export reserved",
      lastGenerated: "Placeholder",
      name: "Failed payment monitoring",
      reportId: "payments:failed-monitoring",
      status: "review",
      visibility: "internal"
    },
    {
      category: "AI Reports",
      exportPlaceholder: "Usage export reserved",
      lastGenerated: "Live aggregate",
      name: "AI usage and failures",
      reportId: "ai:usage-failures",
      status: aiControl.overview.failedJobs ? "review" : "ready",
      visibility: "internal"
    },
    {
      category: "Domain & Email Reports",
      exportPlaceholder: "CSV export reserved",
      lastGenerated: "Live aggregate",
      name: "Domain and email order readiness",
      reportId: "domains-email:readiness",
      status: domainsHosting.overview.failedOperations ? "review" : "ready",
      visibility: "internal"
    },
    {
      category: "Marketplace Reports",
      exportPlaceholder: "Marketplace export reserved",
      lastGenerated: "Live aggregate",
      name: "Marketplace approval pipeline",
      reportId: "marketplace:approval-pipeline",
      status: marketplace.overview.pendingReviewItems ? "review" : "ready",
      visibility: "internal"
    },
    {
      category: "Security Reports",
      exportPlaceholder: "Audit export reserved",
      lastGenerated: "Live aggregate",
      name: "Security event summary",
      reportId: "security:event-summary",
      status: platformHealth.recentSecurityEvents ? "review" : "ready",
      visibility: "internal"
    },
    {
      category: "Operations Reports",
      exportPlaceholder: "Scheduled delivery reserved",
      lastGenerated: "Live aggregate",
      name: "Operations and support health",
      reportId: "operations:support-health",
      status: platformHealth.label === "Needs review" ? "review" : "ready",
      visibility: "internal"
    }
  ];
  const dateFilters: AdminReportingControl["dateFilters"] = [
    { active: selectedRange === "today", href: "/admin/reports?range=today", label: "Today", value: "today" },
    { active: selectedRange === "7d", href: "/admin/reports?range=7d", label: "7 days", value: "7d" },
    { active: selectedRange === "30d", href: "/admin/reports?range=30d", label: "30 days", value: "30d" },
    { active: selectedRange === "month", href: "/admin/reports?range=month", label: "Month", value: "month" },
    { active: selectedRange === "year", href: "/admin/reports?range=year", label: "Year", value: "year" }
  ];

  return {
    categories,
    dateFilters,
    futureHooks: [
      "CSV export",
      "PDF export",
      "Scheduled reports",
      "Email report delivery",
      "BI dashboard integration"
    ],
    overview: {
      activeStores: stores.filter((store) => store.storeStatus === "active" || store.publicationStatus === "published").length,
      activeUsers: users.filter((user) => user.accountStatus === "active").length,
      aiUsage: aiControl.overview.totalJobs,
      domainOrders:
        domainsHosting.overview.domainDrafts +
        domainsHosting.overview.pendingDomainOrders +
        domainsHosting.overview.readyForRegistration,
      failedPayments: subscriptions.reduce((total, subscription) => total + subscription.failedPayments, 0),
      paidSubscriptions: subscriptions.filter((subscription) => subscription.planId !== "free" && subscription.status === "active").length,
      securityEvents: platformHealth.recentSecurityEvents,
      supportTickets: platformHealth.openSupportTickets,
      totalRevenueEstimate: analytics.revenueEstimate
    },
    reports,
    selectedRange,
    sources: [
      "getAdminAnalytics",
      "getAdminUsers",
      "getAdminStores",
      "getAdminSubscriptions",
      "getAdminDomainsHostingControl",
      "getAdminAIControl",
      "getAdminMarketplaceControl",
      "getAdminPlatformHealth"
    ]
  };
}

export async function getAdminAdvancedSecurityControl(): Promise<AdminAdvancedSecurityControl> {
  const { supabase } = await getAdminClient();
  const [securityLogs, adminEvents] = await Promise.all([
    safeSelect(
      supabase,
      "security_audit_logs",
      "id, workspace_id, store_id, user_id, action, reason, route, ip_address, user_agent, metadata, created_at",
      500
    ),
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500)
  ]);
  const reviewedIds = new Set(
    adminEvents
      .filter((event) => text(event.event_type) === "admin_security_mark_reviewed")
      .map((event) => {
        const metadata = isRecord(event.metadata) ? event.metadata : {};
        return text(metadata.event_id);
      })
      .filter(Boolean)
  );

  function severityFor(log: AnyRecord): AdminAdvancedSecurityControl["events"][number]["severity"] {
    const action = text(log.action).toLowerCase();
    const reason = text(log.reason).toLowerCase();

    if (action.includes("token") || reason.includes("token") || action.includes("fraud")) {
      return "critical";
    }

    if (action.includes("denied") || action.includes("unauthorized") || action.includes("rate_limit") || reason.includes("abuse")) {
      return "high";
    }

    if (action.includes("login") && (action.includes("failed") || reason.includes("failed"))) {
      return "medium";
    }

    return "low";
  }

  function statusFor(
    log: AnyRecord,
    severity: AdminAdvancedSecurityControl["events"][number]["severity"]
  ): AdminAdvancedSecurityControl["events"][number]["status"] {
    const id = text(log.id);
    const action = text(log.action).toLowerCase();

    if (id && reviewedIds.has(id)) {
      return "reviewed";
    }

    if (action.includes("denied") || action.includes("rate_limit") || action.includes("blocked")) {
      return "blocked";
    }

    if (action.includes("failed")) {
      return "failed";
    }

    return severity === "high" || severity === "critical" ? "watching" : "recorded";
  }

  const events = securityLogs
    .sort((left, right) => dateValue(right.created_at) - dateValue(left.created_at))
    .slice(0, 100)
    .map((log) => {
      const severity = severityFor(log);
      const userAgent = text(log.user_agent);
      const { browserLabel, deviceLabel } = summarizeUserAgent(userAgent);

      return {
        browser: browserLabel,
        createdAt: text(log.created_at, new Date(0).toISOString()),
        device: deviceLabel,
        eventType: text(log.action, "security.event"),
        id: text(log.id) || `security:${text(log.created_at)}`,
        ipMasked: maskedIP(log.ip_address),
        severity,
        status: statusFor(log, severity),
        storeId: text(log.store_id) || null,
        summary: safeSecuritySummary(log.reason),
        userId: text(log.user_id) || null
      };
    });
  const highRiskUsers = new Set(
    events.filter((event) => (event.severity === "high" || event.severity === "critical") && event.userId).map((event) => event.userId)
  ).size;
  const highRiskStores = new Set(
    events.filter((event) => (event.severity === "high" || event.severity === "critical") && event.storeId).map((event) => event.storeId)
  ).size;
  const suspiciousEvents = events.filter((event) => event.severity === "high" || event.severity === "critical").length;
  const sections: AdminAdvancedSecurityControl["sections"] = [
    {
      name: "Audit Logs",
      note: "Uses existing security_audit_logs records without duplicating audit storage.",
      status: "monitoring"
    },
    {
      name: "Login Monitoring",
      note: "Login success and failure events are summarized from security audit actions.",
      status: "monitoring"
    },
    {
      name: "IP Monitoring",
      note: "IP addresses are masked before display.",
      status: "monitoring"
    },
    {
      name: "Device Monitoring",
      note: "Browser/device labels are derived from user-agent summaries only.",
      status: "monitoring"
    },
    {
      name: "Abuse Detection",
      note: "Unauthorized, denied, and repeated-action signals feed review status.",
      status: suspiciousEvents ? "review" : "monitoring"
    },
    {
      name: "Fraud Detection",
      note: "Fraud rules engine is reserved; current phase monitors high-risk audit patterns.",
      status: "placeholder"
    },
    {
      name: "Rate Limits",
      note: "Rate-limit exceeded events come from existing rate-limit audit logging.",
      status: events.some((event) => event.eventType.includes("rate_limit")) ? "review" : "monitoring"
    },
    {
      name: "Risk Score Engine",
      note: "Risk levels are derived from event classification; no automated enforcement here.",
      status: "placeholder"
    }
  ];

  return {
    events,
    futureHooks: [
      "Fraud rules engine",
      "IP blocklist",
      "Device fingerprinting",
      "Automated abuse detection",
      "Security alert notifications",
      "Export audit logs"
    ],
    overview: {
      deniedAccessEvents: events.filter((event) => event.eventType.toLowerCase().includes("denied")).length,
      failedLogins: events.filter((event) => event.eventType.toLowerCase().includes("login") && event.status === "failed").length,
      highRiskStores,
      highRiskUsers,
      rateLimitEvents: events.filter((event) => event.eventType.toLowerCase().includes("rate_limit")).length,
      suspiciousEvents,
      totalLoginEvents: events.filter((event) => event.eventType.toLowerCase().includes("login")).length
    },
    riskScores: [
      { count: events.filter((event) => event.severity === "low").length, description: "Routine or informational audit events.", level: "low" },
      { count: events.filter((event) => event.severity === "medium").length, description: "Failed login or moderate review signals.", level: "medium" },
      { count: events.filter((event) => event.severity === "high").length, description: "Denied access, abuse, or rate-limit signals.", level: "high" },
      { count: events.filter((event) => event.severity === "critical").length, description: "Token, fraud, or severe security signals.", level: "critical" }
    ],
    sections
  };
}

export async function getAdminOperationsControl(): Promise<AdminOperationsControl> {
  const { supabase, serviceRoleConfigured } = await getAdminClient();
  const [monitoringEvents, emailLogs, aiQueues, domainsHosting] = await Promise.all([
    safeSelect(supabase, "monitoring_events", "event_type, event_status, entity_type, metadata, created_at", 500),
    safeSelect(supabase, "email_event_logs", "id, status, sent_at, created_at, next_retry_at", 500),
    safeSelect(
      supabase,
      "ai_generation_queue",
      "id, workflow_state, queue_status, attempts, max_attempts, completed_at, failed_at, created_at, updated_at",
      500
    ),
    getAdminDomainsHostingControl()
  ]);
  const monitoringFailures = monitoringEvents.filter((event) => {
    const eventStatus = text(event.event_status).toLowerCase();
    const eventType = text(event.event_type).toLowerCase();
    return eventStatus === "failed" || eventType.includes("failed") || eventType.includes("error");
  });
  const latestMonitoring = monitoringEvents
    .map((event) => text(event.created_at))
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;

  function latestDate(rows: AnyRecord[], keys: string[]) {
    return rows
      .flatMap((row) => keys.map((key) => text(row[key])).filter(Boolean))
      .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;
  }

  const emailQueue = {
    completed: emailLogs.filter((log) => text(log.status) === "sent").length,
    failed: emailLogs.filter((log) => text(log.status) === "failed").length,
    lastProcessed: latestDate(emailLogs, ["sent_at", "created_at"]),
    name: "Email event queue",
    pending: emailLogs.filter((log) => ["pending", "queued", "retry_pending"].includes(text(log.status))).length,
    processing: emailLogs.filter((log) => text(log.status) === "processing").length
  };
  const aiQueue = {
    completed: aiQueues.filter((queue) => ["succeeded", "completed", "ready"].includes(text(queue.queue_status, text(queue.workflow_state)))).length,
    failed: aiQueues.filter((queue) => text(queue.queue_status) === "failed" || text(queue.workflow_state) === "failed").length,
    lastProcessed: latestDate(aiQueues, ["completed_at", "failed_at", "updated_at", "created_at"]),
    name: "AI generation queue",
    pending: aiQueues.filter((queue) => ["queued", "waiting", "pending"].includes(text(queue.queue_status, text(queue.workflow_state)))).length,
    processing: aiQueues.filter((queue) => ["running", "processing", "generating"].includes(text(queue.queue_status, text(queue.workflow_state)))).length
  };
  const domainEmailQueue = {
    completed: domainsHosting.overview.connectedDomains,
    failed: domainsHosting.overview.failedOperations,
    lastProcessed:
      [...domainsHosting.domainOrders, ...domainsHosting.emailOrders]
        .map((order) => order.createdAt)
        .filter(Boolean)
        .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null,
    name: "Domain/email workflow queue",
    pending:
      domainsHosting.overview.pendingDomainOrders +
      domainsHosting.overview.dnsPending +
      domainsHosting.overview.sslPending +
      domainsHosting.overview.emailMailboxDrafts,
    processing: domainsHosting.overview.readyForRegistration
  };
  const monitoringQueue = {
    completed: monitoringEvents.filter((event) => ["info", "success", "recorded"].includes(text(event.event_status))).length,
    failed: monitoringFailures.length,
    lastProcessed: latestMonitoring,
    name: "Monitoring event stream",
    pending: monitoringEvents.filter((event) => ["warning", "retry_pending"].includes(text(event.event_status))).length,
    processing: 0
  };
  const queues = [emailQueue, aiQueue, domainEmailQueue, monitoringQueue];
  const r2Status = envConfigurationStatus([
    "CLOUDFLARE_R2_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET"
  ]);
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const queueHasFailures = queues.some((queue) => queue.failed > 0);
  const workerFailures = aiQueue.failed + emailQueue.failed + domainEmailQueue.failed + monitoringFailures.length;
  const aiWorkerStatus: AdminOperationsControl["workers"][number]["status"] =
    aiQueue.processing > 0 ? "running" : aiQueue.failed > 0 ? "warning" : "idle";
  const emailWorkerStatus: AdminOperationsControl["workers"][number]["status"] =
    emailQueue.processing > 0 ? "running" : emailQueue.failed > 0 ? "warning" : "idle";

  return {
    backupRecovery: [
      {
        name: "Backup status",
        note: "Supabase backup status is not queried in this phase.",
        status: "placeholder"
      },
      {
        name: "Last backup placeholder",
        note: "Backup timestamp will attach when provider backup APIs are connected.",
        status: "placeholder"
      },
      {
        name: "Restore test placeholder",
        note: "No restore is triggered from Super Admin Operations.",
        status: "placeholder"
      },
      {
        name: "Disaster recovery readiness",
        note: "Runbook readiness placeholder only; no production reset or restore action exists.",
        status: "review"
      }
    ],
    cronJobs: [
      {
        lastRun: latestMonitoring,
        name: "Billing sync monitor",
        nextRun: "Placeholder schedule",
        schedule: "Provider webhook driven",
        status: "placeholder"
      },
      {
        lastRun: emailQueue.lastProcessed,
        name: "Email retry monitor",
        nextRun: "Future cron placeholder",
        schedule: "Manual/store-triggered queue today",
        status: emailQueue.failed ? "review" : "placeholder"
      },
      {
        lastRun: aiQueue.lastProcessed,
        name: "AI queue monitor",
        nextRun: "Future worker schedule",
        schedule: "Worker/runtime driven",
        status: aiQueue.failed ? "review" : "placeholder"
      },
      {
        lastRun: domainEmailQueue.lastProcessed,
        name: "Domain/email workflow monitor",
        nextRun: "Future provider sync",
        schedule: "Placeholder",
        status: domainEmailQueue.failed ? "review" : "placeholder"
      }
    ],
    databaseStorage: [
      {
        metric: "Supabase health",
        note: "Presence check only. No destructive database operation is exposed.",
        status: supabaseConfigured ? "configured" : "missing",
        value: supabaseConfigured ? "Configured" : "Missing environment"
      },
      {
        metric: "R2 storage health",
        note: "Secret values remain hidden; only configuration status is shown.",
        status: r2Status === "configured" ? "configured" : r2Status === "partial" ? "review" : "missing",
        value: r2Status
      },
      {
        metric: "Database size",
        note: "Database size metrics require provider integration.",
        status: "placeholder",
        value: "Placeholder"
      },
      {
        metric: "Storage usage",
        note: "Storage usage metrics require provider integration.",
        status: "placeholder",
        value: "Placeholder"
      },
      {
        metric: "Service role readiness",
        note: "Status only; key is never displayed.",
        status: serviceRoleConfigured ? "configured" : "missing",
        value: serviceRoleConfigured ? "Configured" : "Missing"
      }
    ],
    futureHooks: [
      "Retry failed queue",
      "Restart worker",
      "Run cron manually",
      "Trigger backup",
      "Restore backup",
      "Export logs",
      "Incident notifications"
    ],
    overview: {
      aiQueueHealth: aiQueue.failed ? "needs_review" : aiQueues.length ? "healthy" : "placeholder",
      cronHealth: monitoringFailures.length ? "needs_review" : "placeholder",
      databaseHealth: supabaseConfigured ? "healthy" : "missing_config",
      domainEmailQueueHealth: domainEmailQueue.failed ? "needs_review" : domainEmailQueue.pending ? "healthy" : "placeholder",
      emailQueueHealth: emailQueue.failed ? "needs_review" : emailLogs.length ? "healthy" : "placeholder",
      queueHealth: queueHasFailures ? "needs_review" : "healthy",
      storageHealth: r2Status === "configured" ? "healthy" : r2Status === "partial" ? "needs_review" : "missing_config",
      workerHealth: workerFailures ? "needs_review" : "placeholder"
    },
    queues,
    sections: [
      {
        name: "Queues",
        note: "Aggregates existing email, AI, domain/email, and monitoring queues/log streams.",
        status: queueHasFailures ? "review" : "monitoring"
      },
      {
        name: "Workers",
        note: "Worker status is inferred from existing queue activity. No worker restart is available.",
        status: workerFailures ? "review" : "monitoring"
      },
      {
        name: "Cron Jobs",
        note: "Cron schedules are placeholders until scheduler integration is added.",
        status: "placeholder"
      },
      {
        name: "Storage Health",
        note: "Supabase/R2 configuration status only; no storage operations run here.",
        status: r2Status === "partial" ? "review" : "monitoring"
      },
      {
        name: "Database Health",
        note: "Environment and service-role readiness only; no direct database action.",
        status: supabaseConfigured ? "monitoring" : "review"
      },
      {
        name: "Backups",
        note: "Backup status is a non-destructive placeholder.",
        status: "placeholder"
      },
      {
        name: "Disaster Recovery",
        note: "Restore tests and disaster recovery runbooks are placeholders only.",
        status: "placeholder"
      },
      {
        name: "System Monitoring",
        note: "Uses existing monitoring_events without duplicating monitoring storage.",
        status: monitoringFailures.length ? "review" : "monitoring"
      }
    ],
    workers: [
      {
        failures: aiQueue.failed,
        lastRun: aiQueue.lastProcessed,
        name: "AI visual/generation worker",
        nextRun: "Runtime driven",
        status: aiWorkerStatus
      },
      {
        failures: emailQueue.failed,
        lastRun: emailQueue.lastProcessed,
        name: "Email delivery worker",
        nextRun: "Queue driven",
        status: emailWorkerStatus
      },
      {
        failures: domainEmailQueue.failed,
        lastRun: domainEmailQueue.lastProcessed,
        name: "Domain/email provider worker placeholder",
        nextRun: "Future provider sync",
        status: domainEmailQueue.failed ? "warning" : "placeholder"
      },
      {
        failures: monitoringFailures.length,
        lastRun: latestMonitoring,
        name: "Monitoring event processor",
        nextRun: "Live event stream",
        status: monitoringFailures.length ? "warning" : "idle"
      }
    ]
  };
}

const internalPermissionGroups: AdminInternalTeamControl["permissionGroups"] = [
  { description: "Platform user review and account governance.", key: "users", label: "Users" },
  { description: "Store monitoring and seller/store governance.", key: "stores", label: "Stores" },
  { description: "Subscriptions, invoices, payment provider monitoring, and revenue reports.", key: "billing", label: "Billing" },
  { description: "Domain, hosting, professional email, DNS, and SSL monitoring.", key: "domains", label: "Domains" },
  { description: "AI jobs, provider readiness, usage, and failure monitoring.", key: "ai", label: "AI" },
  { description: "Support tickets, user issues, and safe assistance workflows.", key: "support", label: "Support" },
  { description: "Security events, risk review, fraud/abuse placeholders, and audit logs.", key: "security", label: "Security" },
  { description: "Queues, workers, cron placeholders, backups, and runtime health.", key: "operations", label: "Operations" },
  { description: "Templates, themes, plugins, apps, and approval workflow placeholders.", key: "marketplace", label: "Marketplace" },
  { description: "Platform settings, integrations, branding, SEO, and governance foundations.", key: "settings", label: "Settings" }
];

export async function getAdminInternalTeamControl(): Promise<AdminInternalTeamControl> {
  const { supabase, users } = await getAdminUsersBase();
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const [memberRows, inviteRows] = await Promise.all([
    safeSelect(
      supabase,
      "internal_team_members",
      "id, user_id, email, display_name, role, status, invited_at, accepted_at, last_active_at, created_at",
      1000
    ),
    safeSelect(
      supabase,
      "internal_team_invitations",
      "id, email, display_name, role, status, expires_at, accepted_at, accepted_user_id, invited_by, last_sent_at, email_status, email_error, created_at",
      1000
    )
  ]);
  const configuredEmails = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const configuredSuperAdminMembers = configuredEmails
    .filter((email) => !memberRows.some((row) => text(row.email).toLowerCase() === email))
    .map((email, index) => {
      const user = usersByEmail.get(email);
      const role = internalTeamRoleMeta("super_admin");

      return {
        acceptedAt: user?.createdAt ?? null,
        assignedArea: role.assignedArea,
        createdAt: user?.createdAt ?? null,
        email,
        id: user?.id ?? `configured-super-admin-${index}`,
        invitedAt: null,
        lastActiveAt: user?.lastLoginAt ?? null,
        name: user?.fullName ?? email,
        permissionsSummary: role.permissionsSummary,
        role: role.name,
        roleKey: role.key,
        status: "active" as const,
        userId: user?.id ?? null
      };
    });
  const members: AdminInternalTeamControl["members"] = [
    ...configuredSuperAdminMembers,
    ...memberRows.map((row) => {
      const member = row as InternalTeamMemberRow;
      const user = usersByEmail.get(text(member.email).toLowerCase());
      const roleKey = normalizeInternalTeamRole(member.role);
      const role = internalTeamRoleMeta(roleKey);

      return {
        acceptedAt: text(member.accepted_at) || null,
        assignedArea: role.assignedArea,
        createdAt: text(member.created_at) || null,
        email: text(member.email, "unknown@internal.local").toLowerCase(),
        id: text(member.id, text(member.user_id, text(member.email))),
        invitedAt: text(member.invited_at) || null,
        lastActiveAt: text(member.last_active_at) || user?.lastLoginAt || null,
        name: text(member.display_name) || user?.fullName || text(member.email),
        permissionsSummary: role.permissionsSummary,
        role: role.name,
        roleKey,
        status: member.status === "suspended" ? "suspended" as const : "active" as const,
        userId: text(member.user_id) || null
      };
    })
  ].sort((left, right) => dateValue(right.lastActiveAt ?? right.createdAt) - dateValue(left.lastActiveAt ?? left.createdAt));
  const invitations: AdminInternalTeamControl["invitations"] = inviteRows
    .map((row) => {
      const invite = row as InternalTeamInvitationRow;
      const roleKey = normalizeInternalTeamRole(invite.role);
      const role = internalTeamRoleMeta(roleKey);
      const expiresAt = text(invite.expires_at) || null;
      const expired = invite.status === "pending" && expiresAt ? dateValue(expiresAt) < Date.now() : false;

      return {
        acceptedAt: text(invite.accepted_at) || null,
        createdAt: text(invite.created_at) || null,
        email: text(invite.email, "pending@internal.local").toLowerCase(),
        emailStatus: text(invite.email_status, "not_sent"),
        expiresAt,
        id: text(invite.id),
        invitedAt: text(invite.created_at) || null,
        lastSentAt: text(invite.last_sent_at) || null,
        name: text(invite.display_name) || text(invite.email, "Pending invite"),
        role: role.name,
        roleKey,
        status: expired ? "expired" : invite.status
      };
    })
    .sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt));

  return {
    accessSafety: [
      {
        name: "Final Super Admin protection",
        note: "Runtime actions block self-removal and protect the final active Super Admin from suspension or downgrade.",
        status: "enforced"
      },
      {
        name: "No destructive staff deletion",
        note: "Members and invitations are suspended, restored, cancelled, or expired; no destructive deletion is exposed.",
        status: "enforced"
      },
      {
        name: "Internal role RBAC",
        note: "Admin access is restricted by internal role while configured Super Admins retain full access.",
        status: "runtime"
      },
      {
        name: "Secure invite tokens",
        note: "Invitation tokens are stored only as SHA-256 hashes with expiration dates.",
        status: "enforced"
      },
      {
        name: "Audit every team action",
        note: "Invitation, acceptance, role, suspend, restore, resend, and cancel actions write monitoring and security audit events.",
        status: "enforced"
      }
    ],
    invitations,
    members,
    overview: {
      activeStaff: members.filter((member) => member.status === "active").length,
      finalSuperAdminProtected: "enforced",
      pendingInvites: invitations.filter((invite) => invite.status === "pending").length,
      permissionGroups: internalPermissionGroups.length,
      roles: internalTeamRoles.length,
      suspendedStaff: members.filter((member) => member.status === "suspended").length
    },
    permissionGroups: internalPermissionGroups,
    roles: internalTeamRoles
  };
}

function formattedLimit(value: number | null | undefined) {
  return value === null ? "Unlimited" : String(value ?? "Placeholder");
}

export async function getAdminPlatformSettingsControl(): Promise<AdminPlatformSettingsControl> {
  await getAdminAccess();

  const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME?.trim() || "SHASTORE";
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || process.env.EMAIL_FROM?.trim() || "support@shastore.local";
  const defaultCountry = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY?.trim() || "MA";
  const defaultTimezone = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE?.trim() || "UTC";
  const defaultLanguage = process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE?.trim() || "en";
  const defaultCurrency = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY?.trim().toUpperCase() || "USD";
  const starterLimits = planLimitsConfig.starter;
  const proLimits = planLimitsConfig.pro;

  return {
    currencies: [
      { code: "USD", isDefault: defaultCurrency === "USD", name: "US Dollar", status: "enabled" },
      { code: "EUR", isDefault: defaultCurrency === "EUR", name: "Euro", status: "placeholder_disabled" },
      { code: "MAD", isDefault: defaultCurrency === "MAD", name: "Moroccan Dirham", status: "placeholder_disabled" },
      { code: "AED", isDefault: defaultCurrency === "AED", name: "UAE Dirham", status: "placeholder_disabled" },
      { code: "SAR", isDefault: defaultCurrency === "SAR", name: "Saudi Riyal", status: "placeholder_disabled" }
    ],
    defaultLimits: [
      {
        description: "Read-only reference from existing billing plan limits. No billing rewrite.",
        key: "default_stores_per_plan",
        value: `Starter ${formattedLimit(starterLimits.stores)} / Pro ${formattedLimit(proLimits.stores)}`
      },
      {
        description: "Read-only reference from existing product limits.",
        key: "default_products_per_plan",
        value: `Starter ${formattedLimit(starterLimits.products)} / Pro ${formattedLimit(proLimits.products)}`
      },
      {
        description: "Read-only reference from existing AI generation limits.",
        key: "default_ai_credits",
        value: `Starter ${formattedLimit(starterLimits.aiGenerations)} / Pro ${formattedLimit(proLimits.aiGenerations)}`
      },
      {
        description: "Read-only reference from existing domain limits.",
        key: "default_domain_credit",
        value: `Starter ${formattedLimit(starterLimits.domains)} / Pro ${formattedLimit(proLimits.domains)}`
      },
      {
        description: "Read-only reference from existing team member limits.",
        key: "default_team_members",
        value: `Starter ${formattedLimit(starterLimits.teamMembers)} / Pro ${formattedLimit(proLimits.teamMembers)}`
      }
    ],
    featureFlags: [
      {
        key: "platform_feature_rollout",
        note: "Future rollout control only. No feature gate changes are applied in this phase.",
        status: "placeholder"
      },
      {
        key: "marketplace_seller_access",
        note: "Future marketplace seller access flag placeholder.",
        status: "placeholder"
      },
      {
        key: "maintenance_scheduling",
        note: "Future scheduled maintenance flag placeholder.",
        status: "placeholder"
      },
      {
        key: "regional_tax_engine",
        note: "Future tax rules engine flag placeholder.",
        status: "placeholder"
      }
    ],
    futureHooks: [
      "Save global settings",
      "Feature flag rollout",
      "Regional defaults",
      "Tax rules engine",
      "Platform-wide maintenance scheduling",
      "Export settings snapshot"
    ],
    general: [
      {
        key: "platform_name",
        label: "Platform name",
        note: "Display default only; Platform Theme remains separate.",
        value: platformName
      },
      {
        key: "support_email",
        label: "Support email",
        note: "Public support reference only; no mail provider secret is shown.",
        value: supportEmail
      },
      {
        key: "default_country",
        label: "Default country",
        note: "Global default for future onboarding only.",
        value: defaultCountry
      },
      {
        key: "default_timezone",
        label: "Default timezone",
        note: "Does not overwrite Store Owner timezone settings.",
        value: defaultTimezone
      },
      {
        key: "default_language",
        label: "Default language",
        note: "Does not overwrite Store Owner language settings.",
        value: defaultLanguage
      },
      {
        key: "default_currency",
        label: "Default currency",
        note: "Does not overwrite Store Owner currency settings.",
        value: defaultCurrency
      }
    ],
    languages: [
      { code: "ar", direction: "RTL", name: "Arabic", readiness: "ready" },
      { code: "en", direction: "LTR", name: "English", readiness: "ready" },
      { code: "fr", direction: "LTR", name: "French", readiness: "placeholder" }
    ],
    legalPolicies: [
      {
        name: "Terms of Service",
        note: "Platform policy reference placeholder for public website/legal pages.",
        status: "placeholder"
      },
      {
        name: "Privacy Policy",
        note: "Platform policy reference placeholder, separate from Store Owner legal pages.",
        status: "placeholder"
      },
      {
        name: "Refund and billing policy",
        note: "Platform billing policy reference only; billing logic remains unchanged.",
        status: "placeholder"
      },
      {
        name: "Acceptable use policy",
        note: "Future moderation/security policy reference.",
        status: "placeholder"
      }
    ],
    maintenanceModes: [
      {
        name: "Platform maintenance",
        note: "Placeholder only. No platform shutdown or redirect is enabled.",
        status: "off_placeholder",
        warning: "Future toggle must require confirmation and scheduling."
      },
      {
        name: "Owner dashboard maintenance",
        note: "Placeholder only. Store Owner dashboards remain available.",
        status: "off_placeholder",
        warning: "Future toggle must not block billing, support, or auth unexpectedly."
      },
      {
        name: "Public website maintenance",
        note: "Placeholder only. Public marketing pages remain available.",
        status: "off_placeholder",
        warning: "Future toggle must preserve legal/status access."
      },
      {
        name: "Storefront maintenance",
        note: "Placeholder only. Existing storefront runtime remains untouched.",
        status: "off_placeholder",
        warning: "Future toggle must not affect stores without explicit migration/rollout."
      }
    ],
    overview: {
      currencies: 5,
      defaultCurrency,
      defaultLanguage,
      languages: 3,
      maintenanceModes: 4,
      sections: 10,
      storeSettingsTouched: 0
    },
    regionalSettings: [
      { key: "country", label: "Default country", value: defaultCountry },
      { key: "timezone", label: "Default timezone", value: defaultTimezone },
      { key: "language_direction", label: "RTL/LTR readiness", value: "Arabic RTL, English/French LTR" },
      { key: "number_format", label: "Number format", value: "Future regional default placeholder" },
      { key: "date_format", label: "Date format", value: "Future regional default placeholder" }
    ],
    safety: [
      {
        name: "Global defaults only",
        note: "Settings shown here do not overwrite existing stores or Store Owner settings.",
        status: "enforced"
      },
      {
        name: "No immediate destructive toggle",
        note: "Maintenance, feature flags, taxes, and limits are placeholder controls only.",
        status: "enforced"
      },
      {
        name: "Store Owner settings separation",
        note: "Store-specific settings remain under dashboard routes and store records.",
        status: "enforced"
      },
      {
        name: "Platform Theme separation",
        note: "Branding and theme publishing remain in /admin/platform-theme.",
        status: "enforced"
      },
      {
        name: "Billing separation",
        note: "Plan limits are displayed as references only; billing enforcement is not modified.",
        status: "enforced"
      }
    ],
    sections: [
      { name: "General settings", note: "Platform identity and default locale references.", status: "ready" },
      { name: "Languages", note: "Arabic, English, French, and direction readiness.", status: "ready" },
      { name: "Currencies", note: "Currency availability placeholders and default currency.", status: "ready" },
      { name: "Timezones", note: "Default timezone references for future onboarding.", status: "ready" },
      { name: "Taxes", note: "Tax settings are placeholders; Store Owner tax settings remain separate.", status: "placeholder" },
      { name: "Default limits", note: "Read-only billing plan limit references.", status: "ready" },
      { name: "Regional settings", note: "Regional defaults for future onboarding only.", status: "placeholder" },
      { name: "Maintenance mode", note: "Non-destructive maintenance placeholders.", status: "placeholder" },
      { name: "Legal/platform policies", note: "Platform policy references, separate from store legal pages.", status: "placeholder" },
      { name: "Feature flags placeholder", note: "Future rollout controls with no live effect.", status: "placeholder" }
    ],
    taxes: [
      {
        key: "tax_enabled",
        label: "Tax enabled",
        note: "Placeholder only; Store Owner tax settings remain store-specific.",
        value: "Off placeholder"
      },
      {
        key: "default_tax_rate",
        label: "Default tax rate",
        note: "Future onboarding default only.",
        value: "0% placeholder"
      },
      {
        key: "regional_tax_mode",
        label: "Regional tax mode",
        note: "Future tax rules engine placeholder.",
        value: "Manual placeholder"
      }
    ],
    timezones: [
      { isDefault: defaultTimezone === "UTC", label: "UTC", value: "UTC" },
      { isDefault: defaultTimezone === "Africa/Casablanca", label: "Casablanca", value: "Africa/Casablanca" },
      { isDefault: defaultTimezone === "Europe/Paris", label: "Paris", value: "Europe/Paris" },
      { isDefault: defaultTimezone === "Asia/Dubai", label: "Dubai", value: "Asia/Dubai" },
      { isDefault: defaultTimezone === "Asia/Riyadh", label: "Riyadh", value: "Asia/Riyadh" }
    ]
  };
}

export async function getAdminDomainsHostingControl(): Promise<AdminDomainsHostingControl> {
  const { supabase, users } = await getAdminUsersBase();
  const httpApiReadiness = getHttpApiReadiness();
  const owners = emailMap(users);
  const [stores, storeDomains, runtimeDomainOrders, runtimeDnsRecords] = await Promise.all([
    safeSelect(supabase, "stores", "id, owner_user_id, user_id, name, store_name, slug, store_data, created_at"),
    safeSelect(
      supabase,
      "store_domains",
      "id, store_id, store_instance_id, owner_user_id, hostname, domain_type, status, verification_status, dns_status, ssl_status, is_primary, primary_domain, created_at"
    ),
    safeSelect(
      supabase,
      "domain_orders",
      "id, store_id, domain_name, tld, provider, provider_order_id, provider_entity_id, registration_years, status, raw_response, created_at"
    ),
    safeSelect(
      supabase,
      "domain_dns_records",
      "id, domain_order_id, domain_name, record_type, name, value, ttl, priority, status, verification_status, created_at, updated_at"
    )
  ]);
  const storeById = new Map(stores.map((store) => [text(store.id), store]));
  const runtimeDomainOrderById = new Map(runtimeDomainOrders.map((order) => [text(order.id), order]));
  const dnsRecordsByOrderId = new Map<string, DomainDnsRuntimeRecord[]>();

  for (const record of runtimeDnsRecords) {
    const domainOrderId = text(record.domain_order_id);
    const recordType = text(record.record_type, "TXT") as DomainDnsRuntimeRecord["recordType"];

    if (!domainOrderId || !["A", "ALIAS", "CNAME", "TXT"].includes(recordType)) {
      continue;
    }

    const records = dnsRecordsByOrderId.get(domainOrderId) ?? [];
    records.push({
      createdAt: text(record.created_at) || null,
      domainName: text(record.domain_name),
      domainOrderId,
      id: text(record.id, `${domainOrderId}-${recordType}-${text(record.name)}`),
      name: text(record.name),
      priority: numberValue(record.priority),
      recordType,
      status: (["pending", "configured", "verified", "failed"].includes(text(record.status))
        ? text(record.status)
        : "pending") as DomainDnsRuntimeRecord["status"],
      ttl: numberValue(record.ttl) || 3600,
      updatedAt: text(record.updated_at) || null,
      value: text(record.value),
      verificationStatus: (["pending", "configured", "verified", "failed"].includes(text(record.verification_status))
        ? text(record.verification_status)
        : "pending") as DomainDnsRuntimeRecord["verificationStatus"]
    });
    dnsRecordsByOrderId.set(domainOrderId, records);
  }

  const projectedRuntimeDomainOrderIds = new Set<string>();
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
        adminContactId: null,
        autoRenew: null,
        billingContactId: null,
        createdAt: text(draft.createdAt),
        customerDueCents: centsValue(draft.customerDueCents ?? draft.customerDue),
        domain,
        domainOrderId: null,
        dnsRecords: [],
        extension: text(draft.extension, domain.includes(".") ? `.${domain.split(".").pop()}` : "unknown"),
        id: text(draft.id, `${storeId}-domain-draft-${domain}`),
        nameserverCount: 0,
        nameservers: [],
        nextStep: text(isRecord(draft.paymentPreparation) ? draft.paymentPreparation.nextStep : null, "Prepare payment or registration workflow"),
        ownerEmail,
        planCreditUsedCents: centsValue(draft.creditUsedCents ?? draft.creditUsed),
        provider: null,
        providerCustomerId: null,
        providerEntityId: null,
        providerErrorMessage: null,
        providerOrderId: null,
        providerResponse: null,
        providerStatusSyncedAt: null,
        registrantContactId: null,
        registrationYears: null,
        status: text(draft.status, "draft"),
        storeId,
        storeName,
        techContactId: null,
        timelineEvents: domainTimelineFromDraft({ draft }),
        updatedAt: text(draft.updatedAt, text(draft.createdAt))
      });
    }

    for (const workflow of recordsFromStoreData(storeData, "domainRegistrationWorkflows")) {
      const domain = text(workflow.domain);
      const dnsSetup = isRecord(workflow.dnsSetup) ? workflow.dnsSetup : {};
      const sslSetup = isRecord(workflow.sslSetup) ? workflow.sslSetup : {};
      const providerRawResponse = workflow.providerRawResponse;
      const registrationResponse = providerRegistrationResponse(providerRawResponse);
      const contactCreateResponse = isRecord(providerRawResponse)
        ? providerRawResponse.contactCreate
        : null;
      const nameservers = nameserverListFromWorkflow(workflow);
      const contactId = contactCreateId(contactCreateResponse);
      const providerErrorMessage = providerErrorFromWorkflow(workflow);
      const providerOrderId = text(workflow.providerOrderId) || firstTextValue(registrationResponse, ["orderid", "orderId", "entityid", "entityId"]);
      const draft = recordFromStoreDataById(storeData, "domainOrderDrafts", text(workflow.domainOrderDraftId));
      const preview = recordFromStoreDataById(storeData, "domainCheckoutPreviews", text(workflow.domainCheckoutPreviewId));
      const domainOrderId = text(workflow.registrationOrderId) || null;
      const runtimeOrder = domainOrderId ? runtimeDomainOrderById.get(domainOrderId) : null;
      const runtimeRawResponse = runtimeOrder?.raw_response;
      const runtimeStatusSync = responseRecord(runtimeRawResponse);
      const providerStatusSyncedAt = firstTextValue(runtimeStatusSync, ["providerStatusSyncedAt", "syncedAt"]);
      const dnsRecords = domainOrderId
        ? dnsRecordsByOrderId.get(domainOrderId) ??
          buildDefaultDomainDnsRecords({
            domainName: domain,
            domainOrderId,
            dnsSetup: {
              domain,
              records: [],
              status: "pending",
              targetStore: storeName
            }
          })
        : [];

      if (domainOrderId) {
        projectedRuntimeDomainOrderIds.add(domainOrderId);
      }

      domainOrders.push({
        adminContactId: firstTextValue(workflow, ["adminContactId", "admin-contact-id"]) ?? contactId,
        autoRenew: firstTextValue(registrationResponse, ["auto-renew", "autoRenew"]),
        billingContactId: firstTextValue(workflow, ["billingContactId", "billing-contact-id"]) ?? contactId,
        createdAt: text(workflow.createdAt),
        customerDueCents: centsValue(workflow.customerDueCents ?? workflow.customerDue),
        domain,
        domainOrderId,
        dnsRecords,
        extension: domain.includes(".") ? `.${domain.split(".").pop()}` : "unknown",
        id: text(workflow.id, `${storeId}-domain-workflow-${domain}`),
        nameserverCount: nameservers.length,
        nameservers,
        nextStep: text(dnsSetup.status) === "verified" ? "Request SSL placeholder" : "Verify DNS placeholder",
        ownerEmail,
        planCreditUsedCents: 0,
        provider: text(workflow.provider) || null,
        providerCustomerId: firstTextValue(workflow, ["customerId", "customer-id"]) ?? firstTextValue(registrationResponse, ["customerid", "customer-id", "customerId"]),
        providerEntityId: text(workflow.providerEntityId) || text(runtimeOrder?.provider_entity_id) || firstTextValue(registrationResponse, ["entityid", "entityId"]),
        providerErrorMessage,
        providerOrderId: providerOrderId || text(runtimeOrder?.provider_order_id) || null,
        providerResponse: sanitizedProviderResponse(runtimeRawResponse ?? providerRawResponse),
        providerStatusSyncedAt,
        registrantContactId: firstTextValue(workflow, ["registrantContactId", "reg-contact-id"]) ?? contactId,
        registrationYears: numberValue(workflow.registrationYears) || null,
        status: text(runtimeOrder?.status, text(workflow.status, "ready_for_registration")),
        storeId,
        storeName,
        techContactId: firstTextValue(workflow, ["techContactId", "tech-contact-id"]) ?? contactId,
        timelineEvents: workflowTimelineEvents({
          contactCreateResponse,
          dnsSetup,
          draft,
          preview,
          providerErrorMessage,
          providerOrderId,
          registrationResponse,
          sslSetup,
          workflow
        }),
        updatedAt: text(workflow.updatedAt, text(workflow.createdAt))
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

  for (const order of runtimeDomainOrders) {
    const domainOrderId = text(order.id);

    if (projectedRuntimeDomainOrderIds.has(domainOrderId)) {
      continue;
    }

    const store = storeById.get(text(order.store_id));
    const ownerId = store ? ownerUserId(store) : "";
    const domain = text(order.domain_name, "Unknown domain");
    const rawResponse = order.raw_response;
    const rawRecord = responseRecord(rawResponse);
    const statusSync = responseRecord(rawRecord.statusSync);
    const providerStatus = firstTextValue(rawRecord, ["latestProviderStatus", "providerStatus", "currentstatus", "status"]);
    const providerStatusSyncedAt =
      firstTextValue(rawRecord, ["providerStatusSyncedAt", "syncedAt"]) ??
      firstTextValue(statusSync, ["syncedAt"]);
    const providerOrderId = text(order.provider_order_id) || firstTextValue(rawRecord, ["orderid", "orderId"]);
    const providerEntityId = text(order.provider_entity_id) || firstTextValue(rawRecord, ["entityid", "entityId"]);
    const dnsRecords =
      dnsRecordsByOrderId.get(domainOrderId) ??
      buildDefaultDomainDnsRecords({
        domainName: domain,
        domainOrderId
      });

    domainOrders.push({
      adminContactId: firstTextValue(rawRecord, ["adminContactId", "admin-contact-id"]),
      autoRenew: firstTextValue(rawRecord, ["auto-renew", "autoRenew"]),
      billingContactId: firstTextValue(rawRecord, ["billingContactId", "billing-contact-id"]),
      createdAt: text(order.created_at),
      customerDueCents: 0,
      domain,
      domainOrderId,
      dnsRecords,
      extension: text(order.tld, domain.includes(".") ? `.${domain.split(".").pop()}` : "unknown"),
      id: domainOrderId,
      nameserverCount: 0,
      nameservers: [],
      nextStep: providerStatusSyncedAt ? "Provider status synced" : "Sync provider status",
      ownerEmail: store ? owners.get(ownerId) ?? text(ownerId, "Unknown owner") : "Unknown owner",
      planCreditUsedCents: 0,
      provider: text(order.provider, "httpapi") || null,
      providerCustomerId: firstTextValue(rawRecord, ["customerid", "customer-id", "customerId"]),
      providerEntityId,
      providerErrorMessage: providerErrorFromWorkflow({ providerRawResponse: rawResponse, registrationError: null }),
      providerOrderId,
      providerResponse: sanitizedProviderResponse(rawResponse),
      providerStatusSyncedAt,
      registrantContactId: firstTextValue(rawRecord, ["registrantContactId", "reg-contact-id"]),
      registrationYears: numberValue(order.registration_years) || null,
      status: text(order.status, providerStatus ?? "unknown"),
      storeId: text(order.store_id),
      storeName: store ? text(store.store_name, text(store.name, "Untitled store")) : "Unknown store",
      techContactId: firstTextValue(rawRecord, ["techContactId", "tech-contact-id"]),
      timelineEvents: [
        timelineEvent({
          label: "Runtime domain order created",
          providerMessage: text(order.status) || null,
          providerOrderId,
          status: text(order.status) === "failed" ? "failed" : "info",
          timestamp: text(order.created_at) || null
        }),
        ...(providerStatusSyncedAt
          ? [
              timelineEvent({
                label: "Provider status synced",
                providerMessage: providerStatus,
                providerOrderId,
                status: providerStatus === "active" ? "success" : providerStatus === "failed" ? "failed" : "info",
                timestamp: providerStatusSyncedAt
              })
            ]
          : [])
      ],
      updatedAt: providerStatusSyncedAt ?? text(order.created_at)
    });
  }

  const sslStatuses: AdminDomainsHostingControl["sslStatuses"] = storeDomains.map((domain) => {
    const store = storeById.get(text(domain.store_id)) ?? storeById.get(text(domain.store_instance_id));
    const ownerId = store ? ownerUserId(store) : text(domain.owner_user_id);

    return {
      createdAt: text(domain.created_at),
      dnsStatus: text(domain.dns_status, text(domain.verification_status, "pending")),
      domain: text(domain.hostname, text(domain.primary_domain, "Unknown domain")),
      id: text(domain.id),
      ownerEmail: owners.get(ownerId) ?? text(ownerId, "Unknown owner"),
      primaryDomainStatus: domain.is_primary === true ? "primary" : "secondary",
      provider: null,
      sslStatus: text(domain.ssl_status, "pending"),
      storeId: store ? text(store.id) : text(domain.store_id, text(domain.store_instance_id)),
      storeName: store ? text(store.store_name, text(store.name, "Untitled store")) : "Unknown store"
    };
  });
  const workflowSslStatuses = stores.flatMap((store) =>
    recordsFromStoreData(store.store_data, "domainRegistrationWorkflows").map((workflow) => {
      const dnsSetup = isRecord(workflow.dnsSetup) ? workflow.dnsSetup : {};
      const sslSetup = isRecord(workflow.sslSetup) ? workflow.sslSetup : {};

      return {
        createdAt: text(workflow.createdAt),
        dnsStatus: text(dnsSetup.status, "not_started"),
        domain: text(workflow.domain, "Pending domain"),
        id: text(workflow.id, `${text(store.id)}-workflow-ssl`),
        ownerEmail: owners.get(ownerUserId(store)) ?? text(ownerUserId(store), "Unknown owner"),
        primaryDomainStatus: "workflow placeholder",
        provider: text(workflow.provider) || null,
        sslStatus: text(sslSetup.status, "ssl_pending"),
        storeId: text(store.id),
        storeName: text(store.store_name, text(store.name, "Untitled store"))
      };
    })
  );
  const allSslStatuses = [...sslStatuses, ...workflowSslStatuses];
  const allDnsRecords = domainOrders.flatMap((order) => order.dnsRecords);
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
        allDnsRecords.filter((record) => record.status === "pending").length +
        storeDomains.filter((domain) => ["pending", "verifying", "not_configured"].includes(text(domain.dns_status))).length +
        workflowSslStatuses.filter((status) => status.dnsStatus !== "verified").length,
      dnsConfigured: allDnsRecords.filter((record) => record.status === "configured").length,
      dnsFailed: allDnsRecords.filter((record) => record.status === "failed" || record.verificationStatus === "failed").length,
      dnsVerified: allDnsRecords.filter((record) => record.status === "verified" || record.verificationStatus === "verified").length,
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
      {
        service: "Domain service health",
        status: httpApiReadiness.enabled ? "ready" : "review",
        note: httpApiReadiness.enabled
          ? "HTTPAPI domain availability search is configured. Admin health does not call the provider."
          : "Configure HTTPAPI_BASE_URL, HTTPAPI_RESELLER_ID, and HTTPAPI_API_KEY to enable domain availability search."
      },
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
