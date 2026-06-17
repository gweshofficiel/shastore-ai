"use client";

type TemplateUpdateRuntimeFormProps = {
  applyAction: (formData: FormData) => void | Promise<void>;
  checkAction: (formData: FormData) => void | Promise<void>;
  prepareAction: (formData: FormData) => void | Promise<void>;
  stores: Array<{
    id: string;
    name: string;
    slug: string | null;
  }>;
  updatableTargets: Array<{
    assignmentId: string;
    currentVersionId: string | null;
    currentVersionNumber: string | null;
    registryId: string;
    storeId: string;
    storeName: string;
    targetVersionId: string;
    targetVersionNumber: string;
    templateName: string;
  }>;
};

const prepareConfirmMessage =
  "Prepare a template update for this store? This records an update job only. Customer products, pages, custom themes, orders, payments, and domains are never deleted.";

const applyConfirmMessage =
  "Apply this prepared template update? Conflicts are skipped safely and recorded. No destructive overwrite of customer store data.";

export function TemplateUpdateRuntimeForm({
  applyAction,
  checkAction,
  prepareAction,
  stores,
  updatableTargets
}: TemplateUpdateRuntimeFormProps) {
  return (
    <div className="grid gap-4">
      <details className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-amber-800">
          Check for updates
        </summary>
        <form action={checkAction} className="mt-3 grid gap-3 md:grid-cols-2">
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
            Updatable target
            <select
              className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
              name="targetKey"
              required
            >
              <option value="">Select store + template + target version</option>
              {updatableTargets.map((target) => (
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
          <input name="registryId" type="hidden" value="" />
          <input name="toVersionId" type="hidden" value="" />
          <input name="templateName" type="hidden" value="" />
          <p className="md:col-span-2 text-[10px] font-semibold text-slate-500">
            Validation only. Requires active assignment, published target version newer than current, and passing
            isolation checks.
          </p>
          <button
            className="h-9 rounded-full border border-amber-300 bg-amber-100 px-4 text-xs font-black uppercase tracking-[0.14em] text-amber-800 md:col-span-2 md:justify-self-start"
            type="submit"
            onClick={(event) => {
              const form = event.currentTarget.form;

              if (!form) return;

              const targetKey = new FormData(form).get("targetKey");

              if (typeof targetKey !== "string" || !targetKey.includes("|")) {
                event.preventDefault();
                window.alert("Select an updatable target.");
                return;
              }

              const [storeId, registryId, toVersionId] = targetKey.split("|");
              const storeIdInput = form.querySelector('select[name="storeId"]');

              if (storeIdInput instanceof HTMLSelectElement && storeId) {
                storeIdInput.value = storeId;
              }

              const registryInput = form.querySelector('input[name="registryId"]');
              const versionInput = form.querySelector('input[name="toVersionId"]');
              const templateNameInput = form.querySelector('input[name="templateName"]');
              const target = updatableTargets.find(
                (entry) =>
                  entry.storeId === storeId &&
                  entry.registryId === registryId &&
                  entry.targetVersionId === toVersionId
              );

              if (registryInput instanceof HTMLInputElement) registryInput.value = registryId;
              if (versionInput instanceof HTMLInputElement) versionInput.value = toVersionId;
              if (templateNameInput instanceof HTMLInputElement) {
                templateNameInput.value = target?.templateName ?? "";
              }
            }}
          >
            Check for updates
          </button>
        </form>
      </details>

      <details className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-orange-800">
          Prepare update
        </summary>
        <form
          action={prepareAction}
          className="mt-3 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            const form = event.currentTarget;
            const targetKey = new FormData(form).get("targetKey");

            if (typeof targetKey !== "string" || !targetKey.includes("|")) {
              event.preventDefault();
              window.alert("Select an updatable target.");
              return;
            }

            const [storeId, registryId, toVersionId] = targetKey.split("|");
            const storeIdInput = form.querySelector('select[name="storeId"]');

            if (storeIdInput instanceof HTMLSelectElement && storeId) {
              storeIdInput.value = storeId;
            }

            const registryInput = form.querySelector('input[name="registryId"]');
            const versionInput = form.querySelector('input[name="toVersionId"]');
            const templateNameInput = form.querySelector('input[name="templateName"]');
            const target = updatableTargets.find(
              (entry) =>
                entry.storeId === storeId &&
                entry.registryId === registryId &&
                entry.targetVersionId === toVersionId
            );

            if (registryInput instanceof HTMLInputElement) registryInput.value = registryId;
            if (versionInput instanceof HTMLInputElement) versionInput.value = toVersionId;
            if (templateNameInput instanceof HTMLInputElement) {
              templateNameInput.value = target?.templateName ?? "";
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
            Updatable target
            <select
              className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
              name="targetKey"
              required
            >
              <option value="">Select store + template + target version</option>
              {updatableTargets.map((target) => (
                <option
                  key={`prepare-${target.storeId}:${target.registryId}:${target.targetVersionId}`}
                  value={`${target.storeId}|${target.registryId}|${target.targetVersionId}`}
                >
                  {target.storeName} · {target.templateName} · v{target.currentVersionNumber ?? "?"} → v
                  {target.targetVersionNumber}
                </option>
              ))}
            </select>
          </label>
          <input name="registryId" type="hidden" value="" />
          <input name="toVersionId" type="hidden" value="" />
          <input name="templateName" type="hidden" value="" />
          <button
            className="h-9 rounded-full border border-orange-300 bg-orange-700 px-4 text-xs font-black uppercase tracking-[0.14em] text-white md:col-span-2 md:justify-self-start"
            type="submit"
          >
            Prepare update
          </button>
        </form>
      </details>

      <details className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-emerald-800">
          Apply prepared update
        </summary>
        <form
          action={applyAction}
          className="mt-3 grid gap-3"
          onSubmit={(event) => {
            const form = event.currentTarget;
            const jobId = new FormData(form).get("updateJobId");

            if (!jobId) {
              event.preventDefault();
              window.alert("Select a prepared update job.");
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
            Prepared job id
            <input
              className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
              name="updateJobId"
              placeholder="Paste prepared update job id"
              required
            />
          </label>
          <button
            className="h-9 rounded-full border border-emerald-300 bg-emerald-700 px-4 text-xs font-black uppercase tracking-[0.14em] text-white"
            type="submit"
          >
            Apply update
          </button>
        </form>
      </details>
    </div>
  );
}
