import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import CreateStoreForm from "@/components/dashboard/create-store-form";
import { StoreBuilder } from "@/components/dashboard/store-builder";
import { saveStoreDraft } from "@/lib/store-actions";

export default async function NewStorePage({
  searchParams
}: {
  searchParams: Promise<{ detail?: string; error?: string }>;
}) {
  const query = await searchParams;
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

        <CreateStoreForm />

        <StoreBuilder databaseError={databaseError} saveStoreDraft={saveStoreDraft} />
      </div>
    </div>
  );
}