"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AddToCartButton } from "@/components/storefront/public-store-cart";
import { ProductBadges } from "@/components/storefront/product-badges";
import { ProductSalesProof } from "@/components/storefront/product-sales-proof";
import { ProductStockUrgency } from "@/components/storefront/product-stock-urgency";
import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";

type CompareScope = {
  currency: string;
  slug: string;
  storeId: string;
};

type CompareUpdatedDetail = {
  slug: string;
  storeId: string;
};

const COMPARE_UPDATED_EVENT = "shastore-compare-updated";
const COMPARE_LIMIT = 4;

function compareStorageKey(storeId: string) {
  return `shastore_compare_${storeId}`;
}

function parseCompareProductIds(value: string | null) {
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
    ).slice(0, COMPARE_LIMIT);
  } catch {
    return [];
  }
}

function dispatchCompareUpdated(scope: CompareScope) {
  window.dispatchEvent(
    new CustomEvent<CompareUpdatedDetail>(COMPARE_UPDATED_EVENT, {
      detail: { slug: scope.slug, storeId: scope.storeId }
    })
  );
}

export function readStoreCompare(scope: CompareScope) {
  if (typeof window === "undefined") {
    return [];
  }

  return parseCompareProductIds(window.localStorage.getItem(compareStorageKey(scope.storeId)));
}

export function writeStoreCompare(scope: CompareScope, productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean))).slice(0, COMPARE_LIMIT);
  const key = compareStorageKey(scope.storeId);

  if (!uniqueIds.length) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, JSON.stringify(uniqueIds));
  }

  dispatchCompareUpdated(scope);
}

function isCompareEventForScope(event: Event, storeId: string) {
  const detail = (event as CustomEvent<CompareUpdatedDetail>).detail;

  if (!detail?.storeId) {
    return true;
  }

  return detail.storeId === storeId;
}

function useStoreCompare(scope: CompareScope) {
  const [productIds, setProductIds] = useState<string[]>([]);

  const syncFromStorage = useCallback(() => {
    setProductIds(readStoreCompare(scope));
  }, [scope]);

  useEffect(() => {
    syncFromStorage();

    function handleCompareChange(event: Event) {
      if (!isCompareEventForScope(event, scope.storeId)) {
        return;
      }

      syncFromStorage();
    }

    window.addEventListener(COMPARE_UPDATED_EVENT, handleCompareChange);
    window.addEventListener("storage", handleCompareChange);

    return () => {
      window.removeEventListener(COMPARE_UPDATED_EVENT, handleCompareChange);
      window.removeEventListener("storage", handleCompareChange);
    };
  }, [scope, syncFromStorage]);

  const persistProductIds = useCallback(
    (next: string[]) => {
      writeStoreCompare(scope, next);
      setProductIds(readStoreCompare(scope));
    },
    [scope]
  );

  return { persistProductIds, productIds };
}

function formatProductPrice(price: number | string | null, priceLabel: string | null, currency: string) {
  if (priceLabel) {
    return priceLabel;
  }

  if (price === null || price === undefined || price === "") {
    return "Price coming soon";
  }

  const numeric = typeof price === "number" ? price : Number(price);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return String(price);
  }

  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(numeric);
}

function availabilityLabel(product: PublicStorefrontProduct) {
  if (!product.trackInventory) {
    return product.variants.length ? "See options" : "Inventory not tracked";
  }

  const stock = typeof product.stockQuantity === "number"
    ? product.stockQuantity
    : product.variants.reduce((sum, variant) => sum + Math.max(0, variant.stockQuantity ?? 0), 0);

  if (product.inventoryStatus === "out_of_stock" || stock <= 0) {
    return "Sold out";
  }

  return `${stock} available`;
}

export function CompareButton({
  currency,
  product,
  slug,
  storeId
}: {
  currency: string;
  product: PublicStorefrontProduct;
  slug: string;
  storeId: string;
}) {
  const scope = useMemo(
    () => ({ currency, slug, storeId }),
    [currency, slug, storeId]
  );
  const { persistProductIds, productIds } = useStoreCompare(scope);
  const selected = productIds.includes(product.id);
  const limitReached = productIds.length >= COMPARE_LIMIT && !selected;

  return (
    <button
      aria-pressed={selected}
      className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-xs font-black uppercase tracking-[0.14em] transition ${
        selected
          ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          : limitReached
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            : "border-slate-200 bg-white text-ink hover:border-slate-300 hover:bg-slate-50"
      }`}
      disabled={limitReached}
      onClick={() => {
        persistProductIds(
          selected
            ? productIds.filter((id) => id !== product.id)
            : [...productIds, product.id]
        );
      }}
      type="button"
    >
      {selected ? "Remove Compare" : limitReached ? "Compare Full" : "Compare"}
    </button>
  );
}

export function CompareNavLink({
  currency,
  slug,
  storeId
}: {
  currency: string;
  slug: string;
  storeId: string;
}) {
  const scope = useMemo(
    () => ({ currency, slug, storeId }),
    [currency, slug, storeId]
  );
  const { productIds } = useStoreCompare(scope);

  return (
    <Link
      className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
      href={`/store/${slug}/compare`}
    >
      Compare{productIds.length ? ` (${productIds.length})` : ""}
    </Link>
  );
}

export function ComparePageClient({
  currency,
  products,
  slug,
  storeId
}: {
  currency: string;
  products: PublicStorefrontProduct[];
  slug: string;
  storeId: string;
}) {
  const scope = useMemo(
    () => ({ currency, slug, storeId }),
    [currency, slug, storeId]
  );
  const { persistProductIds, productIds } = useStoreCompare(scope);
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const compareProducts = productIds
    .map((productId) => productsById.get(productId) ?? null)
    .filter((product): product is PublicStorefrontProduct => Boolean(product && product.status === "active"));

  if (!compareProducts.length) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">No products to compare</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
          Add up to four products from this store to compare their price, stock, category, and details.
        </p>
        <Link
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white"
          href={`/store/${slug}`}
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-px bg-slate-200 lg:grid-cols-4">
        {compareProducts.map((product) => {
          const productCurrency = product.currency || currency;
          const detailsHref = `/store/${slug}/product/${encodeURIComponent(product.slug || product.id)}`;

          return (
            <article className="grid gap-4 bg-white p-4" key={product.id}>
              <Link className="relative block" href={detailsHref}>
                <ProductBadges className="absolute left-3 top-3 z-10" product={product} />
                {product.imageUrl ? (
                  <img
                    alt={product.title}
                    className="aspect-square w-full rounded-[1.5rem] object-cover"
                    src={product.imageUrl}
                  />
                ) : (
                  <div className="aspect-square rounded-[1.5rem] bg-slate-100" />
                )}
              </Link>
              <div>
                <Link href={detailsHref}>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-ink transition hover:text-slate-600">
                    {product.title}
                  </h2>
                </Link>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {product.description || "No description has been added for this product yet."}
                </p>
                <ProductSalesProof compact product={product} />
                <ProductStockUrgency className="mt-3" compact product={product} />
              </div>
              <dl className="grid gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Price</dt>
                  <dd className="mt-1 font-black text-ink">
                    {formatProductPrice(product.price, product.priceLabel, productCurrency)}
                  </dd>
                  {product.compareAtPrice ? (
                    <dd className="mt-1 text-xs font-bold text-slate-400 line-through">
                      {formatProductPrice(product.compareAtPrice, null, productCurrency)}
                    </dd>
                  ) : null}
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Availability</dt>
                  <dd className="mt-1 font-bold text-ink">{availabilityLabel(product)}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Category</dt>
                  <dd className="mt-1 font-bold text-ink">{product.categoryName || "Uncategorized"}</dd>
                </div>
                {product.sku ? (
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">SKU</dt>
                    <dd className="mt-1 font-bold text-ink">{product.sku}</dd>
                  </div>
                ) : null}
                {product.variants.length ? (
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Options</dt>
                    <dd className="mt-1 font-bold text-ink">
                      {product.variants.map((variant) => variant.name).join(", ")}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-auto grid gap-2">
                <AddToCartButton
                  currency={productCurrency}
                  detailsHref={detailsHref}
                  product={product}
                  showViewDetails
                  slug={slug}
                  storeId={storeId}
                />
                <button
                  className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-blue-700 transition hover:bg-blue-50"
                  onClick={() => persistProductIds(productIds.filter((id) => id !== product.id))}
                  type="button"
                >
                  Remove from Compare
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
