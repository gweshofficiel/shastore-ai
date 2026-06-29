import "server-only";

import {
  SUPPORT_REGISTRY_SOURCE,
  getSupportRegistryEntry,
  resolveSupportRegistryEntries,
  type SupportRegistryEntry,
  type SupportRegistryVisibility
} from "@/src/lib/support/support-registry-runtime";

export type SupportDashboardSource = "support_dashboard_runtime";

export type SupportDashboardRuntimeStatus =
  | "disabled"
  | "future_hook"
  | "production_ready"
  | "registered"
  | "review_required"
  | "runtime_ready";

export type SupportDashboardSectionKey =
  | "analytics"
  | "discovery"
  | "governance"
  | "integrations"
  | "monitoring"
  | "platform"
  | "tickets";

export type SupportDashboardSectionDefinition = {
  description: string;
  key: SupportDashboardSectionKey;
  title: string;
};

export type SupportDashboardItem = {
  auditSupport: boolean;
  category: string;
  description: string;
  healthSupport: boolean;
  key: string;
  monitoringSupport: boolean;
  runtimeStatus: SupportDashboardRuntimeStatus;
  sectionKey: SupportDashboardSectionKey;
  title: string;
  visibility: SupportRegistryVisibility;
};

export type SupportDashboardSection = {
  itemCount: number;
  items: SupportDashboardItem[];
  key: SupportDashboardSectionKey;
  title: string;
};

export type SupportDashboardMetrics = {
  auditSupportedModules: number;
  errorEvents: number;
  healthSupportedModules: number;
  monitoringEvents: number;
  monitoringSupportedModules: number;
  openTickets: number;
  productionReadyModules: number;
  recentActivityCount: number;
  reviewRequiredModules: number;
  runtimeReadyModules: number;
  totalSupportModules: number;
  totalTickets: number;
  visibleModules: number;
};

export type SupportDashboardActivityItem = {
  activityKey: string;
  activityType: "error" | "monitoring" | "ticket";
  createdAt: string;
  safeSummary: string;
  status: string;
  title: string;
};

export type SupportDashboardTicketRecord = {
  createdAt: string;
  priority: string;
  recordKey: string;
  status: string;
  subject: string;
  ticketNumber: string;
  updatedAt: string;
};

export type SupportDashboardMonitoringRecord = {
  createdAt: string;
  entityType: string;
  eventStatus: string;
  eventType: string;
  recordKey: string;
  safeSummary: string;
};

export type SupportDashboardSummary = {
  loadError: string | null;
  metrics: SupportDashboardMetrics;
  readOnly: true;
  registrySource: typeof SUPPORT_REGISTRY_SOURCE;
  sectionCount: number;
  source: SupportDashboardSource;
  status: "dashboard_ready" | "load_error" | "needs_attention";
  summary: string;
};

type SupportDashboardTicketInput = {
  created_at: string;
  id: string;
  priority: string;
  status: string;
  subject: string;
  ticket_number: string;
  updated_at: string;
};

type SupportDashboardMonitoringInput = {
  created_at: string;
  entity_type: string;
  event_status: string;
  event_type: string;
  id: string;
};

export type SupportDashboardRuntimeInput = {
  loadError: string | null;
  monitoringEvents: SupportDashboardMonitoringInput[];
  tickets: SupportDashboardTicketInput[];
};

export const SUPPORT_DASHBOARD_SOURCE = "support_dashboard_runtime" as const;

const SUPPORT_DASHBOARD_SECTIONS: readonly SupportDashboardSectionDefinition[] = [
  {
    description: "Support platform modules registered in the support runtime.",
    key: "platform",
    title: "Platform"
  },
  {
    description: "Ticket runtime modules registered in the support runtime.",
    key: "tickets",
    title: "Tickets"
  },
  {
    description: "Monitoring and event modules registered in the support runtime.",
    key: "monitoring",
    title: "Monitoring"
  },
  {
    description: "Search and filter modules registered in the support runtime.",
    key: "discovery",
    title: "Discovery"
  },
  {
    description: "Governance modules registered in the support runtime.",
    key: "governance",
    title: "Governance"
  },
  {
    description: "Integration modules registered in the support runtime.",
    key: "integrations",
    title: "Integrations"
  },
  {
    description: "Analytics and export modules registered in the support runtime.",
    key: "analytics",
    title: "Analytics"
  }
] as const;

const REGISTRY_KEY_TO_SECTION: Record<string, SupportDashboardSectionKey> = {
  "sp-analytics": "analytics",
  "sp-audit": "governance",
  "sp-dashboard": "platform",
  "sp-error-events": "monitoring",
  "sp-event-timeline": "monitoring",
  "sp-export": "analytics",
  "sp-filters": "discovery",
  "sp-metrics": "platform",
  "sp-monitoring-events": "monitoring",
  "sp-notifications": "integrations",
  "sp-review": "governance",
  "sp-safe-actions": "governance",
  "sp-search": "discovery",
  "sp-status": "platform",
  "sp-ticket-assignment": "tickets",
  "sp-ticket-conversation": "tickets",
  "sp-ticket-details": "tickets",
  "sp-ticket-status": "tickets",
  "sp-tickets": "tickets",
  "sp-visibility": "platform"
};

function isErrorMonitoringEvent(event: SupportDashboardMonitoringInput) {
  return (
    event.event_status === "failed" ||
    event.event_type.toLowerCase().includes("error") ||
    event.event_type.toLowerCase().includes("failed")
  );
}

function isOpenTicket(ticket: SupportDashboardTicketInput) {
  return ticket.status !== "resolved" && ticket.status !== "closed";
}

export function resolveSupportDashboardSectionKey(entry: SupportRegistryEntry): SupportDashboardSectionKey {
  return REGISTRY_KEY_TO_SECTION[entry.key] ?? "platform";
}

export function mapSupportRegistryEntryToDashboardRuntimeStatus(
  entry: SupportRegistryEntry
): SupportDashboardRuntimeStatus {
  if (entry.visibility === "hidden") {
    return "disabled";
  }

  if (entry.runtimeType === "export_runtime" && entry.implementationStatus === "planned") {
    return "future_hook";
  }

  if (entry.implementationStatus === "planned") {
    return "future_hook";
  }

  if (entry.productionReady) {
    return "production_ready";
  }

  if (entry.implementationStatus === "production_ready") {
    return "runtime_ready";
  }

  if (entry.implementationStatus === "architectural") {
    return "review_required";
  }

  if (entry.key === "sp-dashboard") {
    return "runtime_ready";
  }

  return "registered";
}

export function supportDashboardRuntimeStatusLabel(status: SupportDashboardRuntimeStatus) {
  switch (status) {
    case "disabled":
      return "Disabled";
    case "future_hook":
      return "Future Hook";
    case "production_ready":
      return "Production Ready";
    case "registered":
      return "Registered";
    case "review_required":
      return "Review Required";
    case "runtime_ready":
      return "Runtime Ready";
  }
}

export function supportDashboardRuntimeStatusBadgeTone(status: SupportDashboardRuntimeStatus) {
  switch (status) {
    case "production_ready":
    case "runtime_ready":
      return "green" as const;
    case "review_required":
      return "amber" as const;
    case "future_hook":
    case "registered":
      return "blue" as const;
    case "disabled":
      return "slate" as const;
  }
}

export function buildSupportDashboardMetrics(
  entries: SupportRegistryEntry[],
  input: SupportDashboardRuntimeInput
): SupportDashboardMetrics {
  const errorEvents = input.monitoringEvents.filter(isErrorMonitoringEvent).length;
  const openTickets = input.tickets.filter(isOpenTicket).length;
  const recentActivity = buildSupportRecentActivity(input);

  return {
    auditSupportedModules: entries.filter((entry) => entry.auditSupport).length,
    errorEvents,
    healthSupportedModules: entries.filter((entry) => entry.healthSupport).length,
    monitoringEvents: input.monitoringEvents.length,
    monitoringSupportedModules: entries.filter((entry) => entry.monitoringSupport).length,
    openTickets,
    productionReadyModules: entries.filter((entry) => entry.productionReady).length,
    recentActivityCount: recentActivity.length,
    reviewRequiredModules: entries.filter(
      (entry) => mapSupportRegistryEntryToDashboardRuntimeStatus(entry) === "review_required"
    ).length,
    runtimeReadyModules: entries.filter((entry) => entry.implementationStatus === "production_ready").length,
    totalSupportModules: entries.length,
    totalTickets: input.tickets.length,
    visibleModules: entries.filter((entry) => entry.visibility !== "hidden").length
  };
}

export function mapSupportRegistryEntryToDashboardItem(entry: SupportRegistryEntry): SupportDashboardItem {
  return {
    auditSupport: entry.auditSupport,
    category: entry.category,
    description: entry.description,
    healthSupport: entry.healthSupport,
    key: entry.key,
    monitoringSupport: entry.monitoringSupport,
    runtimeStatus: mapSupportRegistryEntryToDashboardRuntimeStatus(entry),
    sectionKey: resolveSupportDashboardSectionKey(entry),
    title: entry.title,
    visibility: entry.visibility
  };
}

export function buildSupportDashboardSections(entries: SupportRegistryEntry[]): SupportDashboardSection[] {
  const items = entries.map(mapSupportRegistryEntryToDashboardItem);

  return SUPPORT_DASHBOARD_SECTIONS.map((section) => {
    const sectionItems = items.filter((item) => item.sectionKey === section.key);

    return {
      itemCount: sectionItems.length,
      items: sectionItems,
      key: section.key,
      title: section.title
    };
  }).filter((section) => section.itemCount > 0);
}

export function buildSupportRecentActivity(input: SupportDashboardRuntimeInput): SupportDashboardActivityItem[] {
  const ticketActivity: SupportDashboardActivityItem[] = input.tickets.map((ticket) => ({
    activityKey: `activity-ticket-${ticket.id}`,
    activityType: "ticket",
    createdAt: ticket.created_at,
    safeSummary: `ticket ${ticket.ticket_number}; status ${ticket.status}; priority ${ticket.priority}`,
    status: ticket.status,
    title: ticket.subject || `Ticket ${ticket.ticket_number}`
  }));

  const monitoringActivity: SupportDashboardActivityItem[] = input.monitoringEvents.map((event) => {
    const error = isErrorMonitoringEvent(event);

    return {
      activityKey: `activity-monitoring-${event.id}`,
      activityType: error ? "error" : "monitoring",
      createdAt: event.created_at,
      safeSummary: `event ${event.event_type}; status ${event.event_status}; entity ${event.entity_type}`,
      status: event.event_status,
      title: event.event_type
    };
  });

  return [...ticketActivity, ...monitoringActivity]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 20);
}

export function buildSupportLatestTicketRecords(
  input: SupportDashboardRuntimeInput
): SupportDashboardTicketRecord[] {
  return input.tickets.slice(0, 10).map((ticket) => ({
    createdAt: ticket.created_at,
    priority: ticket.priority,
    recordKey: `latest-ticket-${ticket.id}`,
    status: ticket.status,
    subject: ticket.subject,
    ticketNumber: ticket.ticket_number,
    updatedAt: ticket.updated_at
  }));
}

export function buildSupportLatestMonitoringRecords(
  input: SupportDashboardRuntimeInput
): SupportDashboardMonitoringRecord[] {
  return input.monitoringEvents.slice(0, 10).map((event) => ({
    createdAt: event.created_at,
    entityType: event.entity_type,
    eventStatus: event.event_status,
    eventType: event.event_type,
    recordKey: `latest-monitoring-${event.id}`,
    safeSummary: `event ${event.event_type}; status ${event.event_status}; entity ${event.entity_type}`
  }));
}

export function buildSupportLatestErrorRecords(
  input: SupportDashboardRuntimeInput
): SupportDashboardMonitoringRecord[] {
  return input.monitoringEvents
    .filter(isErrorMonitoringEvent)
    .slice(0, 10)
    .map((event) => ({
      createdAt: event.created_at,
      entityType: event.entity_type,
      eventStatus: event.event_status,
      eventType: event.event_type,
      recordKey: `latest-error-${event.id}`,
      safeSummary: `error ${event.event_type}; status ${event.event_status}; entity ${event.entity_type}`
    }));
}

export function getSupportDashboardSummary(
  entries: SupportRegistryEntry[],
  input: SupportDashboardRuntimeInput
): SupportDashboardSummary {
  const metrics = buildSupportDashboardMetrics(entries, input);
  const sections = buildSupportDashboardSections(entries);
  const dashboardEntry = getSupportRegistryEntry("sp-dashboard");
  const status = input.loadError
    ? ("load_error" as const)
    : metrics.openTickets > 0 || metrics.errorEvents > 0 || metrics.reviewRequiredModules > 0
      ? ("needs_attention" as const)
      : ("dashboard_ready" as const);

  return {
    loadError: input.loadError,
    metrics,
    readOnly: true,
    registrySource: SUPPORT_REGISTRY_SOURCE,
    sectionCount: sections.length,
    source: SUPPORT_DASHBOARD_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : [
          `status ${status}`,
          dashboardEntry ? `dashboard ${dashboardEntry.key}` : "dashboard sp-dashboard",
          `${metrics.totalTickets} tickets`,
          `${metrics.openTickets} open`,
          `${metrics.monitoringEvents} monitoring events`,
          `${metrics.errorEvents} error events`,
          `${metrics.recentActivityCount} recent activity items`
        ].join("; ")
  };
}

export function mapSupportDashboardRuntimeToAdminFields(input: SupportDashboardRuntimeInput) {
  const entries = resolveSupportRegistryEntries();
  const summary = getSupportDashboardSummary(entries, input);
  const sections = buildSupportDashboardSections(entries);
  const recentActivity = buildSupportRecentActivity(input);
  const latestTickets = buildSupportLatestTicketRecords(input);
  const latestMonitoringRecords = buildSupportLatestMonitoringRecords(input);
  const latestErrorRecords = buildSupportLatestErrorRecords(input);

  return {
    dashboard: summary,
    dashboardSections: sections,
    dashboardStats: [
      { label: "Total tickets", value: String(summary.metrics.totalTickets) },
      { label: "Open tickets", value: String(summary.metrics.openTickets) },
      { label: "Monitoring events", value: String(summary.metrics.monitoringEvents) },
      { label: "Error events", value: String(summary.metrics.errorEvents) },
      { label: "Recent activity", value: String(summary.metrics.recentActivityCount) },
      { label: "Support modules", value: String(summary.metrics.totalSupportModules) },
      { label: "Production ready", value: String(summary.metrics.productionReadyModules) },
      { label: "Review required", value: String(summary.metrics.reviewRequiredModules) }
    ],
    latestErrorRecords,
    latestMonitoringRecords,
    latestTickets,
    recentActivity
  };
}

export async function loadSupportDashboardReadOnlySafe(input: SupportDashboardRuntimeInput) {
  return mapSupportDashboardRuntimeToAdminFields(input);
}
