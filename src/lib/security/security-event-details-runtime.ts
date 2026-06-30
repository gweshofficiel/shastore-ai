import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { summarizeUserAgent } from "@/lib/security/user-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityEventDetailsSource = "security_event_details_runtime";

export type SecurityEventDetailSeverity = "critical" | "high" | "low" | "medium";

export type SecurityEventDetailStatus = "blocked" | "failed" | "recorded" | "reviewed" | "watching";

export type SecurityEventDetailsRuntimeStatus =
  | "event_details_ready"
  | "load_error"
  | "not_found";

export type SecurityEventDetailRow = {
  action?: string | null;
  created_at?: string | null;
  id?: string | null;
  ip_address?: string | null;
  metadata?: unknown;
  reason?: string | null;
  route?: string | null;
  store_id?: string | null;
  user_agent?: string | null;
  user_id?: string | null;
  workspace_id?: string | null;
};

export type SecurityEventMetadataEntry = {
  key: string;
  label: string;
  value: string;
};

export type SecurityEventDetailRecord = {
  actor: string | null;
  browserLabel: string | null;
  createdAt: string;
  description: string | null;
  deviceLabel: string | null;
  eventId: string;
  eventType: string;
  ipAvailable: boolean;
  ipMasked: string;
  metadataEntries: SecurityEventMetadataEntry[];
  orderId: string | null;
  paymentId: string | null;
  riskLevel: string | null;
  route: string | null;
  severity: SecurityEventDetailSeverity;
  sourceModule: string;
  status: SecurityEventDetailStatus;
  storeId: string | null;
  title: string;
  updatedAt: string | null;
  userAgentAvailable: boolean;
  userId: string | null;
};

export type SecurityEventDetailsEmptyFields = {
  fields: string[];
  hasMissing: boolean;
};

export type SecurityEventDetailsSummary = {
  loadError: string | null;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  requestedEventId: string;
  source: SecurityEventDetailsSource;
  status: SecurityEventDetailsRuntimeStatus;
  summary: string;
};

export type SecurityEventDetailsRuntimeInput = {
  event: SecurityEventDetailRow | null;
  loadError: string | null;
  requestedEventId: string;
  reviewedEventIds?: string[];
};

export type SecurityEventDetailsLoadingState = {
  loading: true;
  message: string;
  readOnly: true;
  source: SecurityEventDetailsSource;
};

export const SECURITY_EVENT_DETAILS_SOURCE = "security_event_details_runtime" as const;

export const SECURITY_EVENT_DETAILS_TABLE = "security_audit_logs" as const;

export const SECURITY_EVENT_DETAILS_REGISTRY_KEY = "sec-security-events" as const;

export const SECURITY_EVENT_DETAILS_MAX_METADATA_ENTRIES = 40 as const;

export const SECURITY_EVENT_DETAILS_NOT_FOUND_STATE =
  "This security event could not be found. It may have been outside the readable scope or never existed. No event was created.";

export const SECURITY_EVENT_DETAILS_EMPTY_FIELD_STATE = "Not recorded for this event.";

const SECURITY_EVENT_DETAILS_SENSITIVE_KEYS = [
  "password",
  "secret",
  "token",
  "api_key",
  "apikey",
  "authorization",
  "auth",
  "key",
  "credential",
  "session",
  "cookie"
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function maskIp(value: unknown): { available: boolean; masked: string } {
  const raw = text(value);

  if (!raw) {
    return { available: false, masked: "IP not recorded" };
  }

  if (raw.includes(":")) {
    const parts = raw.split(":").filter(Boolean);
    return { available: true, masked: `${parts.slice(0, 2).join(":")}:****` };
  }

  const parts = raw.split(".");

  if (parts.length === 4) {
    return { available: true, masked: `${parts[0]}.${parts[1]}.***.***` };
  }

  return { available: true, masked: "[masked-ip]" };
}

function safeText(value: unknown, max = 240): string | null {
  const raw = text(value).replace(/\s+/g, " ").trim();

  if (!raw) {
    return null;
  }

  return raw
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[redacted-token]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, max);
}

function metadataOf(row: SecurityEventDetailRow): Record<string, unknown> {
  return isRecord(row.metadata) ? row.metadata : {};
}

function titleCase(value: string): string {
  return value
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isSensitiveKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return SECURITY_EVENT_DETAILS_SENSITIVE_KEYS.some((sensitive) => lowered.includes(sensitive));
}

function stringifyMetadataValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return safeText(value, 200);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return safeText(`[${value.length} item(s)]`, 60);
  }

  if (isRecord(value)) {
    return safeText(`{${Object.keys(value).length} field(s)}`, 60);
  }

  return null;
}

export function buildSecurityEventMetadataEntries(
  metadata: Record<string, unknown>
): SecurityEventMetadataEntry[] {
  const entries: SecurityEventMetadataEntry[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (entries.length >= SECURITY_EVENT_DETAILS_MAX_METADATA_ENTRIES) {
      break;
    }

    if (isSensitiveKey(key)) {
      entries.push({ key, label: titleCase(key), value: "[redacted]" });
      continue;
    }

    const stringified = stringifyMetadataValue(value);

    if (stringified === null) {
      continue;
    }

    entries.push({ key, label: titleCase(key), value: stringified });
  }

  return entries;
}

function deriveSeverity(row: SecurityEventDetailRow): SecurityEventDetailSeverity {
  const action = text(row.action).toLowerCase();
  const reason = text(row.reason).toLowerCase();

  if (action.includes("token") || reason.includes("token") || action.includes("fraud") || action.includes("chargeback")) {
    return "critical";
  }

  if (
    action.includes("denied") ||
    action.includes("unauthorized") ||
    action.includes("rate_limit") ||
    action.includes("blocked") ||
    reason.includes("abuse")
  ) {
    return "high";
  }

  if (action.includes("login") && (action.includes("failed") || reason.includes("failed"))) {
    return "medium";
  }

  if (action.includes("suspicious")) {
    return "medium";
  }

  return "low";
}

function deriveStatus(
  row: SecurityEventDetailRow,
  severity: SecurityEventDetailSeverity,
  reviewedIds: Set<string>
): SecurityEventDetailStatus {
  const id = text(row.id);
  const action = text(row.action).toLowerCase();

  if (id && reviewedIds.has(id)) {
    return "reviewed";
  }

  if (action.includes("denied") || action.includes("rate_limit") || action.includes("blocked")) {
    return "blocked";
  }

  if (action.includes("failed")) {
    return "failed";
  }

  return severity === "high" || severity === "critical" ? "watching" : "recorded";
}

function deriveSourceModule(row: SecurityEventDetailRow): string {
  const metadata = metadataOf(row);
  const explicit = text(metadata.source_module) || text(metadata.source);

  if (explicit) {
    return explicit;
  }

  const action = text(row.action).toLowerCase();

  if (action.includes("rate_limit")) {
    return "rate_limit";
  }

  if (action.includes("fraud") || action.includes("chargeback") || action.includes("dispute")) {
    return "fraud_detection";
  }

  if (action.includes("denied") || action.includes("unauthorized") || action.includes("blocked")) {
    return "access_control";
  }

  if (action.includes("login") || action.includes("password") || action.includes("session")) {
    return "login_monitoring";
  }

  if (action.includes("abuse") || action.includes("suspicious")) {
    return "abuse_detection";
  }

  return "security_audit";
}

function deriveActor(row: SecurityEventDetailRow): string | null {
  const metadata = metadataOf(row);
  const metadataActor = safeText(metadata.actor ?? metadata.actor_email, 120);

  if (metadataActor) {
    return metadataActor;
  }

  return text(row.user_id) || null;
}

export function mapSecurityEventDetailRowToRecord(
  row: SecurityEventDetailRow,
  reviewedIds: Set<string>
): SecurityEventDetailRecord {
  const metadata = metadataOf(row);
  const severity = deriveSeverity(row);
  const status = deriveStatus(row, severity, reviewedIds);
  const ip = maskIp(row.ip_address);
  const rawUserAgent = text(row.user_agent) || null;
  const { browserLabel, deviceLabel } = summarizeUserAgent(rawUserAgent);
  const eventType = text(row.action, "security.event");
  const eventId = text(row.id) || `security-event:${text(row.created_at)}`;

  return {
    actor: deriveActor(row),
    browserLabel: rawUserAgent ? browserLabel : null,
    createdAt: text(row.created_at, new Date(0).toISOString()),
    description: safeText(row.reason),
    deviceLabel: rawUserAgent ? deviceLabel : null,
    eventId,
    eventType,
    ipAvailable: ip.available,
    ipMasked: ip.masked,
    metadataEntries: buildSecurityEventMetadataEntries(metadata),
    orderId: text(metadata.order_id) || text(metadata.orderId) || null,
    paymentId:
      text(metadata.payment_id) || text(metadata.paymentId) || text(metadata.transaction_id) || null,
    riskLevel: text(metadata.risk_level) || text(metadata.riskLevel) || null,
    route: text(row.route) || null,
    severity,
    sourceModule: deriveSourceModule(row),
    status,
    storeId: text(row.store_id) || null,
    title: safeText(metadata.title, 120) || titleCase(eventType),
    updatedAt: text(metadata.updated_at) || text(metadata.updatedAt) || null,
    userAgentAvailable: Boolean(rawUserAgent),
    userId: text(row.user_id) || null
  };
}

export function securityEventDetailSeverityBadgeTone(severity: SecurityEventDetailSeverity) {
  switch (severity) {
    case "critical":
      return "red" as const;
    case "high":
      return "amber" as const;
    case "medium":
      return "blue" as const;
    case "low":
      return "green" as const;
  }
}

export function securityEventDetailStatusBadgeTone(status: SecurityEventDetailStatus) {
  switch (status) {
    case "reviewed":
    case "recorded":
      return "green" as const;
    case "failed":
      return "red" as const;
    case "blocked":
    case "watching":
      return "amber" as const;
  }
}

export function buildSecurityEventDetailsMissingFields(
  record: SecurityEventDetailRecord
): SecurityEventDetailsEmptyFields {
  const fields: string[] = [];

  if (!record.description) {
    fields.push("description");
  }

  if (!record.riskLevel) {
    fields.push("risk level");
  }

  if (!record.userId) {
    fields.push("related user");
  }

  if (!record.storeId) {
    fields.push("related store");
  }

  if (!record.orderId) {
    fields.push("related order");
  }

  if (!record.paymentId) {
    fields.push("related payment");
  }

  if (!record.ipAvailable) {
    fields.push("related IP address");
  }

  if (!record.userAgentAvailable) {
    fields.push("related device/browser");
  }

  if (!record.actor) {
    fields.push("actor");
  }

  if (!record.updatedAt) {
    fields.push("updated at");
  }

  if (record.metadataEntries.length === 0) {
    fields.push("metadata");
  }

  return {
    fields,
    hasMissing: fields.length > 0
  };
}

export function getSecurityEventDetailsSummary(
  input: SecurityEventDetailsRuntimeInput,
  record: SecurityEventDetailRecord | null
): SecurityEventDetailsSummary {
  const status: SecurityEventDetailsRuntimeStatus = input.loadError
    ? "load_error"
    : record === null
      ? "not_found"
      : "event_details_ready";

  return {
    loadError: input.loadError,
    readOnly: true,
    registryKey: SECURITY_EVENT_DETAILS_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    requestedEventId: input.requestedEventId,
    source: SECURITY_EVENT_DETAILS_SOURCE,
    status,
    summary: input.loadError
      ? `status load_error; ${input.loadError}`
      : record === null
        ? `status not_found; requested ${input.requestedEventId || "unknown"}`
        : [
            `status ${status}`,
            `event ${record.eventId}`,
            `type ${record.eventType}`,
            `severity ${record.severity}`,
            `status ${record.status}`,
            `${record.metadataEntries.length} metadata fields`
          ].join("; ")
  };
}

export function buildSecurityEventDetailsLoadingState(): SecurityEventDetailsLoadingState {
  return {
    loading: true,
    message: "Loading the read-only Security event details runtime from existing security event records.",
    readOnly: true,
    source: SECURITY_EVENT_DETAILS_SOURCE
  };
}

export function buildSecurityEventDetailsErrorInput(
  message: string,
  requestedEventId: string
): SecurityEventDetailsRuntimeInput {
  return {
    event: null,
    loadError: message,
    requestedEventId,
    reviewedEventIds: []
  };
}

export function mapSecurityEventDetailsRuntimeToAdminFields(input: SecurityEventDetailsRuntimeInput) {
  const registryEntry = getSecurityRegistryEntry(SECURITY_EVENT_DETAILS_REGISTRY_KEY);

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    const safeInput = buildSecurityEventDetailsErrorInput(
      "Security events are not registered as a super-admin module in the security registry.",
      input.requestedEventId
    );

    return {
      emptyFieldState: SECURITY_EVENT_DETAILS_EMPTY_FIELD_STATE,
      event: null,
      missingFields: { fields: [], hasMissing: false } as SecurityEventDetailsEmptyFields,
      notFoundState: SECURITY_EVENT_DETAILS_NOT_FOUND_STATE,
      registry: null,
      summary: getSecurityEventDetailsSummary(safeInput, null)
    };
  }

  const reviewedIds = new Set((input.reviewedEventIds ?? []).filter(Boolean));
  const record =
    input.loadError || !input.event ? null : mapSecurityEventDetailRowToRecord(input.event, reviewedIds);
  const summary = getSecurityEventDetailsSummary(input, record);
  const missingFields = record
    ? buildSecurityEventDetailsMissingFields(record)
    : ({ fields: [], hasMissing: false } as SecurityEventDetailsEmptyFields);

  return {
    emptyFieldState: SECURITY_EVENT_DETAILS_EMPTY_FIELD_STATE,
    event: record,
    missingFields,
    notFoundState: SECURITY_EVENT_DETAILS_NOT_FOUND_STATE,
    registry: {
      auditEnabled: registryEntry.auditEnabled,
      description: registryEntry.description,
      displayName: registryEntry.displayName,
      key: registryEntry.key,
      permissions: [...registryEntry.permissions],
      route: registryEntry.route,
      runtimeStatus: registryEntry.runtimeStatus,
      source: SECURITY_REGISTRY_SOURCE,
      telemetryEnabled: registryEntry.telemetryEnabled,
      visibility: registryEntry.visibility
    },
    summary
  };
}

export async function fetchSecurityEventDetailsInput(
  eventId: string
): Promise<SecurityEventDetailsRuntimeInput> {
  const requestedEventId = text(eventId).trim();

  if (!requestedEventId) {
    return {
      event: null,
      loadError: null,
      requestedEventId,
      reviewedEventIds: []
    };
  }

  try {
    await getAdminAccess();

    const admin = createAdminClient();

    if (!admin) {
      return buildSecurityEventDetailsErrorInput(
        "Service-role admin access is required to read security event details.",
        requestedEventId
      );
    }

    const { data, error } = await admin
      .from(SECURITY_EVENT_DETAILS_TABLE as never)
      .select(
        "id, workspace_id, store_id, user_id, action, reason, route, ip_address, user_agent, metadata, created_at"
      )
      .eq("id" as never, requestedEventId as never)
      .limit(1)
      .maybeSingle();

    if (error) {
      return buildSecurityEventDetailsErrorInput(
        `Unable to load security event details: ${error.message}`,
        requestedEventId
      );
    }

    return {
      event: isRecord(data) ? (data as SecurityEventDetailRow) : null,
      loadError: null,
      requestedEventId,
      reviewedEventIds: []
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error loading security event details.";
    return buildSecurityEventDetailsErrorInput(
      `Unable to load security event details: ${message}`,
      requestedEventId
    );
  }
}

export async function loadSecurityEventDetailsReadOnlySafe(eventId: string) {
  const input = await fetchSecurityEventDetailsInput(eventId);
  return mapSecurityEventDetailsRuntimeToAdminFields(input);
}
