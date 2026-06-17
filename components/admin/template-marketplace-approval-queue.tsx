"use client";

import { AdminTable } from "@/components/admin/admin-control";

type TemplateMarketplaceApprovalQueueProps = {
  approveAction: (formData: FormData) => void | Promise<void>;
  queue: Array<{
    approvalStatus: string;
    id: string;
    lastReviewNote: string | null;
    listingDescription: string | null;
    listingStatus: string;
    listingTitle: string;
    pricingType: string;
    readinessLabel: string;
    rejectionReason: string | null;
    templateId: string;
    templateName: string | null;
    updatedAt: string | null;
    versionNumber: string | null;
  }>;
  rejectAction: (formData: FormData) => void | Promise<void>;
  requestChangesAction: (formData: FormData) => void | Promise<void>;
};

const approveConfirmMessage =
  "Approve this marketplace listing? Approval updates approval_status only. It does not auto-publish, install the template, or enable payments.";

const rejectConfirmMessage =
  "Reject this marketplace listing? A safe rejection reason is required and stored for Super Admin review only.";

const changesConfirmMessage =
  "Request changes for this marketplace listing? A safe review note is required and stored for Super Admin review only.";

export function TemplateMarketplaceApprovalQueue({
  approveAction,
  queue,
  rejectAction,
  requestChangesAction
}: TemplateMarketplaceApprovalQueueProps) {
  return (
    <AdminTable
      empty={!queue.length ? "No marketplace listings are pending review." : null}
      headers={[
        "Listing",
        "Template",
        "Status",
        "Approval",
        "Pricing",
        "Readiness",
        "Last updated",
        "Actions"
      ]}
    >
      {queue.map((listing) => (
        <tr key={listing.id}>
          <td className="px-5 py-4">
            <p className="font-bold text-slate-950">{listing.listingTitle}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{listing.id}</p>
          </td>
          <td className="px-5 py-4">
            <p className="font-semibold text-slate-700">{listing.templateName ?? "Template"}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{listing.templateId}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">v{listing.versionNumber ?? "—"}</p>
          </td>
          <td className="px-5 py-4 text-sm font-semibold text-slate-600">{listing.listingStatus}</td>
          <td className="px-5 py-4 text-sm font-semibold text-slate-600">{listing.approvalStatus}</td>
          <td className="px-5 py-4 text-sm font-semibold text-slate-600">{listing.pricingType}</td>
          <td className="px-5 py-4 text-sm font-semibold text-slate-600">{listing.readinessLabel}</td>
          <td className="px-5 py-4 text-sm font-semibold text-slate-600">{listing.updatedAt ?? "—"}</td>
          <td className="px-5 py-4">
            <div className="grid min-w-56 gap-2">
              <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-700">
                  View listing
                </summary>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600">
                  <p>{listing.listingDescription ?? "No description provided."}</p>
                  {listing.lastReviewNote ? <p>Last review note: {listing.lastReviewNote}</p> : null}
                  {listing.rejectionReason ? <p>Rejection reason: {listing.rejectionReason}</p> : null}
                </div>
              </details>

              <form
                action={approveAction}
                onSubmit={(event) => {
                  if (!window.confirm(approveConfirmMessage)) {
                    event.preventDefault();
                    return;
                  }

                  const confirmedInput = event.currentTarget.querySelector('input[name="confirmed"]');
                  if (confirmedInput instanceof HTMLInputElement) confirmedInput.value = "1";
                }}
              >
                <input name="confirmed" type="hidden" value="" />
                <input name="listingId" type="hidden" value={listing.id} />
                <input name="listingTitle" type="hidden" value={listing.listingTitle} />
                <input name="templateName" type="hidden" value={listing.templateName ?? ""} />
                <button
                  className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
                  type="submit"
                >
                  Approve
                </button>
              </form>

              <form
                action={rejectAction}
                onSubmit={(event) => {
                  const form = event.currentTarget;
                  const reason = new FormData(form).get("reason");

                  if (typeof reason !== "string" || !reason.trim()) {
                    event.preventDefault();
                    window.alert("A safe rejection reason is required.");
                    return;
                  }

                  if (!window.confirm(rejectConfirmMessage)) {
                    event.preventDefault();
                    return;
                  }

                  const confirmedInput = form.querySelector('input[name="confirmed"]');
                  if (confirmedInput instanceof HTMLInputElement) confirmedInput.value = "1";
                }}
              >
                <input name="confirmed" type="hidden" value="" />
                <input name="listingId" type="hidden" value={listing.id} />
                <input name="listingTitle" type="hidden" value={listing.listingTitle} />
                <textarea
                  className="mb-2 min-h-16 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  maxLength={2000}
                  name="reason"
                  placeholder="Safe rejection reason (Super Admin only)"
                  required
                />
                <button
                  className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700"
                  type="submit"
                >
                  Reject
                </button>
              </form>

              <form
                action={requestChangesAction}
                onSubmit={(event) => {
                  const form = event.currentTarget;
                  const reason = new FormData(form).get("reason");

                  if (typeof reason !== "string" || !reason.trim()) {
                    event.preventDefault();
                    window.alert("A safe review note is required.");
                    return;
                  }

                  if (!window.confirm(changesConfirmMessage)) {
                    event.preventDefault();
                    return;
                  }

                  const confirmedInput = form.querySelector('input[name="confirmed"]');
                  if (confirmedInput instanceof HTMLInputElement) confirmedInput.value = "1";
                }}
              >
                <input name="confirmed" type="hidden" value="" />
                <input name="listingId" type="hidden" value={listing.id} />
                <input name="listingTitle" type="hidden" value={listing.listingTitle} />
                <textarea
                  className="mb-2 min-h-16 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  maxLength={2000}
                  name="reason"
                  placeholder="Safe review note (Super Admin only)"
                  required
                />
                <button
                  className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
                  type="submit"
                >
                  Request changes
                </button>
              </form>
            </div>
          </td>
        </tr>
      ))}
    </AdminTable>
  );
}
