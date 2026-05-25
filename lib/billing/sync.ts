import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingPlan, type SubscriptionPlanId } from "@/lib/billing/plans";
import {
  isPaidSubscriptionPlan,
  resolvePlatformPlanByPriceId
} from "@/lib/billing/platform-checkout";
import { createBillingNotification } from "@/lib/notifications/billing-notifications";
import { resolveNotificationUserId } from "@/lib/notifications/resolve-user";
import { getPlatformBillingStripe } from "@/lib/stripe";

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

function stripeEmail(value: unknown) {
  if (!value || typeof value !== "object" || !("email" in value)) {
    return null;
  }

  const email = (value as { email?: unknown }).email;
  return typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : null;
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

async function resolveStripeCustomerEmail(input: {
  customer: unknown;
  customerEmail?: string | null;
  stripeCustomerId?: string | null;
}) {
  const directEmail =
    typeof input.customerEmail === "string" && input.customerEmail.includes("@")
      ? input.customerEmail.trim().toLowerCase()
      : stripeEmail(input.customer);

  if (directEmail || !input.stripeCustomerId) {
    return directEmail;
  }

  try {
    const customer = await getPlatformBillingStripe().customers.retrieve(input.stripeCustomerId);

    if (customer.deleted) {
      return null;
    }

    return customer.email?.trim().toLowerCase() ?? null;
  } catch (error) {
    console.warn("[billing-notification-skip] Stripe customer email lookup failed", {
      message: error instanceof Error ? error.message : String(error),
      stripeCustomerId: input.stripeCustomerId
    });
    return null;
  }
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

async function createWebhookBillingNotification(input: {
  eventId: string;
  metadata: Record<string, unknown>;
  providerEventId: string;
  type: Parameters<typeof createBillingNotification>[0]["type"];
  userId?: string | null;
  webhookType: string;
}) {
  console.log("[stripe-debug] notification handler start", {
    eventId: input.eventId,
    eventType: input.webhookType,
    notificationType: input.type,
    resolvedUserId: input.userId ?? null
  });

  if (!input.userId) {
    console.warn("[stripe-debug] notification skipped (no resolved user)", {
      eventId: input.eventId,
      eventType: input.webhookType,
      failureReason: "user_resolution_empty",
      notificationType: input.type
    });
    return;
  }

  try {
    const inserted = await createBillingNotification({
      metadata: {
        ...input.metadata,
        webhookType: input.webhookType
      },
      providerEventId: input.providerEventId,
      type: input.type,
      userId: input.userId
    });

    console.log("[stripe-debug] notification handler completed", {
      eventId: input.eventId,
      eventType: input.webhookType,
      inserted,
      notificationType: input.type,
      resolvedUserId: input.userId
    });
  } catch (error) {
    console.warn("[stripe-debug] notification handler error", {
      eventId: input.eventId,
      eventType: input.webhookType,
      message: error instanceof Error ? error.message : String(error),
      notificationType: input.type,
      resolvedUserId: input.userId ?? null
    });
  }
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
    const subscriptionCustomerEmail = await resolveStripeCustomerEmail({
      customer: subscription.customer,
      stripeCustomerId
    });
    const existingSubscription = await findExistingSubscriptionByStripeReference({
      stripeCustomerId,
      stripeSubscriptionId: subscription.id
    });
    const billingUserId =
      metadataValue(subscription.metadata, "userId", "user_id") ??
      existingSubscription?.user_id ??
      null;
    const notificationUserId = await resolveNotificationUserId({
      currentUserId: billingUserId,
      eventType: event.type,
      stripeCustomerEmail: subscriptionCustomerEmail
    });
    const pricePlanId = paidPlanFromSubscriptionPrice(subscription);
    const planId =
      pricePlanId ??
      paidPlanFromMetadata(subscription.metadata) ??
      (existingSubscription?.plan_id && isPaidSubscriptionPlan(existingSubscription.plan_id)
        ? existingSubscription.plan_id
        : null);
    const previousPlanId = existingSubscription?.plan_id ?? null;
    const planChanged =
      event.type === "customer.subscription.updated" &&
      Boolean(previousPlanId) &&
      Boolean(planId) &&
      previousPlanId !== planId;

    console.info("[stripe-webhook] subscription update received", {
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      eventId: event.id,
      eventType: event.type,
      planId,
      pricePlanId,
      status: subscription.status,
      subscriptionId: subscription.id
    });

    if (event.type === "customer.subscription.updated") {
      console.info("[subscription-updated] subscription update resolved", {
        eventId: event.id,
        metadataPlanId: paidPlanFromMetadata(subscription.metadata),
        planChanged,
        previousPlanId,
        pricePlanId,
        resolvedPlanId: planId,
        status: subscription.status,
        subscriptionId: subscription.id
      });
    }

    if (!billingUserId || !planId) {
      console.error("[stripe-webhook] subscription event missing required metadata", {
        eventId: event.id,
        eventType: event.type,
        hasPlan: Boolean(planId),
        hasUserId: Boolean(billingUserId),
        metadata: subscription.metadata ?? null,
        subscriptionId: subscription.id
      });
      if (event.type === "customer.subscription.deleted" && notificationUserId) {
        await createWebhookBillingNotification({
          eventId: event.id,
          metadata: {
            eventType: event.type,
            planId: "free",
            resolvedEmail: subscriptionCustomerEmail,
            status: "canceled"
          },
          providerEventId: event.id,
          type: "subscription_canceled",
          userId: notificationUserId,
          webhookType: event.type
        });
      }
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
      userId: billingUserId
    });

    if (planChanged) {
      console.info("[subscription-updated] plan change detected", {
        eventId: event.id,
        newPlanId: planId,
        previousPlanId,
        pricePlanId,
        status,
        subscriptionId: subscription.id,
        userId: billingUserId
      });

      console.info("[plan-change-notification] creating notification", {
        eventId: event.id,
        newPlanId: planId,
        previousPlanId,
        userId: notificationUserId
      });

      await createWebhookBillingNotification({
        eventId: event.id,
        metadata: {
          eventType: event.type,
          newPlanId: planId,
          previousPlanId,
          pricePlanId,
          resolvedEmail: subscriptionCustomerEmail,
          status
        },
        providerEventId: `${event.id}:plan-change`,
        type: "subscription_plan_changed",
        userId: notificationUserId,
        webhookType: event.type
      });

      console.info("[plan-change-notification] notification flow completed", {
        eventId: event.id,
        newPlanId: planId,
        previousPlanId,
        userId: notificationUserId
      });
    }

    if (status === "canceled") {
      await createWebhookBillingNotification({
        eventId: event.id,
        metadata: {
          eventType: event.type,
          planId: "free",
          resolvedEmail: subscriptionCustomerEmail,
          status
        },
        providerEventId: event.id,
        type: "subscription_canceled",
        userId: notificationUserId,
        webhookType: event.type
      });
    } else if (event.type === "customer.subscription.updated" && subscription.cancel_at_period_end) {
      await createWebhookBillingNotification({
        eventId: event.id,
        metadata: {
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd,
          eventType: event.type,
          planId,
          resolvedEmail: subscriptionCustomerEmail,
          status
        },
        providerEventId: event.id,
        type: "subscription_canceled_at_period_end",
        userId: notificationUserId,
        webhookType: event.type
      });
    } else if (status === "past_due" || status === "unpaid") {
      await createWebhookBillingNotification({
        eventId: event.id,
        metadata: {
          eventType: event.type,
          gracePeriodUntil,
          planId,
          resolvedEmail: subscriptionCustomerEmail,
          status
        },
        providerEventId: event.id,
        type: gracePeriodUntil ? "grace_period_started" : "subscription_restricted",
        userId: notificationUserId,
        webhookType: event.type
      });
    }

    await logBillingEvent(event, billingUserId);
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
    const stripeCustomerEmail = await resolveStripeCustomerEmail({
      customer: invoice.customer,
      customerEmail: invoice.customer_email,
      stripeCustomerId
    });
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

    const billingUserId = subscription?.user_id ?? null;

    if (!billingUserId) {
      console.warn("[billing-notification-skip] invoice event has no matching user subscription", {
        eventId: event.id,
        eventType: event.type,
        hasStripeCustomerId: Boolean(stripeCustomerId),
        hasStripeSubscriptionId: Boolean(stripeSubscriptionId),
        resolvedEmail: stripeCustomerEmail ?? null
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
      user_id: billingUserId
    } as never, { onConflict: "provider_invoice_id" });

    if (invoiceError) {
      console.warn("[stripe-debug] invoice upsert failed (continuing to notifications)", {
        code: invoiceError.code,
        eventId: event.id,
        eventType: event.type,
        invoiceId: invoice.id,
        message: invoiceError.message
      });
    }

    console.log("[stripe-debug] invoice event ready for notifications", {
      billingUserId,
      customerEmail: stripeCustomerEmail ?? null,
      eventId: event.id,
      eventType: event.type,
      hasStripeCustomerId: Boolean(stripeCustomerId),
      hasStripeSubscriptionId: Boolean(stripeSubscriptionId)
    });

    if (event.type === "invoice.payment_failed") {
      const gracePeriodUntil = calculateGracePeriodUntil(subscription?.current_period_end ?? null);
      const updatedUserId = await updateSubscriptionStatusByStripeReference({
        gracePeriodUntil,
        status: "past_due",
        stripeCustomerId,
        stripeSubscriptionId
      });
      const notificationUserId = await resolveNotificationUserId({
        currentUserId: billingUserId ?? updatedUserId,
        eventType: event.type,
        stripeCustomerEmail
      });
      await createWebhookBillingNotification({
        eventId: event.id,
        metadata: {
          eventType: event.type,
          gracePeriodUntil,
          resolvedEmail: stripeCustomerEmail,
          status: "past_due"
        },
        providerEventId: event.id,
        type: "payment_failed",
        userId: notificationUserId,
        webhookType: event.type
      });
      await createWebhookBillingNotification({
        eventId: event.id,
        metadata: {
          eventType: event.type,
          gracePeriodUntil,
          resolvedEmail: stripeCustomerEmail,
          status: "past_due"
        },
        providerEventId: `${event.id}:grace`,
        type: "grace_period_started",
        userId: notificationUserId,
        webhookType: event.type
      });
    }

    if (event.type === "invoice.payment_succeeded") {
      const updatedUserId = await updateSubscriptionStatusByStripeReference({
        clearGracePeriod: true,
        status: "active",
        stripeCustomerId,
        stripeSubscriptionId
      });
      const notificationUserId = await resolveNotificationUserId({
        currentUserId: billingUserId ?? updatedUserId,
        eventType: event.type,
        stripeCustomerEmail
      });
      await createWebhookBillingNotification({
        eventId: event.id,
        metadata: {
          eventType: event.type,
          resolvedEmail: stripeCustomerEmail,
          status: "active"
        },
        providerEventId: event.id,
        type: "payment_recovered",
        userId: notificationUserId,
        webhookType: event.type
      });
      await createWebhookBillingNotification({
        eventId: event.id,
        metadata: {
          eventType: event.type,
          resolvedEmail: stripeCustomerEmail,
          status: "active"
        },
        providerEventId: `${event.id}:reactivated`,
        type: "subscription_reactivated",
        userId: notificationUserId,
        webhookType: event.type
      });
    }

    await logBillingEvent(event, billingUserId);
    return;
  }

  await logBillingEvent(event);
}
