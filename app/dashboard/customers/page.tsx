import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  commerceMigrationMessage,
  getCommerceCustomers
} from "@/lib/commerce/data";

export const dynamic = "force-dynamic";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD"
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No orders";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export default async function CustomersPage() {
  const customers = await getCommerceCustomers();

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="A shared customer view for orders captured from landing pages and ecommerce stores."
        title="Customers"
      />
      {!customers.ready ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            {commerceMigrationMessage()}
          </p>
        </Card>
      ) : null}
      {customers.items.length ? (
        <div className="grid gap-4">
          {customers.items.map((customer) => (
            <Card
              className="grid gap-5 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 lg:grid-cols-[minmax(0,1fr)_auto]"
              key={customer.id}
            >
              <div className="min-w-0">
                <h2 className="truncate text-xl font-black tracking-[-0.02em] text-ink">
                  {customer.name}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {[customer.email, customer.phone].filter(Boolean).join(" • ") ||
                    "No contact details"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {customer.source_type}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    {customer.orderCount} orders
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    Last order {formatDate(customer.lastOrderAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 lg:justify-end">
                <div className="text-right">
                  <p className="text-sm font-bold text-muted">Total spent</p>
                  <p className="text-xl font-black text-ink">
                    {formatMoney(customer.totalSpent)}
                  </p>
                </div>
                <ButtonLink href={`/dashboard/customers/${customer.id}`} variant="secondary">
                  Details
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            No customers yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            Customer profiles will be shared across landing pages and stores once
            orders start flowing into the unified commerce system.
          </p>
        </Card>
      )}
    </div>
  );
}
