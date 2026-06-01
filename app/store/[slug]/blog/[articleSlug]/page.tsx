import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  absoluteBlogImageUrl,
  loadPublicStoreBlogArticle
} from "@/lib/store-blog-public";

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

  const image = absoluteBlogImageUrl(article.coverImageUrl);
  const description = article.excerpt || article.content.slice(0, 160);

  return {
    title: `${article.title} | ${preview.store.title}`,
    description,
    openGraph: {
      description,
      images: image ? [{ url: image }] : undefined,
      title: article.title,
      type: "article"
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      description,
      images: image ? [image] : undefined,
      title: article.title
    }
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

  const publishedDate = formatDate(article.publishedAt);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-ink sm:px-6 lg:px-8">
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
