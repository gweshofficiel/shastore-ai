import { PageHeader } from "@/components/dashboard/page-header";
import { ResellerPlaceholderPanel } from "@/components/reseller-showcase/dashboard-panels";

export const dynamic = "force-dynamic";

export default function ResellerEarningsPage() {
  return (
    <>
      <PageHeader
        description="Future commissions, recurring reseller revenue, and VIP reseller earnings."
        title="Earnings"
      />
      <ResellerPlaceholderPanel
        description="This placeholder keeps earnings separate from platform billing and buyer checkout. Future payout ledgers, commission rules, and VIP tiers can be added here."
        items={["Commissions", "Recurring revenue", "VIP reseller earnings"]}
        title="Earnings foundation ready"
      />
    </>
  );
}
