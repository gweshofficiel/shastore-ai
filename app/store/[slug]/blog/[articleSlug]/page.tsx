import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MetaPixelScript } from "@/components/storefront/meta-pixel";
import {
  absoluteBlogImageUrl,
  loadPublicStoreBlogArticle
} from "@/lib/store-blog-public";
import {
  contentSeoTitle,
  defaultStoreSeoSettings,
  googleVerificationMetadata,
  loadStoreSeoSettings,
  productSeoDescription
} from "@/lib/store-seo";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type StoreBlogArticlePageProps = {
  params: Promise<{
    articleSlug: string;
    slug: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export async function generateMetadata({
  params
}: StoreBlogArticlePageProps): Promise<Metadata> {
  const { articleSlug, slug } = await params;
  const { article, preview } = await loadPublicStoreBlogArticle({ articleSlug, slug });

  if (!preview || !article) {
    return {
      title: "Article not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const admin = createAdminClient();
  const seoSettings = admin
    ? await loadStoreSeoSettings(admin, preview.store.id)
    : defaultStoreSeoSettings;
  const image = absoluteBlogImageUrl(article.ogImageUrl || article.coverImageUrl || seoSettings.defaultOgImageUrl);
  const title = contentSeoTitle({
    explicitTitle: article.seoTitle,
    rule: seoSettings.blogFallbackRule,
    settings: seoSettings,
    storeTitle: preview.store.title,
    title: article.title
  });
  const description =
    article.seoDescription ||
    productSeoDescription({
      description: article.excerpt || article.content.slice(0, 160),
      productTitle: article.title,
      rule: seoSettings.blogFallbackRule,
      settings: seoSettings,
      storeTitle: preview.store.title
    });

  return {
    alternates: article.canonicalUrl ? { canonical: article.canonicalUrl } : undefined,
    title: title.includes(preview.store.title) ? title : `${title} | ${preview.store.title}`,
    description,
    openGraph: {
      description: article.ogDescription || description,
      images: image ? [{ url: image }] : undefined,
      title: article.ogTitle || title,
      type: "article"
    },
    robots: { follow: !article.noindex, index: !article.noindex },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      description: article.ogDescription || description,
      images: image ? [image] : undefined,
      title: article.ogTitle || title
    },
    verification: googleVerificationMetadata(seoSettings)
  };
}

export default async function StoreBlogArticlePage({
  params
}: StoreBlogArticlePageProps) {
  const { articleSlug, slug } = await params;
  const { article, preview } = await loadPublicStoreBlogArticle({ articleSlug, slug });

  if (!preview || !article) {
    notFound();
  }

  const admin = createAdminClient();
  const seoSettings = admin
    ? await loadStoreSeoSettings(admin, preview.store.id)
    : defaultStoreSeoSettings;
  const publishedDate = formatDate(article.publishedAt);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-ink sm:px-6 lg:px-8">
      <MetaPixelScript enabled={seoSettings.metaPixelEnabled} pixelId={seoSettings.metaPixelId} />
      <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_-60px_rgba(15,23,42,0.9)]">
        {article.coverImageUrl ? (
          <img
            alt={article.title}
            className="aspect-[16/9] w-full object-cover"
            src={article.coverImageUrl}
          />
        ) : null}
        <div className="p-6 sm:p-8">
          <Link
            className="text-sm font-black text-muted transition hover:text-ink"
            href={`/store/${preview.store.slug}/blog`}
          >
            Back to blog
          </Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            {publishedDate || "Store article"}
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">
            {article.title}
          </h1>
          {article.excerpt ? (
            <p className="mt-4 text-lg font-semibold leading-8 text-muted">
              {article.excerpt}
            </p>
          ) : null}
          <div className="mt-8 whitespace-pre-wrap rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold leading-7 text-ink">
            {article.content}
          </div>
        </div>
      </article>
    </main>
  );
}
