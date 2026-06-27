import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminSEOControl } from "@/lib/admin/data";
import {
  generateSitemapPlaceholder,
  markSEOReviewed,
  previewSEO,
  validateRobotsPlaceholder,
  validateStructuredDataPlaceholder
} from "@/lib/admin/seo-actions";

function toneForCertificationStatus(status: string) {
  if (status === "certified") {
    return "green" as const;
  }

  return "amber" as const;
}

function toneForAiSeoStatus(status: string) {
  if (status === "ai_ready") {
    return "green" as const;
  }

  if (status === "invalid") {
    return "red" as const;
  }

  return "blue" as const;
}

function toneForEditorStatus(status: string) {
  if (status === "editor_ready") {
    return "green" as const;
  }

  if (status === "invalid") {
    return "red" as const;
  }

  return "blue" as const;
}

function toneForExportStatus(status: string) {
  if (status === "export_ready") {
    return "green" as const;
  }

  if (status === "incomplete") {
    return "red" as const;
  }

  if (status === "needs_review") {
    return "amber" as const;
  }

  return "blue" as const;
}

function toneForSafeActionStatus(status: string) {
  if (status === "available") {
    return "green" as const;
  }

  if (status === "blocked") {
    return "red" as const;
  }

  return "blue" as const;
}

function getSeoSafeAction(
  control: Awaited<ReturnType<typeof getAdminSEOControl>>,
  actionId: Awaited<ReturnType<typeof getAdminSEOControl>>["seoSafeActions"]["actions"][number]["id"]
) {
  return control.seoSafeActions.actions.find((action) => action.id === actionId);
}

function SafeActionMeta({
  action
}: {
  action: NonNullable<ReturnType<typeof getSeoSafeAction>>;
}) {
  return (
    <div className="space-y-1">
      <AdminBadge tone={toneForSafeActionStatus(action.status)}>{action.status}</AdminBadge>
      <p className="text-[10px] leading-4 text-slate-500">{action.description}</p>
    </div>
  );
}

function toneForReviewStatus(status: string) {
  if (status === "reviewed") {
    return "green" as const;
  }

  if (status === "missing_required_seo") {
    return "red" as const;
  }

  if (status === "blocked_private_route") {
    return "red" as const;
  }

  if (status === "needs_review") {
    return "amber" as const;
  }

  return "blue" as const;
}

function toneForReportStatus(status: string) {
  if (status === "report_ready") {
    return "green" as const;
  }

  if (status === "incomplete") {
    return "red" as const;
  }

  if (status === "needs_review") {
    return "amber" as const;
  }

  return "blue" as const;
}

function toneForAuditStatus(status: string) {
  if (status === "audit_ready") {
    return "green" as const;
  }

  if (status === "incomplete") {
    return "red" as const;
  }

  if (status === "needs_review") {
    return "amber" as const;
  }

  return "blue" as const;
}

function toneForStatus(status: string) {
  if (["configured", "ready"].includes(status)) {
    return "green" as const;
  }

  if (["missing", "warning"].includes(status)) {
    return "red" as const;
  }

  if (status === "placeholder") {
    return "blue" as const;
  }

  return "amber" as const;
}

function PageHiddenFields({
  page
}: {
  page: Awaited<ReturnType<typeof getAdminSEOControl>>["pages"][number];
}) {
  return (
    <>
      <input name="slug" type="hidden" value={page.slug} />
      <input name="pageTitle" type="hidden" value={page.page} />
    </>
  );
}

export default async function AdminSEOPage() {
  const control = await getAdminSEOControl();
  const previewSeoAction = getSeoSafeAction(control, "preview_seo");
  const markReviewedAction = getSeoSafeAction(control, "mark_reviewed_placeholder");
  const generateSitemapAction = getSeoSafeAction(control, "generate_sitemap_placeholder");
  const validateSitemapAction = getSeoSafeAction(control, "validate_sitemap_placeholder");
  const validateRobotsAction = getSeoSafeAction(control, "validate_robots_placeholder");
  const validateSchemaAction = getSeoSafeAction(control, "validate_schema_placeholder");
  const exportReportAction = getSeoSafeAction(control, "export_report_placeholder");

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Platform-level SEO monitoring for SHASTORE public pages, sitemap, robots, metadata, structured data, and analytics readiness. Store Owner SEO remains in the Store Owner dashboard."
        title="SEO Center"
      />

      <AdminStatGrid
        stats={[
          { label: "Indexed pages", value: control.overview.indexedPagesPlaceholder },
          { label: "Missing titles", value: control.overview.missingMetaTitles },
          { label: "Missing descriptions", value: control.overview.missingMetaDescriptions },
          { label: "Sitemap", value: control.overview.sitemapStatus },
          { label: "Robots", value: control.overview.robotsStatus },
          { label: "Structured data", value: control.overview.structuredDataStatus },
          { label: "Canonicals ready", value: control.overview.canonicalReady },
          { label: "Language ready", value: control.overview.languageReady }
        ]}
      />

      <AdminTable headers={["SEO certification", "Status", "Readiness"]}>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Data certification readiness</td>
          <td className="px-5 py-4">
            <AdminBadge tone={toneForCertificationStatus(control.seoDataCertification.status)}>
              {control.seoDataCertification.status}
            </AdminBadge>
          </td>
          <td className="px-5 py-4 text-slate-600">
            <p className="text-sm">{control.seoDataCertification.summary}</p>
            <p className="mt-2 text-xs text-slate-500">
              {control.seoDataCertification.passedChecks}/{control.seoDataCertification.totalChecks} checks passed
              · generated {formatAdminDate(control.seoDataCertification.generatedAt)}
            </p>
            {control.seoDataCertification.warnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-700">
                {control.seoDataCertification.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Security certification readiness</td>
          <td className="px-5 py-4">
            <AdminBadge tone={toneForCertificationStatus(control.seoSecurityCertification.status)}>
              {control.seoSecurityCertification.status}
            </AdminBadge>
          </td>
          <td className="px-5 py-4 text-slate-600">
            <p className="text-sm">{control.seoSecurityCertification.summary}</p>
            <p className="mt-2 text-xs text-slate-500">
              {control.seoSecurityCertification.passedChecks}/{control.seoSecurityCertification.totalChecks} checks passed
              · generated {formatAdminDate(control.seoSecurityCertification.generatedAt)}
            </p>
            {control.seoSecurityCertification.warnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-700">
                {control.seoSecurityCertification.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Runtime certification readiness</td>
          <td className="px-5 py-4">
            <AdminBadge tone={toneForCertificationStatus(control.seoRuntimeCertification.status)}>
              {control.seoRuntimeCertification.status}
            </AdminBadge>
          </td>
          <td className="px-5 py-4 text-slate-600">
            <p className="text-sm">{control.seoRuntimeCertification.summary}</p>
            <p className="mt-2 text-xs text-slate-500">
              {control.seoRuntimeCertification.passedChecks}/{control.seoRuntimeCertification.totalChecks} checks passed
              · generated {formatAdminDate(control.seoRuntimeCertification.generatedAt)}
            </p>
            {control.seoRuntimeCertification.warnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-700">
                {control.seoRuntimeCertification.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </td>
        </tr>
      </AdminTable>

      <AdminTable
        headers={[
          "Page",
          "Slug",
          "Meta title",
          "Meta description",
          "Canonical",
          "Open Graph",
          "Language",
          "Last updated",
          "Safe actions"
        ]}
      >
        {control.pages.map((page) => (
          <tr key={page.slug}>
            <td className="px-5 py-4 font-bold text-slate-950">{page.page}</td>
            <td className="px-5 py-4 text-slate-600">{page.slug}</td>
            <td className="px-5 py-4">
              <p className="max-w-xs text-sm font-semibold text-slate-900">{page.metaTitle}</p>
              <div className="mt-2">
                <AdminBadge tone={toneForStatus(page.metaTitleStatus)}>{page.metaTitleStatus}</AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4">
              <p className="max-w-xs text-sm font-semibold text-slate-900">{page.metaDescription}</p>
              <div className="mt-2">
                <AdminBadge tone={toneForStatus(page.metaDescriptionStatus)}>{page.metaDescriptionStatus}</AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4">
              <p className="max-w-xs text-sm font-semibold text-slate-900">{page.canonicalPath}</p>
              <div className="mt-2">
                <AdminBadge tone={toneForStatus(page.canonicalStatus)}>{page.canonicalStatus}</AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4">
              <p className="max-w-xs text-sm font-semibold text-slate-900">{page.openGraphTitle}</p>
              <div className="mt-2">
                <AdminBadge tone={toneForStatus(page.openGraphStatus)}>{page.openGraphStatus}</AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4">
              <p className="max-w-xs text-sm font-semibold text-slate-900">{page.language}</p>
              <div className="mt-2">
                <AdminBadge tone={toneForStatus(page.languageStatus)}>{page.languageStatus}</AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(page.lastUpdated)}</td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <AdminBadge tone={toneForReviewStatus(page.reviewStatus)}>{page.reviewStatus}</AdminBadge>
                {page.reviewWarnings.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                    {page.reviewWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
                {previewSeoAction ? <SafeActionMeta action={previewSeoAction} /> : null}
                <form action={previewSEO}>
                  <PageHiddenFields page={page} />
                  <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                    {previewSeoAction?.label ?? "Preview SEO"}
                  </button>
                </form>
                {markReviewedAction ? <SafeActionMeta action={markReviewedAction} /> : null}
                <form action={markSEOReviewed}>
                  <PageHiddenFields page={page} />
                  <button
                    className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={page.reviewStatus === "blocked_private_route"}
                    type="submit"
                  >
                    {markReviewedAction?.label ?? "Mark reviewed"}
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Sitemap item", "Value", "Status / action"]}>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">sitemap.xml status</td>
          <td className="px-5 py-4 text-slate-600">{control.sitemap.lastGenerated}</td>
          <td className="px-5 py-4"><AdminBadge tone={toneForStatus(control.sitemap.status)}>{control.sitemap.status}</AdminBadge></td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Included routes</td>
          <td className="px-5 py-4 text-slate-600">{control.sitemap.includedRoutes.join(", ")}</td>
          <td className="px-5 py-4">
            {generateSitemapAction ? <SafeActionMeta action={generateSitemapAction} /> : null}
            <form action={generateSitemapPlaceholder}>
              <button className="h-9 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                {generateSitemapAction?.label ?? "Generate placeholder"}
              </button>
            </form>
            {validateSitemapAction ? (
              <div className="mt-2">
                <SafeActionMeta action={validateSitemapAction} />
              </div>
            ) : null}
          </td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Excluded routes</td>
          <td className="px-5 py-4 text-slate-600">{control.sitemap.excludedRoutes.join(", ")}</td>
          <td className="px-5 py-4 text-slate-500">No route changes in this phase</td>
        </tr>
      </AdminTable>

      <AdminTable headers={["Robots item", "Value", "Status / action"]}>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">robots.txt status</td>
          <td className="px-5 py-4 text-slate-600">{control.robots.environmentWarning}</td>
          <td className="px-5 py-4"><AdminBadge tone={toneForStatus(control.robots.status)}>{control.robots.status}</AdminBadge></td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Allowed paths</td>
          <td className="px-5 py-4 text-slate-600">{control.robots.allowedPaths.join(", ")}</td>
          <td className="px-5 py-4">
            {validateRobotsAction ? <SafeActionMeta action={validateRobotsAction} /> : null}
            <form action={validateRobotsPlaceholder}>
              <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                {validateRobotsAction?.label ?? "Validate robots"}
              </button>
            </form>
          </td>
        </tr>
        <tr>
          <td className="px-5 py-4 font-bold text-slate-950">Blocked paths</td>
          <td className="px-5 py-4 text-slate-600">{control.robots.blockedPaths.join(", ")}</td>
          <td className="px-5 py-4 text-slate-500">Admin/dashboard/private routes blocked</td>
        </tr>
      </AdminTable>

      <AdminTable headers={["Structured data", "Status", "Notes", "Action"]}>
        {control.structuredData.map((item) => (
          <tr key={item.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(item.status)}>{item.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{item.note}</td>
            <td className="px-5 py-4">
              {validateSchemaAction ? <SafeActionMeta action={validateSchemaAction} /> : null}
              <form action={validateStructuredDataPlaceholder}>
                <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                  {validateSchemaAction?.label ?? "Validate schema"}
                </button>
              </form>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Analytics / search readiness", "Status", "Notes"]}>
        {control.analyticsReadiness.map((item) => (
          <tr key={item.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(item.status)}>{item.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{item.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Future hook", "Status"]}>
        {control.futureHooks.map((hook) => (
          <tr key={hook}>
            <td className="px-5 py-4 font-bold text-slate-950">{hook}</td>
            <td className="px-5 py-4">
              {hook === control.seoEditor.hookLabel ? (
                <div className="space-y-2">
                  <AdminBadge tone={toneForEditorStatus(control.seoEditor.runtimeStatus)}>
                    {control.seoEditor.runtimeStatus}
                  </AdminBadge>
                  <p className="text-xs text-slate-600">{control.seoEditor.summary}</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                    {control.seoEditor.editableFields.map((field) => (
                      <li key={field.id}>
                        {field.label} ({field.type}) — {field.implemented ? "implemented" : "validation-only"}
                      </li>
                    ))}
                  </ul>
                  <button
                    className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                    disabled
                    type="button"
                  >
                    Editor placeholder
                  </button>
                </div>
              ) : hook === control.aiSeo.hookLabel ? (
                <div className="space-y-2">
                  <AdminBadge tone={toneForAiSeoStatus(control.aiSeo.runtimeStatus)}>
                    {control.aiSeo.runtimeStatus}
                  </AdminBadge>
                  <p className="text-xs text-slate-600">{control.aiSeo.summary}</p>
                  <p className="text-xs text-slate-600">{control.aiSeo.message}</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                    {control.aiSeo.futureFields.map((field) => (
                      <li key={field.id}>
                        {field.label} — {field.implemented ? "implemented" : "validation-only"}
                      </li>
                    ))}
                  </ul>
                  <button
                    className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                    disabled
                    type="button"
                  >
                    Generate placeholder
                  </button>
                </div>
              ) : hook === control.seoAudit.exportHookLabel ? (
                <div className="space-y-2">
                  <AdminBadge tone={toneForAuditStatus(control.seoAudit.runtimeStatus)}>
                    {control.seoAudit.runtimeStatus}
                  </AdminBadge>
                  <p className="text-xs text-slate-600">{control.seoAudit.summary}</p>
                  <AdminBadge tone={toneForExportStatus(control.seoExport.runtimeStatus)}>
                    export {control.seoExport.runtimeStatus}
                  </AdminBadge>
                  <p className="text-xs text-slate-600">{control.seoExport.summary}</p>
                  {exportReportAction ? <SafeActionMeta action={exportReportAction} /> : null}
                  <button
                    className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                    disabled
                    type="button"
                  >
                    {exportReportAction?.label ?? "Export placeholder"}
                  </button>
                </div>
              ) : hook === control.seoReport.exportHookLabel ? (
                <div className="space-y-2">
                  <AdminBadge tone={toneForReportStatus(control.seoReport.runtimeStatus)}>
                    {control.seoReport.runtimeStatus}
                  </AdminBadge>
                  <p className="text-xs text-slate-600">{control.seoReport.summary}</p>
                  {control.seoReport.recommendations.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                      {control.seoReport.recommendations.map((recommendation) => (
                        <li key={recommendation}>{recommendation}</li>
                      ))}
                    </ul>
                  ) : null}
                  <AdminBadge tone={toneForExportStatus(control.seoExport.runtimeStatus)}>
                    export {control.seoExport.runtimeStatus}
                  </AdminBadge>
                  <p className="text-xs text-slate-600">{control.seoExport.summary}</p>
                  {control.seoExport.safeRecommendations.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                      {control.seoExport.safeRecommendations.map((recommendation) => (
                        <li key={recommendation}>{recommendation}</li>
                      ))}
                    </ul>
                  ) : null}
                  {exportReportAction ? <SafeActionMeta action={exportReportAction} /> : null}
                  <button
                    className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                    disabled
                    type="button"
                  >
                    Download placeholder
                  </button>
                </div>
              ) : (
                <button
                  className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                  disabled
                  type="button"
                >
                  Reserved placeholder
                </button>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
