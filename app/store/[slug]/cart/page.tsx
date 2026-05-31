import type { Metadata } from "next";
import Link from "next/link";
import { CartPageClient } from "@/components/storefront/public-store-cart";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicShippingMethodsForStore } from "@/lib/public-shipping-methods";
import { getPublicTaxSettingsForStore } from "@/lib/public-tax";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { getEnabledPublicStorePaymentMethods } from "@/lib/store-payment-methods";
import { buttonRadiusClass, fontClass, fontScaleClass } from "@/lib/store-theme";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type StoreCartPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params
}: StoreCartPageProps): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return {
      title: "Cart not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const admin = createAdminClient();

  if (admin) {
    const storefrontAccess = await getPublicStorefrontAccess({
      storeId: preview.store.id,
      supabase: admin
    });

    if (!storefrontAccess.allowed) {
      return {
        title: "Store unavailable | SHASTORE AI",
        robots: { follow: false, index: false }
      };
    }
  }

  return {
    title: `Cart | ${preview.store.title}`,
    description: `Review your cart for ${preview.store.title}.`
  };
}

export default async function StoreCartPage({ params }: StoreCartPageProps) {
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
            This cart is not available.
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

  const [shippingMethods, taxSettings, paymentMethods] = await Promise.all([
    getPublicShippingMethodsForStore(preview.store.id),
    getPublicTaxSettingsForStore(preview.store.id),
    admin ? getEnabledPublicStorePaymentMethods(admin, preview.store.id) : Promise.resolve([])
  ]);
  const theme = preview.themeSettings;

  return (
    <main
      className={`min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8 ${fontClass(theme.bodyFont)} ${fontScaleClass(theme.fontScale)}`}
      style={{ backgroundColor: `${theme.primaryColor}08` }}
    >
      <div className="mx-auto max-w-7xl">
        <header
          className={`mb-6 flex flex-wrap items-center justify-between gap-4 border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur ${buttonRadiusClass(theme.buttonStyle)}`}
        >
          <div className="flex items-center gap-3">
            {theme.logoUrl ? (
              <img
                alt={`${preview.store.title} logo`}
                className="h-10 w-10 rounded-full object-cover"
                src={theme.logoUrl}
              />
            ) : null}
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                SHASTORE AI Store
              </p>
              <p className="mt-1 text-sm font-black text-ink">{preview.store.title}</p>
            </div>
          </div>
          <Link
            className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
            href={`/store/${preview.store.slug}`}
          >
            Back to store
          </Link>
        </header>

        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Cart
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-ink">
            Review your order
          </h1>
          <p className="mt-2 text-sm font-semibold text-muted">
            Checkout styling follows the published theme for {preview.store.title}.
          </p>
        </div>

        <CartPageClient
          currency={preview.store.currency}
          deliverySettings={{
            deliveryEnabled: preview.store.deliveryEnabled,
            deliveryFee: preview.store.deliveryFee,
            deliveryNotes: preview.store.deliveryNotes,
            freeDeliveryThreshold: preview.store.freeDeliveryThreshold,
            pickupEnabled: preview.store.pickupEnabled
          }}
          products={preview.products}
          paymentMethods={paymentMethods}
          shippingMethods={shippingMethods}
          slug={preview.store.slug}
          storeId={preview.store.id}
          taxSettings={taxSettings}
        />
      </div>
    </main>
  );
}
