"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicStorefrontPreview } from "@/lib/public-storefront-preview";
import type { Json } from "@/types/database";

export type PublicStoreOrderState = {
  error: string | null;
  message: string | null;
  ok: boolean;
  orderId: string | null;
};

type CartSubmitItem = {
  id: string;
  quantity: number;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
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

function parseCartItems(value: FormDataEntryValue | null): CartSubmitItem[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is CartSubmitItem => {
        return (
          item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.quantity === "number"
        );
      })
      .map((item) => ({
        id: item.id,
        quantity: Math.max(1, Math.floor(item.quantity))
      }));
  } catch {
    return [];
  }
}

export async function createPublicStoreOrderAction(
  _prev: PublicStoreOrderState | null,
  formData: FormData
): Promise<PublicStoreOrderState> {
  const slug = cleanText(formData.get("slug"), 120).toLowerCase();
  const customerName = cleanText(formData.get("customerName"), 160);
  const customerPhone = cleanText(formData.get("customerPhone"), 80);
  const customerEmail = cleanText(formData.get("customerEmail"), 180);
  const customerAddress = cleanText(formData.get("customerAddress"), 500);
  const requestedItems = parseCartItems(formData.get("items"));

  if (!slug) {
    return { error: "Store not found.", message: null, ok: false, orderId: null };
  }

  if (!customerName || !customerPhone) {
    return {
      error: "Customer name and phone are required.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  if (!requestedItems.length) {
    return { error: "Your cart is empty.", message: null, ok: false, orderId: null };
  }

  const admin = createAdminClient();

  if (!admin) {
    return {
      error: "Order capture is not configured. Add SUPABASE_SERVICE_ROLE_KEY.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const preview = await getPublicStorefrontPreview(slug);

  if (!preview) {
    return { error: "Store not found or unpublished.", message: null, ok: false, orderId: null };
  }

  const { data: rawStore, error: storeError } = await admin
    .from("stores")
    .select("id, user_id, owner_user_id, slug, status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  const store = rawStore as {
    id: string;
    owner_user_id: string | null;
    slug: string | null;
    status: string;
    user_id: string;
  } | null;

  if (storeError || !store) {
    return { error: "Store not found or unpublished.", message: null, ok: false, orderId: null };
  }

  const productsById = new Map(preview.products.map((product) => [product.id, product]));
  const items = requestedItems
    .map((item) => {
      const product = productsById.get(item.id);

      if (!product) {
        return null;
      }

      const unitPrice = parsePrice(product.price);
      const lineTotal = unitPrice * item.quantity;

      return {
        categoryName: product.categoryName,
        id: product.id,
        imageUrl: product.imageUrl,
        price: unitPrice,
        priceLabel: product.priceLabel,
        quantity: item.quantity,
        title: product.title,
        total: lineTotal
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!items.length) {
    return {
      error: "Cart products are no longer available.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  const total = Number(items.reduce((sum, item) => sum + item.total, 0).toFixed(2));
  const { data: order, error: orderError } = await admin
    .from("store_orders")
    .insert({
      store_id: store.id,
      user_id: store.user_id,
      owner_user_id: store.owner_user_id ?? store.user_id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      customer_address: customerAddress || null,
      items: items as Json,
      subtotal: total,
      total,
      payment_method: "whatsapp",
      payment_status: "pending",
      order_status: "pending"
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[store-orders] create public order failed", {
      code: orderError?.code,
      message: orderError?.message,
      slug
    });
    return {
      error: "Order could not be submitted. Please try again.",
      message: null,
      ok: false,
      orderId: null
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");

  return {
    error: null,
    message: "Order submitted. The store owner can now see it in their dashboard.",
    ok: true,
    orderId: order.id
  };
}
