"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ResellerNotificationStatus } from "@/lib/reseller-showcase/data";

type NotificationPlaceholderAction =
  | "reseller_notification_archive_placeholder"
  | "reseller_notification_mark_all_read_placeholder"
  | "reseller_notification_mark_read_placeholder"
  | "reseller_notification_view_related_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 220) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/reseller/dashboard")) {
    return "/reseller/dashboard/notifications";
  }

  return value;
}

function withStatus(path: string, key: "error" | "saved", value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function statusForAction(action: NotificationPlaceholderAction): ResellerNotificationStatus {
  if (action === "reseller_notification_archive_placeholder") {
    return "archived";
  }

  return "read";
}

async function recordNotificationAction(
  formData: FormData,
  action: NotificationPlaceholderAction
) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const returnTo = safeReturnPath(formData.get("returnTo"));

  if (!user) {
    redirect("/login");
  }

  const notificationReference =
    cleanText(formData.get("notificationReference")) || "notification-placeholder";
  const relatedItem = cleanText(formData.get("relatedItem")) || "Related item placeholder";
  const category = cleanText(formData.get("category")) || "listing_updates";
  const admin = createAdminClient();

  if (admin) {
    await admin.from("monitoring_events" as never).insert({
      entity_id: null,
      entity_type: "reseller_notifications",
      event_status: "info",
      event_type: action,
      metadata: {
        notification_category: category,
        notification_reference: notificationReference,
        notification_status: statusForAction(action),
        priority: "normal",
        privacy: "Private reseller notification placeholder only. No buyer private data, admin internal alert, Store Owner notification, external email/SMS/WhatsApp, wallet, payout, commission, ownership transfer, or fake sale was created.",
        related_item: relatedItem,
        source: "reseller_dashboard_notifications",
        title:
          action === "reseller_notification_mark_all_read_placeholder"
            ? "All notifications marked read placeholder"
            : "Notification action placeholder"
      },
      store_id: null,
      user_id: user.id,
      workspace_id: null
    } as never);
  }

  revalidatePath("/reseller/dashboard/notifications");
  redirect(withStatus(returnTo, "saved", action));
}

export async function markNotificationReadPlaceholder(formData: FormData) {
  await recordNotificationAction(formData, "reseller_notification_mark_read_placeholder");
}

export async function markAllNotificationsReadPlaceholder(formData: FormData) {
  await recordNotificationAction(formData, "reseller_notification_mark_all_read_placeholder");
}

export async function archiveNotificationPlaceholder(formData: FormData) {
  await recordNotificationAction(formData, "reseller_notification_archive_placeholder");
}

export async function viewNotificationRelatedItemPlaceholder(formData: FormData) {
  await recordNotificationAction(formData, "reseller_notification_view_related_placeholder");
}
