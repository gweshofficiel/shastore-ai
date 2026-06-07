import Link from "next/link";
import { AccountIdCard } from "@/components/account/account-id-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  ResellerInventoryCard,
  ResellerOverviewCards,
  ResellerQuickActions,
  ResellerTemplateInventoryCard,
  ResellerStatusAlerts
} from "@/components/reseller-showcase/dashboard-panels";
import {
  getResellerDashboardData,
  getResellerInventoryData,
  getResellerReputationData,
  getResellerTemplateInventoryData,
  getResellerVerificationData,
  getResellerReviewsData,
  resellerMigrationMessage
} from "@/lib/reseller-showcase/data";
import {
  accountProfileUnavailableMessage,
  getOrCreateAccountProfile
} from "@/lib/account-profiles";

export const dynamic = "force-dynamic";

export default async function PrivateResellerHomePage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data, reviewsData, reputation, verification, inventory, templateInventory, account] = await Promise.all([
    searchParams,
    getResellerDashboardData(),
    getResellerReviewsData(),
    getResellerReputationData(),
    getResellerVerificationData(),
    getResellerInventoryData(),
    getResellerTemplateInventoryData(),
    getOrCreateAccountProfile("reseller")
  ]);

  return (
    <>
      <PageHeader
        action={
          data.profile?.slug ? (
            <Link
              className="inline-flex h-11 items-center justify-center rounded-full bg-violet-950 px-5 text-sm font-bold text-white"
              href={`/resellers/${data.profile.slug}`}
              target="_blank"
            >
              Public profile
            </Link>
          ) : null
        }
        description="Dedicated reseller dashboard for showcase management, marketplace listings, reports, subscriptions, and future reseller revenue tools."
        title="Reseller Overview"
      />
      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{resellerMigrationMessage()}</p>
        </Card>
      ) : null}
      <ResellerStatusAlerts query={query} />
      <AccountIdCard account={account} unavailableMessage={accountProfileUnavailableMessage()} />
      <ResellerOverviewCards data={data} />
      <ResellerInventoryCard inventory={inventory} />
      <ResellerTemplateInventoryCard inventory={templateInventory} />
      <Card className="p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Verification
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              {verification.verifiedCount}/4 checks verified
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Public profiles show verification badge statuses only. Private documents and contact details stay hidden.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-ink"
            href="/reseller/dashboard/verification"
          >
            Verification center
          </Link>
        </div>
      </Card>
      <Card className="p-6 lg:p-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Reputation & Level
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
              {reputation.currentLevel} reseller
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              {reputation.friendlyExplanation}
            </p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-violet-600" style={{ width: `${reputation.progress}%` }} />
            </div>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              {reputation.progress}% toward {reputation.nextLevel}
            </p>
          </div>
          <div className="grid gap-2 rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-black text-ink">Missing requirements</p>
            {reputation.missingRequirements.map((requirement) => (
              <p className="rounded-2xl bg-white p-3 text-sm font-semibold text-muted" key={requirement}>
                {requirement}
              </p>
            ))}
          </div>
        </div>
      </Card>
      <Card className="p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Ratings & Reviews
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              {reviewsData.summary.averageRating
                ? `${reviewsData.summary.averageRating}/5 average rating`
                : "No reviews yet"}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              {reviewsData.summary.approvedReviews} approved, {reviewsData.summary.pendingReviews} pending, {reviewsData.summary.rejectedReviews} rejected.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-ink"
            href="/reseller/dashboard/reviews"
          >
            Manage reviews
          </Link>
        </div>
      </Card>
      <ResellerQuickActions profile={data.profile} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Seller dashboard
          </p>
          <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">
            Separate tools
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Normal seller tools live under /dashboard and do not include reseller management.
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Reseller dashboard
          </p>
          <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">
            Showcase-first flow
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Manage reseller profile, listings, future orders, reports, subscriptions, and earnings here.
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Admin dashboard
          </p>
          <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">
            Platform-only
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Platform owner tools remain isolated under /admin.
          </p>
        </Card>
      </div>
    </>
  );
}
