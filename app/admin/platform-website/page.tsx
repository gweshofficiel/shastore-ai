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
  approvePlatformContentAction,
  archivePlatformPagePlaceholder,
  archivePlatformBlogCategoryAction,
  archivePlatformBlogPostAction,
  archivePlatformBlogTagAction,
  cancelPlatformContentScheduleAction,
  createPlatformBlogCategoryAction,
  createPlatformBlogDraftAction,
  createPlatformBlogTagAction,
  markPlatformPageDraft,
  markPlatformPagePublished,
  publishPlatformBlogPostAction,
  rejectPlatformContentAction,
  revertPlatformBlogPostDraftAction,
  updatePlatformBlogCategoryAction,
  updatePlatformBlogDraftAction,
  updatePlatformBlogTagAction
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

function AdvancedPublishingHiddenFields({
  contentId,
  contentType
}: {
  contentId: string;
  contentType: "platform_blog_post" | "platform_page";
}) {
  return (
    <>
      <input name="contentId" type="hidden" value={contentId} />
      <input name="contentType" type="hidden" value={contentType} />
    </>
  );
}

function contentTypeLabel(contentType: string) {
  return contentType.replace("platform_", "").replaceAll("_", " ");
}

function AnalyticsRows({
  empty,
  metrics
}: {
  empty: string;
  metrics: Array<{ label: string; value: number }>;
}) {
  return (
    <>
      {metrics.length ? (
        metrics.map((metric) => (
          <tr key={metric.label}>
            <td className="px-5 py-4 font-bold text-slate-950">{metric.label}</td>
            <td className="px-5 py-4 text-slate-600">{metric.value}</td>
          </tr>
        ))
      ) : (
        <tr>
          <td className="px-5 py-4 text-sm text-slate-500" colSpan={2}>{empty}</td>
        </tr>
      )}
    </>
  );
}

export default async function AdminPlatformWebsitePage({
  searchParams
}: {
  searchParams?: Promise<{ analyticsRange?: string; message?: string; status?: string }>;
}) {
  const params = await searchParams;
  const control = await getAdminPlatformWebsiteControl(params?.analyticsRange);
  const actionMessage = params?.message;
  const actionStatus = params?.status === "error" ? "error" : params?.status === "success" ? "success" : null;
  const analyticsRange = control.analytics.range;

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

      <section className="grid gap-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Website Analytics</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">Platform website performance</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Platform website and platform blog events only. Customer store analytics and visitor personal data are not included.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["today", "last_7_days", "last_30_days"] as const).map((range) => (
            <Link
              className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black uppercase tracking-[0.14em] ${
                analyticsRange === range
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
              href={`/admin/platform-website?analyticsRange=${range}`}
              key={range}
            >
              {range.replaceAll("_", " ")}
            </Link>
          ))}
          <span className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Custom range reserved
          </span>
        </div>

        <AdminStatGrid
          stats={[
            { label: "Homepage views", value: control.analytics.cards.homepageViews },
            { label: "Pricing views", value: control.analytics.cards.pricingViews },
            { label: "Blog views", value: control.analytics.cards.blogViews },
            { label: "Top landing page", value: control.analytics.cards.topLandingPage },
            { label: "Top locale", value: control.analytics.cards.topLocale },
            { label: "Page views", value: control.analytics.pages.totalViews },
            { label: "Post views", value: control.analytics.blog.totalViews },
            { label: "Unique visitors", value: control.analytics.pages.uniqueVisitors ?? "Not tracked" }
          ]}
        />

        <AdminTable headers={["Traffic window", "Views"]}>
          <tr>
            <td className="px-5 py-4 font-bold text-slate-950">Last 24h</td>
            <td className="px-5 py-4 text-slate-600">{control.analytics.traffic.last24h}</td>
          </tr>
          <tr>
            <td className="px-5 py-4 font-bold text-slate-950">Last 7 days</td>
            <td className="px-5 py-4 text-slate-600">{control.analytics.traffic.last7Days}</td>
          </tr>
          <tr>
            <td className="px-5 py-4 font-bold text-slate-950">Last 30 days</td>
            <td className="px-5 py-4 text-slate-600">{control.analytics.traffic.last30Days}</td>
          </tr>
        </AdminTable>

        <div className="grid gap-5 xl:grid-cols-2">
          <AdminTable headers={["Top pages", "Views"]}>
            <AnalyticsRows empty="No platform page views yet." metrics={control.analytics.pages.topPages} />
          </AdminTable>

          <AdminTable headers={["Views by locale", "Views"]}>
            <AnalyticsRows empty="No locale analytics yet." metrics={control.analytics.pages.viewsByLocale} />
          </AdminTable>

          <AdminTable headers={["Top posts", "Views"]}>
            <AnalyticsRows empty="No platform blog post views yet." metrics={control.analytics.blog.topPosts} />
          </AdminTable>

          <AdminTable headers={["Top referrers", "Views"]}>
            <AnalyticsRows empty="No referrer data yet." metrics={control.analytics.traffic.topReferrers} />
          </AdminTable>

          <AdminTable headers={["Top categories", "Views"]}>
            <AnalyticsRows empty="No category views yet." metrics={control.analytics.blog.topCategories} />
          </AdminTable>

          <AdminTable headers={["Top tags", "Views"]}>
            <AnalyticsRows empty="No tag views yet." metrics={control.analytics.blog.topTags} />
          </AdminTable>
        </div>
      </section>

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
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Advanced Publishing</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">Revisions, approval, and scheduling</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Metadata-only workflow controls for platform pages and platform blog posts. Scheduled publishing does not run automatically in this phase.
          </p>
        </div>

        <AdminStatGrid
          stats={[
            { label: "Pending review", value: control.advancedPublishing.pendingReviewItems.length },
            { label: "Scheduled", value: control.advancedPublishing.scheduledItems.length },
            { label: "Rejected", value: control.advancedPublishing.rejectedItems.length },
            { label: "Recent revisions", value: control.advancedPublishing.recentRevisions.length }
          ]}
        />

        <AdminTable
          empty={!control.advancedPublishing.pendingReviewItems.length ? "No platform content is pending review." : null}
          headers={["Item", "Type", "Status", "Updated", "Actions"]}
        >
          {control.advancedPublishing.pendingReviewItems.map((item) => (
            <tr key={`pending-${item.contentType}-${item.contentId}`}>
              <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
              <td className="px-5 py-4 text-slate-600">{contentTypeLabel(item.contentType)}</td>
              <td className="px-5 py-4">
                <AdminBadge tone="amber">{item.approvalStatus}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(item.updatedAt)}</td>
              <td className="px-5 py-4">
                <div className="flex min-w-48 flex-wrap gap-2">
                  <form action={approvePlatformContentAction}>
                    <AdvancedPublishingHiddenFields contentId={item.contentId} contentType={item.contentType} />
                    <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                      Approve
                    </button>
                  </form>
                  <form action={rejectPlatformContentAction}>
                    <AdvancedPublishingHiddenFields contentId={item.contentId} contentType={item.contentType} />
                    <button className="h-9 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                      Reject
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>

        <AdminTable
          empty={!control.advancedPublishing.scheduledItems.length ? "No platform content has a scheduled publish date." : null}
          headers={["Item", "Type", "Scheduled", "Approval", "Actions"]}
        >
          {control.advancedPublishing.scheduledItems.map((item) => (
            <tr key={`scheduled-${item.contentType}-${item.contentId}`}>
              <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
              <td className="px-5 py-4 text-slate-600">{contentTypeLabel(item.contentType)}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(item.scheduledPublishAt)}</td>
              <td className="px-5 py-4">
                <AdminBadge tone={toneForStatus(item.approvalStatus)}>{item.approvalStatus}</AdminBadge>
              </td>
              <td className="px-5 py-4">
                <form action={cancelPlatformContentScheduleAction}>
                  <AdvancedPublishingHiddenFields contentId={item.contentId} contentType={item.contentType} />
                  <button className="h-9 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                    Cancel schedule
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </AdminTable>

        <AdminTable
          empty={!control.advancedPublishing.rejectedItems.length ? "No platform content is rejected." : null}
          headers={["Item", "Type", "Status", "Updated", "Actions"]}
        >
          {control.advancedPublishing.rejectedItems.map((item) => (
            <tr key={`rejected-${item.contentType}-${item.contentId}`}>
              <td className="px-5 py-4 font-bold text-slate-950">{item.label}</td>
              <td className="px-5 py-4 text-slate-600">{contentTypeLabel(item.contentType)}</td>
              <td className="px-5 py-4">
                <AdminBadge tone="red">{item.approvalStatus}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(item.updatedAt)}</td>
              <td className="px-5 py-4">
                <form action={approvePlatformContentAction}>
                  <AdvancedPublishingHiddenFields contentId={item.contentId} contentType={item.contentType} />
                  <button className="h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                    Approve
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </AdminTable>

        <AdminTable
          empty={!control.advancedPublishing.recentRevisions.length ? "No platform content revisions yet." : null}
          headers={["Revision", "Type", "Content ID", "Created", "Note"]}
        >
          {control.advancedPublishing.recentRevisions.map((revision) => (
            <tr key={revision.id}>
              <td className="px-5 py-4 font-bold text-slate-950">#{revision.revisionNumber}</td>
              <td className="px-5 py-4 text-slate-600">{contentTypeLabel(revision.contentType)}</td>
              <td className="px-5 py-4 text-xs font-semibold text-slate-500">{revision.contentId}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(revision.createdAt)}</td>
              <td className="px-5 py-4 text-slate-600">{revision.note ?? "Snapshot"}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Platform Blog Foundation</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">SHASTORE Platform Blog</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Platform public website blog posts only. Published posts render on `/blog`; draft and archived posts stay admin-only.
          </p>
        </div>

        <AdminStatGrid
          stats={[
            { label: "Total posts", value: control.blogFoundation.totalPosts },
            { label: "Draft posts", value: control.blogFoundation.draftPosts },
            { label: "Published posts", value: control.blogFoundation.publishedPosts },
            { label: "Archived posts", value: control.blogFoundation.archivedPosts },
            { label: "Categories", value: control.blogFoundation.totalCategories },
            { label: "Tags", value: control.blogFoundation.totalTags }
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
          headers={["Post", "Status", "Author", "Updated", "Edit metadata", "Open", "Workflow"]}
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
                <div className="grid min-w-40 gap-2">
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
                    href={`/admin/platform-website/blog/${post.id}`}
                  >
                    Edit
                  </Link>
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-full border border-purple-200 bg-purple-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-purple-700"
                    href={`/admin/platform-website/blog/preview/${post.id}`}
                  >
                    Preview
                  </Link>
                </div>
              </td>
              <td className="px-5 py-4">
                <div className="grid min-w-40 gap-2">
                {post.status === "draft" ? (
                  <form action={publishPlatformBlogPostAction}>
                    <input name="postId" type="hidden" value={post.id} />
                    <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
                      Publish
                    </button>
                  </form>
                ) : null}
                {post.status === "published" ? (
                  <form action={archivePlatformBlogPostAction}>
                    <input name="postId" type="hidden" value={post.id} />
                    <button className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                      Archive
                    </button>
                  </form>
                ) : null}
                {post.status === "archived" ? (
                  <form action={revertPlatformBlogPostDraftAction}>
                    <input name="postId" type="hidden" value={post.id} />
                    <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
                      Revert to Draft
                    </button>
                  </form>
                ) : null}
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="grid gap-4 rounded-[2rem] border border-emerald-100 bg-emerald-50 p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Categories Management</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-emerald-700">
                Categories organize platform blog navigation and SEO only.
              </p>
            </div>
            <form action={createPlatformBlogCategoryAction} className="grid gap-3">
              <input className="h-10 rounded-2xl border border-emerald-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={120} name="categoryName" placeholder="Category name" required type="text" />
              <input className="h-10 rounded-2xl border border-emerald-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={120} name="categorySlug" placeholder="category-slug" type="text" />
              <textarea className="min-h-16 rounded-2xl border border-emerald-100 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-700" maxLength={500} name="categoryDescription" placeholder="Description" />
              <div className="grid gap-2 md:grid-cols-2">
                <input className="h-10 rounded-2xl border border-emerald-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={70} name="categorySeoTitle" placeholder="SEO title" type="text" />
                <input className="h-10 rounded-2xl border border-emerald-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={160} name="categorySeoDescription" placeholder="SEO description" type="text" />
              </div>
              <input name="categoryTranslations" type="hidden" value="{}" />
              <button className="h-10 w-fit rounded-full bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.16em] text-white" type="submit">
                Create category
              </button>
            </form>
          </div>

          <div className="grid gap-4 rounded-[2rem] border border-purple-100 bg-purple-50 p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Tags Management</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-purple-700">
                Tags add lightweight filtering for platform blog posts.
              </p>
            </div>
            <form action={createPlatformBlogTagAction} className="grid gap-3">
              <input className="h-10 rounded-2xl border border-purple-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={120} name="tagName" placeholder="Tag name" required type="text" />
              <input className="h-10 rounded-2xl border border-purple-100 bg-white px-3 text-sm font-semibold text-slate-700" maxLength={120} name="tagSlug" placeholder="tag-slug" type="text" />
              <input name="tagTranslations" type="hidden" value="{}" />
              <button className="h-10 w-fit rounded-full bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.16em] text-white" type="submit">
                Create tag
              </button>
            </form>
          </div>
        </div>

        <AdminTable
          empty={!control.blogFoundation.categories.length ? "No platform blog categories yet." : null}
          headers={["Category", "Status", "Posts", "SEO", "Translations", "Actions"]}
        >
          {control.blogFoundation.categories.map((category) => (
            <tr key={category.id}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{category.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">/blog/category/{category.slug}</p>
                {category.description ? <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{category.description}</p> : null}
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={category.status === "active" ? "green" : "red"}>{category.status}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{category.postCount}</td>
              <td className="px-5 py-4 text-xs leading-5 text-slate-500">
                <p><span className="font-black text-slate-700">Title:</span> {category.seoTitle ?? "Missing"}</p>
                <p><span className="font-black text-slate-700">Description:</span> {category.seoDescription ?? "Missing"}</p>
              </td>
              <td className="px-5 py-4">
                <textarea className="min-h-20 min-w-64 rounded-2xl border border-slate-200 px-3 py-2 font-mono text-xs text-slate-600" form={`category-${category.id}`} name="categoryTranslations" defaultValue={JSON.stringify(category.translations, null, 2)} />
              </td>
              <td className="px-5 py-4">
                <div className="grid min-w-72 gap-2">
                  <form action={updatePlatformBlogCategoryAction} className="grid gap-2" id={`category-${category.id}`}>
                    <input name="categoryId" type="hidden" value={category.id} />
                    <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={120} name="categoryName" placeholder="Name" type="text" defaultValue={category.name} />
                    <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={120} name="categorySlug" placeholder="Slug" type="text" defaultValue={category.slug} />
                    <textarea className="min-h-14 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold leading-5 text-slate-700" maxLength={500} name="categoryDescription" placeholder="Description" defaultValue={category.description ?? ""} />
                    <div className="grid gap-2 md:grid-cols-2">
                      <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={70} name="categorySeoTitle" placeholder="SEO title" type="text" defaultValue={category.seoTitle ?? ""} />
                      <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={160} name="categorySeoDescription" placeholder="SEO description" type="text" defaultValue={category.seoDescription ?? ""} />
                    </div>
                    <button className="h-9 w-fit rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" disabled={category.status === "archived"} type="submit">
                      Save category
                    </button>
                  </form>
                  {category.status === "active" ? (
                    <form action={archivePlatformBlogCategoryAction}>
                      <input name="categoryId" type="hidden" value={category.id} />
                      <button className="h-9 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                        Archive category
                      </button>
                    </form>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>

        <AdminTable
          empty={!control.blogFoundation.tags.length ? "No platform blog tags yet." : null}
          headers={["Tag", "Status", "Posts", "Translations", "Actions"]}
        >
          {control.blogFoundation.tags.map((tag) => (
            <tr key={tag.id}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{tag.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">/blog/tag/{tag.slug}</p>
              </td>
              <td className="px-5 py-4">
                <AdminBadge tone={tag.status === "active" ? "green" : "red"}>{tag.status}</AdminBadge>
              </td>
              <td className="px-5 py-4 text-slate-600">{tag.postCount}</td>
              <td className="px-5 py-4">
                <textarea className="min-h-20 min-w-64 rounded-2xl border border-slate-200 px-3 py-2 font-mono text-xs text-slate-600" form={`tag-${tag.id}`} name="tagTranslations" defaultValue={JSON.stringify(tag.translations, null, 2)} />
              </td>
              <td className="px-5 py-4">
                <div className="grid min-w-64 gap-2">
                  <form action={updatePlatformBlogTagAction} className="grid gap-2" id={`tag-${tag.id}`}>
                    <input name="tagId" type="hidden" value={tag.id} />
                    <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={120} name="tagName" placeholder="Name" type="text" defaultValue={tag.name} />
                    <input className="h-9 rounded-2xl border border-slate-200 px-3 text-xs font-semibold text-slate-700" maxLength={120} name="tagSlug" placeholder="Slug" type="text" defaultValue={tag.slug} />
                    <button className="h-9 w-fit rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" disabled={tag.status === "archived"} type="submit">
                      Save tag
                    </button>
                  </form>
                  {tag.status === "active" ? (
                    <form action={archivePlatformBlogTagAction}>
                      <input name="tagId" type="hidden" value={tag.id} />
                      <button className="h-9 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                        Archive tag
                      </button>
                    </form>
                  ) : null}
                </div>
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
