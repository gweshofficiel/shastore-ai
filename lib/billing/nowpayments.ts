import crypto from "crypto";
import { getManagedBillingPlanForCheckout } from "@/lib/billing/managed-plans";
import { getBillingPlan, type SubscriptionPlanId } from "@/lib/billing/plans";
import {
  isPaidSubscriptionPlan,
  type PlatformBillingAccountRole
} from "@/lib/billing/platform-checkout";
import { createAdminClient } from "@/lib/supabase/admin";

type NowPaymentsCheckoutInput = {
  accountId?: string | null;
  accountRole: PlatformBillingAccountRole;
  customerEmail?: string | null;
  plan: SubscriptionPlanId;
  userId: string;
};

export type NowPaymentsCheckoutResult =
  | { ok: true; url: string }
  | {
      code: "checkout_failed" | "checkout_url_unavailable" | "invalid_plan" | "missing_config";
      message: string;
      ok: false;
    };

type NowPaymentsPaymentPayload = {
  actually_paid?: number | string | null;
  invoice_id?: number | string | null;
  order_id?: string | null;
  outcome_amount?: number | string | null;
  pay_amount?: number | string | null;
  pay_currency?: string | null;
  payment_id?: number | string | null;
  payment_status?: string | null;
  price_amount?: number | string | null;
  price_currency?: string | null;
};

type ParsedPlatformOrderId = {
  accountId: string | null;
  accountRole: PlatformBillingAccountRole;
  orderTimestamp: string | null;
  planId: SubscriptionPlanId | null;
  userId: string | null;
};

const NOWPAYMENTS_API_BASE_URL = "https://api.nowpayments.io/v1";
const PLATFORM_ORDER_PREFIX = "platform_subscription";

function readEnv(key: string) {
  return process.env[key]?.trim() || null;
}

function appBaseUrl() {
  const baseUrl = readEnv("NEXT_PUBLIC_APP_URL");

  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/+$/, "");
}

function nowPaymentsApiKey() {
  return readEnv("NOWPAYMENTS_API_KEY");
}

function nowPaymentsIpnSecret() {
  return readEnv("NOWPAYMENTS_IPN_SECRET");
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

function nowPaymentsOrderId(input: NowPaymentsCheckoutInput) {
  return [
    PLATFORM_ORDER_PREFIX,
    input.accountRole,
    input.plan,
    input.userId,
    Date.now().toString()
  ].join(":");
}

function parsePlatformOrderId(orderId?: string | null): ParsedPlatformOrderId {
  const [prefix, role, planId, userId, fifthPart, sixthPart] = (orderId ?? "").split(":");

  if (prefix !== PLATFORM_ORDER_PREFIX) {
    return {
      accountId: null,
      accountRole: "owner",
      orderTimestamp: null,
      planId: null,
      userId: null
    };
  }

  const hasLegacyAccountId = Boolean(sixthPart);

  return {
    accountId: hasLegacyAccountId && fifthPart !== "none" ? fifthPart : null,
    accountRole: role === "reseller" ? "reseller" : "owner",
    orderTimestamp: hasLegacyAccountId ? sixthPart || null : fifthPart || null,
    planId: planId && isPaidSubscriptionPlan(planId) ? planId : null,
    userId: userId || null
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function safeCompareSignature(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
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

function confirmedNowPaymentsStatus(status?: string | null) {
  return status === "confirmed" || status === "finished";
}

async function logNowPaymentsBillingEvent(input: {
  eventType: string;
  outcome: "failed" | "skipped" | "success";
  payload: Record<string, unknown>;
  providerEventId: string;
  reason?: string | null;
  userId?: string | null;
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    console.warn("[nowpayments-platform] billing event log skipped without service client", {
      eventType: input.eventType,
      providerEventId: input.providerEventId
    });
    return;
  }

  const { error } = await supabase.from("billing_events" as never).upsert({
    event_type: input.eventType,
    provider: "nowpayments",
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
      console.warn("[nowpayments-platform] billing event log skipped because table is unavailable", {
        eventType: input.eventType,
        providerEventId: input.providerEventId
      });
      return;
    }

    console.warn("[nowpayments-platform] billing event log failed", {
      eventType: input.eventType,
      message: error.message,
      providerEventId: input.providerEventId
    });
  }
}

async function upsertNowPaymentsSubscription(input: {
  accountId?: string | null;
  accountRole: PlatformBillingAccountRole;
  nowPaymentsInvoiceId?: string | null;
  nowPaymentsPaymentId: string;
  payCurrency?: string | null;
  planId: SubscriptionPlanId;
  userId: string;
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for NOWPayments billing sync.");
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
        accountId: input.accountId ?? null,
        accountRole: input.accountRole,
        billingScope: "platform",
        nowPaymentsInvoiceId: input.nowPaymentsInvoiceId ?? null,
        nowPaymentsPaymentId: input.nowPaymentsPaymentId,
        payCurrency: input.payCurrency ?? null,
        provider: "nowpayments",
        syncedAt: now.toISOString()
      }
    },
    plan_key: plan.id,
    plan_id: plan.id,
    provider: "nowpayments",
    nowpayments_invoice_id: input.nowPaymentsInvoiceId ?? null,
    nowpayments_payment_id: input.nowPaymentsPaymentId,
    status: "active",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    updated_at: now.toISOString(),
    user_id: input.userId
  } as never, { onConflict: "user_id" });

  if (error) {
    console.error("[nowpayments_plan_activation_failed]", {
      message: error.message,
      nowPaymentsPaymentId: input.nowPaymentsPaymentId,
      planId: input.planId,
      userId: input.userId
    });
    throw error;
  }

  console.info("[nowpayments_user_subscription_upsert_success]", {
    nowPaymentsPaymentId: input.nowPaymentsPaymentId,
    planId: input.planId,
    provider: "nowpayments",
    userId: input.userId
  });
}

export async function createNowPaymentsPlatformCheckout(
  input: NowPaymentsCheckoutInput
): Promise<NowPaymentsCheckoutResult> {
  const apiKey = nowPaymentsApiKey();
  const baseUrl = appBaseUrl();

  if (!apiKey || !nowPaymentsIpnSecret() || !baseUrl) {
    return {
      code: "missing_config",
      message: "NOWPayments platform billing is not configured.",
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
    provider: "nowpayments"
  });
  const cancelUrl = platformBillingUrl(input.accountRole, {
    billing: "cancelled",
    provider: "nowpayments"
  });

  if (!successUrl || !cancelUrl) {
    return {
      code: "missing_config",
      message: "NEXT_PUBLIC_APP_URL is required for NOWPayments checkout.",
      ok: false
    };
  }

  const orderId = nowPaymentsOrderId(input);
  const payload = {
    cancel_url: cancelUrl,
    ipn_callback_url: `${baseUrl}/api/nowpayments/ipn`,
    order_description: `SHASTORE AI ${input.accountRole} ${plan.name} platform subscription`,
    order_id: orderId,
    price_amount: plan.priceCents / 100,
    price_currency: "usd",
    success_url: successUrl
  };

  try {
    const response = await fetch(`${NOWPAYMENTS_API_BASE_URL}/invoice`, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      method: "POST"
    });
    const data = (await response.json().catch(() => null)) as
      | { id?: string | number; invoice_url?: string; payment_url?: string }
      | { message?: string }
      | null;

    if (!response.ok) {
      console.error("[nowpayments-platform] checkout create failed", {
        message: data && "message" in data ? data.message : response.statusText,
        planId: input.plan,
        status: response.status,
        userId: input.userId
      });
      return {
        code: "checkout_failed",
        message: "Could not start NOWPayments checkout. Verify platform NOWPayments configuration.",
        ok: false
      };
    }

    const url = data && "invoice_url" in data ? data.invoice_url ?? data.payment_url : null;

    if (!url) {
      return {
        code: "checkout_url_unavailable",
        message: "NOWPayments checkout was created without a redirect URL.",
        ok: false
      };
    }

    await logNowPaymentsBillingEvent({
      eventType: "nowpayments.checkout.created",
      outcome: "success",
      payload: {
        accountId: input.accountId ?? null,
        accountRole: input.accountRole,
        invoiceId: data && "id" in data ? data.id ?? null : null,
        orderId,
        planId: input.plan,
        priceAmount: plan.priceCents / 100,
        priceCurrency: "usd"
      },
      providerEventId: `checkout:${orderId}`,
      userId: input.userId
    });

    return { ok: true, url };
  } catch (error) {
    console.error("[nowpayments-platform] checkout create error", {
      message: error instanceof Error ? error.message : String(error),
      planId: input.plan,
      userId: input.userId
    });
    return {
      code: "checkout_failed",
      message: "Could not start NOWPayments checkout. Please try again.",
      ok: false
    };
  }
}

export function verifyNowPaymentsIpnSignature(rawBody: string, signature: string | null) {
  const secret = nowPaymentsIpnSecret();

  if (!secret || !signature) {
    return false;
  }

  try {
    const payload = JSON.parse(rawBody) as unknown;
    const expected = crypto
      .createHmac("sha512", secret)
      .update(stableStringify(payload))
      .digest("hex");

    return safeCompareSignature(expected, signature);
  } catch {
    return false;
  }
}

export async function syncNowPaymentsPlatformPayment(payload: NowPaymentsPaymentPayload) {
  const providerEventId =
    stringValue(payload.payment_id) ??
    stringValue(payload.invoice_id) ??
    payload.order_id ??
    `nowpayments:${Date.now()}`;
  const parsedOrder = parsePlatformOrderId(payload.order_id);
  const paymentStatus = payload.payment_status ?? null;

  if (!confirmedNowPaymentsStatus(paymentStatus)) {
    await logNowPaymentsBillingEvent({
      eventType: `nowpayments.payment.${paymentStatus ?? "unknown"}`,
      outcome: "skipped",
      payload: {
        orderId: payload.order_id ?? null,
        paymentStatus
      },
      providerEventId,
      reason: "payment_not_confirmed",
      userId: parsedOrder.userId
    });
    return { activated: false, reason: "payment_not_confirmed" };
  }

  if (!parsedOrder.userId || !parsedOrder.planId) {
    console.error("[nowpayments_plan_activation_failed]", {
      orderId: payload.order_id ?? null,
      paymentStatus,
      reason: "invalid_platform_order_id"
    });
    await logNowPaymentsBillingEvent({
      eventType: "nowpayments.payment.confirmed",
      outcome: "failed",
      payload: {
        orderId: payload.order_id ?? null,
        paymentStatus
      },
      providerEventId,
      reason: "invalid_platform_order_id"
    });
    throw new Error("Invalid NOWPayments platform billing order_id.");
  }

  console.info("[nowpayments_plan_activation_started]", {
    nowPaymentsInvoiceId: stringValue(payload.invoice_id),
    nowPaymentsPaymentId: providerEventId,
    orderId: payload.order_id ?? null,
    paymentStatus,
    planId: parsedOrder.planId,
    userId: parsedOrder.userId
  });

  await upsertNowPaymentsSubscription({
    accountId: parsedOrder.accountId,
    accountRole: parsedOrder.accountRole,
    nowPaymentsInvoiceId: stringValue(payload.invoice_id),
    nowPaymentsPaymentId: providerEventId,
    payCurrency: payload.pay_currency ?? null,
    planId: parsedOrder.planId,
    userId: parsedOrder.userId
  });

  await logNowPaymentsBillingEvent({
    eventType: "nowpayments.payment.confirmed",
    outcome: "success",
    payload: {
      actuallyPaid: payload.actually_paid ?? null,
      invoiceId: payload.invoice_id ?? null,
      orderTimestamp: parsedOrder.orderTimestamp,
      orderId: payload.order_id ?? null,
      payAmount: payload.pay_amount ?? null,
      payCurrency: payload.pay_currency ?? null,
      paymentStatus,
      planId: parsedOrder.planId,
      priceAmount: payload.price_amount ?? null,
      priceCurrency: payload.price_currency ?? null
    },
    providerEventId,
    userId: parsedOrder.userId
  });

  return { activated: true, reason: "payment_confirmed" };
}
