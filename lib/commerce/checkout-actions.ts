"use server";

import { createClient } from "@/lib/supabase/server";
import type { CommerceAnalyticsEventType, CommercePaymentMethod } from "@/lib/commerce/types";

type CheckoutResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function parseJsonArray(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePaymentMethod(value: string): CommercePaymentMethod {
  if (value === "cod" || value === "whatsapp") {
    return value;
  }

  return "whatsapp";
}

function parseAmount(value: FormDataEntryValue | null) {
  const parsed = Number(cleanText(value, 32));
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

export async function submitCommerceCheckout(
  _previousState: CheckoutResult,
  formData: FormData
): Promise<CheckoutResult> {
  const supabase = await createClient();
  const sourceType = cleanText(formData.get("sourceType"), 20);
  const sourceSlug = cleanText(formData.get("sourceSlug"), 140);
  const customerName = cleanText(formData.get("customerName"), 120);
  const customerPhone = cleanText(formData.get("customerPhone"), 80);
  const customerEmail = cleanText(formData.get("customerEmail"), 160);
  const city = cleanText(formData.get("city"), 120);
  const address = cleanText(formData.get("address"), 240);
  const notes = cleanText(formData.get("notes"), 500);
  const paymentMethod = parsePaymentMethod(cleanText(formData.get("paymentMethod"), 40));
  const products = parseJsonArray(formData.get("products"));
  const subtotal = parseAmount(formData.get("subtotal"));
  const total = parseAmount(formData.get("total"));
  const currency = cleanText(formData.get("currency"), 8) || "USD";
  const visitorId = cleanText(formData.get("visitorId"), 120);
  const sessionId = cleanText(formData.get("sessionId"), 120);

  if ((sourceType !== "landing" && sourceType !== "store") || !sourceSlug) {
    return { ok: false, error: "Invalid order source." };
  }

  if (!customerName || !customerPhone) {
    return { ok: false, error: "Name and phone are required." };
  }

  const { data, error } = await supabase.rpc("create_commerce_order" as never, {
    p_source_type: sourceType,
    p_source_slug: sourceSlug,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_customer_email: customerEmail || null,
    p_city: city || null,
    p_address: address || null,
    p_notes: notes || null,
    p_payment_method: paymentMethod,
    p_products: products,
    p_subtotal: subtotal,
    p_total: total,
    p_currency: currency,
    p_visitor_id: visitorId || null,
    p_session_id: sessionId || null
  } as never);

  if (error) {
    const message =
      error.code === "PGRST202"
        ? "Unified checkout SQL is not installed yet. Apply supabase/migrations/unified-checkout-safe.sql."
        : error.message || "Order could not be saved.";
    return { ok: false, error: message };
  }

  return { ok: true, orderId: String(data) };
}

export async function trackCommerceEvent(input: {
  sourceType: "landing" | "store";
  sourceSlug: string;
  eventType: CommerceAnalyticsEventType;
  visitorId?: string;
  sessionId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const supabase = await createClient();

  try {
    await supabase.rpc("track_commerce_event" as never, {
      p_source_type: input.sourceType,
      p_source_slug: input.sourceSlug,
      p_event_type: input.eventType,
      p_visitor_id: input.visitorId ?? null,
      p_session_id: input.sessionId ?? null,
      p_metadata: input.metadata ?? {}
    } as never);
  } catch {
    // Analytics must never block checkout.
  }
}
