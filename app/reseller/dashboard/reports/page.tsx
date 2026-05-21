import { PageHeader } from "@/components/dashboard/page-header";
import { ResellerPlaceholderPanel } from "@/components/reseller-showcase/dashboard-panels";

export const dynamic = "force-dynamic";

export default function ResellerReportsPage() {
  return (
    <>
      <PageHeader
        description="Future reseller showcase reports, listing views, demo clicks, and conversion signals."
        title="Reseller Reports"
      />
      <ResellerPlaceholderPanel
        description="Reports are reserved for reseller-specific marketplace analytics. This placeholder does not use the existing seller analytics system."
        items={["Showcase views", "Listing clicks", "Demo opens"]}
        title="Reports foundation ready"
      />
    </>
  );
}
