"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildBuyerWhatsAppOrderUrl,
  getBuyerCheckoutSource
} from "@/lib/commerce/buyer-checkout";
import { calculateCheckoutTotal, parsePrice } from "@/lib/commerce/checkout";
import type { CommercePaymentMethod } from "@/lib/commerce/types";

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function parseQuantity(value: FormDataEntryValue | null) {
  const parsed = Number(cleanText(value, 20));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function parsePaymentMethod(value: string): CommercePaymentMethod | null {
  return value === "cod" || value === "stripe" || value === "whatsapp" || value === "paypal" || value === "youcan_pay" ? value : null;
}

function checkoutPath(sourceType: string, sourceSlug: string, error?: string) {
  const params = new URLSearchParams();

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return `/checkout/${sourceType}/${sourceSlug}${query ? `?${query}` : ""}`;
}

function successPath(input: {
  orderId: string;
  paymentMethod: CommercePaymentMethod;
  sourceSlug: string;
  sourceType: string;
  whatsappUrl?: string | null;
}) {
  const params = new URLSearchParams({
    method: input.paymentMethod,
    order: input.orderId,
    source: input.sourceSlug,
    type: input.sourceType
  });

  if (input.whatsappUrl) {
    params.set("whatsapp", input.whatsappUrl);
  }

  return `/checkout/success?${params.toString()}`;
}

export async function createBuyerCheckoutOrder(formData: FormData) {
  const sourceType = cleanText(formData.get("sourceType"), 20);
  const sourceSlug = cleanText(formData.get("sourceSlug"), 140);
  const productId = cleanText(formData.get("productId"), 140);
  const customerName = cleanText(formData.get("customerName"), 120);
  const customerPhone = cleanText(formData.get("customerPhone"), 80);
  const customerEmail = cleanText(formData.get("customerEmail"), 160);
  const city = cleanText(formData.get("city"), 120);
  const address = cleanText(formData.get("address"), 240);
  const buyerNotes = cleanText(formData.get("buyerNotes"), 500);
  const quantity = parseQuantity(formData.get("quantity"));
  const paymentMethod = parsePaymentMethod(cleanText(formData.get("paymentMethod"), 40));
  const source = await getBuyerCheckoutSource({ sourceSlug, sourceType });

  if (!source) {
    redirect(checkoutPath(sourceType || "store", sourceSlug || "missing", "source-not-found"));
  }

  if (!customerName || !customerPhone) {
    redirect(checkoutPath(sourceType, sourceSlug, "missing-customer"));
  }

  if (!quantity) {
    redirect(checkoutPath(sourceType, sourceSlug, "invalid-quantity"));
  }

  if (!paymentMethod || !source.paymentMethods.includes(paymentMethod)) {
    redirect(checkoutPath(sourceType, sourceSlug, "payment-method-disabled"));
  }

  const item = source.items.find((candidate) => candidate.id === productId) ?? source.items[0];

  if (!item) {
    redirect(checkoutPath(sourceType, sourceSlug, "product-not-found"));
  }

  const checkoutItems = [{ ...item, quantity }];
  const subtotal = calculateCheckoutTotal(checkoutItems);
  const total = subtotal;
  const products = checkoutItems.map((checkoutItem) => ({
    id: checkoutItem.id,
    name: checkoutItem.name,
    quantity: checkoutItem.quantity ?? 1,
    totalPrice: parsePrice(checkoutItem.price) * (checkoutItem.quantity ?? 1),
    unitPrice: parsePrice(checkoutItem.price)
  }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_commerce_order" as never, {
    p_address: address || null,
    p_city: city || null,
    p_currency: source.currency,
    p_customer_email: customerEmail || null,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_notes: buyerNotes || null,
    p_payment_method: paymentMethod,
    p_products: products,
    p_session_id: null,
    p_source_slug: source.sourceSlug,
    p_source_type: source.sourceType,
    p_subtotal: subtotal,
    p_total: total,
    p_visitor_id: null
  } as never);

  if (error) {
    redirect(checkoutPath(sourceType, sourceSlug, "order-save-failed"));
  }

  const orderId = String(data);
  const whatsappUrl =
    paymentMethod === "whatsapp"
      ? buildBuyerWhatsAppOrderUrl({
          address,
          city,
          customerName,
          customerPhone,
          item,
          notes: buyerNotes,
          quantity,
          source
        })
      : null;

  redirect(
    successPath({
      orderId,
      paymentMethod,
      sourceSlug,
      sourceType,
      whatsappUrl
    })
  );
}
