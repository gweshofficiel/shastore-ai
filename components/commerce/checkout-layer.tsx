"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  buildWhatsAppOrderUrl,
  calculateCheckoutTotal,
  formatCheckoutMoney,
  parsePrice,
  type CheckoutSource
} from "@/lib/commerce/checkout";
import { useAnalyticsTracking } from "@/lib/analytics/use-analytics-tracking";
import { submitCommerceCheckout } from "@/lib/commerce/checkout-actions";
import type { CommercePaymentMethod } from "@/lib/commerce/types";

type CheckoutState =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

const initialState: CheckoutState = { ok: false, error: "" };

export function CommerceCheckoutLayer({
  children,
  source
}: {
  children: React.ReactNode;
  source: CheckoutSource;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(source.items[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<CommercePaymentMethod>(
    source.paymentMethods[0] ?? "whatsapp"
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [state, formAction, isPending] = useActionState(
    submitCommerceCheckout,
    initialState
  );
  const trackedProductIds = useRef(new Set<string>());
  const { sessionId, track, visitorId } = useAnalyticsTracking({
    sourceSlug: source.sourceSlug,
    sourceType: source.sourceType
  });

  const selectedItem = useMemo(
    () => source.items.find((item) => item.id === selectedItemId) ?? source.items[0],
    [selectedItemId, source.items]
  );
  const checkoutItems = selectedItem ? [{ ...selectedItem, quantity: 1 }] : [];
  const subtotal = calculateCheckoutTotal(checkoutItems);
  const total = subtotal;
  const whatsappUrl = buildWhatsAppOrderUrl({
    address,
    city,
    customerName,
    items: checkoutItems,
    notes,
    paymentMethod,
    phone: customerPhone,
    source,
    total
  });

  useEffect(() => {
    if (state.ok && paymentMethod === "whatsapp" && whatsappUrl) {
      track("whatsapp_click", {
        metadata: { order_id: state.orderId }
      });
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  }, [paymentMethod, state, track, whatsappUrl]);

  useEffect(() => {
    if (
      !selectedItem ||
      !visitorId ||
      !sessionId ||
      trackedProductIds.current.has(selectedItem.id)
    ) {
      return;
    }

    trackedProductIds.current.add(selectedItem.id);
    track("product_view", {
      metadata: {
        price: parsePrice(selectedItem.price),
        source_title: source.title
      },
      productId: selectedItem.id,
      productName: selectedItem.name
    });
  }, [selectedItem, sessionId, source.title, track, visitorId]);

  function openCheckout(method?: CommercePaymentMethod) {
    const nextMethod = method ?? paymentMethod;
    setPaymentMethod(nextMethod);
    setIsOpen(true);
    track("checkout_started", {
      metadata: { payment_method: nextMethod }
    });
  }

  function handleTemplateClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const link = target?.closest("a");
    const href = link?.getAttribute("href") ?? "";

    if (href.includes("wa.me") || href.includes("whatsapp")) {
      track("whatsapp_click");
    }
  }

  return (
    <div onClick={handleTemplateClick}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-3 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">{source.title}</p>
            <p className="text-xs font-semibold text-slate-500">
              Secure order capture by SHASTORE AI
            </p>
          </div>
          <button
            className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800"
            onClick={() => openCheckout()}
            type="button"
          >
            Order now
          </button>
        </div>
      </div>
      {isOpen ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Checkout
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">
                  Complete your order
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  This order is saved to the unified commerce backend.
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            {state.ok ? (
              <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-800">
                  Order captured successfully.
                </p>
                <p className="mt-1 font-mono text-xs text-emerald-700">
                  {state.orderId}
                </p>
              </div>
            ) : state.error ? (
              <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-700">{state.error}</p>
              </div>
            ) : null}
            <form action={formAction} className="mt-6 grid gap-4">
              <input name="sourceType" type="hidden" value={source.sourceType} />
              <input name="sourceId" type="hidden" value={source.sourceId} />
              <input name="sourceSlug" type="hidden" value={source.sourceSlug} />
              <input name="currency" type="hidden" value={source.currency} />
              <input name="subtotal" type="hidden" value={subtotal.toFixed(2)} />
              <input name="total" type="hidden" value={total.toFixed(2)} />
              <input name="visitorId" type="hidden" value={visitorId} />
              <input name="sessionId" type="hidden" value={sessionId} />
              <input
                name="products"
                type="hidden"
                value={JSON.stringify(
                  checkoutItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity ?? 1,
                    unitPrice: parsePrice(item.price),
                    totalPrice: parsePrice(item.price) * (item.quantity ?? 1)
                  }))
                )}
              />
              {source.items.length > 1 ? (
                <label className="grid gap-2 text-sm font-bold text-slate-950">
                  Product
                  <select
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                    onChange={(event) => setSelectedItemId(event.target.value)}
                    value={selectedItemId}
                  >
                    {source.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} - {item.price || "Custom price"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-slate-950">
                  Name
                  <input
                    className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                    name="customerName"
                    onChange={(event) => setCustomerName(event.target.value)}
                    required
                    value={customerName}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-slate-950">
                  Phone
                  <input
                    className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                    name="customerPhone"
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    required
                    value={customerPhone}
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-slate-950">
                  Email
                  <input
                    className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                    name="customerEmail"
                    type="email"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-slate-950">
                  City
                  <input
                    className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                    name="city"
                    onChange={(event) => setCity(event.target.value)}
                    value={city}
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-bold text-slate-950">
                Address
                <input
                  className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                  name="address"
                  onChange={(event) => setAddress(event.target.value)}
                  value={address}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-950">
                Notes
                <textarea
                  className="min-h-24 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                  name="notes"
                  onChange={(event) => setNotes(event.target.value)}
                  value={notes}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {source.paymentMethods.map((method) => (
                  <label
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-950"
                    key={method}
                  >
                    <input
                      checked={paymentMethod === method}
                      name="paymentMethod"
                      onChange={() => setPaymentMethod(method)}
                      type="radio"
                      value={method}
                    />
                    {method}
                  </label>
                ))}
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-slate-500">Total</span>
                  <span className="text-2xl font-black text-slate-950">
                    {formatCheckoutMoney(total, source.currency)}
                  </span>
                </div>
                {paymentMethod === "stripe" || paymentMethod === "paypal" ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {paymentMethod} payment automation is a foundation placeholder;
                    this order will be captured as pending.
                  </p>
                ) : null}
              </div>
              <button
                className="h-12 rounded-full bg-slate-950 px-6 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Saving order..." : "Submit order"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
