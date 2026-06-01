import type { PublicStorefrontProduct } from "@/lib/public-storefront-preview";

const POPULAR_PRODUCT_SALES_THRESHOLD = 10;
const RECENT_PURCHASE_DAYS = 14;

function isRecentlyPurchased(value: string | null) {
  if (!value) {
    return false;
  }

  const purchasedAt = new Date(value).getTime();

  if (!Number.isFinite(purchasedAt)) {
    return false;
  }

  return Date.now() - purchasedAt <= RECENT_PURCHASE_DAYS * 24 * 60 * 60 * 1000;
}

export function ProductSalesProof({
  compact = false,
  product
}: {
  compact?: boolean;
  product: PublicStorefrontProduct;
}) {
  if (!product.salesCount) {
    return null;
  }

  const recentlyPurchased = isRecentlyPurchased(product.recentlyPurchasedAt);
  const popular = product.salesCount >= POPULAR_PRODUCT_SALES_THRESHOLD;

  if (compact) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          {product.salesCount} sold
        </span>
        {popular ? (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-700">
            Popular
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-muted">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">
          {product.salesCount} sold
        </span>
        {recentlyPurchased ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            Recently purchased
          </span>
        ) : null}
        {popular ? (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-700">
            Popular product
          </span>
        ) : null}
      </div>
      <p>Real purchase activity from this store.</p>
    </div>
  );
}
