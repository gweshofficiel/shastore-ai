import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import {
  getShippingZonesDashboardData,
  saveShippingZone,
  type ShippingZoneProfileOption,
  type ShippingZoneRow
} from "@/lib/shipping-zones";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const zoneTemplates = [
  {
    cities: "Casablanca\nRabat\nMarrakech",
    country: "Morocco",
    name: "Morocco",
    regions: "Casablanca-Settat\nRabat-Sale-Kenitra\nMarrakech-Safi"
  },
  {
    cities: "Dubai\nAbu Dhabi\nSharjah",
    country: "United Arab Emirates",
    name: "UAE",
    regions: "Dubai\nAbu Dhabi\nSharjah"
  },
  {
    cities: "Paris\nLyon\nMarseille",
    country: "France",
    name: "France",
    regions: "Ile-de-France\nAuvergne-Rhone-Alpes\nProvence-Alpes-Cote d'Azur"
  },
  {
    cities: "Paris\nBerlin\nMadrid\nRome",
    country: "Europe",
    name: "Europe",
    regions: "Western Europe\nSouthern Europe\nCentral Europe"
  },
  {
    cities: "Casablanca",
    country: "Morocco",
    name: "Local City Zone",
    regions: "Local delivery area"
  }
];

function zoneQuery(storeId: string | null | undefined) {
  return storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
}

function listText(values: string[]) {
  return values.length ? values.join(", ") : "All areas";
}

export default async function ShippingZonesPage({
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
            description="Shipping zones are limited to shipping managers."
            title="Shipping Zones"
          />
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-800">
              You do not have permission to view shipping zones.
            </p>
          </Card>
        </div>
      );
    }
  }

  const data = await getShippingZonesDashboardData(query.storeId);
  const activeStore = data.activeStore;
  const returnPath = `/dashboard/shipping-zones${zoneQuery(activeStore?.id)}`;
  const defaultProfileId = data.profiles[0]?.id ?? "";

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create store-scoped delivery regions and link each zone to a shipping profile. Rate rules can attach here next."
        title="Shipping Zones"
      />

      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            Apply the shipping zones migration to enable zone management.
          </p>
        </Card>
      ) : null}
      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Shipping zone saved.</p>
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
              Zones are linked to shipping profiles and stay scoped to this store.
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
            <Button type="submit" variant="secondary">View zones</Button>
          </form>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">No stores found</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Create a store before configuring shipping zones.
          </p>
        </Card>
      )}

      {activeStore ? (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-6">
            <Card className="p-6 lg:p-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Create Zone
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
                Shipping zone
              </h2>
              {data.profiles.length ? (
                <form action={saveShippingZone} className="mt-5 grid gap-4">
                  <input name="storeId" type="hidden" value={activeStore.id} />
                  <input name="returnTo" type="hidden" value={returnPath} />
                  <ZoneFields profiles={data.profiles} />
                  <Button type="submit">Create shipping zone</Button>
                </form>
              ) : (
                <p className="mt-5 rounded-3xl border border-dashed border-slate-300 p-5 text-sm font-semibold leading-6 text-muted">
                  Create a shipping profile first, then link zones to that profile.
                </p>
              )}
            </Card>

            <Card className="p-6 lg:p-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Quick Templates
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
                Common zones
              </h2>
              {activeStore && defaultProfileId ? (
                <div className="mt-5 grid gap-3">
                  {zoneTemplates.map((template, index) => (
                    <form action={saveShippingZone} className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={template.name}>
                      <input name="storeId" type="hidden" value={activeStore.id} />
                      <input name="returnTo" type="hidden" value={returnPath} />
                      <input name="profileId" type="hidden" value={defaultProfileId} />
                      <input name="zoneName" type="hidden" value={template.name} />
                      <input name="country" type="hidden" value={template.country} />
                      <input name="regions" type="hidden" value={template.regions} />
                      <input name="cities" type="hidden" value={template.cities} />
                      <input name="sortOrder" type="hidden" value={index} />
                      <input name="enabled" type="hidden" value="true" />
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-ink">{template.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-muted">
                            {template.country} · {template.regions.split(/\r?\n/)[0]}
                          </p>
                        </div>
                        <Button type="submit" variant="secondary">Create</Button>
                      </div>
                    </form>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-3xl border border-dashed border-slate-300 p-5 text-sm font-semibold leading-6 text-muted">
                  Templates become available after a shipping profile exists.
                </p>
              )}
            </Card>
          </div>

          <Card className="p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Zones
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              Zone management
            </h2>
            <div className="mt-5 grid gap-4">
              {data.zones.length ? data.zones.map((zone) => (
                <ZoneCard
                  key={zone.id}
                  profiles={data.profiles}
                  returnPath={returnPath}
                  storeId={activeStore.id}
                  zone={zone}
                />
              )) : (
                <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-muted">
                  No shipping zones yet. Create Morocco, UAE, France, Europe, or a Local City Zone to start.
                </p>
              )}
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function ZoneFields({
  profiles,
  zone
}: {
  profiles: ShippingZoneProfileOption[];
  zone?: ShippingZoneRow;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Input defaultValue={zone?.zone_name ?? ""} id={zone ? `zone-name-${zone.id}` : "zoneName"} label="Zone name" name="zoneName" placeholder="Morocco" required />
        <Input defaultValue={zone?.country ?? ""} id={zone ? `country-${zone.id}` : "country"} label="Country" name="country" placeholder="Morocco" required />
        <Input defaultValue={zone?.sort_order ?? 0} id={zone ? `sort-${zone.id}` : "sortOrder"} label="Sort order" name="sortOrder" type="number" />
        <label className="grid gap-2 text-sm font-semibold text-ink">
          <span>Linked shipping profile</span>
          <select
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            defaultValue={zone?.profile_id ?? profiles[0]?.id}
            name="profileId"
            required
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}{profile.enabled ? "" : " (disabled)"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Textarea
          defaultValue={zone?.regions.join("\n") ?? ""}
          id={zone ? `regions-${zone.id}` : "regions"}
          label="Regions"
          name="regions"
          placeholder="Casablanca-Settat&#10;Rabat-Sale-Kenitra"
        />
        <Textarea
          defaultValue={zone?.cities.join("\n") ?? ""}
          id={zone ? `cities-${zone.id}` : "cities"}
          label="Cities"
          name="cities"
          placeholder="Casablanca&#10;Rabat"
        />
      </div>
      <label className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink">
        <input defaultChecked={zone?.enabled ?? true} name="enabled" type="checkbox" />
        Enabled
      </label>
    </>
  );
}

function ZoneCard({
  profiles,
  returnPath,
  storeId,
  zone
}: {
  profiles: ShippingZoneProfileOption[];
  returnPath: string;
  storeId: string;
  zone: ShippingZoneRow;
}) {
  return (
    <details className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-ink">{zone.zone_name}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              {zone.country} · {zone.profileName}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
            zone.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
          }`}>
            {zone.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <div className="mt-3 grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          <span className="rounded-full bg-white px-3 py-1">Regions: {listText(zone.regions)}</span>
          <span className="rounded-full bg-white px-3 py-1">Cities: {listText(zone.cities)}</span>
        </div>
      </summary>
      <form action={saveShippingZone} className="mt-5 grid gap-4 rounded-3xl bg-white p-4">
        <input name="zoneId" type="hidden" value={zone.id} />
        <input name="storeId" type="hidden" value={storeId} />
        <input name="returnTo" type="hidden" value={returnPath} />
        <ZoneFields profiles={profiles} zone={zone} />
        <Button type="submit" variant="secondary">Update zone</Button>
      </form>
    </details>
  );
}
