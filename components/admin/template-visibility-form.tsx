"use client";

type TemplateVisibilityFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  currentVisibility: "internal" | "marketplace" | "owner" | "reseller";
  registryId: string;
  templateName: string;
};

const internalConfirmMessage =
  "Internal templates will be hidden from owner/reseller/marketplace catalogs. Continue?";

const marketplaceConfirmMessage =
  "Marketplace visibility does not approve marketplace publication yet. Approval comes in a later phase.";

export function TemplateVisibilityForm({
  action,
  currentVisibility,
  registryId,
  templateName
}: TemplateVisibilityFormProps) {
  return (
    <form
      action={action}
      className="grid gap-2"
      onSubmit={(event) => {
        const form = event.currentTarget;
        const visibility = new FormData(form).get("visibility");

        if (visibility === "internal" && !window.confirm(internalConfirmMessage)) {
          event.preventDefault();
          return;
        }

        if (visibility === "marketplace" && !window.confirm(marketplaceConfirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input name="registryId" type="hidden" value={registryId} />
      <input name="templateName" type="hidden" value={templateName} />
      <select
        className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
        defaultValue={currentVisibility}
        name="visibility"
      >
        <option value="owner">Owner</option>
        <option value="reseller">Reseller</option>
        <option value="marketplace">Marketplace</option>
        <option value="internal">Internal</option>
      </select>
      <button
        className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
        type="submit"
      >
        Set visibility
      </button>
    </form>
  );
}
