import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable
} from "@/components/admin/admin-control";
import { getAdminPlatformThemeControl } from "@/lib/admin/data";
import {
  previewPlatformBranding,
  publishPlatformBrandingPlaceholder,
  resetPlatformBrandingPlaceholder,
  savePlatformBrandingDraft
} from "@/lib/admin/platform-theme-actions";

function toneForStatus(status: string) {
  if (status === "ready") {
    return "green" as const;
  }

  if (status === "disabled" || status === "invalid" || status === "needs_attention") {
    return "red" as const;
  }

  if (status === "draft") {
    return "amber" as const;
  }

  return "blue" as const;
}

export default async function AdminPlatformThemePage() {
  const control = await getAdminPlatformThemeControl();
  const readySections = control.sections.filter((section) => section.status === "ready").length;
  const readyPublicPreviews = control.previews.publicWebsite.filter((preview) => preview.status === "ready").length;
  const readyAdminPreviews = control.previews.adminDashboard.filter((preview) => preview.status === "ready").length;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform-level SHASTORE branding for the SaaS interface and public website only. This does not touch Store Owner Theme Customize, store themes, storefront runtime, or template rendering."
        title="Platform Theme & Branding"
      />

      <AdminStatGrid
        stats={[
          { label: "Brand sections", value: control.sections.length },
          { label: "Ready sections", value: readySections },
          { label: "Public previews", value: `${readyPublicPreviews}/${control.previews.publicWebsite.length}` },
          { label: "Admin previews", value: `${readyAdminPreviews}/${control.previews.adminDashboard.length}` },
          { label: "RTL languages", value: control.readiness.filter((item) => item.direction === "RTL").length },
          { label: "Store themes touched", value: 0 }
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <button
          className="h-11 w-full rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-amber-700"
          form="platform-brand-settings-form"
          type="submit"
        >
          Save draft
        </button>
        <form action={previewPlatformBranding}>
          <button className="h-11 w-full rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
            Preview branding
          </button>
        </form>
        <form action={resetPlatformBrandingPlaceholder}>
          <button className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
            Reset placeholder
          </button>
        </form>
        <form action={publishPlatformBrandingPlaceholder}>
          <button className="h-11 w-full rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
            Publish placeholder
          </button>
        </form>
      </div>

      <form action={savePlatformBrandingDraft} id="platform-brand-settings-form">
        <AdminTable headers={["Branding section", "Draft value", "Registry status", "Validation", "Description"]}>
          {control.sections.map((section) => (
            <tr key={section.label}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{section.label}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{section.settingType}</p>
              </td>
              <td className="px-5 py-4">
                <div className="flex min-w-72 items-center gap-3">
                  {section.value.startsWith("#") ? (
                    <span
                      className="h-8 w-8 rounded-full border border-slate-200"
                      style={{ backgroundColor: section.value }}
                    />
                  ) : null}
                  <input
                    className="h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                    name={`setting_${section.settingKey}`}
                    type="text"
                    defaultValue={section.value}
                  />
                </div>
              </td>
              <td className="px-5 py-4"><AdminBadge tone={toneForStatus(section.status)}>{section.status}</AdminBadge></td>
              <td className="px-5 py-4"><AdminBadge tone={toneForStatus(section.validationStatus)}>{section.validationStatus}</AdminBadge></td>
              <td className="px-5 py-4 text-slate-600">{section.description}</td>
            </tr>
          ))}
        </AdminTable>
      </form>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Public website preview</p>
          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <p className="font-black tracking-[-0.03em]" style={{ color: control.branding.primaryColor }}>
                {control.branding.logo}
              </p>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                <span>Pricing</span>
                <span>Login</span>
                <span className="rounded-full px-3 py-2 text-white" style={{ backgroundColor: control.branding.primaryColor }}>
                  Start free
                </span>
              </div>
            </div>
            <div className="bg-slate-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: control.branding.secondaryColor }}>
                SHASTORE platform
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
                Launch stores with one platform brand.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Hero and button previews are platform-only placeholders for future page editor hooks.
              </p>
              <button
                className="mt-5 rounded-full px-5 py-3 text-sm font-black text-white"
                style={{ backgroundColor: control.branding.accentColor }}
                type="button"
              >
                Button preview
              </button>
            </div>
            <div className="bg-slate-950 px-5 py-4 text-sm font-semibold text-white">
              Footer preview placeholder
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {control.previews.publicWebsite.map((preview) => (
              <AdminBadge key={preview.label} tone={toneForStatus(preview.status)}>
                {preview.label}
              </AdminBadge>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Admin dashboard preview</p>
          <div className="mt-4 grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[180px_1fr]">
            <div className="rounded-2xl p-4 text-white" style={{ backgroundColor: control.branding.primaryColor }}>
              <p className="font-black">{control.branding.logo}</p>
              <div className="mt-5 grid gap-2 text-xs font-bold opacity-90">
                <span>Overview</span>
                <span>Platform Theme</span>
                <span>Settings</span>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-black text-slate-950">Card preview</p>
                <p className="mt-2 text-sm text-slate-500">Admin surfaces keep existing layout while platform branding remains isolated.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <AdminBadge tone="green">Badge preview</AdminBadge>
                <button
                  className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white"
                  style={{ backgroundColor: control.branding.secondaryColor }}
                  type="button"
                >
                  Button preview
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {control.previews.adminDashboard.map((preview) => (
              <AdminBadge key={preview.label} tone={toneForStatus(preview.status)}>
                {preview.label}
              </AdminBadge>
            ))}
          </div>
        </section>
      </div>

      <AdminTable headers={["Language", "Direction", "Readiness"]}>
        {control.readiness.map((item) => (
          <tr key={item.language}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.language}</td>
            <td className="px-5 py-4 text-slate-600">{item.direction}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(item.status)}>{item.status}</AdminBadge></td>
          </tr>
        ))}
      </AdminTable>

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
