import "server-only";

import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import type {
  OperationsDataCertificationItem,
  OperationsDataCertificationSummary
} from "@/src/lib/operations/operations-data-certification-runtime";
import type { OperationsAuditRuntimeItem } from "@/src/lib/operations/operations-audit-runtime";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE
} from "@/src/lib/operations/operations-registry-runtime";
import type { OperationsReviewRuntimeItem } from "@/src/lib/operations/operations-review-runtime";
import type { OperationsStatusRuntimeItem } from "@/src/lib/operations/operations-status-runtime";
import type { OperationsVisibilityRuntimeItem } from "@/src/lib/operations/operations-visibility-runtime";

export type OperationsSecurityCertificationSource = "operations_security_certification_runtime";

export type OperationsSecurityCertificationGroupKey =
  | "ai-queue-security-certification"
  | "audit-security-certification"
  | "backup-security-certification"
  | "cron-security-certification"
  | "dashboard-security-certification"
  | "data-certification-security-review"
  | "database-security-certification"
  | "diagnostics-security-certification"
  | "disaster-recovery-security-certification"
  | "domain-email-queue-security-certification"
  | "email-queue-security-certification"
  | "monitoring-security-certification"
  | "queue-security-certification"
  | "registry-security-certification"
  | "review-security-certification"
  | "safe-controls-security-certification"
  | "status-security-certification"
  | "storage-security-certification"
  | "visibility-security-certification"
  | "worker-security-certification";

export type OperationsSecurityCertificationStatus = "certified" | "review_required";

export type OperationsSecurityCertificationSafeControlKey =
  | "approve_security_certification"
  | "export_security_report"
  | "mark_security_certified"
  | "recheck_security"
  | "resolve_security_blocker";

export type OperationsSecurityCertificationSafeControl = {
  enabled: false;
  key: OperationsSecurityCertificationSafeControlKey;
  label: string;
  note: string;
};

export type OperationsSecurityCertificationItem = {
  actionSafetyStatus: OperationsSecurityCertificationStatus;
  blockedModules: number;
  certificationName: string;
  certificationScope: string;
  certifiedModules: number;
  executionSafetyStatus: OperationsSecurityCertificationStatus;
  groupKey: OperationsSecurityCertificationGroupKey;
  mutationSafetyStatus: OperationsSecurityCertificationStatus;
  ownershipSafetyStatus: OperationsSecurityCertificationStatus;
  privateDataSafetyStatus: OperationsSecurityCertificationStatus;
  readOnlyStatus: OperationsSecurityCertificationStatus;
  rlsSafetyStatus: OperationsSecurityCertificationStatus;
  safeControls: OperationsSecurityCertificationSafeControl[];
  safeSummary: string;
  secretSafetyStatus: OperationsSecurityCertificationStatus;
  securityCertificationKey: string;
  superAdminOnlyStatus: OperationsSecurityCertificationStatus;
  warningModules: number;
};

export type OperationsSecurityCertificationGroup = {
  groupKey: OperationsSecurityCertificationGroupKey;
  itemCount: number;
  items: OperationsSecurityCertificationItem[];
  title: string;
};

export type OperationsSecurityCertificationSummary = {
  blockedScopes: number;
  certifiedScopes: number;
  groupCount: number;
  overallStatus: "needs_attention" | "operations_security_certification_ready";
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  reviewRequiredScopes: number;
  source: OperationsSecurityCertificationSource;
  summary: string;
  totalCertifications: number;
  warningScopes: number;
};

type RuntimeSnapshot = {
  readOnly?: boolean;
  source?: string;
  summary?: string;
};

export type OperationsSecurityCertificationInput = {
  aiQueueRuntime: RuntimeSnapshot;
  auditItems: OperationsAuditRuntimeItem[];
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
  statusItems: OperationsStatusRuntimeItem[];
  statusRuntime: RuntimeSnapshot;
  storageMetricsRuntime: RuntimeSnapshot;
  storageRuntime: RuntimeSnapshot;
  visibilityItems: OperationsVisibilityRuntimeItem[];
  visibilityRuntime: RuntimeSnapshot;
  workerMonitoringRuntime: RuntimeSnapshot;
  workerRuntime: RuntimeSnapshot;
};

type SecurityScopeDefinition = {
  certificationName: string;
  certificationScope: string;
  dataCertificationKey: string | null;
  expectedSources: readonly string[];
  groupKey: OperationsSecurityCertificationGroupKey;
  moduleKeys: readonly string[];
  registryKeys: readonly (string | null)[];
  resolveRuntimeSnapshots: (input: OperationsSecurityCertificationInput) => RuntimeSnapshot[];
};

export const OPERATIONS_SECURITY_CERTIFICATION_SOURCE = "operations_security_certification_runtime" as const;

export const OPERATIONS_SECURITY_CERTIFICATION_SAFE_CONTROLS: readonly OperationsSecurityCertificationSafeControl[] = [
  {
    enabled: false,
    key: "approve_security_certification",
    label: "Approve Security Certification",
    note: "Read-only placeholder. No security certification approval or mutation runs during OP-24 page load."
  },
  {
    enabled: false,
    key: "recheck_security",
    label: "Recheck Security",
    note: "Read-only placeholder. No security recheck execution, provider call, or mutation runs during OP-24 page load."
  },
  {
    enabled: false,
    key: "export_security_report",
    label: "Export Security Report",
    note: "Read-only placeholder. No security export or provider call runs during OP-24 page load."
  },
  {
    enabled: false,
    key: "resolve_security_blocker",
    label: "Resolve Security Blocker",
    note: "Read-only placeholder. No security blocker resolve action runs during OP-24 page load."
  },
  {
    enabled: false,
    key: "mark_security_certified",
    label: "Mark Security Certified",
    note: "Read-only placeholder. No security certification record write or policy mutation runs during OP-24 page load."
  }
] as const;

const SECURITY_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsSecurityCertificationGroupKey;
  title: string;
}> = [
  { groupKey: "registry-security-certification", title: "Registry Security Certification" },
  { groupKey: "dashboard-security-certification", title: "Dashboard Security Certification" },
  { groupKey: "queue-security-certification", title: "Queue Security Certification" },
  { groupKey: "worker-security-certification", title: "Worker Security Certification" },
  { groupKey: "cron-security-certification", title: "Cron Security Certification" },
  { groupKey: "storage-security-certification", title: "Storage Security Certification" },
  { groupKey: "database-security-certification", title: "Database Security Certification" },
  { groupKey: "email-queue-security-certification", title: "Email Queue Security Certification" },
  { groupKey: "ai-queue-security-certification", title: "AI Queue Security Certification" },
  { groupKey: "domain-email-queue-security-certification", title: "Domain & Email Queue Security Certification" },
  { groupKey: "monitoring-security-certification", title: "Monitoring Security Certification" },
  { groupKey: "backup-security-certification", title: "Backup Security Certification" },
  { groupKey: "disaster-recovery-security-certification", title: "Disaster Recovery Security Certification" },
  { groupKey: "diagnostics-security-certification", title: "Diagnostics Security Certification" },
  { groupKey: "safe-controls-security-certification", title: "Safe Controls Security Certification" },
  { groupKey: "status-security-certification", title: "Status Security Certification" },
  { groupKey: "visibility-security-certification", title: "Visibility Security Certification" },
  { groupKey: "audit-security-certification", title: "Audit Security Certification" },
  { groupKey: "review-security-certification", title: "Review Security Certification" },
  { groupKey: "data-certification-security-review", title: "Data Certification Security Review" }
];

const SECURITY_SCOPE_DEFINITIONS: readonly SecurityScopeDefinition[] = [
  {
    certificationName: "Registry Security Certification",
    certificationScope: "OP-1 Operations Registry Super Admin read-only security metadata",
    dataCertificationKey: "op-cert-registry-data",
    expectedSources: ["operations_registry_runtime"],
    groupKey: "registry-security-certification",
    moduleKeys: ["operations_registry_runtime"],
    registryKeys: [null],
    resolveRuntimeSnapshots: (input) => [input.registryRuntime]
  },
  {
    certificationName: "Dashboard Security Certification",
    certificationScope: "OP-2 Operations Dashboard Super Admin read-only security metadata",
    dataCertificationKey: "op-cert-dashboard-data",
    expectedSources: ["operations_dashboard_runtime"],
    groupKey: "dashboard-security-certification",
    moduleKeys: ["operations_dashboard_runtime"],
    registryKeys: [null],
    resolveRuntimeSnapshots: (input) => [input.dashboardRuntime]
  },
  {
    certificationName: "Queue Security Certification",
    certificationScope: "OP-3 Operations Queue read-only security metadata",
    dataCertificationKey: "op-cert-queue-data",
    expectedSources: ["operations_queue_runtime"],
    groupKey: "queue-security-certification",
    moduleKeys: ["op-queue-tables"],
    registryKeys: ["op-queue-tables"],
    resolveRuntimeSnapshots: (input) => [input.queueRuntime]
  },
  {
    certificationName: "Worker Security Certification",
    certificationScope: "OP-4 and OP-12 Worker read-only security metadata",
    dataCertificationKey: "op-cert-worker-data",
    expectedSources: ["operations_worker_runtime", "operations_worker_monitoring_runtime"],
    groupKey: "worker-security-certification",
    moduleKeys: ["op-worker-tables", "op-worker-health"],
    registryKeys: ["op-worker-tables", "op-worker-health"],
    resolveRuntimeSnapshots: (input) => [input.workerRuntime, input.workerMonitoringRuntime]
  },
  {
    certificationName: "Cron Security Certification",
    certificationScope: "OP-5 and OP-13 Cron read-only security metadata",
    dataCertificationKey: "op-cert-cron-data",
    expectedSources: ["operations_cron_runtime", "operations_cron_monitoring_runtime"],
    groupKey: "cron-security-certification",
    moduleKeys: ["op-cron-jobs", "op-cron-health"],
    registryKeys: ["op-cron-jobs", "op-cron-health"],
    resolveRuntimeSnapshots: (input) => [input.cronRuntime, input.cronMonitoringRuntime]
  },
  {
    certificationName: "Storage Security Certification",
    certificationScope: "OP-5 and OP-14 Storage read-only security metadata",
    dataCertificationKey: "op-cert-storage-data",
    expectedSources: ["operations_storage_runtime", "operations_storage_metrics_runtime"],
    groupKey: "storage-security-certification",
    moduleKeys: ["op-storage-health", "op-storage-metrics"],
    registryKeys: ["op-storage-health", "op-storage-metrics"],
    resolveRuntimeSnapshots: (input) => [input.storageRuntime, input.storageMetricsRuntime]
  },
  {
    certificationName: "Database Security Certification",
    certificationScope: "OP-6 Operations Database read-only security metadata",
    dataCertificationKey: "op-cert-database-data",
    expectedSources: ["operations_database_runtime"],
    groupKey: "database-security-certification",
    moduleKeys: ["op-database-health"],
    registryKeys: ["op-database-health"],
    resolveRuntimeSnapshots: (input) => [input.databaseRuntime]
  },
  {
    certificationName: "Email Queue Security Certification",
    certificationScope: "OP-7 Operations Email Queue read-only security metadata",
    dataCertificationKey: "op-cert-email-queue-data",
    expectedSources: ["operations_email_queue_runtime"],
    groupKey: "email-queue-security-certification",
    moduleKeys: ["op-email-queue"],
    registryKeys: ["op-email-queue"],
    resolveRuntimeSnapshots: (input) => [input.emailQueueRuntime]
  },
  {
    certificationName: "AI Queue Security Certification",
    certificationScope: "OP-8 Operations AI Queue read-only security metadata",
    dataCertificationKey: "op-cert-ai-queue-data",
    expectedSources: ["operations_ai_queue_runtime"],
    groupKey: "ai-queue-security-certification",
    moduleKeys: ["op-ai-queue"],
    registryKeys: ["op-ai-queue"],
    resolveRuntimeSnapshots: (input) => [input.aiQueueRuntime]
  },
  {
    certificationName: "Domain & Email Queue Security Certification",
    certificationScope: "OP-9 Operations Domain and Email Queue read-only security metadata",
    dataCertificationKey: "op-cert-domain-email-queue-data",
    expectedSources: ["operations_domain_email_queue_runtime"],
    groupKey: "domain-email-queue-security-certification",
    moduleKeys: ["op-domain-email-queue"],
    registryKeys: ["op-domain-email-queue"],
    resolveRuntimeSnapshots: (input) => [input.domainEmailQueueRuntime]
  },
  {
    certificationName: "Monitoring Security Certification",
    certificationScope: "OP-11 Operations Monitoring Events read-only security metadata",
    dataCertificationKey: "op-cert-monitoring-data",
    expectedSources: ["operations_monitoring_events_runtime"],
    groupKey: "monitoring-security-certification",
    moduleKeys: ["op-monitoring-events"],
    registryKeys: ["op-monitoring-events"],
    resolveRuntimeSnapshots: (input) => [input.monitoringEventsRuntime]
  },
  {
    certificationName: "Backup Security Certification",
    certificationScope: "OP-15 Operations Backup read-only security metadata",
    dataCertificationKey: "op-cert-backup-data",
    expectedSources: ["operations_backup_runtime"],
    groupKey: "backup-security-certification",
    moduleKeys: ["op-backup"],
    registryKeys: ["op-backup"],
    resolveRuntimeSnapshots: (input) => [input.backupRuntime]
  },
  {
    certificationName: "Disaster Recovery Security Certification",
    certificationScope: "OP-16 Operations Disaster Recovery read-only security metadata",
    dataCertificationKey: "op-cert-disaster-recovery-data",
    expectedSources: ["operations_disaster_recovery_runtime"],
    groupKey: "disaster-recovery-security-certification",
    moduleKeys: ["op-disaster-recovery"],
    registryKeys: ["op-disaster-recovery"],
    resolveRuntimeSnapshots: (input) => [input.disasterRecoveryRuntime]
  },
  {
    certificationName: "Diagnostics Security Certification",
    certificationScope: "OP-17 Operations Diagnostics read-only security metadata",
    dataCertificationKey: "op-cert-diagnostics-data",
    expectedSources: ["operations_diagnostics_runtime"],
    groupKey: "diagnostics-security-certification",
    moduleKeys: ["op-diagnostics"],
    registryKeys: ["op-diagnostics"],
    resolveRuntimeSnapshots: (input) => [input.diagnosticsRuntime]
  },
  {
    certificationName: "Safe Controls Security Certification",
    certificationScope: "OP-18 Operations Safe Controls disabled-action security metadata",
    dataCertificationKey: "op-cert-safe-controls-data",
    expectedSources: ["operations_safe_controls_runtime"],
    groupKey: "safe-controls-security-certification",
    moduleKeys: ["op-safe-controls"],
    registryKeys: ["op-safe-controls"],
    resolveRuntimeSnapshots: (input) => [input.safeControlsRuntime]
  },
  {
    certificationName: "Status Security Certification",
    certificationScope: "OP-19 Operations Status read-only security metadata",
    dataCertificationKey: "op-cert-status-data",
    expectedSources: ["operations_status_runtime"],
    groupKey: "status-security-certification",
    moduleKeys: ["operations_status_runtime"],
    registryKeys: [null],
    resolveRuntimeSnapshots: (input) => [input.statusRuntime]
  },
  {
    certificationName: "Visibility Security Certification",
    certificationScope: "OP-20 Operations Visibility read-only security metadata",
    dataCertificationKey: "op-cert-visibility-data",
    expectedSources: ["operations_visibility_runtime"],
    groupKey: "visibility-security-certification",
    moduleKeys: ["operations_visibility_runtime"],
    registryKeys: [null],
    resolveRuntimeSnapshots: (input) => [input.visibilityRuntime]
  },
  {
    certificationName: "Audit Security Certification",
    certificationScope: "OP-21 Operations Audit read-only security metadata",
    dataCertificationKey: "op-cert-audit-data",
    expectedSources: ["operations_audit_runtime"],
    groupKey: "audit-security-certification",
    moduleKeys: ["operations_audit_runtime"],
    registryKeys: [null],
    resolveRuntimeSnapshots: (input) => [input.auditRuntime]
  },
  {
    certificationName: "Review Security Certification",
    certificationScope: "OP-22 Operations Review read-only security metadata",
    dataCertificationKey: "op-cert-review-data",
    expectedSources: ["operations_review_runtime"],
    groupKey: "review-security-certification",
    moduleKeys: ["operations_review_runtime"],
    registryKeys: [null],
    resolveRuntimeSnapshots: (input) => [input.reviewRuntime]
  },
  {
    certificationName: "Data Certification Security Review",
    certificationScope: "OP-23 Operations Data Certification read-only security metadata",
    dataCertificationKey: null,
    expectedSources: ["operations_data_certification_runtime"],
    groupKey: "data-certification-security-review",
    moduleKeys: ["operations_data_certification_runtime"],
    registryKeys: [null],
    resolveRuntimeSnapshots: (input) => [input.dataCertification]
  }
] as const;

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|authorization|bearer|sb_secret|smtp[_-]?pass|smtp[_-]?user|cloudflare|r2[_-]?|aws[_-]?|signed[_-]?url|x-amz-signature|presigned|credential)/i;

const privateDataPattern =
  /(?:customer[_-]?(?:email|phone|name|address)|user[_-]?(?:email|phone|name)|full[_-]?name|@[a-z0-9.-]+\.[a-z]{2,}|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b)/i;

const rlsWeakeningPattern = /(?:rls\s+disabled|disable\s+rls|policy\s+removed|weaken\s+policy|bypass\s+rls|ownership\s+bypass|transfer\s+ownership(?!\s+placeholder))/i;

const unsafeExecutionPattern = /(?:execute\s+queue|run\s+worker|trigger\s+cron|restore\s+backup|run\s+diagnostics(?!\s+placeholder)|provider\s+api\s+call(?!\s+during))/i;

function buildSafeControls() {
  return OPERATIONS_SECURITY_CERTIFICATION_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function sanitizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return maskSensitiveText(value).slice(0, maxLength);
}

function collectModuleCounts(input: OperationsSecurityCertificationInput, moduleKeys: readonly string[]) {
  const reviewItems = input.reviewItems.filter((item) => moduleKeys.includes(item.moduleKey));

  return {
    blockedModules: reviewItems.filter((item) => item.reviewStatus === "blocked").length,
    certifiedModules: reviewItems.filter(
      (item) => item.reviewStatus === "reviewed" || item.reviewStatus === "production_ready_candidate"
    ).length,
    warningModules: reviewItems.filter((item) => item.reviewStatus === "warning").length
  };
}

function collectSafeTexts(input: OperationsSecurityCertificationInput, moduleKeys: readonly string[]) {
  return [
    ...input.statusItems.filter((item) => moduleKeys.includes(item.moduleKey)).map((item) => sanitizeText(item.safeSummary)),
    ...input.visibilityItems.filter((item) => moduleKeys.includes(item.moduleKey)).map((item) => sanitizeText(item.safeSummary)),
    ...input.auditItems.filter((item) => moduleKeys.includes(item.moduleKey)).map((item) => sanitizeText(item.safeSummary)),
    ...input.reviewItems.filter((item) => moduleKeys.includes(item.moduleKey)).map((item) => sanitizeText(item.safeSummary))
  ];
}

function validateSuperAdminOnly(registryKeys: readonly (string | null)[]) {
  const scopedKeys = registryKeys.filter((key): key is string => Boolean(key));

  if (!scopedKeys.length) {
    return "certified" as const;
  }

  return scopedKeys.every((key) => {
    const entry = getOperationsRegistryEntry(key);
    return (
      entry !== null &&
      entry.visibility === "super_admin" &&
      entry.permissions.every((permission) => permission.startsWith("super_admin"))
    );
  })
    ? ("certified" as const)
    : ("review_required" as const);
}

function validateReadOnly(snapshots: RuntimeSnapshot[]) {
  return snapshots.every((snapshot) => snapshot.readOnly === true) ? ("certified" as const) : ("review_required" as const);
}

function validateMutationSafety(snapshots: RuntimeSnapshot[], texts: string[]) {
  if (!snapshots.every((snapshot) => snapshot.readOnly === true)) {
    return "review_required" as const;
  }

  const combined = texts.join(" ").toLowerCase();
  if (/no mutation|read-only|without mutation|does not mutate/.test(combined) || combined.length === 0) {
    return "certified" as const;
  }

  if (/mutate|insert|update|delete|upsert/.test(combined)) {
    return "review_required" as const;
  }

  return "certified" as const;
}

function validateExecutionSafety(texts: string[]) {
  const combined = texts.join(" ").toLowerCase();

  if (unsafeExecutionPattern.test(combined)) {
    return "review_required" as const;
  }

  if (/no execution|read-only page load|without execution|does not execute|disabled safe control/.test(combined)) {
    return "certified" as const;
  }

  return texts.length > 0 ? ("certified" as const) : ("review_required" as const);
}

function validateSecretSafety(texts: string[]) {
  return texts.every((value) => !secretPattern.test(value)) ? ("certified" as const) : ("review_required" as const);
}

function validatePrivateDataSafety(texts: string[]) {
  return texts.every((value) => !privateDataPattern.test(value)) ? ("certified" as const) : ("review_required" as const);
}

function validateRlsSafety(texts: string[]) {
  return texts.every((value) => !rlsWeakeningPattern.test(value)) ? ("certified" as const) : ("review_required" as const);
}

function validateOwnershipSafety(texts: string[]) {
  const combined = texts.join(" ").toLowerCase();
  if (/ownership bypass|bypass ownership|transfer ownership(?! placeholder)/.test(combined)) {
    return "review_required" as const;
  }

  return "certified" as const;
}

function validateActionSafety(definition: SecurityScopeDefinition, dataCertificationItem: OperationsDataCertificationItem | null) {
  if (definition.groupKey === "safe-controls-security-certification") {
    return "certified" as const;
  }

  if (definition.groupKey === "data-certification-security-review") {
    const allDataItemsSafe = dataCertificationItem
      ? true
      : false;

    return allDataItemsSafe ? ("certified" as const) : ("review_required" as const);
  }

  return "certified" as const;
}

function findDataCertificationItem(input: OperationsSecurityCertificationInput, definition: SecurityScopeDefinition) {
  if (definition.groupKey === "data-certification-security-review") {
    return null;
  }

  if (!definition.dataCertificationKey) {
    return null;
  }

  return input.dataCertificationItems.find((item) => item.certificationKey === definition.dataCertificationKey) ?? null;
}

function resolveScopeCounts(input: {
  dataCertificationItem: OperationsDataCertificationItem | null;
  dataCertificationSummary: OperationsDataCertificationSummary | null;
  moduleCounts: ReturnType<typeof collectModuleCounts>;
}) {
  if (input.dataCertificationSummary) {
    return {
      blockedModules: input.dataCertificationSummary.blockedScopes,
      certifiedModules: input.dataCertificationSummary.certifiedScopes,
      warningModules: input.dataCertificationSummary.warningScopes
    };
  }

  return {
    blockedModules: Math.max(input.moduleCounts.blockedModules, input.dataCertificationItem?.blockedModules ?? 0),
    certifiedModules: Math.max(input.moduleCounts.certifiedModules, input.dataCertificationItem?.certifiedModules ?? 0),
    warningModules: Math.max(input.moduleCounts.warningModules, input.dataCertificationItem?.warningModules ?? 0)
  };
}

function buildSecurityCertificationItem(
  definition: SecurityScopeDefinition,
  input: OperationsSecurityCertificationInput
): OperationsSecurityCertificationItem {
  const snapshots = definition.resolveRuntimeSnapshots(input);
  const dataCertificationItem = findDataCertificationItem(input, definition);
  const dataCertificationSummary =
    definition.groupKey === "data-certification-security-review" ? input.dataCertification : null;
  const texts = [
    ...snapshots.map((snapshot) => sanitizeText(snapshot.summary)),
    ...collectSafeTexts(input, definition.moduleKeys),
    ...(dataCertificationItem ? [sanitizeText(dataCertificationItem.safeSummary)] : []),
    ...(dataCertificationSummary ? [sanitizeText(dataCertificationSummary.summary)] : []),
    ...(definition.groupKey === "data-certification-security-review"
      ? input.dataCertificationItems.map((item) => sanitizeText(item.safeSummary))
      : [])
  ];
  const moduleCounts = collectModuleCounts(input, definition.moduleKeys);
  const counts = resolveScopeCounts({
    dataCertificationItem,
    dataCertificationSummary,
    moduleCounts
  });
  const superAdminOnlyStatus = validateSuperAdminOnly(definition.registryKeys);
  const readOnlyStatus = validateReadOnly(snapshots);
  const mutationSafetyStatus = validateMutationSafety(snapshots, texts);
  const executionSafetyStatus = validateExecutionSafety(texts);
  const secretSafetyStatus = validateSecretSafety(texts);
  const privateDataSafetyStatus = validatePrivateDataSafety(texts);
  const rlsSafetyStatus = validateRlsSafety(texts);
  const ownershipSafetyStatus = validateOwnershipSafety(texts);
  const actionSafetyStatus =
    definition.groupKey === "data-certification-security-review"
      ? input.dataCertificationItems.every(
          (item) => item.secretSafetyStatus === "safe" && item.mutationSafetyStatus === "read_only_certified"
        ) && input.dataCertification.readOnly === true
        ? ("certified" as const)
        : ("review_required" as const)
      : validateActionSafety(definition, dataCertificationItem);

  return {
    actionSafetyStatus,
    blockedModules: counts.blockedModules,
    certificationName: definition.certificationName,
    certificationScope: definition.certificationScope,
    certifiedModules: counts.certifiedModules,
    executionSafetyStatus,
    groupKey: definition.groupKey,
    mutationSafetyStatus,
    ownershipSafetyStatus,
    privateDataSafetyStatus,
    readOnlyStatus,
    rlsSafetyStatus,
    safeControls: buildSafeControls(),
    safeSummary: [
      `scope ${definition.certificationScope}`,
      `super admin ${superAdminOnlyStatus}`,
      `read only ${readOnlyStatus}`,
      `secrets ${secretSafetyStatus}`,
      `private data ${privateDataSafetyStatus}`,
      `rls ${rlsSafetyStatus}`,
      `execution ${executionSafetyStatus}`,
      `${counts.blockedModules} blocked`,
      `${counts.warningModules} warning`
    ].join("; "),
    secretSafetyStatus,
    securityCertificationKey: `op-sec-${definition.groupKey}`,
    superAdminOnlyStatus,
    warningModules: counts.warningModules
  };
}

export function operationsSecurityCertificationStatusLabel(status: OperationsSecurityCertificationStatus) {
  return status === "certified" ? "Certified" : "Review Required";
}

export function operationsSecurityCertificationStatusTone(status: OperationsSecurityCertificationStatus) {
  return status === "certified" ? ("green" as const) : ("amber" as const);
}

export function isSecurityScopeCertified(item: OperationsSecurityCertificationItem) {
  return [
    item.superAdminOnlyStatus,
    item.readOnlyStatus,
    item.mutationSafetyStatus,
    item.executionSafetyStatus,
    item.secretSafetyStatus,
    item.privateDataSafetyStatus,
    item.rlsSafetyStatus,
    item.ownershipSafetyStatus,
    item.actionSafetyStatus
  ].every((status) => status === "certified");
}

export function buildOperationsSecurityCertificationGroups(
  items: OperationsSecurityCertificationItem[]
): OperationsSecurityCertificationGroup[] {
  return SECURITY_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsSecurityCertificationSummary(
  items: OperationsSecurityCertificationItem[]
): OperationsSecurityCertificationSummary {
  const certifiedScopes = items.filter((item) => isSecurityScopeCertified(item) && item.blockedModules === 0).length;
  const reviewRequiredScopes = items.filter((item) => !isSecurityScopeCertified(item)).length;
  const blockedScopes = items.filter((item) => item.blockedModules > 0).length;
  const warningScopes = items.filter((item) => item.warningModules > 0).length;
  const overallStatus =
    blockedScopes > 0 || reviewRequiredScopes > 0 ? ("needs_attention" as const) : ("operations_security_certification_ready" as const);

  return {
    blockedScopes,
    certifiedScopes,
    groupCount: buildOperationsSecurityCertificationGroups(items).length,
    overallStatus,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    reviewRequiredScopes,
    source: OPERATIONS_SECURITY_CERTIFICATION_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} security scopes`,
      `${certifiedScopes} certified`,
      `${reviewRequiredScopes} review required`,
      `${blockedScopes} blocked`,
      `${warningScopes} warning`
    ].join("; "),
    totalCertifications: items.length,
    warningScopes
  };
}

export function buildOperationsSecurityCertificationReadOnlySafe(input: OperationsSecurityCertificationInput) {
  const securityCertificationItems = SECURITY_SCOPE_DEFINITIONS.map((definition) =>
    buildSecurityCertificationItem(definition, input)
  );
  const groups = buildOperationsSecurityCertificationGroups(securityCertificationItems);
  const summary = getOperationsSecurityCertificationSummary(securityCertificationItems);

  return {
    groups,
    safeControls: buildSafeControls(),
    securityCertification: summary,
    securityCertificationItems
  };
}

export function mapOperationsSecurityCertificationToAdminFields(
  input: ReturnType<typeof buildOperationsSecurityCertificationReadOnlySafe>
) {
  return {
    groups: input.groups,
    safeControls: input.safeControls,
    securityCertification: input.securityCertification,
    securityCertificationItems: input.securityCertificationItems
  };
}
