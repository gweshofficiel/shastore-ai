import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/deployment/config";
import { createClient } from "@/lib/supabase/server";

function siteUrl() {
  return getAppBaseUrl();
}

function publicUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${normalizedPath}`;
}

function dateOrNow(value: string | null | undefined) {
  return value ? new Date(value) : new Date();
}

function routeEntry(url: string, lastModified?: string | null): MetadataRoute.Sitemap[number] {
  return {
    lastModified: dateOrNow(lastModified),
    url
  };
}

function isSafeSlug(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("/");
}

function uniqueRoutes(routes: MetadataRoute.Sitemap) {
  const seen = new Set<string>();

  return routes.filter((route) => {
    if (seen.has(route.url)) {
      return false;
    }

    seen.add(route.url);
    return true;
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const [
    { data: landingPublications },
    { data: publicationHosts },
    { data: storePublications }
  ] = await Promise.all([
    supabase
      .from("publications")
      .select("url, published_at")
      .eq("status", "published")
      .limit(500),
    supabase
      .from("publication_hosts" as never)
      .select("canonical_url, publication_url, published_at, sitemap_enabled")
      .eq("status", "published")
      .eq("sitemap_enabled", true)
      .limit(500),
    supabase
      .from("published_stores" as never)
      .select("store_id, slug, canonical_url, published_at, noindex")
      .eq("status" as never, "published" as never)
      .eq("visibility" as never, "public" as never)
      .neq("noindex" as never, true as never)
      .limit(500)
  ]);
  const publicStores = ((storePublications ?? []) as unknown as Array<{
    canonical_url?: string | null;
    noindex?: boolean | null;
    published_at?: string | null;
    slug?: string | null;
    store_id?: string | null;
  }>).filter((store) => Boolean(store.store_id) && isSafeSlug(store.slug));
  const storeIds = publicStores.map((store) => store.store_id).filter((id): id is string => Boolean(id));
  const [{ data: products }, { data: categories }, { data: pages }] = storeIds.length
    ? await Promise.all([
        supabase
          .from("store_products" as never)
          .select("id, store_id, slug, updated_at, created_at, noindex")
          .in("store_id" as never, storeIds as never)
          .eq("status" as never, "active" as never)
          .neq("noindex" as never, true as never)
          .limit(2000),
        supabase
          .from("store_categories" as never)
          .select("id, store_id, slug, updated_at, created_at, noindex")
          .in("store_id" as never, storeIds as never)
          .eq("status" as never, "active" as never)
          .neq("noindex" as never, true as never)
          .limit(1000),
        supabase
          .from("store_pages" as never)
          .select("id, store_id, slug, updated_at, created_at, noindex")
          .in("store_id" as never, storeIds as never)
          .eq("status" as never, "published" as never)
          .neq("noindex" as never, true as never)
          .limit(1000)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const storesById = new Map(publicStores.map((store) => [store.store_id, store]));

  const defaultRoutes =
    landingPublications?.map((publication) => ({
      lastModified: publication.published_at
        ? new Date(publication.published_at)
        : new Date(),
      url: `${siteUrl()}${publication.url}`
    })) ?? [];
  const hostRoutes =
    (publicationHosts as Array<{
      canonical_url?: string | null;
      publication_url?: string | null;
      published_at?: string | null;
    }> | null)?.map((publication) => ({
      lastModified: publication.published_at
        ? new Date(publication.published_at)
        : new Date(),
      url: publication.canonical_url || `${siteUrl()}${publication.publication_url}`
    })) ?? [];
  const storeRoutes = publicStores.map((store) => routeEntry(
    store.canonical_url || publicUrl(`/store/${store.slug}`),
    store.published_at
  ));
  const productRoutes = ((products ?? []) as unknown as Array<{
    created_at?: string | null;
    id?: string | null;
    slug?: string | null;
    store_id?: string | null;
    updated_at?: string | null;
  }>)
    .filter((product) => Boolean(product.id) && Boolean(product.store_id) && storesById.has(product.store_id))
    .map((product) => {
      const store = storesById.get(product.store_id);
      const productPath = isSafeSlug(product.slug) ? product.slug : product.id;

      return routeEntry(
        publicUrl(`/store/${store?.slug}/product/${encodeURIComponent(productPath ?? "")}`),
        product.updated_at || product.created_at
      );
    });
  const categoryRoutes = ((categories ?? []) as unknown as Array<{
    created_at?: string | null;
    id?: string | null;
    slug?: string | null;
    store_id?: string | null;
    updated_at?: string | null;
  }>)
    .filter((category) => isSafeSlug(category.slug) && Boolean(category.store_id) && storesById.has(category.store_id))
    .map((category) => {
      const store = storesById.get(category.store_id);

      return routeEntry(
        publicUrl(`/store/${store?.slug}/category/${encodeURIComponent(category.slug ?? "")}`),
        category.updated_at || category.created_at
      );
    });
  const pageRoutes = ((pages ?? []) as unknown as Array<{
    created_at?: string | null;
    id?: string | null;
    slug?: string | null;
    store_id?: string | null;
    updated_at?: string | null;
  }>)
    .filter((page) => isSafeSlug(page.slug) && Boolean(page.store_id) && storesById.has(page.store_id))
    .map((page) => {
      const store = storesById.get(page.store_id);

      return routeEntry(
        publicUrl(`/store/${store?.slug}/pages/${encodeURIComponent(page.slug ?? "")}`),
        page.updated_at || page.created_at
      );
    });

  return uniqueRoutes([
    {
      lastModified: new Date(),
      url: siteUrl()
    },
    ...defaultRoutes,
    ...hostRoutes,
    ...storeRoutes,
    ...productRoutes,
    ...categoryRoutes,
    ...pageRoutes
  ]);
}
