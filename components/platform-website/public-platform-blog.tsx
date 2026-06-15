import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingNavbar } from "@/components/marketing/navbar";
import {
  getPublishedPlatformBlogPostBySlug,
  listPublishedPlatformBlogPosts,
  platformBlogCanonicalPath,
  platformBlogCanonicalUrl,
  translatePlatformBlogPost,
  type PlatformBlogPostRecord
} from "@/src/lib/platform-website/blog/platform-blog-service";
import { isPlatformLocale } from "@/src/lib/platform-website/platform-translations-runtime";

function text(value: unknown, maxLength = 2000) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function bodySections(content: Record<string, unknown>) {
  const sections = Array.isArray(content.sections) ? content.sections : [];
  const parsedSections = sections
    .map((section) => {
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        return null;
      }

      const value = section as Record<string, unknown>;
      const heading = text(value.heading ?? value.title, 180);
      const body = text(value.text ?? value.content ?? value.body, 5000);

      return heading || body ? { body, heading } : null;
    })
    .filter((section): section is { body: string; heading: string } => Boolean(section));
  const fallbackBody = text(content.text ?? content.body ?? content.content, 5000);

  return parsedSections.length || !fallbackBody
    ? parsedSections
    : [{ body: fallbackBody, heading: "" }];
}

function blogIndexTitle(locale?: string | null) {
  if (locale === "ar") return "مدونة SHASTORE AI";
  if (locale === "fr") return "Blog SHASTORE AI";

  return "SHASTORE AI Blog";
}

function blogIndexDescription(locale?: string | null) {
  if (locale === "ar") return "مقالات وتحديثات منصة SHASTORE AI.";
  if (locale === "fr") return "Articles et mises a jour de la plateforme SHASTORE AI.";

  return "Articles and updates from the SHASTORE AI platform.";
}

function postDescription(post: PlatformBlogPostRecord) {
  return text(post.seoDescription, 160) ||
    text(post.excerpt, 160) ||
    `Read ${post.title} on the SHASTORE AI blog.`;
}

function PublicBlogCard({
  locale,
  post
}: {
  locale?: string | null;
  post: PlatformBlogPostRecord;
}) {
  const href = platformBlogCanonicalPath(post, locale);

  return (
    <article className="rounded-[2rem] border border-line bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
        {post.authorName}
      </p>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-ink">
        <Link href={href}>{post.title}</Link>
      </h2>
      {post.excerpt ? (
        <p className="mt-3 text-sm leading-7 text-muted">{post.excerpt}</p>
      ) : null}
      <Link
        className="mt-5 inline-flex h-10 items-center rounded-full bg-ink px-4 text-xs font-black uppercase tracking-[0.16em] text-white"
        href={href}
      >
        Read article
      </Link>
    </article>
  );
}

export async function generatePublicPlatformBlogIndexMetadata(locale?: string | null): Promise<Metadata> {
  const canonicalUrl = platformBlogCanonicalUrl("/blog", locale);
  const title = blogIndexTitle(locale);
  const description = blogIndexDescription(locale);

  return {
    alternates: {
      canonical: canonicalUrl
    },
    description,
    openGraph: {
      description,
      title,
      type: "website",
      url: canonicalUrl
    },
    robots: {
      follow: true,
      index: true
    },
    title
  };
}

export async function generatePublicPlatformBlogPostMetadata(
  slug: string,
  locale?: string | null
): Promise<Metadata> {
  const post = await getPublishedPlatformBlogPostBySlug(slug);

  if (!post) {
    return {
      robots: {
        follow: false,
        index: false
      }
    };
  }

  const translatedPost = locale ? translatePlatformBlogPost(post, locale) : post;
  const canonicalUrl = platformBlogCanonicalUrl(translatedPost, locale);
  const title = text(translatedPost.seoTitle, 70) || translatedPost.title;
  const description = postDescription(translatedPost);

  return {
    alternates: {
      canonical: canonicalUrl
    },
    description,
    openGraph: {
      description,
      title,
      type: "article",
      url: canonicalUrl
    },
    robots: {
      follow: true,
      index: true
    },
    title
  };
}

export async function renderPublicPlatformBlogIndex(locale?: string | null) {
  const posts = (await listPublishedPlatformBlogPosts()).map((post) =>
    locale ? translatePlatformBlogPost(post, locale) : post
  );
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <div dir={direction} lang={isPlatformLocale(locale) ? locale : "en"}>
      <MarketingNavbar />
      <main className="bg-canvas">
        <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted">SHASTORE AI</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-ink sm:text-6xl">
            {blogIndexTitle(locale)}
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-muted">
            {blogIndexDescription(locale)}
          </p>
        </section>

        <section className="border-t border-line bg-canvas py-14">
          <div className="mx-auto grid max-w-5xl gap-5 px-4 sm:px-6 lg:px-8">
            {posts.length ? (
              posts.map((post) => (
                <PublicBlogCard key={post.id} locale={locale} post={post} />
              ))
            ) : (
              <article className="rounded-[2rem] border border-line bg-white p-6 text-center shadow-sm">
                <h2 className="text-2xl font-black tracking-tight text-ink">No published posts yet</h2>
                <p className="mt-3 text-base leading-8 text-muted">
                  Platform blog posts are being prepared.
                </p>
              </article>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export async function renderPublicPlatformBlogPost(slug: string, locale?: string | null) {
  const post = await getPublishedPlatformBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const translatedPost = locale ? translatePlatformBlogPost(post, locale) : post;
  const sections = bodySections(translatedPost.content);
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <div dir={direction} lang={isPlatformLocale(locale) ? locale : "en"}>
      <MarketingNavbar />
      <main className="bg-canvas">
        <article>
          <header className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted">
              {translatedPost.authorName}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-ink sm:text-6xl">
              {translatedPost.title}
            </h1>
            {translatedPost.excerpt ? (
              <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-muted">
                {translatedPost.excerpt}
              </p>
            ) : null}
          </header>

          <section className="border-t border-line bg-white py-16">
            <div className="mx-auto grid max-w-3xl gap-6 px-4 sm:px-6 lg:px-8">
              {sections.length ? (
                sections.map((section, index) => (
                  <section className="rounded-[2rem] border border-line bg-canvas p-6 shadow-sm" key={`${section.heading}-${index}`}>
                    {section.heading ? (
                      <h2 className="text-2xl font-black tracking-tight text-ink">{section.heading}</h2>
                    ) : null}
                    {section.body ? (
                      <p className="mt-3 whitespace-pre-line text-base leading-8 text-muted">{section.body}</p>
                    ) : null}
                  </section>
                ))
              ) : (
                <section className="rounded-[2rem] border border-line bg-canvas p-6 shadow-sm">
                  <p className="text-base leading-8 text-muted">
                    This platform blog post is published. Article content is being prepared.
                  </p>
                </section>
              )}
            </div>
          </section>
        </article>
      </main>
    </div>
  );
}
