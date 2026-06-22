"use server";

import { revalidatePath } from "next/cache";
import {
  assertNotificationSafeActionSubmitAllowed,
  mapNotificationAdminActionToSafeAction,
  sanitizeNotificationSafeActionErrorMessage
} from "@/src/lib/notifications/notification-safe-action-runtime";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type NotificationAdminAction =
  | "admin_notification_details_viewed"
  | "admin_notification_disable_template"
  | "admin_notification_mark_reviewed"
  | "admin_notification_retry_placeholder";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordNotificationAdminAction(formData: FormData, action: NotificationAdminAction) {
  const safeAction = mapNotificationAdminActionToSafeAction(action);
  if (!safeAction) {
    throw new Error(sanitizeNotificationSafeActionErrorMessage("Unknown notification admin action."));
  }

  assertNotificationSafeActionSubmitAllowed(safeAction);

  const access = await getAdminAccess();
  const notificationId = cleanText(formData.get("notificationId"));
  const notificationType = cleanText(formData.get("notificationType"));
  const channel = cleanText(formData.get("channel"));

  if (!notificationId) {
    throw new Error("Missing notification id.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for notification controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_notification_center",
    event_status: "info",
    event_type: action,
    metadata: {
      channel,
      note: "Placeholder notification governance action only. No Store Owner notification, Email Center template, SMS, WhatsApp, push, or real retry/send was modified.",
      notification_id: notificationId,
      notification_type: notificationType,
      source: "super_admin_notification_center"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/notifications");
}

export async function markNotificationFailureReviewed(formData: FormData) {
  await recordNotificationAdminAction(formData, "admin_notification_mark_reviewed");
}

export async function retryNotificationPlaceholder(formData: FormData) {
  assertNotificationSafeActionSubmitAllowed("retry_failure");
  await recordNotificationAdminAction(formData, "admin_notification_retry_placeholder");
}

export async function disableNotificationTemplatePlaceholder(formData: FormData) {
  assertNotificationSafeActionSubmitAllowed("disable_template");
  await recordNotificationAdminAction(formData, "admin_notification_disable_template");
}

export async function viewNotificationDetails(formData: FormData) {
  await recordNotificationAdminAction(formData, "admin_notification_details_viewed");
}
