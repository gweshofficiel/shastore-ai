"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CompareButton } from "@/components/storefront/product-compare";
import { ProductBadges } from "@/components/storefront/product-badges";
import { ProductQuickView } from "@/components/storefront/product-quick-view";
import { ProductSalesProof } from "@/components/storefront/product-sales-proof";
import { ProductStockUrgency } from "@/components/storefront/product-stock-urgency";
import { AddToCartButton } from "@/components/storefront/public-store-cart";
import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";
import { isPublicCategoryTitle } from "@/lib/storefront/catalog-sections";

type RecentlyViewedProductsProps = {
  currentProductId?: string | null;
  currency: string;
  displayLimit?: number;
  fallbackProducts?: PublicStorefrontProduct[];
  fallbackTitle?: string;
  products: PublicStorefrontProduct[];
  slug: string;
  storeId: string;
  title?: string;
  trackCurrentProduct?: boolean;
};

const RECENTLY_VIEWED_LIMIT = 8;
const RECENTLY_VIEWED_DISPLAY_LIMIT = 4;

function recentlyViewedStorageKey(storeId: string) {
  return `shastore_recently_viewed_${storeId}`;
}

function parseRecentlyViewedProductIds(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return Array.from(
      new Set(
        parsed
          .map((item) => {
            if (typeof item === "string") {
              return item;
            }

            if (item && typeof item === "object") {
              const record = item as Record<string, unknown>;
              return typeof record.productId === "string"
                ? record.productId
                : typeof record.id === "string"
                  ? record.id
                  : null;
            }

            return null;
          })
          .filter((item): item is string => Boolean(item))
      )
    );
  } catch {
    return [];
  }
}

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

function isPublicProductStatus(status: string | null) {
  return status === "active" || status === "published";
}

export function RecentlyViewedProducts({
  currentProductId = null,
  currency,
  displayLimit = RECENTLY_VIEWED_DISPLAY_LIMIT,
  fallbackProducts = [],
  fallbackTitle = "Newest products to explore",
  products,
  slug,
  storeId,
  title = "Pick up where you left off",
  trackCurrentProduct = true
}: RecentlyViewedProductsProps) {
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  useEffect(() => {
    const key = recentlyViewedStorageKey(storeId);
    const existingProductIds = parseRecentlyViewedProductIds(window.localStorage.getItem(key));
    const cleanCurrentProductId = currentProductId?.trim() ?? "";

    if (!trackCurrentProduct || !cleanCurrentProductId || !productById.has(cleanCurrentProductId)) {
      setRecentProductIds(existingProductIds.slice(0, RECENTLY_VIEWED_LIMIT));
      return;
    }

    const nextProductIds = [
      cleanCurrentProductId,
      ...existingProductIds.filter((productId) => productId !== cleanCurrentProductId)
    ].slice(0, RECENTLY_VIEWED_LIMIT);

    setRecentProductIds(existingProductIds);
    window.localStorage.setItem(key, JSON.stringify(nextProductIds));
  }, [currentProductId, productById, storeId, trackCurrentProduct]);

  const recentProducts = recentProductIds
    .filter((productId) => productId !== currentProductId)
    .map((productId) => productById.get(productId) ?? null)
    .filter((product): product is PublicStorefrontProduct => Boolean(product && isPublicProductStatus(product.status)))
    .slice(0, Math.max(1, Math.min(displayLimit, RECENTLY_VIEWED_LIMIT)));
  const displayProducts = recentProducts.length
    ? recentProducts
    : fallbackProducts
        .filter((product) => isPublicProductStatus(product.status))
        .filter((product) => product.id !== currentProductId)
        .slice(0, Math.max(1, Math.min(displayLimit, RECENTLY_VIEWED_LIMIT)));
  const displayTitle = recentProducts.length ? title : fallbackTitle;

  if (!displayProducts.length) {
    return null;
  }

  return (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Recently Viewed
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
            {displayTitle}
          </h2>
        </div>
        <Link
          className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
          href={`/store/${slug}`}
        >
          Browse store
        </Link>
      </div>
      <div className="mt-6 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {displayProducts.map((product) => {
          const productHref = `/store/${slug}/product/${encodeURIComponent(product.slug || product.id)}`;
          const productCurrency = product.currency || currency;

          return (
            <article
              className="group flex min-h-[42rem] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 bg-slate-50 transition hover:border-slate-300 hover:shadow-xl"
              key={product.id}
            >
              <Link className="relative block shrink-0 overflow-hidden rounded-t-[inherit]" href={productHref}>
                <ProductBadges className="absolute inset-x-3 top-3 z-10" product={product} />
                {product.imageUrl ? (
                  <img
                    alt={product.title}
                    className="block h-56 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-60"
                    src={product.imageUrl}
                  />
                ) : (
                  <div className="flex h-56 items-end bg-slate-900 p-5 text-white sm:h-60">
                    <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white backdrop-blur">
                      {isPublicCategoryTitle(product.categoryName) ? product.categoryName : "Product"}
                    </span>
                  </div>
                )}
              </Link>
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
                {isPublicCategoryTitle(product.categoryName) ? (
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {product.categoryName}
                  </p>
                ) : null}
                <div>
                  <Link href={productHref}>
                    <h3 className="text-xl font-black leading-tight tracking-[-0.03em] text-ink">
                      {product.title}
                    </h3>
                  </Link>
                  <p className="mt-3 text-xl font-black leading-none text-ink">
                    {formatProductPrice(product.price, product.priceLabel, productCurrency)}
                  </p>
                  <ProductSalesProof compact product={product} />
                  <ProductStockUrgency className="mt-3" compact product={product} />
                </div>
                <div className="mt-auto grid min-w-0 gap-2 pt-4">
                  <ProductQuickView
                    currency={productCurrency}
                    detailsHref={productHref}
                    product={product}
                    slug={slug}
                    storeId={storeId}
                  />
                  <CompareButton
                    currency={productCurrency}
                    product={product}
                    slug={slug}
                    storeId={storeId}
                  />
                  <AddToCartButton
                    currency={productCurrency}
                    detailsHref={productHref}
                    product={product}
                    showViewDetails
                    slug={slug}
                    storeId={storeId}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
