import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PaidSubscriptionPlanId } from "@/lib/billing/platform-checkout";

type UpgradeRequiredCardProps = {
  blockedAction: string;
  currentPlan?: string | null;
  reason: string;
  recommendedPlan: string;
  recommendedPlanId?: PaidSubscriptionPlanId | null;
};

export function UpgradeRequiredCard({
  blockedAction,
  currentPlan,
  reason,
  recommendedPlan,
  recommendedPlanId
}: UpgradeRequiredCardProps) {
  return (
    <Card className="border-amber-200 bg-amber-50 p-5 lg:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">
            Upgrade required
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
            {blockedAction}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">{reason}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.16em]">
            <span className="rounded-full bg-white px-3 py-1 text-amber-800">
              Current: {currentPlan ?? "Free"}
            </span>
            <span className="rounded-full bg-ink px-3 py-1 text-white">
              Recommended: {recommendedPlan}
            </span>
          </div>
        </div>
        {recommendedPlanId ? (
          <form action="/api/stripe/create-checkout-session" className="w-fit shrink-0" method="POST">
            <input name="plan" type="hidden" value={recommendedPlanId} />
            <Button type="submit">Upgrade to {recommendedPlan}</Button>
          </form>
        ) : (
          <Button className="w-fit shrink-0" disabled type="button" variant="secondary">
            Current top plan
          </Button>
        )}
      </div>
    </Card>
  );
}
