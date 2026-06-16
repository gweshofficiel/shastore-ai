import "server-only";

export type {
  PlatformThemeBranding as PlatformBranding,
  PublishedPlatformTheme,
  PublishedPlatformThemeSetting
} from "@/src/lib/platform-theme/platform-theme-runtime";

export {
  buildPlatformThemeCssVariables,
  getPlatformThemeBranding as resolvePlatformBranding,
  getPublishedPlatformTheme
} from "@/src/lib/platform-theme/platform-theme-runtime";
