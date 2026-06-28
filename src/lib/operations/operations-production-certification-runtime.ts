import "server-only";

import type {
  OperationsDataCertificationItem,
  OperationsDataCertificationSummary
} from "@/src/lib/operations/operations-data-certification-runtime";
import { OPERATIONS_REGISTRY_SOURCE } from "@/src/lib/operations/operations-registry-runtime";
import type {
  OperationsRuntimeCertificationItem,
  OperationsRuntimeCertificationSummary
} from "@/src/lib/operations/operations-runtime-certification-runtime";
import type {
  OperationsSecurityCertificationItem,
  OperationsSecurityCertificationSummary
} from "@/src/lib/operations/operations-security-certification-runtime";
import type { OperationsReviewRuntimeItem } from "@/src/lib/operations/operations-review-runtime";

export type OperationsProductionCertificationSource = "operations_production_certification_runtime";

export type OperationsProductionCertificationGroupKey =
  | "ai-queue-production-certification"
  | "audit-production-certification"
  | "backup-production-certification"
  | "cron-monitoring-production-certification"
  | "cron-production-certification"
  | "dashboard-production-certification"
  | "data-certification-review"
  | "database-production-certification"
  | "diagnostics-production-certification"
  | "disaster-recovery-production-certification"
  | "domain-email-queue-production-certification"
  | "email-queue-production-certification"
  | "monitoring-production-certification"
  | "queue-production-certification"
  | "registry-production-certification"
  | "review-production-certification"
  | "runtime-certification-review"
  | "safe-controls-production-certification"
  | "security-certification-review"
  | "status-production-certification"
  | "storage-metrics-production-certification"
  | "storage-production-certification"
  | "visibility-production-certification"
  | "worker-monitoring-production-certification"
  | "worker-production-certification";

export type OperationsProductionCertificationStatus = "blocked" | "certified" | "review_required" | "warning";

export type OperationsProductionReadinessStatus = "blocked" | "production_ready" | "review_required" | "warning";

export type OperationsProductionCertificationSafeControlKey =
  | "approve_production_certification"
  | "export_production_report"
  | "mark_production_certified"
  | "recheck_production_readiness"
  | "resolve_production_blocker";

export type OperationsProductionCertificationSafeControl = {
  enabled: false;
  key: OperationsProductionCertificationSafeControlKey;
  label: string;
  note: string;
};

export type OperationsProductionCertificationItem = {
  blockedModules: number;
  certificationName: string;
  certificationScope: string;
  certifiedModules: number;
  dataSafetyStatus: OperationsProductionCertificationStatus;
  executionSafetyStatus: OperationsProductionCertificationStatus;
  groupKey: OperationsProductionCertificationGroupKey;
  mutationSafetyStatus: OperationsProductionCertificationStatus;
  productionCertificationKey: string;
  productionReadinessStatus: OperationsProductionReadinessStatus;
  readOnlyStatus: OperationsProductionCertificationStatus;
  runtimeIntegrityStatus: OperationsProductionCertificationStatus;
  safeControls: OperationsProductionCertificationSafeControl[];
  safeSummary: string;
  securitySafetyStatus: OperationsProductionCertificationStatus;
  warningModules: number;
};

export type OperationsProductionCertificationGroup = {
  groupKey: OperationsProductionCertificationGroupKey;
  itemCount: number;
  items: OperationsProductionCertificationItem[];
  title: string;
};

export type OperationsProductionCertificationSummary = {
  blockedScopes: number;
  groupCount: number;
  overallStatus: "needs_attention" | "operations_production_certification_ready";
  productionReadyScopes: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  reviewRequiredScopes: number;
  source: OperationsProductionCertificationSource;
  summary: string;
  totalCertifications: number;
  warningScopes: number;
};

type RuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

export type OperationsProductionCertificationInput = {
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
  runtimeCertification: OperationsRuntimeCertificationSummary;
  runtimeCertificationItems: OperationsRuntimeCertificationItem[];
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

type ProductionScopeDefinition = {
  certificationName: string;
  certificationScope: string;
  dataCertificationKey: string | null;
  derivedOnly: boolean;
  expectedSources: readonly string[];
  groupKey: OperationsProductionCertificationGroupKey;
  moduleKeys: readonly string[];
  productionGuarantee: string;
  resolveRuntimeSnapshots: (input: OperationsProductionCertificationInput) => RuntimeSnapshot[];
  runtimeCertificationGroupKey: string | null;
};

export const OPERATIONS_PRODUCTION_CERTIFICATION_SOURCE = "operations_production_certification_runtime" as const;

export const OPERATIONS_PRODUCTION_CERTIFICATION_SAFE_CONTROLS: readonly OperationsProductionCertificationSafeControl[] = [
  {
    enabled: false,
    key: "approve_production_certification",
    label: "Approve Production Certification",
    note: "Read-only placeholder. No production certification approval or mutation runs during OP-26 page load."
  },
  {
    enabled: false,
    key: "recheck_production_readiness",
    label: "Recheck Production Readiness",
    note: "Read-only placeholder. No production recheck execution, provider call, or mutation runs during OP-26 page load."
  },
  {
    enabled: false,
    key: "export_production_report",
    label: "Export Production Report",
    note: "Read-only placeholder. No production export or provider call runs during OP-26 page load."
  },
  {
    enabled: false,
    key: "resolve_production_blocker",
    label: "Resolve Production Blocker",
    note: "Read-only placeholder. No production blocker resolve action runs during OP-26 page load."
  },
  {
    enabled: false,
    key: "mark_production_certified",
    label: "Mark Production Certified",
    note: "Read-only placeholder. No production certification record write or registry mutation runs during OP-26 page load."
  }
] as const;

const PRODUCTION_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsProductionCertificationGroupKey;
  title: string;
}> = [
  { groupKey: "registry-production-certification", title: "Registry Production Certification" },
  { groupKey: "dashboard-production-certification", title: "Dashboard Production Certification" },
  { groupKey: "queue-production-certification", title: "Queue Production Certification" },
  { groupKey: "worker-production-certification", title: "Worker Production Certification" },
  { groupKey: "cron-production-certification", title: "Cron Production Certification" },
  { groupKey: "storage-production-certification", title: "Storage Production Certification" },
  { groupKey: "database-production-certification", title: "Database Production Certification" },
  { groupKey: "email-queue-production-certification", title: "Email Queue Production Certification" },
  { groupKey: "ai-queue-production-certification", title: "AI Queue Production Certification" },
  { groupKey: "domain-email-queue-production-certification", title: "Domain & Email Queue Production Certification" },
  { groupKey: "monitoring-production-certification", title: "Monitoring Production Certification" },
  { groupKey: "worker-monitoring-production-certification", title: "Worker Monitoring Production Certification" },
  { groupKey: "cron-monitoring-production-certification", title: "Cron Monitoring Production Certification" },
  { groupKey: "storage-metrics-production-certification", title: "Storage Metrics Production Certification" },
  { groupKey: "backup-production-certification", title: "Backup Production Certification" },
  { groupKey: "disaster-recovery-production-certification", title: "Disaster Recovery Production Certification" },
  { groupKey: "diagnostics-production-certification", title: "Diagnostics Production Certification" },
  { groupKey: "safe-controls-production-certification", title: "Safe Controls Production Certification" },
  { groupKey: "status-production-certification", title: "Status Production Certification" },
  { groupKey: "visibility-production-certification", title: "Visibility Production Certification" },
  { groupKey: "audit-production-certification", title: "Audit Production Certification" },
  { groupKey: "review-production-certification", title: "Review Production Certification" },
  { groupKey: "data-certification-review", title: "Data Certification Review" },
  { groupKey: "security-certification-review", title: "Security Certification Review" },
  { groupKey: "runtime-certification-review", title: "Runtime Certification Review" }
];

const PRODUCTION_SCOPE_DEFINITIONS: readonly ProductionScopeDefinition[] = [
  {
    certificationName: "Registry Production Certification",
    certificationScope: "OP-1 Operations Registry is stable and production-safe",
    dataCertificationKey: "op-cert-registry-data",
    derivedOnly: false,
    expectedSources: ["operations_registry_runtime"],
    groupKey: "registry-production-certification",
    moduleKeys: ["operations_registry_runtime"],
    productionGuarantee: "Operations Registry is stable",
    runtimeCertificationGroupKey: "registry-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.registryRuntime]
  },
  {
    certificationName: "Dashboard Production Certification",
    certificationScope: "OP-2 Operations Dashboard is registry-derived and production-safe",
    dataCertificationKey: "op-cert-dashboard-data",
    derivedOnly: true,
    expectedSources: ["operations_dashboard_runtime", "operations_registry_runtime"],
    groupKey: "dashboard-production-certification",
    moduleKeys: ["operations_dashboard_runtime"],
    productionGuarantee: "Operations Dashboard is registry-derived",
    runtimeCertificationGroupKey: "dashboard-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime, input.registryRuntime]
  },
  {
    certificationName: "Queue Production Certification",
    certificationScope: "OP-3 Queue Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-queue-data",
    derivedOnly: false,
    expectedSources: ["operations_queue_runtime"],
    groupKey: "queue-production-certification",
    moduleKeys: ["op-queue-tables"],
    productionGuarantee: "Queue Runtime is read-only",
    runtimeCertificationGroupKey: "queue-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.queueRuntime]
  },
  {
    certificationName: "Worker Production Certification",
    certificationScope: "OP-4 Worker Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-worker-data",
    derivedOnly: false,
    expectedSources: ["operations_worker_runtime"],
    groupKey: "worker-production-certification",
    moduleKeys: ["op-worker-tables"],
    productionGuarantee: "Worker Runtime is read-only",
    runtimeCertificationGroupKey: "worker-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.workerRuntime]
  },
  {
    certificationName: "Cron Production Certification",
    certificationScope: "OP-5 Cron Jobs Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-cron-data",
    derivedOnly: false,
    expectedSources: ["operations_cron_runtime"],
    groupKey: "cron-production-certification",
    moduleKeys: ["op-cron-jobs"],
    productionGuarantee: "Cron Jobs Runtime is read-only",
    runtimeCertificationGroupKey: "cron-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.cronRuntime]
  },
  {
    certificationName: "Storage Production Certification",
    certificationScope: "OP-5 Storage Health Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-storage-data",
    derivedOnly: false,
    expectedSources: ["operations_storage_runtime"],
    groupKey: "storage-production-certification",
    moduleKeys: ["op-storage-health"],
    productionGuarantee: "Storage Health Runtime is read-only",
    runtimeCertificationGroupKey: "storage-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.storageRuntime]
  },
  {
    certificationName: "Database Production Certification",
    certificationScope: "OP-6 Database Health Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-database-data",
    derivedOnly: false,
    expectedSources: ["operations_database_runtime"],
    groupKey: "database-production-certification",
    moduleKeys: ["op-database-health"],
    productionGuarantee: "Database Health Runtime is read-only",
    runtimeCertificationGroupKey: "database-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.databaseRuntime]
  },
  {
    certificationName: "Email Queue Production Certification",
    certificationScope: "OP-7 Email Queue Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-email-queue-data",
    derivedOnly: false,
    expectedSources: ["operations_email_queue_runtime"],
    groupKey: "email-queue-production-certification",
    moduleKeys: ["op-email-queue"],
    productionGuarantee: "Email Queue Runtime is read-only",
    runtimeCertificationGroupKey: "email-queue-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.emailQueueRuntime]
  },
  {
    certificationName: "AI Queue Production Certification",
    certificationScope: "OP-8 AI Queue Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-ai-queue-data",
    derivedOnly: false,
    expectedSources: ["operations_ai_queue_runtime"],
    groupKey: "ai-queue-production-certification",
    moduleKeys: ["op-ai-queue"],
    productionGuarantee: "AI Queue Runtime is read-only",
    runtimeCertificationGroupKey: "ai-queue-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.aiQueueRuntime]
  },
  {
    certificationName: "Domain & Email Queue Production Certification",
    certificationScope: "OP-9 Domain and Email Queue Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-domain-email-queue-data",
    derivedOnly: false,
    expectedSources: ["operations_domain_email_queue_runtime"],
    groupKey: "domain-email-queue-production-certification",
    moduleKeys: ["op-domain-email-queue"],
    productionGuarantee: "Domain & Email Queue Runtime is read-only",
    runtimeCertificationGroupKey: "domain-email-queue-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.domainEmailQueueRuntime]
  },
  {
    certificationName: "Monitoring Production Certification",
    certificationScope: "OP-11 Monitoring Events Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-monitoring-data",
    derivedOnly: false,
    expectedSources: ["operations_monitoring_events_runtime"],
    groupKey: "monitoring-production-certification",
    moduleKeys: ["op-monitoring-events"],
    productionGuarantee: "Monitoring Events Runtime is read-only",
    runtimeCertificationGroupKey: "monitoring-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime]
  },
  {
    certificationName: "Worker Monitoring Production Certification",
    certificationScope: "OP-12 Worker Monitoring Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-worker-data",
    derivedOnly: false,
    expectedSources: ["operations_worker_monitoring_runtime"],
    groupKey: "worker-monitoring-production-certification",
    moduleKeys: ["op-worker-health"],
    productionGuarantee: "Worker Monitoring Runtime is read-only",
    runtimeCertificationGroupKey: "worker-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.workerMonitoringRuntime]
  },
  {
    certificationName: "Cron Monitoring Production Certification",
    certificationScope: "OP-13 Cron Monitoring Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-cron-data",
    derivedOnly: false,
    expectedSources: ["operations_cron_monitoring_runtime"],
    groupKey: "cron-monitoring-production-certification",
    moduleKeys: ["op-cron-health"],
    productionGuarantee: "Cron Monitoring Runtime is read-only",
    runtimeCertificationGroupKey: "cron-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.cronMonitoringRuntime]
  },
  {
    certificationName: "Storage Metrics Production Certification",
    certificationScope: "OP-14 Storage Metrics Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-storage-data",
    derivedOnly: false,
    expectedSources: ["operations_storage_metrics_runtime"],
    groupKey: "storage-metrics-production-certification",
    moduleKeys: ["op-storage-metrics"],
    productionGuarantee: "Storage Metrics Runtime is read-only",
    runtimeCertificationGroupKey: "storage-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.storageMetricsRuntime]
  },
  {
    certificationName: "Backup Production Certification",
    certificationScope: "OP-15 Backup Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-backup-data",
    derivedOnly: false,
    expectedSources: ["operations_backup_runtime"],
    groupKey: "backup-production-certification",
    moduleKeys: ["op-backup"],
    productionGuarantee: "Backup Runtime is read-only",
    runtimeCertificationGroupKey: "backup-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.backupRuntime]
  },
  {
    certificationName: "Disaster Recovery Production Certification",
    certificationScope: "OP-16 Disaster Recovery Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-disaster-recovery-data",
    derivedOnly: false,
    expectedSources: ["operations_disaster_recovery_runtime"],
    groupKey: "disaster-recovery-production-certification",
    moduleKeys: ["op-disaster-recovery"],
    productionGuarantee: "Disaster Recovery Runtime is read-only",
    runtimeCertificationGroupKey: "disaster-recovery-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.disasterRecoveryRuntime]
  },
  {
    certificationName: "Diagnostics Production Certification",
    certificationScope: "OP-17 Diagnostics Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-diagnostics-data",
    derivedOnly: false,
    expectedSources: ["operations_diagnostics_runtime"],
    groupKey: "diagnostics-production-certification",
    moduleKeys: ["op-diagnostics"],
    productionGuarantee: "Diagnostics Runtime is read-only",
    runtimeCertificationGroupKey: "diagnostics-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.diagnosticsRuntime]
  },
  {
    certificationName: "Safe Controls Production Certification",
    certificationScope: "OP-18 Safe Controls Runtime is disabled and non-executable",
    dataCertificationKey: "op-cert-safe-controls-data",
    derivedOnly: false,
    expectedSources: ["operations_safe_controls_runtime"],
    groupKey: "safe-controls-production-certification",
    moduleKeys: ["op-safe-controls"],
    productionGuarantee: "Safe Controls Runtime is disabled and non-executable",
    runtimeCertificationGroupKey: "safe-controls-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.safeControlsRuntime]
  },
  {
    certificationName: "Status Production Certification",
    certificationScope: "OP-19 Operations Status Runtime is derived only and production-safe",
    dataCertificationKey: "op-cert-status-data",
    derivedOnly: true,
    expectedSources: ["operations_status_runtime"],
    groupKey: "status-production-certification",
    moduleKeys: ["operations_status_runtime"],
    productionGuarantee: "Operations Status Runtime is derived only",
    runtimeCertificationGroupKey: "status-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.statusRuntime]
  },
  {
    certificationName: "Visibility Production Certification",
    certificationScope: "OP-20 Operations Visibility Runtime is derived only and production-safe",
    dataCertificationKey: "op-cert-visibility-data",
    derivedOnly: true,
    expectedSources: ["operations_visibility_runtime"],
    groupKey: "visibility-production-certification",
    moduleKeys: ["operations_visibility_runtime"],
    productionGuarantee: "Operations Visibility Runtime is derived only",
    runtimeCertificationGroupKey: "visibility-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime]
  },
  {
    certificationName: "Audit Production Certification",
    certificationScope: "OP-21 Operations Audit Runtime is read-only and production-safe",
    dataCertificationKey: "op-cert-audit-data",
    derivedOnly: false,
    expectedSources: ["operations_audit_runtime"],
    groupKey: "audit-production-certification",
    moduleKeys: ["operations_audit_runtime"],
    productionGuarantee: "Operations Audit Runtime is read-only",
    runtimeCertificationGroupKey: "audit-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.auditRuntime]
  },
  {
    certificationName: "Review Production Certification",
    certificationScope: "OP-22 Operations Review Runtime is derived only and production-safe",
    dataCertificationKey: "op-cert-review-data",
    derivedOnly: true,
    expectedSources: ["operations_review_runtime"],
    groupKey: "review-production-certification",
    moduleKeys: ["operations_review_runtime"],
    productionGuarantee: "Operations Review Runtime is derived only",
    runtimeCertificationGroupKey: "review-runtime-certification",
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime]
  },
  {
    certificationName: "Data Certification Review",
    certificationScope: "OP-23 Operations Data Certification is read-only and production-safe",
    dataCertificationKey: null,
    derivedOnly: false,
    expectedSources: ["operations_data_certification_runtime"],
    groupKey: "data-certification-review",
    moduleKeys: ["operations_data_certification_runtime"],
    productionGuarantee: "Operations Data Certification is read-only",
    runtimeCertificationGroupKey: "data-certification-review",
    resolveRuntimeSnapshots: (input) => [input.dataCertification]
  },
  {
    certificationName: "Security Certification Review",
    certificationScope: "OP-24 Operations Security Certification is read-only and production-safe",
    dataCertificationKey: null,
    derivedOnly: false,
    expectedSources: ["operations_security_certification_runtime"],
    groupKey: "security-certification-review",
    moduleKeys: ["operations_security_certification_runtime"],
    productionGuarantee: "Operations Security Certification is read-only",
    runtimeCertificationGroupKey: "security-certification-review",
    resolveRuntimeSnapshots: (input) => [input.securityCertification]
  },
  {
    certificationName: "Runtime Certification Review",
    certificationScope: "OP-25 Operations Runtime Certification is read-only and production-safe",
    dataCertificationKey: null,
    derivedOnly: false,
    expectedSources: ["operations_runtime_certification_runtime"],
    groupKey: "runtime-certification-review",
    moduleKeys: ["operations_runtime_certification_runtime"],
    productionGuarantee: "Operations Runtime Certification is read-only",
    runtimeCertificationGroupKey: null,
    resolveRuntimeSnapshots: (input) => [input.runtimeCertification]
  }
] as const;

function buildSafeControls() {
  return OPERATIONS_PRODUCTION_CERTIFICATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function collectModuleCounts(input: OperationsProductionCertificationInput, moduleKeys: readonly string[]) {
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

function mapDataSafetyStatus(item: OperationsDataCertificationItem | null): OperationsProductionCertificationStatus {
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

function mapRuntimeCertificationStatus(
  item: OperationsRuntimeCertificationItem | null,
  field: keyof Pick<
    OperationsRuntimeCertificationItem,
    "dataSafetyStatus" | "executionSafetyStatus" | "mutationSafetyStatus" | "readOnlyStatus" | "runtimeIntegrityStatus" | "securitySafetyStatus"
  >
): OperationsProductionCertificationStatus {
  if (!item) {
    return "review_required";
  }

  return item[field];
}

function resolveProductionReadinessStatus(input: {
  blockedModules: number;
  dataSafetyStatus: OperationsProductionCertificationStatus;
  executionSafetyStatus: OperationsProductionCertificationStatus;
  mutationSafetyStatus: OperationsProductionCertificationStatus;
  readOnlyStatus: OperationsProductionCertificationStatus;
  runtimeIntegrityStatus: OperationsProductionCertificationStatus;
  runtimeShapeValid: boolean;
  securitySafetyStatus: OperationsProductionCertificationStatus;
  warningModules: number;
}): OperationsProductionReadinessStatus {
  if (
    !input.runtimeShapeValid ||
    input.blockedModules > 0 ||
    input.runtimeIntegrityStatus === "blocked" ||
    input.dataSafetyStatus === "blocked" ||
    input.securitySafetyStatus === "blocked"
  ) {
    return "blocked";
  }

  if (
    input.warningModules > 0 ||
    input.runtimeIntegrityStatus === "warning" ||
    input.dataSafetyStatus === "warning" ||
    input.securitySafetyStatus === "warning"
  ) {
    return "warning";
  }

  const ready =
    input.readOnlyStatus === "certified" &&
    input.mutationSafetyStatus === "certified" &&
    input.executionSafetyStatus === "certified" &&
    input.dataSafetyStatus === "certified" &&
    input.securitySafetyStatus === "certified" &&
    input.runtimeIntegrityStatus === "certified";

  return ready ? "production_ready" : "review_required";
}

function buildProductionCertificationItem(
  definition: ProductionScopeDefinition,
  input: OperationsProductionCertificationInput
): OperationsProductionCertificationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeShapeValid = validateRuntimeShape(snapshots, definition.expectedSources);
  const runtimeCertificationItem = definition.runtimeCertificationGroupKey
    ? input.runtimeCertificationItems.find((item) => item.groupKey === definition.runtimeCertificationGroupKey) ?? null
    : null;
  const dataCertificationItem = definition.dataCertificationKey
    ? input.dataCertificationItems.find((item) => item.certificationKey === definition.dataCertificationKey) ?? null
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
        : definition.groupKey === "runtime-certification-review"
          ? {
              blockedModules: input.runtimeCertification.blockedScopes,
              certifiedModules: input.runtimeCertification.certifiedScopes,
              warningModules: input.runtimeCertification.warningScopes
            }
          : collectModuleCounts(input, definition.moduleKeys);
  const readOnlyStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-certification-review"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "readOnlyStatus");
  const mutationSafetyStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-certification-review"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "mutationSafetyStatus");
  const executionSafetyStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-certification-review"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "executionSafetyStatus");
  const dataSafetyStatus =
    definition.groupKey === "data-certification-review"
      ? runtimeShapeValid
        ? "certified"
        : "review_required"
      : mapDataSafetyStatus(dataCertificationItem);
  const securitySafetyStatus =
    definition.groupKey === "security-certification-review" || definition.groupKey === "runtime-certification-review"
      ? runtimeShapeValid
        ? "certified"
        : "review_required"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "securitySafetyStatus");
  const runtimeIntegrityStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-certification-review"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "runtimeIntegrityStatus");
  const productionReadinessStatus = resolveProductionReadinessStatus({
    blockedModules: moduleCounts.blockedModules,
    dataSafetyStatus,
    executionSafetyStatus,
    mutationSafetyStatus,
    readOnlyStatus,
    runtimeIntegrityStatus,
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
    productionCertificationKey: `op-production-${definition.groupKey}`,
    productionReadinessStatus,
    readOnlyStatus,
    runtimeIntegrityStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `guarantee ${definition.productionGuarantee}`,
      `production ${productionReadinessStatus}`,
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

export function operationsProductionCertificationStatusLabel(status: OperationsProductionCertificationStatus) {
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

export function operationsProductionReadinessLabel(status: OperationsProductionReadinessStatus) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "production_ready":
      return "Production Ready";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function operationsProductionCertificationStatusTone(
  status: OperationsProductionCertificationStatus | OperationsProductionReadinessStatus
) {
  switch (status) {
    case "certified":
    case "production_ready":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
  }
}

export function isProductionScopeReady(item: OperationsProductionCertificationItem) {
  return item.productionReadinessStatus === "production_ready";
}

export function buildOperationsProductionCertificationGroups(
  items: OperationsProductionCertificationItem[]
): OperationsProductionCertificationGroup[] {
  return PRODUCTION_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsProductionCertificationSummary(
  items: OperationsProductionCertificationItem[]
): OperationsProductionCertificationSummary {
  const productionReadyScopes = items.filter((item) => isProductionScopeReady(item)).length;
  const reviewRequiredScopes = items.filter((item) => item.productionReadinessStatus === "review_required").length;
  const blockedScopes = items.filter((item) => item.productionReadinessStatus === "blocked").length;
  const warningScopes = items.filter((item) => item.productionReadinessStatus === "warning").length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0
      ? ("needs_attention" as const)
      : ("operations_production_certification_ready" as const);

  return {
    blockedScopes,
    groupCount: buildOperationsProductionCertificationGroups(items).length,
    overallStatus,
    productionReadyScopes,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    reviewRequiredScopes,
    source: OPERATIONS_PRODUCTION_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} production scopes`,
      `${productionReadyScopes} production ready`,
      `${reviewRequiredScopes} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`
    ].join("; "),
    totalCertifications: items.length,
    warningScopes
  };
}

export function buildOperationsProductionCertificationReadOnlySafe(input: OperationsProductionCertificationInput) {
  const productionCertificationItems = PRODUCTION_SCOPE_DEFINITIONS.map((definition) =>
    buildProductionCertificationItem(definition, input)
  );
  const groups = buildOperationsProductionCertificationGroups(productionCertificationItems);
  const summary = getOperationsProductionCertificationSummary(productionCertificationItems);

  return {
    groups,
    productionCertification: summary,
    productionCertificationItems,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsProductionCertificationToAdminFields(
  input: ReturnType<typeof buildOperationsProductionCertificationReadOnlySafe>
) {
  return {
    groups: input.groups,
    productionCertification: input.productionCertification,
    productionCertificationItems: input.productionCertificationItems,
    safeControls: input.safeControls
  };
}
