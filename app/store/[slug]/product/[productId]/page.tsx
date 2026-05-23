import type { Metadata } from "next";
import Link from "next/link";
import { AddToCartButton, CartNavLink } from "@/components/storefront/public-store-cart";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";

export const dynamic = "force-dynamic";

type ProductDetailPageProps = {
  params: Promise<{
    productId: string;
    slug: string;
  }>;
};

function formatProductPrice(price: number | string | null, priceLabel: string | null, currency: string) {
  if (priceLabel) {
    return priceLabel;
  }

  if (price === null || price === undefined || price === "") {
    return "Price coming soon";
  }

  const numericPrice = typeof price === "number" ? price : Number(price);

  if (!Number.isFinite(numericPrice)) {
    return String(price);
  }

  return new Intl.NumberFormat("en", {
    currency: currency || "USD",
    style: "currency"
  }).format(numericPrice);
}

function whatsappProductHref(whatsappNumber: string | null, storeTitle: string, productTitle: string) {
  const number = whatsappNumber?.replace(/\D/g, "");

  if (!number) {
    return null;
  }

  const text = encodeURIComponent(`Hi, I want to order ${productTitle} from ${storeTitle}.`);
  return `https://wa.me/${number}?text=${text}`;
}

export async function generateMetadata({
  params
}: ProductDetailPageProps): Promise<Metadata> {
  const { productId, slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return {
      title: "Store not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const product = preview.products.find((item) => item.id === decodeURIComponent(productId));

  if (!product) {
    return {
      title: `Product not found | ${preview.store.title}`,
      robots: { follow: false, index: false }
    };
  }

  return {
    title: `${product.title} | ${preview.store.title}`,
    description:
      product.description ||
      `Order ${product.title} from ${preview.store.title}, powered by SHASTORE AI.`,
    openGraph: {
      title: `${product.title} | ${preview.store.title}`,
      description: product.description ?? preview.store.description ?? undefined,
      images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
      type: "website"
    },
    twitter: {
      card: product.imageUrl ? "summary_large_image" : "summary",
      title: `${product.title} | ${preview.store.title}`,
      description: product.description ?? preview.store.description ?? undefined
    }
  };
}

export default async function PublicProductDetailPage({
  params
}: ProductDetailPageProps) {
  const { productId, slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Store not found
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
            This store is not available.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            The store may be unpublished or the public link may be incorrect.
          </p>
        </div>
      </main>
    );
  }

  const decodedProductId = decodeURIComponent(productId);
  const product = preview.products.find((item) => item.id === decodedProductId);

  if (!product) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Product not found
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
            This product is not available.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            It may have been removed from the store catalog.
          </p>
          <Link
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white"
            href={`/store/${preview.store.slug}`}
          >
            Back to store
          </Link>
        </div>
      </main>
    );
  }

  const whatsappHref = whatsappProductHref(
    preview.store.whatsappNumber,
    preview.store.title,
    product.title
  );
  const heroBackground = `radial-gradient(circle at 20% 10%, ${preview.branding.secondaryColor}55, transparent 34%), linear-gradient(135deg, ${preview.branding.primaryColor}, #020617)`;

  return (
    <main className="min-h-screen bg-slate-50 text-ink">
      <section className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                SHASTORE AI Store
              </p>
              <p className="mt-1 text-sm font-black text-ink">{preview.store.title}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CartNavLink slug={preview.store.slug} />
              <Link
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
                href={`/store/${preview.store.slug}`}
              >
                Back to store
              </Link>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-[0_35px_100px_-70px_rgba(15,23,42,0.95)]">
              {product.imageUrl ? (
                <img
                  alt={product.title}
                  className="aspect-square w-full object-cover"
                  src={product.imageUrl}
                />
              ) : (
                <div
                  className="flex aspect-square items-end p-8 text-white"
                  style={{ background: heroBackground }}
                >
                  <span className="rounded-full bg-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white backdrop-blur">
                    {product.categoryName ?? "Product"}
                  </span>
                </div>
              )}
            </div>

            <article className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-[0_35px_100px_-80px_rgba(15,23,42,0.95)] sm:p-8 lg:p-10">
              {product.categoryName ? (
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  {product.categoryName}
                </p>
              ) : null}
              <h1 className="mt-3 text-4xl font-black leading-none tracking-[-0.06em] text-ink sm:text-6xl">
                {product.title}
              </h1>
              <p className="mt-5 text-2xl font-black text-ink">
                {formatProductPrice(product.price, product.priceLabel, preview.store.currency)}
              </p>
              <p className="mt-6 text-base leading-8 text-muted">
                {product.description || "No description has been added for this product yet."}
              </p>

              <div className="mt-8 grid gap-3 border-t border-slate-100 pt-6">
                <AddToCartButton product={product} slug={preview.store.slug} />
                {whatsappHref ? (
                  <a
                    className="inline-flex h-12 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700"
                    href={whatsappHref}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Order on WhatsApp
                  </a>
                ) : (
                  <button
                    className="h-12 rounded-full bg-slate-100 px-5 text-sm font-black text-slate-400"
                    disabled
                    type="button"
                  >
                    WhatsApp unavailable
                  </button>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    className="h-12 rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-black text-slate-400"
                    disabled
                    type="button"
                  >
                    Pay by Card · Coming soon
                  </button>
                  <button
                    className="h-12 rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-black text-slate-400"
                    disabled
                    type="button"
                  >
                    PayPal · Coming soon
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
