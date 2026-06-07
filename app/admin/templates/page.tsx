import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminTemplateManagementControl } from "@/lib/admin/data";
import {
  activateTemplatePlaceholder,
  archiveTemplatePlaceholder,
  markTemplateOfficial,
  markTemplateRecommended,
  previewTemplatePlaceholder,
  setTemplateVisibility,
  viewTemplatePackageSummary
} from "@/lib/admin/template-management-actions";

function toneForStatus(status: string) {
  if (["active", "marketplace", "owner", "ready"].includes(status)) {
    return "green" as const;
  }

  if (["archived", "internal"].includes(status)) {
    return "red" as const;
  }

  if (status === "reseller") {
    return "blue" as const;
  }

  return "amber" as const;
}

function TemplateHiddenFields({
  template
}: {
  template: Awaited<ReturnType<typeof getAdminTemplateManagementControl>>["templates"][number];
}) {
  return (
    <>
      <input name="templateId" type="hidden" value={template.id} />
      <input name="templateName" type="hidden" value={template.name} />
    </>
  );
}

export default async function AdminTemplatesPage() {
  const control = await getAdminTemplateManagementControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Global control layer over the existing Store Owner template library and Template Package Installer. No packages are installed here, no stores are overwritten, and no duplicate template registry is created."
        title="Template Management Center"
      />

      <AdminStatGrid
        stats={[
          { label: "Templates", value: control.overview.totalTemplates },
          { label: "Active", value: control.overview.activeTemplates },
          { label: "Draft", value: control.overview.draftTemplates },
          { label: "Archived", value: control.overview.archivedTemplates },
          { label: "Official", value: control.overview.officialTemplates },
          { label: "Owner visible", value: control.visibility.ownerVisible },
          { label: "Reseller visible", value: control.visibility.resellerVisible },
          { label: "Hidden/internal", value: control.visibility.hiddenInternal }
        ]}
      />

      <AdminTable
        empty={!control.templates.length ? "No templates found in the existing template library." : null}
        headers={[
          "Template",
          "Category / Industry",
          "Status",
          "Visibility",
          "Version",
          "Badges",
          "Created / Updated",
          "Package summary",
          "Controls"
        ]}
      >
        {control.templates.map((template) => (
          <tr key={template.id}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{template.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{template.id}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">
              <p>{template.category}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{template.industry}</p>
            </td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(template.status)}>{template.status}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(template.visibility)}>{template.visibility}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">
              <p>Latest: {template.packageVersion ?? "legacy"}</p>
              <p className="mt-1 text-xs font-semibold">Installed versions: {template.installedVersionCount}</p>
              <p className="mt-1 text-xs font-semibold">Update: {template.updateAvailable}</p>
            </td>
            <td className="px-5 py-4">
              <div className="flex min-w-56 flex-wrap gap-2">
                <AdminBadge tone={template.badges.official ? "green" : "slate"}>
                  {template.badges.official ? "official" : "not official"}
                </AdminBadge>
                <AdminBadge tone={template.badges.premium ? "blue" : "slate"}>
                  {template.badges.premium ? "premium/package" : "free/basic"}
                </AdminBadge>
                <AdminBadge tone={template.badges.recommended ? "amber" : "slate"}>
                  {template.badges.recommended ? "recommended" : "standard"}
                </AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">
              <p>Created: {formatAdminDate(template.createdAt)}</p>
              <p className="mt-1">Updated: {formatAdminDate(template.lastUpdated)}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">
              <div className="grid min-w-56 gap-1 text-xs font-semibold">
                <p>Products: {template.packageSummary.productsCount}</p>
                <p>Categories: {template.packageSummary.categoriesCount}</p>
                <p>Pages: {template.packageSummary.pagesCount}</p>
                <p>Blog: {template.packageSummary.blogCount}</p>
                <p>FAQ: {template.packageSummary.faqCount}</p>
                <p>AI visual support: {template.packageSummary.aiVisualSupport ? "yes" : "placeholder"}</p>
                <p>Domain/email readiness: {template.domainEmailReadiness}</p>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-56 gap-2">
                <form action={activateTemplatePlaceholder}>
                  <TemplateHiddenFields template={template} />
                  <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                    Activate
                  </button>
                </form>
                <form action={archiveTemplatePlaceholder}>
                  <TemplateHiddenFields template={template} />
                  <button className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                    Archive
                  </button>
                </form>
                <form action={markTemplateOfficial}>
                  <TemplateHiddenFields template={template} />
                  <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                    Mark official
                  </button>
                </form>
                <form action={markTemplateRecommended}>
                  <TemplateHiddenFields template={template} />
                  <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                    Recommend
                  </button>
                </form>
                <form action={setTemplateVisibility} className="grid gap-2">
                  <TemplateHiddenFields template={template} />
                  <select
                    className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
                    defaultValue={template.visibility}
                    name="visibility"
                  >
                    <option value="owner">Owner</option>
                    <option value="reseller">Reseller</option>
                    <option value="marketplace">Marketplace</option>
                    <option value="internal">Internal</option>
                  </select>
                  <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                    Set visibility
                  </button>
                </form>
                <form action={previewTemplatePlaceholder}>
                  <TemplateHiddenFields template={template} />
                  <Link
                    className="flex h-9 w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                    href={template.previewHref}
                    target="_blank"
                  >
                    Preview
                  </Link>
                </form>
                <form action={viewTemplatePackageSummary}>
                  <TemplateHiddenFields template={template} />
                  <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                    Package summary
                  </button>
                </form>
              </div>
            </td>
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
