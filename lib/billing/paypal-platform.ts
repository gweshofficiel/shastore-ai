import { getManagedBillingPlanForCheckout } from "@/lib/billing/managed-plans";
import { getBillingPlan, type SubscriptionPlanId } from "@/lib/billing/plans";
import {
  isPaidSubscriptionPlan,
  type PlatformBillingAccountRole
} from "@/lib/billing/platform-checkout";
import type { PlatformBillingProvider } from "@/lib/billing/providers";
import { createAdminClient } from "@/lib/supabase/admin";

type PayPalPlatformCheckoutInput = {
  accountId?: string | null;
  accountRole: PlatformBillingAccountRole;
  customerEmail?: string | null;
  plan: SubscriptionPlanId;
  userId: string;
};

export type PayPalPlatformCheckoutResult =
  | { ok: true; url: string }
  | {
      code: "checkout_failed" | "checkout_url_unavailable" | "invalid_plan" | "missing_config";
      message: string;
      ok: false;
    };

type ParsedPlatformOrderId = {
  accountRole: PlatformBillingAccountRole;
  orderTimestamp: string | null;
  planId: SubscriptionPlanId | null;
  userId: string | null;
};

type PlatformOrderContext = {
  captureId: string | null;
  orderId: string | null;
  orderReference: string | null;
  parsedOrder: ParsedPlatformOrderId;
  payerId: string | null;
  resource: PayPalResource | null;
};

type PayPalApiOrderResponse = {
  id?: string;
  links?: Array<{ href?: string; rel?: string }>;
};

type PayPalWebhookEvent = {
  event_type?: string;
  id?: string;
  resource?: PayPalResource;
};

type PayPalResource = {
  id?: string;
  invoice_id?: string;
  payer?: {
    email_address?: string;
    payer_id?: string;
  };
  payer_email?: string;
  payer_id?: string;
  purchase_units?: Array<{
    custom_id?: string;
    invoice_id?: string;
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
      }>;
    };
  }>;
  status?: string;
  supplementary_data?: {
    related_ids?: {
      order_id?: string;
    };
  };
};

type PayPalErrorResponse = {
  details?: Array<{ issue?: string }>;
  message?: string;
  name?: string;
};

const PAYPAL_PROVIDER = "paypal" satisfies PlatformBillingProvider;
const PAYPAL_SANDBOX_API_BASE_URL = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE_API_BASE_URL = "https://api-m.paypal.com";
const PLATFORM_ORDER_PREFIX = "platform_subscription";

function readEnv(key: string) {
  return process.env[key]?.trim() || null;
}

function paypalApiBaseUrl() {
  return readEnv("PAYPAL_ENVIRONMENT") === "live"
    ? PAYPAL_LIVE_API_BASE_URL
    : PAYPAL_SANDBOX_API_BASE_URL;
}

function appBaseUrl() {
  const baseUrl = readEnv("NEXT_PUBLIC_APP_URL");

  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/+$/, "");
}

function paypalClientId() {
  return readEnv("PAYPAL_CLIENT_ID");
}

function paypalClientSecret() {
  return readEnv("PAYPAL_CLIENT_SECRET");
}

function paypalWebhookId() {
  return readEnv("PAYPAL_WEBHOOK_ID");
}

function platformBillingUrl(accountRole: PlatformBillingAccountRole, params: Record<string, string>) {
  const baseUrl = appBaseUrl();

  if (!baseUrl) {
    return null;
  }

  const path = accountRole === "reseller" ? "/reseller/dashboard/subscription" : "/dashboard/billing";
  const search = new URLSearchParams(params);

  return `${baseUrl}${path}?${search.toString()}`;
}

function paypalPlatformOrderId(input: PayPalPlatformCheckoutInput) {
  return [
    PLATFORM_ORDER_PREFIX,
    input.accountRole,
    input.plan,
    input.userId,
    Date.now().toString()
  ].join(":");
}

function parsePlatformOrderId(orderId?: string | null): ParsedPlatformOrderId {
  const [prefix, role, planId, userId, orderTimestamp] = (orderId ?? "").split(":");

  if (prefix !== PLATFORM_ORDER_PREFIX) {
    return {
      accountRole: "owner",
      orderTimestamp: null,
      planId: null,
      userId: null
    };
  }

  return {
    accountRole: role === "reseller" ? "reseller" : "owner",
    orderTimestamp: orderTimestamp || null,
    planId: planId && isPaidSubscriptionPlan(planId) ? planId : null,
    userId: userId || null
  };
}

function paypalErrorIssue(data: PayPalErrorResponse | null) {
  return data?.details?.find((detail) => detail.issue)?.issue ?? data?.name ?? null;
}

async function getPayPalAccessToken() {
  const clientId = paypalClientId();
  const clientSecret = paypalClientSecret();

  if (!clientId || !clientSecret) {
    return null;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${paypalApiBaseUrl()}/v1/oauth2/token`, {
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });
  const data = (await response.json().catch(() => null)) as { access_token?: string } | null;

  if (!response.ok || !data?.access_token) {
    console.error("[paypal-platform] access token request failed", {
      status: response.status,
      statusText: response.statusText
    });
    return null;
  }

  return data.access_token;
}

async function logPayPalBillingEvent(input: {
  eventType: string;
  outcome: "failed" | "skipped" | "success";
  payload: Record<string, unknown>;
  providerEventId: string;
  reason?: string | null;
  userId?: string | null;
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    console.warn("[paypal-platform] billing event log skipped without service client", {
      eventType: input.eventType,
      providerEventId: input.providerEventId
    });
    return;
  }

  const { error } = await supabase.from("billing_events" as never).upsert({
    event_type: input.eventType,
    provider: PAYPAL_PROVIDER,
    provider_event_id: input.providerEventId,
    user_id: input.userId ?? null,
    payload: {
      ...input.payload,
      outcome: input.outcome,
      reason: input.reason ?? null
    } as never,
    processed_at: new Date().toISOString()
  } as never, { onConflict: "provider_event_id" });

  if (error) {
    if (
      error.code === "PGRST205" ||
      error.message?.toLowerCase().includes("billing_events")
    ) {
      console.warn("[paypal-platform] billing event log skipped because table is unavailable", {
        eventType: input.eventType,
        providerEventId: input.providerEventId
      });
      return;
    }

    console.warn("[paypal-platform] billing event log failed", {
      eventType: input.eventType,
      message: error.message,
      providerEventId: input.providerEventId
    });
  }
}

function platformOrderIdFromResource(resource: PayPalResource | undefined) {
  return (
    resource?.purchase_units?.find((unit) => unit.custom_id)?.custom_id ??
    resource?.purchase_units?.find((unit) => unit.invoice_id)?.invoice_id ??
    resource?.invoice_id ??
    null
  );
}

function payerIdFromResource(resource: PayPalResource | undefined) {
  return (
    resource?.payer?.payer_id ??
    resource?.payer_id ??
    resource?.payer?.email_address ??
    resource?.payer_email ??
    null
  );
}

function captureIdFromResource(resource: PayPalResource | undefined) {
  return (
    resource?.purchase_units
      ?.flatMap((unit) => unit.payments?.captures ?? [])
      .find((capture) => capture.id)?.id ??
    (resource?.supplementary_data?.related_ids?.order_id ? resource.id ?? null : null)
  );
}

async function fetchPayPalOrder(orderId: string) {
  const accessToken = await getPayPalAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${paypalApiBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "GET"
  });
  const data = (await response.json().catch(() => null)) as PayPalResource | PayPalErrorResponse | null;

  if (!response.ok) {
    console.error("[paypal_activation_failed]", {
      message: data && "message" in data ? data.message : response.statusText,
      orderId,
      reason: "fetch_order_failed",
      status: response.status
    });
    return null;
  }

  return data as PayPalResource;
}

async function resolvePlatformOrderContext(input: {
  paypalOrderId?: string | null;
  resource?: PayPalResource;
}): Promise<PlatformOrderContext> {
  let resource = input.resource ?? null;
  let orderId = resource?.id ?? input.paypalOrderId ?? null;
  let orderReference = platformOrderIdFromResource(resource ?? undefined);

  if (!orderReference && resource?.supplementary_data?.related_ids?.order_id) {
    orderId = resource.supplementary_data.related_ids.order_id;
    resource = await fetchPayPalOrder(orderId);
    orderReference = platformOrderIdFromResource(resource ?? undefined);
  }

  if (!orderReference && orderId) {
    resource = resource ?? (await fetchPayPalOrder(orderId));
    orderReference = platformOrderIdFromResource(resource ?? undefined);
  }

  const parsedOrder = parsePlatformOrderId(orderReference);

  return {
    captureId: captureIdFromResource(resource ?? undefined),
    orderId,
    orderReference,
    parsedOrder,
    payerId: payerIdFromResource(resource ?? undefined),
    resource
  };
}

async function upsertPayPalSubscription(input: {
  accountRole: PlatformBillingAccountRole;
  captureId?: string | null;
  orderId?: string | null;
  payerId?: string | null;
  planId: SubscriptionPlanId;
  userId: string;
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for PayPal billing sync.");
  }

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
  const now = new Date();
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  const { error } = await supabase.from("user_subscriptions" as never).upsert({
    cancel_at_period_end: false,
    current_period_end: currentPeriodEnd.toISOString(),
    current_period_start: now.toISOString(),
    grace_period_until: null,
    limits_snapshot: {
      ...existingSnapshot,
      platformBilling: {
        accountRole: input.accountRole,
        billingScope: "platform",
        paypalCaptureId: input.captureId ?? null,
        paypalOrderId: input.orderId ?? null,
        provider: PAYPAL_PROVIDER,
        syncedAt: now.toISOString()
      }
    },
    paypal_capture_id: input.captureId ?? null,
    paypal_order_id: input.orderId ?? null,
    plan_key: plan.id,
    plan_id: plan.id,
    provider: PAYPAL_PROVIDER,
    provider_customer_id: input.payerId ?? null,
    provider_subscription_id: input.orderId ?? input.captureId ?? null,
    status: "active",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    updated_at: now.toISOString(),
    user_id: input.userId
  } as never, { onConflict: "user_id" });

  if (error) {
    console.error("[paypal_activation_failed]", {
      captureId: input.captureId ?? null,
      message: error.message,
      orderId: input.orderId ?? null,
      planId: input.planId,
      reason: "user_subscription_upsert_failed",
      userId: input.userId
    });
    throw error;
  }

  console.info("[paypal_activation_completed]", {
    captureId: input.captureId ?? null,
    orderId: input.orderId ?? null,
    planId: input.planId,
    provider: PAYPAL_PROVIDER,
    userId: input.userId
  });
}

async function activatePayPalPlatformSubscription(input: {
  accountRole: PlatformBillingAccountRole;
  captureId?: string | null;
  eventId: string;
  eventType: string;
  orderId?: string | null;
  orderReference?: string | null;
  payerId?: string | null;
  planId: SubscriptionPlanId;
  source: "checkout_return" | "webhook";
  userId: string;
}) {
  console.info("[paypal_activation_started]", {
    eventId: input.eventId,
    eventType: input.eventType,
    orderId: input.orderId ?? null,
    orderReference: input.orderReference ?? null,
    planId: input.planId,
    source: input.source,
    userId: input.userId
  });

  await upsertPayPalSubscription({
    accountRole: input.accountRole,
    captureId: input.captureId ?? null,
    orderId: input.orderId ?? null,
    payerId: input.payerId ?? null,
    planId: input.planId,
    userId: input.userId
  });

  await logPayPalBillingEvent({
    eventType: `paypal.activation.${input.source}`,
    outcome: "success",
    payload: {
      captureId: input.captureId ?? null,
      eventType: input.eventType,
      orderId: input.orderId ?? null,
      orderReference: input.orderReference ?? null,
      planId: input.planId,
      source: input.source
    },
    providerEventId: `${input.source}:${input.eventId}`,
    userId: input.userId
  });
}

async function captureApprovedOrder(orderId: string, eventId: string | null) {
  const accessToken = await getPayPalAccessToken();

  if (!accessToken) {
    throw new Error("Could not authenticate PayPal capture request.");
  }

  const response = await fetch(`${paypalApiBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    body: "{}",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": eventId ?? orderId
    },
    method: "POST"
  });
  const data = (await response.json().catch(() => null)) as PayPalResource | PayPalErrorResponse | null;

  if (!response.ok) {
    const issue = paypalErrorIssue(
      data && "name" in data ? (data as PayPalErrorResponse) : null
    );

    if (issue === "ORDER_ALREADY_CAPTURED") {
      console.info("[paypal-platform] order already captured, fetching order details", { orderId });
      const existingOrder = await fetchPayPalOrder(orderId);

      if (existingOrder) {
        return existingOrder;
      }
    }

    console.error("[paypal_activation_failed]", {
      issue,
      message: data && "message" in data ? data.message : response.statusText,
      orderId,
      reason: "order_capture_failed",
      status: response.status
    });
    throw new Error("PayPal order capture failed.");
  }

  return data as PayPalResource;
}

async function activateFromOrderContext(input: {
  context: PlatformOrderContext;
  eventId: string;
  eventType: string;
  source: "checkout_return" | "webhook";
}) {
  const { context, eventId, eventType, source } = input;

  if (!context.parsedOrder.userId || !context.parsedOrder.planId) {
    console.error("[paypal_activation_failed]", {
      eventId,
      eventType,
      orderId: context.orderId,
      orderReference: context.orderReference,
      reason: "invalid_platform_order_reference"
    });
    throw new Error("Invalid PayPal platform billing order reference.");
  }

  const captureId = context.captureId ?? context.orderId;

  if (!captureId) {
    console.error("[paypal_activation_failed]", {
      eventId,
      eventType,
      orderId: context.orderId,
      orderReference: context.orderReference,
      reason: "missing_capture_reference"
    });
    throw new Error("PayPal capture reference is missing.");
  }

  await activatePayPalPlatformSubscription({
    accountRole: context.parsedOrder.accountRole,
    captureId,
    eventId,
    eventType,
    orderId: context.orderId,
    orderReference: context.orderReference,
    payerId: context.payerId,
    planId: context.parsedOrder.planId,
    source,
    userId: context.parsedOrder.userId
  });

  return {
    activated: true,
    planId: context.parsedOrder.planId,
    userId: context.parsedOrder.userId
  };
}

export async function completePayPalPlatformCheckoutFromReturn(input: {
  paypalOrderId: string;
  userId: string;
}) {
  console.info("[paypal_activation_started]", {
    paypalOrderId: input.paypalOrderId,
    source: "checkout_return",
    userId: input.userId
  });

  const capturedOrder = await captureApprovedOrder(input.paypalOrderId, `return:${input.paypalOrderId}`);
  const context = await resolvePlatformOrderContext({
    paypalOrderId: input.paypalOrderId,
    resource: capturedOrder ?? undefined
  });

  if (context.parsedOrder.userId && context.parsedOrder.userId !== input.userId) {
    console.error("[paypal_activation_failed]", {
      expectedUserId: input.userId,
      orderReference: context.orderReference,
      parsedUserId: context.parsedOrder.userId,
      reason: "checkout_return_user_mismatch"
    });
    throw new Error("PayPal order does not belong to the authenticated user.");
  }

  return activateFromOrderContext({
    context,
    eventId: input.paypalOrderId,
    eventType: "CHECKOUT.ORDER.RETURN",
    source: "checkout_return"
  });
}

export async function createPayPalPlatformCheckout(
  input: PayPalPlatformCheckoutInput
): Promise<PayPalPlatformCheckoutResult> {
  const baseUrl = appBaseUrl();

  if (!paypalClientId() || !paypalClientSecret() || !paypalWebhookId() || !baseUrl) {
    return {
      code: "missing_config",
      message: "PayPal platform billing is not configured.",
      ok: false
    };
  }

  if (!isPaidSubscriptionPlan(input.plan)) {
    return {
      code: "invalid_plan",
      message: "Choose Starter, Pro, or Agency.",
      ok: false
    };
  }

  const plan = await getManagedBillingPlanForCheckout(input.plan);

  if (!plan.active) {
    return {
      code: "invalid_plan",
      message: `${plan.name} is not available for checkout.`,
      ok: false
    };
  }

  const successUrl = platformBillingUrl(input.accountRole, {
    billing: "success",
    provider: PAYPAL_PROVIDER
  });
  const cancelUrl = platformBillingUrl(input.accountRole, {
    billing: "cancelled",
    provider: PAYPAL_PROVIDER
  });
  const returnUrl = `${baseUrl}/api/paypal/platform-billing/checkout/return`;

  if (!successUrl || !cancelUrl) {
    return {
      code: "missing_config",
      message: "NEXT_PUBLIC_APP_URL is required for PayPal checkout.",
      ok: false
    };
  }

  const accessToken = await getPayPalAccessToken();

  if (!accessToken) {
    return {
      code: "checkout_failed",
      message: "Could not authenticate PayPal platform billing.",
      ok: false
    };
  }

  const orderReference = paypalPlatformOrderId(input);
  const amount = (plan.priceCents / 100).toFixed(2);

  try {
    const response = await fetch(`${paypalApiBaseUrl()}/v2/checkout/orders`, {
      body: JSON.stringify({
        application_context: {
          brand_name: "SHASTORE AI",
          cancel_url: cancelUrl,
          landing_page: "BILLING",
          return_url: returnUrl,
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW"
        },
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: amount
            },
            custom_id: orderReference,
            description: `SHASTORE AI ${input.accountRole} ${plan.name} platform subscription`,
            invoice_id: orderReference
          }
        ]
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      method: "POST"
    });
    const data = (await response.json().catch(() => null)) as PayPalApiOrderResponse | { message?: string } | null;

    if (!response.ok) {
      console.error("[paypal-platform] checkout order create failed", {
        message: data && "message" in data ? data.message : response.statusText,
        planId: input.plan,
        status: response.status,
        userId: input.userId
      });
      return {
        code: "checkout_failed",
        message: "Could not start PayPal checkout. Verify platform PayPal configuration.",
        ok: false
      };
    }

    const url = data && "links" in data
      ? data.links?.find((link) => link.rel === "approve")?.href
      : null;

    if (!url) {
      return {
        code: "checkout_url_unavailable",
        message: "PayPal checkout was created without an approval URL.",
        ok: false
      };
    }

    await logPayPalBillingEvent({
      eventType: "paypal.checkout.created",
      outcome: "success",
      payload: {
        accountId: input.accountId ?? null,
        accountRole: input.accountRole,
        orderId: data && "id" in data ? data.id ?? null : null,
        orderReference,
        planId: input.plan,
        priceAmount: amount,
        priceCurrency: "USD",
        returnUrl
      },
      providerEventId: `checkout:${orderReference}`,
      userId: input.userId
    });

    return { ok: true, url };
  } catch (error) {
    console.error("[paypal-platform] checkout order create error", {
      message: error instanceof Error ? error.message : String(error),
      planId: input.plan,
      userId: input.userId
    });
    return {
      code: "checkout_failed",
      message: "Could not start PayPal checkout. Please try again.",
      ok: false
    };
  }
}

export async function verifyPayPalWebhookSignature(rawBody: string, request: Request) {
  const webhookId = paypalWebhookId();
  const accessToken = await getPayPalAccessToken();

  if (!webhookId || !accessToken) {
    console.error("[paypal_activation_failed]", {
      hasAccessToken: Boolean(accessToken),
      hasWebhookId: Boolean(webhookId),
      reason: "missing_paypal_webhook_config"
    });
    return false;
  }

  const webhookEvent = JSON.parse(rawBody) as PayPalWebhookEvent;
  const response = await fetch(`${paypalApiBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    body: JSON.stringify({
      auth_algo: request.headers.get("paypal-auth-algo"),
      cert_url: request.headers.get("paypal-cert-url"),
      transmission_id: request.headers.get("paypal-transmission-id"),
      transmission_sig: request.headers.get("paypal-transmission-sig"),
      transmission_time: request.headers.get("paypal-transmission-time"),
      webhook_event: webhookEvent,
      webhook_id: webhookId
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await response.json().catch(() => null)) as { verification_status?: string } | null;
  const verified = response.ok && data?.verification_status === "SUCCESS";

  if (!verified) {
    console.error("[paypal_activation_failed]", {
      reason: "webhook_signature_verification_failed",
      status: response.status,
      verificationStatus: data?.verification_status ?? null,
      webhookIdConfigured: Boolean(webhookId)
    });
  }

  return verified;
}

export async function syncPayPalPlatformWebhook(event: PayPalWebhookEvent) {
  const eventType = event.event_type ?? "paypal.event.unknown";
  const resource = event.resource;
  const eventId = event.id ?? `${eventType}:${Date.now()}`;

  console.info("[paypal_activation_event_type]", {
    eventId,
    eventType
  });

  if (eventType === "CHECKOUT.ORDER.APPROVED") {
    const orderId = resource?.id;

    if (!orderId) {
      console.error("[paypal_activation_failed]", {
        eventId,
        eventType,
        reason: "missing_order_id"
      });
      throw new Error("PayPal approved order event is missing resource.id.");
    }

    const capturedOrder = await captureApprovedOrder(orderId, event.id ?? null);
    const context = await resolvePlatformOrderContext({
      paypalOrderId: orderId,
      resource: capturedOrder ?? resource
    });

    const result = await activateFromOrderContext({
      context,
      eventId,
      eventType,
      source: "webhook"
    });

    await logPayPalBillingEvent({
      eventType,
      outcome: "success",
      payload: {
        captureId: context.captureId,
        orderId: context.orderId,
        orderReference: context.orderReference,
        planId: context.parsedOrder.planId,
        status: capturedOrder?.status ?? resource?.status ?? null
      },
      providerEventId: eventId,
      userId: context.parsedOrder.userId
    });

    return { activated: result.activated, reason: "order_approved" };
  }

  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    const context = await resolvePlatformOrderContext({
      paypalOrderId: resource?.supplementary_data?.related_ids?.order_id ?? null,
      resource
    });

    const result = await activateFromOrderContext({
      context,
      eventId,
      eventType,
      source: "webhook"
    });

    await logPayPalBillingEvent({
      eventType,
      outcome: "success",
      payload: {
        captureId: context.captureId,
        orderId: context.orderId,
        orderReference: context.orderReference,
        orderTimestamp: context.parsedOrder.orderTimestamp,
        planId: context.parsedOrder.planId,
        status: resource?.status ?? null
      },
      providerEventId: eventId,
      userId: context.parsedOrder.userId
    });

    return { activated: result.activated, reason: "payment_capture_completed" };
  }

  await logPayPalBillingEvent({
    eventType,
    outcome: "skipped",
    payload: {
      orderId: resource?.id ?? null,
      status: resource?.status ?? null
    },
    providerEventId: eventId,
    reason: "unsupported_paypal_event"
  });

  return { activated: false, reason: "unsupported_paypal_event" };
}
