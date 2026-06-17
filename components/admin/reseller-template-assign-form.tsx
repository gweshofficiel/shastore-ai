"use client";

type ResellerTemplateAssignFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  assignableTemplates: Array<{
    publishedVersionNumber: string | null;
    registryId: string;
    templateName: string;
    visibility: string;
  }>;
  resellers: Array<{
    displayName: string;
    id: string;
    slug: string | null;
  }>;
};

const assignConfirmMessage =
  "Assign this template to the reseller catalog? This grants catalog access only. No automatic install or store mutation occurs.";

export function ResellerTemplateAssignForm({
  action,
  assignableTemplates,
  resellers
}: ResellerTemplateAssignFormProps) {
  return (
    <details className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
      <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-cyan-800">
        Assign template to reseller
      </summary>
      <form
        action={action}
        className="mt-3 grid gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          if (!window.confirm(assignConfirmMessage)) {
            event.preventDefault();
            return;
          }

          const confirmedInput = event.currentTarget.querySelector('input[name="confirmed"]');
          if (confirmedInput instanceof HTMLInputElement) confirmedInput.value = "1";
        }}
      >
        <input name="confirmed" type="hidden" value="" />
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Reseller
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
            name="resellerId"
            required
          >
            <option value="">Select reseller</option>
            {resellers.map((reseller) => (
              <option key={reseller.id} value={reseller.id}>
                {reseller.displayName} {reseller.slug ? `· ${reseller.slug}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Template
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
            name="templateId"
            required
          >
            <option value="">Select eligible template</option>
            {assignableTemplates.map((template) => (
              <option key={template.registryId} value={template.registryId}>
                {template.templateName} · v{template.publishedVersionNumber ?? "—"} · {template.visibility}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Access type
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
            defaultValue="assigned"
            name="accessType"
          >
            <option value="assigned">Assigned</option>
            <option value="inherited">Inherited</option>
            <option value="marketplace">Marketplace</option>
          </select>
        </label>
        <button
          className="h-10 rounded-full border border-cyan-300 bg-cyan-100 px-4 text-xs font-black uppercase tracking-[0.14em] text-cyan-800 md:col-span-2"
          type="submit"
        >
          Assign to reseller catalog
        </button>
      </form>
    </details>
  );
}
