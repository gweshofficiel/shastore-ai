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
          { label: "Payments processed", value: formatAdminMoney(0) },
          { label: "Live installs", value: 0 }
        ]}
      />

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
                "Status",
                "Visibility",
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
                  <td className="px-5 py-4"><AdminBadge tone={item.priceType === "free" ? "green" : "amber"}>{item.priceType}</AdminBadge></td>
                  <td className="px-5 py-4 text-slate-600">{item.installs} placeholder</td>
                  <td className="px-5 py-4 text-slate-600">{formatAdminMoney(item.revenue)} placeholder</td>
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
