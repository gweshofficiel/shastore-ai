import "server-only";

import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type {
  OperationsDataCertificationItem,
  OperationsDataCertificationSummary
} from "@/src/lib/operations/operations-data-certification-runtime";
import { OPERATIONS_REGISTRY_SOURCE } from "@/src/lib/operations/operations-registry-runtime";
import type {
  OperationsSecurityCertificationGroupKey,
  OperationsSecurityCertificationItem,
  OperationsSecurityCertificationSummary
} from "@/src/lib/operations/operations-security-certification-runtime";
import type { OperationsReviewRuntimeItem } from "@/src/lib/operations/operations-review-runtime";

export type OperationsRuntimeCertificationSource = "operations_runtime_certification_runtime";

export type OperationsRuntimeCertificationGroupKey =
  | "ai-queue-runtime-certification"
  | "audit-runtime-certification"
  | "backup-runtime-certification"
  | "cron-runtime-certification"
  | "dashboard-runtime-certification"
  | "data-certification-review"
  | "database-runtime-certification"
  | "diagnostics-runtime-certification"
  | "disaster-recovery-runtime-certification"
  | "domain-email-queue-runtime-certification"
  | "email-queue-runtime-certification"
  | "monitoring-runtime-certification"
  | "queue-runtime-certification"
  | "registry-runtime-certification"
  | "review-runtime-certification"
  | "safe-controls-runtime-certification"
  | "security-certification-review"
  | "status-runtime-certification"
  | "storage-runtime-certification"
  | "visibility-runtime-certification"
  | "worker-runtime-certification";

export type OperationsRuntimeCertificationStatus = "blocked" | "certified" | "review_required" | "warning";

export type OperationsRuntimeCertificationSafeControlKey =
  | "approve_runtime_certification"
  | "export_runtime_report"
  | "mark_runtime_certified"
  | "recheck_runtime"
  | "resolve_runtime_blocker";

export type OperationsRuntimeCertificationSafeControl = {
  enabled: false;
  key: OperationsRuntimeCertificationSafeControlKey;
  label: string;
  note: string;
};

export type OperationsRuntimeCertificationItem = {
  blockedModules: number;
  certificationName: string;
  certificationScope: string;
  certifiedModules: number;
  dataSafetyStatus: OperationsRuntimeCertificationStatus;
  executionSafetyStatus: OperationsRuntimeCertificationStatus;
  groupKey: OperationsRuntimeCertificationGroupKey;
  mutationSafetyStatus: OperationsRuntimeCertificationStatus;
  readOnlyStatus: OperationsRuntimeCertificationStatus;
  runtimeCertificationKey: string;
  runtimeIntegrityStatus: OperationsRuntimeCertificationStatus;
  safeControls: OperationsRuntimeCertificationSafeControl[];
  safeSummary: string;
  securitySafetyStatus: OperationsRuntimeCertificationStatus;
  warningModules: number;
};

export type OperationsRuntimeCertificationGroup = {
  groupKey: OperationsRuntimeCertificationGroupKey;
  itemCount: number;
  items: OperationsRuntimeCertificationItem[];
  title: string;
};

export type OperationsRuntimeCertificationSummary = {
  blockedScopes: number;
  certifiedScopes: number;
  groupCount: number;
  overallStatus: "needs_attention" | "operations_runtime_certification_ready";
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  reviewRequiredScopes: number;
  source: OperationsRuntimeCertificationSource;
  summary: string;
  totalCertifications: number;
  warningScopes: number;
};

type RuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

export type OperationsRuntimeCertificationInput = {
  aiQueueRuntime: RuntimeSnapshot;
  auditRuntime: RuntimeSnapshot;
  backupRuntime: RuntimeSnapshot;
  cronMonitoringRuntime: RuntimeSnapshot;
  cronRuntime: RuntimeSnapshot;
  dashboardRuntime: RuntimeSnapshot;
  dataCertification: OperationsDataCertificationSummary;
  dataCertificationItems: OperationsDataCertificationItem[];
  databaseRuntime: RuntimeSnapshot;
  diagnosticsRuntime: RuntimeSnapshot;
  disasterRecoveryRuntime: RuntimeSnapshot;
  domainEmailQueueRuntime: RuntimeSnapshot;
  emailQueueRuntime: RuntimeSnapshot;
  monitoringEventsRuntime: RuntimeSnapshot;
  queueRuntime: RuntimeSnapshot;
  registryRuntime: RuntimeSnapshot;
  reviewItems: OperationsReviewRuntimeItem[];
  reviewRuntime: RuntimeSnapshot;
  safeControlsRuntime: RuntimeSnapshot;
  securityCertification: OperationsSecurityCertificationSummary;
  securityCertificationItems: OperationsSecurityCertificationItem[];
  statusRuntime: RuntimeSnapshot;
  storageMetricsRuntime: RuntimeSnapshot;
  storageRuntime: RuntimeSnapshot;
  visibilityRuntime: RuntimeSnapshot;
  workerMonitoringRuntime: RuntimeSnapshot;
  workerRuntime: RuntimeSnapshot;
};

type RuntimeScopeDefinition = {
  certificationName: string;
  certificationScope: string;
  dataCertificationKey: string | null;
  derivedOnly: boolean;
  expectedSources: readonly string[];
  groupKey: OperationsRuntimeCertificationGroupKey;
  moduleKeys: readonly string[];
  runtimeGuarantee: string;
  securityGroupKey: OperationsSecurityCertificationGroupKey | null;
  resolveRuntimeSnapshots: (input: OperationsRuntimeCertificationInput) => RuntimeSnapshot[];
};

export const OPERATIONS_RUNTIME_CERTIFICATION_SOURCE = "operations_runtime_certification_runtime" as const;

export const OPERATIONS_RUNTIME_CERTIFICATION_SAFE_CONTROLS: readonly OperationsRuntimeCertificationSafeControl[] = [
  {
    enabled: false,
    key: "approve_runtime_certification",
    label: "Approve Runtime Certification",
    note: "Read-only placeholder. No runtime certification approval or mutation runs during OP-25 page load."
  },
  {
    enabled: false,
    key: "recheck_runtime",
    label: "Recheck Runtime",
    note: "Read-only placeholder. No runtime recheck execution, provider call, or mutation runs during OP-25 page load."
  },
  {
    enabled: false,
    key: "export_runtime_report",
    label: "Export Runtime Report",
    note: "Read-only placeholder. No runtime export or provider call runs during OP-25 page load."
  },
  {
    enabled: false,
    key: "resolve_runtime_blocker",
    label: "Resolve Runtime Blocker",
    note: "Read-only placeholder. No runtime blocker resolve action runs during OP-25 page load."
  },
  {
    enabled: false,
    key: "mark_runtime_certified",
    label: "Mark Runtime Certified",
    note: "Read-only placeholder. No runtime certification record write or registry mutation runs during OP-25 page load."
  }
] as const;

const RUNTIME_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsRuntimeCertificationGroupKey;
  title: string;
}> = [
  { groupKey: "registry-runtime-certification", title: "Registry Runtime Certification" },
  { groupKey: "dashboard-runtime-certification", title: "Dashboard Runtime Certification" },
  { groupKey: "queue-runtime-certification", title: "Queue Runtime Certification" },
  { groupKey: "worker-runtime-certification", title: "Worker Runtime Certification" },
  { groupKey: "cron-runtime-certification", title: "Cron Runtime Certification" },
  { groupKey: "storage-runtime-certification", title: "Storage Runtime Certification" },
  { groupKey: "database-runtime-certification", title: "Database Runtime Certification" },
  { groupKey: "email-queue-runtime-certification", title: "Email Queue Runtime Certification" },
  { groupKey: "ai-queue-runtime-certification", title: "AI Queue Runtime Certification" },
  { groupKey: "domain-email-queue-runtime-certification", title: "Domain & Email Queue Runtime Certification" },
  { groupKey: "monitoring-runtime-certification", title: "Monitoring Runtime Certification" },
  { groupKey: "backup-runtime-certification", title: "Backup Runtime Certification" },
  { groupKey: "disaster-recovery-runtime-certification", title: "Disaster Recovery Runtime Certification" },
  { groupKey: "diagnostics-runtime-certification", title: "Diagnostics Runtime Certification" },
  { groupKey: "safe-controls-runtime-certification", title: "Safe Controls Runtime Certification" },
  { groupKey: "status-runtime-certification", title: "Status Runtime Certification" },
  { groupKey: "visibility-runtime-certification", title: "Visibility Runtime Certification" },
  { groupKey: "audit-runtime-certification", title: "Audit Runtime Certification" },
  { groupKey: "review-runtime-certification", title: "Review Runtime Certification" },
  { groupKey: "data-certification-review", title: "Data Certification Review" },
  { groupKey: "security-certification-review", title: "Security Certification Review" }
];

const RUNTIME_SCOPE_DEFINITIONS: readonly RuntimeScopeDefinition[] = [
  {
    certificationName: "Registry Runtime Certification",
    certificationScope: "OP-1 Operations Registry runtime exists and remains read-only",
    dataCertificationKey: "op-cert-registry-data",
    derivedOnly: false,
    expectedSources: ["operations_registry_runtime"],
    groupKey: "registry-runtime-certification",
    moduleKeys: ["operations_registry_runtime"],
    runtimeGuarantee: "registry exists",
    securityGroupKey: "registry-security-certification",
    resolveRuntimeSnapshots: (input) => [input.registryRuntime]
  },
  {
    certificationName: "Dashboard Runtime Certification",
    certificationScope: "OP-2 Operations Dashboard runtime derives from registry metadata only",
    dataCertificationKey: "op-cert-dashboard-data",
    derivedOnly: true,
    expectedSources: ["operations_dashboard_runtime", "operations_registry_runtime"],
    groupKey: "dashboard-runtime-certification",
    moduleKeys: ["operations_dashboard_runtime"],
    runtimeGuarantee: "dashboard derives from registry",
    securityGroupKey: "dashboard-security-certification",
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime, input.registryRuntime]
  },
  {
    certificationName: "Queue Runtime Certification",
    certificationScope: "OP-3 Operations Queue runtime is read-only",
    dataCertificationKey: "op-cert-queue-data",
    derivedOnly: false,
    expectedSources: ["operations_queue_runtime"],
    groupKey: "queue-runtime-certification",
    moduleKeys: ["op-queue-tables"],
    runtimeGuarantee: "queues are read-only",
    securityGroupKey: "queue-security-certification",
    resolveRuntimeSnapshots: (input) => [input.queueRuntime]
  },
  {
    certificationName: "Worker Runtime Certification",
    certificationScope: "OP-4 and OP-12 Worker runtimes are read-only",
    dataCertificationKey: "op-cert-worker-data",
    derivedOnly: false,
    expectedSources: ["operations_worker_runtime", "operations_worker_monitoring_runtime"],
    groupKey: "worker-runtime-certification",
    moduleKeys: ["op-worker-tables", "op-worker-health"],
    runtimeGuarantee: "workers are read-only",
    securityGroupKey: "worker-security-certification",
    resolveRuntimeSnapshots: (input) => [input.workerRuntime, input.workerMonitoringRuntime]
  },
  {
    certificationName: "Cron Runtime Certification",
    certificationScope: "OP-5 and OP-13 Cron runtimes are read-only",
    dataCertificationKey: "op-cert-cron-data",
    derivedOnly: false,
    expectedSources: ["operations_cron_runtime", "operations_cron_monitoring_runtime"],
    groupKey: "cron-runtime-certification",
    moduleKeys: ["op-cron-jobs", "op-cron-health"],
    runtimeGuarantee: "cron jobs are read-only",
    securityGroupKey: "cron-security-certification",
    resolveRuntimeSnapshots: (input) => [input.cronRuntime, input.cronMonitoringRuntime]
  },
  {
    certificationName: "Storage Runtime Certification",
    certificationScope: "OP-5 and OP-14 Storage runtimes are read-only",
    dataCertificationKey: "op-cert-storage-data",
    derivedOnly: false,
    expectedSources: ["operations_storage_runtime", "operations_storage_metrics_runtime"],
    groupKey: "storage-runtime-certification",
    moduleKeys: ["op-storage-health", "op-storage-metrics"],
    runtimeGuarantee: "storage health is read-only",
    securityGroupKey: "storage-security-certification",
    resolveRuntimeSnapshots: (input) => [input.storageRuntime, input.storageMetricsRuntime]
  },
  {
    certificationName: "Database Runtime Certification",
    certificationScope: "OP-6 Operations Database runtime is read-only",
    dataCertificationKey: "op-cert-database-data",
    derivedOnly: false,
    expectedSources: ["operations_database_runtime"],
    groupKey: "database-runtime-certification",
    moduleKeys: ["op-database-health"],
    runtimeGuarantee: "database health is read-only",
    securityGroupKey: "database-security-certification",
    resolveRuntimeSnapshots: (input) => [input.databaseRuntime]
  },
  {
    certificationName: "Email Queue Runtime Certification",
    certificationScope: "OP-7 Operations Email Queue runtime is read-only",
    dataCertificationKey: "op-cert-email-queue-data",
    derivedOnly: false,
    expectedSources: ["operations_email_queue_runtime"],
    groupKey: "email-queue-runtime-certification",
    moduleKeys: ["op-email-queue"],
    runtimeGuarantee: "email queue is read-only",
    securityGroupKey: "email-queue-security-certification",
    resolveRuntimeSnapshots: (input) => [input.emailQueueRuntime]
  },
  {
    certificationName: "AI Queue Runtime Certification",
    certificationScope: "OP-8 Operations AI Queue runtime is read-only",
    dataCertificationKey: "op-cert-ai-queue-data",
    derivedOnly: false,
    expectedSources: ["operations_ai_queue_runtime"],
    groupKey: "ai-queue-runtime-certification",
    moduleKeys: ["op-ai-queue"],
    runtimeGuarantee: "AI queue is read-only",
    securityGroupKey: "ai-queue-security-certification",
    resolveRuntimeSnapshots: (input) => [input.aiQueueRuntime]
  },
  {
    certificationName: "Domain & Email Queue Runtime Certification",
    certificationScope: "OP-9 Operations Domain and Email Queue runtime is read-only",
    dataCertificationKey: "op-cert-domain-email-queue-data",
    derivedOnly: false,
    expectedSources: ["operations_domain_email_queue_runtime"],
    groupKey: "domain-email-queue-runtime-certification",
    moduleKeys: ["op-domain-email-queue"],
    runtimeGuarantee: "domain and email queue is read-only",
    securityGroupKey: "domain-email-queue-security-certification",
    resolveRuntimeSnapshots: (input) => [input.domainEmailQueueRuntime]
  },
  {
    certificationName: "Monitoring Runtime Certification",
    certificationScope: "OP-11 Operations Monitoring Events runtime is read-only",
    dataCertificationKey: "op-cert-monitoring-data",
    derivedOnly: false,
    expectedSources: ["operations_monitoring_events_runtime"],
    groupKey: "monitoring-runtime-certification",
    moduleKeys: ["op-monitoring-events"],
    runtimeGuarantee: "monitoring events are read-only",
    securityGroupKey: "monitoring-security-certification",
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime]
  },
  {
    certificationName: "Backup Runtime Certification",
    certificationScope: "OP-15 Operations Backup runtime is read-only",
    dataCertificationKey: "op-cert-backup-data",
    derivedOnly: false,
    expectedSources: ["operations_backup_runtime"],
    groupKey: "backup-runtime-certification",
    moduleKeys: ["op-backup"],
    runtimeGuarantee: "backup is read-only",
    securityGroupKey: "backup-security-certification",
    resolveRuntimeSnapshots: (input) => [input.backupRuntime]
  },
  {
    certificationName: "Disaster Recovery Runtime Certification",
    certificationScope: "OP-16 Operations Disaster Recovery runtime is read-only",
    dataCertificationKey: "op-cert-disaster-recovery-data",
    derivedOnly: false,
    expectedSources: ["operations_disaster_recovery_runtime"],
    groupKey: "disaster-recovery-runtime-certification",
    moduleKeys: ["op-disaster-recovery"],
    runtimeGuarantee: "disaster recovery is read-only",
    securityGroupKey: "disaster-recovery-security-certification",
    resolveRuntimeSnapshots: (input) => [input.disasterRecoveryRuntime]
  },
  {
    certificationName: "Diagnostics Runtime Certification",
    certificationScope: "OP-17 Operations Diagnostics runtime is read-only",
    dataCertificationKey: "op-cert-diagnostics-data",
    derivedOnly: false,
    expectedSources: ["operations_diagnostics_runtime"],
    groupKey: "diagnostics-runtime-certification",
    moduleKeys: ["op-diagnostics"],
    runtimeGuarantee: "diagnostics are read-only",
    securityGroupKey: "diagnostics-security-certification",
    resolveRuntimeSnapshots: (input) => [input.diagnosticsRuntime]
  },
  {
    certificationName: "Safe Controls Runtime Certification",
    certificationScope: "OP-18 Operations Safe Controls remain disabled and non-executable",
    dataCertificationKey: "op-cert-safe-controls-data",
    derivedOnly: false,
    expectedSources: ["operations_safe_controls_runtime"],
    groupKey: "safe-controls-runtime-certification",
    moduleKeys: ["op-safe-controls"],
    runtimeGuarantee: "safe controls are disabled",
    securityGroupKey: "safe-controls-security-certification",
    resolveRuntimeSnapshots: (input) => [input.safeControlsRuntime]
  },
  {
    certificationName: "Status Runtime Certification",
    certificationScope: "OP-19 Operations Status runtime is derived only",
    dataCertificationKey: "op-cert-status-data",
    derivedOnly: true,
    expectedSources: ["operations_status_runtime"],
    groupKey: "status-runtime-certification",
    moduleKeys: ["operations_status_runtime"],
    runtimeGuarantee: "status is derived only",
    securityGroupKey: "status-security-certification",
    resolveRuntimeSnapshots: (input) => [input.statusRuntime]
  },
  {
    certificationName: "Visibility Runtime Certification",
    certificationScope: "OP-20 Operations Visibility runtime is derived only",
    dataCertificationKey: "op-cert-visibility-data",
    derivedOnly: true,
    expectedSources: ["operations_visibility_runtime"],
    groupKey: "visibility-runtime-certification",
    moduleKeys: ["operations_visibility_runtime"],
    runtimeGuarantee: "visibility is derived only",
    securityGroupKey: "visibility-security-certification",
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime]
  },
  {
    certificationName: "Audit Runtime Certification",
    certificationScope: "OP-21 Operations Audit runtime is read-only",
    dataCertificationKey: "op-cert-audit-data",
    derivedOnly: false,
    expectedSources: ["operations_audit_runtime"],
    groupKey: "audit-runtime-certification",
    moduleKeys: ["operations_audit_runtime"],
    runtimeGuarantee: "audit is read-only",
    securityGroupKey: "audit-security-certification",
    resolveRuntimeSnapshots: (input) => [input.auditRuntime]
  },
  {
    certificationName: "Review Runtime Certification",
    certificationScope: "OP-22 Operations Review runtime is derived only",
    dataCertificationKey: "op-cert-review-data",
    derivedOnly: true,
    expectedSources: ["operations_review_runtime"],
    groupKey: "review-runtime-certification",
    moduleKeys: ["operations_review_runtime"],
    runtimeGuarantee: "review is derived only",
    securityGroupKey: "review-security-certification",
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime]
  },
  {
    certificationName: "Data Certification Review",
    certificationScope: "OP-23 Operations Data Certification runtime is read-only",
    dataCertificationKey: null,
    derivedOnly: false,
    expectedSources: ["operations_data_certification_runtime"],
    groupKey: "data-certification-review",
    moduleKeys: ["operations_data_certification_runtime"],
    runtimeGuarantee: "data certification is read-only",
    securityGroupKey: "data-certification-security-review",
    resolveRuntimeSnapshots: (input) => [input.dataCertification]
  },
  {
    certificationName: "Security Certification Review",
    certificationScope: "OP-24 Operations Security Certification runtime is read-only",
    dataCertificationKey: null,
    derivedOnly: false,
    expectedSources: ["operations_security_certification_runtime"],
    groupKey: "security-certification-review",
    moduleKeys: ["operations_security_certification_runtime"],
    runtimeGuarantee: "security certification is read-only",
    securityGroupKey: null,
    resolveRuntimeSnapshots: (input) => [input.securityCertification]
  }
] as const;

function buildSafeControls() {
  return OPERATIONS_RUNTIME_CERTIFICATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function collectModuleCounts(input: OperationsRuntimeCertificationInput, moduleKeys: readonly string[]) {
  const reviewItems = input.reviewItems.filter((item) => moduleKeys.includes(item.moduleKey));

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
    certifiedModules: reviewItems.filter(
      (item) => item.reviewStatus === "reviewed" || item.reviewStatus === "production_ready_candidate"
    ).length,
    warningModules: reviewItems.filter((item) => item.reviewStatus === "warning").length
  };
}

function validateRuntimeShape(snapshots: RuntimeSnapshot[], expectedSources: readonly string[]) {
  if (!snapshots.length) {
    return false;
  }

  return snapshots.every(
    (snapshot) =>
      snapshot.readOnly === true &&
      Boolean(snapshot.source) &&
      expectedSources.includes(String(snapshot.source)) &&
      typeof snapshot.summary === "string" &&
      snapshot.summary.trim().length > 0
  );
}

function mapBinaryStatus(passed: boolean): OperationsRuntimeCertificationStatus {
  return passed ? "certified" : "review_required";
}

function mapDataSafetyStatus(item: OperationsDataCertificationItem | null): OperationsRuntimeCertificationStatus {
  if (!item) {
    return "review_required";
  }

  if (item.dataIntegrityStatus === "blocked") {
    return "blocked";
  }

  if (item.dataIntegrityStatus === "warning") {
    return "warning";
  }

  if (item.dataIntegrityStatus === "certified" && item.mutationSafetyStatus === "read_only_certified") {
    return "certified";
  }

  return "review_required";
}

function mapSecuritySafetyStatus(item: OperationsSecurityCertificationItem | null): OperationsRuntimeCertificationStatus {
  if (!item) {
    return "review_required";
  }

  if (item.blockedModules > 0) {
    return "blocked";
  }

  if (item.warningModules > 0) {
    return "warning";
  }

  const certified =
    item.superAdminOnlyStatus === "certified" &&
    item.readOnlyStatus === "certified" &&
    item.mutationSafetyStatus === "certified" &&
    item.executionSafetyStatus === "certified" &&
    item.secretSafetyStatus === "certified" &&
    item.privateDataSafetyStatus === "certified" &&
    item.rlsSafetyStatus === "certified" &&
    item.ownershipSafetyStatus === "certified" &&
    item.actionSafetyStatus === "certified";

  return certified ? "certified" : "review_required";
}

function resolveRuntimeIntegrityStatus(input: {
  blockedModules: number;
  dataSafetyStatus: OperationsRuntimeCertificationStatus;
  runtimeShapeValid: boolean;
  securitySafetyStatus: OperationsRuntimeCertificationStatus;
  warningModules: number;
}): OperationsRuntimeCertificationStatus {
  if (!input.runtimeShapeValid || input.blockedModules > 0 || input.dataSafetyStatus === "blocked" || input.securitySafetyStatus === "blocked") {
    return "blocked";
  }

  if (input.warningModules > 0 || input.dataSafetyStatus === "warning" || input.securitySafetyStatus === "warning") {
    return "warning";
  }

  if (input.dataSafetyStatus === "review_required" || input.securitySafetyStatus === "review_required") {
    return "review_required";
  }

  return "certified";
}

function buildRuntimeCertificationItem(
  definition: RuntimeScopeDefinition,
  input: OperationsRuntimeCertificationInput
): OperationsRuntimeCertificationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeShapeValid = validateRuntimeShape(snapshots, definition.expectedSources);
  const dataCertificationItem = definition.dataCertificationKey
    ? input.dataCertificationItems.find((item) => item.certificationKey === definition.dataCertificationKey) ?? null
    : definition.groupKey === "data-certification-review"
      ? null
      : null;
  const securityCertificationItem = definition.securityGroupKey
    ? input.securityCertificationItems.find((item) => item.groupKey === definition.securityGroupKey) ?? null
    : null;
  const moduleCounts =
    definition.groupKey === "data-certification-review"
      ? {
          blockedModules: input.dataCertification.blockedScopes,
          certifiedModules: input.dataCertification.certifiedScopes,
          warningModules: input.dataCertification.warningScopes
        }
      : definition.groupKey === "security-certification-review"
        ? {
            blockedModules: input.securityCertification.blockedScopes,
            certifiedModules: input.securityCertification.certifiedScopes,
            warningModules: input.securityCertification.warningScopes
          }
        : collectModuleCounts(input, definition.moduleKeys);
  const readOnlyStatus = mapBinaryStatus(runtimeShapeValid);
  const mutationSafetyStatus = mapBinaryStatus(
    runtimeShapeValid &&
      snapshots.every((snapshot) => snapshot.readOnly === true) &&
      (dataCertificationItem?.mutationSafetyStatus === "read_only_certified" || definition.derivedOnly)
  );
  const executionSafetyStatus = mapBinaryStatus(
    securityCertificationItem?.executionSafetyStatus === "certified" || runtimeShapeValid
  );
  const dataSafetyStatus =
    definition.groupKey === "data-certification-review"
      ? mapBinaryStatus(input.dataCertification.readOnly === true && input.dataCertification.source === "operations_data_certification_runtime")
      : mapDataSafetyStatus(dataCertificationItem);
  const securitySafetyStatus =
    definition.groupKey === "security-certification-review"
      ? mapBinaryStatus(
          input.securityCertification.readOnly === true &&
            input.securityCertification.source === "operations_security_certification_runtime"
        )
      : mapSecuritySafetyStatus(securityCertificationItem);
  const runtimeIntegrityStatus = resolveRuntimeIntegrityStatus({
    blockedModules: moduleCounts.blockedModules,
    dataSafetyStatus,
    runtimeShapeValid,
    securitySafetyStatus,
    warningModules: moduleCounts.warningModules
  });

  return {
    blockedModules: moduleCounts.blockedModules,
    certificationName: definition.certificationName,
    certificationScope: definition.certificationScope,
    certifiedModules: moduleCounts.certifiedModules,
    dataSafetyStatus,
    executionSafetyStatus,
    groupKey: definition.groupKey,
    mutationSafetyStatus,
    readOnlyStatus,
    runtimeCertificationKey: `op-runtime-${definition.groupKey}`,
    runtimeIntegrityStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `guarantee ${definition.runtimeGuarantee}`,
      `integrity ${runtimeIntegrityStatus}`,
      `read only ${readOnlyStatus}`,
      `data ${dataSafetyStatus}`,
      `security ${securitySafetyStatus}`,
      `${moduleCounts.certifiedModules} certified modules`,
      `${moduleCounts.blockedModules} blocked`,
      `${moduleCounts.warningModules} warning`
    ].join("; "),
    securitySafetyStatus,
    warningModules: moduleCounts.warningModules
  };
}

export function operationsRuntimeCertificationStatusLabel(status: OperationsRuntimeCertificationStatus) {
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

export function operationsRuntimeCertificationStatusTone(status: OperationsRuntimeCertificationStatus) {
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

export function isRuntimeScopeCertified(item: OperationsRuntimeCertificationItem) {
  return (
    item.runtimeIntegrityStatus === "certified" &&
    item.readOnlyStatus === "certified" &&
    item.mutationSafetyStatus === "certified" &&
    item.executionSafetyStatus === "certified" &&
    item.dataSafetyStatus === "certified" &&
    item.securitySafetyStatus === "certified"
  );
}

export function buildOperationsRuntimeCertificationGroups(
  items: OperationsRuntimeCertificationItem[]
): OperationsRuntimeCertificationGroup[] {
  return RUNTIME_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsRuntimeCertificationSummary(
  items: OperationsRuntimeCertificationItem[]
): OperationsRuntimeCertificationSummary {
  const certifiedScopes = items.filter((item) => isRuntimeScopeCertified(item)).length;
  const reviewRequiredScopes = items.filter((item) => !isRuntimeScopeCertified(item) && item.runtimeIntegrityStatus === "review_required").length;
  const blockedScopes = items.filter((item) => item.runtimeIntegrityStatus === "blocked").length;
  const warningScopes = items.filter((item) => item.runtimeIntegrityStatus === "warning").length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0
      ? ("needs_attention" as const)
      : ("operations_runtime_certification_ready" as const);

  return {
    blockedScopes,
    certifiedScopes,
    groupCount: buildOperationsRuntimeCertificationGroups(items).length,
    overallStatus,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    reviewRequiredScopes,
    source: OPERATIONS_RUNTIME_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} runtime scopes`,
      `${certifiedScopes} certified`,
      `${reviewRequiredScopes} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`
    ].join("; "),
    totalCertifications: items.length,
    warningScopes
  };
}

export function buildOperationsRuntimeCertificationReadOnlySafe(input: OperationsRuntimeCertificationInput) {
  const runtimeCertificationItems = RUNTIME_SCOPE_DEFINITIONS.map((definition) =>
    buildRuntimeCertificationItem(definition, input)
  );
  const groups = buildOperationsRuntimeCertificationGroups(runtimeCertificationItems);
  const summary = getOperationsRuntimeCertificationSummary(runtimeCertificationItems);

  return {
    groups,
    runtimeCertification: summary,
    runtimeCertificationItems,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsRuntimeCertificationToAdminFields(
  input: ReturnType<typeof buildOperationsRuntimeCertificationReadOnlySafe>
) {
  return {
    groups: input.groups,
    runtimeCertification: input.runtimeCertification,
    runtimeCertificationItems: input.runtimeCertificationItems,
    safeControls: input.safeControls
  };
}
