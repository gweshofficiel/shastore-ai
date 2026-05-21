import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { ResellerBusinessSettingsPanel } from "@/components/reseller-business/business-settings-panel";
import {
  getResellerBusinessSettings,
  resellerBusinessMigrationMessage
} from "@/lib/reseller-business/data";

export const dynamic = "force-dynamic";

export default async function ResellerBusinessPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data] = await Promise.all([
    searchParams,
    getResellerBusinessSettings()
  ]);

  return (
    <>
      <PageHeader
        description="Configure reseller business details and how clients receive purchased stores, templates, or services."
        title="Business Settings"
      />
      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            {resellerBusinessMigrationMessage()}
          </p>
        </Card>
      ) : null}
      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Reseller business settings saved.
          </p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}
      <ResellerBusinessSettingsPanel settings={data.settings} />
    </>
  );
}
