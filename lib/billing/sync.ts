import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingPlan, type SubscriptionPlanId } from "@/lib/billing/plans";
import {
  isPaidSubscriptionPlan,
  resolvePlatformPlanByPriceId
} from "@/lib/billing/platform-checkout";
import { createBillingNotification } from "@/lib/notifications/billing-notifications";

type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";

function gracePeriodDays() {
  const raw =
    process.env.PLATFORM_BILLING_GRACE_PERIOD_DAYS ?? process.env.BILLING_GRACE_PERIOD_DAYS;
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : 7;
}

function normalizeStatus(value: string | null | undefined): SubscriptionStatus {
  if (
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "incomplete" ||
    value === "unpaid"
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

function calculateGracePeriodUntil(currentPeriodEnd?: string | null) {
  const periodEndTime = currentPeriodEnd ? new Date(currentPeriodEnd).getTime() : null;
  const fallbackTime = Date.now() + gracePeriodDays() * 86_400_000;
  const graceTime =
    periodEndTime && Number.isFinite(periodEndTime) && periodEndTime > Date.now()
      ? periodEndTime
      : fallbackTime;

  return new Date(graceTime).toISOString();
}

function stripeId(value: { id?: string | null } | string | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function stripeReferenceFromRecord(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }

  return null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const record = invoice as unknown as Record<string, unknown>;
  const direct = stripeReferenceFromRecord(record.subscription);

  if (direct) {
    return direct;
  }

  const subscriptionDetails =
    record.subscription_details && typeof record.subscription_details === "object"
      ? (record.subscription_details as Record<string, unknown>)
      : null;
  const fromDetails = stripeReferenceFromRecord(subscriptionDetails?.subscription);

  if (fromDetails) {
    return fromDetails;
  }

  const parent =
    record.parent && typeof record.parent === "object"
      ? (record.parent as Record<string, unknown>)
      : null;
  const parentSubscriptionDetails =
    parent?.subscription_details && typeof parent.subscription_details === "object"
      ? (parent.subscription_details as Record<string, unknown>)
      : null;

  return stripeReferenceFromRecord(parentSubscriptionDetails?.subscription);
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

function paidPlanFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  const planId = metadataValue(metadata, "planId", "plan_id") ?? metadata?.plan ?? null;

  return planId && isPaidSubscriptionPlan(planId) ? planId : null;
}

function paidPlanFromSubscriptionPrice(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  return resolvePlatformPlanByPriceId(priceId);
}

async function upsertUserSubscription(input: {
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  currentPeriodStart?: string | null;
  gracePeriodUntil?: string | null;
  planId: SubscriptionPlanId;
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
      grace_period_until: input.gracePeriodUntil ?? null,
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

  console.info("[stripe-webhook] user subscription upserted", {
    planId: plan.id,
    status: input.status,
    stripeSubscriptionId: input.stripeSubscriptionId,
    userId: input.userId
  });

  if (input.status === "active") {
    console.info("[billing-recovery] subscription access active", {
      planId: plan.id,
      stripeSubscriptionId: input.stripeSubscriptionId,
      userId: input.userId
    });
  } else if (input.status === "past_due" || input.status === "unpaid" || input.status === "canceled") {
    console.warn(input.gracePeriodUntil ? "[billing-grace] subscription entered grace period" : "[billing-restricted] subscription access restricted", {
      gracePeriodUntil: input.gracePeriodUntil ?? null,
      planId: plan.id,
      status: input.status,
      stripeSubscriptionId: input.stripeSubscriptionId,
      userId: input.userId
    });
  }
}

async function updateSubscriptionStatusByStripeReference(input: {
  clearGracePeriod?: boolean;
  gracePeriodUntil?: string | null;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}) {
  if (!input.stripeSubscriptionId && !input.stripeCustomerId) {
    console.warn("[stripe-webhook] invoice status update skipped without Stripe reference", {
      status: input.status
    });
    return null;
  }

  const supabase = getBillingSyncClient();
  const updatePayload: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString()
  };

  if (input.clearGracePeriod) {
    updatePayload.grace_period_until = null;
  } else if (input.gracePeriodUntil) {
    updatePayload.grace_period_until = input.gracePeriodUntil;
  }

  const query = supabase
    .from("user_subscriptions" as never)
    .update(updatePayload as never)
    .select("user_id, plan_id, status")
    .limit(1);

  const { data, error } = input.stripeSubscriptionId
    ? await query.eq("stripe_subscription_id", input.stripeSubscriptionId)
    : await query.eq("stripe_customer_id", input.stripeCustomerId as string);

  if (error) {
    console.error("[stripe-webhook] subscription status update failed", {
      message: error.message,
      status: input.status,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId
    });
    throw error;
  }

  const subscription = (data ?? [])[0] as
    | { plan_id: string | null; status: SubscriptionStatus | null; user_id: string | null }
    | undefined;

  console.info("[stripe-webhook] subscription status updated from invoice", {
    status: input.status,
    stripeSubscriptionId: input.stripeSubscriptionId,
    userId: subscription?.user_id ?? null
  });

  if (input.status === "active") {
    console.info("[billing-recovery] invoice payment restored subscription access", {
      stripeSubscriptionId: input.stripeSubscriptionId,
      userId: subscription?.user_id ?? null
    });
  } else {
    console.warn(
      input.gracePeriodUntil
        ? "[billing-grace] invoice payment started grace period"
        : "[billing-restricted] invoice payment restricted subscription access",
      {
      status: input.status,
      gracePeriodUntil: input.gracePeriodUntil ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId,
      userId: subscription?.user_id ?? null
      }
    );
  }

  return subscription?.user_id ?? null;
}

async function findExistingSubscriptionByStripeReference(input: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const supabase = getBillingSyncClient();
  let data:
    | { plan_id: string | null; user_id: string | null }
    | null = null;

  if (input.stripeSubscriptionId) {
    const result = await supabase
      .from("user_subscriptions" as never)
      .select("user_id, plan_id")
      .eq("stripe_subscription_id", input.stripeSubscriptionId)
      .maybeSingle();

    if (result.error) {
      console.error("[stripe-webhook] existing subscription lookup failed", {
        message: result.error.message,
        stripeSubscriptionId: input.stripeSubscriptionId
      });
      throw result.error;
    }

    data = result.data as { plan_id: string | null; user_id: string | null } | null;
  }

  if (data || !input.stripeCustomerId) {
    return data;
  }

  const { data: customerData, error } = await supabase
    .from("user_subscriptions" as never)
    .select("user_id, plan_id")
    .eq("stripe_customer_id", input.stripeCustomerId)
    .maybeSingle();

  if (error) {
    console.error("[stripe-webhook] existing subscription lookup failed", {
      message: error.message,
      stripeCustomerId: input.stripeCustomerId
    });
    throw error;
  }

  return customerData as { plan_id: string | null; user_id: string | null } | null;
}

export async function syncStripeSubscriptionEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId =
      metadataValue(session.metadata, "userId", "user_id") ?? session.client_reference_id;
    const planId = paidPlanFromMetadata(session.metadata);

    if (!userId || !planId) {
      console.error("[stripe-webhook] checkout.session.completed missing required metadata", {
        eventId: event.id,
        hasPlan: Boolean(planId),
        hasUserId: Boolean(userId),
        metadata: session.metadata ?? null,
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

    await createBillingNotification({
      metadata: {
        eventType: event.type,
        planId,
        status: "active"
      },
      providerEventId: event.id,
      type: "subscription_activated",
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
    const stripeCustomerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id ?? null;
    const existingSubscription = await findExistingSubscriptionByStripeReference({
      stripeCustomerId,
      stripeSubscriptionId: subscription.id
    });
    const userId =
      metadataValue(subscription.metadata, "userId", "user_id") ??
      existingSubscription?.user_id ??
      null;
    const pricePlanId = paidPlanFromSubscriptionPrice(subscription);
    const planId =
      pricePlanId ??
      paidPlanFromMetadata(subscription.metadata) ??
      (existingSubscription?.plan_id && isPaidSubscriptionPlan(existingSubscription.plan_id)
        ? existingSubscription.plan_id
        : null);

    console.info("[stripe-webhook] subscription update received", {
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      eventId: event.id,
      eventType: event.type,
      planId,
      pricePlanId,
      status: subscription.status,
      subscriptionId: subscription.id
    });

    if (!userId || !planId) {
      console.error("[stripe-webhook] subscription event missing required metadata", {
        eventId: event.id,
        eventType: event.type,
        hasPlan: Boolean(planId),
        hasUserId: Boolean(userId),
        metadata: subscription.metadata ?? null,
        subscriptionId: subscription.id
      });
      await logBillingEvent(event);
      return;
    }

    const status =
      event.type === "customer.subscription.deleted"
        ? "canceled"
        : normalizeStatus(subscription.status);

    const currentPeriodEnd = subscriptionPeriodDate(subscription, "current_period_end");
    const gracePeriodUntil =
      status === "past_due" || status === "unpaid"
        ? calculateGracePeriodUntil(currentPeriodEnd)
        : null;

    await upsertUserSubscription({
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd,
      currentPeriodStart: subscriptionPeriodDate(subscription, "current_period_start"),
      gracePeriodUntil,
      planId: status === "canceled" ? "free" : planId,
      status,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      userId
    });

    if (status === "canceled") {
      await createBillingNotification({
        metadata: {
          eventType: event.type,
          planId: "free",
          status
        },
        providerEventId: event.id,
        type: "subscription_canceled",
        userId
      });
    } else if (event.type === "customer.subscription.updated" && subscription.cancel_at_period_end) {
      await createBillingNotification({
        metadata: {
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd,
          eventType: event.type,
          planId,
          status
        },
        providerEventId: event.id,
        type: "subscription_canceled_at_period_end",
        userId
      });
    } else if (status === "past_due" || status === "unpaid") {
      await createBillingNotification({
        metadata: {
          eventType: event.type,
          gracePeriodUntil,
          planId,
          status
        },
        providerEventId: event.id,
        type: gracePeriodUntil ? "grace_period_started" : "subscription_restricted",
        userId
      });
    }

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
    const stripeSubscriptionId = invoiceSubscriptionId(invoice);
    const stripeCustomerId = stripeId(invoice.customer);
    const supabase = getBillingSyncClient();

    let subscription:
      | { current_period_end?: string | null; id: string; user_id: string | null }
      | undefined;

    if (stripeSubscriptionId || stripeCustomerId) {
      const query = supabase
        .from("user_subscriptions" as never)
        .select("id, user_id, current_period_end")
        .limit(1);
      const { data: subscriptions } = stripeSubscriptionId
        ? await query.eq("stripe_subscription_id", stripeSubscriptionId)
        : await query.eq("stripe_customer_id", stripeCustomerId as string);
      subscription = (subscriptions ?? [])[0] as
        | { current_period_end?: string | null; id: string; user_id: string | null }
        | undefined;
    }

    const userId = subscription?.user_id ?? null;

    if (!userId) {
      console.warn("[billing-notification-skip] invoice event has no matching user subscription", {
        eventId: event.id,
        eventType: event.type,
        hasStripeCustomerId: Boolean(stripeCustomerId),
        hasStripeSubscriptionId: Boolean(stripeSubscriptionId)
      });
    }

    const { error: invoiceError } = await supabase.from("invoices" as never).upsert({
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

    if (invoiceError) {
      console.error("[stripe-webhook] invoice upsert failed", {
        eventId: event.id,
        invoiceId: invoice.id,
        message: invoiceError.message
      });
      throw invoiceError;
    }

    if (event.type === "invoice.payment_failed") {
      const gracePeriodUntil = calculateGracePeriodUntil(subscription?.current_period_end ?? null);
      await updateSubscriptionStatusByStripeReference({
        gracePeriodUntil,
        status: "past_due",
        stripeCustomerId,
        stripeSubscriptionId
      });
      await createBillingNotification({
        metadata: {
          eventType: event.type,
          gracePeriodUntil,
          status: "past_due"
        },
        providerEventId: event.id,
        type: "payment_failed",
        userId
      });
      await createBillingNotification({
        metadata: {
          eventType: event.type,
          gracePeriodUntil,
          status: "past_due"
        },
        providerEventId: `${event.id}:grace`,
        type: "grace_period_started",
        userId
      });
    }

    if (event.type === "invoice.payment_succeeded") {
      await updateSubscriptionStatusByStripeReference({
        clearGracePeriod: true,
        status: "active",
        stripeCustomerId,
        stripeSubscriptionId
      });
      await createBillingNotification({
        metadata: {
          eventType: event.type,
          status: "active"
        },
        providerEventId: event.id,
        type: "payment_recovered",
        userId
      });
      await createBillingNotification({
        metadata: {
          eventType: event.type,
          status: "active"
        },
        providerEventId: `${event.id}:reactivated`,
        type: "subscription_reactivated",
        userId
      });
    }

    await logBillingEvent(event, userId);
    return;
  }

  await logBillingEvent(event);
}
