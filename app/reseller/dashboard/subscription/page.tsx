import { PageHeader } from "@/components/dashboard/page-header";
import { ResellerPlaceholderPanel } from "@/components/reseller-showcase/dashboard-panels";

export const dynamic = "force-dynamic";

export default function ResellerSubscriptionPage() {
  return (
    <>
      <PageHeader
        description="Future reseller subscription tier, VIP plan, and marketplace entitlement area."
        title="Reseller Subscription"
      />
      <ResellerPlaceholderPanel
        description="This placeholder keeps reseller subscription concepts separate from SHASTORE AI platform billing subscriptions until a dedicated reseller plan model exists."
        items={["Reseller tier", "VIP benefits", "Marketplace entitlements"]}
        title="Reseller subscription placeholder"
      />
    </>
  );
}
