import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import CreateStoreForm from "@/components/dashboard/create-store-form";
import { StoreBuilder } from "@/components/dashboard/store-builder";
import { saveStoreDraft } from "@/lib/store-actions";

export default async function NewStorePage() {
  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        title="Create store"
        description="Create a draft multi-category store with categories, products, template selection, and a live storefront preview."
      />

      <div className="grid gap-6">
        <Card className="border-blue-100 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            Publishing happens after saving: create the draft here, then use the
            Publish Store button on My Stores or Manage Store.
          </p>
        </Card>

        <CreateStoreForm />

        <StoreBuilder saveStoreDraft={saveStoreDraft} />
      </div>
    </div>
  );
}