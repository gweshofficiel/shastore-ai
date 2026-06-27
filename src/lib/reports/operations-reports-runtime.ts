import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { createAdminClient } from "@/lib/supabase/admin";

export type OperationsReportsSource = "operations_reports_runtime";

export type OperationsReportsDateRange = "today" | "7d" | "30d" | "month" | "year";

export type OperationsReportsLoadingState = "empty" | "error" | "loaded";

export type OperationsReportsRuntimeStatus = "needs_attention" | "ready" | "unavailable";

export type OperationsReportsBreakdownItem = {
  count: number;
  dataAvailability: "available" | "planned";
  label: string;
};

export type OperationsReportsActivityItem = {
  activityAt: string;
  activityType: string;
  category: string;
  dataAvailability: "available" | "planned";
  status: string;
  summary: string;
};

export type OperationsReportsMetrics = {
  activeDeliveries: number;
  cancelledOrders: number;
  completedDeliveries: number;
  deliveryAssignments: number;
  failedDeliveries: number;
  fulfilledOrders: number;
  operationalIssues: number;
  pendingOrders: number;
  returnRequests: number;
  totalOrders: number;
  trackingEvents: number;
};

export type OperationsReportsSnapshot = {
  dataSources: string[];
  errorMessage: string | null;
  generatedAt: string;
  issuesByCategory: OperationsReportsBreakdownItem[];
  lastUpdatedAt: string | null;
  latestOperationsActivity: OperationsReportsActivityItem[];
  loadingState: OperationsReportsLoadingState;
  metrics: OperationsReportsMetrics;
  rangeLabel: string;
  readOnly: true;
  selectedRange: OperationsReportsDateRange;
  source: OperationsReportsSource;
  status: OperationsReportsRuntimeStatus;
  warnings: string[];
};

export type OperationsReportsSummary = {
  lastGeneratedState: string;
  readOnly: true;
  status: OperationsReportsRuntimeStatus;
  summary: string;
};

export type OperationsReportsValidation = {
  isValid: boolean;
  issues: string[];
};

export const OPERATIONS_REPORTS_SOURCE = "operations_reports_runtime" as const;

type RawRecord = Record<string, unknown>;

type NormalizedOrder = {
  activityAt: string;
  cancelled: boolean;
  fulfilled: boolean;
  pending: boolean;
};

type NormalizedActivity = {
  activityAt: string;
  activityType: string;
  category: string;
  status: string;
  summary: string;
};

const ISSUE_CATEGORY_LABELS = ["Delivery", "Orders", "Returns", "Support", "System"] as const;

const PENDING_ORDER_STATUSES = new Set(["draft", "pending", "paid", "processing", "confirmed"]);

const FULFILLED_ORDER_STATUSES = new Set(["shipped", "delivered", "fulfilled", "completed"]);

const CANCELLED_ORDER_STATUSES = new Set(["cancelled", "canceled", "refunded"]);

const FULFILLED_FULFILLMENT_STATUSES = new Set(["fulfilled", "shipped", "delivered", "partially_fulfilled"]);

const ACTIVE_DELIVERY_STATUSES = new Set(["assigned", "accepted", "picked_up", "out_for_delivery"]);

const COMPLETED_DELIVERY_STATUSES = new Set(["delivered"]);

const FAILED_DELIVERY_STATUSES = new Set(["failed", "returned"]);

const OPEN_INCIDENT_STATUSES = new Set(["open", "under_review", "escalated"]);

const OPEN_SUPPORT_STATUSES = new Set(["open", "in_review", "in progress", "waiting customer"]);

const OPERATIONAL_MONITORING_KEYWORDS = [
  "delivery",
  "fulfillment",
  "order",
  "return",
  "support",
  "tracking",
  "shipment",
  "incident"
];

function text(value: unknown, fallback = "") {
  const cleaned =
    typeof value === "string" && value.trim()
      ? maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, 120)
      : fallback;

  return cleaned;
}

function dateValue(value: unknown) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveRangeLabel(range: OperationsReportsDateRange) {
  switch (range) {
    case "today":
      return "Today";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "month":
      return "Current month";
    case "year":
      return "Current year";
    default:
      return "Last 30 days";
  }
}

function resolveRangeStart(range: OperationsReportsDateRange) {
  const now = new Date();

  if (range === "today") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  if (range === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (range === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (range === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

function isWithinRange(timestamp: string | null | undefined, rangeStart: Date) {
  const value = dateValue(timestamp);

  if (!value) {
    return false;
  }

  return value >= rangeStart.getTime();
}

function asRecords(data: unknown): RawRecord[] {
  return Array.isArray(data) ? (data as RawRecord[]) : [];
}

function safeOperationsSummary(value: unknown) {
  const raw = text(value, "").replace(/\s+/g, " ").trim();

  if (!raw) {
    return "Operational activity recorded.";
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
    .slice(0, 120);
}

function formatEventLabel(value: string) {
  const cleaned = text(value, "event");

  return cleaned.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeOrder(record: RawRecord): NormalizedOrder | null {
  const activityAt = text(record.created_at);

  if (!activityAt) {
    return null;
  }

  const orderStatus = text(record.order_status).toLowerCase();
  const fulfillmentStatus = text(record.fulfillment_status).toLowerCase();
  const cancelled = CANCELLED_ORDER_STATUSES.has(orderStatus);
  const fulfilled =
    FULFILLED_ORDER_STATUSES.has(orderStatus) ||
    FULFILLED_FULFILLMENT_STATUSES.has(fulfillmentStatus);
  const pending = !cancelled && !fulfilled && PENDING_ORDER_STATUSES.has(orderStatus);

  return {
    activityAt,
    cancelled,
    fulfilled,
    pending
  };
}

function isTrackingEvent(eventType: string) {
  const normalized = eventType.toLowerCase();

  return (
    normalized.includes("tracking") ||
    normalized.includes("shipping") ||
    normalized === "delivery_status_changed"
  );
}

function isOperationalMonitoringEvent(eventType: string, eventStatus: string) {
  const normalizedType = eventType.toLowerCase();
  const normalizedStatus = eventStatus.toLowerCase();

  if (normalizedStatus !== "failed" && normalizedStatus !== "warning") {
    return false;
  }

  return OPERATIONAL_MONITORING_KEYWORDS.some((keyword) => normalizedType.includes(keyword));
}

function classifyActivityCategory(source: string, eventType: string) {
  const combined = `${source} ${eventType}`.toLowerCase();

  if (combined.includes("return")) {
    return "Returns";
  }

  if (combined.includes("support") || combined.includes("ticket")) {
    return "Support";
  }

  if (combined.includes("delivery") || combined.includes("tracking") || combined.includes("shipment")) {
    return "Delivery";
  }

  if (combined.includes("order") || combined.includes("fulfillment")) {
    return "Orders";
  }

  return "System";
}

async function safeAdminSelect(table: string, columns: string) {
  const admin = createAdminClient();

  if (!admin) {
    return {
      records: [] as RawRecord[],
      warning: "Service-role admin access is unavailable. Operations report aggregates are empty."
    };
  }

  const { data, error } = await admin.from(table as never).select(columns as never).limit(5000);

  if (error) {
    return {
      records: [] as RawRecord[],
      warning: `Operations report source ${table} could not be loaded safely.`
    };
  }

  return {
    records: asRecords(data),
    warning: null as string | null
  };
}

function incrementBreakdown(map: Map<string, OperationsReportsBreakdownItem>, label: string) {
  const key = label || "unknown";
  const current = map.get(key) ?? {
    count: 0,
    dataAvailability: "available" as const,
    label: key
  };

  map.set(key, {
    ...current,
    count: current.count + 1
  });
}

function buildEmptySnapshot(
  range: OperationsReportsDateRange,
  warnings: string[],
  errorMessage: string | null = null
): OperationsReportsSnapshot {
  return {
    dataSources: [],
    errorMessage,
    generatedAt: new Date().toISOString(),
    issuesByCategory: ISSUE_CATEGORY_LABELS.map((label) => ({
      count: 0,
      dataAvailability: "planned" as const,
      label
    })),
    lastUpdatedAt: null,
    latestOperationsActivity: [],
    loadingState: errorMessage ? "error" : "empty",
    metrics: {
      activeDeliveries: 0,
      cancelledOrders: 0,
      completedDeliveries: 0,
      deliveryAssignments: 0,
      failedDeliveries: 0,
      fulfilledOrders: 0,
      operationalIssues: 0,
      pendingOrders: 0,
      returnRequests: 0,
      totalOrders: 0,
      trackingEvents: 0
    },
    rangeLabel: resolveRangeLabel(range),
    readOnly: true,
    selectedRange: range,
    source: OPERATIONS_REPORTS_SOURCE,
    status: errorMessage ? "unavailable" : warnings.length ? "needs_attention" : "ready",
    warnings
  };
}

export async function runOperationsReportsSnapshot(
  range: OperationsReportsDateRange = "30d"
): Promise<OperationsReportsSnapshot> {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return buildEmptySnapshot(range, ["Super Admin access is required for Operations Reports runtime."]);
  }

  const selectedRange = range;
  const rangeStart = resolveRangeStart(selectedRange);
  const warnings: string[] = [];
  const dataSources: string[] = [];
  let lastUpdatedAt: string | null = null;

  try {
    const [
      storeOrdersResult,
      ordersResult,
      deliveryAssignmentsResult,
      deliveryEventsResult,
      orderEventsResult,
      returnRequestsResult,
      deliveryIncidentsResult,
      supportTicketsResult,
      storeSupportTicketsResult,
      monitoringEventsResult
    ] = await Promise.all([
      safeAdminSelect(
        "store_orders",
        "id, order_status, fulfillment_status, delivery_status, created_at, updated_at"
      ),
      safeAdminSelect(
        "orders",
        "id, order_status, fulfillment_status, delivery_status, created_at, updated_at"
      ),
      safeAdminSelect("delivery_assignments", "id, status, assigned_at, created_at, updated_at"),
      safeAdminSelect("store_delivery_events", "event_type, new_value, created_at"),
      safeAdminSelect("order_events", "event_type, new_value, created_at"),
      safeAdminSelect("store_return_requests", "id, status, created_at, updated_at"),
      safeAdminSelect("delivery_incidents", "id, category, status, priority, created_at, updated_at"),
      safeAdminSelect("support_tickets", "status, priority, created_at, updated_at"),
      safeAdminSelect("store_support_tickets", "status, category, priority, created_at, updated_at"),
      safeAdminSelect("monitoring_events", "event_type, event_status, entity_type, created_at")
    ]);

    for (const result of [
      storeOrdersResult,
      ordersResult,
      deliveryAssignmentsResult,
      deliveryEventsResult,
      orderEventsResult,
      returnRequestsResult,
      deliveryIncidentsResult,
      supportTicketsResult,
      storeSupportTicketsResult,
      monitoringEventsResult
    ]) {
      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    if (storeOrdersResult.records.length) {
      dataSources.push("store_orders");
    }

    if (ordersResult.records.length) {
      dataSources.push("orders");
    }

    if (deliveryAssignmentsResult.records.length) {
      dataSources.push("delivery_assignments");
    }

    if (deliveryEventsResult.records.length) {
      dataSources.push("store_delivery_events");
    }

    if (orderEventsResult.records.length) {
      dataSources.push("order_events");
    }

    if (returnRequestsResult.records.length) {
      dataSources.push("store_return_requests");
    }

    if (deliveryIncidentsResult.records.length) {
      dataSources.push("delivery_incidents");
    }

    if (supportTicketsResult.records.length) {
      dataSources.push("support_tickets");
    }

    if (storeSupportTicketsResult.records.length) {
      dataSources.push("store_support_tickets");
    }

    if (monitoringEventsResult.records.length) {
      dataSources.push("monitoring_events");
    }

    const issuesByCategory = new Map<string, OperationsReportsBreakdownItem>();
    const activityCandidates: NormalizedActivity[] = [];

    let totalOrders = 0;
    let pendingOrders = 0;
    let fulfilledOrders = 0;
    let cancelledOrders = 0;
    let deliveryAssignments = 0;
    let activeDeliveries = 0;
    let completedDeliveries = 0;
    let failedDeliveries = 0;
    let trackingEvents = 0;
    let returnRequests = 0;
    let operationalIssues = 0;

    for (const record of [...storeOrdersResult.records, ...ordersResult.records]) {
      const normalized = normalizeOrder(record);
      const createdAt = text(record.created_at);
      const deliveryStatus = text(record.delivery_status).toLowerCase();

      if (!normalized || !isWithinRange(createdAt, rangeStart)) {
        continue;
      }

      totalOrders += 1;

      if (normalized.pending) {
        pendingOrders += 1;
      }

      if (normalized.fulfilled) {
        fulfilledOrders += 1;
      }

      if (normalized.cancelled) {
        cancelledOrders += 1;
      }

      if (ACTIVE_DELIVERY_STATUSES.has(deliveryStatus)) {
        activeDeliveries += 1;
      }

      if (COMPLETED_DELIVERY_STATUSES.has(deliveryStatus)) {
        completedDeliveries += 1;
      }

      if (FAILED_DELIVERY_STATUSES.has(deliveryStatus)) {
        failedDeliveries += 1;
        operationalIssues += 1;
        incrementBreakdown(issuesByCategory, "Delivery");
      }

      if (!lastUpdatedAt || dateValue(createdAt) > dateValue(lastUpdatedAt)) {
        lastUpdatedAt = createdAt;
      }
    }

    for (const assignment of deliveryAssignmentsResult.records) {
      const activityAt = text(assignment.assigned_at) || text(assignment.created_at);
      const status = text(assignment.status).toLowerCase();

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      deliveryAssignments += 1;

      if (ACTIVE_DELIVERY_STATUSES.has(status)) {
        activeDeliveries += 1;
      }

      if (COMPLETED_DELIVERY_STATUSES.has(status)) {
        completedDeliveries += 1;
      }

      if (FAILED_DELIVERY_STATUSES.has(status)) {
        failedDeliveries += 1;
        operationalIssues += 1;
        incrementBreakdown(issuesByCategory, "Delivery");
      }

      activityCandidates.push({
        activityAt,
        activityType: formatEventLabel(`delivery_assignment_${status || "assigned"}`),
        category: "Delivery",
        status: status || "assigned",
        summary: safeOperationsSummary(`Assignment status ${status || "assigned"}`)
      });

      if (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt)) {
        lastUpdatedAt = activityAt;
      }
    }

    for (const event of [...deliveryEventsResult.records, ...orderEventsResult.records]) {
      const activityAt = text(event.created_at);
      const eventType = text(event.event_type);

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      if (isTrackingEvent(eventType)) {
        trackingEvents += 1;
      }

      const category = classifyActivityCategory("order", eventType);

      activityCandidates.push({
        activityAt,
        activityType: formatEventLabel(eventType),
        category,
        status: "recorded",
        summary: safeOperationsSummary(text(event.new_value, "Operational timeline update"))
      });

      if (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt)) {
        lastUpdatedAt = activityAt;
      }
    }

    for (const request of returnRequestsResult.records) {
      const activityAt = text(request.created_at);
      const status = text(request.status).toLowerCase();

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      returnRequests += 1;

      if (status === "requested" || status === "approved") {
        operationalIssues += 1;
        incrementBreakdown(issuesByCategory, "Returns");
      }

      activityCandidates.push({
        activityAt,
        activityType: formatEventLabel("return_request"),
        category: "Returns",
        status: status || "requested",
        summary: safeOperationsSummary(`Return request ${status || "requested"}`)
      });

      if (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt)) {
        lastUpdatedAt = activityAt;
      }
    }

    for (const incident of deliveryIncidentsResult.records) {
      const activityAt = text(incident.created_at);
      const status = text(incident.status).toLowerCase();
      const category = text(incident.category, "other");
      const priority = text(incident.priority, "medium");

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      if (OPEN_INCIDENT_STATUSES.has(status)) {
        operationalIssues += 1;
        incrementBreakdown(issuesByCategory, "Delivery");
      }

      activityCandidates.push({
        activityAt,
        activityType: formatEventLabel(`delivery_incident_${category}`),
        category: "Delivery",
        status: status || "open",
        summary: safeOperationsSummary(`Incident ${category.replace(/_/g, " ")} · ${priority}`)
      });

      if (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt)) {
        lastUpdatedAt = activityAt;
      }
    }

    for (const ticket of [...supportTicketsResult.records, ...storeSupportTicketsResult.records]) {
      const activityAt = text(ticket.created_at);
      const status = text(ticket.status).toLowerCase();
      const category = text(ticket.category, "Support");

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      if (OPEN_SUPPORT_STATUSES.has(status)) {
        operationalIssues += 1;
        incrementBreakdown(issuesByCategory, "Support");
      }

      activityCandidates.push({
        activityAt,
        activityType: formatEventLabel("support_ticket"),
        category: "Support",
        status: status || "open",
        summary: safeOperationsSummary(`Support ticket ${category}`)
      });

      if (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt)) {
        lastUpdatedAt = activityAt;
      }
    }

    for (const event of monitoringEventsResult.records) {
      const activityAt = text(event.created_at);
      const eventType = text(event.event_type);
      const eventStatus = text(event.event_status);

      if (!isWithinRange(activityAt, rangeStart)) {
        continue;
      }

      if (!isOperationalMonitoringEvent(eventType, eventStatus)) {
        continue;
      }

      operationalIssues += 1;
      incrementBreakdown(issuesByCategory, "System");

      activityCandidates.push({
        activityAt,
        activityType: formatEventLabel(eventType),
        category: "System",
        status: eventStatus || "failed",
        summary: safeOperationsSummary(`Monitoring ${eventStatus} on ${text(event.entity_type, "entity")}`)
      });

      if (!lastUpdatedAt || dateValue(activityAt) > dateValue(lastUpdatedAt)) {
        lastUpdatedAt = activityAt;
      }
    }

    if (!dataSources.length) {
      warnings.push(
        "Operational data sources are unavailable. Metrics remain read-only with planned indicators."
      );
    } else if (!storeOrdersResult.records.length && !ordersResult.records.length) {
      warnings.push("Order sources are empty. Order metrics may remain at zero until data is available.");
    }

    const latestOperationsActivity = [...activityCandidates]
      .sort((left, right) => dateValue(right.activityAt) - dateValue(left.activityAt))
      .slice(0, 8)
      .map((activity) => ({
        activityAt: activity.activityAt,
        activityType: activity.activityType,
        category: activity.category,
        dataAvailability: "available" as const,
        status: activity.status,
        summary: activity.summary
      }));

    const issuesBreakdown = ISSUE_CATEGORY_LABELS.map((label) => ({
      count: issuesByCategory.get(label)?.count ?? 0,
      dataAvailability: dataSources.length ? ("available" as const) : ("planned" as const),
      label
    }));

    const status: OperationsReportsRuntimeStatus =
      warnings.length && !dataSources.length
        ? "unavailable"
        : operationalIssues > 0 || failedDeliveries > 0
          ? "needs_attention"
          : dataSources.length
            ? "ready"
            : "unavailable";

    return {
      dataSources,
      errorMessage: null,
      generatedAt: new Date().toISOString(),
      issuesByCategory: issuesBreakdown,
      lastUpdatedAt,
      latestOperationsActivity,
      loadingState: dataSources.length ? "loaded" : "empty",
      metrics: {
        activeDeliveries,
        cancelledOrders,
        completedDeliveries,
        deliveryAssignments,
        failedDeliveries,
        fulfilledOrders,
        operationalIssues,
        pendingOrders,
        returnRequests,
        totalOrders,
        trackingEvents
      },
      rangeLabel: resolveRangeLabel(selectedRange),
      readOnly: true,
      selectedRange,
      source: OPERATIONS_REPORTS_SOURCE,
      status,
      warnings
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Operations Reports runtime failed to load safely.";

    return buildEmptySnapshot(selectedRange, [], message);
  }
}

export function getOperationsReportsSummary(snapshot: OperationsReportsSnapshot): OperationsReportsSummary {
  return {
    lastGeneratedState: snapshot.lastUpdatedAt
      ? `Generated ${snapshot.generatedAt}; latest operations activity ${snapshot.lastUpdatedAt}`
      : `Generated ${snapshot.generatedAt}; no operations activity timestamps recorded`,
    readOnly: true,
    status: snapshot.status,
    summary: [
      `status ${snapshot.status}`,
      `${snapshot.rangeLabel}`,
      `${snapshot.metrics.totalOrders} total orders`,
      `${snapshot.metrics.deliveryAssignments} delivery assignments`,
      `${snapshot.metrics.operationalIssues} operational issues`,
      `${snapshot.metrics.trackingEvents} tracking events`
    ].join("; ")
  };
}

export function validateOperationsReportsRuntime(
  snapshot: OperationsReportsSnapshot
): OperationsReportsValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("Operations Reports runtime must remain read-only.");
  }

  if (snapshot.source !== OPERATIONS_REPORTS_SOURCE) {
    issues.push("Operations Reports runtime must originate from the operations reports runtime.");
  }

  if (!snapshot.generatedAt) {
    issues.push("Operations Reports runtime must include generatedAt.");
  }

  if (snapshot.metrics.totalOrders < 0 || snapshot.metrics.operationalIssues < 0) {
    issues.push("Operations Reports totals must not be negative.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapOperationsReportsRuntimeToAdminFields(
  range: OperationsReportsDateRange = "30d"
) {
  const snapshot = await runOperationsReportsSnapshot(range);
  const validation = validateOperationsReportsRuntime(snapshot);
  const summary = getOperationsReportsSummary(snapshot);

  return {
    errorMessage: snapshot.errorMessage,
    generatedAt: snapshot.generatedAt,
    issuesByCategory: snapshot.issuesByCategory,
    lastGeneratedState: summary.lastGeneratedState,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    latestOperationsActivity: snapshot.latestOperationsActivity,
    loadingState: snapshot.loadingState,
    metrics: snapshot.metrics,
    rangeLabel: snapshot.rangeLabel,
    readOnly: true as const,
    selectedRange: snapshot.selectedRange,
    status: validation.isValid ? summary.status : ("needs_attention" as const),
    summary: validation.isValid
      ? summary.summary
      : "Operations Reports runtime validation requires safe read-only defaults.",
    warnings: [...snapshot.warnings, ...validation.issues]
  };
}
