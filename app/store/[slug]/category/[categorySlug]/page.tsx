import type { Metadata } from "next";
import Link from "next/link";
import { AddToCartButton, CartNavLink } from "@/components/storefront/public-store-cart";
import { WishlistButton, WishlistNavLink } from "@/components/storefront/public-store-wishlist";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import { isPublicCategoryTitle } from "@/lib/storefront/catalog-sections";
import { buttonRadiusClass, fontClass, fontScaleClass } from "@/lib/store-theme";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{
    categorySlug: string;
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

function resolveCategory(
  categories: NonNullable<Awaited<ReturnType<typeof getPublicStorefrontPreview>>>["categories"],
  categoryPathSegment: string
) {
  const decodedCategory = decodeURIComponent(categoryPathSegment);

  return categories.find((category) => category.id === decodedCategory || category.slug === decodedCategory);
}

export async function generateMetadata({
  params
}: CategoryPageProps): Promise<Metadata> {
  const { categorySlug, slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return {
      title: "Category not found | SHASTORE AI",
      robots: { follow: false, index: false }
    };
  }

  const category = resolveCategory(preview.categories, categorySlug);

  if (!category || !isPublicCategoryTitle(category.name)) {
    return {
      title: `Category not found | ${preview.store.title}`,
      robots: { follow: false, index: false }
    };
  }

  const title = category.seoTitle || category.name;
  const description =
    category.seoDescription ||
    category.description ||
    `Shop ${category.name} products from ${preview.store.title}, powered by SHASTORE AI.`;
  const ogTitle = category.ogTitle || title;
  const ogDescription = category.ogDescription || description;
  const ogImage = category.ogImageUrl || category.imageUrl;

  return {
    alternates: category.canonicalUrl ? { canonical: category.canonicalUrl } : undefined,
    title: `${title} | ${preview.store.title}`,
    keywords: category.seoKeywords || undefined,
    description,
    openGraph: {
      description: ogDescription,
      images: ogImage ? [{ url: ogImage }] : undefined,
      title: ogTitle,
      type: "website"
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      description: ogDescription,
      title: ogTitle
    },
    robots: { follow: !category.noindex, index: !category.noindex }
  };
}

export default async function PublicCategoryPage({ params }: CategoryPageProps) {
  const { categorySlug, slug } = await params;
  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">
            This category is not available.
          </h1>
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
          <h1 className="text-4xl font-black tracking-[-0.05em]">
            This storefront is temporarily unavailable.
          </h1>
        </div>
      </main>
    );
  }

  const category = resolveCategory(preview.categories, categorySlug);

  if (!category || category.status !== "active" || !isPublicCategoryTitle(category.name)) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Category not found
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
            This category is not available.
          </h1>
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

  const products = preview.products.filter(
    (product) =>
      product.status === "active" &&
      (product.categoryId === category.id || (!product.categoryId && product.categoryName === category.name))
  );
  const theme = preview.themeSettings;
  const categoryHeroBackground = category.imageUrl
    ? undefined
    : `radial-gradient(circle at 20% 10%, ${preview.branding.secondaryColor}44, transparent 34%), linear-gradient(135deg, ${preview.branding.primaryColor}, ${preview.branding.secondaryColor})`;

  return (
    <main
      className={`min-h-screen text-ink ${fontClass(theme.bodyFont)} ${fontScaleClass(theme.fontScale)}`}
      style={{ backgroundColor: `${theme.primaryColor}08` }}
    >
      <section className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header
            className={`mb-5 flex flex-wrap items-center justify-between gap-4 border border-slate-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur ${buttonRadiusClass(theme.buttonStyle)}`}
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
            <div className="flex flex-wrap gap-2">
              <Link
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
                href={`/store/${preview.store.slug}/account`}
              >
                Account
              </Link>
              <CartNavLink
                currency={preview.store.currency}
                slug={preview.store.slug}
                storeId={preview.store.id}
              />
              <WishlistNavLink
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

          <section
            className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-[0_35px_100px_-80px_rgba(15,23,42,0.95)]"
            style={categoryHeroBackground ? { background: categoryHeroBackground } : undefined}
          >
            {category.imageUrl ? (
              <img alt={category.name} className="max-h-80 w-full object-cover" src={category.imageUrl} />
            ) : null}
            <div className="p-8 sm:p-10">
              <p className={`text-xs font-black uppercase tracking-[0.22em] ${category.imageUrl ? "text-slate-400" : "text-white/55"}`}>
                Category
              </p>
              <h1 className={`mt-3 text-4xl font-black tracking-[-0.05em] sm:text-6xl ${category.imageUrl ? "text-ink" : "text-white"} ${fontClass(theme.headingFont)}`}>
                {category.name}
              </h1>
              <p className={`mt-4 max-w-3xl text-sm font-semibold leading-6 ${category.imageUrl ? "text-muted" : "text-white/75"}`}>
                {category.description || "Browse products in this category."}
              </p>
            </div>
          </section>

          <section className="mt-8">
            {products.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => {
                  const currency = product.currency || preview.store.currency;

                  const detailsHref = `/store/${preview.store.slug}/product/${encodeURIComponent(product.slug || product.id)}`;

                  return (
                    <article
                      className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm"
                      key={product.id}
                    >
                      {product.imageUrl ? (
                        <img
                          alt={product.title}
                          className="aspect-square w-full rounded-[1.5rem] object-cover"
                          src={product.imageUrl}
                        />
                      ) : (
                        <div className="aspect-square rounded-[1.5rem] bg-slate-100" />
                      )}
                      <div>
                        <Link href={`/store/${preview.store.slug}/product/${encodeURIComponent(product.slug || product.id)}`}>
                          <h2 className="text-xl font-black tracking-[-0.03em] text-ink transition hover:text-slate-600">
                            {product.title}
                          </h2>
                        </Link>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          {product.description || "No description has been added for this product yet."}
                        </p>
                        <p className="mt-3 text-lg font-black text-ink">
                          {formatProductPrice(product.price, product.priceLabel, currency)}
                        </p>
                      </div>
                      <AddToCartButton
                        currency={currency}
                        detailsHref={detailsHref}
                        product={product}
                        showBuyNow
                        showViewDetails
                        slug={preview.store.slug}
                        storeId={preview.store.id}
                      />
                      <WishlistButton
                        currency={currency}
                        product={product}
                        slug={preview.store.slug}
                        storeId={preview.store.id}
                      />
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
                <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
                  No products available yet
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  Please check back soon.
                </p>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
