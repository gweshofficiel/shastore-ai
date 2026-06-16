import {
  AdminBadge
} from "@/components/admin/admin-control";
import {
  publishResellerBrandingAction,
  saveResellerBrandingDraftAction,
  switchResellerInheritanceCustomAction,
  switchResellerInheritancePlatformAction
} from "@/lib/admin/reseller-actions";
import type { AdminReseller } from "@/lib/admin/data";

function sourceLabel(source: AdminReseller["branding"]["effectiveSource"]) {
  if (source === "platform") return "Platform published white label";
  if (source === "reseller_custom") return "Reseller custom published branding";
  return "Reseller defaults (custom not published)";
}

function previewLines(branding: AdminReseller["branding"]["customDraft"]) {
  return [
    ["Brand", branding.brandName || "Not set"],
    ["Legal", branding.legalName ?? "Not set"],
    ["Support email", branding.supportEmail ?? "Not set"],
    ["Support URL", branding.supportUrl ?? "Not set"],
    ["Documentation", branding.documentationUrl ?? "Not set"],
    ["Powered by", branding.showPoweredBy ? branding.poweredByLabel ?? "Enabled" : "Hidden"]
  ] as const;
}

export function ResellerBrandingPanel({ branding, resellerId }: { branding: AdminReseller["branding"]; resellerId: string }) {
  const platformLines = previewLines(branding.platformPreview);
  const customLines = previewLines(branding.customPreview);

  return (
    <section className="rounded-xl bg-white p-3" id={`branding-${resellerId}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Branding</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <AdminBadge tone={branding.inheritanceMode === "inherit_platform" ? "blue" : "amber"}>
          {branding.inheritanceMode === "inherit_platform" ? "inherit platform" : "custom branding"}
        </AdminBadge>
        <AdminBadge tone={branding.effectiveSource === "platform" ? "green" : branding.effectiveSource === "reseller_custom" ? "amber" : "slate"}>
          {sourceLabel(branding.effectiveSource)}
        </AdminBadge>
        <AdminBadge tone={branding.hasCustomDraftChanges ? "amber" : "slate"}>
          Draft: {branding.hasCustomDraftChanges ? "changed" : "synced"}
        </AdminBadge>
        <AdminBadge tone={branding.publishStatus === "published" ? "green" : "amber"}>
          Publish: {branding.publishStatus}
        </AdminBadge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Platform inherited preview</p>
          <dl className="mt-3 grid gap-2 text-sm text-slate-600">
            {platformLines.map(([label, value]) => (
              <div className="grid gap-1" key={`platform-${label}`}>
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</dt>
                <dd className="font-semibold text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Reseller custom preview</p>
          <dl className="mt-3 grid gap-2 text-sm text-slate-600">
            {customLines.map(([label, value]) => (
              <div className="grid gap-1" key={`custom-${label}`}>
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</dt>
                <dd className="font-semibold text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={switchResellerInheritancePlatformAction}>
          <input name="resellerId" type="hidden" value={resellerId} />
          <button
            className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700 disabled:opacity-50"
            disabled={branding.inheritanceMode === "inherit_platform"}
            type="submit"
          >
            Inherit platform
          </button>
        </form>
        <form action={switchResellerInheritanceCustomAction}>
          <input name="resellerId" type="hidden" value={resellerId} />
          <button
            className="h-9 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700 disabled:opacity-50"
            disabled={branding.inheritanceMode === "custom_branding"}
            type="submit"
          >
            Custom branding
          </button>
        </form>
      </div>

      <form action={saveResellerBrandingDraftAction} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2">
        <input name="resellerId" type="hidden" value={resellerId} />
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          <span>Brand name</span>
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            defaultValue={branding.customPreview.brandName}
            name="brandName"
            required
            type="text"
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          <span>Legal name</span>
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            defaultValue={branding.customPreview.legalName ?? ""}
            name="legalName"
            type="text"
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          <span>Support email</span>
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            defaultValue={branding.customPreview.supportEmail ?? ""}
            name="supportEmail"
            type="email"
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          <span>Support URL</span>
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            defaultValue={branding.customPreview.supportUrl ?? ""}
            name="supportUrl"
            type="url"
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700 lg:col-span-2">
          <span>Documentation URL</span>
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            defaultValue={branding.customPreview.documentationUrl ?? ""}
            name="documentationUrl"
            type="url"
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          <span>Powered by label</span>
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            defaultValue={branding.customPreview.poweredByLabel ?? ""}
            name="poweredByLabel"
            type="text"
          />
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
          <input defaultChecked={branding.customPreview.showPoweredBy} name="showPoweredBy" type="checkbox" value="true" />
          <span>Show powered by</span>
        </label>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <button
            className="h-9 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
            type="submit"
          >
            Save draft
          </button>
        </div>
      </form>

      <form action={publishResellerBrandingAction} className="mt-3">
        <input name="resellerId" type="hidden" value={resellerId} />
        <button
          className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 disabled:opacity-50"
          disabled={branding.inheritanceMode !== "custom_branding" || !branding.validationOk}
          type="submit"
        >
          Publish branding
        </button>
      </form>
    </section>
  );
}
