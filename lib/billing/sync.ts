import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingPlan, type SubscriptionPlanId } from "@/lib/billing/plans";
import {
  isPaidSubscriptionPlan,
  type PlatformBillingAccountRole,
  resolvePlatformPlanByPriceId,
  resolvePlatformPlanByPriceIdAsync
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

function stripeReferenceByPrefix(value: unknown, prefix: string, seen = new WeakSet<object>()): string | null {
  if (typeof value === "string") {
    return value.startsWith(prefix) ? value : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }

  seen.add(value);

  for (const child of Object.values(value as Record<string, unknown>)) {
    const reference = stripeReferenceByPrefix(child, prefix, seen);

    if (reference) {
      return reference;
    }
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

  return (
    stripeReferenceFromRecord(parentSubscriptionDetails?.subscription) ??
    stripeReferenceByPrefix(invoice, "sub_")
  );
}

function invoiceCustomerId(invoice: Stripe.Invoice) {
  return stripeId(invoice.customer) ?? stripeReferenceByPrefix(invoice, "cus_");
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

type BillingEventLogOutcome = "failed" | "skipped" | "success";

async function logBillingEvent(
  event: Stripe.Event,
  options?: {
    outcome?: BillingEventLogOutcome;
    reason?: string | null;
    userId?: string | null;
  }
) {
  const supabase = getBillingSyncClient();
  const { error } = await supabase.from("billing_events" as never).upsert({
    event_type: event.type,
    provider: "stripe",
    provider_event_id: event.id,
    user_id: options?.userId ?? null,
    payload: {
      api_version: event.api_version ?? null,
      created: event.created,
      data_object_id: (() => {
        const dataObject = event.data.object;
        return dataObject &&
          typeof dataObject === "object" &&
          "id" in dataObject &&
          typeof dataObject.id === "string"
          ? dataObject.id
          : null;
      })(),
      event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
      object: event.object,
      outcome: options?.outcome ?? "success",
      pending_webhooks: event.pending_webhooks ?? null,
      reason: options?.reason ?? null,
      request_id: event.request?.id ?? null
    } as never,
    processed_at: new Date().toISOString()
  } as never, { onConflict: "provider_event_id" });

  if (error) {
    console.warn("[stripe-webhook] billing event log skipped", {
      eventId: event.id,
      eventType: event.type,
      message: error.message
    });
  }
}

async function stripeEventAlreadyProcessed(eventId: string) {
  const supabase = getBillingSyncClient();
  const { data, error } = await supabase
    .from("billing_events" as never)
    .select("id, payload")
    .eq("provider_event_id" as never, eventId as never)
    .maybeSingle();

  if (error) {
    console.warn("[stripe-webhook] idempotency lookup failed; continuing", {
      eventId,
      message: error.message
    });
    return false;
  }

  if (!data) {
    return false;
  }

  const row = data as { payload?: { outcome?: string | null } | null };
  const outcome = row.payload?.outcome ?? null;

  if (outcome === "skipped" || outcome === "failed") {
    console.info("[stripe-webhook] retrying previously unmatched event", {
      eventId,
      outcome
    });
    return false;
  }

  return true;
}

function metadataValue(metadata: Stripe.Metadata | null | undefined, camelKey: string, snakeKey: string) {
  return metadata?.[snakeKey] ?? metadata?.[camelKey] ?? null;
}

function paidPlanFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  const planId = metadataValue(metadata, "planId", "plan_id") ?? metadata?.plan ?? null;

  return planId && isPaidSubscriptionPlan(planId) ? planId : null;
}

function platformBillingRoleFromMetadata(metadata: Stripe.Metadata | null | undefined): PlatformBillingAccountRole {
  const role = metadataValue(metadata, "role", "account_role") ?? metadata?.scope ?? null;
  return role === "reseller" ? "reseller" : "owner";
}

function platformBillingAccountIdFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  return metadataValue(metadata, "accountId", "account_id");
}

async function paidPlanFromSubscriptionPrice(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  return (
    resolvePlatformPlanByPriceId(priceId) ?? (await resolvePlatformPlanByPriceIdAsync(priceId))
  );
}

function isPlatformBillingMetadata(metadata: Stripe.Metadata | null | undefined) {
  const scope = metadataValue(metadata, "billingScope", "billing_scope");

  if (scope === "platform_subscription") {
    return true;
  }

  return Boolean(
    paidPlanFromMetadata(metadata) && metadataValue(metadata, "userId", "user_id")
  );
}

async function retrievePlatformSubscription(
  subscriptionRef: string | Stripe.Subscription | null | undefined
) {
  const subscriptionId =
    typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id ?? null;

  if (!subscriptionId) {
    return null;
  }

  try {
    return await getPlatformBillingStripe().subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.warn("[stripe-webhook] subscription retrieve failed", {
      message: error instanceof Error ? error.message : String(error),
      subscriptionId
    });
    return null;
  }
}

async function retrievePlatformSubscriptionForCustomer(stripeCustomerId: string | null | undefined) {
  if (!stripeCustomerId) {
    return null;
  }

  try {
    const subscriptions = await getPlatformBillingStripe().subscriptions.list({
      customer: stripeCustomerId,
      limit: 3,
      status: "all"
    });

    return (
      subscriptions.data.find((subscription) => isPlatformBillingMetadata(subscription.metadata)) ??
      subscriptions.data.find((subscription) => Boolean(paidPlanFromMetadata(subscription.metadata))) ??
      subscriptions.data[0] ??
      null
    );
  } catch (error) {
    console.warn("[stripe-webhook] customer subscription lookup failed", {
      message: error instanceof Error ? error.message : String(error),
      stripeCustomerId
    });
    return null;
  }
}

async function resolvePlatformCheckoutActivation(session: Stripe.Checkout.Session) {
  const sessionMetadata = session.metadata ?? {};
  let userId =
    metadataValue(sessionMetadata, "userId", "user_id") ?? session.client_reference_id ?? null;
  let planId = paidPlanFromMetadata(sessionMetadata);
  let metadata: Stripe.Metadata = sessionMetadata;
  let accountId = platformBillingAccountIdFromMetadata(sessionMetadata);
  const accountRole = platformBillingRoleFromMetadata(sessionMetadata);
  const subscription = await retrievePlatformSubscription(session.subscription);

  if (subscription) {
    const subscriptionMetadata = subscription.metadata ?? {};
    userId =
      userId ?? metadataValue(subscriptionMetadata, "userId", "user_id") ?? null;
    planId =
      planId ??
      paidPlanFromMetadata(subscriptionMetadata) ??
      (await paidPlanFromSubscriptionPrice(subscription));
    accountId = accountId ?? platformBillingAccountIdFromMetadata(subscriptionMetadata);

    if (!metadataValue(metadata, "billingScope", "billing_scope")) {
      metadata = {
        ...subscriptionMetadata,
        ...metadata
      };
    }
  }

  if (!planId && session.id) {
    try {
      const expandedSession = await getPlatformBillingStripe().checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price"]
      });
      planId = await resolvePlatformPlanByPriceIdAsync(
        expandedSession.line_items?.data?.[0]?.price?.id ?? null
      );
    } catch (error) {
      console.warn("[stripe-webhook] checkout session line item lookup failed", {
        message: error instanceof Error ? error.message : String(error),
        sessionId: session.id
      });
    }
  }

  return {
    accountId,
    accountRole,
    metadata,
    planId,
    subscription,
    userId
  };
}

async function activatePlatformSubscriptionFromStripe(input: {
  accountId?: string | null;
  accountRole?: PlatformBillingAccountRole;
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
  await upsertUserSubscription({
    accountId: input.accountId,
    accountRole: input.accountRole,
    billingScope: "platform_subscription",
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    currentPeriodEnd: input.currentPeriodEnd,
    currentPeriodStart: input.currentPeriodStart,
    gracePeriodUntil: input.gracePeriodUntil,
    planId: input.planId,
    status: input.status,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    userId: input.userId
  });
}

async function upsertUserSubscription(input: {
  accountId?: string | null;
  accountRole?: PlatformBillingAccountRole;
  billingScope?: "platform_subscription";
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
  const { data } = await supabase
    .from("user_subscriptions" as never)
    .select("limits_snapshot")
    .eq("user_id" as never, input.userId as never)
    .maybeSingle();
  const existing = data as { limits_snapshot?: Record<string, unknown> | null } | null;
  const existingSnapshot =
    existing?.limits_snapshot &&
    typeof existing.limits_snapshot === "object" &&
    !Array.isArray(existing.limits_snapshot)
      ? existing.limits_snapshot
      : {};
  const { error } = await supabase.from("user_subscriptions" as never).upsert(
    {
      cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
      current_period_end: input.currentPeriodEnd ?? null,
      current_period_start: input.currentPeriodStart ?? null,
      grace_period_until: input.gracePeriodUntil ?? null,
      limits_snapshot: {
        ...existingSnapshot,
        platformBilling: {
          accountId: input.accountId ?? null,
          accountRole: input.accountRole ?? "owner",
          billingScope: input.billingScope ?? "platform_subscription",
          provider: "stripe",
          syncedAt: new Date().toISOString()
        }
      },
      plan_key: plan.id,
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
    stripeCustomerId: input.stripeCustomerId,
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
  if (await stripeEventAlreadyProcessed(event.id)) {
    console.info("[stripe-webhook] duplicate event skipped", {
      eventId: event.id,
      eventType: event.type
    });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.mode !== "subscription") {
      await logBillingEvent(event, {
        outcome: "skipped",
        reason: "non_subscription_checkout"
      });
      return;
    }

    const activation = await resolvePlatformCheckoutActivation(session);

    if (!isPlatformBillingMetadata(activation.metadata)) {
      await logBillingEvent(event, {
        outcome: "skipped",
        reason: "non_platform_billing_checkout"
      });
      return;
    }

    const { accountId, accountRole, planId, subscription, userId } = activation;

    if (!userId || !planId) {
      console.error("[stripe-webhook] checkout.session.completed missing required metadata", {
        eventId: event.id,
        hasPlan: Boolean(planId),
        hasUserId: Boolean(userId),
        metadata: activation.metadata ?? null,
        sessionId: session.id
      });
      await logBillingEvent(event, {
        outcome: "skipped",
        reason: "missing_checkout_activation_metadata"
      });
      return;
    }

    const stripeCustomerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    const stripeSubscriptionId =
      subscription?.id ??
      (typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id ?? null);

    await activatePlatformSubscriptionFromStripe({
      accountId,
      accountRole,
      currentPeriodEnd: subscription
        ? subscriptionPeriodDate(subscription, "current_period_end")
        : null,
      currentPeriodStart: subscription
        ? subscriptionPeriodDate(subscription, "current_period_start")
        : null,
      planId,
      status: "active",
      stripeCustomerId,
      stripeSubscriptionId,
      userId
    });

    try {
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
    } catch (error) {
      console.warn("[stripe-webhook] subscription activation notification skipped", {
        eventId: event.id,
        message: error instanceof Error ? error.message : String(error),
        userId
      });
    }

    await logBillingEvent(event, {
      outcome: "success",
      userId
    });
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
    let billingUserId =
      metadataValue(subscription.metadata, "userId", "user_id") ??
      existingSubscription?.user_id ??
      null;
    const notificationUserId = await resolveNotificationUserId({
      currentUserId: billingUserId,
      eventType: event.type,
      stripeCustomerEmail: subscriptionCustomerEmail
    });
    billingUserId = billingUserId ?? notificationUserId ?? null;
    if (
      !isPlatformBillingMetadata(subscription.metadata) &&
      !existingSubscription &&
      event.type !== "customer.subscription.deleted"
    ) {
      await logBillingEvent(event, {
        outcome: "skipped",
        reason: "non_platform_subscription"
      });
      return;
    }

    const pricePlanId = await paidPlanFromSubscriptionPrice(subscription);
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
      await logBillingEvent(event, {
        outcome: "skipped",
        reason: "missing_subscription_activation_metadata"
      });
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
      accountId: platformBillingAccountIdFromMetadata(subscription.metadata),
      accountRole: platformBillingRoleFromMetadata(subscription.metadata),
      billingScope: "platform_subscription",
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

    await logBillingEvent(event, {
      outcome: "success",
      userId: billingUserId
    });
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
    let stripeSubscriptionId = invoiceSubscriptionId(invoice);
    const stripeCustomerId = invoiceCustomerId(invoice);
    const stripeCustomerEmail = await resolveStripeCustomerEmail({
      customer: invoice.customer,
      customerEmail: invoice.customer_email,
      stripeCustomerId
    });
    const supabase = getBillingSyncClient();

    let subscription:
      | { current_period_end?: string | null; id: string; user_id: string | null }
      | undefined;

    if (stripeSubscriptionId) {
      const { data: subscriptions } = await supabase
        .from("user_subscriptions" as never)
        .select("id, user_id, current_period_end")
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .limit(1);
      subscription = (subscriptions ?? [])[0] as
        | { current_period_end?: string | null; id: string; user_id: string | null }
        | undefined;
    }

    if (!subscription && stripeCustomerId) {
      const { data: subscriptions } = await supabase
        .from("user_subscriptions" as never)
        .select("id, user_id, current_period_end")
        .eq("stripe_customer_id", stripeCustomerId)
        .limit(1);
      subscription = (subscriptions ?? [])[0] as
        | { current_period_end?: string | null; id: string; user_id: string | null }
        | undefined;
    }

    let billingUserId = subscription?.user_id ?? null;

    console.info("[stripe-webhook] invoice subscription lookup completed", {
      eventId: event.id,
      eventType: event.type,
      matchedUserId: billingUserId,
      stripeCustomerId,
      stripeSubscriptionId
    });

    if (
      !billingUserId &&
      event.type === "invoice.payment_succeeded" &&
      (stripeSubscriptionId || stripeCustomerId)
    ) {
      const stripeSubscription =
        (await retrievePlatformSubscription(stripeSubscriptionId)) ??
        (await retrievePlatformSubscriptionForCustomer(stripeCustomerId));

      if (stripeSubscription && isPlatformBillingMetadata(stripeSubscription.metadata)) {
        stripeSubscriptionId = stripeSubscription.id;
        const metadataUserId =
          metadataValue(stripeSubscription.metadata, "userId", "user_id") ?? null;
        const invoiceUserId = await resolveNotificationUserId({
          currentUserId: metadataUserId,
          eventType: event.type,
          stripeCustomerEmail
        });
        const invoicePlanId =
          paidPlanFromMetadata(stripeSubscription.metadata) ??
          (await paidPlanFromSubscriptionPrice(stripeSubscription));

        if (invoiceUserId && invoicePlanId) {
          await activatePlatformSubscriptionFromStripe({
            accountId: platformBillingAccountIdFromMetadata(stripeSubscription.metadata),
            accountRole: platformBillingRoleFromMetadata(stripeSubscription.metadata),
            currentPeriodEnd: subscriptionPeriodDate(stripeSubscription, "current_period_end"),
            currentPeriodStart: subscriptionPeriodDate(stripeSubscription, "current_period_start"),
            planId: invoicePlanId,
            status: "active",
            stripeCustomerId,
            stripeSubscriptionId,
            userId: invoiceUserId
          });
          billingUserId = invoiceUserId;

          console.info("[stripe-webhook] invoice matched platform subscription", {
            eventId: event.id,
            eventType: event.type,
            stripeCustomerId,
            stripeSubscriptionId,
            userId: invoiceUserId
          });

          const { data: activatedSubscription } = await supabase
            .from("user_subscriptions" as never)
            .select("id, user_id, current_period_end")
            .eq("user_id" as never, invoiceUserId as never)
            .maybeSingle();
          subscription = (activatedSubscription ?? undefined) as
            | { current_period_end?: string | null; id: string; user_id: string | null }
            | undefined;
        }
      }
    }

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

    await logBillingEvent(event, {
      outcome: billingUserId ? "success" : "skipped",
      reason: billingUserId ? null : "invoice_without_user_subscription",
      userId: billingUserId
    });
    return;
  }

  await logBillingEvent(event, { outcome: "skipped", reason: "unhandled_event_type" });
}
