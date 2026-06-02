import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

type ReturnsData = {
  activeStore: UserStoreRow | null;
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
    return { activeStore: null, error: "Sign in to manage returns.", requests: [], stores: [] };
  }

  const workspaceId = await getUserPrimaryWorkspaceId(supabase, user.id);
  const role = await getUserWorkspaceRole(supabase, workspaceId, user.id);

  if (!hasPermission(role, "manage_orders")) {
    return { activeStore: null, error: "You do not have permission to manage returns.", requests: [], stores: [] };
  }

  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (storesError || !activeStore) {
    return {
      activeStore,
      error: storesError ? "Stores could not be loaded." : null,
      requests: [],
      stores
    };
  }

  const { data, error } = await supabase
    .from("store_return_requests" as never)
    .select("id, store_id, order_source, order_id, customer_name, customer_phone, customer_email, reason, notes, status, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("created_at" as never, { ascending: false } as never);

  if (error) {
    return {
      activeStore,
      error: "Return requests could not be loaded. Apply the returns migration.",
      requests: [],
      stores
    };
  }

  return {
    activeStore,
    error: null,
    requests: (data ?? []) as unknown as ReturnRequestRow[],
    stores
  };
}

export default async function ReturnsPage({ searchParams }: ReturnsPageProps) {
  const query = await searchParams;
  const { activeStore, error, requests, stores } = await getReturnsData(query.storeId);
  const message = statusMessage(query.returnStatus);
  const statusCounts = {
    approved: requests.filter((request) => request.status === "approved").length,
    received: requests.filter((request) => request.status === "received").length,
    requested: requests.filter((request) => request.status === "requested").length
  };

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Review customer product return requests and move them through approval, receipt, and closure."
        title="Returns"
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
        <MetricCard label="Return requests" value={requests.length} />
        <MetricCard label="Requested" value={statusCounts.requested} />
        <MetricCard label="Approved" value={statusCounts.approved} />
        <MetricCard label="Received" value={statusCounts.received} />
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">{value.toLocaleString()}</p>
    </Card>
  );
}
