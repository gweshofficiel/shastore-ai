import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  commerceMigrationMessage,
  getCommerceCustomerDetail
} from "@/lib/commerce/data";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "USD"
  }).format(amount);
}

export default async function CustomerDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCommerceCustomerDetail(id);

  if (!detail.ready) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          action={<ButtonLink href="/dashboard/customers">Back</ButtonLink>}
          description="Customer order history and contact details."
          title="Customer"
        />
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            {commerceMigrationMessage()}
          </p>
        </Card>
      </div>
    );
  }

  if (!detail.items.customer) {
    notFound();
  }

  const { customer, orders } = detail.items;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        action={<ButtonLink href="/dashboard/customers">Back to customers</ButtonLink>}
        description="Customer profile, source, contact details, and unified order history."
        title={customer.name}
      />
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Profile
          </p>
          <div className="mt-5 grid gap-4 text-sm">
            <div>
              <p className="font-bold text-muted">Email</p>
              <p className="mt-1 font-semibold text-ink">{customer.email ?? "Not set"}</p>
            </div>
            <div>
              <p className="font-bold text-muted">Phone</p>
              <p className="mt-1 font-semibold text-ink">{customer.phone ?? "Not set"}</p>
            </div>
            <div>
              <p className="font-bold text-muted">Location</p>
              <p className="mt-1 font-semibold text-ink">
                {[customer.city, customer.country].filter(Boolean).join(", ") ||
                  "Not set"}
              </p>
            </div>
            <div>
              <p className="font-bold text-muted">Source</p>
              <p className="mt-1 font-semibold text-ink">{customer.source_type}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Order history
          </p>
          <div className="mt-5 grid gap-3">
            {orders.length ? (
              orders.map((order) => (
                <div
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  key={order.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      {order.id.slice(0, 8)}
                    </p>
                    <p className="text-sm font-black text-ink">
                      {formatMoney(Number(order.total_amount), order.currency)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {order.status}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {order.payment_method}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      {formatDate(order.created_at)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                No orders are linked to this customer yet.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
