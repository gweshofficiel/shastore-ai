import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createStoreOwnerCategory,
  updateStoreOwnerCategory
} from "@/lib/category-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type CategoryRow = {
  canonical_url?: string | null;
  description?: string | null;
  id: string;
  image_url?: string | null;
  name: string;
  noindex?: boolean | null;
  og_description?: string | null;
  og_image_url?: string | null;
  og_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  seo_title?: string | null;
  slug: string;
  sort_order?: number | null;
  status?: string | null;
  store_id: string;
  workspace_id?: string | null;
};

type CategoriesDashboardData = {
  activeStore: UserStoreRow | null;
  categories: CategoryRow[];
  error: string | null;
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "create-failed": "Category could not be created. Check the fields and try again.",
    created: "Category created.",
    "missing-name": "Category name is required.",
    "missing-store": "Choose a store before managing categories.",
    "not-authorized": "You do not have permission to manage that store.",
    "slug-exists": "That category slug is already used in this store.",
    "update-failed": "Category could not be updated. Check the fields and try again.",
    updated: "Category updated."
  };

  return status ? messages[status] : null;
}

async function getCategoriesDashboardData(
  selectedStoreId?: string
): Promise<CategoriesDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      categories: [],
      error: "Sign in to manage categories.",
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(
    supabase,
    user.id,
    workspaceId
  );

  if (storesError) {
    return {
      activeStore: null,
      categories: [],
      error: "Stores could not be loaded. Please try again.",
      stores: []
    };
  }

  const activeStore =
    stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      categories: [],
      error: null,
      stores
    };
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("store_categories" as never)
    .select("id, workspace_id, store_id, name, slug, description, image_url, status, sort_order, seo_title, seo_description, seo_keywords, og_title, og_description, og_image_url, canonical_url, noindex")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id", activeStore.id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (categoriesError) {
    return {
      activeStore,
      categories: [],
      error: "Categories could not be loaded. Confirm the categories migration has been applied.",
      stores
    };
  }

  return {
    activeStore,
    categories: (categories ?? []) as unknown as CategoryRow[],
    error: null,
    stores
  };
}

function categoryStatus(category?: CategoryRow) {
  return category?.status === "inactive" ? "inactive" : "active";
}

function CategoryFields({ category }: { category?: CategoryRow }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          defaultValue={category?.name ?? ""}
          id={category ? `category-${category.id}-name` : "category-new-name"}
          label="Name"
          maxLength={140}
          name="name"
          placeholder="Summer essentials"
          required
        />
        <Input
          defaultValue={category?.slug ?? ""}
          id={category ? `category-${category.id}-slug` : "category-new-slug"}
          label="Slug"
          maxLength={90}
          name="slug"
          placeholder="summer-essentials"
        />
      </div>
      <Textarea
        defaultValue={category?.description ?? ""}
        id={category ? `category-${category.id}-description` : "category-new-description"}
        label="Description"
        maxLength={1000}
        name="description"
        placeholder="Describe what belongs in this category."
        rows={3}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Input
          defaultValue={category?.image_url ?? ""}
          id={category ? `category-${category.id}-image` : "category-new-image"}
          label="Image URL"
          maxLength={1000}
          name="imageUrl"
          placeholder="https://..."
        />
        <Input
          defaultValue={String(category?.sort_order ?? 0)}
          id={category ? `category-${category.id}-sort` : "category-new-sort"}
          label="Sort order"
          min="0"
          name="sortOrder"
          step="1"
          type="number"
        />
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Status</span>
          <select
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            defaultValue={categoryStatus(category)}
            name="status"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
        <div>
          <p className="text-sm font-black text-ink">SEO</p>
          <p className="mt-1 text-xs font-semibold text-muted">
            Optional search and social metadata. Empty fields fall back to category name and description.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            defaultValue={category?.seo_title ?? ""}
            id={category ? `category-${category.id}-seo-title` : "category-new-seo-title"}
            label="SEO title"
            maxLength={180}
            name="seoTitle"
            placeholder={category?.name ?? "Category search title"}
          />
          <Input
            defaultValue={category?.seo_keywords ?? ""}
            id={category ? `category-${category.id}-seo-keywords` : "category-new-seo-keywords"}
            label="SEO keywords"
            maxLength={500}
            name="seoKeywords"
            placeholder="keyword, category, collection"
          />
        </div>
        <Textarea
          defaultValue={category?.seo_description ?? ""}
          id={category ? `category-${category.id}-seo-description` : "category-new-seo-description"}
          label="SEO description"
          maxLength={320}
          name="seoDescription"
          placeholder="Search result description."
          rows={3}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            defaultValue={category?.og_title ?? ""}
            id={category ? `category-${category.id}-og-title` : "category-new-og-title"}
            label="OpenGraph title"
            maxLength={180}
            name="ogTitle"
            placeholder="Social preview title"
          />
          <Textarea
            defaultValue={category?.og_description ?? ""}
            id={category ? `category-${category.id}-og-description` : "category-new-og-description"}
            label="OpenGraph description"
            maxLength={320}
            name="ogDescription"
            placeholder="Social preview description."
            rows={3}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Input
            defaultValue={category?.og_image_url ?? ""}
            id={category ? `category-${category.id}-og-image-url` : "category-new-og-image-url"}
            label="OpenGraph image URL"
            maxLength={1000}
            name="ogImageUrl"
            placeholder="https://..."
          />
          <Input
            defaultValue={category?.canonical_url ?? ""}
            id={category ? `category-${category.id}-canonical-url` : "category-new-canonical-url"}
            label="Canonical URL"
            maxLength={500}
            name="canonicalUrl"
            placeholder="https://example.com/category"
          />
          <label className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink shadow-sm">
            <input defaultChecked={category?.noindex === true} name="noindex" type="checkbox" />
            Noindex
          </label>
        </div>
      </div>
    </>
  );
}

export default async function CategoriesPage({
  searchParams
}: {
  searchParams: Promise<{ categories?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, categories, error, stores } = await getCategoriesDashboardData(query.storeId);
  const message = statusMessage(query.categories);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={
          activeStore ? (
            <ButtonLink href={`/dashboard/products?storeId=${activeStore.id}`} variant="secondary">
              Products
            </ButtonLink>
          ) : null
        }
        description="Create store-scoped categories and collections for storefront catalog browsing."
        title="Categories"
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
            Create a store before adding categories. Categories are isolated by workspace and store.
          </p>
        </Card>
      ) : null}

      {activeStore ? (
        <>
          <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Active Store
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {activeStore.store_name || activeStore.name || "Workspace store"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Categories created here are scoped to this store only.
              </p>
            </div>
            <form className="flex flex-col gap-3 sm:min-w-[260px]" method="get">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Switch store</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  defaultValue={activeStore.id}
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
                View categories
              </Button>
            </form>
          </Card>

          <Card className="grid gap-5 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Create Category
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                Add a catalog category
              </h2>
            </div>
            <form action={createStoreOwnerCategory} className="grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <CategoryFields />
              <div className="flex justify-end">
                <Button type="submit">Create category</Button>
              </div>
            </form>
          </Card>

          <section className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Category List
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {categories.length} {categories.length === 1 ? "category" : "categories"}
              </h2>
            </div>

            {categories.length === 0 ? (
              <Card className="p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                  No categories yet
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  Create categories, then assign products from the products dashboard.
                </p>
              </Card>
            ) : null}

            {categories.map((category) => (
              <Card key={category.id} className="grid gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                        {category.name}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
                          categoryStatus(category) === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {categoryStatus(category)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-muted">/{category.slug}</p>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                      {category.description || "No description yet."}
                    </p>
                  </div>
                  {category.image_url ? (
                    <img
                      alt={category.name}
                      className="h-24 w-32 rounded-2xl border border-slate-200 object-cover"
                      src={category.image_url}
                    />
                  ) : null}
                </div>
                <details className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-black text-ink">
                    Edit category
                  </summary>
                  <form action={updateStoreOwnerCategory} className="mt-4 grid gap-4">
                    <input name="storeId" type="hidden" value={activeStore.id} />
                    <input name="categoryId" type="hidden" value={category.id} />
                    <CategoryFields category={category} />
                    <div className="flex justify-end">
                      <Button type="submit" variant="secondary">
                        Save category
                      </Button>
                    </div>
                  </form>
                </details>
              </Card>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
