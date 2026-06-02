import type { Metadata } from "next";
import {
  AccountLookupForm,
  CustomerAccountShell
} from "@/components/storefront/customer-account-shell";
import { WishlistPageClient } from "@/components/storefront/public-store-wishlist";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type WishlistPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ phone?: string }>;
};

function cleanText(value: string | undefined, maxLength = 120) {
  return (value ?? "").trim().slice(0, maxLength);
}

export async function generateMetadata({ params }: WishlistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  return {
    title: preview ? `Wishlist | ${preview.store.title}` : "Wishlist not found | SHASTORE AI",
    robots: { follow: false, index: false }
  };
}

export default async function CustomerAccountWishlistPage({ params, searchParams }: WishlistPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const phone = cleanText(query.phone, 80);
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return <Unavailable title="This wishlist portal is not available." />;
  }

  const admin = createAdminClient();
  const storefrontAccess = admin
    ? await getPublicStorefrontAccess({ storeId: preview.store.id, supabase: admin })
    : { allowed: true };

  if (!storefrontAccess.allowed) {
    return <Unavailable title="This storefront is temporarily unavailable." />;
  }

  return (
    <CustomerAccountShell
      active="wishlist"
      currency={preview.store.currency}
      description="Wishlist products are scoped to this store and this browser session."
      phone={phone}
      slug={preview.store.slug}
      storeId={preview.store.id}
      storeTitle={preview.store.title}
      title="Wishlist"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <WishlistPageClient
          currency={preview.store.currency}
          products={preview.products}
          slug={preview.store.slug}
          storeId={preview.store.id}
        />
        <AccountLookupForm buttonLabel="Keep phone in account nav" phone={phone} />
      </section>
    </CustomerAccountShell>
  );
}

function Unavailable({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">{title}</h1>
      </div>
    </main>
  );
}
