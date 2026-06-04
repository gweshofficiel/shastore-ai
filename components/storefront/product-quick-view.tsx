"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StorefrontAssetImage } from "@/components/storefront/asset-image";
import {
  addProductToStoreCart,
  CartNavLink
} from "@/components/storefront/public-store-cart";
import { ProductBadges } from "@/components/storefront/product-badges";
import { ProductSalesProof } from "@/components/storefront/product-sales-proof";
import { ProductStockUrgency } from "@/components/storefront/product-stock-urgency";
import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";
import { resolveProductImageSlots } from "@/lib/storefront/visual-assets";

type ProductQuickViewProps = {
  currency: string;
  detailsHref: string;
  product: PublicStorefrontProduct;
  slug: string;
  storeId: string;
};

function numericPrice(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatProductPrice(price: number | string | null, priceLabel: string | null, currency: string) {
  if (priceLabel) {
    return priceLabel;
  }

  if (price === null || price === undefined || price === "") {
    return "Price coming soon";
  }

  const numeric = numericPrice(price);

  if (numeric <= 0) {
    return String(price);
  }

  return new Intl.NumberFormat("en", {
    currency: currency || "USD",
    style: "currency"
  }).format(numeric);
}

function stockStatus(product: PublicStorefrontProduct, variantId: string | null) {
  const selectedVariant = variantId
    ? product.variants.find((variant) => variant.id === variantId) ?? null
    : null;

  if (selectedVariant) {
    const stock = selectedVariant.stockQuantity ?? 0;

    return {
      availableStock: stock,
      isSoldOut: selectedVariant.status !== "active" || stock <= 0,
      message: stock > 0 ? `${stock} available for this option.` : "Sold out"
    };
  }

  if (product.variants.length) {
    return {
      availableStock: 0,
      isSoldOut: true,
      message: "Choose an available option."
    };
  }

  if (!product.trackInventory) {
    return {
      availableStock: null,
      isSoldOut: false,
      message: "Inventory quantity is not tracked."
    };
  }

  const stock = product.stockQuantity ?? 0;

  return {
    availableStock: stock,
    isSoldOut: product.inventoryStatus === "out_of_stock" || stock <= 0,
    message: stock > 0 ? `${stock} available.` : "Sold out"
  };
}

function shortDescription(product: PublicStorefrontProduct) {
  const description = product.description?.trim();

  if (!description) {
    return "Product details are available on the full product page.";
  }

  return description.length > 180 ? `${description.slice(0, 177).trim()}...` : description;
}

export function ProductQuickView({
  currency,
  detailsHref,
  product,
  slug,
  storeId
}: ProductQuickViewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const productCurrency = product.currency || currency;
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ?? null;
  const activePrice = selectedVariant?.priceOverride ?? product.price;
  const activePriceLabel = selectedVariant?.priceOverride ? null : product.priceLabel;
  const imageSlots = useMemo(
    () => resolveProductImageSlots({
      gallery: product.gallery,
      primary: product.imageUrl,
      title: product.title
    }),
    [product.gallery, product.imageUrl, product.title]
  );
  const availability = useMemo(
    () => stockStatus(product, selectedVariant?.id ?? null),
    [product, selectedVariant]
  );
  const maxQuantity = availability.availableStock ?? 99;
  const isAddDisabled = availability.isSoldOut || quantity > maxQuantity;

  function closeModal() {
    setIsOpen(false);
    setMessage(null);
  }

  function addToCart() {
    const result = addProductToStoreCart({
      currency: productCurrency,
      product,
      quantity,
      slug,
      storeId,
      variantId: selectedVariant?.id ?? null
    });

    setMessage(result.message);
  }

  return (
    <>
      <button
        className="inline-flex min-h-10 w-full min-w-0 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-xs font-black uppercase leading-5 tracking-[0.14em] text-ink transition hover:border-slate-300 hover:bg-slate-50"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Quick View
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Quick View
                </p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-ink">
                  {product.title}
                </h2>
              </div>
              <button
                className="h-10 rounded-full bg-slate-100 px-4 text-sm font-black text-ink transition hover:bg-slate-200"
                onClick={closeModal}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-[1.75rem] border border-slate-100 bg-slate-50">
                <StorefrontAssetImage
                  asset={imageSlots.primary}
                  className="aspect-square w-full object-cover"
                  theme={{ accent: "#d4af37", primary: "#0f172a", secondary: "#1d4ed8" }}
                />
              </div>
              <div className="grid min-w-0 content-start gap-4">
                <ProductBadges product={product} />
                <div>
                  <h3 className="text-3xl font-black tracking-[-0.05em] text-ink">
                    {product.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <p className="text-2xl font-black text-ink">
                      {formatProductPrice(activePrice, activePriceLabel, productCurrency)}
                    </p>
                    {product.compareAtPrice ? (
                      <p className="text-sm font-bold text-slate-400 line-through">
                        {formatProductPrice(product.compareAtPrice, null, productCurrency)}
                      </p>
                    ) : null}
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {productCurrency}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-semibold leading-6 text-muted">
                  {shortDescription(product)}
                </p>
                <ProductSalesProof compact product={product} />
                <ProductStockUrgency compact product={product} variantId={selectedVariant?.id ?? null} />
                <div className={`rounded-2xl border px-4 py-3 text-sm font-black ${
                  availability.isSoldOut
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}>
                  {availability.message}
                </div>
                {product.variants.length ? (
                  <label className="grid min-w-0 gap-2 text-sm font-bold text-ink">
                    <span>Choose option</span>
                    <select
                      className="h-11 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink"
                      onChange={(event) => {
                        setSelectedVariantId(event.target.value);
                        setQuantity(1);
                        setMessage(null);
                      }}
                      value={selectedVariantId}
                    >
                      {product.variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.name}
                          {variant.priceOverride
                            ? ` - ${formatProductPrice(variant.priceOverride, null, productCurrency)}`
                            : ""}
                          {(variant.stockQuantity ?? 0) <= 0 ? " - out of stock" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="grid gap-2 text-sm font-bold text-ink">
                  <span>Quantity</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="h-10 w-10 rounded-full border border-slate-200 bg-white text-lg font-black text-ink"
                      onClick={() => {
                        setQuantity((value) => Math.max(1, value - 1));
                        setMessage(null);
                      }}
                      type="button"
                    >
                      -
                    </button>
                    <input
                      className="h-10 w-20 rounded-2xl border border-slate-200 bg-white text-center text-sm font-black text-ink"
                      min={1}
                      onChange={(event) => {
                        const nextQuantity = Number.parseInt(event.target.value, 10);
                        setQuantity(Number.isFinite(nextQuantity) ? Math.max(1, nextQuantity) : 1);
                        setMessage(null);
                      }}
                      type="number"
                      value={quantity}
                    />
                    <button
                      className="h-10 w-10 rounded-full border border-slate-200 bg-white text-lg font-black text-ink"
                      onClick={() => {
                        setQuantity((value) => Math.min(maxQuantity, value + 1));
                        setMessage(null);
                      }}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </label>
                {message ? (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-muted">
                    {message}
                  </p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    className="min-h-11 w-full rounded-full bg-ink px-4 py-3 text-sm font-black leading-5 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-red-600 disabled:text-white"
                    disabled={isAddDisabled}
                    onClick={addToCart}
                    type="button"
                  >
                    {availability.isSoldOut ? "Sold Out" : "Add to Cart"}
                  </button>
                  <Link
                    className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black leading-5 text-ink transition hover:border-slate-300 hover:bg-slate-50"
                    href={detailsHref}
                    onClick={closeModal}
                  >
                    View Full Product
                  </Link>
                </div>
                <CartNavLink currency={productCurrency} slug={slug} storeId={storeId} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
