import { PageHeader } from "@/components/dashboard/page-header";
import { ResellerPlaceholderPanel } from "@/components/reseller-showcase/dashboard-panels";

export const dynamic = "force-dynamic";

export default function PrivateResellerOrdersPage() {
  return (
    <>
      <PageHeader
        description="Future reseller client purchase requests and ownership transfer workflow."
        title="Reseller Orders"
      />
      <ResellerPlaceholderPanel
        description="This area is reserved for client purchase requests, approval steps, transfer verification codes, and store ownership handoff. It does not use the buyer checkout or seller order system yet."
        items={[
          "Client purchase requests",
          "Ownership transfer ready",
          "Verification codes later"
        ]}
        title="No reseller purchase requests yet"
      />
    </>
  );
}
