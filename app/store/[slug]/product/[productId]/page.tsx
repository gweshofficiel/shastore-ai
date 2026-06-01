import type { Metadata } from "next";
import Link from "next/link";
import { ProductBadges } from "@/components/storefront/product-badges";
import { AddToCartButton, CartNavLink } from "@/components/storefront/public-store-cart";
import { RecentlyViewedProducts } from "@/components/storefront/recently-viewed-products";
import { WishlistButton, WishlistNavLink } from "@/components/storefront/public-store-wishlist";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { submitProductReview } from "@/lib/product-review-actions";
import { getApprovedProductReviews } from "@/lib/product-reviews";
import {
  getPublicStorefrontPreview,
  type PublicStorefrontProduct
} from "@/lib/public-storefront-preview";
import { isPublicCategoryTitle } from "@/lib/storefront/catalog-sections";
import { buttonRadiusClass, fontClass, fontScaleClass } from "@/lib/store-theme";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProductDetailPageProps = {
  params: Promise<{
    productId: string;
    slug: string;
  }>;
  searchParams: Promise<{
    review?: string;
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

function productGalleryUrls(gallery: unknown[]) {
  return gallery
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return typeof record.url === "string"
          ? record.url
          : typeof record.publicUrl === "string"
            ? record.publicUrl
            : null;
      }

      return null;
    })
    .filter((url): url is string => Boolean(url));
}

function comparableProductPrice(product: PublicStorefrontProduct) {
  const price = typeof product.price === "number" ? product.price : Number(product.price ?? 0);
  return Number.isFinite(price) ? Math.max(0, price) : 0;
}

function relatedProductScore(currentProduct: PublicStorefrontProduct, candidate: PublicStorefrontProduct) {
  const currentPrice = comparableProductPrice(currentProduct);
  const candidatePrice = comparableProductPrice(candidate);
  let score = 0;

  if (candidate.categoryId && candidate.categoryId === currentProduct.categoryId) {
    score += 80;
  } else if (
    candidate.categoryName &&
    currentProduct.categoryName &&
    candidate.categoryName.toLowerCase() === currentProduct.categoryName.toLowerCase()
  ) {
    score += 60;
  }

  if (currentPrice > 0 && candidatePrice > 0) {
    const priceDistance = Math.abs(currentPrice - candidatePrice) / currentPrice;

    if (priceDistance <= 0.2) {
      score += 30;
    } else if (priceDistance <= 0.5) {
      score += 15;
    }
  }

  if (candidate.createdAt) {
    score += 1;
  }

  return score;
}

function resolveRelatedProducts(
  products: PublicStorefrontProduct[],
  currentProduct: PublicStorefrontProduct
) {
  return products
    .filter((candidate) => candidate.id !== currentProduct.id && candidate.status === "active")
    .map((candidate) => ({
      product: candidate,
      score: relatedProductScore(currentProduct, candidate)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return comparableProductPrice(right.product) - comparableProductPrice(left.product);
    })
    .slice(0, 4)
    .map((candidate) => candidate.product);
}

function resolvePublicProduct(
  products: PublicStorefrontProduct[],
  productPathSegment: string
) {
  const decodedProductId = decodeURIComponent(productPathSegment);

  return products.find((item) => item.id === decodedProductId || item.slug === decodedProductId);
}

function reviewMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    failed: "Review could not be submitted. Please try again.",
    invalid: "Choose a rating from 1 to 5 and add a review comment.",
    "not-configured": "Review submission is not configured yet.",
    "purchase-required": "We could not match that order reference and phone to this product.",
    submitted: "Review submitted for moderation."
  };

  return status ? messages[status] : null;
}

function ratingStars(rating: number) {
  if (rating <= 0) {
    return "No ratings yet";
  }

  return `${"★".repeat(Math.round(rating))}${"☆".repeat(5 - Math.round(rating))}`;
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

  const product = resolvePublicProduct(preview.products, productId);

  if (!product) {
    return {
      title: `Product not found | ${preview.store.title}`,
      robots: { follow: false, index: false }
    };
  }

  const title = product.seoTitle || product.title;
  const description =
    product.seoDescription ||
    product.description ||
    `Order ${product.title} from ${preview.store.title}, powered by SHASTORE AI.`;
  const ogTitle = product.ogTitle || title;
  const ogDescription = product.ogDescription || description;
  const ogImage = product.ogImageUrl || product.imageUrl;

  return {
    alternates: product.canonicalUrl ? { canonical: product.canonicalUrl } : undefined,
    title: `${title} | ${preview.store.title}`,
    keywords: product.seoKeywords || undefined,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "website"
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription
    },
    robots: { follow: !product.noindex, index: !product.noindex }
  };
}

export default async function PublicProductDetailPage({
  params,
  searchParams
}: ProductDetailPageProps) {
  const { productId, slug } = await params;
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
            This store is not available.
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

  const product = resolvePublicProduct(preview.products, productId);

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

  const theme = preview.themeSettings;
  const heroBackground = theme.bannerImageUrl
    ? `linear-gradient(135deg, ${preview.branding.primaryColor}cc, ${preview.branding.secondaryColor}99), url("${theme.bannerImageUrl}") center/cover`
    : `radial-gradient(circle at 20% 10%, ${preview.branding.secondaryColor}55, transparent 34%), linear-gradient(135deg, ${preview.branding.primaryColor}, ${preview.branding.secondaryColor})`;
  const galleryUrls = productGalleryUrls(product.gallery);
  const currency = product.currency || preview.store.currency;
  const relatedProducts = resolveRelatedProducts(preview.products, product);
  const { reviews, summary } = await getApprovedProductReviews({
    productId: product.id,
    storeId: preview.store.id
  });
  const message = reviewMessage(query.review);

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

          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-[0_35px_100px_-70px_rgba(15,23,42,0.95)]">
              <ProductBadges className="absolute left-5 top-5 z-10" product={product} />
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
                    {isPublicCategoryTitle(product.categoryName) ? product.categoryName : "Product"}
                  </span>
                </div>
              )}
              {galleryUrls.length ? (
                <div className="grid grid-cols-3 gap-3 border-t border-slate-100 p-4">
                  {galleryUrls.slice(0, 6).map((url) => (
                    <img
                      alt={`${product.title} gallery image`}
                      className="aspect-square rounded-2xl object-cover"
                      key={url}
                      src={url}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <article className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-[0_35px_100px_-80px_rgba(15,23,42,0.95)] sm:p-8 lg:p-10">
              <ProductBadges className="mb-4" product={product} />
              {isPublicCategoryTitle(product.categoryName) ? (
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  {product.categoryName}
                </p>
              ) : null}
              <h1 className="mt-3 text-4xl font-black leading-none tracking-[-0.06em] text-ink sm:text-6xl">
                {product.title}
              </h1>
              <div className="mt-5 flex flex-wrap items-end gap-3">
                <p className="text-2xl font-black text-ink">
                  {formatProductPrice(product.price, product.priceLabel, currency)}
                </p>
                {product.compareAtPrice ? (
                  <p className="text-base font-bold text-slate-400 line-through">
                    {formatProductPrice(product.compareAtPrice, null, currency)}
                  </p>
                ) : null}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  {currency}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-black">
                <span className="text-amber-500">{ratingStars(summary.averageRating)}</span>
                <span className="text-muted">
                  {summary.reviewCount
                    ? `${summary.averageRating.toFixed(1)} from ${summary.reviewCount} ${summary.reviewCount === 1 ? "review" : "reviews"}`
                    : "No approved reviews yet"}
                </span>
              </div>
              <p className="mt-6 text-base leading-8 text-muted">
                {product.description || "No description has been added for this product yet."}
              </p>

              <div className="mt-8 grid gap-3 border-t border-slate-100 pt-6">
                <AddToCartButton
                  currency={currency}
                  detailsHref={`/store/${preview.store.slug}/product/${encodeURIComponent(product.slug || product.id)}`}
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
              </div>
            </article>
          </div>

          {relatedProducts.length ? (
            <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                    Related Products
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
                    You may also like
                  </h2>
                </div>
                <Link
                  className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
                  href={`/store/${preview.store.slug}`}
                >
                  View all products
                </Link>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {relatedProducts.map((relatedProduct) => {
                  const relatedHref = `/store/${preview.store.slug}/product/${encodeURIComponent(relatedProduct.slug || relatedProduct.id)}`;
                  const relatedCurrency = relatedProduct.currency || preview.store.currency;

                  return (
                    <article
                      className="group overflow-hidden rounded-[1.75rem] border border-slate-100 bg-slate-50 transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl"
                      key={relatedProduct.id}
                    >
                      <Link className="relative block" href={relatedHref}>
                        <ProductBadges className="absolute left-3 top-3 z-10" product={relatedProduct} />
                        {relatedProduct.imageUrl ? (
                          <img
                            alt={relatedProduct.title}
                            className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                            src={relatedProduct.imageUrl}
                          />
                        ) : (
                          <div
                            className="flex aspect-square items-end p-5 text-white"
                            style={{ background: heroBackground }}
                          >
                            <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white backdrop-blur">
                              {isPublicCategoryTitle(relatedProduct.categoryName)
                                ? relatedProduct.categoryName
                                : "Product"}
                            </span>
                          </div>
                        )}
                      </Link>
                      <div className="grid gap-3 p-4">
                        {isPublicCategoryTitle(relatedProduct.categoryName) ? (
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                            {relatedProduct.categoryName}
                          </p>
                        ) : null}
                        <div>
                          <Link href={relatedHref}>
                            <h3 className="line-clamp-2 text-lg font-black tracking-[-0.03em] text-ink">
                              {relatedProduct.title}
                            </h3>
                          </Link>
                          <p className="mt-2 text-sm font-black text-ink">
                            {formatProductPrice(relatedProduct.price, relatedProduct.priceLabel, relatedCurrency)}
                          </p>
                        </div>
                        <AddToCartButton
                          currency={relatedCurrency}
                          detailsHref={relatedHref}
                          product={relatedProduct}
                          showViewDetails
                          slug={preview.store.slug}
                          storeId={preview.store.id}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <RecentlyViewedProducts
            currentProductId={product.id}
            currency={preview.store.currency}
            products={preview.products}
            slug={preview.store.slug}
            storeId={preview.store.id}
          />

          <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Customer Reviews
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
                {summary.reviewCount
                  ? `${summary.averageRating.toFixed(1)} average rating`
                  : "No approved reviews yet"}
              </h2>
              <div className="mt-5 grid gap-4">
                {reviews.length ? (
                  reviews.map((review) => (
                    <article className="rounded-3xl border border-slate-100 bg-slate-50 p-4" key={review.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-amber-500">{ratingStars(review.rating)}</p>
                          <h3 className="mt-1 text-lg font-black text-ink">
                            {review.title || "Customer review"}
                          </h3>
                          <p className="mt-1 text-xs font-bold text-muted">
                            {review.customerName}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted">{review.comment}</p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-muted">
                    Approved reviews will appear here after moderation.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Write a Review
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
                Purchased this product?
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Enter your order reference and phone number. Reviews are moderated before publishing.
              </p>
              {message ? (
                <div className={`mt-4 rounded-2xl border p-3 text-sm font-bold ${
                  query.review === "submitted"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}>
                  {message}
                </div>
              ) : null}
              <form action={submitProductReview} className="mt-5 grid gap-3">
                <input name="slug" type="hidden" value={preview.store.slug} />
                <input name="storeId" type="hidden" value={preview.store.id} />
                <input name="workspaceId" type="hidden" value={preview.store.workspaceId ?? ""} />
                <input name="productId" type="hidden" value={product.id} />
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Order reference *</span>
                  <input
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    name="orderReference"
                    placeholder="First 8 characters from your order"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Phone used at checkout *</span>
                  <input
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    name="customerPhone"
                    placeholder="+15551234567"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Rating *</span>
                  <select
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    name="rating"
                    required
                  >
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Okay</option>
                    <option value="2">2 - Poor</option>
                    <option value="1">1 - Bad</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Title</span>
                  <input
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    maxLength={140}
                    name="title"
                    placeholder="Great product"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Comment *</span>
                  <textarea
                    className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    maxLength={2000}
                    name="comment"
                    placeholder="Share your experience."
                    required
                  />
                </label>
                <button
                  className="h-12 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800"
                  type="submit"
                >
                  Submit review
                </button>
              </form>
            </div>
          </section>
        </div>
      </section>
      <footer
        className="px-4 py-8 sm:px-6 lg:px-8"
        style={{
          backgroundColor: theme.footerBackgroundColor,
          color: theme.footerTextColor
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-bold">
            {theme.copyrightText || `© ${new Date().getFullYear()} ${preview.store.title}`}
          </p>
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-75">
            Powered by SHASTORE AI
          </p>
        </div>
      </footer>
    </main>
  );
}
