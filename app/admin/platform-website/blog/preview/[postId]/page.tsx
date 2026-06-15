import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  formatAdminDate
} from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import {
  getPlatformBlogPostForAdmin,
  translatePlatformBlogPost
} from "@/src/lib/platform-website/blog/platform-blog-service";
import { isPlatformLocale, platformLocales } from "@/src/lib/platform-website/platform-translations-runtime";

function text(value: unknown, maxLength = 2000) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function bodySections(content: Record<string, unknown>) {
  const sections = Array.isArray(content.sections) ? content.sections : [];
  const parsed = sections
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
  const fallback = text(content.text ?? content.body ?? content.content, 5000);

  return parsed.length || !fallback ? parsed : [{ body: fallback, heading: "" }];
}

export default async function AdminPlatformBlogPreviewPage({
  params,
  searchParams
}: {
  params: Promise<{ postId: string }>;
  searchParams?: Promise<{ locale?: string }>;
}) {
  const [{ postId }, query] = await Promise.all([params, searchParams]);
  const post = await getPlatformBlogPostForAdmin(postId);
  const locale = isPlatformLocale(query?.locale) ? query?.locale : "en";

  if (!post) {
    return (
      <div className="grid gap-6">
        <AdminHeader
          description="The requested platform blog post preview could not be loaded."
          title="Platform Blog Preview"
        />
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Preview error</p>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">Post not found</h1>
          <Link
            className="mt-6 inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600"
            href="/admin/platform-website"
          >
            Back to platform website
          </Link>
        </Card>
      </div>
    );
  }

  const previewPost = translatePlatformBlogPost(post, locale);
  const sections = bodySections(previewPost.content);

  return (
    <div className="grid gap-6 lg:gap-8" dir={previewPost.direction} lang={locale}>
      <AdminHeader
        description="Admin-only preview for platform blog posts. Draft and archived content is never exposed through public blog routes."
        title={`Preview ${previewPost.title}`}
      />

      <Card className="grid gap-4 p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <AdminBadge tone={post.status === "published" ? "green" : post.status === "archived" ? "red" : "amber"}>
            {post.status} preview
          </AdminBadge>
          <AdminBadge tone="blue">Admin-only</AdminBadge>
          <AdminBadge tone={post.status === "published" ? "green" : "amber"}>
            {post.status === "published" ? "Publicly eligible" : "Not public"}
          </AdminBadge>
        </div>
        <p className="text-sm leading-6 text-slate-500">
          <span className="font-black text-slate-800">Last updated:</span> {formatAdminDate(post.updatedAt)}
        </p>
        <div className="flex flex-wrap gap-2">
          {platformLocales.map((item) => (
            <Link
              className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black uppercase tracking-[0.14em] ${
                item === locale
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
              href={`/admin/platform-website/blog/preview/${post.id}?locale=${item}`}
              key={item}
            >
              {item}
            </Link>
          ))}
          <Link
            className="inline-flex h-9 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
            href={`/admin/platform-website/blog/${post.id}`}
          >
            Edit post
          </Link>
        </div>
      </Card>

      <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <header className="bg-slate-950 px-6 py-16 text-center text-white lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-300">{previewPost.authorName}</p>
          <h1 className="mx-auto mt-3 max-w-4xl text-4xl font-black tracking-[-0.04em] sm:text-6xl">
            {previewPost.title}
          </h1>
          {previewPost.excerpt ? (
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-300">{previewPost.excerpt}</p>
          ) : null}
        </header>
        <div className="grid gap-5 bg-slate-50 p-5 lg:p-8">
          {sections.length ? (
            sections.map((section, index) => (
              <section className="rounded-[2rem] border border-slate-200 bg-white p-6" key={`${section.heading}-${index}`}>
                {section.heading ? <h2 className="text-2xl font-black text-slate-950">{section.heading}</h2> : null}
                {section.body ? <p className="mt-3 whitespace-pre-line text-base leading-8 text-slate-600">{section.body}</p> : null}
              </section>
            ))
          ) : (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6">
              <p className="text-base leading-8 text-slate-600">No article content sections have been added yet.</p>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
