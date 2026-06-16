import "server-only";

import {
  getPublishedPlatformTheme,
  type PublishedPlatformTheme,
  type PublishedPlatformThemeSetting
} from "@/src/lib/platform-theme/public-platform-theme-resolver";

export type AdminPlatformThemeVariables = Record<
  "--admin-platform-accent" | "--admin-platform-font-family" | "--admin-platform-primary" | "--admin-platform-secondary",
  string
>;

export type AdminPlatformBranding = {
  cssVariables: AdminPlatformThemeVariables;
  hasPublishedTheme: boolean;
  logoUrl: string | null;
  publishedSummary: PublishedPlatformThemeSetting[];
};

const fallbackAdminTheme = {
  accentColor: "#2563eb",
  fontFamily: "Inter, system-ui, sans-serif",
  primaryColor: "#0f172a",
  secondaryColor: "#2563eb"
};

export async function getPublishedAdminPlatformTheme() {
  return getPublishedPlatformTheme();
}

export function buildAdminThemeCssVariables(theme: PublishedPlatformTheme): AdminPlatformThemeVariables {
  return {
    "--admin-platform-accent": theme.accentColor ?? fallbackAdminTheme.accentColor,
    "--admin-platform-font-family": theme.typography ?? fallbackAdminTheme.fontFamily,
    "--admin-platform-primary": theme.primaryColor ?? fallbackAdminTheme.primaryColor,
    "--admin-platform-secondary": theme.secondaryColor ?? fallbackAdminTheme.secondaryColor
  };
}

export async function resolveAdminBranding(): Promise<AdminPlatformBranding> {
  const theme = await getPublishedAdminPlatformTheme();

  return {
    cssVariables: buildAdminThemeCssVariables(theme),
    hasPublishedTheme: theme.hasPublishedTheme,
    logoUrl: theme.logoUrl,
    publishedSummary: theme.publishedSummary
  };
}
