import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

type StockUrgencyTone = "available" | "low" | "sold-out";

type StockUrgency = {
  message: string;
  tone: StockUrgencyTone;
};

function variantStock(product: PublicStorefrontProduct, variantId: string | null | undefined) {
  if (!variantId) {
    return null;
  }

  const variant = product.variants.find((candidate) => candidate.id === variantId);

  if (!variant) {
    return null;
  }

  return {
    stock: Math.max(0, variant.stockQuantity ?? 0),
    tracked: true
  };
}

function productStock(product: PublicStorefrontProduct) {
  if (typeof product.stockQuantity === "number") {
    return {
      stock: Math.max(0, product.stockQuantity),
      tracked: product.trackInventory
    };
  }

  if (product.variants.length) {
    return {
      stock: product.variants.reduce((sum, variant) => sum + Math.max(0, variant.stockQuantity ?? 0), 0),
      tracked: true
    };
  }

  return null;
}

export function resolveStockUrgency(
  product: PublicStorefrontProduct,
  variantId?: string | null
): StockUrgency | null {
  const stockInfo = variantStock(product, variantId) ?? productStock(product);

  if (!stockInfo?.tracked) {
    return null;
  }

  const lowStockThreshold = product.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  if (product.inventoryStatus === "out_of_stock" || stockInfo.stock <= 0) {
    return {
      message: "Sold out",
      tone: "sold-out"
    };
  }

  if (stockInfo.stock <= lowStockThreshold) {
    return {
      message: stockInfo.stock <= 3 ? `Only ${stockInfo.stock} left` : "Low stock",
      tone: "low"
    };
  }

  return {
    message: "In stock",
    tone: "available"
  };
}

export function ProductStockUrgency({
  className = "",
  compact = false,
  product,
  variantId = null
}: {
  className?: string;
  compact?: boolean;
  product: PublicStorefrontProduct;
  variantId?: string | null;
}) {
  const urgency = resolveStockUrgency(product, variantId);

  if (!urgency) {
    return null;
  }

  const toneClass =
    urgency.tone === "sold-out"
      ? "border-red-200 bg-red-50 text-red-700"
      : urgency.tone === "low"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div
      className={`rounded-2xl border px-3 py-2 font-black ${toneClass} ${
        compact ? "text-xs" : "text-sm"
      } ${className}`}
    >
      {urgency.message}
    </div>
  );
}
