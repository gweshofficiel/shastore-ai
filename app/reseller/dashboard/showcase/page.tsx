import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  ResellerListingsGrid,
  ResellerShowcaseProfileForm,
  ResellerStatusAlerts
} from "@/components/reseller-showcase/dashboard-panels";
import {
  getResellerDashboardData,
  getResellerReputationData,
  getResellerVerificationData,
  getResellerReviewsData,
  resellerMigrationMessage
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

export default async function PrivateResellerShowcasePage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data, reviewsData, reputation, verification] = await Promise.all([
    searchParams,
    getResellerDashboardData(),
    getResellerReviewsData(),
    getResellerReputationData(),
    getResellerVerificationData()
  ]);

  return (
    <>
      <PageHeader
        description="Edit reseller profile, public showcase identity, social links, publish state, theme, and visual styling."
        title="Showcase Manager"
      />
      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{resellerMigrationMessage()}</p>
        </Card>
      ) : null}
      <ResellerStatusAlerts query={query} />
      <ResellerShowcaseProfileForm
        profile={data.profile}
        returnPath="/reseller/dashboard/showcase"
      />
      <ResellerListingsGrid
        items={data.items}
        returnPath="/reseller/dashboard/showcase"
        title="Marketplace Visibility Controls"
      />
      <Card className="p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Public reputation
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              {reputation.currentLevel} level · {reputation.trustScore} trust
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Public profile shows friendly level, trust, and metrics without exposing private scoring internals.
            </p>
          </div>
          <div className="rounded-full bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">
            {reputation.progress}% toward {reputation.nextLevel}
          </div>
        </div>
      </Card>
      <Card className="p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Verification badges
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              {verification.overallStatus}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Public profile badges show status only. Identity and business documents remain private.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-ink"
            href="/reseller/dashboard/verification"
          >
            Manage verification
          </Link>
        </div>
      </Card>
      <Card className="p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Public reviews
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              {reviewsData.summary.averageRating
                ? `${reviewsData.summary.averageRating}/5 public rating`
                : "No approved reviews yet"}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Only approved reviews can appear on the public reseller profile.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-ink"
            href="/reseller/dashboard/reviews"
          >
            Review center
          </Link>
        </div>
      </Card>
    </>
  );
}
