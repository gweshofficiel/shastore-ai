import { PageHeader } from "@/components/dashboard/page-header";
import { LandingBuilder } from "@/components/dashboard/landing-builder";
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard";
import { publishLandingPage } from "@/lib/landing-actions";
import { getCurrentUserSubscriptionAccess } from "@/lib/billing/access";
import { getRecommendedUpgrade } from "@/lib/billing/upgrade";

export const dynamic = "force-dynamic";

export default async function NewLandingPage({
  searchParams
}: {
  searchParams: Promise<{ detail?: string; error?: string }>;
}) {
  const query = await searchParams;
  const access = await getCurrentUserSubscriptionAccess();
  const limitError = query.error === "limit-reached" ? query.detail : null;
  const landingUpgrade = access
    ? getRecommendedUpgrade({
        blockedResource: "landings",
        currentPlanId: access.plan.id,
        needsUnlimited: access.plan.id === "starter" || access.plan.id === "pro"
      })
    : null;

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
          reason={landingUpgrade?.reason ?? limitError}
          recommendedPlan={landingUpgrade?.planName ?? "Starter"}
          recommendedPlanId={landingUpgrade?.planId}
        />
      ) : null}
      <LandingBuilder publishLandingPage={publishLandingPage} />
    </div>
  );
}
