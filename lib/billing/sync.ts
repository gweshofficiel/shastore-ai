import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
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

function subscriptionPeriodDate(subscription: Stripe.Subscription, key: "current_period_end" | "current_period_start") {
  const directValue = (subscription as unknown as Record<string, unknown>)[key];
  const itemValue = subscription.items.data[0]
    ? (subscription.items.data[0] as unknown as Record<string, unknown>)[key]
    : null;
  const value = typeof directValue === "number" ? directValue : itemValue;

  return typeof value === "number" ? dateFromUnix(value) : null;
}

function stripeId(value: { id?: string | null } | string | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function getBillingSyncClient() {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for Stripe billing webhook sync.");
  }

  return supabase;
}

async function logBillingEvent(event: Stripe.Event, userId?: string | null) {
  const supabase = getBillingSyncClient();
  const { error } = await supabase.from("billing_events" as never).insert({
    event_type: event.type,
    provider: "stripe",
    provider_event_id: event.id,
    user_id: userId ?? null,
    payload: event as never,
    processed_at: new Date().toISOString()
  } as never);

  if (error) {
    console.warn("[stripe-webhook] billing event log skipped", {
      eventId: event.id,
      eventType: event.type,
      message: error.message
    });
  }
}

function metadataValue(metadata: Stripe.Metadata | null | undefined, camelKey: string, snakeKey: string) {
  return metadata?.[snakeKey] ?? metadata?.[camelKey] ?? null;
}

async function upsertUserSubscription(input: {
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  currentPeriodStart?: string | null;
  planId: string | null | undefined;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  userId: string;
}) {
  const supabase = getBillingSyncClient();
  const plan = getBillingPlan(input.planId);
  const { error } = await supabase.from("user_subscriptions" as never).upsert(
    {
      cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
      current_period_end: input.currentPeriodEnd ?? null,
      current_period_start: input.currentPeriodStart ?? null,
      plan_id: plan.id,
      status: input.status,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      updated_at: new Date().toISOString(),
      user_id: input.userId
    } as never,
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[stripe-webhook] user subscription upsert failed", {
      message: error.message,
      planId: plan.id,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      userId: input.userId
    });
    throw error;
  }
}

export async function syncStripeSubscriptionEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId =
      metadataValue(session.metadata, "userId", "user_id") ?? session.client_reference_id;
    const planId =
      metadataValue(session.metadata, "planId", "plan_id") ?? session.metadata?.plan ?? null;

    if (!userId) {
      console.error("[stripe-webhook] checkout.session.completed missing user_id metadata", {
        eventId: event.id,
        sessionId: session.id
      });
      await logBillingEvent(event);
      return;
    }

    await upsertUserSubscription({
      currentPeriodEnd: null,
      currentPeriodStart: null,
      planId,
      status: "active",
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      stripeSubscriptionId:
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null,
      userId
    });

    await logBillingEvent(event, userId);
    return;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = metadataValue(subscription.metadata, "userId", "user_id");
    const planId =
      metadataValue(subscription.metadata, "planId", "plan_id") ??
      subscription.metadata?.plan ??
      null;

    if (!userId) {
      console.error("[stripe-webhook] subscription event missing user_id metadata", {
        eventId: event.id,
        eventType: event.type,
        subscriptionId: subscription.id
      });
      await logBillingEvent(event);
      return;
    }

    await upsertUserSubscription({
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscriptionPeriodDate(subscription, "current_period_end"),
      currentPeriodStart: subscriptionPeriodDate(subscription, "current_period_start"),
      planId,
      status:
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : normalizeStatus(subscription.status),
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id ?? null,
      stripeSubscriptionId: subscription.id,
      userId
    });

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
    const supabase = getBillingSyncClient();

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
