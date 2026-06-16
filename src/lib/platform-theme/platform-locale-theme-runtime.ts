import "server-only";

import {
  isPlatformLocale,
  type PlatformLocale
} from "@/src/lib/platform-website/platform-translations-runtime";
import {
  buildPlatformDirectionAttributes,
  buildPlatformRtlClassNames,
  getPlatformDirection,
  type PlatformDirection
} from "@/src/lib/platform-theme/platform-rtl-runtime";

export type PlatformLocaleTheme = {
  className: string;
  direction: PlatformDirection;
  fontFamily: string;
  isRtl: boolean;
  lang: PlatformLocale;
  locale: PlatformLocale;
  previewDescription: string;
  previewLabel: string;
};

const localeLabels: Record<PlatformLocale, string> = {
  ar: "Arabic RTL preview",
  en: "English LTR preview",
  fr: "French LTR preview"
};

const localeDescriptions: Record<PlatformLocale, string> = {
  ar: "Arabic uses RTL direction and keeps platform typography isolated from storefronts.",
  en: "English uses LTR direction and base platform typography.",
  fr: "French uses LTR direction and falls back to base platform typography."
};

const localeTypography: Record<PlatformLocale, string> = {
  ar: "var(--platform-font-family)",
  en: "var(--platform-font-family)",
  fr: "var(--platform-font-family)"
};

function safeLocale(locale: string | null | undefined): PlatformLocale {
  return isPlatformLocale(locale) ? locale : "en";
}

export function getPlatformLocaleTypography(locale: string | null | undefined) {
  return localeTypography[safeLocale(locale)];
}

export function getPlatformLocaleTheme(locale: string | null | undefined): PlatformLocaleTheme {
  const resolvedLocale = safeLocale(locale);
  const direction = getPlatformDirection(resolvedLocale);

  return {
    className: buildPlatformRtlClassNames(resolvedLocale),
    direction,
    fontFamily: getPlatformLocaleTypography(resolvedLocale),
    isRtl: direction === "rtl",
    lang: resolvedLocale,
    locale: resolvedLocale,
    previewDescription: localeDescriptions[resolvedLocale],
    previewLabel: localeLabels[resolvedLocale]
  };
}

export function buildPlatformLocaleThemeAttributes(locale: string | null | undefined) {
  const theme = getPlatformLocaleTheme(locale);
  const directionAttributes = buildPlatformDirectionAttributes(theme.locale);

  return {
    className: theme.className,
    dir: directionAttributes.dir,
    lang: directionAttributes.lang
  };
}

export function getPlatformLocalePreviewConfig(locale: string | null | undefined) {
  const theme = getPlatformLocaleTheme(locale);

  return {
    description: theme.previewDescription,
    direction: theme.direction,
    label: theme.previewLabel,
    locale: theme.locale,
    typography: theme.fontFamily
  };
}
