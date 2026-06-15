import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable
} from "@/components/admin/admin-control";
import { getAdminPlatformThemeControl } from "@/lib/admin/data";
import {
  discardPlatformBrandingDraft,
  previewPlatformBranding,
  previewPlatformLogoAction,
  publishPlatformBrandingPlaceholder,
  removeDraftPlatformLogoAction,
  resetPlatformBrandingPlaceholder,
  savePlatformBrandingDraft,
  uploadPlatformLogoAction
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

function formatBytes(value: number | null) {
  if (!value) return "Not recorded";

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export default async function AdminPlatformThemePage({
  searchParams
}: {
  searchParams?: Promise<{
    logoMessage?: string;
    logoStatus?: string;
    publishMessage?: string;
    publishStatus?: string;
  }>;
}) {
  const params = await searchParams;
  const control = await getAdminPlatformThemeControl();
  const readySections = control.sections.filter((section) => section.status === "ready").length;
  const readyPublicPreviews = control.previews.publicWebsite.filter((preview) => preview.status === "ready").length;
  const readyAdminPreviews = control.previews.adminDashboard.filter((preview) => preview.status === "ready").length;
  const publishStatus = params?.publishStatus === "success" ? "success" : params?.publishStatus === "error" ? "error" : null;
  const publishMessage = params?.publishMessage;
  const logoStatus = params?.logoStatus === "success" ? "success" : params?.logoStatus === "error" ? "error" : null;
  const logoMessage = params?.logoMessage;

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
          { label: "Draft changes", value: control.draft.changedCount },
          { label: "Validation errors", value: control.draft.validationErrors.length },
          { label: "Public previews", value: `${readyPublicPreviews}/${control.previews.publicWebsite.length}` },
          { label: "Admin previews", value: `${readyAdminPreviews}/${control.previews.adminDashboard.length}` },
          { label: "RTL languages", value: control.readiness.filter((item) => item.direction === "RTL").length },
          { label: "Store themes touched", value: 0 }
        ]}
      />

      {publishStatus && publishMessage ? (
        <div
          className={`rounded-3xl border p-5 text-sm font-bold leading-6 ${
            publishStatus === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={publishStatus === "success" ? "status" : "alert"}
        >
          {publishMessage}
        </div>
      ) : null}

      {logoStatus && logoMessage ? (
        <div
          className={`rounded-3xl border p-5 text-sm font-bold leading-6 ${
            logoStatus === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={logoStatus === "success" ? "status" : "alert"}
        >
          {logoMessage}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
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
        <form action={discardPlatformBrandingDraft}>
          <button className="h-11 w-full rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
            Discard draft
          </button>
        </form>
        <form action={publishPlatformBrandingPlaceholder}>
          <button className="h-11 w-full rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
            Publish branding
          </button>
        </form>
      </div>

      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5" id="platform-logo">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Platform Logo</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Logo upload runtime</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Uploading or removing a logo updates the platform branding draft only. It does not auto-publish, does not change public website rendering, and does not touch storefront logos.
            </p>
          </div>
          <AdminBadge tone={control.logo.previewUrl ? "green" : "blue"}>
            {control.logo.previewUrl ? "Draft logo configured" : "Placeholder logo"}
          </AdminBadge>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-4">
            <form action={uploadPlatformLogoAction} className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                <span>Upload or replace logo</span>
                <input
                  accept="image/png,image/svg+xml,image/webp"
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"
                  name="platformLogo"
                  required
                  type="file"
                />
              </label>
              <p className="text-xs font-semibold leading-5 text-slate-500">
                Allowed formats: PNG, SVG, WEBP. Maximum size: 5 MB. SVG files with scripts, event handlers, JavaScript URLs, or embedded foreign objects are rejected.
              </p>
              <button className="h-11 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                {control.logo.previewUrl ? "Replace logo" : "Upload logo"}
              </button>
            </form>

            <div className="grid gap-3 sm:grid-cols-2">
              <form action={removeDraftPlatformLogoAction}>
                <button className="h-11 w-full rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                  Remove draft logo
                </button>
              </form>
              <form action={previewPlatformLogoAction}>
                <button className="h-11 w-full rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                  Preview logo
                </button>
              </form>
            </div>

            <AdminTable headers={["Metadata", "Value"]}>
              {[
                ["File name", control.logo.fileName ?? "Placeholder"],
                ["MIME type", control.logo.mimeType ?? "Not recorded"],
                ["Size", formatBytes(control.logo.size)],
                ["Uploaded", control.logo.uploadedAt ?? "Not uploaded"],
                ["Storage bucket", control.logo.storageBucket ?? "Existing platform asset bucket"],
                ["Storage key", control.logo.storageKey ?? "Not stored"]
              ].map(([label, value]) => (
                <tr key={`logo-metadata-${label}`}>
                  <td className="px-5 py-4 font-bold text-slate-950">{label}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-600">{value}</td>
                </tr>
              ))}
            </AdminTable>
          </div>

          <div className="grid place-items-center rounded-3xl border border-slate-200 bg-slate-50 p-5">
            {control.logo.previewUrl ? (
              <object
                aria-label="Platform logo preview"
                className="max-h-40 w-full rounded-2xl bg-white p-4"
                data={control.logo.previewUrl}
                type={control.logo.mimeType ?? "image/png"}
              >
                <span className="text-sm font-semibold text-slate-500">Logo preview unavailable.</span>
              </object>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-lg font-black text-slate-950">SHASTORE AI</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">Placeholder logo</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <AdminBadge tone={control.publishReadiness.canPublish ? "green" : "amber"}>
            {control.publishReadiness.canPublish ? "Ready to publish" : "Publish needs attention"}
          </AdminBadge>
          <AdminBadge tone={control.publishReadiness.hasChanges ? "amber" : "blue"}>
            {control.publishReadiness.hasChanges ? "Draft changes available" : "No draft changes to publish"}
          </AdminBadge>
        </div>
        <p className="text-sm leading-6 text-slate-500">
          Publishing copies draft values into published values only. Public website, admin dashboard styling, storefronts, and customer stores are still not connected to these values.
        </p>
        {control.publishReadiness.invalidSettings.length ? (
          <div className="grid gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {control.publishReadiness.invalidSettings.map((item) => (
              <p key={`publish-invalid-${item.settingKey}`}>{item.settingKey}: {item.message}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <AdminBadge tone={control.draft.hasChanges ? "amber" : "green"}>
            {control.draft.hasChanges ? "Draft changed" : "No draft changes"}
          </AdminBadge>
          <AdminBadge tone={control.draft.validationErrors.length ? "red" : "green"}>
            {control.draft.validationErrors.length ? "Validation errors" : "Validation clear"}
          </AdminBadge>
          <span className="text-sm font-semibold text-slate-500">
            Last saved: {control.draft.lastSavedAt ?? "Not saved yet"}
          </span>
        </div>
        {control.draft.validationErrors.length ? (
          <div className="grid gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {control.draft.validationErrors.map((error) => (
              <p key={`${error.settingKey}-${error.message}`}>{error.settingKey}: {error.message}</p>
            ))}
          </div>
        ) : null}
        <p className="text-sm leading-6 text-slate-500">
          Preview Branding uses these draft values inside this Super Admin screen only. Public website, admin dashboard theme, storefronts, and customer stores are not changed.
        </p>
      </section>

      <form action={savePlatformBrandingDraft} id="platform-brand-settings-form">
        <AdminTable headers={["Branding section", "Draft value", "Published value", "Registry status", "Validation", "Description"]}>
          {control.sections.map((section) => (
            <tr key={section.label}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{section.label}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{section.settingType}</p>
                {section.draftChanged ? (
                  <div className="mt-2">
                    <AdminBadge tone="amber">changed</AdminBadge>
                  </div>
                ) : null}
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
              <td className="px-5 py-4 text-sm font-semibold text-slate-600">{section.publishedValue}</td>
              <td className="px-5 py-4"><AdminBadge tone={toneForStatus(section.status)}>{section.status}</AdminBadge></td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(section.validationStatus)}>{section.validationStatus}</AdminBadge>
                {section.validationMessage ? (
                  <p className="mt-2 text-xs font-semibold leading-5 text-red-600">{section.validationMessage}</p>
                ) : null}
              </td>
              <td className="px-5 py-4 text-slate-600">
                <p>{section.description}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Saved: {section.lastSavedAt ?? "not saved"}</p>
              </td>
            </tr>
          ))}
        </AdminTable>
      </form>

      <AdminTable headers={["Setting", "Draft", "Published", "Changed"]}>
        {control.draft.comparisons.map((item) => (
          <tr key={`compare-${item.settingKey}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.settingKey}</td>
            <td className="px-5 py-4 text-sm font-semibold text-slate-600">{item.draftDisplayValue}</td>
            <td className="px-5 py-4 text-sm font-semibold text-slate-600">{item.publishedDisplayValue}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={item.hasChanged ? "amber" : "green"}>{item.hasChanged ? "changed" : "same"}</AdminBadge>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Publish readiness", "Status", "Message"]}>
        {control.publishReadiness.checklist.map((item) => (
          <tr key={`publish-readiness-${item.key}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={item.ready ? "green" : "red"}>{item.ready ? "ready" : "blocked"}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-sm leading-6 text-slate-600">{item.message}</td>
          </tr>
        ))}
      </AdminTable>

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
