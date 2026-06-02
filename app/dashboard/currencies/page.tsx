import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getUserPrimaryWorkspaceId, hasPermission, type WorkspaceRole } from "@/lib/permissions/rbac";
import { saveStoreCurrencySettingsAction } from "@/lib/store-currency-actions";
import {
  normalizeStoreCurrencySettings,
  supportedStoreCurrencies
} from "@/lib/store-currencies";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type CurrenciesPageProps = {
  searchParams: Promise<{
    currencies?: string;
    storeId?: string;
  }>;
};

type CurrencyStoreRow = {
  currency?: string | null;
  currency_settings?: unknown;
  id: string;
  name: string;
  slug: string | null;
};

type CurrenciesData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  storeCurrencies: CurrencyStoreRow | null;
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "missing-store": "Choose a store before saving currency settings.",
    "not-authorized": "You do not have permission to manage currencies for that store.",
    saved: "Currency settings saved.",
    "save-failed": "Currency settings could not be saved."
  };

  return status ? messages[status] ?? null : null;
}

async function getCurrenciesData(selectedStoreId?: string): Promise<CurrenciesData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, error: "Sign in to manage storefront currencies.", storeCurrencies: null, stores: [] };
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
    return { activeStore: null, error: "You do not have permission to manage currencies.", storeCurrencies: null, stores: [] };
  }

  if (!hasPermission((member?.role ?? null) as WorkspaceRole | null, "settings.edit", member?.permission_overrides ?? undefined)) {
    return { activeStore: null, error: "You do not have permission to manage currencies.", storeCurrencies: null, stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      error: storesError ? "Stores could not be loaded." : null,
      storeCurrencies: null,
      stores
    };
  }

  const { data, error } = await supabase
    .from("stores" as never)
    .select("id, name, slug, currency, currency_settings")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("id" as never, activeStore.id as never)
    .maybeSingle();

  if (error) {
    return {
      activeStore,
      error: "Currency settings could not be loaded. Apply the multi-currency migration.",
      storeCurrencies: null,
      stores
    };
  }

  return {
    activeStore,
    error: null,
    storeCurrencies: data as unknown as CurrencyStoreRow | null,
    stores
  };
}

export default async function CurrenciesPage({ searchParams }: CurrenciesPageProps) {
  const query = await searchParams;
  const { activeStore, error, storeCurrencies, stores } = await getCurrenciesData(query.storeId);
  const settings = normalizeStoreCurrencySettings(storeCurrencies?.currency_settings, storeCurrencies?.currency);
  const message = statusMessage(query.currencies);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Enable storefront currencies and set manual exchange rates without changing payment providers or automatic exchange APIs."
        title="Currencies"
      />

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
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Storefront currencies</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">{activeStore?.name ?? "No store selected"}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Manual rates are relative to the default currency. No exchange API is used yet.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
            {settings.enabledCurrencies.length} enabled
          </span>
        </div>

        <form action={saveStoreCurrencySettingsAction} className="mt-6 grid gap-5">
          <input name="storeId" type="hidden" value={activeStore?.id ?? ""} />

          <label className="grid gap-2 text-sm font-bold text-ink">
            <span>Default currency</span>
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink outline-none" defaultValue={settings.defaultCurrency} name="defaultCurrency">
              {supportedStoreCurrencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currency.label}
                </option>
              ))}
            </select>
          </label>

          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <div className="grid grid-cols-[1fr_7rem_10rem] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <span>Currency</span>
              <span>Enabled</span>
              <span>Manual rate</span>
            </div>
            {supportedStoreCurrencies.map((currency) => {
              const enabled = settings.enabledCurrencies.includes(currency.code);
              const isDefault = currency.code === settings.defaultCurrency;

              return (
                <div className="grid grid-cols-[1fr_7rem_10rem] items-center gap-3 border-t border-slate-100 px-4 py-3" key={currency.code}>
                  <div>
                    <p className="text-sm font-black text-ink">{currency.code}</p>
                    <p className="text-xs font-semibold text-muted">{currency.label} · {currency.symbol}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold text-ink">
                    <input
                      defaultChecked={enabled || isDefault}
                      disabled={isDefault}
                      name="enabledCurrencies"
                      type="checkbox"
                      value={currency.code}
                    />
                    {isDefault ? "Default" : "Enable"}
                  </label>
                  <input
                    className="h-10 rounded-2xl border border-slate-200 px-3 text-sm font-bold text-ink outline-none"
                    defaultValue={isDefault ? 1 : settings.manualRates[currency.code] ?? 1}
                    min="0.00000001"
                    name={`rate_${currency.code}`}
                    readOnly={isDefault}
                    step="0.00000001"
                    type="number"
                  />
                  {isDefault ? <input name="enabledCurrencies" type="hidden" value={currency.code} /> : null}
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
            <p className="font-black text-ink">Checkout behavior</p>
            <p className="mt-2">The storefront displays selected-currency prices using your manual rates. Checkout keeps the selected currency on the order and stores base currency/rate metadata for auditability.</p>
          </div>

          <Button type="submit">Save currency settings</Button>
        </form>
      </Card>
    </div>
  );
}
