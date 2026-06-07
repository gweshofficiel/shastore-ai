import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminPlatformWebsiteControl } from "@/lib/admin/data";
import {
  archivePlatformPagePlaceholder,
  editPlatformPagePlaceholder,
  markPlatformPageDraft,
  markPlatformPagePublished,
  previewPlatformPage
} from "@/lib/admin/platform-website-actions";

function toneForStatus(status: string) {
  if (["published", "ready"].includes(status)) {
    return "green" as const;
  }

  if (["archived", "needs_metadata"].includes(status)) {
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
  page: Awaited<ReturnType<typeof getAdminPlatformWebsiteControl>>["pages"][number];
}) {
  return (
    <>
      <input name="slug" type="hidden" value={page.slug} />
      <input name="title" type="hidden" value={page.title} />
    </>
  );
}

export default async function AdminPlatformWebsitePage() {
  const control = await getAdminPlatformWebsiteControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Manage SHASTORE platform public website pages only. This does not touch Store Owner pages, storefront legal pages, the template engine, or store page builder."
        title="Platform Website Management"
      />

      <AdminStatGrid
        stats={[
          { label: "Platform pages", value: control.overview.totalPages },
          { label: "Published", value: control.overview.publishedPages },
          { label: "Draft", value: control.overview.draftPages },
          { label: "Archived", value: control.overview.archivedPages },
          { label: "SEO ready", value: control.overview.seoReadyPages },
          { label: "Landing readiness", value: `${control.overview.readyLandingPages}/${control.landingStatus.length}` }
        ]}
      />

      <AdminTable headers={["Landing area", "Route", "Readiness"]}>
        {control.landingStatus.map((item) => (
          <tr key={item.route}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
            <td className="px-5 py-4 text-slate-600">{item.route}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={item.ready ? "green" : "amber"}>{item.ready ? "ready" : "placeholder"}</AdminBadge>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.pages.length ? "No platform website pages configured." : null}
        headers={[
          "Page",
          "Slug",
          "Status",
          "Last updated",
          "SEO",
          "Languages",
          "Preview",
          "Actions"
        ]}
      >
        {control.pages.map((page) => (
          <tr key={page.slug}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{page.title}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{page.section}</p>
            </td>
            <td className="px-5 py-4 text-slate-600">{page.slug}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(page.status)}>{page.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(page.lastUpdated)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(page.seoStatus)}>{page.seoStatus}</AdminBadge>
              <div className="mt-3 max-w-sm text-xs leading-5 text-slate-500">
                <p><span className="font-black text-slate-700">Meta title:</span> {page.metaTitle}</p>
                <p><span className="font-black text-slate-700">Description:</span> {page.metaDescription}</p>
                <p><span className="font-black text-slate-700">Canonical:</span> {page.canonical}</p>
                <p><span className="font-black text-slate-700">Open Graph:</span> {page.openGraph}</p>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="flex min-w-56 flex-wrap gap-2">
                {page.languages.map((language) => (
                  <AdminBadge key={language.language} tone={toneForStatus(language.status)}>
                    {language.language}: {language.status}
                  </AdminBadge>
                ))}
              </div>
            </td>
            <td className="px-5 py-4">
              {page.previewHref ? (
                <form action={previewPlatformPage}>
                  <PageHiddenFields page={page} />
                  <Link
                    className="inline-flex h-9 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                    href={page.previewHref}
                    target="_blank"
                  >
                    Preview page
                  </Link>
                </form>
              ) : (
                <button
                  className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                  disabled
                  type="button"
                >
                  Preview placeholder
                </button>
              )}
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                <form action={markPlatformPageDraft}>
                  <PageHiddenFields page={page} />
                  <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                    Mark draft
                  </button>
                </form>
                <form action={markPlatformPagePublished}>
                  <PageHiddenFields page={page} />
                  <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                    Publish placeholder
                  </button>
                </form>
                <form action={editPlatformPagePlaceholder}>
                  <PageHiddenFields page={page} />
                  <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
                    Edit placeholder
                  </button>
                </form>
                <form action={archivePlatformPagePlaceholder}>
                  <PageHiddenFields page={page} />
                  <button className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                    Archive placeholder
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
