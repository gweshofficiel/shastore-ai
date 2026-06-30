"use server";

import {
  buildSecurityExportIdleResult,
  runSecurityExport,
  type SecurityExportDatasetKey,
  type SecurityExportFormat,
  type SecurityExportResult
} from "@/src/lib/security/security-export-runtime";

function cleanText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDataset(value: string): SecurityExportDatasetKey | null {
  if (value === "audit_logs" || value === "security_events" || value === "all") {
    return value;
  }

  return null;
}

function parseFormat(value: string): SecurityExportFormat | null {
  if (value === "csv" || value === "json") {
    return value;
  }

  return null;
}

export async function generateSecurityExportAction(
  formData: FormData
): Promise<SecurityExportResult> {
  const dataset = parseDataset(cleanText(formData.get("dataset")));
  const format = parseFormat(cleanText(formData.get("format")));
  const confirmed = cleanText(formData.get("confirm")) === "true";

  if (!confirmed) {
    return {
      ...buildSecurityExportIdleResult(),
      message: "Security Export requires explicit confirmation before it can run."
    };
  }

  return runSecurityExport({ confirmed, dataset, format });
}

export async function generateSecurityExportFormState(
  _previousState: SecurityExportResult,
  formData: FormData
): Promise<SecurityExportResult> {
  return generateSecurityExportAction(formData);
}
