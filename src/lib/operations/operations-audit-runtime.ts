import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsImplementationStatus,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";
import type { OperationsStatusRuntimeInput } from "@/src/lib/operations/operations-status-runtime";

export type OperationsAuditRuntimeSource = "operations_audit_runtime";

export type OperationsAuditGroupKey =
  | "ai-queue-audit"
  | "backup-audit"
  | "cron-audit"
  | "dashboard-audit"
  | "database-audit"
  | "diagnostics-audit"
  | "disaster-recovery-audit"
  | "domain-email-queue-audit"
  | "email-queue-audit"
  | "future-audit-hooks"
  | "monitoring-audit"
  | "queue-audit"
  | "registry-audit"
  | "safe-controls-audit"
  | "status-audit"
  | "storage-audit"
  | "visibility-audit"
  | "worker-audit";

export type OperationsAuditRuntimeStatus =
  | "available"
  | "critical"
  | "disabled"
  | "empty"
  | "future_hook"
  | "no_audit_data_detected"
  | "registered"
  | "review_required"
  | "warning";

export type OperationsAuditActorType = "platform" | "super_admin" | "system" | "unknown";

export type OperationsAuditSeverity = "critical" | "info" | "low" | "warning";

export type OperationsAuditReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsAuditSafeControlKey =
  | "export_audit"
  | "inspect_audit"
  | "resolve"
  | "review_actor"
  | "review_payload";

export type OperationsAuditSafeControl = {
  enabled: false;
  key: OperationsAuditSafeControlKey;
  label: string;
  note: string;
};

export type OperationsAuditRuntimeItem = {
  actionType: string;
  actorType: OperationsAuditActorType;
  auditKey: string;
  auditType: string;
  category: string;
  groupKey: OperationsAuditGroupKey;
  moduleKey: string;
  moduleName: string;
  occurredAt: string | null;
  reviewStatus: OperationsAuditReviewStatus;
  runtimeStatus: OperationsAuditRuntimeStatus;
  safeControls: OperationsAuditSafeControl[];
  safeSummary: string;
  severity: OperationsAuditSeverity;
  visibility: OperationsRegistryVisibility;
};

export type OperationsAuditRuntimeGroup = {
  groupKey: OperationsAuditGroupKey;
  itemCount: number;
  items: OperationsAuditRuntimeItem[];
  title: string;
};

export type OperationsAuditRuntimeSummary = {
  availableItems: number;
  criticalItems: number;
  disabledItems: number;
  emptyItems: number;
  futureHookItems: number;
  groupCount: number;
  noAuditDataItems: number;
  overallStatus: "needs_attention" | "operations_audit_runtime_ready";
  readOnly: true;
  registeredItems: number;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  reviewRequiredItems: number;
  source: OperationsAuditRuntimeSource;
  summary: string;
  totalAuditItems: number;
  warningItems: number;
};

type AnyRecord = Record<string, unknown>;

type AuditModuleBinding = {
  auditKey: string;
  category: string;
  groupKey: OperationsAuditGroupKey;
  matchesIntegrationAudit: (category: string, operation: string) => boolean;
  matchesMonitoringEvent: (eventType: string, entityType: string) => boolean;
  moduleKey: string;
  moduleName: string;
  registryKey: string | null;
  resolveProviderStatus: (input: OperationsStatusRuntimeInput) => string;
};

type AuditEventAggregate = {
  eventCount: number;
  failedCount: number;
  latestActionType: string | null;
  latestActorType: OperationsAuditActorType;
  latestAuditType: string;
  latestOccurredAt: string | null;
  warningCount: number;
};

export const OPERATIONS_AUDIT_RUNTIME_SOURCE = "operations_audit_runtime" as const;

export const OPERATIONS_AUDIT_SAFE_CONTROLS: readonly OperationsAuditSafeControl[] = [
  {
    enabled: false,
    key: "inspect_audit",
    label: "Inspect Audit",
    note: "Read-only placeholder. No audit inspection or payload access runs during OP-21 page load."
  },
  {
    enabled: false,
    key: "resolve",
    label: "Resolve",
    note: "Read-only placeholder. No audit resolve action runs during OP-21 page load."
  },
  {
    enabled: false,
    key: "export_audit",
    label: "Export Audit",
    note: "Read-only placeholder. No audit export or provider call runs during OP-21 page load."
  },
  {
    enabled: false,
    key: "review_actor",
    label: "Review Actor",
    note: "Read-only placeholder. No actor review or private user data exposure runs during OP-21 page load."
  },
  {
    enabled: false,
    key: "review_payload",
    label: "Review Payload",
    note: "Read-only placeholder. Raw payloads, headers, and tokens are never rendered during OP-21 page load."
  }
] as const;

const AUDIT_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsAuditGroupKey;
  title: string;
}> = [
  { groupKey: "registry-audit", title: "Registry Audit" },
  { groupKey: "dashboard-audit", title: "Dashboard Audit" },
  { groupKey: "queue-audit", title: "Queue Audit" },
  { groupKey: "worker-audit", title: "Worker Audit" },
  { groupKey: "cron-audit", title: "Cron Audit" },
  { groupKey: "storage-audit", title: "Storage Audit" },
  { groupKey: "database-audit", title: "Database Audit" },
  { groupKey: "email-queue-audit", title: "Email Queue Audit" },
  { groupKey: "ai-queue-audit", title: "AI Queue Audit" },
  { groupKey: "domain-email-queue-audit", title: "Domain & Email Queue Audit" },
  { groupKey: "monitoring-audit", title: "Monitoring Audit" },
  { groupKey: "backup-audit", title: "Backup Audit" },
  { groupKey: "disaster-recovery-audit", title: "Disaster Recovery Audit" },
  { groupKey: "diagnostics-audit", title: "Diagnostics Audit" },
  { groupKey: "safe-controls-audit", title: "Safe Controls Audit" },
  { groupKey: "status-audit", title: "Status Audit" },
  { groupKey: "visibility-audit", title: "Visibility Audit" },
  { groupKey: "future-audit-hooks", title: "Future Audit Hooks" }
];

const AUDIT_MODULE_BINDINGS: readonly AuditModuleBinding[] = [
  {
    auditKey: "op-audit-registry",
    category: "Operations Platform",
    groupKey: "registry-audit",
    matchesIntegrationAudit: (category, operation) =>
      /registry|operations.?platform|platform.?registry/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /registry.?audit|operations.?registry|platform.?registry/i),
    moduleKey: "operations_registry_runtime",
    moduleName: "Operations registry",
    registryKey: null,
    resolveProviderStatus: (input) => input.registry.status
  },
  {
    auditKey: "op-audit-dashboard",
    category: "Operations Platform",
    groupKey: "dashboard-audit",
    matchesIntegrationAudit: (category, operation) =>
      /dashboard|operations.?dashboard/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /dashboard.?audit|operations.?dashboard/i),
    moduleKey: "operations_dashboard_runtime",
    moduleName: "Operations dashboard",
    registryKey: null,
    resolveProviderStatus: (input) => input.dashboard.status
  },
  {
    auditKey: "op-audit-queue",
    category: "Queue Operations",
    groupKey: "queue-audit",
    matchesIntegrationAudit: (category, operation) =>
      /queue|job.?queue|pending.?job/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /queue.?audit|job.?queue|queue.?runtime/i),
    moduleKey: "op-queue-tables",
    moduleName: "Queue runtime",
    registryKey: "op-queue-tables",
    resolveProviderStatus: (input) => input.queueRuntime.status
  },
  {
    auditKey: "op-audit-worker",
    category: "Worker Operations",
    groupKey: "worker-audit",
    matchesIntegrationAudit: (category, operation) =>
      /worker|background.?job|job.?worker/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /worker.?audit|worker.?runtime|background.?worker/i),
    moduleKey: "op-worker-tables",
    moduleName: "Worker runtime",
    registryKey: "op-worker-tables",
    resolveProviderStatus: (input) => input.workerRuntime.status
  },
  {
    auditKey: "op-audit-worker-monitoring",
    category: "Worker Operations",
    groupKey: "worker-audit",
    matchesIntegrationAudit: (category, operation) =>
      /worker.?monitor|worker.?health/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /worker.?monitor|worker.?health/i),
    moduleKey: "op-worker-health",
    moduleName: "Worker monitoring runtime",
    registryKey: "op-worker-health",
    resolveProviderStatus: (input) => input.workerMonitoringRuntime.status
  },
  {
    auditKey: "op-audit-cron",
    category: "Cron Operations",
    groupKey: "cron-audit",
    matchesIntegrationAudit: (category, operation) =>
      /cron|scheduled.?job|scheduler/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /cron.?audit|cron.?runtime|scheduled.?job/i),
    moduleKey: "op-cron-jobs",
    moduleName: "Cron runtime",
    registryKey: "op-cron-jobs",
    resolveProviderStatus: (input) => input.cronRuntime.status
  },
  {
    auditKey: "op-audit-cron-monitoring",
    category: "Cron Operations",
    groupKey: "cron-audit",
    matchesIntegrationAudit: (category, operation) =>
      /cron.?monitor|cron.?health/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /cron.?monitor|cron.?health/i),
    moduleKey: "op-cron-health",
    moduleName: "Cron monitoring runtime",
    registryKey: "op-cron-health",
    resolveProviderStatus: (input) => input.cronMonitoringRuntime.status
  },
  {
    auditKey: "op-audit-storage",
    category: "Storage Operations",
    groupKey: "storage-audit",
    matchesIntegrationAudit: (category, operation) =>
      /storage|r2|bucket|object.?store/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /storage.?audit|storage.?health|object.?store/i),
    moduleKey: "op-storage-health",
    moduleName: "Storage health runtime",
    registryKey: "op-storage-health",
    resolveProviderStatus: (input) => input.storageRuntime.status
  },
  {
    auditKey: "op-audit-storage-metrics",
    category: "Storage Operations",
    groupKey: "storage-audit",
    matchesIntegrationAudit: (category, operation) =>
      /storage.?metric|quota|usage/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /storage.?metric|storage.?usage/i),
    moduleKey: "op-storage-metrics",
    moduleName: "Storage metrics runtime",
    registryKey: "op-storage-metrics",
    resolveProviderStatus: (input) => input.storageMetricsRuntime.status
  },
  {
    auditKey: "op-audit-database",
    category: "Database Operations",
    groupKey: "database-audit",
    matchesIntegrationAudit: (category, operation) =>
      /database|supabase|postgres|sql/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /database.?audit|database.?health|supabase/i),
    moduleKey: "op-database-health",
    moduleName: "Database health runtime",
    registryKey: "op-database-health",
    resolveProviderStatus: (input) => input.databaseRuntime.status
  },
  {
    auditKey: "op-audit-email-queue",
    category: "Queue Operations",
    groupKey: "email-queue-audit",
    matchesIntegrationAudit: (category, operation) =>
      /email.?queue|mail.?queue|smtp/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /email.?queue|mail.?queue|smtp/i),
    moduleKey: "op-email-queue",
    moduleName: "Email queue runtime",
    registryKey: "op-email-queue",
    resolveProviderStatus: (input) => input.emailQueueRuntime.status
  },
  {
    auditKey: "op-audit-ai-queue",
    category: "Queue Operations",
    groupKey: "ai-queue-audit",
    matchesIntegrationAudit: (category, operation) =>
      /ai.?queue|generation.?queue|openai/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /ai.?queue|generation.?queue|openai/i),
    moduleKey: "op-ai-queue",
    moduleName: "AI queue runtime",
    registryKey: "op-ai-queue",
    resolveProviderStatus: (input) => input.aiQueueRuntime.status
  },
  {
    auditKey: "op-audit-domain-email-queue",
    category: "Queue Operations",
    groupKey: "domain-email-queue-audit",
    matchesIntegrationAudit: (category, operation) =>
      /domain.?email|mailbox|domain.?workflow/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /domain.?email|mailbox|domain.?workflow/i),
    moduleKey: "op-domain-email-queue",
    moduleName: "Domain and email queue runtime",
    registryKey: "op-domain-email-queue",
    resolveProviderStatus: (input) => input.domainEmailQueueRuntime.status
  },
  {
    auditKey: "op-audit-monitoring",
    category: "Monitoring",
    groupKey: "monitoring-audit",
    matchesIntegrationAudit: (category, operation) =>
      /monitor|alert|incident|event.?stream/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /monitor.?audit|monitoring.?event|alert.?stream/i),
    moduleKey: "op-monitoring-events",
    moduleName: "Monitoring events runtime",
    registryKey: "op-monitoring-events",
    resolveProviderStatus: (input) => input.monitoringEventsRuntime.status
  },
  {
    auditKey: "op-audit-backup",
    category: "Backup & Recovery",
    groupKey: "backup-audit",
    matchesIntegrationAudit: (category, operation) =>
      /backup|snapshot|archive/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /backup.?audit|backup.?runtime|snapshot/i),
    moduleKey: "op-backup",
    moduleName: "Backup runtime",
    registryKey: "op-backup",
    resolveProviderStatus: (input) => input.backupRuntime.status
  },
  {
    auditKey: "op-audit-disaster-recovery",
    category: "Backup & Recovery",
    groupKey: "disaster-recovery-audit",
    matchesIntegrationAudit: (category, operation) =>
      /disaster.?recovery|recovery.?plan|restore/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /disaster.?recovery|recovery.?plan|restore/i),
    moduleKey: "op-disaster-recovery",
    moduleName: "Disaster recovery runtime",
    registryKey: "op-disaster-recovery",
    resolveProviderStatus: (input) => input.disasterRecoveryRuntime.status
  },
  {
    auditKey: "op-audit-diagnostics",
    category: "Operations Controls",
    groupKey: "diagnostics-audit",
    matchesIntegrationAudit: (category, operation) =>
      /diagnostic|health.?check|probe/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /diagnostic.?audit|diagnostics.?runtime|health.?check/i),
    moduleKey: "op-diagnostics",
    moduleName: "Diagnostics runtime",
    registryKey: "op-diagnostics",
    resolveProviderStatus: (input) => input.diagnosticsRuntime.status
  },
  {
    auditKey: "op-audit-safe-controls",
    category: "Operations Controls",
    groupKey: "safe-controls-audit",
    matchesIntegrationAudit: (category, operation) =>
      /safe.?control|governance|admin.?action/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /safe.?control|governance.?action|admin.?action/i),
    moduleKey: "op-safe-controls",
    moduleName: "Safe controls runtime",
    registryKey: "op-safe-controls",
    resolveProviderStatus: (input) => input.safeControlsRuntime.status
  },
  {
    auditKey: "op-audit-status",
    category: "Operations Platform",
    groupKey: "status-audit",
    matchesIntegrationAudit: (category, operation) =>
      /status.?runtime|operations.?status/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /status.?runtime|operations.?status/i),
    moduleKey: "operations_status_runtime",
    moduleName: "Operations status runtime",
    registryKey: null,
    resolveProviderStatus: (input) => {
      const statuses = [
        input.registry.status,
        input.dashboard.status,
        input.queueRuntime.status,
        input.workerRuntime.status,
        input.workerMonitoringRuntime.status,
        input.cronRuntime.status,
        input.cronMonitoringRuntime.status,
        input.storageRuntime.status,
        input.storageMetricsRuntime.status,
        input.databaseRuntime.status,
        input.emailQueueRuntime.status,
        input.aiQueueRuntime.status,
        input.domainEmailQueueRuntime.status,
        input.monitoringEventsRuntime.status,
        input.backupRuntime.status,
        input.disasterRecoveryRuntime.status,
        input.diagnosticsRuntime.status,
        input.safeControlsRuntime.status
      ];

      return statuses.some((status) => status === "needs_attention")
        ? "needs_attention"
        : "operations_status_runtime_ready";
    }
  },
  {
    auditKey: "op-audit-visibility",
    category: "Operations Platform",
    groupKey: "visibility-audit",
    matchesIntegrationAudit: (category, operation) =>
      /visibility.?runtime|operations.?visibility/i.test(`${category} ${operation}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesAuditPattern(eventType, entityType, /visibility.?runtime|operations.?visibility/i),
    moduleKey: "operations_visibility_runtime",
    moduleName: "Operations visibility runtime",
    registryKey: null,
    resolveProviderStatus: (input) => {
      const statuses = [
        input.registry.status,
        input.dashboard.status,
        input.queueRuntime.status,
        input.workerRuntime.status,
        input.workerMonitoringRuntime.status,
        input.cronRuntime.status,
        input.cronMonitoringRuntime.status,
        input.storageRuntime.status,
        input.storageMetricsRuntime.status,
        input.databaseRuntime.status,
        input.emailQueueRuntime.status,
        input.aiQueueRuntime.status,
        input.domainEmailQueueRuntime.status,
        input.monitoringEventsRuntime.status,
        input.backupRuntime.status,
        input.disasterRecoveryRuntime.status,
        input.diagnosticsRuntime.status,
        input.safeControlsRuntime.status
      ];

      return statuses.some((status) => status === "needs_attention")
        ? "needs_attention"
        : "operations_visibility_runtime_ready";
    }
  }
] as const;

const secretPattern =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|authorization|bearer|sb_secret|smtp|webhook|@[a-z0-9.-]+\.[a-z]{2,}|\b\d{10,}\b)/i;

function text(value: unknown, maxLength = 160) {
  if (typeof value !== "string") {
    return "";
  }

  return maskSensitiveText(
    value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\bjavascript:/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  ).slice(0, maxLength);
}

function clip(value: string, maxLength: number) {
  return value.slice(0, maxLength);
}

function asRecords(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as AnyRecord[]) : [];
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const message = text(error.message ?? "", 500).toLowerCase();
  return error.code === "42P01" || error.code === "PGRST205" || message.includes("does not exist");
}

function matchesAuditPattern(eventType: string, entityType: string, pattern: RegExp) {
  return pattern.test(`${eventType} ${entityType}`);
}

function buildSafeControls() {
  return OPERATIONS_AUDIT_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function resolveActorType(entityType: string, category = ""): OperationsAuditActorType {
  const combined = `${entityType} ${category}`.toLowerCase();

  if (/super.?admin|platform.?admin|admin/.test(combined)) {
    return "super_admin";
  }

  if (/system|worker|cron|queue|service|automation|integration/.test(combined)) {
    return "system";
  }

  if (/platform|operations|registry|dashboard/.test(combined)) {
    return "platform";
  }

  return "unknown";
}

function resolveSeverity(failedCount: number, warningCount: number): OperationsAuditSeverity {
  if (failedCount > 0) {
    return "critical";
  }

  if (warningCount > 0) {
    return "warning";
  }

  return "info";
}

function resolveReviewStatus(runtimeStatus: OperationsAuditRuntimeStatus): OperationsAuditReviewStatus {
  if (runtimeStatus === "review_required" || runtimeStatus === "warning" || runtimeStatus === "critical") {
    return "review_required";
  }

  if (runtimeStatus === "future_hook" || runtimeStatus === "disabled") {
    return "not_applicable";
  }

  return "clear";
}

function resolveAuditRuntimeStatus(input: {
  auditSupport: boolean;
  eventCount: number;
  failedCount: number;
  implementationStatus?: OperationsImplementationStatus;
  integrationTableDetected: boolean;
  isFutureHook: boolean;
  monitoringTableDetected: boolean;
  providerStatus: string;
  warningCount: number;
}): OperationsAuditRuntimeStatus {
  if (input.isFutureHook) {
    return "future_hook";
  }

  if (input.implementationStatus === "planned") {
    return "disabled";
  }

  if (input.providerStatus === "needs_attention") {
    return "review_required";
  }

  if (input.eventCount > 0) {
    if (input.failedCount > 0) {
      return "critical";
    }

    if (input.warningCount > 0) {
      return "warning";
    }

    return "available";
  }

  if (!input.auditSupport) {
    return "disabled";
  }

  if (input.monitoringTableDetected || input.integrationTableDetected) {
    return "empty";
  }

  if (/runtime_ready|registry_ready|dashboard_ready/.test(input.providerStatus)) {
    return "registered";
  }

  return "no_audit_data_detected";
}

function buildSafeSummary(input: {
  aggregate: AuditEventAggregate;
  auditSupport: boolean;
  providerStatus: string;
  runtimeStatus: OperationsAuditRuntimeStatus;
}) {
  if (input.runtimeStatus === "future_hook") {
    return "Future audit hook placeholder derived from operations registry metadata only";
  }

  if (input.runtimeStatus === "disabled") {
    return input.auditSupport
      ? "Audit support is registered but no safe audit metadata is available for this module yet"
      : "Audit support is disabled for this module in the operations registry";
  }

  if (input.runtimeStatus === "no_audit_data_detected") {
    return "No operations audit metadata source detected; safe empty audit state only";
  }

  if (input.runtimeStatus === "registered") {
    return `Module registered with audit support; provider status ${input.providerStatus}; no matching audit events yet`;
  }

  if (input.runtimeStatus === "empty") {
    return "Audit metadata source detected but no matching operations audit events are recorded yet";
  }

  if (input.runtimeStatus === "review_required") {
    return `Runtime review required before audit coverage is considered complete; provider status ${input.providerStatus}`;
  }

  const parts = [
    `${input.aggregate.eventCount} safe audit event${input.aggregate.eventCount === 1 ? "" : "s"}`,
    `${input.aggregate.failedCount} failed`,
    `${input.aggregate.warningCount} warning`
  ];

  if (input.aggregate.latestActionType) {
    parts.push(`latest action ${input.aggregate.latestActionType}`);
  }

  return parts.join("; ");
}

function aggregateMonitoringRows(rows: AnyRecord[]): AuditEventAggregate {
  let failedCount = 0;
  let warningCount = 0;
  let latestOccurredAt: string | null = null;
  let latestActionType: string | null = null;
  let latestActorType: OperationsAuditActorType = "unknown";
  let latestAuditType = "monitoring_event";

  for (const row of rows) {
    const eventStatus = text(row.event_status, 80).toLowerCase();
    const eventType = text(row.event_type, 120);
    const entityType = text(row.entity_type, 120);
    const createdAt = text(row.created_at, 80);

    if (eventStatus === "failed" || /failed|error|critical/.test(eventType)) {
      failedCount += 1;
    } else if (eventStatus === "warning" || eventStatus === "pending" || /warning|retry/.test(eventType)) {
      warningCount += 1;
    }

    if (!createdAt) {
      continue;
    }

    if (!latestOccurredAt || dateValue(createdAt) > dateValue(latestOccurredAt)) {
      latestOccurredAt = createdAt;
      latestActionType = eventType || "monitoring_event";
      latestActorType = resolveActorType(entityType, eventType);
      latestAuditType = "monitoring_event";
    }
  }

  return {
    eventCount: rows.length,
    failedCount,
    latestActionType,
    latestActorType,
    latestAuditType,
    latestOccurredAt,
    warningCount
  };
}

function aggregateIntegrationRows(rows: AnyRecord[]): AuditEventAggregate {
  let failedCount = 0;
  let warningCount = 0;
  let latestOccurredAt: string | null = null;
  let latestActionType: string | null = null;
  let latestActorType: OperationsAuditActorType = "system";
  let latestAuditType = "integration_audit";

  for (const row of rows) {
    const status = text(row.status, 80).toLowerCase();
    const category = text(row.category, 120);
    const operation = text(row.operation, 120);
    const providerKey = text(row.provider_key, 80);
    const createdAt = text(row.created_at, 80);

    if (status === "failed" || status === "blocked") {
      failedCount += 1;
    } else if (status === "started" || status === "skipped") {
      warningCount += 1;
    }

    if (!createdAt) {
      continue;
    }

    if (!latestOccurredAt || dateValue(createdAt) > dateValue(latestOccurredAt)) {
      latestOccurredAt = createdAt;
      latestActionType = operation || category || "integration_operation";
      latestActorType = resolveActorType(providerKey, category);
      latestAuditType = "integration_audit";
    }
  }

  return {
    eventCount: rows.length,
    failedCount,
    latestActionType,
    latestActorType,
    latestAuditType,
    latestOccurredAt,
    warningCount
  };
}

function mergeAggregates(left: AuditEventAggregate, right: AuditEventAggregate): AuditEventAggregate {
  const latestLeft = left.latestOccurredAt ? dateValue(left.latestOccurredAt) : 0;
  const latestRight = right.latestOccurredAt ? dateValue(right.latestOccurredAt) : 0;
  const latest = latestRight >= latestLeft ? right : left;

  return {
    eventCount: left.eventCount + right.eventCount,
    failedCount: left.failedCount + right.failedCount,
    latestActionType: latest.latestActionType,
    latestActorType: latest.latestActorType,
    latestAuditType: latest.latestAuditType,
    latestOccurredAt: latest.latestOccurredAt,
    warningCount: left.warningCount + right.warningCount
  };
}

function partitionMonitoringRows(rows: AnyRecord[]) {
  const assignments = new Map<string, AnyRecord[]>(
    AUDIT_MODULE_BINDINGS.map((binding) => [binding.auditKey, [] as AnyRecord[]])
  );

  for (const row of rows) {
    const eventType = text(row.event_type, 160);
    const entityType = text(row.entity_type, 160);

    if (secretPattern.test(`${eventType} ${entityType}`)) {
      continue;
    }

    const binding = AUDIT_MODULE_BINDINGS.find((entry) => entry.matchesMonitoringEvent(eventType, entityType));

    if (binding) {
      assignments.get(binding.auditKey)?.push(row);
    }
  }

  return assignments;
}

function partitionIntegrationRows(rows: AnyRecord[]) {
  const assignments = new Map<string, AnyRecord[]>(
    AUDIT_MODULE_BINDINGS.map((binding) => [binding.auditKey, [] as AnyRecord[]])
  );

  for (const row of rows) {
    const category = text(row.category, 160);
    const operation = text(row.operation, 160);
    const providerKey = text(row.provider_key, 80);

    if (secretPattern.test(`${category} ${operation} ${providerKey}`)) {
      continue;
    }

    const binding = AUDIT_MODULE_BINDINGS.find((entry) => entry.matchesIntegrationAudit(category, operation));

    if (binding) {
      assignments.get(binding.auditKey)?.push(row);
    }
  }

  return assignments;
}

function buildAuditModuleItem(input: {
  aggregate: AuditEventAggregate;
  binding: AuditModuleBinding;
  integrationTableDetected: boolean;
  monitoringTableDetected: boolean;
  statusInput: OperationsStatusRuntimeInput;
}): OperationsAuditRuntimeItem {
  const registryEntry = input.binding.registryKey ? getOperationsRegistryEntry(input.binding.registryKey) : null;
  const providerStatus = input.binding.resolveProviderStatus(input.statusInput);
  const auditSupport = registryEntry?.auditSupport ?? true;
  const runtimeStatus = resolveAuditRuntimeStatus({
    auditSupport,
    eventCount: input.aggregate.eventCount,
    failedCount: input.aggregate.failedCount,
    implementationStatus: registryEntry?.implementationStatus,
    integrationTableDetected: input.integrationTableDetected,
    isFutureHook: false,
    monitoringTableDetected: input.monitoringTableDetected,
    providerStatus,
    warningCount: input.aggregate.warningCount
  });

  return {
    actionType: input.aggregate.latestActionType ?? "no_action_recorded",
    actorType: input.aggregate.eventCount > 0 ? input.aggregate.latestActorType : resolveActorType(input.binding.moduleKey),
    auditKey: input.binding.auditKey,
    auditType: input.aggregate.eventCount > 0 ? input.aggregate.latestAuditType : "registry_metadata",
    category: input.binding.category,
    groupKey: input.binding.groupKey,
    moduleKey: input.binding.moduleKey,
    moduleName: input.binding.moduleName,
    occurredAt: input.aggregate.latestOccurredAt,
    reviewStatus: resolveReviewStatus(runtimeStatus),
    runtimeStatus,
    safeControls: buildSafeControls(),
    safeSummary: buildSafeSummary({
      aggregate: input.aggregate,
      auditSupport,
      providerStatus,
      runtimeStatus
    }),
    severity: resolveSeverity(input.aggregate.failedCount, input.aggregate.warningCount),
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildFutureAuditHookItems(futureHooks: readonly string[]): OperationsAuditRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");

  return futureHooks
    .filter((hook) => /audit|trail|log|history|governance|compliance/i.test(hook))
    .map((hook, index) => ({
      actionType: "future_hook",
      actorType: "unknown" as const,
      auditKey: `op-audit-future-hook-${index + 1}`,
      auditType: "future_hook",
      category: "Operations Platform",
      groupKey: "future-audit-hooks" as const,
      moduleKey: `op-future-audit-hook-${index + 1}`,
      moduleName: clip(text(hook, 120), 120),
      occurredAt: null,
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      safeSummary: "Future audit hook placeholder derived from operations registry metadata only",
      severity: "low" as const,
      visibility: registryEntry?.visibility ?? "super_admin"
    }));
}

async function safeAuditTableSelect(
  supabase: SupabaseClient<Database>,
  table: "integration_audit_logs" | "monitoring_events",
  columns: string,
  limit: number
): Promise<{ rows: AnyRecord[]; tableDetected: boolean }> {
  try {
    const { data, error } = await supabase.from(table as never).select(columns).limit(limit);

    if (error) {
      if (isMissingTableError(error)) {
        return { rows: [], tableDetected: false };
      }

      console.warn(`[operations-audit-runtime] read-only ${table} select failed`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-audit-runtime] read-only ${table} select crashed`, error);
    return { rows: [], tableDetected: false };
  }
}

export function operationsAuditRuntimeStatusLabel(status: OperationsAuditRuntimeStatus) {
  switch (status) {
    case "available":
      return "Available";
    case "critical":
      return "Critical";
    case "disabled":
      return "Disabled";
    case "empty":
      return "Empty";
    case "future_hook":
      return "Future Hook";
    case "no_audit_data_detected":
      return "No Audit Data Detected";
    case "registered":
      return "Registered";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function operationsAuditRuntimeStatusBadgeTone(status: OperationsAuditRuntimeStatus) {
  switch (status) {
    case "available":
    case "registered":
      return "green" as const;
    case "warning":
    case "review_required":
      return "amber" as const;
    case "critical":
      return "red" as const;
    case "empty":
    case "no_audit_data_detected":
      return "slate" as const;
    case "disabled":
      return "slate" as const;
    case "future_hook":
      return "blue" as const;
  }
}

export function buildOperationsAuditRuntimeGroups(items: OperationsAuditRuntimeItem[]): OperationsAuditRuntimeGroup[] {
  return AUDIT_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsAuditRuntimeSummary(items: OperationsAuditRuntimeItem[]): OperationsAuditRuntimeSummary {
  const operationalItems = items.filter((item) => item.groupKey !== "future-audit-hooks");
  const availableItems = operationalItems.filter((item) => item.runtimeStatus === "available").length;
  const criticalItems = operationalItems.filter((item) => item.runtimeStatus === "critical").length;
  const disabledItems = operationalItems.filter((item) => item.runtimeStatus === "disabled").length;
  const emptyItems = operationalItems.filter((item) => item.runtimeStatus === "empty").length;
  const futureHookItems = items.filter((item) => item.runtimeStatus === "future_hook").length;
  const noAuditDataItems = operationalItems.filter((item) => item.runtimeStatus === "no_audit_data_detected").length;
  const registeredItems = operationalItems.filter((item) => item.runtimeStatus === "registered").length;
  const reviewRequiredItems = operationalItems.filter((item) => item.runtimeStatus === "review_required").length;
  const warningItems = operationalItems.filter((item) => item.runtimeStatus === "warning").length;
  const overallStatus =
    criticalItems > 0 || reviewRequiredItems > 0 || warningItems > 0
      ? ("needs_attention" as const)
      : ("operations_audit_runtime_ready" as const);

  return {
    availableItems,
    criticalItems,
    disabledItems,
    emptyItems,
    futureHookItems,
    groupCount: buildOperationsAuditRuntimeGroups(items).length,
    noAuditDataItems,
    overallStatus,
    readOnly: true,
    registeredItems,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    reviewRequiredItems,
    source: OPERATIONS_AUDIT_RUNTIME_SOURCE,
    summary: [
      `overall ${overallStatus}`,
      `${items.length} audit items`,
      `${availableItems} available`,
      `${emptyItems} empty`,
      `${noAuditDataItems} no audit data`,
      `${reviewRequiredItems} review required`
    ].join("; "),
    totalAuditItems: items.length,
    warningItems
  };
}

export async function loadOperationsAuditRuntimeReadOnlySafe(params: {
  statusInput: OperationsStatusRuntimeInput;
  supabase: SupabaseClient<Database>;
}) {
  const [monitoringLoad, integrationLoad] = await Promise.all([
    safeAuditTableSelect(
      params.supabase,
      "monitoring_events",
      "id, event_type, event_status, entity_type, created_at",
      500
    ),
    safeAuditTableSelect(
      params.supabase,
      "integration_audit_logs",
      "id, provider_key, category, operation, status, created_at",
      500
    )
  ]);
  const monitoringPartitions = partitionMonitoringRows(monitoringLoad.rows);
  const integrationPartitions = partitionIntegrationRows(integrationLoad.rows);
  const auditItems = [
    ...AUDIT_MODULE_BINDINGS.map((binding) => {
      const monitoringAggregate = aggregateMonitoringRows(monitoringPartitions.get(binding.auditKey) ?? []);
      const integrationAggregate = aggregateIntegrationRows(integrationPartitions.get(binding.auditKey) ?? []);
      const aggregate = mergeAggregates(monitoringAggregate, integrationAggregate);

      return buildAuditModuleItem({
        aggregate,
        binding,
        integrationTableDetected: integrationLoad.tableDetected,
        monitoringTableDetected: monitoringLoad.tableDetected,
        statusInput: params.statusInput
      });
    }),
    ...buildFutureAuditHookItems(params.statusInput.futureHooks)
  ];
  const groups = buildOperationsAuditRuntimeGroups(auditItems);
  const summary = getOperationsAuditRuntimeSummary(auditItems);

  return {
    auditItems,
    auditRuntime: summary,
    groups,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsAuditRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsAuditRuntimeReadOnlySafe>>
) {
  return {
    auditItems: input.auditItems,
    auditRuntime: input.auditRuntime,
    groups: input.groups,
    safeControls: input.safeControls
  };
}

export type { OperationsStatusRuntimeInput as OperationsAuditRuntimeInput };
