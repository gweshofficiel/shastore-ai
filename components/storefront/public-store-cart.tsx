"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPublicStoreOrderDraftAction,
  type PublicStoreOrderState
} from "@/lib/store-order-actions";
import { matchPublicShippingRate, type PublicShippingMethod } from "@/lib/public-shipping-methods";
import { calculateCheckoutFinancials, type PublicTaxSettings } from "@/lib/checkout-financials";
import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";
import type {
  PublicStorePaymentMethod,
  PublicStorePaymentMethodKey
} from "@/lib/store-payment-methods";

export type CartItem = {
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
  detailsHref?: string;
  product: PublicStorefrontProduct;
  showBuyNow?: boolean;
  showViewDetails?: boolean;
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
  initialCouponCode?: string;
  initialRecoveryItems?: CartItem[];
  initialRecoverySessionId?: string | null;
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

type SavedCheckoutAddress = {
  address_line1: string;
  address_line2: string | null;
  city: string;
  country: string;
  full_name: string | null;
  id: string;
  is_default: boolean;
  notes: string | null;
  phone: string | null;
  postal_code: string | null;
};

type CartUpdatedDetail = {
  slug: string;
  storeId: string;
};

const CART_UPDATED_EVENT = "shastore-cart-updated";
const CART_RECOVERY_SESSION_KEY = "shastore_cart_recovery_session";
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

function checkoutContactStorageKey(storeId: string) {
  return `shastore_checkout_contact_${storeId}`;
}

/** Legacy slug-only key — cleared on every write to prevent stale rehydration. */
function legacyCartStorageKey(slug: string) {
  return `shastore_cart_${slug}`;
}

function cartRecoverySessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(CART_RECOVERY_SESSION_KEY);

  if (existing && /^[a-zA-Z0-9_-]{16,160}$/.test(existing)) {
    return existing;
  }

  const generated =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `cart_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(CART_RECOVERY_SESSION_KEY, generated);
  return generated;
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

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function formatSavedAddress(address: SavedCheckoutAddress) {
  return [
    address.full_name,
    address.phone,
    address.address_line1,
    address.address_line2,
    [address.city, address.country, address.postal_code].filter(Boolean).join(", ")
  ]
    .filter(Boolean)
    .join("\n");
}

function savedAddressLabel(address: SavedCheckoutAddress) {
  const labelParts = [
    address.full_name?.trim(),
    address.address_line1?.trim(),
    address.city?.trim()
  ].filter(Boolean);

  return labelParts.join(" - ") || "Saved address";
}

function defaultSavedAddress(addresses: SavedCheckoutAddress[]) {
  return addresses.find((address) => address.is_default) ?? addresses[0] ?? null;
}

function hasPhysicalShippingItems(items: CartItem[], productsById: Map<string, PublicStorefrontProduct>) {
  return items.some((item) => {
    const product = productsById.get(item.productId);
    return !product || product.productType !== "digital" || product.requiresShipping !== false;
  });
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

function paymentMethodDescription(method: PublicStorePaymentMethodKey) {
  if (method === "cod") {
    return "Pay the seller when your order is delivered.";
  }

  if (method === "whatsapp") {
    return "Create the order and continue through WhatsApp.";
  }

  if (method === "card") {
    return "Pay securely with Visa or Mastercard.";
  }

  if (method === "paypal") {
    return "Pay securely with this store's connected PayPal account.";
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

export function addProductToStoreCart({
  currency,
  product,
  quantity = 1,
  slug,
  storeId,
  variantId = null
}: {
  currency: string;
  product: PublicStorefrontProduct;
  quantity?: number;
  slug: string;
  storeId: string;
  variantId?: string | null;
}) {
  const scope = { currency, slug, storeId };
  const selectedVariant = variantId
    ? product.variants.find((variant) => variant.id === variantId) ?? null
    : product.variants[0] ?? null;

  if (product.variants.length && !selectedVariant) {
    return { message: "Choose an available option.", ok: false };
  }

  const requestedQuantity = Math.max(1, Math.floor(quantity));
  const current = readStoreCart(scope);
  const lineId = cartLineId(product.id, selectedVariant?.id);
  const existing = current.find(
    (item) =>
      item.id === lineId ||
      (item.productId === product.id && item.variantId === (selectedVariant?.id ?? null))
  );
  const currentQuantity = existing?.quantity ?? 0;
  const availability = selectedVariant
    ? isVariantBlocked(selectedVariant, currentQuantity + requestedQuantity)
    : product.variants.length
      ? {
          blocked: true as const,
          message: "Choose an available option.",
          availableStock: 0
        }
      : isProductBlocked(product, currentQuantity + requestedQuantity);

  if (availability.blocked) {
    return {
      message: availability.message ?? "This product is out of stock or quantity is not available.",
      ok: false
    };
  }

  const availableStock = selectedVariant?.stockQuantity ?? product.stockQuantity ?? 0;
  const next = existing
    ? current.map((item) =>
        item.id === lineId ||
        (item.productId === product.id && item.variantId === selectedVariant?.id)
          ? {
              ...item,
              quantity: Math.min(
                item.quantity + requestedQuantity,
                selectedVariant || product.trackInventory
                  ? availableStock
                  : item.quantity + requestedQuantity
              )
            }
          : item
      )
    : [
        ...current,
        {
          ...toCartItem(product, storeId, currency, selectedVariant),
          quantity: selectedVariant || product.trackInventory
            ? Math.min(requestedQuantity, availableStock)
            : requestedQuantity
        }
      ];

  writeStoreCart(scope, next);
  return { message: "Added to cart.", ok: true };
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

export function AddToCartButton({
  currency,
  detailsHref,
  product,
  showBuyNow = false,
  showViewDetails = false,
  slug,
  storeId
}: AddToCartButtonProps) {
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

  function addSelectedProductToCart() {
    return addProductToStoreCart({
      currency,
      product,
      slug,
      storeId,
      variantId: selectedVariant?.id ?? null
    }).ok;
  }

  function handleAddToCart() {
    if (!addSelectedProductToCart()) {
      return;
    }

    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  function handleBuyNow() {
    if (!addSelectedProductToCart()) {
      return;
    }

    window.location.assign(`/store/${slug}/cart`);
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
      {showViewDetails && detailsHref ? (
        <Link
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-ink transition hover:border-slate-300 hover:bg-slate-50"
          href={detailsHref}
        >
          View product details
        </Link>
      ) : null}
      {showBuyNow ? (
        <button
          className={`inline-flex h-11 items-center justify-center rounded-full border px-4 text-sm font-black transition ${
            isAddToCartDisabled
              ? "pointer-events-none cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500 opacity-50"
              : "border-transparent text-white hover:opacity-90"
          }`}
          disabled={isAddToCartDisabled}
          onClick={handleBuyNow}
          style={{
            backgroundColor: isAddToCartDisabled ? undefined : "var(--store-primary, #0f172a)"
          }}
          type="button"
        >
          Buy Now
        </button>
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
    window.localStorage.removeItem(CART_RECOVERY_SESSION_KEY);
  }, [orderId, scope]);

  return null;
}

export function CartPageClient({
  currency,
  deliverySettings,
  initialCouponCode = "",
  initialRecoveryItems = [],
  initialRecoverySessionId = null,
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
  const [couponMessageType, setCouponMessageType] = useState<"error" | "success" | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  const [autoCouponAttempted, setAutoCouponAttempted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PublicStorePaymentMethodKey | "">(
    paymentMethods[0]?.method ?? ""
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedCheckoutAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressMessage, setAddressMessage] = useState<string | null>(null);
  const [cartSessionId, setCartSessionId] = useState("");
  const [recoveryRestored, setRecoveryRestored] = useState(false);
  const [reservationPending, setReservationPending] = useState(false);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const customerAddressRef = useRef("");
  const customerNameRef = useRef("");
  const customerNotesRef = useRef("");
  const selectedAddressIdRef = useRef("");
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
  const needsShippingAddress = hasPhysicalShippingItems(items, productsById);
  const total = useMemo(() => cartTotal(items), [items]);
  const discountAmount = appliedCoupon ? Math.min(total, appliedCoupon.discountAmount) : 0;
  const rateSubtotal = Math.max(0, total - discountAmount);
  const selectedShippingMethod =
    shippingMethods.find((method) => method.id === shippingMethodId) ?? null;
  const selectedShippingRateMatch = matchPublicShippingRate({
    addressText: customerAddress,
    method: selectedShippingMethod,
    subtotalAmount: rateSubtotal,
    totalWeight: null
  });
  const shippingUnavailable = needsShippingAddress && selectedShippingRateMatch.unavailable;
  const selectedDeliveryFee = selectedShippingMethod
    ? selectedShippingRateMatch.shippingAmount
    : deliveryMethod === "delivery"
      ? deliverySettings.deliveryFee ?? 0
      : 0;
  const financialBreakdown = calculateCheckoutFinancials({
    customerAddress,
    discountAmount,
    shippingAmount: selectedDeliveryFee,
    subtotalAmount: total,
    taxSettings
  });
  const discountedSubtotal = financialBreakdown.discountedSubtotalAmount;
  const finalTotal = financialBreakdown.totalAmount;

  useEffect(() => {
    if (initialRecoverySessionId && /^[a-zA-Z0-9_-]{16,160}$/.test(initialRecoverySessionId)) {
      window.localStorage.setItem(CART_RECOVERY_SESSION_KEY, initialRecoverySessionId);
      setCartSessionId(initialRecoverySessionId);
      return;
    }

    setCartSessionId(cartRecoverySessionId());
  }, [initialRecoverySessionId]);

  useEffect(() => {
    if (recoveryRestored || !initialRecoveryItems.length) {
      return;
    }

    persistItems(initialRecoveryItems);
    setRecoveryRestored(true);
  }, [initialRecoveryItems, persistItems, recoveryRestored]);

  useEffect(() => {
    customerAddressRef.current = customerAddress;
    customerNameRef.current = customerName;
    customerNotesRef.current = customerNotes;
    selectedAddressIdRef.current = selectedAddressId;
  }, [customerAddress, customerName, customerNotes, selectedAddressId]);

  useEffect(() => {
    const raw = window.localStorage.getItem(checkoutContactStorageKey(storeId));

    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        customerEmail?: unknown;
        customerName?: unknown;
        customerPhone?: unknown;
      };

      if (typeof parsed.customerName === "string") {
        setCustomerName(parsed.customerName);
      }

      if (typeof parsed.customerPhone === "string") {
        setCustomerPhone(parsed.customerPhone);
      }

      if (typeof parsed.customerEmail === "string") {
        setCustomerEmail(parsed.customerEmail);
      }
    } catch {
      window.localStorage.removeItem(checkoutContactStorageKey(storeId));
    }
  }, [storeId]);

  useEffect(() => {
    if (!customerName && !customerPhone && !customerEmail) {
      return;
    }

    window.localStorage.setItem(
      checkoutContactStorageKey(storeId),
      JSON.stringify({
        customerEmail,
        customerName,
        customerPhone
      })
    );
  }, [customerEmail, customerName, customerPhone, storeId]);

  useEffect(() => {
    setAppliedCoupon(null);
    setCouponMessage(null);
    setCouponMessageType(null);
  }, [total]);

  useEffect(() => {
    const initialCode = initialCouponCode.trim();

    if (!initialCode || autoCouponAttempted || total <= 0) {
      return;
    }

    setAutoCouponAttempted(true);
    setCouponCode(initialCode);
    void applyCoupon(initialCode);
  }, [autoCouponAttempted, initialCouponCode, total]);

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

  useEffect(() => {
    const normalizedPhone = normalizePhone(customerPhone);

    if (!checkoutStarted || !needsShippingAddress || normalizedPhone.length < 4) {
      setSavedAddresses([]);
      setSelectedAddressId("");
      setAddressMessage(null);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      const params = new URLSearchParams({
        phone: customerPhone,
        slug,
        storeId
      });

      try {
        const response = await fetch(`/api/store-addresses?${params.toString()}`, {
          cache: "no-store"
        });
        const payload = await response.json().catch(() => null);
        const addresses = Array.isArray(payload?.addresses)
          ? (payload.addresses as SavedCheckoutAddress[])
          : [];

        if (cancelled) {
          return;
        }

        setSavedAddresses(addresses);
        setAddressMessage(addresses.length ? null : "No saved addresses found for this phone.");

        const defaultAddress = defaultSavedAddress(addresses);
        if (defaultAddress && !selectedAddressIdRef.current && !customerAddressRef.current.trim()) {
          setSelectedAddressId(defaultAddress.id);
          setCustomerName(defaultAddress.full_name ?? customerNameRef.current);
          setCustomerPhone(defaultAddress.phone ?? customerPhone);
          setCustomerAddress(formatSavedAddress(defaultAddress));

          if (defaultAddress.notes && !customerNotesRef.current) {
            setCustomerNotes(defaultAddress.notes);
          }
        }
      } catch {
        if (!cancelled) {
          setSavedAddresses([]);
          setAddressMessage("Saved addresses could not be loaded.");
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [checkoutStarted, customerPhone, needsShippingAddress, slug, storeId]);

  useEffect(() => {
    if (!cartSessionId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fetch("/api/store-cart-recovery", {
        body: JSON.stringify({
          currency,
          customerEmail,
          customerPhone,
          estimatedTotal: finalTotal,
          items: items.map((item) => ({
            id: item.id,
            price: item.price,
            productId: item.productId,
            quantity: item.quantity,
            title: item.title,
            variantId: item.variantId ?? null,
            variantName: item.variantName ?? null
          })),
          sessionId: cartSessionId,
          slug,
          storeId
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      }).catch(() => undefined);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [cartSessionId, currency, customerEmail, customerPhone, finalTotal, items, slug, storeId]);

  useEffect(() => {
    if (!checkoutStarted || !cartSessionId || !items.length) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setReservationPending(true);
      setReservationError(null);

      void fetch("/api/store-inventory-reservations", {
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            variantId: item.variantId ?? null
          })),
          sessionId: cartSessionId,
          slug,
          storeId
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
        .then(async (response) => {
          const data = (await response.json().catch(() => ({}))) as { error?: string };

          if (!cancelled && !response.ok) {
            setReservationError(data.error ?? "Stock could not be reserved for this cart.");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setReservationError("Stock could not be reserved for this cart.");
          }
        })
        .finally(() => {
          if (!cancelled) {
            setReservationPending(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [cartSessionId, checkoutStarted, items, slug, storeId]);

  function applySavedAddress(addressId: string) {
    setSelectedAddressId(addressId);

    if (!addressId) {
      return;
    }

    const address = savedAddresses.find((candidate) => candidate.id === addressId);

    if (!address) {
      return;
    }

    setCustomerName(address.full_name ?? customerName);
    setCustomerPhone(address.phone ?? customerPhone);
    setCustomerAddress(formatSavedAddress(address));

    setCustomerNotes(address.notes ?? customerNotes);
  }

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

  async function applyCoupon(nextCode = couponCode) {
    const code = nextCode.trim();

    if (!code) {
      setCouponMessage("Enter a coupon code.");
      setCouponMessageType("error");
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
        setCouponMessageType("error");
        return;
      }

      setAppliedCoupon({
        code: data.code,
        discountAmount: data.discountAmount
      });
      setCouponCode(data.code);
      setCouponMessage(`${data.code} applied. You saved ${formatMoney(data.discountAmount, currency)}.`);
      setCouponMessageType("success");
    } catch {
      setAppliedCoupon(null);
      setCouponMessage("Coupon could not be applied.");
      setCouponMessageType("error");
    } finally {
      setCouponPending(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponMessage("Coupon removed.");
    setCouponMessageType(null);
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
            <span>Original subtotal</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Coupon
              </p>
              {appliedCoupon ? (
                <button
                  className="text-xs font-black uppercase tracking-[0.14em] text-red-600"
                  onClick={removeCoupon}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                onChange={(event) => {
                  setCouponCode(event.target.value);
                  setAppliedCoupon(null);
                  setCouponMessage(null);
                  setCouponMessageType(null);
                }}
                placeholder="WELCOME10"
                value={couponCode}
              />
              <button
                className="h-11 rounded-full bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-300"
                disabled={couponPending}
                onClick={() => void applyCoupon()}
                type="button"
              >
                {couponPending ? "Checking..." : "Apply"}
              </button>
            </div>
            {couponMessage ? (
              <p className={`mt-2 rounded-xl px-3 py-2 text-xs font-bold ${
                couponMessageType === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : couponMessageType === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-white text-muted"
              }`}>
                {couponMessage}
              </p>
            ) : null}
            {appliedCoupon ? (
              <div className="mt-3 flex justify-between text-emerald-700">
                <span>Discount ({appliedCoupon.code})</span>
                <span>-{formatMoney(discountAmount, currency)}</span>
              </div>
            ) : null}
          </div>
          {discountAmount > 0 ? (
            <div className="flex justify-between text-emerald-700">
              <span>Subtotal after discount</span>
              <span>{formatMoney(discountedSubtotal, currency)}</span>
            </div>
          ) : null}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Delivery summary
            </p>
            {shippingMethods.length ? (
              <div className="mt-3 grid gap-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Choose shipping profile / method
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
                      {method.profile ? (
                        <span className={`mb-1 block text-[0.68rem] font-black uppercase tracking-[0.16em] ${
                          shippingMethodId === method.id ? "text-white/60" : "text-emerald-700"
                        }`}>
                          {method.profile.name}
                        </span>
                      ) : null}
                      <span className="block">{method.name}</span>
                      <span className={`mt-1 block text-xs ${shippingMethodId === method.id ? "text-white/70" : "text-muted"}`}>
                        {method.type.replace(/_/g, " ")} · {formatMoney(method.fee, currency)}
                        {method.estimatedMinDays || method.estimatedMaxDays
                          ? ` · ${method.estimatedMinDays ?? method.estimatedMaxDays}-${method.estimatedMaxDays ?? method.estimatedMinDays} days`
                          : ""}
                      </span>
                      {method.profile ? (
                        <span className={`mt-1 block text-xs ${shippingMethodId === method.id ? "text-white/70" : "text-muted"}`}>
                          {method.profile.preparationDays ?? 0} prep days
                          {method.profile.codSupported ? " · COD supported" : " · No COD"}
                          {method.profile.freeShippingEnabled ? " · Free shipping profile" : ""}
                        </span>
                      ) : null}
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
            {selectedShippingRateMatch.rate ? (
              <p className="mt-3 text-xs font-semibold leading-5 text-emerald-700">
                Matched rate: {selectedShippingRateMatch.rate.name}
              </p>
            ) : null}
            {shippingUnavailable ? (
              <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                {selectedShippingRateMatch.message}
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
            <span>Final total</span>
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
          <input name="cartSessionId" type="hidden" value={cartSessionId} />
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
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Checkout coupon
              </p>
              {appliedCoupon ? (
                <button
                  className="text-xs font-black uppercase tracking-[0.14em] text-red-600"
                  onClick={removeCoupon}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                onChange={(event) => {
                  setCouponCode(event.target.value);
                  setAppliedCoupon(null);
                  setCouponMessage(null);
                  setCouponMessageType(null);
                }}
                placeholder="Coupon code"
                value={couponCode}
              />
              <button
                className="h-11 rounded-full bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-300"
                disabled={couponPending}
                onClick={() => void applyCoupon()}
                type="button"
              >
                {couponPending ? "Checking..." : "Apply"}
              </button>
            </div>
            {couponMessage ? (
              <p className={`mt-2 rounded-xl px-3 py-2 text-xs font-bold ${
                couponMessageType === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : couponMessageType === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-white text-muted"
              }`}>
                {couponMessage}
              </p>
            ) : null}
            {discountAmount > 0 ? (
              <div className="mt-3 grid gap-1 text-xs font-bold text-muted">
                <div className="flex justify-between">
                  <span>Original subtotal</span>
                  <span>{formatMoney(total, currency)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span>-{formatMoney(discountAmount, currency)}</span>
                </div>
                <div className="flex justify-between text-ink">
                  <span>Final total</span>
                  <span>{formatMoney(finalTotal, currency)}</span>
                </div>
              </div>
            ) : null}
          </div>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Customer full name *</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="customerName"
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Full name"
              required
              value={customerName}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Phone *</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="customerPhone"
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="+15551234567"
              required
              value={customerPhone}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Email optional</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="customerEmail"
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="customer@example.com"
              type="email"
              value={customerEmail}
            />
          </label>
          {needsShippingAddress && savedAddresses.length ? (
            <label className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-ink">
              <span>Select delivery address</span>
              <select
                className="h-11 rounded-2xl border border-emerald-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                onChange={(event) => applySavedAddress(event.target.value)}
                value={selectedAddressId}
              >
                <option value="">Create or enter a new address manually</option>
                {savedAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.is_default ? "Default - " : ""}
                    {savedAddressLabel(address)}
                  </option>
                ))}
              </select>
              <div className="grid gap-2">
                {savedAddresses.map((address) => (
                  <button
                    className={`rounded-2xl border px-3 py-2 text-left transition ${
                      selectedAddressId === address.id
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-emerald-200 bg-white text-ink hover:border-emerald-300"
                    }`}
                    key={address.id}
                    onClick={() => applySavedAddress(address.id)}
                    type="button"
                  >
                    <span className="block text-sm font-black">
                      {selectedAddressId === address.id ? "● " : "○ "}
                      {savedAddressLabel(address)}
                    </span>
                    <span className={`mt-1 block text-xs font-semibold ${selectedAddressId === address.id ? "text-white/80" : "text-emerald-800"}`}>
                      {address.is_default ? "Default address · " : ""}
                      {[address.city, address.country, address.postal_code].filter(Boolean).join(", ") || "Delivery address"}
                    </span>
                  </button>
                ))}
              </div>
              <span className="text-xs font-semibold leading-5 text-emerald-800">
                Selecting an address fills full name, phone, country, city, address lines, postal code, and notes into the checkout fields below. You can still edit them before placing the order.
              </span>
            </label>
          ) : needsShippingAddress && addressMessage ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-muted">
              {addressMessage}
            </div>
          ) : !needsShippingAddress ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-xs font-bold text-violet-700">
              Digital-only checkout: no shipping address is required. You can still add notes below if needed.
            </div>
          ) : null}
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>{needsShippingAddress ? "Shipping address" : "Address optional"}</span>
            <textarea
              className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="customerAddress"
              onChange={(event) => setCustomerAddress(event.target.value)}
              placeholder={needsShippingAddress ? "Delivery address" : "No shipping address required for digital-only checkout"}
              value={customerAddress}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Notes optional</span>
            <textarea
              className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              name="customerNotes"
              onChange={(event) => setCustomerNotes(event.target.value)}
              placeholder="Delivery notes, preferred time, or special requests"
              value={customerNotes}
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
                  {method.method === "card" ? (
                    <span
                      className={`mt-3 flex flex-wrap gap-2 text-[0.65rem] font-black uppercase tracking-[0.14em] ${
                        paymentMethod === method.method ? "text-white/80" : "text-slate-500"
                      }`}
                    >
                      <span>Visa</span>
                      <span>Mastercard</span>
                      <span>Credit card</span>
                      <span>Debit card</span>
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          {draftState.error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {draftState.error}
            </div>
          ) : null}
          {reservationError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {reservationError}
            </div>
          ) : null}
          {draftState.message ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
              {draftState.message}
            </div>
          ) : null}
          <button
            className="h-12 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={
              hasUnavailableItems ||
              isDraftPending ||
              draftState.ok ||
              !paymentMethod ||
              shippingUnavailable ||
              reservationPending ||
              Boolean(reservationError)
            }
            type="submit"
          >
            {isDraftPending
              ? "Preparing draft..."
              : reservationPending
                ? "Reserving stock..."
              : draftState.ok
                ? "Draft prepared"
                : "Prepare order draft"}
          </button>
          </form>
        ) : null}
        {paymentMethods.some((method) => method.method === "youcan_pay") ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">
            YouCan Pay is a selectable foundation method only. No online payment is processed yet.
          </div>
        ) : null}
      </aside>
    </div>
  );
}
