"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

function cartKey(storeId: string) {
  return `shastore_cart_${storeId}`;
}

function legacyCartKey(slug: string) {
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
          (typeof item.id === "string" || typeof (item as { productId?: unknown }).productId === "string") &&
          typeof item.title === "string" &&
          typeof item.quantity === "number" &&
          (!("storeId" in item) || item.storeId === storeId)
        );
      })
      .map((item) => ({
        categoryName: typeof item.categoryName === "string" ? item.categoryName : null,
        currency: typeof item.currency === "string" && item.currency.trim() ? item.currency : currency,
        id:
          typeof item.id === "string"
            ? item.id
            : ((item as { productId: string }).productId),
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

function readCart(storeId: string, slug: string, currency: string) {
  if (typeof window === "undefined") {
    return [];
  }

  const scopedItems = parseCartItems(window.localStorage.getItem(cartKey(storeId)), storeId, currency);

  if (scopedItems.length) {
    return scopedItems;
  }

  return parseCartItems(window.localStorage.getItem(legacyCartKey(slug)), storeId, currency);
}

function writeCart(storeId: string, slug: string, items: CartItem[]) {
  const scopedItems = items.filter((item) => item.storeId === storeId);
  window.localStorage.setItem(cartKey(storeId), JSON.stringify(scopedItems));
  window.dispatchEvent(new CustomEvent("shastore-cart-updated", { detail: { slug, storeId } }));
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

export function AddToCartButton({ currency, product, slug, storeId }: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);

  function handleAddToCart() {
    const current = readCart(storeId, slug, currency);
    const existing = current.find((item) => item.id === product.id);
    const next = existing
      ? current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      : [...current, toCartItem(product, storeId, currency)];

    writeCart(storeId, slug, next);
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
  const [count, setCount] = useState(0);

  useEffect(() => {
    function updateCount() {
      setCount(readCart(storeId, slug, currency).reduce((total, item) => total + item.quantity, 0));
    }

    updateCount();
    window.addEventListener("storage", updateCount);
    window.addEventListener("shastore-cart-updated", updateCount);
    return () => {
      window.removeEventListener("storage", updateCount);
      window.removeEventListener("shastore-cart-updated", updateCount);
    };
  }, [currency, slug, storeId]);

  return (
    <Link
      className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted transition hover:bg-slate-200"
      href={`/store/${slug}/cart`}
    >
      Cart{count ? ` (${count})` : ""}
    </Link>
  );
}

export function CartPageClient({
  currency,
  slug,
  storeId
}: CartPageClientProps) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readCart(storeId, slug, currency));
  }, [currency, slug, storeId]);

  const total = useMemo(() => cartTotal(items), [items]);

  function updateItems(next: CartItem[]) {
    const scopedItems = next.filter((item) => item.storeId === storeId);
    setItems(scopedItems);
    writeCart(storeId, slug, scopedItems);
  }

  function updateQuantity(itemId: string, quantity: number) {
    const nextQuantity = Math.max(1, quantity);
    updateItems(
      items.map((item) =>
        item.id === itemId ? { ...item, quantity: nextQuantity } : item
      )
    );
  }

  function removeItem(itemId: string) {
    updateItems(items.filter((item) => item.id !== itemId));
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
            key={item.id}
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
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  type="button"
                >
                  -
                </button>
                <span className="min-w-10 text-center text-sm font-black text-ink">
                  {item.quantity}
                </span>
                <button
                  className="h-10 w-10 rounded-full border border-slate-200 bg-white text-lg font-black text-ink"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  type="button"
                >
                  +
                </button>
                <button
                  className="ml-auto h-10 rounded-full bg-red-50 px-4 text-sm font-black text-red-600"
                  onClick={() => removeItem(item.id)}
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
