import "server-only";

import { getAdminAccess } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listBrandSettings,
  type PlatformBrandSettingRecord
} from "@/src/lib/platform-theme/platform-brand-settings";
import {
  buildPlatformLocaleThemeAttributes,
  getPlatformLocalePreviewConfig,
  getPlatformLocaleTheme,
  type PlatformLocaleTheme
} from "@/src/lib/platform-theme/platform-locale-theme-runtime";
import {
  buildPlatformThemeCssVariables,
  type PublishedPlatformTheme
} from "@/src/lib/platform-theme/public-platform-theme-resolver";
import {
  isPlatformLocale,
  type PlatformLocale
} from "@/src/lib/platform-website/platform-translations-runtime";

export type PlatformThemePreviewMode = "draft" | "published";

export type PlatformThemePreview = {
  accentColor: string;
  cssVariables: Record<
    "--platform-accent" | "--platform-font-family" | "--platform-primary" | "--platform-secondary",
    string
  >;
  faviconUrl: string | null;
  hasThemeValues: boolean;
  locale: PlatformLocale;
  localeTheme: PlatformLocaleTheme;
  logoUrl: string | null;
  mode: PlatformThemePreviewMode;
  primaryColor: string;
  secondaryColor: string;
  summary: Array<{ key: string; value: string | null }>;
  typography: string;
};

export type PlatformThemePreviewMetadata = {
  description: string;
  icons?: { icon: Array<{ url: string }> };
  title: string;
};

type ThemeAssetRow = {
  id?: string | null;
  public_url?: string | null;
  status?: string | null;
};

const fallbackTheme = {
  accentColor: "#2563eb",
  fontFamily: "Inter, system-ui, sans-serif",
  primaryColor: "#0f172a",
  secondaryColor: "#2563eb"
};

const fontPattern = /^(inter|system|sans|serif|mono|roboto|poppins|cairo|tajawal|nunito|arial|helvetica|georgia|ui-sans-serif|ui-serif|ui-monospace|[\s,/()-])+$/i;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validHex(value: unknown) {
  const cleaned = text(value, 20);
  return /^#[0-9a-f]{6}$/i.test(cleaned) ? cleaned : null;
}

function validFont(value: unknown) {
  const cleaned = text(value, 240);
  return cleaned && fontPattern.test(cleaned) ? cleaned : null;
}

function safePublicUrl(value: unknown) {
  const cleaned = text(value, 1000);

  if (!cleaned) return null;
  if (cleaned.startsWith("/") && !cleaned.startsWith("//") && !/[<>"'`]/.test(cleaned)) return cleaned;

  try {
    const url = new URL(cleaned);
    return url.protocol === "https:" || url.protocol === "http:" ? cleaned : null;
  } catch {
    return null;
  }
}

function safeLocale(locale: string | null | undefined): PlatformLocale {
  return isPlatformLocale(locale) ? locale : "en";
}

function safeMode(mode: string | null | undefined): PlatformThemePreviewMode {
  return mode === "published" ? "published" : "draft";
}

function settingValue(setting: PlatformBrandSettingRecord | undefined, mode: PlatformThemePreviewMode) {
  const value = mode === "published" ? setting?.publishedValue : setting?.draftValue;
  return isRecord(value) ? value : {};
}

function assetIdFrom(value: Record<string, unknown>) {
  return text(value.assetId, 120);
}

async function requireSuperAdmin() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Super Admin access is required for platform theme preview.");
  }

  return access;
}

async function assetBackedUrl(value: Record<string, unknown>, mode: PlatformThemePreviewMode) {
  const assetId = assetIdFrom(value);
  const directUrl = safePublicUrl(value.url ?? value.path);

  if (!assetId) return directUrl;

  const admin = createAdminClient();
  if (!admin) return directUrl;

  const { data, error } = await admin
    .from("platform_theme_assets" as never)
    .select("id, public_url, status")
    .eq("id" as never, assetId as never)
    .maybeSingle();

  if (error) return directUrl;

  const asset = data as ThemeAssetRow | null;
  const assetStatus = text(asset?.status, 40);

  if (mode === "published" && assetStatus !== "published") {
    return directUrl;
  }

  if (mode === "draft" && assetStatus === "deleted") {
    return directUrl;
  }

  return safePublicUrl(asset?.public_url) ?? directUrl;
}

async function resolveThemePreview(mode: PlatformThemePreviewMode, locale: string | null | undefined): Promise<PlatformThemePreview> {
  await requireSuperAdmin();

  const resolvedLocale = safeLocale(locale);
  const settings = await listBrandSettings();
  const settingsByKey = new Map(settings.map((setting) => [setting.settingKey, setting]));
  const primaryValue = settingValue(settingsByKey.get("primary_color"), mode);
  const secondaryValue = settingValue(settingsByKey.get("secondary_color"), mode);
  const accentValue = settingValue(settingsByKey.get("accent_color"), mode);
  const typographyValue = settingValue(settingsByKey.get("typography"), mode);
  const logoValue = settingValue(settingsByKey.get("platform_logo"), mode);
  const faviconValue = settingValue(settingsByKey.get("favicon"), mode);
  const primaryColor = validHex(primaryValue.hex) ?? fallbackTheme.primaryColor;
  const secondaryColor = validHex(secondaryValue.hex) ?? fallbackTheme.secondaryColor;
  const accentColor = validHex(accentValue.hex) ?? fallbackTheme.accentColor;
  const typography = validFont(typographyValue.stack) ?? fallbackTheme.fontFamily;
  const [logoUrl, faviconUrl] = await Promise.all([
    assetBackedUrl(logoValue, mode),
    assetBackedUrl(faviconValue, mode)
  ]);
  const summary = [
    { key: "primary_color", value: primaryColor },
    { key: "secondary_color", value: secondaryColor },
    { key: "accent_color", value: accentColor },
    { key: "typography", value: typography },
    { key: "platform_logo", value: logoUrl ? "Logo available" : null },
    { key: "favicon", value: faviconUrl ? "Favicon available" : null }
  ];
  const themeForCss: PublishedPlatformTheme = {
    accentColor,
    faviconUrl,
    hasPublishedTheme: summary.some((item) => Boolean(item.value)),
    logoUrl,
    primaryColor,
    publishedSummary: summary.map((item) => ({ key: item.key, value: item.value })),
    secondaryColor,
    typography
  };
  const localeTheme = getPlatformLocaleTheme(resolvedLocale);

  return {
    accentColor,
    cssVariables: buildPlatformThemeCssVariables(themeForCss),
    faviconUrl,
    hasThemeValues: summary.some((item) => Boolean(item.value)),
    locale: resolvedLocale,
    localeTheme,
    logoUrl,
    mode,
    primaryColor,
    secondaryColor,
    summary,
    typography
  };
}

export async function getThemeDraftPreview(locale?: string | null) {
  return resolveThemePreview("draft", locale);
}

export async function getPublishedThemePreview(locale?: string | null) {
  return resolveThemePreview("published", locale);
}

export async function buildThemePreviewCssVariables(mode: string | null | undefined, locale?: string | null) {
  const preview = await resolveThemePreview(safeMode(mode), locale);
  const localeTheme = getPlatformLocaleTheme(preview.locale);

  return {
    ...preview.cssVariables,
    fontFamily: localeTheme.fontFamily === "var(--platform-font-family)"
      ? preview.cssVariables["--platform-font-family"]
      : localeTheme.fontFamily
  };
}

export async function buildThemePreviewMetadata(
  mode: string | null | undefined,
  locale?: string | null
): Promise<PlatformThemePreviewMetadata> {
  const preview = await resolveThemePreview(safeMode(mode), locale);
  const localeConfig = getPlatformLocalePreviewConfig(preview.locale);
  const modeLabel = preview.mode === "draft" ? "Draft" : "Published";

  return {
    description: `${modeLabel} platform theme preview for ${localeConfig.label}. Admin-only. Does not change public website or storefronts.`,
    icons: preview.faviconUrl ? { icon: [{ url: preview.faviconUrl }] } : undefined,
    title: `Platform Theme ${modeLabel} Preview (${preview.locale.toUpperCase()})`
  };
}

export function buildThemePreviewDirectionAttributes(locale: string | null | undefined) {
  return buildPlatformLocaleThemeAttributes(locale);
}
