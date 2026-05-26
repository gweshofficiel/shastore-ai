import type { StoreThemeSettings } from "@/types/storefront";

export type StorefrontTemplateKey =
  | "fashion-starter"
  | "electronics-starter"
  | "beauty-starter"
  | "general-starter";

export type StorefrontTemplateConfig = {
  key: StorefrontTemplateKey;
  label: string;
  colorPalette: {
    accent: string;
    background: string;
    muted: string;
    primary: string;
    secondary: string;
    surface: string;
    text: string;
  };
  typography: {
    body: string;
    heading: string;
    scale: "compact" | "comfortable" | "large";
  };
  layout: {
    hero: "editorial-split" | "technical-grid" | "soft-stack" | "classic";
    navbar: "boutique" | "utility" | "soft" | "classic";
    productCard: "lookbook" | "spec-card" | "glow-card" | "classic";
    spacing: "compact" | "comfortable" | "spacious";
    mobileDensity: "airy" | "dense" | "balanced";
  };
  sections: {
    heroEyebrow: string;
    productsTitle: string;
    productsDescription: string;
    categoriesTitle: string;
    testimonialsTitle: string;
    faqTitle: string;
    ctaTitle: string;
    ctaBody: string;
  };
};

type ResolveTemplateConfigInput = {
  fontStyle?: string | null;
  layoutStyle?: string | null;
  templateId?: string | null;
  themeColor?: string | null;
  themeSettings?: Partial<StoreThemeSettings> | null;
};

const colorPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const registry: Record<StorefrontTemplateKey, StorefrontTemplateConfig> = {
  "fashion-starter": {
    key: "fashion-starter",
    label: "Fashion Starter",
    colorPalette: {
      accent: "#f43f5e",
      background: "#fff7f3",
      muted: "#8f5f63",
      primary: "#9f1239",
      secondary: "#f97316",
      surface: "#fffaf7",
      text: "#1f1717"
    },
    typography: {
      body: "serif",
      heading: "serif",
      scale: "large"
    },
    layout: {
      hero: "editorial-split",
      mobileDensity: "airy",
      navbar: "boutique",
      productCard: "lookbook",
      spacing: "spacious"
    },
    sections: {
      categoriesTitle: "Curated edits",
      ctaBody: "Style a polished storefront with editorial sections and boutique product cards.",
      ctaTitle: "Launch the latest collection",
      faqTitle: "Boutique questions",
      heroEyebrow: "Fashion collection",
      productsDescription: "Highlight seasonal pieces with large imagery, soft spacing, and premium callouts.",
      productsTitle: "Featured looks",
      testimonialsTitle: "Styled by shoppers"
    }
  },
  "electronics-starter": {
    key: "electronics-starter",
    label: "Electronics Starter",
    colorPalette: {
      accent: "#22d3ee",
      background: "#020617",
      muted: "#94a3b8",
      primary: "#2563eb",
      secondary: "#0f172a",
      surface: "#0b1220",
      text: "#e2e8f0"
    },
    typography: {
      body: "mono",
      heading: "inter",
      scale: "compact"
    },
    layout: {
      hero: "technical-grid",
      mobileDensity: "dense",
      navbar: "utility",
      productCard: "spec-card",
      spacing: "compact"
    },
    sections: {
      categoriesTitle: "Shop by spec",
      ctaBody: "Present smart products with crisp specs, compact cards, and high-contrast conversion areas.",
      ctaTitle: "Build your setup",
      faqTitle: "Tech details",
      heroEyebrow: "Electronics hub",
      productsDescription: "Compact cards keep pricing, categories, and actions easy to compare.",
      productsTitle: "Smart gear",
      testimonialsTitle: "Trusted by builders"
    }
  },
  "beauty-starter": {
    key: "beauty-starter",
    label: "Beauty Starter",
    colorPalette: {
      accent: "#ec4899",
      background: "#fff1f8",
      muted: "#9d5c7a",
      primary: "#db2777",
      secondary: "#f9a8d4",
      surface: "#fff7fb",
      text: "#331527"
    },
    typography: {
      body: "inter",
      heading: "display",
      scale: "comfortable"
    },
    layout: {
      hero: "soft-stack",
      mobileDensity: "balanced",
      navbar: "soft",
      productCard: "glow-card",
      spacing: "comfortable"
    },
    sections: {
      categoriesTitle: "Shop routines",
      ctaBody: "Create a soft, guided shopping flow for routines, bundles, and product benefits.",
      ctaTitle: "Start the glow routine",
      faqTitle: "Routine help",
      heroEyebrow: "Beauty studio",
      productsDescription: "Soft cards and routine-led sections help shoppers choose by goal.",
      productsTitle: "Glow picks",
      testimonialsTitle: "Routine results"
    }
  },
  "general-starter": {
    key: "general-starter",
    label: "General Starter",
    colorPalette: {
      accent: "#f59e0b",
      background: "#f8fafc",
      muted: "#64748b",
      primary: "#0f172a",
      secondary: "#2563eb",
      surface: "#ffffff",
      text: "#0f172a"
    },
    typography: {
      body: "inter",
      heading: "inter",
      scale: "comfortable"
    },
    layout: {
      hero: "classic",
      mobileDensity: "balanced",
      navbar: "classic",
      productCard: "classic",
      spacing: "comfortable"
    },
    sections: {
      categoriesTitle: "Shop categories",
      ctaBody: "Browse the latest products and place your order.",
      ctaTitle: "Ready to shop?",
      faqTitle: "Common questions",
      heroEyebrow: "Public storefront",
      productsDescription: "Real products saved in Store Builder are shown here for this published store.",
      productsTitle: "Featured products",
      testimonialsTitle: "What customers notice"
    }
  }
};

function cleanColor(value: unknown, fallback: string) {
  return typeof value === "string" && colorPattern.test(value) ? value : fallback;
}

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizeStorefrontTemplateKey(value?: string | null): StorefrontTemplateKey {
  if (value === "fashion-starter" || value === "fashion-atelier") {
    return "fashion-starter";
  }

  if (value === "electronics-starter" || value === "electronics-hub") {
    return "electronics-starter";
  }

  if (value === "beauty-starter" || value === "beauty-glow-lab") {
    return "beauty-starter";
  }

  return "general-starter";
}

export function resolveStorefrontTemplateConfig({
  fontStyle,
  layoutStyle,
  templateId,
  themeColor,
  themeSettings
}: ResolveTemplateConfigInput): StorefrontTemplateConfig {
  const key = normalizeStorefrontTemplateKey(templateId);
  const base = registry[key];
  const primary = cleanColor(themeColor, cleanColor(themeSettings?.primaryColor, base.colorPalette.primary));
  const spacing = textValue(layoutStyle, base.layout.spacing);
  const headingFont = textValue(fontStyle, textValue(themeSettings?.headingFont, base.typography.heading));

  return {
    ...base,
    colorPalette: {
      ...base.colorPalette,
      accent: cleanColor(themeSettings?.accentColor, base.colorPalette.accent),
      primary,
      secondary: cleanColor(themeSettings?.secondaryColor, base.colorPalette.secondary)
    },
    layout: {
      ...base.layout,
      spacing:
        spacing === "compact" || spacing === "spacious" || spacing === "comfortable"
          ? spacing
          : base.layout.spacing
    },
    typography: {
      ...base.typography,
      body: textValue(themeSettings?.bodyFont, base.typography.body),
      heading: headingFont,
      scale:
        themeSettings?.fontScale === "compact" || themeSettings?.fontScale === "large"
          ? themeSettings.fontScale
          : base.typography.scale
    }
  };
}
