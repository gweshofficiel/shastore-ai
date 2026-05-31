import { PageHeader } from "@/components/dashboard/page-header";
import { PageUrlCopyButton } from "@/components/dashboard/page-url-copy-button";
import { RichTextEditor } from "@/components/dashboard/rich-text-editor";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createStoreOwnerPage,
  deleteStoreOwnerPage,
  setStoreOwnerPageStatus,
  updateStoreOwnerPage
} from "@/lib/store-page-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type StorePageRow = {
  canonical_url?: string | null;
  content?: string | null;
  created_at: string;
  id: string;
  noindex?: boolean | null;
  og_description?: string | null;
  og_image_url?: string | null;
  og_title?: string | null;
  page_type: string;
  seo_description?: string | null;
  seo_keywords?: string | null;
  seo_title?: string | null;
  slug: string;
  status: string;
  store_id: string;
  title: string;
  updated_at?: string | null;
  workspace_id: string;
};

type PageActivityRow = {
  action: string;
  created_at: string;
  id: string;
  page_id: string | null;
};

type PagesDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  logs: PageActivityRow[];
  pages: StorePageRow[];
  stores: UserStoreRow[];
};

const pageTypeOptions = [
  { label: "About Us", value: "about" },
  { label: "Contact Us", value: "contact" },
  { label: "FAQ", value: "faq" },
  { label: "Terms & Conditions", value: "terms" },
  { label: "Privacy Policy", value: "privacy" },
  { label: "Shipping Policy", value: "shipping" },
  { label: "Returns Policy", value: "returns" },
  { label: "Custom Page", value: "custom" }
];

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    archived: "Page archived.",
    "create-failed": "Page could not be created. Check the fields and try again.",
    created: "Page created.",
    deleted: "Page deleted.",
    "delete-failed": "Page could not be deleted.",
    "missing-store": "Choose a store before managing pages.",
    "missing-title": "Page title is required.",
    "not-authorized": "You do not have permission to manage that store.",
    published: "Page published.",
    "slug-exists": "That page slug is already used in this store.",
    "status-failed": "Page status could not be updated.",
    unpublished: "Page moved back to draft.",
    "update-failed": "Page could not be updated. Check the fields and try again.",
    updated: "Page updated."
  };

  return status ? messages[status] : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function pageStatusClass(status: string) {
  if (status === "published") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "archived") {
    return "bg-slate-100 text-slate-600";
  }

  return "bg-amber-100 text-amber-700";
}

function publicPageHref(store: UserStoreRow, page: StorePageRow) {
  const slug = store.slug ?? "";
  return slug ? `/store/${slug}/pages/${page.slug}` : "#";
}

function previewPageHref(store: UserStoreRow, page: StorePageRow) {
  return `/dashboard/pages/preview/${page.id}?storeId=${store.id}`;
}

async function getPagesDashboardData({
  search,
  selectedStoreId
}: {
  search?: string;
  selectedStoreId?: string;
}): Promise<PagesDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      error: "Sign in to manage pages.",
      logs: [],
      pages: [],
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return {
      activeStore: null,
      error: "Stores could not be loaded. Please try again.",
      logs: [],
      pages: [],
      stores: []
    };
  }

  const activeStore =
    stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      error: null,
      logs: [],
      pages: [],
      stores
    };
  }

  let pagesQuery = supabase
    .from("store_pages" as never)
    .select("id, workspace_id, store_id, title, slug, content, page_type, status, seo_title, seo_description, seo_keywords, og_title, og_description, og_image_url, canonical_url, noindex, created_at, updated_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id", activeStore.id)
    .order("updated_at" as never, { ascending: false } as never)
    .order("created_at" as never, { ascending: false } as never);

  const searchText = search?.trim();
  if (searchText) {
    pagesQuery = pagesQuery.or(`title.ilike.%${searchText}%,slug.ilike.%${searchText}%` as never);
  }

  const [{ data: pages, error: pagesError }, { data: logs }] = await Promise.all([
    pagesQuery,
    supabase
      .from("page_activity_logs" as never)
      .select("id, page_id, action, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id", activeStore.id)
      .order("created_at" as never, { ascending: false } as never)
      .limit(12)
  ]);

  if (pagesError) {
    return {
      activeStore,
      error: "Pages could not be loaded. Confirm the store pages migration has been applied.",
      logs: [],
      pages: [],
      stores
    };
  }

  return {
    activeStore,
    error: null,
    logs: (logs ?? []) as unknown as PageActivityRow[],
    pages: (pages ?? []) as unknown as StorePageRow[],
    stores
  };
}

function PageFields({ page }: { page?: StorePageRow }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          defaultValue={page?.title ?? ""}
          id={page ? `page-${page.id}-title` : "page-new-title"}
          label="Title"
          maxLength={180}
          name="title"
          placeholder="About Us"
          required
        />
        <Input
          defaultValue={page?.slug ?? ""}
          id={page ? `page-${page.id}-slug` : "page-new-slug"}
          label="Slug"
          maxLength={100}
          name="slug"
          placeholder="about-us"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Page type</span>
          <select
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            defaultValue={page?.page_type ?? "custom"}
            name="pageType"
          >
            {pageTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Status</span>
          <select
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            defaultValue={page?.status ?? "draft"}
            name="status"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>
      <RichTextEditor
        defaultValue={page?.content ?? ""}
        editorKey={page?.id ?? "new"}
        id={page ? `page-${page.id}-content` : "page-new-content"}
        name="content"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          defaultValue={page?.seo_title ?? ""}
          id={page ? `page-${page.id}-seo-title` : "page-new-seo-title"}
          label="SEO title"
          maxLength={180}
          name="seoTitle"
          placeholder="About our store"
        />
        <Textarea
          defaultValue={page?.seo_description ?? ""}
          id={page ? `page-${page.id}-seo-description` : "page-new-seo-description"}
          label="SEO description"
          maxLength={300}
          name="seoDescription"
          placeholder="Short search description for this page."
          rows={3}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          defaultValue={page?.seo_keywords ?? ""}
          id={page ? `page-${page.id}-seo-keywords` : "page-new-seo-keywords"}
          label="SEO keywords"
          maxLength={500}
          name="seoKeywords"
          placeholder="about, brand, store"
        />
        <Input
          defaultValue={page?.canonical_url ?? ""}
          id={page ? `page-${page.id}-canonical-url` : "page-new-canonical-url"}
          label="Canonical URL"
          maxLength={500}
          name="canonicalUrl"
          placeholder="https://example.com/about-us"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          defaultValue={page?.og_title ?? ""}
          id={page ? `page-${page.id}-og-title` : "page-new-og-title"}
          label="OpenGraph title"
          maxLength={180}
          name="ogTitle"
          placeholder="Social preview title"
        />
        <Textarea
          defaultValue={page?.og_description ?? ""}
          id={page ? `page-${page.id}-og-description` : "page-new-og-description"}
          label="OpenGraph description"
          maxLength={320}
          name="ogDescription"
          placeholder="Social preview description."
          rows={3}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <Input
          defaultValue={page?.og_image_url ?? ""}
          id={page ? `page-${page.id}-og-image-url` : "page-new-og-image-url"}
          label="OpenGraph image URL"
          maxLength={1000}
          name="ogImageUrl"
          placeholder="https://..."
        />
        <label className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink shadow-sm">
          <input defaultChecked={page?.noindex === true} name="noindex" type="checkbox" />
          Noindex
        </label>
      </div>
    </>
  );
}

export default async function StorePagesDashboard({
  searchParams
}: {
  searchParams: Promise<{ edit?: string; pages?: string; q?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, logs, pages, stores } = await getPagesDashboardData({
    search: query.q,
    selectedStoreId: query.storeId
  });
  const message = statusMessage(query.pages);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create, preview, publish, and organize store-scoped pages for your public storefront."
        title="Pages"
      />

      {message ? (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {stores.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            No stores in this workspace yet
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Create a store before adding custom pages. Pages are isolated by workspace and store.
          </p>
        </Card>
      ) : null}

      {activeStore ? (
        <>
          <Card className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <form className="grid gap-2" method="get">
              <label className="text-sm font-semibold text-ink" htmlFor="storeId">
                Active store
              </label>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm"
                defaultValue={activeStore.id}
                id="storeId"
                name="storeId"
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.store_name || store.name || store.slug || store.id}
                  </option>
                ))}
              </select>
              {query.q ? <input name="q" type="hidden" value={query.q} /> : null}
              <button className="h-10 rounded-full bg-ink px-4 text-sm font-black text-white" type="submit">
                Switch store
              </button>
            </form>
            <form className="grid gap-2" method="get">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <Input
                defaultValue={query.q ?? ""}
                id="page-search"
                label="Search pages"
                name="q"
                placeholder="Search by title or slug"
              />
              <button className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-ink" type="submit">
                Search
              </button>
            </form>
            <ButtonLink href={`/dashboard/pages?storeId=${activeStore.id}`} variant="secondary">
              Clear
            </ButtonLink>
          </Card>

          <Card className="grid gap-5 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Create Page
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                Add a store page
              </h2>
            </div>
            <form action={createStoreOwnerPage} className="grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <PageFields />
              <div className="flex justify-end">
                <Button type="submit">Create page</Button>
              </div>
            </form>
          </Card>

          <section className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Page Library
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {pages.length} {pages.length === 1 ? "page" : "pages"}
              </h2>
            </div>

            {pages.length === 0 ? (
              <Card className="p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                  No pages yet
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  Create an About, Contact, FAQ, policy, or custom page for this store.
                </p>
              </Card>
            ) : null}

            {pages.map((page) => {
              const isEditing = query.edit === page.id;
              const href = publicPageHref(activeStore, page);

              return (
                <Card className="grid gap-5 p-5" key={page.id}>
                  {isEditing ? (
                    <form action={updateStoreOwnerPage} className="grid gap-4">
                      <input name="storeId" type="hidden" value={activeStore.id} />
                      <input name="pageId" type="hidden" value={page.id} />
                      <PageFields page={page} />
                      <div className="flex flex-wrap justify-end gap-3">
                        <ButtonLink href={`/dashboard/pages?storeId=${activeStore.id}`} variant="ghost">
                          Cancel
                        </ButtonLink>
                        <Button type="submit">Save page</Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                              {page.title}
                            </h3>
                            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${pageStatusClass(page.status)}`}>
                              {page.status}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
                              {page.page_type}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-muted">
                            /pages/{page.slug} - Updated {formatDate(page.updated_at ?? page.created_at)}
                          </p>
                          {page.status === "published" && href !== "#" ? (
                            <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                                Public URL
                              </p>
                              <p className="mt-1 break-all text-sm font-bold text-emerald-900">
                                {href}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-emerald-700">
                                Customers can open this URL now. Header/footer navigation will be handled later.
                              </p>
                            </div>
                          ) : (
                            <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                                Draft preview
                              </p>
                              <p className="mt-1 text-xs font-semibold text-amber-800">
                                This page is private until published. Use Preview to check saved content.
                              </p>
                            </div>
                          )}
                          <p className="mt-2 text-sm leading-6 text-muted">
                            {page.seo_description || "No SEO description yet."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          <ButtonLink href={`/dashboard/pages?storeId=${activeStore.id}&edit=${page.id}`} variant="secondary">
                            Edit
                          </ButtonLink>
                          <ButtonLink href={previewPageHref(activeStore, page)} variant="secondary">
                            Preview
                          </ButtonLink>
                          {page.status === "published" && href !== "#" ? (
                            <>
                              <PageUrlCopyButton path={href} />
                              <ButtonLink href={href} variant="secondary">
                                Open Page
                              </ButtonLink>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <form action={setStoreOwnerPageStatus}>
                          <input name="storeId" type="hidden" value={activeStore.id} />
                          <input name="pageId" type="hidden" value={page.id} />
                          <input name="slug" type="hidden" value={page.slug} />
                          <input name="status" type="hidden" value={page.status === "published" ? "draft" : "published"} />
                          <Button type="submit" variant={page.status === "published" ? "secondary" : "primary"}>
                            {page.status === "published" ? "Unpublish" : "Publish"}
                          </Button>
                        </form>
                        <form action={setStoreOwnerPageStatus}>
                          <input name="storeId" type="hidden" value={activeStore.id} />
                          <input name="pageId" type="hidden" value={page.id} />
                          <input name="slug" type="hidden" value={page.slug} />
                          <input name="status" type="hidden" value="archived" />
                          <Button type="submit" variant="secondary">Archive</Button>
                        </form>
                        <form action={deleteStoreOwnerPage}>
                          <input name="storeId" type="hidden" value={activeStore.id} />
                          <input name="pageId" type="hidden" value={page.id} />
                          <input name="slug" type="hidden" value={page.slug} />
                          <Button type="submit" variant="ghost">Delete</Button>
                        </form>
                      </div>
                    </>
                  )}
                </Card>
              );
            })}
          </section>

          <Card className="p-5">
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">Page Logs</h2>
            <div className="mt-4 grid gap-2">
              {logs.length ? (
                logs.map((log) => (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-muted" key={log.id}>
                    {log.action} - {formatDate(log.created_at)}
                  </p>
                ))
              ) : (
                <p className="text-sm font-semibold text-muted">No page activity yet.</p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-xl font-black tracking-[-0.02em] text-ink">Analytics Placeholder</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Page views and engagement metrics will appear here when storefront analytics events are connected.
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
