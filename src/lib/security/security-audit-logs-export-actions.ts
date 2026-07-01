"use server";

import {
  buildSecurityAuditLogsExportIdleResult,
  runSecurityAuditLogsExport,
  type SecurityAuditLogsExportFormat,
  type SecurityAuditLogsExportResult
} from "@/src/lib/security/security-audit-logs-export-runtime";

function cleanText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseFormat(value: string): SecurityAuditLogsExportFormat | null {
  if (value === "csv" || value === "json") {
    return value;
  }

  return null;
}

export async function exportSecurityAuditLogsAction(
  formData: FormData
): Promise<SecurityAuditLogsExportResult> {
  const format = parseFormat(cleanText(formData.get("format")));
  const confirmed = cleanText(formData.get("confirm")) === "true";

  if (!confirmed) {
    return {
      ...buildSecurityAuditLogsExportIdleResult(),
      message: "Export Audit Logs requires explicit confirmation before it can run."
    };
  }

  return runSecurityAuditLogsExport({ confirmed, format });
}

export async function exportSecurityAuditLogsFormState(
  _previousState: SecurityAuditLogsExportResult,
  formData: FormData
): Promise<SecurityAuditLogsExportResult> {
  return exportSecurityAuditLogsAction(formData);
}
