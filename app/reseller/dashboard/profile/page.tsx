import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  ResellerShowcaseProfileForm,
  ResellerStatusAlerts
} from "@/components/reseller-showcase/dashboard-panels";
import {
  getResellerBadgesData,
  getResellerDashboardData,
  getResellerVerificationData,
  resellerMigrationMessage
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

export default async function ResellerProfilePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [query, data, verification, badges] = await Promise.all([
    searchParams,
    getResellerDashboardData(),
    getResellerVerificationData(),
    getResellerBadgesData()
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
              View public profile
            </Link>
          ) : null
        }
        description="Stabilized reseller profile route for public identity, publish state, social links, and profile visibility checks."
        title="Reseller Profile"
      />

      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{resellerMigrationMessage()}</p>
        </Card>
      ) : null}

      <ResellerStatusAlerts query={query} />
      <ResellerShowcaseProfileForm profile={data.profile} returnPath="/reseller/dashboard/profile" />

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Public status</p>
          <p className="mt-3 text-2xl font-black text-ink">
            {data.profile?.is_published ? "Published" : "Draft"}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Draft profiles and private listings stay hidden from the public profile.
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Verification</p>
          <p className="mt-3 text-2xl font-black text-ink">{verification.overallStatus}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Private verification details are never shown publicly.
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Public badges</p>
          <p className="mt-3 text-2xl font-black text-ink">{badges.summary.publicVisible}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Only earned and public-visible badges can appear publicly.
          </p>
        </Card>
      </div>
    </>
  );
}
