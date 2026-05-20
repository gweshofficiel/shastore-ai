import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://shastore.ai";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const [{ data: landingPublications }, { data: publicationHosts }] = await Promise.all([
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
      .limit(500)
  ]);

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

  return [
    {
      lastModified: new Date(),
      url: siteUrl()
    },
    ...defaultRoutes,
    ...hostRoutes
  ];
}
