import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeStoreThemeSettings } from "@/lib/store-theme";
import { defaultStoreTemplateId } from "@/lib/store-templates";
import { getProductionStoreTemplate } from "@/lib/storefront/template-library";
import type { StorePublication } from "@/types/storefront";
import type { StorefrontData } from "@/types/storefront";

type PublicationRow = Record<string, unknown> & {
  store_id?: string;
  slug?: string;
  status?: string;
  visibility?: string;
};

function normalizePublication(publication: Record<string, unknown>): StorePublication {
  const status =
    publication.status === "published" || publication.status === "unpublished"
      ? publication.status
      : "draft";
  const visibility = publication.visibility === "private" ? "private" : "public";

  return {
    slug: String(publication.slug ?? ""),
    status,
    visibility,
    url: String(publication.url ?? `/store/${publication.slug ?? ""}`),
    publishedAt:
      typeof publication.published_at === "string" ? publication.published_at : null,
    seoTitle: typeof publication.seo_title === "string" ? publication.seo_title : null,
    seoDescription:
      typeof publication.seo_description === "string" ? publication.seo_description : null,
    ogTitle: typeof publication.og_title === "string" ? publication.og_title : null,
    ogDescription:
      typeof publication.og_description === "string" ? publication.og_description : null,
    faviconUrl: typeof publication.favicon_url === "string" ? publication.favicon_url : null,
    socialImageUrl:
      typeof publication.social_image_url === "string"
        ? publication.social_image_url
        : null,
    customDomain:
      typeof publication.custom_domain === "string" ? publication.custom_domain : null,
    subdomain: typeof publication.subdomain === "string" ? publication.subdomain : null,
    hostname: typeof publication.hostname === "string" ? publication.hostname : null
  };
}

export async function getPublishedStorefront(slug: string): Promise<StorefrontData> {
  const supabase = await createClient();
  const { data: rawPublication, error: initialPublicationError } = await supabase
    .from("published_stores")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  let publicationError = initialPublicationError;
  let publication = rawPublication as PublicationRow | null;

  if (publicationError?.code === "PGRST204") {
    const fallback = await supabase
      .from("published_stores")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();
    publication = fallback.data as PublicationRow | null;
    publicationError = fallback.error;
  }

  if (publicationError || !publication) {
    notFound();
  }
  if (publication.visibility === "private") {
    notFound();
  }
  const normalizedPublication = normalizePublication(publication);

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", publication.store_id ?? "")
    .single();

  if (!store) {
    notFound();
  }
  const storeRecord = store as typeof store & Record<string, unknown>;

  const [{ data: categories }, { data: products }, { data: themeSettings }] = await Promise.all([
    supabase
      .from("store_categories")
      .select("id, name, description, image_url, sort_order")
      .eq("store_id", store.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_products")
      .select("id, category_id, name, description, price, image_url, sort_order")
      .eq("store_id", store.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_theme_settings")
      .select("settings, theme_settings, logo_image_url, brand_color, theme_color" as never)
      .eq("store_id", store.id)
      .maybeSingle()
  ]);

  const productionTemplate = await getProductionStoreTemplate(
    typeof store.template_id === "string" ? store.template_id : defaultStoreTemplateId
  );
  const storeThemeSettings =
    storeRecord.theme_settings &&
    typeof storeRecord.theme_settings === "object" &&
    !Array.isArray(storeRecord.theme_settings)
      ? (storeRecord.theme_settings as Record<string, unknown>)
      : {};
  const themeSettingsRecord = (themeSettings ?? {}) as Record<string, unknown>;
  const persistedThemeSettings =
    themeSettingsRecord.theme_settings &&
    typeof themeSettingsRecord.theme_settings === "object" &&
    !Array.isArray(themeSettingsRecord.theme_settings)
      ? (themeSettingsRecord.theme_settings as Record<string, unknown>)
      : {};
  const normalizedTheme = normalizeStoreThemeSettings({
    ...productionTemplate.default_theme_settings,
    ...storeThemeSettings,
    ...persistedThemeSettings,
    ...(themeSettingsRecord.settings && typeof themeSettingsRecord.settings === "object"
      ? (themeSettingsRecord.settings as Record<string, unknown>)
      : {})
  });

  return {
    id: store.id,
    slug: normalizedPublication.slug,
    name: store.name,
    description: store.description,
    logoImageUrl:
      (typeof themeSettingsRecord.logo_image_url === "string" ? themeSettingsRecord.logo_image_url : null) ||
      normalizedTheme.logoUrl ||
      store.logo_image_url,
    brandColor:
      (typeof storeRecord.theme_color === "string" ? storeRecord.theme_color : null) ||
      store.brand_color ||
      normalizedTheme.primaryColor,
    currency: store.currency,
    whatsappNumber: store.whatsapp_number,
    templateId: productionTemplate.id || store.template_id || defaultStoreTemplateId,
    publication: normalizedPublication,
    themeSettings: {
      ...normalizedTheme,
      primaryColor:
        (typeof themeSettingsRecord.theme_color === "string" ? themeSettingsRecord.theme_color : null) ||
        (typeof themeSettingsRecord.brand_color === "string" ? themeSettingsRecord.brand_color : null) ||
        (typeof storeRecord.theme_color === "string" ? storeRecord.theme_color : null) ||
        normalizedTheme.primaryColor
    },
    categories:
      categories?.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        imageUrl: category.image_url
      })) ?? [],
    products:
      products?.map((product) => ({
        id: product.id,
        categoryId: product.category_id,
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrl: product.image_url
      })) ?? []
  };
}
