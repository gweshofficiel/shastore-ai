import type { StoreTenantContext } from "@/lib/tenant/context";
import { getProductionStoreTemplate } from "@/lib/storefront/template-library";
import type { StoreSection } from "@/lib/storefront/sections";
import { resolveStorefrontTemplateConfig } from "@/lib/storefront/theme-registry";

type RuntimeSectionInput = {
  config?: unknown;
  enabled?: unknown;
  id?: unknown;
  order?: unknown;
  props?: unknown;
  responsive?: unknown;
  section_order?: unknown;
  section_type?: unknown;
  type?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeRuntimeSection(
  value: unknown,
  context: StoreTenantContext,
  fallbackOrder: number
): StoreSection | null {
  if (!isRecord(value)) {
    return null;
  }

  const section = value as RuntimeSectionInput;
  const sectionType = textValue(section.section_type, textValue(section.type));

  if (!sectionType) {
    return null;
  }

  const props = {
    ...recordValue(section.config),
    ...recordValue(section.props)
  };

  return {
    config: {
      ...props,
      responsive: recordValue(section.responsive)
    },
    id: textValue(section.id, `${sectionType}-${fallbackOrder}`),
    owner_user_id: context.owner_user_id,
    section_enabled: typeof section.enabled === "boolean" ? section.enabled : true,
    section_order: numberValue(section.order, numberValue(section.section_order, fallbackOrder)),
    section_type: sectionType,
    store_instance_id: context.store_instance_id
  };
}

function normalizeRuntimeSections(value: unknown, context: StoreTenantContext) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section, index) => normalizeRuntimeSection(section, context, (index + 1) * 10))
    .filter((section): section is StoreSection => Boolean(section))
    .filter((section) => section.section_enabled)
    .sort((left, right) => left.section_order - right.section_order);
}

function hasSection(sections: StoreSection[], type: string) {
  return sections.some((section) => section.section_type.toLowerCase() === type.toLowerCase());
}

function defaultRuntimeSections(context: StoreTenantContext): StoreSection[] {
  const template = resolveStorefrontTemplateConfig({
    fontStyle: context.preview.fontStyle,
    layoutStyle: context.preview.layoutStyle,
    templateId: context.preview.templateId,
    themeColor: context.preview.themeColor,
    themeSettings: context.preview.themeSettings
  });
  const order =
    template.key === "shastore-flagship-premium"
      ? [
          "navbar",
          "hero",
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
          "newsletter",
          "footer"
        ]
      : template.key === "beauty-starter"
      ? ["navbar", "hero", "categories", "testimonials", "featured_products", "faq", "cta"]
      : template.key === "electronics-starter"
        ? ["navbar", "hero", "categories", "featured_products", "faq", "testimonials", "cta"]
        : ["navbar", "hero", "featured_products", "categories", "testimonials", "faq", "cta"];

  if (template.key === "shastore-flagship-premium") {
    return normalizeRuntimeSections(
      order.map((type, index) => ({
        id: `runtime-${type.replace(/_/g, "-")}`,
        order: (index + 1) * 10,
        type,
        props: type === "hero"
          ? {
              title: context.preview.themeSettings.heroTitle || context.settings.title,
              body: context.preview.themeSettings.heroSubtitle || context.settings.description,
              templateKey: template.key
            }
          : {}
      })),
      context
    );
  }

  const baseSections = [
    {
      id: "runtime-navbar",
      order: (order.indexOf("navbar") + 1) * 10,
      type: "navbar",
      props: {}
    },
    {
      id: "runtime-hero",
      order: (order.indexOf("hero") + 1) * 10,
      type: "hero",
      props: {
        title: context.preview.themeSettings.heroTitle || context.settings.title,
        body: context.preview.themeSettings.heroSubtitle || context.settings.description,
        templateKey: template.key
      }
    },
    {
      id: "runtime-categories",
      order: (order.indexOf("categories") + 1) * 10,
      type: "categories",
      props: {}
    },
    {
      id: "runtime-featured-products",
      order: (order.indexOf("featured_products") + 1) * 10,
      type: "featured_products",
      props: {}
    },
    {
      id: "runtime-testimonials",
      order: (order.indexOf("testimonials") + 1) * 10,
      type: "testimonials",
      props: {}
    },
    {
      id: "runtime-faq",
      order: (order.indexOf("faq") + 1) * 10,
      type: "faq",
      props: {}
    },
    {
      id: "runtime-cta",
      order: (order.indexOf("cta") + 1) * 10,
      type: "cta",
      props: {}
    }
  ];

  return normalizeRuntimeSections(baseSections, context);
}

function ensureCommercialSections(sections: StoreSection[], context: StoreTenantContext) {
  const defaults = defaultRuntimeSections(context);
  const next = [...sections];

  for (const fallback of defaults) {
    if (!hasSection(next, fallback.section_type)) {
      next.push(fallback);
    }
  }

  return next.sort((left, right) => left.section_order - right.section_order);
}

export async function resolveStorefrontRuntimeSections(
  context: StoreTenantContext
): Promise<StoreSection[]> {
  const template = await getProductionStoreTemplate(context.preview.templateId);
  const templateLayoutSections = Array.isArray(template.layout_schema.sections)
    ? template.layout_schema.sections
    : [];
  const storeSections = normalizeRuntimeSections(context.preview.sectionsSchema, context);
  const templateSections = normalizeRuntimeSections(
    template.sections_schema.length ? template.sections_schema : templateLayoutSections,
    context
  );
  const runtimeSections = storeSections.length ? storeSections : templateSections;

  if (!runtimeSections.length) {
    return defaultRuntimeSections(context);
  }

  return ensureCommercialSections(runtimeSections, context);
}
