import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultStoreThemeSettings,
  normalizeStoreThemeSettings
} from "@/lib/store-theme";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StoreThemeSettings } from "@/types/storefront";

type ThemeRuntimeStatus = "draft" | "published" | "archived";

type ThemeRuntimeRow = {
  color_palette?: unknown;
  id?: string | null;
  is_active?: boolean | null;
  layout_key?: string | null;
  logo_config?: unknown;
  settings?: unknown;
  status?: ThemeRuntimeStatus | string | null;
  style_config?: unknown;
  theme_key?: string | null;
  typography?: unknown;
};

export type StorefrontThemeRuntime = {
  branding: {
    primaryColor: string;
    secondaryColor: string;
    themeMode: string;
  };
  fontStyle: string;
  layoutSections: unknown[];
  layoutStyle: string;
  logEvents: string[];
  settings: StoreThemeSettings;
  status: ThemeRuntimeStatus;
  themeColor: string;
  themeConfig: Record<string, unknown>;
  themeId: string | null;
  themeKey: string;
};

type ResolveStorefrontThemeRuntimeInput = {
  brandColor?: string | null;
  client: SupabaseClient;
  fallbackSettings?: unknown;
  fontStyle?: string | null;
  layoutStyle?: string | null;
  selectedThemeKey?: string | null;
  storeId: string;
  storeSettings?: unknown;
  themeSettingsRow?: unknown;
  workspaceId?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function colorFromPalette(palette: unknown, key: string) {
  return isRecord(palette) && typeof palette[key] === "string" ? palette[key] : undefined;
}

function themeSettingsFromRow(row: ThemeRuntimeRow | null) {
  if (!row) {
    return {};
  }

  const logo = isRecord(row.logo_config) ? row.logo_config : {};
  const typography = isRecord(row.typography) ? row.typography : {};

  return {
    accentColor: colorFromPalette(row.color_palette, "accent"),
    bodyFont: typography.body,
    gradientFrom: colorFromPalette(row.color_palette, "primary"),
    gradientTo: colorFromPalette(row.color_palette, "secondary"),
    headingFont: typography.heading,
    logoUrl: logo.url,
    primaryColor: colorFromPalette(row.color_palette, "primary"),
    secondaryColor: colorFromPalette(row.color_palette, "secondary")
  };
}

async function loadPublishedThemeRow(client: SupabaseClient, storeId: string) {
  const baseSelect =
    "id, theme_key, status, settings, color_palette, typography, logo_config, style_config, layout_key, is_active";
  const byStoreId = await client
    .from("store_themes" as never)
    .select(baseSelect)
    .eq("store_id" as never, storeId as never)
    .eq("status" as never, "published" as never)
    .eq("is_active" as never, true as never)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byStoreId.data) {
    return { error: byStoreId.error, row: byStoreId.data as ThemeRuntimeRow };
  }

  const byInstanceId = await client
    .from("store_themes" as never)
    .select(baseSelect)
    .eq("store_instance_id" as never, storeId as never)
    .eq("status" as never, "published" as never)
    .eq("is_active" as never, true as never)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    error: byStoreId.error ?? byInstanceId.error,
    row: (byInstanceId.data ?? null) as ThemeRuntimeRow | null
  };
}

async function recordThemeRuntimeLogSafe({
  event,
  message,
  storeId,
  themeKey,
  workspaceId
}: {
  event: string;
  message: string;
  storeId: string;
  themeKey: string;
  workspaceId?: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    console.warn("[theme-runtime]", { event, message, storeId, themeKey });
    return;
  }

  const { error } = await admin.from("theme_runtime_logs" as never).insert({
    event,
    message,
    store_id: storeId,
    theme_key: themeKey,
    workspace_id: workspaceId ?? null
  } as never);

  if (error) {
    console.warn("[theme-runtime] log insert failed", {
      code: error.code,
      event,
      message: error.message,
      storeId,
      themeKey
    });
  }
}

export async function resolveStorefrontThemeRuntime({
  brandColor,
  client,
  fallbackSettings,
  fontStyle,
  layoutStyle,
  selectedThemeKey,
  storeId,
  storeSettings,
  themeSettingsRow,
  workspaceId
}: ResolveStorefrontThemeRuntimeInput): Promise<StorefrontThemeRuntime> {
  const logEvents: string[] = [];
  const selectedKey = textValue(selectedThemeKey, "default");
  const { error, row } = await loadPublishedThemeRow(client, storeId);

  if (error) {
    logEvents.push("theme_query_failed");
    await recordThemeRuntimeLogSafe({
      event: "theme_query_failed",
      message: error.message ?? "Theme runtime query failed; default theme was used.",
      storeId,
      themeKey: selectedKey,
      workspaceId
    });
  } else if (!row) {
    logEvents.push("theme_fallback_default");
  } else if (row.status !== "published" || row.is_active === false) {
    logEvents.push("theme_invalid_status");
    await recordThemeRuntimeLogSafe({
      event: "theme_invalid_status",
      message: `Theme ${row.theme_key ?? selectedKey} is not published; default theme was used.`,
      storeId,
      themeKey: row.theme_key ?? selectedKey,
      workspaceId
    });
  }

  const rowSettings = row && isRecord(row.settings) ? row.settings : {};
  const rowStyleConfig = row && isRecord(row.style_config) ? row.style_config : {};
  const persistedSettings = isRecord(themeSettingsRow) ? themeSettingsRow : {};
  const runtimeSettings = normalizeStoreThemeSettings(
    {
      ...defaultStoreThemeSettings,
      ...(isRecord(fallbackSettings) ? fallbackSettings : {}),
      ...(isRecord(storeSettings) ? storeSettings : {}),
      ...persistedSettings,
      ...themeSettingsFromRow(row),
      ...rowSettings,
      primaryColor:
        rowSettings.primaryColor ??
        colorFromPalette(row?.color_palette, "primary") ??
        persistedSettings.theme_color ??
        brandColor ??
        defaultStoreThemeSettings.primaryColor
    },
    defaultStoreThemeSettings
  );
  const themeConfig = {
    ...rowStyleConfig,
    colorPalette: row?.color_palette ?? {},
    layoutSections: arrayValue(rowSettings.layoutSections),
    typography: row?.typography ?? {}
  };

  return {
    branding: {
      primaryColor: runtimeSettings.primaryColor,
      secondaryColor: runtimeSettings.secondaryColor,
      themeMode: "light"
    },
    fontStyle: textValue(fontStyle, textValue(persistedSettings.font_style, runtimeSettings.headingFont)),
    layoutSections: arrayValue(rowSettings.layoutSections),
    layoutStyle: textValue(row?.layout_key, textValue(layoutStyle, textValue(persistedSettings.layout_style, "classic"))),
    logEvents,
    settings: runtimeSettings,
    status: row?.status === "published" ? "published" : "published",
    themeColor: runtimeSettings.primaryColor,
    themeConfig,
    themeId: row?.id ?? null,
    themeKey: textValue(row?.theme_key, selectedKey)
  };
}
