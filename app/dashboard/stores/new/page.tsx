import { PageHeader } from "@/components/dashboard/page-header";
import { StoreBuilder } from "@/components/dashboard/store-builder";
import CreateStoreForm from "@/components/dashboard/create-store-form";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  canCreateStore,
  getCurrentUserSubscriptionAccess,
  getUpgradeMessage
} from "@/lib/billing/access";
import { saveStoreDraft } from "@/lib/store-actions";

export default async function NewStorePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const access = await getCurrentUserSubscriptionAccess();

  const storeLimitReached = access
    ? !canCreateStore(access)
    : false;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create a draft multi-category store with categories, products, template selection, and a live storefront preview."
        title="Create store"
      />

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">
            {error}
          </p>
        </Card>
      ) : null}

      {storeLimitReached ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">
            {getUpgradeMessage("stores")}
          </p>

          <div className="mt-4">
            <ButtonLink href="/dashboard/billing">
              View plans
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6">
          <CreateStoreForm />
          <StoreBuilder saveStoreDraft={saveStoreDraft} />
        </div>
      )}
    </div>
  );
}