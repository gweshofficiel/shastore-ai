import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createStoreTaxRule,
  saveStoreTaxSettings,
  updateStoreTaxRule
} from "@/lib/tax-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type TaxSettingsRow = {
  apply_tax_to_shipping?: boolean | null;
  default_tax_rate?: number | string | null;
  prices_include_tax?: boolean | null;
  tax_enabled?: boolean | null;
  tax_name?: string | null;
};

type TaxRuleRow = {
  city?: string | null;
  country: string;
  enabled?: boolean | null;
  id: string;
  region?: string | null;
  sort_order?: number | null;
  status?: string | null;
  tax_name?: string | null;
  tax_rate: number | string;
};

type TaxDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  rules: TaxRuleRow[];
  settings: TaxSettingsRow | null;
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "missing-country": "Country is required for a tax rule.",
    "missing-store": "Choose a store before managing tax settings.",
    "not-authorized": "You do not have permission to manage tax for that store.",
    "rule-create-failed": "Tax rule could not be created.",
    "rule-created": "Tax rule created.",
    "rule-update-failed": "Tax rule could not be updated.",
    "rule-updated": "Tax rule updated.",
    "settings-failed": "Tax settings could not be saved.",
    "settings-saved": "Tax settings saved."
  };

  return status ? messages[status] : null;
}

async function getTaxDashboardData(selectedStoreId?: string): Promise<TaxDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      error: "Sign in to manage tax settings.",
      rules: [],
      settings: null,
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
      error: "Stores could not be loaded. Please try again.",
      rules: [],
      settings: null,
      stores: []
    };
  }

  const activeStore =
    stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      error: null,
      rules: [],
      settings: null,
      stores
    };
  }

  const [settingsResult, rulesResult] = await Promise.all([
    supabase
      .from("store_tax_settings" as never)
      .select("tax_enabled, tax_name, default_tax_rate, prices_include_tax, apply_tax_to_shipping")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .maybeSingle(),
    supabase
      .from("store_tax_rules" as never)
      .select("id, tax_name, country, region, city, tax_rate, status, enabled, sort_order")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("sort_order", { ascending: true })
      .order("country", { ascending: true })
  ]);

  if (settingsResult.error || rulesResult.error) {
    return {
      activeStore,
      error: "Tax tables could not be loaded. Confirm the tax foundation migration has been applied.",
      rules: [],
      settings: null,
      stores
    };
  }

  return {
    activeStore,
    error: null,
    rules: (rulesResult.data ?? []) as unknown as TaxRuleRow[],
    settings: (settingsResult.data as unknown as TaxSettingsRow | null) ?? null,
    stores
  };
}

function checked(value: unknown) {
  return Boolean(value);
}

function taxRate(value: unknown) {
  return String(value ?? 0);
}

function TaxRuleFields({ rule }: { rule?: TaxRuleRow }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Input
        defaultValue={rule?.tax_name ?? ""}
        id={rule ? `tax-rule-${rule.id}-name` : "tax-rule-name"}
        label="Tax name"
        maxLength={80}
        name="taxRuleName"
        placeholder="VAT, Sales Tax, GST"
      />
      <Input
        defaultValue={rule?.country ?? ""}
        id={rule ? `tax-rule-${rule.id}-country` : "tax-rule-country"}
        label="Country"
        maxLength={120}
        name="country"
        placeholder="United States"
        required
      />
      <Input
        defaultValue={rule?.region ?? ""}
        id={rule ? `tax-rule-${rule.id}-region` : "tax-rule-region"}
        label="Region / state"
        maxLength={120}
        name="region"
        placeholder="California"
      />
      <Input
        defaultValue={rule?.city ?? ""}
        id={rule ? `tax-rule-${rule.id}-city` : "tax-rule-city"}
        label="City"
        maxLength={120}
        name="city"
        placeholder="Los Angeles"
      />
      <Input
        defaultValue={taxRate(rule?.tax_rate)}
        id={rule ? `tax-rule-${rule.id}-rate` : "tax-rule-rate"}
        label="Tax rate %"
        min="0"
        name="taxRate"
        step="0.0001"
        type="number"
      />
      <Input
        defaultValue={String(rule?.sort_order ?? 0)}
        id={rule ? `tax-rule-${rule.id}-sort` : "tax-rule-sort"}
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
          defaultValue={rule?.status === "inactive" ? "inactive" : "active"}
          name="status"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink">
        <input defaultChecked={rule?.enabled !== false && rule?.status !== "inactive"} name="enabled" type="checkbox" />
        Enabled
      </label>
    </div>
  );
}

export default async function TaxPage({
  searchParams
}: {
  searchParams: Promise<{ storeId?: string; tax?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, rules, settings, stores } = await getTaxDashboardData(query.storeId);
  const message = statusMessage(query.tax);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Configure store-scoped tax settings and regional tax rules for checkout."
        title="Taxes"
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
            Create a store before configuring tax. Tax settings are isolated by workspace and store.
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
                Tax rates created here apply only to this store checkout.
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
                View taxes
              </Button>
            </form>
          </Card>

          <Card className="grid gap-5 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Store Tax Settings
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                Checkout tax behavior
              </h2>
            </div>
            <form action={saveStoreTaxSettings} className="grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  defaultValue={settings?.tax_name ?? "Tax"}
                  id="tax-name"
                  label="Tax name"
                  maxLength={80}
                  name="taxName"
                  placeholder="VAT, Sales Tax, GST"
                />
                <Input
                  defaultValue={taxRate(settings?.default_tax_rate)}
                  id="default-tax-rate"
                  label="Default tax rate %"
                  min="0"
                  name="defaultTaxRate"
                  step="0.0001"
                  type="number"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["taxEnabled", "Enable tax", checked(settings?.tax_enabled)],
                  ["pricesIncludeTax", "Prices include tax", checked(settings?.prices_include_tax)],
                  ["applyTaxToShipping", "Apply tax to shipping", checked(settings?.apply_tax_to_shipping)]
                ].map(([name, label, defaultChecked]) => (
                  <label
                    className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink"
                    key={String(name)}
                  >
                    <input defaultChecked={Boolean(defaultChecked)} name={String(name)} type="checkbox" />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <Button type="submit">Save tax settings</Button>
              </div>
            </form>
          </Card>

          <Card className="grid gap-5 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Tax Rates
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                Add tax rate
              </h2>
            </div>
            <form action={createStoreTaxRule} className="grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <TaxRuleFields />
              <div className="flex justify-end">
                <Button type="submit">Create tax rate</Button>
              </div>
            </form>
          </Card>

          <section className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Rate List
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {rules.length} {rules.length === 1 ? "rate" : "rates"}
              </h2>
            </div>

            {rules.length === 0 ? (
              <Card className="p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                  No tax rates yet
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
                  The default tax rate is used until regional rates are added.
                </p>
              </Card>
            ) : null}

            {rules.map((rule) => (
              <Card key={rule.id} className="grid gap-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black tracking-[-0.03em] text-ink">
                      {rule.tax_name?.trim() || "Tax"}
                    </h3>
                    <p className="mt-1 text-sm font-bold text-muted">
                      {taxRate(rule.tax_rate)}% · {[rule.city, rule.region, rule.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
                    rule.enabled === false || rule.status === "inactive" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {rule.enabled === false || rule.status === "inactive" ? "inactive" : "active"}
                  </span>
                </div>
                <details className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-black text-ink">
                    Edit tax rate
                  </summary>
                  <form action={updateStoreTaxRule} className="mt-4 grid gap-4">
                    <input name="storeId" type="hidden" value={activeStore.id} />
                    <input name="ruleId" type="hidden" value={rule.id} />
                    <TaxRuleFields rule={rule} />
                    <div className="flex justify-end">
                      <Button type="submit" variant="secondary">
                        Save tax rate
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
