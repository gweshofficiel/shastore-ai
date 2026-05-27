"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";

type CartItem = {
  categoryName: string | null;
  currency: string;
  id: string;
  image: string | null;
  price: number | string | null;
  priceLabel: string | null;
  productId: string;
  quantity: number;
  storeId: string;
  title: string;
};

type AddToCartButtonProps = {
  currency: string;
  product: PublicStorefrontProduct;
  slug: string;
  storeId: string;
};

type CartPageClientProps = {
  currency: string;
  slug: string;
  storeId: string;
};

type CartScope = {
  currency: string;
  slug: string;
  storeId: string;
};

type CartUpdatedDetail = {
  slug: string;
  storeId: string;
};

const CART_UPDATED_EVENT = "shastore-cart-updated";

/** Canonical per-store cart key (stable across slug changes). */
export function cartStorageKey(storeId: string) {
  return `shastore_cart_${storeId}`;
}

/** Legacy slug-only key — cleared on every write to prevent stale rehydration. */
function legacyCartStorageKey(slug: string) {
  return `shastore_cart_${slug}`;
}

function parseCartItems(value: string | null, storeId: string, currency: string): CartItem[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is CartItem => {
        return (
          item &&
          typeof item === "object" &&
          (typeof item.id === "string" ||
            typeof (item as { productId?: unknown }).productId === "string") &&
          typeof item.title === "string" &&
          typeof item.quantity === "number" &&
          (!("storeId" in item) || item.storeId === storeId)
        );
      })
      .map((item) => ({
        categoryName: typeof item.categoryName === "string" ? item.categoryName : null,
        currency:
          typeof item.currency === "string" && item.currency.trim() ? item.currency : currency,
        id:
          typeof item.id === "string"
            ? item.id
            : (item as { productId: string }).productId,
        image: (() => {
          const legacyItem = item as unknown as { imageUrl?: unknown };
          return typeof item.image === "string"
            ? item.image
            : typeof legacyItem.imageUrl === "string"
              ? legacyItem.imageUrl
              : null;
        })(),
        price:
          typeof item.price === "number" || typeof item.price === "string" ? item.price : null,
        priceLabel: typeof item.priceLabel === "string" ? item.priceLabel : null,
        productId:
          typeof (item as { productId?: unknown }).productId === "string"
            ? (item as { productId: string }).productId
            : item.id,
        quantity: Math.max(1, Math.floor(item.quantity)),
        storeId,
        title: item.title
      }));
  } catch {
    return [];
  }
}

function dispatchCartUpdated(scope: CartScope) {
  window.dispatchEvent(
    new CustomEvent<CartUpdatedDetail>(CART_UPDATED_EVENT, {
      detail: { slug: scope.slug, storeId: scope.storeId }
    })
  );
}

/** Read cart for one store only — never fall back to legacy after canonical key exists. */
export function readStoreCart(scope: CartScope): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const key = cartStorageKey(scope.storeId);
  const raw = window.localStorage.getItem(key);

  if (raw !== null) {
    return parseCartItems(raw, scope.storeId, scope.currency);
  }

  const legacyRaw = window.localStorage.getItem(legacyCartStorageKey(scope.slug));

  if (legacyRaw === null) {
    return [];
  }

  const migrated = parseCartItems(legacyRaw, scope.storeId, scope.currency);
  writeStoreCart(scope, migrated);
  return migrated;
}

/** Persist cart; removes storage when empty and always clears legacy slug cart. */
export function writeStoreCart(scope: CartScope, items: CartItem[]) {
  const scopedItems = items.filter((item) => item.storeId === scope.storeId);
  const key = cartStorageKey(scope.storeId);

  if (!scopedItems.length) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, JSON.stringify(scopedItems));
  }

  window.localStorage.removeItem(legacyCartStorageKey(scope.slug));
  dispatchCartUpdated(scope);
}

/** Clear cart for one store (state + localStorage + header sync). */
export function clearStoreCart(scope: CartScope) {
  writeStoreCart(scope, []);
}

export function cartItemCount(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function isCartEventForScope(event: Event, storeId: string) {
  const detail = (event as CustomEvent<CartUpdatedDetail>).detail;

  if (!detail?.storeId) {
    return true;
  }

  return detail.storeId === storeId;
}

function parsePrice(value: number | string | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    currency: currency || "USD",
    style: "currency"
  }).format(value);
}

function displayPrice(item: Pick<CartItem, "price" | "priceLabel">, currency: string) {
  if (item.priceLabel) {
    return item.priceLabel;
  }

  const numeric = parsePrice(item.price);

  if (!numeric) {
    return "Price coming soon";
  }

  return formatMoney(numeric, currency);
}

function toCartItem(
  product: PublicStorefrontProduct,
  storeId: string,
  currency: string
): CartItem {
  return {
    categoryName: product.categoryName,
    currency: product.currency || currency,
    id: product.id,
    image: product.imageUrl,
    price: product.price,
    priceLabel: product.priceLabel,
    productId: product.id,
    quantity: 1,
    storeId,
    title: product.title
  };
}

function cartTotal(items: CartItem[]) {
  return items.reduce((total, item) => total + parsePrice(item.price) * item.quantity, 0);
}

function useStoreCart(scope: CartScope) {
  const [items, setItems] = useState<CartItem[]>([]);

  const syncFromStorage = useCallback(() => {
    setItems(readStoreCart(scope));
  }, [scope]);

  useEffect(() => {
    syncFromStorage();

    function handleCartChange(event: Event) {
      if (!isCartEventForScope(event, scope.storeId)) {
        return;
      }

      syncFromStorage();
    }

    window.addEventListener(CART_UPDATED_EVENT, handleCartChange);
    window.addEventListener("storage", handleCartChange);

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, handleCartChange);
      window.removeEventListener("storage", handleCartChange);
    };
  }, [scope, syncFromStorage]);

  const persistItems = useCallback(
    (next: CartItem[]) => {
      writeStoreCart(scope, next);
      setItems(readStoreCart(scope));
    },
    [scope]
  );

  return { items, persistItems, syncFromStorage };
}

export function AddToCartButton({ currency, product, slug, storeId }: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);
  const scope = useMemo(
    () => ({ currency, slug, storeId }),
    [currency, slug, storeId]
  );

  function handleAddToCart() {
    const current = readStoreCart(scope);
    const existing = current.find(
      (item) => item.productId === product.id || item.id === product.id
    );
    const next = existing
      ? current.map((item) =>
          item.productId === product.id || item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      : [...current, toCartItem(product, storeId, currency)];

    writeStoreCart(scope, next);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <button
      className="inline-flex h-11 items-center justify-center px-4 text-sm font-black text-white transition hover:opacity-90"
      onClick={handleAddToCart}
      style={{
        backgroundColor: "var(--store-primary, #0f172a)",
        borderRadius: "var(--store-border-radius, 9999px)"
      }}
      type="button"
    >
      {added ? "Added to cart" : "Add to cart"}
    </button>
  );
}

export function CartNavLink({
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
  const { items } = useStoreCart(scope);
  const count = cartItemCount(items);

  return (
    <Link
      className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
      href={`/store/${slug}/cart`}
    >
      Cart{count ? ` (${count})` : ""}
    </Link>
  );
}

export function CartPageClient({ currency, slug, storeId }: CartPageClientProps) {
  const scope = useMemo(
    () => ({ currency, slug, storeId }),
    [currency, slug, storeId]
  );
  const { items, persistItems } = useStoreCart(scope);
  const total = useMemo(() => cartTotal(items), [items]);

  function updateQuantity(itemId: string, quantity: number) {
    if (quantity < 1) {
      removeItem(itemId);
      return;
    }

    persistItems(
      items.map((item) =>
        item.id === itemId || item.productId === itemId
          ? { ...item, quantity: Math.max(1, quantity) }
          : item
      )
    );
  }

  function removeItem(itemId: string) {
    persistItems(
      items.filter((item) => item.id !== itemId && item.productId !== itemId)
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="text-3xl font-black tracking-[-0.04em] text-ink">Your cart is empty</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
          Add products from the public store before checkout.
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-4">
        {items.map((item) => (
          <article
            className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 sm:grid-cols-[120px_minmax(0,1fr)]"
            key={item.productId}
          >
            {item.image ? (
              <img
                alt={item.title}
                className="aspect-square w-full rounded-[1.5rem] object-cover"
                src={item.image}
              />
            ) : (
              <div className="aspect-square rounded-[1.5rem] bg-slate-100" />
            )}
            <div className="grid gap-3">
              {item.categoryName ? (
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  {item.categoryName}
                </p>
              ) : null}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-ink">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-muted">
                    {displayPrice(item, item.currency || currency)}
                  </p>
                </div>
                <p className="text-lg font-black text-ink">
                  {formatMoney(parsePrice(item.price) * item.quantity, item.currency || currency)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="h-10 w-10 rounded-full border border-slate-200 bg-white text-lg font-black text-ink"
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  type="button"
                >
                  -
                </button>
                <span className="min-w-10 text-center text-sm font-black text-ink">
                  {item.quantity}
                </span>
                <button
                  className="h-10 w-10 rounded-full border border-slate-200 bg-white text-lg font-black text-ink"
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  type="button"
                >
                  +
                </button>
                <button
                  className="ml-auto h-10 rounded-full bg-red-50 px-4 text-sm font-black text-red-600"
                  onClick={() => removeItem(item.productId)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className="h-fit rounded-[2rem] border border-slate-200 bg-white p-5 lg:sticky lg:top-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Checkout
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
          Order summary
        </h2>
        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 text-sm font-bold text-muted">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
          <div className="flex justify-between text-lg font-black text-ink">
            <span>Total</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-3 border-t border-slate-100 pt-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
            Checkout is not enabled yet. This cart is ready for the next checkout phase.
          </div>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Customer name</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              disabled
              name="customerName"
              placeholder="Full name"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Phone</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              disabled
              name="customerPhone"
              placeholder="+15551234567"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Email optional</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              disabled
              name="customerEmail"
              placeholder="customer@example.com"
              type="email"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Address optional</span>
            <textarea
              className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              disabled
              name="customerAddress"
              placeholder="Delivery address or notes"
            />
          </label>
          <button
            className="h-12 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled
            type="submit"
          >
            Submit order · Coming soon
          </button>
        </div>
        <div className="mt-6 grid gap-3">
          <button
            className="h-12 rounded-full bg-slate-100 px-5 text-sm font-black text-slate-400"
            disabled
            type="button"
          >
            WhatsApp checkout · Coming soon
          </button>
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
      </aside>
    </div>
  );
}
