import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { billingPlans } from "@/lib/billing/plans";
import { getCurrentUserSubscriptionAccess } from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatLimit(value: number | null) {
  return value === null ? "Unlimited" : value.toString();
}

function usagePercent(used: number, limit: number | null) {
  if (limit === null) {
    return 18;
  }

  return Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
}

function priceLabel(priceCents: number) {
  if (priceCents === 0) {
    return "$0";
  }

  return `$${priceCents / 100}`;
}

async function getBillingTableAvailable() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("subscription_plans" as never)
    .select("*")
    .limit(1);

  return !error;
}

async function getBillingHistory(userId: string) {
  const supabase = await createClient();
  const [{ data: invoices }, { data: events }] = await Promise.all([
    supabase
      .from("invoices" as never)
      .select("id, amount_due, amount_paid, currency, status, invoice_url, issued_at")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false })
      .limit(6),
    supabase
      .from("billing_events" as never)
      .select("id, event_type, provider, processed_at")
      .eq("user_id", userId)
      .order("processed_at", { ascending: false })
      .limit(6)
  ]);

  return {
    events: (events ?? []) as Array<{
      event_type: string;
      id: string;
      processed_at: string | null;
      provider: string;
    }>,
    invoices: (invoices ?? []) as Array<{
      amount_due: number | null;
      amount_paid: number | null;
      currency: string | null;
      id: string;
      invoice_url: string | null;
      issued_at: string | null;
      status: string | null;
    }>
  };
}

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{
    billing?: string;
    message?: string;
    reason?: string;
  }>;
}) {
  const query = await searchParams;
  const access = await getCurrentUserSubscriptionAccess();
  const billingTablesReady = await getBillingTableAvailable();

  if (!access) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <PageHeader
          description="Sign in to view your SHASTORE AI plan and usage."
          title="Billing"
        />
        <Card className="p-6">
          <p className="text-sm font-bold text-muted">Please sign in to manage billing.</p>
        </Card>
      </div>
    );
  }

  const currentPlan = access.plan;
  const isPaid = currentPlan.id !== "free";
  const hasActiveSubscription = access.status === "active";
  const hasStripeCustomerId = Boolean(access.stripeCustomerId);
  const hasStripeSubscriptionId = Boolean(access.stripeSubscriptionId);
  const canManageSubscription = isPaid && hasActiveSubscription && hasStripeCustomerId;
  const paidSubscriptionMissingCustomer =
    isPaid && hasActiveSubscription && !hasStripeCustomerId;

  console.info("[billing-debug] manage subscription visibility", {
    canManageSubscription,
    currentPlan,
    hasActiveSubscription,
    hasStripeCustomerId,
    hasStripeSubscriptionId,
    isPaid,
    stripeCustomerId: access.stripeCustomerId,
    stripeSubscriptionId: access.stripeSubscriptionId,
    subscriptionStatus: access.status,
    userId: access.userId
  });

  const billingHistory = await getBillingHistory(access.userId);
  const storePercent = usagePercent(access.usage.storesUsed, access.usage.storeLimit);
  const landingPercent = usagePercent(access.usage.landingsUsed, access.usage.landingLimit);
  const domainPercent = usagePercent(access.usage.domainsUsed, access.usage.domainLimit);
  const usageMeters = [
    {
      label: "Landing pages",
      limit: access.usage.landingLimit,
      percent: landingPercent,
      used: access.usage.landingsUsed
    },
    {
      label: "Stores",
      limit: access.usage.storeLimit,
      percent: storePercent,
      used: access.usage.storesUsed
    },
    {
      label: "Domains",
      limit: access.usage.domainLimit,
      percent: domainPercent,
      used: access.usage.domainsUsed
    }
  ];

  const routeBuildMarker = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

  return (
    <div className="grid gap-6 lg:gap-8">
      <div className="rounded-xl border-4 border-fuchsia-600 bg-fuchsia-500 p-5 text-center text-lg font-black uppercase tracking-[0.18em] text-white shadow-lg">
        REAL BILLING ROUTE ACTIVE — app/dashboard/billing/page.tsx ({routeBuildMarker})
      </div>
      <PageHeader
        description="Manage your SHASTORE AI subscription, store limits, and publishing access."
        title="Billing"
      />
      {query.billing === "success" ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Checkout completed. Your active plan and limits will update as soon as Stripe sends the platform billing webhook.
          </p>
        </Card>
      ) : null}
      {query.billing === "cancelled" ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-700">
            Checkout canceled. Your current plan is unchanged.
          </p>
        </Card>
      ) : null}
      {query.billing === "error" ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-800">
            {query.message ??
              "Checkout could not be started. Verify STRIPE_SECRET_KEY and plan price IDs."}
          </p>
        </Card>
      ) : null}
      {!billingTablesReady ? (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-800">
            Billing migration not applied yet. Run
            {" "}
            <code>supabase/migrations/subscription-billing-safe.sql</code>
            {" "}
            to persist plan data. Free plan fallbacks are active.
          </p>
        </Card>
      ) : null}
      <Card className="border-dashed border-slate-300 bg-slate-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Temporary billing debug
        </p>
        <div className="mt-4 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-2">
          <p>Current plan: {currentPlan.id}</p>
          <p>Subscription status: {access.status}</p>
          <p>Stripe customer ID exists: {hasStripeCustomerId ? "yes" : "no"}</p>
          <p>Stripe subscription ID exists: {hasStripeSubscriptionId ? "yes" : "no"}</p>
          <p>isPaid: {isPaid ? "yes" : "no"}</p>
          <p>hasActiveSubscription: {hasActiveSubscription ? "yes" : "no"}</p>
          <p>Manage subscription visible: {canManageSubscription ? "yes" : "no"}</p>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white/45">
              Current plan
            </p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-4xl font-black tracking-[-0.05em]">
                  {currentPlan.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  {currentPlan.description}
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/80">
                {access.status}
              </span>
            </div>
          </div>
          <div className="grid gap-5 p-6 lg:p-8">
            <div className="grid gap-5">
              {usageMeters.map((meter) => (
                <div key={meter.label}>
                  <div className="flex items-center justify-between gap-4 text-sm font-bold">
                    <span className="text-ink">{meter.label}</span>
                    <span className="text-muted">
                      {meter.used} / {formatLimit(meter.limit)}
                    </span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-ink"
                      style={{ width: `${meter.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-2xl font-black text-ink">
                  {access.usage.ordersUsed}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                  Orders
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-2xl font-black text-ink">
                  {access.usage.trafficUsed}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                  Page views
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-2xl font-black text-ink">
                  {access.usage.storageMbUsed} MB
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                  Storage estimate
                </p>
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Platform billing Stripe
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
            SaaS subscription checkout
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Paid buttons use SHASTORE AI platform Stripe credentials only. Client store
            buyer payments are kept separate and are not routed through this billing flow.
          </p>
          <div className="mt-5 rounded-3xl border border-slate-200 p-4 text-sm leading-6">
            <p className="font-black text-ink">Stripe subscription status</p>
            <p className="mt-1 capitalize text-muted">{access.status}</p>
          </div>
          <div className="mt-5 rounded-xl border-4 border-red-700 bg-red-600 p-4 text-center text-base font-black uppercase tracking-[0.18em] text-white">
            MANAGE BUTTON SHOULD BE HERE
          </div>
          {canManageSubscription ? (
            <form action="/api/stripe/billing-portal" className="mt-5" method="POST">
              <Button className="w-full" type="submit">
                Manage subscription
              </Button>
            </form>
          ) : null}
          {paidSubscriptionMissingCustomer ? (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
              Your paid platform plan is active, but the Stripe customer ID has not synced yet.
              The customer portal will appear after Stripe sends the subscription customer data.
            </div>
          ) : null}
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-muted">
            Configure <code>PLATFORM_BILLING_STRIPE_PRICE_ID_STARTER</code>,{" "}
            <code>PLATFORM_BILLING_STRIPE_PRICE_ID_PRO</code>, and{" "}
            <code>PLATFORM_BILLING_STRIPE_PRICE_ID_AGENCY</code> for plan-specific
            checkout.
          </div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        {billingPlans.map((plan) => (
          <Card
            className={`p-6 transition hover:-translate-y-0.5 hover:border-slate-300 ${
              plan.id === currentPlan.id ? "border-ink shadow-sm" : ""
            }`}
            key={plan.id}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-black tracking-[-0.02em] text-ink">
                {plan.name}
              </h2>
              {plan.id === currentPlan.id ? (
                <span className="rounded-full bg-ink px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
                  Current
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">
              {plan.description}
            </p>
            <p className="mt-6 text-4xl font-black tracking-[-0.04em] text-ink">
              {priceLabel(plan.priceCents)}
            </p>
            <p className="mt-2 text-sm font-semibold text-muted">per month</p>
            <div className="mt-5 grid gap-2 rounded-3xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
              <div className="flex justify-between gap-3">
                <span>Landings</span>
                <span>{formatLimit(plan.landingLimit)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Stores</span>
                <span>{formatLimit(plan.storeLimit)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Analytics</span>
                <span className="capitalize">{plan.analytics}</span>
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              {plan.features.map((feature) => (
                <div className="flex items-center gap-2 text-sm font-semibold text-ink" key={feature}>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {feature}
                </div>
              ))}
            </div>
            {plan.id === currentPlan.id ? (
              <div className="mt-6 rounded-xl border-4 border-red-700 bg-red-600 p-4 text-center text-base font-black uppercase tracking-[0.18em] text-white">
                MANAGE BUTTON SHOULD BE HERE
              </div>
            ) : null}
            {plan.id === currentPlan.id && canManageSubscription ? (
              <form action="/api/stripe/billing-portal" className="mt-6" method="POST">
                <Button className="w-full" type="submit">
                  Manage subscription
                </Button>
              </form>
            ) : plan.id === currentPlan.id ? (
              <Button className="mt-6 w-full" disabled type="button" variant="secondary">
                Current plan
              </Button>
            ) : plan.id === "free" ? (
              <Button className="mt-6 w-full" disabled type="button" variant="secondary">
                Included
              </Button>
            ) : (
              <form action="/api/stripe/create-checkout-session" className="mt-6" method="POST">
                <input name="plan" type="hidden" value={plan.id} />
                <Button className="w-full" type="submit">
                  Upgrade to {plan.name}
                </Button>
              </form>
            )}
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6 lg:p-8">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            Billing history
          </h2>
          <div className="mt-5 grid gap-3">
            {billingHistory.invoices.length ? (
              billingHistory.invoices.map((invoice) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 p-4 text-sm"
                  key={invoice.id}
                >
                  <div>
                    <p className="font-black text-ink">{invoice.status ?? "invoice"}</p>
                    <p className="mt-1 text-muted">
                      {invoice.currency ?? "USD"}{" "}
                      {((invoice.amount_paid ?? invoice.amount_due ?? 0) / 100).toFixed(2)}
                    </p>
                  </div>
                  {invoice.invoice_url ? (
                    <a
                      className="text-sm font-black text-ink underline"
                      href={invoice.invoice_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View invoice
                    </a>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Pending
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-muted">
                No invoices yet. Future platform billing invoices will appear here after webhook sync.
              </p>
            )}
          </div>
        </Card>
        <Card className="p-6 lg:p-8">
          <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">
            Billing events
          </h2>
          <div className="mt-5 grid gap-3">
            {billingHistory.events.length ? (
              billingHistory.events.map((event) => (
                <div
                  className="rounded-3xl border border-slate-200 p-4 text-sm"
                  key={event.id}
                >
                  <p className="font-black text-ink">{event.event_type}</p>
                  <p className="mt-1 text-muted">
                    {event.provider} · {event.processed_at ?? "queued"}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-muted">
                No billing events yet. Checkout and webhook activity will be tracked here.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
