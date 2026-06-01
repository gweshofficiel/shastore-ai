import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createStoreBlogArticle,
  deleteStoreBlogArticle,
  setStoreBlogArticleStatus,
  updateStoreBlogArticle
} from "@/lib/store-blog-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type BlogArticleRow = {
  content: string;
  cover_image_url: string | null;
  created_at: string;
  excerpt: string | null;
  id: string;
  published_at: string | null;
  slug: string;
  status: string;
  title: string;
  updated_at: string | null;
};

type BlogDashboardData = {
  activeStore: UserStoreRow | null;
  articles: BlogArticleRow[];
  error: string | null;
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    created: "Article created.",
    deleted: "Article deleted.",
    "delete-failed": "Article could not be deleted.",
    "create-failed": "Article could not be created.",
    "missing-fields": "Article title and content are required.",
    "missing-store": "Choose a store before managing articles.",
    "not-authorized": "You do not have permission to manage that store.",
    published: "Article published.",
    "slug-exists": "That article slug is already used in this store.",
    "status-failed": "Article status could not be updated.",
    unpublished: "Article moved back to draft.",
    updated: "Article updated.",
    "update-failed": "Article could not be updated."
  };

  return status ? messages[status] : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not published";
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

function publicArticleHref(store: UserStoreRow, article: BlogArticleRow) {
  return store.slug ? `/store/${store.slug}/blog/${article.slug}` : "#";
}

async function getBlogDashboardData(selectedStoreId?: string): Promise<BlogDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { activeStore: null, articles: [], error: "Sign in to manage articles.", stores: [] };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return { activeStore: null, articles: [], error: "Stores could not be loaded.", stores: [] };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, articles: [], error: null, stores };
  }

  const { data, error } = await supabase
    .from("store_blog_articles" as never)
    .select("id, title, slug, excerpt, content, cover_image_url, status, published_at, created_at, updated_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("updated_at" as never, { ascending: false } as never)
    .order("created_at" as never, { ascending: false } as never);

  if (error) {
    return {
      activeStore,
      articles: [],
      error: "Articles could not be loaded. Confirm the blog migration has been applied.",
      stores
    };
  }

  return {
    activeStore,
    articles: (data ?? []) as unknown as BlogArticleRow[],
    error: null,
    stores
  };
}

function ArticleFields({ article }: { article?: BlogArticleRow }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          defaultValue={article?.title ?? ""}
          id={article ? `article-${article.id}-title` : "article-new-title"}
          label="Title"
          maxLength={180}
          name="title"
          placeholder="How to choose the right product"
          required
        />
        <Input
          defaultValue={article?.slug ?? ""}
          id={article ? `article-${article.id}-slug` : "article-new-slug"}
          label="Slug"
          maxLength={100}
          name="slug"
          placeholder="how-to-choose-the-right-product"
        />
      </div>
      <Textarea
        defaultValue={article?.excerpt ?? ""}
        id={article ? `article-${article.id}-excerpt` : "article-new-excerpt"}
        label="Excerpt"
        maxLength={500}
        name="excerpt"
        placeholder="Short summary for the blog list and SEO previews."
        rows={3}
      />
      <Input
        defaultValue={article?.cover_image_url ?? ""}
        id={article ? `article-${article.id}-cover` : "article-new-cover"}
        label="Cover image URL"
        maxLength={1000}
        name="coverImageUrl"
        placeholder="https://..."
      />
      <Textarea
        defaultValue={article?.content ?? ""}
        id={article ? `article-${article.id}-content` : "article-new-content"}
        label="Content"
        maxLength={12000}
        name="content"
        placeholder="Write the article content."
        required
        rows={10}
      />
      <label className="grid gap-2 text-sm font-semibold text-ink">
        <span>Status</span>
        <select
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          defaultValue={article?.status ?? "draft"}
          name="status"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>
    </>
  );
}

export default async function StoreBlogDashboard({
  searchParams
}: {
  searchParams: Promise<{ blog?: string; edit?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, articles, error, stores } = await getBlogDashboardData(query.storeId);
  const message = statusMessage(query.blog);
  const editingArticle = query.edit
    ? articles.find((article) => article.id === query.edit) ?? null
    : null;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create SEO-friendly articles for your public storefront blog."
        title="Blog / Articles"
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="p-5">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
              {editingArticle ? "Edit article" : "Create article"}
            </h2>
            <form
              action={editingArticle ? updateStoreBlogArticle : createStoreBlogArticle}
              className="mt-5 grid gap-4"
            >
              <input name="storeId" type="hidden" value={activeStore.id} />
              {editingArticle ? (
                <>
                  <input name="articleId" type="hidden" value={editingArticle.id} />
                  <input name="previousSlug" type="hidden" value={editingArticle.slug} />
                </>
              ) : null}
              <ArticleFields article={editingArticle ?? undefined} />
              <Button type="submit">
                {editingArticle ? "Save article" : "Create article"}
              </Button>
            </form>
          </Card>

          <section className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Article Library
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {articles.length} {articles.length === 1 ? "article" : "articles"}
              </h2>
            </div>

            {articles.length ? (
              articles.map((article) => (
                <Card className="grid gap-4 p-5" key={article.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(article.status)}`}>
                        {article.status}
                      </span>
                      <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">
                        {article.title}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        /{article.slug} · Published {formatDate(article.published_at)}
                      </p>
                    </div>
                    {article.status === "published" ? (
                      <a
                        className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted"
                        href={publicArticleHref(activeStore, article)}
                        target="_blank"
                      >
                        View
                      </a>
                    ) : null}
                  </div>
                  {article.excerpt ? (
                    <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-muted">
                      {article.excerpt}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="inline-flex h-10 items-center justify-center rounded-full bg-ink px-4 text-xs font-black uppercase tracking-[0.14em] text-white"
                      href={`/dashboard/blog?storeId=${activeStore.id}&edit=${article.id}`}
                    >
                      Edit
                    </a>
                    <form action={setStoreBlogArticleStatus}>
                      <input name="articleId" type="hidden" value={article.id} />
                      <input name="storeId" type="hidden" value={activeStore.id} />
                      <input name="slug" type="hidden" value={article.slug} />
                      <input
                        name="status"
                        type="hidden"
                        value={article.status === "published" ? "draft" : "published"}
                      />
                      <Button type="submit" variant="secondary">
                        {article.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                    </form>
                    <form action={deleteStoreBlogArticle}>
                      <input name="articleId" type="hidden" value={article.id} />
                      <input name="storeId" type="hidden" value={activeStore.id} />
                      <input name="slug" type="hidden" value={article.slug} />
                      <Button type="submit" variant="secondary">
                        Delete
                      </Button>
                    </form>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="border-dashed p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                  No articles yet
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  Create your first article to add SEO and marketing content to this store.
                </p>
              </Card>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
