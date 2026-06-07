"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type PlatformThemeAction =
  | "admin_platform_theme_preview"
  | "admin_platform_theme_publish_placeholder"
  | "admin_platform_theme_reset_placeholder"
  | "admin_platform_theme_save_draft";

async function recordPlatformThemeAction(action: PlatformThemeAction) {
  const access = await getAdminAccess();
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform theme controls.");
  }

  await admin.from("monitoring_events" as never).insert({
    entity_id: null,
    entity_type: "admin_platform_theme_branding",
    event_status: "info",
    event_type: action,
    metadata: {
      note: "Placeholder platform branding action only. Store owner themes and storefront runtime were not changed.",
      source: "super_admin_platform_theme_branding_center"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/platform-theme");
}

export async function savePlatformBrandingDraft() {
  await recordPlatformThemeAction("admin_platform_theme_save_draft");
}

export async function previewPlatformBranding() {
  await recordPlatformThemeAction("admin_platform_theme_preview");
}

export async function resetPlatformBrandingPlaceholder() {
  await recordPlatformThemeAction("admin_platform_theme_reset_placeholder");
}

export async function publishPlatformBrandingPlaceholder() {
  await recordPlatformThemeAction("admin_platform_theme_publish_placeholder");
}
