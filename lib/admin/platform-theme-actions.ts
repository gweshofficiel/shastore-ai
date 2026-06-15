"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  compareDraftWithPublished,
  discardThemeDraft,
  getThemeDraft,
  updateThemeDraft,
  validateThemeDraft
} from "@/src/lib/platform-theme/platform-theme-draft-runtime";

type PlatformThemeAction =
  | "admin_platform_theme_preview"
  | "admin_platform_theme_publish_placeholder"
  | "admin_platform_theme_reset_placeholder"
  | "admin_platform_theme_save_draft"
  | "admin_platform_theme_discard_draft";

async function recordPlatformThemeAction(action: PlatformThemeAction, metadata: Record<string, unknown> = {}) {
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
      ...metadata,
      note: "Placeholder platform branding action only. Store owner themes and storefront runtime were not changed.",
      source: "super_admin_platform_theme_branding_center"
    },
    store_id: null,
    user_id: access.user.id,
    workspace_id: null
  } as never);

  revalidatePath("/admin/platform-theme");
}

export async function savePlatformBrandingDraft(formData: FormData) {
  const draft = await getThemeDraft();
  const input = Object.fromEntries(
    draft.settings.map((setting) => {
      const value = formData.get(`setting_${setting.settingKey}`);
      return [setting.settingKey, typeof value === "string" ? value : ""];
    })
  );
  const validation = validateThemeDraft(input);
  const updatedDraft = await updateThemeDraft(input);

  await recordPlatformThemeAction("admin_platform_theme_save_draft", {
    changed_settings: updatedDraft.changedCount,
    draft_only: true,
    invalid_settings: Object.values(validation).filter((item) => item.status === "invalid").length,
    public_theme_changed: false,
    store_themes_touched: 0
  });
}

export async function previewPlatformBranding() {
  const draft = await getThemeDraft();
  await recordPlatformThemeAction("admin_platform_theme_preview", {
    draft_only: true,
    invalid_settings: draft.validationErrors.length,
    preview_uses: "admin_only_draft_values",
    public_theme_changed: false,
    store_themes_touched: 0
  });
}

export async function resetPlatformBrandingPlaceholder() {
  await recordPlatformThemeAction("admin_platform_theme_reset_placeholder");
}

export async function publishPlatformBrandingPlaceholder() {
  await recordPlatformThemeAction("admin_platform_theme_publish_placeholder");
}

export async function discardPlatformBrandingDraft() {
  const before = await compareDraftWithPublished();
  const draft = await discardThemeDraft();

  await recordPlatformThemeAction("admin_platform_theme_discard_draft", {
    discarded_settings: before.filter((item) => item.hasChanged).length,
    draft_only: true,
    remaining_changes: draft.changedCount,
    public_theme_changed: false,
    store_themes_touched: 0
  });
}
