import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createStoreLegalPage,
  setStoreLegalPageStatus,
  updateStoreLegalPage
} from "@/lib/store-legal-page-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type LegalPageType = "privacy" | "returns" | "shipping" | "terms";

type LegalPageRow = {
  content: string | null;
  created_at: string;
  id: string;
  page_type: LegalPageType;
  slug: string;
  status: string;
  title: string;
  updated_at: string | null;
};

type LegalPagesDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  pages: LegalPageRow[];
  stores: UserStoreRow[];
};

const legalPageOptions: Array<{
  defaultSlug: string;
  defaultTitle: string;
  description: string;
  label: string;
  type: LegalPageType;
}> = [
  {
    defaultSlug: "privacy-policy",
    defaultTitle: "Privacy Policy",
    description: "Explain how customer data is collected, used, and protected.",
    label: "Privacy Policy",
    type: "privacy"
  },
  {
    defaultSlug: "terms-and-conditions",
    defaultTitle: "Terms & Conditions",
    description: "Publish purchase terms, store policies, and customer responsibilities.",
    label: "Terms & Conditions",
    type: "terms"
  },
  {
    defaultSlug: "refund-policy",
    defaultTitle: "Refund Policy",
    description: "Describe refunds, returns, exchanges, and eligibility rules.",
    label: "Refund Policy",
    type: "returns"
  },
  {
    defaultSlug: "shipping-policy",
    defaultTitle: "Shipping Policy",
    description: "Describe shipping regions, timelines, fees, and delivery expectations.",
    label: "Shipping Policy",
    type: "shipping"
  }
];

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "create-failed": "Legal page could not be created.",
    created: "Legal page created.",
    "missing-fields": "Legal page title and type are required.",
    "missing-store": "Choose a store before managing legal pages.",
    "not-authorized": "You do not have permission to manage that store.",
    published: "Legal page published.",
    "slug-exists": "That legal page slug is already used in this store.",
    "status-failed": "Legal page status could not be updated.",
    unpublished: "Legal page moved back to draft.",
    updated: "Legal page updated.",
    "update-failed": "Legal page could not be updated."
  };

  return status ? messages[status] : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not updated yet";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function statusClass(status: string) {
  return status === "published"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
}

async function getLegalPagesDashboardData(selectedStoreId?: string): Promise<LegalPagesDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { activeStore: null, error: "Sign in to manage legal pages.", pages: [], stores: [] };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return { activeStore: null, error: "Stores could not be loaded.", pages: [], stores: [] };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, error: null, pages: [], stores };
  }

  const { data, error } = await supabase
    .from("store_pages" as never)
    .select("id, title, slug, content, page_type, status, created_at, updated_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .in("page_type" as never, ["privacy", "returns", "shipping", "terms"] as never)
    .order("updated_at" as never, { ascending: false } as never)
    .order("created_at" as never, { ascending: false } as never);

  if (error) {
    return {
      activeStore,
      error: "Legal pages could not be loaded. Confirm the store pages migration has been applied.",
      pages: [],
      stores
    };
  }

  return {
    activeStore,
    error: null,
    pages: (data ?? []) as unknown as LegalPageRow[],
    stores
  };
}

function legalPageForType(pages: LegalPageRow[], type: LegalPageType) {
  return pages.find((page) => page.page_type === type) ?? null;
}

export default async function LegalPagesDashboard({
  searchParams
}: {
  searchParams: Promise<{ edit?: string; legal?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, pages, stores } = await getLegalPagesDashboardData(query.storeId);
  const message = statusMessage(query.legal);
  const editingPage = query.edit ? pages.find((page) => page.id === query.edit) ?? null : null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create and publish legal pages for your public storefront."
        title="Legal Pages"
      />

      {message ? (
        <Card className="border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          {message}
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          {error}
        </Card>
      ) : null}

      {stores.length ? (
        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-bold text-ink">
              <span>Store</span>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink outline-none"
                defaultValue={activeStore?.id}
                name="storeId"
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.store_name || store.name || store.slug || store.id}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              View store
            </Button>
          </form>
        </Card>
      ) : null}

      {activeStore ? (
        <div className="grid gap-5">
          {legalPageOptions.map((option) => {
            const page = editingPage?.page_type === option.type ? editingPage : legalPageForType(pages, option.type);
            const action = page ? updateStoreLegalPage : createStoreLegalPage;

            return (
              <Card className="p-5" key={option.type}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(page?.status ?? "draft")}`}>
                      {page?.status ?? "draft"}
                    </span>
                    <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
                      {option.label}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-muted">
                      {option.description}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Updated {formatDate(page?.updated_at ?? page?.created_at)}
                    </p>
                  </div>
                  {page?.status === "published" && activeStore.slug ? (
                    <a
                      className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted"
                      href={`/store/${activeStore.slug}/pages/${page.slug}`}
                      target="_blank"
                    >
                      View
                    </a>
                  ) : null}
                </div>

                <form action={action} className="mt-5 grid gap-4">
                  <input name="storeId" type="hidden" value={activeStore.id} />
                  <input name="legalType" type="hidden" value={option.type} />
                  {page ? (
                    <>
                      <input name="pageId" type="hidden" value={page.id} />
                      <input name="previousSlug" type="hidden" value={page.slug} />
                    </>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      defaultValue={page?.title ?? option.defaultTitle}
                      id={`${option.type}-title`}
                      label="Title"
                      maxLength={180}
                      name="title"
                      required
                    />
                    <Input
                      defaultValue={page?.slug ?? option.defaultSlug}
                      id={`${option.type}-slug`}
                      label="Slug"
                      maxLength={100}
                      name="slug"
                      required
                    />
                  </div>
                  <Textarea
                    defaultValue={page?.content ?? ""}
                    id={`${option.type}-content`}
                    label="Content"
                    name="content"
                    placeholder={`Write your ${option.label.toLowerCase()} content.`}
                    rows={8}
                  />
                  <label className="grid gap-2 text-sm font-semibold text-ink">
                    <span>Status</span>
                    <select
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                      defaultValue={page?.status ?? "draft"}
                      name="status"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </label>
                  <Button type="submit">
                    {page ? "Save legal page" : "Create legal page"}
                  </Button>
                </form>
                {page ? (
                  <form action={setStoreLegalPageStatus} className="mt-3">
                    <input name="pageId" type="hidden" value={page.id} />
                    <input name="storeId" type="hidden" value={activeStore.id} />
                    <input name="legalType" type="hidden" value={option.type} />
                    <input name="slug" type="hidden" value={page.slug} />
                    <input name="status" type="hidden" value={page.status === "published" ? "draft" : "published"} />
                    <Button type="submit" variant="secondary">
                      {page.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                  </form>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
