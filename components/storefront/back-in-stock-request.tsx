"use client";

import { useState } from "react";
import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";

function productSoldOut(product: PublicStorefrontProduct) {
  if (product.inventoryStatus === "out_of_stock") {
    return true;
  }

  if (product.variants.length) {
    return product.variants.every((variant) => variant.status !== "active" || (variant.stockQuantity ?? 0) <= 0);
  }

  return product.trackInventory && (product.stockQuantity ?? 0) <= 0;
}

export function BackInStockRequest({
  product,
  slug,
  storeId
}: {
  product: PublicStorefrontProduct;
  slug: string;
  storeId: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success" | null>(null);
  const [pending, setPending] = useState(false);

  if (!productSoldOut(product)) {
    return null;
  }

  async function submitRequest() {
    setPending(true);
    setMessage(null);
    setMessageType(null);

    try {
      const response = await fetch("/api/store-back-in-stock", {
        body: JSON.stringify({
          email,
          productId: product.id,
          slug,
          storeId
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "Request could not be saved.");
        setMessageType("error");
        return;
      }

      setMessage(payload?.message ?? "You're on the notification list.");
      setMessageType("success");
    } catch {
      setMessage("Request could not be saved.");
      setMessageType("error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
        Notify me when available
      </p>
      <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">
        This product is currently sold out.
      </h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
        Enter your email and the seller can notify you when this item is back in stock.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          className="h-11 min-w-0 flex-1 rounded-2xl border border-amber-200 bg-white px-4 text-sm font-bold text-ink outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          onChange={(event) => {
            setEmail(event.target.value);
            setMessage(null);
            setMessageType(null);
          }}
          placeholder="you@example.com"
          type="email"
          value={email}
        />
        <button
          className="h-11 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={pending}
          onClick={submitRequest}
          type="button"
        >
          {pending ? "Saving..." : "Notify me"}
        </button>
      </div>
      {message ? (
        <p className={`mt-3 rounded-2xl px-3 py-2 text-sm font-bold ${
          messageType === "success"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700"
        }`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
