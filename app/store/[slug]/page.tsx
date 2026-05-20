import type { Metadata } from "next";
import { getPublishedStorefront } from "@/lib/storefront";
import { StoreTemplateRenderer } from "@/templates/store/renderer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await getPublishedStorefront(slug);
  const title = store.publication.seoTitle || store.publication.ogTitle || store.name;
  const description =
    store.publication.seoDescription ||
    store.publication.ogDescription ||
    store.description ||
    `Shop ${store.name} and order directly on WhatsApp.`;
  const image = store.publication.socialImageUrl || store.logoImageUrl || undefined;
  const url = store.publication.hostname
    ? `https://${store.publication.hostname}`
    : store.publication.url;

  return {
    title,
    description,
    icons: store.publication.faviconUrl ? { icon: store.publication.faviconUrl } : undefined,
    openGraph: {
      title: store.publication.ogTitle || title,
      description: store.publication.ogDescription || description,
      url,
      siteName: store.name,
      images: image ? [{ url: image, alt: store.name }] : undefined,
      type: "website"
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: store.publication.ogTitle || title,
      description: store.publication.ogDescription || description,
      images: image ? [image] : undefined
    },
    robots:
      store.publication.visibility === "public"
        ? { index: true, follow: true }
        : { index: false, follow: false }
  };
}

export default async function PublicStorePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getPublishedStorefront(slug);

  return <StoreTemplateRenderer store={store} />;
}
