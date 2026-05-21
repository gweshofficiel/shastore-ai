import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  ResellerListingsGrid,
  ResellerShowcaseItemForm,
  ResellerStatusAlerts
} from "@/components/reseller-showcase/dashboard-panels";
import {
  getResellerDashboardData,
  resellerMigrationMessage
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

export default async function ResellerStoresPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data] = await Promise.all([searchParams, getResellerDashboardData()]);
  const publishedItems = data.items.filter((item) => item.status === "published");
  const draftItems = data.items.filter((item) => item.status !== "published");

  return (
    <>
      <PageHeader
        description="Create marketplace listings, link store drafts, publish or unpublish showcase products, and prepare future transfer flows."
        title="Store Listings Manager"
      />
      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{resellerMigrationMessage()}</p>
        </Card>
      ) : null}
      <ResellerStatusAlerts query={query} />
      <ResellerShowcaseItemForm
        returnPath="/dashboard/reseller/stores"
        stores={data.stores}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ResellerListingsGrid
          items={publishedItems}
          returnPath="/dashboard/reseller/stores"
          title="Published Stores"
        />
        <ResellerListingsGrid
          items={draftItems}
          returnPath="/dashboard/reseller/stores"
          title="Draft Stores"
        />
      </div>
    </>
  );
}
