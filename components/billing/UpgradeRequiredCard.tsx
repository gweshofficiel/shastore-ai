import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type UpgradeRequiredCardProps = {
  blockedAction: string;
  currentPlan?: string | null;
  reason: string;
  recommendedPlan: string;
};

export function UpgradeRequiredCard({
  blockedAction,
  currentPlan,
  reason,
  recommendedPlan
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
        <ButtonLink className="w-fit shrink-0" href="/dashboard/billing">
          View plans
        </ButtonLink>
      </div>
    </Card>
  );
}
