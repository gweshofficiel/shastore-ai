import "server-only";

import type { OperationsAuditRuntimeItem, OperationsAuditRuntimeSummary } from "@/src/lib/operations/operations-audit-runtime";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";
import type {
  OperationsStatusHealthStatus,
  OperationsStatusRuntimeItem,
  OperationsStatusRuntimeSummary
} from "@/src/lib/operations/operations-status-runtime";
import type {
  OperationsVisibilityRuntimeItem,
  OperationsVisibilityRuntimeSummary
} from "@/src/lib/operations/operations-visibility-runtime";

export type OperationsReviewRuntimeSource = "operations_review_runtime";

export type OperationsReviewGroupKey =
  | "ai-queue-review"
  | "audit-review"
  | "backup-review"
  | "cron-review"
  | "dashboard-review"
  | "database-review"
  | "diagnostics-review"
  | "disaster-recovery-review"
  | "domain-email-queue-review"
  | "email-queue-review"
  | "future-review-hooks"
  | "monitoring-review"
  | "queue-review"
  | "registry-review"
  | "safe-controls-review"
  | "status-review"
  | "storage-review"
  | "visibility-review"
  | "worker-review";

export type OperationsReviewState =
  | "blocked"
  | "disabled"
  | "future_hook"
  | "production_ready_candidate"
  | "review_required"
  | "reviewed"
  | "warning";

export type OperationsReviewSafeControlKey =
  | "approve_review"
  | "export_review"
  | "mark_production_ready"
  | "reject_review"
  | "resolve_blocker";

export type OperationsReviewSafeControl = {
  enabled: false;
  key: OperationsReviewSafeControlKey;
  label: string;
  note: string;
};

export type OperationsReviewRuntimeItem = {
  auditStatus: string;
  blockerCount: number;
  category: string;
  certificationCandidate: boolean;
  groupKey: OperationsReviewGroupKey;
  healthStatus: OperationsStatusHealthStatus | "unknown";
  moduleKey: string;
  moduleName: string;
  reviewKey: string;
  reviewStatus: OperationsReviewState;
  runtimeStatus: string;
  safeControls: OperationsReviewSafeControl[];
  safeSummary: string;
  visibility: string;
  warningCount: number;
};

export type OperationsReviewRuntimeGroup = {
  groupKey: OperationsReviewGroupKey;
  itemCount: number;
  items: OperationsReviewRuntimeItem[];
  title: string;
};

export type OperationsReviewRuntimeSummary = {
  blockedModules: number;
  disabledModules: number;
  futureHooks: number;
  groupCount: number;
  overallStatus: "needs_attention" | "operations_review_runtime_ready";
  productionReadyCandidates: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  reviewRequiredModules: number;
  reviewedModules: number;
  source: OperationsReviewRuntimeSource;
  summary: string;
  totalModules: number;
  warningModules: number;
};

export type OperationsReviewRuntimeInput = {
  auditItems: OperationsAuditRuntimeItem[];
  auditRuntime: OperationsAuditRuntimeSummary;
  futureHooks: readonly string[];
  statusItems: OperationsStatusRuntimeItem[];
  statusRuntime: OperationsStatusRuntimeSummary;
  visibilityItems: OperationsVisibilityRuntimeItem[];
  visibilityRuntime: OperationsVisibilityRuntimeSummary;
};

type ReviewModuleBinding = {
  category: string;
  groupKey: OperationsReviewGroupKey;
  moduleKey: string;
  moduleName: string;
  registryKey: string | null;
  reviewKey: string;
};

export const OPERATIONS_REVIEW_RUNTIME_SOURCE = "operations_review_runtime" as const;

export const OPERATIONS_REVIEW_SAFE_CONTROLS: readonly OperationsReviewSafeControl[] = [
  {
    enabled: false,
    key: "approve_review",
    label: "Approve Review",
    note: "Read-only placeholder. No review approval runs during OP-22 page load."
  },
  {
    enabled: false,
    key: "reject_review",
    label: "Reject Review",
    note: "Read-only placeholder. No review rejection runs during OP-22 page load."
  },
  {
    enabled: false,
    key: "resolve_blocker",
    label: "Resolve Blocker",
    note: "Read-only placeholder. No blocker resolve action runs during OP-22 page load."
  },
  {
    enabled: false,
    key: "mark_production_ready",
    label: "Mark Production Ready",
    note: "Read-only placeholder. No certification or production-ready mutation runs during OP-22 page load."
  },
  {
    enabled: false,
    key: "export_review",
    label: "Export Review",
    note: "Read-only placeholder. No review export or provider call runs during OP-22 page load."
  }
] as const;

const REVIEW_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsReviewGroupKey;
  title: string;
}> = [
  { groupKey: "registry-review", title: "Registry Review" },
  { groupKey: "dashboard-review", title: "Dashboard Review" },
  { groupKey: "queue-review", title: "Queue Review" },
  { groupKey: "worker-review", title: "Worker Review" },
  { groupKey: "cron-review", title: "Cron Review" },
  { groupKey: "storage-review", title: "Storage Review" },
  { groupKey: "database-review", title: "Database Review" },
  { groupKey: "email-queue-review", title: "Email Queue Review" },
  { groupKey: "ai-queue-review", title: "AI Queue Review" },
  { groupKey: "domain-email-queue-review", title: "Domain & Email Queue Review" },
  { groupKey: "monitoring-review", title: "Monitoring Review" },
  { groupKey: "backup-review", title: "Backup Review" },
  { groupKey: "disaster-recovery-review", title: "Disaster Recovery Review" },
  { groupKey: "diagnostics-review", title: "Diagnostics Review" },
  { groupKey: "safe-controls-review", title: "Safe Controls Review" },
  { groupKey: "status-review", title: "Status Review" },
  { groupKey: "visibility-review", title: "Visibility Review" },
  { groupKey: "audit-review", title: "Audit Review" },
  { groupKey: "future-review-hooks", title: "Future Review Hooks" }
];

const REVIEW_MODULE_BINDINGS: readonly ReviewModuleBinding[] = [
  {
    category: "Operations Platform",
    groupKey: "registry-review",
    moduleKey: "operations_registry_runtime",
    moduleName: "Operations registry",
    registryKey: null,
    reviewKey: "op-review-registry"
  },
  {
    category: "Operations Platform",
    groupKey: "dashboard-review",
    moduleKey: "operations_dashboard_runtime",
    moduleName: "Operations dashboard",
    registryKey: null,
    reviewKey: "op-review-dashboard"
  },
  {
    category: "Queue Operations",
    groupKey: "queue-review",
    moduleKey: "op-queue-tables",
    moduleName: "Queue runtime",
    registryKey: "op-queue-tables",
    reviewKey: "op-review-queue"
  },
  {
    category: "Worker Operations",
    groupKey: "worker-review",
    moduleKey: "op-worker-tables",
    moduleName: "Worker runtime",
    registryKey: "op-worker-tables",
    reviewKey: "op-review-worker"
  },
  {
    category: "Worker Operations",
    groupKey: "worker-review",
    moduleKey: "op-worker-health",
    moduleName: "Worker monitoring runtime",
    registryKey: "op-worker-health",
    reviewKey: "op-review-worker-monitoring"
  },
  {
    category: "Cron Operations",
    groupKey: "cron-review",
    moduleKey: "op-cron-jobs",
    moduleName: "Cron runtime",
    registryKey: "op-cron-jobs",
    reviewKey: "op-review-cron"
  },
  {
    category: "Cron Operations",
    groupKey: "cron-review",
    moduleKey: "op-cron-health",
    moduleName: "Cron monitoring runtime",
    registryKey: "op-cron-health",
    reviewKey: "op-review-cron-monitoring"
  },
  {
    category: "Storage Operations",
    groupKey: "storage-review",
    moduleKey: "op-storage-health",
    moduleName: "Storage health runtime",
    registryKey: "op-storage-health",
    reviewKey: "op-review-storage-health"
  },
  {
    category: "Storage Operations",
    groupKey: "storage-review",
    moduleKey: "op-storage-metrics",
    moduleName: "Storage metrics runtime",
    registryKey: "op-storage-metrics",
    reviewKey: "op-review-storage-metrics"
  },
  {
    category: "Database Operations",
    groupKey: "database-review",
    moduleKey: "op-database-health",
    moduleName: "Database health runtime",
    registryKey: "op-database-health",
    reviewKey: "op-review-database"
  },
  {
    category: "Queue Operations",
    groupKey: "email-queue-review",
    moduleKey: "op-email-queue",
    moduleName: "Email queue runtime",
    registryKey: "op-email-queue",
    reviewKey: "op-review-email-queue"
  },
  {
    category: "Queue Operations",
    groupKey: "ai-queue-review",
    moduleKey: "op-ai-queue",
    moduleName: "AI queue runtime",
    registryKey: "op-ai-queue",
    reviewKey: "op-review-ai-queue"
  },
  {
    category: "Queue Operations",
    groupKey: "domain-email-queue-review",
    moduleKey: "op-domain-email-queue",
    moduleName: "Domain and email queue runtime",
    registryKey: "op-domain-email-queue",
    reviewKey: "op-review-domain-email-queue"
  },
  {
    category: "Monitoring",
    groupKey: "monitoring-review",
    moduleKey: "op-monitoring-events",
    moduleName: "Monitoring events runtime",
    registryKey: "op-monitoring-events",
    reviewKey: "op-review-monitoring-events"
  },
  {
    category: "Backup & Recovery",
    groupKey: "backup-review",
    moduleKey: "op-backup",
    moduleName: "Backup runtime",
    registryKey: "op-backup",
    reviewKey: "op-review-backup"
  },
  {
    category: "Backup & Recovery",
    groupKey: "disaster-recovery-review",
    moduleKey: "op-disaster-recovery",
    moduleName: "Disaster recovery runtime",
    registryKey: "op-disaster-recovery",
    reviewKey: "op-review-disaster-recovery"
  },
  {
    category: "Operations Controls",
    groupKey: "diagnostics-review",
    moduleKey: "op-diagnostics",
    moduleName: "Diagnostics runtime",
    registryKey: "op-diagnostics",
    reviewKey: "op-review-diagnostics"
  },
  {
    category: "Operations Controls",
    groupKey: "safe-controls-review",
    moduleKey: "op-safe-controls",
    moduleName: "Safe controls runtime",
    registryKey: "op-safe-controls",
    reviewKey: "op-review-safe-controls"
  },
  {
    category: "Operations Platform",
    groupKey: "status-review",
    moduleKey: "operations_status_runtime",
    moduleName: "Operations status runtime",
    registryKey: null,
    reviewKey: "op-review-status-runtime"
  },
  {
    category: "Operations Platform",
    groupKey: "visibility-review",
    moduleKey: "operations_visibility_runtime",
    moduleName: "Operations visibility runtime",
    registryKey: null,
    reviewKey: "op-review-visibility-runtime"
  },
  {
    category: "Operations Platform",
    groupKey: "audit-review",
    moduleKey: "operations_audit_runtime",
    moduleName: "Operations audit runtime",
    registryKey: null,
    reviewKey: "op-review-audit-runtime"
  }
] as const;

function buildSafeControls() {
  return OPERATIONS_REVIEW_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function indexByModuleKey<T extends { moduleKey: string }>(items: T[]) {
  return new Map(items.map((item) => [item.moduleKey, item]));
}

function formatVisibilityLabel(visibility: OperationsRegistryVisibility | string) {
  switch (visibility) {
    case "hidden":
      return "Hidden";
    case "internal":
      return "Internal";
    case "super_admin":
      return "Super Admin Only";
    case "visible":
      return "Visible";
    case "disabled":
      return "Disabled";
    case "future_hook":
      return "Future Hook";
    case "review_required":
      return "Review Required";
    case "super_admin_only":
      return "Super Admin Only";
    default:
      return String(visibility);
  }
}

function formatAuditStatusLabel(auditItem: OperationsAuditRuntimeItem | undefined, statusAuditStatus: string | undefined) {
  if (auditItem) {
    return auditItem.runtimeStatus.replace(/_/g, " ");
  }

  return statusAuditStatus ?? "not_supported";
}

function countBlockers(input: {
  auditItem: OperationsAuditRuntimeItem | undefined;
  statusItem: OperationsStatusRuntimeItem | undefined;
  visibilityItem: OperationsVisibilityRuntimeItem | undefined;
}) {
  let blockerCount = 0;

  if (input.statusItem?.runtimeStatus === "failed") {
    blockerCount += 1;
  }

  if (input.auditItem?.runtimeStatus === "critical") {
    blockerCount += 1;
  }

  if (input.visibilityItem?.visibility === "hidden" && input.visibilityItem.reviewStatus === "review_required") {
    blockerCount += 1;
  }

  if (input.statusItem?.certificationStatus === "not_certified" && input.statusItem.runtimeStatus === "failed") {
    blockerCount += 1;
  }

  return blockerCount;
}

function countWarnings(input: {
  auditItem: OperationsAuditRuntimeItem | undefined;
  statusItem: OperationsStatusRuntimeItem | undefined;
  visibilityItem: OperationsVisibilityRuntimeItem | undefined;
}) {
  let warningCount = 0;

  if (input.statusItem?.runtimeStatus === "warning") {
    warningCount += 1;
  }

  if (input.statusItem?.healthStatus === "warning") {
    warningCount += 1;
  }

  if (input.statusItem?.monitoringStatus === "warning") {
    warningCount += 1;
  }

  if (input.visibilityItem?.visibility === "review_required") {
    warningCount += 1;
  }

  if (input.auditItem?.runtimeStatus === "warning") {
    warningCount += 1;
  }

  if (input.auditItem?.severity === "warning") {
    warningCount += 1;
  }

  return warningCount;
}

function resolveCertificationCandidate(input: {
  auditItem: OperationsAuditRuntimeItem | undefined;
  registryKey: string | null;
  reviewStatus: OperationsReviewState;
  statusItem: OperationsStatusRuntimeItem | undefined;
  visibilityItem: OperationsVisibilityRuntimeItem | undefined;
}) {
  if (input.reviewStatus === "future_hook" || input.reviewStatus === "disabled" || input.reviewStatus === "blocked") {
    return false;
  }

  const registryEntry = input.registryKey ? getOperationsRegistryEntry(input.registryKey) : null;
  const runtimeReady =
    input.statusItem?.runtimeStatus === "runtime_ready" ||
    input.statusItem?.runtimeStatus === "production_ready" ||
    input.statusItem?.runtimeStatus === "healthy";
  const visibilityClear =
    !input.visibilityItem ||
    ["visible", "super_admin_only"].includes(String(input.visibilityItem.visibility));
  const auditClear =
    !input.auditItem ||
    ["available", "registered", "empty"].includes(input.auditItem.runtimeStatus);

  return Boolean(
    registryEntry?.productionReady ||
      input.statusItem?.certificationStatus === "certified" ||
      (runtimeReady && visibilityClear && auditClear && input.reviewStatus !== "review_required")
  );
}

function resolveReviewState(input: {
  auditItem: OperationsAuditRuntimeItem | undefined;
  blockerCount: number;
  statusItem: OperationsStatusRuntimeItem | undefined;
  visibilityItem: OperationsVisibilityRuntimeItem | undefined;
  warningCount: number;
}): OperationsReviewState {
  if (
    input.statusItem?.runtimeStatus === "future_hook" ||
    input.visibilityItem?.visibility === "future_hook" ||
    input.auditItem?.runtimeStatus === "future_hook"
  ) {
    return "future_hook";
  }

  if (
    input.statusItem?.runtimeStatus === "disabled" ||
    input.visibilityItem?.visibility === "disabled" ||
    input.auditItem?.runtimeStatus === "disabled"
  ) {
    return "disabled";
  }

  if (input.blockerCount > 0 || input.statusItem?.runtimeStatus === "failed" || input.auditItem?.runtimeStatus === "critical") {
    return "blocked";
  }

  if (
    input.statusItem?.reviewStatus === "review_required" ||
    input.statusItem?.runtimeStatus === "review_required" ||
    input.visibilityItem?.reviewStatus === "review_required" ||
    input.visibilityItem?.visibility === "review_required" ||
    input.auditItem?.reviewStatus === "review_required" ||
    input.auditItem?.runtimeStatus === "review_required"
  ) {
    return "review_required";
  }

  if (input.warningCount > 0 || input.statusItem?.runtimeStatus === "warning") {
    return "warning";
  }

  const certificationCandidate = resolveCertificationCandidate({
    auditItem: input.auditItem,
    registryKey: null,
    reviewStatus: "reviewed",
    statusItem: input.statusItem,
    visibilityItem: input.visibilityItem
  });

  if (
    certificationCandidate &&
    (input.statusItem?.runtimeStatus === "production_ready" ||
      input.statusItem?.runtimeStatus === "runtime_ready" ||
      input.statusItem?.certificationStatus === "certified")
  ) {
    return "production_ready_candidate";
  }

  if (
    input.statusItem?.reviewStatus === "clear" &&
    (!input.visibilityItem || input.visibilityItem.reviewStatus === "clear") &&
    (!input.auditItem || input.auditItem.reviewStatus === "clear")
  ) {
    return "reviewed";
  }

  return "review_required";
}

function buildSafeSummary(input: {
  auditItem: OperationsAuditRuntimeItem | undefined;
  blockerCount: number;
  reviewStatus: OperationsReviewState;
  statusItem: OperationsStatusRuntimeItem | undefined;
  visibilityItem: OperationsVisibilityRuntimeItem | undefined;
  warningCount: number;
}) {
  if (input.reviewStatus === "future_hook") {
    return "Future review hook placeholder derived from operations registry metadata only";
  }

  const parts = [
    `review ${input.reviewStatus.replace(/_/g, " ")}`,
    `${input.blockerCount} blocker${input.blockerCount === 1 ? "" : "s"}`,
    `${input.warningCount} warning${input.warningCount === 1 ? "" : "s"}`
  ];

  if (input.statusItem?.safeSummary) {
    parts.push(`status ${input.statusItem.safeSummary}`);
  }

  if (input.visibilityItem?.safeSummary) {
    parts.push(`visibility ${input.visibilityItem.safeSummary}`);
  }

  if (input.auditItem?.safeSummary) {
    parts.push(`audit ${input.auditItem.safeSummary}`);
  }

  return parts.join("; ").slice(0, 500);
}

function buildAggregateReviewItem(input: {
  auditRuntime: OperationsAuditRuntimeSummary;
  binding: ReviewModuleBinding;
  statusRuntime: OperationsStatusRuntimeSummary;
  visibilityRuntime: OperationsVisibilityRuntimeSummary;
}): OperationsReviewRuntimeItem {
  const blockerCount =
    input.statusRuntime.failedModules +
    input.auditRuntime.criticalItems +
    (input.visibilityRuntime.overallStatus === "needs_attention" ? 1 : 0);
  const warningCount =
    input.statusRuntime.warningModules + input.auditRuntime.warningItems + input.visibilityRuntime.reviewRequiredModules;
  let reviewStatus: OperationsReviewState = "reviewed";

  if (input.binding.moduleKey === "operations_status_runtime") {
    reviewStatus =
      input.statusRuntime.failedModules > 0
        ? "blocked"
        : input.statusRuntime.reviewRequiredModules > 0
          ? "review_required"
          : input.statusRuntime.warningModules > 0
            ? "warning"
            : input.statusRuntime.productionReadyModules > 0
              ? "production_ready_candidate"
              : "reviewed";
  } else if (input.binding.moduleKey === "operations_visibility_runtime") {
    reviewStatus =
      input.visibilityRuntime.overallStatus === "needs_attention"
        ? "review_required"
        : input.visibilityRuntime.disabledModules > 0
          ? "disabled"
          : "reviewed";
  } else if (input.binding.moduleKey === "operations_audit_runtime") {
    reviewStatus =
      input.auditRuntime.criticalItems > 0
        ? "blocked"
        : input.auditRuntime.reviewRequiredItems > 0
          ? "review_required"
          : input.auditRuntime.warningItems > 0
            ? "warning"
            : input.auditRuntime.availableItems > 0
              ? "reviewed"
              : "review_required";
  }

  return {
    auditStatus: input.binding.moduleKey === "operations_audit_runtime" ? input.auditRuntime.overallStatus : "aggregate",
    blockerCount,
    category: input.binding.category,
    certificationCandidate: reviewStatus === "production_ready_candidate",
    groupKey: input.binding.groupKey,
    healthStatus: input.statusRuntime.failedModules > 0 ? "failed" : input.statusRuntime.warningModules > 0 ? "warning" : "healthy",
    moduleKey: input.binding.moduleKey,
    moduleName: input.binding.moduleName,
    reviewKey: input.binding.reviewKey,
    reviewStatus,
    runtimeStatus:
      input.binding.moduleKey === "operations_status_runtime"
        ? input.statusRuntime.overallStatus
        : input.binding.moduleKey === "operations_visibility_runtime"
          ? input.visibilityRuntime.overallStatus
          : input.auditRuntime.overallStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `aggregate review ${reviewStatus.replace(/_/g, " ")}`,
      input.binding.moduleKey === "operations_status_runtime" ? input.statusRuntime.summary : null,
      input.binding.moduleKey === "operations_visibility_runtime" ? input.visibilityRuntime.summary : null,
      input.binding.moduleKey === "operations_audit_runtime" ? input.auditRuntime.summary : null
    ]
      .filter(Boolean)
      .join("; ")
      .slice(0, 500),
    visibility:
      input.binding.moduleKey === "operations_visibility_runtime"
        ? input.visibilityRuntime.overallStatus
        : "super_admin",
    warningCount
  };
}

function buildReviewModuleItem(input: {
  auditByModuleKey: Map<string, OperationsAuditRuntimeItem>;
  binding: ReviewModuleBinding;
  statusByModuleKey: Map<string, OperationsStatusRuntimeItem>;
  visibilityByModuleKey: Map<string, OperationsVisibilityRuntimeItem>;
}): OperationsReviewRuntimeItem {
  const statusItem = input.statusByModuleKey.get(input.binding.moduleKey);
  const visibilityItem = input.visibilityByModuleKey.get(input.binding.moduleKey);
  const auditItem = input.auditByModuleKey.get(input.binding.moduleKey);
  const blockerCount = countBlockers({ auditItem, statusItem, visibilityItem });
  const warningCount = countWarnings({ auditItem, statusItem, visibilityItem });
  const reviewStatus = resolveReviewState({
    auditItem,
    blockerCount,
    statusItem,
    visibilityItem,
    warningCount
  });

  return {
    auditStatus: formatAuditStatusLabel(auditItem, statusItem?.auditStatus),
    blockerCount,
    category: input.binding.category,
    certificationCandidate: resolveCertificationCandidate({
      auditItem,
      registryKey: input.binding.registryKey,
      reviewStatus,
      statusItem,
      visibilityItem
    }),
    groupKey: input.binding.groupKey,
    healthStatus: statusItem?.healthStatus ?? "unknown",
    moduleKey: input.binding.moduleKey,
    moduleName: input.binding.moduleName,
    reviewKey: input.binding.reviewKey,
    reviewStatus,
    runtimeStatus: statusItem?.runtimeStatus ?? "registered",
    safeControls: buildSafeControls(),
    safeSummary: buildSafeSummary({
      auditItem,
      blockerCount,
      reviewStatus,
      statusItem,
      visibilityItem,
      warningCount
    }),
    visibility: formatVisibilityLabel(visibilityItem?.visibility ?? statusItem?.visibility ?? "super_admin"),
    warningCount
  };
}

function buildFutureReviewHookItems(futureHooks: readonly string[]): OperationsReviewRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");

  return futureHooks
    .filter((hook) => /review|approval|certification|governance|sign.?off|audit/i.test(hook))
    .map((hook, index) => ({
      auditStatus: "future_hook",
      blockerCount: 0,
      category: "Operations Platform",
      certificationCandidate: false,
      groupKey: "future-review-hooks" as const,
      healthStatus: "unknown" as const,
      moduleKey: `op-future-review-hook-${index + 1}`,
      moduleName: hook.slice(0, 120),
      reviewKey: `op-review-future-hook-${index + 1}`,
      reviewStatus: "future_hook" as const,
      runtimeStatus: "future_hook",
      safeControls: buildSafeControls(),
      safeSummary: "Future review hook placeholder derived from operations registry metadata only",
      visibility: formatVisibilityLabel(registryEntry?.visibility ?? "super_admin"),
      warningCount: 0
    }));
}

export function operationsReviewStateLabel(state: OperationsReviewState) {
  switch (state) {
    case "blocked":
      return "Blocked";
    case "disabled":
      return "Disabled";
    case "future_hook":
      return "Future Hook";
    case "production_ready_candidate":
      return "Production Ready Candidate";
    case "review_required":
      return "Review Required";
    case "reviewed":
      return "Reviewed";
    case "warning":
      return "Warning";
  }
}

export function operationsReviewStateBadgeTone(state: OperationsReviewState) {
  switch (state) {
    case "reviewed":
    case "production_ready_candidate":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
    case "disabled":
      return "slate" as const;
    case "future_hook":
      return "blue" as const;
  }
}

export function buildOperationsReviewRuntimeGroups(items: OperationsReviewRuntimeItem[]): OperationsReviewRuntimeGroup[] {
  return REVIEW_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsReviewRuntimeSummary(items: OperationsReviewRuntimeItem[]): OperationsReviewRuntimeSummary {
  const operationalItems = items.filter((item) => item.groupKey !== "future-review-hooks");
  const reviewedModules = operationalItems.filter((item) => item.reviewStatus === "reviewed").length;
  const reviewRequiredModules = operationalItems.filter((item) => item.reviewStatus === "review_required").length;
  const blockedModules = operationalItems.filter((item) => item.reviewStatus === "blocked").length;
  const warningModules = operationalItems.filter((item) => item.reviewStatus === "warning").length;
  const productionReadyCandidates = operationalItems.filter((item) => item.reviewStatus === "production_ready_candidate").length;
  const futureHooks = items.filter((item) => item.reviewStatus === "future_hook").length;
  const disabledModules = operationalItems.filter((item) => item.reviewStatus === "disabled").length;
  const overallStatus =
    blockedModules > 0 || reviewRequiredModules > 0 || warningModules > 0
      ? ("needs_attention" as const)
      : ("operations_review_runtime_ready" as const);

  return {
    blockedModules,
    disabledModules,
    futureHooks,
    groupCount: buildOperationsReviewRuntimeGroups(items).length,
    overallStatus,
    productionReadyCandidates,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    reviewRequiredModules,
    reviewedModules,
    source: OPERATIONS_REVIEW_RUNTIME_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} modules`,
      `${reviewedModules} reviewed`,
      `${reviewRequiredModules} review required`,
      `${blockedModules} blocked`,
      `${productionReadyCandidates} production ready candidates`
    ].join("; "),
    totalModules: items.length,
    warningModules
  };
}

export function buildOperationsReviewRuntimeReadOnlySafe(input: OperationsReviewRuntimeInput) {
  const statusByModuleKey = indexByModuleKey(input.statusItems);
  const visibilityByModuleKey = indexByModuleKey(input.visibilityItems);
  const auditByModuleKey = indexByModuleKey(input.auditItems);
  const reviewItems = [
    ...REVIEW_MODULE_BINDINGS.map((binding) => {
      if (
        binding.moduleKey === "operations_status_runtime" ||
        binding.moduleKey === "operations_visibility_runtime" ||
        binding.moduleKey === "operations_audit_runtime"
      ) {
        return buildAggregateReviewItem({
          auditRuntime: input.auditRuntime,
          binding,
          statusRuntime: input.statusRuntime,
          visibilityRuntime: input.visibilityRuntime
        });
      }

      return buildReviewModuleItem({
        auditByModuleKey,
        binding,
        statusByModuleKey,
        visibilityByModuleKey
      });
    }),
    ...buildFutureReviewHookItems(input.futureHooks)
  ];
  const groups = buildOperationsReviewRuntimeGroups(reviewItems);
  const summary = getOperationsReviewRuntimeSummary(reviewItems);

  return {
    groups,
    reviewItems,
    reviewRuntime: summary,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsReviewRuntimeToAdminFields(
  input: ReturnType<typeof buildOperationsReviewRuntimeReadOnlySafe>
) {
  return {
    groups: input.groups,
    reviewItems: input.reviewItems,
    reviewRuntime: input.reviewRuntime,
    safeControls: input.safeControls
  };
}
