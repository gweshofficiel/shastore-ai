import "server-only";

export type OperationsRegistrySource = "operations_registry_runtime";

export type OperationsRegistryCategory =
  | "Backup & Recovery"
  | "Cron Operations"
  | "Database Operations"
  | "Health Overview"
  | "Monitoring"
  | "Operations Controls"
  | "Operations Platform"
  | "Queue Operations"
  | "Storage Operations"
  | "Worker Operations";

export type OperationsRuntimeType =
  | "backup_runtime"
  | "cron_runtime"
  | "diagnostics"
  | "disaster_recovery_runtime"
  | "future_hooks"
  | "health_indicator"
  | "monitoring_stream"
  | "queue_runtime"
  | "safe_controls"
  | "storage_metric"
  | "table_view"
  | "worker_runtime";

export type OperationsImplementationStatus =
  | "architectural"
  | "planned"
  | "production_ready"
  | "registered";

export type OperationsRegistryVisibility = "hidden" | "internal" | "super_admin";

export type OperationsRegistryEntryDefinition = {
  auditSupport: boolean;
  category: OperationsRegistryCategory;
  createdFromArchitecture: boolean;
  description: string;
  futureHooks: readonly string[];
  healthSupport: boolean;
  id: string;
  implementationStatus: OperationsImplementationStatus;
  key: string;
  monitoringSupport: boolean;
  permissions: readonly string[];
  productionReady: boolean;
  roadmapPhase:
    | "OP-10"
    | "OP-11"
    | "OP-12"
    | "OP-13"
    | "OP-14"
    | "OP-15"
    | "OP-16"
    | "OP-17"
    | "OP-18"
    | "OP-19"
    | "OP-2"
    | "OP-20"
    | "OP-3"
    | "OP-4"
    | "OP-5"
    | "OP-6"
    | "OP-7"
    | "OP-8"
    | "OP-9";
  runtimeType: OperationsRuntimeType;
  title: string;
  visibility: OperationsRegistryVisibility;
};

export type OperationsRegistryEntry = OperationsRegistryEntryDefinition & {
  readOnly: true;
  source: OperationsRegistrySource;
};

export type OperationsRegistryRuntimeStatus = "needs_attention" | "registry_ready";

export type OperationsRegistrySummary = {
  productionReadyEntries: number;
  readOnly: true;
  registeredEntries: number;
  status: OperationsRegistryRuntimeStatus;
  summary: string;
  totalEntries: number;
};

export type OperationsRegistryValidation = {
  isValid: boolean;
  issues: string[];
};

export const OPERATIONS_REGISTRY_SOURCE = "operations_registry_runtime" as const;

const OPERATIONS_REGISTRY_DEFINITIONS: readonly OperationsRegistryEntryDefinition[] = [
  {
    auditSupport: false,
    category: "Health Overview",
    createdFromArchitecture: true,
    description:
      "Read-only queue health overview derived from existing certified queue aggregates. No queue execution on page load.",
    futureHooks: ["Queue health thresholds", "Queue health alerts"],
    healthSupport: true,
    id: "operations:queue-health",
    implementationStatus: "production_ready",
    key: "op-queue-health",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "OP-2",
    runtimeType: "health_indicator",
    title: "Queue Health",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Health Overview",
    createdFromArchitecture: true,
    description:
      "Read-only worker health overview inferred from existing queue activity. No worker restart or execution on page load.",
    futureHooks: ["Worker heartbeat", "Worker restart controls"],
    healthSupport: true,
    id: "operations:worker-health",
    implementationStatus: "production_ready",
    key: "op-worker-health",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "OP-3",
    runtimeType: "health_indicator",
    title: "Worker Health",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Health Overview",
    createdFromArchitecture: true,
    description:
      "Cron health registry metadata only. Cron schedules remain placeholders until scheduler integration is added.",
    futureHooks: ["Cron scheduler integration", "Cron health alerts"],
    healthSupport: true,
    id: "operations:cron-health",
    implementationStatus: "architectural",
    key: "op-cron-health",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "OP-4",
    runtimeType: "health_indicator",
    title: "Cron Health",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Health Overview",
    createdFromArchitecture: true,
    description:
      "Storage configuration readiness from environment presence checks only. No storage scanning on page load.",
    futureHooks: ["R2 usage metrics", "Storage quota alerts"],
    healthSupport: true,
    id: "operations:storage-health",
    implementationStatus: "production_ready",
    key: "op-storage-health",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "OP-5",
    runtimeType: "health_indicator",
    title: "Storage Health",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Health Overview",
    createdFromArchitecture: true,
    description:
      "Database configuration readiness from Supabase environment presence checks only. No database diagnostics on page load.",
    futureHooks: ["Connection pool metrics", "Database latency monitoring"],
    healthSupport: true,
    id: "operations:database-health",
    implementationStatus: "production_ready",
    key: "op-database-health",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "OP-6",
    runtimeType: "health_indicator",
    title: "Database Health",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Queue Operations",
    createdFromArchitecture: true,
    description:
      "Email event queue read-only aggregate from email_event_logs. No queue processing on page load.",
    futureHooks: ["Email queue retry controls", "Email queue drain"],
    healthSupport: true,
    id: "operations:email-queue",
    implementationStatus: "production_ready",
    key: "op-email-queue",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "OP-7",
    runtimeType: "queue_runtime",
    title: "Email Queue",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Queue Operations",
    createdFromArchitecture: true,
    description:
      "AI generation queue read-only aggregate from ai_generation_queue. No worker execution on page load.",
    futureHooks: ["AI queue priority controls", "AI queue cancellation"],
    healthSupport: true,
    id: "operations:ai-queue",
    implementationStatus: "production_ready",
    key: "op-ai-queue",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "OP-8",
    runtimeType: "queue_runtime",
    title: "AI Queue",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Queue Operations",
    createdFromArchitecture: true,
    description:
      "Domain and email workflow queue read-only aggregate from domains hosting control. No provider sync on page load.",
    futureHooks: ["Domain workflow retry", "Email mailbox provisioning monitor"],
    healthSupport: true,
    id: "operations:domain-email-queue",
    implementationStatus: "production_ready",
    key: "op-domain-email-queue",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "OP-9",
    runtimeType: "queue_runtime",
    title: "Domain & Email Queue",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Queue Operations",
    createdFromArchitecture: true,
    description:
      "Queue tables view registry for email, AI, domain/email, and monitoring event streams. Read-only table presentation.",
    futureHooks: ["Queue table export", "Queue table filtering"],
    healthSupport: false,
    id: "operations:queue-tables",
    implementationStatus: "production_ready",
    key: "op-queue-tables",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "OP-10",
    runtimeType: "table_view",
    title: "Queue Tables",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Worker Operations",
    createdFromArchitecture: true,
    description:
      "Worker tables view registry for AI, email, domain/email, and monitoring processors. No worker communication on page load.",
    futureHooks: ["Worker table export", "Worker status history"],
    healthSupport: false,
    id: "operations:worker-tables",
    implementationStatus: "production_ready",
    key: "op-worker-tables",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "OP-11",
    runtimeType: "table_view",
    title: "Worker Tables",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Cron Operations",
    createdFromArchitecture: true,
    description:
      "Cron jobs registry metadata for billing sync, email retry, AI queue, and domain/email monitors. No cron execution on page load.",
    futureHooks: ["Cron scheduler", "Manual cron trigger"],
    healthSupport: false,
    id: "operations:cron-jobs",
    implementationStatus: "architectural",
    key: "op-cron-jobs",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "OP-12",
    runtimeType: "cron_runtime",
    title: "Cron Jobs",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Storage Operations",
    createdFromArchitecture: true,
    description:
      "Storage metrics registry for Supabase, R2, database size, and storage usage. Configuration status only; no storage scanning.",
    futureHooks: ["Provider storage APIs", "Usage trend charts"],
    healthSupport: true,
    id: "operations:storage-metrics",
    implementationStatus: "architectural",
    key: "op-storage-metrics",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "OP-13",
    runtimeType: "storage_metric",
    title: "Storage Metrics",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Backup & Recovery",
    createdFromArchitecture: true,
    description:
      "Backup status registry metadata only. No backup execution or provider backup API queries on page load.",
    futureHooks: ["Trigger backup", "Backup schedule", "Backup verification"],
    healthSupport: false,
    id: "operations:backup",
    implementationStatus: "architectural",
    key: "op-backup",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "OP-14",
    runtimeType: "backup_runtime",
    title: "Backup",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Backup & Recovery",
    createdFromArchitecture: true,
    description:
      "Disaster recovery readiness registry metadata only. No restore tests or recovery actions on page load.",
    futureHooks: ["Restore test", "DR runbook", "Failover controls"],
    healthSupport: false,
    id: "operations:disaster-recovery",
    implementationStatus: "architectural",
    key: "op-disaster-recovery",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "OP-15",
    runtimeType: "disaster_recovery_runtime",
    title: "Disaster Recovery",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Monitoring",
    createdFromArchitecture: true,
    description:
      "Monitoring events stream read-only aggregate from monitoring_events. No event mutation on page load.",
    futureHooks: ["Incident notifications", "Monitoring event export"],
    healthSupport: true,
    id: "operations:monitoring-events",
    implementationStatus: "production_ready",
    key: "op-monitoring-events",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: true,
    roadmapPhase: "OP-16",
    runtimeType: "monitoring_stream",
    title: "Monitoring Events",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Operations Controls",
    createdFromArchitecture: true,
    description:
      "Safe controls registry for mark reviewed, view logs, and retry placeholders. Actions write monitoring_events only.",
    futureHooks: ["Retry failed queue", "Restart worker"],
    healthSupport: false,
    id: "operations:safe-controls",
    implementationStatus: "production_ready",
    key: "op-safe-controls",
    monitoringSupport: true,
    permissions: ["super_admin:read", "super_admin:safe_action"],
    productionReady: true,
    roadmapPhase: "OP-17",
    runtimeType: "safe_controls",
    title: "Safe Controls",
    visibility: "super_admin"
  },
  {
    auditSupport: true,
    category: "Operations Controls",
    createdFromArchitecture: true,
    description:
      "Diagnostics export placeholder registry. No diagnostic execution or backup queries on page load.",
    futureHooks: ["Export diagnostics bundle", "Runtime trace export"],
    healthSupport: false,
    id: "operations:diagnostics",
    implementationStatus: "architectural",
    key: "op-diagnostics",
    monitoringSupport: true,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "OP-18",
    runtimeType: "diagnostics",
    title: "Diagnostics",
    visibility: "super_admin"
  },
  {
    auditSupport: false,
    category: "Operations Platform",
    createdFromArchitecture: true,
    description:
      "Reserved future hooks for queue retry, worker restart, cron manual run, backup, restore, logs export, and incident notifications.",
    futureHooks: [
      "Retry failed queue",
      "Restart worker",
      "Run cron manually",
      "Trigger backup",
      "Restore backup",
      "Export logs",
      "Incident notifications"
    ],
    healthSupport: false,
    id: "operations:future-hooks",
    implementationStatus: "planned",
    key: "op-future-hooks",
    monitoringSupport: false,
    permissions: ["super_admin:read"],
    productionReady: false,
    roadmapPhase: "OP-19",
    runtimeType: "future_hooks",
    title: "Future Hooks",
    visibility: "super_admin"
  }
] as const;

function finalizeRegistryEntry(definition: OperationsRegistryEntryDefinition): OperationsRegistryEntry {
  return {
    ...definition,
    readOnly: true,
    source: OPERATIONS_REGISTRY_SOURCE
  };
}

export function listOperationsRegistryDefinitions() {
  return OPERATIONS_REGISTRY_DEFINITIONS.map((definition) => ({ ...definition }));
}

export function resolveOperationsRegistryEntries(): OperationsRegistryEntry[] {
  return OPERATIONS_REGISTRY_DEFINITIONS.map((definition) => finalizeRegistryEntry(definition));
}

export function getOperationsRegistryEntry(key: string): OperationsRegistryEntry | null {
  const definition = OPERATIONS_REGISTRY_DEFINITIONS.find((entry) => entry.key === key);

  if (!definition) {
    return null;
  }

  return finalizeRegistryEntry(definition);
}

export function getOperationsRegistryStatus(entries: OperationsRegistryEntry[]): OperationsRegistryRuntimeStatus {
  const hasAttention = entries.some(
    (entry) => entry.implementationStatus === "architectural" || entry.implementationStatus === "planned"
  );

  return hasAttention ? "needs_attention" : "registry_ready";
}

export function getOperationsRegistrySummary(entries: OperationsRegistryEntry[]): OperationsRegistrySummary {
  const productionReadyEntries = entries.filter((entry) => entry.productionReady).length;
  const registeredEntries = entries.filter((entry) => entry.implementationStatus !== "planned").length;
  const status = getOperationsRegistryStatus(entries);

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

export function validateOperationsRegistryRuntime(entries: OperationsRegistryEntry[]): OperationsRegistryValidation {
  const issues: string[] = [];

  if (entries.length !== OPERATIONS_REGISTRY_DEFINITIONS.length) {
    issues.push("Operations registry must include all roadmap registry entries.");
  }

  const keys = new Set<string>();

  for (const entry of entries) {
    if (!entry.readOnly) {
      issues.push(`${entry.key} must remain read-only.`);
    }

    if (entry.source !== OPERATIONS_REGISTRY_SOURCE) {
      issues.push(`${entry.key} must originate from the operations registry runtime.`);
    }

    if (keys.has(entry.key)) {
      issues.push(`Duplicate operations registry key: ${entry.key}.`);
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

export function buildOperationsRegistryCategories(entries: OperationsRegistryEntry[]) {
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

export function buildOperationsRegistryFutureHooks(entries: OperationsRegistryEntry[]) {
  return [...new Set(entries.flatMap((entry) => [...entry.futureHooks]))].sort();
}

export function mapOperationsRegistryEntryToAdminComponent(entry: OperationsRegistryEntry) {
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

export function mapOperationsRegistryRuntimeToAdminFields() {
  const entries = resolveOperationsRegistryEntries();
  const validation = validateOperationsRegistryRuntime(entries);
  const summary = getOperationsRegistrySummary(entries);

  return {
    categories: buildOperationsRegistryCategories(entries),
    components: entries.map(mapOperationsRegistryEntryToAdminComponent),
    futureHooks: buildOperationsRegistryFutureHooks(entries),
    registry: {
      readOnly: true as const,
      source: OPERATIONS_REGISTRY_SOURCE,
      status: validation.isValid ? summary.status : ("needs_attention" as const),
      summary: validation.isValid
        ? summary.summary
        : "Operations registry validation requires safe read-only defaults.",
      totalEntries: summary.totalEntries
    }
  };
}

export async function loadOperationsRegistryReadOnlySafe() {
  return mapOperationsRegistryRuntimeToAdminFields();
}
