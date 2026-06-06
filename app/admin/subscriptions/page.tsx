import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import {
  clearBillingReview,
  markBillingReview,
  overrideUserPlan,
  restorePreviousPlan
} from "@/lib/billing/admin-actions";
import { billingPlans } from "@/lib/billing/plans";
import { getAdminSubscriptions } from "@/lib/admin/data";

type AdminSubscriptionsPageProps = {
  searchParams: Promise<{
    plan?: string;
    q?: string;
    status?: string;
  }>;
};

function statusTone(status: string) {
  if (status === "active" || status === "trialing") {
    return "green" as const;
  }

  if (status === "past_due" || status === "incomplete" || status === "unpaid") {
    return "amber" as const;
  }

  return "red" as const;
}

function warningTone(warning: string) {
  if (warning === "payment_failed" || warning === "subscription_cancelled") {
    return "red" as const;
  }

  if (warning === "limit_exceeded") {
    return "amber" as const;
  }

  return "blue" as const;
}

function cleanStatusFilter(value: string | undefined) {
  return value === "free" ||
    value === "paid" ||
    value === "trial" ||
    value === "active" ||
    value === "cancelled" ||
    value === "failed_payment"
    ? value
    : "all";
}

export default async function AdminSubscriptionsPage({ searchParams }: AdminSubscriptionsPageProps) {
  const query = await searchParams;
  const subscriptions = await getAdminSubscriptions();
  const statusFilter = cleanStatusFilter(query.status);
  const planFilter = String(query.plan ?? "").trim().toLowerCase();
  const searchTerm = String(query.q ?? "").trim().toLowerCase();
  const filteredSubscriptions = subscriptions.filter((subscription) => {
    const matchesSearch =
      !searchTerm ||
      subscription.email.toLowerCase().includes(searchTerm) ||
      subscription.userId.toLowerCase().includes(searchTerm) ||
      subscription.plan.toLowerCase().includes(searchTerm) ||
      subscription.planId.toLowerCase().includes(searchTerm);
    const matchesPlan = !planFilter || subscription.planId === planFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "free"
        ? subscription.planId === "free"
        : statusFilter === "paid"
          ? subscription.planId !== "free"
          : statusFilter === "trial"
            ? subscription.status === "trialing"
            : statusFilter === "active"
              ? subscription.status === "active"
              : statusFilter === "cancelled"
                ? subscription.status === "canceled" || subscription.status === "cancelled"
                : subscription.failedPayments > 0);

    return matchesSearch && matchesPlan && matchesStatus;
  });
  const paidUsers = subscriptions.filter((subscription) => subscription.planId !== "free").length;
  const trialUsers = subscriptions.filter((subscription) => subscription.status === "trialing").length;
  const freeUsers = subscriptions.filter((subscription) => subscription.planId === "free").length;
  const activeSubscriptions = subscriptions.filter((subscription) =>
    ["active", "trialing"].includes(subscription.status)
  ).length;
  const failedPayments = subscriptions.reduce((total, subscription) => total + subscription.failedPayments, 0);
  const estimatedMrr = subscriptions.reduce((total, subscription) => {
    if (!["active", "trialing"].includes(subscription.status)) {
      return total;
    }

    const plan = billingPlans.find((candidate) => candidate.id === subscription.planId);
    return total + (plan?.priceCents ?? 0) / 100;
  }, 0);
  const planOptions = billingPlans.map((plan) => ({ id: plan.id, name: plan.name }));

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Super Admin billing control center over existing subscriptions, plans, invoices, usage, and admin billing events. No external payment APIs are called here."
        title="Billing Control Center"
      />
      <AdminStatGrid
        stats={[
          { label: "Total users", value: subscriptions.length },
          { label: "Paid users", value: paidUsers },
          { label: "Trial users", value: trialUsers },
          { label: "Free users", value: freeUsers },
          { label: "Active subscriptions", value: activeSubscriptions },
          { label: "Failed payments", value: failedPayments },
          { label: "Estimated MRR", value: formatAdminMoney(estimatedMrr) },
          { label: "Estimated yearly revenue", value: formatAdminMoney(estimatedMrr * 12) }
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <form className="grid gap-4 lg:grid-cols-[1fr_220px_220px_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Search billing</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.q ?? ""}
              name="q"
              placeholder="Email, user ID, or plan"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Status</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={statusFilter}
              name="status"
            >
              <option value="all">All</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed_payment">Failed payment</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Plan</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.plan ?? ""}
              name="plan"
            >
              <option value="">All plans</option>
              {planOptions.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
            Filter billing
          </button>
        </form>
      </div>

      <AdminTable
        empty={!filteredSubscriptions.length ? "No subscriptions matched the selected search or filters." : null}
        headers={[
          "User",
          "Plan",
          "Status",
          "Provider",
          "Stores",
          "Domains",
          "Orders",
          "Next billing",
          "Created",
          "Warnings",
          "Actions",
          "Future hooks"
        ]}
      >
        {filteredSubscriptions.map((subscription) => (
          <tr key={subscription.userId}>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="font-bold text-slate-950">{subscription.email}</span>
                <span className="break-all text-slate-500">{subscription.userId}</span>
              </div>
            </td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{subscription.plan}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={statusTone(subscription.status)}>{subscription.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{subscription.billingProvider}</td>
            <td className="px-5 py-4 text-slate-600">
              {subscription.storesUsed} / {subscription.storeLimit}
            </td>
            <td className="px-5 py-4 text-slate-600">
              {subscription.domainsUsed} / {subscription.domainLimit}
            </td>
            <td className="px-5 py-4 text-slate-600">{subscription.ordersUsed}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(subscription.nextBillingDate)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(subscription.createdAt)}</td>
            <td className="px-5 py-4">
              <div className="flex min-w-60 flex-wrap gap-2">
                {subscription.warningBadges.length ? (
                  subscription.warningBadges.map((warning) => (
                    <AdminBadge key={warning} tone={warningTone(warning)}>
                      {warning.replace(/_/g, " ")}
                    </AdminBadge>
                  ))
                ) : (
                  <AdminBadge tone="green">clear</AdminBadge>
                )}
                {subscription.billingReview ? <AdminBadge tone="amber">billing review</AdminBadge> : null}
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-80 gap-2">
                <form action={overrideUserPlan} className="flex gap-2">
                  <input name="userId" type="hidden" value={subscription.userId} />
                  <select
                    className="h-10 flex-1 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
                    defaultValue={subscription.planId}
                    name="planId"
                  >
                    {billingPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                  <button className="h-10 rounded-full bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white">
                    Override
                  </button>
                </form>
                <div className="grid gap-2 sm:grid-cols-3">
                  <form action={restorePreviousPlan}>
                    <input name="userId" type="hidden" value={subscription.userId} />
                    <button
                      className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700 disabled:opacity-50"
                      disabled={!subscription.manualOverrideActive}
                      type="submit"
                    >
                      Restore plan
                    </button>
                  </form>
                  <form action={markBillingReview}>
                    <input name="userId" type="hidden" value={subscription.userId} />
                    <button
                      className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700 disabled:opacity-50"
                      disabled={subscription.billingReview}
                      type="submit"
                    >
                      Mark review
                    </button>
                  </form>
                  <form action={clearBillingReview}>
                    <input name="userId" type="hidden" value={subscription.userId} />
                    <button
                      className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 disabled:opacity-50"
                      disabled={!subscription.billingReview}
                      type="submit"
                    >
                      Clear review
                    </button>
                  </form>
                </div>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                {[
                  "Sync Stripe subscription",
                  "Sync NOWPayments subscription",
                  "Issue refund",
                  "Retry failed invoice",
                  "Export billing report"
                ].map((label) => (
                  <button
                    className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                    disabled
                    key={label}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
