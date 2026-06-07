import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { getAdminPlatformMarketingControl } from "@/lib/admin/data";
import {
  activateMarketingCampaignPlaceholder,
  archiveMarketingCampaignPlaceholder,
  createMarketingDraftPlaceholder,
  pauseMarketingCampaign,
  viewMarketingUsagePlaceholder
} from "@/lib/admin/platform-marketing-actions";

function toneForStatus(status: string) {
  if (status === "active") {
    return "green" as const;
  }

  if (["archived", "expired"].includes(status)) {
    return "red" as const;
  }

  if (status === "paused") {
    return "blue" as const;
  }

  return "amber" as const;
}

function CampaignHiddenFields({
  campaign
}: {
  campaign: Awaited<ReturnType<typeof getAdminPlatformMarketingControl>>["campaigns"][number];
}) {
  return (
    <>
      <input name="campaignId" type="hidden" value={campaign.id} />
      <input name="campaignName" type="hidden" value={campaign.name} />
      <input name="campaignType" type="hidden" value={campaign.type} />
    </>
  );
}

export default async function AdminMarketingPage() {
  const control = await getAdminPlatformMarketingControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform-level marketing foundations for SHASTORE coupons, promotions, gift codes, referrals, affiliates, and campaigns. This does not modify Store Owner coupons, discounts, email campaigns, referrals, or storefront marketing."
        title="Marketing & Promotion Center"
      />

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
            <td className="px-5 py-4"><AdminBadge tone="blue">{campaign.type}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(campaign.status)}>{campaign.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{campaign.targetAudience}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(campaign.startDate)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(campaign.endDate)}</td>
            <td className="px-5 py-4 text-slate-600">{campaign.usage} placeholder</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(campaign.revenueImpact)} placeholder</td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <form action={createMarketingDraftPlaceholder}>
                  <CampaignHiddenFields campaign={campaign} />
                  <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                    Create draft
                  </button>
                </form>
                <form action={pauseMarketingCampaign}>
                  <CampaignHiddenFields campaign={campaign} />
                  <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                    Pause
                  </button>
                </form>
                <form action={activateMarketingCampaignPlaceholder}>
                  <CampaignHiddenFields campaign={campaign} />
                  <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                    Activate
                  </button>
                </form>
                <form action={archiveMarketingCampaignPlaceholder}>
                  <CampaignHiddenFields campaign={campaign} />
                  <button className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                    Archive
                  </button>
                </form>
                <form action={viewMarketingUsagePlaceholder}>
                  <CampaignHiddenFields campaign={campaign} />
                  <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                    View usage
                  </button>
                </form>
              </div>
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
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(coupon.status)}>{coupon.status}</AdminBadge></td>
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
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(giftCode.status)}>{giftCode.status}</AdminBadge></td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Referrer", "Type", "Referred users", "Commission", "Payout status", "Status"]}>
        {control.referralAffiliates.map((record) => (
          <tr key={`${record.type}:${record.referrer}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{record.referrer}</td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{record.type}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{record.referredUsers} placeholder</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminMoney(record.commission)} placeholder</td>
            <td className="px-5 py-4 text-slate-600">{record.payoutStatus}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(record.status)}>{record.status}</AdminBadge></td>
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
