"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createBuyerCheckoutOrder } from "@/lib/commerce/buyer-checkout-actions";
import { calculateCheckoutTotal, formatCheckoutMoney } from "@/lib/commerce/checkout";
import type { BuyerCheckoutSource } from "@/lib/commerce/buyer-checkout";
import type { CommercePaymentMethod } from "@/lib/commerce/types";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="h-12 rounded-full bg-slate-950 px-6 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Placing order..." : "Place order"}
    </button>
  );
}

function getPaymentMethodLabel(method: CommercePaymentMethod) {
  const labels: Record<CommercePaymentMethod, string> = {
    cod: "Cash on Delivery",
    paypal: "PayPal",
    stripe: "Credit / Debit Card",
    whatsapp: "Order via WhatsApp",
    youcan_pay: "YouCan Pay"
  };

  return labels[method];
}

function getPaymentMethodDescription(method: CommercePaymentMethod) {
  if (method === "cod") {
    return "Pay the seller when your order is delivered.";
  }

  if (method === "whatsapp") {
    return "Save the order and open WhatsApp with a prepared message.";
  }

  if (method === "stripe") {
    return "Pay by credit or debit card with this store's connected Stripe account.";
  }

  return "Integration foundation only. The seller will confirm payment instructions after order submission.";
}

export function BuyerCheckoutForm({ source }: { source: BuyerCheckoutSource }) {
  const [productId, setProductId] = useState(source.items[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<CommercePaymentMethod>(
    source.paymentMethods[0] ?? "cod"
  );
  const selectedItem = useMemo(
    () => source.items.find((item) => item.id === productId) ?? source.items[0],
    [productId, source.items]
  );
  const checkoutItems = selectedItem ? [{ ...selectedItem, quantity }] : [];
  const total = calculateCheckoutTotal(checkoutItems);
  const paymentDetails = source.paymentMethodDetails.find((method) => method.method === paymentMethod);

  return (
    <form action={createBuyerCheckoutOrder} className="grid gap-6">
      <input name="sourceType" type="hidden" value={source.sourceType} />
      <input name="sourceSlug" type="hidden" value={source.sourceSlug} />
      <input name="productId" type="hidden" value={selectedItem?.id ?? ""} />
      <input name="paymentMethod" type="hidden" value={paymentMethod} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-5">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Contact
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-950">
                Customer name
                <input
                  className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                  maxLength={120}
                  name="customerName"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-950">
                Phone
                <input
                  className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                  maxLength={80}
                  name="customerPhone"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-950">
                Email
                <input
                  className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                  maxLength={160}
                  name="customerEmail"
                  type="email"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-950">
                City
                <input
                  className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                  maxLength={120}
                  name="city"
                />
              </label>
            </div>
            <label className="mt-4 grid gap-2 text-sm font-bold text-slate-950">
              Address
              <input
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                maxLength={240}
                name="address"
              />
            </label>
            <label className="mt-4 grid gap-2 text-sm font-bold text-slate-950">
              Buyer notes
              <textarea
                className="min-h-24 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                maxLength={500}
                name="buyerNotes"
                placeholder="Delivery notes, preferred time, or special requests"
              />
            </label>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Payment method
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {source.paymentMethods.map((method) => (
                <button
                  className={`rounded-3xl border p-4 text-left transition ${
                    paymentMethod === method
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-950 hover:border-slate-300"
                  }`}
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  type="button"
                >
                  <span className="block text-sm font-black">
                    {source.paymentMethodDetails.find((item) => item.method === method)?.displayName || getPaymentMethodLabel(method)}
                  </span>
                  <span
                    className={`mt-1 block text-xs font-semibold ${
                      paymentMethod === method ? "text-white/70" : "text-slate-500"
                    }`}
                  >
                    {source.paymentMethodDetails.find((item) => item.method === method)?.instructions || getPaymentMethodDescription(method)}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Stripe seller accounts, PayPal seller accounts, crypto checkout, and digital
              delivery can plug into this checkout flow later. No online payment SDK is
              loaded today.
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Order summary
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">
            {source.title}
          </h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-slate-950">
              Product
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                onChange={(event) => setProductId(event.target.value)}
                value={productId}
              >
                {source.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-950">
              Quantity
              <input
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                min={1}
                name="quantity"
                onChange={(event) => setQuantity(Math.max(Number(event.target.value), 1))}
                required
                type="number"
                value={quantity}
              />
            </label>
          </div>
          <div className="mt-5 rounded-3xl bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-500">
              <span>{selectedItem?.name ?? "Product"}</span>
              <span>x{quantity}</span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">
                Total
              </span>
              <span className="text-3xl font-black tracking-[-0.04em] text-slate-950">
                {formatCheckoutMoney(total, source.currency)}
              </span>
            </div>
          </div>
          {source.paymentSettings.paymentInstructions ? (
            <div className="mt-4 rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
              {source.paymentSettings.paymentInstructions}
            </div>
          ) : null}
          {paymentDetails && (paymentMethod === "paypal" || paymentMethod === "stripe" || paymentMethod === "youcan_pay") ? (
            <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
              Online payment processing is not active yet. This order will be created as pending and the seller will confirm payment manually.
            </div>
          ) : null}
          <div className="mt-5">
            <SubmitButton />
          </div>
        </aside>
      </div>
    </form>
  );
}
