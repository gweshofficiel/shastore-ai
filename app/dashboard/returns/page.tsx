import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateDeliveryReturnStatusAction } from "@/lib/delivery/return-actions";
import { getUserPrimaryWorkspaceId, getUserWorkspaceRole, hasPermission } from "@/lib/permissions/rbac";
import { updateReturnRequestStatusAction } from "@/lib/return-request-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";

export const dynamic = "force-dynamic";

type ReturnsPageProps = {
  searchParams: Promise<{
    returnStatus?: string;
    storeId?: string;
  }>;
};

type ReturnRequestRow = {
  created_at: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  id: string;
  notes: string | null;
  order_id: string;
  order_source: "orders" | "store_orders";
  reason: string;
  status: string;
  store_id: string;
};

type DeliveryReturnRow = {
  approved_delivery_date_placeholder: string | null;
  created_at: string;
  delivery_agent_id: string;
  id: string;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  order_id: string;
  order_source: "orders" | "store_orders";
  reason: string;
  requested_delivery_date_placeholder: string | null;
  status: string;
  store_id: string;
  updated_at: string;
};

type DeliveryAgentRow = {
  id: string;
  name: string;
};

type ReturnsData = {
  activeStore: UserStoreRow | null;
  deliveryAgents: Map<string, string>;
  deliveryReturns: DeliveryReturnRow[];
  error: string | null;
  requests: ReturnRequestRow[];
  stores: UserStoreRow[];
};

const nextActions: Record<string, Array<{ label: string; status: string }>> = {
  approved: [
    { label: "Mark Received", status: "received" },
    { label: "Close", status: "closed" }
  ],
  received: [{ label: "Close", status: "closed" }],
  requested: [
    { label: "Approve", status: "approved" },
    { label: "Reject", status: "rejected" }
  ],
  rejected: [{ label: "Close", status: "closed" }]
};

function statusMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    failed: "Return request status could not be updated.",
    invalid: "That return status is not supported.",
    "not-authorized": "You can only update returns for your own stores.",
    updated: "Return request updated."
  };

  return value ? messages[value] ?? null : null;
}

function deliveryReturnStatusLabel(status: string) {
  const labels: Record<string, string> = {
    customer_refused: "Customer Refused",
    customer_unreachable: "Customer Unreachable",
    reschedule_requested: "Reschedule Requested",
    return_completed: "Return Completed",
    return_in_progress: "Return In Progress",
    returned_to_store: "Returned To Store",
    wrong_address: "Wrong Address"
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function deliveryReturnReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    customer_refused: "Customer Refused",
    customer_unreachable: "Customer Unreachable",
    reschedule_requested: "Reschedule Requested",
    wrong_address: "Wrong Address"
  };

  return labels[reason] ?? reason.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "approved" || status === "received" || status === "closed") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700";
  }

  return "bg-blue-100 text-blue-700";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function orderReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}

async function getReturnsData(selectedStoreId?: string): Promise<ReturnsData> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      activeStore: null,
      deliveryAgents: new Map<string, string>(),
      deliveryReturns: [],
      error: "Sign in to manage returns.",
      requests: [],
      stores: []
    };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "manage_orders")) {
    return {
      activeStore: null,
      deliveryAgents: new Map<string, string>(),
      deliveryReturns: [],
      error: "You do not have permission to manage returns.",
      requests: [],
      stores: []
    };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      deliveryAgents: new Map<string, string>(),
      deliveryReturns: [],
      error: storesError ? "Stores could not be loaded." : null,
      requests: [],
      stores
    };
  }

  const [customerReturnsResult, deliveryReturnsResult, agentsResult] = await Promise.all([
    supabase
      .from("store_return_requests" as never)
      .select("id, store_id, order_source, order_id, customer_name, customer_phone, customer_email, reason, notes, status, created_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("created_at" as never, { ascending: false } as never),
    supabase
      .from("delivery_returns" as never)
      .select("id, store_id, order_source, order_id, delivery_agent_id, reason, status, notes, requested_delivery_date_placeholder, approved_delivery_date_placeholder, metadata, created_at, updated_at")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
      .order("created_at" as never, { ascending: false } as never),
    supabase
      .from("store_delivery_agents" as never)
      .select("id, name")
      .eq("workspace_id" as never, workspaceId as never)
      .eq("store_id" as never, activeStore.id as never)
  ]);

  if (customerReturnsResult.error) {
    return {
      activeStore,
      deliveryAgents: new Map<string, string>(),
      deliveryReturns: [],
      error: "Return requests could not be loaded. Apply the returns migration.",
      requests: [],
      stores
    };
  }

  if (deliveryReturnsResult.error) {
    return {
      activeStore,
      deliveryAgents: new Map<string, string>(),
      deliveryReturns: [],
      error: "Delivery returns could not be loaded. Apply the delivery returns migration.",
      requests: (customerReturnsResult.data ?? []) as unknown as ReturnRequestRow[],
      stores
    };
  }

  const deliveryAgents = new Map(
    ((agentsResult.data ?? []) as unknown as DeliveryAgentRow[]).map((agent) => [agent.id, agent.name])
  );

  return {
    activeStore,
    deliveryAgents,
    deliveryReturns: (deliveryReturnsResult.data ?? []) as unknown as DeliveryReturnRow[],
    error: null,
    requests: (customerReturnsResult.data ?? []) as unknown as ReturnRequestRow[],
    stores
  };
}

export default async function ReturnsPage({ searchParams }: ReturnsPageProps) {
  const query = await searchParams;
  const { activeStore, deliveryAgents, deliveryReturns, error, requests, stores } = await getReturnsData(query.storeId);
  const message = statusMessage(query.returnStatus);
  const statusCounts = {
    approved: requests.filter((request) => request.status === "approved").length,
    received: requests.filter((request) => request.status === "received").length,
    requested: requests.filter((request) => request.status === "requested").length
  };
  const completedDeliveryReturns = deliveryReturns.filter((item) => item.status === "return_completed").length;
  const inProgressDeliveryReturns = deliveryReturns.filter((item) =>
    ["customer_refused", "customer_unreachable", "wrong_address", "return_in_progress", "returned_to_store"].includes(item.status)
  ).length;
  const reschedules = deliveryReturns.filter((item) => item.status === "reschedule_requested").length;
  const refusalRate = deliveryReturns.length
    ? Math.round((deliveryReturns.filter((item) => item.reason === "customer_refused").length / deliveryReturns.length) * 100)
    : 0;
  const rescheduleRate = deliveryReturns.length ? Math.round((reschedules / deliveryReturns.length) * 100) : 0;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Review customer return requests and delivery failed-return workflows from one store-scoped center."
        title="Return Center"
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
        <MetricCard label="Failed Deliveries" value={deliveryReturns.length} />
        <MetricCard label="Returns In Progress" value={inProgressDeliveryReturns} />
        <MetricCard label="Completed Returns" value={completedDeliveryReturns} />
        <MetricCard label="Reschedules" value={reschedules} />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Failed Delivery Rate" value={`${deliveryReturns.length ? 100 : 0}%`} />
        <MetricCard label="Return Rate" value={`${deliveryReturns.length ? Math.round(((inProgressDeliveryReturns + completedDeliveryReturns) / deliveryReturns.length) * 100) : 0}%`} />
        <MetricCard label="Refusal Rate" value={`${refusalRate}%`} />
        <MetricCard label="Reschedule Rate" value={`${rescheduleRate}%`} />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Customer Return Requests" value={requests.length} />
        <MetricCard label="Customer Requested" value={statusCounts.requested} />
        <MetricCard label="Customer Approved" value={statusCounts.approved} />
        <MetricCard label="Customer Received" value={statusCounts.received} />
      </section>

      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Store returns</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              {activeStore ? activeStore.name : "No store selected"}
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Delivery failed returns
          </p>
          {deliveryReturns.length ? deliveryReturns.map((deliveryReturn) => (
            <article className="rounded-[1.5rem] border border-red-100 bg-red-50 p-5" key={deliveryReturn.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-red-400">
                    Order {orderReference(deliveryReturn.order_id)}
                  </p>
                  <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-red-950">
                    {deliveryReturnReasonLabel(deliveryReturn.reason)}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-red-900">
                    Agent: {deliveryAgents.get(deliveryReturn.delivery_agent_id) ?? deliveryReturn.delivery_agent_id.slice(0, 8)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-red-500">
                    Reported {formatDate(deliveryReturn.created_at)}
                  </p>
                  {deliveryReturn.requested_delivery_date_placeholder ? (
                    <p className="mt-1 text-sm font-semibold text-red-900">
                      Requested date: {formatDate(deliveryReturn.requested_delivery_date_placeholder)}
                    </p>
                  ) : null}
                  {deliveryReturn.approved_delivery_date_placeholder ? (
                    <p className="mt-1 text-sm font-semibold text-red-900">
                      Approved date: {formatDate(deliveryReturn.approved_delivery_date_placeholder)}
                    </p>
                  ) : null}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(deliveryReturn.status)}`}>
                  {deliveryReturnStatusLabel(deliveryReturn.status)}
                </span>
              </div>
              {deliveryReturn.notes ? (
                <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-red-950">
                  {deliveryReturn.notes}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href={`/dashboard/orders/${deliveryReturn.order_id}?source=${deliveryReturn.order_source}`} variant="secondary">
                  View order
                </ButtonLink>
                {deliveryReturn.status === "reschedule_requested" ? (
                  <form action={updateDeliveryReturnStatusAction} className="flex flex-wrap gap-2">
                    <input name="returnId" type="hidden" value={deliveryReturn.id} />
                    <input
                      className="h-10 rounded-full border border-red-100 bg-white px-4 text-xs font-bold text-ink"
                      name="approvedDeliveryDate"
                      type="datetime-local"
                    />
                    <button
                      className="h-10 rounded-full bg-emerald-600 px-4 text-xs font-black uppercase tracking-[0.14em] text-white"
                      name="status"
                      type="submit"
                      value="reschedule_requested"
                    >
                      Approve Reschedule
                    </button>
                  </form>
                ) : null}
                {[
                  { label: "Return In Progress", status: "return_in_progress" },
                  { label: "Returned To Store", status: "returned_to_store" },
                  { label: "Complete Return", status: "return_completed" }
                ]
                  .filter((action) => action.status !== deliveryReturn.status)
                  .map((action) => (
                    <form action={updateDeliveryReturnStatusAction} key={action.status}>
                      <input name="returnId" type="hidden" value={deliveryReturn.id} />
                      <button
                        className="h-10 rounded-full border border-red-100 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-ink transition hover:bg-red-50"
                        name="status"
                        type="submit"
                        value={action.status}
                      >
                        {action.label}
                      </button>
                    </form>
                  ))}
              </div>
            </article>
          )) : (
            <div className="rounded-[1.5rem] border border-dashed border-red-200 bg-red-50 p-8 text-center">
              <h3 className="text-xl font-black tracking-[-0.03em] text-red-950">No delivery returns yet</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-red-900">
                Failed delivery reports from delivery agents will appear here.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Customer product returns
          </p>
          {requests.length ? requests.map((request) => (
            <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5" key={request.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Order {orderReference(request.order_id)}
                  </p>
                  <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">{request.reason}</h3>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    {request.customer_name ?? "Customer"} · {request.customer_phone ?? "No phone"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-400">Requested {formatDate(request.created_at)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(request.status)}`}>
                  {request.status}
                </span>
              </div>

              {request.notes ? (
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">{request.notes}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href={`/dashboard/orders/${request.order_id}?source=${request.order_source}`} variant="secondary">
                  View order
                </ButtonLink>
                {(nextActions[request.status] ?? []).map((action) => (
                  <form action={updateReturnRequestStatusAction} key={action.status}>
                    <input name="requestId" type="hidden" value={request.id} />
                    <input name="storeId" type="hidden" value={request.store_id} />
                    <button
                      className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-ink transition hover:border-slate-300 hover:bg-slate-50"
                      name="status"
                      type="submit"
                      value={action.status}
                    >
                      {action.label}
                    </button>
                  </form>
                ))}
              </div>
            </article>
          )) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <h3 className="text-xl font-black tracking-[-0.03em] text-ink">No return requests yet</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-muted">
                Customer return requests submitted from order details will appear here.
              </p>
            </div>
          )}
        </div>
      </Card>
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
