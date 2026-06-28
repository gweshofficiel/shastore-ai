import "server-only";

import {
  OPERATIONS_REGISTRY_SOURCE,
  resolveOperationsRegistryEntries,
  type OperationsRegistryEntry,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsDashboardSource = "operations_dashboard_runtime";

export type OperationsDashboardRuntimeStatus =
  | "disabled"
  | "future_hook"
  | "production_ready"
  | "registered"
  | "review_required"
  | "runtime_ready";

export type OperationsDashboardSectionKey =
  | "backup"
  | "controls"
  | "cron"
  | "database"
  | "diagnostics"
  | "future"
  | "health"
  | "monitoring"
  | "queues"
  | "storage"
  | "workers";

export type OperationsDashboardSectionDefinition = {
  description: string;
  key: OperationsDashboardSectionKey;
  title: string;
};

export type OperationsDashboardItem = {
  auditSupport: boolean;
  category: string;
  description: string;
  healthSupport: boolean;
  key: string;
  monitoringSupport: boolean;
  runtimeStatus: OperationsDashboardRuntimeStatus;
  sectionKey: OperationsDashboardSectionKey;
  title: string;
  visibility: OperationsRegistryVisibility;
};

export type OperationsDashboardSection = {
  itemCount: number;
  items: OperationsDashboardItem[];
  key: OperationsDashboardSectionKey;
  title: string;
};

export type OperationsDashboardMetrics = {
  auditSupportedModules: number;
  healthSupportedModules: number;
  monitoringSupportedModules: number;
  productionReadyModules: number;
  reviewRequiredModules: number;
  runtimeReadyModules: number;
  totalOperationsModules: number;
  visibleModules: number;
};

export type OperationsDashboardSummary = {
  metrics: OperationsDashboardMetrics;
  readOnly: true;
  sectionCount: number;
  source: OperationsDashboardSource;
  status: "dashboard_ready" | "needs_attention";
  summary: string;
};

export const OPERATIONS_DASHBOARD_SOURCE = "operations_dashboard_runtime" as const;

const OPERATIONS_DASHBOARD_SECTIONS: readonly OperationsDashboardSectionDefinition[] = [
  {
    description: "Health overview modules registered in the operations runtime.",
    key: "health",
    title: "Health"
  },
  {
    description: "Queue runtime modules registered in the operations runtime.",
    key: "queues",
    title: "Queues"
  },
  {
    description: "Worker runtime modules registered in the operations runtime.",
    key: "workers",
    title: "Workers"
  },
  {
    description: "Cron runtime modules registered in the operations runtime.",
    key: "cron",
    title: "Cron"
  },
  {
    description: "Storage runtime modules registered in the operations runtime.",
    key: "storage",
    title: "Storage"
  },
  {
    description: "Database runtime modules registered in the operations runtime.",
    key: "database",
    title: "Database"
  },
  {
    description: "Backup and disaster recovery modules registered in the operations runtime.",
    key: "backup",
    title: "Backup"
  },
  {
    description: "Monitoring modules registered in the operations runtime.",
    key: "monitoring",
    title: "Monitoring"
  },
  {
    description: "Safe control modules registered in the operations runtime.",
    key: "controls",
    title: "Controls"
  },
  {
    description: "Diagnostics modules registered in the operations runtime.",
    key: "diagnostics",
    title: "Diagnostics"
  },
  {
    description: "Reserved future hook modules registered in the operations runtime.",
    key: "future",
    title: "Future"
  }
] as const;

const REGISTRY_KEY_TO_SECTION: Record<string, OperationsDashboardSectionKey> = {
  "op-ai-queue": "queues",
  "op-backup": "backup",
  "op-cron-health": "health",
  "op-cron-jobs": "cron",
  "op-database-health": "database",
  "op-diagnostics": "diagnostics",
  "op-disaster-recovery": "backup",
  "op-domain-email-queue": "queues",
  "op-email-queue": "queues",
  "op-future-hooks": "future",
  "op-monitoring-events": "monitoring",
  "op-queue-health": "health",
  "op-queue-tables": "queues",
  "op-safe-controls": "controls",
  "op-storage-health": "health",
  "op-storage-metrics": "storage",
  "op-worker-health": "health",
  "op-worker-tables": "workers"
};

export function resolveOperationsDashboardSectionKey(entry: OperationsRegistryEntry): OperationsDashboardSectionKey {
  return REGISTRY_KEY_TO_SECTION[entry.key] ?? "health";
}

export function mapOperationsRegistryEntryToDashboardRuntimeStatus(
  entry: OperationsRegistryEntry
): OperationsDashboardRuntimeStatus {
  if (entry.visibility === "hidden") {
    return "disabled";
  }

  if (entry.runtimeType === "future_hooks" || entry.implementationStatus === "planned") {
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

  if (entry.implementationStatus === "registered") {
    return "registered";
  }

  return "registered";
}

export function operationsDashboardRuntimeStatusLabel(status: OperationsDashboardRuntimeStatus) {
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

export function operationsDashboardRuntimeStatusBadgeTone(status: OperationsDashboardRuntimeStatus) {
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

export function buildOperationsDashboardMetrics(entries: OperationsRegistryEntry[]): OperationsDashboardMetrics {
  return {
    auditSupportedModules: entries.filter((entry) => entry.auditSupport).length,
    healthSupportedModules: entries.filter((entry) => entry.healthSupport).length,
    monitoringSupportedModules: entries.filter((entry) => entry.monitoringSupport).length,
    productionReadyModules: entries.filter((entry) => entry.productionReady).length,
    reviewRequiredModules: entries.filter(
      (entry) => mapOperationsRegistryEntryToDashboardRuntimeStatus(entry) === "review_required"
    ).length,
    runtimeReadyModules: entries.filter((entry) => entry.implementationStatus === "production_ready").length,
    totalOperationsModules: entries.length,
    visibleModules: entries.filter((entry) => entry.visibility !== "hidden").length
  };
}

export function mapOperationsRegistryEntryToDashboardItem(entry: OperationsRegistryEntry): OperationsDashboardItem {
  return {
    auditSupport: entry.auditSupport,
    category: entry.category,
    description: entry.description,
    healthSupport: entry.healthSupport,
    key: entry.key,
    monitoringSupport: entry.monitoringSupport,
    runtimeStatus: mapOperationsRegistryEntryToDashboardRuntimeStatus(entry),
    sectionKey: resolveOperationsDashboardSectionKey(entry),
    title: entry.title,
    visibility: entry.visibility
  };
}

export function buildOperationsDashboardSections(entries: OperationsRegistryEntry[]): OperationsDashboardSection[] {
  const items = entries.map(mapOperationsRegistryEntryToDashboardItem);

  return OPERATIONS_DASHBOARD_SECTIONS.map((section) => {
    const sectionItems = items.filter((item) => item.sectionKey === section.key);

    return {
      itemCount: sectionItems.length,
      items: sectionItems,
      key: section.key,
      title: section.title
    };
  }).filter((section) => section.itemCount > 0);
}

export function getOperationsDashboardSummary(entries: OperationsRegistryEntry[]): OperationsDashboardSummary {
  const metrics = buildOperationsDashboardMetrics(entries);
  const sections = buildOperationsDashboardSections(entries);
  const status = metrics.reviewRequiredModules > 0 || metrics.productionReadyModules < metrics.totalOperationsModules
    ? ("needs_attention" as const)
    : ("dashboard_ready" as const);

  return {
    metrics,
    readOnly: true,
    sectionCount: sections.length,
    source: OPERATIONS_DASHBOARD_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${metrics.totalOperationsModules} operations modules`,
      `${metrics.productionReadyModules} production ready`,
      `${metrics.reviewRequiredModules} review required`
    ].join("; ")
  };
}

export function mapOperationsDashboardRuntimeToAdminFields() {
  const entries = resolveOperationsRegistryEntries();
  const summary = getOperationsDashboardSummary(entries);
  const sections = buildOperationsDashboardSections(entries);

  return {
    dashboard: summary,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    sections,
    stats: [
      { label: "Total Operations Modules", value: String(summary.metrics.totalOperationsModules) },
      { label: "Visible Modules", value: String(summary.metrics.visibleModules) },
      { label: "Runtime Ready Modules", value: String(summary.metrics.runtimeReadyModules) },
      { label: "Monitoring Supported Modules", value: String(summary.metrics.monitoringSupportedModules) },
      { label: "Audit Supported Modules", value: String(summary.metrics.auditSupportedModules) },
      { label: "Health Supported Modules", value: String(summary.metrics.healthSupportedModules) },
      { label: "Review Required Modules", value: String(summary.metrics.reviewRequiredModules) },
      { label: "Production Ready Modules", value: String(summary.metrics.productionReadyModules) }
    ]
  };
}

export async function loadOperationsDashboardReadOnlySafe() {
  return mapOperationsDashboardRuntimeToAdminFields();
}
