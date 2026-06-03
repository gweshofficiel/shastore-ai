import { Star } from "lucide-react";

export type ProductRatingSummaryValue = {
  averageRating: number;
  reviewCount: number;
};

export function ProductRatingSummary({
  className = "",
  emptyLabel,
  summary
}: {
  className?: string;
  emptyLabel?: string;
  summary: ProductRatingSummaryValue | null;
}) {
  const averageRating = summary?.averageRating ?? 0;
  const reviewCount = summary?.reviewCount ?? 0;
  const hasReviews = averageRating > 0 && reviewCount > 0;
  const roundedRating = hasReviews ? Math.round(averageRating) : 0;

  if (!hasReviews && !emptyLabel) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs font-black ${className}`}>
      <span
        aria-label={hasReviews ? `${averageRating.toFixed(1)} out of 5 stars` : emptyLabel}
        className="flex items-center gap-0.5 text-amber-500"
      >
        {[0, 1, 2, 3, 4].map((item) => (
          <Star
            className={`h-3.5 w-3.5 ${hasReviews && item < roundedRating ? "fill-current" : "text-slate-300"}`}
            key={item}
          />
        ))}
      </span>
      <span className="text-slate-500">
        {hasReviews
          ? `${averageRating.toFixed(1)} (${reviewCount} ${reviewCount === 1 ? "review" : "reviews"})`
          : emptyLabel}
      </span>
    </div>
  );
}
