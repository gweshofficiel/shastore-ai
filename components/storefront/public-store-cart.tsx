"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import {
  createPublicStoreOrderDraftAction,
  type PublicStoreOrderState
} from "@/lib/store-order-actions";
import type { PublicShippingMethod } from "@/lib/public-shipping-methods";
import { calculateCheckoutFinancials, type PublicTaxSettings } from "@/lib/checkout-financials";
import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";
import type { PublicStorePaymentMethod, StorePaymentMethod } from "@/lib/store-payment-methods";

type CartItem = {
  categoryName: string | null;
  currency: string;
  id: string;
  image: string | null;
  inventoryStatus?: string | null;
  price: number | string | null;
  priceLabel: string | null;
  productId: string;
  quantity: number;
  stockQuantity?: number | null;
  storeId: string;
  title: string;
  trackInventory?: boolean;
  variantId?: string | null;
  variantName?: string | null;
  variantOptions?: Record<string, string>;
  variantSku?: string | null;
};

type AddToCartButtonProps = {
  currency: string;
  product: PublicStorefrontProduct;
  slug: string;
  storeId: string;
};

type CartPageClientProps = {
  currency: string;
  deliverySettings: {
    deliveryEnabled: boolean;
    deliveryFee: number | null;
    deliveryNotes: string | null;
    freeDeliveryThreshold: number | null;
    pickupEnabled: boolean;
  };
  paymentMethods?: PublicStorePaymentMethod[];
  products: PublicStorefrontProduct[];
  shippingMethods?: PublicShippingMethod[];
  slug: string;
  storeId: string;
  taxSettings?: PublicTaxSettings | null;
};

type CartScope = {
  currency: string;
  slug: string;
  storeId: string;
};

type CheckoutDeliveryMethod = "delivery" | "pickup" | "none";

type AppliedCoupon = {
  code: string;
  discountAmount: number;
};

type CartUpdatedDetail = {
  slug: string;
  storeId: string;
};

const CART_UPDATED_EVENT = "shastore-cart-updated";
const initialOrderDraftState: PublicStoreOrderState = {
  error: null,
  message: null,
  ok: false,
  orderId: null
};

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
        inventoryStatus:
          typeof (item as { inventoryStatus?: unknown }).inventoryStatus === "string"
            ? (item as { inventoryStatus: string }).inventoryStatus
            : null,
        price:
          typeof item.price === "number" || typeof item.price === "string" ? item.price : null,
        priceLabel: typeof item.priceLabel === "string" ? item.priceLabel : null,
        productId:
          typeof (item as { productId?: unknown }).productId === "string"
            ? (item as { productId: string }).productId
            : item.id,
        quantity: Math.max(1, Math.floor(item.quantity)),
        stockQuantity:
          typeof (item as { stockQuantity?: unknown }).stockQuantity === "number"
            ? (item as { stockQuantity: number }).stockQuantity
            : null,
        storeId,
        title: item.title,
        trackInventory: (item as { trackInventory?: unknown }).trackInventory === true,
        variantId:
          typeof (item as { variantId?: unknown }).variantId === "string"
            ? (item as { variantId: string }).variantId
            : null,
        variantName:
          typeof (item as { variantName?: unknown }).variantName === "string"
            ? (item as { variantName: string }).variantName
            : null,
        variantOptions:
          item.variantOptions && typeof item.variantOptions === "object"
            ? (item.variantOptions as Record<string, string>)
            : {},
        variantSku:
          typeof (item as { variantSku?: unknown }).variantSku === "string"
            ? (item as { variantSku: string }).variantSku
            : null
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

function paymentMethodDescription(method: StorePaymentMethod) {
  if (method === "cod") {
    return "Pay the seller when your order is delivered.";
  }

  if (method === "whatsapp") {
    return "Create the order and continue through WhatsApp.";
  }

  return "Foundation method only. No online payment is processed yet.";
}

function variantOptions(variant: PublicStorefrontProduct["variants"][number] | null) {
  if (!variant) {
    return {};
  }

  return Object.fromEntries(
    [
      ["Size", variant.optionSize],
      ["Color", variant.optionColor],
      ["Material", variant.optionMaterial],
      [variant.optionCustomName || "", variant.optionCustomValue]
    ].filter(([label, value]) => label && value)
  ) as Record<string, string>;
}

function cartLineId(productId: string, variantId?: string | null) {
  return variantId ? `${productId}:${variantId}` : productId;
}

function toCartItem(
  product: PublicStorefrontProduct,
  storeId: string,
  currency: string,
  variant: PublicStorefrontProduct["variants"][number] | null = null
): CartItem {
  const price = variant?.priceOverride ?? product.price;
  return {
    categoryName: product.categoryName,
    currency: product.currency || currency,
    id: cartLineId(product.id, variant?.id),
    image: product.imageUrl,
    inventoryStatus: variant && (variant.stockQuantity ?? 0) <= 0 ? "out_of_stock" : product.inventoryStatus,
    price,
    priceLabel: variant?.priceOverride ? null : product.priceLabel,
    productId: product.id,
    quantity: 1,
    stockQuantity: variant ? variant.stockQuantity : product.stockQuantity,
    storeId,
    title: product.title,
    trackInventory: variant ? true : product.trackInventory,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    variantOptions: variantOptions(variant),
    variantSku: variant?.sku ?? null
  };
}

function cartTotal(items: CartItem[]) {
  return items.reduce((total, item) => total + parsePrice(item.price) * item.quantity, 0);
}

function parseStockQuantity(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function isProductBlocked(product: PublicStorefrontProduct, quantity: number) {
  if (!product.trackInventory) {
    return { blocked: false as const, message: null, availableStock: null };
  }

  const availableStock = parseStockQuantity(product.stockQuantity);

  if (product.inventoryStatus === "out_of_stock" || availableStock <= 0) {
    return {
      blocked: true as const,
      message: "This product is out of stock.",
      availableStock
    };
  }

  if (quantity > availableStock) {
    return {
      blocked: true as const,
      message: `Only ${availableStock} available.`,
      availableStock
    };
  }

  return { blocked: false as const, message: null, availableStock };
}

function isVariantBlocked(
  variant: PublicStorefrontProduct["variants"][number] | null,
  quantity: number
) {
  if (!variant || variant.status !== "active") {
    return {
      blocked: true as const,
      message: "This option is no longer available.",
      availableStock: 0
    };
  }

  const availableStock = parseStockQuantity(variant.stockQuantity);

  if (availableStock <= 0) {
    return {
      blocked: true as const,
      message: "This option is out of stock.",
      availableStock
    };
  }

  if (quantity > availableStock) {
    return {
      blocked: true as const,
      message: `Only ${availableStock} available for this option.`,
      availableStock
    };
  }

  return { blocked: false as const, message: null, availableStock };
}

function cartItemAvailability(
  item: CartItem,
  productsById: Map<string, PublicStorefrontProduct>
) {
  const product = productsById.get(item.productId);

  if (!product || product.status !== "active") {
    return {
      blocked: true as const,
      message: "This product is no longer available.",
      availableStock: 0
    };
  }

  if (item.variantId) {
    return isVariantBlocked(
      product.variants.find((variant) => variant.id === item.variantId) ?? null,
      item.quantity
    );
  }

  if (product.variants.length) {
    return {
      blocked: true as const,
      message: "Choose an available option for this product again.",
      availableStock: 0
    };
  }

  return isProductBlocked(product, item.quantity);
}

function defaultDeliveryMethod(
  deliverySettings: CartPageClientProps["deliverySettings"],
  shippingMethods: PublicShippingMethod[] = []
): CheckoutDeliveryMethod {
  if (shippingMethods[0]?.type === "local_pickup") {
    return "pickup";
  }

  if (shippingMethods.length) {
    return "delivery";
  }

  if (deliverySettings.deliveryEnabled) {
    return "delivery";
  }

  if (deliverySettings.pickupEnabled) {
    return "pickup";
  }

  return "none";
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
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id ?? "");
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ?? null;
  const scope = useMemo(
    () => ({ currency, slug, storeId }),
    [currency, slug, storeId]
  );
  const { items } = useStoreCart(scope);
  const currentLineId = cartLineId(product.id, selectedVariant?.id);
  const currentQuantity =
    items.find(
      (item) =>
        item.id === currentLineId ||
        (item.productId === product.id && item.variantId === (selectedVariant?.id ?? null))
    )?.quantity ?? 0;
  const selectedAvailability = selectedVariant
    ? isVariantBlocked(selectedVariant, currentQuantity + 1)
    : product.variants.length
      ? {
          blocked: true as const,
          message: "Choose an available option.",
          availableStock: 0
        }
      : isProductBlocked(product, currentQuantity + 1);
  const selectedStockQuantity = selectedVariant
    ? parseStockQuantity(selectedVariant.stockQuantity)
    : parseStockQuantity(product.stockQuantity);
  const isOutOfStock = selectedVariant
    ? selectedVariant.status !== "active" || selectedStockQuantity <= 0
    : product.variants.length
      ? true
      : product.trackInventory &&
        (product.inventoryStatus === "out_of_stock" || selectedStockQuantity <= 0);
  const isAddToCartDisabled = isOutOfStock || selectedAvailability.blocked;
  const stockMessage = isOutOfStock
    ? "Out of stock"
    : selectedAvailability.blocked
      ? selectedAvailability.message ?? "This product is out of stock or quantity is not available."
      : selectedAvailability.availableStock !== null &&
          selectedAvailability.availableStock <= currentQuantity + 1
        ? "Last available item."
        : null;

  function handleAddToCart() {
    if (isAddToCartDisabled) {
      return;
    }

    const current = readStoreCart(scope);
    const lineId = cartLineId(product.id, selectedVariant?.id);
    const availableStock = selectedVariant?.stockQuantity ?? product.stockQuantity ?? 0;
    const existing = current.find(
      (item) => item.id === lineId || (item.productId === product.id && item.variantId === selectedVariant?.id)
    );
    const next = existing
      ? current.map((item) =>
          item.id === lineId || (item.productId === product.id && item.variantId === selectedVariant?.id)
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + 1,
                  selectedVariant || product.trackInventory ? availableStock : item.quantity + 1
                )
              }
            : item
        )
      : [...current, toCartItem(product, storeId, currency, selectedVariant)];

    writeStoreCart(scope, next);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="grid gap-3">
      {product.variants.length ? (
        <label className="grid gap-2 text-sm font-bold text-ink">
          <span>Choose option</span>
          <select
            className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-ink"
            onChange={(event) => setSelectedVariantId(event.target.value)}
            value={selectedVariantId}
          >
            {product.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name}
                {variant.priceOverride ? ` · ${formatMoney(parsePrice(variant.priceOverride), product.currency || currency)}` : ""}
                {(variant.stockQuantity ?? 0) <= 0 ? " · out of stock" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {stockMessage ? (
        <p
          className={`rounded-2xl border px-4 py-3 text-center text-base font-black ${
            isOutOfStock
              ? "border-red-600 bg-red-600 text-white shadow-lg shadow-red-200"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {stockMessage}
        </p>
      ) : null}
      <button
        className={`inline-flex h-11 items-center justify-center border px-4 text-sm font-black transition ${
          isAddToCartDisabled
            ? "pointer-events-none cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500 opacity-50"
            : "border-transparent text-white hover:opacity-90"
        }`}
        disabled={isAddToCartDisabled}
        onClick={handleAddToCart}
        style={{
          backgroundColor: isAddToCartDisabled ? undefined : "var(--store-primary, #0f172a)",
          borderRadius: "var(--store-border-radius, 9999px)"
        }}
        type="button"
      >
        {isAddToCartDisabled ? "Unavailable" : added ? "Added to cart" : "Add to cart"}
      </button>
    </div>
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

export function ClearStoreCartOnOrderSuccess({
  currency,
  orderId,
  slug,
  storeId
}: {
  currency: string;
  orderId: string;
  slug: string;
  storeId: string;
}) {
  const scope = useMemo(
    () => ({ currency, slug, storeId }),
    [currency, slug, storeId]
  );

  useEffect(() => {
    if (!orderId) {
      return;
    }

    clearStoreCart(scope);
  }, [orderId, scope]);

  return null;
}

export function CartPageClient({
  currency,
  deliverySettings,
  paymentMethods = [],
  products,
  shippingMethods = [],
  slug,
  storeId,
  taxSettings = null
}: CartPageClientProps) {
  const scope = useMemo(
    () => ({ currency, slug, storeId }),
    [currency, slug, storeId]
  );
  const { items, persistItems } = useStoreCart(scope);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [draftState, submitDraft, isDraftPending] = useActionState(
    createPublicStoreOrderDraftAction,
    initialOrderDraftState
  );
  const activeShippingMethods = useMemo(
    () => shippingMethods.filter((method) => method.type !== "local_pickup"),
    [shippingMethods]
  );
  const activePickupMethods = useMemo(
    () => shippingMethods.filter((method) => method.type === "local_pickup"),
    [shippingMethods]
  );
  const [deliveryMethod, setDeliveryMethod] = useState<CheckoutDeliveryMethod>(
    defaultDeliveryMethod(deliverySettings, shippingMethods)
  );
  const [shippingMethodId, setShippingMethodId] = useState(shippingMethods[0]?.id ?? "");
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<StorePaymentMethod | "">(
    paymentMethods[0]?.method ?? ""
  );
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const itemAvailabilityById = useMemo(
    () =>
      new Map(
        items.map((item) => [
          item.id,
          cartItemAvailability(item, productsById)
        ])
      ),
    [items, productsById]
  );
  const hasUnavailableItems = [...itemAvailabilityById.values()].some(
    (availability) => availability.blocked
  );
  const total = useMemo(() => cartTotal(items), [items]);
  const discountAmount = appliedCoupon ? Math.min(total, appliedCoupon.discountAmount) : 0;
  const selectedShippingMethod =
    shippingMethods.find((method) => method.id === shippingMethodId) ?? null;
  const shippingThresholdReached =
    selectedShippingMethod?.freeShippingThreshold != null &&
    Math.max(0, total - discountAmount) >= selectedShippingMethod.freeShippingThreshold;
  const selectedDeliveryFee = selectedShippingMethod
    ? shippingThresholdReached
      ? 0
      : selectedShippingMethod.fee
    : deliveryMethod === "delivery"
      ? deliverySettings.deliveryFee ?? 0
      : 0;
  const financialBreakdown = calculateCheckoutFinancials({
    discountAmount,
    shippingAmount: selectedDeliveryFee,
    subtotalAmount: total,
    taxSettings
  });
  const finalTotal = financialBreakdown.totalAmount;

  useEffect(() => {
    setAppliedCoupon(null);
    setCouponMessage(null);
  }, [total]);

  useEffect(() => {
    if (!paymentMethods.length) {
      setPaymentMethod("");
      return;
    }

    if (!paymentMethods.some((method) => method.method === paymentMethod)) {
      setPaymentMethod(paymentMethods[0].method);
    }
  }, [paymentMethod, paymentMethods]);

  useEffect(() => {
    if (!shippingMethods.length || shippingMethods.some((method) => method.id === shippingMethodId)) {
      return;
    }

    const nextMethod = shippingMethods[0];
    setShippingMethodId(nextMethod.id);
    setDeliveryMethod(nextMethod.type === "local_pickup" ? "pickup" : "delivery");
  }, [shippingMethodId, shippingMethods]);

  function updateQuantity(itemId: string, quantity: number) {
    if (quantity < 1) {
      removeItem(itemId);
      return;
    }

    persistItems(
      items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const product = productsById.get(item.productId);
        const variant = item.variantId
          ? product?.variants.find((candidate) => candidate.id === item.variantId) ?? null
          : null;
        const maxQuantity = variant
          ? parseStockQuantity(variant.stockQuantity)
          : product?.trackInventory
            ? parseStockQuantity(product.stockQuantity)
            : quantity;

        return {
          ...item,
          quantity: Math.max(1, Math.min(quantity, maxQuantity || item.quantity))
        };
      })
    );
  }

  function removeItem(itemId: string) {
    persistItems(
      items.filter((item) => item.id !== itemId)
    );
  }

  async function applyCoupon() {
    const code = couponCode.trim();

    if (!code) {
      setCouponMessage("Enter a coupon code.");
      setAppliedCoupon(null);
      return;
    }

    setCouponPending(true);
    setCouponMessage(null);

    try {
      const response = await fetch("/api/store-coupons/validate", {
        body: JSON.stringify({ code, slug, storeId, subtotal: total }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const data = (await response.json()) as {
        code?: string;
        discountAmount?: number;
        error?: string;
      };

      if (!response.ok || !data.code || typeof data.discountAmount !== "number") {
        setAppliedCoupon(null);
        setCouponMessage(data.error ?? "Coupon could not be applied.");
        return;
      }

      setAppliedCoupon({
        code: data.code,
        discountAmount: data.discountAmount
      });
      setCouponCode(data.code);
      setCouponMessage(`${data.code} applied.`);
    } catch {
      setAppliedCoupon(null);
      setCouponMessage("Coupon could not be applied.");
    } finally {
      setCouponPending(false);
    }
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
        {items.map((item) => {
          const availability = itemAvailabilityById.get(item.id);

          return (
          <article
            className={`grid gap-4 rounded-[2rem] border bg-white p-4 sm:grid-cols-[120px_minmax(0,1fr)] ${
              availability?.blocked ? "border-red-200" : "border-slate-200"
            }`}
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
                  {item.variantName ? (
                    <p className="mt-1 text-xs font-bold text-muted">
                      {item.variantName}
                      {item.variantSku ? ` · ${item.variantSku}` : ""}
                    </p>
                  ) : null}
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
              {availability?.blocked ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {availability.message ??
                    "This product is out of stock or quantity is not available."}
                </div>
              ) : null}
            </div>
          </article>
          );
        })}
      </div>

      <aside className="h-fit rounded-[2rem] border border-slate-200 bg-white p-5 lg:sticky lg:top-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Checkout
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
          Order summary
        </h2>
        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5">
          {items.map((item) => (
            <div
              className="flex items-start justify-between gap-3 text-sm"
              key={`summary-${item.id}`}
            >
              <div>
                <p className="font-black text-ink">{item.title}</p>
                {item.variantName ? (
                  <p className="mt-1 text-xs font-bold text-muted">
                    {item.variantName}
                    {item.variantSku ? ` · ${item.variantSku}` : ""}
                  </p>
                ) : null}
                <p className="mt-1 font-bold text-muted">
                  {item.quantity} x {displayPrice(item, item.currency || currency)}
                </p>
              </div>
              <p className="font-black text-ink">
                {formatMoney(parsePrice(item.price) * item.quantity, item.currency || currency)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 text-sm font-bold text-muted">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Coupon
            </p>
            <div className="mt-3 flex gap-2">
              <input
                className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                onChange={(event) => {
                  setCouponCode(event.target.value);
                  setAppliedCoupon(null);
                  setCouponMessage(null);
                }}
                placeholder="WELCOME10"
                value={couponCode}
              />
              <button
                className="h-11 rounded-full bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-300"
                disabled={couponPending}
                onClick={applyCoupon}
                type="button"
              >
                {couponPending ? "Checking..." : "Apply"}
              </button>
            </div>
            {couponMessage ? (
              <p className="mt-2 text-xs font-bold text-muted">{couponMessage}</p>
            ) : null}
            {appliedCoupon ? (
              <div className="mt-3 flex justify-between text-emerald-700">
                <span>Discount ({appliedCoupon.code})</span>
                <span>-{formatMoney(discountAmount, currency)}</span>
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Delivery summary
            </p>
            {shippingMethods.length ? (
              <div className="mt-3 grid gap-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Choose shipping method
                </p>
                <div className="grid gap-2">
                  {shippingMethods.map((method) => (
                    <button
                      className={`rounded-2xl border px-3 py-3 text-left text-sm font-black transition ${
                        shippingMethodId === method.id
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-ink"
                      }`}
                      key={method.id}
                      onClick={() => {
                        setShippingMethodId(method.id);
                        setDeliveryMethod(method.type === "local_pickup" ? "pickup" : "delivery");
                      }}
                      type="button"
                    >
                      <span className="block">{method.name}</span>
                      <span className={`mt-1 block text-xs ${shippingMethodId === method.id ? "text-white/70" : "text-muted"}`}>
                        {method.type.replace(/_/g, " ")} · {formatMoney(method.fee, currency)}
                        {method.estimatedMinDays || method.estimatedMaxDays
                          ? ` · ${method.estimatedMinDays ?? method.estimatedMaxDays}-${method.estimatedMaxDays ?? method.estimatedMinDays} days`
                          : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : deliverySettings.deliveryEnabled || deliverySettings.pickupEnabled ? (
              <div className="mt-3 grid gap-2">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Choose method
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {deliverySettings.deliveryEnabled ? (
                    <button
                      className={`rounded-2xl border px-3 py-2 text-left text-sm font-black transition ${
                        deliveryMethod === "delivery"
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-ink"
                      }`}
                      onClick={() => setDeliveryMethod("delivery")}
                      type="button"
                    >
                      Delivery
                    </button>
                  ) : null}
                  {deliverySettings.pickupEnabled ? (
                    <button
                      className={`rounded-2xl border px-3 py-2 text-left text-sm font-black transition ${
                        deliveryMethod === "pickup"
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-ink"
                      }`}
                      onClick={() => setDeliveryMethod("pickup")}
                      type="button"
                    >
                      Pickup
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs font-semibold leading-5 text-muted">
                The store has not enabled delivery or pickup options yet.
              </p>
            )}
            <div className="mt-3 grid gap-2">
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>{activeShippingMethods.length || deliverySettings.deliveryEnabled ? "Available" : "Not enabled"}</span>
              </div>
              <div className="flex justify-between">
                <span>Pickup</span>
                <span>{activePickupMethods.length || deliverySettings.pickupEnabled ? "Available" : "Not enabled"}</span>
              </div>
              <div className="flex justify-between">
                <span>Selected fee</span>
                <span>{formatMoney(selectedDeliveryFee, currency)}</span>
              </div>
              {deliverySettings.freeDeliveryThreshold !== null ? (
                <div className="flex justify-between">
                  <span>Free delivery from</span>
                  <span>{formatMoney(deliverySettings.freeDeliveryThreshold, currency)}</span>
                </div>
              ) : null}
            </div>
            {deliverySettings.deliveryNotes ? (
              <p className="mt-3 whitespace-pre-line text-xs font-semibold leading-5 text-muted">
                {deliverySettings.deliveryNotes}
              </p>
            ) : null}
            {selectedShippingMethod?.deliveryNotes ? (
              <p className="mt-3 whitespace-pre-line text-xs font-semibold leading-5 text-muted">
                {selectedShippingMethod.deliveryNotes}
              </p>
            ) : null}
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
              The selected shipping method fee is included in your order total.
            </p>
          </div>
          <div className="flex justify-between">
            <span>Currency</span>
            <span>{currency}</span>
          </div>
          {taxSettings?.taxEnabled ? (
            <div className="flex justify-between">
              <span>
                {financialBreakdown.taxName ?? taxSettings.taxName} ({financialBreakdown.taxRate}%)
                {financialBreakdown.pricesIncludeTax ? " included" : ""}
              </span>
              <span>{formatMoney(financialBreakdown.taxAmount, currency)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-lg font-black text-ink">
            <span>Total</span>
            <span>{formatMoney(finalTotal, currency)}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-3 border-t border-slate-100 pt-6">
          {hasUnavailableItems ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              Fix unavailable cart items before checkout.
            </div>
          ) : null}
          {!paymentMethods.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
              This store has not enabled any checkout payment methods yet.
            </div>
          ) : null}
          {!checkoutStarted ? (
            <button
              className="h-12 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={hasUnavailableItems || !paymentMethods.length}
              onClick={() => {
                setCheckoutStarted(true);
              }}
              type="button"
            >
              Continue to checkout details
            </button>
          ) : null}
        </div>
        {checkoutStarted ? (
          <form
            className="mt-5 grid gap-3"
            action={submitDraft}
          >
          <input name="slug" type="hidden" value={slug} />
          <input name="storeId" type="hidden" value={storeId} />
          <input name="deliveryMethod" type="hidden" value={deliveryMethod} />
          <input name="paymentMethod" type="hidden" value={paymentMethod} />
          <input name="shippingMethodId" type="hidden" value={shippingMethodId} />
          <input name="couponCode" type="hidden" value={appliedCoupon?.code ?? ""} />
          <input
            name="items"
            type="hidden"
            value={JSON.stringify(
              items.map((item) => ({
                id: item.productId,
                quantity: item.quantity,
                variantId: item.variantId ?? null
              }))
            )}
          />
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Customer full name *</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="customerName"
              placeholder="Full name"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Phone *</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="customerPhone"
              placeholder="+15551234567"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Email optional</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="customerEmail"
              placeholder="customer@example.com"
              type="email"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Address optional</span>
            <textarea
              className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="customerAddress"
              placeholder="Delivery address"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Notes optional</span>
            <textarea
              className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="customerNotes"
              placeholder="Delivery notes, preferred time, or special requests"
            />
          </label>
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-ink">Payment method *</p>
            <div className="grid gap-2">
              {paymentMethods.map((method) => (
                <button
                  className={`rounded-2xl border p-3 text-left transition ${
                    paymentMethod === method.method
                      ? "border-ink bg-ink text-white"
                      : "border-slate-200 bg-white text-ink hover:border-slate-300"
                  }`}
                  key={method.method}
                  onClick={() => setPaymentMethod(method.method)}
                  type="button"
                >
                  <span className="block text-sm font-black">{method.displayName}</span>
                  <span
                    className={`mt-1 block text-xs font-semibold ${
                      paymentMethod === method.method ? "text-white/70" : "text-muted"
                    }`}
                  >
                    {method.instructions || paymentMethodDescription(method.method)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {draftState.error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {draftState.error}
            </div>
          ) : null}
          {draftState.message ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
              {draftState.message}
            </div>
          ) : null}
          <button
            className="h-12 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={hasUnavailableItems || isDraftPending || draftState.ok || !paymentMethod}
            type="submit"
          >
            {isDraftPending
              ? "Preparing draft..."
              : draftState.ok
                ? "Draft prepared"
                : "Prepare order draft"}
          </button>
          </form>
        ) : null}
        {paymentMethods.some((method) => method.method === "paypal" || method.method === "youcan_pay") ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">
            PayPal and YouCan Pay are selectable foundation methods only. No online payment is processed yet.
          </div>
        ) : null}
      </aside>
    </div>
  );
}
