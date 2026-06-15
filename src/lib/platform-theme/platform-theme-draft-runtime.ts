import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  listBrandSettings,
  updateBrandSettingDraft,
  validateBrandSetting,
  type PlatformBrandSettingRecord,
  type PlatformBrandValidationStatus
} from "@/src/lib/platform-theme/platform-brand-settings";

export type PlatformThemeDraftInput = Record<string, string | null | undefined>;

export type PlatformThemeDraftComparison = {
  draftDisplayValue: string;
  hasChanged: boolean;
  publishedDisplayValue: string;
  settingKey: string;
};

export type PlatformThemeDraftSetting = PlatformBrandSettingRecord & {
  draftDisplayValue: string;
  hasChanged: boolean;
  publishedDisplayValue: string;
  validationMessage: string | null;
};

export type PlatformThemeDraft = {
  changedCount: number;
  comparisons: PlatformThemeDraftComparison[];
  hasChanges: boolean;
  lastSavedAt: string | null;
  settings: PlatformThemeDraftSetting[];
  validationErrors: Array<{
    message: string;
    settingKey: string;
    status: PlatformBrandValidationStatus;
  }>;
};

function text(value: unknown, maxLength = 1000) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function valueDisplay(value: Record<string, unknown>) {
  return text(value.value) ||
    text(value.hex) ||
    text(value.path) ||
    text(value.url) ||
    text(value.stack) ||
    text(value.mode) ||
    "Not configured";
}

function isEmptyValue(value: Record<string, unknown>) {
  return !Object.keys(value).length;
}

function validationMessage(setting: PlatformBrandSettingRecord) {
  if (setting.validationStatus !== "invalid") return null;

  if (setting.settingType === "color") return "Use a valid #RRGGBB hex color.";
  if (setting.settingType === "logo" || setting.settingType === "favicon") return "Use a safe relative path or http/https URL.";
  if (setting.settingType === "typography") return "Use safe text from known font stack names.";
  if (setting.settingType === "mode") return "Use light, dark, or placeholder.";

  return "Draft value failed validation.";
}

function decorate(settings: PlatformBrandSettingRecord[]): PlatformThemeDraft {
  const decorated = settings.map((setting) => {
    const draftDisplayValue = valueDisplay(setting.draftValue);
    const publishedDisplayValue = isEmptyValue(setting.publishedValue)
      ? "Not published"
      : valueDisplay(setting.publishedValue);
    const hasChanged = JSON.stringify(setting.draftValue) !== JSON.stringify(setting.publishedValue);

    return {
      ...setting,
      draftDisplayValue,
      hasChanged,
      publishedDisplayValue,
      validationMessage: validationMessage(setting)
    };
  });
  const validationErrors = decorated
    .filter((setting) => setting.validationStatus === "invalid")
    .map((setting) => ({
      message: setting.validationMessage ?? "Draft value failed validation.",
      settingKey: setting.settingKey,
      status: setting.validationStatus
    }));
  const lastSavedAt = decorated
    .map((setting) => setting.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

  return {
    changedCount: decorated.filter((setting) => setting.hasChanged).length,
    comparisons: decorated.map((setting) => ({
      draftDisplayValue: setting.draftDisplayValue,
      hasChanged: setting.hasChanged,
      publishedDisplayValue: setting.publishedDisplayValue,
      settingKey: setting.settingKey
    })),
    hasChanges: decorated.some((setting) => setting.hasChanged),
    lastSavedAt,
    settings: decorated,
    validationErrors
  };
}

export async function getThemeDraft() {
  return decorate(await listBrandSettings());
}

export function validateThemeDraft(input: PlatformThemeDraftInput) {
  return Object.fromEntries(
    Object.entries(input).map(([settingKey, value]) => [
      settingKey,
      validateBrandSetting(settingKey, { value: value ?? "" })
    ])
  );
}

export async function updateThemeDraft(input: PlatformThemeDraftInput) {
  const updates = await Promise.all(
    Object.entries(input).map(([settingKey, value]) =>
      updateBrandSettingDraft(settingKey, { value: value ?? "" })
    )
  );

  return decorate(updates.filter((setting): setting is PlatformBrandSettingRecord => Boolean(setting)));
}

export async function compareDraftWithPublished() {
  return (await getThemeDraft()).comparisons;
}

export async function discardThemeDraft() {
  const settings = await listBrandSettings();
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for platform theme draft runtime.");
  }

  await Promise.all(
    settings.map(async (setting) => {
      const publishedValue = setting.publishedValue;
      const validationStatus: PlatformBrandValidationStatus = isEmptyValue(publishedValue)
        ? "placeholder"
        : validateBrandSetting(setting.settingKey, publishedValue).status;
      const { error } = await admin
        .from("platform_brand_settings" as never)
        .update({
          draft_value: publishedValue,
          status: "draft",
          validation_status: validationStatus
        } as never)
        .eq("setting_key" as never, setting.settingKey as never);

      if (error) {
        throw new Error(`Platform theme draft could not be discarded: ${error.message}`);
      }
    })
  );

  return getThemeDraft();
}
