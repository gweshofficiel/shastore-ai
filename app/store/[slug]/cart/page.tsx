import type { Metadata } from "next";
import Link from "next/link";
import { GoogleAnalyticsScript } from "@/components/storefront/google-analytics";
import { StorefrontLanguageSwitcher } from "@/components/storefront/language-switcher";
import { MetaPixelScript } from "@/components/storefront/meta-pixel";
import { CartPageClient, type CartItem } from "@/components/storefront/public-store-cart";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicShippingMethodsForStore } from "@/lib/public-shipping-methods";
import { getPublicTaxSettingsForStore } from "@/lib/public-tax";
import { getPublicStorefrontPreview, type PublicStorefrontProduct } from "@/lib/public-storefront-preview";
import { getEnabledPublicStorePaymentMethods } from "@/lib/store-payment-methods";
import { defaultStoreSeoSettings, loadStoreSeoSettings } from "@/lib/store-seo";
import { buttonRadiusClass, fontClass, fontScaleClass } from "@/lib/store-theme";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

type StoreCartPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    coupon?: string;
    recovery?: string;
  }>;
};

type RecoveryCartSnapshot = {
  items: Json;
  session_id: string;
};

function cleanText(value: string | undefined, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function stockQuantity(value: number | string | null | undefined) {
  return Math.max(0, Math.floor(numericValue(value)));
}

async function loadRecoveryCartSnapshot({
  cartId,
  storeId,
  workspaceId
}: {
  cartId: string;
  storeId: string;
  workspaceId: string | null;
}) {
  const admin = createAdminClient();

  if (!admin || !cartId || !workspaceId) {
    return null;
  }

  const { data } = await admin
    .from("store_abandoned_carts" as never)
    .select("session_id, items")
    .eq("id" as never, cartId as never)
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, storeId as never)
    .in("recovery_status" as never, ["pending", "email_sent"] as never)
    .gt("items_count" as never, 0 as never)
    .maybeSingle();

  return data as RecoveryCartSnapshot | null;
}

function recoveryItemsFromSnapshot({
  currency,
  products,
  snapshot,
  storeId
}: {
  currency: string;
  products: PublicStorefrontProduct[];
  snapshot: RecoveryCartSnapshot | null;
  storeId: string;
}): CartItem[] {
  if (!snapshot || !Array.isArray(snapshot.items)) {
    return [];
  }

  const productsById = new Map(products.map((product) => [product.id, product]));

  const recoveredItems: CartItem[] = [];

  for (const item of snapshot.items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, Json | undefined>;
    const productId = typeof record.productId === "string" ? record.productId : "";
    const product = productsById.get(productId);

    if (!product) {
      continue;
    }

    const variantId = typeof record.variantId === "string" ? record.variantId : null;
    const variant = variantId
      ? product.variants.find((candidate) => candidate.id === variantId) ?? null
      : null;
    const quantity = Math.max(1, Math.floor(numericValue(record.quantity) || 1));

    recoveredItems.push({
      categoryName: product.categoryName,
      currency: product.currency || currency,
      id: `${product.id}:${variant?.id ?? "default"}`,
      image: product.imageUrl,
      inventoryStatus: product.inventoryStatus,
      price: variant?.priceOverride ?? product.price,
      priceLabel: product.priceLabel,
      productId: product.id,
      quantity,
      stockQuantity: variant ? stockQuantity(variant.stockQuantity) : product.stockQuantity,
      storeId,
      title: product.title,
      trackInventory: product.trackInventory,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? (typeof record.variantName === "string" ? record.variantName : null),
      variantOptions: {},
      variantSku: variant?.sku ?? null
    });
  }

  return recoveredItems;
}

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

export default async function StoreCartPage({ params, searchParams }: StoreCartPageProps) {
  const { slug } = await params;
  const query = await searchParams;
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

  const [shippingMethods, taxSettings, paymentMethods, seoSettings] = await Promise.all([
    getPublicShippingMethodsForStore(preview.store.id),
    getPublicTaxSettingsForStore(preview.store.id),
    admin ? getEnabledPublicStorePaymentMethods(admin, preview.store.id) : Promise.resolve([]),
    admin ? loadStoreSeoSettings(admin, preview.store.id) : Promise.resolve(defaultStoreSeoSettings)
  ]);
  const recoverySnapshot = await loadRecoveryCartSnapshot({
    cartId: cleanText(query.recovery, 80),
    storeId: preview.store.id,
    workspaceId: preview.store.workspaceId
  });
  const initialRecoveryItems = recoveryItemsFromSnapshot({
    currency: preview.store.currency,
    products: preview.products,
    snapshot: recoverySnapshot,
    storeId: preview.store.id
  });
  const theme = preview.themeSettings;

  return (
    <main
      className={`min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8 ${fontClass(theme.bodyFont)} ${fontScaleClass(theme.fontScale)}`}
      style={{ backgroundColor: `${theme.primaryColor}08` }}
    >
      <GoogleAnalyticsScript enabled={seoSettings.googleAnalyticsEnabled} measurementId={seoSettings.googleAnalyticsMeasurementId} />
      <MetaPixelScript enabled={seoSettings.metaPixelEnabled} pixelId={seoSettings.metaPixelId} />
      <div className="fixed right-4 top-4 z-50">
        <StorefrontLanguageSwitcher settings={preview.store.languageSettings} />
      </div>
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
          initialCouponCode={query.coupon}
          initialRecoveryItems={initialRecoveryItems}
          initialRecoverySessionId={recoverySnapshot?.session_id ?? null}
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
