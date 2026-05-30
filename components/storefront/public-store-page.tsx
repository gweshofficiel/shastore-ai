import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { sanitizePageContent, textFromPageContent } from "@/lib/store-pages/content";
import { createAdminClient } from "@/lib/supabase/admin";

type StorePageRow = {
  content: string | null;
  id: string;
  seo_description: string | null;
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
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed || !admin) {
    return { page: null, preview };
  }

  const { data } = await admin
    .from("store_pages" as never)
    .select("id, title, slug, content, seo_title, seo_description")
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

  const description = page.seo_description || textFromPageContent(page.content).slice(0, 160);

  return {
    description: description || undefined,
    title: `${page.seo_title || page.title} | ${preview.store.title}`,
    robots: { follow: true, index: true }
  };
}

export async function PublicStorePage({ pageSlug, slug }: PublicStorePageProps) {
  const { page, preview } = await loadPublicStorePage({ pageSlug, slug });

  if (!preview || !page) {
    notFound();
  }

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
        <div
          className="prose prose-slate mt-8 max-w-none rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold leading-7 text-ink"
          dangerouslySetInnerHTML={{ __html: sanitizePageContent(page.content) }}
        />
      </article>
    </main>
  );
}
