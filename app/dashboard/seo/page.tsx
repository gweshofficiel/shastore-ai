import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAppBaseUrl } from "@/lib/deployment/config";
import { getUserPrimaryWorkspaceId, hasPermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import {
  saveBlogSeoOverrideAction,
  savePageSeoOverrideAction,
  saveProductSeoOverrideAction,
  saveStoreSeoSettingsAction
} from "@/lib/store-seo-actions";
import { normalizeStoreSeoSettings } from "@/lib/store-seo";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type SeoPageProps = {
  searchParams: Promise<{
    seoStatus?: string;
    storeId?: string;
  }>;
};

type StoreSeoRow = {
  description: string | null;
  id: string;
  logo_image_url?: string | null;
  name: string;
  og_image_url?: string | null;
  seo_description?: string | null;
  seo_settings?: unknown;
  seo_title?: string | null;
  slug: string;
  workspace_id: string;
};

type ProductSeoRow = {
  canonical_url: string | null;
  description: string | null;
  id: string;
  image_url: string | null;
  noindex: boolean | null;
  og_description: string | null;
  og_image_url: string | null;
  og_title: string | null;
  seo_description: string | null;
  seo_title: string | null;
  slug: string | null;
  title: string;
};

type PageSeoRow = {
  canonical_url: string | null;
  content: string | null;
  id: string;
  noindex: boolean | null;
  og_description: string | null;
  og_image_url: string | null;
  og_title: string | null;
  seo_description: string | null;
  seo_title: string | null;
  slug: string;
  title: string;
};

type BlogSeoRow = {
  canonical_url: string | null;
  content: string | null;
  cover_image_url: string | null;
  excerpt: string | null;
  id: string;
  noindex: boolean | null;
  og_description: string | null;
  og_image_url: string | null;
  og_title: string | null;
  seo_description: string | null;
  seo_title: string | null;
  slug: string;
  title: string;
};

type SeoData = {
  activeStore: UserStoreRow | null;
  articles: BlogSeoRow[];
  error: string | null;
  pages: PageSeoRow[];
  products: ProductSeoRow[];
  storeSeo: StoreSeoRow | null;
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    invalid: "SEO settings were incomplete.",
    "not-authorized": "You do not have permission to manage SEO for that store.",
    "override-failed": "SEO override could not be saved.",
    "override-saved": "SEO override saved.",
    "settings-failed": "SEO settings could not be saved.",
    "settings-saved": "SEO settings saved."
  };

  return status ? messages[status] ?? null : null;
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function truncate(value: string | null | undefined, length = 96) {
  const text = value?.trim() ?? "";
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

async function getSeoData(selectedStoreId?: string): Promise<SeoData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, articles: [], error: "Sign in to manage SEO.", pages: [], products: [], storeSeo: null, stores: [] };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const { data: membership } = await supabase
    .from("workspace_members" as never)
    .select("role, status, permission_overrides")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  const member = membership as {
    permission_overrides?: Record<string, boolean> | null;
    role?: string | null;
    status?: string | null;
  } | null;

  if (member?.status && member.status !== "active") {
    return { activeStore: null, articles: [], error: "You do not have permission to manage SEO.", pages: [], products: [], storeSeo: null, stores: [] };
  }

  if (!hasPermission((member?.role ?? null) as WorkspaceRole | null, "settings.edit", member?.permission_overrides ?? undefined)) {
    return { activeStore: null, articles: [], error: "You do not have permission to manage SEO.", pages: [], products: [], storeSeo: null, stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      articles: [],
      error: storesError ? "Stores could not be loaded." : null,
      pages: [],
      products: [],
      storeSeo: null,
      stores
    };
  }

  const [storeResult, productsResult, pagesResult, articlesResult] = await Promise.all([
    supabase
      .from("stores" as never)
      .select("id, workspace_id, name, slug, description, logo_image_url, seo_title, seo_description, og_image_url, seo_settings")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("id" as never, activeStore.id as never)
      .maybeSingle(),
    supabase
      .from("store_products" as never)
      .select("id, title, slug, description, image_url, seo_title, seo_description, og_title, og_description, og_image_url, canonical_url, noindex")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("updated_at" as never, { ascending: false })
      .limit(8),
    supabase
      .from("store_pages" as never)
      .select("id, title, slug, content, seo_title, seo_description, og_title, og_description, og_image_url, canonical_url, noindex")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("updated_at" as never, { ascending: false })
      .limit(8),
    supabase
      .from("store_blog_articles" as never)
      .select("id, title, slug, excerpt, content, cover_image_url, seo_title, seo_description, og_title, og_description, og_image_url, canonical_url, noindex")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("updated_at" as never, { ascending: false })
      .limit(8)
  ]);

  if (storeResult.error || productsResult.error || pagesResult.error || articlesResult.error) {
    return {
      activeStore,
      articles: [],
      error: "SEO data could not be loaded. Apply the SEO Advanced migration.",
      pages: [],
      products: [],
      storeSeo: null,
      stores
    };
  }

  return {
    activeStore,
    articles: (articlesResult.data ?? []) as unknown as BlogSeoRow[],
    error: null,
    pages: (pagesResult.data ?? []) as unknown as PageSeoRow[],
    products: (productsResult.data ?? []) as unknown as ProductSeoRow[],
    storeSeo: storeResult.data as unknown as StoreSeoRow | null,
    stores
  };
}

export default async function SeoPage({ searchParams }: SeoPageProps) {
  const query = await searchParams;
  const { activeStore, articles, error, pages, products, storeSeo, stores } = await getSeoData(query.storeId);
  const settings = normalizeStoreSeoSettings(storeSeo?.seo_settings);
  const message = statusMessage(query.seoStatus);
  const baseUrl = getAppBaseUrl();
  const checklist = [
    { label: "Homepage title exists", ok: hasText(settings.homepageSeoTitle) || hasText(storeSeo?.seo_title) || hasText(storeSeo?.name) },
    { label: "Homepage description exists", ok: hasText(settings.homepageSeoDescription) || hasText(storeSeo?.seo_description) || hasText(storeSeo?.description) },
    { label: "Store logo exists", ok: hasText(storeSeo?.logo_image_url) },
    { label: "Products have descriptions", ok: products.length > 0 && products.every((product) => hasText(product.description) || hasText(product.seo_description)) },
    { label: "Sitemap available", ok: true, href: `${baseUrl}/sitemap.xml` },
    { label: "Robots available", ok: true, href: `${baseUrl}/robots.txt` }
  ];

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Manage store SEO defaults, homepage metadata, fallback rules, and scoped page/product/blog overrides."
        title="SEO"
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">SEO tools</p>
            <p className="mt-1 text-sm font-semibold text-muted">Manage URL redirects and Google Search Console verification separately from sitemap and robots.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted"
              href={`/dashboard/seo/search-console${activeStore ? `?storeId=${encodeURIComponent(activeStore.id)}` : ""}`}
            >
              Search Console
            </Link>
            <Link
              className="rounded-full bg-ink px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white"
              href={`/dashboard/seo/redirects${activeStore ? `?storeId=${encodeURIComponent(activeStore.id)}` : ""}`}
            >
              Redirects
            </Link>
          </div>
        </div>
      </Card>

      {message ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">{message}</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">{error}</p>
        </Card>
      ) : null}

      {stores.length > 1 ? (
        <Card className="p-5">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Store</span>
              <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={activeStore?.id ?? ""} name="storeId">
                {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            </label>
            <Button type="submit">Switch store</Button>
          </form>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Store defaults</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{activeStore?.name ?? "No store selected"}</h2>
          <form action={saveStoreSeoSettingsAction} className="mt-5 grid gap-4">
            <input name="storeId" type="hidden" value={activeStore?.id ?? ""} />
            <div className="grid gap-4 md:grid-cols-2">
              <Input defaultValue={settings.defaultMetaTitle} label="Default meta title" name="defaultMetaTitle" placeholder={storeSeo?.name ?? "Store title"} />
              <Input defaultValue={settings.defaultOgImageUrl || storeSeo?.og_image_url || ""} label="Default Open Graph image" name="defaultOgImageUrl" placeholder="https://example.com/og-image.png" />
            </div>
            <Textarea defaultValue={settings.defaultMetaDescription} label="Default meta description" name="defaultMetaDescription" placeholder={storeSeo?.description ?? "Default search result description"} />
            <div className="grid gap-4 md:grid-cols-2">
              <Input defaultValue={settings.homepageSeoTitle || storeSeo?.seo_title || ""} label="Homepage SEO title" name="homepageSeoTitle" placeholder={storeSeo?.name ?? "Homepage title"} />
              <Textarea defaultValue={settings.homepageSeoDescription || storeSeo?.seo_description || ""} label="Homepage SEO description" name="homepageSeoDescription" placeholder={storeSeo?.description ?? "Homepage description"} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FallbackSelect defaultValue={settings.productFallbackRule} label="Product SEO fallback rules" name="productFallbackRule" />
              <FallbackSelect defaultValue={settings.blogFallbackRule} label="Blog/article SEO fallback rules" name="blogFallbackRule" />
            </div>
            <Button type="submit">Save SEO settings</Button>
          </form>
        </Card>

        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">SEO checklist</p>
          <div className="mt-4 grid gap-3">
            {checklist.map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4" key={item.label}>
                <div>
                  <p className="text-sm font-black text-ink">{item.label}</p>
                  {item.href ? <a className="text-xs font-bold text-blue-600" href={item.href} rel="noreferrer" target="_blank">{item.href}</a> : null}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${item.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                  {item.ok ? "Ready" : "Needs work"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <OverrideSection
        action={saveProductSeoOverrideAction}
        emptyText="No products found for this store."
        itemIdName="productId"
        items={products}
        storeId={activeStore?.id ?? ""}
        title="Product SEO overrides"
      />
      <OverrideSection
        action={savePageSeoOverrideAction}
        emptyText="No pages found for this store."
        itemIdName="pageId"
        items={pages}
        storeId={activeStore?.id ?? ""}
        title="Page SEO overrides"
      />
      <OverrideSection
        action={saveBlogSeoOverrideAction}
        emptyText="No blog articles found for this store."
        itemIdName="articleId"
        items={articles}
        storeId={activeStore?.id ?? ""}
        title="Blog/article SEO overrides"
      />
    </div>
  );
}

function FallbackSelect({
  defaultValue,
  label,
  name
}: {
  defaultValue: string;
  label: string;
  name: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={defaultValue} name={name}>
        <option value="existing_data">Use existing item data first</option>
        <option value="store_defaults">Use store defaults when missing</option>
        <option value="title_with_store">Append store name to titles</option>
      </select>
    </label>
  );
}

function OverrideSection({
  action,
  emptyText,
  itemIdName,
  items,
  storeId,
  title
}: {
  action: (formData: FormData) => Promise<void>;
  emptyText: string;
  itemIdName: "articleId" | "pageId" | "productId";
  items: Array<(ProductSeoRow | PageSeoRow | BlogSeoRow) & { id: string; title: string }>;
  storeId: string;
  title: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Overrides</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{title}</h2>
        </div>
        <p className="text-sm font-bold text-muted">Showing latest {items.length} records.</p>
      </div>
      <div className="mt-5 grid gap-4">
        {items.length ? items.map((item) => (
          <details className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={item.id}>
            <summary className="cursor-pointer">
              <span className="font-black text-ink">{item.title}</span>
              <span className="ml-2 text-sm font-bold text-muted">{truncate(item.seo_description || ("description" in item ? item.description : null) || ("excerpt" in item ? item.excerpt : null))}</span>
            </summary>
            <form action={action} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={storeId} />
              <input name={itemIdName} type="hidden" value={item.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <Input defaultValue={item.seo_title ?? ""} label="SEO title" name="seoTitle" placeholder={item.title} />
                <Input defaultValue={item.og_title ?? ""} label="Open Graph title" name="ogTitle" placeholder={item.title} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Textarea defaultValue={item.seo_description ?? ""} label="SEO description" name="seoDescription" placeholder={truncate(("description" in item ? item.description : null) || ("excerpt" in item ? item.excerpt : null) || ("content" in item ? item.content : null), 140)} />
                <Textarea defaultValue={item.og_description ?? ""} label="Open Graph description" name="ogDescription" placeholder="Social preview description" />
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <Input defaultValue={item.og_image_url ?? ""} label="Open Graph image URL" name="ogImageUrl" placeholder={"image_url" in item ? item.image_url ?? "" : "cover_image_url" in item ? item.cover_image_url ?? "" : ""} />
                <Input defaultValue={item.canonical_url ?? ""} label="Canonical URL" name="canonicalUrl" placeholder="https://example.com/page" />
                <label className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink">
                  <input defaultChecked={item.noindex === true} name="noindex" type="checkbox" />
                  Noindex
                </label>
              </div>
              <Button type="submit">Save override</Button>
            </form>
          </details>
        )) : (
          <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-semibold text-muted">{emptyText}</p>
        )}
      </div>
    </Card>
  );
}
