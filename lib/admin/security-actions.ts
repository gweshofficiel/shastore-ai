"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type SecurityAdminAction =
  | "admin_security_clear_risk"
  | "admin_security_export_placeholder"
  | "admin_security_mark_high_risk"
  | "admin_security_mark_reviewed"
  | "admin_security_store_suspend_shortcut"
  | "admin_security_user_suspend_shortcut";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordSecurityAdminAction(formData: FormData, action: SecurityAdminAction) {
  const access = await getAdminAccess();
  const eventId = cleanText(formData.get("eventId"));
  const eventType = cleanText(formData.get("eventType"));
  const userId = cleanText(formData.get("userId"));
  const storeId = cleanText(formData.get("storeId"));

  if (!eventId) {
    throw new Error("Missing security event id.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for security controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_advanced_security",
    event_status: "info",
    event_type: action,
    metadata: {
      event_id: eventId,
      event_type: eventType,
      note: "Placeholder advanced security governance action only. No audit logs were modified, no secrets exposed, and no user/store suspension was executed from this table.",
      source: "super_admin_advanced_security_center",
      store_id: storeId || null,
      user_id: userId || null
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/security");
}

export async function markSecurityEventReviewed(formData: FormData) {
  await recordSecurityAdminAction(formData, "admin_security_mark_reviewed");
}

export async function markSecurityEventHighRisk(formData: FormData) {
  await recordSecurityAdminAction(formData, "admin_security_mark_high_risk");
}

export async function clearSecurityEventRisk(formData: FormData) {
  await recordSecurityAdminAction(formData, "admin_security_clear_risk");
}

export async function suspendUserShortcutPlaceholder(formData: FormData) {
  await recordSecurityAdminAction(formData, "admin_security_user_suspend_shortcut");
}

export async function suspendStoreShortcutPlaceholder(formData: FormData) {
  await recordSecurityAdminAction(formData, "admin_security_store_suspend_shortcut");
}

export async function exportSecurityPlaceholder(formData: FormData) {
  await recordSecurityAdminAction(formData, "admin_security_export_placeholder");
}
