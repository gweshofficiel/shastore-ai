import { PageHeader } from "@/components/dashboard/page-header";
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

export default async function ResellerSettingsPage({
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
      <ResellerSettingsPanel profile={data.profile} />
    </>
  );
}
