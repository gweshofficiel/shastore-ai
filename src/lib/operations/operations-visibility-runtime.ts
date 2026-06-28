import "server-only";

import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsImplementationStatus,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";
import type { OperationsStatusRuntimeInput } from "@/src/lib/operations/operations-status-runtime";

export type OperationsVisibilityRuntimeSource = "operations_visibility_runtime";

export type OperationsVisibilityGroupKey =
  | "ai-queue-visibility"
  | "backup-visibility"
  | "cron-visibility"
  | "dashboard-visibility"
  | "database-visibility"
  | "diagnostics-visibility"
  | "disaster-recovery-visibility"
  | "domain-email-queue-visibility"
  | "email-queue-visibility"
  | "future-visibility-hooks"
  | "monitoring-visibility"
  | "queue-visibility"
  | "registry-visibility"
  | "safe-controls-visibility"
  | "storage-visibility"
  | "worker-visibility";

export type OperationsVisibilityState =
  | "disabled"
  | "future_hook"
  | "hidden"
  | "review_required"
  | "super_admin_only"
  | "visible";

export type OperationsVisibilityAccessLevel = "hidden" | "internal_read_only" | "super_admin_only";

export type OperationsVisibilityRouteStatus = "not_connected" | "registered" | "review_required" | "runtime_ready";

export type OperationsVisibilityFeatureStatus = "disabled" | "enabled" | "future_hook" | "review_required";

export type OperationsVisibilityRuntimeStatus = "disabled" | "future_hook" | "registered" | "review_required" | "runtime_ready";

export type OperationsVisibilityReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsVisibilitySafeControlKey =
  | "change_visibility"
  | "export_report"
  | "review_feature_flag"
  | "review_permissions"
  | "review_route";

export type OperationsVisibilitySafeControl = {
  enabled: false;
  key: OperationsVisibilitySafeControlKey;
  label: string;
  note: string;
};

export type OperationsVisibilityRuntimeItem = {
  accessLevel: OperationsVisibilityAccessLevel;
  category: string;
  featureStatus: OperationsVisibilityFeatureStatus;
  groupKey: OperationsVisibilityGroupKey;
  moduleKey: string;
  moduleName: string;
  permissionScope: string;
  reviewStatus: OperationsVisibilityReviewStatus;
  routeStatus: OperationsVisibilityRouteStatus;
  runtimeStatus: OperationsVisibilityRuntimeStatus;
  safeControls: OperationsVisibilitySafeControl[];
  safeSummary: string;
  visibility: OperationsVisibilityState;
  visibilityKey: string;
};

export type OperationsVisibilityRuntimeGroup = {
  groupKey: OperationsVisibilityGroupKey;
  itemCount: number;
  items: OperationsVisibilityRuntimeItem[];
  title: string;
};

export type OperationsVisibilityRuntimeSummary = {
  disabledModules: number;
  futureHookModules: number;
  groupCount: number;
  hiddenModules: number;
  overallStatus: "needs_attention" | "operations_visibility_runtime_ready";
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  reviewRequiredModules: number;
  source: OperationsVisibilityRuntimeSource;
  summary: string;
  superAdminOnlyModules: number;
  totalModules: number;
  visibleModules: number;
};

type VisibilityModuleBinding = {
  category: string;
  groupKey: OperationsVisibilityGroupKey;
  moduleKey: string;
  moduleName: string;
  registryKey: string | null;
  resolveProviderStatus: (input: OperationsStatusRuntimeInput) => string;
  resolveSafeSummary: (input: OperationsStatusRuntimeInput) => string;
  visibilityKey: string;
};

export const OPERATIONS_VISIBILITY_RUNTIME_SOURCE = "operations_visibility_runtime" as const;

export const OPERATIONS_VISIBILITY_SAFE_CONTROLS: readonly OperationsVisibilitySafeControl[] = [
  {
    enabled: false,
    key: "change_visibility",
    label: "Change Visibility",
    note: "Read-only placeholder. No visibility mutation runs during OP-20 page load."
  },
  {
    enabled: false,
    key: "review_permissions",
    label: "Review Permissions",
    note: "Read-only placeholder. No permission mutation runs during OP-20 page load."
  },
  {
    enabled: false,
    key: "review_route",
    label: "Review Route",
    note: "Read-only placeholder. No route mutation runs during OP-20 page load."
  },
  {
    enabled: false,
    key: "review_feature_flag",
    label: "Review Feature Flag",
    note: "Read-only placeholder. No feature flag mutation runs during OP-20 page load."
  },
  {
    enabled: false,
    key: "export_report",
    label: "Export Report",
    note: "Read-only placeholder. No visibility export or provider call runs during OP-20 page load."
  }
] as const;

const VISIBILITY_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsVisibilityGroupKey;
  title: string;
}> = [
  { groupKey: "registry-visibility", title: "Registry Visibility" },
  { groupKey: "dashboard-visibility", title: "Dashboard Visibility" },
  { groupKey: "queue-visibility", title: "Queue Visibility" },
  { groupKey: "worker-visibility", title: "Worker Visibility" },
  { groupKey: "cron-visibility", title: "Cron Visibility" },
  { groupKey: "storage-visibility", title: "Storage Visibility" },
  { groupKey: "database-visibility", title: "Database Visibility" },
  { groupKey: "email-queue-visibility", title: "Email Queue Visibility" },
  { groupKey: "ai-queue-visibility", title: "AI Queue Visibility" },
  { groupKey: "domain-email-queue-visibility", title: "Domain & Email Queue Visibility" },
  { groupKey: "monitoring-visibility", title: "Monitoring Visibility" },
  { groupKey: "backup-visibility", title: "Backup Visibility" },
  { groupKey: "disaster-recovery-visibility", title: "Disaster Recovery Visibility" },
  { groupKey: "diagnostics-visibility", title: "Diagnostics Visibility" },
  { groupKey: "safe-controls-visibility", title: "Safe Controls Visibility" },
  { groupKey: "future-visibility-hooks", title: "Future Visibility Hooks" }
];

const VISIBILITY_MODULE_BINDINGS: readonly VisibilityModuleBinding[] = [
  {
    category: "Operations Platform",
    groupKey: "registry-visibility",
    moduleKey: "operations_registry_runtime",
    moduleName: "Operations registry",
    registryKey: null,
    resolveProviderStatus: (input) => input.registry.status,
    resolveSafeSummary: (input) => input.registry.summary,
    visibilityKey: "op-visibility-registry"
  },
  {
    category: "Operations Platform",
    groupKey: "dashboard-visibility",
    moduleKey: "operations_dashboard_runtime",
    moduleName: "Operations dashboard",
    registryKey: null,
    resolveProviderStatus: (input) => input.dashboard.status,
    resolveSafeSummary: (input) => input.dashboard.summary,
    visibilityKey: "op-visibility-dashboard"
  },
  {
    category: "Queue Operations",
    groupKey: "queue-visibility",
    moduleKey: "op-queue-tables",
    moduleName: "Queue runtime",
    registryKey: "op-queue-tables",
    resolveProviderStatus: (input) => input.queueRuntime.status,
    resolveSafeSummary: (input) => input.queueRuntime.summary,
    visibilityKey: "op-visibility-queue"
  },
  {
    category: "Worker Operations",
    groupKey: "worker-visibility",
    moduleKey: "op-worker-tables",
    moduleName: "Worker runtime",
    registryKey: "op-worker-tables",
    resolveProviderStatus: (input) => input.workerRuntime.status,
    resolveSafeSummary: (input) => input.workerRuntime.summary,
    visibilityKey: "op-visibility-worker"
  },
  {
    category: "Worker Operations",
    groupKey: "worker-visibility",
    moduleKey: "op-worker-health",
    moduleName: "Worker monitoring runtime",
    registryKey: "op-worker-health",
    resolveProviderStatus: (input) => input.workerMonitoringRuntime.status,
    resolveSafeSummary: (input) => input.workerMonitoringRuntime.summary,
    visibilityKey: "op-visibility-worker-monitoring"
  },
  {
    category: "Cron Operations",
    groupKey: "cron-visibility",
    moduleKey: "op-cron-jobs",
    moduleName: "Cron runtime",
    registryKey: "op-cron-jobs",
    resolveProviderStatus: (input) => input.cronRuntime.status,
    resolveSafeSummary: (input) => input.cronRuntime.summary,
    visibilityKey: "op-visibility-cron"
  },
  {
    category: "Cron Operations",
    groupKey: "cron-visibility",
    moduleKey: "op-cron-health",
    moduleName: "Cron monitoring runtime",
    registryKey: "op-cron-health",
    resolveProviderStatus: (input) => input.cronMonitoringRuntime.status,
    resolveSafeSummary: (input) => input.cronMonitoringRuntime.summary,
    visibilityKey: "op-visibility-cron-monitoring"
  },
  {
    category: "Storage Operations",
    groupKey: "storage-visibility",
    moduleKey: "op-storage-health",
    moduleName: "Storage health runtime",
    registryKey: "op-storage-health",
    resolveProviderStatus: (input) => input.storageRuntime.status,
    resolveSafeSummary: (input) => input.storageRuntime.summary,
    visibilityKey: "op-visibility-storage-health"
  },
  {
    category: "Storage Operations",
    groupKey: "storage-visibility",
    moduleKey: "op-storage-metrics",
    moduleName: "Storage metrics runtime",
    registryKey: "op-storage-metrics",
    resolveProviderStatus: (input) => input.storageMetricsRuntime.status,
    resolveSafeSummary: (input) => input.storageMetricsRuntime.summary,
    visibilityKey: "op-visibility-storage-metrics"
  },
  {
    category: "Database Operations",
    groupKey: "database-visibility",
    moduleKey: "op-database-health",
    moduleName: "Database health runtime",
    registryKey: "op-database-health",
    resolveProviderStatus: (input) => input.databaseRuntime.status,
    resolveSafeSummary: (input) => input.databaseRuntime.summary,
    visibilityKey: "op-visibility-database"
  },
  {
    category: "Queue Operations",
    groupKey: "email-queue-visibility",
    moduleKey: "op-email-queue",
    moduleName: "Email queue runtime",
    registryKey: "op-email-queue",
    resolveProviderStatus: (input) => input.emailQueueRuntime.status,
    resolveSafeSummary: (input) => input.emailQueueRuntime.summary,
    visibilityKey: "op-visibility-email-queue"
  },
  {
    category: "Queue Operations",
    groupKey: "ai-queue-visibility",
    moduleKey: "op-ai-queue",
    moduleName: "AI queue runtime",
    registryKey: "op-ai-queue",
    resolveProviderStatus: (input) => input.aiQueueRuntime.status,
    resolveSafeSummary: (input) => input.aiQueueRuntime.summary,
    visibilityKey: "op-visibility-ai-queue"
  },
  {
    category: "Queue Operations",
    groupKey: "domain-email-queue-visibility",
    moduleKey: "op-domain-email-queue",
    moduleName: "Domain and email queue runtime",
    registryKey: "op-domain-email-queue",
    resolveProviderStatus: (input) => input.domainEmailQueueRuntime.status,
    resolveSafeSummary: (input) => input.domainEmailQueueRuntime.summary,
    visibilityKey: "op-visibility-domain-email-queue"
  },
  {
    category: "Monitoring",
    groupKey: "monitoring-visibility",
    moduleKey: "op-monitoring-events",
    moduleName: "Monitoring events runtime",
    registryKey: "op-monitoring-events",
    resolveProviderStatus: (input) => input.monitoringEventsRuntime.status,
    resolveSafeSummary: (input) => input.monitoringEventsRuntime.summary,
    visibilityKey: "op-visibility-monitoring-events"
  },
  {
    category: "Backup & Recovery",
    groupKey: "backup-visibility",
    moduleKey: "op-backup",
    moduleName: "Backup runtime",
    registryKey: "op-backup",
    resolveProviderStatus: (input) => input.backupRuntime.status,
    resolveSafeSummary: (input) => input.backupRuntime.summary,
    visibilityKey: "op-visibility-backup"
  },
  {
    category: "Backup & Recovery",
    groupKey: "disaster-recovery-visibility",
    moduleKey: "op-disaster-recovery",
    moduleName: "Disaster recovery runtime",
    registryKey: "op-disaster-recovery",
    resolveProviderStatus: (input) => input.disasterRecoveryRuntime.status,
    resolveSafeSummary: (input) => input.disasterRecoveryRuntime.summary,
    visibilityKey: "op-visibility-disaster-recovery"
  },
  {
    category: "Operations Controls",
    groupKey: "diagnostics-visibility",
    moduleKey: "op-diagnostics",
    moduleName: "Diagnostics runtime",
    registryKey: "op-diagnostics",
    resolveProviderStatus: (input) => input.diagnosticsRuntime.status,
    resolveSafeSummary: (input) => input.diagnosticsRuntime.summary,
    visibilityKey: "op-visibility-diagnostics"
  },
  {
    category: "Operations Controls",
    groupKey: "safe-controls-visibility",
    moduleKey: "op-safe-controls",
    moduleName: "Safe controls runtime",
    registryKey: "op-safe-controls",
    resolveProviderStatus: (input) => input.safeControlsRuntime.status,
    resolveSafeSummary: (input) => input.safeControlsRuntime.summary,
    visibilityKey: "op-visibility-safe-controls"
  }
] as const;

function buildSafeControls() {
  return OPERATIONS_VISIBILITY_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function isRuntimeReadyStatus(status: string) {
  return /_runtime_ready$|^registry_ready$|^dashboard_ready$/.test(status);
}

function resolvePermissionScope(registryKey: string | null) {
  const registryEntry = registryKey ? getOperationsRegistryEntry(registryKey) : null;
  return registryEntry?.permissions.join(", ") ?? "super_admin:read";
}

function resolveAccessLevel(registryVisibility: OperationsRegistryVisibility): OperationsVisibilityAccessLevel {
  switch (registryVisibility) {
    case "hidden":
      return "hidden";
    case "internal":
      return "internal_read_only";
    case "super_admin":
      return "super_admin_only";
  }
}

function resolveRouteStatus(providerStatus: string): OperationsVisibilityRouteStatus {
  if (providerStatus === "needs_attention") {
    return "review_required";
  }

  if (isRuntimeReadyStatus(providerStatus)) {
    return "runtime_ready";
  }

  return "registered";
}

function resolveFeatureStatus(implementationStatus: OperationsImplementationStatus | undefined): OperationsVisibilityFeatureStatus {
  switch (implementationStatus) {
    case "architectural":
      return "review_required";
    case "planned":
      return "future_hook";
    case "production_ready":
      return "enabled";
    case "registered":
      return "enabled";
    default:
      return "disabled";
  }
}

function resolveRuntimeStatus(providerStatus: string): OperationsVisibilityRuntimeStatus {
  if (providerStatus === "needs_attention") {
    return "review_required";
  }

  if (isRuntimeReadyStatus(providerStatus)) {
    return "runtime_ready";
  }

  return "registered";
}

function resolveVisibilityState(input: {
  implementationStatus?: OperationsImplementationStatus;
  isFutureHook: boolean;
  providerStatus: string;
  registryVisibility: OperationsRegistryVisibility;
}): OperationsVisibilityState {
  if (input.isFutureHook) {
    return "future_hook";
  }

  if (input.registryVisibility === "hidden") {
    return "hidden";
  }

  if (input.implementationStatus === "planned") {
    return "disabled";
  }

  if (input.providerStatus === "needs_attention") {
    return "review_required";
  }

  if (input.registryVisibility === "super_admin") {
    return "super_admin_only";
  }

  return "visible";
}

function resolveReviewStatus(visibility: OperationsVisibilityState): OperationsVisibilityReviewStatus {
  if (visibility === "review_required") {
    return "review_required";
  }

  if (visibility === "future_hook") {
    return "not_applicable";
  }

  return "clear";
}

function buildVisibilityModuleItem(binding: VisibilityModuleBinding, input: OperationsStatusRuntimeInput): OperationsVisibilityRuntimeItem {
  const registryEntry = binding.registryKey ? getOperationsRegistryEntry(binding.registryKey) : null;
  const providerStatus = binding.resolveProviderStatus(input);
  const registryVisibility = registryEntry?.visibility ?? "super_admin";
  const visibility = resolveVisibilityState({
    implementationStatus: registryEntry?.implementationStatus,
    isFutureHook: false,
    providerStatus,
    registryVisibility
  });

  return {
    accessLevel: resolveAccessLevel(registryVisibility),
    category: binding.category,
    featureStatus: resolveFeatureStatus(registryEntry?.implementationStatus),
    groupKey: binding.groupKey,
    moduleKey: binding.moduleKey,
    moduleName: binding.moduleName,
    permissionScope: resolvePermissionScope(binding.registryKey),
    reviewStatus: resolveReviewStatus(visibility),
    routeStatus: resolveRouteStatus(providerStatus),
    runtimeStatus: resolveRuntimeStatus(providerStatus),
    safeControls: buildSafeControls(),
    safeSummary: binding.resolveSafeSummary(input),
    visibility,
    visibilityKey: binding.visibilityKey
  };
}

function buildFutureVisibilityHookItems(futureHooks: readonly string[]): OperationsVisibilityRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");

  return futureHooks.map((hook, index) => ({
    accessLevel: "super_admin_only" as const,
    category: "Operations Platform",
    featureStatus: "future_hook" as const,
    groupKey: "future-visibility-hooks" as const,
    moduleKey: `op-future-visibility-hook-${index + 1}`,
    moduleName: hook,
    permissionScope: registryEntry?.permissions.join(", ") ?? "super_admin:read",
    reviewStatus: "not_applicable" as const,
    routeStatus: "not_connected" as const,
    runtimeStatus: "future_hook" as const,
    safeControls: buildSafeControls(),
    safeSummary: "Future visibility hook placeholder derived from operations registry metadata only",
    visibility: "future_hook" as const,
    visibilityKey: `op-visibility-future-hook-${index + 1}`
  }));
}

export function operationsVisibilityStateLabel(state: OperationsVisibilityState) {
  switch (state) {
    case "disabled":
      return "Disabled";
    case "future_hook":
      return "Future Hook";
    case "hidden":
      return "Hidden";
    case "review_required":
      return "Review Required";
    case "super_admin_only":
      return "Super Admin Only";
    case "visible":
      return "Visible";
  }
}

export function operationsVisibilityStateBadgeTone(state: OperationsVisibilityState) {
  switch (state) {
    case "visible":
    case "super_admin_only":
      return "green" as const;
    case "review_required":
      return "amber" as const;
    case "hidden":
    case "disabled":
      return "slate" as const;
    case "future_hook":
      return "blue" as const;
  }
}

export function buildOperationsVisibilityRuntimeGroups(
  items: OperationsVisibilityRuntimeItem[]
): OperationsVisibilityRuntimeGroup[] {
  return VISIBILITY_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsVisibilityRuntimeSummary(
  items: OperationsVisibilityRuntimeItem[]
): OperationsVisibilityRuntimeSummary {
  const operationalModules = items.filter((item) => item.groupKey !== "future-visibility-hooks");
  const visibleModules = operationalModules.filter((item) => item.visibility === "visible").length;
  const hiddenModules = operationalModules.filter((item) => item.visibility === "hidden").length;
  const disabledModules = operationalModules.filter((item) => item.visibility === "disabled").length;
  const superAdminOnlyModules = operationalModules.filter((item) => item.visibility === "super_admin_only").length;
  const futureHookModules = items.filter((item) => item.visibility === "future_hook").length;
  const reviewRequiredModules = operationalModules.filter((item) => item.visibility === "review_required").length;
  const overallStatus =
    reviewRequiredModules > 0 ? ("needs_attention" as const) : ("operations_visibility_runtime_ready" as const);

  return {
    disabledModules,
    futureHookModules,
    groupCount: buildOperationsVisibilityRuntimeGroups(items).length,
    hiddenModules,
    overallStatus,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    reviewRequiredModules,
    source: OPERATIONS_VISIBILITY_RUNTIME_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${operationalModules.length} modules`,
      `${visibleModules} visible`,
      `${superAdminOnlyModules} super admin only`,
      `${reviewRequiredModules} review required`
    ].join("; "),
    superAdminOnlyModules,
    totalModules: items.length,
    visibleModules
  };
}

export function buildOperationsVisibilityRuntimeReadOnlySafe(input: OperationsStatusRuntimeInput) {
  const visibilityItems = [
    ...VISIBILITY_MODULE_BINDINGS.map((binding) => buildVisibilityModuleItem(binding, input)),
    ...buildFutureVisibilityHookItems(input.futureHooks)
  ];
  const groups = buildOperationsVisibilityRuntimeGroups(visibilityItems);
  const summary = getOperationsVisibilityRuntimeSummary(visibilityItems);

  return {
    groups,
    visibilityItems,
    visibilityRuntime: summary
  };
}

export function mapOperationsVisibilityRuntimeToAdminFields(
  input: ReturnType<typeof buildOperationsVisibilityRuntimeReadOnlySafe>
) {
  return {
    groups: input.groups,
    visibilityItems: input.visibilityItems,
    visibilityRuntime: input.visibilityRuntime
  };
}

export type { OperationsStatusRuntimeInput as OperationsVisibilityRuntimeInput };
