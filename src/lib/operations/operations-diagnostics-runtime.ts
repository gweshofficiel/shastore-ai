import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsDiagnosticsRuntimeSource = "operations_diagnostics_runtime";

export type OperationsDiagnosticsGroupKey =
  | "billing-diagnostics"
  | "email-diagnostics"
  | "future-diagnostics-hooks"
  | "marketplace-diagnostics"
  | "notifications-diagnostics"
  | "operations-diagnostics"
  | "platform-diagnostics"
  | "reports-diagnostics"
  | "security-diagnostics"
  | "seo-diagnostics"
  | "store-diagnostics";

export type OperationsDiagnosticsRuntimeStatus =
  | "disabled"
  | "empty"
  | "failed"
  | "future_hook"
  | "healthy"
  | "no_metadata_detected"
  | "registered"
  | "review_required"
  | "warning";

export type OperationsDiagnosticsStatus = "empty" | "failed" | "healthy" | "unknown" | "warning";

export type OperationsDiagnosticsReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsDiagnosticsSafeControlKey =
  | "auto_fix"
  | "export_report"
  | "inspect"
  | "repair"
  | "run_diagnostics";

export type OperationsDiagnosticsSafeControl = {
  enabled: false;
  key: OperationsDiagnosticsSafeControlKey;
  label: string;
  note: string;
};

export type OperationsDiagnosticsRuntimeItem = {
  diagnosticKey: string;
  diagnosticName: string;
  diagnosticStatus: OperationsDiagnosticsStatus;
  diagnosticType: string;
  errorCount: number;
  groupKey: OperationsDiagnosticsGroupKey;
  lastCheckedAt: string | null;
  lastFailureAt: string | null;
  metadataDetected: boolean;
  reviewStatus: OperationsDiagnosticsReviewStatus;
  runtimeStatus: OperationsDiagnosticsRuntimeStatus;
  safeControls: OperationsDiagnosticsSafeControl[];
  safeSummary: string;
  source: string;
  visibility: OperationsRegistryVisibility;
  warningCount: number;
};

export type OperationsDiagnosticsRuntimeGroup = {
  groupKey: OperationsDiagnosticsGroupKey;
  itemCount: number;
  items: OperationsDiagnosticsRuntimeItem[];
  title: string;
};

export type OperationsDiagnosticsRuntimeSummary = {
  failedDiagnostics: number;
  groupCount: number;
  healthyDiagnostics: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsDiagnosticsRuntimeSource;
  status: "diagnostics_runtime_ready" | "needs_attention";
  summary: string;
  totalDiagnostics: number;
  warningDiagnostics: number;
};

type AnyRecord = Record<string, unknown>;

type DiagnosticDefinition = {
  diagnosticKey: string;
  diagnosticName: string;
  diagnosticType: string;
  groupKey: OperationsDiagnosticsGroupKey;
  matchesDiagnosticRecord: (diagnosticType: string, diagnosticKey: string) => boolean;
  matchesMonitoringEvent: (eventType: string, entityType: string) => boolean;
  metadataColumns: string | null;
  metadataSource: string | null;
  metadataTable: string | null;
  registryKey: string;
  sourceLabel: string;
};

type DiagnosticAggregate = {
  errorCount: number;
  eventCount: number;
  lastCheckedAt: string | null;
  lastFailureAt: string | null;
  warningCount: number;
};

export const OPERATIONS_DIAGNOSTICS_RUNTIME_SOURCE = "operations_diagnostics_runtime" as const;

export const OPERATIONS_DIAGNOSTICS_SAFE_CONTROLS: readonly OperationsDiagnosticsSafeControl[] = [
  {
    enabled: false,
    key: "run_diagnostics",
    label: "Run Diagnostics",
    note: "Read-only placeholder. No live diagnostics execution runs during OP-17 page load."
  },
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No diagnostic inspection, scan, or probe runs during OP-17 page load."
  },
  {
    enabled: false,
    key: "repair",
    label: "Repair",
    note: "Read-only placeholder. No diagnostic repair action runs during OP-17 page load."
  },
  {
    enabled: false,
    key: "auto_fix",
    label: "Auto Fix",
    note: "Read-only placeholder. No auto-fix action runs during OP-17 page load."
  },
  {
    enabled: false,
    key: "export_report",
    label: "Export Report",
    note: "Read-only placeholder. No diagnostics export or provider call runs during OP-17 page load."
  }
] as const;

const DIAGNOSTICS_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsDiagnosticsGroupKey;
  title: string;
}> = [
  { groupKey: "platform-diagnostics", title: "Platform Diagnostics" },
  { groupKey: "billing-diagnostics", title: "Billing Diagnostics" },
  { groupKey: "store-diagnostics", title: "Store Diagnostics" },
  { groupKey: "marketplace-diagnostics", title: "Marketplace Diagnostics" },
  { groupKey: "email-diagnostics", title: "Email Diagnostics" },
  { groupKey: "notifications-diagnostics", title: "Notifications Diagnostics" },
  { groupKey: "seo-diagnostics", title: "SEO Diagnostics" },
  { groupKey: "reports-diagnostics", title: "Reports Diagnostics" },
  { groupKey: "operations-diagnostics", title: "Operations Diagnostics" },
  { groupKey: "security-diagnostics", title: "Security Diagnostics" },
  { groupKey: "future-diagnostics-hooks", title: "Future Diagnostics Hooks" }
];

const DIAGNOSTIC_TABLE_CANDIDATES = [
  "platform_diagnostics",
  "diagnostic_records",
  "diagnostic_events",
  "operations_diagnostics",
  "diagnostic_snapshots"
] as const;

const DIAGNOSTIC_DEFINITIONS: readonly DiagnosticDefinition[] = [
  {
    diagnosticKey: "op-diagnostics-platform",
    diagnosticName: "Platform diagnostics",
    diagnosticType: "platform_diagnostic",
    groupKey: "platform-diagnostics",
    matchesDiagnosticRecord: (diagnosticType, diagnosticKey) =>
      /platform|registry|core/i.test(`${diagnosticType} ${diagnosticKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesDiagnosticPattern(eventType, entityType, /platform.?diagnostic|registry.?diagnostic|core.?health/i),
    metadataColumns: null,
    metadataSource: "operations_registry_runtime",
    metadataTable: null,
    registryKey: "op-diagnostics",
    sourceLabel: "operations_registry_runtime"
  },
  {
    diagnosticKey: "op-diagnostics-billing",
    diagnosticName: "Billing diagnostics",
    diagnosticType: "billing_diagnostic",
    groupKey: "billing-diagnostics",
    matchesDiagnosticRecord: (diagnosticType, diagnosticKey) =>
      /billing|invoice|payment|stripe|paypal|subscription/i.test(`${diagnosticType} ${diagnosticKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesDiagnosticPattern(eventType, entityType, /billing.?diagnostic|invoice.?diagnostic|payment.?diagnostic/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-diagnostics",
    sourceLabel: "monitoring_events"
  },
  {
    diagnosticKey: "op-diagnostics-store",
    diagnosticName: "Store diagnostics",
    diagnosticType: "store_diagnostic",
    groupKey: "store-diagnostics",
    matchesDiagnosticRecord: (diagnosticType, diagnosticKey) =>
      /store|shop|tenant|storefront/i.test(`${diagnosticType} ${diagnosticKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesDiagnosticPattern(eventType, entityType, /store.?diagnostic|shop.?diagnostic|tenant.?diagnostic/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-diagnostics",
    sourceLabel: "monitoring_events"
  },
  {
    diagnosticKey: "op-diagnostics-marketplace",
    diagnosticName: "Marketplace diagnostics",
    diagnosticType: "marketplace_diagnostic",
    groupKey: "marketplace-diagnostics",
    matchesDiagnosticRecord: (diagnosticType, diagnosticKey) =>
      /marketplace|template|plugin|catalog/i.test(`${diagnosticType} ${diagnosticKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesDiagnosticPattern(eventType, entityType, /marketplace.?diagnostic|template.?diagnostic|plugin.?diagnostic/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-diagnostics",
    sourceLabel: "monitoring_events"
  },
  {
    diagnosticKey: "op-diagnostics-email",
    diagnosticName: "Email diagnostics",
    diagnosticType: "email_diagnostic",
    groupKey: "email-diagnostics",
    matchesDiagnosticRecord: (diagnosticType, diagnosticKey) =>
      /email|mail|smtp|delivery/i.test(`${diagnosticType} ${diagnosticKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesDiagnosticPattern(eventType, entityType, /email.?diagnostic|mail.?diagnostic|smtp.?diagnostic/i),
    metadataColumns: "id, status, created_at, updated_at",
    metadataSource: "email_event_logs",
    metadataTable: "email_event_logs",
    registryKey: "op-diagnostics",
    sourceLabel: "email_event_logs"
  },
  {
    diagnosticKey: "op-diagnostics-notifications",
    diagnosticName: "Notifications diagnostics",
    diagnosticType: "notifications_diagnostic",
    groupKey: "notifications-diagnostics",
    matchesDiagnosticRecord: (diagnosticType, diagnosticKey) =>
      /notification|alert|delivery|retry/i.test(`${diagnosticType} ${diagnosticKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesDiagnosticPattern(eventType, entityType, /notification.?diagnostic|alert.?diagnostic|delivery.?diagnostic/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-diagnostics",
    sourceLabel: "monitoring_events"
  },
  {
    diagnosticKey: "op-diagnostics-seo",
    diagnosticName: "SEO diagnostics",
    diagnosticType: "seo_diagnostic",
    groupKey: "seo-diagnostics",
    matchesDiagnosticRecord: (diagnosticType, diagnosticKey) =>
      /seo|sitemap|robots|meta|redirect/i.test(`${diagnosticType} ${diagnosticKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesDiagnosticPattern(eventType, entityType, /seo.?diagnostic|sitemap.?diagnostic|meta.?diagnostic/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-diagnostics",
    sourceLabel: "monitoring_events"
  },
  {
    diagnosticKey: "op-diagnostics-reports",
    diagnosticName: "Reports diagnostics",
    diagnosticType: "reports_diagnostic",
    groupKey: "reports-diagnostics",
    matchesDiagnosticRecord: (diagnosticType, diagnosticKey) =>
      /report|export|analytics|schedule/i.test(`${diagnosticType} ${diagnosticKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesDiagnosticPattern(eventType, entityType, /report.?diagnostic|export.?diagnostic|analytics.?diagnostic/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-diagnostics",
    sourceLabel: "monitoring_events"
  },
  {
    diagnosticKey: "op-diagnostics-operations",
    diagnosticName: "Operations diagnostics",
    diagnosticType: "operations_diagnostic",
    groupKey: "operations-diagnostics",
    matchesDiagnosticRecord: (diagnosticType, diagnosticKey) =>
      /operation|queue|worker|cron|monitor|runtime/i.test(`${diagnosticType} ${diagnosticKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesDiagnosticPattern(
        eventType,
        entityType,
        /operations.?diagnostic|queue.?diagnostic|worker.?diagnostic|cron.?diagnostic|runtime.?diagnostic/i
      ),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-diagnostics",
    sourceLabel: "monitoring_events"
  },
  {
    diagnosticKey: "op-diagnostics-security",
    diagnosticName: "Security diagnostics",
    diagnosticType: "security_diagnostic",
    groupKey: "security-diagnostics",
    matchesDiagnosticRecord: (diagnosticType, diagnosticKey) =>
      /security|audit|fraud|auth|permission/i.test(`${diagnosticType} ${diagnosticKey}`),
    matchesMonitoringEvent: (eventType, entityType) =>
      matchesDiagnosticPattern(eventType, entityType, /security.?diagnostic|audit.?diagnostic|fraud.?diagnostic|auth.?diagnostic/i),
    metadataColumns: null,
    metadataSource: "monitoring_events",
    metadataTable: "monitoring_events",
    registryKey: "op-diagnostics",
    sourceLabel: "monitoring_events"
  }
] as const;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clip(value: string, maxLength: number) {
  return value.slice(0, maxLength);
}

function asRecords(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as AnyRecord[]) : [];
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const message = text(error.message).toLowerCase();
  return error.code === "42P01" || message.includes("does not exist") || message.includes("could not find the table");
}

function buildSafeControls() {
  return OPERATIONS_DIAGNOSTICS_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function matchesDiagnosticPattern(eventType: string, entityType: string, pattern: RegExp) {
  return pattern.test(`${eventType} ${entityType}`.toLowerCase());
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function latestDate(values: Array<string | null>) {
  return (
    values
      .filter(Boolean)
      .sort((left, right) => Date.parse(right ?? "") - Date.parse(left ?? ""))[0] ?? null
  );
}

function sanitizeDiagnosticSource(value: unknown, fallback: string) {
  const source = clip(text(value), 80).toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");

  if (!source) {
    return fallback;
  }

  if (/secret|token|password|credential|authorization|bearer|apikey|api_key|dump|payload|header/i.test(source)) {
    return "masked_source";
  }

  return clip(text(value), 80) || fallback;
}

function resolveReviewStatus(input: {
  diagnosticStatus: OperationsDiagnosticsStatus;
  errorCount: number;
  metadataDetected: boolean;
}): OperationsDiagnosticsReviewStatus {
  if (!input.metadataDetected) {
    return "not_applicable";
  }

  if (input.errorCount > 0 || input.diagnosticStatus === "failed") {
    return "review_required";
  }

  return "clear";
}

function resolveDiagnosticStatus(input: {
  errorCount: number;
  eventCount: number;
  metadataDetected: boolean;
  warningCount: number;
}): OperationsDiagnosticsStatus {
  if (!input.metadataDetected && input.eventCount === 0) {
    return "unknown";
  }

  if (input.errorCount > 0) {
    return "failed";
  }

  if (input.warningCount > 0) {
    return "warning";
  }

  if (input.eventCount > 0) {
    return "healthy";
  }

  return "empty";
}

function resolveDiagnosticsRuntimeStatus(input: {
  diagnosticStatus: OperationsDiagnosticsStatus;
  eventCount: number;
  forceFutureHook?: boolean;
  metadataDetected: boolean;
  reviewStatus: OperationsDiagnosticsReviewStatus;
}): OperationsDiagnosticsRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

  if (!input.metadataDetected) {
    return "no_metadata_detected";
  }

  if (input.diagnosticStatus === "failed") {
    return "failed";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.diagnosticStatus === "warning") {
    return "warning";
  }

  if (input.eventCount === 0) {
    return "empty";
  }

  if (input.diagnosticStatus === "healthy") {
    return "healthy";
  }

  return "registered";
}

function buildSafeSummary(input: {
  errorCount: number;
  eventCount: number;
  metadataDetected: boolean;
  metadataSource: string | null;
  warningCount: number;
}) {
  return [
    input.metadataDetected
      ? `metadata ${input.metadataSource ?? "detected"}`
      : "metadata not detected",
    `${input.eventCount} recorded events`,
    `${input.warningCount} warnings`,
    `${input.errorCount} errors`,
    "raw logs and payloads hidden"
  ].join("; ");
}

function buildMonitoringDiagnosticSnapshot(events: AnyRecord[]): DiagnosticAggregate {
  const failures = events.filter((event) => {
    const eventStatus = text(event.event_status).toLowerCase();
    return eventStatus === "failed" || eventStatus.includes("error");
  });

  return {
    errorCount: failures.length,
    eventCount: events.length,
    lastCheckedAt: latestDate(events.map((event) => text(event.created_at))),
    lastFailureAt: latestDate(failures.map((event) => text(event.created_at))),
    warningCount: events.filter((event) => text(event.event_status).toLowerCase() === "warning").length
  };
}

function aggregateMetadataRows(rows: AnyRecord[]): DiagnosticAggregate {
  const failures = rows.filter((row) => /failed|error/i.test(text(row.status)));

  return {
    errorCount: failures.length,
    eventCount: rows.length,
    lastCheckedAt: latestDate(rows.flatMap((row) => [text(row.updated_at), text(row.created_at)])),
    lastFailureAt: latestDate(failures.map((row) => text(row.created_at))),
    warningCount: rows.filter((row) => /warning|pending/i.test(text(row.status))).length
  };
}

function aggregateDedicatedDiagnosticRows(rows: AnyRecord[], definition: DiagnosticDefinition): DiagnosticAggregate | null {
  const matchingRows = rows.filter((row) => {
    const diagnosticType = text(row.diagnostic_type);
    const diagnosticKey = text(row.diagnostic_key) || text(row.diagnostic_name);
    return definition.matchesDiagnosticRecord(diagnosticType, diagnosticKey);
  });

  if (!matchingRows.length) {
    return null;
  }

  const failures = matchingRows.filter((row) => /failed|error/i.test(text(row.diagnostic_status)));

  return {
    errorCount: matchingRows.reduce((total, row) => total + numberValue(row.error_count), failures.length),
    eventCount: matchingRows.length,
    lastCheckedAt: latestDate(
      matchingRows.flatMap((row) => [text(row.last_checked_at), text(row.updated_at), text(row.created_at)])
    ),
    lastFailureAt: latestDate(
      matchingRows.flatMap((row) => [text(row.last_failure_at), text(row.updated_at)])
    ),
    warningCount: matchingRows.reduce((total, row) => total + numberValue(row.warning_count), 0)
  };
}

async function safeMetadataSelect(
  supabase: SupabaseClient<Database>,
  table: string,
  columns: string,
  limit: number
): Promise<{ rows: AnyRecord[]; tableDetected: boolean }> {
  try {
    const { data, error } = await supabase.from(table as never).select(columns).limit(limit);

    if (error) {
      if (isMissingTableError(error)) {
        return { rows: [], tableDetected: false };
      }

      console.warn(`[operations-diagnostics-runtime] read-only diagnostic metadata select failed for ${table}`, error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn(`[operations-diagnostics-runtime] read-only diagnostic metadata select crashed for ${table}`, error);
    return { rows: [], tableDetected: false };
  }
}

async function detectDedicatedDiagnosticTable(supabase: SupabaseClient<Database>) {
  for (const tableName of DIAGNOSTIC_TABLE_CANDIDATES) {
    const result = await safeMetadataSelect(
      supabase,
      tableName,
      "id, diagnostic_key, diagnostic_type, diagnostic_status, source, last_checked_at, last_failure_at, warning_count, error_count, created_at, updated_at",
      200
    );

    if (result.tableDetected) {
      return {
        rows: result.rows,
        tableDetected: true,
        tableName
      };
    }
  }

  return {
    rows: [] as AnyRecord[],
    tableDetected: false,
    tableName: null as string | null
  };
}

function partitionMonitoringEvents(rows: AnyRecord[]) {
  const partitioned = new Map<string, AnyRecord[]>();

  for (const definition of DIAGNOSTIC_DEFINITIONS) {
    partitioned.set(definition.diagnosticKey, []);
  }

  for (const row of rows) {
    const eventType = text(row.event_type);
    const entityType = text(row.entity_type);

    for (const definition of DIAGNOSTIC_DEFINITIONS) {
      if (definition.matchesMonitoringEvent(eventType, entityType)) {
        partitioned.get(definition.diagnosticKey)?.push(row);
      }
    }
  }

  return partitioned;
}

function resolveDiagnosticSource(definition: DiagnosticDefinition, dedicatedRows: AnyRecord[]) {
  const matchingRow = dedicatedRows.find((row) =>
    definition.matchesDiagnosticRecord(text(row.diagnostic_type), text(row.diagnostic_key) || text(row.diagnostic_name))
  );

  return sanitizeDiagnosticSource(matchingRow?.source, definition.sourceLabel);
}

function buildDiagnosticsRuntimeItem(input: {
  dedicatedDiagnosticRows: AnyRecord[];
  dedicatedDiagnosticTableDetected: boolean;
  definition: DiagnosticDefinition;
  metadataLoad: { rows: AnyRecord[]; tableDetected: boolean };
  monitoringRows: AnyRecord[];
  monitoringTableDetected: boolean;
}): OperationsDiagnosticsRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const monitoringSnapshot = buildMonitoringDiagnosticSnapshot(input.monitoringRows);
  const dedicatedAggregate = input.dedicatedDiagnosticTableDetected
    ? aggregateDedicatedDiagnosticRows(input.dedicatedDiagnosticRows, input.definition)
    : null;
  const metadataAggregate =
    input.definition.metadataTable &&
    input.definition.metadataTable !== "monitoring_events" &&
    input.metadataLoad.tableDetected
      ? aggregateMetadataRows(input.metadataLoad.rows)
      : null;
  const aggregate = dedicatedAggregate ?? metadataAggregate ?? monitoringSnapshot;
  const metadataDetected = Boolean(
    dedicatedAggregate ||
      (input.definition.metadataTable &&
        input.definition.metadataTable !== "monitoring_events" &&
        input.metadataLoad.tableDetected) ||
      (input.definition.metadataTable === "monitoring_events" &&
        input.monitoringTableDetected &&
        input.monitoringRows.length > 0) ||
      (input.definition.metadataSource === "operations_registry_runtime" && registryEntry)
  );
  const diagnosticStatus = resolveDiagnosticStatus({
    errorCount: aggregate.errorCount,
    eventCount: aggregate.eventCount,
    metadataDetected,
    warningCount: aggregate.warningCount
  });
  const reviewStatus = resolveReviewStatus({
    diagnosticStatus,
    errorCount: aggregate.errorCount,
    metadataDetected
  });
  const runtimeStatus = resolveDiagnosticsRuntimeStatus({
    diagnosticStatus,
    eventCount: aggregate.eventCount,
    metadataDetected,
    reviewStatus
  });

  return {
    diagnosticKey: input.definition.diagnosticKey,
    diagnosticName: input.definition.diagnosticName,
    diagnosticStatus,
    diagnosticType: input.definition.diagnosticType,
    errorCount: aggregate.errorCount,
    groupKey: input.definition.groupKey,
    lastCheckedAt: aggregate.lastCheckedAt,
    lastFailureAt: aggregate.lastFailureAt,
    metadataDetected,
    reviewStatus,
    runtimeStatus,
    safeControls: buildSafeControls(),
    safeSummary: buildSafeSummary({
      errorCount: aggregate.errorCount,
      eventCount: aggregate.eventCount,
      metadataDetected,
      metadataSource: input.definition.metadataSource,
      warningCount: aggregate.warningCount
    }),
    source: resolveDiagnosticSource(input.definition, input.dedicatedDiagnosticRows),
    visibility: registryEntry?.visibility ?? "super_admin",
    warningCount: aggregate.warningCount
  };
}

function buildFutureDiagnosticsHookItems(): OperationsDiagnosticsRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /diagnostic|inspect|scan|probe|trace|export logs/i.test(hook))
    .map((hook, index) => ({
      diagnosticKey: `op-future-diagnostics-hook-${index + 1}`,
      diagnosticName: hook,
      diagnosticStatus: "unknown" as const,
      diagnosticType: "future_hook",
      errorCount: 0,
      groupKey: "future-diagnostics-hooks" as const,
      lastCheckedAt: null,
      lastFailureAt: null,
      metadataDetected: false,
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      safeSummary: "Future diagnostics hook placeholder",
      source: "future_hook",
      visibility: registryEntry?.visibility ?? "super_admin",
      warningCount: 0
    }));
}

export function operationsDiagnosticsRuntimeStatusLabel(status: OperationsDiagnosticsRuntimeStatus) {
  switch (status) {
    case "disabled":
      return "Disabled";
    case "empty":
      return "Empty";
    case "failed":
      return "Failed";
    case "future_hook":
      return "Future Hook";
    case "healthy":
      return "Healthy";
    case "no_metadata_detected":
      return "No Metadata Detected";
    case "registered":
      return "Registered";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function operationsDiagnosticsRuntimeStatusBadgeTone(status: OperationsDiagnosticsRuntimeStatus) {
  switch (status) {
    case "healthy":
    case "registered":
      return "green" as const;
    case "empty":
    case "warning":
      return "blue" as const;
    case "failed":
    case "review_required":
      return "amber" as const;
    case "no_metadata_detected":
      return "red" as const;
    case "disabled":
    case "future_hook":
      return "slate" as const;
  }
}

export function operationsDiagnosticsStatusLabel(status: OperationsDiagnosticsStatus) {
  switch (status) {
    case "empty":
      return "Empty";
    case "failed":
      return "Failed";
    case "healthy":
      return "Healthy";
    case "unknown":
      return "Unknown";
    case "warning":
      return "Warning";
  }
}

export function buildOperationsDiagnosticsRuntimeGroups(
  items: OperationsDiagnosticsRuntimeItem[]
): OperationsDiagnosticsRuntimeGroup[] {
  return DIAGNOSTICS_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsDiagnosticsRuntimeSummary(
  items: OperationsDiagnosticsRuntimeItem[]
): OperationsDiagnosticsRuntimeSummary {
  const operationalDiagnostics = items.filter((item) => item.groupKey !== "future-diagnostics-hooks");
  const healthyDiagnostics = operationalDiagnostics.filter((item) => item.runtimeStatus === "healthy").length;
  const warningDiagnostics = operationalDiagnostics.filter((item) => item.runtimeStatus === "warning").length;
  const failedDiagnostics = operationalDiagnostics.filter(
    (item) =>
      item.runtimeStatus === "failed" ||
      item.runtimeStatus === "review_required" ||
      item.runtimeStatus === "no_metadata_detected"
  ).length;
  const status =
    failedDiagnostics > 0 || warningDiagnostics > 0 ? ("needs_attention" as const) : ("diagnostics_runtime_ready" as const);

  return {
    failedDiagnostics,
    groupCount: buildOperationsDiagnosticsRuntimeGroups(items).length,
    healthyDiagnostics,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_DIAGNOSTICS_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalDiagnostics.length} diagnostic streams`,
      `${healthyDiagnostics} healthy`,
      `${warningDiagnostics} warning`,
      `${failedDiagnostics} require review`
    ].join("; "),
    totalDiagnostics: items.length,
    warningDiagnostics
  };
}

export async function loadOperationsDiagnosticsRuntimeReadOnlySafe(params: {
  supabase: SupabaseClient<Database>;
}) {
  const metadataTables = [
    ...new Set(
      DIAGNOSTIC_DEFINITIONS.map((definition) => definition.metadataTable).filter(
        (table): table is string => Boolean(table) && table !== "monitoring_events"
      )
    )
  ];
  const [monitoringLoad, dedicatedDiagnosticTable, ...metadataLoads] = await Promise.all([
    safeMetadataSelect(
      params.supabase,
      "monitoring_events",
      "id, event_type, event_status, entity_type, created_at",
      500
    ),
    detectDedicatedDiagnosticTable(params.supabase),
    ...metadataTables.map((table) => {
      const definition = DIAGNOSTIC_DEFINITIONS.find((item) => item.metadataTable === table);
      return safeMetadataSelect(params.supabase, table, definition?.metadataColumns ?? "id, created_at", 500);
    })
  ]);
  const metadataByTable = new Map<string, { rows: AnyRecord[]; tableDetected: boolean }>();

  metadataTables.forEach((table, index) => {
    metadataByTable.set(table, metadataLoads[index] ?? { rows: [], tableDetected: false });
  });

  const partitionedEvents = partitionMonitoringEvents(monitoringLoad.rows);
  const diagnosticItems = [
    ...DIAGNOSTIC_DEFINITIONS.map((definition) =>
      buildDiagnosticsRuntimeItem({
        dedicatedDiagnosticRows: dedicatedDiagnosticTable.rows,
        dedicatedDiagnosticTableDetected: dedicatedDiagnosticTable.tableDetected,
        definition,
        metadataLoad: definition.metadataTable
          ? metadataByTable.get(definition.metadataTable) ?? { rows: [], tableDetected: false }
          : { rows: [], tableDetected: false },
        monitoringRows: partitionedEvents.get(definition.diagnosticKey) ?? [],
        monitoringTableDetected: monitoringLoad.tableDetected
      })
    ),
    ...buildFutureDiagnosticsHookItems()
  ];
  const groups = buildOperationsDiagnosticsRuntimeGroups(diagnosticItems);
  const summary = getOperationsDiagnosticsRuntimeSummary(diagnosticItems);

  return {
    diagnosticItems,
    diagnosticsRuntime: summary,
    groups,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsDiagnosticsRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsDiagnosticsRuntimeReadOnlySafe>>
) {
  return {
    diagnosticItems: input.diagnosticItems,
    diagnosticsRuntime: input.diagnosticsRuntime,
    groups: input.groups,
    safeControls: input.safeControls
  };
}
