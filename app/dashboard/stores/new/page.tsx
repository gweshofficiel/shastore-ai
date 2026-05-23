import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import CreateStoreForm from "@/components/dashboard/create-store-form";
import { StoreBuilder } from "@/components/dashboard/store-builder";
import {
  canCreateStore,
  getCurrentUserSubscriptionAccess,
  getUpgradeMessage
} from "@/lib/billing/access";

function formatLimit(value: number | null) {
  return value === null ? "Unlimited" : value.toLocaleString();
}

export default async function NewStorePage({
  searchParams
}: {
  searchParams: Promise<{ detail?: string; error?: string }>;
}) {
  const query = await searchParams;
  const access = await getCurrentUserSubscriptionAccess();
  const canCreate = access ? canCreateStore(access) : true;
  const databaseError =
    query.error === "REAL_DATABASE_ERROR"
      ? query.detail ??
        "The store draft could not be saved to the database. Confirm stores RLS migrations are applied."
      : null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        title="Create store"
        description="Create a draft multi-category store with categories, products, template selection, and a live storefront preview."
      />

      <div className="grid gap-6">
        {databaseError ? (
          <Card className="border-red-200 bg-red-50 p-5">
            <p className="text-sm font-bold text-red-700">Database error: {databaseError}</p>
          </Card>
        ) : null}
        <Card className="border-blue-100 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            Publishing happens after saving: create the draft here, then use the
            Publish Store button on My Stores or Manage Store.
          </p>
        </Card>
        {access ? (
          <Card className="border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-ink">
                  Current plan: {access.plan.name}
                </p>
                <p className="mt-1 text-sm font-semibold text-muted">
                  Stores used: {access.usage.storesUsed} / {formatLimit(access.usage.storeLimit)}
                </p>
              </div>
              {!canCreate ? <ButtonLink href="/pricing">Upgrade plan</ButtonLink> : null}
            </div>
          </Card>
        ) : null}
        {!canCreate ? (
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-800">
              {getUpgradeMessage("stores")}
            </p>
          </Card>
        ) : null}

        {canCreate ? <CreateStoreForm /> : null}

        {canCreate ? <StoreBuilder databaseError={databaseError} /> : null}
      </div>
    </div>
  );
}