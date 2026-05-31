import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { recordMonitoringEventSafe } from "@/lib/monitoring/events";
import { preparePageContentForRender } from "@/lib/store-pages/content";
import {
  assertStoreAccessInWorkspace,
  getWorkspaceDataContext
} from "@/lib/workspaces/data-access";

export const dynamic = "force-dynamic";

type PagePreviewProps = {
  params: Promise<{ pageId: string }>;
  searchParams: Promise<{ storeId?: string }>;
};

type StorePagePreviewRow = {
  content: string | null;
  id: string;
  page_type: string;
  slug: string;
  status: string;
  store_id: string;
  title: string;
  workspace_id: string;
};

function cleanText(value: string | undefined, maxLength = 100) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export default async function DashboardPagePreview({ params, searchParams }: PagePreviewProps) {
  const { pageId } = await params;
  const query = await searchParams;
  const storeId = cleanText(query.storeId, 80);

  if (!storeId) {
    notFound();
  }

  const { supabase, user, workspaceId } = await getWorkspaceDataContext({
    permission: "can_edit_stores",
    redirectTo: "/dashboard/pages"
  });
  const access = await assertStoreAccessInWorkspace({
    permission: "can_edit_stores",
    storeId,
    supabase,
    userId: user.id,
    workspaceId
  });

  if (!access.allowed) {
    notFound();
  }

  const { data: page, error: pageError } = await supabase
    .from("store_pages" as never)
    .select("id, workspace_id, store_id, title, slug, content, page_type, status")
    .eq("id", pageId)
    .eq("store_id", storeId)
    .eq("workspace_id" as never, workspaceId as never)
    .maybeSingle();

  if (pageError) {
    await recordMonitoringEventSafe({
      entityId: pageId,
      entityType: "store_page",
      eventStatus: "failed",
      eventType: "store_page_action_failed",
      metadata: {
        action: "page_previewed",
        error_code: pageError.code,
        error_details: pageError.details,
        error_hint: pageError.hint,
        error_message: pageError.message,
        route: "/dashboard/pages/preview"
      },
      storeId,
      supabase,
      userId: user.id,
      workspaceId
    });
  }

  if (!page) {
    notFound();
  }

  const previewPage = page as unknown as StorePagePreviewRow;
  const renderedContent = preparePageContentForRender(previewPage.content);
  await supabase.from("page_activity_logs" as never).insert({
    action: "page_previewed",
    page_id: previewPage.id,
    store_id: storeId,
    workspace_id: workspaceId
  } as never);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-ink sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.9)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="text-sm font-black text-muted transition hover:text-ink"
            href={`/dashboard/pages?storeId=${storeId}`}
          >
            Back to Pages
          </Link>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
            Dashboard preview - {previewPage.status}
          </span>
        </div>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Store page preview
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink">
          {previewPage.title}
        </h1>
        <Card className="mt-8 p-5">
          {renderedContent ? (
            <div
              className="prose prose-slate max-w-none text-sm font-semibold leading-7 text-ink"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          ) : (
            <p className="text-sm font-semibold text-muted">This page has no content yet.</p>
          )}
        </Card>
      </article>
    </main>
  );
}
