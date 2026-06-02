import type { Metadata } from "next";
import {
  AccountLookupForm,
  CustomerAccountShell,
  EmptyAccountCard
} from "@/components/storefront/customer-account-shell";
import { CustomerAddressBook } from "@/components/storefront/customer-address-book";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AddressesPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ phone?: string }>;
};

function cleanText(value: string | undefined, maxLength = 120) {
  return (value ?? "").trim().slice(0, maxLength);
}

export async function generateMetadata({ params }: AddressesPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  return {
    title: preview ? `Addresses | ${preview.store.title}` : "Addresses not found | SHASTORE AI",
    robots: { follow: false, index: false }
  };
}

export default async function CustomerAddressesPage({ params, searchParams }: AddressesPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const phone = cleanText(query.phone, 80);
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return <Unavailable title="This address portal is not available." />;
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
      active="addresses"
      currency={preview.store.currency}
      description="Manage saved delivery addresses for this store account."
      phone={phone}
      slug={preview.store.slug}
      storeId={preview.store.id}
      storeTitle={preview.store.title}
      title="Addresses"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {phone ? (
          <CustomerAddressBook
            customerPhone={phone}
            slug={preview.store.slug}
            storeId={preview.store.id}
          />
        ) : (
          <EmptyAccountCard title="Enter your phone number" text="Use the same phone number from checkout before adding saved delivery addresses." />
        )}
        <AccountLookupForm buttonLabel="View addresses" phone={phone} />
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
