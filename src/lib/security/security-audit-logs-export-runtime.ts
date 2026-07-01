import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { maskSensitiveText } from "@/lib/integrations/safe-diagnostics";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchSecurityAuditLogsInput,
  mapSecurityAuditLogRowToRecord
} from "@/src/lib/security/security-audit-logs-runtime";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";

export type SecurityAuditLogsExportSource = "security_audit_logs_export_runtime";

export type SecurityAuditLogsExportFormat = "csv" | "json";

export type SecurityAuditLogsExportState =
  | "disabled"
  | "empty"
  | "error"
  | "idle"
  | "success"
  | "unauthorized";

export type SecurityAuditLogsExportRow = {
  action: string;
  actor: string;
  actorRole: string;
  createdAt: string;
  eventId: string;
  ipAddress: string;
  severity: string;
  status: string;
  targetId: string;
  targetType: string;
  userAgent: string;
};

export type SecurityAuditLogsExportResult = {
  content: string | null;
  filename: string | null;
  format: SecurityAuditLogsExportFormat;
  generatedAt: string | null;
  message: string;
  mimeType: string | null;
  ok: boolean;
  readOnly: false;
  recordCount: number;
  source: SecurityAuditLogsExportSource;
  state: SecurityAuditLogsExportState;
};

export type SecurityAuditLogsExportColumn = {
  key: keyof SecurityAuditLogsExportRow;
  label: string;
};

export type SecurityAuditLogsExportSupport = {
  columns: SecurityAuditLogsExportColumn[];
  confirmationRequired: boolean;
  disabledReason: string | null;
  maxRecords: number;
  preferredFormat: SecurityAuditLogsExportFormat;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  source: SecurityAuditLogsExportSource;
  supported: boolean;
};

export type SecurityAuditLogsExportInput = {
  confirmed: boolean;
  format?: SecurityAuditLogsExportFormat | null;
};

export const SECURITY_AUDIT_LOGS_EXPORT_SOURCE = "security_audit_logs_export_runtime" as const;

export const SECURITY_AUDIT_LOGS_EXPORT_REGISTRY_KEY = "sec-audit-logs" as const;

export const SECURITY_AUDIT_LOGS_EXPORT_DEFAULT_FORMAT: SecurityAuditLogsExportFormat = "csv";

export const SECURITY_AUDIT_LOGS_EXPORT_PAGE_SIZE = 100 as const;

export const SECURITY_AUDIT_LOGS_EXPORT_MAX_RECORDS = 1000 as const;

export const SECURITY_AUDIT_LOGS_EXPORT_DISABLED_STATE =
  "Export Audit Logs is not available in the current runtime configuration.";

export const SECURITY_AUDIT_LOGS_EXPORT_COLUMNS: readonly SecurityAuditLogsExportColumn[] = [
  { key: "eventId", label: "Event ID" },
  { key: "actor", label: "Actor" },
  { key: "actorRole", label: "Actor Role" },
  { key: "action", label: "Action" },
  { key: "targetType", label: "Target Type" },
  { key: "targetId", label: "Target ID" },
  { key: "severity", label: "Severity" },
  { key: "status", label: "Status" },
  { key: "ipAddress", label: "IP Address" },
  { key: "userAgent", label: "User Agent" },
  { key: "createdAt", label: "Created At" }
] as const;

function safeText(value: unknown, maxLength = 240): string {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return maskSensitiveText(value.trim()).replace(/\s+/g, " ").slice(0, maxLength);
}

function csvValue(value: unknown): string {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function normalizeFormat(
  format: SecurityAuditLogsExportFormat | null | undefined
): SecurityAuditLogsExportFormat {
  return format === "json" ? "json" : SECURITY_AUDIT_LOGS_EXPORT_DEFAULT_FORMAT;
}

function auditLogsExportMechanismAvailable(): boolean {
  return Boolean(createAdminClient());
}

export function resolveSecurityAuditLogsExportSupport(): SecurityAuditLogsExportSupport {
  const registryEntry = getSecurityRegistryEntry(SECURITY_AUDIT_LOGS_EXPORT_REGISTRY_KEY);

  const base = {
    columns: SECURITY_AUDIT_LOGS_EXPORT_COLUMNS.map((column) => ({ ...column })),
    confirmationRequired: true,
    maxRecords: SECURITY_AUDIT_LOGS_EXPORT_MAX_RECORDS,
    preferredFormat: SECURITY_AUDIT_LOGS_EXPORT_DEFAULT_FORMAT,
    readOnly: true as const,
    registryKey: SECURITY_AUDIT_LOGS_EXPORT_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    source: SECURITY_AUDIT_LOGS_EXPORT_SOURCE
  };

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      ...base,
      disabledReason: "Audit logs are not registered as a super-admin module in the security registry.",
      supported: false
    };
  }

  if (!auditLogsExportMechanismAvailable()) {
    return {
      ...base,
      disabledReason:
        "Export Audit Logs is disabled because no existing safe read mechanism (service-role admin access) is configured.",
      supported: false
    };
  }

  return {
    ...base,
    disabledReason: null,
    supported: true
  };
}

async function collectAuditLogExportRows(limit: number): Promise<SecurityAuditLogsExportRow[]> {
  const rows: SecurityAuditLogsExportRow[] = [];
  const reviewed = new Set<string>();
  let page = 1;

  while (rows.length < limit) {
    const input = await fetchSecurityAuditLogsInput({ page, pageSize: SECURITY_AUDIT_LOGS_EXPORT_PAGE_SIZE });

    if (input.loadError) {
      throw new Error(input.loadError);
    }

    if (input.logs.length === 0) {
      break;
    }

    input.logs.forEach((row, index) => {
      if (rows.length >= limit) {
        return;
      }

      const record = mapSecurityAuditLogRowToRecord(row, reviewed, index);

      rows.push({
        action: safeText(record.action),
        actor: safeText(record.actor),
        actorRole: safeText(record.actorRole),
        createdAt: safeText(record.createdAt),
        eventId: safeText(record.eventId),
        ipAddress: record.ipAvailable ? safeText(record.ipMasked) : "",
        severity: safeText(record.severity),
        status: safeText(record.status),
        targetId: safeText(record.targetId ?? ""),
        targetType: safeText(record.targetType),
        userAgent: record.userAgentAvailable ? safeText(record.userAgent ?? "") : ""
      });
    });

    if (input.logs.length < SECURITY_AUDIT_LOGS_EXPORT_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return rows;
}

export type SecurityAuditLogsExportPayload = {
  columns: SecurityAuditLogsExportColumn[];
  exportSource: typeof SECURITY_AUDIT_LOGS_EXPORT_SOURCE;
  exportedAt: string;
  maxRecords: number;
  recordCount: number;
  rows: SecurityAuditLogsExportRow[];
  safeFieldsOnly: true;
  summary: string;
  superAdminOnly: true;
};

export function securityAuditLogsExportPayloadToCsv(payload: SecurityAuditLogsExportPayload): string {
  const headers = payload.columns.map((column) => csvValue(column.label)).join(",");
  const lines = [headers];

  for (const row of payload.rows) {
    lines.push(payload.columns.map((column) => csvValue(row[column.key])).join(","));
  }

  return lines.join("\n");
}

export function buildSecurityAuditLogsExportIdleResult(): SecurityAuditLogsExportResult {
  return {
    content: null,
    filename: null,
    format: SECURITY_AUDIT_LOGS_EXPORT_DEFAULT_FORMAT,
    generatedAt: null,
    message: "No Export Audit Logs action has been generated yet.",
    mimeType: null,
    ok: false,
    readOnly: false,
    recordCount: 0,
    source: SECURITY_AUDIT_LOGS_EXPORT_SOURCE,
    state: "idle"
  };
}

function buildResult(
  state: SecurityAuditLogsExportState,
  format: SecurityAuditLogsExportFormat,
  message: string,
  extra: Partial<SecurityAuditLogsExportResult> = {}
): SecurityAuditLogsExportResult {
  return {
    content: null,
    filename: null,
    format,
    generatedAt: null,
    message,
    mimeType: null,
    ok: state === "success",
    readOnly: false,
    recordCount: 0,
    source: SECURITY_AUDIT_LOGS_EXPORT_SOURCE,
    state,
    ...extra
  };
}

export async function recordSecurityAuditLogsExportAttempt(input: {
  access: Awaited<ReturnType<typeof getAdminAccess>>;
  format: SecurityAuditLogsExportFormat;
  recordCount: number;
  resultCode: SecurityAuditLogsExportState;
}): Promise<void> {
  await recordMonitoringEventSafe({
    entityId: "security-audit-logs-export",
    entityType: "security_audit_logs_export",
    eventStatus: input.resultCode === "success" ? "success" : "failed",
    eventType: "security_audit_logs_export_attempt",
    metadata: {
      action: "security.audit_logs.export.download",
      actorRole: "super_admin",
      exportFormat: input.format,
      exportSource: SECURITY_AUDIT_LOGS_EXPORT_SOURCE,
      recordCount: input.recordCount,
      resultCode: input.resultCode,
      route: "/admin/security",
      safeFieldsOnly: true
    },
    storeId: null,
    userId: input.access.user.id,
    workspaceId: null
  });
}

export async function runSecurityAuditLogsExport(
  input: SecurityAuditLogsExportInput
): Promise<SecurityAuditLogsExportResult> {
  const format = normalizeFormat(input.format);
  const support = resolveSecurityAuditLogsExportSupport();

  if (!support.supported) {
    return buildResult("disabled", format, support.disabledReason ?? SECURITY_AUDIT_LOGS_EXPORT_DISABLED_STATE);
  }

  if (support.confirmationRequired && !input.confirmed) {
    return buildResult("error", format, "Export Audit Logs requires explicit confirmation before it can run.");
  }

  let access: Awaited<ReturnType<typeof getAdminAccess>>;

  try {
    access = await getAdminAccess();
  } catch {
    return buildResult("unauthorized", format, "Super Admin authentication is required to export audit logs.");
  }

  if (access.role !== "super_admin") {
    return buildResult("unauthorized", format, "Only an official Super Admin may export audit logs.");
  }

  try {
    const rows = await collectAuditLogExportRows(SECURITY_AUDIT_LOGS_EXPORT_MAX_RECORDS);

    if (rows.length === 0) {
      await recordSecurityAuditLogsExportAttempt({ access, format, recordCount: 0, resultCode: "empty" });
      return buildResult("empty", format, "No audit log records are available to export for the current scope.");
    }

    const exportedAt = new Date().toISOString();
    const payload: SecurityAuditLogsExportPayload = {
      columns: SECURITY_AUDIT_LOGS_EXPORT_COLUMNS.map((column) => ({ ...column })),
      exportSource: SECURITY_AUDIT_LOGS_EXPORT_SOURCE,
      exportedAt,
      maxRecords: SECURITY_AUDIT_LOGS_EXPORT_MAX_RECORDS,
      recordCount: rows.length,
      rows,
      safeFieldsOnly: true,
      summary: `Audit logs export; ${rows.length} masked record(s) from read-only audit log data only.`,
      superAdminOnly: true
    };

    const stamp = exportedAt.replace(/[:.]/g, "-");
    const content =
      format === "json" ? JSON.stringify(payload, null, 2) : securityAuditLogsExportPayloadToCsv(payload);
    const mimeType = format === "json" ? "application/json" : "text/csv";
    const filename = `security-audit-logs-${stamp}.${format}`;

    await recordSecurityAuditLogsExportAttempt({ access, format, recordCount: rows.length, resultCode: "success" });

    return buildResult("success", format, `Audit logs export generated with ${rows.length} masked record(s).`, {
      content,
      filename,
      generatedAt: exportedAt,
      mimeType,
      ok: true,
      recordCount: rows.length
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error while generating the audit logs export.";

    try {
      await recordSecurityAuditLogsExportAttempt({ access, format, recordCount: 0, resultCode: "error" });
    } catch {
      // Recording the failed attempt is best-effort and must never block the error result.
    }

    return buildResult("error", format, `Unable to generate the audit logs export: ${message}`);
  }
}
