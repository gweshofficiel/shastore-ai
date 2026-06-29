import "server-only";

export type SupportRegistrySource = "support_registry_runtime";

export type SupportRegistryCategory =
  | "Analytics & Export"
  | "Discovery"
  | "Governance"
  | "Integrations"
  | "Monitoring & Events"
  | "Support Platform"
  | "Ticket Operations";

export type SupportRuntimeType =
  | "analytics_runtime"
  | "audit_runtime"
  | "dashboard"
  | "error_stream"
  | "event_timeline"
  | "export_runtime"
  | "filter_runtime"
  | "metrics_runtime"
  | "monitoring_stream"
  | "notification_runtime"
  | "review_runtime"
  | "safe_actions"
  | "search_runtime"
  | "status_runtime"
  | "ticket_assignment"
  | "ticket_conversation"
  | "ticket_detail"
  | "ticket_runtime"
  | "ticket_status"
  | "visibility_runtime";

export type SupportImplementationStatus =
  | "architectural"
  | "planned"
  | "production_ready"
  | "registered";

export type SupportRegistryVisibility = "hidden" | "internal" | "super_admin";

export type SupportRegistryEntryDefinition = {
  auditSupport: boolean;
  category: SupportRegistryCategory;
  createdFromArchitecture: boolean;
  description: string;
  futureHooks: readonly string[];
  healthSupport: boolean;
  id: string;
  implementationStatus: SupportImplementationStatus;
  key: string;
  monitoringSupport: boolean;
  permissions: readonly string[];
  productionReady: boolean;
  roadmapPhase:
    | "SP-10"
    | "SP-11"
    | "SP-12"
    | "SP-13"
    | "SP-14"
    | "SP-15"
    | "SP-16"
    | "SP-17"
    | "SP-18"
    | "SP-19"
    | "SP-2"
    | "SP-20"
    | "SP-21"
    | "SP-3"
    | "SP-4"
    | "SP-5"
    | "SP-6"
    | "SP-7"
    | "SP-8"
    | "SP-9";
  runtimeType: SupportRuntimeType;
  title: string;
  visibility: SupportRegistryVisibility;
};

export type SupportRegistryEntry = SupportRegistryEntryDefinition & {
  readOnly: true;
  source: SupportRegistrySource;
};

export type SupportRegistryRuntimeStatus = "needs_attention" | "registry_ready";

export type SupportRegistrySummary = {
  productionReadyEntries: number;
  readOnly: true;
  registeredEntries: number;
  status: SupportRegistryRuntimeStatus;
  summary: string;
  totalEntries: number;
};

export type SupportRegistryValidation = {
  isValid: boolean;
  issues: string[];
};

export const SUPPORT_REGISTRY_SOURCE = "support_registry_runtime" as const;

const SUPPORT_REGISTRY_DEFINITIONS: readonly SupportRegistryEntryDefinition[] = [
  {
    auditSupport: false,
    category: "Support Platform",
    createdFromArchitecture: true,
    description:
      "Support dashboard runtime derived from SP-1 registry and read-only ticket and monitoring aggregates. No ticket mutation or provider calls on page load.",
    futureHooks: ["Support dashboard sections", "Registry-derived support stats"],
    healthSupport: true,
    id: "support:dashboard",
    implementationStatus: "production_ready",
    key: "sp-dashboard",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "SP-2",
    runtimeType: "dashboard",
    title: "Dashboard",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Ticket Operations",
    createdFromArchitecture: true,
    description:
      "Platform support tickets read-only list from support_tickets. No ticket creation, assignment, or status mutation on page load.",
    futureHooks: ["Ticket triage", "Bulk ticket review"],
    healthSupport: true,
    id: "support:tickets",
    implementationStatus: "production_ready",
    key: "sp-tickets",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "SP-3",
    runtimeType: "ticket_runtime",
    title: "Tickets",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Ticket Operations",
    createdFromArchitecture: true,
    description:
      "Ticket detail registry for subject, priority, scope, and safe summary fields. No raw payload rendering by default in later phases.",
    futureHooks: ["Ticket detail drawer", "Masked technical snapshot"],
    healthSupport: false,
    id: "support:ticket-details",
    implementationStatus: "registered",
    key: "sp-ticket-details",
    monitoringSupport: false,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-4",
    runtimeType: "ticket_detail",
    title: "Ticket Details",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Ticket Operations",
    createdFromArchitecture: true,
    description:
      "Ticket status registry metadata only. Status management remains reserved; no status mutation on page load.",
    futureHooks: ["Status transitions", "SLA status rules"],
    healthSupport: true,
    id: "support:ticket-status",
    implementationStatus: "architectural",
    key: "sp-ticket-status",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-5",
    runtimeType: "ticket_status",
    title: "Ticket Status",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Ticket Operations",
    createdFromArchitecture: true,
    description:
      "Ticket assignment registry metadata only. No assignment mutation or notification dispatch on page load.",
    futureHooks: ["Assign to agent", "Assignment queue"],
    healthSupport: false,
    id: "support:ticket-assignment",
    implementationStatus: "architectural",
    key: "sp-ticket-assignment",
    monitoringSupport: false,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-6",
    runtimeType: "ticket_assignment",
    title: "Ticket Assignment",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Ticket Operations",
    createdFromArchitecture: true,
    description:
      "Ticket conversation registry for platform and store support threads. No message send or edit on page load.",
    futureHooks: ["Conversation thread view", "Internal notes"],
    healthSupport: false,
    id: "support:ticket-conversation",
    implementationStatus: "architectural",
    key: "sp-ticket-conversation",
    monitoringSupport: false,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-7",
    runtimeType: "ticket_conversation",
    title: "Ticket Conversation",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Monitoring & Events",
    createdFromArchitecture: true,
    description:
      "Monitoring events read-only stream from monitoring_events. No event mutation or provider calls on page load.",
    futureHooks: ["Event correlation", "Escalation to ticket"],
    healthSupport: true,
    id: "support:monitoring-events",
    implementationStatus: "production_ready",
    key: "sp-monitoring-events",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "SP-8",
    runtimeType: "monitoring_stream",
    title: "Monitoring Events",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Monitoring & Events",
    createdFromArchitecture: true,
    description:
      "Error events registry derived from failed monitoring event metadata only. No log export or diagnostics execution on page load.",
    futureHooks: ["Error grouping", "Error-to-ticket linking"],
    healthSupport: true,
    id: "support:error-events",
    implementationStatus: "production_ready",
    key: "sp-error-events",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "SP-9",
    runtimeType: "error_stream",
    title: "Error Events",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Monitoring & Events",
    createdFromArchitecture: true,
    description:
      "Event timeline registry for ticket and monitoring chronology. Derived metadata only; no timeline mutation on page load.",
    futureHooks: ["Unified timeline", "Timeline filters"],
    healthSupport: false,
    id: "support:event-timeline",
    implementationStatus: "registered",
    key: "sp-event-timeline",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-10",
    runtimeType: "event_timeline",
    title: "Event Timeline",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Discovery",
    createdFromArchitecture: true,
    description:
      "Support search registry metadata only. No search index mutation or external search provider calls on page load.",
    futureHooks: ["Ticket search", "Event search"],
    healthSupport: false,
    id: "support:search",
    implementationStatus: "planned",
    key: "sp-search",
    monitoringSupport: false,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-11",
    runtimeType: "search_runtime",
    title: "Search",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Discovery",
    createdFromArchitecture: true,
    description:
      "Support filters registry metadata for ticket and event views. No filter persistence or query mutation on page load.",
    futureHooks: ["Saved filters", "Filter presets"],
    healthSupport: false,
    id: "support:filters",
    implementationStatus: "planned",
    key: "sp-filters",
    monitoringSupport: false,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-12",
    runtimeType: "filter_runtime",
    title: "Filters",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Support Platform",
    createdFromArchitecture: true,
    description:
      "Support metrics registry for ticket and event counts derived from read-only aggregates. No metric writes on page load.",
    futureHooks: ["SLA metrics", "Response time charts"],
    healthSupport: true,
    id: "support:metrics",
    implementationStatus: "registered",
    key: "sp-metrics",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-13",
    runtimeType: "metrics_runtime",
    title: "Metrics",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Support Platform",
    createdFromArchitecture: true,
    description:
      "Support visibility registry for super-admin module exposure rules. Derived metadata only; no visibility mutation on page load.",
    futureHooks: ["Module visibility matrix", "Role visibility review"],
    healthSupport: false,
    id: "support:visibility",
    implementationStatus: "registered",
    key: "sp-visibility",
    monitoringSupport: false,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-14",
    runtimeType: "visibility_runtime",
    title: "Visibility",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Governance",
    createdFromArchitecture: true,
    description:
      "Safe actions registry for disabled support controls. No action execution, assignment, or status mutation on page load.",
    futureHooks: ["Assign ticket", "Resolve ticket", "Escalate ticket"],
    healthSupport: false,
    id: "support:safe-actions",
    implementationStatus: "architectural",
    key: "sp-safe-actions",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-15",
    runtimeType: "safe_actions",
    title: "Safe Actions",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Governance",
    createdFromArchitecture: true,
    description:
      "Support audit registry for ticket and escalation review trails. Read-only metadata only; no audit writes on page load.",
    futureHooks: ["Audit export", "Actor review"],
    healthSupport: false,
    id: "support:audit",
    implementationStatus: "registered",
    key: "sp-audit",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-16",
    runtimeType: "audit_runtime",
    title: "Audit",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Governance",
    createdFromArchitecture: true,
    description:
      "Support review registry for triage and production readiness review states. Derived metadata only on page load.",
    futureHooks: ["Review workflow", "Production readiness review"],
    healthSupport: false,
    id: "support:review",
    implementationStatus: "registered",
    key: "sp-review",
    monitoringSupport: false,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-17",
    runtimeType: "review_runtime",
    title: "Review",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Integrations",
    createdFromArchitecture: true,
    description:
      "Support notifications registry for escalation and update hooks. No notification send or queue execution on page load.",
    futureHooks: ["Ticket update notifications", "Escalation alerts"],
    healthSupport: false,
    id: "support:notifications",
    implementationStatus: "architectural",
    key: "sp-notifications",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-18",
    runtimeType: "notification_runtime",
    title: "Notifications",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Analytics & Export",
    createdFromArchitecture: true,
    description:
      "Support analytics registry for ticket and event insights. Derived counts only; no analytics pipeline execution on page load.",
    futureHooks: ["Ticket volume trends", "Resolution analytics"],
    healthSupport: true,
    id: "support:analytics",
    implementationStatus: "planned",
    key: "sp-analytics",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-19",
    runtimeType: "analytics_runtime",
    title: "Analytics",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Analytics & Export",
    createdFromArchitecture: true,
    description:
      "Support export registry for read-only report placeholders. No export execution or provider calls on page load.",
    futureHooks: ["Export tickets", "Export monitoring events"],
    healthSupport: false,
    id: "support:export",
    implementationStatus: "planned",
    key: "sp-export",
    monitoringSupport: false,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-20",
    runtimeType: "export_runtime",
    title: "Export",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Support Platform",
    createdFromArchitecture: true,
    description:
      "Support status registry consolidating module readiness from SP-1 registry metadata. Derived only; no status mutation on page load.",
    futureHooks: ["Global support status", "Blocked module review"],
    healthSupport: true,
    id: "support:status",
    implementationStatus: "registered",
    key: "sp-status",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "SP-21",
    runtimeType: "status_runtime",
    title: "Status",
    visibility: "super_admin"
  }
] as const;

function finalizeRegistryEntry(definition: SupportRegistryEntryDefinition): SupportRegistryEntry {
  return {
    ...definition,
    readOnly: true,
    source: SUPPORT_REGISTRY_SOURCE
  };
}

export function listSupportRegistryDefinitions() {
  return SUPPORT_REGISTRY_DEFINITIONS.map((definition) => ({ ...definition }));
}

export function resolveSupportRegistryEntries(): SupportRegistryEntry[] {
  return SUPPORT_REGISTRY_DEFINITIONS.map((definition) => finalizeRegistryEntry(definition));
}

export function getSupportRegistryEntry(key: string): SupportRegistryEntry | null {
  const definition = SUPPORT_REGISTRY_DEFINITIONS.find((entry) => entry.key === key);

  if (!definition) {
    return null;
  }

  return finalizeRegistryEntry(definition);
}

export function getSupportRegistryStatus(entries: SupportRegistryEntry[]): SupportRegistryRuntimeStatus {
  const hasAttention = entries.some(
    (entry) => entry.implementationStatus === "architectural" || entry.implementationStatus === "planned"
  );

  return hasAttention ? "needs_attention" : "registry_ready";
}

export function getSupportRegistrySummary(entries: SupportRegistryEntry[]): SupportRegistrySummary {
  const productionReadyEntries = entries.filter((entry) => entry.productionReady).length;
  const registeredEntries = entries.filter((entry) => entry.implementationStatus !== "planned").length;
  const status = getSupportRegistryStatus(entries);

  return {
    productionReadyEntries,
    readOnly: true,
    registeredEntries,
    status,
    summary: [
      `status ${status}`,
      `${entries.length} registry entries`,
      `${productionReadyEntries} production ready`,
      `${registeredEntries} registered`
    ].join("; "),
    totalEntries: entries.length
  };
}

export function validateSupportRegistryRuntime(entries: SupportRegistryEntry[]): SupportRegistryValidation {
  const issues: string[] = [];

  if (entries.length !== SUPPORT_REGISTRY_DEFINITIONS.length) {
    issues.push("Support registry must include all SP-1 registry entries.");
  }

  const keys = new Set<string>();

  for (const entry of entries) {
    if (!entry.readOnly) {
      issues.push(`${entry.key} must remain read-only.`);
    }

    if (entry.source !== SUPPORT_REGISTRY_SOURCE) {
      issues.push(`${entry.key} must originate from the support registry runtime.`);
    }

    if (keys.has(entry.key)) {
      issues.push(`Duplicate support registry key: ${entry.key}.`);
    }

    keys.add(entry.key);

    if (entry.visibility !== "super_admin") {
      issues.push(`${entry.key} must remain super_admin only.`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildSupportRegistryCategories(entries: SupportRegistryEntry[]) {
  const categoryNames = [...new Set(entries.map((entry) => entry.category))].sort();

  return categoryNames.map((name) => {
    const categoryEntries = entries.filter((entry) => entry.category === name);
    const status = categoryEntries.some((entry) => entry.productionReady)
      ? ("ready" as const)
      : categoryEntries.some((entry) => entry.implementationStatus === "architectural")
        ? ("architectural" as const)
        : ("planned" as const);

    return {
      entryCount: categoryEntries.length,
      name,
      status
    };
  });
}

export function buildSupportRegistryFutureHooks(entries: SupportRegistryEntry[]) {
  return [...new Set(entries.flatMap((entry) => [...entry.futureHooks]))].sort();
}

export function mapSupportRegistryEntryToAdminComponent(entry: SupportRegistryEntry) {
  return {
    auditSupport: entry.auditSupport,
    category: entry.category,
    createdFromArchitecture: entry.createdFromArchitecture,
    description: entry.description,
    futureHooks: [...entry.futureHooks],
    healthSupport: entry.healthSupport,
    id: entry.id,
    implementationStatus: entry.implementationStatus,
    key: entry.key,
    monitoringSupport: entry.monitoringSupport,
    permissions: [...entry.permissions],
    productionReady: entry.productionReady,
    roadmapPhase: entry.roadmapPhase,
    runtimeType: entry.runtimeType,
    title: entry.title,
    visibility: entry.visibility
  };
}

export function mapSupportRegistryRuntimeToAdminFields() {
  const entries = resolveSupportRegistryEntries();
  const validation = validateSupportRegistryRuntime(entries);
  const summary = getSupportRegistrySummary(entries);

  return {
    categories: buildSupportRegistryCategories(entries),
    components: entries.map(mapSupportRegistryEntryToAdminComponent),
    futureHooks: buildSupportRegistryFutureHooks(entries),
    registry: {
      readOnly: true as const,
      source: SUPPORT_REGISTRY_SOURCE,
      status: validation.isValid ? summary.status : ("needs_attention" as const),
      summary: validation.isValid
        ? summary.summary
        : "Support registry validation requires safe read-only defaults.",
      totalEntries: summary.totalEntries
    }
  };
}

export async function loadSupportRegistryReadOnlySafe() {
  return mapSupportRegistryRuntimeToAdminFields();
}
