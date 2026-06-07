"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type OperationsAdminAction =
  | "admin_operations_export_diagnostics_placeholder"
  | "admin_operations_incident_reviewed"
  | "admin_operations_retry_placeholder"
  | "admin_operations_view_logs";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordOperationsAction(formData: FormData, action: OperationsAdminAction) {
  const access = await getAdminAccess();
  const targetName = cleanText(formData.get("targetName"));
  const targetType = cleanText(formData.get("targetType"));

  if (!targetName) {
    throw new Error("Missing operations target.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for operations controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_operations_center",
    event_status: "info",
    event_type: action,
    metadata: {
      note: "Placeholder operations governance action only. No destructive delete, restore, production reset, worker restart, cron execution, backup trigger, or direct database action was performed.",
      source: "super_admin_platform_operations_center",
      target_name: targetName,
      target_type: targetType || null
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/operations");
}

export async function markOperationsIncidentReviewed(formData: FormData) {
  await recordOperationsAction(formData, "admin_operations_incident_reviewed");
}

export async function viewOperationsLogs(formData: FormData) {
  await recordOperationsAction(formData, "admin_operations_view_logs");
}

export async function retryOperationsPlaceholder(formData: FormData) {
  await recordOperationsAction(formData, "admin_operations_retry_placeholder");
}

export async function exportOperationsDiagnosticsPlaceholder(formData: FormData) {
  await recordOperationsAction(formData, "admin_operations_export_diagnostics_placeholder");
}
