import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { securityAuditActions } from "@/lib/store-security";
import { createAdminClient } from "@/lib/supabase/admin";

export type SecurityReportsSource = "security_reports_runtime";

export type SecurityReportsDateRange = "today" | "7d" | "30d" | "month" | "year";

export type SecurityReportsLoadingState = "empty" | "error" | "loaded";

export type SecurityReportsRuntimeStatus = "needs_attention" | "ready" | "unavailable";

export type SecurityReportsBreakdownItem = {
  count: number;
  dataAvailability: "available" | "planned";
  label: string;
};

export type SecurityReportsActivityItem = {
  activityAt: string;
  activityType: string;
  category: string;
  dataAvailability: "available" | "planned";
  severity: string;
  summary: string;
};

export type SecurityReportsMetrics = {
  adminActivityCount: number;
  auditEventsCount: number;
  blockedOrDeniedActions: number;
  failedLoginAttempts: number;
  permissionChangesCount: number;
  rlsDeniedAccessEvents: number;
  roleChangesCount: number;
  successfulLoginEvents: number;
  totalSecurityEvents: number;
};

export type SecurityReportsSnapshot = {
  dataSources: string[];
  errorMessage: string | null;
  eventsByCategory: SecurityReportsBreakdownItem[];
  eventsBySeverity: SecurityReportsBreakdownItem[];
  generatedAt: string;
  lastUpdatedAt: string | null;
  latestSecurityActivity: SecurityReportsActivityItem[];
  loadingState: SecurityReportsLoadingState;
  metrics: SecurityReportsMetrics;
  rangeLabel: string;
  readOnly: true;
  selectedRange: SecurityReportsDateRange;
  source: SecurityReportsSource;
  status: SecurityReportsRuntimeStatus;
  warnings: string[];
};

export type SecurityReportsSummary = {
  lastGeneratedState: string;
  readOnly: true;
  status: SecurityReportsRuntimeStatus;
  summary: string;
};

export type SecurityReportsValidation = {
  isValid: boolean;
  issues: string[];
};

export const SECURITY_REPORTS_SOURCE = "security_reports_runtime" as const;

type RawRecord = Record<string, unknown>;

type NormalizedActivity = {
  activityAt: string;
  activityType: string;
  category: string;
  severity: string;
  summary: string;
};

const SEVERITY_LABELS = ["critical", "high", "medium", "low", "info"] as const;

const CATEGORY_LABELS = ["Auth", "Access", "Admin", "Audit", "Monitoring", "Other"] as const;

type SecuritySeverity = (typeof SEVERITY_LABELS)[number];

type SecurityCategory = (typeof CATEGORY_LABELS)[number];

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

function resolveRangeLabel(range: SecurityReportsDateRange) {
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

function resolveRangeStart(range: SecurityReportsDateRange) {
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

function safeSecuritySummary(value: unknown) {
  const raw = text(value, "").replace(/\s+/g, " ").trim();

  if (!raw) {
    return "No safe summary recorded.";
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[redacted-token]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, 120);
}

function formatActionLabel(action: string) {
  const cleaned = text(action, "security.event");

  return cleaned.replace(/\./g, " · ");
}

function classifySeverity(action: string, reason: string, eventType = ""): SecuritySeverity {
  const normalizedAction = action.toLowerCase();
  const normalizedReason = reason.toLowerCase();
  const normalizedEventType = eventType.toLowerCase();
  const combined = `${normalizedAction} ${normalizedReason} ${normalizedEventType}`;

  if (combined.includes("token") || combined.includes("fraud")) {
    return "critical";
  }

  if (
    combined.includes("denied") ||
    combined.includes("unauthorized") ||
    combined.includes("rate_limit") ||
    combined.includes("abuse") ||
    combined.includes("blocked")
  ) {
    return "high";
  }

  if (combined.includes("login") && combined.includes("failed")) {
    return "medium";
  }

  if (normalizedEventType.startsWith("admin_") || normalizedAction.startsWith("admin.")) {
    return "info";
  }

  return "low";
}

function classifyCategory(action: string, reason: string, eventType = ""): SecurityCategory {
  const normalizedAction = action.toLowerCase();
  const normalizedReason = reason.toLowerCase();
  const normalizedEventType = eventType.toLowerCase();
  const combined = `${normalizedAction} ${normalizedReason} ${normalizedEventType}`;

  if (
    combined.includes("login") ||
    combined.includes("password") ||
    combined.includes("session") ||
    combined.includes("auth")
  ) {
    return "Auth";
  }

  if (
    combined.includes("denied") ||
    combined.includes("unauthorized") ||
    combined.includes("access") ||
    combined.includes("rls") ||
    combined.includes("permission denied")
  ) {
    return "Access";
  }

  if (normalizedEventType.startsWith("admin_") || normalizedAction.startsWith("admin.")) {
    return "Admin";
  }

  if (normalizedEventType) {
    return "Monitoring";
  }

  if (normalizedAction) {
    return "Audit";
  }

  return "Other";
}

function isFailedLogin(action: string, reason: string) {
  const normalizedAction = action.toLowerCase();
  const normalizedReason = reason.toLowerCase();

  return (
    normalizedAction === securityAuditActions.loginFailed ||
    normalizedAction.includes("login.failed") ||
    (normalizedAction.includes("login") &&
      (normalizedAction.includes("failed") || normalizedReason.includes("failed")))
  );
}

function isSuccessfulLogin(action: string) {
  const normalizedAction = action.toLowerCase();

  return (
    normalizedAction === securityAuditActions.loginSuccess ||
    normalizedAction.includes("login.success") ||
    (normalizedAction.includes("login") && normalizedAction.includes("success"))
  );
}

function isRoleChange(action: string, eventType = "") {
  const combined = `${action} ${eventType}`.toLowerCase();

  return (
    combined.includes("member_role_changed") ||
    combined.includes("role_changed") ||
    combined.includes("admin_internal_team_role") ||
    combined.includes("account_role")
  );
}

function isPermissionChange(action: string, eventType = "") {
  const combined = `${action} ${eventType}`.toLowerCase();

  return combined.includes("permissions_changed") || combined.includes("permission_changed");
}

function isBlockedOrDenied(action: string, reason: string, eventType = "") {
  const combined = `${action} ${reason} ${eventType}`.toLowerCase();

  return (
    combined.includes("access.denied") ||
    combined.includes(".denied") ||
    combined.includes("denied") ||
    combined.includes("blocked") ||
    combined.includes("unauthorized") ||
    combined.includes("rate_limit")
  );
}

function isRlsDenied(action: string, reason: string) {
  const normalizedAction = action.toLowerCase();
  const normalizedReason = reason.toLowerCase();

  return (
    normalizedReason.includes("rls") ||
    normalizedReason.includes("row level security") ||
    (normalizedReason.includes("permission denied") && normalizedAction.includes("denied"))
  );
}

function isAdminActivity(action: string, eventType = "") {
  const normalizedAction = action.toLowerCase();
  const normalizedEventType = eventType.toLowerCase();

  return normalizedEventType.startsWith("admin_") || normalizedAction.startsWith("admin.");
}

function isSecurityMonitoringEvent(eventType: string) {
  const normalized = eventType.toLowerCase();

  return (
    normalized.startsWith("admin_") ||
    normalized.includes("security") ||
    normalized.includes("login") ||
    normalized.includes("abuse") ||
    normalized.includes("rate_limit")
  );
}

async function safeAdminSelect(table: string, columns: string) {
  const admin = createAdminClient();

  if (!admin) {
    return {
      records: [] as RawRecord[],
      warning: "Service-role admin access is unavailable. Security report aggregates are empty."
    };
  }

  const { data, error } = await admin.from(table as never).select(columns as never).limit(5000);

  if (error) {
    return {
      records: [] as RawRecord[],
      warning: `Security report source ${table} could not be loaded safely.`
    };
  }

  return {
    records: asRecords(data),
    warning: null as string | null
  };
}

function incrementBreakdown(map: Map<string, SecurityReportsBreakdownItem>, label: string, planned = false) {
  const key = label || "unknown";
  const current = map.get(key) ?? {
    count: 0,
    dataAvailability: planned ? ("planned" as const) : ("available" as const),
    label: key
  };

  map.set(key, {
    ...current,
    count: current.count + 1
  });
}

function buildEmptySnapshot(
  range: SecurityReportsDateRange,
  warnings: string[],
  errorMessage: string | null = null
): SecurityReportsSnapshot {
  return {
    dataSources: [],
    errorMessage,
    eventsByCategory: CATEGORY_LABELS.map((label) => ({
      count: 0,
      dataAvailability: "planned" as const,
      label
    })),
    eventsBySeverity: SEVERITY_LABELS.map((label) => ({
      count: 0,
      dataAvailability: "planned" as const,
      label
    })),
    generatedAt: new Date().toISOString(),
    lastUpdatedAt: null,
    latestSecurityActivity: [],
    loadingState: errorMessage ? "error" : "empty",
    metrics: {
      adminActivityCount: 0,
      auditEventsCount: 0,
      blockedOrDeniedActions: 0,
      failedLoginAttempts: 0,
      permissionChangesCount: 0,
      rlsDeniedAccessEvents: 0,
      roleChangesCount: 0,
      successfulLoginEvents: 0,
      totalSecurityEvents: 0
    },
    rangeLabel: resolveRangeLabel(range),
    readOnly: true,
    selectedRange: range,
    source: SECURITY_REPORTS_SOURCE,
    status: errorMessage ? "unavailable" : warnings.length ? "needs_attention" : "ready",
    warnings
  };
}

export async function runSecurityReportsSnapshot(
  range: SecurityReportsDateRange = "30d"
): Promise<SecurityReportsSnapshot> {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    return buildEmptySnapshot(range, ["Super Admin access is required for Security Reports runtime."]);
  }

  const selectedRange = range;
  const rangeStart = resolveRangeStart(selectedRange);
  const warnings: string[] = [];
  const dataSources: string[] = [];
  let lastUpdatedAt: string | null = null;

  try {
    const [auditResult, monitoringResult] = await Promise.all([
      safeAdminSelect("security_audit_logs", "id, action, reason, created_at"),
      safeAdminSelect("monitoring_events", "event_type, event_status, entity_type, created_at")
    ]);

    for (const result of [auditResult, monitoringResult]) {
      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    if (auditResult.records.length) {
      dataSources.push("security_audit_logs");
    }

    if (monitoringResult.records.length) {
      dataSources.push("monitoring_events");
    }

    const eventsBySeverity = new Map<string, SecurityReportsBreakdownItem>();
    const eventsByCategory = new Map<string, SecurityReportsBreakdownItem>();
    const activityCandidates: NormalizedActivity[] = [];

    let auditEventsCount = 0;
    let failedLoginAttempts = 0;
    let successfulLoginEvents = 0;
    let roleChangesCount = 0;
    let permissionChangesCount = 0;
    let adminActivityCount = 0;
    let blockedOrDeniedActions = 0;
    let rlsDeniedAccessEvents = 0;
    let monitoringSecurityEvents = 0;
    let highSeverityEvents = 0;

    for (const log of auditResult.records) {
      const createdAt = text(log.created_at);

      if (!isWithinRange(createdAt, rangeStart)) {
        continue;
      }

      auditEventsCount += 1;

      const action = text(log.action);
      const reason = text(log.reason);
      const severity = classifySeverity(action, reason);
      const category = classifyCategory(action, reason);

      incrementBreakdown(eventsBySeverity, severity);
      incrementBreakdown(eventsByCategory, category);

      if (severity === "high" || severity === "critical") {
        highSeverityEvents += 1;
      }

      if (isFailedLogin(action, reason)) {
        failedLoginAttempts += 1;
      }

      if (isSuccessfulLogin(action)) {
        successfulLoginEvents += 1;
      }

      if (isRoleChange(action)) {
        roleChangesCount += 1;
      }

      if (isPermissionChange(action)) {
        permissionChangesCount += 1;
      }

      if (isAdminActivity(action)) {
        adminActivityCount += 1;
      }

      if (isBlockedOrDenied(action, reason)) {
        blockedOrDeniedActions += 1;
      }

      if (isRlsDenied(action, reason)) {
        rlsDeniedAccessEvents += 1;
      }

      if (!lastUpdatedAt || dateValue(createdAt) > dateValue(lastUpdatedAt)) {
        lastUpdatedAt = createdAt;
      }

      activityCandidates.push({
        activityAt: createdAt,
        activityType: formatActionLabel(action),
        category,
        severity,
        summary: safeSecuritySummary(reason)
      });
    }

    for (const event of monitoringResult.records) {
      const createdAt = text(event.created_at);

      if (!isWithinRange(createdAt, rangeStart)) {
        continue;
      }

      const eventType = text(event.event_type);
      const eventStatus = text(event.event_status);

      if (!isSecurityMonitoringEvent(eventType)) {
        continue;
      }

      monitoringSecurityEvents += 1;

      const reason = `${eventStatus} · ${text(event.entity_type, "entity")}`;
      const severity = classifySeverity("", reason, eventType);
      const category = classifyCategory("", reason, eventType);

      incrementBreakdown(eventsBySeverity, severity);
      incrementBreakdown(eventsByCategory, category);

      if (severity === "high" || severity === "critical") {
        highSeverityEvents += 1;
      }

      if (isRoleChange("", eventType)) {
        roleChangesCount += 1;
      }

      if (isPermissionChange("", eventType)) {
        permissionChangesCount += 1;
      }

      if (isAdminActivity("", eventType)) {
        adminActivityCount += 1;
      }

      if (isBlockedOrDenied("", reason, eventType) || eventStatus === "failed") {
        blockedOrDeniedActions += 1;
      }

      if (!lastUpdatedAt || dateValue(createdAt) > dateValue(lastUpdatedAt)) {
        lastUpdatedAt = createdAt;
      }

      activityCandidates.push({
        activityAt: createdAt,
        activityType: formatActionLabel(eventType),
        category,
        severity,
        summary: safeSecuritySummary(`${eventStatus} event on ${text(event.entity_type, "entity")}`)
      });
    }

    const totalSecurityEvents = auditEventsCount + monitoringSecurityEvents;

    if (!auditResult.records.length && !monitoringResult.records.length) {
      warnings.push("Security audit and monitoring sources are empty. Metrics remain read-only with planned indicators.");
    } else if (!auditResult.records.length) {
      warnings.push("Audit log source is unavailable. Login and access metrics may be incomplete.");
    }

    const latestSecurityActivity = [...activityCandidates]
      .sort((left, right) => dateValue(right.activityAt) - dateValue(left.activityAt))
      .slice(0, 8)
      .map((activity) => ({
        activityAt: activity.activityAt,
        activityType: activity.activityType,
        category: activity.category,
        dataAvailability: "available" as const,
        severity: activity.severity,
        summary: activity.summary
      }));

    const severityBreakdown = SEVERITY_LABELS.map((label) => ({
      count: eventsBySeverity.get(label)?.count ?? 0,
      dataAvailability: dataSources.length ? ("available" as const) : ("planned" as const),
      label
    }));

    const categoryBreakdown = CATEGORY_LABELS.map((label) => ({
      count: eventsByCategory.get(label)?.count ?? 0,
      dataAvailability: dataSources.length ? ("available" as const) : ("planned" as const),
      label
    }));

    const status: SecurityReportsRuntimeStatus =
      warnings.length && !dataSources.length
        ? "unavailable"
        : highSeverityEvents > 0 || failedLoginAttempts > 5
          ? "needs_attention"
          : dataSources.length
            ? "ready"
            : "unavailable";

    return {
      dataSources,
      errorMessage: null,
      eventsByCategory: categoryBreakdown,
      eventsBySeverity: severityBreakdown,
      generatedAt: new Date().toISOString(),
      lastUpdatedAt,
      latestSecurityActivity,
      loadingState: dataSources.length ? "loaded" : "empty",
      metrics: {
        adminActivityCount,
        auditEventsCount,
        blockedOrDeniedActions,
        failedLoginAttempts,
        permissionChangesCount,
        rlsDeniedAccessEvents,
        roleChangesCount,
        successfulLoginEvents,
        totalSecurityEvents
      },
      rangeLabel: resolveRangeLabel(selectedRange),
      readOnly: true,
      selectedRange,
      source: SECURITY_REPORTS_SOURCE,
      status,
      warnings
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Security Reports runtime failed to load safely.";

    return buildEmptySnapshot(selectedRange, [], message);
  }
}

export function getSecurityReportsSummary(snapshot: SecurityReportsSnapshot): SecurityReportsSummary {
  return {
    lastGeneratedState: snapshot.lastUpdatedAt
      ? `Generated ${snapshot.generatedAt}; latest security activity ${snapshot.lastUpdatedAt}`
      : `Generated ${snapshot.generatedAt}; no security activity timestamps recorded`,
    readOnly: true,
    status: snapshot.status,
    summary: [
      `status ${snapshot.status}`,
      `${snapshot.rangeLabel}`,
      `${snapshot.metrics.totalSecurityEvents} total security events`,
      `${snapshot.metrics.auditEventsCount} audit events`,
      `${snapshot.metrics.failedLoginAttempts} failed login attempts`,
      `${snapshot.metrics.blockedOrDeniedActions} blocked or denied actions`
    ].join("; ")
  };
}

export function validateSecurityReportsRuntime(snapshot: SecurityReportsSnapshot): SecurityReportsValidation {
  const issues: string[] = [];

  if (!snapshot.readOnly) {
    issues.push("Security Reports runtime must remain read-only.");
  }

  if (snapshot.source !== SECURITY_REPORTS_SOURCE) {
    issues.push("Security Reports runtime must originate from the security reports runtime.");
  }

  if (!snapshot.generatedAt) {
    issues.push("Security Reports runtime must include generatedAt.");
  }

  if (snapshot.metrics.totalSecurityEvents < 0 || snapshot.metrics.auditEventsCount < 0) {
    issues.push("Security Reports totals must not be negative.");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function mapSecurityReportsRuntimeToAdminFields(range: SecurityReportsDateRange = "30d") {
  const snapshot = await runSecurityReportsSnapshot(range);
  const validation = validateSecurityReportsRuntime(snapshot);
  const summary = getSecurityReportsSummary(snapshot);

  return {
    errorMessage: snapshot.errorMessage,
    eventsByCategory: snapshot.eventsByCategory,
    eventsBySeverity: snapshot.eventsBySeverity,
    generatedAt: snapshot.generatedAt,
    lastGeneratedState: summary.lastGeneratedState,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    latestSecurityActivity: snapshot.latestSecurityActivity,
    loadingState: snapshot.loadingState,
    metrics: snapshot.metrics,
    rangeLabel: snapshot.rangeLabel,
    readOnly: true as const,
    selectedRange: snapshot.selectedRange,
    status: validation.isValid ? summary.status : ("needs_attention" as const),
    summary: validation.isValid
      ? summary.summary
      : "Security Reports runtime validation requires safe read-only defaults.",
    warnings: [...snapshot.warnings, ...validation.issues]
  };
}
