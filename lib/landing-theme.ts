import type { LandingThemeSettings } from "@/types/landing";

export const defaultLandingThemeSettings: LandingThemeSettings = {
  primaryColor: "#0f172a",
  secondaryColor: "#f8fafc",
  logoUrl: "",
  heroTitle: "",
  ctaText: "Order on WhatsApp",
  footerText: "Powered by SHASTORE AI",
  announcementText: ""
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function clean(value: unknown, fallback: string, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback;
}

function cleanColor(value: unknown, fallback: string) {
  const text = clean(value, fallback, 24);
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}

export function normalizeLandingThemeSettings(value: unknown): LandingThemeSettings {
  const record = asRecord(value);

  return {
    primaryColor: cleanColor(record.primaryColor, defaultLandingThemeSettings.primaryColor),
    secondaryColor: cleanColor(record.secondaryColor, defaultLandingThemeSettings.secondaryColor),
    logoUrl: clean(record.logoUrl, "", 500),
    heroTitle: clean(record.heroTitle, "", 160),
    ctaText: clean(record.ctaText, defaultLandingThemeSettings.ctaText, 80),
    footerText: clean(record.footerText, defaultLandingThemeSettings.footerText, 180),
    announcementText: clean(record.announcementText, "", 180)
  };
}

export function parseLandingThemeSettings(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") {
    return defaultLandingThemeSettings;
  }

  try {
    return normalizeLandingThemeSettings(JSON.parse(value));
  } catch {
    return defaultLandingThemeSettings;
  }
}
