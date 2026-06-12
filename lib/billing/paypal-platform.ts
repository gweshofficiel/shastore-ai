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

function stringValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
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
    resource?.id ??
    resource?.purchase_units
      ?.flatMap((unit) => unit.payments?.captures ?? [])
      .find((capture) => capture.id)?.id ??
    null
  );
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
    console.error("[paypal-platform] user subscription upsert failed", {
      captureId: input.captureId ?? null,
      message: error.message,
      orderId: input.orderId ?? null,
      planId: input.planId,
      userId: input.userId
    });
    throw error;
  }

  console.info("[paypal-platform] user subscription upserted", {
    captureId: input.captureId ?? null,
    orderId: input.orderId ?? null,
    planId: input.planId,
    provider: PAYPAL_PROVIDER,
    userId: input.userId
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
          return_url: successUrl,
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
        priceCurrency: "USD"
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

  return response.ok && data?.verification_status === "SUCCESS";
}

async function captureApprovedOrder(resource: PayPalResource, eventId: string | null) {
  const orderId = resource.id;

  if (!orderId) {
    throw new Error("PayPal approved order event is missing resource.id.");
  }

  const accessToken = await getPayPalAccessToken();

  if (!accessToken) {
    throw new Error("Could not authenticate PayPal capture request.");
  }

  const response = await fetch(`${paypalApiBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": eventId ?? orderId
    },
    method: "POST"
  });
  const data = (await response.json().catch(() => null)) as PayPalResource | { message?: string } | null;

  if (!response.ok) {
    console.error("[paypal-platform] order capture failed", {
      message: data && "message" in data ? data.message : response.statusText,
      orderId,
      status: response.status
    });
    throw new Error("PayPal order capture failed.");
  }

  return data as PayPalResource | null;
}

export async function syncPayPalPlatformWebhook(event: PayPalWebhookEvent) {
  const eventType = event.event_type ?? "paypal.event.unknown";
  const resource = event.resource;
  const eventId = event.id ?? `${eventType}:${Date.now()}`;
  const orderReference = platformOrderIdFromResource(resource);
  const parsedOrder = parsePlatformOrderId(orderReference);

  if (eventType === "CHECKOUT.ORDER.APPROVED") {
    await logPayPalBillingEvent({
      eventType,
      outcome: "success",
      payload: {
        orderId: resource?.id ?? null,
        orderReference,
        orderTimestamp: parsedOrder.orderTimestamp,
        planId: parsedOrder.planId
      },
      providerEventId: eventId,
      userId: parsedOrder.userId
    });

    const capturedOrder = await captureApprovedOrder(resource ?? {}, event.id ?? null);
    const captureId = captureIdFromResource(capturedOrder ?? undefined) ?? captureIdFromResource(resource);

    if (parsedOrder.userId && parsedOrder.planId && captureId) {
      await upsertPayPalSubscription({
        accountRole: parsedOrder.accountRole,
        captureId,
        orderId: resource?.id ?? null,
        payerId: payerIdFromResource(capturedOrder ?? undefined) ?? payerIdFromResource(resource),
        planId: parsedOrder.planId,
        userId: parsedOrder.userId
      });
    }

    return { activated: Boolean(parsedOrder.userId && parsedOrder.planId && captureId), reason: "order_approved" };
  }

  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = resource?.supplementary_data?.related_ids?.order_id ?? null;
    const captureId = captureIdFromResource(resource) ?? eventId;

    if (!parsedOrder.userId || !parsedOrder.planId) {
      await logPayPalBillingEvent({
        eventType,
        outcome: "failed",
        payload: {
          captureId,
          orderId,
          orderReference
        },
        providerEventId: eventId,
        reason: "invalid_platform_order_id"
      });
      throw new Error("Invalid PayPal platform billing order reference.");
    }

    await upsertPayPalSubscription({
      accountRole: parsedOrder.accountRole,
      captureId,
      orderId,
      payerId: payerIdFromResource(resource),
      planId: parsedOrder.planId,
      userId: parsedOrder.userId
    });

    await logPayPalBillingEvent({
      eventType,
      outcome: "success",
      payload: {
        captureId,
        orderId,
        orderReference,
        orderTimestamp: parsedOrder.orderTimestamp,
        planId: parsedOrder.planId,
        status: resource?.status ?? null
      },
      providerEventId: eventId,
      userId: parsedOrder.userId
    });

    return { activated: true, reason: "payment_capture_completed" };
  }

  await logPayPalBillingEvent({
    eventType,
    outcome: "skipped",
    payload: {
      orderId: resource?.id ?? null,
      orderReference,
      status: resource?.status ?? null
    },
    providerEventId: eventId,
    reason: "unsupported_paypal_event",
    userId: parsedOrder.userId
  });

  return { activated: false, reason: "unsupported_paypal_event" };
}
