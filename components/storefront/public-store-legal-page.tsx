import type { Metadata } from "next";
import Link from "next/link";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreLegalPageKind = "privacy" | "terms" | "refund";

type StoreLegalPageProps = {
  kind: StoreLegalPageKind;
  slug: string;
};

const legalPageConfig = {
  privacy: {
    contentKey: "privacyPolicy",
    fallback:
      "This store has not published a privacy policy yet. Contact the store owner for privacy questions.",
    title: "Privacy policy"
  },
  refund: {
    contentKey: "refundPolicy",
    fallback:
      "This store has not published a refund policy yet. Contact the store owner for refund or exchange questions.",
    title: "Refund policy"
  },
  terms: {
    contentKey: "termsOfService",
    fallback:
      "This store has not published terms of service yet. Contact the store owner for purchase terms.",
    title: "Terms of service"
  }
} as const;

export async function generateStoreLegalMetadata({
  kind,
  slug
}: StoreLegalPageProps): Promise<Metadata> {
  const preview = await getPublicStorefrontPreview(slug);
  const config = legalPageConfig[kind];

  return {
    title: preview ? `${config.title} | ${preview.store.title}` : `${config.title} | SHASTORE AI`,
    robots: { follow: true, index: false }
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
  const content = preview.store[config.contentKey]?.trim() || config.fallback;
  const hasPublishedContent = Boolean(preview.store[config.contentKey]?.trim());

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
          {config.title}
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">
          {hasPublishedContent
            ? `This policy is managed by ${preview.store.title}.`
            : "The store owner can add this content from the dashboard."}
        </p>
        <div className="mt-8 whitespace-pre-line rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold leading-7 text-ink">
          {content}
        </div>
      </article>
    </main>
  );
}
