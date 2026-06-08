import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { disputeCodCollectionAction, settleCodCollectionAction } from "@/lib/delivery/cod-actions";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type CodCenterPageProps = {
  searchParams?: Promise<{ cod?: string | string[]; storeId?: string | string[] }>;
};

type CodCollectionRow = {
  amount: number | string;
  collected_at: string | null;
  currency: string | null;
  delivery_agent_id: string;
  id: string;
  notes: string | null;
  order_id: string;
  order_source: "orders" | "store_orders";
  settled_at: string | null;
  status: string;
  store_id: string;
};

type DeliveryAgentRow = {
  id: string;
  name: string;
};

function cleanParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function numericValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatMoney(amount: number | string, currency = "USD") {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(numericValue(amount));
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function orderReference(orderId: string) {
  return orderId.slice(0, 8).toUpperCase();
}

function codStatusLabel(status: string) {
  const labels: Record<string, string> = {
    collected: "Collected",
    disputed: "Disputed",
    pending_collection: "Pending Collection",
    settled_to_store: "Settled To Store"
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "settled_to_store") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "disputed") {
    return "bg-red-100 text-red-700";
  }

  if (status === "collected") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

function statusMessage(value: string | undefined) {
  const messages: Record<string, { className: string; text: string }> = {
    disputed: {
      className: "border-amber-200 bg-amber-50 text-amber-800",
      text: "COD collection dispute opened."
    },
    failed: {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "COD collection could not be updated."
    },
    invalid: {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Choose a COD collection before updating it."
    },
    "not-collectable": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Only collected cash can be settled to store."
    },
    "not-found": {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "COD collection was not found in this workspace."
    },
    settled: {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      text: "COD collection settled to store."
    }
  };

  return value ? messages[value] ?? null : null;
}

async function loadCodCenterData(selectedStoreId?: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStoreId: null, agents: new Map<string, string>(), collections: [], error: "Sign in to view COD collections.", stores: [] };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "manage_orders")) {
    return { activeStoreId: null, agents: new Map<string, string>(), collections: [], error: "You do not have permission to manage COD collections.", stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStoreId: activeStore?.id ?? null,
      agents: new Map<string, string>(),
      collections: [],
      error: storesError ? "Stores could not be loaded." : null,
      stores
    };
  }

  const [collectionsResult, agentsResult] = await Promise.all([
    supabase
      .from("cod_collections" as never)
      .select("id, store_id, order_id, order_source, delivery_agent_id, amount, currency, status, collected_at, settled_at, notes")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("created_at" as never, { ascending: false } as never),
    supabase
      .from("store_delivery_agents" as never)
      .select("id, name")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
  ]);

  if (collectionsResult.error) {
    return {
      activeStoreId: activeStore.id,
      agents: new Map<string, string>(),
      collections: [],
      error: "COD collections could not be loaded. Apply the COD migration.",
      stores
    };
  }

  const agents = new Map(
    ((agentsResult.data ?? []) as unknown as DeliveryAgentRow[]).map((agent) => [agent.id, agent.name])
  );

  return {
    activeStoreId: activeStore.id,
    agents,
    collections: (collectionsResult.data ?? []) as unknown as CodCollectionRow[],
    error: null,
    stores
  };
}

export default async function CodCenterPage({ searchParams }: CodCenterPageProps) {
  const query = await searchParams;
  const status = statusMessage(cleanParam(query?.cod));
  const { activeStoreId, agents, collections, error, stores } = await loadCodCenterData(cleanParam(query?.storeId));
  const activeStore = stores.find((store) => store.id === activeStoreId) ?? null;
  const collectedCash = collections
    .filter((collection) => collection.status === "collected" || collection.status === "settled_to_store")
    .reduce((sum, collection) => sum + numericValue(collection.amount), 0);
  const settledCash = collections
    .filter((collection) => collection.status === "settled_to_store")
    .reduce((sum, collection) => sum + numericValue(collection.amount), 0);
  const pendingCollections = collections.filter((collection) => collection.status === "pending_collection").length;
  const outstandingCash = collections
    .filter((collection) => collection.status === "collected" || collection.status === "disputed")
    .reduce((sum, collection) => sum + numericValue(collection.amount), 0);
  const currency = collections[0]?.currency ?? "USD";

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Track cash collected by delivery agents and settle collected COD amounts to the store."
        title="COD Center"
      />

      {status ? (
        <Card className={`p-5 ${status.className}`}>
          <p className="text-sm font-bold">{status.text}</p>
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
              <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue={activeStoreId ?? ""} name="storeId">
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </label>
            <button className="h-11 rounded-full bg-ink px-5 text-sm font-bold text-white" type="submit">
              Switch store
            </button>
          </form>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Pending Collections", value: pendingCollections.toLocaleString() },
          { label: "Collected Cash", value: formatMoney(collectedCash, currency ?? "USD") },
          { label: "Settled Cash", value: formatMoney(settledCash, currency ?? "USD") },
          { label: "Outstanding Cash", value: formatMoney(outstandingCash, currency ?? "USD") }
        ].map((card) => (
          <Card className="p-5" key={card.label}>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{card.label}</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">{card.value}</p>
          </Card>
        ))}
      </section>

      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Collections</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {activeStore ? activeStore.name : "No store selected"}
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {collections.length ? collections.map((collection) => (
            <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={collection.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Order {orderReference(collection.order_id)}
                  </p>
                  <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">
                    {formatMoney(collection.amount, collection.currency ?? "USD")}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    Agent: {agents.get(collection.delivery_agent_id) ?? collection.delivery_agent_id.slice(0, 8)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    Collected: {formatDate(collection.collected_at)} · Settled: {formatDate(collection.settled_at)}
                  </p>
                  {collection.notes ? (
                    <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-muted">
                      {collection.notes}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2 text-right">
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(collection.status)}`}>
                    {codStatusLabel(collection.status)}
                  </span>
                  {collection.status === "collected" ? (
                    <form action={settleCodCollectionAction}>
                      <input name="collectionId" type="hidden" value={collection.id} />
                      <button className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
                        Settle
                      </button>
                    </form>
                  ) : null}
                  {collection.status === "collected" ? (
                    <form action={disputeCodCollectionAction}>
                      <input name="collectionId" type="hidden" value={collection.id} />
                      <button className="rounded-full bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
                        Dispute
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <h3 className="text-xl font-black tracking-[-0.03em] text-ink">No COD collections yet</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-muted">
                Delivered orders marked cash collected by delivery agents will appear here.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
