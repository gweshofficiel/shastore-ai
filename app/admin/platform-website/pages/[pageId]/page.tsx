import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import {
  approvePlatformContentAction,
  cancelPlatformContentScheduleAction,
  rejectPlatformContentAction,
  rollbackPlatformContentRevisionAction,
  schedulePlatformContentPublishAction,
  submitPlatformContentForReviewAction
} from "@/lib/admin/platform-website-actions";
import { listPageBlocks } from "@/src/lib/platform-website/platform-blocks-runtime";
import { getPlatformPageEditorContent } from "@/src/lib/platform-website/platform-content-storage";
import {
  getPublishingMetadata,
  listRevisions
} from "@/src/lib/platform-website/publishing/revisions-service";
import { PlatformPageEditorForm } from "./platform-page-editor-form";

export default async function AdminPlatformPageEditorPage({
  params,
  searchParams
}: {
  params: Promise<{ pageId: string }>;
  searchParams?: Promise<{ message?: string; status?: string }>;
}) {
  const { pageId } = await params;
  const query = await searchParams;
  const [page, blocks, revisions, publishingMetadata] = await Promise.all([
    getPlatformPageEditorContent(pageId),
    listPageBlocks(pageId),
    listRevisions("platform_page", pageId),
    getPublishingMetadata("platform_page", pageId)
  ]);
  const actionMessage = query?.message;
  const actionStatus = query?.status === "error" ? "error" : query?.status === "success" ? "success" : null;

  if (!page) {
    return (
      <div className="grid gap-6">
        <AdminHeader
          description="The requested platform page could not be loaded from platform_pages."
          title="Platform Page Editor"
        />
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Editor error</p>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">Page not found</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            No platform page record matched this editor URL. Public routes were not changed.
          </p>
          <Link
            className="mt-6 inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600"
            href="/admin/platform-website"
          >
            Back to platform pages
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Edit platform_pages content storage only. Saving here does not publish, change page status, or affect public website rendering."
        title={`Edit ${page.title}`}
      />

      <Card className="grid gap-3 p-5 text-sm leading-6 text-slate-500 lg:p-6">
        <p><span className="font-black text-slate-800">Slug:</span> {page.slug}</p>
        <p><span className="font-black text-slate-800">Platform route:</span> {page.routePath}</p>
        <p><span className="font-black text-slate-800">Last updated:</span> {formatAdminDate(page.updatedAt)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            className="inline-flex h-10 w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-blue-700"
            href={`/admin/platform-website/preview/${page.id}`}
          >
            Preview page
          </Link>
          <Link
            className="inline-flex h-10 w-fit items-center rounded-full border border-purple-200 bg-purple-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-purple-700"
            href={`/admin/platform-website/builder/${page.id}`}
          >
            Open landing builder
          </Link>
        </div>
      </Card>

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

      <Card className="grid gap-5 p-5 lg:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Advanced publishing</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">Approval, schedule, and revisions</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Scheduling is metadata-only in this phase. Public rendering still follows the existing published status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminBadge tone={publishingMetadata?.approvalStatus === "approved" ? "green" : publishingMetadata?.approvalStatus === "rejected" ? "red" : "amber"}>
            {publishingMetadata?.approvalStatus ?? "draft"}
          </AdminBadge>
          <AdminBadge tone={publishingMetadata?.scheduledPublishAt ? "blue" : "slate"}>
            Schedule: {formatAdminDate(publishingMetadata?.scheduledPublishAt)}
          </AdminBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={submitPlatformContentForReviewAction}>
            <input name="contentId" type="hidden" value={page.id} />
            <input name="contentType" type="hidden" value="platform_page" />
            <button className="h-10 rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-amber-700" type="submit">
              Submit for review
            </button>
          </form>
          <form action={approvePlatformContentAction}>
            <input name="contentId" type="hidden" value={page.id} />
            <input name="contentType" type="hidden" value="platform_page" />
            <button className="h-10 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-emerald-700" type="submit">
              Approve
            </button>
          </form>
          <form action={rejectPlatformContentAction}>
            <input name="contentId" type="hidden" value={page.id} />
            <input name="contentType" type="hidden" value="platform_page" />
            <button className="h-10 rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-red-700" type="submit">
              Reject
            </button>
          </form>
        </div>
        <form action={schedulePlatformContentPublishAction} className="flex flex-wrap items-end gap-3">
          <input name="contentId" type="hidden" value={page.id} />
          <input name="contentType" type="hidden" value="platform_page" />
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Scheduled publish date</span>
            <input className="h-10 rounded-2xl border border-slate-200 px-3 text-sm font-semibold text-slate-700" name="scheduledPublishAt" type="datetime-local" />
          </label>
          <button className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-blue-700" type="submit">
            Schedule publish
          </button>
        </form>
        <form action={cancelPlatformContentScheduleAction}>
          <input name="contentId" type="hidden" value={page.id} />
          <input name="contentType" type="hidden" value="platform_page" />
          <button className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600" type="submit">
            Cancel scheduled publish
          </button>
        </form>
        <AdminTable empty={!revisions.length ? "No revisions have been created for this page yet." : null} headers={["Revision", "Created", "Note", "Rollback"]}>
          {revisions.map((revision) => (
            <tr key={revision.id}>
              <td className="px-5 py-4 font-bold text-slate-950">#{revision.revisionNumber}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(revision.createdAt)}</td>
              <td className="px-5 py-4 text-slate-600">{revision.note ?? "Snapshot"}</td>
              <td className="px-5 py-4">
                <form action={rollbackPlatformContentRevisionAction}>
                  <input name="contentId" type="hidden" value={page.id} />
                  <input name="contentType" type="hidden" value="platform_page" />
                  <input name="revisionId" type="hidden" value={revision.id} />
                  <button className="h-9 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                    Rollback
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </AdminTable>
      </Card>

      <PlatformPageEditorForm blocks={blocks} page={page} />
    </div>
  );
}
