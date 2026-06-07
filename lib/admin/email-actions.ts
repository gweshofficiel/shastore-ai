"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type EmailAdminAction =
  | "admin_email_disable_template"
  | "admin_email_failed_reviewed"
  | "admin_email_retry_placeholder"
  | "admin_email_template_preview";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordEmailAdminAction(formData: FormData, action: EmailAdminAction) {
  const access = await getAdminAccess();
  const templateId = cleanText(formData.get("templateId"));
  const templateName = cleanText(formData.get("templateName"));
  const failedEmailId = cleanText(formData.get("failedEmailId"));
  const emailType = cleanText(formData.get("emailType"));

  if (!templateId && !failedEmailId) {
    throw new Error("Missing email template or failed email id.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for email controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_email_center",
    event_status: "info",
    event_type: action,
    metadata: {
      email_type: emailType || null,
      failed_email_id: failedEmailId || null,
      note: "Placeholder platform email admin action only. No store email campaign, Professional Email mailbox, mass send, provider key, or real retry was modified.",
      source: "super_admin_email_center",
      template_id: templateId || null,
      template_name: templateName || null
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/email");
}

export async function previewEmailTemplate(formData: FormData) {
  await recordEmailAdminAction(formData, "admin_email_template_preview");
}

export async function disableEmailTemplatePlaceholder(formData: FormData) {
  await recordEmailAdminAction(formData, "admin_email_disable_template");
}

export async function markFailedEmailReviewed(formData: FormData) {
  await recordEmailAdminAction(formData, "admin_email_failed_reviewed");
}

export async function retryEmailPlaceholder(formData: FormData) {
  await recordEmailAdminAction(formData, "admin_email_retry_placeholder");
}
