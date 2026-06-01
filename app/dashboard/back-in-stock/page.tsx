import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateBackInStockRequestStatusAction } from "@/lib/back-in-stock-actions";
import { createClient } from "@/lib/supabase/server";
import { fetchStoresForAuthUser, type UserStoreRow } from "@/lib/stores/user-stores";
import { getActiveWorkspaceForUser } from "@/lib/workspaces/active-workspace";

export const dynamic = "force-dynamic";

type BackInStockPageProps = {
  searchParams: Promise<{
    stock?: string;
    storeId?: string;
  }>;
};

type BackInStockRequestRow = {
  cancelled_at: string | null;
  created_at: string;
  customer_email: string;
  id: string;
  notification_status: string;
  notified_at: string | null;
  product_id: string;
};

type ProductSummary = {
  id: string;
  image_url?: string | null;
  title?: string | null;
  name?: string | null;
};

type BackInStockData = {
  activeStore: UserStoreRow | null;
  error: string | null;
  productsById: Map<string, ProductSummary>;
  requests: BackInStockRequestRow[];
  stores: UserStoreRow[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    cancelled: "Cancelled",
    notified: "Notified",
    pending: "Pending"
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function statusClass(status: string) {
  const classes: Record<string, string> = {
    cancelled: "bg-slate-100 text-slate-700",
    notified: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700"
  };

  return classes[status] ?? "bg-slate-100 text-slate-700";
}

function noticeMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    "not-authorized": "You are not authorized to manage this request.",
    "request-invalid": "Request update was invalid.",
    "request-missing": "Request was not found.",
    "status-updated": "Request status updated.",
    "update-failed": "Request status could not be updated."
  };

  return value ? messages[value] : null;
}

async function getBackInStockData(selectedStoreId?: string): Promise<BackInStockData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      activeStore: null,
      error: "Sign in to view back-in-stock requests.",
      productsById: new Map(),
      requests: [],
      stores: []
    };
  }

  const selection = await getActiveWorkspaceForUser({ supabase, userId: user.id });
  const workspaceId = selection.activeWorkspaceId;
  const { stores, error: storesError } = await fetchStoresForAuthUser(supabase, user.id, workspaceId);

  if (storesError) {
    return {
      activeStore: null,
      error: "Stores could not be loaded.",
      productsById: new Map(),
      requests: [],
      stores: []
    };
  }

  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;

  if (!activeStore) {
    return { activeStore: null, error: null, productsById: new Map(), requests: [], stores };
  }

  const { data, error } = await supabase
    .from("store_back_in_stock_requests" as never)
    .select("id, product_id, customer_email, notification_status, notified_at, cancelled_at, created_at")
    .eq("workspace_id" as never, workspaceId as never)
    .eq("store_id" as never, activeStore.id as never)
    .order("created_at" as never, { ascending: false } as never)
    .limit(100);

  if (error) {
    return {
      activeStore,
      error: "Back-in-stock requests could not be loaded.",
      productsById: new Map(),
      requests: [],
      stores
    };
  }

  const requests = (data ?? []) as unknown as BackInStockRequestRow[];
  const productIds = Array.from(new Set(requests.map((request) => request.product_id).filter(Boolean)));
  const { data: products } = productIds.length
    ? await supabase
        .from("store_products" as never)
        .select("id, title, name, image_url")
        .eq("store_id" as never, activeStore.id as never)
        .in("id" as never, productIds as never)
    : { data: [] };

  return {
    activeStore,
    error: null,
    productsById: new Map(((products ?? []) as unknown as ProductSummary[]).map((product) => [product.id, product])),
    requests,
    stores
  };
}

export default async function BackInStockPage({
  searchParams
}: BackInStockPageProps) {
  const query = await searchParams;
  const { activeStore, error, productsById, requests, stores } = await getBackInStockData(query.storeId);
  const notice = noticeMessage(query.stock);
  const returnTo = `/dashboard/back-in-stock${activeStore ? `?storeId=${encodeURIComponent(activeStore.id)}` : ""}`;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Review customer requests to be notified when sold-out products become available again."
        title="Back in stock requests"
      />

      {notice ? (
        <Card className="border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          {notice}
        </Card>
      ) : null}

      {error ? (
        <Card className="border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-800">
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
                    {store.name}
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

      <div className="grid gap-4">
        {requests.length ? (
          requests.map((request) => {
            const product = productsById.get(request.product_id);

            return (
              <Card className="grid gap-4 p-5" key={request.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-4">
                    {product?.image_url ? (
                      <img
                        alt={product.title ?? product.name ?? "Product"}
                        className="h-16 w-16 rounded-2xl object-cover"
                        src={product.image_url}
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-2xl bg-slate-100" />
                    )}
                    <div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(request.notification_status)}`}>
                        {statusLabel(request.notification_status)}
                      </span>
                      <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-ink">
                        {product?.title ?? product?.name ?? "Product"}
                      </h2>
                      <p className="mt-2 text-sm font-semibold text-muted">
                        {request.customer_email}
                      </p>
                    </div>
                  </div>
                  <div className="text-left text-sm font-bold text-muted sm:text-right">
                    <p>Requested {formatDate(request.created_at)}</p>
                    <p>Notified {formatDate(request.notified_at)}</p>
                    <p>Cancelled {formatDate(request.cancelled_at)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {request.notification_status !== "notified" ? (
                    <form action={updateBackInStockRequestStatusAction}>
                      <input name="requestId" type="hidden" value={request.id} />
                      <input name="returnTo" type="hidden" value={returnTo} />
                      <input name="status" type="hidden" value="notified" />
                      <Button type="submit">Mark notified</Button>
                    </form>
                  ) : null}
                  {request.notification_status !== "cancelled" ? (
                    <form action={updateBackInStockRequestStatusAction}>
                      <input name="requestId" type="hidden" value={request.id} />
                      <input name="returnTo" type="hidden" value={returnTo} />
                      <input name="status" type="hidden" value="cancelled" />
                      <Button type="submit" variant="secondary">
                        Cancel request
                      </Button>
                    </form>
                  ) : null}
                  {request.notification_status !== "pending" ? (
                    <form action={updateBackInStockRequestStatusAction}>
                      <input name="requestId" type="hidden" value={request.id} />
                      <input name="returnTo" type="hidden" value={returnTo} />
                      <input name="status" type="hidden" value="pending" />
                      <Button type="submit" variant="secondary">
                        Reopen
                      </Button>
                    </form>
                  ) : null}
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="border-dashed p-8 text-center">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
              No back-in-stock requests yet
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
              When customers request notification for sold-out products, their requests will appear here.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
