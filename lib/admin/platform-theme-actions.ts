"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  compareDraftWithPublished,
  discardThemeDraft,
  getThemeDraft,
  updateThemeDraft,
  validateThemeDraft
} from "@/src/lib/platform-theme/platform-theme-draft-runtime";
import { publishThemeDraft } from "@/src/lib/platform-theme/platform-theme-publish-runtime";
import {
  deleteDraftPlatformLogo,
  getCurrentPlatformLogo,
  uploadPlatformLogo
} from "@/src/lib/platform-theme/platform-logo-upload";
import {
  deleteDraftPlatformFavicon,
  getCurrentPlatformFavicon,
  uploadPlatformFavicon
} from "@/src/lib/platform-theme/platform-favicon-upload";
import {
  createDraftThemeSnapshot,
  createPublishedThemeSnapshot,
  createThemeVersion
} from "@/src/lib/platform-theme/platform-theme-versions";
import { rollbackThemeVersionToDraft } from "@/src/lib/platform-theme/platform-theme-rollback";
import {
  applyThemePresetToDraft,
  archiveThemePreset,
  createPresetFromCurrentDraft
} from "@/src/lib/platform-theme/platform-theme-presets";

type PlatformThemeAction =
  | "admin_platform_theme_preview"
  | "admin_platform_theme_publish_placeholder"
  | "admin_platform_theme_reset_placeholder"
  | "admin_platform_theme_save_draft"
  | "admin_platform_theme_discard_draft"
  | "admin_platform_theme_publish"
  | "admin_platform_theme_rollback_to_draft"
  | "admin_platform_theme_preset_apply"
  | "admin_platform_theme_preset_create_from_draft"
  | "admin_platform_theme_preset_archive"
  | "admin_platform_theme_favicon_upload"
  | "admin_platform_theme_favicon_remove_draft"
  | "admin_platform_theme_favicon_preview"
  | "admin_platform_theme_logo_upload"
  | "admin_platform_theme_logo_remove_draft"
  | "admin_platform_theme_logo_preview";

function platformThemeRedirect(status: "error" | "success", message: string): never {
  redirect(`/admin/platform-theme?publishStatus=${status}&publishMessage=${encodeURIComponent(message)}`);
}

function platformLogoRedirect(status: "error" | "success", message: string): never {
  redirect(`/admin/platform-theme?logoStatus=${status}&logoMessage=${encodeURIComponent(message)}#platform-logo`);
}

function platformFaviconRedirect(status: "error" | "success", message: string): never {
  redirect(`/admin/platform-theme?faviconStatus=${status}&faviconMessage=${encodeURIComponent(message)}#platform-favicon`);
}

function platformRollbackRedirect(status: "error" | "success", message: string, versionNumber?: number): never {
  const params = new URLSearchParams({
    rollbackMessage: message,
    rollbackStatus: status
  });

  if (versionNumber) {
    params.set("rollbackVersion", String(versionNumber));
  }

  redirect(`/admin/platform-theme?${params.toString()}#theme-version-history`);
}

function platformPresetRedirect(status: "error" | "success", message: string): never {
  redirect(`/admin/platform-theme?presetStatus=${status}&presetMessage=${encodeURIComponent(message)}#theme-preset-manager`);
}

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
  await createDraftThemeSnapshot();
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
  redirect("/admin/platform-theme/preview?mode=draft&locale=en");
}

export async function resetPlatformBrandingPlaceholder() {
  await recordPlatformThemeAction("admin_platform_theme_reset_placeholder");
}

export async function publishPlatformBrandingPlaceholder() {
  try {
    const publishedTheme = await publishThemeDraft();
    await createPublishedThemeSnapshot();
    await recordPlatformThemeAction("admin_platform_theme_publish", {
      public_theme_changed: false,
      published_settings: publishedTheme.settings.length,
      store_themes_touched: 0
    });
  } catch (error) {
    await recordPlatformThemeAction("admin_platform_theme_publish_placeholder", {
      error_message: error instanceof Error ? error.message : "Platform theme publish failed.",
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformThemeRedirect("error", error instanceof Error ? error.message : "Platform theme publish failed.");
  }

  platformThemeRedirect("success", "Publish successful.");
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

export async function uploadPlatformLogoAction(formData: FormData) {
  const file = formData.get("platformLogo");

  if (!(file instanceof File)) {
    platformLogoRedirect("error", "Select a PNG, SVG, or WEBP logo to upload.");
  }

  try {
    const result = await uploadPlatformLogo(file);
    await createThemeVersion("asset_uploaded", "Platform logo uploaded");
    await recordPlatformThemeAction("admin_platform_theme_logo_upload", {
      draft_only: true,
      file_name: result.logo.fileName,
      mime_type: result.logo.mimeType,
      public_theme_changed: false,
      size_bytes: result.logo.size,
      storage_bucket: result.logo.storageBucket,
      store_themes_touched: 0
    });
  } catch (error) {
    await recordPlatformThemeAction("admin_platform_theme_logo_upload", {
      error_message: error instanceof Error ? error.message : "Platform logo upload failed.",
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformLogoRedirect("error", error instanceof Error ? error.message : "Platform logo upload failed.");
  }

  platformLogoRedirect("success", "Logo uploaded to draft branding.");
}

export async function removeDraftPlatformLogoAction() {
  try {
    await deleteDraftPlatformLogo();
    await recordPlatformThemeAction("admin_platform_theme_logo_remove_draft", {
      draft_only: true,
      public_theme_changed: false,
      store_themes_touched: 0
    });
  } catch (error) {
    await recordPlatformThemeAction("admin_platform_theme_logo_remove_draft", {
      error_message: error instanceof Error ? error.message : "Draft platform logo could not be removed.",
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformLogoRedirect("error", error instanceof Error ? error.message : "Draft platform logo could not be removed.");
  }

  platformLogoRedirect("success", "Draft logo removed.");
}

export async function previewPlatformLogoAction() {
  const currentLogo = await getCurrentPlatformLogo();

  await recordPlatformThemeAction("admin_platform_theme_logo_preview", {
    draft_only: true,
    has_logo: Boolean(currentLogo.logo.previewUrl),
    public_theme_changed: false,
    store_themes_touched: 0
  });
  platformLogoRedirect("success", "Logo preview refreshed.");
}

export async function uploadPlatformFaviconAction(formData: FormData) {
  const file = formData.get("platformFavicon");

  if (!(file instanceof File)) {
    platformFaviconRedirect("error", "Select an ICO, PNG, SVG, or WEBP favicon to upload.");
  }

  try {
    const result = await uploadPlatformFavicon(file);
    await createThemeVersion("asset_uploaded", "Platform favicon uploaded");
    await recordPlatformThemeAction("admin_platform_theme_favicon_upload", {
      draft_only: true,
      file_name: result.favicon.fileName,
      mime_type: result.favicon.mimeType,
      public_theme_changed: false,
      size_bytes: result.favicon.size,
      storage_bucket: result.favicon.storageBucket,
      store_themes_touched: 0
    });
  } catch (error) {
    await recordPlatformThemeAction("admin_platform_theme_favicon_upload", {
      error_message: error instanceof Error ? error.message : "Platform favicon upload failed.",
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformFaviconRedirect("error", error instanceof Error ? error.message : "Platform favicon upload failed.");
  }

  platformFaviconRedirect("success", "Favicon uploaded to draft branding.");
}

export async function removeDraftPlatformFaviconAction() {
  try {
    await deleteDraftPlatformFavicon();
    await recordPlatformThemeAction("admin_platform_theme_favicon_remove_draft", {
      draft_only: true,
      public_theme_changed: false,
      store_themes_touched: 0
    });
  } catch (error) {
    await recordPlatformThemeAction("admin_platform_theme_favicon_remove_draft", {
      error_message: error instanceof Error ? error.message : "Draft platform favicon could not be removed.",
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformFaviconRedirect("error", error instanceof Error ? error.message : "Draft platform favicon could not be removed.");
  }

  platformFaviconRedirect("success", "Draft favicon removed.");
}

export async function previewPlatformFaviconAction() {
  const currentFavicon = await getCurrentPlatformFavicon();

  await recordPlatformThemeAction("admin_platform_theme_favicon_preview", {
    draft_only: true,
    has_favicon: Boolean(currentFavicon.favicon.previewUrl),
    public_theme_changed: false,
    store_themes_touched: 0
  });
  platformFaviconRedirect("success", "Favicon preview refreshed.");
}

export async function rollbackThemeVersionToDraftAction(formData: FormData) {
  const versionId = formData.get("versionId");

  if (typeof versionId !== "string" || !versionId.trim()) {
    platformRollbackRedirect("error", "Theme version id is required for rollback.");
  }

  try {
    const result = await rollbackThemeVersionToDraft(versionId);
    await recordPlatformThemeAction("admin_platform_theme_rollback_to_draft", {
      draft_only: true,
      public_theme_changed: false,
      restored_settings: result.restoredSettingCount,
      rollback_version_number: result.rollbackVersionNumber,
      source_version_number: result.sourceVersionNumber,
      store_themes_touched: 0
    });
    platformRollbackRedirect(
      "success",
      `Draft restored from version #${result.sourceVersionNumber}. Publish Branding required to make it live.`,
      result.sourceVersionNumber
    );
  } catch (error) {
    await recordPlatformThemeAction("admin_platform_theme_rollback_to_draft", {
      draft_only: true,
      error_message: error instanceof Error ? error.message : "Theme rollback failed.",
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformRollbackRedirect("error", error instanceof Error ? error.message : "Theme rollback failed.");
  }
}

export async function applyThemePresetToDraftAction(formData: FormData) {
  const presetKey = formData.get("presetKey");

  if (typeof presetKey !== "string" || !presetKey.trim()) {
    platformPresetRedirect("error", "Preset key is required.");
  }

  try {
    const result = await applyThemePresetToDraft(presetKey);
    await recordPlatformThemeAction("admin_platform_theme_preset_apply", {
      applied_settings: result.appliedSettingCount,
      draft_only: true,
      preset_key: result.presetKey,
      preset_name: result.presetName,
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformPresetRedirect(
      "success",
      `Preset "${result.presetName}" applied to draft. Publish Branding required to make it live.`
    );
  } catch (error) {
    await recordPlatformThemeAction("admin_platform_theme_preset_apply", {
      draft_only: true,
      error_message: error instanceof Error ? error.message : "Preset apply failed.",
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformPresetRedirect("error", error instanceof Error ? error.message : "Preset apply failed.");
  }
}

export async function createPresetFromCurrentDraftAction(formData: FormData) {
  const name = formData.get("presetName");
  const presetKey = formData.get("presetKey");
  const description = formData.get("presetDescription");

  if (typeof name !== "string" || !name.trim()) {
    platformPresetRedirect("error", "Preset name is required.");
  }

  if (typeof presetKey !== "string" || !presetKey.trim()) {
    platformPresetRedirect("error", "Preset key is required.");
  }

  try {
    const preset = await createPresetFromCurrentDraft({
      description: typeof description === "string" ? description : null,
      name: name.trim(),
      presetKey: presetKey.trim()
    });
    await recordPlatformThemeAction("admin_platform_theme_preset_create_from_draft", {
      draft_only: true,
      preset_key: preset.presetKey,
      preset_name: preset.name,
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformPresetRedirect("success", `Preset "${preset.name}" created from current draft.`);
  } catch (error) {
    await recordPlatformThemeAction("admin_platform_theme_preset_create_from_draft", {
      draft_only: true,
      error_message: error instanceof Error ? error.message : "Preset creation failed.",
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformPresetRedirect("error", error instanceof Error ? error.message : "Preset creation failed.");
  }
}

export async function archiveThemePresetAction(formData: FormData) {
  const presetId = formData.get("presetId");

  if (typeof presetId !== "string" || !presetId.trim()) {
    platformPresetRedirect("error", "Preset id is required.");
  }

  try {
    const preset = await archiveThemePreset(presetId);
    await recordPlatformThemeAction("admin_platform_theme_preset_archive", {
      draft_only: true,
      preset_key: preset.presetKey,
      preset_name: preset.name,
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformPresetRedirect("success", `Preset "${preset.name}" archived.`);
  } catch (error) {
    await recordPlatformThemeAction("admin_platform_theme_preset_archive", {
      draft_only: true,
      error_message: error instanceof Error ? error.message : "Preset archive failed.",
      public_theme_changed: false,
      store_themes_touched: 0
    });
    platformPresetRedirect("error", error instanceof Error ? error.message : "Preset archive failed.");
  }
}
