import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  absoluteBlogImageUrl,
  loadPublicStoreBlog
} from "@/lib/store-blog-public";

export const dynamic = "force-dynamic";

type StoreBlogPageProps = {
  params: Promise<{ slug: string }>;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Recently published";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export async function generateMetadata({
  params
}: StoreBlogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { articles, preview } = await loadPublicStoreBlog(slug);

  if (!preview) {
    return {
      title: "Blog not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const firstCover = absoluteBlogImageUrl(articles[0]?.coverImageUrl ?? null);
  const description = `Read articles, guides, and updates from ${preview.store.title}.`;

  return {
    title: `Blog | ${preview.store.title}`,
    description,
    openGraph: {
      description,
      images: firstCover ? [{ url: firstCover }] : undefined,
      title: `Blog | ${preview.store.title}`,
      type: "website"
    },
    twitter: {
      card: firstCover ? "summary_large_image" : "summary",
      description,
      images: firstCover ? [firstCover] : undefined,
      title: `Blog | ${preview.store.title}`
    }
  };
}

export default async function StoreBlogPage({
  params
}: StoreBlogPageProps) {
  const { slug } = await params;
  const { articles, preview } = await loadPublicStoreBlog(slug);

  if (!preview) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-ink sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <Link
          className="text-sm font-black text-muted transition hover:text-ink"
          href={`/store/${preview.store.slug}`}
        >
          Back to {preview.store.title}
        </Link>
        <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Store Blog
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">
            Articles from {preview.store.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-muted">
            Guides, updates, and product stories from this store.
          </p>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {articles.length ? (
            articles.map((article) => (
              <article
                className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
                key={article.id}
              >
                {article.coverImageUrl ? (
                  <img
                    alt={article.title}
                    className="aspect-[16/9] w-full object-cover"
                    src={article.coverImageUrl}
                  />
                ) : null}
                <div className="p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {formatDate(article.publishedAt)}
                  </p>
                  <Link href={`/store/${preview.store.slug}/blog/${article.slug}`}>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
                      {article.title}
                    </h2>
                  </Link>
                  {article.excerpt ? (
                    <p className="mt-3 text-sm font-semibold leading-6 text-muted">
                      {article.excerpt}
                    </p>
                  ) : null}
                  <Link
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-ink px-4 text-xs font-black uppercase tracking-[0.14em] text-white"
                    href={`/store/${preview.store.slug}/blog/${article.slug}`}
                  >
                    Read article
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center md:col-span-2">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-ink">
                No published articles yet
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-muted">
                Published articles from this store will appear here.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
