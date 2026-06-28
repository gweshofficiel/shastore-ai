import "server-only";

import type {
  OperationsDataCertificationItem,
  OperationsDataCertificationSummary
} from "@/src/lib/operations/operations-data-certification-runtime";
import { OPERATIONS_REGISTRY_SOURCE } from "@/src/lib/operations/operations-registry-runtime";
import type {
  OperationsProductionCertificationItem,
  OperationsProductionCertificationSummary
} from "@/src/lib/operations/operations-production-certification-runtime";
import {
  isHardeningScopeReady,
  type OperationsProductionHardeningItem,
  type OperationsProductionHardeningSummary
} from "@/src/lib/operations/operations-production-hardening-runtime";
import type {
  OperationsRuntimeCertificationItem,
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

export type OperationsFinalProductionCertificationSource = "operations_final_production_certification_runtime";

export type OperationsFinalProductionCertificationGroupKey =
  | "ai-queue-final-certification"
  | "audit-final-certification"
  | "backup-final-certification"
  | "cron-final-certification"
  | "cron-monitoring-final-certification"
  | "dashboard-final-certification"
  | "data-final-certification"
  | "database-final-certification"
  | "diagnostics-final-certification"
  | "disaster-recovery-final-certification"
  | "domain-email-queue-final-certification"
  | "email-queue-final-certification"
  | "hardening-final-certification"
  | "monitoring-final-certification"
  | "production-final-certification"
  | "queue-final-certification"
  | "registry-final-certification"
  | "review-final-certification"
  | "runtime-final-certification"
  | "safe-controls-final-certification"
  | "security-final-certification"
  | "status-final-certification"
  | "storage-final-certification"
  | "storage-metrics-final-certification"
  | "stress-validation-final-certification"
  | "visibility-final-certification"
  | "worker-final-certification"
  | "worker-monitoring-final-certification";

export type OperationsFinalCertificationStatus = "blocked" | "certified" | "review_required" | "warning";

export type OperationsFinalProductionStatus = "blocked" | "final_production_certified" | "review_required" | "warning";

export type OperationsFinalProductionCertificationSafeControlKey =
  | "approve_final_certification"
  | "export_final_report"
  | "mark_final_certified"
  | "recheck_final_production"
  | "resolve_final_blocker";

export type OperationsFinalProductionCertificationSafeControl = {
  enabled: false;
  key: OperationsFinalProductionCertificationSafeControlKey;
  label: string;
  note: string;
};

export type OperationsFinalProductionCertificationItem = {
  blockedModules: number;
  certificationName: string;
  certificationScope: string;
  certifiedModules: number;
  dataSafetyStatus: OperationsFinalCertificationStatus;
  executionSafetyStatus: OperationsFinalCertificationStatus;
  finalCertificationKey: string;
  finalProductionStatus: OperationsFinalProductionStatus;
  groupKey: OperationsFinalProductionCertificationGroupKey;
  hardeningStatus: OperationsFinalCertificationStatus;
  mutationSafetyStatus: OperationsFinalCertificationStatus;
  readOnlyStatus: OperationsFinalCertificationStatus;
  runtimeIntegrityStatus: OperationsFinalCertificationStatus;
  safeControls: OperationsFinalProductionCertificationSafeControl[];
  safeSummary: string;
  securitySafetyStatus: OperationsFinalCertificationStatus;
  warningModules: number;
};

export type OperationsFinalProductionCertificationGroup = {
  groupKey: OperationsFinalProductionCertificationGroupKey;
  itemCount: number;
  items: OperationsFinalProductionCertificationItem[];
  title: string;
};

export type OperationsFinalProductionCertificationSummary = {
  blockedScopes: number;
  certifiedScopes: number;
  groupCount: number;
  overallStatus: "needs_attention" | "operations_final_production_certification_ready";
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  reviewRequiredScopes: number;
  source: OperationsFinalProductionCertificationSource;
  summary: string;
  totalCertifications: number;
  warningScopes: number;
};

export const OPERATIONS_FINAL_PRODUCTION_CERTIFICATION_BADGES = [
  "Operations Runtime Conversion",
  "Final Production Certified",
  "Super Admin Only",
  "Read-only",
  "Non-executing",
  "Non-destructive"
] as const;

type RuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

export type OperationsFinalProductionCertificationInput = {
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
  productionCertification: OperationsProductionCertificationSummary;
  productionCertificationItems: OperationsProductionCertificationItem[];
  productionHardening: OperationsProductionHardeningSummary;
  productionHardeningItems: OperationsProductionHardeningItem[];
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
  stressValidation: OperationsStressValidationSummary;
  stressValidationItems: OperationsStressValidationItem[];
  visibilityRuntime: RuntimeSnapshot;
  workerMonitoringRuntime: RuntimeSnapshot;
  workerRuntime: RuntimeSnapshot;
};

type FinalScopeDefinition = {
  certificationName: string;
  certificationScope: string;
  dataCertificationKey: string | null;
  expectedSources: readonly string[];
  finalGuarantee: string;
  groupKey: OperationsFinalProductionCertificationGroupKey;
  hardeningGroupKey: string | null;
  moduleKeys: readonly string[];
  productionCertificationGroupKey: string | null;
  resolveRuntimeSnapshots: (input: OperationsFinalProductionCertificationInput) => RuntimeSnapshot[];
  runtimeCertificationGroupKey: string | null;
  securityCertificationGroupKey: string | null;
  stressValidationGroupKey: string | null;
};

export const OPERATIONS_FINAL_PRODUCTION_CERTIFICATION_SOURCE =
  "operations_final_production_certification_runtime" as const;

export const OPERATIONS_FINAL_PRODUCTION_CERTIFICATION_SAFE_CONTROLS: readonly OperationsFinalProductionCertificationSafeControl[] =
  [
    {
      enabled: false,
      key: "approve_final_certification",
      label: "Approve Final Certification",
      note: "Read-only placeholder. No final certification approval or mutation runs during OP-29 page load."
    },
    {
      enabled: false,
      key: "recheck_final_production",
      label: "Recheck Final Production",
      note: "Read-only placeholder. No final production recheck execution or mutation runs during OP-29 page load."
    },
    {
      enabled: false,
      key: "export_final_report",
      label: "Export Final Report",
      note: "Read-only placeholder. No final export or provider call runs during OP-29 page load."
    },
    {
      enabled: false,
      key: "resolve_final_blocker",
      label: "Resolve Final Blocker",
      note: "Read-only placeholder. No final blocker resolve action runs during OP-29 page load."
    },
    {
      enabled: false,
      key: "mark_final_certified",
      label: "Mark Final Certified",
      note: "Read-only placeholder. No final certification record write or registry mutation runs during OP-29 page load."
    }
  ] as const;

const FINAL_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsFinalProductionCertificationGroupKey;
  title: string;
}> = [
  { groupKey: "registry-final-certification", title: "Registry Final Certification" },
  { groupKey: "dashboard-final-certification", title: "Dashboard Final Certification" },
  { groupKey: "queue-final-certification", title: "Queue Final Certification" },
  { groupKey: "worker-final-certification", title: "Worker Final Certification" },
  { groupKey: "cron-final-certification", title: "Cron Final Certification" },
  { groupKey: "storage-final-certification", title: "Storage Final Certification" },
  { groupKey: "database-final-certification", title: "Database Final Certification" },
  { groupKey: "email-queue-final-certification", title: "Email Queue Final Certification" },
  { groupKey: "ai-queue-final-certification", title: "AI Queue Final Certification" },
  { groupKey: "domain-email-queue-final-certification", title: "Domain & Email Queue Final Certification" },
  { groupKey: "monitoring-final-certification", title: "Monitoring Final Certification" },
  { groupKey: "worker-monitoring-final-certification", title: "Worker Monitoring Final Certification" },
  { groupKey: "cron-monitoring-final-certification", title: "Cron Monitoring Final Certification" },
  { groupKey: "storage-metrics-final-certification", title: "Storage Metrics Final Certification" },
  { groupKey: "backup-final-certification", title: "Backup Final Certification" },
  { groupKey: "disaster-recovery-final-certification", title: "Disaster Recovery Final Certification" },
  { groupKey: "diagnostics-final-certification", title: "Diagnostics Final Certification" },
  { groupKey: "safe-controls-final-certification", title: "Safe Controls Final Certification" },
  { groupKey: "status-final-certification", title: "Status Final Certification" },
  { groupKey: "visibility-final-certification", title: "Visibility Final Certification" },
  { groupKey: "audit-final-certification", title: "Audit Final Certification" },
  { groupKey: "review-final-certification", title: "Review Final Certification" },
  { groupKey: "data-final-certification", title: "Data Final Certification" },
  { groupKey: "security-final-certification", title: "Security Final Certification" },
  { groupKey: "runtime-final-certification", title: "Runtime Final Certification" },
  { groupKey: "production-final-certification", title: "Production Final Certification" },
  { groupKey: "stress-validation-final-certification", title: "Stress Validation Final Certification" },
  { groupKey: "hardening-final-certification", title: "Hardening Final Certification" }
];

const FINAL_SCOPE_DEFINITIONS: readonly FinalScopeDefinition[] = [
  {
    certificationName: "Registry Final Certification",
    certificationScope: "OP-1 Operations Registry is complete and final production certified",
    dataCertificationKey: "op-cert-registry-data",
    expectedSources: ["operations_registry_runtime"],
    finalGuarantee: "Operations Registry is complete",
    groupKey: "registry-final-certification",
    hardeningGroupKey: "registry-hardening",
    moduleKeys: ["operations_registry_runtime"],
    productionCertificationGroupKey: "registry-production-certification",
    resolveRuntimeSnapshots: (input) => [input.registryRuntime],
    runtimeCertificationGroupKey: "registry-runtime-certification",
    securityCertificationGroupKey: "registry-security-certification",
    stressValidationGroupKey: "registry-stress-validation"
  },
  {
    certificationName: "Dashboard Final Certification",
    certificationScope: "OP-2 Operations Dashboard is registry-derived and final production certified",
    dataCertificationKey: "op-cert-dashboard-data",
    expectedSources: ["operations_dashboard_runtime", "operations_registry_runtime"],
    finalGuarantee: "Operations Dashboard is registry-derived",
    groupKey: "dashboard-final-certification",
    hardeningGroupKey: "dashboard-hardening",
    moduleKeys: ["operations_dashboard_runtime"],
    productionCertificationGroupKey: "dashboard-production-certification",
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime, input.registryRuntime],
    runtimeCertificationGroupKey: "dashboard-runtime-certification",
    securityCertificationGroupKey: "dashboard-security-certification",
    stressValidationGroupKey: "dashboard-stress-validation"
  },
  {
    certificationName: "Queue Final Certification",
    certificationScope: "OP-3 Queue Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-queue-data",
    expectedSources: ["operations_queue_runtime"],
    finalGuarantee: "Queue Runtime is read-only",
    groupKey: "queue-final-certification",
    hardeningGroupKey: "queue-hardening",
    moduleKeys: ["op-queue-tables"],
    productionCertificationGroupKey: "queue-production-certification",
    resolveRuntimeSnapshots: (input) => [input.queueRuntime],
    runtimeCertificationGroupKey: "queue-runtime-certification",
    securityCertificationGroupKey: "queue-security-certification",
    stressValidationGroupKey: "queue-stress-validation"
  },
  {
    certificationName: "Worker Final Certification",
    certificationScope: "OP-4 Worker Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-worker-data",
    expectedSources: ["operations_worker_runtime"],
    finalGuarantee: "Worker Runtime is read-only",
    groupKey: "worker-final-certification",
    hardeningGroupKey: "worker-hardening",
    moduleKeys: ["op-worker-tables"],
    productionCertificationGroupKey: "worker-production-certification",
    resolveRuntimeSnapshots: (input) => [input.workerRuntime],
    runtimeCertificationGroupKey: "worker-runtime-certification",
    securityCertificationGroupKey: "worker-security-certification",
    stressValidationGroupKey: "worker-stress-validation"
  },
  {
    certificationName: "Cron Final Certification",
    certificationScope: "OP-5 Cron Jobs Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-cron-data",
    expectedSources: ["operations_cron_runtime"],
    finalGuarantee: "Cron Jobs Runtime is read-only",
    groupKey: "cron-final-certification",
    hardeningGroupKey: "cron-hardening",
    moduleKeys: ["op-cron-jobs"],
    productionCertificationGroupKey: "cron-production-certification",
    resolveRuntimeSnapshots: (input) => [input.cronRuntime],
    runtimeCertificationGroupKey: "cron-runtime-certification",
    securityCertificationGroupKey: "cron-security-certification",
    stressValidationGroupKey: "cron-stress-validation"
  },
  {
    certificationName: "Storage Final Certification",
    certificationScope: "OP-5 Storage Health Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-storage-data",
    expectedSources: ["operations_storage_runtime"],
    finalGuarantee: "Storage Health Runtime is read-only",
    groupKey: "storage-final-certification",
    hardeningGroupKey: "storage-hardening",
    moduleKeys: ["op-storage-health"],
    productionCertificationGroupKey: "storage-production-certification",
    resolveRuntimeSnapshots: (input) => [input.storageRuntime],
    runtimeCertificationGroupKey: "storage-runtime-certification",
    securityCertificationGroupKey: "storage-security-certification",
    stressValidationGroupKey: "storage-stress-validation"
  },
  {
    certificationName: "Database Final Certification",
    certificationScope: "OP-6 Database Health Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-database-data",
    expectedSources: ["operations_database_runtime"],
    finalGuarantee: "Database Health Runtime is read-only",
    groupKey: "database-final-certification",
    hardeningGroupKey: "database-hardening",
    moduleKeys: ["op-database-health"],
    productionCertificationGroupKey: "database-production-certification",
    resolveRuntimeSnapshots: (input) => [input.databaseRuntime],
    runtimeCertificationGroupKey: "database-runtime-certification",
    securityCertificationGroupKey: "database-security-certification",
    stressValidationGroupKey: "database-stress-validation"
  },
  {
    certificationName: "Email Queue Final Certification",
    certificationScope: "OP-7 Email Queue Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-email-queue-data",
    expectedSources: ["operations_email_queue_runtime"],
    finalGuarantee: "Email Queue Runtime is read-only",
    groupKey: "email-queue-final-certification",
    hardeningGroupKey: "email-queue-hardening",
    moduleKeys: ["op-email-queue"],
    productionCertificationGroupKey: "email-queue-production-certification",
    resolveRuntimeSnapshots: (input) => [input.emailQueueRuntime],
    runtimeCertificationGroupKey: "email-queue-runtime-certification",
    securityCertificationGroupKey: "email-queue-security-certification",
    stressValidationGroupKey: "email-queue-stress-validation"
  },
  {
    certificationName: "AI Queue Final Certification",
    certificationScope: "OP-8 AI Queue Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-ai-queue-data",
    expectedSources: ["operations_ai_queue_runtime"],
    finalGuarantee: "AI Queue Runtime is read-only",
    groupKey: "ai-queue-final-certification",
    hardeningGroupKey: "ai-queue-hardening",
    moduleKeys: ["op-ai-queue"],
    productionCertificationGroupKey: "ai-queue-production-certification",
    resolveRuntimeSnapshots: (input) => [input.aiQueueRuntime],
    runtimeCertificationGroupKey: "ai-queue-runtime-certification",
    securityCertificationGroupKey: "ai-queue-security-certification",
    stressValidationGroupKey: "ai-queue-stress-validation"
  },
  {
    certificationName: "Domain & Email Queue Final Certification",
    certificationScope: "OP-9 Domain and Email Queue Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-domain-email-queue-data",
    expectedSources: ["operations_domain_email_queue_runtime"],
    finalGuarantee: "Domain & Email Queue Runtime is read-only",
    groupKey: "domain-email-queue-final-certification",
    hardeningGroupKey: "domain-email-queue-hardening",
    moduleKeys: ["op-domain-email-queue"],
    productionCertificationGroupKey: "domain-email-queue-production-certification",
    resolveRuntimeSnapshots: (input) => [input.domainEmailQueueRuntime],
    runtimeCertificationGroupKey: "domain-email-queue-runtime-certification",
    securityCertificationGroupKey: "domain-email-queue-security-certification",
    stressValidationGroupKey: "domain-email-queue-stress-validation"
  },
  {
    certificationName: "Monitoring Final Certification",
    certificationScope: "OP-11 Monitoring Events Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-monitoring-data",
    expectedSources: ["operations_monitoring_events_runtime"],
    finalGuarantee: "Monitoring Events Runtime is read-only",
    groupKey: "monitoring-final-certification",
    hardeningGroupKey: "monitoring-hardening",
    moduleKeys: ["op-monitoring-events"],
    productionCertificationGroupKey: "monitoring-production-certification",
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime],
    runtimeCertificationGroupKey: "monitoring-runtime-certification",
    securityCertificationGroupKey: "monitoring-security-certification",
    stressValidationGroupKey: "monitoring-stress-validation"
  },
  {
    certificationName: "Worker Monitoring Final Certification",
    certificationScope: "OP-12 Worker Monitoring Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-worker-data",
    expectedSources: ["operations_worker_monitoring_runtime"],
    finalGuarantee: "Worker Monitoring Runtime is read-only",
    groupKey: "worker-monitoring-final-certification",
    hardeningGroupKey: "worker-hardening",
    moduleKeys: ["op-worker-health"],
    productionCertificationGroupKey: "worker-monitoring-production-certification",
    resolveRuntimeSnapshots: (input) => [input.workerMonitoringRuntime],
    runtimeCertificationGroupKey: "worker-runtime-certification",
    securityCertificationGroupKey: "worker-security-certification",
    stressValidationGroupKey: "worker-stress-validation"
  },
  {
    certificationName: "Cron Monitoring Final Certification",
    certificationScope: "OP-13 Cron Monitoring Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-cron-data",
    expectedSources: ["operations_cron_monitoring_runtime"],
    finalGuarantee: "Cron Monitoring Runtime is read-only",
    groupKey: "cron-monitoring-final-certification",
    hardeningGroupKey: "cron-hardening",
    moduleKeys: ["op-cron-health"],
    productionCertificationGroupKey: "cron-monitoring-production-certification",
    resolveRuntimeSnapshots: (input) => [input.cronMonitoringRuntime],
    runtimeCertificationGroupKey: "cron-runtime-certification",
    securityCertificationGroupKey: "cron-security-certification",
    stressValidationGroupKey: "cron-stress-validation"
  },
  {
    certificationName: "Storage Metrics Final Certification",
    certificationScope: "OP-14 Storage Metrics Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-storage-data",
    expectedSources: ["operations_storage_metrics_runtime"],
    finalGuarantee: "Storage Metrics Runtime is read-only",
    groupKey: "storage-metrics-final-certification",
    hardeningGroupKey: "storage-hardening",
    moduleKeys: ["op-storage-metrics"],
    productionCertificationGroupKey: "storage-metrics-production-certification",
    resolveRuntimeSnapshots: (input) => [input.storageMetricsRuntime],
    runtimeCertificationGroupKey: "storage-runtime-certification",
    securityCertificationGroupKey: "storage-security-certification",
    stressValidationGroupKey: "storage-stress-validation"
  },
  {
    certificationName: "Backup Final Certification",
    certificationScope: "OP-15 Backup Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-backup-data",
    expectedSources: ["operations_backup_runtime"],
    finalGuarantee: "Backup Runtime is read-only",
    groupKey: "backup-final-certification",
    hardeningGroupKey: "backup-hardening",
    moduleKeys: ["op-backup"],
    productionCertificationGroupKey: "backup-production-certification",
    resolveRuntimeSnapshots: (input) => [input.backupRuntime],
    runtimeCertificationGroupKey: "backup-runtime-certification",
    securityCertificationGroupKey: "backup-security-certification",
    stressValidationGroupKey: "backup-stress-validation"
  },
  {
    certificationName: "Disaster Recovery Final Certification",
    certificationScope: "OP-16 Disaster Recovery Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-disaster-recovery-data",
    expectedSources: ["operations_disaster_recovery_runtime"],
    finalGuarantee: "Disaster Recovery Runtime is read-only",
    groupKey: "disaster-recovery-final-certification",
    hardeningGroupKey: "disaster-recovery-hardening",
    moduleKeys: ["op-disaster-recovery"],
    productionCertificationGroupKey: "disaster-recovery-production-certification",
    resolveRuntimeSnapshots: (input) => [input.disasterRecoveryRuntime],
    runtimeCertificationGroupKey: "disaster-recovery-runtime-certification",
    securityCertificationGroupKey: "disaster-recovery-security-certification",
    stressValidationGroupKey: "disaster-recovery-stress-validation"
  },
  {
    certificationName: "Diagnostics Final Certification",
    certificationScope: "OP-17 Diagnostics Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-diagnostics-data",
    expectedSources: ["operations_diagnostics_runtime"],
    finalGuarantee: "Diagnostics Runtime is read-only",
    groupKey: "diagnostics-final-certification",
    hardeningGroupKey: "diagnostics-hardening",
    moduleKeys: ["op-diagnostics"],
    productionCertificationGroupKey: "diagnostics-production-certification",
    resolveRuntimeSnapshots: (input) => [input.diagnosticsRuntime],
    runtimeCertificationGroupKey: "diagnostics-runtime-certification",
    securityCertificationGroupKey: "diagnostics-security-certification",
    stressValidationGroupKey: "diagnostics-stress-validation"
  },
  {
    certificationName: "Safe Controls Final Certification",
    certificationScope: "OP-18 Safe Controls Runtime is disabled and final production certified",
    dataCertificationKey: "op-cert-safe-controls-data",
    expectedSources: ["operations_safe_controls_runtime"],
    finalGuarantee: "Safe Controls Runtime is disabled and non-executable",
    groupKey: "safe-controls-final-certification",
    hardeningGroupKey: "safe-controls-hardening",
    moduleKeys: ["op-safe-controls"],
    productionCertificationGroupKey: "safe-controls-production-certification",
    resolveRuntimeSnapshots: (input) => [input.safeControlsRuntime],
    runtimeCertificationGroupKey: "safe-controls-runtime-certification",
    securityCertificationGroupKey: "safe-controls-security-certification",
    stressValidationGroupKey: "safe-controls-stress-validation"
  },
  {
    certificationName: "Status Final Certification",
    certificationScope: "OP-19 Operations Status Runtime is derived only and final production certified",
    dataCertificationKey: "op-cert-status-data",
    expectedSources: ["operations_status_runtime"],
    finalGuarantee: "Operations Status Runtime is derived only",
    groupKey: "status-final-certification",
    hardeningGroupKey: "status-hardening",
    moduleKeys: ["operations_status_runtime"],
    productionCertificationGroupKey: "status-production-certification",
    resolveRuntimeSnapshots: (input) => [input.statusRuntime],
    runtimeCertificationGroupKey: "status-runtime-certification",
    securityCertificationGroupKey: "status-security-certification",
    stressValidationGroupKey: "status-stress-validation"
  },
  {
    certificationName: "Visibility Final Certification",
    certificationScope: "OP-20 Operations Visibility Runtime is derived only and final production certified",
    dataCertificationKey: "op-cert-visibility-data",
    expectedSources: ["operations_visibility_runtime"],
    finalGuarantee: "Operations Visibility Runtime is derived only",
    groupKey: "visibility-final-certification",
    hardeningGroupKey: "visibility-hardening",
    moduleKeys: ["operations_visibility_runtime"],
    productionCertificationGroupKey: "visibility-production-certification",
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime],
    runtimeCertificationGroupKey: "visibility-runtime-certification",
    securityCertificationGroupKey: "visibility-security-certification",
    stressValidationGroupKey: "visibility-stress-validation"
  },
  {
    certificationName: "Audit Final Certification",
    certificationScope: "OP-21 Operations Audit Runtime is read-only and final production certified",
    dataCertificationKey: "op-cert-audit-data",
    expectedSources: ["operations_audit_runtime"],
    finalGuarantee: "Operations Audit Runtime is read-only",
    groupKey: "audit-final-certification",
    hardeningGroupKey: "audit-hardening",
    moduleKeys: ["operations_audit_runtime"],
    productionCertificationGroupKey: "audit-production-certification",
    resolveRuntimeSnapshots: (input) => [input.auditRuntime],
    runtimeCertificationGroupKey: "audit-runtime-certification",
    securityCertificationGroupKey: "audit-security-certification",
    stressValidationGroupKey: "audit-stress-validation"
  },
  {
    certificationName: "Review Final Certification",
    certificationScope: "OP-22 Operations Review Runtime is derived only and final production certified",
    dataCertificationKey: "op-cert-review-data",
    expectedSources: ["operations_review_runtime"],
    finalGuarantee: "Operations Review Runtime is derived only",
    groupKey: "review-final-certification",
    hardeningGroupKey: "review-hardening",
    moduleKeys: ["operations_review_runtime"],
    productionCertificationGroupKey: "review-production-certification",
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime],
    runtimeCertificationGroupKey: "review-runtime-certification",
    securityCertificationGroupKey: "review-security-certification",
    stressValidationGroupKey: "review-stress-validation"
  },
  {
    certificationName: "Data Final Certification",
    certificationScope: "OP-23 Operations Data Certification is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["operations_data_certification_runtime"],
    finalGuarantee: "Operations Data Certification is read-only",
    groupKey: "data-final-certification",
    hardeningGroupKey: "certification-hardening",
    moduleKeys: ["operations_data_certification_runtime"],
    productionCertificationGroupKey: "data-certification-review",
    resolveRuntimeSnapshots: (input) => [input.dataCertification],
    runtimeCertificationGroupKey: "data-certification-review",
    securityCertificationGroupKey: "data-certification-security-review",
    stressValidationGroupKey: "certification-stress-validation"
  },
  {
    certificationName: "Security Final Certification",
    certificationScope: "OP-24 Operations Security Certification is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["operations_security_certification_runtime"],
    finalGuarantee: "Operations Security Certification is read-only",
    groupKey: "security-final-certification",
    hardeningGroupKey: "certification-hardening",
    moduleKeys: ["operations_security_certification_runtime"],
    productionCertificationGroupKey: "security-certification-review",
    resolveRuntimeSnapshots: (input) => [input.securityCertification],
    runtimeCertificationGroupKey: "security-certification-review",
    securityCertificationGroupKey: "data-certification-security-review",
    stressValidationGroupKey: "certification-stress-validation"
  },
  {
    certificationName: "Runtime Final Certification",
    certificationScope: "OP-25 Operations Runtime Certification is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["operations_runtime_certification_runtime"],
    finalGuarantee: "Operations Runtime Certification is read-only",
    groupKey: "runtime-final-certification",
    hardeningGroupKey: "certification-hardening",
    moduleKeys: ["operations_runtime_certification_runtime"],
    productionCertificationGroupKey: "runtime-certification-review",
    resolveRuntimeSnapshots: (input) => [input.runtimeCertification],
    runtimeCertificationGroupKey: null,
    securityCertificationGroupKey: null,
    stressValidationGroupKey: "certification-stress-validation"
  },
  {
    certificationName: "Production Final Certification",
    certificationScope: "OP-26 Operations Production Certification is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["operations_production_certification_runtime"],
    finalGuarantee: "Operations Production Certification is read-only",
    groupKey: "production-final-certification",
    hardeningGroupKey: "certification-hardening",
    moduleKeys: ["operations_production_certification_runtime"],
    productionCertificationGroupKey: null,
    resolveRuntimeSnapshots: (input) => [input.productionCertification],
    runtimeCertificationGroupKey: null,
    securityCertificationGroupKey: null,
    stressValidationGroupKey: "certification-stress-validation"
  },
  {
    certificationName: "Stress Validation Final Certification",
    certificationScope: "OP-27 Operations Stress Validation is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["operations_stress_validation_runtime"],
    finalGuarantee: "Operations Stress Validation is read-only",
    groupKey: "stress-validation-final-certification",
    hardeningGroupKey: "stress-validation-hardening",
    moduleKeys: ["operations_stress_validation_runtime"],
    productionCertificationGroupKey: null,
    resolveRuntimeSnapshots: (input) => [input.stressValidation],
    runtimeCertificationGroupKey: null,
    securityCertificationGroupKey: null,
    stressValidationGroupKey: null
  },
  {
    certificationName: "Hardening Final Certification",
    certificationScope: "OP-28 Operations Production Hardening is read-only and final production certified",
    dataCertificationKey: null,
    expectedSources: ["operations_production_hardening_runtime"],
    finalGuarantee: "Operations Production Hardening is read-only",
    groupKey: "hardening-final-certification",
    hardeningGroupKey: null,
    moduleKeys: ["operations_production_hardening_runtime"],
    productionCertificationGroupKey: null,
    resolveRuntimeSnapshots: (input) => [input.productionHardening],
    runtimeCertificationGroupKey: null,
    securityCertificationGroupKey: null,
    stressValidationGroupKey: null
  }
] as const;

function buildSafeControls() {
  return OPERATIONS_FINAL_PRODUCTION_CERTIFICATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function collectModuleCounts(input: OperationsFinalProductionCertificationInput, moduleKeys: readonly string[]) {
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

function mapHardeningStatus(item: OperationsProductionHardeningItem | null): OperationsFinalCertificationStatus {
  if (!item) {
    return "review_required";
  }

  return isHardeningScopeReady(item) ? "certified" : item.readOnlyHardeningStatus === "blocked" ? "blocked" : "review_required";
}

function mapDataSafetyStatus(item: OperationsDataCertificationItem | null): OperationsFinalCertificationStatus {
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
): OperationsFinalCertificationStatus {
  if (!item) {
    return "review_required";
  }

  return item[field];
}

function mapSecurityStatus(item: OperationsSecurityCertificationItem | null): OperationsFinalCertificationStatus {
  if (!item) {
    return "review_required";
  }

  return item.secretSafetyStatus === "certified" && item.privateDataSafetyStatus === "certified"
    ? "certified"
    : "review_required";
}

function resolveFinalProductionStatus(input: {
  blockedModules: number;
  dataSafetyStatus: OperationsFinalCertificationStatus;
  executionSafetyStatus: OperationsFinalCertificationStatus;
  hardeningStatus: OperationsFinalCertificationStatus;
  mutationSafetyStatus: OperationsFinalCertificationStatus;
  readOnlyStatus: OperationsFinalCertificationStatus;
  runtimeIntegrityStatus: OperationsFinalCertificationStatus;
  runtimeShapeValid: boolean;
  securitySafetyStatus: OperationsFinalCertificationStatus;
  stressStable: boolean;
  warningModules: number;
}): OperationsFinalProductionStatus {
  if (
    !input.runtimeShapeValid ||
    input.blockedModules > 0 ||
    input.runtimeIntegrityStatus === "blocked" ||
    input.dataSafetyStatus === "blocked" ||
    input.securitySafetyStatus === "blocked" ||
    input.hardeningStatus === "blocked"
  ) {
    return "blocked";
  }

  if (
    input.warningModules > 0 ||
    input.runtimeIntegrityStatus === "warning" ||
    input.dataSafetyStatus === "warning" ||
    input.securitySafetyStatus === "warning" ||
    input.hardeningStatus === "warning"
  ) {
    return "warning";
  }

  const certified =
    input.readOnlyStatus === "certified" &&
    input.mutationSafetyStatus === "certified" &&
    input.executionSafetyStatus === "certified" &&
    input.dataSafetyStatus === "certified" &&
    input.securitySafetyStatus === "certified" &&
    input.runtimeIntegrityStatus === "certified" &&
    input.hardeningStatus === "certified" &&
    input.stressStable;

  return certified ? "final_production_certified" : "review_required";
}

function buildFinalCertificationItem(
  definition: FinalScopeDefinition,
  input: OperationsFinalProductionCertificationInput
): OperationsFinalProductionCertificationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const runtimeShapeValid = validateRuntimeShape(snapshots, definition.expectedSources);
  const productionCertificationItem = definition.productionCertificationGroupKey
    ? input.productionCertificationItems.find((item) => item.groupKey === definition.productionCertificationGroupKey) ?? null
    : null;
  const runtimeCertificationItem = definition.runtimeCertificationGroupKey
    ? input.runtimeCertificationItems.find((item) => item.groupKey === definition.runtimeCertificationGroupKey) ?? null
    : null;
  const dataCertificationItem = definition.dataCertificationKey
    ? input.dataCertificationItems.find((item) => item.certificationKey === definition.dataCertificationKey) ?? null
    : null;
  const securityCertificationItem = definition.securityCertificationGroupKey
    ? input.securityCertificationItems.find((item) => item.groupKey === definition.securityCertificationGroupKey) ?? null
    : null;
  const hardeningItem = definition.hardeningGroupKey
    ? input.productionHardeningItems.find((item) => item.groupKey === definition.hardeningGroupKey) ?? null
    : null;
  const stressItem = definition.stressValidationGroupKey
    ? input.stressValidationItems.find((item) => item.groupKey === definition.stressValidationGroupKey) ?? null
    : null;
  const moduleCounts =
    definition.groupKey === "data-final-certification"
      ? {
          blockedModules: input.dataCertification.blockedScopes,
          certifiedModules: input.dataCertification.certifiedScopes,
          warningModules: input.dataCertification.warningScopes
        }
      : definition.groupKey === "security-final-certification"
        ? {
            blockedModules: input.securityCertification.blockedScopes,
            certifiedModules: input.securityCertification.certifiedScopes,
            warningModules: input.securityCertification.warningScopes
          }
        : definition.groupKey === "runtime-final-certification"
          ? {
              blockedModules: input.runtimeCertification.blockedScopes,
              certifiedModules: input.runtimeCertification.certifiedScopes,
              warningModules: input.runtimeCertification.warningScopes
            }
          : definition.groupKey === "production-final-certification"
            ? {
                blockedModules: input.productionCertification.blockedScopes,
                certifiedModules: input.productionCertification.productionReadyScopes,
                warningModules: input.productionCertification.warningScopes
              }
            : definition.groupKey === "stress-validation-final-certification"
              ? {
                  blockedModules: input.stressValidation.blockedScopes,
                  certifiedModules: input.stressValidation.stableScopes,
                  warningModules: input.stressValidation.warningScopes
                }
              : definition.groupKey === "hardening-final-certification"
                ? {
                    blockedModules: input.productionHardening.blockedScopes,
                    certifiedModules: input.productionHardening.hardenedScopes,
                    warningModules: input.productionHardening.warningScopes
                  }
                : collectModuleCounts(input, definition.moduleKeys);
  const readOnlyStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-final-certification" ||
        definition.groupKey === "production-final-certification" ||
        definition.groupKey === "stress-validation-final-certification" ||
        definition.groupKey === "hardening-final-certification"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "readOnlyStatus");
  const mutationSafetyStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-final-certification" ||
        definition.groupKey === "production-final-certification" ||
        definition.groupKey === "stress-validation-final-certification" ||
        definition.groupKey === "hardening-final-certification"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "mutationSafetyStatus");
  const executionSafetyStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-final-certification" ||
        definition.groupKey === "production-final-certification" ||
        definition.groupKey === "stress-validation-final-certification" ||
        definition.groupKey === "hardening-final-certification"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "executionSafetyStatus");
  const dataSafetyStatus =
    definition.groupKey === "data-final-certification" ||
    definition.groupKey === "security-final-certification" ||
    definition.groupKey === "runtime-final-certification" ||
    definition.groupKey === "production-final-certification" ||
    definition.groupKey === "stress-validation-final-certification" ||
    definition.groupKey === "hardening-final-certification"
      ? runtimeShapeValid
        ? "certified"
        : "review_required"
      : mapDataSafetyStatus(dataCertificationItem);
  const securitySafetyStatus =
    definition.groupKey === "security-final-certification" ||
    definition.groupKey === "runtime-final-certification" ||
    definition.groupKey === "production-final-certification" ||
    definition.groupKey === "stress-validation-final-certification" ||
    definition.groupKey === "hardening-final-certification"
      ? runtimeShapeValid
        ? "certified"
        : "review_required"
      : mapSecurityStatus(securityCertificationItem);
  const runtimeIntegrityStatus = !runtimeShapeValid
    ? "review_required"
    : definition.groupKey === "runtime-final-certification" ||
        definition.groupKey === "production-final-certification" ||
        definition.groupKey === "stress-validation-final-certification" ||
        definition.groupKey === "hardening-final-certification"
      ? "certified"
      : mapRuntimeCertificationStatus(runtimeCertificationItem, "runtimeIntegrityStatus");
  const hardeningStatus =
    definition.groupKey === "hardening-final-certification"
      ? runtimeShapeValid && input.productionHardening.overallStatus === "operations_production_hardening_ready"
        ? "certified"
        : "review_required"
      : mapHardeningStatus(hardeningItem);
  const stressStable = definition.groupKey === "stress-validation-final-certification"
    ? runtimeShapeValid && input.stressValidation.overallStatus === "operations_stress_validation_ready"
    : stressItem
      ? isStressScopeStable(stressItem)
      : true;
  const finalProductionStatus = resolveFinalProductionStatus({
    blockedModules: moduleCounts.blockedModules,
    dataSafetyStatus,
    executionSafetyStatus,
    hardeningStatus,
    mutationSafetyStatus,
    readOnlyStatus,
    runtimeIntegrityStatus,
    runtimeShapeValid,
    securitySafetyStatus,
    stressStable,
    warningModules: moduleCounts.warningModules
  });

  return {
    blockedModules: moduleCounts.blockedModules,
    certificationName: definition.certificationName,
    certificationScope: definition.certificationScope,
    certifiedModules: moduleCounts.certifiedModules,
    dataSafetyStatus,
    executionSafetyStatus,
    finalCertificationKey: `op-final-${definition.groupKey}`,
    finalProductionStatus,
    groupKey: definition.groupKey,
    hardeningStatus,
    mutationSafetyStatus,
    readOnlyStatus,
    runtimeIntegrityStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `guarantee ${definition.finalGuarantee}`,
      `final ${finalProductionStatus}`,
      `integrity ${runtimeIntegrityStatus}`,
      `read only ${readOnlyStatus}`,
      `hardening ${hardeningStatus}`,
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

export function isFinalScopeCertified(item: OperationsFinalProductionCertificationItem) {
  return item.finalProductionStatus === "final_production_certified";
}

export function buildOperationsFinalProductionCertificationGroups(items: OperationsFinalProductionCertificationItem[]) {
  return FINAL_GROUP_DEFINITIONS.map((definition) => {
    const groupItems = items.filter((item) => item.groupKey === definition.groupKey);

    return {
      groupKey: definition.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: definition.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsFinalProductionCertificationSummary(
  items: OperationsFinalProductionCertificationItem[]
): OperationsFinalProductionCertificationSummary {
  const certifiedScopes = items.filter((item) => isFinalScopeCertified(item)).length;
  const reviewRequiredScopes = items.filter((item) => item.finalProductionStatus === "review_required").length;
  const blockedScopes = items.filter((item) => item.finalProductionStatus === "blocked").length;
  const warningScopes = items.filter((item) => item.finalProductionStatus === "warning").length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 || warningScopes > 0
      ? ("needs_attention" as const)
      : ("operations_final_production_certification_ready" as const);

  return {
    blockedScopes,
    certifiedScopes,
    groupCount: buildOperationsFinalProductionCertificationGroups(items).length,
    overallStatus,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    reviewRequiredScopes,
    source: OPERATIONS_FINAL_PRODUCTION_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} final certifications`,
      `${certifiedScopes} final production certified`,
      `${reviewRequiredScopes} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`
    ].join("; "),
    totalCertifications: items.length,
    warningScopes
  };
}

export function operationsFinalCertificationStatusLabel(status: OperationsFinalCertificationStatus) {
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

export function operationsFinalProductionStatusLabel(status: OperationsFinalProductionStatus) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "final_production_certified":
      return "Final Production Certified";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function operationsFinalCertificationStatusTone(
  status: OperationsFinalCertificationStatus | OperationsFinalProductionStatus
) {
  switch (status) {
    case "certified":
    case "final_production_certified":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "blocked":
      return "red" as const;
  }
}

export function buildOperationsFinalProductionCertificationReadOnlySafe(
  input: OperationsFinalProductionCertificationInput
) {
  const finalCertificationItems = FINAL_SCOPE_DEFINITIONS.map((definition) =>
    buildFinalCertificationItem(definition, input)
  );
  const groups = buildOperationsFinalProductionCertificationGroups(finalCertificationItems);
  const summary = getOperationsFinalProductionCertificationSummary(finalCertificationItems);

  return {
    finalCertification: summary,
    finalCertificationItems,
    groups,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsFinalProductionCertificationToAdminFields(
  input: ReturnType<typeof buildOperationsFinalProductionCertificationReadOnlySafe>
) {
  return {
    finalCertification: input.finalCertification,
    finalCertificationItems: input.finalCertificationItems,
    groups: input.groups,
    safeControls: input.safeControls
  };
}
