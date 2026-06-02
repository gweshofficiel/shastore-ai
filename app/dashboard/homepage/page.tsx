import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveStoreHomepageSections } from "@/lib/store-homepage-actions";
import {
  loadOrCreateStoreHomepageSections,
  storeHomepageSectionOptions,
  type StoreHomepageSection
} from "@/lib/store-homepage-sections";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type HomepageDashboardData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  sections: StoreHomepageSection[];
  stores: UserStoreRow[];
};

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    "missing-store": "Choose a store before managing the homepage.",
    "not-authorized": "You do not have permission to manage that store homepage.",
    saved: "Homepage section configuration saved.",
    "save-failed": "Homepage section configuration could not be saved."
  };

  return status ? messages[status] : null;
}

function sectionLabel(sectionType: string) {
  return (
    storeHomepageSectionOptions.find((option) => option.sectionType === sectionType)?.label ??
    sectionType
  );
}

async function getHomepageDashboardData(
  selectedStoreId?: string
): Promise<HomepageDashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      error: "Sign in to manage your homepage.",
      sections: [],
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
      error: "Stores could not be loaded.",
      sections: [],
      stores: []
    };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return {
      activeStore: null,
      error: null,
      sections: [],
      stores
    };
  }

  const sections = await loadOrCreateStoreHomepageSections({
    storeId: activeStore.id,
    supabase,
    workspaceId
  });

  if (!sections.length) {
    return {
      activeStore,
      error: "Homepage sections could not be loaded. Confirm the homepage sections migration has been applied.",
      sections: [],
      stores
    };
  }

  return {
    activeStore,
    error: null,
    sections,
    stores
  };
}

export default async function HomepageDashboard({
  searchParams
}: {
  searchParams: Promise<{ homepage?: string; storeId?: string }>;
}) {
  const query = await searchParams;
  const { activeStore, error, sections, stores } = await getHomepageDashboardData(query.storeId);
  const message = statusMessage(query.homepage);
  const enabledSections = sections.filter((section) => section.enabled);

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Control the public storefront homepage sections without changing products, pages, templates, or checkout systems."
        title="Homepage"
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
                  Homepage sections
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                  Enabled sections render publicly in ascending display order.
                </p>
              </div>
              {activeStore.slug ? (
                <a
                  className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted"
                  href={`/store/${activeStore.slug}`}
                  target="_blank"
                >
                  Preview
                </a>
              ) : null}
            </div>

            <form action={saveStoreHomepageSections} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              {sections.map((section) => (
                <div
                  className="grid gap-4 rounded-[2rem] border border-slate-200 bg-slate-50 p-4"
                  key={section.sectionType}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        {section.sectionType.replaceAll("_", " ")}
                      </p>
                      <h3 className="mt-1 text-xl font-black tracking-[-0.03em] text-ink">
                        {sectionLabel(section.sectionType)}
                      </h3>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-black text-ink">
                      <input
                        className="h-5 w-5 rounded border-slate-300 text-ink"
                        defaultChecked={section.enabled}
                        name={`${section.sectionType}.enabled`}
                        type="checkbox"
                      />
                      Enabled
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem]">
                    <Input
                      defaultValue={section.title ?? ""}
                      id={`${section.sectionType}-title`}
                      label="Title"
                      maxLength={180}
                      name={`${section.sectionType}.title`}
                    />
                    <Input
                      defaultValue={section.sortOrder}
                      id={`${section.sectionType}-sort-order`}
                      label="Display order"
                      name={`${section.sectionType}.sortOrder`}
                      step={1}
                      type="number"
                    />
                  </div>
                  <Textarea
                    defaultValue={section.subtitle ?? ""}
                    id={`${section.sectionType}-subtitle`}
                    label="Subtitle"
                    maxLength={500}
                    name={`${section.sectionType}.subtitle`}
                    rows={3}
                  />
                </div>
              ))}
              <Button type="submit">Save homepage</Button>
            </form>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Preview configuration
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              Public order
            </h2>
            <div className="mt-5 grid gap-3">
              {enabledSections.length ? (
                enabledSections.map((section) => (
                  <div
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                    key={section.sectionType}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-ink">
                        {section.sortOrder}. {sectionLabel(section.sectionType)}
                      </p>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
                        Enabled
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                      {section.title}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-muted">
                  All homepage content sections are disabled.
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
