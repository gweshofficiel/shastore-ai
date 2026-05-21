import { PageHeader } from "@/components/dashboard/page-header";
import { AccountIdCard } from "@/components/account/account-id-card";
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
import {
  accountProfileUnavailableMessage,
  getOrCreateAccountProfile
} from "@/lib/account-profiles";

export const dynamic = "force-dynamic";

export default async function PrivateResellerSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data, account] = await Promise.all([
    searchParams,
    getResellerDashboardData(),
    getOrCreateAccountProfile("reseller")
  ]);

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
      <AccountIdCard account={account} unavailableMessage={accountProfileUnavailableMessage()} />
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
