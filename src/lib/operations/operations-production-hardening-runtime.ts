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
import type { OperationsReviewRuntimeItem } from "@/src/lib/operations/operations-review-runtime";
import type {
  OperationsSecurityCertificationItem,
  OperationsSecurityCertificationSummary
} from "@/src/lib/operations/operations-security-certification-runtime";
import {
  isStressScopeStable,
  type OperationsStressValidationItem,
  type OperationsStressValidationSummary
} from "@/src/lib/operations/operations-stress-validation-runtime";

export type OperationsProductionHardeningSource = "operations_production_hardening_runtime";

export type OperationsProductionHardeningGroupKey =
  | "ai-queue-hardening"
  | "audit-hardening"
  | "backup-hardening"
  | "certification-hardening"
  | "cron-hardening"
  | "dashboard-hardening"
  | "database-hardening"
  | "diagnostics-hardening"
  | "disaster-recovery-hardening"
  | "domain-email-queue-hardening"
  | "email-queue-hardening"
  | "monitoring-hardening"
  | "queue-hardening"
  | "registry-hardening"
  | "review-hardening"
  | "safe-controls-hardening"
  | "status-hardening"
  | "storage-hardening"
  | "stress-validation-hardening"
  | "visibility-hardening"
  | "worker-hardening";

export type OperationsProductionHardeningStatus = "blocked" | "hardened" | "review_required" | "warning";

export type OperationsProductionHardeningSafeControlKey =
  | "apply_hardening"
  | "export_hardening_report"
  | "mark_hardened"
  | "recheck_hardening"
  | "resolve_hardening_blocker";

export type OperationsProductionHardeningSafeControl = {
  enabled: false;
  key: OperationsProductionHardeningSafeControlKey;
  label: string;
  note: string;
};

export type OperationsProductionHardeningItem = {
  blockedModules: number;
  certifiedSystemIsolationStatus: OperationsProductionHardeningStatus;
  controlSafetyStatus: OperationsProductionHardeningStatus;
  emptyStateStatus: OperationsProductionHardeningStatus;
  executionIsolationStatus: OperationsProductionHardeningStatus;
  groupKey: OperationsProductionHardeningGroupKey;
  hardeningKey: string;
  hardeningName: string;
  hardeningScope: string;
  mutationIsolationStatus: OperationsProductionHardeningStatus;
  readOnlyHardeningStatus: OperationsProductionHardeningStatus;
  safeControls: OperationsProductionHardeningSafeControl[];
  safeSummary: string;
  secretMaskingStatus: OperationsProductionHardeningStatus;
  warningModules: number;
};

export type OperationsProductionHardeningGroup = {
  groupKey: OperationsProductionHardeningGroupKey;
  itemCount: number;
  items: OperationsProductionHardeningItem[];
  title: string;
};

export type OperationsProductionHardeningSummary = {
  blockedScopes: number;
  groupCount: number;
  hardenedScopes: number;
  overallStatus: "needs_attention" | "operations_production_hardening_ready";
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  reviewRequiredScopes: number;
  source: OperationsProductionHardeningSource;
  summary: string;
  totalHardeningScopes: number;
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

export type OperationsProductionHardeningInput = {
  aiQueueRuntime: RuntimeSnapshot;
  aiQueueSafeControls: SafeControlSnapshot[];
  auditRuntime: RuntimeSnapshot;
  auditSafeControls: SafeControlSnapshot[];
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
  stressValidation: OperationsStressValidationSummary;
  stressValidationItems: OperationsStressValidationItem[];
  stressValidationSafeControls: SafeControlSnapshot[];
  visibilityRuntime: RuntimeSnapshot;
  workerMonitoringRuntime: RuntimeSnapshot;
  workerMonitoringSafeControls: SafeControlSnapshot[];
  workerRuntime: RuntimeSnapshot;
  workerSafeControls: SafeControlSnapshot[];
};

type HardeningScopeDefinition = {
  expectedSources: readonly string[];
  groupKey: OperationsProductionHardeningGroupKey;
  hardeningGuarantee: string;
  hardeningName: string;
  hardeningScope: string;
  moduleKeys: readonly string[];
  resolveRuntimeSnapshots: (input: OperationsProductionHardeningInput) => RuntimeSnapshot[];
  resolveSafeControls: (input: OperationsProductionHardeningInput) => SafeControlSnapshot[];
  securityCertificationGroupKey: string | null;
  stressValidationGroupKey: string | null;
};

export const OPERATIONS_PRODUCTION_HARDENING_SOURCE = "operations_production_hardening_runtime" as const;

export const OPERATIONS_PRODUCTION_HARDENING_SAFE_CONTROLS: readonly OperationsProductionHardeningSafeControl[] = [
  {
    enabled: false,
    key: "apply_hardening",
    label: "Apply Hardening",
    note: "Read-only placeholder. No hardening apply, mutation, or provider call runs during OP-28 page load."
  },
  {
    enabled: false,
    key: "recheck_hardening",
    label: "Recheck Hardening",
    note: "Read-only placeholder. No hardening recheck execution or mutation runs during OP-28 page load."
  },
  {
    enabled: false,
    key: "export_hardening_report",
    label: "Export Hardening Report",
    note: "Read-only placeholder. No hardening export or provider call runs during OP-28 page load."
  },
  {
    enabled: false,
    key: "resolve_hardening_blocker",
    label: "Resolve Hardening Blocker",
    note: "Read-only placeholder. No hardening blocker resolve action runs during OP-28 page load."
  },
  {
    enabled: false,
    key: "mark_hardened",
    label: "Mark Hardened",
    note: "Read-only placeholder. No hardening record write or registry mutation runs during OP-28 page load."
  }
] as const;

const HARDENING_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsProductionHardeningGroupKey;
  title: string;
}> = [
  { groupKey: "registry-hardening", title: "Registry Hardening" },
  { groupKey: "dashboard-hardening", title: "Dashboard Hardening" },
  { groupKey: "queue-hardening", title: "Queue Hardening" },
  { groupKey: "worker-hardening", title: "Worker Hardening" },
  { groupKey: "cron-hardening", title: "Cron Hardening" },
  { groupKey: "storage-hardening", title: "Storage Hardening" },
  { groupKey: "database-hardening", title: "Database Hardening" },
  { groupKey: "email-queue-hardening", title: "Email Queue Hardening" },
  { groupKey: "ai-queue-hardening", title: "AI Queue Hardening" },
  { groupKey: "domain-email-queue-hardening", title: "Domain & Email Queue Hardening" },
  { groupKey: "monitoring-hardening", title: "Monitoring Hardening" },
  { groupKey: "backup-hardening", title: "Backup Hardening" },
  { groupKey: "disaster-recovery-hardening", title: "Disaster Recovery Hardening" },
  { groupKey: "diagnostics-hardening", title: "Diagnostics Hardening" },
  { groupKey: "safe-controls-hardening", title: "Safe Controls Hardening" },
  { groupKey: "status-hardening", title: "Status Hardening" },
  { groupKey: "visibility-hardening", title: "Visibility Hardening" },
  { groupKey: "audit-hardening", title: "Audit Hardening" },
  { groupKey: "review-hardening", title: "Review Hardening" },
  { groupKey: "certification-hardening", title: "Certification Hardening" },
  { groupKey: "stress-validation-hardening", title: "Stress Validation Hardening" }
];

const HARDENING_SCOPE_DEFINITIONS: readonly HardeningScopeDefinition[] = [
  {
    expectedSources: ["operations_registry_runtime"],
    groupKey: "registry-hardening",
    hardeningGuarantee: "read-only registry metadata with masked secrets",
    hardeningName: "Registry Hardening",
    hardeningScope: "OP-1 registry read-only hardening and deterministic output",
    moduleKeys: ["operations_registry_runtime"],
    resolveRuntimeSnapshots: (input) => [input.registryRuntime],
    resolveSafeControls: () => [],
    securityCertificationGroupKey: "registry-security-certification",
    stressValidationGroupKey: "registry-stress-validation"
  },
  {
    expectedSources: ["operations_dashboard_runtime", "operations_registry_runtime"],
    groupKey: "dashboard-hardening",
    hardeningGuarantee: "registry-derived dashboard with safe empty states",
    hardeningName: "Dashboard Hardening",
    hardeningScope: "OP-2 dashboard read-only hardening and registry isolation",
    moduleKeys: ["operations_dashboard_runtime"],
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime, input.registryRuntime],
    resolveSafeControls: () => [],
    securityCertificationGroupKey: "dashboard-security-certification",
    stressValidationGroupKey: "dashboard-stress-validation"
  },
  {
    expectedSources: ["operations_queue_runtime"],
    groupKey: "queue-hardening",
    hardeningGuarantee: "read-only queue metadata with disabled controls",
    hardeningName: "Queue Hardening",
    hardeningScope: "OP-3 queue read-only hardening without execution",
    moduleKeys: ["op-queue-tables"],
    resolveRuntimeSnapshots: (input) => [input.queueRuntime],
    resolveSafeControls: (input) => input.queueSafeControls,
    securityCertificationGroupKey: "queue-security-certification",
    stressValidationGroupKey: "queue-stress-validation"
  },
  {
    expectedSources: ["operations_worker_runtime", "operations_worker_monitoring_runtime"],
    groupKey: "worker-hardening",
    hardeningGuarantee: "read-only worker metadata with disabled controls",
    hardeningName: "Worker Hardening",
    hardeningScope: "OP-4 and OP-12 worker read-only hardening without execution",
    moduleKeys: ["op-worker-tables", "op-worker-health"],
    resolveRuntimeSnapshots: (input) => [input.workerRuntime, input.workerMonitoringRuntime],
    resolveSafeControls: (input) => [...input.workerSafeControls, ...input.workerMonitoringSafeControls],
    securityCertificationGroupKey: "worker-security-certification",
    stressValidationGroupKey: "worker-stress-validation"
  },
  {
    expectedSources: ["operations_cron_runtime", "operations_cron_monitoring_runtime"],
    groupKey: "cron-hardening",
    hardeningGuarantee: "read-only cron metadata with disabled controls",
    hardeningName: "Cron Hardening",
    hardeningScope: "OP-5 and OP-13 cron read-only hardening without execution",
    moduleKeys: ["op-cron-jobs", "op-cron-health"],
    resolveRuntimeSnapshots: (input) => [input.cronRuntime, input.cronMonitoringRuntime],
    resolveSafeControls: (input) => [...input.cronSafeControls, ...input.cronMonitoringSafeControls],
    securityCertificationGroupKey: "cron-security-certification",
    stressValidationGroupKey: "cron-stress-validation"
  },
  {
    expectedSources: ["operations_storage_runtime", "operations_storage_metrics_runtime"],
    groupKey: "storage-hardening",
    hardeningGuarantee: "read-only storage metadata with safe empty states",
    hardeningName: "Storage Hardening",
    hardeningScope: "OP-5 and OP-14 storage read-only hardening without mutation",
    moduleKeys: ["op-storage-health", "op-storage-metrics"],
    resolveRuntimeSnapshots: (input) => [input.storageRuntime, input.storageMetricsRuntime],
    resolveSafeControls: (input) => [...input.storageSafeControls, ...input.storageMetricsSafeControls],
    securityCertificationGroupKey: "storage-security-certification",
    stressValidationGroupKey: "storage-stress-validation"
  },
  {
    expectedSources: ["operations_database_runtime"],
    groupKey: "database-hardening",
    hardeningGuarantee: "read-only database metadata with disabled controls",
    hardeningName: "Database Hardening",
    hardeningScope: "OP-6 database read-only hardening without mutation",
    moduleKeys: ["op-database-health"],
    resolveRuntimeSnapshots: (input) => [input.databaseRuntime],
    resolveSafeControls: (input) => input.databaseSafeControls,
    securityCertificationGroupKey: "database-security-certification",
    stressValidationGroupKey: "database-stress-validation"
  },
  {
    expectedSources: ["operations_email_queue_runtime"],
    groupKey: "email-queue-hardening",
    hardeningGuarantee: "read-only email queue metadata with safe empty states",
    hardeningName: "Email Queue Hardening",
    hardeningScope: "OP-7 email queue read-only hardening without execution",
    moduleKeys: ["op-email-queue"],
    resolveRuntimeSnapshots: (input) => [input.emailQueueRuntime],
    resolveSafeControls: (input) => input.emailQueueSafeControls,
    securityCertificationGroupKey: "email-queue-security-certification",
    stressValidationGroupKey: "email-queue-stress-validation"
  },
  {
    expectedSources: ["operations_ai_queue_runtime"],
    groupKey: "ai-queue-hardening",
    hardeningGuarantee: "read-only AI queue metadata with disabled controls",
    hardeningName: "AI Queue Hardening",
    hardeningScope: "OP-8 AI queue read-only hardening without execution",
    moduleKeys: ["op-ai-queue"],
    resolveRuntimeSnapshots: (input) => [input.aiQueueRuntime],
    resolveSafeControls: (input) => input.aiQueueSafeControls,
    securityCertificationGroupKey: "ai-queue-security-certification",
    stressValidationGroupKey: "ai-queue-stress-validation"
  },
  {
    expectedSources: ["operations_domain_email_queue_runtime"],
    groupKey: "domain-email-queue-hardening",
    hardeningGuarantee: "read-only domain and email queue metadata with safe empty states",
    hardeningName: "Domain & Email Queue Hardening",
    hardeningScope: "OP-9 domain and email queue read-only hardening without execution",
    moduleKeys: ["op-domain-email-queue"],
    resolveRuntimeSnapshots: (input) => [input.domainEmailQueueRuntime],
    resolveSafeControls: (input) => input.domainEmailQueueSafeControls,
    securityCertificationGroupKey: "domain-email-queue-security-certification",
    stressValidationGroupKey: "domain-email-queue-stress-validation"
  },
  {
    expectedSources: ["operations_monitoring_events_runtime"],
    groupKey: "monitoring-hardening",
    hardeningGuarantee: "read-only monitoring metadata without raw payloads",
    hardeningName: "Monitoring Hardening",
    hardeningScope: "OP-11 monitoring read-only hardening with secret masking",
    moduleKeys: ["op-monitoring-events"],
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime],
    resolveSafeControls: (input) => input.monitoringEventsSafeControls,
    securityCertificationGroupKey: "monitoring-security-certification",
    stressValidationGroupKey: "monitoring-stress-validation"
  },
  {
    expectedSources: ["operations_backup_runtime"],
    groupKey: "backup-hardening",
    hardeningGuarantee: "read-only backup metadata without execution",
    hardeningName: "Backup Hardening",
    hardeningScope: "OP-15 backup read-only hardening without execution",
    moduleKeys: ["op-backup"],
    resolveRuntimeSnapshots: (input) => [input.backupRuntime],
    resolveSafeControls: (input) => input.backupSafeControls,
    securityCertificationGroupKey: "backup-security-certification",
    stressValidationGroupKey: "backup-stress-validation"
  },
  {
    expectedSources: ["operations_disaster_recovery_runtime"],
    groupKey: "disaster-recovery-hardening",
    hardeningGuarantee: "read-only disaster recovery metadata without execution",
    hardeningName: "Disaster Recovery Hardening",
    hardeningScope: "OP-16 disaster recovery read-only hardening without execution",
    moduleKeys: ["op-disaster-recovery"],
    resolveRuntimeSnapshots: (input) => [input.disasterRecoveryRuntime],
    resolveSafeControls: (input) => input.disasterRecoverySafeControls,
    securityCertificationGroupKey: "disaster-recovery-security-certification",
    stressValidationGroupKey: "disaster-recovery-stress-validation"
  },
  {
    expectedSources: ["operations_diagnostics_runtime"],
    groupKey: "diagnostics-hardening",
    hardeningGuarantee: "read-only diagnostics metadata without execution",
    hardeningName: "Diagnostics Hardening",
    hardeningScope: "OP-17 diagnostics read-only hardening without execution",
    moduleKeys: ["op-diagnostics"],
    resolveRuntimeSnapshots: (input) => [input.diagnosticsRuntime],
    resolveSafeControls: (input) => input.diagnosticsSafeControls,
    securityCertificationGroupKey: "diagnostics-security-certification",
    stressValidationGroupKey: "diagnostics-stress-validation"
  },
  {
    expectedSources: ["operations_safe_controls_runtime"],
    groupKey: "safe-controls-hardening",
    hardeningGuarantee: "all dangerous controls disabled and non-executable",
    hardeningName: "Safe Controls Hardening",
    hardeningScope: "OP-18 safe controls read-only hardening with disabled execution",
    moduleKeys: ["op-safe-controls"],
    resolveRuntimeSnapshots: (input) => [input.safeControlsRuntime],
    resolveSafeControls: (input) => input.safeControlsSafeControls,
    securityCertificationGroupKey: "safe-controls-security-certification",
    stressValidationGroupKey: "safe-controls-stress-validation"
  },
  {
    expectedSources: ["operations_status_runtime"],
    groupKey: "status-hardening",
    hardeningGuarantee: "derived status metadata without mutation hooks",
    hardeningName: "Status Hardening",
    hardeningScope: "OP-19 status read-only hardening with derived-only output",
    moduleKeys: ["operations_status_runtime"],
    resolveRuntimeSnapshots: (input) => [input.statusRuntime],
    resolveSafeControls: () => [],
    securityCertificationGroupKey: "status-security-certification",
    stressValidationGroupKey: "status-stress-validation"
  },
  {
    expectedSources: ["operations_visibility_runtime"],
    groupKey: "visibility-hardening",
    hardeningGuarantee: "derived visibility metadata without mutation hooks",
    hardeningName: "Visibility Hardening",
    hardeningScope: "OP-20 visibility read-only hardening with derived-only output",
    moduleKeys: ["operations_visibility_runtime"],
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime],
    resolveSafeControls: () => [],
    securityCertificationGroupKey: "visibility-security-certification",
    stressValidationGroupKey: "visibility-stress-validation"
  },
  {
    expectedSources: ["operations_audit_runtime"],
    groupKey: "audit-hardening",
    hardeningGuarantee: "read-only audit metadata without raw payloads",
    hardeningName: "Audit Hardening",
    hardeningScope: "OP-21 audit read-only hardening with safe empty states",
    moduleKeys: ["operations_audit_runtime"],
    resolveRuntimeSnapshots: (input) => [input.auditRuntime],
    resolveSafeControls: (input) => input.auditSafeControls,
    securityCertificationGroupKey: "audit-security-certification",
    stressValidationGroupKey: "audit-stress-validation"
  },
  {
    expectedSources: ["operations_review_runtime"],
    groupKey: "review-hardening",
    hardeningGuarantee: "derived review metadata without mutation hooks",
    hardeningName: "Review Hardening",
    hardeningScope: "OP-22 review read-only hardening with derived-only output",
    moduleKeys: ["operations_review_runtime"],
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime],
    resolveSafeControls: (input) => input.reviewSafeControls,
    securityCertificationGroupKey: "review-security-certification",
    stressValidationGroupKey: "review-stress-validation"
  },
  {
    expectedSources: [
      "operations_data_certification_runtime",
      "operations_security_certification_runtime",
      "operations_runtime_certification_runtime",
      "operations_production_certification_runtime"
    ],
    groupKey: "certification-hardening",
    hardeningGuarantee: "certification metadata read-only without persistence",
    hardeningName: "Certification Hardening",
    hardeningScope: "OP-23 through OP-26 certification read-only hardening and isolation",
    moduleKeys: [
      "operations_data_certification_runtime",
      "operations_security_certification_runtime",
      "operations_runtime_certification_runtime",
      "operations_production_certification_runtime"
    ],
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
    stressValidationGroupKey: "certification-stress-validation"
  },
  {
    expectedSources: ["operations_stress_validation_runtime"],
    groupKey: "stress-validation-hardening",
    hardeningGuarantee: "stress validation metadata read-only without load testing",
    hardeningName: "Stress Validation Hardening",
    hardeningScope: "OP-27 stress validation read-only hardening and certified system isolation",
    moduleKeys: ["operations_stress_validation_runtime"],
    resolveRuntimeSnapshots: (input) => [input.stressValidation],
    resolveSafeControls: (input) => input.stressValidationSafeControls,
    securityCertificationGroupKey: null,
    stressValidationGroupKey: null
  }
] as const;

function buildSafeControls() {
  return OPERATIONS_PRODUCTION_HARDENING_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function collectModuleCounts(input: OperationsProductionHardeningInput, moduleKeys: readonly string[]) {
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

function mapStressStatusToHardeningStatus(
  status: OperationsStressValidationItem["refreshStabilityStatus"] | undefined
): OperationsProductionHardeningStatus {
  switch (status) {
    case "stable":
      return "hardened";
    case "warning":
      return "warning";
    case "blocked":
      return "blocked";
    case "review_required":
    default:
      return "review_required";
  }
}

function mapSecretMaskingStatus(item: OperationsSecurityCertificationItem | null): OperationsProductionHardeningStatus {
  if (!item) {
    return "review_required";
  }

  if (item.secretSafetyStatus === "certified" && item.privateDataSafetyStatus === "certified") {
    return "hardened";
  }

  return "review_required";
}

function mapControlSafetyStatus(input: {
  safeControlsDisabled: boolean;
  securityCertificationItem: OperationsSecurityCertificationItem | null;
}): OperationsProductionHardeningStatus {
  if (!input.safeControlsDisabled) {
    return "blocked";
  }

  if (input.securityCertificationItem?.actionSafetyStatus === "certified") {
    return "hardened";
  }

  return input.safeControlsDisabled ? "hardened" : "review_required";
}

function buildHardeningItem(
  definition: HardeningScopeDefinition,
  input: OperationsProductionHardeningInput
): OperationsProductionHardeningItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeShapeValid = validateRuntimeShape(snapshots, definition.expectedSources);
  const safeControls = definition.resolveSafeControls(input);
  const stressItem = definition.stressValidationGroupKey
    ? input.stressValidationItems.find((item) => item.groupKey === definition.stressValidationGroupKey) ?? null
    : null;
  const securityCertificationItem = definition.securityCertificationGroupKey
    ? input.securityCertificationItems.find((item) => item.groupKey === definition.securityCertificationGroupKey) ?? null
    : null;
  const moduleCounts =
    definition.groupKey === "certification-hardening"
      ? {
          blockedModules: input.productionCertification.blockedScopes,
          warningModules: input.productionCertification.warningScopes
        }
      : definition.groupKey === "stress-validation-hardening"
        ? {
            blockedModules: input.stressValidation.blockedScopes,
            warningModules: input.stressValidation.warningScopes
          }
        : collectModuleCounts(input, definition.moduleKeys);
  const readOnlyHardeningStatus: OperationsProductionHardeningStatus = runtimeShapeValid
    ? stressItem
      ? mapStressStatusToHardeningStatus(stressItem.refreshStabilityStatus)
      : definition.groupKey === "stress-validation-hardening"
        ? input.stressValidation.overallStatus === "operations_stress_validation_ready"
          ? "hardened"
          : "review_required"
        : "hardened"
    : "review_required";
  const controlSafetyStatus = mapControlSafetyStatus({
    safeControlsDisabled: validateSafeControlsDisabled(safeControls),
    securityCertificationItem
  });
  const secretMaskingStatus =
    definition.groupKey === "stress-validation-hardening"
      ? input.stressValidationItems.every((item) => item.secretSafetyStatus === "stable")
        ? "hardened"
        : "review_required"
      : mapSecretMaskingStatus(securityCertificationItem);
  const emptyStateStatus = stressItem
    ? mapStressStatusToHardeningStatus(stressItem.emptyStateSafetyStatus)
    : definition.groupKey === "stress-validation-hardening"
      ? input.stressValidationItems.every((item) => isStressScopeStable(item))
        ? "hardened"
        : "review_required"
      : runtimeShapeValid && moduleCounts.blockedModules === 0
        ? moduleCounts.warningModules > 0
          ? "warning"
          : "hardened"
        : moduleCounts.blockedModules > 0
          ? "blocked"
          : "review_required";
  const executionIsolationStatus = stressItem
    ? mapStressStatusToHardeningStatus(stressItem.executionSafetyStatus)
    : runtimeShapeValid
      ? "hardened"
      : "review_required";
  const mutationIsolationStatus = stressItem
    ? mapStressStatusToHardeningStatus(stressItem.mutationSafetyStatus)
    : runtimeShapeValid
      ? "hardened"
      : "review_required";
  const certifiedSystemIsolationStatus: OperationsProductionHardeningStatus =
    runtimeShapeValid && validateCertifiedSystemIsolation(snapshots)
      ? stressItem
        ? mapStressStatusToHardeningStatus(stressItem.certifiedSystemIsolationStatus)
        : "hardened"
      : "blocked";

  return {
    blockedModules: moduleCounts.blockedModules,
    certifiedSystemIsolationStatus,
    controlSafetyStatus,
    emptyStateStatus,
    executionIsolationStatus,
    groupKey: definition.groupKey,
    hardeningKey: `op-hardening-${definition.groupKey}`,
    hardeningName: definition.hardeningName,
    hardeningScope: definition.hardeningScope,
    mutationIsolationStatus,
    readOnlyHardeningStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `guarantee ${definition.hardeningGuarantee}`,
      `read only ${readOnlyHardeningStatus}`,
      `controls ${controlSafetyStatus}`,
      `secrets ${secretMaskingStatus}`,
      `empty state ${emptyStateStatus}`,
      `execution ${executionIsolationStatus}`,
      `mutation ${mutationIsolationStatus}`,
      `isolation ${certifiedSystemIsolationStatus}`,
      `${moduleCounts.blockedModules} blocked`,
      `${moduleCounts.warningModules} warning`
    ].join("; "),
    secretMaskingStatus,
    warningModules: moduleCounts.warningModules
  };
}

export function isHardeningScopeReady(item: OperationsProductionHardeningItem) {
  return (
    item.readOnlyHardeningStatus === "hardened" &&
    item.controlSafetyStatus === "hardened" &&
    item.secretMaskingStatus === "hardened" &&
    item.emptyStateStatus === "hardened" &&
    item.executionIsolationStatus === "hardened" &&
    item.mutationIsolationStatus === "hardened" &&
    item.certifiedSystemIsolationStatus === "hardened"
  );
}

export function buildOperationsProductionHardeningGroups(items: OperationsProductionHardeningItem[]) {
  return HARDENING_GROUP_DEFINITIONS.map((definition) => {
    const groupItems = items.filter((item) => item.groupKey === definition.groupKey);

    return {
      groupKey: definition.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: definition.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsProductionHardeningSummary(
  items: OperationsProductionHardeningItem[]
): OperationsProductionHardeningSummary {
  const hardenedScopes = items.filter((item) => isHardeningScopeReady(item)).length;
  const blockedScopes = items.filter(
    (item) =>
      item.readOnlyHardeningStatus === "blocked" ||
      item.controlSafetyStatus === "blocked" ||
      item.secretMaskingStatus === "blocked" ||
      item.emptyStateStatus === "blocked" ||
      item.executionIsolationStatus === "blocked" ||
      item.mutationIsolationStatus === "blocked" ||
      item.certifiedSystemIsolationStatus === "blocked"
  ).length;
  const warningScopes = items.filter(
    (item) =>
      item.readOnlyHardeningStatus === "warning" ||
      item.controlSafetyStatus === "warning" ||
      item.emptyStateStatus === "warning" ||
      item.executionIsolationStatus === "warning" ||
      item.mutationIsolationStatus === "warning" ||
      item.certifiedSystemIsolationStatus === "warning"
  ).length;
  const reviewRequiredScopes = items.length - hardenedScopes - blockedScopes;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0
      ? ("needs_attention" as const)
      : ("operations_production_hardening_ready" as const);

  return {
    blockedScopes,
    groupCount: buildOperationsProductionHardeningGroups(items).length,
    hardenedScopes,
    overallStatus,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    reviewRequiredScopes: Math.max(reviewRequiredScopes, 0),
    source: OPERATIONS_PRODUCTION_HARDENING_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} hardening scopes`,
      `${hardenedScopes} hardened`,
      `${reviewRequiredScopes} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`
    ].join("; "),
    totalHardeningScopes: items.length,
    warningScopes
  };
}

export function operationsProductionHardeningStatusLabel(status: OperationsProductionHardeningStatus) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "hardened":
      return "Hardened";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function operationsProductionHardeningStatusTone(status: OperationsProductionHardeningStatus) {
  switch (status) {
    case "hardened":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
  }
}

export function buildOperationsProductionHardeningReadOnlySafe(input: OperationsProductionHardeningInput) {
  const hardeningItems = HARDENING_SCOPE_DEFINITIONS.map((definition) => buildHardeningItem(definition, input));
  const groups = buildOperationsProductionHardeningGroups(hardeningItems);
  const summary = getOperationsProductionHardeningSummary(hardeningItems);

  return {
    groups,
    productionHardening: summary,
    productionHardeningItems: hardeningItems,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsProductionHardeningToAdminFields(
  input: ReturnType<typeof buildOperationsProductionHardeningReadOnlySafe>
) {
  return {
    groups: input.groups,
    productionHardening: input.productionHardening,
    productionHardeningItems: input.productionHardeningItems,
    safeControls: input.safeControls
  };
}
