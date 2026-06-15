import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import {
  archivePlatformBlogPostAction,
  approvePlatformContentAction,
  cancelPlatformContentScheduleAction,
  publishPlatformBlogPostAction,
  rejectPlatformContentAction,
  revertPlatformBlogPostDraftAction,
  rollbackPlatformContentRevisionAction,
  schedulePlatformContentPublishAction,
  submitPlatformContentForReviewAction
} from "@/lib/admin/platform-website-actions";
import {
  getPlatformBlogPostCategoryIds,
  getPlatformBlogPostForAdmin,
  getPlatformBlogPostTagIds
} from "@/src/lib/platform-website/blog/platform-blog-service";
import { listCategories } from "@/src/lib/platform-website/blog/categories-service";
import { listTags } from "@/src/lib/platform-website/blog/tags-service";
import {
  getPublishingMetadata,
  listRevisions
} from "@/src/lib/platform-website/publishing/revisions-service";
import { PlatformBlogEditorForm } from "./platform-blog-editor-form";

export default async function AdminPlatformBlogEditorPage({
  params,
  searchParams
}: {
  params: Promise<{ postId: string }>;
  searchParams?: Promise<{ message?: string; status?: string }>;
}) {
  const { postId } = await params;
  const query = await searchParams;
  const [post, categories, tags, selectedCategoryIds, selectedTagIds, revisions, publishingMetadata] = await Promise.all([
    getPlatformBlogPostForAdmin(postId),
    listCategories(),
    listTags(),
    getPlatformBlogPostCategoryIds(postId),
    getPlatformBlogPostTagIds(postId),
    listRevisions("platform_blog_post", postId),
    getPublishingMetadata("platform_blog_post", postId)
  ]);
  const actionMessage = query?.message;
  const actionStatus = query?.status === "error" ? "error" : query?.status === "success" ? "success" : null;

  if (!post) {
    return (
      <div className="grid gap-6">
        <AdminHeader
          description="The requested platform blog post could not be loaded from platform_blog_posts."
          title="Platform Blog Editor"
        />
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Editor error</p>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">Post not found</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            No platform blog post record matched this editor URL. Customer store blogs and public routes were not changed.
          </p>
          <Link
            className="mt-6 inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600"
            href="/admin/platform-website"
          >
            Back to platform website
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Edit SHASTORE platform public website blog posts only. This does not touch customer store blogs, Store Builder, billing, hosting, domains, payments, or AI control."
        title={`Edit ${post.title}`}
      />

      <Card className="grid gap-3 p-5 text-sm leading-6 text-slate-500 lg:p-6">
        <p><span className="font-black text-slate-800">Slug:</span> {post.slug}</p>
        <p><span className="font-black text-slate-800">Author:</span> {post.authorName}</p>
        <p><span className="font-black text-slate-800">Published:</span> {formatAdminDate(post.publishedAt)}</p>
        <p><span className="font-black text-slate-800">Last updated:</span> {formatAdminDate(post.updatedAt)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AdminBadge tone={post.status === "published" ? "green" : post.status === "archived" ? "red" : "amber"}>
            {post.status}
          </AdminBadge>
          <Link
            className="inline-flex h-10 w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-blue-700"
            href={`/admin/platform-website/blog/preview/${post.id}`}
          >
            Preview post
          </Link>
          <Link
            className="inline-flex h-10 w-fit items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600"
            href="/admin/platform-website"
          >
            Back to platform website
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {post.status === "draft" ? (
            <form action={publishPlatformBlogPostAction}>
              <input name="postId" type="hidden" value={post.id} />
              <button className="h-10 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-emerald-700" type="submit">
                Publish
              </button>
            </form>
          ) : null}
          {post.status === "published" ? (
            <form action={archivePlatformBlogPostAction}>
              <input name="postId" type="hidden" value={post.id} />
              <button className="h-10 rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-red-700" type="submit">
                Archive
              </button>
            </form>
          ) : null}
          {post.status === "archived" ? (
            <form action={revertPlatformBlogPostDraftAction}>
              <input name="postId" type="hidden" value={post.id} />
              <button className="h-10 rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-amber-700" type="submit">
                Revert to Draft
              </button>
            </form>
          ) : null}
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
            Scheduling is metadata-only in this phase. Published platform blog posts remain public only through the existing status rule.
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
            <input name="contentId" type="hidden" value={post.id} />
            <input name="contentType" type="hidden" value="platform_blog_post" />
            <button className="h-10 rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-amber-700" type="submit">
              Submit for review
            </button>
          </form>
          <form action={approvePlatformContentAction}>
            <input name="contentId" type="hidden" value={post.id} />
            <input name="contentType" type="hidden" value="platform_blog_post" />
            <button className="h-10 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-emerald-700" type="submit">
              Approve
            </button>
          </form>
          <form action={rejectPlatformContentAction}>
            <input name="contentId" type="hidden" value={post.id} />
            <input name="contentType" type="hidden" value="platform_blog_post" />
            <button className="h-10 rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-red-700" type="submit">
              Reject
            </button>
          </form>
        </div>
        <form action={schedulePlatformContentPublishAction} className="flex flex-wrap items-end gap-3">
          <input name="contentId" type="hidden" value={post.id} />
          <input name="contentType" type="hidden" value="platform_blog_post" />
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Scheduled publish date</span>
            <input className="h-10 rounded-2xl border border-slate-200 px-3 text-sm font-semibold text-slate-700" name="scheduledPublishAt" type="datetime-local" />
          </label>
          <button className="h-10 rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.16em] text-blue-700" type="submit">
            Schedule publish
          </button>
        </form>
        <form action={cancelPlatformContentScheduleAction}>
          <input name="contentId" type="hidden" value={post.id} />
          <input name="contentType" type="hidden" value="platform_blog_post" />
          <button className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600" type="submit">
            Cancel scheduled publish
          </button>
        </form>
        <AdminTable empty={!revisions.length ? "No revisions have been created for this blog post yet." : null} headers={["Revision", "Created", "Note", "Rollback"]}>
          {revisions.map((revision) => (
            <tr key={revision.id}>
              <td className="px-5 py-4 font-bold text-slate-950">#{revision.revisionNumber}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(revision.createdAt)}</td>
              <td className="px-5 py-4 text-slate-600">{revision.note ?? "Snapshot"}</td>
              <td className="px-5 py-4">
                <form action={rollbackPlatformContentRevisionAction}>
                  <input name="contentId" type="hidden" value={post.id} />
                  <input name="contentType" type="hidden" value="platform_blog_post" />
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

      <PlatformBlogEditorForm
        categories={categories.filter((category) => category.status === "active")}
        post={post}
        selectedCategoryIds={selectedCategoryIds}
        selectedTagIds={selectedTagIds}
        tags={tags.filter((tag) => tag.status === "active")}
      />
    </div>
  );
}
