import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { getAdminMarketplaceControl } from "@/lib/admin/data";
import {
  approveMarketplaceItem,
  archiveMarketplaceItem,
  markMarketplaceItemUnderReview,
  rejectMarketplaceItem,
  restoreMarketplaceItemDraft,
  updateMarketplaceItemPricing,
  updateMarketplaceItemVisibility
} from "@/lib/admin/marketplace-actions";

function toneForStatus(status: string) {
  if (["approved", "public", "ready"].includes(status)) {
    return "green" as const;
  }

  if (["archived", "rejected"].includes(status)) {
    return "red" as const;
  }

  if (["internal", "placeholder"].includes(status)) {
    return "amber" as const;
  }

  if (status === "private") {
    return "blue" as const;
  }

  return "amber" as const;
}

function MarketplaceHiddenFields({
  item
}: {
  item: Awaited<ReturnType<typeof getAdminMarketplaceControl>>["items"][number];
}) {
  return (
    <>
      <input name="itemId" type="hidden" value={item.id} />
      <input name="itemName" type="hidden" value={item.name} />
      <input name="itemType" type="hidden" value={item.type} />
    </>
  );
}

function shortenActorId(value: string | null) {
  if (!value) return null;
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function MarketplaceRevenueInspection({
  item
}: {
  item: Awaited<ReturnType<typeof getAdminMarketplaceControl>>["items"][number];
}) {
  const { revenueInspection } = item;

  return (
    <div className="grid min-w-52 gap-2">
      <p className="text-xs font-semibold text-slate-600">
        Recorded: {formatAdminMoney(revenueInspection.recordedAmount)} {revenueInspection.currency ?? "USD"}
      </p>
      <p className="text-xs font-semibold text-slate-600">
        Pricing gross: {formatAdminMoney(revenueInspection.grossAmount)} {revenueInspection.currency ?? "USD"}
      </p>
      <p className="text-xs font-semibold text-slate-500">
        Platform fee ({Math.round(revenueInspection.platformFeeRate * 100)}%):{" "}
        {formatAdminMoney(revenueInspection.platformFeeAmount)}
      </p>
      <p className="text-xs font-semibold text-slate-500">
        Creator share: {formatAdminMoney(revenueInspection.creatorRevenueAmount)}
      </p>
      <p className="text-xs font-semibold text-slate-500">
        Events: {revenueInspection.processedEventCount} processed / {revenueInspection.eventCount} total
      </p>
      {revenueInspection.recentEvents.length ? (
        <div className="grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Recent revenue events</p>
          {revenueInspection.recentEvents.map((event) => (
            <div className="text-[11px] font-semibold text-slate-600" key={event.id}>
              <p>
                {formatAdminMoney(event.grossAmount)} {event.currency} · {event.revenueStatus}
              </p>
              <p className="text-slate-400">
                Fee {formatAdminMoney(event.platformFeeAmount)} · Creator {formatAdminMoney(event.creatorRevenueAmount)}
              </p>
              {event.createdAt ? <p className="text-slate-400">{formatAdminDate(event.createdAt)}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400">No revenue events recorded yet.</p>
      )}
    </div>
  );
}

function MarketplaceInstallInspection({
  item
}: {
  item: Awaited<ReturnType<typeof getAdminMarketplaceControl>>["items"][number];
}) {
  const { installInspection } = item;

  return (
    <div className="grid min-w-52 gap-2">
      <p className="text-xs font-semibold text-slate-600">
        Live installs: {installInspection.liveInstalls}
      </p>
      <p className="text-xs font-semibold text-slate-600">
        Total installs: {installInspection.installCount}
      </p>
      <p className="text-xs font-semibold text-slate-500">
        Eligible: {installInspection.installEligible ? "yes" : "service excluded"}
      </p>
      <p className="text-xs font-semibold text-slate-500">
        Public install eligible: {installInspection.publicInstallEligible ? "yes" : "no"}
      </p>
      {installInspection.installCountUpdatedAt ? (
        <p className="text-xs font-semibold text-slate-500">
          Updated: {formatAdminDate(installInspection.installCountUpdatedAt)}
        </p>
      ) : null}
      <p className="text-xs font-semibold text-slate-500">
        Events: {installInspection.eventCount}
      </p>
      {installInspection.recentEvents.length ? (
        <div className="grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Recent install events</p>
          {installInspection.recentEvents.map((event) => (
            <div className="text-[11px] font-semibold text-slate-600" key={event.id}>
              <p>
                {event.installStatus}
                {event.storeId ? ` · store ${event.storeId.slice(0, 8)}…` : ""}
              </p>
              {event.createdAt ? <p className="text-slate-400">{formatAdminDate(event.createdAt)}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400">No install events recorded yet.</p>
      )}
    </div>
  );
}

function MarketplaceTemplateBindingInspection({
  item
}: {
  item: Awaited<ReturnType<typeof getAdminMarketplaceControl>>["items"][number];
}) {
  if (!item.templateBinding) {
    return <p className="text-xs font-semibold text-slate-400">Not applicable</p>;
  }

  const binding = item.templateBinding;

  return (
    <div className="grid min-w-52 gap-2">
      <AdminBadge tone={binding.verified ? "green" : binding.bindingStatus === "bound" ? "amber" : "red"}>
        {binding.bindingStatus ?? "unknown"}
      </AdminBadge>
      <p className="text-xs font-semibold text-slate-600">
        Verified: {binding.verified ? "yes" : "no"}
      </p>
      {binding.templateName ? (
        <p className="text-xs font-semibold text-slate-600">Template: {binding.templateName}</p>
      ) : null}
      {binding.templateKey ? (
        <p className="text-xs font-semibold text-slate-500">Key: {binding.templateKey}</p>
      ) : null}
      {binding.linkedTemplateId ? (
        <p className="text-xs font-semibold text-slate-500">Registry ID: {binding.linkedTemplateId}</p>
      ) : null}
      {binding.templateVersion ? (
        <p className="text-xs font-semibold text-slate-500">Bound version: {binding.templateVersion}</p>
      ) : null}
      {binding.templateStatus ? (
        <p className="text-xs font-semibold text-slate-500">Template status: {binding.templateStatus}</p>
      ) : null}
      {binding.templateVisibility ? (
        <p className="text-xs font-semibold text-slate-500">Template visibility: {binding.templateVisibility}</p>
      ) : null}
      {binding.bindingUpdatedAt ? (
        <p className="text-xs font-semibold text-slate-500">
          Binding updated: {formatAdminDate(binding.bindingUpdatedAt)}
        </p>
      ) : null}
      {binding.verificationIssues.length ? (
        <div className="grid gap-1 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">Binding issues</p>
          {binding.verificationIssues.map((issue) => (
            <p className="text-[11px] font-semibold text-amber-800" key={issue}>
              {issue}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400">Template binding verified.</p>
      )}
    </div>
  );
}

function MarketplaceThemeBindingInspection({
  item
}: {
  item: Awaited<ReturnType<typeof getAdminMarketplaceControl>>["items"][number];
}) {
  if (!item.themeBinding) {
    return <p className="text-xs font-semibold text-slate-400">Not applicable</p>;
  }

  const binding = item.themeBinding;

  return (
    <div className="grid min-w-52 gap-2">
      <AdminBadge tone={binding.verified ? "green" : binding.bindingStatus === "bound" ? "amber" : "red"}>
        {binding.bindingStatus ?? "unknown"}
      </AdminBadge>
      <p className="text-xs font-semibold text-slate-600">
        Verified: {binding.verified ? "yes" : "no"}
      </p>
      {binding.themeName ? (
        <p className="text-xs font-semibold text-slate-600">Theme: {binding.themeName}</p>
      ) : null}
      {binding.themeKey ? (
        <p className="text-xs font-semibold text-slate-500">Key: {binding.themeKey}</p>
      ) : null}
      {binding.linkedThemeId ? (
        <p className="text-xs font-semibold text-slate-500">Preset ID: {binding.linkedThemeId}</p>
      ) : null}
      {binding.themeVersion ? (
        <p className="text-xs font-semibold text-slate-500">Bound version: {binding.themeVersion}</p>
      ) : null}
      {binding.themeStatus ? (
        <p className="text-xs font-semibold text-slate-500">Theme status: {binding.themeStatus}</p>
      ) : null}
      {binding.bindingUpdatedAt ? (
        <p className="text-xs font-semibold text-slate-500">
          Binding updated: {formatAdminDate(binding.bindingUpdatedAt)}
        </p>
      ) : null}
      {binding.verificationIssues.length ? (
        <div className="grid gap-1 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">Binding issues</p>
          {binding.verificationIssues.map((issue) => (
            <p className="text-[11px] font-semibold text-amber-800" key={issue}>
              {issue}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400">Theme binding verified.</p>
      )}
    </div>
  );
}

function MarketplacePluginBindingInspection({
  item
}: {
  item: Awaited<ReturnType<typeof getAdminMarketplaceControl>>["items"][number];
}) {
  if (!item.pluginBinding) {
    return <p className="text-xs font-semibold text-slate-400">Not applicable</p>;
  }

  const binding = item.pluginBinding;

  return (
    <div className="grid min-w-52 gap-2">
      <AdminBadge tone={binding.verified ? "green" : binding.bindingStatus === "active" ? "amber" : "red"}>
        {binding.bindingStatus ?? "unbound"}
      </AdminBadge>
      <p className="text-xs font-semibold text-slate-600">
        Verified: {binding.verified ? "yes" : "no"}
      </p>
      {binding.pluginName ? (
        <p className="text-xs font-semibold text-slate-600">Plugin: {binding.pluginName}</p>
      ) : null}
      {binding.pluginKey ? (
        <p className="text-xs font-semibold text-slate-500">Key: {binding.pluginKey}</p>
      ) : null}
      {binding.pluginVersion ? (
        <p className="text-xs font-semibold text-slate-500">Version: {binding.pluginVersion}</p>
      ) : null}
      <p className="text-xs font-semibold text-slate-500">Marketplace status: {binding.marketplaceStatus}</p>
      <p className="text-xs font-semibold text-slate-500">Visibility: {binding.marketplaceVisibility}</p>
      <p className="text-xs font-semibold text-slate-500">Pricing mode: {binding.pricingMode}</p>
      <p className="text-xs font-semibold text-slate-500">
        Public eligible: {binding.publicEligible ? "yes" : "no"}
      </p>
      {binding.pluginManifestSummary.length ? (
        <div className="grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Manifest summary</p>
          {binding.pluginManifestSummary.map((line) => (
            <p className="text-[11px] font-semibold text-slate-600" key={line}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {binding.verificationIssues.length ? (
        <div className="grid gap-1 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">Binding issues</p>
          {binding.verificationIssues.map((issue) => (
            <p className="text-[11px] font-semibold text-amber-800" key={issue}>
              {issue}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400">Plugin binding verified.</p>
      )}
    </div>
  );
}

function MarketplaceAppBindingInspection({
  item
}: {
  item: Awaited<ReturnType<typeof getAdminMarketplaceControl>>["items"][number];
}) {
  if (!item.appBinding) {
    return <p className="text-xs font-semibold text-slate-400">Not applicable</p>;
  }

  const binding = item.appBinding;

  return (
    <div className="grid min-w-52 gap-2">
      <AdminBadge tone={binding.verified ? "green" : binding.bindingStatus === "active" ? "amber" : "red"}>
        {binding.bindingStatus ?? "unbound"}
      </AdminBadge>
      <p className="text-xs font-semibold text-slate-600">
        Verified: {binding.verified ? "yes" : "no"}
      </p>
      {binding.appName ? (
        <p className="text-xs font-semibold text-slate-600">App: {binding.appName}</p>
      ) : null}
      {binding.appKey ? (
        <p className="text-xs font-semibold text-slate-500">Key: {binding.appKey}</p>
      ) : null}
      {binding.appVersion ? (
        <p className="text-xs font-semibold text-slate-500">Version: {binding.appVersion}</p>
      ) : null}
      <p className="text-xs font-semibold text-slate-500">Marketplace status: {binding.marketplaceStatus}</p>
      <p className="text-xs font-semibold text-slate-500">Visibility: {binding.marketplaceVisibility}</p>
      <p className="text-xs font-semibold text-slate-500">Pricing mode: {binding.pricingMode}</p>
      <p className="text-xs font-semibold text-slate-500">
        Public eligible: {binding.publicEligible ? "yes" : "no"}
      </p>
      {binding.appManifestSummary.length ? (
        <div className="grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Manifest summary</p>
          {binding.appManifestSummary.map((line) => (
            <p className="text-[11px] font-semibold text-slate-600" key={line}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {binding.verificationIssues.length ? (
        <div className="grid gap-1 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">Binding issues</p>
          {binding.verificationIssues.map((issue) => (
            <p className="text-[11px] font-semibold text-amber-800" key={issue}>
              {issue}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400">App binding verified.</p>
      )}
    </div>
  );
}

function MarketplaceServiceBindingInspection({
  item
}: {
  item: Awaited<ReturnType<typeof getAdminMarketplaceControl>>["items"][number];
}) {
  if (!item.serviceBinding) {
    return <p className="text-xs font-semibold text-slate-400">Not applicable</p>;
  }

  const binding = item.serviceBinding;

  return (
    <div className="grid min-w-52 gap-2">
      <AdminBadge tone={binding.verified ? "green" : binding.bindingStatus === "active" ? "amber" : "red"}>
        {binding.bindingStatus ?? "unbound"}
      </AdminBadge>
      <p className="text-xs font-semibold text-slate-600">
        Verified: {binding.verified ? "yes" : "no"}
      </p>
      {binding.serviceName ? (
        <p className="text-xs font-semibold text-slate-600">Service: {binding.serviceName}</p>
      ) : null}
      {binding.serviceKey ? (
        <p className="text-xs font-semibold text-slate-500">Key: {binding.serviceKey}</p>
      ) : null}
      {binding.serviceCategory ? (
        <p className="text-xs font-semibold text-slate-500">Category: {binding.serviceCategory}</p>
      ) : null}
      {binding.serviceDurationDays !== null && binding.serviceDurationDays > 0 ? (
        <p className="text-xs font-semibold text-slate-500">Duration: {binding.serviceDurationDays} days</p>
      ) : null}
      <p className="text-xs font-semibold text-slate-500">Marketplace status: {binding.marketplaceStatus}</p>
      <p className="text-xs font-semibold text-slate-500">Visibility: {binding.marketplaceVisibility}</p>
      <p className="text-xs font-semibold text-slate-500">Pricing mode: {binding.pricingMode}</p>
      <p className="text-xs font-semibold text-slate-500">
        Public eligible: {binding.publicEligible ? "yes" : "no"}
      </p>
      {binding.serviceRequirementsSummary.length ? (
        <div className="grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Requirements summary</p>
          {binding.serviceRequirementsSummary.map((line) => (
            <p className="text-[11px] font-semibold text-slate-600" key={line}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {binding.verificationIssues.length ? (
        <div className="grid gap-1 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">Binding issues</p>
          {binding.verificationIssues.map((issue) => (
            <p className="text-[11px] font-semibold text-amber-800" key={issue}>
              {issue}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400">Service binding verified.</p>
      )}
    </div>
  );
}

function MarketplaceCreatorAccountInspection({
  item
}: {
  item: Awaited<ReturnType<typeof getAdminMarketplaceControl>>["items"][number];
}) {
  const binding = item.creatorAccount;

  return (
    <div className="grid min-w-52 gap-2">
      <AdminBadge tone={binding.verified ? "green" : binding.creatorStatus === "active" ? "amber" : "red"}>
        {binding.creatorStatus ?? "unlinked"}
      </AdminBadge>
      <p className="text-xs font-semibold text-slate-600">
        Verified: {binding.verified ? "yes" : "no"}
      </p>
      {binding.displayName ? (
        <p className="text-xs font-semibold text-slate-600">Creator: {binding.displayName}</p>
      ) : null}
      {binding.publicSlug ? (
        <p className="text-xs font-semibold text-slate-500">Slug: {binding.publicSlug}</p>
      ) : null}
      {binding.creatorType ? (
        <p className="text-xs font-semibold text-slate-500">Type: {binding.creatorType}</p>
      ) : null}
      {binding.verificationStatus ? (
        <p className="text-xs font-semibold text-slate-500">Verification: {binding.verificationStatus}</p>
      ) : null}
      {binding.accountId ? (
        <p className="text-xs font-semibold text-slate-500">Account: {binding.accountId}</p>
      ) : null}
      {binding.linkedUserId ? (
        <p className="text-xs font-semibold text-slate-500">User: {shortenActorId(binding.linkedUserId)}</p>
      ) : null}
      <p className="text-xs font-semibold text-slate-500">
        Public eligible: {binding.publicEligible ? "yes" : "no"}
      </p>
      {binding.verificationIssues.length ? (
        <div className="grid gap-1 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">Creator issues</p>
          {binding.verificationIssues.map((issue) => (
            <p className="text-[11px] font-semibold text-amber-800" key={issue}>
              {issue}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400">Creator account verified.</p>
      )}
    </div>
  );
}

function MarketplaceApprovalMeta({
  item
}: {
  item: Awaited<ReturnType<typeof getAdminMarketplaceControl>>["items"][number];
}) {
  const { approval } = item;

  return (
    <div className="mt-2 grid gap-1 text-[11px] font-semibold text-slate-500">
      {approval.action ? <p>Last action: {approval.action}</p> : null}
      {approval.approvalUpdatedAt ? <p>Updated: {formatAdminDate(approval.approvalUpdatedAt)}</p> : null}
      {approval.reviewedAt ? <p>Reviewed: {formatAdminDate(approval.reviewedAt)}</p> : null}
      {approval.reviewedBy ? <p>Reviewer: {shortenActorId(approval.reviewedBy)}</p> : null}
      {approval.approvedAt ? <p>Approved: {formatAdminDate(approval.approvedAt)}</p> : null}
      {approval.approvedBy ? <p>Approver: {shortenActorId(approval.approvedBy)}</p> : null}
      {approval.rejectedAt ? <p>Rejected: {formatAdminDate(approval.rejectedAt)}</p> : null}
      {approval.rejectedBy ? <p>Rejector: {shortenActorId(approval.rejectedBy)}</p> : null}
      {approval.approvalNote ? <p>Note: {approval.approvalNote}</p> : null}
    </div>
  );
}

export default async function AdminMarketplacePage() {
  const control = await getAdminMarketplaceControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Prepare SHASTORE marketplace governance for templates, themes, plugins, apps, and services. This is a control layer only: no payments, no installs, no deletions, and no public marketplace exposure happen here."
        title="Marketplace Management Center"
      />

      <AdminStatGrid
        stats={[
          { label: "Marketplace items", value: control.overview.totalItems },
          { label: "Approved", value: control.overview.approvedItems },
          { label: "Pending review", value: control.overview.pendingReviewItems },
          { label: "Draft", value: control.overview.draftItems },
          { label: "Rejected", value: control.overview.rejectedItems },
          { label: "Archived", value: control.overview.archivedItems },
          { label: "Payments processed", value: formatAdminMoney(control.overview.paymentsProcessed) },
          { label: "Live installs", value: control.overview.liveInstalls }
        ]}
      />

      <AdminStatGrid
        stats={[
          { label: "Platform fees", value: formatAdminMoney(control.overview.totalPlatformFeesProcessed) },
          { label: "Creator revenue", value: formatAdminMoney(control.overview.totalCreatorRevenueProcessed) },
          { label: "Verified template bindings", value: control.overview.verifiedTemplateBindings },
          { label: "Verified theme bindings", value: control.overview.verifiedThemeBindings },
          { label: "Verified plugin bindings", value: control.overview.verifiedPluginBindings },
          { label: "Verified app bindings", value: control.overview.verifiedAppBindings },
          { label: "Verified service bindings", value: control.overview.verifiedServiceBindings },
          { label: "Creator accounts", value: control.overview.totalCreatorAccounts },
          { label: "Active creators", value: control.overview.activeCreatorAccounts },
          { label: "Verified creators", value: control.overview.verifiedCreatorAccounts }
        ]}
      />

      <section className="grid gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Marketplace foundation</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">Creator Accounts</h2>
        </div>
        <AdminTable
          empty={!control.creators.length ? "No creator accounts registered yet." : null}
          headers={[
            "Creator",
            "Public slug",
            "Type",
            "Status",
            "Verification",
            "Linked account",
            "Linked user",
            "Items",
            "Public eligible"
          ]}
        >
          {control.creators.map((creator) => (
            <tr key={creator.id}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{creator.displayName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{creator.id}</p>
              </td>
              <td className="px-5 py-4 text-slate-600">{creator.publicSlug}</td>
              <td className="px-5 py-4"><AdminBadge tone="blue">{creator.creatorType}</AdminBadge></td>
              <td className="px-5 py-4"><AdminBadge tone={toneForStatus(creator.creatorStatus)}>{creator.creatorStatus}</AdminBadge></td>
              <td className="px-5 py-4"><AdminBadge tone={toneForStatus(creator.verificationStatus)}>{creator.verificationStatus}</AdminBadge></td>
              <td className="px-5 py-4 text-slate-600">{creator.accountId ?? "—"}</td>
              <td className="px-5 py-4 text-slate-600">{creator.linkedUserId ? shortenActorId(creator.linkedUserId) : "—"}</td>
              <td className="px-5 py-4 text-slate-600">{creator.itemCount}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={creator.publicEligible ? "green" : "amber"}>
                  {creator.publicEligible ? "yes" : "no"}
                </AdminBadge>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <AdminTable headers={["Marketplace section", "Items", "Status"]}>
        {control.sections.map((section) => (
          <tr key={section.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{section.name}</td>
            <td className="px-5 py-4 text-slate-600">{section.itemCount}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(section.status)}>{section.status}</AdminBadge>
            </td>
          </tr>
        ))}
      </AdminTable>

      {control.sections.map((section) => {
        const items = control.items.filter(
          (item) => item.section === section.name && item.type === section.itemType
        );

        return (
          <section className="grid gap-4" key={section.name}>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Marketplace section</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">{section.name}</h2>
            </div>
            <AdminTable
              empty={!items.length ? "No marketplace items in this section." : null}
              headers={[
                "Item",
                "Type",
                "Creator/source",
                "Creator account",
                "Status",
                "Visibility",
                "Template binding",
                "Theme binding",
                "Plugin binding",
                "App binding",
                "Service binding",
                "Price",
                "Installs",
                "Revenue",
                "Last updated",
                "Approval workflow"
              ]}
            >
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-950">{item.name}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{item.id}</p>
                  </td>
                  <td className="px-5 py-4"><AdminBadge tone="blue">{item.type}</AdminBadge></td>
                  <td className="px-5 py-4 text-slate-600">{item.creator}</td>
                  <td className="px-5 py-4 text-slate-600">
                    <MarketplaceCreatorAccountInspection item={item} />
                  </td>
                  <td className="px-5 py-4"><AdminBadge tone={toneForStatus(item.status)}>{item.status}</AdminBadge></td>
                  <td className="px-5 py-4">
                    <div className="grid gap-2">
                      <AdminBadge tone={toneForStatus(item.visibility)}>{item.visibility}</AdminBadge>
                      <form action={updateMarketplaceItemVisibility} className="grid gap-2">
                        <MarketplaceHiddenFields item={item} />
                        <select
                          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                          defaultValue={item.visibility}
                          name="visibility"
                        >
                          <option value="private">private</option>
                          <option value="internal">internal</option>
                          <option value="public">public</option>
                        </select>
                        <button
                          className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                          type="submit"
                        >
                          Update visibility
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <MarketplaceTemplateBindingInspection item={item} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <MarketplaceThemeBindingInspection item={item} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <MarketplacePluginBindingInspection item={item} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <MarketplaceAppBindingInspection item={item} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <MarketplaceServiceBindingInspection item={item} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="grid gap-2">
                      <AdminBadge tone={item.pricing.mode === "free" ? "green" : "amber"}>
                        {item.pricing.mode}
                      </AdminBadge>
                      <p className="text-xs font-semibold text-slate-600">
                        {item.pricing.mode === "free"
                          ? "Free"
                          : `${formatAdminMoney(item.pricing.priceAmount)} ${item.pricing.currency ?? "USD"}${
                              item.pricing.billingInterval ? ` / ${item.pricing.billingInterval}` : ""
                            }`}
                      </p>
                      {item.pricing.trialDays ? (
                        <p className="text-xs font-semibold text-slate-500">Trial: {item.pricing.trialDays} days</p>
                      ) : null}
                      {item.pricing.pricingUpdatedAt ? (
                        <p className="text-xs font-semibold text-slate-500">
                          Pricing updated: {formatAdminDate(item.pricing.pricingUpdatedAt)}
                        </p>
                      ) : null}
                      <form action={updateMarketplaceItemPricing} className="grid gap-2">
                        <MarketplaceHiddenFields item={item} />
                        <select
                          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                          defaultValue={item.pricing.mode}
                          name="pricingMode"
                        >
                          <option value="free">free</option>
                          <option value="paid">paid</option>
                          <option value="subscription">subscription</option>
                        </select>
                        <input
                          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                          defaultValue={item.pricing.priceAmount}
                          min="0"
                          name="priceAmount"
                          step="0.01"
                          type="number"
                        />
                        <select
                          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                          defaultValue={item.pricing.currency ?? "USD"}
                          name="currency"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="MAD">MAD</option>
                        </select>
                        <select
                          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                          defaultValue={item.pricing.billingInterval ?? ""}
                          name="billingInterval"
                        >
                          <option value="">No interval</option>
                          <option value="monthly">monthly</option>
                          <option value="yearly">yearly</option>
                        </select>
                        <input
                          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                          defaultValue={item.pricing.trialDays}
                          min="0"
                          name="trialDays"
                          type="number"
                        />
                        <button
                          className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                          type="submit"
                        >
                          Update pricing
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <MarketplaceInstallInspection item={item} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <MarketplaceRevenueInspection item={item} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatAdminDate(item.lastUpdated)}</td>
                  <td className="px-5 py-4">
                    <div className="grid min-w-52 gap-2">
                      {item.approval.availableActions.includes("submit_for_review") ? (
                        <form action={markMarketplaceItemUnderReview}>
                          <MarketplaceHiddenFields item={item} />
                          <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                            Under review
                          </button>
                        </form>
                      ) : null}
                      {item.approval.availableActions.includes("approve") ? (
                        <form action={approveMarketplaceItem}>
                          <MarketplaceHiddenFields item={item} />
                          <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                            Approve
                          </button>
                        </form>
                      ) : null}
                      {item.approval.availableActions.includes("reject") ? (
                        <form action={rejectMarketplaceItem} className="grid gap-2">
                          <MarketplaceHiddenFields item={item} />
                          <input
                            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                            name="approvalNote"
                            placeholder="Rejection note (optional)"
                            type="text"
                          />
                          <button className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                            Reject
                          </button>
                        </form>
                      ) : null}
                      {item.approval.availableActions.includes("archive") ? (
                        <form action={archiveMarketplaceItem}>
                          <MarketplaceHiddenFields item={item} />
                          <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                            Archive
                          </button>
                        </form>
                      ) : null}
                      {item.approval.availableActions.includes("restore_to_draft") ? (
                        <form action={restoreMarketplaceItemDraft}>
                          <MarketplaceHiddenFields item={item} />
                          <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                            Restore draft
                          </button>
                        </form>
                      ) : null}
                      <MarketplaceApprovalMeta item={item} />
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
          </section>
        );
      })}

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
