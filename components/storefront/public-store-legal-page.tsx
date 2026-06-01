import type { Metadata } from "next";
import Link from "next/link";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { preparePageContentForRender, textFromPageContent } from "@/lib/store-pages/content";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type StoreLegalPageKind = "privacy" | "refund" | "shipping" | "terms";

type ManagedLegalPage = {
  content: string | null;
  noindex: boolean | null;
  seo_description: string | null;
  seo_title: string | null;
  slug: string;
  title: string;
};

type StoreLegalPageProps = {
  kind: StoreLegalPageKind;
  slug: string;
};

const legalPageConfig = {
  privacy: {
    contentKey: "privacyPolicy",
    fallback:
      "This store has not published a privacy policy yet. Contact the store owner for privacy questions.",
    pageTypes: ["privacy"],
    title: "Privacy policy"
  },
  refund: {
    contentKey: "refundPolicy",
    fallback:
      "This store has not published a refund policy yet. Contact the store owner for refund or exchange questions.",
    pageTypes: ["returns"],
    title: "Refund policy"
  },
  shipping: {
    contentKey: "deliveryNotes",
    fallback:
      "This store has not published a shipping policy yet. Contact the store owner for shipping questions.",
    pageTypes: ["shipping"],
    title: "Shipping policy"
  },
  terms: {
    contentKey: "termsOfService",
    fallback:
      "This store has not published terms of service yet. Contact the store owner for purchase terms.",
    pageTypes: ["terms"],
    title: "Terms of service"
  }
} as const;

async function loadManagedLegalPage({
  kind,
  storeId
}: {
  kind: StoreLegalPageKind;
  storeId: string;
}) {
  const admin = createAdminClient();
  const readClient = admin ?? (await createClient());
  const config = legalPageConfig[kind];
  const { data } = await readClient
    .from("store_pages" as never)
    .select("title, slug, content, seo_title, seo_description, noindex")
    .eq("store_id" as never, storeId as never)
    .eq("status" as never, "published" as never)
    .in("page_type" as never, config.pageTypes as unknown as never)
    .order("updated_at" as never, { ascending: false } as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(1)
    .maybeSingle();

  return (data ?? null) as unknown as ManagedLegalPage | null;
}

export async function generateStoreLegalMetadata({
  kind,
  slug
}: StoreLegalPageProps): Promise<Metadata> {
  const preview = await getPublicStorefrontPreview(slug);
  const config = legalPageConfig[kind];
  const page = preview ? await loadManagedLegalPage({ kind, storeId: preview.store.id }) : null;
  const title = page?.seo_title || page?.title || config.title;
  const description = page?.seo_description || textFromPageContent(page?.content).slice(0, 160);

  return {
    description: description || undefined,
    title: preview ? `${title} | ${preview.store.title}` : `${config.title} | SHASTORE AI`,
    robots: { follow: !page?.noindex, index: false }
  };
}

function StoreUnavailablePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_-60px_rgba(15,23,42,0.9)]">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
          Store unavailable
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
          This store is not available right now.
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          Legal pages are only shown for published public stores.
        </p>
      </div>
    </main>
  );
}

export async function StoreLegalPage({ kind, slug }: StoreLegalPageProps) {
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return <StoreUnavailablePage />;
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return <StoreUnavailablePage />;
  }

  const config = legalPageConfig[kind];
  const page = await loadManagedLegalPage({ kind, storeId: preview.store.id });
  const legacyContent = preview.store[config.contentKey]?.trim() || "";
  const renderedContent = page
    ? preparePageContentForRender(page.content)
    : preparePageContentForRender(legacyContent || config.fallback);
  const title = page?.title || config.title;
  const hasPublishedContent = Boolean(page || legacyContent);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-ink sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.9)] sm:p-8">
        <Link
          className="text-sm font-black text-muted transition hover:text-ink"
          href={`/store/${preview.store.slug}`}
        >
          Back to {preview.store.title}
        </Link>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Store legal page
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">
          {title}
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">
          {hasPublishedContent
            ? `This policy is managed by ${preview.store.title}.`
            : "The store owner can add this content from the dashboard."}
        </p>
        <div
          className="mt-8 whitespace-pre-line rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold leading-7 text-ink"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      </article>
    </main>
  );
}
