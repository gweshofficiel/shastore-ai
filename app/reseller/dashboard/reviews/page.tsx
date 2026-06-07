import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  getResellerReputationData,
  getResellerReviewsData,
  resellerMigrationMessage,
  type ResellerReview
} from "@/lib/reseller-showcase/data";
import {
  markResellerReviewReviewedPlaceholder,
  replyResellerReviewPlaceholder,
  reportResellerReviewPlaceholder,
  viewResellerReview
} from "@/lib/reseller-showcase/review-actions";

export const dynamic = "force-dynamic";

type ResellerReviewsPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function statusClass(status: ResellerReview["status"]) {
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

function ReviewHiddenFields({
  profileSlug,
  review,
  returnTo
}: {
  profileSlug: string | null;
  review: ResellerReview;
  returnTo: string;
}) {
  return (
    <>
      <input name="profileSlug" type="hidden" value={profileSlug ?? ""} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <input name="reviewReference" type="hidden" value={review.id} />
    </>
  );
}

function ReviewActions({
  profileSlug,
  review,
  returnTo
}: {
  profileSlug: string | null;
  review: ResellerReview;
  returnTo: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={viewResellerReview}>
        <ReviewHiddenFields profileSlug={profileSlug} returnTo={returnTo} review={review} />
        <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          View review
        </button>
      </form>
      <form action={markResellerReviewReviewedPlaceholder}>
        <ReviewHiddenFields profileSlug={profileSlug} returnTo={returnTo} review={review} />
        <button className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
          Mark reviewed
        </button>
      </form>
      <form action={replyResellerReviewPlaceholder}>
        <ReviewHiddenFields profileSlug={profileSlug} returnTo={returnTo} review={review} />
        <button className="h-9 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-violet-700" type="submit">
          Reply placeholder
        </button>
      </form>
      <form action={reportResellerReviewPlaceholder}>
        <ReviewHiddenFields profileSlug={profileSlug} returnTo={returnTo} review={review} />
        <button className="h-9 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
          Report placeholder
        </button>
      </form>
    </div>
  );
}

function ReviewCard({
  profileSlug,
  returnTo,
  review
}: {
  profileSlug: string | null;
  returnTo: string;
  review: ResellerReview;
}) {
  return (
    <article className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-ink">{review.buyerDisplayName}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{formatDate(review.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">
            {review.rating}/5
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(review.status)}`}>
            {review.status}
          </span>
        </div>
      </div>
      <p className="text-sm font-semibold leading-6 text-slate-600">{review.reviewText}</p>
      <ReviewActions profileSlug={profileSlug} returnTo={returnTo} review={review} />
    </article>
  );
}

function ReviewSection({
  empty,
  profileSlug,
  returnTo,
  reviews,
  title
}: {
  empty: string;
  profileSlug: string | null;
  returnTo: string;
  reviews: ResellerReview[];
  title: string;
}) {
  return (
    <Card className="p-6 lg:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{title}</p>
      <div className="mt-5 grid gap-3">
        {reviews.length ? (
          reviews.map((review) => (
            <ReviewCard key={review.id} profileSlug={profileSlug} returnTo={returnTo} review={review} />
          ))
        ) : (
          <p className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">{empty}</p>
        )}
      </div>
    </Card>
  );
}

export default async function ResellerReviewsPage({ searchParams }: ResellerReviewsPageProps) {
  const [query, data, reputation] = await Promise.all([
    searchParams,
    getResellerReviewsData(),
    getResellerReputationData()
  ]);
  const returnTo = "/reseller/dashboard/reviews";

  return (
    <>
      <PageHeader
        description="Monitor reseller rating and review foundations. Reviews remain separate from checkout, orders, wallet, payout, and withdrawal systems."
        title="Reviews"
      />

      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{resellerMigrationMessage()}</p>
        </Card>
      ) : null}

      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Review placeholder action recorded.</p>
        </Card>
      ) : null}

      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Average rating</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.averageRating ?? "No reviews"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Total reviews</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.totalReviews}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Approved</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.approvedReviews}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pending</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.pendingReviews}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Rejected</p>
          <p className="mt-3 text-3xl font-black text-ink">{data.summary.rejectedReviews}</p>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Reputation impact
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              {reputation.currentLevel} level · {reputation.trustScore} trust
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Approved reviews contribute to rating and level progress. Pending and rejected reviews do not appear publicly.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
            {reputation.progress}% toward {reputation.nextLevel}
          </div>
        </div>
      </Card>

      <ReviewSection
        empty="No latest reviews yet. Future buyer verified purchase reviews will appear here."
        profileSlug={data.profile?.slug ?? null}
        returnTo={returnTo}
        reviews={data.latest}
        title="Latest reviews"
      />
      <ReviewSection
        empty="No pending reviews. Pending review moderation is a future placeholder."
        profileSlug={data.profile?.slug ?? null}
        returnTo={returnTo}
        reviews={data.pending}
        title="Pending reviews"
      />
      <ReviewSection
        empty="No approved reviews yet. Only approved reviews can appear on the public reseller profile."
        profileSlug={data.profile?.slug ?? null}
        returnTo={returnTo}
        reviews={data.approved}
        title="Approved reviews"
      />
      <ReviewSection
        empty="No rejected reviews. Rejected review workflows are placeholders only."
        profileSlug={data.profile?.slug ?? null}
        returnTo={returnTo}
        reviews={data.rejected}
        title="Rejected reviews"
      />

      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Future hooks</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.futureHooks.map((hook) => (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600" key={hook}>
              {hook}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}
