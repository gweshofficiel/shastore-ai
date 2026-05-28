import type { Metadata } from "next";
import Link from "next/link";
import { CartNavLink } from "@/components/storefront/public-store-cart";
import { WishlistPageClient } from "@/components/storefront/public-store-wishlist";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type WishlistPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params
}: WishlistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return {
      title: "Wishlist not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  return {
    title: `Wishlist | ${preview.store.title}`,
    description: `Saved products from ${preview.store.title}.`
  };
}

export default async function StoreWishlistPage({ params }: WishlistPageProps) {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Store not found
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
            This wishlist is not available.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            The store may be unpublished or the public link may be incorrect.
          </p>
        </div>
      </main>
    );
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({
        storeId: preview.store.id,
        supabase: admin
      })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            Store unavailable
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em]">
            This storefront is temporarily unavailable.
          </h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-muted">
            The store owner needs to update their SHASTORE AI subscription before this
            storefront can be viewed again.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              SHASTORE AI Store
            </p>
            <p className="mt-1 text-sm font-black text-ink">{preview.store.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CartNavLink
              currency={preview.store.currency}
              slug={preview.store.slug}
              storeId={preview.store.id}
            />
            <Link
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
              href={`/store/${preview.store.slug}`}
            >
              Back to store
            </Link>
          </div>
        </header>

        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Wishlist
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-ink">
            Saved products
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
            Your wishlist is saved on this browser and scoped to this store only.
          </p>
        </div>

        <WishlistPageClient
          currency={preview.store.currency}
          products={preview.products}
          slug={preview.store.slug}
          storeId={preview.store.id}
        />
      </div>
    </main>
  );
}
