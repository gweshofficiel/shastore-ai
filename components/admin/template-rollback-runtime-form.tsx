"use client";

type TemplateRollbackRuntimeFormProps = {
  applyAction: (formData: FormData) => void | Promise<void>;
  prepareAction: (formData: FormData) => void | Promise<void>;
  rollbackableTargets: Array<{
    assignmentId: string;
    currentVersionId: string | null;
    currentVersionNumber: string | null;
    registryId: string;
    storeId: string;
    storeName: string;
    targetVersionId: string;
    targetVersionNumber: string;
    templateName: string;
    updateJobId: string | null;
  }>;
  stores: Array<{
    id: string;
    name: string;
    slug: string | null;
  }>;
};

const prepareConfirmMessage =
  "Prepare a template rollback for this store? Customer products, orders, pages, custom themes, payments, and domains are never deleted. Conflicts are skipped safely.";

const applyConfirmMessage =
  "Apply this prepared template rollback? Assignment version will be restored where supported. No destructive overwrite of customer store data.";

export function TemplateRollbackRuntimeForm({
  applyAction,
  prepareAction,
  rollbackableTargets,
  stores
}: TemplateRollbackRuntimeFormProps) {
  const applyTargetFields = (
    form: HTMLFormElement,
    targetKey: string | FormDataEntryValue | null
  ) => {
    if (typeof targetKey !== "string" || !targetKey.includes("|")) {
      return false;
    }

    const [storeId, registryId, toVersionId] = targetKey.split("|");
    const storeIdInput = form.querySelector('select[name="storeId"]');

    if (storeIdInput instanceof HTMLSelectElement && storeId) {
      storeIdInput.value = storeId;
    }

    const target = rollbackableTargets.find(
      (entry) =>
        entry.storeId === storeId &&
        entry.registryId === registryId &&
        entry.targetVersionId === toVersionId
    );

    const registryInput = form.querySelector('input[name="registryId"]');
    const versionInput = form.querySelector('input[name="toVersionId"]');
    const templateNameInput = form.querySelector('input[name="templateName"]');
    const updateJobInput = form.querySelector('input[name="updateJobId"]');

    if (registryInput instanceof HTMLInputElement) registryInput.value = registryId;
    if (versionInput instanceof HTMLInputElement) versionInput.value = toVersionId;
    if (templateNameInput instanceof HTMLInputElement) {
      templateNameInput.value = target?.templateName ?? "";
    }
    if (updateJobInput instanceof HTMLInputElement) {
      updateJobInput.value = target?.updateJobId ?? "";
    }

    return true;
  };

  return (
    <div className="grid gap-4">
      <details className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-rose-800">
          Prepare rollback
        </summary>
        <form
          action={prepareAction}
          className="mt-3 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            const form = event.currentTarget;
            const targetKey = new FormData(form).get("targetKey");

            if (!applyTargetFields(form, targetKey)) {
              event.preventDefault();
              window.alert("Select a rollback target.");
              return;
            }

            if (!window.confirm(prepareConfirmMessage)) {
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
          <input name="registryId" type="hidden" value="" />
          <input name="toVersionId" type="hidden" value="" />
          <input name="templateName" type="hidden" value="" />
          <input name="updateJobId" type="hidden" value="" />
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Store
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
            Rollback target
            <select
              className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
              name="targetKey"
              required
            >
              <option value="">Select store + template + rollback version</option>
              {rollbackableTargets.map((target) => (
                <option
                  key={`${target.storeId}:${target.registryId}:${target.targetVersionId}`}
                  value={`${target.storeId}|${target.registryId}|${target.targetVersionId}`}
                >
                  {target.storeName} · {target.templateName} · v{target.currentVersionNumber ?? "?"} → v
                  {target.targetVersionNumber}
                </option>
              ))}
            </select>
          </label>
          <p className="md:col-span-2 text-[10px] font-semibold text-slate-500">
            Requires active assignment, safe published rollback version, and passing isolation checks.
          </p>
          <button
            className="h-9 rounded-full border border-rose-300 bg-rose-700 px-4 text-xs font-black uppercase tracking-[0.14em] text-white md:col-span-2 md:justify-self-start"
            type="submit"
          >
            Prepare rollback
          </button>
        </form>
      </details>

      <details className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-fuchsia-800">
          Apply prepared rollback
        </summary>
        <form
          action={applyAction}
          className="mt-3 grid gap-3"
          onSubmit={(event) => {
            const form = event.currentTarget;
            const jobId = new FormData(form).get("rollbackJobId");

            if (!jobId) {
              event.preventDefault();
              window.alert("Select a prepared rollback job.");
              return;
            }

            if (!window.confirm(applyConfirmMessage)) {
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
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Prepared rollback job id
            <input
              className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
              name="rollbackJobId"
              placeholder="Paste prepared rollback job id"
              required
            />
          </label>
          <button
            className="h-9 rounded-full border border-fuchsia-300 bg-fuchsia-700 px-4 text-xs font-black uppercase tracking-[0.14em] text-white"
            type="submit"
          >
            Apply rollback
          </button>
        </form>
      </details>
    </div>
  );
}
