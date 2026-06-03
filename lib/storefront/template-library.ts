import {
  normalizeBuilderPageSchema,
  type BuilderPageSchema
} from "@/lib/storefront/builder";
import { createClient } from "@/lib/supabase/server";

export type TemplateCategoryRecord = {
  category_key: string;
  description: string | null;
  name: string;
  sort_order: number;
};

export type StoreTemplateRecord = {
  ai_customization_config: Record<string, unknown>;
  branding_config: Record<string, unknown>;
  category: string;
  category_key: string;
  default_theme_settings: Record<string, unknown>;
  description: string | null;
  id: string;
  is_active: boolean;
  layout_schema: BuilderPageSchema;
  name: string;
  niche_category: string;
  preview_image: string | null;
  preview_config: Record<string, unknown>;
  preview_gradient: string | null;
  preview_summary: string | null;
  responsive_preview_config: Record<string, unknown>;
  sections_schema: unknown[];
  slug: string;
  template_slug: string;
  template_type: string;
  theme_config: Record<string, unknown>;
};

export type TemplateLibrary = {
  categories: TemplateCategoryRecord[];
  ready: boolean;
  templates: StoreTemplateRecord[];
};

const fallbackCategories: TemplateCategoryRecord[] = [
  { category_key: "fashion", description: "Boutique apparel and seasonal edits.", name: "Fashion", sort_order: 10 },
  { category_key: "electronics", description: "Gadgets, smart bundles, and comparisons.", name: "Electronics", sort_order: 20 },
  { category_key: "beauty", description: "Skincare, cosmetics, and routines.", name: "Beauty", sort_order: 30 },
  { category_key: "perfume", description: "Fragrance notes, gifting, and collections.", name: "Perfume", sort_order: 40 },
  { category_key: "restaurant", description: "Menus, specials, and reservations.", name: "Restaurant", sort_order: 50 },
  { category_key: "jewelry", description: "Fine jewelry, collections, and gifting.", name: "Jewelry", sort_order: 60 },
  { category_key: "premium", description: "Luxury storefronts with editorial merchandising.", name: "Premium", sort_order: 65 },
  { category_key: "general", description: "Flexible storefront layouts for any store.", name: "General", sort_order: 70 }
];

const fallbackTemplates: StoreTemplateRecord[] = fallbackCategories.slice(0, 6).map((category, index) => {
  const sectionId = `${category.category_key}-hero`;

  return {
    ai_customization_config: {
      recommendedPrompts: [`Adapt ${category.name.toLowerCase()} branding`, "Improve layout sections"]
    },
    branding_config: {
      accentColor: index % 2 === 0 ? "#2563eb" : "#f59e0b",
      primaryColor: "#0f172a",
      tone: "modern"
    },
    category: category.category_key,
    category_key: category.category_key,
    default_theme_settings: {
      aiTemplateReady: true,
      colorPresets: ["slate", "blue", "white"],
      fontStyle: "modern",
      layoutStyle: "classic",
      multilingualReady: true,
      themeColor: index % 2 === 0 ? "#2563eb" : "#f59e0b"
    },
    description: category.description,
    id: `${category.category_key}-starter`,
    is_active: true,
    layout_schema: normalizeBuilderPageSchema({
      sections: [
        {
          enabled: true,
          id: sectionId,
          order: 10,
          props: {
            heading: `${category.name} starter storefront`
          },
          responsive: {},
          type: "hero"
        }
      ],
      version: 1
    }),
    name: `${category.name} Starter`,
    niche_category: category.category_key,
    preview_image: null,
    preview_config: { devices: ["desktop", "tablet", "mobile"] },
    preview_gradient: "linear-gradient(135deg,#f8fafc,#2563eb 52%,#020617)",
    preview_summary: category.description,
    responsive_preview_config: {
      desktop: "Full template preview",
      mobile: "Stacked mobile preview",
      tablet: "Tablet preview"
    },
    sections_schema: [],
    slug: `${category.category_key}-starter`,
    template_slug: `${category.category_key}-starter`,
    template_type: "store",
    theme_config: {
      border_radius: "2rem",
      layout_key: "classic",
      spacing: "comfortable",
      theme_key: "modern"
    }
  };
});

const flagshipSectionDefinitions = [
  ["flagship-hero", "hero", 10, "Premium commerce, powered by your real catalog", "Official SHASTORE flagship storefront structure."],
  ["flagship-categories", "featured_categories", 20, "Shop by category", "Browse store-managed categories."],
  ["flagship-featured-products", "featured_products", 30, "Featured products", "Highlight active products from this store."],
  ["flagship-new-arrivals", "new_arrivals", 40, "New arrivals", "Recently added active products."],
  ["flagship-best-sellers", "best_sellers", 50, "Best sellers", "Products ranked by real order signals when available."],
  ["flagship-flash-deals", "flash_deals", 60, "Flash deals", "Products with sale pricing appear here."],
  ["flagship-recommended", "recommended_products", 70, "Recommended products", "Store recommendations and merchandising picks."],
  ["flagship-recently-viewed", "recently_viewed", 80, "Recently viewed", "Customer-specific browsing history on this device."],
  ["flagship-brands", "brands", 90, "Brands and collections", "Store categories and collections are presented as brand-style entry points."],
  ["flagship-trust", "trust_badges", 100, "Why shop here", "Trust, delivery, payment, and support structure."],
  ["flagship-testimonials", "testimonials", 110, "Customer testimonials", "Approved testimonials can be configured here later."],
  ["flagship-blog", "blog_preview", 120, "From the blog", "Editorial placeholders keep this premium section complete."],
  ["flagship-faq", "faq_preview", 130, "Frequently asked questions", "FAQ placeholders keep this premium section complete."],
  ["flagship-newsletter", "newsletter", 140, "Join the newsletter", "Newsletter structure for future customer engagement."],
  ["flagship-footer-cta", "footer_cta", 150, "Ready to shop?", "Return customers to the real catalog."],
  ["flagship-footer", "footer", 160, "Footer", "Store footer links, legal pages, social links, and locale tools."]
] as const;

const shastoreFlagshipPremiumTemplate: StoreTemplateRecord = {
  ai_customization_config: {
    recommendedPrompts: [
      "Tune the flagship storefront for the store category",
      "Prioritize homepage sections for conversion",
      "Refine premium navigation and merchandising copy"
    ]
  },
  branding_config: {
    accentColor: "#d4af37",
    primaryColor: "#0f172a",
    secondaryColor: "#1d4ed8",
    tone: "premium"
  },
  category: "premium",
  category_key: "premium",
  default_theme_settings: {
    aiTemplateReady: true,
    buttonStyle: "pill",
    colorPresets: ["slate", "blue", "gold", "white"],
    ctaStyle: "filled",
    fontScale: "comfortable",
    fontStyle: "display",
    footerStyle: "bold",
    heroBackground: "glass",
    layoutStyle: "spacious",
    multilingualReady: true,
    navigationStyle: "mega",
    stickyHeader: true,
    themeColor: "#0f172a"
  },
  description: "Official SHASTORE premium storefront structure with full ecommerce header, homepage merchandising, product discovery, customer account entry points, multilingual, multicurrency, and conversion-ready footer.",
  id: "shastore-flagship-premium",
  is_active: true,
  layout_schema: normalizeBuilderPageSchema({
    sections: flagshipSectionDefinitions.map(([id, type, order, heading, subheading]) => ({
      enabled: true,
      id,
      order,
      props: {
        heading,
        subtitle: subheading,
        title: heading
      },
      responsive: {},
      type
    })),
    version: 1
  }),
  name: "SHASTORE Flagship Premium",
  niche_category: "premium",
  preview_image: null,
  preview_config: {
    devices: ["desktop", "tablet", "mobile"],
    highlights: [
      "Mega navigation and catalog search",
      "Full premium homepage structure",
      "Language and currency ready",
      "Customer account, wishlist, and cart entry points"
    ]
  },
  preview_gradient: "linear-gradient(135deg,#020617,#1d4ed8 52%,#d4af37)",
  preview_summary: "Official SHASTORE reference template for premium ecommerce structure without demo data.",
  responsive_preview_config: {
    desktop: "Full premium commerce structure with header, discovery, merchandising, trust, content previews, and footer",
    mobile: "Stacked premium shopping flow with account, wishlist, cart, language, and currency access",
    tablet: "Balanced catalog and content sections for store browsing"
  },
  sections_schema: [],
  slug: "shastore-flagship-premium",
  template_slug: "shastore-flagship-premium",
  template_type: "store",
  theme_config: {
    border_radius: "2rem",
    layout_key: "premium",
    spacing: "spacious",
    theme_key: "shastore-flagship-premium"
  }
};

const auroraProTemplate: StoreTemplateRecord = {
  ai_customization_config: {
    recommendedPrompts: [
      "Adapt Aurora Pro for a luxury ecommerce niche",
      "Rewrite premium hero and product copy",
      "Tune gold accent palette for the brand"
    ]
  },
  branding_config: {
    accentColor: "#c6a15b",
    primaryColor: "#0b0906",
    secondaryColor: "#f7f3ea",
    tone: "luxury"
  },
  category: "premium",
  category_key: "premium",
  default_theme_settings: {
    aiTemplateReady: true,
    announcementText: "Premium launch offer",
    buttonStyle: "pill",
    colorPresets: ["black", "gold", "ivory"],
    ctaStyle: "filled",
    fontScale: "comfortable",
    fontStyle: "modern",
    footerStyle: "bold",
    heroBackground: "glass",
    layoutStyle: "premium",
    multilingualReady: true,
    navigationStyle: "split",
    stickyHeader: true,
    themeColor: "#c6a15b"
  },
  description: "A premium Shopify-grade luxury ecommerce template with a dark hero, gold accents, editorial product cards, trust sections, testimonials, newsletter, and professional footer.",
  id: "aurora-pro",
  is_active: true,
  layout_schema: normalizeBuilderPageSchema({
    sections: [
      {
        enabled: true,
        id: "aurora-pro-hero",
        order: 10,
        props: {
          eyebrow: "Luxury collection 2026",
          heading: "Premium commerce for curated collections",
          subheading: "A luxury dark hero with gold accents, polished merchandising, and responsive ecommerce sections."
        },
        responsive: {},
        type: "hero"
      },
      {
        enabled: true,
        id: "aurora-pro-categories",
        order: 20,
        props: {
          heading: "Shop by category"
        },
        responsive: {},
        type: "categories"
      },
      {
        enabled: true,
        id: "aurora-pro-products",
        order: 30,
        props: {
          heading: "Best sellers"
        },
        responsive: {},
        type: "products"
      },
      {
        enabled: true,
        id: "aurora-pro-trust",
        order: 40,
        props: {
          heading: "Premium service promise"
        },
        responsive: {},
        type: "trust"
      },
      {
        enabled: true,
        id: "aurora-pro-newsletter",
        order: 50,
        props: {
          heading: "Join the private Aurora list"
        },
        responsive: {},
        type: "newsletter"
      }
    ],
    version: 1
  }),
  name: "Aurora Pro",
  niche_category: "premium",
  preview_image: "https://images.unsplash.com/photo-1491933382434-500287f9b54b?auto=format&fit=crop&w=1400&q=85",
  preview_config: {
    devices: ["desktop", "tablet", "mobile"],
    highlights: ["Luxury dark hero", "Gold CTA buttons", "Premium product cards", "Trust and testimonials"]
  },
  preview_gradient: "linear-gradient(135deg,#080705,#c6a15b 48%,#f7f3ea)",
  preview_summary: "Shopify-grade luxury commerce with a dark cinematic hero, gold accents, clean product sections, trust blocks, testimonials, newsletter, and polished footer.",
  responsive_preview_config: {
    desktop: "Luxury hero, category cards, best sellers, promos, trust, testimonials, newsletter, footer",
    mobile: "Stacked premium hero and compact commercial product cards",
    tablet: "Balanced two-column luxury commerce layout"
  },
  sections_schema: [],
  slug: "aurora-pro",
  template_slug: "aurora-pro",
  template_type: "store",
  theme_config: {
    border_radius: "2.5rem",
    layout_key: "premium",
    spacing: "spacious",
    theme_key: "aurora-pro"
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeCategory(value: unknown): TemplateCategoryRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const categoryKey = textValue(value.category_key);

  if (!categoryKey) {
    return null;
  }

  return {
    category_key: categoryKey,
    description: typeof value.description === "string" ? value.description : null,
    name: textValue(value.name, categoryKey.replace(/_/g, " ")),
    sort_order: numberValue(value.sort_order)
  };
}

function normalizeTemplate(value: unknown): StoreTemplateRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = textValue(value.id);
  const categoryKey = textValue(
    value.category_key,
    textValue(value.category, textValue(value.niche_category, "general"))
  );

  if (!id) {
    return null;
  }

  const layoutSchema = validateTemplateSchema(value.layout_schema).schema;
  const defaultThemeSettings = recordValue(value.default_theme_settings);
  const themeConfig = {
    ...defaultThemeSettings,
    ...recordValue(value.theme_config)
  };
  const slug = textValue(value.slug, textValue(value.template_slug, textValue(value.template_key, id)));

  return {
    ai_customization_config: recordValue(value.ai_customization_config),
    branding_config: recordValue(value.branding_config),
    category: textValue(value.category, categoryKey),
    category_key: categoryKey,
    default_theme_settings: defaultThemeSettings,
    description: typeof value.description === "string" ? value.description : null,
    id,
    is_active: value.is_active !== false,
    layout_schema: layoutSchema,
    name: textValue(value.name, "Store Template"),
    niche_category: textValue(value.niche_category, categoryKey),
    preview_image: typeof value.preview_image === "string" ? value.preview_image : null,
    preview_config: recordValue(value.preview_config),
    preview_gradient: typeof value.preview_gradient === "string" ? value.preview_gradient : null,
    preview_summary: typeof value.preview_summary === "string" ? value.preview_summary : null,
    responsive_preview_config: recordValue(value.responsive_preview_config),
    sections_schema: Array.isArray(value.sections_schema) ? value.sections_schema : [],
    slug,
    template_slug: slug,
    template_type: textValue(value.template_type, "store"),
    theme_config: themeConfig
  };
}

function missingTemplateFoundation(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: string; message?: string };
  const message = (record.message ?? "").toLowerCase();
  return (
    record.code === "PGRST202" ||
    record.code === "PGRST205" ||
    message.includes("is_active") ||
    message.includes("default_theme_settings") ||
    message.includes("preview_image") ||
    message.includes("template_slug") ||
    message.includes("layout_schema") ||
    message.includes("template_sections") ||
    message.includes("schema cache")
  );
}

export function validateTemplateSchema(value: unknown) {
  const schema = normalizeBuilderPageSchema(value);

  return {
    errors: schema.sections.length ? [] : ["Template has no valid builder sections."],
    schema
  };
}

export function mapTemplateToBuilderDraft(template: StoreTemplateRecord): BuilderPageSchema {
  return validateTemplateSchema(template.layout_schema).schema;
}

export async function getTemplateLibrary(): Promise<TemplateLibrary> {
  const supabase = await createClient();
  const [{ data: categoryData, error: categoryError }, { data: templateData, error: templateError }] =
    await Promise.all([
      supabase
        .from("template_categories" as never)
        .select("category_key, name, description, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("store_templates" as never)
        .select(
          "id, template_key, name, description, category, category_key, preview_image, preview_gradient, slug, template_slug, template_type, niche_category, preview_summary, preview_config, layout_schema, sections_schema, branding_config, theme_config, default_theme_settings, ai_customization_config, responsive_preview_config, is_active"
        )
        .eq("is_active", true)
        .order("created_at", { ascending: true })
    ]);

  if (
    (categoryError && !missingTemplateFoundation(categoryError)) ||
    (templateError && !missingTemplateFoundation(templateError))
  ) {
    console.error("[template-library] read failed", {
      categoryError: categoryError?.message,
      templateError: templateError?.message
    });
  }

  const categories = Array.isArray(categoryData)
    ? categoryData.map(normalizeCategory).filter((category): category is TemplateCategoryRecord => Boolean(category))
    : [];
  const templates = Array.isArray(templateData)
    ? templateData.map(normalizeTemplate).filter((template): template is StoreTemplateRecord => Boolean(template))
    : [];
  const baseCategories = categories.length ? categories : fallbackCategories;
  const libraryCategories = baseCategories.some((category) => category.category_key === "premium")
    ? baseCategories
    : [
        ...baseCategories,
        { category_key: "premium", description: "Luxury storefronts with editorial merchandising.", name: "Premium", sort_order: 65 }
      ].sort((left, right) => left.sort_order - right.sort_order);
  const baseTemplates = templates.length ? templates : fallbackTemplates;
  const withFlagship = baseTemplates.some((template) => template.id === shastoreFlagshipPremiumTemplate.id)
    ? baseTemplates
    : [shastoreFlagshipPremiumTemplate, ...baseTemplates];
  const libraryTemplates = withFlagship.some((template) => template.id === auroraProTemplate.id)
    ? withFlagship
    : [...withFlagship, auroraProTemplate];

  return {
    categories: libraryCategories,
    ready: Boolean(!categoryError && !templateError && libraryTemplates.length),
    templates: libraryTemplates
  };
}

export async function getTemplatesByCategory(categoryKey: string) {
  const library = await getTemplateLibrary();

  return library.templates.filter((template) => template.niche_category === categoryKey);
}

export async function getProductionStoreTemplate(templateId?: string | null) {
  const library = await getTemplateLibrary();
  const requestedId = textValue(templateId, "shastore-flagship-premium");
  const template =
    library.templates.find((candidate) => candidate.id === requestedId || candidate.slug === requestedId) ??
    library.templates.find((candidate) => candidate.id === "shastore-flagship-premium") ??
    library.templates.find((candidate) => candidate.id === "general-starter") ??
    library.templates[0] ??
    shastoreFlagshipPremiumTemplate ??
    fallbackTemplates.find((candidate) => candidate.id === "general-starter") ??
    fallbackTemplates[0];

  return template;
}

export async function cloneTemplateToStore({
  storeInstanceId,
  templateId
}: {
  storeInstanceId: string;
  templateId: string;
}) {
  const supabase = await createClient();
  const library = await getTemplateLibrary();
  const template = library.templates.find((candidate) => candidate.id === templateId);

  if (!template) {
    return { error: "Template not found.", pageId: null };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required.", pageId: null };
  }

  const draftSchema = mapTemplateToBuilderDraft(template);
  const { data: pageData, error: pageError } = await supabase
    .from("builder_pages" as never)
    .upsert(
      {
        owner_user_id: user.id,
        page_key: "home",
        page_title: "Home",
        schema_version: draftSchema.version,
        status: "draft",
        store_instance_id: storeInstanceId
      } as never,
      { onConflict: "store_instance_id,page_key" }
    )
    .select("id")
    .single();

  if (pageError || !pageData) {
    return { error: pageError?.message ?? "Unable to prepare builder page.", pageId: null };
  }

  const pageId = (pageData as { id: string }).id;
  const { error: draftError } = await supabase
    .from("builder_drafts" as never)
    .upsert(
      {
        builder_page_id: pageId,
        draft_schema: draftSchema,
        editor_state: {
          mode: "desktop",
          selectedSectionId: null,
          source: "template_library",
          templateId
        },
        has_unsaved_changes: true,
        layout_tree: draftSchema.layoutTree,
        owner_user_id: user.id,
        responsive_config: draftSchema.responsive,
        store_instance_id: storeInstanceId
      } as never,
      { onConflict: "builder_page_id" }
    );

  return {
    error: draftError?.message ?? null,
    pageId
  };
}
