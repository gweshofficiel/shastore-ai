import { AdminHeader } from "@/components/admin/admin-control";
import { MarketplaceAdminPanel } from "@/components/admin/marketplace-admin-panel";

export default function AdminMarketplacePage() {
  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Prepare SHASTORE marketplace governance for templates, themes, plugins, apps, and services. This is a control layer only: no payments, no installs, no deletions, and no public marketplace exposure happen here."
        title="Marketplace Management Center"
      />
      <MarketplaceAdminPanel />
    </div>
  );
}
