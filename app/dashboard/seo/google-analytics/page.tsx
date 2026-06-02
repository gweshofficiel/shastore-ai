import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getUserPrimaryWorkspaceId, hasPermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import { saveGoogleAnalyticsSettingsAction } from "@/lib/store-seo-actions";
import { normalizeStoreSeoSettings } from "@/lib/store-seo";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type GoogleAnalyticsPageProps = {
  searchParams: Promise<{
    analyticsStatus?: string;
    storeId?: string;
  }>;
};

type AnalyticsStoreRow = {
  id: string;
  name: string;
  seo_settings?: unknown;
  slug: string;
};

type AnalyticsData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  storeSeo: AnalyticsStoreRow | null;
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    invalid: "Google Analytics settings were incomplete.",
    "missing-id": "Enter a GA4 Measurement ID before enabling analytics.",
    "not-authorized": "You do not have permission to manage analytics for that store.",
    "save-failed": "Google Analytics settings could not be saved.",
    saved: "Google Analytics settings saved."
  };

  return status ? messages[status] ?? null : null;
}

async function getAnalyticsData(selectedStoreId?: string): Promise<AnalyticsData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage Google Analytics.", storeSeo: null, stores: [] };
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
    return { activeStore: null, error: "You do not have permission to manage Google Analytics.", storeSeo: null, stores: [] };
  }

  if (!hasPermission((member?.role ?? null) as WorkspaceRole | null, "settings.edit", member?.permission_overrides ?? undefined)) {
    return { activeStore: null, error: "You do not have permission to manage Google Analytics.", storeSeo: null, stores: [] };
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
    .select("id, name, slug, seo_settings")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("id" as never, activeStore.id as never)
    .maybeSingle();

  if (error) {
    return {
      activeStore,
      error: "Google Analytics settings could not be loaded. Apply the SEO Advanced migration.",
      storeSeo: null,
      stores
    };
  }

  return {
    activeStore,
    error: null,
    storeSeo: data as unknown as AnalyticsStoreRow | null,
    stores
  };
}

export default async function GoogleAnalyticsPage({ searchParams }: GoogleAnalyticsPageProps) {
  const query = await searchParams;
  const { activeStore, error, storeSeo, stores } = await getAnalyticsData(query.storeId);
  const settings = normalizeStoreSeoSettings(storeSeo?.seo_settings);
  const message = statusMessage(query.analyticsStatus);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Connect a store-scoped GA4 Measurement ID and enable storefront ecommerce analytics events."
        title="Google Analytics"
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

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">GA4</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{activeStore?.name ?? "No store selected"}</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${settings.googleAnalyticsEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {settings.googleAnalyticsEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <form action={saveGoogleAnalyticsSettingsAction} className="mt-5 grid gap-4">
          <input name="storeId" type="hidden" value={activeStore?.id ?? ""} />
          <Input
            defaultValue={settings.googleAnalyticsMeasurementId}
            label="GA4 Measurement ID"
            name="googleAnalyticsMeasurementId"
            placeholder="G-XXXXXXXXXX"
          />
          <label className="flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-ink">
            <input defaultChecked={settings.googleAnalyticsEnabled} name="googleAnalyticsEnabled" type="checkbox" />
            Enable GA4 on this storefront
          </label>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
            <p className="font-black text-ink">Tracked events</p>
            <p className="mt-2">page_view on public storefront pages, view_item on product pages, add_to_cart, begin_checkout, and purchase on order confirmation pages.</p>
            <p className="mt-2">The GA4 script is rendered only for this store when enabled and a Measurement ID is saved.</p>
          </div>
          <Button type="submit">Save Google Analytics settings</Button>
        </form>
      </Card>
    </div>
  );
}
