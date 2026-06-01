import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { moderateProductReview } from "@/lib/product-review-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type ReviewRow = {
  comment: string;
  created_at: string;
  customer_name: string;
  id: string;
  moderation_note?: string | null;
  product_id: string;
  rating: number;
  status: string;
  store_id: string;
  title?: string | null;
};

type ProductRow = {
  id: string;
  title?: string | null;
  name?: string | null;
};

type ReviewsDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  products: ProductRow[];
  reviewStats: {
    approvedCount: number;
    averageRating: number;
    pendingCount: number;
    rejectedCount: number;
    totalCount: number;
  };
  reviews: ReviewRow[];
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    approved: "Review approved.",
    "missing-review": "Review could not be found.",
    "moderation-failed": "Review moderation could not be saved.",
    "not-authorized": "You do not have permission to moderate reviews for that store.",
    pending: "Review moved back to pending.",
    rejected: "Review rejected."
  };

  return status ? messages[status] : null;
}

function ratingStars(rating: number) {
  return "★".repeat(Math.max(1, Math.min(5, Math.round(rating))));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function summarizeReviews(reviews: ReviewRow[]) {
  const approvedReviews = reviews.filter((review) => review.status === "approved");
  const averageRating = approvedReviews.length
    ? Number((approvedReviews.reduce((sum, review) => sum + review.rating, 0) / approvedReviews.length).toFixed(1))
    : 0;

  return {
    approvedCount: approvedReviews.length,
    averageRating,
    pendingCount: reviews.filter((review) => review.status === "pending").length,
    rejectedCount: reviews.filter((review) => review.status === "rejected").length,
    totalCount: reviews.length
  };
}

async function getReviewsDashboardData(selectedStoreId?: string): Promise<ReviewsDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      error: "Sign in to moderate reviews.",
      products: [],
      reviewStats: summarizeReviews([]),
      reviews: [],
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(
    supabase,
    user.id,
    workspaceId
  );

  if (storesError) {
    return {
      activeStore: null,
      error: "Stores could not be loaded. Please try again.",
      products: [],
      reviewStats: summarizeReviews([]),
      reviews: [],
      stores: []
    };
  }

  const activeStore =
    stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      error: null,
      products: [],
      reviewStats: summarizeReviews([]),
      reviews: [],
      stores
    };
  }

  const [reviewsResult, productsResult] = await Promise.all([
    supabase
      .from("product_reviews" as never)
      .select("id, store_id, product_id, customer_name, rating, title, comment, status, moderation_note, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("created_at", { ascending: false }),
    supabase
      .from("store_products" as never)
      .select("id, title, name")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id", activeStore.id)
  ]);

  if (reviewsResult.error || productsResult.error) {
    return {
      activeStore,
      error: "Reviews could not be loaded. Confirm the reviews migration has been applied.",
      products: [],
      reviewStats: summarizeReviews([]),
      reviews: [],
      stores
    };
  }

  return {
    activeStore,
    error: null,
    products: (productsResult.data ?? []) as unknown as ProductRow[],
    reviewStats: summarizeReviews((reviewsResult.data ?? []) as unknown as ReviewRow[]),
    reviews: (reviewsResult.data ?? []) as unknown as ReviewRow[],
    stores
  };
}

export default async function ReviewsPage({
  searchParams
}: {
  searchParams: Promise<{ reviews?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, products, reviewStats, reviews, stores } = await getReviewsDashboardData(query.storeId);
  const message = statusMessage(query.reviews);
  const productsById = new Map(products.map((product) => [product.id, product.title || product.name || product.id]));

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Moderate product reviews before they appear on the public storefront."
        title="Reviews"
      />

      {message ? (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {stores.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            No stores in this workspace yet
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Create a store before moderating reviews.
          </p>
        </Card>
      ) : null}

      {activeStore ? (
        <>
          <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Active Store
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {activeStore.store_name || activeStore.name || "Workspace store"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Pending and rejected reviews never appear publicly.
              </p>
            </div>
            <form className="flex flex-col gap-3 sm:min-w-[260px]" method="get">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Switch store</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  defaultValue={activeStore.id}
                  name="storeId"
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.store_name || store.name || store.slug || store.id}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">
                View reviews
              </Button>
            </form>
          </Card>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <ReviewStatCard label="Store average rating" value={reviewStats.averageRating ? `${reviewStats.averageRating}/5` : "No ratings"} />
            <ReviewStatCard label="Total reviews" value={String(reviewStats.totalCount)} />
            <ReviewStatCard label="Pending" value={String(reviewStats.pendingCount)} />
            <ReviewStatCard label="Approved" value={String(reviewStats.approvedCount)} />
            <ReviewStatCard label="Rejected" value={String(reviewStats.rejectedCount)} />
          </section>

          <section className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Review Queue
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </h2>
            </div>

            {reviews.length === 0 ? (
              <Card className="p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                  No reviews yet
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  Customer reviews submitted after purchase will appear here for moderation.
                </p>
              </Card>
            ) : null}

            {reviews.map((review) => (
              <Card className="grid gap-4 p-5" key={review.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                        {review.title || "Untitled review"}
                      </h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
                        review.status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : review.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                      }`}>
                        {review.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-amber-600">
                      {ratingStars(review.rating)} · {review.rating}/5
                    </p>
                    <p className="mt-1 text-sm font-bold text-muted">
                      {productsById.get(review.product_id) ?? review.product_id} · {review.customer_name} · {formatDate(review.created_at)}
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted">{review.comment}</p>
                {review.moderation_note ? (
                  <p className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-muted">
                    Moderation note: {review.moderation_note}
                  </p>
                ) : null}
                <form action={moderateProductReview} className="grid gap-3">
                  <input name="reviewId" type="hidden" value={review.id} />
                  <input name="storeId" type="hidden" value={activeStore.id} />
                  <Textarea
                    defaultValue={review.moderation_note ?? ""}
                    id={`review-${review.id}-note`}
                    label="Moderation note"
                    name="moderationNote"
                    rows={2}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button name="status" type="submit" value="pending" variant="secondary">
                      Mark pending
                    </Button>
                    <Button name="status" type="submit" value="rejected" variant="secondary">
                      Reject
                    </Button>
                    <Button name="status" type="submit" value="approved">
                      Approve
                    </Button>
                  </div>
                </form>
              </Card>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}

function ReviewStatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{value}</p>
    </Card>
  );
}
