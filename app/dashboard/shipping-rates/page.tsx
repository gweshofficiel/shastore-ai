import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import {
  getShippingRatesDashboardData,
  saveShippingRate,
  type ShippingRateProfileOption,
  type ShippingRateRow,
  type ShippingRateZoneOption
} from "@/lib/shipping-rates";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const rateTypes = [
  ["flat_rate", "Flat rate"],
  ["free_shipping", "Free shipping"],
  ["order_amount", "Order amount based"],
  ["weight_based", "Weight based"]
] as const;

function rateQuery(storeId: string | null | undefined) {
  return storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(value);
}

function typeLabel(value: string) {
  return rateTypes.find(([type]) => type === value)?.[1] ?? value.replaceAll("_", " ");
}

export default async function ShippingRatesPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; saved?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
    const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

    if (!hasPermission(role, "shipping.view")) {
      return (
        <div className="grid gap-6 lg:gap-8">
          <PageHeader
            description="Shipping rates are limited to shipping managers."
            title="Shipping Rates"
          />
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-800">
              You do not have permission to view shipping rates.
            </p>
          </Card>
        </div>
      );
    }
  }

  const data = await getShippingRatesDashboardData(query.storeId);
  const activeStore = data.activeStore;
  const returnPath = `/dashboard/shipping-rates${rateQuery(activeStore?.id)}`;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Define zone-based prices for shipping profiles. Checkout can use matching enabled rates safely."
        title="Shipping Rates"
      />

      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            Apply the shipping rates migration to enable rate management.
          </p>
        </Card>
      ) : null}
      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Shipping rate saved.</p>
        </Card>
      ) : null}
      {query.error || data.error ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{query.error ?? data.error}</p>
        </Card>
      ) : null}

      {data.stores.length ? (
        <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Active Store</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {activeStore?.name || activeStore?.store_name || "Store"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Rates are scoped to this store and linked to both a shipping profile and zone.
            </p>
          </div>
          <form className="flex flex-col gap-3 sm:min-w-[260px]" method="get">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              <span>Switch store</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={activeStore?.id}
                name="storeId"
              >
                {data.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name || store.store_name || store.slug || store.id}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">View rates</Button>
          </form>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">No stores found</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Create a store before configuring shipping rates.
          </p>
        </Card>
      )}

      {activeStore ? (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Create Rate
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              Shipping price rule
            </h2>
            {data.profiles.length && data.zones.length ? (
              <form action={saveShippingRate} className="mt-5 grid gap-4">
                <input name="storeId" type="hidden" value={activeStore.id} />
                <input name="returnTo" type="hidden" value={returnPath} />
                <RateFields profiles={data.profiles} storeCurrency="USD" zones={data.zones} />
                <Button type="submit">Create shipping rate</Button>
              </form>
            ) : (
              <p className="mt-5 rounded-3xl border border-dashed border-slate-300 p-5 text-sm font-semibold leading-6 text-muted">
                Create at least one shipping profile and one shipping zone before adding rates.
              </p>
            )}
          </Card>

          <Card className="p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Rates
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              Zone-based shipping prices
            </h2>
            <div className="mt-5 grid gap-4">
              {data.rates.length ? data.rates.map((rate) => (
                <RateCard
                  key={rate.id}
                  profiles={data.profiles}
                  rate={rate}
                  returnPath={returnPath}
                  storeId={activeStore.id}
                  zones={data.zones}
                />
              )) : (
                <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-muted">
                  No shipping rates yet. Add flat, free, order amount, or weight-based rates for your zones.
                </p>
              )}
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function RateFields({
  profiles,
  rate,
  storeCurrency,
  zones
}: {
  profiles: ShippingRateProfileOption[];
  rate?: ShippingRateRow;
  storeCurrency: string;
  zones: ShippingRateZoneOption[];
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Input defaultValue={rate?.rate_name ?? ""} id={rate ? `rate-${rate.id}` : "rateName"} label="Rate name" name="rateName" placeholder="Casablanca flat rate" required />
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Rate type</span>
          <select
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            defaultValue={rate?.rate_type ?? "flat_rate"}
            name="rateType"
          >
            {rateTypes.map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Shipping profile</span>
          <select
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            defaultValue={rate?.profile_id ?? profiles[0]?.id}
            name="profileId"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Shipping zone</span>
          <select
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            defaultValue={rate?.zone_id ?? zones[0]?.id}
            name="zoneId"
          >
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name} · {zone.country}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input defaultValue={rate?.price ?? 0} id={rate ? `price-${rate.id}` : "price"} label="Price" name="price" step="0.01" type="number" />
        <Input defaultValue={rate?.currency ?? storeCurrency} id={rate ? `currency-${rate.id}` : "currency"} label="Currency" name="currency" placeholder="USD" />
        <Input defaultValue={rate?.sort_order ?? 0} id={rate ? `sort-${rate.id}` : "sortOrder"} label="Sort order" name="sortOrder" type="number" />
        <Input defaultValue={rate?.min_order_amount ?? ""} id={rate ? `min-order-${rate.id}` : "minOrderAmount"} label="Min order amount" name="minOrderAmount" step="0.01" type="number" />
        <Input defaultValue={rate?.max_order_amount ?? ""} id={rate ? `max-order-${rate.id}` : "maxOrderAmount"} label="Max order amount" name="maxOrderAmount" step="0.01" type="number" />
        <Input defaultValue={rate?.min_weight ?? ""} id={rate ? `min-weight-${rate.id}` : "minWeight"} label="Min weight" name="minWeight" step="0.001" type="number" />
        <Input defaultValue={rate?.max_weight ?? ""} id={rate ? `max-weight-${rate.id}` : "maxWeight"} label="Max weight" name="maxWeight" step="0.001" type="number" />
      </div>
      <label className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink">
        <input defaultChecked={rate?.enabled ?? true} name="enabled" type="checkbox" />
        Enabled
      </label>
    </>
  );
}

function RateCard({
  profiles,
  rate,
  returnPath,
  storeId,
  zones
}: {
  profiles: ShippingRateProfileOption[];
  rate: ShippingRateRow;
  returnPath: string;
  storeId: string;
  zones: ShippingRateZoneOption[];
}) {
  return (
    <details className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-ink">{rate.rate_name}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              {rate.profileName} · {rate.zoneName} · {typeLabel(rate.rate_type)}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
            rate.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
          }`}>
            {rate.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          <span className="rounded-full bg-white px-3 py-1">{money(rate.price, rate.currency)}</span>
          {rate.min_order_amount != null ? <span className="rounded-full bg-white px-3 py-1">Min order {rate.min_order_amount}</span> : null}
          {rate.max_order_amount != null ? <span className="rounded-full bg-white px-3 py-1">Max order {rate.max_order_amount}</span> : null}
          {rate.min_weight != null || rate.max_weight != null ? <span className="rounded-full bg-white px-3 py-1">Weight rule</span> : null}
        </div>
      </summary>
      <form action={saveShippingRate} className="mt-5 grid gap-4 rounded-3xl bg-white p-4">
        <input name="rateId" type="hidden" value={rate.id} />
        <input name="storeId" type="hidden" value={storeId} />
        <input name="returnTo" type="hidden" value={returnPath} />
        <RateFields profiles={profiles} rate={rate} storeCurrency={rate.currency} zones={zones} />
        <Button type="submit" variant="secondary">Update rate</Button>
      </form>
    </details>
  );
}
