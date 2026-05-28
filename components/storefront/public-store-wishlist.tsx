"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AddToCartButton } from "@/components/storefront/public-store-cart";
import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";

type WishlistScope = {
  currency: string;
  slug: string;
  storeId: string;
};

type WishlistUpdatedDetail = {
  slug: string;
  storeId: string;
};

const WISHLIST_UPDATED_EVENT = "shastore-wishlist-updated";

function wishlistStorageKey(storeId: string) {
  return `shastore_wishlist_${storeId}`;
}

function legacyWishlistStorageKey(slug: string) {
  return `shastore_wishlist_${slug}`;
}

function parseWishlistProductIds(value: string | null) {
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

function dispatchWishlistUpdated(scope: WishlistScope) {
  window.dispatchEvent(
    new CustomEvent<WishlistUpdatedDetail>(WISHLIST_UPDATED_EVENT, {
      detail: { slug: scope.slug, storeId: scope.storeId }
    })
  );
}

export function readStoreWishlist(scope: WishlistScope) {
  if (typeof window === "undefined") {
    return [];
  }

  const key = wishlistStorageKey(scope.storeId);
  const raw = window.localStorage.getItem(key);

  if (raw !== null) {
    return parseWishlistProductIds(raw);
  }

  const legacyRaw = window.localStorage.getItem(legacyWishlistStorageKey(scope.slug));
  if (legacyRaw === null) {
    return [];
  }

  const migrated = parseWishlistProductIds(legacyRaw);
  writeStoreWishlist(scope, migrated);
  return migrated;
}

export function writeStoreWishlist(scope: WishlistScope, productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  const key = wishlistStorageKey(scope.storeId);

  if (!uniqueIds.length) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, JSON.stringify(uniqueIds));
  }

  window.localStorage.removeItem(legacyWishlistStorageKey(scope.slug));
  dispatchWishlistUpdated(scope);
}

function isWishlistEventForScope(event: Event, storeId: string) {
  const detail = (event as CustomEvent<WishlistUpdatedDetail>).detail;

  if (!detail?.storeId) {
    return true;
  }

  return detail.storeId === storeId;
}

function useStoreWishlist(scope: WishlistScope) {
  const [productIds, setProductIds] = useState<string[]>([]);

  const syncFromStorage = useCallback(() => {
    setProductIds(readStoreWishlist(scope));
  }, [scope]);

  useEffect(() => {
    syncFromStorage();

    function handleWishlistChange(event: Event) {
      if (!isWishlistEventForScope(event, scope.storeId)) {
        return;
      }

      syncFromStorage();
    }

    window.addEventListener(WISHLIST_UPDATED_EVENT, handleWishlistChange);
    window.addEventListener("storage", handleWishlistChange);

    return () => {
      window.removeEventListener(WISHLIST_UPDATED_EVENT, handleWishlistChange);
      window.removeEventListener("storage", handleWishlistChange);
    };
  }, [scope, syncFromStorage]);

  const persistProductIds = useCallback(
    (next: string[]) => {
      writeStoreWishlist(scope, next);
      setProductIds(readStoreWishlist(scope));
    },
    [scope]
  );

  return { persistProductIds, productIds };
}

export function WishlistButton({
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
  const { persistProductIds, productIds } = useStoreWishlist(scope);
  const saved = productIds.includes(product.id);

  return (
    <button
      aria-pressed={saved}
      className={`inline-flex h-11 items-center justify-center rounded-full border px-4 text-sm font-black transition ${
        saved
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-slate-200 bg-white text-ink hover:border-slate-300 hover:bg-slate-50"
      }`}
      onClick={() => {
        persistProductIds(
          saved ? productIds.filter((id) => id !== product.id) : [...productIds, product.id]
        );
      }}
      type="button"
    >
      {saved ? "Saved to wishlist" : "Add to wishlist"}
    </button>
  );
}

export function WishlistNavLink({
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
  const { productIds } = useStoreWishlist(scope);

  return (
    <Link
      className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
      href={`/store/${slug}/wishlist`}
    >
      Wishlist{productIds.length ? ` (${productIds.length})` : ""}
    </Link>
  );
}

function productPrice(product: PublicStorefrontProduct, currency: string) {
  if (product.priceLabel) {
    return product.priceLabel;
  }

  const numeric = typeof product.price === "number" ? product.price : Number(product.price ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "Price coming soon";
  }

  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(numeric);
}

export function WishlistPageClient({
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
  const { persistProductIds, productIds } = useStoreWishlist(scope);
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const wishlistProducts = productIds
    .map((productId) => productsById.get(productId) ?? null)
    .filter((product): product is PublicStorefrontProduct => Boolean(product));

  if (!wishlistProducts.length) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">Your wishlist is empty</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
          Save products from this store and they will appear here on this device.
        </p>
        <Link
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white"
          href={`/store/${slug}`}
        >
          Back to store
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {wishlistProducts.map((product) => {
        const itemCurrency = product.currency || currency;

        return (
          <article className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm" key={product.id}>
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
              <Link href={`/store/${slug}/product/${encodeURIComponent(product.slug || product.id)}`}>
                <h2 className="text-xl font-black tracking-[-0.03em] text-ink transition hover:text-slate-600">
                  {product.title}
                </h2>
              </Link>
              <p className="mt-2 text-sm leading-6 text-muted">
                {product.description || "No description has been added for this product yet."}
              </p>
              <p className="mt-3 text-lg font-black text-ink">
                {productPrice(product, itemCurrency)}
              </p>
            </div>
            <div className="grid gap-2">
              <AddToCartButton
                currency={itemCurrency}
                product={product}
                slug={slug}
                storeId={storeId}
              />
              <button
                className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-rose-700 transition hover:bg-rose-50"
                onClick={() => persistProductIds(productIds.filter((id) => id !== product.id))}
                type="button"
              >
                Remove from wishlist
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
