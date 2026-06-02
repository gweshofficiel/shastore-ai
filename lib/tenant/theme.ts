import type { StoreTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStorefrontTemplateConfig } from "@/lib/storefront/theme-registry";

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

export const themeVisualStyleOptions = {
  buttonRadius: ["pill", "rounded", "sharp"],
  cardRadius: ["soft", "rounded", "sharp"],
  footerStyle: ["minimal", "bold", "glass"],
  headerStyle: ["classic", "boutique", "soft", "utility"],
  productCardStyle: ["classic", "lookbook", "spec-card", "glow-card"]
} as const;

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

function pickOption<T extends readonly string[]>(
  value: unknown,
  options: T,
  fallback: string
) {
  return typeof value === "string" && options.includes(value) ? value : fallback;
}

function themeStyleConfig(value: Record<string, unknown>, fallback: Record<string, unknown>) {
  return {
    ...fallback,
    ...value,
    buttonRadius: pickOption(
      value.buttonRadius,
      themeVisualStyleOptions.buttonRadius,
      textValue(fallback.buttonRadius, "pill")
    ),
    cardRadius: pickOption(
      value.cardRadius,
      themeVisualStyleOptions.cardRadius,
      textValue(fallback.cardRadius, "soft")
    ),
    footerStyle: pickOption(
      value.footerStyle,
      themeVisualStyleOptions.footerStyle,
      textValue(fallback.footerStyle, "minimal")
    ),
    headerStyle: pickOption(
      value.headerStyle,
      themeVisualStyleOptions.headerStyle,
      textValue(fallback.headerStyle, "classic")
    ),
    productCardStyle: pickOption(
      value.productCardStyle,
      themeVisualStyleOptions.productCardStyle,
      textValue(fallback.productCardStyle, "classic")
    )
  };
}

function defaultTheme(context: StoreTenantContext): StoreThemeRecord {
  const themeSettings = context.preview.themeSettings;
  const themeConfig = context.preview.themeConfig;
  const brandingConfig = context.preview.brandingConfig;
  const templateConfig = resolveStorefrontTemplateConfig({
    fontStyle: context.preview.fontStyle,
    layoutStyle: context.preview.layoutStyle,
    templateId: context.preview.templateId,
    themeColor: context.preview.themeColor,
    themeSettings
  });
  const colorPalette = isRecord(themeConfig.colorPalette)
    ? themeConfig.colorPalette
    : isRecord(themeConfig.color_palette)
      ? themeConfig.color_palette
      : {};
  const typographyConfig = isRecord(themeConfig.typography) ? themeConfig.typography : {};
  const logoConfig = isRecord(brandingConfig.logo) ? brandingConfig.logo : {};
  const spacing = textValue(themeConfig.spacing, templateConfig.layout.spacing);
  const layoutKey =
    context.preview.layoutStyle || textValue(themeConfig.layout_key, templateConfig.layout.hero);

  return {
    border_radius: textValue(themeConfig.border_radius, templateConfig.key === "electronics-starter" ? "1rem" : "2rem"),
    color_palette: {
      accent: cleanColor(colorPalette.accent, templateConfig.colorPalette.accent),
      background: cleanColor(colorPalette.background, templateConfig.colorPalette.background),
      muted: cleanColor(colorPalette.muted, templateConfig.colorPalette.muted),
      primary: cleanColor(colorPalette.primary, templateConfig.colorPalette.primary),
      secondary: cleanColor(colorPalette.secondary, templateConfig.colorPalette.secondary),
      surface: cleanColor(colorPalette.surface, templateConfig.colorPalette.surface),
      text: cleanColor(colorPalette.text, templateConfig.colorPalette.text)
    },
    id: null,
    is_active: true,
    layout_key: layoutKey,
    logo_config: {
      alt: context.settings.title,
      mode:
        themeSettings.logoUrl || (typeof logoConfig.url === "string" && logoConfig.url.trim())
          ? "image"
          : "text",
      url:
        themeSettings.logoUrl ||
        (typeof logoConfig.url === "string" && logoConfig.url.trim() ? logoConfig.url : null)
    },
    owner_user_id: context.owner_user_id,
    spacing:
      spacing === "compact" || spacing === "spacious" || spacing === "comfortable"
        ? spacing
        : "comfortable",
    store_instance_id: context.store_instance_id,
    style_config: themeStyleConfig(isRecord(themeConfig) ? themeConfig : {}, {
      ...templateConfig,
      buttonRadius: themeSettings.buttonStyle || "pill",
      cardRadius: "soft",
      footerStyle: themeSettings.footerStyle || "minimal",
      headerStyle: templateConfig.layout.navbar,
      productCardStyle: templateConfig.layout.productCard
    }),
    theme_id: `shastore-${templateConfig.key}`,
    theme_key: textValue(themeConfig.theme_key, templateConfig.key),
    typography: {
      body: textValue(typographyConfig.body, templateConfig.typography.body),
      heading: textValue(typographyConfig.heading, templateConfig.typography.heading),
      scale: textValue(typographyConfig.scale, templateConfig.typography.scale)
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
      mode:
        (typeof logo.url === "string" && logo.url.trim().startsWith("http")) ||
        fallback.logo_config.mode === "image"
          ? "image"
          : "text",
      url:
        typeof logo.url === "string" && logo.url.trim().startsWith("http")
          ? logo.url.trim()
          : fallback.logo_config.url
    },
    owner_user_id:
      typeof row.owner_user_id === "string" ? row.owner_user_id : fallback.owner_user_id,
    spacing:
      spacing === "compact" || spacing === "spacious" ? spacing : fallback.spacing,
    store_instance_id: context.store_instance_id,
    style_config: themeStyleConfig(
      isRecord(row.style_config) ? row.style_config : {},
      fallback.style_config
    ),
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

  const baseSelect = admin
    .from("store_themes" as never)
    .select("*")
    .eq("status" as never, "published" as never)
    .eq("is_active" as never, true as never)
    .order("updated_at", { ascending: false })
    .limit(1);
  const byStoreId = await baseSelect.eq("store_id" as never, context.store_instance_id as never).maybeSingle();

  if (byStoreId.data) {
    return normalizeTheme(byStoreId.data, context);
  }

  const byInstanceId = await admin
    .from("store_themes" as never)
    .select("*")
    .eq("status" as never, "published" as never)
    .eq("is_active" as never, true as never)
    .eq("store_instance_id" as never, context.store_instance_id as never)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byInstanceId.error || !byInstanceId.data) {
    return defaultTheme(context);
  }

  return normalizeTheme(byInstanceId.data, context);
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
  const headingFamily =
    theme.typography.heading === "serif"
      ? "Georgia, Cambria, serif"
      : theme.typography.heading === "mono"
        ? "ui-monospace, SFMono-Regular, Menlo, monospace"
        : "Inter, ui-sans-serif, system-ui, sans-serif";
  const bodyFamily =
    theme.typography.body === "serif"
      ? "Georgia, Cambria, serif"
      : theme.typography.body === "mono"
        ? "ui-monospace, SFMono-Regular, Menlo, monospace"
        : "Inter, ui-sans-serif, system-ui, sans-serif";
  const buttonRadius = textValue(theme.style_config.buttonRadius, "pill");
  const cardRadius = textValue(theme.style_config.cardRadius, "soft");
  const buttonRadiusValue =
    buttonRadius === "sharp" ? "0.5rem" : buttonRadius === "rounded" ? "1rem" : "999px";
  const cardRadiusValue =
    cardRadius === "sharp" ? "0.75rem" : cardRadius === "rounded" ? "1.5rem" : theme.border_radius;

  return {
    borderRadius: theme.border_radius,
    colorPalette: theme.color_palette,
    cssVariables: {
      "--store-accent": theme.color_palette.accent,
      "--store-background": theme.color_palette.background,
      "--store-border-radius": theme.border_radius,
      "--store-button-radius": buttonRadiusValue,
      "--store-card-radius": cardRadiusValue,
      "--store-muted": theme.color_palette.muted,
      "--store-primary": theme.color_palette.primary,
      "--store-secondary": theme.color_palette.secondary,
      "--store-spacing": spacingUnit,
      "--store-surface": theme.color_palette.surface,
      "--store-text": theme.color_palette.text,
      "--store-font-body": bodyFamily,
      "--store-font-heading": headingFamily
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
