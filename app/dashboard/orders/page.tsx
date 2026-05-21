import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  commerceMigrationMessage,
  getCommerceOrders
} from "@/lib/commerce/data";

export const dynamic = "force-dynamic";

const statuses = ["all", "pending", "new", "confirmed", "shipped", "delivered", "canceled"];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "USD"
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function statusHref(status: string, query?: string) {
  const params = new URLSearchParams();
  if (status !== "all") {
    params.set("status", status);
  }
  if (query) {
    params.set("q", query);
  }
  const search = params.toString();
  return search ? `/dashboard/orders?${search}` : "/dashboard/orders";
}

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "all";
  const orders = await getCommerceOrders({ status, query: params.q });

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Unified orders from landing pages and ecommerce stores. Buyer payments stay on COD and WhatsApp until seller-owned payment integrations are added."
        title="Orders"
      />
      {!orders.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            {commerceMigrationMessage()}
          </p>
        </Card>
      ) : null}
      <Card className="p-5 lg:p-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {statuses.map((item) => (
            <ButtonLink
              href={statusHref(item, params.q)}
              key={item}
              variant={status === item ? "primary" : "secondary"}
            >
              {item === "all" ? "All" : item}
            </ButtonLink>
          ))}
        </div>
        <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <input name="status" type="hidden" value={status} />
          <Input
            defaultValue={params.q}
            id="q"
            label="Search"
            name="q"
            placeholder="Search by order, customer, source"
          />
          <button className="h-12 rounded-full bg-ink px-6 text-sm font-black text-white">
            Filter
          </button>
        </form>
      </Card>
      {orders.items.length ? (
        <div className="grid gap-4">
          {orders.items.map((order) => (
            <Card
              className="grid gap-5 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 lg:grid-cols-[minmax(0,1fr)_auto]"
              key={order.id}
            >
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  {order.id.slice(0, 8)}
                </p>
                <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-ink">
                  {formatMoney(Number(order.total_amount), order.currency)}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {order.status}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {order.payment_method}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {order.source_type}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {formatDate(order.created_at)}
                  </span>
                </div>
                {order.notes ? (
                  <p className="mt-3 text-sm leading-6 text-muted">{order.notes}</p>
                ) : null}
              </div>
              <div className="self-center text-left lg:text-right">
                <p className="text-sm font-bold text-ink">
                  {order.source_slug ? `/${order.source_slug}` : "No source slug"}
                </p>
                <p className="mt-1 text-sm text-muted">{order.payment_status}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            No orders yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            Orders from landing pages and stores will appear here once commerce capture
            is connected to public CTAs and checkout forms.
          </p>
        </Card>
      )}
    </div>
  );
}
