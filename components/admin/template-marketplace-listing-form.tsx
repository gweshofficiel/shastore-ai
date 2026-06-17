"use client";

type TemplateMarketplaceListingFormProps = {
  createAction: (formData: FormData) => void | Promise<void>;
  eligibleTemplates: Array<{
    packageReadiness: string;
    publishedVersionNumber: string | null;
    registryId: string;
    templateName: string;
    visibility: string;
    warnings: string[];
  }>;
  listings: Array<{
    approvalStatus: string;
    featured: boolean;
    id: string;
    listingDescription: string | null;
    listingStatus: string;
    listingTitle: string;
    pricingType: string;
    priceAmount: number | null;
    currency: string | null;
    templateId: string;
    templateName: string;
  }>;
  updateAction: (formData: FormData) => void | Promise<void>;
};

const createConfirmMessage =
  "Create a draft marketplace listing for this template? This does not install the template, charge payments, or expose a public purchase flow.";

export function TemplateMarketplaceListingForm({
  createAction,
  eligibleTemplates,
  listings,
  updateAction
}: TemplateMarketplaceListingFormProps) {
  return (
    <div className="grid gap-4">
      <details className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-violet-800">
          Create listing
        </summary>
        <form
          action={createAction}
          className="mt-3 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            if (!window.confirm(createConfirmMessage)) {
              event.preventDefault();
              return;
            }

            const confirmedInput = event.currentTarget.querySelector('input[name="confirmed"]');
            if (confirmedInput instanceof HTMLInputElement) confirmedInput.value = "1";
          }}
        >
          <input name="confirmed" type="hidden" value="" />
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Template
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              name="templateId"
              required
            >
              <option value="">Select eligible template</option>
              {eligibleTemplates.map((template) => (
                <option key={template.registryId} value={template.registryId}>
                  {template.templateName} · v{template.publishedVersionNumber ?? "—"} ·{" "}
                  {template.packageReadiness}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Listing title
            <input
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              name="listingTitle"
              placeholder="Defaults to template name"
              type="text"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 md:col-span-2">
            Description
            <textarea
              className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              name="listingDescription"
              placeholder="Optional marketplace description"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Pricing type
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              defaultValue="free"
              name="pricingType"
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
              <option value="included">Included</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Price amount
            <input
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              min="0"
              name="priceAmount"
              placeholder="Required for paid listings"
              step="0.01"
              type="number"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Currency
            <input
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              defaultValue="USD"
              maxLength={12}
              name="currency"
              placeholder="USD"
              type="text"
            />
          </label>
          <button
            className="h-10 rounded-full border border-violet-300 bg-violet-100 px-4 text-xs font-black uppercase tracking-[0.14em] text-violet-800 md:col-span-2"
            type="submit"
          >
            Create draft listing
          </button>
        </form>
      </details>

      <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-700">
          Edit listing
        </summary>
        <form action={updateAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 md:col-span-2">
            Listing
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              name="listingId"
              required
            >
              <option value="">Select listing</option>
              {listings
                .filter((listing) => listing.listingStatus !== "archived")
                .map((listing) => (
                  <option key={listing.id} value={listing.id}>
                    {listing.listingTitle} · {listing.templateName} · {listing.listingStatus}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Listing title
            <input
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              name="listingTitle"
              type="text"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Approval status
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              name="approvalStatus"
            >
              <option value="">Keep current</option>
              <option value="pending_review">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="changes_requested">Changes requested</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 md:col-span-2">
            Description
            <textarea
              className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              name="listingDescription"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Pricing type
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              name="pricingType"
            >
              <option value="">Keep current</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
              <option value="included">Included</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Price amount
            <input
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              min="0"
              name="priceAmount"
              step="0.01"
              type="number"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Currency
            <input
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              maxLength={12}
              name="currency"
              type="text"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Featured
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              name="featured"
            >
              <option value="">Keep current</option>
              <option value="1">Featured</option>
              <option value="0">Not featured</option>
            </select>
          </label>
          <button
            className="h-10 rounded-full border border-slate-300 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700 md:col-span-2"
            type="submit"
          >
            Save listing changes
          </button>
        </form>
      </details>
    </div>
  );
}
