"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type TemplateAdminAction =
  | "admin_template_activate"
  | "admin_template_archive"
  | "admin_template_install_version"
  | "admin_template_mark_official"
  | "admin_template_mark_recommended"
  | "admin_template_package_summary_viewed"
  | "admin_template_preview"
  | "admin_template_publish_update"
  | "admin_template_set_visibility"
  | "admin_template_update_stores";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function recordTemplateAdminAction(formData: FormData, action: TemplateAdminAction) {
  const access = await getAdminAccess();
  const templateId = cleanText(formData.get("templateId"));
  const templateName = cleanText(formData.get("templateName"));
  const visibility = cleanText(formData.get("visibility"));
  const versionId = cleanText(formData.get("versionId"));
  const versionNumber = cleanText(formData.get("versionNumber"));

  if (!templateId) {
    throw new Error("Missing template id.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for template controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_template_management",
    event_status: "info",
    event_type: action,
    metadata: {
      note: "Placeholder template governance action only. No template package was installed, no store was overwritten, and no template registry was duplicated.",
      source: "super_admin_template_management_center",
      template_id: templateId,
      template_name: templateName,
      version_id: versionId || null,
      version_number: versionNumber || null,
      visibility: visibility || null
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/templates");
}

export async function activateTemplatePlaceholder(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_activate");
}

export async function archiveTemplatePlaceholder(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_archive");
}

export async function markTemplateOfficial(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_mark_official");
}

export async function markTemplateRecommended(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_mark_recommended");
}

export async function setTemplateVisibility(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_set_visibility");
}

export async function previewTemplatePlaceholder(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_preview");
}

export async function viewTemplatePackageSummary(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_package_summary_viewed");
}

export async function publishTemplateUpdatePlaceholder(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_publish_update");
}

export async function installTemplateVersionPlaceholder(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_install_version");
}

export async function updateStoresTemplatePlaceholder(formData: FormData) {
  await recordTemplateAdminAction(formData, "admin_template_update_stores");
}
