import type { VisualAssetSlot } from "@/lib/storefront/visual-assets";

export type TemplateIndustry =
  | "multi-purpose"
  | "fashion"
  | "electronics"
  | "beauty"
  | "furniture"
  | "jewelry"
  | "sports"
  | "automotive"
  | "kids";

export type TemplateVisualProfile = {
  accentColor: string;
  categoryCardStyle: "icon-led" | "image-led" | "standard";
  heroMood: string;
  productCardStyle: string;
  productImageTreatment: string;
};

export type TemplateGenerationHooks = {
  bannerPromptKey: string;
  categoryPromptKey: string;
  demoProductPromptKey: string;
  marketingPromptKey: string;
};

export type TemplateBlueprint = {
  aiGenerationHooks: TemplateGenerationHooks;
  category: {
    description: string;
    key: TemplateIndustry;
    name: string;
    sortOrder: number;
  };
  defaultThemeSettings: Record<string, unknown>;
  id: TemplateIndustry;
  inheritedRuntimeSlots: string[];
  industry: TemplateIndustry;
  name: string;
  packageVersion: number;
  previewGradient: string;
  previewSummary: string;
  recommendedAudience: string[];
  runtimeSectionOrder: string[];
  style: string;
  templateIds: string[];
  visualAssetSlots: VisualAssetSlot[];
  visualProfile: TemplateVisualProfile;
};

/** Shared storefront capabilities every blueprint inherits from the runtime engine. */
export const inheritedStorefrontRuntimeSlots = [
  "hero",
  "categories",
  "product_grid",
  "pdp",
  "reviews",
  "faq",
  "blog",
  "marketing_blocks",
  "trust_blocks",
  "announcement_system"
] as const;

export const sharedTemplateRuntimeSectionOrder = [
  "navbar",
  "announcement_bar",
  "hero",
  "promotion_strips",
  "trust_badges",
  "featured_categories",
  "featured_products",
  "testimonials",
  "blog_preview",
  "faq_preview",
  "conversion_blocks",
  "newsletter",
  "footer"
] as const;

export const sharedTemplateVisualAssetSlots: VisualAssetSlot[] = [
  "product.primary",
  "product.gallery",
  "product.fallback",
  "product.comingSoon",
  "category.icon",
  "category.image",
  "category.banner",
  "hero.desktop",
  "hero.mobile",
  "hero.ctaOverlay",
  "marketing.flashSale",
  "marketing.seasonalSale",
  "marketing.collection",
  "marketing.announcement"
];

const flagshipRuntimeSectionOrder = [
  "navbar",
  "announcement_bar",
  "hero",
  "promotion_strips",
  "trust_badges",
  "featured_categories",
  "featured_products",
  "flash_deals",
  "new_arrivals",
  "best_sellers",
  "brands",
  "testimonials",
  "blog_preview",
  "faq_preview",
  "conversion_blocks",
  "newsletter",
  "footer"
] as const;

function blueprint(partial: Omit<TemplateBlueprint, "visualAssetSlots"> & Partial<Pick<TemplateBlueprint, "visualAssetSlots">>): TemplateBlueprint {
  return {
    ...partial,
    visualAssetSlots: partial.visualAssetSlots ?? [...sharedTemplateVisualAssetSlots]
  };
}

export const templateBlueprintRegistry: TemplateBlueprint[] = [
  blueprint({
    aiGenerationHooks: {
      bannerPromptKey: "multi-purpose-premium-banner",
      categoryPromptKey: "multi-purpose-category-set",
      demoProductPromptKey: "multi-purpose-demo-products",
      marketingPromptKey: "multi-purpose-marketing-blocks"
    },
    category: {
      description: "Ready-to-use storefront packages for many store types.",
      key: "multi-purpose",
      name: "Multi-purpose",
      sortOrder: 5
    },
    defaultThemeSettings: {
      buttonStyle: "pill",
      colorPresets: ["slate", "blue", "gold", "white"],
      fontStyle: "display",
      layoutStyle: "spacious",
      navigationStyle: "mega"
    },
    id: "multi-purpose",
    industry: "multi-purpose",
    inheritedRuntimeSlots: [...inheritedStorefrontRuntimeSlots],
    name: "Multi-purpose Blueprint",
    packageVersion: 1,
    previewGradient: "linear-gradient(135deg,#020617,#1d4ed8 52%,#d4af37)",
    previewSummary: "Premium reference blueprint for complete ecommerce storefront packages.",
    recommendedAudience: ["new sellers", "multi-category stores", "premium commerce launches"],
    runtimeSectionOrder: [...flagshipRuntimeSectionOrder],
    style: "premium editorial",
    templateIds: ["shastore-flagship-premium"],
    visualProfile: {
      accentColor: "#d4af37",
      categoryCardStyle: "icon-led",
      heroMood: "premium glass commerce",
      productCardStyle: "editorial commerce card",
      productImageTreatment: "premium visual fallback"
    }
  }),
  blueprint({
    aiGenerationHooks: {
      bannerPromptKey: "fashion-editorial-banner",
      categoryPromptKey: "fashion-category-set",
      demoProductPromptKey: "fashion-demo-products",
      marketingPromptKey: "fashion-marketing-blocks"
    },
    category: {
      description: "Boutique apparel, seasonal edits, and editorial merchandising.",
      key: "fashion",
      name: "Fashion",
      sortOrder: 10
    },
    defaultThemeSettings: {
      colorPresets: ["rose", "cream", "black"],
      fontStyle: "serif",
      layoutStyle: "editorial",
      navigationStyle: "boutique"
    },
    id: "fashion",
    industry: "fashion",
    inheritedRuntimeSlots: [...inheritedStorefrontRuntimeSlots],
    name: "Fashion Blueprint",
    packageVersion: 1,
    previewGradient: "linear-gradient(135deg,#fff7ed,#f43f5e 55%,#111827)",
    previewSummary: "Editorial fashion storefront blueprint for collections, lookbooks, and seasonal drops.",
    recommendedAudience: ["boutiques", "apparel brands", "seasonal fashion drops"],
    runtimeSectionOrder: [...sharedTemplateRuntimeSectionOrder],
    style: "editorial boutique",
    templateIds: ["fashion-starter", "shastore-fashion", "fashion-editorial"],
    visualProfile: {
      accentColor: "#f43f5e",
      categoryCardStyle: "image-led",
      heroMood: "editorial lookbook",
      productCardStyle: "lookbook card",
      productImageTreatment: "large lifestyle crop"
    }
  }),
  blueprint({
    aiGenerationHooks: {
      bannerPromptKey: "electronics-technical-banner",
      categoryPromptKey: "electronics-category-set",
      demoProductPromptKey: "electronics-demo-products",
      marketingPromptKey: "electronics-marketing-blocks"
    },
    category: {
      description: "Gadgets, smart bundles, product comparisons, and specs.",
      key: "electronics",
      name: "Electronics",
      sortOrder: 20
    },
    defaultThemeSettings: {
      colorPresets: ["blue", "cyan", "slate"],
      fontStyle: "modern",
      layoutStyle: "technical",
      navigationStyle: "utility"
    },
    id: "electronics",
    industry: "electronics",
    inheritedRuntimeSlots: [...inheritedStorefrontRuntimeSlots],
    name: "Electronics Blueprint",
    packageVersion: 1,
    previewGradient: "linear-gradient(135deg,#020617,#2563eb 55%,#22d3ee)",
    previewSummary: "Technical commerce blueprint for specs, bundles, and high-comparison product grids.",
    recommendedAudience: ["gadget shops", "electronics retailers", "smart device brands"],
    runtimeSectionOrder: [...sharedTemplateRuntimeSectionOrder],
    style: "technical grid",
    templateIds: ["electronics-starter", "shastore-electronics", "gadget-neon"],
    visualProfile: {
      accentColor: "#22d3ee",
      categoryCardStyle: "standard",
      heroMood: "high contrast technical",
      productCardStyle: "spec card",
      productImageTreatment: "clean product silhouette"
    }
  }),
  blueprint({
    aiGenerationHooks: {
      bannerPromptKey: "beauty-soft-banner",
      categoryPromptKey: "beauty-category-set",
      demoProductPromptKey: "beauty-demo-products",
      marketingPromptKey: "beauty-marketing-blocks"
    },
    category: {
      description: "Skincare, cosmetics, fragrance routines, and self-care.",
      key: "beauty",
      name: "Beauty",
      sortOrder: 30
    },
    defaultThemeSettings: {
      colorPresets: ["pink", "rose", "cream"],
      fontStyle: "display",
      layoutStyle: "soft",
      navigationStyle: "soft"
    },
    id: "beauty",
    industry: "beauty",
    inheritedRuntimeSlots: [...inheritedStorefrontRuntimeSlots],
    name: "Beauty Blueprint",
    packageVersion: 1,
    previewGradient: "linear-gradient(135deg,#fff1f8,#ec4899 55%,#7c2d12)",
    previewSummary: "Soft conversion blueprint for beauty routines, bundles, and product benefits.",
    recommendedAudience: ["beauty shops", "skincare brands", "fragrance stores"],
    runtimeSectionOrder: [...sharedTemplateRuntimeSectionOrder],
    style: "soft glow",
    templateIds: ["beauty-starter", "shastore-beauty", "beauty-glow"],
    visualProfile: {
      accentColor: "#ec4899",
      categoryCardStyle: "image-led",
      heroMood: "soft routine-led",
      productCardStyle: "glow card",
      productImageTreatment: "soft gradient surface"
    }
  }),
  blueprint({
    aiGenerationHooks: {
      bannerPromptKey: "furniture-lifestyle-banner",
      categoryPromptKey: "furniture-category-set",
      demoProductPromptKey: "furniture-demo-products",
      marketingPromptKey: "furniture-marketing-blocks"
    },
    category: {
      description: "Home furniture, room collections, and lifestyle merchandising.",
      key: "furniture",
      name: "Furniture",
      sortOrder: 40
    },
    defaultThemeSettings: {
      colorPresets: ["stone", "wood", "linen"],
      fontStyle: "modern",
      layoutStyle: "spacious",
      navigationStyle: "catalog"
    },
    id: "furniture",
    industry: "furniture",
    inheritedRuntimeSlots: [...inheritedStorefrontRuntimeSlots],
    name: "Furniture Blueprint",
    packageVersion: 1,
    previewGradient: "linear-gradient(135deg,#faf7f0,#a16207 55%,#292524)",
    previewSummary: "Room-led storefront blueprint for furniture collections and home lifestyle shopping.",
    recommendedAudience: ["furniture stores", "home decor brands", "interior retailers"],
    runtimeSectionOrder: [...sharedTemplateRuntimeSectionOrder],
    style: "warm lifestyle",
    templateIds: ["shastore-furniture"],
    visualProfile: {
      accentColor: "#a16207",
      categoryCardStyle: "image-led",
      heroMood: "warm room scene",
      productCardStyle: "room card",
      productImageTreatment: "lifestyle room crop"
    }
  }),
  blueprint({
    aiGenerationHooks: {
      bannerPromptKey: "jewelry-luxury-banner",
      categoryPromptKey: "jewelry-category-set",
      demoProductPromptKey: "jewelry-demo-products",
      marketingPromptKey: "jewelry-marketing-blocks"
    },
    category: {
      description: "Fine jewelry, watches, gifting, and luxury accessories.",
      key: "jewelry",
      name: "Jewelry",
      sortOrder: 50
    },
    defaultThemeSettings: {
      colorPresets: ["black", "gold", "ivory"],
      fontStyle: "display",
      layoutStyle: "luxury",
      navigationStyle: "premium"
    },
    id: "jewelry",
    industry: "jewelry",
    inheritedRuntimeSlots: [...inheritedStorefrontRuntimeSlots],
    name: "Jewelry Blueprint",
    packageVersion: 1,
    previewGradient: "linear-gradient(135deg,#09090b,#ca8a04 52%,#fef3c7)",
    previewSummary: "Luxury jewelry blueprint for gifting, collections, and premium product presentation.",
    recommendedAudience: ["jewelry stores", "watch brands", "luxury gift retailers"],
    runtimeSectionOrder: [...sharedTemplateRuntimeSectionOrder],
    style: "luxury gifting",
    templateIds: ["shastore-jewelry"],
    visualProfile: {
      accentColor: "#ca8a04",
      categoryCardStyle: "icon-led",
      heroMood: "luxury gifting",
      productCardStyle: "fine jewelry card",
      productImageTreatment: "premium macro crop"
    }
  }),
  blueprint({
    aiGenerationHooks: {
      bannerPromptKey: "sports-performance-banner",
      categoryPromptKey: "sports-category-set",
      demoProductPromptKey: "sports-demo-products",
      marketingPromptKey: "sports-marketing-blocks"
    },
    category: {
      description: "Athletic gear, training collections, and performance merchandising.",
      key: "sports",
      name: "Sports",
      sortOrder: 55
    },
    defaultThemeSettings: {
      colorPresets: ["green", "black", "white"],
      fontStyle: "modern",
      layoutStyle: "dynamic",
      navigationStyle: "utility"
    },
    id: "sports",
    industry: "sports",
    inheritedRuntimeSlots: [...inheritedStorefrontRuntimeSlots],
    name: "Sports Blueprint",
    packageVersion: 1,
    previewGradient: "linear-gradient(135deg,#052e16,#16a34a 55%,#0f172a)",
    previewSummary: "Performance commerce blueprint for athletic gear, training, and seasonal sport edits.",
    recommendedAudience: ["sports retailers", "fitness brands", "team merchandise stores"],
    runtimeSectionOrder: [...sharedTemplateRuntimeSectionOrder],
    style: "performance dynamic",
    templateIds: ["shastore-sports"],
    visualProfile: {
      accentColor: "#16a34a",
      categoryCardStyle: "image-led",
      heroMood: "high energy performance",
      productCardStyle: "performance card",
      productImageTreatment: "action crop"
    }
  }),
  blueprint({
    aiGenerationHooks: {
      bannerPromptKey: "automotive-parts-banner",
      categoryPromptKey: "automotive-category-set",
      demoProductPromptKey: "automotive-demo-products",
      marketingPromptKey: "automotive-marketing-blocks"
    },
    category: {
      description: "Automotive parts, accessories, and fitment-ready merchandising.",
      key: "automotive",
      name: "Automotive",
      sortOrder: 58
    },
    defaultThemeSettings: {
      colorPresets: ["red", "slate", "silver"],
      fontStyle: "modern",
      layoutStyle: "technical",
      navigationStyle: "utility"
    },
    id: "automotive",
    industry: "automotive",
    inheritedRuntimeSlots: [...inheritedStorefrontRuntimeSlots],
    name: "Automotive Blueprint",
    packageVersion: 1,
    previewGradient: "linear-gradient(135deg,#111827,#dc2626 55%,#94a3b8)",
    previewSummary: "Automotive commerce blueprint for parts discovery, fitment, and accessory merchandising.",
    recommendedAudience: ["auto parts stores", "accessory brands", "service retailers"],
    runtimeSectionOrder: [...sharedTemplateRuntimeSectionOrder],
    style: "technical utility",
    templateIds: ["shastore-automotive"],
    visualProfile: {
      accentColor: "#dc2626",
      categoryCardStyle: "standard",
      heroMood: "technical utility",
      productCardStyle: "parts card",
      productImageTreatment: "clean studio crop"
    }
  }),
  blueprint({
    aiGenerationHooks: {
      bannerPromptKey: "kids-playful-banner",
      categoryPromptKey: "kids-category-set",
      demoProductPromptKey: "kids-demo-products",
      marketingPromptKey: "kids-marketing-blocks"
    },
    category: {
      description: "Kids products, playful collections, and family-friendly shopping.",
      key: "kids",
      name: "Kids",
      sortOrder: 62
    },
    defaultThemeSettings: {
      colorPresets: ["sky", "yellow", "mint"],
      fontStyle: "rounded",
      layoutStyle: "playful",
      navigationStyle: "soft"
    },
    id: "kids",
    industry: "kids",
    inheritedRuntimeSlots: [...inheritedStorefrontRuntimeSlots],
    name: "Kids Blueprint",
    packageVersion: 1,
    previewGradient: "linear-gradient(135deg,#eff6ff,#38bdf8 55%,#facc15)",
    previewSummary: "Family-friendly blueprint for playful kids merchandising and age-group collections.",
    recommendedAudience: ["kids stores", "toy brands", "family lifestyle retailers"],
    runtimeSectionOrder: [...sharedTemplateRuntimeSectionOrder],
    style: "playful family",
    templateIds: ["shastore-kids"],
    visualProfile: {
      accentColor: "#38bdf8",
      categoryCardStyle: "image-led",
      heroMood: "playful family",
      productCardStyle: "playful card",
      productImageTreatment: "bright friendly crop"
    }
  })
];

export function getTemplateBlueprint(industryOrTemplateId?: string | null) {
  const key = typeof industryOrTemplateId === "string" ? industryOrTemplateId.trim() : "";

  if (!key) {
    return templateBlueprintRegistry.find((blueprint) => blueprint.id === "multi-purpose") ?? templateBlueprintRegistry[0];
  }

  return (
    templateBlueprintRegistry.find(
      (blueprint) =>
        blueprint.id === key ||
        blueprint.industry === key ||
        blueprint.templateIds.includes(key) ||
        blueprint.category.key === key
    ) ?? templateBlueprintRegistry.find((blueprint) => blueprint.id === "multi-purpose") ??
    templateBlueprintRegistry[0]
  );
}

export function getTemplateBlueprintForTemplate(templateId?: string | null) {
  return getTemplateBlueprint(templateId);
}

export function getRuntimeSectionOrderForTemplate(templateId?: string | null) {
  return getTemplateBlueprint(templateId).runtimeSectionOrder;
}

export function blueprintCategoryRecords() {
  return templateBlueprintRegistry
    .map((blueprint) => blueprint.category)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function applyBlueprintMetadata<T extends Record<string, unknown>>({
  blueprint,
  record
}: {
  blueprint: TemplateBlueprint;
  record: T;
}) {
  return {
    ...record,
    ai_customization_config: {
      ...(isRecord(record.ai_customization_config) ? record.ai_customization_config : {}),
      generationHooks: blueprint.aiGenerationHooks,
      recommendedPrompts: blueprint.recommendedAudience.map(
        (audience) => `Adapt this storefront for ${audience}`
      )
    },
    blueprint_id: blueprint.id,
    default_theme_settings: {
      ...(isRecord(record.default_theme_settings) ? record.default_theme_settings : {}),
      ...blueprint.defaultThemeSettings,
      categoryCardStyle: blueprint.visualProfile.categoryCardStyle,
      generationHooks: blueprint.aiGenerationHooks,
      visualProfile: blueprint.visualProfile
    },
    industry: blueprint.industry,
    package_version: blueprint.packageVersion,
    preview_config: {
      ...(isRecord(record.preview_config) ? record.preview_config : {}),
      blueprintId: blueprint.id,
      inheritedRuntimeSlots: blueprint.inheritedRuntimeSlots,
      industry: blueprint.industry,
      recommendedAudience: blueprint.recommendedAudience,
      style: blueprint.style,
      visualAssetSlots: blueprint.visualAssetSlots,
      visualProfile: blueprint.visualProfile
    },
    preview_gradient: blueprint.previewGradient,
    preview_summary: blueprint.previewSummary,
    recommended_audience: blueprint.recommendedAudience,
    style: blueprint.style,
    visual_profile: blueprint.visualProfile
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function verifyBlueprintRuntimeInheritance(blueprint: TemplateBlueprint = getTemplateBlueprint()) {
  const requiredSlots = [...inheritedStorefrontRuntimeSlots];
  const missing = requiredSlots.filter((slot) => !blueprint.inheritedRuntimeSlots.includes(slot));

  return {
    blueprintId: blueprint.id,
    inheritedRuntimeSlots: blueprint.inheritedRuntimeSlots,
    missingSlots: missing,
    ok: missing.length === 0 && blueprint.runtimeSectionOrder.length > 0,
    runtimeSectionOrder: blueprint.runtimeSectionOrder
  };
}
