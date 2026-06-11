import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import Link from "next/link";
import {
  clearBillingReview,
  markBillingReview,
  markBillingReviewed
} from "@/lib/billing/admin-actions";
import { billingPlans } from "@/lib/billing/plans";
import { getAdminSubscriptions } from "@/lib/admin/data";

type AdminSubscriptionsPageProps = {
  searchParams: Promise<{
    billingCycle?: string;
    plan?: string;
    provider?: string;
    q?: string;
    renewal?: string;
    status?: string;
    storeRelation?: string;
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
  return value === "all" ||
    value === "active" ||
    value === "trialing" ||
    value === "cancelled" ||
    value === "past_due" ||
    value === "incomplete" ||
    value === "unpaid"
    ? value
    : "all";
}

function cleanFilter(value: string | undefined, allowed: string[]) {
  return value && allowed.includes(value) ? value : "all";
}

export default async function AdminSubscriptionsPage({ searchParams }: AdminSubscriptionsPageProps) {
  const query = await searchParams;
  const subscriptions = await getAdminSubscriptions();
  const statusFilter = cleanStatusFilter(query.status);
  const planFilter = cleanFilter(query.plan, billingPlans.map((plan) => plan.id));
  const billingCycleFilter = cleanFilter(query.billingCycle, ["monthly", "annual", "not_available"]);
  const providerFilter = cleanFilter(query.provider, [...new Set(subscriptions.map((subscription) => subscription.billingProvider))]);
  const renewalFilter = cleanFilter(query.renewal, ["renews", "canceling", "expired"]);
  const storeRelationFilter = cleanFilter(query.storeRelation, ["with_store", "without_store"]);
  const searchTerm = String(query.q ?? "").trim().toLowerCase();
  const filteredSubscriptions = subscriptions.filter((subscription) => {
    const relationHaystack = [
      subscription.email,
      subscription.userId,
      subscription.subscriptionId,
      subscription.providerSubscriptionId ?? "",
      subscription.plan,
      subscription.planId,
      ...subscription.workspaceIds,
      ...subscription.stores.flatMap((store) => [store.id, store.name, store.slug ?? "", store.workspaceId ?? ""])
    ].join(" ").toLowerCase();
    const matchesSearch =
      !searchTerm ||
      relationHaystack.includes(searchTerm);
    const isCancelled = subscription.status === "canceled" || subscription.status === "cancelled";
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "cancelled" ? isCancelled : subscription.status === statusFilter);
    const matchesPlan = planFilter === "all" || subscription.planId === planFilter;
    const matchesBillingCycle = billingCycleFilter === "all" || subscription.billingCycle === billingCycleFilter;
    const matchesProvider = providerFilter === "all" || subscription.billingProvider === providerFilter;
    const matchesRenewal =
      renewalFilter === "all" ||
      (renewalFilter === "canceling"
        ? subscription.cancelAtPeriodEnd || isCancelled
        : renewalFilter === "expired"
          ? ["past_due", "incomplete", "unpaid"].includes(subscription.status)
          : subscription.renewalStatus === "renews");
    const matchesStoreRelation =
      storeRelationFilter === "all" ||
      (storeRelationFilter === "with_store" ? subscription.storesUsed > 0 : subscription.storesUsed === 0);

    return matchesSearch &&
      matchesPlan &&
      matchesStatus &&
      matchesBillingCycle &&
      matchesProvider &&
      matchesRenewal &&
      matchesStoreRelation;
  });
  const trialSubscriptions = subscriptions.filter((subscription) => subscription.status === "trialing").length;
  const activeSubscriptions = subscriptions.filter((subscription) =>
    ["active", "trialing"].includes(subscription.status)
  ).length;
  const cancelledSubscriptions = subscriptions.filter((subscription) =>
    subscription.status === "canceled" || subscription.status === "cancelled"
  ).length;
  const expiredSubscriptions = subscriptions.filter((subscription) =>
    ["past_due", "incomplete", "unpaid"].includes(subscription.status)
  ).length;
  const estimatedMrr = subscriptions.reduce((total, subscription) => {
    if (!["active", "trialing"].includes(subscription.status) || subscription.planId === "free") {
      return total;
    }

    return total + subscription.amount;
  }, 0);
  const planOptions = billingPlans.map((plan) => ({ id: plan.id, name: plan.name }));
  const providerOptions = [...new Set(subscriptions.map((subscription) => subscription.billingProvider))].sort();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Super Admin billing control center over existing subscriptions, plans, invoices, usage, and admin billing events. No external payment APIs are called here."
        title="Billing Control Center"
      />
      <AdminStatGrid
        stats={[
          { label: "Total subscriptions", value: subscriptions.length },
          { label: "Active subscriptions", value: activeSubscriptions },
          { label: "Trial subscriptions", value: trialSubscriptions },
          { label: "Cancelled subscriptions", value: cancelledSubscriptions },
          { label: "Expired / past due", value: expiredSubscriptions },
          { label: "Stores linked", value: subscriptions.reduce((total, subscription) => total + subscription.storesUsed, 0) },
          { label: "Estimated MRR", value: formatAdminMoney(estimatedMrr) },
          { label: "Estimated ARR", value: formatAdminMoney(estimatedMrr * 12) }
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <form className="grid gap-4 lg:grid-cols-[1.3fr_repeat(6,minmax(150px,1fr))_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Search billing</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.q ?? ""}
              name="q"
              placeholder="Owner, workspace, store, subscription, plan"
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
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="cancelled">Cancelled</option>
              <option value="past_due">Past due</option>
              <option value="incomplete">Incomplete</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Plan</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={planFilter}
              name="plan"
            >
              <option value="all">All plans</option>
              {planOptions.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Cycle</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={billingCycleFilter}
              name="billingCycle"
            >
              <option value="all">All</option>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="not_available">Not available</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Provider</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={providerFilter}
              name="provider"
            >
              <option value="all">All</option>
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Renewal</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={renewalFilter}
              name="renewal"
            >
              <option value="all">All</option>
              <option value="renews">Renews</option>
              <option value="canceling">Canceling</option>
              <option value="expired">Expired / past due</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Stores</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={storeRelationFilter}
              name="storeRelation"
            >
              <option value="all">All</option>
              <option value="with_store">With store</option>
              <option value="without_store">Without store</option>
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
          "Subscription",
          "Owner / Workspace",
          "Store relation",
          "Plan",
          "Status",
          "Provider",
          "Amount",
          "Period / Renewal",
          "Created",
          "Details",
          "Actions",
          "Placeholders"
        ]}
      >
        {filteredSubscriptions.map((subscription) => (
          <tr key={subscription.subscriptionId}>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="break-all font-bold text-slate-950">{subscription.subscriptionId}</span>
                <span className="break-all text-slate-500">{subscription.providerSubscriptionId ?? "No provider subscription ID"}</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <span className="font-bold text-slate-950">{subscription.email}</span>
                <Link className="break-all text-blue-700" href={`/admin/users/${subscription.userId}`}>
                  {subscription.userId}
                </Link>
                <span className="text-slate-500">{subscription.workspaceIds.length} workspace links</span>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-1 text-slate-600">
                <span>{subscription.storesUsed} stores</span>
                <span>{subscription.publishedStoresUsed} published</span>
              </div>
            </td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{subscription.plan}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={statusTone(subscription.status)}>{subscription.status}</AdminBadge></td>
            <td className="px-5 py-4">
              <div className="grid gap-1 text-slate-600">
                <span>{subscription.billingProvider}</span>
                <span>{subscription.billingCycle}</span>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">
              {formatAdminMoney(subscription.amount)} {subscription.currency}
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-1 text-slate-600">
                <span>Start: {formatAdminDate(subscription.currentPeriodStart)}</span>
                <span>End: {formatAdminDate(subscription.currentPeriodEnd)}</span>
                <span>Renewal: {subscription.renewalStatus}</span>
                {subscription.cancellationDate ? <span>Cancel: {formatAdminDate(subscription.cancellationDate)}</span> : null}
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(subscription.createdAt)}</td>
            <td className="px-5 py-4">
              <details className="min-w-96 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                  Subscription details
                </summary>
                <div className="mt-3 grid gap-4 text-sm text-slate-600">
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Owner summary</p>
                    <p className="mt-2 break-all font-bold text-slate-950">{subscription.email}</p>
                    <p className="break-all">{subscription.userId}</p>
                    <Link className="mt-2 block text-xs font-black uppercase tracking-[0.14em] text-blue-700" href={`/admin/users/${subscription.userId}`}>
                      Open owner
                    </Link>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Linked workspace/store</p>
                    <div className="mt-2 grid gap-2">
                      {subscription.workspaceIds.length ? (
                        subscription.workspaceIds.map((workspaceId) => (
                          <p className="break-all rounded-lg bg-slate-50 p-2" key={`${subscription.subscriptionId}-${workspaceId}`}>
                            {workspaceId}
                          </p>
                        ))
                      ) : (
                        <p>No workspace links found.</p>
                      )}
                      {subscription.stores.length ? (
                        subscription.stores.slice(0, 5).map((store) => (
                          <p className="rounded-lg bg-slate-50 p-2" key={store.id}>
                            <span className="block font-bold text-slate-950">{store.name}</span>
                            {store.status} · {store.slug ?? "no slug"}
                            <Link className="mt-1 block text-xs font-black uppercase tracking-[0.14em] text-blue-700" href={`/admin/stores?q=${store.id}`}>
                              Open store
                            </Link>
                          </p>
                        ))
                      ) : (
                        <p>No linked stores found.</p>
                      )}
                    </div>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Invoices</p>
                    <div className="mt-2 grid gap-2">
                      {subscription.invoices.length ? (
                        subscription.invoices.map((invoice) => (
                          <p className="rounded-lg bg-slate-50 p-2" key={`${subscription.subscriptionId}-${invoice.provider}-${invoice.status}-${invoice.createdAt ?? "unknown"}`}>
                            {invoice.provider} · {invoice.status} · {formatAdminDate(invoice.createdAt)}
                          </p>
                        ))
                      ) : (
                        <p>Invoices not available.</p>
                      )}
                    </div>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Payment provider</p>
                    <p className="mt-2">Provider: {subscription.billingProvider}</p>
                    <p>Provider subscription: {subscription.providerSubscriptionId ?? "not available"}</p>
                    {subscription.providerUrl ? (
                      <a className="mt-2 block text-xs font-black uppercase tracking-[0.14em] text-blue-700" href={subscription.providerUrl} rel="noreferrer" target="_blank">
                        Open provider link
                      </a>
                    ) : (
                      <p className="mt-2">Provider link not available.</p>
                    )}
                    <p className="mt-2">Last event: {subscription.lastBillingEvent ? `${subscription.lastBillingEvent.eventType} · ${formatAdminDate(subscription.lastBillingEvent.createdAt)}` : "not available"}</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Plan limits / usage</p>
                    <p className="mt-2">Stores: {subscription.storesUsed} / {subscription.storeLimit}</p>
                    <p>Domains: {subscription.domainsUsed} / {subscription.domainLimit}</p>
                    <p>Landings: {subscription.landingsUsed} / {subscription.landingLimit}</p>
                    <p>Orders: {subscription.ordersUsed}</p>
                  </section>
                  <section className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Warnings</p>
                    <div className="mt-2 flex flex-wrap gap-2">
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
                  </section>
                </div>
              </details>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-60 gap-2">
                <form action={markBillingReviewed}>
                  <input name="userId" type="hidden" value={subscription.userId} />
                  <button
                    className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
                    type="submit"
                  >
                    Mark reviewed
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
                    className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700 disabled:opacity-50"
                    disabled={!subscription.billingReview}
                    type="submit"
                  >
                    Clear review
                  </button>
                </form>
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="grid min-w-52 gap-2">
                {[
                  "Change plan placeholder",
                  "Cancel subscription placeholder",
                  "Sync Stripe subscription",
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
