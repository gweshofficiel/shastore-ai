import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import type { AdminPlatformMarketingControl } from "@/lib/admin/data";
import { loadPlatformMarketingControlSafe } from "@/lib/admin/marketing-loader";
import type { MarketingLifecycleAction } from "@/src/lib/marketing/marketing-campaign-lifecycle-runtime";
import {
  getMarketingStatusBadgeTone,
  getMarketingStatusLabel
} from "@/src/lib/marketing/marketing-status-runtime";
import {
  getMarketingTypeBadgeTone,
  getMarketingTypeLabel
} from "@/src/lib/marketing/marketing-type-runtime";
import {
  activateMarketingCampaignPlaceholder,
  archiveMarketingCampaignPlaceholder,
  createMarketingDraftPlaceholder,
  pauseMarketingCampaign,
  viewMarketingUsagePlaceholder
} from "@/lib/admin/platform-marketing-actions";
import type { ComponentProps } from "react";

function MarketingRuntimeRecoveryNotice({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Marketing registry recovery</p>
      <p className="mt-2 text-sm font-semibold text-amber-900">
        Marketing registry data could not be loaded from runtime storage. The admin shell is still available with fallback
        registry rows.
      </p>
      <p className="mt-2 text-xs font-semibold text-amber-800">{message}</p>
    </div>
  );
}

function CampaignHiddenFields({
  campaign
}: {
  campaign: AdminPlatformMarketingControl["campaigns"][number];
}) {
  return (
    <>
      <input name="campaignId" type="hidden" value={campaign.id} />
      <input name="campaignName" type="hidden" value={campaign.name} />
      <input name="campaignType" type="hidden" value={campaign.type} />
    </>
  );
}

const lifecycleActionHandlers: Record<
  MarketingLifecycleAction,
  ComponentProps<"form">["action"]
> = {
  activate: activateMarketingCampaignPlaceholder,
  archive: archiveMarketingCampaignPlaceholder,
  create_draft: createMarketingDraftPlaceholder,
  pause: pauseMarketingCampaign,
  view_usage: viewMarketingUsagePlaceholder
};

const lifecycleActionButtonClass: Record<MarketingLifecycleAction, string> = {
  activate: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  archive: "border border-red-200 bg-red-50 text-red-700",
  create_draft: "border border-slate-200 bg-white text-slate-700",
  pause: "border border-blue-200 bg-blue-50 text-blue-700",
  view_usage: "border border-amber-200 bg-amber-50 text-amber-700"
};

function MarketingCampaignSafeActions({
  campaign
}: {
  campaign: AdminPlatformMarketingControl["campaigns"][number];
}) {
  return (
    <div className="grid min-w-52 gap-2">
      {campaign.lifecycleActions.map((action) => (
        <form action={lifecycleActionHandlers[action.action]} key={action.action}>
          <CampaignHiddenFields campaign={campaign} />
          <button
            className={`h-9 w-full rounded-full px-3 text-xs font-black uppercase tracking-[0.14em] ${lifecycleActionButtonClass[action.action]}`}
            title={action.description}
            type="submit"
          >
            {action.label}
          </button>
        </form>
      ))}
    </div>
  );
}

export default async function AdminMarketingPage() {
  const { control, ok, warning } = await loadPlatformMarketingControlSafe();
  const recoveryMessage = warning ?? control.runtimeWarning ?? null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform-level marketing foundations for SHASTORE coupons, promotions, gift codes, referrals, affiliates, and campaigns. This does not modify Store Owner coupons, discounts, email campaigns, referrals, or storefront marketing."
        title="Marketing & Promotion Center"
      />

      {!ok && recoveryMessage ? <MarketingRuntimeRecoveryNotice message={recoveryMessage} /> : null}

      <AdminStatGrid
        stats={[
          { label: "Platform sections", value: control.overview.totalSections },
          { label: "Active", value: control.overview.activeSections },
          { label: "Draft", value: control.overview.draftSections },
          { label: "Paused", value: control.overview.pausedSections },
          { label: "Expired", value: control.overview.expiredSections },
          { label: "Archived", value: control.overview.archivedSections },
          { label: "Mass sends", value: 0 },
          { label: "Affiliate payouts", value: formatAdminMoney(0) }
        ]}
      />

      <AdminTable
        headers={[
          "Name",
          "Type",
          "Status",
          "Target audience",
          "Start date",
          "End date",
          "Usage",
          "Revenue impact",
          "Safe actions"
        ]}
      >
        {control.campaigns.map((campaign) => (
          <tr key={campaign.id}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{campaign.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{campaign.section}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={campaign.typeBadgeTone}>{campaign.typeLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{campaign.typeDescription}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={campaign.statusBadgeTone}>{campaign.statusLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{campaign.statusDescription}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{campaign.lifecycleLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{campaign.lifecycleDescription}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={campaign.audienceBadgeTone}>{campaign.audienceLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{campaign.audienceDescription}</p>
              <p className="mt-1 text-sm text-slate-600">{campaign.targetAudienceSummary}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(campaign.startDate)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(campaign.endDate)}</td>
            <td className="px-5 py-4 text-slate-600">{campaign.usage} placeholder</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(campaign.revenueImpact)} placeholder</td>
            <td className="px-5 py-4">
              <MarketingCampaignSafeActions campaign={campaign} />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Coupon code", "Discount type", "Amount", "Plan eligibility", "Usage limit", "Status"]}>
        {control.coupons.map((coupon) => (
          <tr key={coupon.code}>
            <td className="px-5 py-4 font-bold text-slate-950">{coupon.code}</td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{coupon.discountType}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{coupon.amount}</td>
            <td className="px-5 py-4 text-slate-600">{coupon.planEligibility}</td>
            <td className="px-5 py-4 text-slate-600">{coupon.usageLimit}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={getMarketingStatusBadgeTone(coupon.status)}>{getMarketingStatusLabel(coupon.status)}</AdminBadge>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Gift code", "Credit amount", "Plan credit", "Redemption status", "Status"]}>
        {control.giftCodes.map((giftCode) => (
          <tr key={giftCode.code}>
            <td className="px-5 py-4 font-bold text-slate-950">{giftCode.code}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(giftCode.creditAmount)} placeholder</td>
            <td className="px-5 py-4 text-slate-600">{giftCode.planCredit}</td>
            <td className="px-5 py-4 text-slate-600">{giftCode.redemptionStatus}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={getMarketingStatusBadgeTone(giftCode.status)}>{getMarketingStatusLabel(giftCode.status)}</AdminBadge>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Referrer", "Type", "Referred users", "Commission", "Payout status", "Status"]}>
        {control.referralAffiliates.map((record) => (
          <tr key={`${record.type}:${record.referrer}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{record.referrer}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={getMarketingTypeBadgeTone(record.type)}>{getMarketingTypeLabel(record.type)}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{record.referredUsers} placeholder</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(record.commission)} placeholder</td>
            <td className="px-5 py-4 text-slate-600">{record.payoutStatus}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={getMarketingStatusBadgeTone(record.status)}>{getMarketingStatusLabel(record.status)}</AdminBadge>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Future hook", "Status"]}>
        {control.futureHooks.map((hook) => (
          <tr key={hook}>
            <td className="px-5 py-4 font-bold text-slate-950">{hook}</td>
            <td className="px-5 py-4">
              <button
                className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                type="button"
              >
                Reserved placeholder
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
