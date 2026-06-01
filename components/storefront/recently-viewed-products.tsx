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
  currentProductId: string;
  currency: string;
  products: PublicStorefrontProduct[];
  slug: string;
  storeId: string;
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

export function RecentlyViewedProducts({
  currentProductId,
  currency,
  products,
  slug,
  storeId
}: RecentlyViewedProductsProps) {
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  useEffect(() => {
    const key = recentlyViewedStorageKey(storeId);
    const existingProductIds = parseRecentlyViewedProductIds(window.localStorage.getItem(key));
    const nextProductIds = [
      currentProductId,
      ...existingProductIds.filter((productId) => productId !== currentProductId)
    ].slice(0, RECENTLY_VIEWED_LIMIT);

    setRecentProductIds(existingProductIds);
    window.localStorage.setItem(key, JSON.stringify(nextProductIds));
  }, [currentProductId, storeId]);

  const recentProducts = recentProductIds
    .filter((productId) => productId !== currentProductId)
    .map((productId) => productById.get(productId) ?? null)
    .filter((product): product is PublicStorefrontProduct => Boolean(product && product.status === "active"))
    .slice(0, RECENTLY_VIEWED_DISPLAY_LIMIT);

  if (!recentProducts.length) {
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
            Pick up where you left off
          </h2>
        </div>
        <Link
          className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
          href={`/store/${slug}`}
        >
          Browse store
        </Link>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {recentProducts.map((product) => {
          const productHref = `/store/${slug}/product/${encodeURIComponent(product.slug || product.id)}`;
          const productCurrency = product.currency || currency;

          return (
            <article
              className="group overflow-hidden rounded-[1.75rem] border border-slate-100 bg-slate-50 transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl"
              key={product.id}
            >
              <Link className="relative block" href={productHref}>
                <ProductBadges className="absolute left-3 top-3 z-10" product={product} />
                {product.imageUrl ? (
                  <img
                    alt={product.title}
                    className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                    src={product.imageUrl}
                  />
                ) : (
                  <div className="flex aspect-square items-end bg-slate-900 p-5 text-white">
                    <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white backdrop-blur">
                      {isPublicCategoryTitle(product.categoryName) ? product.categoryName : "Product"}
                    </span>
                  </div>
                )}
              </Link>
              <div className="grid gap-3 p-4">
                {isPublicCategoryTitle(product.categoryName) ? (
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {product.categoryName}
                  </p>
                ) : null}
                <div>
                  <Link href={productHref}>
                    <h3 className="line-clamp-2 text-lg font-black tracking-[-0.03em] text-ink">
                      {product.title}
                    </h3>
                  </Link>
                  <p className="mt-2 text-sm font-black text-ink">
                    {formatProductPrice(product.price, product.priceLabel, productCurrency)}
                  </p>
                  <ProductSalesProof compact product={product} />
                  <ProductStockUrgency className="mt-3" compact product={product} />
                </div>
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
