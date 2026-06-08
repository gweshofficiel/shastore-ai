import { requireDeliveryAccess } from "@/lib/delivery/access";
import { getDeliveryAssignedOrdersData } from "@/lib/delivery/data";

export const dynamic = "force-dynamic";

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    accepted: "Accepted",
    assigned: "Assigned",
    delivered: "Delivered",
    picked_up: "Picked Up",
    returned: "Returned"
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "delivered") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "returned") {
    return "bg-red-100 text-red-700";
  }

  if (status === "accepted" || status === "picked_up") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default async function DeliveryAssignedOrdersPage() {
  const { agent } = await requireDeliveryAccess();
  const data = await getDeliveryAssignedOrdersData(agent);

  return (
    <div className="grid gap-6 lg:gap-8">
      <section className="rounded-[2rem] border border-emerald-100 bg-white/85 p-5 shadow-[0_24px_80px_-54px_rgba(6,78,59,0.65)] backdrop-blur lg:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
          Delivery orders
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
          Assigned Orders
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Only orders assigned to {agent?.agentName ?? "this delivery agent"} for{" "}
          {agent?.storeName ?? "the linked store"} are shown here.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Assigned Orders", value: data.assignedOrders },
          { label: "Delivered Orders", value: data.deliveredOrders },
          { label: "Pending Orders", value: data.pendingOrders },
          { label: "Returns", value: data.returnedOrders }
        ].map((card) => (
          <article
            className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_55px_-44px_rgba(15,23,42,0.7)]"
            key={card.label}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-black text-slate-950">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Assignment list
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">
              Store-scoped deliveries
            </h2>
          </div>
          <p className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
            {agent?.cityZone ?? "Zone pending"}
          </p>
        </div>

        {data.orders.length ? (
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            <div className="grid min-w-[780px] grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1fr_1fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <span>Order Number</span>
              <span>Customer</span>
              <span>Phone</span>
              <span>City</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Assigned Date</span>
            </div>
            <div className="grid overflow-x-auto">
              {data.orders.map((order) => (
                <article
                  className="grid min-w-[780px] grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1fr_1fr] gap-3 border-t border-slate-100 px-4 py-4 text-sm font-semibold text-slate-600"
                  key={order.id}
                >
                  <span className="font-black text-slate-950">{order.orderNumber}</span>
                  <span>{order.customer ?? "Customer"}</span>
                  <span>{order.phone ?? "Not provided"}</span>
                  <span>{order.city ?? "Not set"}</span>
                  <span>{formatMoney(order.amount, order.currency)}</span>
                  <span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${statusClass(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </span>
                  <span>{formatDate(order.assignedAt)}</span>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h3 className="text-xl font-black tracking-[-0.03em] text-slate-950">
              No assigned orders yet
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-slate-600">
              When a store owner assigns an order to this delivery agent, it will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
