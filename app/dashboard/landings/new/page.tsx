import { PageHeader } from "@/components/dashboard/page-header";
import { LandingBuilder } from "@/components/dashboard/landing-builder";
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard";
import { publishLandingPage } from "@/lib/landing-actions";
import { getCurrentUserSubscriptionAccess } from "@/lib/billing/access";

export const dynamic = "force-dynamic";

export default async function NewLandingPage({
  searchParams
}: {
  searchParams: Promise<{ detail?: string; error?: string }>;
}) {
  const query = await searchParams;
  const access = await getCurrentUserSubscriptionAccess();
  const limitError = query.error === "limit-reached" ? query.detail : null;

  return (
    <div className="grid gap-8">
      <PageHeader
        description="Create a product landing page, generate AI marketing copy, select a template, and publish instantly."
        title="Create landing page"
      />
      {limitError && access ? (
        <UpgradeRequiredCard
          blockedAction="Landing page limit reached"
          currentPlan={access.plan.name}
          reason={
            access.plan.id === "pro"
              ? "Agency plan required for unlimited usage."
              : limitError
          }
          recommendedPlan={access.plan.id === "pro" ? "Agency" : "Pro"}
        />
      ) : null}
      <LandingBuilder publishLandingPage={publishLandingPage} />
    </div>
  );
}
