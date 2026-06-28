import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getOperationsRegistryEntry,
  OPERATIONS_REGISTRY_SOURCE,
  type OperationsRegistryVisibility
} from "@/src/lib/operations/operations-registry-runtime";

export type OperationsMonitoringEventsRuntimeSource = "operations_monitoring_events_runtime";

export type OperationsMonitoringEventsGroupKey =
  | "billing-events"
  | "email-events"
  | "future-monitoring-hooks"
  | "marketplace-events"
  | "notifications-events"
  | "operations-events"
  | "platform-events"
  | "reports-events"
  | "security-events"
  | "seo-events"
  | "store-events";

export type OperationsMonitoringEventsRuntimeStatus =
  | "active"
  | "critical"
  | "disabled"
  | "empty"
  | "future_hook"
  | "no_table_detected"
  | "registered"
  | "resolved"
  | "review_required"
  | "warning";

export type OperationsMonitoringEventsReviewStatus = "clear" | "not_applicable" | "review_required";

export type OperationsMonitoringEventsSeverity = "critical" | "info" | "low" | "warning";

export type OperationsMonitoringEventsSafeControlKey =
  | "acknowledge"
  | "export"
  | "inspect"
  | "resolve"
  | "retry_alert";

export type OperationsMonitoringEventsSafeControl = {
  enabled: false;
  key: OperationsMonitoringEventsSafeControlKey;
  label: string;
  note: string;
};

export type OperationsMonitoringEventsRuntimeItem = {
  count: number;
  eventType: string;
  groupKey: OperationsMonitoringEventsGroupKey;
  lastSeenAt: string | null;
  monitoringEventKey: string;
  occurredAt: string | null;
  resolvedAt: string | null;
  reviewStatus: OperationsMonitoringEventsReviewStatus;
  runtimeStatus: OperationsMonitoringEventsRuntimeStatus;
  safeControls: OperationsMonitoringEventsSafeControl[];
  safeSummary: string;
  severity: OperationsMonitoringEventsSeverity;
  source: string;
  status: string;
  tableDetected: boolean;
  title: string;
  visibility: OperationsRegistryVisibility;
};

export type OperationsMonitoringEventsRuntimeGroup = {
  groupKey: OperationsMonitoringEventsGroupKey;
  itemCount: number;
  items: OperationsMonitoringEventsRuntimeItem[];
  title: string;
};

export type OperationsMonitoringEventsRuntimeSummary = {
  activeStreams: number;
  criticalStreams: number;
  groupCount: number;
  readOnly: true;
  registrySource: typeof OPERATIONS_REGISTRY_SOURCE;
  source: OperationsMonitoringEventsRuntimeSource;
  status: "monitoring_events_runtime_ready" | "needs_attention";
  summary: string;
  totalStreams: number;
};

type AnyRecord = Record<string, unknown>;

type MonitoringGroupDefinition = {
  classify: (eventType: string, entityType: string) => boolean;
  eventType: string;
  groupKey: OperationsMonitoringEventsGroupKey;
  monitoringEventKey: string;
  registryKey: string;
  title: string;
};

export const OPERATIONS_MONITORING_EVENTS_RUNTIME_SOURCE = "operations_monitoring_events_runtime" as const;

export const OPERATIONS_MONITORING_EVENTS_SAFE_CONTROLS: readonly OperationsMonitoringEventsSafeControl[] = [
  {
    enabled: false,
    key: "acknowledge",
    label: "Acknowledge",
    note: "Read-only placeholder. No monitoring acknowledge action runs during OP-11 page load."
  },
  {
    enabled: false,
    key: "resolve",
    label: "Resolve",
    note: "Read-only placeholder. No monitoring resolve action runs during OP-11 page load."
  },
  {
    enabled: false,
    key: "retry_alert",
    label: "Retry Alert",
    note: "Read-only placeholder. No alert retry or notification send runs during OP-11 page load."
  },
  {
    enabled: false,
    key: "inspect",
    label: "Inspect",
    note: "Read-only placeholder. No raw payload or secret inspection runs during OP-11 page load."
  },
  {
    enabled: false,
    key: "export",
    label: "Export",
    note: "Read-only placeholder. No monitoring export or diagnostics execution runs during OP-11 page load."
  }
] as const;

const MONITORING_GROUP_DEFINITIONS: ReadonlyArray<{
  groupKey: OperationsMonitoringEventsGroupKey;
  title: string;
}> = [
  { groupKey: "platform-events", title: "Platform Events" },
  { groupKey: "billing-events", title: "Billing Events" },
  { groupKey: "store-events", title: "Store Events" },
  { groupKey: "marketplace-events", title: "Marketplace Events" },
  { groupKey: "email-events", title: "Email Events" },
  { groupKey: "notifications-events", title: "Notifications Events" },
  { groupKey: "seo-events", title: "SEO Events" },
  { groupKey: "reports-events", title: "Reports Events" },
  { groupKey: "operations-events", title: "Operations Events" },
  { groupKey: "security-events", title: "Security Events" },
  { groupKey: "future-monitoring-hooks", title: "Future Monitoring Hooks" }
];

const MONITORING_STREAM_DEFINITIONS: readonly MonitoringGroupDefinition[] = [
  {
    classify: (eventType, entityType) => matchesMonitoringPattern(eventType, entityType, /platform|website|page|blog|brand|theme_preset/i),
    eventType: "platform_stream",
    groupKey: "platform-events",
    monitoringEventKey: "op-monitoring-platform-stream",
    registryKey: "op-monitoring-events",
    title: "Platform monitoring stream"
  },
  {
    classify: (eventType, entityType) =>
      matchesMonitoringPattern(eventType, entityType, /billing|invoice|subscription|payment|stripe|paypal|revenue/i),
    eventType: "billing_stream",
    groupKey: "billing-events",
    monitoringEventKey: "op-monitoring-billing-stream",
    registryKey: "op-monitoring-events",
    title: "Billing monitoring stream"
  },
  {
    classify: (eventType, entityType) =>
      matchesMonitoringPattern(eventType, entityType, /store|shop|seller|product|order|customer|commerce/i),
    eventType: "store_stream",
    groupKey: "store-events",
    monitoringEventKey: "op-monitoring-store-stream",
    registryKey: "op-monitoring-events",
    title: "Store monitoring stream"
  },
  {
    classify: (eventType, entityType) =>
      matchesMonitoringPattern(eventType, entityType, /marketplace|template|theme|plugin|app|package/i),
    eventType: "marketplace_stream",
    groupKey: "marketplace-events",
    monitoringEventKey: "op-monitoring-marketplace-stream",
    registryKey: "op-monitoring-events",
    title: "Marketplace monitoring stream"
  },
  {
    classify: (eventType, entityType) => matchesMonitoringPattern(eventType, entityType, /email|mailbox|smtp|mail/i),
    eventType: "email_stream",
    groupKey: "email-events",
    monitoringEventKey: "op-monitoring-email-stream",
    registryKey: "op-monitoring-events",
    title: "Email monitoring stream"
  },
  {
    classify: (eventType, entityType) =>
      matchesMonitoringPattern(eventType, entityType, /notification|alert|delivery|retry/i),
    eventType: "notifications_stream",
    groupKey: "notifications-events",
    monitoringEventKey: "op-monitoring-notifications-stream",
    registryKey: "op-monitoring-events",
    title: "Notifications monitoring stream"
  },
  {
    classify: (eventType, entityType) => matchesMonitoringPattern(eventType, entityType, /seo|sitemap|robots|meta|redirect/i),
    eventType: "seo_stream",
    groupKey: "seo-events",
    monitoringEventKey: "op-monitoring-seo-stream",
    registryKey: "op-monitoring-events",
    title: "SEO monitoring stream"
  },
  {
    classify: (eventType, entityType) => matchesMonitoringPattern(eventType, entityType, /report|export|analytics|dashboard/i),
    eventType: "reports_stream",
    groupKey: "reports-events",
    monitoringEventKey: "op-monitoring-reports-stream",
    registryKey: "op-monitoring-events",
    title: "Reports monitoring stream"
  },
  {
    classify: (eventType, entityType) =>
      matchesMonitoringPattern(eventType, entityType, /operation|queue|worker|cron|backup|storage|database|monitoring/i),
    eventType: "operations_stream",
    groupKey: "operations-events",
    monitoringEventKey: "op-monitoring-operations-stream",
    registryKey: "op-monitoring-events",
    title: "Operations monitoring stream"
  },
  {
    classify: (eventType, entityType) =>
      matchesMonitoringPattern(eventType, entityType, /security|auth|login|fraud|abuse|audit|risk|denied|token/i),
    eventType: "security_stream",
    groupKey: "security-events",
    monitoringEventKey: "op-monitoring-security-stream",
    registryKey: "op-monitoring-events",
    title: "Security monitoring stream"
  }
] as const;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clip(value: unknown, maxLength = 500) {
  return text(value).slice(0, maxLength);
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  return OPERATIONS_MONITORING_EVENTS_SAFE_CONTROLS.map((control) => ({ ...control }));
}

function matchesMonitoringPattern(eventType: string, entityType: string, pattern: RegExp) {
  return pattern.test(`${eventType} ${entityType}`.toLowerCase());
}

function sanitizeEventType(value: unknown) {
  const eventType = clip(value, 120).toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");

  if (!eventType) {
    return "unknown_event";
  }

  if (eventType.includes("secret") || eventType.includes("token") || eventType.includes("password")) {
    return "masked_event";
  }

  return eventType;
}

function sanitizeSource(value: unknown) {
  const source = clip(value, 80).toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");

  if (!source) {
    return "monitoring_events";
  }

  if (source.includes("secret") || source.includes("token") || source.includes("password")) {
    return "masked_source";
  }

  return source;
}

export function maskMonitoringUserReferenceSafe(value: unknown) {
  const reference = text(value).toLowerCase();

  if (!reference) {
    return "[masked-user]";
  }

  if (reference.includes("@")) {
    const [localPart, domainPart] = reference.split("@");
    return `${localPart.slice(0, 1) || "*"}***@${domainPart}`;
  }

  return `${reference.slice(0, 4)}***`;
}

function resolveSeverity(status: string, failedCount: number, warningCount: number): OperationsMonitoringEventsSeverity {
  const normalized = status.toLowerCase();

  if (failedCount > 0 || normalized === "failed" || normalized.includes("critical")) {
    return "critical";
  }

  if (warningCount > 0 || normalized === "warning" || normalized === "pending") {
    return "warning";
  }

  if (normalized === "info" || normalized === "success" || normalized === "recorded") {
    return "info";
  }

  return "low";
}

function resolveDominantStatus(rows: AnyRecord[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const status = text(row.event_status).toLowerCase() || "info";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  const priority = ["failed", "warning", "pending", "info", "success", "recorded"];
  for (const status of priority) {
    if ((counts.get(status) ?? 0) > 0) {
      return status;
    }
  }

  return "info";
}

function resolveReviewStatus(failedCount: number, tableDetected: boolean): OperationsMonitoringEventsReviewStatus {
  if (!tableDetected) {
    return "not_applicable";
  }

  if (failedCount > 0) {
    return "review_required";
  }

  return "clear";
}

function resolveMonitoringRuntimeStatus(input: {
  count: number;
  failedCount: number;
  forceFutureHook?: boolean;
  reviewStatus: OperationsMonitoringEventsReviewStatus;
  status: string;
  tableDetected: boolean;
  warningCount: number;
}): OperationsMonitoringEventsRuntimeStatus {
  if (input.forceFutureHook) {
    return "future_hook";
  }

  if (!input.tableDetected) {
    return "no_table_detected";
  }

  if (input.failedCount > 0 || input.status === "failed") {
    return input.failedCount > 2 ? "critical" : "review_required";
  }

  if (input.reviewStatus === "review_required") {
    return "review_required";
  }

  if (input.warningCount > 0 || input.status === "warning" || input.status === "pending") {
    return "warning";
  }

  if (input.count === 0) {
    return "empty";
  }

  if (input.status === "success" || input.status === "recorded" || input.status === "info") {
    return input.warningCount === 0 && input.failedCount === 0 ? "resolved" : "active";
  }

  if (input.count > 0) {
    return "active";
  }

  return "registered";
}

function buildSafeSummary(input: { count: number; failedCount: number; pendingCount: number; warningCount: number }) {
  return [
    `${input.count} events`,
    `${input.failedCount} failed`,
    `${input.warningCount} warning`,
    `${input.pendingCount} pending`
  ].join("; ");
}

function partitionMonitoringRows(rows: AnyRecord[]) {
  const assignments = new Map<string, AnyRecord[]>(
    MONITORING_STREAM_DEFINITIONS.map((definition) => [definition.monitoringEventKey, [] as AnyRecord[]])
  );
  const unmatched: AnyRecord[] = [];

  for (const row of rows) {
    const eventType = sanitizeEventType(row.event_type);
    const entityType = sanitizeSource(row.entity_type);
    const definition = MONITORING_STREAM_DEFINITIONS.find((entry) => entry.classify(eventType, entityType));

    if (definition) {
      assignments.get(definition.monitoringEventKey)?.push(row);
    } else {
      unmatched.push(row);
    }
  }

  if (unmatched.length) {
    assignments.get("op-monitoring-platform-stream")?.push(...unmatched);
  }

  return assignments;
}

function buildMonitoringEventRuntimeItem(input: {
  definition: MonitoringGroupDefinition;
  rows: AnyRecord[];
  tableDetected: boolean;
}): OperationsMonitoringEventsRuntimeItem {
  const registryEntry = getOperationsRegistryEntry(input.definition.registryKey);
  const failedCount = input.rows.filter((row) => text(row.event_status).toLowerCase() === "failed").length;
  const warningCount = input.rows.filter((row) => ["warning", "pending"].includes(text(row.event_status).toLowerCase())).length;
  const pendingCount = input.rows.filter((row) => text(row.event_status).toLowerCase() === "pending").length;
  const count = input.rows.length;
  const status = resolveDominantStatus(input.rows);
  const occurredAt =
    input.rows
      .map((row) => text(row.created_at))
      .filter(Boolean)
      .sort((left, right) => dateValue(left) - dateValue(right))[0] ?? null;
  const lastSeenAt =
    input.rows
      .map((row) => text(row.created_at))
      .filter(Boolean)
      .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;
  const resolvedAt =
    count > 0 && failedCount === 0 && warningCount === 0 && pendingCount === 0 ? lastSeenAt : null;
  const reviewStatus = resolveReviewStatus(failedCount, input.tableDetected);
  const primarySource =
    input.rows.length > 0
      ? sanitizeSource(
          input.rows
            .map((row) => text(row.entity_type))
            .filter(Boolean)
            .sort(
              (left, right) =>
                input.rows.filter((row) => text(row.entity_type) === right).length -
                input.rows.filter((row) => text(row.entity_type) === left).length
            )[0]
        )
      : "monitoring_events";

  return {
    count,
    eventType: input.definition.eventType,
    groupKey: input.definition.groupKey,
    lastSeenAt,
    monitoringEventKey: input.definition.monitoringEventKey,
    occurredAt,
    resolvedAt,
    reviewStatus,
    runtimeStatus: resolveMonitoringRuntimeStatus({
      count,
      failedCount,
      reviewStatus,
      status,
      tableDetected: input.tableDetected,
      warningCount
    }),
    safeControls: buildSafeControls(),
    safeSummary: buildSafeSummary({ count, failedCount, pendingCount, warningCount }),
    severity: resolveSeverity(status, failedCount, warningCount),
    source: primarySource,
    status,
    tableDetected: input.tableDetected,
    title: input.definition.title,
    visibility: registryEntry?.visibility ?? "super_admin"
  };
}

function buildFutureMonitoringHookItems(): OperationsMonitoringEventsRuntimeItem[] {
  const registryEntry = getOperationsRegistryEntry("op-future-hooks");
  const hooks = registryEntry?.futureHooks ?? [];

  return hooks
    .filter((hook) => /monitor|alert|incident|export|log|diagnostic|notify/i.test(hook))
    .map((hook, index) => ({
      count: 0,
      eventType: "future_hook",
      groupKey: "future-monitoring-hooks" as const,
      lastSeenAt: null,
      monitoringEventKey: `op-future-monitoring-hook-${index + 1}`,
      occurredAt: null,
      resolvedAt: null,
      reviewStatus: "not_applicable" as const,
      runtimeStatus: "future_hook" as const,
      safeControls: buildSafeControls(),
      safeSummary: "Future monitoring hook placeholder",
      severity: "low" as const,
      source: "future_hook",
      status: "future_hook",
      tableDetected: false,
      title: hook,
      visibility: registryEntry?.visibility ?? "super_admin"
    }));
}

async function safeMonitoringEventsTableSelect(
  supabase: SupabaseClient<Database>,
  limit: number
): Promise<{ rows: AnyRecord[]; tableDetected: boolean }> {
  try {
    const { data, error } = await supabase
      .from("monitoring_events" as never)
      .select("id, event_type, event_status, entity_type, created_at")
      .limit(limit);

    if (error) {
      if (isMissingTableError(error)) {
        return { rows: [], tableDetected: false };
      }

      console.warn("[operations-monitoring-events-runtime] read-only monitoring events select failed", error.message);
      return { rows: [], tableDetected: false };
    }

    return {
      rows: asRecords(data),
      tableDetected: true
    };
  } catch (error) {
    console.warn("[operations-monitoring-events-runtime] read-only monitoring events select crashed", error);
    return { rows: [], tableDetected: false };
  }
}

export function operationsMonitoringEventsRuntimeStatusLabel(status: OperationsMonitoringEventsRuntimeStatus) {
  switch (status) {
    case "active":
      return "Active";
    case "critical":
      return "Critical";
    case "disabled":
      return "Disabled";
    case "empty":
      return "Empty";
    case "future_hook":
      return "Future Hook";
    case "no_table_detected":
      return "No Table Detected";
    case "registered":
      return "Registered";
    case "resolved":
      return "Resolved";
    case "review_required":
      return "Review Required";
    case "warning":
      return "Warning";
  }
}

export function operationsMonitoringEventsRuntimeStatusBadgeTone(status: OperationsMonitoringEventsRuntimeStatus) {
  switch (status) {
    case "active":
    case "registered":
    case "resolved":
      return "green" as const;
    case "empty":
    case "warning":
      return "blue" as const;
    case "critical":
      return "red" as const;
    case "review_required":
      return "amber" as const;
    case "no_table_detected":
      return "red" as const;
    case "disabled":
    case "future_hook":
      return "slate" as const;
  }
}

export function buildOperationsMonitoringEventsRuntimeGroups(
  items: OperationsMonitoringEventsRuntimeItem[]
): OperationsMonitoringEventsRuntimeGroup[] {
  return MONITORING_GROUP_DEFINITIONS.map((group) => {
    const groupItems = items.filter((item) => item.groupKey === group.groupKey);

    return {
      groupKey: group.groupKey,
      itemCount: groupItems.length,
      items: groupItems,
      title: group.title
    };
  }).filter((group) => group.itemCount > 0);
}

export function getOperationsMonitoringEventsRuntimeSummary(
  items: OperationsMonitoringEventsRuntimeItem[]
): OperationsMonitoringEventsRuntimeSummary {
  const operationalStreams = items.filter((item) => item.groupKey !== "future-monitoring-hooks");
  const activeStreams = operationalStreams.filter(
    (item) => item.runtimeStatus === "active" || item.runtimeStatus === "resolved"
  ).length;
  const criticalStreams = operationalStreams.filter(
    (item) =>
      item.runtimeStatus === "critical" ||
      item.runtimeStatus === "review_required" ||
      item.severity === "critical"
  ).length;
  const status =
    criticalStreams > 0 || operationalStreams.some((item) => item.runtimeStatus === "no_table_detected")
      ? ("needs_attention" as const)
      : ("monitoring_events_runtime_ready" as const);

  return {
    activeStreams,
    criticalStreams,
    groupCount: buildOperationsMonitoringEventsRuntimeGroups(items).length,
    readOnly: true,
    registrySource: OPERATIONS_REGISTRY_SOURCE,
    source: OPERATIONS_MONITORING_EVENTS_RUNTIME_SOURCE,
    status,
    summary: [
      `status ${status}`,
      `${operationalStreams.length} monitoring streams`,
      `${activeStreams} active`,
      `${criticalStreams} require review`
    ].join("; "),
    totalStreams: items.length
  };
}

export async function loadOperationsMonitoringEventsRuntimeReadOnlySafe(params: {
  supabase: SupabaseClient<Database>;
}) {
  const monitoringLoad = await safeMonitoringEventsTableSelect(params.supabase, 500);
  const partitionedRows = partitionMonitoringRows(monitoringLoad.rows);
  const monitoringEvents = [
    ...MONITORING_STREAM_DEFINITIONS.map((definition) =>
      buildMonitoringEventRuntimeItem({
        definition,
        rows: partitionedRows.get(definition.monitoringEventKey) ?? [],
        tableDetected: monitoringLoad.tableDetected
      })
    ),
    ...buildFutureMonitoringHookItems()
  ];
  const groups = buildOperationsMonitoringEventsRuntimeGroups(monitoringEvents);
  const summary = getOperationsMonitoringEventsRuntimeSummary(monitoringEvents);

  return {
    groups,
    monitoringEvents,
    monitoringEventsRuntime: summary,
    safeControls: buildSafeControls()
  };
}

export function mapOperationsMonitoringEventsRuntimeToAdminFields(
  input: Awaited<ReturnType<typeof loadOperationsMonitoringEventsRuntimeReadOnlySafe>>
) {
  return {
    groups: input.groups,
    monitoringEvents: input.monitoringEvents,
    monitoringEventsRuntime: input.monitoringEventsRuntime,
    safeControls: input.safeControls
  };
}
