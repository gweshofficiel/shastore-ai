import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";

type ProductBadgeTone = "amber" | "blue" | "emerald" | "red" | "slate";

type ProductBadge = {
  label: string;
  tone: ProductBadgeTone;
};

const NEW_PRODUCT_DAYS = 30;
const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const badgeToneClasses: Record<ProductBadgeTone, string> = {
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  emerald: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-700",
  slate: "bg-slate-100 text-slate-700"
};

function numericValue(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function manualBadgeLabels(product: PublicStorefrontProduct) {
  const record = product as unknown as Record<string, unknown>;
  const rawBadges = record.productBadges ?? record.product_badges ?? record.badges;

  if (!Array.isArray(rawBadges)) {
    return [];
  }

  return rawBadges
    .map((badge) => (typeof badge === "string" ? badge.trim() : ""))
    .filter(Boolean)
    .slice(0, 3);
}

function isProductNew(product: PublicStorefrontProduct) {
  if (!product.createdAt) {
    return false;
  }

  const createdAt = new Date(product.createdAt).getTime();

  if (!Number.isFinite(createdAt)) {
    return false;
  }

  return Date.now() - createdAt <= NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000;
}

function isProductOnSale(product: PublicStorefrontProduct) {
  const price = numericValue(product.price);
  const compareAtPrice = numericValue(product.compareAtPrice);

  return price > 0 && compareAtPrice > price;
}

function productStock(product: PublicStorefrontProduct) {
  if (typeof product.stockQuantity === "number") {
    return product.stockQuantity;
  }

  if (product.variants.length) {
    return product.variants.reduce((sum, variant) => sum + Math.max(0, variant.stockQuantity ?? 0), 0);
  }

  return null;
}

function isSoldOut(product: PublicStorefrontProduct) {
  const stock = productStock(product);

  return product.inventoryStatus === "out_of_stock" || (product.trackInventory && stock !== null && stock <= 0);
}

function isLowStock(product: PublicStorefrontProduct) {
  const stock = productStock(product);
  const threshold = product.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  return product.trackInventory && stock !== null && stock > 0 && stock <= threshold;
}

function isBestSeller(product: PublicStorefrontProduct) {
  const status = product.inventoryStatus?.toLowerCase().replace(/[\s-]+/g, "_");
  return status === "best_seller" || status === "bestseller" || product.salesCount >= 10;
}

export function resolveProductBadges(product: PublicStorefrontProduct) {
  const badges: ProductBadge[] = manualBadgeLabels(product).map((label) => ({
    label,
    tone: "slate"
  }));

  if (isSoldOut(product)) {
    badges.push({ label: "Sold Out", tone: "red" });
  } else if (isLowStock(product)) {
    badges.push({ label: "Low Stock", tone: "amber" });
  }

  if (isProductOnSale(product)) {
    badges.push({ label: "On Sale", tone: "emerald" });
  }

  if (isBestSeller(product)) {
    badges.push({ label: "Best Seller", tone: "blue" });
  }

  if (isProductNew(product)) {
    badges.push({ label: "New", tone: "slate" });
  }

  return badges.filter(
    (badge, index, list) => list.findIndex((candidate) => candidate.label === badge.label) === index
  );
}

export function ProductBadges({
  className = "",
  product
}: {
  className?: string;
  product: PublicStorefrontProduct;
}) {
  const badges = resolveProductBadges(product);

  if (!badges.length) {
    return null;
  }

  return (
    <div className={`flex max-w-full flex-wrap items-start gap-2 ${className}`}>
      {badges.map((badge) => (
        <span
          className={`max-w-full rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] shadow-sm ${badgeToneClasses[badge.tone]}`}
          key={badge.label}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
