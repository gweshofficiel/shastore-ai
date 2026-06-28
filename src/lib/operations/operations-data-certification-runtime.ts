import "server-only";

import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type { OperationsAuditRuntimeItem, OperationsAuditRuntimeSummary } from "@/src/lib/operations/operations-audit-runtime";
import { OPERATIONS_REGISTRY_SOURCE } from "@/src/lib/operations/operations-registry-runtime";
import type { OperationsReviewRuntimeItem, OperationsReviewRuntimeSummary } from "@/src/lib/operations/operations-review-runtime";
import type { OperationsStatusRuntimeItem, OperationsStatusRuntimeSummary } from "@/src/lib/operations/operations-status-runtime";
import type { OperationsVisibilityRuntimeItem, OperationsVisibilityRuntimeSummary } from "@/src/lib/operations/operations-visibility-runtime";

export type OperationsDataCertificationSource = "operations_data_certification_runtime";

export type OperationsDataCertificationGroupKey =
  | "ai-queue-data-certification"
  | "audit-data-certification"
  | "backup-data-certification"
  | "cron-data-certification"
  | "dashboard-data-certification"
  | "database-data-certification"
  | "diagnostics-data-certification"
  | "disaster-recovery-data-certification"
  | "domain-email-queue-data-certification"
  | "email-queue-data-certification"
  | "monitoring-data-certification"
  | "queue-data-certification"
  | "registry-data-certification"
  | "review-data-certification"
  | "safe-controls-data-certification"
  | "status-data-certification"
  | "storage-data-certification"
  | "visibility-data-certification"
  | "worker-data-certification";

export type OperationsDataCertificationIntegrityStatus = "blocked" | "certified" | "review_required" | "warning";

export type OperationsDataCertificationPlaceholderStatus = "certified" | "labeled_placeholders" | "review_required";

export type OperationsDataCertificationSafetyStatus = "read_only_certified" | "review_required";

export type OperationsDataCertificationSecretStatus = "review_required" | "safe";

export type OperationsDataCertificationExecutionStatus = "no_execution_certified" | "review_required";

export type OperationsDataCertificationSafeControlKey =
  | "approve_certification"
  | "export_certification"
  | "mark_certified"
  | "recheck_data"
  | "resolve_blocker";

export type OperationsDataCertificationSafeControl = {
  enabled: false;
  key: OperationsDataCertificationSafeControlKey;
  label: string;
  note: string;
};

export type OperationsDataCertificationItem = {
  blockedModules: number;
  certificationKey: string;
  certificationName: string;
  certificationScope: string;
  certifiedModules: number;
  dataIntegrityStatus: OperationsDataCertificationIntegrityStatus;
  executionSafetyStatus: OperationsDataCertificationExecutionStatus;
  groupKey: OperationsDataCertificationGroupKey;
  mutationSafetyStatus: OperationsDataCertificationSafetyStatus;
  placeholderStatus: OperationsDataCertificationPlaceholderStatus;
  reviewRequiredModules: number;
  safeControls: OperationsDataCertificationSafeControl[];
  safeSummary: string;
  secretSafetyStatus: OperationsDataCertificationSecretStatus;
  warningModules: number;
};

export type OperationsDataCertificationGroup = {
  groupKey: OperationsDataCertificationGroupKey;
  itemCount: number;
  items: OperationsDataCertificationItem[];
  title: string;
};

export type OperationsDataCertificationSummary = {
  blockedScopes: number;
  certifiedScopes: number;
  groupCount: number;
  overallStatus: "needs_attention" | "operations_data_certification_ready";
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  reviewRequiredScopes: number;
  source: OperationsDataCertificationSource;
  summary: string;
  totalCertifications: number;
  warningScopes: number;
};

type RuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  status?: string;
  summary?: string;
};

export type OperationsDataCertificationInput = {
  auditItems: OperationsAuditRuntimeItem[];
  auditRuntime: OperationsAuditRuntimeSummary;
  backupRuntime: RuntimeSnapshot;
  cronMonitoringRuntime: RuntimeSnapshot;
  cronRuntime: RuntimeSnapshot;
  dashboardRuntime: RuntimeSnapshot;
  databaseRuntime: RuntimeSnapshot;
  diagnosticsRuntime: RuntimeSnapshot;
  disasterRecoveryRuntime: RuntimeSnapshot;
  domainEmailQueueRuntime: RuntimeSnapshot;
  emailQueueRuntime: RuntimeSnapshot;
  aiQueueRuntime: RuntimeSnapshot;
  monitoringEventsRuntime: RuntimeSnapshot;
  queueRuntime: RuntimeSnapshot;
  registryRuntime: RuntimeSnapshot;
  reviewItems: OperationsReviewRuntimeItem[];
  reviewRuntime: OperationsReviewRuntimeSummary;
  safeControlsRuntime: RuntimeSnapshot;
  statusItems: OperationsStatusRuntimeItem[];
  statusRuntime: OperationsStatusRuntimeSummary;
  storageMetricsRuntime: RuntimeSnapshot;
  storageRuntime: RuntimeSnapshot;
  visibilityItems: OperationsVisibilityRuntimeItem[];
  visibilityRuntime: OperationsVisibilityRuntimeSummary;
  workerMonitoringRuntime: RuntimeSnapshot;
  workerRuntime: RuntimeSnapshot;
};

type CertificationScopeDefinition = {
  certificationKey: string;
  certificationName: string;
  certificationScope: string;
  expectedSources: readonly string[];
  groupKey: OperationsDataCertificationGroupKey;
  moduleKeys: readonly string[];
  resolveRuntimeSnapshots: (input: OperationsDataCertificationInput) => RuntimeSnapshot[];
};

export const OPERATIONS_DATA_CERTIFICATION_SOURCE = "operations_data_certification_runtime" as const;

export const OPERATIONS_DATA_CERTIFICATION_SAFE_CONTROLS: readonly OperationsDataCertificationSafeControl[] = [
  {
    enabled: false,
    key: "approve_certification",
    label: "Approve Certification",
    note: "Read-only placeholder. No certification approval or mutation runs during OP-23 page load."
  },
  {
    enabled: false,
    key: "recheck_data",
    label: "Recheck Data",
    note: "Read-only placeholder. No recheck execution, provider call, or data mutation runs during OP-23 page load."
  },
  {
    enabled: false,
    key: "export_certification",
    label: "Export Certification",
    note: "Read-only placeholder. No certification export or provider call runs during OP-23 page load."
  },
  {
    enabled: false,
    key: "resolve_blocker",
    label: "Resolve Blocker",
    note: "Read-only placeholder. No blocker resolve action runs during OP-23 page load."
  },
  {
    enabled: false,
    key: "mark_certified",
    label: "Mark Certified",
    note: "Read-only placeholder. No certification record write or registry mutation runs during OP-23 page load."
  }
] as const;

const CERTIFICATION_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsDataCertificationGroupKey;
  title: string;
}> = [
  { groupKey: "registry-data-certification", title: "Registry Data Certification" },
  { groupKey: "dashboard-data-certification", title: "Dashboard Data Certification" },
  { groupKey: "queue-data-certification", title: "Queue Data Certification" },
  { groupKey: "worker-data-certification", title: "Worker Data Certification" },
  { groupKey: "cron-data-certification", title: "Cron Data Certification" },
  { groupKey: "storage-data-certification", title: "Storage Data Certification" },
  { groupKey: "database-data-certification", title: "Database Data Certification" },
  { groupKey: "email-queue-data-certification", title: "Email Queue Data Certification" },
  { groupKey: "ai-queue-data-certification", title: "AI Queue Data Certification" },
  { groupKey: "domain-email-queue-data-certification", title: "Domain & Email Queue Data Certification" },
  { groupKey: "monitoring-data-certification", title: "Monitoring Data Certification" },
  { groupKey: "backup-data-certification", title: "Backup Data Certification" },
  { groupKey: "disaster-recovery-data-certification", title: "Disaster Recovery Data Certification" },
  { groupKey: "diagnostics-data-certification", title: "Diagnostics Data Certification" },
  { groupKey: "safe-controls-data-certification", title: "Safe Controls Data Certification" },
  { groupKey: "status-data-certification", title: "Status Data Certification" },
  { groupKey: "visibility-data-certification", title: "Visibility Data Certification" },
  { groupKey: "audit-data-certification", title: "Audit Data Certification" },
  { groupKey: "review-data-certification", title: "Review Data Certification" }
];

const CERTIFICATION_SCOPE_DEFINITIONS: readonly CertificationScopeDefinition[] = [
  {
    certificationKey: "op-cert-registry-data",
    certificationName: "Registry Data Certification",
    certificationScope: "OP-1 Operations Registry read-only runtime metadata",
    expectedSources: ["operations_registry_runtime"],
    groupKey: "registry-data-certification",
    moduleKeys: ["operations_registry_runtime"],
    resolveRuntimeSnapshots: (input) => [input.registryRuntime]
  },
  {
    certificationKey: "op-cert-dashboard-data",
    certificationName: "Dashboard Data Certification",
    certificationScope: "OP-2 Operations Dashboard read-only runtime metadata",
    expectedSources: ["operations_dashboard_runtime"],
    groupKey: "dashboard-data-certification",
    moduleKeys: ["operations_dashboard_runtime"],
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime]
  },
  {
    certificationKey: "op-cert-queue-data",
    certificationName: "Queue Data Certification",
    certificationScope: "OP-3 Operations Queue read-only runtime metadata",
    expectedSources: ["operations_queue_runtime"],
    groupKey: "queue-data-certification",
    moduleKeys: ["op-queue-tables"],
    resolveRuntimeSnapshots: (input) => [input.queueRuntime]
  },
  {
    certificationKey: "op-cert-worker-data",
    certificationName: "Worker Data Certification",
    certificationScope: "OP-4 and OP-12 Worker read-only runtime metadata",
    expectedSources: ["operations_worker_runtime", "operations_worker_monitoring_runtime"],
    groupKey: "worker-data-certification",
    moduleKeys: ["op-worker-tables", "op-worker-health"],
    resolveRuntimeSnapshots: (input) => [input.workerRuntime, input.workerMonitoringRuntime]
  },
  {
    certificationKey: "op-cert-cron-data",
    certificationName: "Cron Data Certification",
    certificationScope: "OP-5 and OP-13 Cron read-only runtime metadata",
    expectedSources: ["operations_cron_runtime", "operations_cron_monitoring_runtime"],
    groupKey: "cron-data-certification",
    moduleKeys: ["op-cron-jobs", "op-cron-health"],
    resolveRuntimeSnapshots: (input) => [input.cronRuntime, input.cronMonitoringRuntime]
  },
  {
    certificationKey: "op-cert-storage-data",
    certificationName: "Storage Data Certification",
    certificationScope: "OP-5 and OP-14 Storage read-only runtime metadata",
    expectedSources: ["operations_storage_runtime", "operations_storage_metrics_runtime"],
    groupKey: "storage-data-certification",
    moduleKeys: ["op-storage-health", "op-storage-metrics"],
    resolveRuntimeSnapshots: (input) => [input.storageRuntime, input.storageMetricsRuntime]
  },
  {
    certificationKey: "op-cert-database-data",
    certificationName: "Database Data Certification",
    certificationScope: "OP-6 Operations Database read-only runtime metadata",
    expectedSources: ["operations_database_runtime"],
    groupKey: "database-data-certification",
    moduleKeys: ["op-database-health"],
    resolveRuntimeSnapshots: (input) => [input.databaseRuntime]
  },
  {
    certificationKey: "op-cert-email-queue-data",
    certificationName: "Email Queue Data Certification",
    certificationScope: "OP-7 Operations Email Queue read-only runtime metadata",
    expectedSources: ["operations_email_queue_runtime"],
    groupKey: "email-queue-data-certification",
    moduleKeys: ["op-email-queue"],
    resolveRuntimeSnapshots: (input) => [input.emailQueueRuntime]
  },
  {
    certificationKey: "op-cert-ai-queue-data",
    certificationName: "AI Queue Data Certification",
    certificationScope: "OP-8 Operations AI Queue read-only runtime metadata",
    expectedSources: ["operations_ai_queue_runtime"],
    groupKey: "ai-queue-data-certification",
    moduleKeys: ["op-ai-queue"],
    resolveRuntimeSnapshots: (input) => [input.aiQueueRuntime]
  },
  {
    certificationKey: "op-cert-domain-email-queue-data",
    certificationName: "Domain & Email Queue Data Certification",
    certificationScope: "OP-9 Operations Domain and Email Queue read-only runtime metadata",
    expectedSources: ["operations_domain_email_queue_runtime"],
    groupKey: "domain-email-queue-data-certification",
    moduleKeys: ["op-domain-email-queue"],
    resolveRuntimeSnapshots: (input) => [input.domainEmailQueueRuntime]
  },
  {
    certificationKey: "op-cert-monitoring-data",
    certificationName: "Monitoring Data Certification",
    certificationScope: "OP-11 Operations Monitoring Events read-only runtime metadata",
    expectedSources: ["operations_monitoring_events_runtime"],
    groupKey: "monitoring-data-certification",
    moduleKeys: ["op-monitoring-events"],
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime]
  },
  {
    certificationKey: "op-cert-backup-data",
    certificationName: "Backup Data Certification",
    certificationScope: "OP-15 Operations Backup read-only runtime metadata",
    expectedSources: ["operations_backup_runtime"],
    groupKey: "backup-data-certification",
    moduleKeys: ["op-backup"],
    resolveRuntimeSnapshots: (input) => [input.backupRuntime]
  },
  {
    certificationKey: "op-cert-disaster-recovery-data",
    certificationName: "Disaster Recovery Data Certification",
    certificationScope: "OP-16 Operations Disaster Recovery read-only runtime metadata",
    expectedSources: ["operations_disaster_recovery_runtime"],
    groupKey: "disaster-recovery-data-certification",
    moduleKeys: ["op-disaster-recovery"],
    resolveRuntimeSnapshots: (input) => [input.disasterRecoveryRuntime]
  },
  {
    certificationKey: "op-cert-diagnostics-data",
    certificationName: "Diagnostics Data Certification",
    certificationScope: "OP-17 Operations Diagnostics read-only runtime metadata",
    expectedSources: ["operations_diagnostics_runtime"],
    groupKey: "diagnostics-data-certification",
    moduleKeys: ["op-diagnostics"],
    resolveRuntimeSnapshots: (input) => [input.diagnosticsRuntime]
  },
  {
    certificationKey: "op-cert-safe-controls-data",
    certificationName: "Safe Controls Data Certification",
    certificationScope: "OP-18 Operations Safe Controls read-only runtime metadata",
    expectedSources: ["operations_safe_controls_runtime"],
    groupKey: "safe-controls-data-certification",
    moduleKeys: ["op-safe-controls"],
    resolveRuntimeSnapshots: (input) => [input.safeControlsRuntime]
  },
  {
    certificationKey: "op-cert-status-data",
    certificationName: "Status Data Certification",
    certificationScope: "OP-19 Operations Status read-only runtime metadata",
    expectedSources: ["operations_status_runtime"],
    groupKey: "status-data-certification",
    moduleKeys: ["operations_status_runtime"],
    resolveRuntimeSnapshots: (input) => [input.statusRuntime]
  },
  {
    certificationKey: "op-cert-visibility-data",
    certificationName: "Visibility Data Certification",
    certificationScope: "OP-20 Operations Visibility read-only runtime metadata",
    expectedSources: ["operations_visibility_runtime"],
    groupKey: "visibility-data-certification",
    moduleKeys: ["operations_visibility_runtime"],
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime]
  },
  {
    certificationKey: "op-cert-audit-data",
    certificationName: "Audit Data Certification",
    certificationScope: "OP-21 Operations Audit read-only runtime metadata",
    expectedSources: ["operations_audit_runtime"],
    groupKey: "audit-data-certification",
    moduleKeys: ["operations_audit_runtime"],
    resolveRuntimeSnapshots: (input) => [input.auditRuntime]
  },
  {
    certificationKey: "op-cert-review-data",
    certificationName: "Review Data Certification",
    certificationScope: "OP-22 Operations Review read-only runtime metadata",
    expectedSources: ["operations_review_runtime"],
    groupKey: "review-data-certification",
    moduleKeys: ["operations_review_runtime"],
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime]
  }
] as const;

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|authorization|bearer|sb_secret|smtp|webhook|@[a-z0-9.-]+\.[a-z]{2,}|\b\d{10,}\b)/i;

function buildSafeControls() {
  return OPERATIONS_DATA_CERTIFICATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function sanitizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return maskSensitiveText(value).slice(0, maxLength);
}

function collectReviewCounts(input: OperationsDataCertificationInput, moduleKeys: readonly string[]) {
  const reviewItems = input.reviewItems.filter((item) => moduleKeys.includes(item.moduleKey));

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
    certifiedModules: reviewItems.filter(
      (item) => item.reviewStatus === "reviewed" || item.reviewStatus === "production_ready_candidate"
    ).length,
    reviewRequiredModules: reviewItems.filter((item) => item.reviewStatus === "review_required").length,
    warningModules: reviewItems.filter((item) => item.reviewStatus === "warning").length
  };
}

function validateRuntimeShape(snapshot: RuntimeSnapshot, expectedSources: readonly string[]) {
  const issues: string[] = [];

  if (snapshot.readOnly !== true) {
    issues.push("readOnly flag missing or false");
  }

  if (!snapshot.source || !expectedSources.includes(snapshot.source)) {
    issues.push("unexpected or missing runtime source");
  }

  if (typeof snapshot.summary !== "string" || !snapshot.summary.trim()) {
    issues.push("summary metadata missing");
  }

  return issues;
}

function validateSecretSafety(values: string[]) {
  return values.every((value) => !secretPattern.test(value));
}

function validatePlaceholderSafety(values: string[]) {
  const combined = values.join(" ").toLowerCase();

  if (!combined.includes("placeholder")) {
    return "certified" as const;
  }

  if (
    combined.includes("read-only placeholder") ||
    combined.includes("labeled placeholder") ||
    combined.includes("legacy placeholder") ||
    combined.includes("future hook placeholder") ||
    combined.includes("placeholder derived")
  ) {
    return "labeled_placeholders" as const;
  }

  return "review_required" as const;
}

function resolveIntegrityStatus(input: {
  blockedModules: number;
  reviewRequiredModules: number;
  runtimeIssues: string[];
  warningModules: number;
}): OperationsDataCertificationIntegrityStatus {
  if (input.runtimeIssues.length > 0 || input.blockedModules > 0) {
    return input.blockedModules > 0 ? "blocked" : "review_required";
  }

  if (input.reviewRequiredModules > 0) {
    return "review_required";
  }

  if (input.warningModules > 0) {
    return "warning";
  }

  return "certified";
}

function buildCertificationItem(
  definition: CertificationScopeDefinition,
  input: OperationsDataCertificationInput
): OperationsDataCertificationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeIssues = snapshots.flatMap((snapshot) => validateRuntimeShape(snapshot, definition.expectedSources));
  const reviewCounts = collectReviewCounts(input, definition.moduleKeys);
  const textValues = [
    ...snapshots.map((snapshot) => sanitizeText(snapshot.summary)),
    ...input.statusItems
      .filter((item) => definition.moduleKeys.includes(item.moduleKey))
      .map((item) => sanitizeText(item.safeSummary)),
    ...input.visibilityItems
      .filter((item) => definition.moduleKeys.includes(item.moduleKey))
      .map((item) => sanitizeText(item.safeSummary)),
    ...input.auditItems
      .filter((item) => definition.moduleKeys.includes(item.moduleKey))
      .map((item) => sanitizeText(item.safeSummary))
  ];
  const secretSafetyStatus: OperationsDataCertificationSecretStatus = validateSecretSafety(textValues)
    ? "safe"
    : "review_required";
  const placeholderStatus = validatePlaceholderSafety(textValues);
  const mutationSafetyStatus: OperationsDataCertificationSafetyStatus =
    snapshots.every((snapshot) => snapshot.readOnly === true) && runtimeIssues.length === 0
      ? "read_only_certified"
      : "review_required";
  const executionSafetyStatus: OperationsDataCertificationExecutionStatus =
    mutationSafetyStatus === "read_only_certified" ? "no_execution_certified" : "review_required";
  const dataIntegrityStatus = resolveIntegrityStatus({
    blockedModules: reviewCounts.blockedModules,
    reviewRequiredModules: reviewCounts.reviewRequiredModules,
    runtimeIssues,
    warningModules: reviewCounts.warningModules
  });

  return {
    blockedModules: reviewCounts.blockedModules,
    certificationKey: definition.certificationKey,
    certificationName: definition.certificationName,
    certificationScope: definition.certificationScope,
    certifiedModules: reviewCounts.certifiedModules,
    dataIntegrityStatus,
    executionSafetyStatus,
    groupKey: definition.groupKey,
    mutationSafetyStatus,
    placeholderStatus,
    reviewRequiredModules: reviewCounts.reviewRequiredModules,
    safeControls: buildSafeControls(),
    safeSummary: [
      `scope ${definition.certificationScope}`,
      `${reviewCounts.certifiedModules} certified modules`,
      `${reviewCounts.reviewRequiredModules} review required`,
      `${runtimeIssues.length} shape issue${runtimeIssues.length === 1 ? "" : "s"}`,
      `mutation ${mutationSafetyStatus}`,
      `secrets ${secretSafetyStatus}`,
      `execution ${executionSafetyStatus}`
    ].join("; "),
    secretSafetyStatus,
    warningModules: reviewCounts.warningModules
  };
}

export function operationsDataCertificationIntegrityLabel(status: OperationsDataCertificationIntegrityStatus) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "certified":
      return "Certified";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function operationsDataCertificationIntegrityTone(status: OperationsDataCertificationIntegrityStatus) {
  switch (status) {
    case "certified":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
  }
}

export function operationsDataCertificationSafetyLabel(status: OperationsDataCertificationSafetyStatus | OperationsDataCertificationSecretStatus | OperationsDataCertificationExecutionStatus | OperationsDataCertificationPlaceholderStatus) {
  return status.replace(/_/g, " ");
}

export function buildOperationsDataCertificationGroups(
  items: OperationsDataCertificationItem[]
): OperationsDataCertificationGroup[] {
  return CERTIFICATION_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsDataCertificationSummary(
  items: OperationsDataCertificationItem[]
): OperationsDataCertificationSummary {
  const certifiedScopes = items.filter((item) => item.dataIntegrityStatus === "certified").length;
  const reviewRequiredScopes = items.filter((item) => item.dataIntegrityStatus === "review_required").length;
  const blockedScopes = items.filter((item) => item.dataIntegrityStatus === "blocked").length;
  const warningScopes = items.filter((item) => item.dataIntegrityStatus === "warning").length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0
      ? ("needs_attention" as const)
      : ("operations_data_certification_ready" as const);

  return {
    blockedScopes,
    certifiedScopes,
    groupCount: buildOperationsDataCertificationGroups(items).length,
    overallStatus,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    reviewRequiredScopes,
    source: OPERATIONS_DATA_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} certification scopes`,
      `${certifiedScopes} certified`,
      `${reviewRequiredScopes} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`
    ].join("; "),
    totalCertifications: items.length,
    warningScopes
  };
}

export function buildOperationsDataCertificationReadOnlySafe(input: OperationsDataCertificationInput) {
  const certificationItems = CERTIFICATION_SCOPE_DEFINITIONS.map((definition) => buildCertificationItem(definition, input));
  const groups = buildOperationsDataCertificationGroups(certificationItems);
  const summary = getOperationsDataCertificationSummary(certificationItems);

  return {
    certificationItems,
    dataCertification: summary,
    groups,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsDataCertificationToAdminFields(
  input: ReturnType<typeof buildOperationsDataCertificationReadOnlySafe>
) {
  return {
    certificationItems: input.certificationItems,
    dataCertification: input.dataCertification,
    groups: input.groups,
    safeControls: input.safeControls
  };
}
