import "server-only";

export type ReportRegistrySource = "reports_registry_runtime";

export type ReportRegistryCategory =
  | "AI Reports"
  | "Domain & Email Reports"
  | "Marketplace Reports"
  | "Operations Reports"
  | "Payment Reports"
  | "Report Certification"
  | "Report Platform"
  | "Reports Registry"
  | "Revenue Reports"
  | "Security Reports"
  | "Store Reports"
  | "Subscription Reports"
  | "User Reports";

export type ReportRegistryStatus = "inactive" | "planned" | "placeholder" | "ready" | "review";

export type ReportRegistryVisibility = "hidden" | "internal" | "super_admin";

export type ReportExportAvailabilityState = "export_ready" | "placeholder" | "unavailable";

export type ReportSafeActionsAvailability = "available" | "placeholder" | "unavailable";

export type ReportCertificationState = "certified" | "needs_attention" | "not_applicable" | "planned";

export type ReportRegistryRoadmapPhase =
  | "RP-1"
  | "RP-10"
  | "RP-11"
  | "RP-12"
  | "RP-13"
  | "RP-14"
  | "RP-15"
  | "RP-16"
  | "RP-17"
  | "RP-18"
  | "RP-19"
  | "RP-2"
  | "RP-20"
  | "RP-21"
  | "RP-22"
  | "RP-23"
  | "RP-24"
  | "RP-25"
  | "RP-26"
  | "RP-3"
  | "RP-4"
  | "RP-5"
  | "RP-6"
  | "RP-7"
  | "RP-8"
  | "RP-9";

export type ReportRegistryEntryDefinition = {
  category: ReportRegistryCategory;
  certificationState: ReportCertificationState;
  dataSourceDescription: string;
  exportAvailabilityState: ReportExportAvailabilityState;
  futureHooks: readonly string[];
  lastGeneratedState: string;
  reportId: string;
  reportKey: string;
  roadmapPhase: ReportRegistryRoadmapPhase;
  safeActionsAvailability: ReportSafeActionsAvailability;
  status: ReportRegistryStatus;
  title: string;
  visibility: ReportRegistryVisibility;
};

export type ReportRegistryEntry = ReportRegistryEntryDefinition & {
  readOnly: true;
  source: ReportRegistrySource;
};

export type ReportsRegistryRuntimeContext = {
  aiFailedJobs: boolean;
  domainsFailedOperations: boolean;
  marketplacePendingReview: boolean;
  platformHealthNeedsReview: boolean;
  recentSecurityEvents: boolean;
  revenueReportLastGenerated?: string;
  revenueReportNeedsAttention?: boolean;
  storeReportLastGenerated?: string;
  storeReportNeedsAttention?: boolean;
  userReportLastGenerated?: string;
  userReportNeedsAttention?: boolean;
  subscriptionReportLastGenerated?: string;
  subscriptionReportNeedsAttention?: boolean;
  paymentReportLastGenerated?: string;
  paymentReportNeedsAttention?: boolean;
  aiReportLastGenerated?: string;
  aiReportNeedsAttention?: boolean;
  domainEmailReportLastGenerated?: string;
  domainEmailReportNeedsAttention?: boolean;
  marketplaceReportLastGenerated?: string;
  marketplaceReportNeedsAttention?: boolean;
  securityReportLastGenerated?: string;
  securityReportNeedsAttention?: boolean;
  operationsReportLastGenerated?: string;
  operationsReportNeedsAttention?: boolean;
  reportViewerLastGenerated?: string;
  reportViewerNeedsAttention?: boolean;
  reportStatusLastGenerated?: string;
  reportStatusNeedsAttention?: boolean;
  reportVisibilityLastGenerated?: string;
  reportVisibilityNeedsAttention?: boolean;
  reportSafeActionsLastGenerated?: string;
  reportSafeActionsNeedsAttention?: boolean;
  selectedRange: "today" | "7d" | "30d" | "month" | "year";
};

export type ReportsRegistryRuntimeStatus = "needs_attention" | "registry_ready";

export type ReportsRegistrySummary = {
  activeEntries: number;
  plannedEntries: number;
  readOnly: true;
  status: ReportsRegistryRuntimeStatus;
  summary: string;
  totalEntries: number;
};

export type ReportsRegistryValidation = {
  isValid: boolean;
  issues: string[];
};

export const REPORTS_REGISTRY_SOURCE = "reports_registry_runtime" as const;

export const REPORT_CATEGORY_NAMES = [
  "Revenue Reports",
  "Store Reports",
  "User Reports",
  "Subscription Reports",
  "Payment Reports",
  "AI Reports",
  "Domain & Email Reports",
  "Marketplace Reports",
  "Security Reports",
  "Operations Reports"
] as const;

export type ReportCategoryName = (typeof REPORT_CATEGORY_NAMES)[number];

const REPORT_REGISTRY_DEFINITIONS: readonly ReportRegistryEntryDefinition[] = [
  {
    category: "Reports Registry",
    certificationState: "planned",
    dataSourceDescription: "Centralized in-memory report registry runtime. No database writes on page load.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Registry sync", "Registry audit trail"],
    lastGeneratedState: "Live registry",
    reportId: "registry:reports-registry",
    reportKey: "rp-1-reports-registry",
    roadmapPhase: "RP-1",
    safeActionsAvailability: "unavailable",
    status: "ready",
    title: "Reports Registry",
    visibility: "super_admin"
  },
  {
    category: "Revenue Reports",
    certificationState: "not_applicable",
    dataSourceDescription: "getAdminAnalytics revenue estimate aggregate.",
    exportAvailabilityState: "placeholder",
    futureHooks: ["CSV export", "PDF export"],
    lastGeneratedState: "Live aggregate",
    reportId: "revenue:platform-estimate",
    reportKey: "rp-2-revenue-reports",
    roadmapPhase: "RP-2",
    safeActionsAvailability: "placeholder",
    status: "ready",
    title: "Platform revenue estimate",
    visibility: "internal"
  },
  {
    category: "Store Reports",
    certificationState: "not_applicable",
    dataSourceDescription: "getAdminStores activity and health aggregate.",
    exportAvailabilityState: "placeholder",
    futureHooks: ["CSV export"],
    lastGeneratedState: "Live aggregate",
    reportId: "stores:activity-health",
    reportKey: "rp-3-store-reports",
    roadmapPhase: "RP-3",
    safeActionsAvailability: "placeholder",
    status: "ready",
    title: "Store activity and health",
    visibility: "internal"
  },
  {
    category: "User Reports",
    certificationState: "not_applicable",
    dataSourceDescription: "getAdminUsers growth and governance aggregate.",
    exportAvailabilityState: "placeholder",
    futureHooks: ["CSV export"],
    lastGeneratedState: "Live aggregate",
    reportId: "users:growth-governance",
    reportKey: "rp-4-user-reports",
    roadmapPhase: "RP-4",
    safeActionsAvailability: "placeholder",
    status: "ready",
    title: "User growth and governance",
    visibility: "internal"
  },
  {
    category: "Subscription Reports",
    certificationState: "not_applicable",
    dataSourceDescription: "getAdminSubscriptions plan health aggregate.",
    exportAvailabilityState: "placeholder",
    futureHooks: ["CSV export", "PDF export"],
    lastGeneratedState: "Live aggregate",
    reportId: "subscriptions:plan-health",
    reportKey: "rp-5-subscription-reports",
    roadmapPhase: "RP-5",
    safeActionsAvailability: "placeholder",
    status: "ready",
    title: "Subscription plan health",
    visibility: "internal"
  },
  {
    category: "Payment Reports",
    certificationState: "not_applicable",
    dataSourceDescription: "Payment Reports runtime (commerce_orders, store_orders, invoices, billing_events).",
    exportAvailabilityState: "placeholder",
    futureHooks: ["Provider export"],
    lastGeneratedState: "Live aggregate",
    reportId: "payments:failed-monitoring",
    reportKey: "rp-6-payment-reports",
    roadmapPhase: "RP-6",
    safeActionsAvailability: "placeholder",
    status: "ready",
    title: "Failed payment monitoring",
    visibility: "internal"
  },
  {
    category: "AI Reports",
    certificationState: "not_applicable",
    dataSourceDescription: "getAdminAIControl usage and failure aggregate.",
    exportAvailabilityState: "placeholder",
    futureHooks: ["Usage export"],
    lastGeneratedState: "Live aggregate",
    reportId: "ai:usage-failures",
    reportKey: "rp-7-ai-reports",
    roadmapPhase: "RP-7",
    safeActionsAvailability: "placeholder",
    status: "ready",
    title: "AI usage and failures",
    visibility: "internal"
  },
  {
    category: "Domain & Email Reports",
    certificationState: "not_applicable",
    dataSourceDescription:
      "Domain & Email Reports runtime (store_domains, domain_orders, domain_dns_records, stores).",
    exportAvailabilityState: "placeholder",
    futureHooks: ["CSV export"],
    lastGeneratedState: "Live aggregate",
    reportId: "domains-email:readiness",
    reportKey: "rp-8-domain-email-reports",
    roadmapPhase: "RP-8",
    safeActionsAvailability: "placeholder",
    status: "ready",
    title: "Domain and email order readiness",
    visibility: "internal"
  },
  {
    category: "Marketplace Reports",
    certificationState: "not_applicable",
    dataSourceDescription:
      "Marketplace Reports runtime (marketplace_items, marketplace_creator_accounts, marketplace_install_events, marketplace_revenue_events, marketplace_purchases).",
    exportAvailabilityState: "placeholder",
    futureHooks: ["Marketplace export"],
    lastGeneratedState: "Live aggregate",
    reportId: "marketplace:approval-pipeline",
    reportKey: "rp-9-marketplace-reports",
    roadmapPhase: "RP-9",
    safeActionsAvailability: "placeholder",
    status: "ready",
    title: "Marketplace approval pipeline",
    visibility: "internal"
  },
  {
    category: "Security Reports",
    certificationState: "not_applicable",
    dataSourceDescription: "getAdminPlatformHealth security event aggregate.",
    exportAvailabilityState: "placeholder",
    futureHooks: ["Audit export"],
    lastGeneratedState: "Live aggregate",
    reportId: "security:event-summary",
    reportKey: "rp-10-security-reports",
    roadmapPhase: "RP-10",
    safeActionsAvailability: "placeholder",
    status: "ready",
    title: "Security event summary",
    visibility: "internal"
  },
  {
    category: "Operations Reports",
    certificationState: "not_applicable",
    dataSourceDescription: "getAdminPlatformHealth support and operations aggregate.",
    exportAvailabilityState: "placeholder",
    futureHooks: ["Scheduled delivery"],
    lastGeneratedState: "Live aggregate",
    reportId: "operations:support-health",
    reportKey: "rp-11-operations-reports",
    roadmapPhase: "RP-11",
    safeActionsAvailability: "placeholder",
    status: "ready",
    title: "Operations and support health",
    visibility: "internal"
  },
  {
    category: "Report Platform",
    certificationState: "not_applicable",
    dataSourceDescription: "Report Viewer runtime (RP-1 registry + RP-2 through RP-11 adapters). Read-only on page load.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Inline viewer", "Report drill-down"],
    lastGeneratedState: "Viewer catalog",
    reportId: "platform:report-viewer",
    reportKey: "rp-12-report-viewer",
    roadmapPhase: "RP-12",
    safeActionsAvailability: "unavailable",
    status: "ready",
    title: "Report Viewer",
    visibility: "super_admin"
  },
  {
    category: "Report Platform",
    certificationState: "not_applicable",
    dataSourceDescription: "Report Status runtime (registry metadata + RP-2 through RP-11 adapter signals). Read-only on page load.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Status history"],
    lastGeneratedState: "Live status layer",
    reportId: "platform:report-status",
    reportKey: "rp-13-report-status",
    roadmapPhase: "RP-13",
    safeActionsAvailability: "unavailable",
    status: "ready",
    title: "Report Status",
    visibility: "super_admin"
  },
  {
    category: "Report Platform",
    certificationState: "not_applicable",
    dataSourceDescription:
      "Report Visibility runtime (registry metadata + RP-13 status signals). Read-only on page load.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Role-based visibility"],
    lastGeneratedState: "Live registry",
    reportId: "platform:report-visibility",
    reportKey: "rp-14-report-visibility",
    roadmapPhase: "RP-14",
    safeActionsAvailability: "unavailable",
    status: "ready",
    title: "Report Visibility",
    visibility: "super_admin"
  },
  {
    category: "Report Platform",
    certificationState: "planned",
    dataSourceDescription:
      "Report Safe Actions runtime (registry metadata + RP-13 status + RP-14 visibility + RP-12 viewer). Read-only on page load.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Action catalog expansion"],
    lastGeneratedState: "Live action guard",
    reportId: "platform:safe-actions",
    reportKey: "rp-15-safe-actions",
    roadmapPhase: "RP-15",
    safeActionsAvailability: "placeholder",
    status: "review",
    title: "Safe Actions",
    visibility: "super_admin"
  },
  {
    category: "Report Platform",
    certificationState: "not_applicable",
    dataSourceDescription: "Overview metrics reused from existing admin aggregates.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Cross-report aggregation"],
    lastGeneratedState: "Live aggregate",
    reportId: "platform:report-aggregation",
    reportKey: "rp-16-report-aggregation",
    roadmapPhase: "RP-16",
    safeActionsAvailability: "unavailable",
    status: "ready",
    title: "Report Aggregation",
    visibility: "super_admin"
  },
  {
    category: "Report Platform",
    certificationState: "not_applicable",
    dataSourceDescription: "Date range filters on Reporting Center page load.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Advanced filters"],
    lastGeneratedState: "Live registry",
    reportId: "platform:report-filters",
    reportKey: "rp-17-report-filters",
    roadmapPhase: "RP-17",
    safeActionsAvailability: "unavailable",
    status: "ready",
    title: "Report Filters",
    visibility: "super_admin"
  },
  {
    category: "Report Platform",
    certificationState: "planned",
    dataSourceDescription: "Report search reserved for a future phase.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Full-text search", "Registry search"],
    lastGeneratedState: "Not generated",
    reportId: "platform:report-search",
    reportKey: "rp-18-report-search",
    roadmapPhase: "RP-18",
    safeActionsAvailability: "unavailable",
    status: "planned",
    title: "Report Search",
    visibility: "super_admin"
  },
  {
    category: "Report Platform",
    certificationState: "planned",
    dataSourceDescription: "Report audit trail reserved. Existing actions log monitoring events only.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Audit timeline", "Audit export"],
    lastGeneratedState: "Monitoring placeholders",
    reportId: "platform:report-audit",
    reportKey: "rp-19-report-audit",
    roadmapPhase: "RP-19",
    safeActionsAvailability: "unavailable",
    status: "planned",
    title: "Report Audit",
    visibility: "super_admin"
  },
  {
    category: "Report Platform",
    certificationState: "planned",
    dataSourceDescription: "Mark reviewed monitoring placeholder. No report persistence.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Review workflow"],
    lastGeneratedState: "Monitoring placeholders",
    reportId: "platform:report-review",
    reportKey: "rp-20-report-review",
    roadmapPhase: "RP-20",
    safeActionsAvailability: "placeholder",
    status: "review",
    title: "Report Review",
    visibility: "super_admin"
  },
  {
    category: "Report Platform",
    certificationState: "planned",
    dataSourceDescription: "Export placeholder only. No file generation on page load.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["CSV export", "PDF export"],
    lastGeneratedState: "Not generated",
    reportId: "platform:report-export",
    reportKey: "rp-21-report-export",
    roadmapPhase: "RP-21",
    safeActionsAvailability: "unavailable",
    status: "planned",
    title: "Report Export",
    visibility: "super_admin"
  },
  {
    category: "Report Platform",
    certificationState: "planned",
    dataSourceDescription: "Scheduled reports reserved. No queue or delivery on page load.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Scheduled delivery", "Email report delivery"],
    lastGeneratedState: "Not generated",
    reportId: "platform:scheduled-reports",
    reportKey: "rp-22-scheduled-reports",
    roadmapPhase: "RP-22",
    safeActionsAvailability: "unavailable",
    status: "planned",
    title: "Scheduled Reports",
    visibility: "super_admin"
  },
  {
    category: "Report Certification",
    certificationState: "planned",
    dataSourceDescription: "Report data certification reserved for RP-23.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Data integrity checks"],
    lastGeneratedState: "Not generated",
    reportId: "certification:report-data",
    reportKey: "rp-23-report-data-certification",
    roadmapPhase: "RP-23",
    safeActionsAvailability: "unavailable",
    status: "planned",
    title: "Report Data Certification",
    visibility: "super_admin"
  },
  {
    category: "Report Certification",
    certificationState: "planned",
    dataSourceDescription: "Report security certification reserved for RP-24.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Security checks"],
    lastGeneratedState: "Not generated",
    reportId: "certification:report-security",
    reportKey: "rp-24-report-security-certification",
    roadmapPhase: "RP-24",
    safeActionsAvailability: "unavailable",
    status: "planned",
    title: "Report Security Certification",
    visibility: "super_admin"
  },
  {
    category: "Report Certification",
    certificationState: "planned",
    dataSourceDescription: "Report runtime certification reserved for RP-25.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Runtime checks"],
    lastGeneratedState: "Not generated",
    reportId: "certification:report-runtime",
    reportKey: "rp-25-report-runtime-certification",
    roadmapPhase: "RP-25",
    safeActionsAvailability: "unavailable",
    status: "planned",
    title: "Report Runtime Certification",
    visibility: "super_admin"
  },
  {
    category: "Report Certification",
    certificationState: "planned",
    dataSourceDescription: "Report production certification reserved for RP-26.",
    exportAvailabilityState: "unavailable",
    futureHooks: ["Production certification"],
    lastGeneratedState: "Not generated",
    reportId: "certification:report-production",
    reportKey: "rp-26-report-production-certification",
    roadmapPhase: "RP-26",
    safeActionsAvailability: "unavailable",
    status: "planned",
    title: "Report Production Certification",
    visibility: "super_admin"
  }
] as const;

const CATEGORY_DESCRIPTIONS: Record<ReportCategoryName, string> = {
  "AI Reports": "AI job usage, failures, stores using AI, and estimated costs.",
  "Domain & Email Reports": "Domain, DNS, SSL, email mailbox draft, and provider order rollups.",
  "Marketplace Reports": "Marketplace item, approval, visibility, and revenue rollups.",
  "Operations Reports": "Support tickets, monitoring events, platform health, and operational review.",
  "Payment Reports": "Payment provider, checkout transaction, and failed payment monitoring rollups.",
  "Revenue Reports": "Revenue estimates from existing commerce and analytics aggregates.",
  "Security Reports": "Security events and audit monitoring from existing logs.",
  "Store Reports": "Store health, publishing, products, views, and revenue rollups.",
  "Subscription Reports": "Subscription plan, payment health, limits, and lifecycle rollups.",
  "User Reports": "User account, plan, governance, and workspace rollups."
};

function finalizeRegistryEntry(definition: ReportRegistryEntryDefinition): ReportRegistryEntry {
  return {
    ...definition,
    readOnly: true,
    source: REPORTS_REGISTRY_SOURCE
  };
}

function applyRuntimeContext(
  definition: ReportRegistryEntryDefinition,
  context: ReportsRegistryRuntimeContext
): ReportRegistryEntryDefinition {
  if (definition.reportKey === "rp-2-revenue-reports") {
    return {
      ...definition,
      dataSourceDescription:
        "Revenue Reports runtime (commerce_orders, store_orders, invoices, billing_events, user_subscriptions).",
      lastGeneratedState: context.revenueReportLastGenerated ?? definition.lastGeneratedState,
      status: context.revenueReportNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-3-store-reports") {
    return {
      ...definition,
      dataSourceDescription:
        "Store Reports runtime (stores, published_stores, store_domains, user_subscriptions).",
      lastGeneratedState: context.storeReportLastGenerated ?? definition.lastGeneratedState,
      status: context.storeReportNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-4-user-reports") {
    return {
      ...definition,
      dataSourceDescription:
        "User Reports runtime (profiles, account_profiles, account_roles, workspace_members, internal_team_members, reseller_profiles, stores, commerce_customers).",
      lastGeneratedState: context.userReportLastGenerated ?? definition.lastGeneratedState,
      status: context.userReportNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-5-subscription-reports") {
    return {
      ...definition,
      dataSourceDescription:
        "Subscription Reports runtime (user_subscriptions, invoices, billing_events).",
      lastGeneratedState: context.subscriptionReportLastGenerated ?? definition.lastGeneratedState,
      status: context.subscriptionReportNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-6-payment-reports") {
    return {
      ...definition,
      dataSourceDescription:
        "Payment Reports runtime (commerce_orders, store_orders, invoices, billing_events).",
      lastGeneratedState: context.paymentReportLastGenerated ?? definition.lastGeneratedState,
      status: context.paymentReportNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-7-ai-reports") {
    return {
      ...definition,
      dataSourceDescription:
        "AI Reports runtime (ai_audit_logs, ai_generation_queue, ai_generation_results, openai_credit_ledger, stores).",
      lastGeneratedState: context.aiReportLastGenerated ?? definition.lastGeneratedState,
      status: context.aiReportNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-8-domain-email-reports") {
    return {
      ...definition,
      dataSourceDescription:
        "Domain & Email Reports runtime (store_domains, domain_orders, domain_dns_records, stores).",
      lastGeneratedState: context.domainEmailReportLastGenerated ?? definition.lastGeneratedState,
      status: context.domainEmailReportNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-9-marketplace-reports") {
    return {
      ...definition,
      dataSourceDescription:
        "Marketplace Reports runtime (marketplace_items, marketplace_creator_accounts, marketplace_install_events, marketplace_revenue_events, marketplace_purchases).",
      lastGeneratedState: context.marketplaceReportLastGenerated ?? definition.lastGeneratedState,
      status: context.marketplaceReportNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-10-security-reports") {
    return {
      ...definition,
      dataSourceDescription:
        "Security Reports runtime (security_audit_logs, monitoring_events). Read-only aggregates only.",
      lastGeneratedState: context.securityReportLastGenerated ?? definition.lastGeneratedState,
      status: context.securityReportNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-11-operations-reports") {
    return {
      ...definition,
      dataSourceDescription:
        "Operations Reports runtime (store_orders, orders, delivery_assignments, order_events, store_delivery_events, store_return_requests, delivery_incidents, support_tickets).",
      lastGeneratedState: context.operationsReportLastGenerated ?? definition.lastGeneratedState,
      status: context.operationsReportNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-12-report-viewer") {
    return {
      ...definition,
      dataSourceDescription:
        "Report Viewer runtime (RP-1 registry + RP-2 through RP-11 adapters). Read-only on page load.",
      lastGeneratedState: context.reportViewerLastGenerated ?? definition.lastGeneratedState,
      status: context.reportViewerNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-13-report-status") {
    return {
      ...definition,
      dataSourceDescription:
        "Report Status runtime (registry metadata + RP-2 through RP-11 adapter signals). Read-only on page load.",
      lastGeneratedState: context.reportStatusLastGenerated ?? definition.lastGeneratedState,
      status: context.reportStatusNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-14-report-visibility") {
    return {
      ...definition,
      dataSourceDescription:
        "Report Visibility runtime (registry metadata + RP-13 status signals). Read-only on page load.",
      lastGeneratedState: context.reportVisibilityLastGenerated ?? definition.lastGeneratedState,
      status: context.reportVisibilityNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-15-safe-actions") {
    return {
      ...definition,
      dataSourceDescription:
        "Report Safe Actions runtime (registry metadata + RP-13 status + RP-14 visibility + RP-12 viewer). Read-only on page load.",
      lastGeneratedState: context.reportSafeActionsLastGenerated ?? definition.lastGeneratedState,
      status: context.reportSafeActionsNeedsAttention ? "review" : definition.status
    };
  }

  if (definition.reportKey === "rp-17-report-filters") {
    return {
      ...definition,
      lastGeneratedState: `Range ${context.selectedRange}`
    };
  }

  return definition;
}

export function listReportRegistryDefinitions() {
  return REPORT_REGISTRY_DEFINITIONS.map((definition) => ({ ...definition }));
}

export function resolveReportRegistryEntries(context: ReportsRegistryRuntimeContext): ReportRegistryEntry[] {
  return REPORT_REGISTRY_DEFINITIONS.map((definition) =>
    finalizeRegistryEntry(applyRuntimeContext(definition, context))
  );
}

export function getReportRegistryEntry(
  reportKey: string,
  context: ReportsRegistryRuntimeContext
): ReportRegistryEntry | null {
  const definition = REPORT_REGISTRY_DEFINITIONS.find((entry) => entry.reportKey === reportKey);
  if (!definition) {
    return null;
  }

  return finalizeRegistryEntry(applyRuntimeContext(definition, context));
}

export function getReportsRegistryStatus(entries: ReportRegistryEntry[]): ReportsRegistryRuntimeStatus {
  const hasAttention = entries.some(
    (entry) => entry.status === "review" || entry.certificationState === "needs_attention"
  );

  return hasAttention ? "needs_attention" : "registry_ready";
}

export function getReportsRegistrySummary(entries: ReportRegistryEntry[]): ReportsRegistrySummary {
  const plannedEntries = entries.filter((entry) => entry.status === "planned" || entry.status === "inactive").length;
  const activeEntries = entries.length - plannedEntries;
  const status = getReportsRegistryStatus(entries);

  return {
    activeEntries,
    plannedEntries,
    readOnly: true,
    status,
    summary: [
      `status ${status}`,
      `${entries.length} registry entries`,
      `${activeEntries} active`,
      `${plannedEntries} planned/inactive`
    ].join("; "),
    totalEntries: entries.length
  };
}

export function validateReportsRegistryRuntime(entries: ReportRegistryEntry[]): ReportsRegistryValidation {
  const issues: string[] = [];

  if (entries.length !== REPORT_REGISTRY_DEFINITIONS.length) {
    issues.push("Reports registry must include all roadmap registry entries.");
  }

  const keys = new Set<string>();

  for (const entry of entries) {
    if (!entry.readOnly) {
      issues.push(`${entry.reportKey} must remain read-only.`);
    }

    if (entry.source !== REPORTS_REGISTRY_SOURCE) {
      issues.push(`${entry.reportKey} must originate from the reports registry runtime.`);
    }

    if (keys.has(entry.reportKey)) {
      issues.push(`Duplicate report registry key: ${entry.reportKey}.`);
    }

    keys.add(entry.reportKey);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildReportRegistryCategories(entries: ReportRegistryEntry[]) {
  return REPORT_CATEGORY_NAMES.map((name) => {
    const categoryEntries = entries.filter((entry) => entry.category === name);
    const status = categoryEntries.some((entry) => entry.status === "review")
      ? ("review" as const)
      : categoryEntries.some((entry) => entry.status === "ready")
        ? ("ready" as const)
        : ("placeholder" as const);

    return {
      description: CATEGORY_DESCRIPTIONS[name],
      name,
      status
    };
  });
}

export function buildReportRegistrySources(entries: ReportRegistryEntry[]) {
  return [...new Set(entries.map((entry) => entry.dataSourceDescription))].sort();
}

export function buildReportRegistryFutureHooks(entries: ReportRegistryEntry[]) {
  return [...new Set(entries.flatMap((entry) => [...entry.futureHooks]))].sort();
}

const LEGACY_REPORT_ACTION_IDS = new Set(
  REPORT_REGISTRY_DEFINITIONS.filter((entry) => REPORT_CATEGORY_NAMES.includes(entry.category as ReportCategoryName)).map(
    (entry) => entry.reportId
  )
);

export function supportsLegacyReportSafeActions(reportId: string) {
  return LEGACY_REPORT_ACTION_IDS.has(reportId);
}

export function mapReportRegistryEntryToAdminReport(entry: ReportRegistryEntry) {
  return {
    category: entry.category,
    certificationState: entry.certificationState,
    dataSourceDescription: entry.dataSourceDescription,
    exportAvailabilityState: entry.exportAvailabilityState,
    exportPlaceholder:
      entry.exportAvailabilityState === "export_ready"
        ? "Export ready (placeholder)"
        : entry.exportAvailabilityState === "placeholder"
          ? "Export reserved placeholder"
          : "Export unavailable",
    futureHooks: [...entry.futureHooks],
    lastGenerated: entry.lastGeneratedState,
    name: entry.title,
    reportId: entry.reportId,
    reportKey: entry.reportKey,
    roadmapPhase: entry.roadmapPhase,
    safeActionsAvailability: entry.safeActionsAvailability,
    safeActionsLabel:
      entry.safeActionsAvailability === "available"
        ? "Safe actions available"
        : entry.safeActionsAvailability === "placeholder"
          ? "Monitoring placeholders"
          : "Read-only",
    status: entry.status,
    supportsSafeActions: supportsLegacyReportSafeActions(entry.reportId),
    visibility: entry.visibility === "super_admin" ? ("super_admin" as const) : ("internal" as const)
  };
}

export function mapReportsRegistryRuntimeToAdminFields(context: ReportsRegistryRuntimeContext) {
  const entries = resolveReportRegistryEntries(context);
  const validation = validateReportsRegistryRuntime(entries);
  const summary = getReportsRegistrySummary(entries);

  return {
    categories: buildReportRegistryCategories(entries),
    futureHooks: buildReportRegistryFutureHooks(entries),
    registry: {
      readOnly: true as const,
      source: REPORTS_REGISTRY_SOURCE,
      status: validation.isValid ? summary.status : ("needs_attention" as const),
      summary: validation.isValid
        ? summary.summary
        : "Reports registry validation requires safe read-only defaults.",
      totalEntries: summary.totalEntries
    },
    reports: entries.map(mapReportRegistryEntryToAdminReport),
    sources: buildReportRegistrySources(entries)
  };
}
