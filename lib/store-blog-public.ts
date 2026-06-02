import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicUrl } from "@/lib/deployment/config";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PublicStoreBlogArticle = {
  canonicalUrl: string | null;
  content: string;
  coverImageUrl: string | null;
  excerpt: string | null;
  id: string;
  noindex: boolean;
  ogDescription: string | null;
  ogImageUrl: string | null;
  ogTitle: string | null;
  publishedAt: string | null;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  title: string;
};

function normalizeArticle(value: unknown): PublicStoreBlogArticle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const slug = typeof record.slug === "string" ? record.slug : "";
  const title = typeof record.title === "string" ? record.title : "";
  const content = typeof record.content === "string" ? record.content : "";

  if (!id || !slug || !title || !content) {
    return null;
  }

  return {
    canonicalUrl: typeof record.canonical_url === "string" ? record.canonical_url : null,
    content,
    coverImageUrl: typeof record.cover_image_url === "string" ? record.cover_image_url : null,
    excerpt: typeof record.excerpt === "string" ? record.excerpt : null,
    id,
    noindex: record.noindex === true,
    ogDescription: typeof record.og_description === "string" ? record.og_description : null,
    ogImageUrl: typeof record.og_image_url === "string" ? record.og_image_url : null,
    ogTitle: typeof record.og_title === "string" ? record.og_title : null,
    publishedAt: typeof record.published_at === "string" ? record.published_at : null,
    seoDescription: typeof record.seo_description === "string" ? record.seo_description : null,
    seoTitle: typeof record.seo_title === "string" ? record.seo_title : null,
    slug,
    title
  };
}

export function absoluteBlogImageUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return getPublicUrl(value);
}

export async function loadPublishedStoreBlogArticlesForStore(storeId: string, limit = 20) {
  const admin = createAdminClient();
  const readClient = admin ?? (await createClient());
  const { data } = await readClient
    .from("store_blog_articles" as never)
    .select("id, title, slug, excerpt, content, cover_image_url, published_at, seo_title, seo_description, og_title, og_description, og_image_url, canonical_url, noindex")
    .eq("store_id" as never, storeId as never)
    .eq("status" as never, "published" as never)
    .order("published_at" as never, { ascending: false } as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(limit);

  return ((data ?? []) as unknown[])
    .map(normalizeArticle)
    .filter((article): article is PublicStoreBlogArticle => Boolean(article));
}

export async function loadPublicStoreBlog(slug: string) {
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return { articles: [], preview: null };
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return { articles: [], preview };
  }

  return {
    articles: await loadPublishedStoreBlogArticlesForStore(preview.store.id),
    preview
  };
}

export async function loadPublicStoreBlogArticle({
  articleSlug,
  slug
}: {
  articleSlug: string;
  slug: string;
}) {
  const { articles, preview } = await loadPublicStoreBlog(slug);
  const article = articles.find((item) => item.slug === articleSlug) ?? null;

  return { article, preview };
}
