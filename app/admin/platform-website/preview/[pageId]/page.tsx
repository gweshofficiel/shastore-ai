import Link from "next/link";
import { AdminBadge, AdminHeader, formatAdminDate } from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import {
  listPageBlocks,
  translatePlatformPageBlock,
  type PlatformPageBlockRecord
} from "@/src/lib/platform-website/platform-blocks-runtime";
import { getPlatformPageEditorContent, type PlatformPageEditorRecord } from "@/src/lib/platform-website/platform-content-storage";
import { getPlatformCanonicalUrl, validatePlatformSeo } from "@/src/lib/platform-website/platform-seo-runtime";
import {
  getPlatformPageFallbackLocale,
  platformLocales,
  type PlatformLocale
} from "@/src/lib/platform-website/platform-translations-runtime";
import type { PublicPlatformPage } from "@/src/lib/platform-website/public-page-resolver";

type PreviewPageProps = {
  params: Promise<{ pageId: string }>;
  searchParams?: Promise<{ locale?: string }>;
};

function text(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bjavascript:/gi, "")
    .trim()
    .slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function jsonRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function bodySections(body: Record<string, unknown>) {
  const sections = Array.isArray(body.sections) ? body.sections : [];

  return sections
    .map((section) => {
      if (!isRecord(section)) {
        return null;
      }

      const heading = text(section.heading ?? section.title, 180);
      const content = text(section.text ?? section.content ?? section.body, 3000);

      return heading || content ? { content, heading } : null;
    })
    .filter((section): section is { content: string; heading: string } => Boolean(section));
}

function blockItems(content: Record<string, unknown>) {
  const items = Array.isArray(content.items) ? content.items : [];

  return items
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const title = text(item.title ?? item.heading ?? item.label, 180);
      const description = text(item.description ?? item.text ?? item.content, 1200);

      return title || description ? { description, title } : null;
    })
    .filter((item): item is { description: string; title: string } => Boolean(item));
}

function pageForPreview(page: PlatformPageEditorRecord): PublicPlatformPage {
  return {
    body: page.body,
    canonicalPath: page.canonicalPath,
    headline: page.headline || page.title,
    id: page.id,
    openGraph: page.openGraph,
    routePath: page.routePath,
    seoDescription: page.seoDescription,
    seoTitle: page.seoTitle,
    slug: page.slug,
    subtitle: page.subtitle,
    title: page.title,
    translations: page.translations
  };
}

function translatePageForAdminPreview(page: PublicPlatformPage, locale: PlatformLocale): PublicPlatformPage {
  const translations = jsonRecord(page.translations);
  const record = jsonRecord(translations[locale]);
  const openGraph = jsonRecord(record.openGraph ?? record.open_graph);
  const translatedBody = jsonRecord(record.body);
  const content = text(record.content, 5000);

  if (!Object.keys(record).length) {
    return page;
  }

  return {
    ...page,
    body: Object.keys(translatedBody).length
      ? translatedBody
      : content
        ? { sections: [{ text: content, type: "translation-preview" }] }
        : page.body,
    canonicalPath: text(record.canonicalPath ?? record.canonical_path, 240) || page.canonicalPath,
    headline: text(record.headline, 240) || page.headline,
    openGraph: Object.keys(openGraph).length ? { ...page.openGraph, ...openGraph } : page.openGraph,
    seoDescription: text(record.seoDescription ?? record.seo_description, 500) || page.seoDescription,
    seoTitle: text(record.seoTitle ?? record.seo_title, 180) || page.seoTitle,
    subtitle: text(record.subtitle, 500) || page.subtitle,
    title: text(record.title, 180) || page.title
  };
}

function toneForStatus(status: string) {
  if (status === "published" || status === "ready") {
    return "green" as const;
  }

  if (status === "hidden" || status === "archived" || status === "missing") {
    return "red" as const;
  }

  return "amber" as const;
}

function PreviewBlock({ block }: { block: PlatformPageBlockRecord }) {
  const body = text(block.content.text ?? block.content.body ?? block.content.description, 3000);
  const items = blockItems(block.content);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{block.blockType}</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">{block.title || "Untitled block"}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminBadge tone={toneForStatus(block.status)}>{block.status}</AdminBadge>
          {block.status === "hidden" ? <AdminBadge tone="red">Hidden block</AdminBadge> : null}
          {block.status !== "published" ? <AdminBadge tone="amber">Unpublished content</AdminBadge> : null}
        </div>
      </div>
      {block.subtitle ? <p className="mt-3 text-sm leading-7 text-slate-500">{block.subtitle}</p> : null}
      {body ? <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{body}</p> : null}
      {items.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {items.map((item, index) => (
            <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={`${item.title}-${index}`}>
              {item.title ? <h3 className="font-black text-slate-900">{item.title}</h3> : null}
              {item.description ? <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default async function AdminPlatformWebsitePreviewPage({
  params,
  searchParams
}: PreviewPageProps) {
  const [{ pageId }, query] = await Promise.all([params, searchParams]);
  const requestedLocale = getPlatformPageFallbackLocale(query?.locale);
  const [editorPage, blocks] = await Promise.all([
    getPlatformPageEditorContent(pageId),
    listPageBlocks(pageId)
  ]);

  if (!editorPage) {
    return (
      <div className="grid gap-6">
        <AdminHeader
          description="The requested platform page preview could not be loaded."
          title="Platform Website Preview"
        />
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Preview error</p>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">Page not found</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">No platform page record matched this preview URL.</p>
          <Link className="mt-6 inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600" href="/admin/platform-website">
            Back to platform pages
          </Link>
        </Card>
      </div>
    );
  }

  const basePage = pageForPreview(editorPage);
  const page = translatePageForAdminPreview(basePage, requestedLocale);
  const translatedBlocks = blocks.map((block) => translatePlatformPageBlock(block, requestedLocale));
  const sections = bodySections(page.body);
  const seo = validatePlatformSeo(page);
  const direction = requestedLocale === "ar" ? "rtl" : "ltr";

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Admin-only preview of platform page content and landing blocks. Draft and hidden content remains unavailable from public routes."
        title={`Preview ${page.title}`}
      />

      <Card className="grid gap-4 p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <AdminBadge tone={editorPage.status === "published" ? "green" : "amber"}>
            {editorPage.status === "published" ? "Published preview" : "Draft preview"}
          </AdminBadge>
          {editorPage.status !== "published" ? <AdminBadge tone="amber">Unpublished content</AdminBadge> : null}
          <AdminBadge tone="blue">Admin-only</AdminBadge>
          <AdminBadge tone={requestedLocale === "ar" ? "amber" : "green"}>{requestedLocale}</AdminBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          {platformLocales.map((locale) => (
            <Link
              className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black uppercase tracking-[0.14em] ${
                requestedLocale === locale
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
              href={`/admin/platform-website/preview/${editorPage.id}?locale=${locale}`}
              key={locale}
            >
              {locale}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50" dir={direction} lang={requestedLocale}>
          <section className="bg-white px-6 py-16 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">SHASTORE AI</p>
            <h1 className="mx-auto mt-3 max-w-4xl text-4xl font-black tracking-[-0.04em] text-slate-950">{page.headline}</h1>
            {page.subtitle ? <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-500">{page.subtitle}</p> : null}
          </section>

          <section className="grid gap-4 px-5 py-5">
            {translatedBlocks.length ? (
              translatedBlocks.map((block) => <PreviewBlock block={block} key={block.id} />)
            ) : sections.length ? (
              sections.map((section, index) => (
                <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" key={`${section.heading}-${index}`}>
                  {section.heading ? <h2 className="text-2xl font-black text-slate-950">{section.heading}</h2> : null}
                  {section.content ? <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-500">{section.content}</p> : null}
                </article>
              ))
            ) : (
              <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black text-slate-950">{page.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">No landing blocks or body sections have been configured yet.</p>
              </article>
            )}
          </section>
        </main>

        <aside className="grid gap-4 self-start xl:sticky xl:top-6">
          <Card className="p-5 lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">SEO preview</p>
            <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-slate-950">{page.seoTitle || page.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{page.seoDescription || page.subtitle || "SEO description is missing."}</p>
            <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-500">
              <p><span className="font-black text-slate-800">Canonical:</span> {getPlatformCanonicalUrl(page)}</p>
              <p><span className="font-black text-slate-800">Open Graph title:</span> {text(page.openGraph.title, 180) || "Missing"}</p>
              <p><span className="font-black text-slate-800">Open Graph description:</span> {text(page.openGraph.description, 300) || "Missing"}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminBadge tone={seo.isReady ? "green" : "amber"}>SEO {seo.isReady ? "ready" : "needs work"}</AdminBadge>
              {seo.missingTitle ? <AdminBadge tone="red">Missing title</AdminBadge> : null}
              {seo.missingDescription ? <AdminBadge tone="red">Missing description</AdminBadge> : null}
              {seo.missingCanonical ? <AdminBadge tone="red">Missing canonical</AdminBadge> : null}
              {seo.missingOpenGraph ? <AdminBadge tone="red">Missing OpenGraph</AdminBadge> : null}
            </div>
          </Card>

          <Card className="grid gap-3 p-5 text-sm leading-6 text-slate-500 lg:p-6">
            <p><span className="font-black text-slate-800">Slug:</span> {editorPage.slug}</p>
            <p><span className="font-black text-slate-800">Route:</span> {editorPage.routePath}</p>
            <p><span className="font-black text-slate-800">Page status:</span> {editorPage.status}</p>
            <p><span className="font-black text-slate-800">Content status:</span> {editorPage.contentStatus}</p>
            <p><span className="font-black text-slate-800">Updated:</span> {formatAdminDate(editorPage.updatedAt)}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link className="inline-flex h-9 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" href={`/admin/platform-website/pages/${editorPage.id}`}>
                Edit page
              </Link>
              <Link className="inline-flex h-9 items-center rounded-full border border-purple-200 bg-purple-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-purple-700" href={`/admin/platform-website/builder/${editorPage.id}`}>
                Builder
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
