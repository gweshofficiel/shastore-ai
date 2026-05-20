import type { CommercePaymentMethod, CommerceSourceType } from "@/lib/commerce/types";

export type CheckoutItem = {
  id: string;
  name: string;
  price: string;
  imageUrl?: string | null;
  quantity?: number;
};

export type CheckoutSource = {
  sourceType: CommerceSourceType;
  sourceId: string;
  sourceSlug: string;
  title: string;
  currency: string;
  whatsappNumber?: string | null;
  paymentMethods: CommercePaymentMethod[];
  items: CheckoutItem[];
};

export function parsePrice(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

export function calculateCheckoutTotal(items: CheckoutItem[]) {
  return items.reduce((total, item) => {
    const quantity = Math.max(Number(item.quantity ?? 1), 1);
    return total + parsePrice(item.price) * quantity;
  }, 0);
}

export function formatCheckoutMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency || "USD"
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "USD"}`;
  }
}

export function buildWhatsAppOrderUrl({
  address,
  city,
  customerName,
  items,
  notes,
  paymentMethod,
  phone,
  source,
  total
}: {
  address?: string;
  city?: string;
  customerName: string;
  items: CheckoutItem[];
  notes?: string;
  paymentMethod: CommercePaymentMethod;
  phone?: string;
  source: CheckoutSource;
  total: number;
}) {
  const destination = (source.whatsappNumber ?? "").replace(/[^0-9]/g, "");
  if (!destination) {
    return null;
  }

  const lines = [
    `New order from ${source.title}`,
    `Customer: ${customerName}`,
    phone ? `Phone: ${phone}` : null,
    city ? `City: ${city}` : null,
    address ? `Address: ${address}` : null,
    "",
    "Items:",
    ...items.map((item) => `- ${item.name} x${item.quantity ?? 1} (${item.price})`),
    "",
    `Payment: ${paymentMethod}`,
    `Total: ${formatCheckoutMoney(total, source.currency)}`,
    notes ? `Notes: ${notes}` : null
  ].filter(Boolean);

  return `https://wa.me/${destination}?text=${encodeURIComponent(lines.join("\n"))}`;
}
