import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  ResellerInventoryCard,
  ResellerListingsGrid,
  ResellerShowcaseItemForm,
  ResellerStatusAlerts
} from "@/components/reseller-showcase/dashboard-panels";
import {
  getResellerDashboardData,
  getResellerInventoryData,
  resellerMigrationMessage
} from "@/lib/reseller-showcase/data";

export const dynamic = "force-dynamic";

function isTemplateListing(item: { preview_images: unknown }) {
  return Array.isArray(item.preview_images)
    ? item.preview_images.map((image) => String(image)).some((image) => image.startsWith("template:"))
    : false;
}

function isPublicMarketplaceStatus(status: string) {
  return ["boosted_placeholder", "featured_ready", "public", "published"].includes(status);
}

export default async function PrivateResellerListingsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [query, data, inventory] = await Promise.all([
    searchParams,
    getResellerDashboardData(),
    getResellerInventoryData()
  ]);
  const storeItems = data.items.filter((item) => !isTemplateListing(item));
  const publishedItems = storeItems.filter((item) => isPublicMarketplaceStatus(item.status));
  const draftItems = storeItems.filter((item) => !isPublicMarketplaceStatus(item.status));

  return (
    <>
      <PageHeader
        description="Inventory-aware reseller listing management. This route uses the same Store Listings engine and plan limits."
        title="Listings"
      />
      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{resellerMigrationMessage()}</p>
        </Card>
      ) : null}
      <ResellerStatusAlerts query={query} />
      <ResellerInventoryCard inventory={inventory} variant="full" />
      <ResellerShowcaseItemForm
        inventory={inventory}
        returnPath="/reseller/dashboard/listings"
        stores={data.stores}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ResellerListingsGrid
          items={publishedItems}
          returnPath="/reseller/dashboard/listings"
          title="Published Listings"
        />
        <ResellerListingsGrid
          items={draftItems}
          returnPath="/reseller/dashboard/listings"
          title="Draft Listings"
        />
      </div>
    </>
  );
}
