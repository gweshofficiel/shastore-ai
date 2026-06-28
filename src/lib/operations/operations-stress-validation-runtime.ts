import "server-only";

import type {
  OperationsDataCertificationSummary
} from "@/src/lib/operations/operations-data-certification-runtime";
import { OPERATIONS_REGISTRY_SOURCE } from "@/src/lib/operations/operations-registry-runtime";
import type {
  OperationsProductionCertificationItem,
  OperationsProductionCertificationSummary
} from "@/src/lib/operations/operations-production-certification-runtime";
import type {
  OperationsRuntimeCertificationSummary
} from "@/src/lib/operations/operations-runtime-certification-runtime";
import type {
  OperationsSecurityCertificationItem,
  OperationsSecurityCertificationSummary
} from "@/src/lib/operations/operations-security-certification-runtime";
import type { OperationsReviewRuntimeItem } from "@/src/lib/operations/operations-review-runtime";

export type OperationsStressValidationSource = "operations_stress_validation_runtime";

export type OperationsStressValidationGroupKey =
  | "ai-queue-stress-validation"
  | "audit-stress-validation"
  | "backup-stress-validation"
  | "certification-stress-validation"
  | "cron-stress-validation"
  | "dashboard-stress-validation"
  | "database-stress-validation"
  | "diagnostics-stress-validation"
  | "disaster-recovery-stress-validation"
  | "domain-email-queue-stress-validation"
  | "email-queue-stress-validation"
  | "monitoring-stress-validation"
  | "queue-stress-validation"
  | "registry-stress-validation"
  | "review-stress-validation"
  | "safe-controls-stress-validation"
  | "status-stress-validation"
  | "storage-stress-validation"
  | "visibility-stress-validation"
  | "worker-stress-validation";

export type OperationsStressValidationStatus = "blocked" | "review_required" | "stable" | "warning";

export type OperationsStressValidationSafeControlKey =
  | "export_stress_report"
  | "mark_stress_validated"
  | "recheck_stability"
  | "resolve_stress_blocker"
  | "run_stress_test";

export type OperationsStressValidationSafeControl = {
  enabled: false;
  key: OperationsStressValidationSafeControlKey;
  label: string;
  note: string;
};

export type OperationsStressValidationItem = {
  blockedModules: number;
  certifiedSystemIsolationStatus: OperationsStressValidationStatus;
  disabledControlsStatus: OperationsStressValidationStatus;
  emptyStateSafetyStatus: OperationsStressValidationStatus;
  executionSafetyStatus: OperationsStressValidationStatus;
  groupKey: OperationsStressValidationGroupKey;
  metadataConsistencyStatus: OperationsStressValidationStatus;
  mutationSafetyStatus: OperationsStressValidationStatus;
  refreshStabilityStatus: OperationsStressValidationStatus;
  safeControls: OperationsStressValidationSafeControl[];
  safeSummary: string;
  secretSafetyStatus: OperationsStressValidationStatus;
  stressValidationKey: string;
  validationName: string;
  validationScope: string;
  warningModules: number;
};

export type OperationsStressValidationGroup = {
  groupKey: OperationsStressValidationGroupKey;
  itemCount: number;
  items: OperationsStressValidationItem[];
  title: string;
};

export type OperationsStressValidationSummary = {
  blockedScopes: number;
  groupCount: number;
  overallStatus: "needs_attention" | "operations_stress_validation_ready";
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  reviewRequiredScopes: number;
  source: OperationsStressValidationSource;
  stableScopes: number;
  summary: string;
  totalValidations: number;
  warningScopes: number;
};

type RuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

type SafeControlSnapshot = {
  enabled: boolean;
};

export type OperationsStressValidationInput = {
  aiQueueRuntime: RuntimeSnapshot;
  aiQueueSafeControls: SafeControlSnapshot[];
  auditRuntime: RuntimeSnapshot;
  backupRuntime: RuntimeSnapshot;
  backupSafeControls: SafeControlSnapshot[];
  cronMonitoringRuntime: RuntimeSnapshot;
  cronMonitoringSafeControls: SafeControlSnapshot[];
  cronRuntime: RuntimeSnapshot;
  cronSafeControls: SafeControlSnapshot[];
  dashboardRuntime: RuntimeSnapshot;
  dataCertification: OperationsDataCertificationSummary;
  dataCertificationSafeControls: SafeControlSnapshot[];
  databaseRuntime: RuntimeSnapshot;
  databaseSafeControls: SafeControlSnapshot[];
  diagnosticsRuntime: RuntimeSnapshot;
  diagnosticsSafeControls: SafeControlSnapshot[];
  disasterRecoveryRuntime: RuntimeSnapshot;
  disasterRecoverySafeControls: SafeControlSnapshot[];
  domainEmailQueueRuntime: RuntimeSnapshot;
  domainEmailQueueSafeControls: SafeControlSnapshot[];
  emailQueueRuntime: RuntimeSnapshot;
  emailQueueSafeControls: SafeControlSnapshot[];
  monitoringEventsRuntime: RuntimeSnapshot;
  monitoringEventsSafeControls: SafeControlSnapshot[];
  productionCertification: OperationsProductionCertificationSummary;
  productionCertificationItems: OperationsProductionCertificationItem[];
  productionCertificationSafeControls: SafeControlSnapshot[];
  queueRuntime: RuntimeSnapshot;
  queueSafeControls: SafeControlSnapshot[];
  registryRuntime: RuntimeSnapshot;
  reviewItems: OperationsReviewRuntimeItem[];
  reviewRuntime: RuntimeSnapshot;
  reviewSafeControls: SafeControlSnapshot[];
  runtimeCertification: OperationsRuntimeCertificationSummary;
  runtimeCertificationSafeControls: SafeControlSnapshot[];
  safeControlsRuntime: RuntimeSnapshot;
  safeControlsSafeControls: SafeControlSnapshot[];
  securityCertification: OperationsSecurityCertificationSummary;
  securityCertificationItems: OperationsSecurityCertificationItem[];
  securityCertificationSafeControls: SafeControlSnapshot[];
  statusRuntime: RuntimeSnapshot;
  storageMetricsRuntime: RuntimeSnapshot;
  storageMetricsSafeControls: SafeControlSnapshot[];
  storageRuntime: RuntimeSnapshot;
  storageSafeControls: SafeControlSnapshot[];
  visibilityRuntime: RuntimeSnapshot;
  workerMonitoringRuntime: RuntimeSnapshot;
  workerMonitoringSafeControls: SafeControlSnapshot[];
  workerRuntime: RuntimeSnapshot;
  workerSafeControls: SafeControlSnapshot[];
  auditSafeControls: SafeControlSnapshot[];
};

type StressScopeDefinition = {
  expectedSources: readonly string[];
  groupKey: OperationsStressValidationGroupKey;
  moduleKeys: readonly string[];
  productionCertificationGroupKey: string | null;
  resolveRuntimeSnapshots: (input: OperationsStressValidationInput) => RuntimeSnapshot[];
  resolveSafeControls: (input: OperationsStressValidationInput) => SafeControlSnapshot[];
  securityCertificationGroupKey: string | null;
  stressCondition: string;
  validationName: string;
  validationScope: string;
};

export const OPERATIONS_STRESS_VALIDATION_SOURCE = "operations_stress_validation_runtime" as const;

export const OPERATIONS_STRESS_VALIDATION_SAFE_CONTROLS: readonly OperationsStressValidationSafeControl[] = [
  {
    enabled: false,
    key: "run_stress_test",
    label: "Run Stress Test",
    note: "Read-only placeholder. No stress execution, provider call, or mutation runs during OP-27 page load."
  },
  {
    enabled: false,
    key: "recheck_stability",
    label: "Recheck Stability",
    note: "Read-only placeholder. No stability recheck execution or mutation runs during OP-27 page load."
  },
  {
    enabled: false,
    key: "export_stress_report",
    label: "Export Stress Report",
    note: "Read-only placeholder. No stress export or provider call runs during OP-27 page load."
  },
  {
    enabled: false,
    key: "resolve_stress_blocker",
    label: "Resolve Stress Blocker",
    note: "Read-only placeholder. No stress blocker resolve action runs during OP-27 page load."
  },
  {
    enabled: false,
    key: "mark_stress_validated",
    label: "Mark Stress Validated",
    note: "Read-only placeholder. No stress validation record write or registry mutation runs during OP-27 page load."
  }
] as const;

const STRESS_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsStressValidationGroupKey;
  title: string;
}> = [
  { groupKey: "registry-stress-validation", title: "Registry Stress Validation" },
  { groupKey: "dashboard-stress-validation", title: "Dashboard Stress Validation" },
  { groupKey: "queue-stress-validation", title: "Queue Stress Validation" },
  { groupKey: "worker-stress-validation", title: "Worker Stress Validation" },
  { groupKey: "cron-stress-validation", title: "Cron Stress Validation" },
  { groupKey: "storage-stress-validation", title: "Storage Stress Validation" },
  { groupKey: "database-stress-validation", title: "Database Stress Validation" },
  { groupKey: "email-queue-stress-validation", title: "Email Queue Stress Validation" },
  { groupKey: "ai-queue-stress-validation", title: "AI Queue Stress Validation" },
  { groupKey: "domain-email-queue-stress-validation", title: "Domain & Email Queue Stress Validation" },
  { groupKey: "monitoring-stress-validation", title: "Monitoring Stress Validation" },
  { groupKey: "backup-stress-validation", title: "Backup Stress Validation" },
  { groupKey: "disaster-recovery-stress-validation", title: "Disaster Recovery Stress Validation" },
  { groupKey: "diagnostics-stress-validation", title: "Diagnostics Stress Validation" },
  { groupKey: "safe-controls-stress-validation", title: "Safe Controls Stress Validation" },
  { groupKey: "status-stress-validation", title: "Status Stress Validation" },
  { groupKey: "visibility-stress-validation", title: "Visibility Stress Validation" },
  { groupKey: "audit-stress-validation", title: "Audit Stress Validation" },
  { groupKey: "review-stress-validation", title: "Review Stress Validation" },
  { groupKey: "certification-stress-validation", title: "Certification Stress Validation" }
];

const STRESS_SCOPE_DEFINITIONS: readonly StressScopeDefinition[] = [
  {
    expectedSources: ["operations_registry_runtime"],
    groupKey: "registry-stress-validation",
    moduleKeys: ["operations_registry_runtime"],
    productionCertificationGroupKey: "registry-production-certification",
    resolveRuntimeSnapshots: (input) => [input.registryRuntime],
    resolveSafeControls: () => [],
    securityCertificationGroupKey: "registry-security-certification",
    stressCondition: "deterministic registry output under safe render",
    validationName: "Registry Stress Validation",
    validationScope: "OP-1 registry refresh stability and metadata consistency"
  },
  {
    expectedSources: ["operations_dashboard_runtime", "operations_registry_runtime"],
    groupKey: "dashboard-stress-validation",
    moduleKeys: ["operations_dashboard_runtime"],
    productionCertificationGroupKey: "dashboard-production-certification",
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime, input.registryRuntime],
    resolveSafeControls: () => [],
    securityCertificationGroupKey: "dashboard-security-certification",
    stressCondition: "deterministic dashboard output under safe render",
    validationName: "Dashboard Stress Validation",
    validationScope: "OP-2 dashboard refresh stability and registry-derived consistency"
  },
  {
    expectedSources: ["operations_queue_runtime"],
    groupKey: "queue-stress-validation",
    moduleKeys: ["op-queue-tables"],
    productionCertificationGroupKey: "queue-production-certification",
    resolveRuntimeSnapshots: (input) => [input.queueRuntime],
    resolveSafeControls: (input) => input.queueSafeControls,
    securityCertificationGroupKey: "queue-security-certification",
    stressCondition: "read-only queue metadata stability",
    validationName: "Queue Stress Validation",
    validationScope: "OP-3 queue refresh stability with disabled controls and safe empty states"
  },
  {
    expectedSources: ["operations_worker_runtime", "operations_worker_monitoring_runtime"],
    groupKey: "worker-stress-validation",
    moduleKeys: ["op-worker-tables", "op-worker-health"],
    productionCertificationGroupKey: "worker-production-certification",
    resolveRuntimeSnapshots: (input) => [input.workerRuntime, input.workerMonitoringRuntime],
    resolveSafeControls: (input) => [...input.workerSafeControls, ...input.workerMonitoringSafeControls],
    securityCertificationGroupKey: "worker-security-certification",
    stressCondition: "read-only worker metadata stability",
    validationName: "Worker Stress Validation",
    validationScope: "OP-4 and OP-12 worker refresh stability with disabled controls"
  },
  {
    expectedSources: ["operations_cron_runtime", "operations_cron_monitoring_runtime"],
    groupKey: "cron-stress-validation",
    moduleKeys: ["op-cron-jobs", "op-cron-health"],
    productionCertificationGroupKey: "cron-production-certification",
    resolveRuntimeSnapshots: (input) => [input.cronRuntime, input.cronMonitoringRuntime],
    resolveSafeControls: (input) => [...input.cronSafeControls, ...input.cronMonitoringSafeControls],
    securityCertificationGroupKey: "cron-security-certification",
    stressCondition: "read-only cron metadata stability",
    validationName: "Cron Stress Validation",
    validationScope: "OP-5 and OP-13 cron refresh stability with disabled controls"
  },
  {
    expectedSources: ["operations_storage_runtime", "operations_storage_metrics_runtime"],
    groupKey: "storage-stress-validation",
    moduleKeys: ["op-storage-health", "op-storage-metrics"],
    productionCertificationGroupKey: "storage-production-certification",
    resolveRuntimeSnapshots: (input) => [input.storageRuntime, input.storageMetricsRuntime],
    resolveSafeControls: (input) => [...input.storageSafeControls, ...input.storageMetricsSafeControls],
    securityCertificationGroupKey: "storage-security-certification",
    stressCondition: "read-only storage metadata stability",
    validationName: "Storage Stress Validation",
    validationScope: "OP-5 and OP-14 storage refresh stability with safe empty states"
  },
  {
    expectedSources: ["operations_database_runtime"],
    groupKey: "database-stress-validation",
    moduleKeys: ["op-database-health"],
    productionCertificationGroupKey: "database-production-certification",
    resolveRuntimeSnapshots: (input) => [input.databaseRuntime],
    resolveSafeControls: (input) => input.databaseSafeControls,
    securityCertificationGroupKey: "database-security-certification",
    stressCondition: "read-only database metadata stability",
    validationName: "Database Stress Validation",
    validationScope: "OP-6 database refresh stability with disabled controls"
  },
  {
    expectedSources: ["operations_email_queue_runtime"],
    groupKey: "email-queue-stress-validation",
    moduleKeys: ["op-email-queue"],
    productionCertificationGroupKey: "email-queue-production-certification",
    resolveRuntimeSnapshots: (input) => [input.emailQueueRuntime],
    resolveSafeControls: (input) => input.emailQueueSafeControls,
    securityCertificationGroupKey: "email-queue-security-certification",
    stressCondition: "read-only email queue metadata stability",
    validationName: "Email Queue Stress Validation",
    validationScope: "OP-7 email queue refresh stability with safe empty states"
  },
  {
    expectedSources: ["operations_ai_queue_runtime"],
    groupKey: "ai-queue-stress-validation",
    moduleKeys: ["op-ai-queue"],
    productionCertificationGroupKey: "ai-queue-production-certification",
    resolveRuntimeSnapshots: (input) => [input.aiQueueRuntime],
    resolveSafeControls: (input) => input.aiQueueSafeControls,
    securityCertificationGroupKey: "ai-queue-security-certification",
    stressCondition: "read-only AI queue metadata stability",
    validationName: "AI Queue Stress Validation",
    validationScope: "OP-8 AI queue refresh stability with disabled controls"
  },
  {
    expectedSources: ["operations_domain_email_queue_runtime"],
    groupKey: "domain-email-queue-stress-validation",
    moduleKeys: ["op-domain-email-queue"],
    productionCertificationGroupKey: "domain-email-queue-production-certification",
    resolveRuntimeSnapshots: (input) => [input.domainEmailQueueRuntime],
    resolveSafeControls: (input) => input.domainEmailQueueSafeControls,
    securityCertificationGroupKey: "domain-email-queue-security-certification",
    stressCondition: "read-only domain and email queue metadata stability",
    validationName: "Domain & Email Queue Stress Validation",
    validationScope: "OP-9 domain and email queue refresh stability with safe empty states"
  },
  {
    expectedSources: ["operations_monitoring_events_runtime"],
    groupKey: "monitoring-stress-validation",
    moduleKeys: ["op-monitoring-events"],
    productionCertificationGroupKey: "monitoring-production-certification",
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime],
    resolveSafeControls: (input) => input.monitoringEventsSafeControls,
    securityCertificationGroupKey: "monitoring-security-certification",
    stressCondition: "read-only monitoring metadata stability",
    validationName: "Monitoring Stress Validation",
    validationScope: "OP-11 monitoring refresh stability with safe empty states"
  },
  {
    expectedSources: ["operations_backup_runtime"],
    groupKey: "backup-stress-validation",
    moduleKeys: ["op-backup"],
    productionCertificationGroupKey: "backup-production-certification",
    resolveRuntimeSnapshots: (input) => [input.backupRuntime],
    resolveSafeControls: (input) => input.backupSafeControls,
    securityCertificationGroupKey: "backup-security-certification",
    stressCondition: "read-only backup metadata stability",
    validationName: "Backup Stress Validation",
    validationScope: "OP-15 backup refresh stability without execution"
  },
  {
    expectedSources: ["operations_disaster_recovery_runtime"],
    groupKey: "disaster-recovery-stress-validation",
    moduleKeys: ["op-disaster-recovery"],
    productionCertificationGroupKey: "disaster-recovery-production-certification",
    resolveRuntimeSnapshots: (input) => [input.disasterRecoveryRuntime],
    resolveSafeControls: (input) => input.disasterRecoverySafeControls,
    securityCertificationGroupKey: "disaster-recovery-security-certification",
    stressCondition: "read-only disaster recovery metadata stability",
    validationName: "Disaster Recovery Stress Validation",
    validationScope: "OP-16 disaster recovery refresh stability without execution"
  },
  {
    expectedSources: ["operations_diagnostics_runtime"],
    groupKey: "diagnostics-stress-validation",
    moduleKeys: ["op-diagnostics"],
    productionCertificationGroupKey: "diagnostics-production-certification",
    resolveRuntimeSnapshots: (input) => [input.diagnosticsRuntime],
    resolveSafeControls: (input) => input.diagnosticsSafeControls,
    securityCertificationGroupKey: "diagnostics-security-certification",
    stressCondition: "read-only diagnostics metadata stability",
    validationName: "Diagnostics Stress Validation",
    validationScope: "OP-17 diagnostics refresh stability without execution"
  },
  {
    expectedSources: ["operations_safe_controls_runtime"],
    groupKey: "safe-controls-stress-validation",
    moduleKeys: ["op-safe-controls"],
    productionCertificationGroupKey: "safe-controls-production-certification",
    resolveRuntimeSnapshots: (input) => [input.safeControlsRuntime],
    resolveSafeControls: (input) => input.safeControlsSafeControls,
    securityCertificationGroupKey: "safe-controls-security-certification",
    stressCondition: "disabled safe controls remain non-executable",
    validationName: "Safe Controls Stress Validation",
    validationScope: "OP-18 safe controls refresh stability with disabled execution"
  },
  {
    expectedSources: ["operations_status_runtime"],
    groupKey: "status-stress-validation",
    moduleKeys: ["operations_status_runtime"],
    productionCertificationGroupKey: "status-production-certification",
    resolveRuntimeSnapshots: (input) => [input.statusRuntime],
    resolveSafeControls: () => [],
    securityCertificationGroupKey: "status-security-certification",
    stressCondition: "derived status metadata stability",
    validationName: "Status Stress Validation",
    validationScope: "OP-19 status refresh stability with derived-only output"
  },
  {
    expectedSources: ["operations_visibility_runtime"],
    groupKey: "visibility-stress-validation",
    moduleKeys: ["operations_visibility_runtime"],
    productionCertificationGroupKey: "visibility-production-certification",
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime],
    resolveSafeControls: () => [],
    securityCertificationGroupKey: "visibility-security-certification",
    stressCondition: "derived visibility metadata stability",
    validationName: "Visibility Stress Validation",
    validationScope: "OP-20 visibility refresh stability with derived-only output"
  },
  {
    expectedSources: ["operations_audit_runtime"],
    groupKey: "audit-stress-validation",
    moduleKeys: ["operations_audit_runtime"],
    productionCertificationGroupKey: "audit-production-certification",
    resolveRuntimeSnapshots: (input) => [input.auditRuntime],
    resolveSafeControls: (input) => input.auditSafeControls,
    securityCertificationGroupKey: "audit-security-certification",
    stressCondition: "read-only audit metadata stability",
    validationName: "Audit Stress Validation",
    validationScope: "OP-21 audit refresh stability with safe empty states"
  },
  {
    expectedSources: ["operations_review_runtime"],
    groupKey: "review-stress-validation",
    moduleKeys: ["operations_review_runtime"],
    productionCertificationGroupKey: "review-production-certification",
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime],
    resolveSafeControls: (input) => input.reviewSafeControls,
    securityCertificationGroupKey: "review-security-certification",
    stressCondition: "derived review metadata stability",
    validationName: "Review Stress Validation",
    validationScope: "OP-22 review refresh stability with derived-only output"
  },
  {
    expectedSources: [
      "operations_data_certification_runtime",
      "operations_security_certification_runtime",
      "operations_runtime_certification_runtime",
      "operations_production_certification_runtime"
    ],
    groupKey: "certification-stress-validation",
    moduleKeys: [
      "operations_data_certification_runtime",
      "operations_security_certification_runtime",
      "operations_runtime_certification_runtime",
      "operations_production_certification_runtime"
    ],
    productionCertificationGroupKey: null,
    resolveRuntimeSnapshots: (input) => [
      input.dataCertification,
      input.securityCertification,
      input.runtimeCertification,
      input.productionCertification
    ],
    resolveSafeControls: (input) => [
      ...input.dataCertificationSafeControls,
      ...input.securityCertificationSafeControls,
      ...input.runtimeCertificationSafeControls,
      ...input.productionCertificationSafeControls
    ],
    securityCertificationGroupKey: "data-certification-security-review",
    stressCondition: "certification metadata stability without persistence",
    validationName: "Certification Stress Validation",
    validationScope: "OP-23 through OP-26 certification refresh stability and isolation"
  }
] as const;

function buildSafeControls() {
  return OPERATIONS_STRESS_VALIDATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function collectModuleCounts(input: OperationsStressValidationInput, moduleKeys: readonly string[]) {
  const reviewItems = input.reviewItems.filter((item) => moduleKeys.includes(item.moduleKey));

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
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

function validateSafeControlsDisabled(controls: SafeControlSnapshot[]) {
  if (!controls.length) {
    return true;
  }

  return controls.every((control) => control.enabled === false);
}

function validateCertifiedSystemIsolation(snapshots: RuntimeSnapshot[]) {
  return snapshots.every((snapshot) => String(snapshot.source).startsWith("operations_"));
}

function mapProductionStatusToStressStatus(
  status: OperationsProductionCertificationItem["readOnlyStatus"] | undefined
): OperationsStressValidationStatus {
  switch (status) {
    case "certified":
      return "stable";
    case "warning":
      return "warning";
    case "blocked":
      return "blocked";
    case "review_required":
    default:
      return "review_required";
  }
}

function mapSecuritySecretStatus(item: OperationsSecurityCertificationItem | null): OperationsStressValidationStatus {
  if (!item) {
    return "review_required";
  }

  return item.secretSafetyStatus === "certified" ? "stable" : "review_required";
}

function resolveEmptyStateSafetyStatus(input: {
  blockedModules: number;
  runtimeShapeValid: boolean;
  warningModules: number;
}): OperationsStressValidationStatus {
  if (!input.runtimeShapeValid) {
    return "review_required";
  }

  if (input.blockedModules > 0) {
    return "blocked";
  }

  if (input.warningModules > 0) {
    return "warning";
  }

  return "stable";
}

function resolveMetadataConsistencyStatus(input: {
  productionCertificationItem: OperationsProductionCertificationItem | null;
  runtimeShapeValid: boolean;
}): OperationsStressValidationStatus {
  if (!input.runtimeShapeValid) {
    return "review_required";
  }

  if (!input.productionCertificationItem) {
    return input.runtimeShapeValid ? "stable" : "review_required";
  }

  switch (input.productionCertificationItem.productionReadinessStatus) {
    case "production_ready":
      return "stable";
    case "warning":
      return "warning";
    case "blocked":
      return "blocked";
    case "review_required":
    default:
      return "review_required";
  }
}

function buildStressValidationItem(
  definition: StressScopeDefinition,
  input: OperationsStressValidationInput
): OperationsStressValidationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeShapeValid = validateRuntimeShape(snapshots, definition.expectedSources);
  const safeControls = definition.resolveSafeControls(input);
  const productionCertificationItem = definition.productionCertificationGroupKey
    ? input.productionCertificationItems.find((item) => item.groupKey === definition.productionCertificationGroupKey) ?? null
    : null;
  const securityCertificationItem = definition.securityCertificationGroupKey
    ? input.securityCertificationItems.find((item) => item.groupKey === definition.securityCertificationGroupKey) ?? null
    : null;
  const moduleCounts =
    definition.groupKey === "certification-stress-validation"
      ? {
          blockedModules: input.productionCertification.blockedScopes,
          warningModules: input.productionCertification.warningScopes
        }
      : collectModuleCounts(input, definition.moduleKeys);
  const refreshStabilityStatus: OperationsStressValidationStatus = runtimeShapeValid ? "stable" : "review_required";
  const metadataConsistencyStatus = resolveMetadataConsistencyStatus({
    productionCertificationItem,
    runtimeShapeValid
  });
  const emptyStateSafetyStatus = resolveEmptyStateSafetyStatus({
    blockedModules: moduleCounts.blockedModules,
    runtimeShapeValid,
    warningModules: moduleCounts.warningModules
  });
  const disabledControlsStatus: OperationsStressValidationStatus = validateSafeControlsDisabled(safeControls)
    ? "stable"
    : "blocked";
  const executionSafetyStatus = runtimeShapeValid
    ? mapProductionStatusToStressStatus(productionCertificationItem?.executionSafetyStatus)
    : "review_required";
  const mutationSafetyStatus = runtimeShapeValid
    ? mapProductionStatusToStressStatus(productionCertificationItem?.mutationSafetyStatus)
    : "review_required";
  const secretSafetyStatus = mapSecuritySecretStatus(securityCertificationItem);
  const certifiedSystemIsolationStatus: OperationsStressValidationStatus =
    runtimeShapeValid && validateCertifiedSystemIsolation(snapshots) ? "stable" : "blocked";

  return {
    blockedModules: moduleCounts.blockedModules,
    certifiedSystemIsolationStatus,
    disabledControlsStatus,
    emptyStateSafetyStatus,
    executionSafetyStatus,
    groupKey: definition.groupKey,
    metadataConsistencyStatus,
    mutationSafetyStatus,
    refreshStabilityStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `condition ${definition.stressCondition}`,
      `refresh ${refreshStabilityStatus}`,
      `metadata ${metadataConsistencyStatus}`,
      `empty state ${emptyStateSafetyStatus}`,
      `controls ${disabledControlsStatus}`,
      `execution ${executionSafetyStatus}`,
      `mutation ${mutationSafetyStatus}`,
      `secrets ${secretSafetyStatus}`,
      `isolation ${certifiedSystemIsolationStatus}`,
      `${moduleCounts.blockedModules} blocked`,
      `${moduleCounts.warningModules} warning`
    ].join("; "),
    secretSafetyStatus,
    stressValidationKey: `op-stress-${definition.groupKey}`,
    validationName: definition.validationName,
    validationScope: definition.validationScope,
    warningModules: moduleCounts.warningModules
  };
}

export function isStressScopeStable(item: OperationsStressValidationItem) {
  return (
    item.refreshStabilityStatus === "stable" &&
    item.metadataConsistencyStatus === "stable" &&
    item.emptyStateSafetyStatus === "stable" &&
    item.disabledControlsStatus === "stable" &&
    item.executionSafetyStatus === "stable" &&
    item.mutationSafetyStatus === "stable" &&
    item.secretSafetyStatus === "stable" &&
    item.certifiedSystemIsolationStatus === "stable"
  );
}

export function buildOperationsStressValidationGroups(items: OperationsStressValidationItem[]) {
  return STRESS_GROUP_DEFINITIONS.map((definition) => {
    const groupItems = items.filter((item) => item.groupKey === definition.groupKey);

    return {
      groupKey: definition.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: definition.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsStressValidationSummary(
  items: OperationsStressValidationItem[]
): OperationsStressValidationSummary {
  const stableScopes = items.filter((item) => isStressScopeStable(item)).length;
  const reviewRequiredScopes = items.filter(
    (item) =>
      !isStressScopeStable(item) &&
      item.refreshStabilityStatus !== "blocked" &&
      item.metadataConsistencyStatus !== "blocked" &&
      item.emptyStateSafetyStatus !== "blocked" &&
      item.disabledControlsStatus !== "blocked" &&
      item.certifiedSystemIsolationStatus !== "blocked"
  ).length;
  const blockedScopes = items.filter(
    (item) =>
      item.refreshStabilityStatus === "blocked" ||
      item.metadataConsistencyStatus === "blocked" ||
      item.emptyStateSafetyStatus === "blocked" ||
      item.disabledControlsStatus === "blocked" ||
      item.executionSafetyStatus === "blocked" ||
      item.mutationSafetyStatus === "blocked" ||
      item.secretSafetyStatus === "blocked" ||
      item.certifiedSystemIsolationStatus === "blocked"
  ).length;
  const warningScopes = items.filter(
    (item) =>
      item.metadataConsistencyStatus === "warning" ||
      item.emptyStateSafetyStatus === "warning" ||
      item.executionSafetyStatus === "warning" ||
      item.mutationSafetyStatus === "warning" ||
      item.secretSafetyStatus === "warning"
  ).length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0
      ? ("needs_attention" as const)
      : ("operations_stress_validation_ready" as const);

  return {
    blockedScopes,
    groupCount: buildOperationsStressValidationGroups(items).length,
    overallStatus,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    reviewRequiredScopes,
    source: OPERATIONS_STRESS_VALIDATION_SOURCE,
    stableScopes,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} stress validations`,
      `${stableScopes} stable`,
      `${reviewRequiredScopes} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`
    ].join("; "),
    totalValidations: items.length,
    warningScopes
  };
}

export function operationsStressValidationStatusLabel(status: OperationsStressValidationStatus) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "review_required":
      return "Review Required";
    case "stable":
      return "Stable";
    case "warning":
      return "Warning";
  }
}

export function operationsStressValidationStatusTone(status: OperationsStressValidationStatus) {
  switch (status) {
    case "stable":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
  }
}

export function buildOperationsStressValidationReadOnlySafe(input: OperationsStressValidationInput) {
  const stressValidationItems = STRESS_SCOPE_DEFINITIONS.map((definition) => buildStressValidationItem(definition, input));
  const groups = buildOperationsStressValidationGroups(stressValidationItems);
  const summary = getOperationsStressValidationSummary(stressValidationItems);

  return {
    groups,
    safeControls: buildSafeControls(),
    stressValidation: summary,
    stressValidationItems
  };
}

export function mapOperationsStressValidationToAdminFields(
  input: ReturnType<typeof buildOperationsStressValidationReadOnlySafe>
) {
  return {
    groups: input.groups,
    safeControls: input.safeControls,
    stressValidation: input.stressValidation,
    stressValidationItems: input.stressValidationItems
  };
}
