"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type ReportAdminAction =
  | "admin_report_export_placeholder"
  | "admin_report_mark_reviewed"
  | "admin_report_schedule_placeholder"
  | "admin_report_viewed";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordReportAdminAction(formData: FormData, action: ReportAdminAction) {
  const access = await getAdminAccess();
  const reportId = cleanText(formData.get("reportId"));
  const reportName = cleanText(formData.get("reportName"));
  const category = cleanText(formData.get("category"));

  if (!reportId) {
    throw new Error("Missing report id.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for reporting controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_reporting_center",
    event_status: "info",
    event_type: action,
    metadata: {
      category,
      note: "Placeholder Super Admin reporting action only. No analytics, billing, Store Owner report, export job, scheduled delivery, or reporting table was modified.",
      report_id: reportId,
      report_name: reportName,
      source: "super_admin_reporting_center"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/reports");
}

export async function viewReportPlaceholder(formData: FormData) {
  await recordReportAdminAction(formData, "admin_report_viewed");
}

export async function markReportReviewed(formData: FormData) {
  await recordReportAdminAction(formData, "admin_report_mark_reviewed");
}

export async function exportReportPlaceholder(formData: FormData) {
  await recordReportAdminAction(formData, "admin_report_export_placeholder");
}

export async function scheduleReportPlaceholder(formData: FormData) {
  await recordReportAdminAction(formData, "admin_report_schedule_placeholder");
}
