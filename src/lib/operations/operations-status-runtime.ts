import "server-only";

import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsStatusRuntimeSource = "operations_status_runtime";

export type OperationsStatusGroupKey =
  | "ai-queue-status"
  | "backup-status"
  | "cron-status"
  | "dashboard-status"
  | "database-status"
  | "diagnostics-status"
  | "disaster-recovery-status"
  | "domain-email-queue-status"
  | "email-queue-status"
  | "future-status-hooks"
  | "monitoring-status"
  | "queue-status"
  | "registry-status"
  | "safe-controls-status"
  | "storage-status"
  | "worker-status";

export type OperationsStatusRuntimeStatus =
  | "disabled"
  | "failed"
  | "future_hook"
  | "healthy"
  | "production_ready"
  | "registered"
  | "review_required"
  | "runtime_ready"
  | "warning";

export type OperationsStatusHealthStatus = "failed" | "healthy" | "unknown" | "warning";

export type OperationsStatusMonitoringStatus = "failed" | "healthy" | "unknown" | "warning";

export type OperationsStatusAuditStatus = "not_supported" | "ready" | "review_required";

export type OperationsStatusCertificationStatus = "certified" | "not_certified" | "review_required";

export type OperationsStatusReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsStatusOverallStatus = "needs_attention" | "operations_status_runtime_ready";

export type OperationsStatusRuntimeItem = {
  auditStatus: OperationsStatusAuditStatus;
  category: string;
  certificationStatus: OperationsStatusCertificationStatus;
  groupKey: OperationsStatusGroupKey;
  healthStatus: OperationsStatusHealthStatus;
  moduleKey: string;
  moduleName: string;
  monitoringStatus: OperationsStatusMonitoringStatus;
  operationsStatusKey: string;
  reviewStatus: OperationsStatusReviewStatus;
  runtimeStatus: OperationsStatusRuntimeStatus;
  safeSummary: string;
  visibility: OperationsRegistryVisibility;
};

export type OperationsStatusRuntimeGroup = {
  groupKey: OperationsStatusGroupKey;
  itemCount: number;
  items: OperationsStatusRuntimeItem[];
  title: string;
};

export type OperationsStatusRuntimeSummary = {
  disabledModules: number;
  failedModules: number;
  futureHooks: number;
  groupCount: number;
  overallStatus: OperationsStatusOverallStatus;
  productionReadyModules: number;
  readOnly: true;
  registeredModules: number;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  reviewRequiredModules: number;
  runtimeReadyModules: number;
  source: OperationsStatusRuntimeSource;
  summary: string;
  totalModules: number;
  warningModules: number;
};

type RuntimeProviderSnapshot = {
  status: string;
  summary: string;
};

export type OperationsStatusRuntimeInput = {
  aiQueueRuntime: RuntimeProviderSnapshot;
  backupRuntime: RuntimeProviderSnapshot;
  cronMonitoringRuntime: RuntimeProviderSnapshot;
  cronRuntime: RuntimeProviderSnapshot;
  dashboard: RuntimeProviderSnapshot;
  databaseRuntime: RuntimeProviderSnapshot;
  diagnosticsRuntime: RuntimeProviderSnapshot;
  disasterRecoveryRuntime: RuntimeProviderSnapshot;
  domainEmailQueueRuntime: RuntimeProviderSnapshot;
  emailQueueRuntime: RuntimeProviderSnapshot;
  futureHooks: readonly string[];
  monitoringEventsRuntime: RuntimeProviderSnapshot;
  queueRuntime: RuntimeProviderSnapshot;
  registry: RuntimeProviderSnapshot & {
    productionReadyEntries?: number;
    registeredEntries?: number;
    totalEntries?: number;
  };
  safeControlsRuntime: RuntimeProviderSnapshot;
  storageMetricsRuntime: RuntimeProviderSnapshot;
  storageRuntime: RuntimeProviderSnapshot;
  workerMonitoringRuntime: RuntimeProviderSnapshot;
  workerRuntime: RuntimeProviderSnapshot;
};

type StatusModuleBinding = {
  category: string;
  groupKey: OperationsStatusGroupKey;
  moduleKey: string;
  moduleName: string;
  operationsStatusKey: string;
  registryKey: string | null;
  resolveProviderStatus: (input: OperationsStatusRuntimeInput) => string;
  resolveSafeSummary: (input: OperationsStatusRuntimeInput) => string;
};

export const OPERATIONS_STATUS_RUNTIME_SOURCE = "operations_status_runtime" as const;

const STATUS_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsStatusGroupKey;
  title: string;
}> = [
  { groupKey: "registry-status", title: "Registry Status" },
  { groupKey: "dashboard-status", title: "Dashboard Status" },
  { groupKey: "queue-status", title: "Queue Status" },
  { groupKey: "worker-status", title: "Worker Status" },
  { groupKey: "cron-status", title: "Cron Status" },
  { groupKey: "storage-status", title: "Storage Status" },
  { groupKey: "database-status", title: "Database Status" },
  { groupKey: "email-queue-status", title: "Email Queue Status" },
  { groupKey: "ai-queue-status", title: "AI Queue Status" },
  { groupKey: "domain-email-queue-status", title: "Domain & Email Queue Status" },
  { groupKey: "monitoring-status", title: "Monitoring Status" },
  { groupKey: "backup-status", title: "Backup Status" },
  { groupKey: "disaster-recovery-status", title: "Disaster Recovery Status" },
  { groupKey: "diagnostics-status", title: "Diagnostics Status" },
  { groupKey: "safe-controls-status", title: "Safe Controls Status" },
  { groupKey: "future-status-hooks", title: "Future Status Hooks" }
];

const STATUS_MODULE_BINDINGS: readonly StatusModuleBinding[] = [
  {
    category: "Operations Platform",
    groupKey: "registry-status",
    moduleKey: "operations_registry_runtime",
    moduleName: "Operations registry",
    operationsStatusKey: "op-status-registry",
    registryKey: null,
    resolveProviderStatus: (input) => input.registry.status,
    resolveSafeSummary: (input) => input.registry.summary
  },
  {
    category: "Operations Platform",
    groupKey: "dashboard-status",
    moduleKey: "operations_dashboard_runtime",
    moduleName: "Operations dashboard",
    operationsStatusKey: "op-status-dashboard",
    registryKey: null,
    resolveProviderStatus: (input) => input.dashboard.status,
    resolveSafeSummary: (input) => input.dashboard.summary
  },
  {
    category: "Queue Operations",
    groupKey: "queue-status",
    moduleKey: "op-queue-tables",
    moduleName: "Queue runtime",
    operationsStatusKey: "op-status-queue",
    registryKey: "op-queue-tables",
    resolveProviderStatus: (input) => input.queueRuntime.status,
    resolveSafeSummary: (input) => input.queueRuntime.summary
  },
  {
    category: "Worker Operations",
    groupKey: "worker-status",
    moduleKey: "op-worker-tables",
    moduleName: "Worker runtime",
    operationsStatusKey: "op-status-worker",
    registryKey: "op-worker-tables",
    resolveProviderStatus: (input) => input.workerRuntime.status,
    resolveSafeSummary: (input) => input.workerRuntime.summary
  },
  {
    category: "Worker Operations",
    groupKey: "worker-status",
    moduleKey: "op-worker-health",
    moduleName: "Worker monitoring runtime",
    operationsStatusKey: "op-status-worker-monitoring",
    registryKey: "op-worker-health",
    resolveProviderStatus: (input) => input.workerMonitoringRuntime.status,
    resolveSafeSummary: (input) => input.workerMonitoringRuntime.summary
  },
  {
    category: "Cron Operations",
    groupKey: "cron-status",
    moduleKey: "op-cron-jobs",
    moduleName: "Cron runtime",
    operationsStatusKey: "op-status-cron",
    registryKey: "op-cron-jobs",
    resolveProviderStatus: (input) => input.cronRuntime.status,
    resolveSafeSummary: (input) => input.cronRuntime.summary
  },
  {
    category: "Cron Operations",
    groupKey: "cron-status",
    moduleKey: "op-cron-health",
    moduleName: "Cron monitoring runtime",
    operationsStatusKey: "op-status-cron-monitoring",
    registryKey: "op-cron-health",
    resolveProviderStatus: (input) => input.cronMonitoringRuntime.status,
    resolveSafeSummary: (input) => input.cronMonitoringRuntime.summary
  },
  {
    category: "Storage Operations",
    groupKey: "storage-status",
    moduleKey: "op-storage-health",
    moduleName: "Storage health runtime",
    operationsStatusKey: "op-status-storage-health",
    registryKey: "op-storage-health",
    resolveProviderStatus: (input) => input.storageRuntime.status,
    resolveSafeSummary: (input) => input.storageRuntime.summary
  },
  {
    category: "Storage Operations",
    groupKey: "storage-status",
    moduleKey: "op-storage-metrics",
    moduleName: "Storage metrics runtime",
    operationsStatusKey: "op-status-storage-metrics",
    registryKey: "op-storage-metrics",
    resolveProviderStatus: (input) => input.storageMetricsRuntime.status,
    resolveSafeSummary: (input) => input.storageMetricsRuntime.summary
  },
  {
    category: "Database Operations",
    groupKey: "database-status",
    moduleKey: "op-database-health",
    moduleName: "Database health runtime",
    operationsStatusKey: "op-status-database",
    registryKey: "op-database-health",
    resolveProviderStatus: (input) => input.databaseRuntime.status,
    resolveSafeSummary: (input) => input.databaseRuntime.summary
  },
  {
    category: "Queue Operations",
    groupKey: "email-queue-status",
    moduleKey: "op-email-queue",
    moduleName: "Email queue runtime",
    operationsStatusKey: "op-status-email-queue",
    registryKey: "op-email-queue",
    resolveProviderStatus: (input) => input.emailQueueRuntime.status,
    resolveSafeSummary: (input) => input.emailQueueRuntime.summary
  },
  {
    category: "Queue Operations",
    groupKey: "ai-queue-status",
    moduleKey: "op-ai-queue",
    moduleName: "AI queue runtime",
    operationsStatusKey: "op-status-ai-queue",
    registryKey: "op-ai-queue",
    resolveProviderStatus: (input) => input.aiQueueRuntime.status,
    resolveSafeSummary: (input) => input.aiQueueRuntime.summary
  },
  {
    category: "Queue Operations",
    groupKey: "domain-email-queue-status",
    moduleKey: "op-domain-email-queue",
    moduleName: "Domain and email queue runtime",
    operationsStatusKey: "op-status-domain-email-queue",
    registryKey: "op-domain-email-queue",
    resolveProviderStatus: (input) => input.domainEmailQueueRuntime.status,
    resolveSafeSummary: (input) => input.domainEmailQueueRuntime.summary
  },
  {
    category: "Monitoring",
    groupKey: "monitoring-status",
    moduleKey: "op-monitoring-events",
    moduleName: "Monitoring events runtime",
    operationsStatusKey: "op-status-monitoring-events",
    registryKey: "op-monitoring-events",
    resolveProviderStatus: (input) => input.monitoringEventsRuntime.status,
    resolveSafeSummary: (input) => input.monitoringEventsRuntime.summary
  },
  {
    category: "Backup & Recovery",
    groupKey: "backup-status",
    moduleKey: "op-backup",
    moduleName: "Backup runtime",
    operationsStatusKey: "op-status-backup",
    registryKey: "op-backup",
    resolveProviderStatus: (input) => input.backupRuntime.status,
    resolveSafeSummary: (input) => input.backupRuntime.summary
  },
  {
    category: "Backup & Recovery",
    groupKey: "disaster-recovery-status",
    moduleKey: "op-disaster-recovery",
    moduleName: "Disaster recovery runtime",
    operationsStatusKey: "op-status-disaster-recovery",
    registryKey: "op-disaster-recovery",
    resolveProviderStatus: (input) => input.disasterRecoveryRuntime.status,
    resolveSafeSummary: (input) => input.disasterRecoveryRuntime.summary
  },
  {
    category: "Operations Controls",
    groupKey: "diagnostics-status",
    moduleKey: "op-diagnostics",
    moduleName: "Diagnostics runtime",
    operationsStatusKey: "op-status-diagnostics",
    registryKey: "op-diagnostics",
    resolveProviderStatus: (input) => input.diagnosticsRuntime.status,
    resolveSafeSummary: (input) => input.diagnosticsRuntime.summary
  },
  {
    category: "Operations Controls",
    groupKey: "safe-controls-status",
    moduleKey: "op-safe-controls",
    moduleName: "Safe controls runtime",
    operationsStatusKey: "op-status-safe-controls",
    registryKey: "op-safe-controls",
    resolveProviderStatus: (input) => input.safeControlsRuntime.status,
    resolveSafeSummary: (input) => input.safeControlsRuntime.summary
  }
] as const;

function isRuntimeReadyStatus(status: string) {
  return /_runtime_ready$|^registry_ready$|^dashboard_ready$/.test(status);
}

function mapProviderStatusToRuntimeStatus(providerStatus: string): OperationsStatusRuntimeStatus {
  if (providerStatus === "needs_attention") {
    return "review_required";
  }

  if (isRuntimeReadyStatus(providerStatus)) {
    return "runtime_ready";
  }

  if (providerStatus === "placeholder") {
    return "registered";
  }

  return "registered";
}

function mapProviderStatusToHealthStatus(providerStatus: string): OperationsStatusHealthStatus {
  if (providerStatus === "needs_attention") {
    return "warning";
  }

  if (isRuntimeReadyStatus(providerStatus)) {
    return "healthy";
  }

  return "unknown";
}

function mapProviderStatusToMonitoringStatus(
  providerStatus: string,
  monitoringSupport: boolean
): OperationsStatusMonitoringStatus {
  if (!monitoringSupport) {
    return "unknown";
  }

  if (providerStatus === "needs_attention") {
    return "warning";
  }

  if (isRuntimeReadyStatus(providerStatus)) {
    return "healthy";
  }

  return "unknown";
}

function resolveAuditStatus(
  registryKey: string | null,
  runtimeStatus: OperationsStatusRuntimeStatus
): OperationsStatusAuditStatus {
  const registryEntry = registryKey ? getOperationsRegistryEntry(registryKey) : null;

  if (!registryEntry?.auditSupport) {
    return "not_supported";
  }

  if (runtimeStatus === "review_required" || runtimeStatus === "failed") {
    return "review_required";
  }

  return "ready";
}

function resolveCertificationStatus(registryKey: string | null, providerStatus: string): OperationsStatusCertificationStatus {
  const registryEntry = registryKey ? getOperationsRegistryEntry(registryKey) : null;

  if (registryEntry?.productionReady || registryEntry?.implementationStatus === "production_ready") {
    return "certified";
  }

  if (isRuntimeReadyStatus(providerStatus)) {
    return "certified";
  }

  if (registryEntry?.implementationStatus === "architectural") {
    return "review_required";
  }

  return "not_certified";
}

function resolveReviewStatus(runtimeStatus: OperationsStatusRuntimeStatus): OperationsStatusReviewStatus {
  if (runtimeStatus === "review_required" || runtimeStatus === "failed" || runtimeStatus === "warning") {
    return "review_required";
  }

  if (runtimeStatus === "future_hook") {
    return "not_applicable";
  }

  return "clear";
}

function buildStatusModuleItem(binding: StatusModuleBinding, input: OperationsStatusRuntimeInput): OperationsStatusRuntimeItem {
  const registryEntry = binding.registryKey ? getOperationsRegistryEntry(binding.registryKey) : null;
  const providerStatus = binding.resolveProviderStatus(input);
  const runtimeStatus = mapProviderStatusToRuntimeStatus(providerStatus);

  return {
    auditStatus: resolveAuditStatus(binding.registryKey, runtimeStatus),
    category: binding.category,
    certificationStatus: resolveCertificationStatus(binding.registryKey, providerStatus),
    groupKey: binding.groupKey,
    healthStatus: mapProviderStatusToHealthStatus(providerStatus),
    moduleKey: binding.moduleKey,
    moduleName: binding.moduleName,
    monitoringStatus: mapProviderStatusToMonitoringStatus(providerStatus, registryEntry?.monitoringSupport ?? false),
    operationsStatusKey: binding.operationsStatusKey,
    reviewStatus: resolveReviewStatus(runtimeStatus),
    runtimeStatus,
    safeSummary: binding.resolveSafeSummary(input),
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildFutureStatusHookItems(futureHooks: readonly string[]): OperationsStatusRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");

  return futureHooks.map((hook, index) => ({
    auditStatus: "not_supported" as const,
    category: "Operations Platform",
    certificationStatus: "not_certified" as const,
    groupKey: "future-status-hooks" as const,
    healthStatus: "unknown" as const,
    moduleKey: `op-future-status-hook-${index + 1}`,
    moduleName: hook,
    monitoringStatus: "unknown" as const,
    operationsStatusKey: `op-status-future-hook-${index + 1}`,
    reviewStatus: "not_applicable" as const,
    runtimeStatus: "future_hook" as const,
    safeSummary: "Future status hook placeholder derived from operations registry metadata only",
    visibility: registryEntry?.visibility ?? "super_admin"
  }));
}

export function operationsStatusRuntimeStatusLabel(status: OperationsStatusRuntimeStatus) {
  switch (status) {
    case "disabled":
      return "Disabled";
    case "failed":
      return "Failed";
    case "future_hook":
      return "Future Hook";
    case "healthy":
      return "Healthy";
    case "production_ready":
      return "Production Ready";
    case "registered":
      return "Registered";
    case "review_required":
      return "Review Required";
    case "runtime_ready":
      return "Runtime Ready";
    case "warning":
      return "Warning";
  }
}

export function operationsStatusRuntimeStatusBadgeTone(status: OperationsStatusRuntimeStatus) {
  switch (status) {
    case "healthy":
    case "production_ready":
    case "runtime_ready":
      return "green" as const;
    case "registered":
    case "warning":
      return "blue" as const;
    case "failed":
    case "review_required":
      return "amber" as const;
    case "disabled":
    case "future_hook":
      return "slate" as const;
  }
}

export function buildOperationsStatusRuntimeGroups(items: OperationsStatusRuntimeItem[]): OperationsStatusRuntimeGroup[] {
  return STATUS_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsStatusRuntimeSummary(items: OperationsStatusRuntimeItem[]): OperationsStatusRuntimeSummary {
  const operationalModules = items.filter((item) => item.groupKey !== "future-status-hooks");
  const runtimeReadyModules = operationalModules.filter((item) => item.runtimeStatus === "runtime_ready").length;
  const reviewRequiredModules = operationalModules.filter((item) => item.reviewStatus === "review_required").length;
  const productionReadyModules = operationalModules.filter(
    (item) => item.runtimeStatus === "production_ready" || item.certificationStatus === "certified"
  ).length;
  const disabledModules = operationalModules.filter((item) => item.runtimeStatus === "disabled").length;
  const warningModules = operationalModules.filter(
    (item) => item.runtimeStatus === "warning" || item.healthStatus === "warning" || item.monitoringStatus === "warning"
  ).length;
  const failedModules = operationalModules.filter((item) => item.runtimeStatus === "failed").length;
  const registeredModules = operationalModules.filter(
    (item) => item.runtimeStatus === "registered" || item.runtimeStatus === "runtime_ready"
  ).length;
  const futureHooks = items.filter((item) => item.groupKey === "future-status-hooks").length;
  const overallStatus =
    reviewRequiredModules > 0 || failedModules > 0 || warningModules > 0
      ? ("needs_attention" as const)
      : ("operations_status_runtime_ready" as const);

  return {
    disabledModules,
    failedModules,
    futureHooks,
    groupCount: buildOperationsStatusRuntimeGroups(items).length,
    overallStatus,
    productionReadyModules,
    readOnly: true,
    registeredModules,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    reviewRequiredModules,
    runtimeReadyModules,
    source: OPERATIONS_STATUS_RUNTIME_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${operationalModules.length} modules`,
      `${runtimeReadyModules} runtime ready`,
      `${reviewRequiredModules} review required`,
      `${productionReadyModules} production ready`
    ].join("; "),
    totalModules: items.length,
    warningModules
  };
}

export function buildOperationsStatusRuntimeReadOnlySafe(input: OperationsStatusRuntimeInput) {
  const statusItems = [
    ...STATUS_MODULE_BINDINGS.map((binding) => buildStatusModuleItem(binding, input)),
    ...buildFutureStatusHookItems(input.futureHooks)
  ];
  const groups = buildOperationsStatusRuntimeGroups(statusItems);
  const summary = getOperationsStatusRuntimeSummary(statusItems);

  return {
    groups,
    statusItems,
    statusRuntime: summary
  };
}

export function mapOperationsStatusRuntimeToAdminFields(
  input: ReturnType<typeof buildOperationsStatusRuntimeReadOnlySafe>
) {
  return {
    groups: input.groups,
    statusItems: input.statusItems,
    statusRuntime: input.statusRuntime
  };
}
