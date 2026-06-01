import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateStoreFooterLinkSettings } from "@/lib/store-footer-link-actions";
import {
  normalizeStoreFooterLinkSettings,
  storeFooterLinkOptions,
  type StoreFooterLinkSettings
} from "@/lib/store-footer-links";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type FooterLinksDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  settings: StoreFooterLinkSettings;
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "missing-store": "Choose a store before managing footer links.",
    "not-authorized": "You do not have permission to manage that store.",
    saved: "Footer link settings saved.",
    "save-failed": "Footer link settings could not be saved."
  };

  return status ? messages[status] : null;
}

async function getFooterLinksDashboardData(selectedStoreId?: string): Promise<FooterLinksDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      error: "Sign in to manage footer links.",
      settings: normalizeStoreFooterLinkSettings(null),
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return {
      activeStore: null,
      error: "Stores could not be loaded.",
      settings: normalizeStoreFooterLinkSettings(null),
      stores: []
    };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      error: null,
      settings: normalizeStoreFooterLinkSettings(null),
      stores
    };
  }

  const { data, error } = await supabase
    .from("stores" as never)
    .select("footer_link_settings")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("id" as never, activeStore.id as never)
    .maybeSingle();

  if (error) {
    return {
      activeStore,
      error: "Footer link settings could not be loaded. Confirm the footer links migration has been applied.",
      settings: normalizeStoreFooterLinkSettings(null),
      stores
    };
  }

  const store = data as { footer_link_settings?: unknown } | null;

  return {
    activeStore,
    error: null,
    settings: normalizeStoreFooterLinkSettings(store?.footer_link_settings),
    stores
  };
}

export default async function FooterLinksDashboard({
  searchParams
}: {
  searchParams: Promise<{ footer?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, settings, stores } = await getFooterLinksDashboardData(query.storeId);
  const message = statusMessage(query.footer);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Choose which links appear in the public storefront footer."
        title="Footer Links"
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
        <Card className="p-5">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            Enabled footer links
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Blog and FAQ only appear publicly when published content exists. Shipping Policy appears only when a published shipping page exists.
          </p>
          <form action={updateStoreFooterLinkSettings} className="mt-5 grid gap-4">
            <input name="storeId" type="hidden" value={activeStore.id} />
            <div className="grid gap-3 md:grid-cols-2">
              {storeFooterLinkOptions.map((option) => (
                <label
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink"
                  key={option.key}
                >
                  <span>{option.label}</span>
                  <input
                    className="h-5 w-5 rounded border-slate-300 text-ink"
                    defaultChecked={settings[option.key]}
                    name={option.key}
                    type="checkbox"
                  />
                </label>
              ))}
            </div>
            <Button type="submit">Save footer links</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
