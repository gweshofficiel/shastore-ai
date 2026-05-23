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
        <CreateStoreForm />

        <StoreBuilder saveStoreDraft={saveStoreDraft} />
      </div>
    </div>
  );
}