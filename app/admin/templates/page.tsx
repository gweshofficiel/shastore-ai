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
  activateTemplate,
  archiveTemplate,
  installTemplateVersionPlaceholder,
  markTemplateDraft,
  markTemplateOfficial,
  markTemplateRecommended,
  previewTemplatePlaceholder,
  publishTemplateUpdatePlaceholder,
  setTemplateVisibility,
  updateStoresTemplatePlaceholder,
  viewTemplatePackageSummary
} from "@/lib/admin/template-management-actions";
import { TemplateActivationControls } from "@/components/admin/template-activation-controls";
import { TemplateVisibilityForm } from "@/components/admin/template-visibility-form";

function toneForStatus(status: string) {
  if (["active", "marketplace", "owner", "ready", "published"].includes(status)) {
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

function statusLabel(status: string) {
  if (status === "active") return "Active";
  if (status === "draft") return "Draft";
  if (status === "archived") return "Archived";
  return status;
}

function visibilityLabel(visibility: string) {
  if (visibility === "owner") return "Owner catalog";
  if (visibility === "reseller") return "Reseller catalog";
  if (visibility === "marketplace") return "Marketplace catalog";
  if (visibility === "internal") return "Hidden / internal";
  return visibility;
}

function TemplateHiddenFields({
  template,
  version
}: {
  template: Awaited<ReturnType<typeof getAdminTemplateManagementControl>>["templates"][number];
  version?: Awaited<ReturnType<typeof getAdminTemplateManagementControl>>["templates"][number]["versions"][number];
}) {
  return (
    <>
      <input name="templateId" type="hidden" value={template.id} />
      <input name="templateName" type="hidden" value={template.name} />
      {version ? <input name="versionId" type="hidden" value={version.id} /> : null}
      {version ? <input name="versionNumber" type="hidden" value={version.versionNumber} /> : null}
    </>
  );
}

export default async function AdminTemplatesPage() {
  const control = await getAdminTemplateManagementControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Global control layer over the template registry and version runtime. No packages are installed here, no stores are overwritten, and storefront rendering is unchanged."
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
          { label: "Marketplace visible", value: control.visibility.marketplaceVisible },
          { label: "Hidden/internal", value: control.visibility.hiddenInternal }
        ]}
      />

      <AdminStatGrid
        stats={[
          { label: "Versions", value: control.versionOverview.totalVersions },
          { label: "Published versions", value: control.versionOverview.publishedVersions },
          { label: "Draft versions", value: control.versionOverview.draftVersions },
          { label: "Archived versions", value: control.versionOverview.archivedVersions },
          { label: "Templates with published version", value: control.versionOverview.templatesWithPublishedVersion }
        ]}
      />

      <AdminTable
        empty={!control.templates.length ? "No templates found in the template registry." : null}
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
          <tr key={template.registryId}>
            <td className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-slate-950">{template.name}</p>
                <AdminBadge tone={toneForStatus(template.status)}>{statusLabel(template.status)}</AdminBadge>
                <AdminBadge tone={toneForStatus(template.visibility)}>{visibilityLabel(template.visibility)}</AdminBadge>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">{template.id}</p>
              <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                  Version details ({template.versions.length})
                </summary>
                <div className="mt-3 grid gap-3">
                  {template.versions.length ? (
                    template.versions.map((version) => (
                      <div className="rounded-2xl border border-slate-200 bg-white p-3" key={version.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-slate-950">v{version.versionNumber}</p>
                          <AdminBadge tone={toneForStatus(version.status)}>{version.status}</AdminBadge>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-600">
                          Changelog: {version.changelog || "No changelog recorded."}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Created: {formatAdminDate(version.createdAt)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Published: {formatAdminDate(version.publishedAt)}
                        </p>
                        <div className="mt-3 grid gap-2">
                          <form action={publishTemplateUpdatePlaceholder}>
                            <TemplateHiddenFields template={template} version={version} />
                            <button
                              className="h-8 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700"
                              type="submit"
                            >
                              Publish template update
                            </button>
                          </form>
                          <form action={installTemplateVersionPlaceholder}>
                            <TemplateHiddenFields template={template} version={version} />
                            <button
                              className="h-8 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700"
                              type="submit"
                            >
                              Install version
                            </button>
                          </form>
                          <form action={updateStoresTemplatePlaceholder}>
                            <TemplateHiddenFields template={template} version={version} />
                            <button
                              className="h-8 w-full rounded-full border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700"
                              type="submit"
                            >
                              Update stores
                            </button>
                          </form>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-semibold text-slate-500">No version records found for this template.</p>
                  )}
                </div>
              </details>
            </td>
            <td className="px-5 py-4 text-slate-600">
              <p>{template.category}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{template.industry}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(template.status)}>{statusLabel(template.status)}</AdminBadge>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{template.status}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(template.visibility)}>{visibilityLabel(template.visibility)}</AdminBadge>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{template.visibility}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">
              <p>
                Latest: {template.latestVersion?.versionNumber ?? template.packageVersion ?? "legacy"}
                {template.latestVersion ? (
                  <span className="ml-2">
                    <AdminBadge tone={toneForStatus(template.latestVersion.status)}>
                      {template.latestVersion.status}
                    </AdminBadge>
                  </span>
                ) : null}
              </p>
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
                <TemplateActivationControls
                  activateAction={activateTemplate}
                  archiveAction={archiveTemplate}
                  markDraftAction={markTemplateDraft}
                  registryId={template.registryId}
                  templateName={template.name}
                />
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
                <TemplateVisibilityForm
                  action={setTemplateVisibility}
                  currentVisibility={template.visibility}
                  registryId={template.registryId}
                  templateName={template.name}
                />
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
