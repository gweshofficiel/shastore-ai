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
  category_key: string;
  description: string | null;
  id: string;
  layout_schema: BuilderPageSchema;
  name: string;
  niche_category: string;
  preview_config: Record<string, unknown>;
  preview_gradient: string | null;
  preview_summary: string | null;
  responsive_preview_config: Record<string, unknown>;
  sections_schema: unknown[];
  template_slug: string;
  theme_config: Record<string, unknown>;
};

export type TemplateLibrary = {
  categories: TemplateCategoryRecord[];
  ready: boolean;
  templates: StoreTemplateRecord[];
};

const fallbackCategories: TemplateCategoryRecord[] = [
  { category_key: "fashion", description: "Boutique apparel and seasonal edits.", name: "Fashion", sort_order: 10 },
  { category_key: "beauty", description: "Skincare, cosmetics, and routines.", name: "Beauty", sort_order: 20 },
  { category_key: "perfumes", description: "Fragrance notes, gifting, and collections.", name: "Perfumes", sort_order: 30 },
  { category_key: "electronics", description: "Gadgets, smart bundles, and comparisons.", name: "Electronics", sort_order: 40 },
  { category_key: "watches", description: "Timepieces, materials, and collections.", name: "Watches", sort_order: 50 },
  { category_key: "furniture", description: "Room collections and material notes.", name: "Furniture", sort_order: 60 },
  { category_key: "gym", description: "Training gear, classes, and supplements.", name: "Gym", sort_order: 70 },
  { category_key: "pets", description: "Pet food, accessories, and care routines.", name: "Pets", sort_order: 80 },
  { category_key: "restaurants", description: "Menus, specials, and reservations.", name: "Restaurants", sort_order: 90 },
  { category_key: "cafes", description: "Drinks, pastries, and loyalty offers.", name: "Cafes", sort_order: 100 },
  { category_key: "gadgets", description: "Smart accessories and launch offers.", name: "Gadgets", sort_order: 110 }
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
    category_key: category.category_key,
    description: category.description,
    id: `${category.category_key}-starter`,
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
    preview_config: { devices: ["desktop", "tablet", "mobile"] },
    preview_gradient: "linear-gradient(135deg,#f8fafc,#2563eb 52%,#020617)",
    preview_summary: category.description,
    responsive_preview_config: {
      desktop: "Full template preview",
      mobile: "Stacked mobile preview",
      tablet: "Tablet preview"
    },
    sections_schema: [],
    template_slug: `${category.category_key}-starter`,
    theme_config: {
      border_radius: "2rem",
      layout_key: "classic",
      spacing: "comfortable",
      theme_key: "modern"
    }
  };
});

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
  const categoryKey = textValue(value.category_key, textValue(value.niche_category, "fashion"));

  if (!id) {
    return null;
  }

  const layoutSchema = validateTemplateSchema(value.layout_schema).schema;

  return {
    ai_customization_config: recordValue(value.ai_customization_config),
    branding_config: recordValue(value.branding_config),
    category_key: categoryKey,
    description: typeof value.description === "string" ? value.description : null,
    id,
    layout_schema: layoutSchema,
    name: textValue(value.name, "Store Template"),
    niche_category: textValue(value.niche_category, categoryKey),
    preview_config: recordValue(value.preview_config),
    preview_gradient: typeof value.preview_gradient === "string" ? value.preview_gradient : null,
    preview_summary: typeof value.preview_summary === "string" ? value.preview_summary : null,
    responsive_preview_config: recordValue(value.responsive_preview_config),
    sections_schema: Array.isArray(value.sections_schema) ? value.sections_schema : [],
    template_slug: textValue(value.template_slug, textValue(value.template_key, id)),
    theme_config: recordValue(value.theme_config)
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
          "id, template_key, name, description, category_key, preview_gradient, template_slug, niche_category, preview_summary, preview_config, layout_schema, sections_schema, branding_config, theme_config, ai_customization_config, responsive_preview_config"
        )
        .eq("status", "published")
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

  return {
    categories: categories.length ? categories : fallbackCategories,
    ready: Boolean(!categoryError && !templateError && templates.length),
    templates: templates.length ? templates : fallbackTemplates
  };
}

export async function getTemplatesByCategory(categoryKey: string) {
  const library = await getTemplateLibrary();

  return library.templates.filter((template) => template.niche_category === categoryKey);
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
