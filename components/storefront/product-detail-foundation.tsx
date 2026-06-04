"use client";

import { useMemo, useState } from "react";
import { BackInStockRequest } from "@/components/storefront/back-in-stock-request";
import { StorefrontAssetImage } from "@/components/storefront/asset-image";
import { trackGoogleAnalyticsEvent } from "@/components/storefront/google-analytics";
import { trackMetaPixelEvent } from "@/components/storefront/meta-pixel";
import { CompareButton } from "@/components/storefront/product-compare";
import { ProductBadges } from "@/components/storefront/product-badges";
import { ProductRatingSummary } from "@/components/storefront/product-rating-summary";
import { ProductSalesProof } from "@/components/storefront/product-sales-proof";
import { ProductShareButtons } from "@/components/storefront/product-share-buttons";
import { ProductStockUrgency } from "@/components/storefront/product-stock-urgency";
import {
  addProductToStoreCart
} from "@/components/storefront/public-store-cart";
import { WishlistButton } from "@/components/storefront/public-store-wishlist";
import {
  convertCurrencyAmount,
  type StoreCurrencyCode,
  type StoreCurrencySettings
} from "@/lib/store-currencies";
import { isPublicCategoryTitle } from "@/lib/storefront/catalog-sections";
import { resolveProductImageSlots, resolveVisualAssetSlot } from "@/lib/storefront/visual-assets";
import type {
  PublicStorefrontProduct,
  PublicStorefrontVariant
} from "@/lib/public-storefront-preview";

type ProductDetailFoundationProps = {
  averageRating: number;
  currency: StoreCurrencyCode;
  currencySettings: StoreCurrencySettings;
  galleryUrls: string[];
  product: PublicStorefrontProduct;
  reviewCount: number;
  slug: string;
  storeId: string;
};

type StockTone = "available" | "low" | "sold-out" | "untracked";

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

function numericPrice(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatProductPrice(
  price: number | string | null,
  priceLabel: string | null,
  currency: StoreCurrencyCode,
  settings: StoreCurrencySettings
) {
  if (priceLabel && currency === settings.defaultCurrency) {
    return priceLabel;
  }

  const numeric = numericPrice(price);

  if (numeric === null) {
    return "Price coming soon";
  }

  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(convertCurrencyAmount(numeric, settings, currency));
}

function variantLabel(variant: PublicStorefrontVariant) {
  const details = [
    variant.optionSize,
    variant.optionColor,
    variant.optionMaterial,
    variant.optionCustomValue
  ].filter(Boolean);

  return details.length ? `${variant.name} (${details.join(" / ")})` : variant.name;
}

function selectedStockState(product: PublicStorefrontProduct, variant: PublicStorefrontVariant | null) {
  if (variant) {
    const stock = Math.max(0, variant.stockQuantity ?? 0);
    const threshold = product.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

    if (variant.status !== "active" || stock <= 0) {
      return {
        availableStock: stock,
        canPurchase: false,
        message: "Out of stock",
        tone: "sold-out" as StockTone
      };
    }

    return {
      availableStock: stock,
      canPurchase: true,
      message: stock <= threshold ? `Low stock: ${stock} left` : "In stock",
      tone: stock <= threshold ? "low" as StockTone : "available" as StockTone
    };
  }

  if (product.variants.length) {
    return {
      availableStock: 0,
      canPurchase: false,
      message: "Choose an available option.",
      tone: "sold-out" as StockTone
    };
  }

  if (!product.trackInventory) {
    return {
      availableStock: null,
      canPurchase: true,
      message: "In stock",
      tone: "untracked" as StockTone
    };
  }

  const stock = Math.max(0, product.stockQuantity ?? 0);
  const threshold = product.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  if (product.inventoryStatus === "out_of_stock" || stock <= 0) {
    return {
      availableStock: stock,
      canPurchase: false,
      message: "Out of stock",
      tone: "sold-out" as StockTone
    };
  }

  return {
    availableStock: stock,
    canPurchase: true,
    message: stock <= threshold ? `Low stock: ${stock} left` : "In stock",
    tone: stock <= threshold ? "low" as StockTone : "available" as StockTone
  };
}

function stockToneClass(tone: StockTone) {
  if (tone === "sold-out") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (tone === "low") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function ProductDetailFoundation({
  averageRating,
  currency,
  currencySettings,
  galleryUrls,
  product,
  reviewCount,
  slug,
  storeId
}: ProductDetailFoundationProps) {
  const imageSlots = useMemo(
    () => resolveProductImageSlots({
      gallery: galleryUrls,
      primary: product.imageUrl,
      title: product.title
    }),
    [galleryUrls, product.imageUrl, product.title]
  );
  const images = useMemo(
    () => Array.from(new Set([imageSlots.primary.url, ...imageSlots.gallery.map((asset) => asset.url)].filter((url): url is string => Boolean(url)))),
    [imageSlots.gallery, imageSlots.primary.url]
  );
  const [selectedImage, setSelectedImage] = useState(images[0] ?? null);
  const selectedAsset = selectedImage
    ? resolveVisualAssetSlot({
        alt: product.title,
        candidates: [selectedImage],
        slot: "product.primary"
      })
    : imageSlots.primary;
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ?? null;
  const activePrice = selectedVariant?.priceOverride ?? product.price;
  const activePriceLabel = selectedVariant?.priceOverride ? null : product.priceLabel;
  const stock = selectedStockState(product, selectedVariant);
  const maxQuantity = stock.availableStock ?? 99;
  const clampedQuantity = Math.min(quantity, maxQuantity);
  const canPurchase = stock.canPurchase && quantity >= 1 && quantity <= maxQuantity;

  function addSelectedToCart() {
    const result = addProductToStoreCart({
      currency,
      product,
      quantity: clampedQuantity,
      slug,
      storeId,
      variantId: selectedVariant?.id ?? null
    });

    setCartMessage(result.message);
    if (result.ok) {
      const numeric = numericPrice(activePrice) ?? 0;

      trackMetaPixelEvent("AddToCart", {
        content_ids: [product.id],
        content_name: product.title,
        content_type: "product",
        currency,
        value: numeric
      });
      trackGoogleAnalyticsEvent("add_to_cart", {
        currency,
        items: [{
          item_id: product.id,
          item_name: product.title,
          price: numeric,
          quantity: clampedQuantity,
          variant: selectedVariant?.id ?? null
        }],
        value: numeric * clampedQuantity
      });
    }

    return result.ok;
  }

  function handleBuyNow() {
    if (!addSelectedToCart()) {
      return;
    }

    window.location.assign(`/store/${slug}/cart`);
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-[2.5rem] border border-slate-200 bg-white p-3 shadow-[0_35px_100px_-70px_rgba(15,23,42,0.95)] sm:p-4">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-100">
          <ProductBadges className="absolute left-5 top-5 z-10" product={product} />
          <StorefrontAssetImage
            asset={selectedAsset}
            className="aspect-square w-full object-cover"
            theme={{ accent: "#d4af37", primary: "#0f172a", secondary: "#1d4ed8" }}
          />
        </div>
        {images.length > 1 ? (
          <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
            {images.slice(0, 10).map((url, index) => (
              <button
                aria-label={`Show product image ${index + 1}`}
                className={`overflow-hidden rounded-2xl border bg-white transition ${
                  selectedImage === url ? "border-slate-950 ring-2 ring-slate-950/10" : "border-slate-200 hover:border-slate-400"
                }`}
                key={url}
                onClick={() => setSelectedImage(url)}
                type="button"
              >
                <StorefrontAssetImage
                  asset={resolveVisualAssetSlot({
                    alt: `${product.title} thumbnail ${index + 1}`,
                    candidates: [url],
                    slot: "product.gallery"
                  })}
                  className="aspect-square w-full object-cover"
                  theme={{ accent: "#d4af37", primary: "#0f172a", secondary: "#1d4ed8" }}
                />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <article className="min-w-0 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-[0_35px_100px_-80px_rgba(15,23,42,0.95)] sm:p-8 lg:p-10">
        <ProductBadges className="mb-4" product={product} />
        {isPublicCategoryTitle(product.categoryName) ? (
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            {product.categoryName}
          </p>
        ) : null}
        <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-[-0.05em] text-ink sm:text-6xl">
          {product.title}
        </h1>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <p className="text-3xl font-black leading-none text-ink">
            {formatProductPrice(activePrice, activePriceLabel, currency, currencySettings)}
          </p>
          {product.compareAtPrice ? (
            <p className="text-base font-bold text-slate-400 line-through">
              {formatProductPrice(product.compareAtPrice, null, currency, currencySettings)}
            </p>
          ) : null}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {currency}
          </span>
        </div>
        <ProductRatingSummary
          className="mt-4"
          emptyLabel="No reviews yet"
          summary={{ averageRating, reviewCount }}
        />
        <p className="mt-6 text-base leading-8 text-muted">
          {product.description || "Product details will appear here when the store owner adds a description."}
        </p>
        <ProductSalesProof product={product} />

        <div className="mt-6 grid gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Inventory
            </p>
            <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${stockToneClass(stock.tone)}`}>
              {stock.message}
            </span>
          </div>
          <ProductStockUrgency product={product} variantId={selectedVariant?.id ?? null} />

          {product.variants.length ? (
            <label className="grid min-w-0 gap-2 text-sm font-bold text-ink">
              <span>Choose option</span>
              <select
                className="h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                onChange={(event) => {
                  setSelectedVariantId(event.target.value);
                  setQuantity(1);
                  setCartMessage(null);
                }}
                value={selectedVariantId}
              >
                {product.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variantLabel(variant)}
                    {variant.priceOverride
                      ? ` - ${formatProductPrice(variant.priceOverride, null, currency, currencySettings)}`
                      : ""}
                    {variant.status !== "active" || (variant.stockQuantity ?? 0) <= 0 ? " - out of stock" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="grid gap-2 text-sm font-bold text-ink">
            <span>Quantity</span>
            <div className="flex items-center gap-2">
              <button
                className="h-11 w-11 rounded-full border border-slate-200 bg-white text-lg font-black text-ink transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={quantity <= 1}
                onClick={() => {
                  setQuantity((value) => Math.max(1, value - 1));
                  setCartMessage(null);
                }}
                type="button"
              >
                -
              </button>
              <input
                className="h-11 w-24 rounded-2xl border border-slate-200 bg-white text-center text-sm font-black text-ink outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                max={maxQuantity}
                min={1}
                onChange={(event) => {
                  const nextQuantity = Number.parseInt(event.target.value, 10);
                  setQuantity(Number.isFinite(nextQuantity) ? Math.max(1, Math.min(maxQuantity, nextQuantity)) : 1);
                  setCartMessage(null);
                }}
                type="number"
                value={quantity}
              />
              <button
                className="h-11 w-11 rounded-full border border-slate-200 bg-white text-lg font-black text-ink transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={quantity >= maxQuantity}
                onClick={() => {
                  setQuantity((value) => Math.min(maxQuantity, value + 1));
                  setCartMessage(null);
                }}
                type="button"
              >
                +
              </button>
            </div>
          </label>
        </div>

        <ProductShareButtons productTitle={product.title} />
        <BackInStockRequest
          product={product}
          slug={slug}
          storeId={storeId}
        />

        <div className="mt-8 grid gap-3 border-t border-slate-100 pt-6">
          {cartMessage ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-muted">
              {cartMessage}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              disabled={!canPurchase}
              onClick={handleBuyNow}
              type="button"
            >
              Buy now
            </button>
            <button
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              disabled={!canPurchase}
              onClick={addSelectedToCart}
              type="button"
            >
              {stock.tone === "sold-out" ? "Out of stock" : "Add to cart"}
            </button>
          </div>
          <WishlistButton
            currency={currency}
            product={product}
            slug={slug}
            storeId={storeId}
          />
          <CompareButton
            currency={currency}
            product={product}
            slug={slug}
            storeId={storeId}
          />
        </div>
      </article>
    </div>
  );
}
