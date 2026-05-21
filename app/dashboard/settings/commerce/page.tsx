import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { CommerceSettingsPanel } from "@/components/commerce-operations/commerce-settings-panel";
import {
  commerceOperationsMigrationMessage,
  getCommerceOperationsData
} from "@/lib/commerce-operations/data";

export const dynamic = "force-dynamic";

export default async function SellerCommerceSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data] = await Promise.all([
    searchParams,
    getCommerceOperationsData("seller")
  ]);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Configure seller business operations, store policies, checkout preferences, supported countries, support contacts, and taxes placeholders."
        title="Commerce Settings"
      />
      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            {commerceOperationsMigrationMessage()}
          </p>
        </Card>
      ) : null}
      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Commerce settings saved.</p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}
      <CommerceSettingsPanel
        returnPath="/dashboard/settings/commerce"
        scope="seller"
        settings={data.settings}
      />
    </div>
  );
}
