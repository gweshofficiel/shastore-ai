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
  approveMarketplaceListingAction,
  archiveTemplate,
  archiveMarketplaceListingAction,
  archiveTemplateAssetAction,
  archiveTemplateScreenshotAction,
  assignResellerTemplateAction,
  assignTemplateToStoreAction,
  applyTemplateRollbackAction,
  applyTemplateUpdateAction,
  checkTemplateUpdateAction,
  createMarketplaceListingAction,
  deleteDraftTemplateAssetAction,
  installTemplateToStoreAction,
  installTemplateVersionPlaceholder,
  markMarketplaceListingFeaturedAction,
  markTemplateAssignmentActiveAction,
  markTemplateDraft,
  markTemplateOfficial,
  prepareTemplateRollbackAction,
  prepareTemplateUpdateAction,
  publishMarketplaceListingAction,
  publishTemplateAssetAction,
  publishTemplateScreenshotAction,
  publishTemplateUpdateAction,
  recommendTemplate,
  revokeResellerTemplateAction,
  rejectMarketplaceListingAction,
  reorderTemplateScreenshotAction,
  requestMarketplaceChangesAction,
  restoreArchivedTemplateToDraft,
  suspendResellerTemplateAction,
  saveTemplatePackageMetadata,
  setTemplateVisibility,
  unmarkTemplateOfficial,
  unrecommendTemplate,
  unassignTemplateFromStoreAction,
  updateMarketplaceListingAction,
  unpublishTemplateVersionAction,
  updateStoresTemplatePlaceholder,
  updateTemplateRecommendationOrder,
  uploadTemplateAssetAction,
  uploadTemplateScreenshotAction
} from "@/lib/admin/template-management-actions";
import { ResellerTemplateAssignForm } from "@/components/admin/reseller-template-assign-form";
import { ResellerTemplateRowActions } from "@/components/admin/reseller-template-row-actions";
import { TemplateUnpublishVersionAction } from "@/components/admin/template-unpublish-version-action";
import { TemplatePublishVersionAction } from "@/components/admin/template-publish-version-action";
import { TemplateMarketplaceApprovalQueue } from "@/components/admin/template-marketplace-approval-queue";
import { TemplateMarketplaceCatalogPreview } from "@/components/admin/template-marketplace-catalog-preview";
import { TemplateMarketplaceListingForm } from "@/components/admin/template-marketplace-listing-form";
import { TemplateMarketplaceListingRowActions } from "@/components/admin/template-marketplace-listing-row-actions";
import { TemplateRollbackApplyRowAction } from "@/components/admin/template-rollback-apply-row-action";
import { TemplateRollbackRuntimeForm } from "@/components/admin/template-rollback-runtime-form";
import { TemplateUpdateApplyRowAction } from "@/components/admin/template-update-apply-row-action";
import { TemplateUpdateRuntimeForm } from "@/components/admin/template-update-runtime-form";
import { TemplateAssignToStoreForm } from "@/components/admin/template-assign-to-store-form";
import { TemplateAssignmentRowActions } from "@/components/admin/template-assignment-row-actions";
import { TemplateAssetList } from "@/components/admin/template-asset-list";
import { TemplateAssetUploadForm } from "@/components/admin/template-asset-upload-form";
import { TemplateInstallToStoreForm } from "@/components/admin/template-install-to-store-form";
import { TemplatePackageEditForm } from "@/components/admin/template-package-edit-form";
import { TemplatePackageSummaryLink } from "@/components/admin/template-package-summary-link";
import { TemplateScreenshotList } from "@/components/admin/template-screenshot-list";
import { TemplateScreenshotUploadForm } from "@/components/admin/template-screenshot-upload-form";
import { TemplateActivationControls } from "@/components/admin/template-activation-controls";
import { TemplateOfficialControls } from "@/components/admin/template-official-controls";
import { TemplateRecommendationControls } from "@/components/admin/template-recommendation-controls";
import { TemplateRecommendationOrderForm } from "@/components/admin/template-recommendation-order-form";
import { TemplateRestoreControl } from "@/components/admin/template-restore-control";
import { TemplateAnalyticsPanel } from "@/components/admin/template-analytics-panel";
import { TemplateCertificationPanel } from "@/components/admin/template-certification-panel";
import { TemplateVisibilityForm } from "@/components/admin/template-visibility-form";
import {
  getTemplateAnalyticsDashboard,
  parseTemplateAnalyticsRange
} from "@/src/lib/templates/template-analytics";
import { runTemplateCertification } from "@/src/lib/templates/template-certification";

function toneForStatus(status: string) {
  if (["active", "approved", "completed", "marketplace", "owner", "ready", "published", "safe"].includes(status)) {
    return "green" as const;
  }

  if (["archived", "cancelled", "failed", "internal", "invalid", "unassigned"].includes(status)) {
    return "red" as const;
  }

  if (["inactive", "assigned"].includes(status)) {
    return "amber" as const;
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

function screenshotStatusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  if (status === "deleted") return "Deleted";
  return "Draft";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assetTypeLabel(type: string) {
  if (type === "screenshot") return "Screenshot";
  if (type === "preview_image") return "Preview image";
  if (type === "icon") return "Icon";
  if (type === "demo_media") return "Demo media";
  if (type === "package_file") return "Package file";
  if (type === "documentation") return "Documentation";
  return type;
}

function installStatusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "installing") return "Installing";
  if (status === "cancelled") return "Cancelled";
  return "Prepared";
}

function assignmentStatusLabel(status: string) {
  if (status === "assigned") return "Assigned";
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  if (status === "unassigned") return "Unassigned";
  if (status === "failed") return "Failed";
  return status;
}

function assignmentSourceLabel(source: string) {
  if (source === "super_admin_manual") return "Super Admin manual";
  if (source === "template_install") return "Template install";
  if (source === "store_creation") return "Store creation";
  if (source === "migration") return "Migration";
  return source;
}

function isolationStatusLabel(status: string) {
  if (status === "safe") return "Safe";
  if (status === "warning") return "Warning";
  if (status === "failed") return "Failed";
  return status;
}

function updateStatusLabel(status: string) {
  if (status === "prepared") return "Prepared";
  if (status === "updating") return "Updating";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function rollbackStatusLabel(status: string) {
  if (status === "prepared") return "Prepared";
  if (status === "rolling_back") return "Rolling back";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function listingStatusLabel(status: string) {
  if (status === "draft") return "Draft";
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return status;
}

function approvalStatusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "changes_requested") return "Changes requested";
  return "Pending review";
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

export default async function AdminTemplatesPage({
  searchParams
}: {
  searchParams: Promise<{ analyticsRange?: string }>;
}) {
  const query = await searchParams;
  const analyticsRange = parseTemplateAnalyticsRange(query.analyticsRange);
  const [control, templateAnalytics, templateCertification] = await Promise.all([
    getAdminTemplateManagementControl(),
    getTemplateAnalyticsDashboard(analyticsRange),
    runTemplateCertification()
  ]);

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

      <TemplateAnalyticsPanel analytics={templateAnalytics} currentRange={analyticsRange} />

      <TemplateCertificationPanel certification={templateCertification} />

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

      <AdminStatGrid
        stats={[
          { label: "Screenshots", value: control.screenshotOverview.totalScreenshots },
          { label: "Published screenshots", value: control.screenshotOverview.publishedScreenshots },
          { label: "Draft screenshots", value: control.screenshotOverview.draftScreenshots },
          { label: "Archived screenshots", value: control.screenshotOverview.archivedScreenshots }
        ]}
      />

      <AdminHeader
        description="Upload, publish, archive, and reorder template screenshots for Super Admin preview only. Storage keys stay private; only safe public preview URLs are shown."
        title="Screenshot Management"
      />

      <AdminTable
        empty={!control.screenshots.length ? "No template screenshots uploaded yet." : null}
        headers={["Template", "Type", "Status", "Order", "Preview", "Filename"]}
      >
        {control.screenshots.map((screenshot) => (
          <tr key={screenshot.id}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{screenshot.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{screenshot.registryId}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{screenshot.screenshotType}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(screenshot.status)}>{screenshotStatusLabel(screenshot.status)}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{screenshot.sortOrder}</td>
            <td className="px-5 py-4">
              {screenshot.previewUrl ? (
                <Link
                  className="text-xs font-black uppercase tracking-[0.14em] text-slate-700 underline"
                  href={screenshot.previewUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Preview image
                </Link>
              ) : (
                <span className="text-xs font-semibold text-slate-400">—</span>
              )}
            </td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-600">{screenshot.originalFilename}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminStatGrid
        stats={[
          { label: "Template assets", value: control.assetOverview.totalAssets },
          { label: "Published assets", value: control.assetOverview.publishedAssets },
          { label: "Draft assets", value: control.assetOverview.draftAssets },
          { label: "Archived assets", value: control.assetOverview.archivedAssets }
        ]}
      />

      <AdminHeader
        description="Unified template asset storage for preview images, icons, demo media, package JSON metadata, and documentation. Screenshots from Screenshot Management appear here as read-only linked assets."
        title="Template Assets"
      />

      <AdminTable
        empty={!control.assets.length ? "No template assets uploaded yet." : null}
        headers={["Template", "Type", "Filename", "MIME", "Size", "Status", "Uploaded", "Preview", "Source"]}
      >
        {control.assets.map((asset) => (
          <tr key={`${asset.source}-${asset.id}`}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{asset.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{asset.registryId}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{assetTypeLabel(asset.assetType)}</td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-600">{asset.originalFilename}</td>
            <td className="px-5 py-4 text-slate-600">{asset.mimeType}</td>
            <td className="px-5 py-4 text-slate-600">{formatFileSize(asset.fileSize)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(asset.status)}>{screenshotStatusLabel(asset.status)}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(asset.uploadedAt)}</td>
            <td className="px-5 py-4">
              {asset.previewUrl ? (
                <Link
                  className="text-xs font-black uppercase tracking-[0.14em] text-slate-700 underline"
                  href={asset.previewUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Preview
                </Link>
              ) : (
                <span className="text-xs font-semibold text-slate-400">—</span>
              )}
            </td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-500">
              {asset.managedExternally ? "Screenshot runtime" : "Template assets"}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminStatGrid
        stats={[
          { label: "Install runs", value: control.installOverview.totalInstalls },
          { label: "Completed", value: control.installOverview.completedInstalls },
          { label: "Prepared", value: control.installOverview.preparedInstalls },
          { label: "Failed", value: control.installOverview.failedInstalls }
        ]}
      />

      <AdminHeader
        description="Super Admin manual install runtime only. One template into one selected store per action. No bulk, marketplace, or automatic installs. Existing store data is never deleted; conflicts are skipped safely."
        title="Template Install Runtime"
      />

      <AdminTable
        empty={!control.templateInstalls.length ? "No template install runs recorded yet." : null}
        headers={["Template", "Store", "Status", "Created", "Completed", "Error"]}
      >
        {control.templateInstalls.map((install) => (
          <tr key={install.id}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{install.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{install.templateId}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-700">{install.storeName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{install.storeId}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(install.status)}>{installStatusLabel(install.status)}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(install.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(install.completedAt)}</td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-600">{install.errorMessage ?? "—"}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminStatGrid
        stats={[
          { label: "Assignments", value: control.assignmentOverview.totalAssignments },
          { label: "Active", value: control.assignmentOverview.activeAssignments },
          { label: "Assigned", value: control.assignmentOverview.assignedAssignments },
          { label: "Unassigned", value: control.assignmentOverview.unassignedAssignments }
        ]}
      />

      <AdminHeader
        description="Super Admin store template assignment runtime. Tracks which template/version is assigned or installed to which store. Metadata only — no store content, pages, products, or theme rendering changes."
        title="Store Template Assignments"
      />

      <TemplateAssignToStoreForm
        action={assignTemplateToStoreAction}
        activeAssignmentStoreIds={control.activeAssignmentStoreIds}
        stores={control.installableStores}
        templates={control.assignableTemplates}
      />

      <AdminTable
        empty={!control.storeTemplateAssignments.length ? "No store template assignments recorded yet." : null}
        headers={[
          "Store",
          "Owner",
          "Template",
          "Version",
          "Status",
          "Source",
          "Assigned",
          "Install",
          "Actions"
        ]}
      >
        {control.storeTemplateAssignments.map((assignment) => (
          <tr key={assignment.id}>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-700">{assignment.storeName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{assignment.storeId}</p>
            </td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-600">{assignment.ownerEmail}</td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{assignment.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{assignment.templateId}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{assignment.versionNumber ?? "—"}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(assignment.assignmentStatus)}>
                {assignmentStatusLabel(assignment.assignmentStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-600">
              {assignmentSourceLabel(assignment.assignmentSource)}
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(assignment.assignedAt)}</td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-500">{assignment.installId ?? "—"}</td>
            <td className="px-5 py-4">
              <TemplateAssignmentRowActions
                assignmentId={assignment.id}
                assignmentStatus={assignment.assignmentStatus}
                markActiveAction={markTemplateAssignmentActiveAction}
                storeName={assignment.storeName}
                templateName={assignment.templateName}
                unassignAction={unassignTemplateFromStoreAction}
              />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminStatGrid
        stats={[
          { label: "Isolation snapshots", value: control.isolationOverview.totalSnapshots },
          { label: "Safe", value: control.isolationOverview.safeSnapshots },
          { label: "Warnings", value: control.isolationOverview.warningSnapshots },
          { label: "Failed", value: control.isolationOverview.failedSnapshots }
        ]}
      />

      <AdminHeader
        description="Super Admin store theme isolation safeguards. Read-only checks plus snapshot metadata ensure template installs and assignments stay scoped to one store. Cross-store risks block install and assignment. No storefront rendering or destructive theme changes."
        title="Store Theme Isolation"
      />

      <AdminTable
        empty={
          !control.storeThemeIsolationSnapshots.length
            ? "No store theme isolation snapshots recorded yet. Snapshots are created after installs and assignments."
            : null
        }
        headers={["Store", "Template", "Install", "Status", "Issues", "Summary", "Created"]}
      >
        {control.storeThemeIsolationSnapshots.map((snapshot) => (
          <tr key={snapshot.id}>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-700">{snapshot.storeName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{snapshot.storeId}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{snapshot.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{snapshot.templateId ?? "—"}</p>
            </td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-500">{snapshot.installId ?? "—"}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(snapshot.isolationStatus)}>
                {isolationStatusLabel(snapshot.isolationStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{snapshot.issuesCount}</td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-600">{snapshot.issueSummary ?? "—"}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(snapshot.createdAt)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminStatGrid
        stats={[
          { label: "Update jobs", value: control.updateOverview.totalUpdates },
          { label: "Prepared", value: control.updateOverview.preparedUpdates },
          { label: "Completed", value: control.updateOverview.completedUpdates },
          { label: "Failed", value: control.updateOverview.failedUpdates }
        ]}
      />

      <AdminHeader
        description="Super Admin manual template update runtime for stores with active assignments. Explicit prepare and apply only. Conflicts are skipped safely; customer products, pages, custom themes, orders, payments, and domains are never deleted."
        title="Template Updates"
      />

      <TemplateUpdateRuntimeForm
        applyAction={applyTemplateUpdateAction}
        checkAction={checkTemplateUpdateAction}
        prepareAction={prepareTemplateUpdateAction}
        stores={control.installableStores}
        updatableTargets={control.updatableTargets}
      />

      <AdminTable
        empty={!control.templateUpdateJobs.length ? "No template update jobs recorded yet." : null}
        headers={[
          "Store",
          "Template",
          "Current",
          "Target",
          "Status",
          "Conflicts",
          "Summary",
          "Created",
          "Actions"
        ]}
      >
        {control.templateUpdateJobs.map((job) => (
          <tr key={job.id}>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-700">{job.storeName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{job.storeId}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{job.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{job.templateId}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{job.currentVersionNumber ?? "—"}</td>
            <td className="px-5 py-4 text-slate-600">{job.targetVersionNumber ?? "—"}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(job.status)}>{updateStatusLabel(job.status)}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <p className="text-slate-600">{job.conflictsCount}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{job.conflictSummary ?? "—"}</p>
            </td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-600">
              {job.summaryNote ?? job.errorMessage ?? "—"}
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(job.createdAt)}</td>
            <td className="px-5 py-4">
              {job.status === "prepared" ? (
                <TemplateUpdateApplyRowAction
                  action={applyTemplateUpdateAction}
                  jobId={job.id}
                  storeName={job.storeName}
                  templateName={job.templateName}
                />
              ) : (
                <span className="text-xs font-semibold text-slate-400">—</span>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminStatGrid
        stats={[
          { label: "Rollback jobs", value: control.rollbackOverview.totalRollbacks },
          { label: "Prepared", value: control.rollbackOverview.preparedRollbacks },
          { label: "Completed", value: control.rollbackOverview.completedRollbacks },
          { label: "Failed", value: control.rollbackOverview.failedRollbacks }
        ]}
      />

      <AdminHeader
        description="Super Admin manual template rollback runtime for stores updated through Template Update Runtime. Explicit prepare and apply only. Conflicts are skipped safely; customer data is never deleted."
        title="Template Rollbacks"
      />

      <TemplateRollbackRuntimeForm
        applyAction={applyTemplateRollbackAction}
        prepareAction={prepareTemplateRollbackAction}
        rollbackableTargets={control.rollbackableTargets}
        stores={control.installableStores}
      />

      <AdminTable
        empty={!control.templateRollbackJobs.length ? "No template rollback jobs recorded yet." : null}
        headers={[
          "Store",
          "Template",
          "Current",
          "Rollback to",
          "Status",
          "Conflicts",
          "Summary",
          "Created",
          "Actions"
        ]}
      >
        {control.templateRollbackJobs.map((job) => (
          <tr key={job.id}>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-700">{job.storeName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{job.storeId}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{job.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{job.templateId}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{job.currentVersionNumber ?? "—"}</td>
            <td className="px-5 py-4 text-slate-600">{job.targetVersionNumber ?? "—"}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(job.status)}>{rollbackStatusLabel(job.status)}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <p className="text-slate-600">{job.conflictsCount}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{job.conflictSummary ?? "—"}</p>
            </td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-600">
              {job.summaryNote ?? job.errorMessage ?? "—"}
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(job.createdAt)}</td>
            <td className="px-5 py-4">
              {job.status === "prepared" ? (
                <TemplateRollbackApplyRowAction
                  action={applyTemplateRollbackAction}
                  jobId={job.id}
                  storeName={job.storeName}
                  templateName={job.templateName}
                />
              ) : (
                <span className="text-xs font-semibold text-slate-400">—</span>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminStatGrid
        stats={[
          { label: "Published versions", value: control.templatePublishOverview.publishedVersions },
          { label: "Draft versions", value: control.templatePublishOverview.draftVersions },
          { label: "Templates published", value: control.templatePublishOverview.templatesWithPublishedVersion },
          { label: "Recent publish events", value: control.templatePublishOverview.recentPublishEvents }
        ]}
      />

      <AdminHeader
        description="Super Admin template publish runtime. Publishes template version and catalog metadata only. Existing stores, assignments, installs, and live storefronts are never updated automatically."
        title="Template Publish Runtime"
      />

      <AdminTable
        empty={!control.templatePublishStatuses.length ? "No template publish statuses available." : null}
        headers={[
          "Template",
          "Template status",
          "Current published",
          "Draft versions",
          "Last published"
        ]}
      >
        {control.templatePublishStatuses.map((status) => (
          <tr key={status.registryId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{status.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{status.registryId}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(status.templateStatus)}>{statusLabel(status.templateStatus)}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{status.currentPublishedVersion ? `v${status.currentPublishedVersion}` : "—"}</td>
            <td className="px-5 py-4 text-slate-600">{status.draftVersionCount}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(status.lastPublishedAt)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.templatePublishEvents.length ? "No template publish events recorded yet." : null}
        headers={["Event", "Template", "Version", "Created"]}
      >
        {control.templatePublishEvents.map((event) => (
          <tr key={`${event.eventType}-${event.versionId}-${event.createdAt}`}>
            <td className="px-5 py-4 font-semibold text-slate-700">{event.eventType}</td>
            <td className="px-5 py-4 text-slate-600">{event.templateName ?? event.templateId ?? "—"}</td>
            <td className="px-5 py-4 text-slate-600">{event.versionNumber ?? event.versionId ?? "—"}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(event.createdAt)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminStatGrid
        stats={[
          { label: "Reseller assignments", value: control.resellerTemplateOverview.totalAssignments },
          { label: "Active", value: control.resellerTemplateOverview.activeAssignments },
          { label: "Suspended", value: control.resellerTemplateOverview.suspendedAssignments },
          { label: "Revoked", value: control.resellerTemplateOverview.revokedAssignments }
        ]}
      />

      <AdminHeader
        description="Super Admin reseller template runtime. Assigns catalog access for reseller-specific template catalogs only. No automatic install, public purchase, or store mutation."
        title="Reseller Template Management"
      />

      <ResellerTemplateAssignForm
        action={assignResellerTemplateAction}
        assignableTemplates={control.resellerAssignableTemplates}
        resellers={control.resellerOptions}
      />

      <AdminTable
        empty={!control.resellerTemplateAssignments.length ? "No reseller template assignments recorded yet." : null}
        headers={[
          "Reseller",
          "Template",
          "Version",
          "Status",
          "Access type",
          "Assigned",
          "Actions"
        ]}
      >
        {control.resellerTemplateAssignments.map((assignment) => (
          <tr key={assignment.accessId}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{assignment.resellerName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{assignment.resellerId}</p>
              {assignment.resellerSlug ? (
                <p className="mt-1 text-xs font-semibold text-slate-500">{assignment.resellerSlug}</p>
              ) : null}
            </td>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-700">{assignment.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{assignment.templateId}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{assignment.versionNumber ? `v${assignment.versionNumber}` : "—"}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(assignment.accessStatus)}>{assignment.accessStatus}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{assignment.accessType}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(assignment.assignedAt)}</td>
            <td className="px-5 py-4">
              <ResellerTemplateRowActions
                access={assignment}
                revokeAction={revokeResellerTemplateAction}
                suspendAction={suspendResellerTemplateAction}
              />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminStatGrid
        stats={[
          { label: "Pending review", value: control.marketplaceApprovalOverview.pendingReviewListings },
          { label: "Approved", value: control.marketplaceApprovalOverview.approvedListings },
          { label: "Rejected", value: control.marketplaceApprovalOverview.rejectedListings },
          { label: "Changes requested", value: control.marketplaceApprovalOverview.changesRequestedListings }
        ]}
      />

      <AdminHeader
        description="Super Admin marketplace approval workflow for template listings. Approval updates approval_status and safe review metadata only. No auto-publish, install, payments, or store mutation."
        title="Marketplace Approval Queue"
      />

      <TemplateMarketplaceApprovalQueue
        approveAction={approveMarketplaceListingAction}
        queue={control.marketplaceApprovalQueue.map((item) => ({
          ...item,
          updatedAt: formatAdminDate(item.updatedAt)
        }))}
        rejectAction={rejectMarketplaceListingAction}
        requestChangesAction={requestMarketplaceChangesAction}
      />

      <AdminStatGrid
        stats={[
          { label: "Marketplace listings", value: control.marketplaceListingOverview.totalListings },
          { label: "Draft", value: control.marketplaceListingOverview.draftListings },
          { label: "Published", value: control.marketplaceListingOverview.publishedListings },
          { label: "Featured", value: control.marketplaceListingOverview.featuredListings }
        ]}
      />

      <AdminHeader
        description="Super Admin template marketplace runtime foundation. Makes marketplace visibility and catalog data real for admin preview only. No public purchase flow, automatic install, payments, or store mutation."
        title="Marketplace Listings"
      />

      <TemplateMarketplaceListingForm
        createAction={createMarketplaceListingAction}
        eligibleTemplates={control.marketplaceEligibleTemplates}
        listings={control.marketplaceListings}
        updateAction={updateMarketplaceListingAction}
      />

      <AdminTable
        empty={!control.marketplaceListings.length ? "No marketplace listings recorded yet." : null}
        headers={[
          "Template",
          "Listing",
          "Status",
          "Approval",
          "Pricing",
          "Featured",
          "Published",
          "Actions"
        ]}
      >
        {control.marketplaceListings.map((listing) => (
          <tr key={listing.id}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{listing.templateName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{listing.templateId}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">v{listing.versionNumber ?? "—"}</p>
            </td>
            <td className="px-5 py-4">
              <p className="font-semibold text-slate-700">{listing.listingTitle}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{listing.listingDescription ?? "—"}</p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(listing.listingStatus)}>
                {listingStatusLabel(listing.listingStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(listing.approvalStatus)}>
                {approvalStatusLabel(listing.approvalStatus)}
              </AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={listing.pricingType === "free" ? "green" : "amber"}>
                {listing.pricingLabel}
              </AdminBadge>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {listing.pricingType}
              </p>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={listing.featured ? "amber" : "blue"}>
                {listing.featured ? "Featured" : "Standard"}
              </AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(listing.publishedAt)}</td>
            <td className="px-5 py-4">
              <TemplateMarketplaceListingRowActions
                archiveAction={archiveMarketplaceListingAction}
                featuredAction={markMarketplaceListingFeaturedAction}
                listing={listing}
                publishAction={publishMarketplaceListingAction}
              />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminHeader
        description="Admin-only preview of the published marketplace catalog. Cards use published screenshots when available, otherwise safe preview placeholders. No public route exposure."
        title="Marketplace Catalog Preview"
      />

      <TemplateMarketplaceCatalogPreview cards={control.marketplaceCatalogPreview} />

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
                          {version.status === "draft" ? (
                            <TemplatePublishVersionAction
                              action={publishTemplateUpdateAction}
                              canPublish={version.publishReadiness.canPublish}
                              readinessIssues={version.publishReadiness.issues}
                              templateId={template.registryId}
                              templateName={template.name}
                              versionId={version.id}
                              versionNumber={version.versionNumber}
                            />
                          ) : null}
                          {version.status === "published" ? (
                            <TemplateUnpublishVersionAction
                              action={unpublishTemplateVersionAction}
                              templateId={template.registryId}
                              versionId={version.id}
                            />
                          ) : null}
                          {version.status === "draft" && !version.publishReadiness.canPublish ? (
                            <p className="text-[10px] font-semibold text-amber-700">
                              {version.publishReadiness.issues[0] ?? "Publish readiness checks required."}
                            </p>
                          ) : null}
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
                <TemplateInstallToStoreForm
                  action={installTemplateToStoreAction}
                  registryId={template.registryId}
                  stores={control.installableStores}
                  templateName={template.name}
                />
                <details
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  id={`asset-runtime-${template.registryId}`}
                >
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                    Template assets ({template.assets.length})
                  </summary>
                  <TemplateAssetUploadForm
                    action={uploadTemplateAssetAction}
                    registryId={template.registryId}
                    templateName={template.name}
                  />
                  <TemplateAssetList
                    archiveAction={archiveTemplateAssetAction}
                    assets={template.assets}
                    deleteDraftAction={deleteDraftTemplateAssetAction}
                    publishAction={publishTemplateAssetAction}
                    registryId={template.registryId}
                    screenshotDrawerId={`screenshot-runtime-${template.registryId}`}
                    templateName={template.name}
                  />
                </details>
                <details
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  id={`screenshot-runtime-${template.registryId}`}
                >
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                    Screenshots ({template.screenshots.length})
                  </summary>
                  <TemplateScreenshotUploadForm
                    action={uploadTemplateScreenshotAction}
                    registryId={template.registryId}
                    templateName={template.name}
                  />
                  <TemplateScreenshotList
                    archiveAction={archiveTemplateScreenshotAction}
                    previewHref={template.previewHref}
                    publishAction={publishTemplateScreenshotAction}
                    registryId={template.registryId}
                    reorderAction={reorderTemplateScreenshotAction}
                    screenshots={template.screenshots}
                    templateName={template.name}
                  />
                </details>
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
