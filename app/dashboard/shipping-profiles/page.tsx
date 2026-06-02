import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getShippingProfilesDashboardData,
  saveShippingProfile,
  type ShippingProfileMethodRow,
  type ShippingProfileRow
} from "@/lib/shipping-profiles";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const profileTemplates = [
  {
    description: "Standard local delivery for nearby customers and same-region orders.",
    estimatedDeliveryDays: 2,
    name: "Local Shipping",
    preparationDays: 1
  },
  {
    description: "Cross-border fulfillment placeholder for future zones and country-based rates.",
    estimatedDeliveryDays: 10,
    name: "International Shipping",
    preparationDays: 2
  },
  {
    description: "Priority handling for fast delivery options.",
    estimatedDeliveryDays: 1,
    name: "Express Shipping",
    preparationDays: 0
  },
  {
    description: "Promotional free shipping profile for eligible methods and future rules.",
    estimatedDeliveryDays: 5,
    freeShippingEnabled: true,
    name: "Free Shipping",
    preparationDays: 1
  },
  {
    description: "Special handling profile for bulky or heavy products.",
    estimatedDeliveryDays: 7,
    name: "Heavy Products Shipping",
    preparationDays: 2
  }
];

function methodName(method: ShippingProfileMethodRow) {
  return method.name?.trim() || method.method_name?.trim() || "Shipping method";
}

function money(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function methodSummary(method: ShippingProfileMethodRow) {
  const parts = [
    method.free_shipping_enabled ? "Free shipping" : `$${money(method.flat_fee)} flat fee`,
    method.cod_supported === false ? "No COD" : "COD",
    method.estimated_delivery_days != null ? `${method.estimated_delivery_days} days` : null
  ].filter(Boolean);

  return parts.join(" · ");
}

function profileQuery(storeId: string | null | undefined) {
  return storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
}

export default async function ShippingProfilesPage({
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
            description="Shipping profiles are limited to shipping managers."
            title="Shipping Profiles"
          />
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-800">
              You do not have permission to view shipping profiles.
            </p>
          </Card>
        </div>
      );
    }
  }

  const data = await getShippingProfilesDashboardData(query.storeId);
  const activeStore = data.activeStore;
  const returnPath = `/dashboard/shipping-profiles${profileQuery(activeStore?.id)}`;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Group existing shipping methods into advanced profiles. Profiles prepare checkout selection, zones, and rates without changing existing methods."
        title="Shipping Profiles"
      />

      {!data.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            Apply the shipping profiles migration to enable advanced profiles.
          </p>
        </Card>
      ) : null}
      {query.saved ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">Shipping profile saved.</p>
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
              Existing shipping methods continue working. Link methods here to prepare grouped checkout selection.
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
            <Button type="submit" variant="secondary">View profiles</Button>
          </form>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">No stores found</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
            Create a store before configuring shipping profiles.
          </p>
        </Card>
      )}

      {activeStore ? (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Create Profile
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
              Advanced shipping profile
            </h2>
            <form action={saveShippingProfile} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <input name="returnTo" type="hidden" value={returnPath} />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Profile template</span>
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  name="template"
                >
                  {profileTemplates.map((template) => (
                    <option key={template.name} value={template.name}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <Input id="name" label="Name" name="name" placeholder="Local Shipping" required />
                <Input id="sortOrder" label="Sort order" name="sortOrder" placeholder="0" type="number" />
                <Input id="preparationDays" label="Preparation days" name="preparationDays" placeholder="1" type="number" />
                <Input id="estimatedDeliveryDays" label="Estimated delivery days" name="estimatedDeliveryDays" placeholder="3" type="number" />
              </div>
              <Textarea
                id="description"
                label="Description"
                name="description"
                placeholder="Describe where this profile applies and how it should be used."
              />
              <ProfileFlags />
              <MethodCheckboxes methods={data.methods} selectedIds={[]} />
              <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
                Shipping zones and rate rules can attach to these profiles in the next phase.
              </div>
              <Button type="submit">Create shipping profile</Button>
            </form>
          </Card>

          <div className="grid gap-6">
            <Card className="p-6 lg:p-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Existing Methods
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
                Methods available for linking
              </h2>
              <div className="mt-5 grid gap-3">
                {data.methods.length ? data.methods.map((method) => (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={method.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-ink">{methodName(method)}</h3>
                        <p className="mt-1 text-sm text-muted">{methodSummary(method)}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        {method.profile_id ? "Linked" : "Unlinked"}
                      </span>
                    </div>
                  </div>
                )) : (
                  <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-muted">
                    No shipping methods yet. Add methods from Dashboard → Shipping, then link them here.
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-6 lg:p-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Profiles
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
                Shipping profile groups
              </h2>
              <div className="mt-5 grid gap-4">
                {data.profiles.length ? data.profiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    methods={data.methods}
                    profile={profile}
                    returnPath={returnPath}
                    storeId={activeStore.id}
                  />
                )) : (
                  <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-muted">
                    No shipping profiles yet. Create Local, International, Express, Free, or Heavy Product profiles to start.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProfileFlags({ profile }: { profile?: ShippingProfileRow }) {
  const flags = [
    ["enabled", "Enabled", profile?.enabled ?? true],
    ["codSupported", "COD support", profile?.cod_supported ?? true],
    ["freeShippingEnabled", "Free shipping option", profile?.free_shipping_enabled ?? false],
    ["isDefault", "Default profile", profile?.is_default ?? false]
  ] as const;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {flags.map(([name, label, checked]) => (
        <label
          className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-ink"
          key={name}
        >
          <input defaultChecked={checked} name={name} type="checkbox" />
          {label}
        </label>
      ))}
    </div>
  );
}

function MethodCheckboxes({
  methods,
  selectedIds
}: {
  methods: ShippingProfileMethodRow[];
  selectedIds: string[];
}) {
  const selected = new Set(selectedIds);

  return (
    <div className="grid gap-2">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Linked shipping methods</p>
      {methods.length ? (
        <div className="grid gap-2">
          {methods.map((method) => (
            <label
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-ink"
              key={method.id}
            >
              <input defaultChecked={selected.has(method.id)} name="methodIds" type="checkbox" value={method.id} />
              <span>
                <span className="block font-black">{methodName(method)}</span>
                <span className="mt-1 block text-xs text-muted">{methodSummary(method)}</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-muted">
          No existing shipping methods are available to link yet.
        </p>
      )}
    </div>
  );
}

function ProfileCard({
  methods,
  profile,
  returnPath,
  storeId
}: {
  methods: ShippingProfileMethodRow[];
  profile: ShippingProfileRow;
  returnPath: string;
  storeId: string;
}) {
  const linkedMethods = methods.filter((method) => profile.linkedMethodIds.includes(method.id));

  return (
    <details className="rounded-3xl border border-slate-200 bg-slate-50 p-4" open={false}>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-ink">{profile.name}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              {profile.description || "No description yet."}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
            profile.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
          }`}>
            {profile.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          <span className="rounded-full bg-white px-3 py-1">{profile.preparation_days} prep days</span>
          <span className="rounded-full bg-white px-3 py-1">{profile.estimated_delivery_days} delivery days</span>
          <span className="rounded-full bg-white px-3 py-1">{profile.cod_supported ? "COD" : "No COD"}</span>
          {profile.free_shipping_enabled ? <span className="rounded-full bg-white px-3 py-1">Free shipping</span> : null}
          <span className="rounded-full bg-white px-3 py-1">{linkedMethods.length} methods</span>
        </div>
      </summary>
      <form action={saveShippingProfile} className="mt-5 grid gap-4 rounded-3xl bg-white p-4">
        <input name="profileId" type="hidden" value={profile.id} />
        <input name="storeId" type="hidden" value={storeId} />
        <input name="returnTo" type="hidden" value={returnPath} />
        <div className="grid gap-4 md:grid-cols-2">
          <Input defaultValue={profile.name} id={`name-${profile.id}`} label="Name" name="name" required />
          <Input defaultValue={profile.sort_order} id={`sort-${profile.id}`} label="Sort order" name="sortOrder" type="number" />
          <Input defaultValue={profile.preparation_days} id={`prep-${profile.id}`} label="Preparation days" name="preparationDays" type="number" />
          <Input defaultValue={profile.estimated_delivery_days} id={`delivery-${profile.id}`} label="Estimated delivery days" name="estimatedDeliveryDays" type="number" />
        </div>
        <Textarea
          defaultValue={profile.description ?? ""}
          id={`description-${profile.id}`}
          label="Description"
          name="description"
        />
        <ProfileFlags profile={profile} />
        <MethodCheckboxes methods={methods} selectedIds={profile.linkedMethodIds} />
        <Button type="submit" variant="secondary">Update profile</Button>
      </form>
    </details>
  );
}
