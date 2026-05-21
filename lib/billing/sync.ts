import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getBillingPlan } from "@/lib/billing/plans";

type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

function normalizeStatus(value: string | null | undefined): SubscriptionStatus {
  if (
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "incomplete"
  ) {
    return value;
  }

  return "active";
}

function dateFromUnix(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function stripeId(value: { id?: string | null } | string | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function logBillingEvent(event: Stripe.Event, userId?: string | null) {
  const supabase = await createClient();
  await supabase.from("billing_events" as never).insert({
    event_type: event.type,
    provider: "stripe",
    provider_event_id: event.id,
    user_id: userId ?? null,
    payload: event as never,
    processed_at: new Date().toISOString()
  } as never);
}

export async function syncStripeSubscriptionEvent(event: Stripe.Event) {
  const supabase = await createClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId ?? session.client_reference_id;
    const plan = getBillingPlan(session.metadata?.planId);

    if (!userId) {
      await logBillingEvent(event);
      return;
    }

    await supabase.from("user_subscriptions" as never).upsert({
      cancel_at_period_end: false,
      plan_id: plan.id,
      status: "active",
      stripe_customer_id:
        typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      stripe_subscription_id:
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null,
      user_id: userId
    } as never, { onConflict: "user_id" });

    await logBillingEvent(event, userId);
    return;
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.userId;
    const plan = getBillingPlan(subscription.metadata?.planId);

    if (!userId) {
      await logBillingEvent(event);
      return;
    }

    await supabase.from("user_subscriptions" as never).upsert({
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: dateFromUnix(subscription.items.data[0]?.current_period_end),
      current_period_start: dateFromUnix(subscription.items.data[0]?.current_period_start),
      plan_id: plan.id,
      status:
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : normalizeStatus(subscription.status),
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id ?? null,
      stripe_subscription_id: subscription.id,
      user_id: userId
    } as never, { onConflict: "user_id" });

    await logBillingEvent(event, userId);
    return;
  }

  if (
    event.type === "invoice.finalized" ||
    event.type === "invoice.payment_succeeded" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null;
    };
    const stripeSubscriptionId = stripeId(invoice.subscription);
    const stripeCustomerId = stripeId(invoice.customer);

    const subscriptionQuery = supabase
      .from("user_subscriptions" as never)
      .select("id, user_id")
      .limit(1);

    const { data: subscriptions } = stripeSubscriptionId
      ? await subscriptionQuery.eq("stripe_subscription_id", stripeSubscriptionId)
      : stripeCustomerId
        ? await subscriptionQuery.eq("stripe_customer_id", stripeCustomerId)
        : { data: [] };
    const subscription = (subscriptions ?? [])[0] as
      | { id: string; user_id: string | null }
      | undefined;
    const userId = subscription?.user_id ?? null;

    await supabase.from("invoices" as never).upsert({
      amount_due: invoice.amount_due ?? 0,
      amount_paid: invoice.amount_paid ?? 0,
      currency: (invoice.currency ?? "usd").toUpperCase(),
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      invoice_url: invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null,
      issued_at: dateFromUnix(invoice.created),
      paid_at: dateFromUnix(invoice.status_transitions?.paid_at),
      provider: "stripe",
      provider_invoice_id: invoice.id,
      status: invoice.status ?? "draft",
      subscription_id: subscription?.id ?? null,
      user_id: userId
    } as never, { onConflict: "provider_invoice_id" });

    await logBillingEvent(event, userId);
    return;
  }

  await logBillingEvent(event);
}
