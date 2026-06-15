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
  archivePlatformBlogPostAction,
  createPlatformBlogDraftAction,
  markPlatformPageDraft,
  markPlatformPagePublished,
  updatePlatformBlogDraftAction
} from "@/lib/admin/platform-website-actions";

function toneForStatus(status: string) {
  if (["Published", "published", "ready"].includes(status)) {
    return "green" as const;
  }

  if (["Archived", "Needs Content", "Needs SEO", "archived", "missing", "needs_metadata", "needs_attention"].includes(status)) {
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
      <input name="pageId" type="hidden" value={page.id} />
      <input name="slug" type="hidden" value={page.slug} />
      <input name="title" type="hidden" value={page.title} />
    </>
  );
}

export default async function AdminPlatformWebsitePage({
  searchParams
}: {
  searchParams?: Promise<{ message?: string; status?: string }>;
}) {
  const params = await searchParams;
  const control = await getAdminPlatformWebsiteControl();
  const actionMessage = params?.message;
  const actionStatus = params?.status === "error" ? "error" : params?.status === "success" ? "success" : null;

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

      {actionMessage && actionStatus ? (
        <div
          className={`rounded-[2rem] border p-5 text-sm font-bold leading-6 ${
            actionStatus === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={actionStatus === "success" ? "status" : "alert"}
        >
          {actionMessage}
        </div>
      ) : null}

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
          "Publishing Status",
          "Last updated",
          "SEO",
          "Readiness",
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
              {page.isLive ? (
                <div className="mt-2">
                  <AdminBadge tone="green">LIVE</AdminBadge>
                </div>
              ) : null}
            </td>
            <td className="px-5 py-4 text-slate-600">{page.slug}</td>
            <td className="px-5 py-4">
              <div className="grid gap-2">
                <AdminBadge tone={toneForStatus(page.status)}>{page.status}</AdminBadge>
                <AdminBadge tone={toneForStatus(page.contentStatus)}>{page.contentStatus}</AdminBadge>
              </div>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(page.publishingStatus)}>{page.publishingStatus}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(page.lastUpdated)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForStatus(page.seoStatus)}>{page.seoStatus}</AdminBadge>
              <div className="mt-3 flex max-w-sm flex-wrap gap-2">
                <AdminBadge tone={page.seoReadiness.isReady ? "green" : "amber"}>
                  SEO {page.seoReadiness.isReady ? "ready" : "needs work"}
                </AdminBadge>
                {page.seoReadiness.missingTitle ? <AdminBadge tone="red">Missing title</AdminBadge> : null}
                {page.seoReadiness.missingDescription ? <AdminBadge tone="red">Missing description</AdminBadge> : null}
                {page.seoReadiness.missingCanonical ? <AdminBadge tone="red">Missing canonical</AdminBadge> : null}
                {page.seoReadiness.missingOpenGraph ? <AdminBadge tone="red">Missing OpenGraph</AdminBadge> : null}
              </div>
              <div className="mt-3 max-w-sm text-xs leading-5 text-slate-500">
                <p><span className="font-black text-slate-700">Meta title:</span> {page.metaTitle}</p>
                <p><span className="font-black text-slate-700">Description:</span> {page.metaDescription}</p>
                <p><span className="font-black text-slate-700">Canonical:</span> {page.canonical}</p>
                <p><span className="font-black text-slate-700">Open Graph:</span> {page.openGraph}</p>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="flex min-w-56 flex-wrap gap-2">
                <AdminBadge tone={page.publishingReadiness.contentReady ? "green" : "amber"}>
                  Content {page.publishingReadiness.contentReady ? "ready" : "needed"}
                </AdminBadge>
                <AdminBadge tone={page.publishingReadiness.seoReady ? "green" : "amber"}>
                  SEO {page.publishingReadiness.seoReady ? "ready" : "needed"}
                </AdminBadge>
                <AdminBadge tone={page.publishingReadiness.routeReady ? "green" : "red"}>
                  Route {page.publishingReadiness.routeReady ? "ready" : "missing"}
                </AdminBadge>
                <AdminBadge tone={toneForStatus(page.publishingReadiness.translationStatus)}>
                  Translation {page.publishingReadiness.translationStatus}
                </AdminBadge>
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
              <Link
                className="inline-flex h-9 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                href={`/admin/platform-website/preview/${page.id}`}
              >
                Preview page
              </Link>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                {page.status === "published" || page.status === "archived" ? (
                  <form action={markPlatformPageDraft}>
                    <PageHiddenFields page={page} />
                    <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                      Revert to Draft
                    </button>
                  </form>
                ) : null}
                {page.status === "draft" ? (
                  <form action={markPlatformPagePublished}>
                    <PageHiddenFields page={page} />
                    <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                      Publish
                    </button>
                  </form>
                ) : null}
                <Link
                  className="inline-flex h-9 w-full items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                  href={`/admin/platform-website/pages/${page.id}`}
                >
                  Edit content
                </Link>
                <Link
                  className="inline-flex h-9 w-full items-center justify-center rounded-full border border-purple-200 bg-purple-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-purple-700"
                  href={`/admin/platform-website/builder/${page.id}`}
                >
                  Landing builder
                </Link>
                {page.status === "draft" || page.status === "published" ? (
                  <form action={archivePlatformPagePlaceholder}>
                    <PageHiddenFields page={page} />
                    <button className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                      Archive
                    </button>
                  </form>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.pages.length ? "No platform page translations configured." : null}
        headers={[
          "Page",
          "Slug",
          "Route",
          "EN",
          "AR",
          "FR",
          "Missing fields",
          "Last updated",
          "Edit"
        ]}
      >
        {control.pages.map((page) => (
          <tr key={`translation-${page.slug}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{page.title}</td>
            <td className="px-5 py-4 text-slate-600">{page.slug}</td>
            <td className="px-5 py-4 text-slate-600">{page.route}</td>
            {(["en", "ar", "fr"] as const).map((locale) => {
              const language = page.languages.find((item) => item.language === locale);

              return (
                <td className="px-5 py-4" key={`${page.slug}-${locale}`}>
                  <AdminBadge tone={toneForStatus(language?.status ?? "missing")}>
                    {locale}: {language?.status ?? "missing"}
                  </AdminBadge>
                </td>
              );
            })}
            <td className="px-5 py-4">
              <div className="flex min-w-64 flex-wrap gap-2">
                {(["en", "ar", "fr"] as const).flatMap((locale) =>
                  page.translationMissingFields[locale].map((field) => (
                    <AdminBadge key={`${locale}-${field}`} tone="red">
                      {locale}: {field}
                    </AdminBadge>
                  ))
                ).slice(0, 8)}
                {(["en", "ar", "fr"] as const).every((locale) => !page.translationMissingFields[locale].length) ? (
                  <AdminBadge tone="green">complete</AdminBadge>
                ) : null}
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(page.lastUpdated)}</td>
            <td className="px-5 py-4">
              <div className="grid min-w-40 gap-2">
                {(["en", "ar", "fr"] as const).map((locale) => (
                  <Link
                    className="inline-flex h-8 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                    href={`/admin/platform-website/translations/${page.id}/${locale}`}
                    key={`${page.id}-edit-${locale}`}
                  >
                    Edit {locale}
                  </Link>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <section className="grid gap-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Platform Blog Foundation</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">SHASTORE Platform Blog</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Foundation only. Draft metadata is stored for platform public website blog posts, but public `/blog` article routes are not connected in this phase.
          </p>
        </div>

        <AdminStatGrid
          stats={[
            { label: "Total posts", value: control.blogFoundation.totalPosts },
            { label: "Draft posts", value: control.blogFoundation.draftPosts },
            { label: "Published posts", value: control.blogFoundation.publishedPosts },
            { label: "Archived posts", value: control.blogFoundation.archivedPosts }
          ]}
        />

        <form action={createPlatformBlogDraftAction} className="grid gap-4 rounded-[2rem] border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Create draft post</p>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="h-10 rounded-2xl border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={180} name="postTitle" placeholder="Title" required type="text" />
            <input className="h-10 rounded-2xl border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={120} name="postSlug" placeholder="Slug (optional)" type="text" />
            <input className="h-10 rounded-2xl border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={120} name="authorName" placeholder="Author name" type="text" />
            <input className="h-10 rounded-2xl border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={1000} name="coverImageUrl" placeholder="Cover image URL (optional)" type="text" />
          </div>
          <textarea className="min-h-20 rounded-2xl border border-blue-100 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-700" maxLength={500} name="excerpt" placeholder="Excerpt" />
          <div className="grid gap-3 md:grid-cols-2">
            <input className="h-10 rounded-2xl border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={70} name="seoTitle" placeholder="SEO title" type="text" />
            <input className="h-10 rounded-2xl border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={160} name="seoDescription" placeholder="SEO description" type="text" />
          </div>
          <input name="content" type="hidden" value="{}" />
          <input name="translations" type="hidden" value="{}" />
          <button className="h-10 w-fit rounded-full bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.16em] text-white" type="submit">
            Create draft post
          </button>
        </form>

        <AdminTable
          empty={!control.blogFoundation.recentPosts.length ? "No platform blog posts yet." : null}
          headers={["Post", "Status", "Author", "Updated", "Edit metadata", "Archive"]}
        >
          {control.blogFoundation.recentPosts.map((post) => (
            <tr key={post.id}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{post.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">/{post.slug}</p>
                {post.excerpt ? <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{post.excerpt}</p> : null}
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(post.status)}>{post.status}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{post.authorName}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(post.updatedAt)}</td>
              <td className="px-5 py-4">
                <form action={updatePlatformBlogDraftAction} className="grid min-w-80 gap-2">
                  <input name="postId" type="hidden" value={post.id} />
                  <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={180} name="postTitle" placeholder="Title" type="text" defaultValue={post.title} />
                  <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={120} name="postSlug" placeholder="Slug" type="text" defaultValue={post.slug} />
                  <textarea className="min-h-16 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold leading-5 text-slate-700" maxLength={500} name="excerpt" placeholder="Excerpt" defaultValue={post.excerpt} />
                  <div className="grid gap-2 md:grid-cols-2">
                    <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={120} name="authorName" placeholder="Author" type="text" defaultValue={post.authorName} />
                    <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={1000} name="coverImageUrl" placeholder="Cover image URL" type="text" defaultValue={post.coverImageUrl ?? ""} />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={70} name="seoTitle" placeholder="SEO title" type="text" defaultValue={post.seoTitle ?? ""} />
                    <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={160} name="seoDescription" placeholder="SEO description" type="text" defaultValue={post.seoDescription ?? ""} />
                  </div>
                  <input name="content" type="hidden" value={JSON.stringify(post.content)} />
                  <input name="translations" type="hidden" value={JSON.stringify(post.translations)} />
                  <button className="h-9 w-fit rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" disabled={post.status === "archived"} type="submit">
                    Save metadata
                  </button>
                </form>
              </td>
              <td className="px-5 py-4">
                {post.status !== "archived" ? (
                  <form action={archivePlatformBlogPostAction}>
                    <input name="postId" type="hidden" value={post.id} />
                    <button className="h-9 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                      Archive
                    </button>
                  </form>
                ) : (
                  <AdminBadge tone="red">archived</AdminBadge>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

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
