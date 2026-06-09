import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createDeliveryAgentAction } from "@/lib/delivery-actions";
import { sendOwnerDeliveryMessageAction } from "@/lib/delivery/communication-actions";
import { calculateDeliveryPerformanceMetrics, type DeliveryPerformanceMetrics } from "@/lib/delivery/performance-data";
import { createDeliveryZoneAction, updateDeliveryAgentCapacityAction } from "@/lib/delivery/route-actions";
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
  assigned_zone_ids: string[] | null;
  availability_status: string | null;
  capacity_limit: number | null;
  city_zone: string | null;
  created_at: string;
  current_active_orders: number | null;
  email: string | null;
  id: string;
  name: string;
  phone: string;
  status: string;
};

type DeliveryZoneRow = {
  city: string | null;
  created_at: string;
  id: string;
  is_active: boolean;
  name: string;
  region: string | null;
};

type DeliveryAssignmentLoadRow = {
  customer_city: string | null;
  delivery_agent_id: string;
  status: string;
};

type DeliveryMessageRow = {
  created_at: string;
  delivery_agent_id: string;
  id: string;
  message: string;
  sender_type: string;
  status: string;
};

type DeliveryAgentsData = {
  activeLoads: Map<string, number>;
  activeStore: UserStoreRow | null;
  agents: DeliveryAgentRow[];
  error: string | null;
  messagesByAgent: Map<string, DeliveryMessageRow[]>;
  performance: Map<string, DeliveryPerformanceMetrics>;
  stores: UserStoreRow[];
  zones: DeliveryZoneRow[];
};

function statusMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    "access-denied": "You do not have permission to manage delivery agents for that store.",
    "capacity-failed": "Delivery capacity settings could not be updated.",
    "capacity-invalid": "Enter a valid capacity, availability, and zone assignment.",
    "capacity-updated": "Delivery capacity settings updated.",
    "create-failed": "Delivery agent could not be created. Apply the delivery migration and try again.",
    created: "Delivery agent created.",
    duplicate: "A delivery agent with that phone already exists for this store.",
    invalid: "Enter a delivery agent name, phone, city/zone, and valid status.",
    "message-access-denied": "You can only message delivery agents for your own store.",
    "message-failed": "Delivery message could not be sent.",
    "message-invalid": "Enter a message before sending.",
    "message-sent": "Delivery message sent.",
    "zone-created": "Delivery zone created.",
    "zone-duplicate": "A delivery zone with that name already exists for this store.",
    "zone-failed": "Delivery zone could not be created.",
    "zone-invalid": "Enter a valid delivery zone name and store."
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
    return {
      activeLoads: new Map<string, number>(),
      activeStore: null,
      agents: [],
      error: "Sign in to manage delivery agents.",
      messagesByAgent: new Map<string, DeliveryMessageRow[]>(),
      performance: new Map<string, DeliveryPerformanceMetrics>(),
      stores: [],
      zones: []
    };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "manage_orders")) {
    return {
      activeLoads: new Map<string, number>(),
      activeStore: null,
      agents: [],
      error: "You do not have permission to manage delivery agents.",
      messagesByAgent: new Map<string, DeliveryMessageRow[]>(),
      performance: new Map<string, DeliveryPerformanceMetrics>(),
      stores: [],
      zones: []
    };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      activeLoads: new Map<string, number>(),
      agents: [],
      error: storesError ? "Stores could not be loaded." : null,
      messagesByAgent: new Map<string, DeliveryMessageRow[]>(),
      performance: new Map<string, DeliveryPerformanceMetrics>(),
      stores,
      zones: []
    };
  }

  const [agentsResult, zonesResult, assignmentsResult] = await Promise.all([
    supabase
      .from("store_delivery_agents" as never)
      .select("id, name, phone, email, city_zone, status, availability_status, capacity_limit, current_active_orders, assigned_zone_ids, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("created_at" as never, { ascending: false } as never),
    supabase
      .from("delivery_zones" as never)
      .select("id, name, city, region, is_active, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("created_at" as never, { ascending: false } as never),
    supabase
      .from("delivery_assignments" as never)
      .select("delivery_agent_id, status, customer_city")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .in("status" as never, ["assigned", "accepted", "picked_up"] as never)
  ]);

  if (agentsResult.error) {
    return {
      activeLoads: new Map<string, number>(),
      activeStore,
      agents: [],
      error: "Delivery agents could not be loaded. Apply the delivery migration.",
      messagesByAgent: new Map<string, DeliveryMessageRow[]>(),
      performance: new Map<string, DeliveryPerformanceMetrics>(),
      stores,
      zones: []
    };
  }

  if (zonesResult.error) {
    return {
      activeLoads: new Map<string, number>(),
      activeStore,
      agents: (agentsResult.data ?? []) as unknown as DeliveryAgentRow[],
      error: "Delivery zones could not be loaded. Apply the route capacity migration.",
      messagesByAgent: new Map<string, DeliveryMessageRow[]>(),
      performance: new Map<string, DeliveryPerformanceMetrics>(),
      stores,
      zones: []
    };
  }

  const activeLoads = new Map<string, number>();

  for (const assignment of (assignmentsResult.data ?? []) as unknown as DeliveryAssignmentLoadRow[]) {
    activeLoads.set(assignment.delivery_agent_id, (activeLoads.get(assignment.delivery_agent_id) ?? 0) + 1);
  }

  const agents = (agentsResult.data ?? []) as unknown as DeliveryAgentRow[];
  const performanceRows = await Promise.all(
    agents.map((agent) =>
      calculateDeliveryPerformanceMetrics({
        agentId: agent.id,
        storeId: activeStore.id,
        workspaceId
      })
    )
  );
  const performance = new Map(performanceRows.map((metrics) => [metrics.deliveryAgentId, metrics]));
  const { data: messageRows } = await supabase
    .from("delivery_messages" as never)
    .select("id, delivery_agent_id, sender_type, message, status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(50);
  const messagesByAgent = new Map<string, DeliveryMessageRow[]>();

  for (const message of (messageRows ?? []) as unknown as DeliveryMessageRow[]) {
    const current = messagesByAgent.get(message.delivery_agent_id) ?? [];
    if (current.length < 3) {
      messagesByAgent.set(message.delivery_agent_id, [...current, message]);
    }
  }

  return {
    activeLoads,
    activeStore,
    agents,
    error: null,
    messagesByAgent,
    performance,
    stores,
    zones: (zonesResult.data ?? []) as unknown as DeliveryZoneRow[]
  };
}

export default async function DeliveryAgentsPage({ searchParams }: DeliveryAgentsPageProps) {
  const query = await searchParams;
  const { activeLoads, activeStore, agents, error, messagesByAgent, performance, stores, zones } = await getDeliveryAgentsData(query.storeId);
  const message = statusMessage(query.delivery);
  const onlineAgents = agents.filter((agent) => agent.availability_status === "online").length;
  const busyAgents = agents.filter((agent) => agent.availability_status === "busy").length;
  const offlineAgents = agents.filter((agent) => (agent.availability_status ?? "offline") === "offline").length;
  const capacityReached = agents.filter((agent) => {
    const activeLoad = activeLoads.get(agent.id) ?? 0;
    return activeLoad >= (agent.capacity_limit ?? 0);
  }).length;
  const availableCapacity = agents.reduce((sum, agent) => {
    const activeLoad = activeLoads.get(agent.id) ?? 0;
    return sum + Math.max((agent.capacity_limit ?? 0) - activeLoad, 0);
  }, 0);
  const ordersPerAgent = agents.length ? Math.round((Array.from(activeLoads.values()).reduce((sum, value) => sum + value, 0) / agents.length) * 10) / 10 : 0;
  const performanceRows = Array.from(performance.values());
  const topAgent = performanceRows
    .slice()
    .sort((a, b) => b.successRate - a.successRate || b.ratingAverage - a.ratingAverage)[0];
  const bestRated = performanceRows.slice().sort((a, b) => b.ratingAverage - a.ratingAverage)[0];
  const lowestReturn = performanceRows.slice().sort((a, b) => a.returnRate - b.returnRate)[0];
  const highestDeliveries = performanceRows.slice().sort((a, b) => b.totalDeliveredOrders - a.totalDeliveredOrders)[0];

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Manage delivery agents, coverage zones, availability, and capacity before assigning order deliveries."
        title="Delivery Management"
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

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Agents" value={agents.length} />
        <MetricCard label="Online Agents" value={onlineAgents} />
        <MetricCard label="Offline Agents" value={offlineAgents} />
        <MetricCard label="Busy Agents" value={busyAgents} />
        <MetricCard label="Capacity Reached" value={capacityReached} />
        <MetricCard label="Available Capacity" value={availableCapacity} />
        <MetricCard label="Orders Per Agent" value={ordersPerAgent} />
        <MetricCard label="Active Zones" value={zones.filter((zone) => zone.is_active).length} />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Top Delivery Agents" value={topAgent ? `${topAgent.successRate}%` : "0%"} />
        <MetricCard label="Lowest Return Rate" value={lowestReturn ? `${lowestReturn.returnRate}%` : "0%"} />
        <MetricCard label="Best Ratings" value={bestRated ? `${bestRated.ratingAverage}/5` : "0/5"} />
        <MetricCard label="Highest Deliveries" value={highestDeliveries?.totalDeliveredOrders ?? 0} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="grid gap-6">
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
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">Create delivery zone</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Coverage zones prepare future auto-assignment, GPS routing, maps, optimization, multi-stop delivery, and driver ranking.
            </p>
            {activeStore ? (
              <form action={createDeliveryZoneAction} className="mt-5 grid gap-4">
                <input name="storeId" type="hidden" value={activeStore.id} />
                <Input label="Zone name" name="name" placeholder="Casablanca Center" required />
                <Input label="City" name="city" placeholder="Casablanca" />
                <Input label="Region" name="region" placeholder="Grand Casablanca" />
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Status</span>
                  <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none" defaultValue="true" name="isActive">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
                <Button type="submit">Create zone</Button>
              </form>
            ) : null}
          </Card>
        </div>

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
            {zones.length ? (
              <div className="grid gap-3 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
                  Zones
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {zones.map((zone) => (
                    <div className="rounded-2xl bg-white p-3" key={zone.id}>
                      <p className="text-sm font-black text-ink">{zone.name}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                        {[zone.city, zone.region].filter(Boolean).join(" / ") || "Coverage zone"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {agents.length ? agents.map((agent) => (
              <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={agent.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{agent.city_zone ?? "No zone"}</p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">{agent.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-muted">{agent.phone}</p>
                    {agent.email ? <p className="mt-1 text-sm font-semibold text-muted">{agent.email}</p> : null}
                    <p className="mt-2 text-sm font-bold text-muted">
                      Load {activeLoads.get(agent.id) ?? 0}/{agent.capacity_limit ?? 0} · Remaining{" "}
                      {Math.max((agent.capacity_limit ?? 0) - (activeLoads.get(agent.id) ?? 0), 0)}
                    </p>
                    {performance.get(agent.id) ? (
                      <p className="mt-2 text-sm font-bold text-muted">
                        Success {performance.get(agent.id)?.successRate}% · Rating{" "}
                        {performance.get(agent.id)?.ratingAverage}/5 · Return {performance.get(agent.id)?.returnRate}% ·{" "}
                        {performance.get(agent.id)?.rank}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(agent.status)}`}>
                      {agent.status}
                    </span>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                      {agent.availability_status ?? "offline"}
                    </span>
                  </div>
                </div>
                <form action={updateDeliveryAgentCapacityAction} className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4">
                  <input name="agentId" type="hidden" value={agent.id} />
                  <input name="storeId" type="hidden" value={activeStore?.id ?? ""} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Availability
                      <select
                        className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink outline-none"
                        defaultValue={agent.availability_status ?? "offline"}
                        name="availabilityStatus"
                      >
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                        <option value="busy">Busy</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Capacity limit
                      <input
                        className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink outline-none"
                        defaultValue={agent.capacity_limit ?? 5}
                        min="0"
                        name="capacityLimit"
                        type="number"
                      />
                    </label>
                  </div>
                  {zones.length ? (
                    <div className="grid gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Assigned zones
                      </p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {zones.map((zone) => (
                          <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-ink" key={zone.id}>
                            <input
                              defaultChecked={(agent.assigned_zone_ids ?? []).includes(zone.id)}
                              name="assignedZoneIds"
                              type="checkbox"
                              value={zone.id}
                            />
                            {zone.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <button
                    className="h-10 rounded-2xl bg-emerald-950 px-4 text-xs font-black uppercase tracking-[0.12em] text-white"
                    type="submit"
                  >
                    Update capacity
                  </button>
                </form>
                <div className="mt-4 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                    Communication
                  </p>
                  <form action={sendOwnerDeliveryMessageAction} className="grid gap-3">
                    <input name="agentId" type="hidden" value={agent.id} />
                    <input name="storeId" type="hidden" value={activeStore?.id ?? ""} />
                    <textarea
                      className="min-h-20 rounded-2xl border border-blue-100 bg-white px-3 py-3 text-sm font-semibold text-ink outline-none"
                      name="message"
                      placeholder="Send a delivery operation message."
                      required
                    />
                    <button
                      className="h-10 rounded-2xl bg-blue-700 px-4 text-xs font-black uppercase tracking-[0.12em] text-white"
                      type="submit"
                    >
                      Send message
                    </button>
                  </form>
                  {(messagesByAgent.get(agent.id) ?? []).length ? (
                    <div className="grid gap-2">
                      {(messagesByAgent.get(agent.id) ?? []).map((message) => (
                        <div className="rounded-2xl bg-white p-3 text-sm font-semibold text-muted" key={message.id}>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-500">
                            {message.sender_type} · {message.status}
                          </p>
                          <p className="mt-1 leading-6">{message.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
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

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </Card>
  );
}
