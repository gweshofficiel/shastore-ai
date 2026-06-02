import type { Metadata } from "next";
import Link from "next/link";
import { BackInStockRequest } from "@/components/storefront/back-in-stock-request";
import { CompareButton, CompareNavLink } from "@/components/storefront/product-compare";
import { ProductBadges } from "@/components/storefront/product-badges";
import { ProductQuickView } from "@/components/storefront/product-quick-view";
import { ProductSalesProof } from "@/components/storefront/product-sales-proof";
import { ProductShareButtons } from "@/components/storefront/product-share-buttons";
import { ProductStockUrgency } from "@/components/storefront/product-stock-urgency";
import { GoogleAnalyticsScript, GoogleAnalyticsViewItem } from "@/components/storefront/google-analytics";
import { MetaPixelScript, MetaPixelViewContent } from "@/components/storefront/meta-pixel";
import { AddToCartButton, CartNavLink } from "@/components/storefront/public-store-cart";
import { RecentlyViewedProducts } from "@/components/storefront/recently-viewed-products";
import { WishlistButton, WishlistNavLink } from "@/components/storefront/public-store-wishlist";
import { getPublicStorefrontAccess } from "@/lib/billing/publish-access";
import { getPublicUrl } from "@/lib/deployment/config";
import { getProductRecommendations } from "@/lib/product-recommendations";
import { submitProductQuestion } from "@/lib/product-question-actions";
import { getApprovedProductQuestions } from "@/lib/product-questions";
import { submitProductReview } from "@/lib/product-review-actions";
import { getApprovedProductReviews, getProductReviewSummary, type ProductReviewFilter } from "@/lib/product-reviews";
import {
  getPublicStorefrontPreview,
  type PublicStorefrontProduct
} from "@/lib/public-storefront-preview";
import {
  contentSeoTitle,
  defaultStoreSeoSettings,
  googleVerificationMetadata,
  loadStoreSeoSettings,
  productSeoDescription
} from "@/lib/store-seo";
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
    question?: string;
    review?: string;
    reviewFilter?: string;
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

function productPagePath(storeSlug: string, product: PublicStorefrontProduct) {
  return `/store/${storeSlug}/product/${encodeURIComponent(product.slug || product.id)}`;
}

function productCanonicalUrl(storeSlug: string, product: PublicStorefrontProduct) {
  return product.canonicalUrl || getPublicUrl(productPagePath(storeSlug, product));
}

function absolutePublicUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return getPublicUrl(value);
}

function numericProductPrice(price: number | string | null) {
  const numericPrice = typeof price === "number" ? price : Number(price ?? NaN);
  return Number.isFinite(numericPrice) && numericPrice >= 0 ? numericPrice : null;
}

function productAvailability(product: PublicStorefrontProduct) {
  if (product.inventoryStatus === "out_of_stock") {
    return "https://schema.org/OutOfStock";
  }

  if (product.inventoryStatus === "in_stock" || product.inventoryStatus === "low_stock") {
    return "https://schema.org/InStock";
  }

  if (product.variants.length) {
    const activeVariants = product.variants.filter((variant) => variant.status === "active");
    const hasAvailableVariant = activeVariants.some((variant) => (variant.stockQuantity ?? 0) > 0);

    return hasAvailableVariant ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  }

  if (product.trackInventory) {
    return (product.stockQuantity ?? 0) > 0
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";
  }

  return null;
}

function productJsonLd({
  currency,
  product,
  storeTitle,
  url
}: {
  currency: string;
  product: PublicStorefrontProduct;
  storeTitle: string;
  url: string;
}) {
  const image = absolutePublicUrl(product.ogImageUrl || product.imageUrl);
  const price = numericProductPrice(product.price);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    brand: {
      "@type": "Brand",
      name: storeTitle
    },
    description: product.seoDescription || product.description || `Product from ${storeTitle}`,
    image: image ? [image] : undefined,
    name: product.title,
    sku: product.sku || undefined,
    url
  };

  if (price !== null) {
    const availability = productAvailability(product);

    jsonLd.offers = {
      "@type": "Offer",
      availability: availability ?? undefined,
      price: String(price),
      priceCurrency: currency,
      url
    };
  }

  return jsonLd;
}

function safeJsonLd(value: Record<string, unknown>) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
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

function questionMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    failed: "Question could not be submitted. Please try again.",
    invalid: "Add a clear product question with at least 10 characters.",
    "not-configured": "Product questions are not configured yet.",
    submitted: "Your question was submitted and is awaiting seller approval."
  };

  return status ? messages[status] : null;
}

function ratingStars(rating: number) {
  if (rating <= 0) {
    return "No ratings yet";
  }

  return `${"★".repeat(Math.round(rating))}${"☆".repeat(5 - Math.round(rating))}`;
}

function reviewFilterLabel(filter: ProductReviewFilter) {
  const labels: Record<ProductReviewFilter, string> = {
    highest: "Highest rating",
    lowest: "Lowest rating",
    newest: "Newest",
    verified: "Verified only"
  };

  return labels[filter];
}

function reviewFilterHref({
  filter,
  product,
  slug
}: {
  filter: ProductReviewFilter;
  product: PublicStorefrontProduct;
  slug: string;
}) {
  const params = new URLSearchParams();
  params.set("reviewFilter", filter);
  return `${productPagePath(slug, product)}?${params.toString()}#reviews`;
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

  const seoSettings = admin
    ? await loadStoreSeoSettings(admin, preview.store.id)
    : defaultStoreSeoSettings;
  const title = contentSeoTitle({
    explicitTitle: product.seoTitle,
    rule: seoSettings.productFallbackRule,
    settings: seoSettings,
    storeTitle: preview.store.title,
    title: product.title
  });
  const description =
    product.seoDescription ||
    productSeoDescription({
      description: product.description,
      productTitle: product.title,
      rule: seoSettings.productFallbackRule,
      settings: seoSettings,
      storeTitle: preview.store.title
    });
  const ogTitle = product.ogTitle || title;
  const ogDescription = product.ogDescription || description;
  const ogImage = absolutePublicUrl(product.ogImageUrl || product.imageUrl || seoSettings.defaultOgImageUrl);
  const canonicalUrl = productCanonicalUrl(preview.store.slug, product);

  return {
    alternates: { canonical: canonicalUrl },
    title: title.includes(preview.store.title) ? title : `${title} | ${preview.store.title}`,
    keywords: product.seoKeywords || undefined,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: ogImage ? [{ url: ogImage }] : undefined,
      url: canonicalUrl,
      siteName: preview.store.title,
      type: "website"
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      images: ogImage ? [ogImage] : undefined
    },
    verification: googleVerificationMetadata(seoSettings),
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
  const seoSettings = admin
    ? await loadStoreSeoSettings(admin, preview.store.id)
    : defaultStoreSeoSettings;
  const heroBackground = theme.bannerImageUrl
    ? `linear-gradient(135deg, ${preview.branding.primaryColor}cc, ${preview.branding.secondaryColor}99), url("${theme.bannerImageUrl}") center/cover`
    : `radial-gradient(circle at 20% 10%, ${preview.branding.secondaryColor}55, transparent 34%), linear-gradient(135deg, ${preview.branding.primaryColor}, ${preview.branding.secondaryColor})`;
  const galleryUrls = productGalleryUrls(product.gallery);
  const currency = product.currency || preview.store.currency;
  const canonicalUrl = productCanonicalUrl(preview.store.slug, product);
  const structuredProductData = productJsonLd({
    currency,
    product,
    storeTitle: preview.store.title,
    url: canonicalUrl
  });
  const relatedProducts = (await getProductRecommendations({
    context: "related",
    limit: 4,
    products: preview.products,
    sourceProductId: product.id,
    storeId: preview.store.id
  })).map((recommendation) => recommendation.product);
  const reviewFilter = (query.reviewFilter === "highest" ||
    query.reviewFilter === "lowest" ||
    query.reviewFilter === "verified")
    ? query.reviewFilter
    : "newest";
  const [{ reviews, filter }, summary] = await Promise.all([
    getApprovedProductReviews({
      filter: reviewFilter,
      productId: product.id,
      storeId: preview.store.id
    }),
    getProductReviewSummary({
      productId: product.id,
      storeId: preview.store.id
    })
  ]);
  const questions = await getApprovedProductQuestions({
    productId: product.id,
    storeId: preview.store.id
  });
  const message = reviewMessage(query.review);
  const qaMessage = questionMessage(query.question);

  return (
    <main
      className={`min-h-screen text-ink ${fontClass(theme.bodyFont)} ${fontScaleClass(theme.fontScale)}`}
      style={{ backgroundColor: `${theme.primaryColor}08` }}
    >
      <GoogleAnalyticsScript enabled={seoSettings.googleAnalyticsEnabled} measurementId={seoSettings.googleAnalyticsMeasurementId} />
      <GoogleAnalyticsViewItem
        currency={currency}
        enabled={seoSettings.googleAnalyticsEnabled}
        itemId={product.id}
        itemName={product.title}
        measurementId={seoSettings.googleAnalyticsMeasurementId}
        value={numericProductPrice(product.price)}
      />
      <MetaPixelScript enabled={seoSettings.metaPixelEnabled} pixelId={seoSettings.metaPixelId} />
      <MetaPixelViewContent
        contentId={product.id}
        contentName={product.title}
        currency={currency}
        enabled={seoSettings.metaPixelEnabled}
        pixelId={seoSettings.metaPixelId}
        value={numericProductPrice(product.price)}
      />
      <script
        dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredProductData) }}
        type="application/ld+json"
      />
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
              <CompareNavLink
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
              <ProductSalesProof product={product} />
              <ProductStockUrgency className="mt-5" product={product} />
              <ProductShareButtons productTitle={product.title} />
              <BackInStockRequest
                product={product}
                slug={preview.store.slug}
                storeId={preview.store.id}
              />

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
                <CompareButton
                  currency={currency}
                  product={product}
                  slug={preview.store.slug}
                  storeId={preview.store.id}
                />
              </div>
            </article>
          </div>

          <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Product Q&A
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
              Questions about this product?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Ask the seller about sizing, materials, compatibility, delivery, or anything else about this product.
              Approved answered questions appear below.
            </p>
            {qaMessage ? (
              <div className={`mt-4 rounded-2xl border p-3 text-sm font-bold ${
                query.question === "submitted"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                {qaMessage}
              </div>
            ) : null}
            <form action={submitProductQuestion} className="mt-5 grid gap-3">
              <input name="slug" type="hidden" value={preview.store.slug} />
              <input name="storeId" type="hidden" value={preview.store.id} />
              <input name="workspaceId" type="hidden" value={preview.store.workspaceId ?? ""} />
              <input name="productId" type="hidden" value={product.id} />
              <input
                aria-hidden="true"
                className="hidden"
                name="website"
                tabIndex={-1}
                type="text"
              />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Question *</span>
                <textarea
                  className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  maxLength={2000}
                  minLength={10}
                  name="questionText"
                  placeholder="What would you like to know about this product?"
                  required
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Name</span>
                  <input
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    maxLength={120}
                    name="customerName"
                    placeholder="Optional"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Email</span>
                  <input
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    maxLength={180}
                    name="customerEmail"
                    placeholder="Optional"
                    type="email"
                  />
                </label>
              </div>
              <button
                className="h-12 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800"
                type="submit"
              >
                Submit question
              </button>
            </form>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="text-2xl font-black tracking-[-0.04em] text-ink">
                {questions.length
                  ? `${questions.length} answered ${questions.length === 1 ? "question" : "questions"}`
                  : "No answered questions yet"}
              </h3>
              <div className="mt-5 grid gap-4">
                {questions.length ? (
                  questions.map((question) => (
                    <article className="rounded-3xl border border-slate-100 bg-slate-50 p-4" key={question.id}>
                      <p className="text-sm font-black text-ink">
                        Q: {question.questionText}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-muted">
                        A: {question.answerText}
                      </p>
                      <p className="mt-3 text-xs font-bold text-slate-400">
                        Asked by {question.customerName}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-muted">
                    Seller-approved answers will appear here after moderation.
                  </p>
                )}
              </div>
            </div>
          </section>

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
                          <ProductSalesProof compact product={relatedProduct} />
                          <ProductStockUrgency className="mt-3" compact product={relatedProduct} />
                        </div>
                        <ProductQuickView
                          currency={relatedCurrency}
                          detailsHref={relatedHref}
                          product={relatedProduct}
                          slug={preview.store.slug}
                          storeId={preview.store.id}
                        />
                        <CompareButton
                          currency={relatedCurrency}
                          product={relatedProduct}
                          slug={preview.store.slug}
                          storeId={preview.store.id}
                        />
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

          <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]" id="reviews">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Customer Reviews
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
                {summary.reviewCount
                  ? `${summary.averageRating.toFixed(1)} average rating`
                  : "No approved reviews yet"}
              </h2>
              {summary.reviewCount ? (
                <div className="mt-4 grid gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = summary.ratingBreakdown[rating as 1 | 2 | 3 | 4 | 5];
                    const percent = summary.reviewCount ? Math.round((count / summary.reviewCount) * 100) : 0;

                    return (
                      <div className="grid grid-cols-[56px_minmax(0,1fr)_48px] items-center gap-3 text-xs font-black text-muted" key={rating}>
                        <span>{rating} star</span>
                        <span className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <span
                            className="block h-full rounded-full bg-amber-400"
                            style={{ width: `${percent}%` }}
                          />
                        </span>
                        <span className="text-right">{count}</span>
                      </div>
                    );
                  })}
                  <p className="text-xs font-bold text-muted">
                    {summary.verifiedCount} verified {summary.verifiedCount === 1 ? "purchase" : "purchases"}
                  </p>
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                {(["newest", "highest", "lowest", "verified"] as ProductReviewFilter[]).map((candidate) => (
                  <Link
                    className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                      filter === candidate
                        ? "bg-ink text-white"
                        : "bg-slate-100 text-muted hover:bg-slate-200"
                    }`}
                    href={reviewFilterHref({ filter: candidate, product, slug: preview.store.slug })}
                    key={candidate}
                  >
                    {reviewFilterLabel(candidate)}
                  </Link>
                ))}
              </div>
              <div className="mt-5 grid gap-4">
                {reviews.length ? (
                  reviews.map((review) => (
                    <article className="rounded-3xl border border-slate-100 bg-slate-50 p-4" key={review.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black text-amber-500">{ratingStars(review.rating)}</p>
                            {review.verifiedPurchase ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                                Verified purchase
                              </span>
                            ) : null}
                            {review.featured ? (
                              <span className="rounded-full bg-purple-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-purple-700">
                                Featured
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-1 text-lg font-black text-ink">
                            {review.title || "Customer review"}
                          </h3>
                          <p className="mt-1 text-xs font-bold text-muted">
                            {review.customerName}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted">{review.comment}</p>
                      {review.images.length ? (
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {review.images.map((url) => (
                            <img
                              alt="Customer review image"
                              className="aspect-square rounded-2xl border border-slate-100 object-cover"
                              key={url}
                              src={url}
                            />
                          ))}
                        </div>
                      ) : null}
                      {review.sellerReply ? (
                        <div className="mt-4 rounded-2xl border border-white bg-white p-4 text-sm leading-6 text-muted">
                          <p className="font-black text-ink">Seller reply</p>
                          <p className="mt-1">{review.sellerReply}</p>
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-muted">
                    {filter === "verified"
                      ? "No verified approved reviews yet."
                      : "Approved reviews will appear here after moderation."}
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
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Image URLs</span>
                  <textarea
                    className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    maxLength={3000}
                    name="reviewImages"
                    placeholder="Optional: paste public image URLs, one per line."
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
