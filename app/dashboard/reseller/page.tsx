import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  ResellerOverviewCards,
  ResellerQuickActions,
  ResellerStatusAlerts
} from "@/components/reseller-showcase/dashboard-panels";
import {
  getResellerDashboardData,
  resellerMigrationMessage
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

export default async function ResellerHomePage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data] = await Promise.all([searchParams, getResellerDashboardData()]);

  return (
    <>
      <PageHeader
        action={
          data.profile?.is_published ? (
            <Link
              className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white"
              href={`/reseller/${data.profile.slug}`}
              target="_blank"
            >
              Public showcase
            </Link>
          ) : null
        }
        description="Dedicated reseller dashboard for showcase management, marketplace listings, and future reseller revenue tools."
        title="Reseller Home"
      />
      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{resellerMigrationMessage()}</p>
        </Card>
      ) : null}
      <ResellerStatusAlerts query={query} />
      <ResellerOverviewCards data={data} />
      <ResellerQuickActions profile={data.profile} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Seller tools
          </p>
          <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">
            Separate workspace
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Normal seller tools remain in Stores, Orders, Payments, Domains, and Billing.
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Reseller tools
          </p>
          <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">
            Showcase-first flow
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Manage your reseller profile, listing catalog, and future client requests here.
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Future systems
          </p>
          <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">
            Transfer-ready
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Ownership transfer, commissions, and purchase requests are reserved placeholders.
          </p>
        </Card>
      </div>
    </>
  );
}
