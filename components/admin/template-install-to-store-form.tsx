"use client";

type TemplateInstallToStoreFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  registryId: string;
  stores: Array<{
    id: string;
    name: string;
    slug: string | null;
  }>;
  templateName: string;
};

const installConfirmMessage =
  "Install this template package into the selected store only? Existing store data will not be deleted. Conflicts are skipped safely. This is a Super Admin manual install with no bulk or marketplace execution.";

export function TemplateInstallToStoreForm({
  action,
  registryId,
  stores,
  templateName
}: TemplateInstallToStoreFormProps) {
  return (
    <details className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
      <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-violet-700">
        Install to store
      </summary>
      <form
        action={action}
        className="mt-3 grid gap-3"
        onSubmit={(event) => {
          const form = event.currentTarget;
          const storeId = new FormData(form).get("storeId");

          if (!storeId) {
            event.preventDefault();
            window.alert("Select a store before installing.");
            return;
          }

          if (!window.confirm(installConfirmMessage)) {
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
        <input name="registryId" type="hidden" value={registryId} />
        <input name="templateName" type="hidden" value={templateName} />
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
        <p className="text-[10px] font-semibold text-slate-500">
          Install requires active template, published version, ready package, and a valid store. Only the selected store
          is affected.
        </p>
        <button
          className="h-9 rounded-full border border-violet-300 bg-violet-700 px-4 text-xs font-black uppercase tracking-[0.14em] text-white"
          type="submit"
        >
          Install to store
        </button>
      </form>
    </details>
  );
}
