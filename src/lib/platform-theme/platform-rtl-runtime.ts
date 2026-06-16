import "server-only";

import {
  isPlatformLocale,
  type PlatformLocale
} from "@/src/lib/platform-website/platform-translations-runtime";

export type PlatformDirection = "ltr" | "rtl";

const rtlLocales = new Set<PlatformLocale>(["ar"]);

export function isPlatformRtlLocale(locale: string | null | undefined) {
  return isPlatformLocale(locale) && rtlLocales.has(locale);
}

export function getPlatformDirection(locale: string | null | undefined): PlatformDirection {
  return isPlatformRtlLocale(locale) ? "rtl" : "ltr";
}

export function buildPlatformDirectionAttributes(locale: string | null | undefined) {
  const safeLocale = isPlatformLocale(locale) ? locale : "en";

  return {
    dir: getPlatformDirection(safeLocale),
    lang: safeLocale
  };
}

export function buildPlatformRtlClassNames(locale: string | null | undefined) {
  return isPlatformRtlLocale(locale)
    ? "platform-rtl text-right rtl"
    : "platform-ltr text-left ltr";
}
