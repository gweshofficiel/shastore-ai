"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type PlatformSettingsAction =
  | "admin_platform_settings_export_snapshot_placeholder"
  | "admin_platform_settings_feature_flag_placeholder"
  | "admin_platform_settings_maintenance_placeholder"
  | "admin_platform_settings_save_placeholder"
  | "admin_platform_settings_tax_rules_placeholder";

function cleanText(value: FormDataEntryValue | null, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function recordPlatformSettingsAction(formData: FormData, action: PlatformSettingsAction) {
  const access = await getAdminAccess();
  const targetName = cleanText(formData.get("targetName")) || "platform_settings";
  const targetType = cleanText(formData.get("targetType")) || "settings";

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform settings controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_platform_settings_center",
    event_status: "info",
    event_type: action,
    metadata: {
      note: "Placeholder platform settings action only. No Store Owner settings, store records, billing rules, platform theme, auth, RLS, maintenance routing, or feature flags were changed.",
      source: "super_admin_platform_settings_center",
      target_name: targetName,
      target_type: targetType
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/settings");
}

export async function savePlatformSettingsPlaceholder(formData: FormData) {
  await recordPlatformSettingsAction(formData, "admin_platform_settings_save_placeholder");
}

export async function featureFlagRolloutPlaceholder(formData: FormData) {
  await recordPlatformSettingsAction(formData, "admin_platform_settings_feature_flag_placeholder");
}

export async function maintenanceModePlaceholder(formData: FormData) {
  await recordPlatformSettingsAction(formData, "admin_platform_settings_maintenance_placeholder");
}

export async function taxRulesEnginePlaceholder(formData: FormData) {
  await recordPlatformSettingsAction(formData, "admin_platform_settings_tax_rules_placeholder");
}

export async function exportSettingsSnapshotPlaceholder(formData: FormData) {
  await recordPlatformSettingsAction(formData, "admin_platform_settings_export_snapshot_placeholder");
}
