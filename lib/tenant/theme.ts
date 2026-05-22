import type { StoreTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreThemeRecord = {
  id: string | null;
  store_instance_id: string;
  owner_user_id: string | null;
  theme_id: string;
  theme_key: string;
  layout_key: string;
  typography: {
    body: string;
    heading: string;
    scale: string;
  };
  border_radius: string;
  spacing: "compact" | "comfortable" | "spacious";
  color_palette: {
    accent: string;
    background: string;
    muted: string;
    primary: string;
    secondary: string;
    surface: string;
    text: string;
  };
  logo_config: {
    alt: string | null;
    mode: "image" | "text";
    url: string | null;
  };
  style_config: Record<string, unknown>;
  is_active: boolean;
};

export type StoreThemeTokens = {
  cssVariables: Record<string, string>;
  theme_id: string;
  theme_key: string;
  layout_key: string;
  typography: StoreThemeRecord["typography"];
  borderRadius: string;
  spacing: StoreThemeRecord["spacing"];
  colorPalette: StoreThemeRecord["color_palette"];
  logo: StoreThemeRecord["logo_config"];
  styleConfig: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function cleanColor(value: unknown, fallback: string) {
  const text = textValue(value, fallback);
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ? text : fallback;
}

function defaultTheme(context: StoreTenantContext): StoreThemeRecord {
  return {
    border_radius: "2rem",
    color_palette: {
      accent: "#f59e0b",
      background: "#f8fafc",
      muted: "#64748b",
      primary: context.branding.primaryColor,
      secondary: context.branding.secondaryColor,
      surface: "#ffffff",
      text: "#0f172a"
    },
    id: null,
    is_active: true,
    layout_key: "classic",
    logo_config: {
      alt: context.settings.title,
      mode: "text",
      url: null
    },
    owner_user_id: context.owner_user_id,
    spacing: "comfortable",
    store_instance_id: context.store_instance_id,
    style_config: {},
    theme_id: "shastore-modern",
    theme_key: "modern",
    typography: {
      body: "inter",
      heading: "inter",
      scale: "comfortable"
    }
  };
}

function normalizeTheme(row: unknown, context: StoreTenantContext): StoreThemeRecord {
  const fallback = defaultTheme(context);

  if (!isRecord(row)) {
    return fallback;
  }

  const palette = isRecord(row.color_palette) ? row.color_palette : {};
  const typography = isRecord(row.typography) ? row.typography : {};
  const logo = isRecord(row.logo_config) ? row.logo_config : {};
  const spacing = textValue(row.spacing, fallback.spacing);

  return {
    border_radius: textValue(row.border_radius, fallback.border_radius),
    color_palette: {
      accent: cleanColor(palette.accent, fallback.color_palette.accent),
      background: cleanColor(palette.background, fallback.color_palette.background),
      muted: cleanColor(palette.muted, fallback.color_palette.muted),
      primary: cleanColor(palette.primary, fallback.color_palette.primary),
      secondary: cleanColor(palette.secondary, fallback.color_palette.secondary),
      surface: cleanColor(palette.surface, fallback.color_palette.surface),
      text: cleanColor(palette.text, fallback.color_palette.text)
    },
    id: typeof row.id === "string" ? row.id : null,
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    layout_key: textValue(row.layout_key, fallback.layout_key),
    logo_config: {
      alt: typeof logo.alt === "string" ? logo.alt : fallback.logo_config.alt,
      mode: logo.mode === "image" ? "image" : "text",
      url: typeof logo.url === "string" && logo.url.startsWith("http") ? logo.url : null
    },
    owner_user_id:
      typeof row.owner_user_id === "string" ? row.owner_user_id : fallback.owner_user_id,
    spacing:
      spacing === "compact" || spacing === "spacious" ? spacing : fallback.spacing,
    store_instance_id: context.store_instance_id,
    style_config: isRecord(row.style_config) ? row.style_config : {},
    theme_id: textValue(row.theme_id, fallback.theme_id),
    theme_key: textValue(row.theme_key, fallback.theme_key),
    typography: {
      body: textValue(typography.body, fallback.typography.body),
      heading: textValue(typography.heading, fallback.typography.heading),
      scale: textValue(typography.scale, fallback.typography.scale)
    }
  };
}

export async function getStoreTheme(context: StoreTenantContext): Promise<StoreThemeRecord> {
  const admin = createAdminClient();

  if (!admin) {
    return defaultTheme(context);
  }

  const { data, error } = await admin
    .from("store_themes" as never)
    .select("*")
    .eq("store_instance_id", context.store_instance_id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return defaultTheme(context);
  }

  return normalizeTheme(data, context);
}

export function getStoreLayout(theme: StoreThemeRecord) {
  return {
    key: theme.layout_key,
    preview: theme.layout_key === "editorial" ? "Editorial hero" : "Classic storefront",
    sections: ["announcement", "header", "hero", "catalog", "footer"]
  };
}

export function getBrandingConfig(theme: StoreThemeRecord, context: StoreTenantContext) {
  return {
    colors: theme.color_palette,
    logo: theme.logo_config,
    storeName: context.settings.title,
    typography: theme.typography
  };
}

export function resolveThemeTokens(theme: StoreThemeRecord): StoreThemeTokens {
  const spacingUnit =
    theme.spacing === "compact" ? "0.875rem" : theme.spacing === "spacious" ? "1.25rem" : "1rem";

  return {
    borderRadius: theme.border_radius,
    colorPalette: theme.color_palette,
    cssVariables: {
      "--store-accent": theme.color_palette.accent,
      "--store-background": theme.color_palette.background,
      "--store-border-radius": theme.border_radius,
      "--store-muted": theme.color_palette.muted,
      "--store-primary": theme.color_palette.primary,
      "--store-secondary": theme.color_palette.secondary,
      "--store-spacing": spacingUnit,
      "--store-surface": theme.color_palette.surface,
      "--store-text": theme.color_palette.text
    },
    layout_key: theme.layout_key,
    logo: theme.logo_config,
    spacing: theme.spacing,
    styleConfig: theme.style_config,
    theme_id: theme.theme_id,
    theme_key: theme.theme_key,
    typography: theme.typography
  };
}
