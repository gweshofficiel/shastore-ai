import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createDeliveryAgentAction } from "@/lib/delivery-actions";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type DeliveryAgentsPageProps = {
  searchParams: Promise<{
    delivery?: string;
    storeId?: string;
  }>;
};

type DeliveryAgentRow = {
  city_zone: string | null;
  created_at: string;
  email: string | null;
  id: string;
  name: string;
  phone: string;
  status: string;
};

type DeliveryAgentsData = {
  activeStore: UserStoreRow | null;
  agents: DeliveryAgentRow[];
  error: string | null;
  stores: UserStoreRow[];
};

function statusMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    "access-denied": "You do not have permission to manage delivery agents for that store.",
    "create-failed": "Delivery agent could not be created. Apply the delivery migration and try again.",
    created: "Delivery agent created.",
    duplicate: "A delivery agent with that phone already exists for this store.",
    invalid: "Enter a delivery agent name, phone, city/zone, and valid status."
  };

  return value ? messages[value] ?? null : null;
}

function statusClass(status: string) {
  return status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700";
}

async function getDeliveryAgentsData(selectedStoreId?: string): Promise<DeliveryAgentsData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { activeStore: null, agents: [], error: "Sign in to manage delivery agents.", stores: [] };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "manage_orders")) {
    return { activeStore: null, agents: [], error: "You do not have permission to manage delivery agents.", stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      agents: [],
      error: storesError ? "Stores could not be loaded." : null,
      stores
    };
  }

  const { data, error } = await supabase
    .from("store_delivery_agents" as never)
    .select("id, name, phone, email, city_zone, status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("created_at" as never, { ascending: false } as never);

  if (error) {
    return {
      activeStore,
      agents: [],
      error: "Delivery agents could not be loaded. Apply the delivery migration.",
      stores
    };
  }

  return {
    activeStore,
    agents: (data ?? []) as unknown as DeliveryAgentRow[],
    error: null,
    stores
  };
}

export default async function DeliveryAgentsPage({ searchParams }: DeliveryAgentsPageProps) {
  const query = await searchParams;
  const { activeStore, agents, error, stores } = await getDeliveryAgentsData(query.storeId);
  const message = statusMessage(query.delivery);
  const activeAgents = agents.filter((agent) => agent.status === "active").length;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Create store-scoped delivery agents and use them when assigning order deliveries."
        title="Delivery Agents"
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
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit">Switch store</Button>
          </form>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Agents" value={agents.length} />
        <MetricCard label="Active agents" value={activeAgents} />
        <MetricCard label="Inactive agents" value={agents.length - activeAgents} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-6">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">Create delivery agent</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Agents are scoped to the selected store and can only be assigned to orders from that same store.
          </p>
          {activeStore ? (
            <form action={createDeliveryAgentAction} className="mt-5 grid gap-4">
              <input name="storeId" type="hidden" value={activeStore.id} />
              <Input label="Name" name="name" placeholder="Livreur name" required />
              <Input label="Phone" name="phone" placeholder="+212..." required />
              <Input label="Email optional" name="email" placeholder="agent@example.com" type="email" />
              <Input label="City / Zone" name="cityZone" placeholder="Casablanca Maarif" required />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Status</span>
                <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue="active" name="status">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <Button type="submit">Create delivery agent</Button>
            </form>
          ) : null}
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Store agents</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
                {activeStore ? activeStore.name : "No store selected"}
              </h2>
            </div>
            {activeStore ? (
              <ButtonLink href="/dashboard/orders" variant="secondary">
                Assign orders
              </ButtonLink>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3">
            {agents.length ? agents.map((agent) => (
              <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={agent.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{agent.city_zone ?? "No zone"}</p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">{agent.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-muted">{agent.phone}</p>
                    {agent.email ? <p className="mt-1 text-sm font-semibold text-muted">{agent.email}</p> : null}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(agent.status)}`}>
                    {agent.status}
                  </span>
                </div>
              </article>
            )) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <h3 className="text-xl font-black tracking-[-0.03em] text-ink">No delivery agents yet</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-muted">
                  Create the first delivery agent for this store, then assign them from an order detail page.
                </p>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">{value.toLocaleString()}</p>
    </Card>
  );
}
