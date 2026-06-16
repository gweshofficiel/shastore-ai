import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type PublishedPlatformThemeSetting = {
  key: string;
  value: string | null;
};

export type PublishedPlatformTheme = {
  accentColor: string | null;
  faviconUrl: string | null;
  hasPublishedTheme: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  publishedSummary: PublishedPlatformThemeSetting[];
  secondaryColor: string | null;
  typography: string | null;
};

export type PlatformBranding = {
  cssVariables: Record<"--platform-accent" | "--platform-font-family" | "--platform-primary" | "--platform-secondary", string>;
  faviconUrl: string | null;
  hasPublishedTheme: boolean;
  logoUrl: string | null;
  publishedSummary: PublishedPlatformThemeSetting[];
};

type BrandSettingRow = {
  published_value?: unknown;
  setting_key?: string | null;
  status?: string | null;
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

function settingValue(setting: BrandSettingRow | undefined) {
  return isRecord(setting?.published_value) ? setting.published_value : {};
}

function assetIdFrom(value: Record<string, unknown>) {
  return text(value.assetId, 120);
}

async function publishedAssetUrl(assetId: string) {
  const admin = createAdminClient();

  if (!admin || !assetId) return null;

  const { data, error } = await admin
    .from("platform_theme_assets" as never)
    .select("id, public_url, status")
    .eq("id" as never, assetId as never)
    .eq("status" as never, "published" as never)
    .maybeSingle();

  if (error) return null;

  const asset = data as ThemeAssetRow | null;
  return asset?.status === "published" ? safePublicUrl(asset.public_url) : null;
}

async function assetBackedUrl(value: Record<string, unknown>) {
  const assetId = assetIdFrom(value);
  const assetUrl = assetId ? await publishedAssetUrl(assetId) : null;

  return assetUrl ?? safePublicUrl(value.url ?? value.path);
}

export async function getPublishedPlatformTheme(): Promise<PublishedPlatformTheme> {
  const admin = createAdminClient();

  if (!admin) {
    return {
      accentColor: null,
      faviconUrl: null,
      hasPublishedTheme: false,
      logoUrl: null,
      primaryColor: null,
      publishedSummary: [],
      secondaryColor: null,
      typography: null
    };
  }

  const { data, error } = await admin
    .from("platform_brand_settings" as never)
    .select("setting_key, published_value, status")
    .eq("status" as never, "published" as never);

  if (error || !Array.isArray(data)) {
    return {
      accentColor: null,
      faviconUrl: null,
      hasPublishedTheme: false,
      logoUrl: null,
      primaryColor: null,
      publishedSummary: [],
      secondaryColor: null,
      typography: null
    };
  }

  const settings = new Map(
    (data as unknown[])
      .filter(isRecord)
      .map((row) => {
        const value = row as BrandSettingRow;
        return [text(value.setting_key, 120), value] as const;
      })
      .filter(([key]) => Boolean(key))
  );
  const primaryValue = settingValue(settings.get("primary_color"));
  const secondaryValue = settingValue(settings.get("secondary_color"));
  const accentValue = settingValue(settings.get("accent_color"));
  const typographyValue = settingValue(settings.get("typography"));
  const logoValue = settingValue(settings.get("platform_logo"));
  const faviconValue = settingValue(settings.get("favicon"));
  const primaryColor = validHex(primaryValue.hex);
  const secondaryColor = validHex(secondaryValue.hex);
  const accentColor = validHex(accentValue.hex);
  const typography = validFont(typographyValue.stack);
  const [logoUrl, faviconUrl] = await Promise.all([
    assetBackedUrl(logoValue),
    assetBackedUrl(faviconValue)
  ]);
  const publishedSummary = [
    { key: "primary_color", value: primaryColor },
    { key: "secondary_color", value: secondaryColor },
    { key: "accent_color", value: accentColor },
    { key: "typography", value: typography },
    { key: "platform_logo", value: logoUrl ? "Published logo available" : null },
    { key: "favicon", value: faviconUrl ? "Published favicon available" : null }
  ];

  return {
    accentColor,
    faviconUrl,
    hasPublishedTheme: publishedSummary.some((item) => Boolean(item.value)),
    logoUrl,
    primaryColor,
    publishedSummary,
    secondaryColor,
    typography
  };
}

export async function resolvePlatformBranding(): Promise<PlatformBranding> {
  const theme = await getPublishedPlatformTheme();

  return {
    cssVariables: buildPlatformThemeCssVariables(theme),
    faviconUrl: theme.faviconUrl,
    hasPublishedTheme: theme.hasPublishedTheme,
    logoUrl: theme.logoUrl,
    publishedSummary: theme.publishedSummary
  };
}

export function buildPlatformThemeCssVariables(theme: PublishedPlatformTheme) {
  return {
    "--platform-accent": theme.accentColor ?? fallbackTheme.accentColor,
    "--platform-font-family": theme.typography ?? fallbackTheme.fontFamily,
    "--platform-primary": theme.primaryColor ?? fallbackTheme.primaryColor,
    "--platform-secondary": theme.secondaryColor ?? fallbackTheme.secondaryColor
  };
}
