import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAppBaseUrl } from "@/lib/deployment/config";
import { getUserPrimaryWorkspaceId, hasPermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import { saveSearchConsoleSettingsAction } from "@/lib/store-seo-actions";
import { normalizeStoreSeoSettings } from "@/lib/store-seo";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type SearchConsolePageProps = {
  searchParams: Promise<{
    searchConsoleStatus?: string;
    storeId?: string;
  }>;
};

type SearchConsoleStoreRow = {
  id: string;
  name: string;
  seo_settings?: unknown;
  slug: string;
  workspace_id: string;
};

type SearchConsoleData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  storeSeo: SearchConsoleStoreRow | null;
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    invalid: "Search Console settings were incomplete.",
    "invalid-property": "Connected property URL must start with http:// or https://.",
    "not-authorized": "You do not have permission to manage Search Console for that store.",
    "save-failed": "Search Console settings could not be saved.",
    saved: "Search Console settings saved."
  };

  return status ? messages[status] ?? null : null;
}

function statusClass(status: string) {
  if (status === "verified") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "failed") {
    return "bg-red-100 text-red-700";
  }

  if (status === "pending") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-slate-100 text-slate-600";
}

async function getSearchConsoleData(selectedStoreId?: string): Promise<SearchConsoleData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage Search Console.", storeSeo: null, stores: [] };
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
    return { activeStore: null, error: "You do not have permission to manage Search Console.", storeSeo: null, stores: [] };
  }

  if (!hasPermission((member?.role ?? null) as WorkspaceRole | null, "settings.edit", member?.permission_overrides ?? undefined)) {
    return { activeStore: null, error: "You do not have permission to manage Search Console.", storeSeo: null, stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      error: storesError ? "Stores could not be loaded." : null,
      storeSeo: null,
      stores
    };
  }

  const { data, error } = await supabase
    .from("stores" as never)
    .select("id, workspace_id, name, slug, seo_settings")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("id" as never, activeStore.id as never)
    .maybeSingle();

  if (error) {
    return {
      activeStore,
      error: "Search Console settings could not be loaded. Apply the SEO Advanced migration.",
      storeSeo: null,
      stores
    };
  }

  return {
    activeStore,
    error: null,
    storeSeo: data as unknown as SearchConsoleStoreRow | null,
    stores
  };
}

export default async function SearchConsolePage({ searchParams }: SearchConsolePageProps) {
  const query = await searchParams;
  const { activeStore, error, storeSeo, stores } = await getSearchConsoleData(query.storeId);
  const settings = normalizeStoreSeoSettings(storeSeo?.seo_settings);
  const message = statusMessage(query.searchConsoleStatus);
  const baseUrl = getAppBaseUrl();
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  const robotsUrl = `${baseUrl}/robots.txt`;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Save Google Search Console verification details and render the verification meta tag on public storefront pages."
        title="Search Console"
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Google verification</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{activeStore?.name ?? "No store selected"}</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(settings.googleVerificationStatus)}`}>
              {settings.googleVerificationStatus.replaceAll("_", " ")}
            </span>
          </div>

          <form action={saveSearchConsoleSettingsAction} className="mt-5 grid gap-4">
            <input name="storeId" type="hidden" value={activeStore?.id ?? ""} />
            <Textarea
              defaultValue={settings.googleVerificationMetaCode}
              label="Google verification meta code"
              name="googleVerificationMetaCode"
              placeholder='<meta name="google-site-verification" content="abc123" />'
            />
            <Input
              defaultValue={settings.googleConnectedPropertyUrl}
              label="Connected property URL"
              name="googleConnectedPropertyUrl"
              placeholder="https://example.com or https://yourdomain.com/store/slug"
            />
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Verification status</span>
              <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={settings.googleVerificationStatus} name="googleVerificationStatus">
                <option value="not_started">Not started</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <Button type="submit">Save Search Console settings</Button>
          </form>
        </Card>

        <Card className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Submit sitemap</p>
          <div className="mt-4 grid gap-4">
            <InfoLink href={sitemapUrl} label="Sitemap URL" />
            <InfoLink href={robotsUrl} label="Robots.txt URL" />
            <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
              <p className="font-black text-ink">Instructions</p>
              <p className="mt-2">1. Add the meta code from Google Search Console and save.</p>
              <p>2. Open the public storefront so Google can read the verification meta tag.</p>
              <p>3. In Search Console, choose Sitemaps and submit <span className="font-mono">sitemap.xml</span>.</p>
              <p>4. Mark the status here manually after Google confirms ownership.</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

function InfoLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <a className="mt-2 block break-all text-sm font-bold text-blue-600" href={href} rel="noreferrer" target="_blank">
        {href}
      </a>
    </div>
  );
}
