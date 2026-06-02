import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createStoreRedirectAction,
  updateStoreRedirectStatusAction
} from "@/lib/store-seo-actions";
import { getUserPrimaryWorkspaceId, hasPermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type RedirectsPageProps = {
  searchParams: Promise<{
    redirectStatus?: string;
    storeId?: string;
  }>;
};

type StoreRedirectRow = {
  created_at: string;
  destination_url: string;
  hits_count: number | string;
  id: string;
  last_hit_at: string | null;
  redirect_type: 301 | 302;
  source_path: string;
  status: "active" | "disabled";
  store_id: string;
};

type RedirectsData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  redirects: StoreRedirectRow[];
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "create-failed": "Redirect could not be created.",
    created: "Redirect created.",
    duplicate: "A redirect with that source URL already exists for this store.",
    invalid: "Enter a source URL, destination URL, and redirect type.",
    loop: "Redirect source and destination cannot resolve to the same path.",
    "not-authorized": "You do not have permission to manage redirects for that store.",
    "update-failed": "Redirect status could not be updated.",
    updated: "Redirect status updated."
  };

  return status ? messages[status] ?? null : null;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function redirectStatusClass(status: string) {
  return status === "active"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-100 text-slate-600";
}

async function getRedirectsData(selectedStoreId?: string): Promise<RedirectsData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage redirects.", redirects: [], stores: [] };
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
    return { activeStore: null, error: "You do not have permission to manage redirects.", redirects: [], stores: [] };
  }

  if (!hasPermission((member?.role ?? null) as WorkspaceRole | null, "settings.edit", member?.permission_overrides ?? undefined)) {
    return { activeStore: null, error: "You do not have permission to manage redirects.", redirects: [], stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      error: storesError ? "Stores could not be loaded." : null,
      redirects: [],
      stores
    };
  }

  const { data, error } = await supabase
    .from("store_redirects" as never)
    .select("id, store_id, source_path, destination_url, redirect_type, status, hits_count, last_hit_at, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("created_at" as never, { ascending: false });

  if (error) {
    return {
      activeStore,
      error: "Redirects could not be loaded. Apply the Redirect Manager migration.",
      redirects: [],
      stores
    };
  }

  return {
    activeStore,
    error: null,
    redirects: (data ?? []) as unknown as StoreRedirectRow[],
    stores
  };
}

export default async function SeoRedirectsPage({ searchParams }: RedirectsPageProps) {
  const query = await searchParams;
  const { activeStore, error, redirects, stores } = await getRedirectsData(query.storeId);
  const message = statusMessage(query.redirectStatus);
  const activeCount = redirects.filter((redirect) => redirect.status === "active").length;
  const disabledCount = redirects.filter((redirect) => redirect.status === "disabled").length;
  const hitsCount = redirects.reduce((sum, redirect) => sum + Number(redirect.hits_count ?? 0), 0);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create store-scoped 301 and 302 redirects for old URLs without changing existing storefront routes."
        title="SEO Redirects"
      />

      <div>
        <Link className="text-sm font-black text-muted transition hover:text-ink" href={`/dashboard/seo${activeStore ? `?storeId=${encodeURIComponent(activeStore.id)}` : ""}`}>
          Back to SEO center
        </Link>
      </div>

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

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Active redirects" value={activeCount.toLocaleString()} />
        <MetricCard label="Disabled redirects" value={disabledCount.toLocaleString()} />
        <MetricCard label="Redirect hits" value={hitsCount.toLocaleString()} />
      </section>

      <Card className="p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Create redirect</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{activeStore?.name ?? "No store selected"}</h2>
        <form action={createStoreRedirectAction} className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_180px_auto] lg:items-end">
          <input name="storeId" type="hidden" value={activeStore?.id ?? ""} />
          <Input label="Source URL" name="sourceUrl" placeholder="/old-product-url" required />
          <Input label="Destination URL" name="destinationUrl" placeholder="/new-product-url or https://example.com" required />
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span>Redirect type</span>
            <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue="301" name="redirectType">
              <option value="301">301 Permanent</option>
              <option value="302">302 Temporary</option>
            </select>
          </label>
          <Button type="submit">Create</Button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Redirects</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">Active and disabled redirects</h2>
          </div>
          <p className="text-sm font-bold text-muted">Sources are unique per store.</p>
        </div>
        <div className="mt-5 grid gap-3">
          {redirects.length ? redirects.map((redirect) => (
            <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={redirect.id}>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${redirectStatusClass(redirect.status)}`}>
                      {redirect.status}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                      {redirect.redirect_type}
                    </span>
                  </div>
                  <p className="mt-3 font-mono text-sm font-black text-ink">{redirect.source_path}</p>
                  <p className="mt-1 break-all text-sm font-semibold text-muted">→ {redirect.destination_url}</p>
                  <p className="mt-2 text-xs font-bold text-slate-400">
                    {Number(redirect.hits_count ?? 0).toLocaleString()} hits · Last hit {formatDate(redirect.last_hit_at)}
                  </p>
                </div>
                <form action={updateStoreRedirectStatusAction} className="flex items-end gap-2">
                  <input name="redirectId" type="hidden" value={redirect.id} />
                  <input name="storeId" type="hidden" value={redirect.store_id} />
                  <input name="status" type="hidden" value={redirect.status === "active" ? "disabled" : "active"} />
                  <button className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-ink transition hover:border-slate-300 hover:bg-slate-50" type="submit">
                    {redirect.status === "active" ? "Disable" : "Enable"}
                  </button>
                </form>
              </div>
            </article>
          )) : (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm font-semibold text-muted">
              No redirects yet. Add an old URL above to preserve SEO value when URLs change.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">{value}</p>
    </Card>
  );
}
