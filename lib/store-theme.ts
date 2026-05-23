import type { StoreThemeSettings } from "@/types/storefront";

const colorPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const defaultStoreThemeSettings: StoreThemeSettings = {
  primaryColor: "#0f172a",
  secondaryColor: "#64748b",
  accentColor: "#f59e0b",
  gradientFrom: "#0f172a",
  gradientTo: "#334155",
  buttonStyle: "pill",
  headingFont: "inter",
  bodyFont: "inter",
  fontScale: "comfortable",
  logoUrl: "",
  navigationStyle: "centered",
  stickyHeader: true,
  announcementText: "",
  bannerImageUrl: "",
  heroTitle: "",
  heroSubtitle: "",
  heroBackground: "gradient",
  ctaText: "Order on WhatsApp",
  ctaStyle: "filled",
  footerStyle: "minimal",
  footerBackgroundColor: "#0f172a",
  footerTextColor: "#ffffff",
  copyrightText: "",
  instagramUrl: "",
  tiktokUrl: "",
  facebookUrl: ""
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim().slice(0, 300);
}

function cleanUrl(value: unknown) {
  const text = cleanText(value, "");
  if (!text) {
    return "";
  }

  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }

  return "";
}

function cleanColor(value: unknown, fallback: string) {
  const text = cleanText(value, fallback);
  return colorPattern.test(text) ? text : fallback;
}

function pick<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

export function normalizeStoreThemeSettings(
  value: unknown,
  fallback: StoreThemeSettings = defaultStoreThemeSettings
): StoreThemeSettings {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    primaryColor: cleanColor(value.primaryColor, fallback.primaryColor),
    secondaryColor: cleanColor(value.secondaryColor, fallback.secondaryColor),
    accentColor: cleanColor(value.accentColor, fallback.accentColor),
    gradientFrom: cleanColor(value.gradientFrom, fallback.gradientFrom),
    gradientTo: cleanColor(value.gradientTo, fallback.gradientTo),
    buttonStyle: pick(value.buttonStyle, ["pill", "rounded", "sharp"], fallback.buttonStyle),
    headingFont: pick(
      value.headingFont,
      ["inter", "serif", "display", "mono"],
      fallback.headingFont
    ),
    bodyFont: pick(value.bodyFont, ["inter", "serif", "display", "mono"], fallback.bodyFont),
    fontScale: pick(value.fontScale, ["compact", "comfortable", "large"], fallback.fontScale),
    logoUrl: cleanUrl(value.logoUrl),
    navigationStyle: pick(
      value.navigationStyle,
      ["centered", "split", "minimal"],
      fallback.navigationStyle
    ),
    stickyHeader:
      typeof value.stickyHeader === "boolean" ? value.stickyHeader : fallback.stickyHeader,
    announcementText: cleanText(value.announcementText),
    bannerImageUrl: cleanUrl(value.bannerImageUrl),
    heroTitle: cleanText(value.heroTitle),
    heroSubtitle: cleanText(value.heroSubtitle),
    heroBackground: pick(
      value.heroBackground,
      ["gradient", "solid", "image", "glass"],
      fallback.heroBackground
    ),
    ctaText: cleanText(value.ctaText, fallback.ctaText),
    ctaStyle: pick(value.ctaStyle, ["filled", "outline", "glass"], fallback.ctaStyle),
    footerStyle: pick(value.footerStyle, ["minimal", "bold", "glass"], fallback.footerStyle),
    footerBackgroundColor: cleanColor(
      value.footerBackgroundColor,
      fallback.footerBackgroundColor
    ),
    footerTextColor: cleanColor(value.footerTextColor, fallback.footerTextColor),
    copyrightText: cleanText(value.copyrightText),
    instagramUrl: cleanUrl(value.instagramUrl),
    tiktokUrl: cleanUrl(value.tiktokUrl),
    facebookUrl: cleanUrl(value.facebookUrl)
  };
}

export function fontClass(font: StoreThemeSettings["headingFont"]) {
  if (font === "serif") {
    return "font-serif";
  }

  if (font === "mono") {
    return "font-mono";
  }

  return "font-sans";
}

export function fontScaleClass(scale: StoreThemeSettings["fontScale"]) {
  if (scale === "compact") {
    return "text-[0.95rem]";
  }

  if (scale === "large") {
    return "text-[1.08rem]";
  }

  return "text-base";
}

export function buttonRadiusClass(style: StoreThemeSettings["buttonStyle"]) {
  if (style === "sharp") {
    return "rounded-lg";
  }

  if (style === "rounded") {
    return "rounded-2xl";
  }

  return "rounded-full";
}
