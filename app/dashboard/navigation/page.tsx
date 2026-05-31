import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createStoreNavigationLink,
  deleteStoreNavigationLink,
  setStoreNavigationLinkEnabled,
  updateStoreNavigationLink
} from "@/lib/store-navigation-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type NavigationLinkRow = {
  category_id: string | null;
  custom_url: string | null;
  id: string;
  is_enabled: boolean;
  label: string;
  link_type: string;
  location: "footer" | "header";
  page_id: string | null;
  product_id: string | null;
  sort_order: number;
};

type OptionRow = {
  id: string;
  slug?: string | null;
  title: string;
};

type NavigationDashboardData = {
  activeStore: UserStoreRow | null;
  categories: OptionRow[];
  error: string | null;
  links: NavigationLinkRow[];
  pages: OptionRow[];
  products: OptionRow[];
  stores: UserStoreRow[];
};

const linkTypes = [
  { label: "Home", value: "home" },
  { label: "Page", value: "page" },
  { label: "Category", value: "category" },
  { label: "Product", value: "product" },
  { label: "Custom", value: "custom" }
];

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "create-failed": "Navigation link could not be created.",
    created: "Navigation link created.",
    deleted: "Navigation link deleted.",
    "delete-failed": "Navigation link could not be deleted.",
    disabled: "Navigation link disabled.",
    enabled: "Navigation link enabled.",
    "missing-label": "Navigation label is required.",
    "missing-store": "Choose a store before managing navigation.",
    "not-authorized": "You do not have permission to manage that store.",
    updated: "Navigation link updated.",
    "update-failed": "Navigation link could not be updated."
  };

  return status ? messages[status] : null;
}

async function getNavigationDashboardData(selectedStoreId?: string): Promise<NavigationDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      categories: [],
      error: "Sign in to manage navigation.",
      links: [],
      pages: [],
      products: [],
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return {
      activeStore: null,
      categories: [],
      error: "Stores could not be loaded. Please try again.",
      links: [],
      pages: [],
      products: [],
      stores: []
    };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      categories: [],
      error: null,
      links: [],
      pages: [],
      products: [],
      stores
    };
  }

  const [linksResult, pagesResult, categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("store_navigation_links" as never)
      .select("id, label, location, link_type, page_id, category_id, product_id, custom_url, sort_order, is_enabled")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id", activeStore.id)
      .order("location" as never, { ascending: true } as never)
      .order("sort_order" as never, { ascending: true } as never)
      .order("created_at" as never, { ascending: true } as never),
    supabase
      .from("store_pages" as never)
      .select("id, title, slug")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id", activeStore.id)
      .eq("status", "published")
      .order("title" as never, { ascending: true } as never),
    supabase
      .from("store_categories" as never)
      .select("id, name, slug")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .eq("status" as never, "active" as never)
      .order("name" as never, { ascending: true } as never),
    supabase
      .from("store_products" as never)
      .select("id, title, name, slug")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id", activeStore.id)
      .eq("status" as never, "active" as never)
      .order("title" as never, { ascending: true } as never)
  ]);

  if (linksResult.error) {
    return {
      activeStore,
      categories: [],
      error: "Navigation links could not be loaded. Confirm the navigation migration has been applied.",
      links: [],
      pages: [],
      products: [],
      stores
    };
  }

  return {
    activeStore,
    categories: ((categoriesResult.data ?? []) as Array<{ id: string; name?: string | null; slug?: string | null }>).map((category) => ({
      id: category.id,
      slug: category.slug,
      title: category.name || "Category"
    })),
    error: null,
    links: (linksResult.data ?? []) as unknown as NavigationLinkRow[],
    pages: (pagesResult.data ?? []) as unknown as OptionRow[],
    products: ((productsResult.data ?? []) as Array<{ id: string; name?: string | null; slug?: string | null; title?: string | null }>).map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title || product.name || "Product"
    })),
    stores
  };
}

function NavigationFields({
  categories,
  link,
  pages,
  products
}: {
  categories: OptionRow[];
  link?: NavigationLinkRow;
  pages: OptionRow[];
  products: OptionRow[];
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Input
          defaultValue={link?.label ?? ""}
          id={link ? `navigation-${link.id}-label` : "navigation-new-label"}
          label="Label"
          maxLength={120}
          name="label"
          placeholder="About Us"
          required
        />
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Location</span>
          <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm" defaultValue={link?.location ?? "header"} name="location">
            <option value="header">Header Menu</option>
            <option value="footer">Footer Menu</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Link type</span>
          <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm" defaultValue={link?.link_type ?? "home"} name="linkType">
            {linkTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Page</span>
          <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm" defaultValue={link?.page_id ?? ""} name="pageId">
            <option value="">Choose published page</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Category</span>
          <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm" defaultValue={link?.category_id ?? ""} name="categoryId">
            <option value="">Choose category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Product</span>
          <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm" defaultValue={link?.product_id ?? ""} name="productId">
            <option value="">Choose product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_12rem_12rem] md:items-end">
        <Input
          defaultValue={link?.custom_url ?? ""}
          id={link ? `navigation-${link.id}-custom-url` : "navigation-new-custom-url"}
          label="Custom URL"
          maxLength={500}
          name="customUrl"
          placeholder="https://wa.me/212629981789"
        />
        <Input
          defaultValue={String(link?.sort_order ?? 0)}
          id={link ? `navigation-${link.id}-sort-order` : "navigation-new-sort-order"}
          label="Sort order"
          name="sortOrder"
          type="number"
        />
        <label className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink shadow-sm">
          <input defaultChecked={link?.is_enabled ?? true} name="isEnabled" type="checkbox" />
          Enabled
        </label>
      </div>
      <p className="text-xs font-semibold leading-5 text-muted">
        Select the matching Page, Category, or Product when that link type is chosen. Home and Custom links ignore unused selectors.
      </p>
    </>
  );
}

function linkTargetLabel(link: NavigationLinkRow, options: { categories: OptionRow[]; pages: OptionRow[]; products: OptionRow[] }) {
  if (link.link_type === "home") {
    return "Home";
  }
  if (link.link_type === "custom") {
    return link.custom_url || "Custom URL missing";
  }
  if (link.link_type === "page") {
    return options.pages.find((page) => page.id === link.page_id)?.title ?? "Published page missing";
  }
  if (link.link_type === "category") {
    return options.categories.find((category) => category.id === link.category_id)?.title ?? "Category missing";
  }
  if (link.link_type === "product") {
    return options.products.find((product) => product.id === link.product_id)?.title ?? "Product missing";
  }
  return "Not configured";
}

function NavigationSection({
  categories,
  links,
  location,
  pages,
  products,
  storeId,
  title
}: {
  categories: OptionRow[];
  links: NavigationLinkRow[];
  location: "footer" | "header";
  pages: OptionRow[];
  products: OptionRow[];
  storeId: string;
  title: string;
}) {
  const sectionLinks = links.filter((link) => link.location === location);

  return (
    <Card className="grid gap-4 p-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          {title}
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
          {sectionLinks.length} {sectionLinks.length === 1 ? "link" : "links"}
        </h2>
      </div>
      {sectionLinks.length ? (
        sectionLinks.map((link) => (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={link.id}>
            <form action={updateStoreNavigationLink} className="grid gap-4">
              <input name="storeId" type="hidden" value={storeId} />
              <input name="linkId" type="hidden" value={link.id} />
              <NavigationFields categories={categories} link={link} pages={pages} products={products} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-muted">
                  {link.link_type} - {linkTargetLabel(link, { categories, pages, products })} - {link.is_enabled ? "Enabled" : "Disabled"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Save link</Button>
                </div>
              </div>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={setStoreNavigationLinkEnabled}>
                <input name="storeId" type="hidden" value={storeId} />
                <input name="linkId" type="hidden" value={link.id} />
                <input name="isEnabled" type="hidden" value={link.is_enabled ? "false" : "true"} />
                <Button type="submit" variant="secondary">
                  {link.is_enabled ? "Disable" : "Enable"}
                </Button>
              </form>
              <form action={deleteStoreNavigationLink}>
                <input name="storeId" type="hidden" value={storeId} />
                <input name="linkId" type="hidden" value={link.id} />
                <Button type="submit" variant="ghost">Delete</Button>
              </form>
            </div>
          </div>
        ))
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-muted">
          No {title.toLowerCase()} links yet.
        </p>
      )}
    </Card>
  );
}

export default async function StoreNavigationDashboard({
  searchParams
}: {
  searchParams: Promise<{ navigation?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, categories, error, links, pages, products, stores } = await getNavigationDashboardData(query.storeId);
  const message = statusMessage(query.navigation);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Manage header and footer links for your public storefront."
        title="Navigation"
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
            Create a store before managing storefront navigation.
          </p>
        </Card>
      ) : null}

      {activeStore ? (
        <>
          <Card className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
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
              <Button type="submit">Switch store</Button>
            </form>
            <ButtonLink href="/dashboard/pages" variant="secondary">
              Manage Pages
            </ButtonLink>
          </Card>

          <Card className="grid gap-5 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Add Link
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                Create navigation link
              </h2>
            </div>
            <form action={createStoreNavigationLink} className="grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <NavigationFields categories={categories} pages={pages} products={products} />
              <div className="flex justify-end">
                <Button type="submit">Add link</Button>
              </div>
            </form>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <NavigationSection
              categories={categories}
              links={links}
              location="header"
              pages={pages}
              products={products}
              storeId={activeStore.id}
              title="Header Menu"
            />
            <NavigationSection
              categories={categories}
              links={links}
              location="footer"
              pages={pages}
              products={products}
              storeId={activeStore.id}
              title="Footer Menu"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
