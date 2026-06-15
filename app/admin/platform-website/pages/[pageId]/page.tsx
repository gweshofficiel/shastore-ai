import Link from "next/link";
import { AdminHeader, formatAdminDate } from "@/components/admin/admin-control";
import { Card } from "@/components/ui/card";
import { getPlatformPageEditorContent } from "@/src/lib/platform-website/platform-content-storage";
import { PlatformPageEditorForm } from "./platform-page-editor-form";

export default async function AdminPlatformPageEditorPage({
  params
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = await getPlatformPageEditorContent(pageId);

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
      </Card>

      <PlatformPageEditorForm page={page} />
    </div>
  );
}
