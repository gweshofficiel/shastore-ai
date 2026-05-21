import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { ShippingOperationsPanel } from "@/components/commerce-operations/shipping-panel";
import {
  commerceOperationsMigrationMessage,
  getCommerceOperationsData
} from "@/lib/commerce-operations/data";

export const dynamic = "force-dynamic";

export default async function ResellerShippingPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data] = await Promise.all([
    searchParams,
    getCommerceOperationsData("reseller")
  ]);

  return (
    <>
      <PageHeader
        description="Manage reseller shipping methods, delivery regions, agents, and fulfillment placeholders for future marketplace sales."
        title="Shipping"
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
          <p className="text-sm font-bold text-emerald-700">Shipping settings saved.</p>
        </Card>
      ) : null}
      {query.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error}</p>
        </Card>
      ) : null}
      <ShippingOperationsPanel
        agents={data.agents}
        returnPath="/reseller/dashboard/shipping"
        scope="reseller"
        shippingMethods={data.shippingMethods}
      />
    </>
  );
}
