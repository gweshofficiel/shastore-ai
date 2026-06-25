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
                <form action={previewSEO}>
                  <PageHiddenFields page={page} />
                  <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                    Preview SEO
                  </button>
                </form>
                <form action={markSEOReviewed}>
                  <PageHiddenFields page={page} />
                  <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
                    Mark reviewed
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
            <form action={generateSitemapPlaceholder}>
              <button className="h-9 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                Generate placeholder
              </button>
            </form>
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
            <form action={validateRobotsPlaceholder}>
              <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                Validate robots
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
              <form action={validateStructuredDataPlaceholder}>
                <button className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                  Validate schema
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
              {hook === control.seoAudit.exportHookLabel ? (
                <div className="space-y-2">
                  <AdminBadge tone={toneForAuditStatus(control.seoAudit.runtimeStatus)}>
                    {control.seoAudit.runtimeStatus}
                  </AdminBadge>
                  <p className="text-xs text-slate-600">{control.seoAudit.summary}</p>
                  <button
                    className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                    disabled
                    type="button"
                  >
                    Export placeholder
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
