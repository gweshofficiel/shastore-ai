"use client";

type TemplateAssignToStoreFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  activeAssignmentStoreIds: string[];
  stores: Array<{
    id: string;
    name: string;
    slug: string | null;
  }>;
  templates: Array<{
    name: string;
    publishedVersionId: string;
    publishedVersionNumber: string;
    registryId: string;
  }>;
};

const assignConfirmMessage =
  "Assign this template to the selected store? This records assignment metadata only. Existing store content is not deleted or overwritten. If the store already has an active assignment, the previous assignment will be marked inactive.";

const replaceConfirmMessage =
  "This store already has an active template assignment. Replace it with the selected template? The previous assignment will be marked inactive. No store pages, products, or themes will be changed.";

export function TemplateAssignToStoreForm({ action, activeAssignmentStoreIds, stores, templates }: TemplateAssignToStoreFormProps) {
  return (
    <details className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
      <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-sky-700">
        Assign to store
      </summary>
      <form
        action={action}
        className="mt-3 grid gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          const form = event.currentTarget;
          const formData = new FormData(form);
          const storeId = formData.get("storeId");
          const templateId = formData.get("registryId");

          if (!storeId || !templateId) {
            event.preventDefault();
            window.alert("Select a store and template before assigning.");
            return;
          }

          const replaceInput = form.querySelector('input[name="replaceConfirmed"]');
          const needsReplace =
            typeof storeId === "string" && activeAssignmentStoreIds.includes(storeId);

          if (needsReplace) {
            if (!window.confirm(replaceConfirmMessage)) {
              event.preventDefault();
              return;
            }

            if (replaceInput instanceof HTMLInputElement) {
              replaceInput.value = "1";
            }
          } else if (!window.confirm(assignConfirmMessage)) {
            event.preventDefault();
            return;
          }

          const confirmedInput = form.querySelector('input[name="confirmed"]');

          if (confirmedInput instanceof HTMLInputElement) {
            confirmedInput.value = "1";
          }
        }}
      >
        <input name="confirmed" type="hidden" value="0" />
        <input name="replaceConfirmed" type="hidden" value="0" />
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Target store
          <select
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
            name="storeId"
            required
          >
            <option value="">Select a store</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
                {store.slug ? ` (${store.slug})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Template
          <select
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
            name="registryId"
            required
          >
            <option value="">Select a template</option>
            {templates.map((template) => (
              <option key={template.registryId} value={template.registryId}>
                {template.name} (v{template.publishedVersionNumber})
              </option>
            ))}
          </select>
        </label>
        <p className="md:col-span-2 text-[10px] font-semibold text-slate-500">
          Assignment requires an active template with a published version. Metadata only — no storefront rendering or
          store content changes in this phase.
        </p>
        <button
          className="h-9 rounded-full border border-sky-300 bg-sky-700 px-4 text-xs font-black uppercase tracking-[0.14em] text-white md:col-span-2 md:justify-self-start"
          type="submit"
        >
          Assign to store
        </button>
      </form>
    </details>
  );
}
