import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  listBrandSettings,
  validateBrandSetting,
  type PlatformBrandSettingRecord,
  type PlatformBrandValidationStatus
} from "@/src/lib/platform-theme/platform-brand-settings";
import {
  compareDraftWithPublished,
  getThemeDraft,
  type PlatformThemeDraftComparison
} from "@/src/lib/platform-theme/platform-theme-draft-runtime";
import { markThemeAssetPublished } from "@/src/lib/platform-theme/platform-theme-assets";

export type PlatformThemePublishReadinessItem = {
  key: string;
  label: string;
  message: string;
  ready: boolean;
};

export type PlatformThemePublishValidation = {
  canPublish: boolean;
  checklist: PlatformThemePublishReadinessItem[];
  invalidSettings: Array<{
    message: string;
    settingKey: string;
    status: PlatformBrandValidationStatus;
  }>;
  hasChanges: boolean;
};

export type PublishedPlatformTheme = {
  publishedAt: string | null;
  settings: Array<{
    publishedValue: Record<string, unknown>;
    settingKey: string;
  }>;
};

const requiredColorSettings = new Set(["primary_color", "secondary_color", "accent_color"]);

function isEmpty(value: Record<string, unknown>) {
  return !Object.keys(value).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function readinessLabel(settingKey: string) {
  return settingKey.replaceAll("_", " ");
}

function validationMessage(setting: PlatformBrandSettingRecord, status: PlatformBrandValidationStatus) {
  if (status !== "invalid") return "Draft value is ready for publish.";
  if (setting.settingType === "color") return "Cannot publish: color must be a valid #RRGGBB hex value.";
  if (setting.settingType === "logo" || setting.settingType === "favicon") return "Cannot publish: logo/favicon must be a safe path or http/https URL.";
  if (setting.settingType === "typography") return "Cannot publish: typography must be safe font-stack text.";
  if (setting.settingType === "mode") return "Cannot publish: mode must be light, dark, or placeholder.";
  return "Cannot publish: invalid setting.";
}

function settingReady(setting: PlatformBrandSettingRecord, status: PlatformBrandValidationStatus) {
  if (status === "invalid") return false;
  if (requiredColorSettings.has(setting.settingKey)) return status === "ready";
  if (setting.settingType === "typography") return status === "ready";
  if (setting.settingType === "logo" || setting.settingType === "favicon") return status === "ready" || status === "placeholder";
  if (setting.settingType === "mode") return status === "placeholder" || status === "ready";
  return status === "ready" || status === "placeholder";
}

export async function validateThemeBeforePublish(): Promise<PlatformThemePublishValidation> {
  const [settings, draft] = await Promise.all([
    listBrandSettings(),
    getThemeDraft()
  ]);
  const checklist = settings.map((setting) => {
    const validation = validateBrandSetting(setting.settingKey, setting.draftValue);
    const ready = settingReady(setting, validation.status);

    return {
      key: setting.settingKey,
      label: readinessLabel(setting.settingKey),
      message: validationMessage(setting, validation.status),
      ready
    };
  });
  const invalidSettings = checklist
    .filter((item) => !item.ready)
    .map((item) => ({
      message: item.message,
      settingKey: item.key,
      status: "invalid" as const
    }));

  return {
    canPublish: draft.hasChanges && !invalidSettings.length,
    checklist,
    hasChanges: draft.hasChanges,
    invalidSettings
  };
}

export async function publishThemeDraft() {
  const validation = await validateThemeBeforePublish();

  if (!validation.hasChanges) {
    throw new Error("No draft changes to publish.");
  }

  if (!validation.canPublish) {
    throw new Error(`Cannot publish: invalid setting ${validation.invalidSettings[0]?.settingKey ?? "unknown"}.`);
  }

  const settings = await listBrandSettings();
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform theme publishing.");
  }

  await Promise.all(
    settings.map(async (setting) => {
      const publishValidation = validateBrandSetting(setting.settingKey, setting.draftValue);
      const { error } = await admin
        .from("platform_brand_settings" as never)
        .update({
          published_value: publishValidation.normalizedValue,
          status: "published",
          validation_status: publishValidation.status
        } as never)
        .eq("setting_key" as never, setting.settingKey as never);

      if (error) {
        throw new Error(`Platform theme draft could not be published: ${error.message}`);
      }

      const assetId = isRecord(setting.draftValue) ? text(setting.draftValue.assetId, 120) : "";
      if ((setting.settingKey === "platform_logo" || setting.settingKey === "favicon") && assetId) {
        await markThemeAssetPublished(assetId);
      }
    })
  );

  return getPublishedTheme();
}

export async function getPublishedTheme(): Promise<PublishedPlatformTheme> {
  const settings = await listBrandSettings();
  const publishedAt = settings
    .filter((setting) => !isEmpty(setting.publishedValue))
    .map((setting) => setting.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

  return {
    publishedAt,
    settings: settings.map((setting) => ({
      publishedValue: setting.publishedValue,
      settingKey: setting.settingKey
    }))
  };
}

export async function comparePublishedWithDraft(): Promise<PlatformThemeDraftComparison[]> {
  return compareDraftWithPublished();
}
