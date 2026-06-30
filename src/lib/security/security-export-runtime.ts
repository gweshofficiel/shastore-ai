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
  fetchSecurityEventsInput,
  mapSecurityEventRowToRecord
} from "@/src/lib/security/security-events-runtime";
import {
  SECURITY_REGISTRY_SOURCE,
  getSecurityRegistryEntry
} from "@/src/lib/security/security-registry-runtime";
import {
  SECURITY_SAFE_ACTIONS_SOURCE,
  getSecuritySafeAction
} from "@/src/lib/security/security-safe-actions-runtime";

export type SecurityExportSource = "security_export_runtime";

export type SecurityExportFormat = "csv" | "json";

export type SecurityExportDatasetKey = "all" | "audit_logs" | "security_events";

export type SecurityExportState =
  | "disabled"
  | "empty"
  | "error"
  | "idle"
  | "success"
  | "unauthorized";

export type SecurityExportResult = {
  content: string | null;
  dataset: SecurityExportDatasetKey;
  filename: string | null;
  format: SecurityExportFormat;
  generatedAt: string | null;
  message: string;
  mimeType: string | null;
  ok: boolean;
  readOnly: false;
  recordCount: number;
  source: SecurityExportSource;
  state: SecurityExportState;
};

export type SecurityExportDatasetDefinition = {
  description: string;
  key: Exclude<SecurityExportDatasetKey, "all">;
  label: string;
};

export type SecurityExportSupport = {
  confirmationRequired: boolean;
  datasets: SecurityExportDatasetDefinition[];
  disabledReason: string | null;
  maxRecords: number;
  preferredFormat: SecurityExportFormat;
  readOnly: true;
  registryKey: string;
  registrySource: typeof SECURITY_REGISTRY_SOURCE;
  safeActionsSource: typeof SECURITY_SAFE_ACTIONS_SOURCE;
  source: SecurityExportSource;
  supported: boolean;
};

export type SecurityExportInput = {
  confirmed: boolean;
  dataset?: SecurityExportDatasetKey | null;
  format?: SecurityExportFormat | null;
};

export const SECURITY_EXPORT_SOURCE = "security_export_runtime" as const;

export const SECURITY_EXPORT_ACTION_KEY = "sec-action-export-security-data" as const;

export const SECURITY_EXPORT_REGISTRY_KEY = "sec-security-actions" as const;

export const SECURITY_EXPORT_DEFAULT_FORMAT: SecurityExportFormat = "csv";

export const SECURITY_EXPORT_DEFAULT_DATASET: SecurityExportDatasetKey = "all";

export const SECURITY_EXPORT_PAGE_SIZE = 100 as const;

export const SECURITY_EXPORT_MAX_RECORDS = 1000 as const;

export const SECURITY_EXPORT_DISABLED_STATE =
  "Security Export is not available in the current runtime configuration.";

export const SECURITY_EXPORT_DATASET_DEFINITIONS: readonly SecurityExportDatasetDefinition[] = [
  {
    description: "Read-only security audit log records, already masked for Super Admin review.",
    key: "audit_logs",
    label: "Security audit logs"
  },
  {
    description: "Read-only derived security events, already masked for Super Admin review.",
    key: "security_events",
    label: "Security events"
  }
] as const;

const SECURITY_EXPORT_BLOCKED_FIELD_PATTERN =
  /api[_-]?key|authorization|bearer|cookie|credential|hash|password|private|secret|session|token|webhook/i;

const SECURITY_EXPORT_PRIVATE_FIELDS = new Set(["recordKey", "userAgent"]);

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

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

function sanitizeExportRecord(record: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(record)) {
    if (SECURITY_EXPORT_PRIVATE_FIELDS.has(key) || SECURITY_EXPORT_BLOCKED_FIELD_PATTERN.test(key)) {
      continue;
    }

    if (typeof entry === "number" && Number.isFinite(entry)) {
      output[key] = entry;
      continue;
    }

    if (typeof entry === "boolean") {
      output[key] = entry;
      continue;
    }

    if (typeof entry === "string") {
      output[key] = safeText(entry);
    }
  }

  return output;
}

function normalizeDataset(dataset: SecurityExportDatasetKey | null | undefined): SecurityExportDatasetKey {
  if (dataset === "audit_logs" || dataset === "security_events" || dataset === "all") {
    return dataset;
  }

  return SECURITY_EXPORT_DEFAULT_DATASET;
}

function normalizeFormat(format: SecurityExportFormat | null | undefined): SecurityExportFormat {
  return format === "json" ? "json" : SECURITY_EXPORT_DEFAULT_FORMAT;
}

function suspensionExportMechanismAvailable(): boolean {
  return Boolean(createAdminClient());
}

export function resolveSecurityExportSupport(): SecurityExportSupport {
  const action = getSecuritySafeAction(SECURITY_EXPORT_ACTION_KEY);
  const registryEntry = getSecurityRegistryEntry(SECURITY_EXPORT_REGISTRY_KEY);

  const base = {
    confirmationRequired: action?.confirmationRequired ?? true,
    datasets: SECURITY_EXPORT_DATASET_DEFINITIONS.map((definition) => ({ ...definition })),
    maxRecords: SECURITY_EXPORT_MAX_RECORDS,
    preferredFormat: SECURITY_EXPORT_DEFAULT_FORMAT,
    readOnly: true as const,
    registryKey: SECURITY_EXPORT_REGISTRY_KEY,
    registrySource: SECURITY_REGISTRY_SOURCE,
    safeActionsSource: SECURITY_SAFE_ACTIONS_SOURCE,
    source: SECURITY_EXPORT_SOURCE
  };

  if (!registryEntry || registryEntry.visibility !== "super_admin") {
    return {
      ...base,
      disabledReason: "Security actions are not registered as a super-admin module in the security registry.",
      supported: false
    };
  }

  if (!action) {
    return {
      ...base,
      disabledReason: "Security Export is not defined in the security safe actions runtime.",
      supported: false
    };
  }

  if (!suspensionExportMechanismAvailable()) {
    return {
      ...base,
      disabledReason:
        "Security Export is disabled because no existing safe read mechanism (service-role admin access) is configured.",
      supported: false
    };
  }

  return {
    ...base,
    disabledReason: null,
    supported: true
  };
}

async function collectAuditLogExportRows(limit: number): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const reviewed = new Set<string>();
  let page = 1;

  while (rows.length < limit) {
    const input = await fetchSecurityAuditLogsInput({ page, pageSize: SECURITY_EXPORT_PAGE_SIZE });

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
      rows.push(
        sanitizeExportRecord({
          action: record.action,
          actor: record.actor,
          actorRole: record.actorRole,
          browserLabel: record.browserLabel,
          createdAt: record.createdAt,
          deviceLabel: record.deviceLabel,
          eventId: record.eventId,
          ipMasked: record.ipMasked,
          route: record.route,
          safeSummary: record.safeSummary,
          severity: record.severity,
          status: record.status,
          targetId: record.targetId,
          targetType: record.targetType
        })
      );
    });

    if (input.logs.length < SECURITY_EXPORT_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return rows;
}

async function collectSecurityEventExportRows(limit: number): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const reviewed = new Set<string>();
  let page = 1;

  while (rows.length < limit) {
    const input = await fetchSecurityEventsInput({ page, pageSize: SECURITY_EXPORT_PAGE_SIZE });

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

      const record = mapSecurityEventRowToRecord(row, reviewed, index);
      rows.push(
        sanitizeExportRecord({
          actor: record.actor,
          createdAt: record.createdAt,
          deviceLabel: record.deviceLabel,
          eventId: record.eventId,
          eventType: record.eventType,
          ipMasked: record.ipMasked,
          orderId: record.orderId,
          riskLevel: record.riskLevel,
          severity: record.severity,
          sourceModule: record.sourceModule,
          status: record.status,
          storeId: record.storeId,
          title: record.title,
          updatedAt: record.updatedAt,
          userId: record.userId
        })
      );
    });

    if (input.logs.length < SECURITY_EXPORT_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return rows;
}

export type SecurityExportPayload = {
  dataset: SecurityExportDatasetKey;
  exportSource: typeof SECURITY_EXPORT_SOURCE;
  exportedAt: string;
  maxRecords: number;
  recordCount: number;
  safeFieldsOnly: true;
  sections: Record<string, Record<string, unknown>[]>;
  summary: string;
  superAdminOnly: true;
};

export function securityExportPayloadToCsv(payload: SecurityExportPayload): string {
  const headers = ["section", "record", "field", "value"];
  const lines = [headers.join(",")];

  for (const [sectionKey, sectionRows] of Object.entries(payload.sections)) {
    sectionRows.forEach((row, index) => {
      for (const [field, value] of Object.entries(row)) {
        lines.push(
          [
            csvValue(sectionKey),
            csvValue(index + 1),
            csvValue(field),
            csvValue(typeof value === "string" ? value : String(value))
          ].join(",")
        );
      }
    });
  }

  return lines.join("\n");
}

export function buildSecurityExportIdleResult(): SecurityExportResult {
  return {
    content: null,
    dataset: SECURITY_EXPORT_DEFAULT_DATASET,
    filename: null,
    format: SECURITY_EXPORT_DEFAULT_FORMAT,
    generatedAt: null,
    message: "No Security Export has been generated yet.",
    mimeType: null,
    ok: false,
    readOnly: false,
    recordCount: 0,
    source: SECURITY_EXPORT_SOURCE,
    state: "idle"
  };
}

function buildResult(
  state: SecurityExportState,
  dataset: SecurityExportDatasetKey,
  format: SecurityExportFormat,
  message: string,
  extra: Partial<SecurityExportResult> = {}
): SecurityExportResult {
  return {
    content: null,
    dataset,
    filename: null,
    format,
    generatedAt: null,
    message,
    mimeType: null,
    ok: state === "success",
    readOnly: false,
    recordCount: 0,
    source: SECURITY_EXPORT_SOURCE,
    state,
    ...extra
  };
}

export async function recordSecurityExportAttempt(input: {
  access: Awaited<ReturnType<typeof getAdminAccess>>;
  dataset: SecurityExportDatasetKey;
  format: SecurityExportFormat;
  recordCount: number;
  resultCode: SecurityExportState;
}): Promise<void> {
  await recordMonitoringEventSafe({
    entityId: "security-export",
    entityType: "security_export",
    eventStatus: input.resultCode === "success" ? "success" : "failed",
    eventType: "security_export_attempt",
    metadata: {
      action: "security.export.download",
      actorRole: "super_admin",
      exportDataset: input.dataset,
      exportFormat: input.format,
      exportSource: SECURITY_EXPORT_SOURCE,
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

export async function runSecurityExport(input: SecurityExportInput): Promise<SecurityExportResult> {
  const dataset = normalizeDataset(input.dataset);
  const format = normalizeFormat(input.format);
  const support = resolveSecurityExportSupport();

  if (!support.supported) {
    return buildResult("disabled", dataset, format, support.disabledReason ?? SECURITY_EXPORT_DISABLED_STATE);
  }

  if (support.confirmationRequired && !input.confirmed) {
    return buildResult(
      "error",
      dataset,
      format,
      "Security Export requires explicit confirmation before it can run."
    );
  }

  let access: Awaited<ReturnType<typeof getAdminAccess>>;

  try {
    access = await getAdminAccess();
  } catch {
    return buildResult("unauthorized", dataset, format, "Super Admin authentication is required to export security data.");
  }

  if (access.role !== "super_admin") {
    return buildResult("unauthorized", dataset, format, "Only an official Super Admin may export security data.");
  }

  try {
    const sections: Record<string, Record<string, unknown>[]> = {};

    if (dataset === "audit_logs" || dataset === "all") {
      sections.audit_logs = await collectAuditLogExportRows(SECURITY_EXPORT_MAX_RECORDS);
    }

    if (dataset === "security_events" || dataset === "all") {
      sections.security_events = await collectSecurityEventExportRows(SECURITY_EXPORT_MAX_RECORDS);
    }

    const recordCount = Object.values(sections).reduce((total, rows) => total + rows.length, 0);

    if (recordCount === 0) {
      await recordSecurityExportAttempt({ access, dataset, format, recordCount, resultCode: "empty" });
      return buildResult("empty", dataset, format, "No security records are available to export for the current scope.");
    }

    const payload: SecurityExportPayload = {
      dataset,
      exportSource: SECURITY_EXPORT_SOURCE,
      exportedAt: new Date().toISOString(),
      maxRecords: SECURITY_EXPORT_MAX_RECORDS,
      recordCount,
      safeFieldsOnly: true,
      sections,
      summary: safeText(
        `Security export ${dataset}; ${recordCount} masked record(s) from read-only security runtime data only.`
      ),
      superAdminOnly: true
    };

    const generatedAt = payload.exportedAt;
    const stamp = generatedAt.replace(/[:.]/g, "-");
    const content = format === "json" ? JSON.stringify(payload, null, 2) : securityExportPayloadToCsv(payload);
    const mimeType = format === "json" ? "application/json" : "text/csv";
    const filename = `security-export-${dataset}-${stamp}.${format}`;

    await recordSecurityExportAttempt({ access, dataset, format, recordCount, resultCode: "success" });

    return buildResult("success", dataset, format, `Security export generated with ${recordCount} masked record(s).`, {
      content,
      filename,
      generatedAt,
      mimeType,
      ok: true,
      recordCount
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error while generating the security export.";

    try {
      await recordSecurityExportAttempt({ access, dataset, format, recordCount: 0, resultCode: "error" });
    } catch {
      // Recording the failed attempt is best-effort and must never block the error result.
    }

    return buildResult("error", dataset, format, `Unable to generate the security export: ${message}`);
  }
}
