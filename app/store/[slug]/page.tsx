import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  StorefrontTenantContextScript,
  StorefrontThemeTokens
} from "@/lib/storefront/context";
import { AddToCartButton, CartNavLink } from "@/components/storefront/public-store-cart";
import { DynamicSectionLoader } from "@/lib/storefront/sections";
import {
  getCurrentStoreContext,
  resolveTenantStore
} from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

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
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const context = await resolveTenantStore({ slug, source: "slug" });
  const preview = context?.preview;

  if (!preview) {
    return {
      title: "Store not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const title = preview.store.title;
  const description =
    preview.store.description ||
    `Preview ${preview.store.title}, powered by SHASTORE AI.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: preview.store.title,
      type: "website"
    },
    twitter: {
      card: "summary",
      title,
      description
    },
    robots: { index: true, follow: true }
  };
}

export default async function PublicStorePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getCurrentStoreContext(slug);
  const preview = context?.preview;

  if (!preview || !context) {
    notFound();
  }

  const { branding, products, store } = preview;
  const theme = preview.themeSettings;
  const categorizedProductIds = new Set<string>();
  const categorySections = preview.categories.map((category) => {
    const categoryProducts = products.filter((product) => {
      const matchesCategory =
        product.categoryId === category.id ||
        (!product.categoryId && product.categoryName === category.name);

      if (matchesCategory) {
        categorizedProductIds.add(product.id);
      }

      return matchesCategory;
    });

    return { category, products: categoryProducts };
  });
  const uncategorizedProducts = products.filter((product) => !categorizedProductIds.has(product.id));
  const productSections = categorySections.length
    ? [
        ...categorySections,
        ...(uncategorizedProducts.length
          ? [
              {
                category: {
                  description: "Products that are not assigned to a category yet.",
                  id: "uncategorized",
                  imageUrl: null,
                  name: "More products"
                },
                products: uncategorizedProducts
              }
            ]
          : [])
      ]
    : [
        {
          category: {
            description: "Products shown here are published products scoped to this store only.",
            id: "featured",
            imageUrl: null,
            name: "Featured products"
          },
          products
        }
      ];
  const heroBackground = theme.bannerImageUrl
    ? `linear-gradient(135deg, ${branding.primaryColor}cc, ${branding.secondaryColor}99), url("${theme.bannerImageUrl}") center/cover`
    : `radial-gradient(circle at 20% 10%, ${branding.secondaryColor}55, transparent 34%), linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`;
  const fallbackStorefront = (
    <>
      <section className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              {theme.logoUrl ? (
                <img
                  alt={`${store.title} logo`}
                  className="h-10 w-10 rounded-full object-cover"
                  src={theme.logoUrl}
                />
              ) : null}
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  SHASTORE AI Store
                </p>
                <p className="mt-1 text-sm font-black text-ink">{store.title}</p>
              </div>
            </div>
            <CartNavLink slug={store.slug} />
          </header>

          <div
            className="overflow-hidden rounded-[2.5rem] px-6 py-16 text-white shadow-[0_35px_100px_-70px_rgba(15,23,42,0.95)] sm:px-10 lg:px-14 lg:py-24"
            style={{ background: heroBackground }}
          >
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-white/55">
                Public Storefront
              </p>
              <h1 className="mt-5 text-5xl font-black leading-none tracking-[-0.07em] sm:text-7xl lg:text-8xl">
                {theme.heroTitle || store.title}
              </h1>
              <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-white/75 sm:text-lg">
                {theme.heroSubtitle ||
                  store.description ||
                  "A clean SHASTORE AI storefront preview for this claimed store."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950">
                  Browse products
                </span>
                <span className="rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white/80">
                  {products.length} {products.length === 1 ? "product" : "products"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Catalog
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
                Featured products
              </h2>
            </div>
            <p className="max-w-xl text-sm font-semibold leading-6 text-muted">
              Products shown here are published products scoped to this store only.
            </p>
          </div>

          {products.length || preview.categories.length ? (
            <div className="grid gap-8">
              {productSections.map((section) => (
                <div className="grid gap-5" key={section.category.id}>
                  <div className="flex flex-col gap-2 rounded-[2rem] border border-slate-200 bg-white p-5">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                      Category
                    </p>
                    <h3 className="text-2xl font-black tracking-[-0.03em] text-ink">
                      {section.category.name}
                    </h3>
                    <p className="text-sm leading-6 text-muted">
                      {section.category.description ||
                        "Products assigned to this category will appear here."}
                    </p>
                  </div>
                  {section.products.length ? (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {section.products.map((product) => {
                const whatsappHref = whatsappProductHref(
                  store.whatsappNumber,
                  store.title,
                  product.title
                );

                return (
                  <article
                    className="group flex flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] transition hover:-translate-y-1 hover:border-slate-300"
                    key={product.id}
                  >
                    <Link href={`/store/${store.slug}/product/${encodeURIComponent(product.id)}`}>
                      {product.imageUrl ? (
                        <img
                          alt={product.title}
                          className="aspect-[4/3] w-full object-cover"
                          src={product.imageUrl}
                        />
                      ) : (
                        <div
                          className="flex aspect-[4/3] items-end p-5"
                          style={{
                            background: `linear-gradient(135deg, ${branding.primaryColor}16, ${branding.secondaryColor}24)`
                          }}
                        >
                          <span
                            className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm"
                            style={{ backgroundColor: branding.primaryColor }}
                          >
                            {product.categoryName ?? "Product"}
                          </span>
                        </div>
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col p-5">
                      {product.categoryName ? (
                        <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          {product.categoryName}
                        </p>
                      ) : null}
                      <Link href={`/store/${store.slug}/product/${encodeURIComponent(product.id)}`}>
                        <h3 className="text-xl font-black tracking-[-0.03em] text-ink transition hover:text-slate-600">
                          {product.title}
                        </h3>
                      </Link>
                      <p className="mt-3 min-h-12 text-sm leading-6 text-muted">
                        {product.description || "No description has been added for this product yet."}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                        <p className="text-lg font-black text-ink">
                          {formatProductPrice(product.price, product.priceLabel, store.currency)}
                        </p>
                        {product.sku ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                            {product.sku}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-5 grid gap-2">
                        <AddToCartButton product={product} slug={store.slug} />
                        <Link
                          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-ink transition hover:border-slate-300 hover:bg-slate-50"
                          href={`/store/${store.slug}/product/${encodeURIComponent(product.id)}`}
                        >
                          View product details
                        </Link>
                        {whatsappHref ? (
                          <a
                            className="inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-black text-white transition"
                            href={whatsappHref}
                            rel="noreferrer"
                            style={{ backgroundColor: theme.accentColor }}
                            target="_blank"
                          >
                            Order on WhatsApp
                          </a>
                        ) : (
                          <button
                            className="h-11 rounded-full bg-slate-100 px-4 text-sm font-black text-slate-400"
                            disabled
                            type="button"
                          >
                            WhatsApp unavailable
                          </button>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <button
                            className="h-11 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-400"
                            disabled
                            type="button"
                          >
                            Pay by Card · Coming soon
                          </button>
                          <button
                            className="h-11 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-400"
                            disabled
                            type="button"
                          >
                            PayPal · Coming soon
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                      <h4 className="text-xl font-black tracking-[-0.03em] text-ink">
                        No products in this category yet
                      </h4>
                      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                        Assign products to {section.category.name} from the store dashboard.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
              <h3 className="text-2xl font-black tracking-[-0.03em] text-ink">
                No products yet
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                This store is live, but the catalog is empty. Products added in Store Builder
                will appear here after the store is saved and published.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );

  return (
    <main className="min-h-screen bg-slate-50 text-ink">
      <StorefrontThemeTokens context={context} />
      <StorefrontTenantContextScript context={context} />
      <DynamicSectionLoader context={context} fallback={fallbackStorefront} />
      <footer
        className="px-4 py-8 sm:px-6 lg:px-8"
        style={{
          backgroundColor: theme.footerBackgroundColor,
          color: theme.footerTextColor
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-bold">
            {theme.copyrightText || `© ${new Date().getFullYear()} ${store.title}`}
          </p>
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-75">
            Powered by SHASTORE AI
          </p>
        </div>
      </footer>
    </main>
  );
}
