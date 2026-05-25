import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { ShippingOperationsPanel } from "@/components/commerce-operations/shipping-panel";
import {
  commerceOperationsMigrationMessage,
  getCommerceOperationsData
} from "@/lib/commerce-operations/data";
import { createClient } from "@/lib/supabase/server";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";

export const dynamic = "force-dynamic";

export default async function SellerShippingPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
    const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

    if (!hasPermission(role, "manage_orders")) {
      console.warn("[permission-denied] shipping page denied", {
        permission: "manage_orders",
        role,
        userId: user.id,
        workspaceId
      });

      return (
        <div className="grid gap-6 lg:gap-8">
          <PageHeader
            description="Shipping settings are limited to order managers."
            title="Shipping"
          />
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-800">
              You do not have permission to manage shipping.
            </p>
          </Card>
        </div>
      );
    }
  }

  const [query, data] = await Promise.all([
    searchParams,
    getCommerceOperationsData("seller")
  ]);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Manage shipping methods, regions, fees, delivery agents, delivery notes, and future courier integration placeholders."
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
        returnPath="/dashboard/shipping"
        scope="seller"
        shippingMethods={data.shippingMethods}
      />
    </div>
  );
}
