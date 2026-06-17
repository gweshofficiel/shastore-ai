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
  publishTemplateUpdatePlaceholder,
  recommendTemplate,
  restoreArchivedTemplateToDraft,
  saveTemplatePackageMetadata,
  setTemplateVisibility,
  unmarkTemplateOfficial,
  unrecommendTemplate,
  updateStoresTemplatePlaceholder,
  updateTemplateRecommendationOrder
} from "@/lib/admin/template-management-actions";
import { TemplatePackageEditForm } from "@/components/admin/template-package-edit-form";
import { TemplatePackageSummaryLink } from "@/components/admin/template-package-summary-link";
import { TemplateActivationControls } from "@/components/admin/template-activation-controls";
import { TemplateOfficialControls } from "@/components/admin/template-official-controls";
import { TemplateRecommendationControls } from "@/components/admin/template-recommendation-controls";
import { TemplateRecommendationOrderForm } from "@/components/admin/template-recommendation-order-form";
import { TemplateRestoreControl } from "@/components/admin/template-restore-control";
import { TemplateVisibilityForm } from "@/components/admin/template-visibility-form";

function toneForStatus(status: string) {
  if (["active", "marketplace", "owner", "ready", "published"].includes(status)) {
    return "green" as const;
  }

  if (["archived", "internal", "invalid"].includes(status)) {
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

function triStateLabel(value: boolean | "unknown") {
  if (value === true) return "ready";
  if (value === false) return "not ready";
  return "unknown";
}

function readinessLabel(status: string) {
  if (status === "ready") return "Ready";
  if (status === "needs_attention") return "Needs attention";
  if (status === "invalid") return "Invalid";
  return "Draft";
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
          { label: "Recommended", value: control.overview.recommendedTemplates },
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

      <AdminStatGrid
        stats={[
          { label: "Packages", value: control.packageOverview.totalPackages },
          { label: "Ready packages", value: control.packageOverview.readyPackages },
          { label: "Draft packages", value: control.packageOverview.draftPackages },
          { label: "Needs attention", value: control.packageOverview.needsAttentionPackages },
          { label: "Invalid packages", value: control.packageOverview.invalidPackages }
        ]}
      />

      <AdminHeader
        description="Package metadata runtime only. Contents are tracked as counts and readiness flags — no packages are installed into stores and storefront rendering is unchanged."
        title="Package Runtime"
      />

      <AdminTable
        empty={!control.packages.length ? "No template packages found in the registry runtime." : null}
        headers={[
          "Package",
          "Readiness",
          "Products",
          "Categories",
          "Pages",
          "Blog",
          "FAQ",
          "AI support",
          "Domain",
          "Checkout",
          "Navigation",
          "Theme",
          "Issues"
        ]}
      >
        {control.packages.map((pkg) => (
          <tr key={pkg.packageId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{pkg.packageName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{pkg.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{pkg.packageKey}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(pkg.readinessStatus)}>{readinessLabel(pkg.readinessStatus)}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{pkg.contents.products_count}</td>
            <td className="px-5 py-4 text-slate-600">{pkg.contents.categories_count}</td>
            <td className="px-5 py-4 text-slate-600">{pkg.contents.pages_count}</td>
            <td className="px-5 py-4 text-slate-600">{pkg.contents.blog_posts_count}</td>
            <td className="px-5 py-4 text-slate-600">{pkg.contents.faq_count}</td>
            <td className="px-5 py-4 text-slate-600">{pkg.contents.ai_support_enabled ? "yes" : "no"}</td>
            <td className="px-5 py-4 text-slate-600">{pkg.contents.domain_ready ? "ready" : "not ready"}</td>
            <td className="px-5 py-4 text-slate-600">{triStateLabel(pkg.contents.checkout_ready)}</td>
            <td className="px-5 py-4 text-slate-600">{triStateLabel(pkg.contents.navigation_ready)}</td>
            <td className="px-5 py-4 text-slate-600">{triStateLabel(pkg.contents.theme_ready)}</td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-600">
              {pkg.validationIssues.length ? pkg.validationIssues.join(" · ") : "—"}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.templates.length ? "No active or draft templates found in the template registry." : null}
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
                {template.badges.official ? <AdminBadge tone="green">Official</AdminBadge> : null}
                {template.badges.recommended ? <AdminBadge tone="amber">Recommended</AdminBadge> : null}
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
                {template.packageRuntime ? (
                  <>
                    <p>Package: {template.packageRuntime.packageName}</p>
                    <p>
                      Readiness:{" "}
                      <AdminBadge tone={toneForStatus(template.packageRuntime.readinessStatus)}>
                        {readinessLabel(template.packageRuntime.readinessStatus)}
                      </AdminBadge>
                    </p>
                    <p>Products: {template.packageRuntime.contents.products_count}</p>
                    <p>Categories: {template.packageRuntime.contents.categories_count}</p>
                    <p>Pages: {template.packageRuntime.contents.pages_count}</p>
                    <p>Blog: {template.packageRuntime.contents.blog_posts_count}</p>
                    <p>FAQ: {template.packageRuntime.contents.faq_count}</p>
                    <p>AI support: {template.packageRuntime.contents.ai_support_enabled ? "yes" : "no"}</p>
                    <p>Domain: {template.packageRuntime.contents.domain_ready ? "ready" : "not ready"}</p>
                    <p>Checkout: {triStateLabel(template.packageRuntime.contents.checkout_ready)}</p>
                    <p>Navigation: {triStateLabel(template.packageRuntime.contents.navigation_ready)}</p>
                    <p>Theme: {triStateLabel(template.packageRuntime.contents.theme_ready)}</p>
                  </>
                ) : (
                  <>
                    <p>Products: {template.packageSummary.productsCount}</p>
                    <p>Categories: {template.packageSummary.categoriesCount}</p>
                    <p>Pages: {template.packageSummary.pagesCount}</p>
                    <p>Blog: {template.packageSummary.blogCount}</p>
                    <p>FAQ: {template.packageSummary.faqCount}</p>
                    <p>AI visual support: {template.packageSummary.aiVisualSupport ? "yes" : "placeholder"}</p>
                    <p>Domain/email readiness: {template.domainEmailReadiness}</p>
                  </>
                )}
              </div>
              {template.packageRuntime ? (
                <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3" id={`package-runtime-${template.registryId}`}>
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                    Package runtime details
                  </summary>
                  {template.packageRuntime.validationIssues.length ? (
                    <p className="mt-2 text-xs font-semibold text-amber-700">
                      Validation: {template.packageRuntime.validationIssues.join(" · ")}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">Validation: no blocking issues.</p>
                  )}
                  <TemplatePackageEditForm
                    action={saveTemplatePackageMetadata}
                    contents={template.packageRuntime.contents}
                    packageName={template.packageRuntime.packageName}
                    registryId={template.registryId}
                    templateName={template.name}
                  />
                </details>
              ) : null}
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
                <TemplateOfficialControls
                  isOfficial={template.badges.official}
                  markOfficialAction={markTemplateOfficial}
                  registryId={template.registryId}
                  templateName={template.name}
                  unmarkOfficialAction={unmarkTemplateOfficial}
                />
                <TemplateRecommendationControls
                  isRecommended={template.badges.recommended}
                  recommendAction={recommendTemplate}
                  registryId={template.registryId}
                  templateName={template.name}
                  unrecommendAction={unrecommendTemplate}
                  visibility={template.visibility}
                />
                {template.badges.recommended ? (
                  <TemplateRecommendationOrderForm
                    action={updateTemplateRecommendationOrder}
                    currentOrder={template.recommendationOrder}
                    registryId={template.registryId}
                    templateName={template.name}
                  />
                ) : null}
                <TemplateVisibilityForm
                  action={setTemplateVisibility}
                  currentVisibility={template.visibility}
                  registryId={template.registryId}
                  templateName={template.name}
                />
                <Link
                  className="flex h-9 w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
                  href={template.previewHref}
                >
                  Preview
                </Link>
                {template.packageRuntime ? (
                  <TemplatePackageSummaryLink targetId={`package-runtime-${template.registryId}`}>
                    Package summary
                  </TemplatePackageSummaryLink>
                ) : (
                  <button
                    className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                    disabled
                    type="button"
                  >
                    Package summary
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminHeader
        description="Recommended templates are sorted for catalog highlighting only. They are not installed into stores and do not change storefront rendering."
        title="Recommended Templates"
      />

      <AdminTable
        empty={!control.recommendedTemplates.length ? "No recommended templates in the registry." : null}
        headers={["Template", "Category", "Visibility", "Latest version", "Order", "Actions"]}
      >
        {control.recommendedTemplates.map((template) => (
          <tr key={template.registryId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{template.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{template.templateKey}</p>
              <AdminBadge tone="amber">Recommended</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{template.category}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(template.visibility)}>{visibilityLabel(template.visibility)}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{template.latestVersion ?? "—"}</td>
            <td className="px-5 py-4 text-slate-600">{template.recommendationOrder ?? "—"}</td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <TemplateRecommendationOrderForm
                  action={updateTemplateRecommendationOrder}
                  currentOrder={template.recommendationOrder}
                  registryId={template.registryId}
                  templateName={template.name}
                />
                <TemplateRecommendationControls
                  isRecommended
                  recommendAction={recommendTemplate}
                  registryId={template.registryId}
                  templateName={template.name}
                  unrecommendAction={unrecommendTemplate}
                  visibility={template.visibility}
                />
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminHeader
        description="Archived templates remain available for Super Admin audit and history. They are hidden from owner, reseller, and marketplace selection lists and do not change existing stores."
        title="Archived Templates"
      />

      <AdminTable
        empty={!control.archivedTemplates.length ? "No archived templates in the registry." : null}
        headers={["Template", "Category", "Previous visibility", "Latest version", "Archived at", "Actions"]}
      >
        {control.archivedTemplates.map((template) => (
          <tr key={template.registryId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{template.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{template.templateKey}</p>
              <AdminBadge tone="red">Archived</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{template.category}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(template.previousVisibility)}>
                {visibilityLabel(template.previousVisibility)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{template.latestVersion ?? "—"}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(template.archivedAt)}</td>
            <td className="px-5 py-4">
              <TemplateRestoreControl
                action={restoreArchivedTemplateToDraft}
                registryId={template.registryId}
                templateName={template.name}
              />
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
