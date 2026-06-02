import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import {
  contentSeoTitle,
  defaultStoreSeoSettings,
  googleVerificationMetadata,
  loadStoreSeoSettings
} from "@/lib/store-seo";
import { preparePageContentForRender, textFromPageContent } from "@/lib/store-pages/content";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type StorePageRow = {
  canonical_url: string | null;
  content: string | null;
  id: string;
  noindex: boolean | null;
  og_description: string | null;
  og_image_url: string | null;
  og_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  seo_title: string | null;
  slug: string;
  title: string;
};

type PublicStorePageProps = {
  pageSlug: string;
  slug: string;
};

async function loadPublicStorePage({ pageSlug, slug }: PublicStorePageProps) {
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return { page: null, preview: null };
  }

  const admin = createAdminClient();
  const readClient = admin ?? (await createClient());
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return { page: null, preview };
  }

  const { data } = await readClient
    .from("store_pages" as never)
    .select("id, title, slug, content, seo_title, seo_description, seo_keywords, og_title, og_description, og_image_url, canonical_url, noindex")
    .eq("store_id", preview.store.id)
    .eq("slug", pageSlug)
    .eq("status", "published")
    .maybeSingle();

  return {
    page: (data ?? null) as unknown as StorePageRow | null,
    preview
  };
}

export async function generatePublicStorePageMetadata({
  pageSlug,
  slug
}: PublicStorePageProps): Promise<Metadata> {
  const { page, preview } = await loadPublicStorePage({ pageSlug, slug });

  if (!preview || !page) {
    return {
      title: "Page unavailable | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const admin = createAdminClient();
  const seoSettings = admin
    ? await loadStoreSeoSettings(admin, preview.store.id)
    : defaultStoreSeoSettings;
  const description = page.seo_description || textFromPageContent(page.content).slice(0, 160) || seoSettings.defaultMetaDescription;
  const title = contentSeoTitle({
    explicitTitle: page.seo_title,
    rule: "existing_data",
    settings: seoSettings,
    storeTitle: preview.store.title,
    title: page.title
  });
  const ogTitle = page.og_title || title;
  const ogDescription = page.og_description || description || undefined;
  const ogImage = page.og_image_url || seoSettings.defaultOgImageUrl;

  return {
    description: description || undefined,
    keywords: page.seo_keywords || undefined,
    alternates: page.canonical_url ? { canonical: page.canonical_url } : undefined,
    title: title.includes(preview.store.title) ? title : `${title} | ${preview.store.title}`,
    openGraph: {
      description: ogDescription,
      images: ogImage ? [{ url: ogImage }] : undefined,
      title: ogTitle,
      type: "website"
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      description: ogDescription,
      title: ogTitle
    },
    verification: googleVerificationMetadata(seoSettings),
    robots: { follow: !page.noindex, index: !page.noindex }
  };
}

export async function PublicStorePage({ pageSlug, slug }: PublicStorePageProps) {
  const { page, preview } = await loadPublicStorePage({ pageSlug, slug });

  if (!preview || !page) {
    notFound();
  }

  const renderedContent = preparePageContentForRender(page.content);

  const admin = createAdminClient();
  if (admin && preview.store.workspaceId) {
    await admin.from("page_activity_logs" as never).insert({
      action: "page_opened",
      page_id: page.id,
      store_id: preview.store.id,
      workspace_id: preview.store.workspaceId
    } as never);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-ink sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.9)] sm:p-8">
        <Link
          className="text-sm font-black text-muted transition hover:text-ink"
          href={`/store/${preview.store.slug}`}
        >
          Back to {preview.store.title}
        </Link>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Store page
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">
          {page.title}
        </h1>
        {renderedContent ? (
          <div
            className="prose prose-slate mt-8 max-w-none whitespace-pre-wrap rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold leading-7 text-ink"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        ) : (
          <p className="mt-8 rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold text-muted">
            This page has no content yet.
          </p>
        )}
      </article>
    </main>
  );
}
