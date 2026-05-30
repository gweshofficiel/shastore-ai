export type StoreThemePresetKey = "default" | "modern" | "clean" | "fashion";

export type StoreThemePreset = {
  accentColor: string;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  headingFont: "inter" | "serif" | "display" | "mono";
  layoutKey: string;
  name: string;
  previewClassName: string;
  primaryColor: string;
  secondaryColor: string;
  themeKey: StoreThemePresetKey;
};

export const storeThemePresets: StoreThemePreset[] = [
  {
    accentColor: "#f59e0b",
    description: "Stable default storefront with balanced product cards and broad category support.",
    gradientFrom: "#0f172a",
    gradientTo: "#334155",
    headingFont: "inter",
    layoutKey: "classic",
    name: "Default Theme",
    previewClassName: "from-slate-950 via-slate-700 to-amber-400",
    primaryColor: "#0f172a",
    secondaryColor: "#64748b",
    themeKey: "default"
  },
  {
    accentColor: "#22d3ee",
    description: "Modern high-contrast storefront for polished launches and strong calls to action.",
    gradientFrom: "#111827",
    gradientTo: "#2563eb",
    headingFont: "inter",
    layoutKey: "modern",
    name: "Modern Theme",
    previewClassName: "from-slate-950 via-blue-700 to-cyan-300",
    primaryColor: "#111827",
    secondaryColor: "#2563eb",
    themeKey: "modern"
  },
  {
    accentColor: "#10b981",
    description: "Clean light storefront with soft surfaces and simple product browsing.",
    gradientFrom: "#f8fafc",
    gradientTo: "#dbeafe",
    headingFont: "inter",
    layoutKey: "clean",
    name: "Clean Theme",
    previewClassName: "from-white via-slate-100 to-emerald-200",
    primaryColor: "#0f172a",
    secondaryColor: "#94a3b8",
    themeKey: "clean"
  },
  {
    accentColor: "#f43f5e",
    description: "Editorial storefront for collections, fashion products, and premium visual merchandising.",
    gradientFrom: "#9f1239",
    gradientTo: "#f97316",
    headingFont: "serif",
    layoutKey: "fashion",
    name: "Fashion Theme",
    previewClassName: "from-rose-900 via-rose-500 to-orange-300",
    primaryColor: "#9f1239",
    secondaryColor: "#f97316",
    themeKey: "fashion"
  }
];

export function getStoreThemePreset(themeKey: string | null | undefined) {
  return storeThemePresets.find((preset) => preset.themeKey === themeKey) ?? storeThemePresets[0];
}

export function themePresetPayload(preset: StoreThemePreset) {
  return {
    color_palette: {
      accent: preset.accentColor,
      background: preset.themeKey === "clean" ? "#f8fafc" : "#f8fafc",
      muted: "#64748b",
      primary: preset.primaryColor,
      secondary: preset.secondaryColor,
      surface: "#ffffff",
      text: "#0f172a"
    },
    layout_key: preset.layoutKey,
    settings: {
      accentColor: preset.accentColor,
      gradientFrom: preset.gradientFrom,
      gradientTo: preset.gradientTo,
      headingFont: preset.headingFont,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor
    },
    style_config: {
      layoutSections: [],
      preset: preset.themeKey
    },
    typography: {
      body: "inter",
      heading: preset.headingFont,
      scale: preset.themeKey === "fashion" ? "large" : "comfortable"
    }
  };
}
