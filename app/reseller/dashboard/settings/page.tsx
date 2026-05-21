import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ResellerSettingsPanel,
  ResellerStatusAlerts
} from "@/components/reseller-showcase/dashboard-panels";
import {
  getResellerDashboardData,
  resellerMigrationMessage
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

export default async function PrivateResellerSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data] = await Promise.all([searchParams, getResellerDashboardData()]);

  return (
    <>
      <PageHeader
        description="Reseller business info, support contact, payout placeholders, and notification preferences."
        title="Reseller Settings"
      />
      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{resellerMigrationMessage()}</p>
        </Card>
      ) : null}
      <ResellerStatusAlerts query={query} />
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Business Settings
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
          Store delivery to clients
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Configure reseller business details and how buyers receive purchased
          stores, templates, or services. Resellers do not use shipping, couriers,
          pickup, or local delivery here.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/reseller/dashboard/business" variant="secondary">
            Business settings
          </ButtonLink>
        </div>
      </Card>
      <ResellerSettingsPanel profile={data.profile} />
    </>
  );
}
