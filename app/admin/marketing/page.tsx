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
  getMarketingCouponBadgeTone,
  getMarketingCouponDiscountTypeLabel
} from "@/src/lib/marketing/marketing-coupon-runtime";
import {
  getMarketingGiftCodeBadgeTone
} from "@/src/lib/marketing/marketing-gift-code-runtime";
import {
  getMarketingPromotionBadgeTone,
  getMarketingPromotionIncentiveTypeLabel
} from "@/src/lib/marketing/marketing-promotion-runtime";
import {
  getMarketingReferralBadgeTone,
  getMarketingReferralProgramTypeLabel
} from "@/src/lib/marketing/marketing-referral-runtime";
import {
  getMarketingAffiliateBadgeTone,
  getMarketingAffiliateProgramTypeLabel
} from "@/src/lib/marketing/marketing-affiliate-runtime";
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

      <AdminStatGrid
        stats={[
          { label: "Coupon items", value: control.couponAnalytics.totalCouponItems },
          { label: "Active coupons", value: control.couponAnalytics.activeCouponItems },
          { label: "Draft coupons", value: control.couponAnalytics.draftCouponItems },
          { label: "Paused coupons", value: control.couponAnalytics.pausedCouponItems },
          { label: "Total usage", value: control.couponAnalytics.totalUsageCount },
          { label: "Avg usage", value: control.couponAnalytics.averageUsageCount.toFixed(1) },
          { label: "High usage", value: control.couponAnalytics.highUsageCouponCount },
          { label: "Needs review", value: control.couponAnalytics.needsReviewCouponCount }
        ]}
      />
      <p className="-mt-4 text-xs font-semibold text-slate-500">{control.couponAnalytics.analyticsDescription}</p>

      <AdminStatGrid
        stats={[
          { label: "Promotion items", value: control.promotionMetrics.totalPromotionItems },
          { label: "Active promotions", value: control.promotionMetrics.activePromotionItems },
          { label: "Draft promotions", value: control.promotionMetrics.draftPromotionItems },
          { label: "Scheduled", value: control.promotionMetrics.scheduledPromotionItems },
          { label: "Live", value: control.promotionMetrics.livePromotionItems },
          { label: "Total usage", value: control.promotionMetrics.totalUsageCount },
          { label: "Revenue impact", value: formatAdminMoney(control.promotionMetrics.totalRevenueImpact) },
          { label: "Needs review", value: control.promotionMetrics.needsReviewPromotionCount }
        ]}
      />
      <p className="-mt-4 text-xs font-semibold text-slate-500">{control.promotionMetrics.metricsDescription}</p>

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

      <AdminTable
        headers={["Promotion", "Incentive", "Plan scope", "Audience", "Usage", "Lifecycle", "Status"]}
      >
        {control.promotions.map((promotion) => (
          <tr key={promotion.registryKey}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{promotion.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{promotion.slug}</p>
              <p className="mt-1 text-xs text-slate-500">{promotion.promotionDescription}</p>
              <p className="mt-1 text-xs text-slate-500">{promotion.metadataSummary}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getMarketingPromotionBadgeTone(promotion.incentiveType)}>
                {getMarketingPromotionIncentiveTypeLabel(promotion.incentiveType)}
              </AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{promotion.incentiveLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{promotion.promotionLabel}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{promotion.planScope}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={promotion.audienceBadgeTone}>{promotion.audienceLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{promotion.audienceDescription}</p>
              <p className="mt-1 text-sm text-slate-600">{promotion.targetAudienceSummary}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">{promotion.promotionAudienceLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{promotion.promotionAudienceDescription}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-950">{promotion.usageCount}</p>
              <p className="mt-1 text-xs text-slate-600">
                {formatAdminMoney(promotion.revenueImpact)} placeholder impact
              </p>
            </td>
            <td className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-500">{promotion.lifecycleLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{promotion.lifecycleDescription}</p>
              <div className="mt-2">
                <AdminBadge tone={promotion.scheduleBadgeTone}>{promotion.scheduleLabel}</AdminBadge>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">{promotion.scheduleDescription}</p>
              {promotion.startsAt || promotion.endsAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  {promotion.startsAt ? `Starts ${promotion.startsAt}` : "No start date"}
                  {promotion.endsAt ? ` · Ends ${promotion.endsAt}` : ""}
                  {promotion.timezoneDisplay ? ` · ${promotion.timezoneDisplay}` : ""}
                </p>
              ) : null}
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={promotion.statusBadgeTone}>{promotion.statusLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{promotion.statusDescription}</p>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Coupon code", "Discount type", "Amount", "Plan eligibility", "Usage", "Validation", "Status"]}>
        {control.coupons.map((coupon) => (
          <tr key={coupon.registryKey}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{coupon.code}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{coupon.name}</p>
              <p className="mt-1 text-xs text-slate-500">{coupon.couponDescription}</p>
              <p className="mt-1 text-xs text-slate-500">{coupon.metadataSummary}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getMarketingCouponBadgeTone(coupon.discountType)}>
                {getMarketingCouponDiscountTypeLabel(coupon.discountType)}
              </AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{coupon.couponLabel}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{coupon.amount}</td>
            <td className="px-5 py-4 text-slate-600">{coupon.planEligibility}</td>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-950">{coupon.usageCount}</p>
              <p className="mt-1 text-xs text-slate-600">{coupon.usageLimit}</p>
              <div className="mt-2">
                <AdminBadge tone={coupon.usageTrackingBadgeTone}>{coupon.usageTrackingLabel}</AdminBadge>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">{coupon.usageSummary}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={coupon.validationBadgeTone}>{coupon.validationLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{coupon.validationDescription}</p>
              <div className="mt-2">
                <AdminBadge tone={coupon.eligibilityBadgeTone}>{coupon.eligibilityLabel}</AdminBadge>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">{coupon.eligibilityDescription}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={coupon.statusBadgeTone}>{coupon.statusLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{coupon.statusDescription}</p>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Gift code", "Credit", "Audience", "Usage", "Lifecycle", "Redemption", "Status"]}>
        {control.giftCodes.map((giftCode) => (
          <tr key={giftCode.registryKey}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{giftCode.code}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{giftCode.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{giftCode.slug}</p>
              <p className="mt-1 text-xs text-slate-500">{giftCode.giftCodeDescription}</p>
              <p className="mt-1 text-xs text-slate-500">{giftCode.metadataSummary}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getMarketingGiftCodeBadgeTone(giftCode.creditType)}>
                {giftCode.creditTypeLabel}
              </AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{giftCode.creditLabel}</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{giftCode.creditAmountDisplay}</p>
              <p className="mt-1 text-xs text-slate-600">{giftCode.creditUnitDisplay}</p>
              <div className="mt-2">
                <AdminBadge tone={giftCode.creditReadinessBadgeTone}>{giftCode.creditReadinessLabel}</AdminBadge>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">{giftCode.creditReadinessDescription}</p>
              <p className="mt-1 text-xs text-slate-600">{giftCode.creditGrantingStatus}</p>
              <p className="mt-1 text-xs text-slate-500">
                Redemption readiness: {giftCode.redemptionReadinessLabel}
              </p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={giftCode.audienceBadgeTone}>{giftCode.audienceLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{giftCode.audienceDescription}</p>
              <p className="mt-1 text-sm text-slate-600">{giftCode.targetAudienceSummary}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-950">{giftCode.usageCount}</p>
              <p className="mt-1 text-xs text-slate-600">
                {formatAdminMoney(giftCode.revenueImpact)} placeholder impact
              </p>
            </td>
            <td className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-500">{giftCode.lifecycleLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{giftCode.lifecycleDescription}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={giftCode.redemptionBadgeTone}>{giftCode.redemptionLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{giftCode.redemptionDescription}</p>
              <p className="mt-1 text-xs text-slate-600">{giftCode.redemptionEngineStatus}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={giftCode.statusBadgeTone}>{giftCode.statusLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{giftCode.statusDescription}</p>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Referral", "Program", "Audience", "Usage", "Lifecycle", "Tracking", "Status"]}>
        {control.referrals.map((referral) => (
          <tr key={referral.registryKey}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{referral.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{referral.code}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{referral.slug}</p>
              <p className="mt-1 text-xs text-slate-500">{referral.referralDescription}</p>
              <p className="mt-1 text-xs text-slate-500">{referral.metadataSummary}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getMarketingReferralBadgeTone(referral.referralProgramType)}>
                {getMarketingReferralProgramTypeLabel(referral.referralProgramType)}
              </AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{referral.referralLabel}</p>
              <p className="mt-1 text-xs text-slate-600">{referral.commissionDisplay}</p>
              <p className="mt-1 text-xs text-slate-600">{referral.payoutStatus}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={referral.audienceBadgeTone}>{referral.audienceLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{referral.audienceDescription}</p>
              <p className="mt-1 text-sm text-slate-600">{referral.targetAudienceSummary}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-950">{referral.usageCount}</p>
              <p className="mt-1 text-xs text-slate-600">
                {formatAdminMoney(referral.revenueImpact)} placeholder impact
              </p>
            </td>
            <td className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-500">{referral.lifecycleLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{referral.lifecycleDescription}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={referral.trackingBadgeTone}>{referral.trackingLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{referral.trackingDescription}</p>
              <p className="mt-1 text-xs text-slate-600">{referral.trackingEngineStatus}</p>
              <p className="mt-2 text-xs font-semibold text-slate-950">
                Visits {referral.trackedVisitsCount} · Signups {referral.trackedSignupsCount} · Conversions{" "}
                {referral.trackedConversionsCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">{referral.trackingSummary}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={referral.statusBadgeTone}>{referral.statusLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{referral.statusDescription}</p>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Affiliate", "Program", "Audience", "Usage", "Lifecycle", "Tracking", "Status"]}>
        {control.affiliates.map((affiliate) => (
          <tr key={affiliate.registryKey}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{affiliate.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{affiliate.code}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{affiliate.slug}</p>
              <p className="mt-1 text-xs text-slate-500">{affiliate.affiliateDescription}</p>
              <p className="mt-1 text-xs text-slate-500">{affiliate.metadataSummary}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={getMarketingAffiliateBadgeTone(affiliate.affiliateProgramType)}>
                {getMarketingAffiliateProgramTypeLabel(affiliate.affiliateProgramType)}
              </AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{affiliate.affiliateLabel}</p>
              <p className="mt-1 text-xs text-slate-600">{affiliate.commissionDisplay}</p>
              <p className="mt-1 text-xs text-slate-600">{affiliate.payoutStatus}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={affiliate.audienceBadgeTone}>{affiliate.audienceLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{affiliate.audienceDescription}</p>
              <p className="mt-1 text-sm text-slate-600">{affiliate.targetAudienceSummary}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-950">{affiliate.usageCount}</p>
              <p className="mt-1 text-xs text-slate-600">
                {formatAdminMoney(affiliate.revenueImpact)} placeholder impact
              </p>
            </td>
            <td className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-500">{affiliate.lifecycleLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{affiliate.lifecycleDescription}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={affiliate.trackingBadgeTone}>{affiliate.trackingLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{affiliate.trackingDescription}</p>
              <p className="mt-1 text-xs text-slate-600">{affiliate.trackingEngineStatus}</p>
              <p className="mt-2 text-xs font-semibold text-slate-950">
                Visits {affiliate.trackedVisitsCount} · Signups {affiliate.trackedSignupsCount} · Conversions{" "}
                {affiliate.trackedConversionsCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">{affiliate.trackingSummary}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={affiliate.statusBadgeTone}>{affiliate.statusLabel}</AdminBadge>
              <p className="mt-1 text-xs font-semibold text-slate-500">{affiliate.statusDescription}</p>
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
