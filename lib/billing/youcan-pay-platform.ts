import crypto from "crypto";
import { getManagedBillingPlanForCheckout } from "@/lib/billing/managed-plans";
import { getBillingPlan, type SubscriptionPlanId } from "@/lib/billing/plans";
import { isPaidSubscriptionPlan } from "@/lib/billing/platform-checkout";
import { createAdminClient } from "@/lib/supabase/admin";

export type YouCanPayBillingMethod = "card" | "cashplus";

type CreateYouCanPayPlatformCheckoutInput = {
  customerIp?: string | null;
  method: YouCanPayBillingMethod;
  planId: SubscriptionPlanId;
  userId: string;
  workspaceId: string;
};

export type YouCanPayPlatformCheckoutResult =
  | { ok: true; url: string }
  | {
      code: "checkout_failed" | "invalid_method" | "invalid_plan" | "missing_config";
      message: string;
      ok: false;
    };

type YouCanPayTokenResponse = {
  id?: string;
  paymentURL?: string;
  paymentUrl?: string;
  payment_url?: string;
  tokenId?: string;
  token?: {
    id?: string;
  };
};

type YouCanPayErrorResponse = {
  errors?: unknown;
  message?: string;
};

export type YouCanPayWebhookPayload = {
  event?: {
    name?: string | null;
  };
  event_name?: string | null;
  id?: string | null;
  payload?: {
    customer?: {
      email?: string | null;
      id?: string | null;
    } | null;
    metadata?: Record<string, unknown> | null;
    payment_method?: {
      name?: string | null;
    } | null;
    transaction?: YouCanPayTransaction | null;
  } | null;
};

type YouCanPayTransaction = {
  amount?: number | string | null;
  currency?: string | null;
  id?: string | null;
  order_id?: string | null;
  status?: number | string | null;
};

type ParsedYouCanPayOrderId = {
  method: YouCanPayBillingMethod | null;
  planId: SubscriptionPlanId | null;
  userId: string | null;
};

const YOUCAN_PAY_PROVIDER = "youcan_pay";
const YOUCAN_PAY_NOT_CONFIGURED_MESSAGE = "Moroccan payment methods are not configured";

function readEnv(key: string) {
  return process.env[key]?.trim() || null;
}

function youCanPayPublicKey() {
  return readEnv("YOUCANPAY_PUBLIC_KEY");
}

function youCanPayPrivateKey() {
  return readEnv("YOUCANPAY_PRIVATE_KEY");
}

function youCanPayIsSandbox() {
  return readEnv("YOUCANPAY_SANDBOX") !== "false";
}

function youCanPayBaseUrl() {
  return "https://youcanpay.com";
}

function appBaseUrl() {
  const baseUrl = readEnv("NEXT_PUBLIC_APP_URL");

  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/+$/, "");
}

function checkoutUrl(path: string) {
  const baseUrl = appBaseUrl();

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}${path}`;
}

function paymentTokenEndpoint() {
  return `${youCanPayBaseUrl()}${youCanPayIsSandbox() ? "/sandbox" : ""}/api/tokenize`;
}

function paymentFormUrl(tokenId: string) {
  return `${youCanPayBaseUrl()}${youCanPayIsSandbox() ? "/sandbox" : ""}/payment-form/${encodeURIComponent(tokenId)}`;
}

function normalizeMethod(value: string): YouCanPayBillingMethod | null {
  return value === "card" || value === "cashplus" ? value : null;
}

function orderId(input: CreateYouCanPayPlatformCheckoutInput) {
  return [
    "platform_subscription",
    YOUCAN_PAY_PROVIDER,
    input.method,
    input.planId,
    input.userId,
    Date.now().toString()
  ].join(":");
}

function amountInSmallestUnit(priceCents: number) {
  return Math.max(0, Math.round(priceCents));
}

function parseOrderId(value?: string | null): ParsedYouCanPayOrderId {
  const [prefix, provider, method, planId, userId] = (value ?? "").split(":");

  if (prefix !== "platform_subscription" || provider !== YOUCAN_PAY_PROVIDER) {
    return {
      method: null,
      planId: null,
      userId: null
    };
  }

  return {
    method: normalizeMethod(method),
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

function numberStatus(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function eventName(payload: YouCanPayWebhookPayload) {
  return payload.event_name ?? payload.event?.name ?? "youcan.event.unknown";
}

function transactionStatusKind(payload: YouCanPayWebhookPayload) {
  const name = eventName(payload).toLowerCase();
  const status = numberStatus(payload.payload?.transaction?.status);
  const textStatus = stringValue(payload.payload?.transaction?.status)?.toLowerCase() ?? "";

  if (name.includes("refund") || textStatus.includes("refund")) {
    return "refunded" as const;
  }

  if (name.includes("paid") || status === 1 || textStatus === "paid" || textStatus === "success") {
    return "paid" as const;
  }

  if (
    name.includes("fail") ||
    name.includes("cancel") ||
    textStatus.includes("fail") ||
    textStatus.includes("cancel") ||
    status === 0
  ) {
    return "failed" as const;
  }

  return "unsupported" as const;
}

function metadata(payload: YouCanPayWebhookPayload) {
  return payload.payload?.metadata && typeof payload.payload.metadata === "object"
    ? payload.payload.metadata
    : {};
}

function webhookContext(payload: YouCanPayWebhookPayload) {
  const tx = payload.payload?.transaction ?? null;
  const meta = metadata(payload);
  const orderId = tx?.order_id ?? stringValue(meta.order_id);
  const parsed = parseOrderId(orderId);
  const planIdFromMetadata = stringValue(meta.plan_id);
  const methodFromMetadata = stringValue(meta.payment_method ?? meta.method);

  return {
    amount: tx?.amount ?? null,
    currency: tx?.currency ?? null,
    customerId: payload.payload?.customer?.id ?? payload.payload?.customer?.email ?? null,
    method: methodFromMetadata ? normalizeMethod(methodFromMetadata) : parsed.method,
    orderId,
    planId:
      planIdFromMetadata && isPaidSubscriptionPlan(planIdFromMetadata)
        ? planIdFromMetadata
        : parsed.planId,
    transactionId: tx?.id ?? payload.id ?? null,
    userId: stringValue(meta.user_id) ?? parsed.userId,
    workspaceId: stringValue(meta.workspace_id)
  };
}

async function logYouCanPayBillingEvent(input: {
  eventType: string;
  outcome: "failed" | "skipped" | "success";
  payload: Record<string, unknown>;
  providerEventId: string;
  reason?: string | null;
  userId?: string | null;
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    console.warn("[youcan-pay] billing event log skipped without service client", {
      eventType: input.eventType,
      providerEventId: input.providerEventId
    });
    return;
  }

  const { error } = await supabase.from("billing_events" as never).upsert({
    event_type: input.eventType,
    provider: YOUCAN_PAY_PROVIDER,
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
      console.warn("[youcan-pay] billing event log skipped because table is unavailable", {
        eventType: input.eventType,
        providerEventId: input.providerEventId
      });
      return;
    }

    console.warn("[youcan-pay] billing event log failed", {
      eventType: input.eventType,
      message: error.message,
      providerEventId: input.providerEventId
    });
  }
}

async function activateYouCanPaySubscription(input: {
  customerId?: string | null;
  method: YouCanPayBillingMethod;
  orderId?: string | null;
  planId: SubscriptionPlanId;
  transactionId: string;
  userId: string;
  workspaceId?: string | null;
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for YouCan Pay billing sync.");
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
        billingScope: "platform",
        paymentMethod: input.method,
        provider: YOUCAN_PAY_PROVIDER,
        syncedAt: now.toISOString(),
        transactionId: input.transactionId,
        workspaceId: input.workspaceId ?? null
      }
    },
    plan_key: plan.id,
    plan_id: plan.id,
    provider: YOUCAN_PAY_PROVIDER,
    provider_customer_id: input.customerId ?? null,
    provider_subscription_id: input.transactionId,
    status: "active",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    updated_at: now.toISOString(),
    user_id: input.userId
  } as never, { onConflict: "user_id" });

  if (error) {
    console.error("youcan activation failed", {
      message: error.message,
      method: input.method,
      orderId: input.orderId ?? null,
      planId: input.planId,
      transactionId: input.transactionId,
      userId: input.userId
    });
    throw error;
  }

  console.info("youcan activation completed", {
    method: input.method,
    orderId: input.orderId ?? null,
    planId: input.planId,
    transactionId: input.transactionId,
    userId: input.userId
  });
}

export function normalizeYouCanPayBillingMethod(value: string | null | undefined) {
  return typeof value === "string" ? normalizeMethod(value) : null;
}

export async function createYouCanPayPlatformCheckout(
  input: CreateYouCanPayPlatformCheckoutInput
): Promise<YouCanPayPlatformCheckoutResult> {
  if (!isPaidSubscriptionPlan(input.planId)) {
    return {
      code: "invalid_plan",
      message: "Choose Starter, Pro, or Agency.",
      ok: false
    };
  }

  if (!normalizeMethod(input.method)) {
    return {
      code: "invalid_method",
      message: "Choose Credit Card (Morocco) or Cash Plus.",
      ok: false
    };
  }

  const publicKey = youCanPayPublicKey();
  const privateKey = youCanPayPrivateKey();
  const successUrl = checkoutUrl("/dashboard/billing?billing=success&provider=youcan_pay");
  const errorUrl = checkoutUrl("/dashboard/billing?billing=cancelled&provider=youcan_pay");

  if (!publicKey || !privateKey || !successUrl || !errorUrl) {
    console.error("youcan checkout failed", {
      hasAppUrl: Boolean(appBaseUrl()),
      hasPrivateKey: Boolean(privateKey),
      hasPublicKey: Boolean(publicKey),
      method: input.method,
      planId: input.planId,
      provider: YOUCAN_PAY_PROVIDER,
      reason: "missing_config",
      userId: input.userId,
      workspaceId: input.workspaceId
    });
    return {
      code: "missing_config",
      message: YOUCAN_PAY_NOT_CONFIGURED_MESSAGE,
      ok: false
    };
  }

  const plan = await getManagedBillingPlanForCheckout(input.planId);

  if (!plan.active) {
    return {
      code: "invalid_plan",
      message: `${plan.name} is not available for checkout.`,
      ok: false
    };
  }

  const providerOrderId = orderId(input);
  const customerIp = input.customerIp?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    const response = await fetch(paymentTokenEndpoint(), {
      body: JSON.stringify({
        amount: amountInSmallestUnit(plan.priceCents),
        currency: "USD",
        customer_ip: customerIp,
        error_url: errorUrl,
        metadata: {
          method: input.method,
          plan_id: input.planId,
          provider: YOUCAN_PAY_PROVIDER,
          public_key: publicKey,
          user_id: input.userId,
          workspace_id: input.workspaceId
        },
        method: input.method,
        order_id: providerOrderId,
        plan_id: input.planId,
        pri_key: privateKey,
        provider: YOUCAN_PAY_PROVIDER,
        success_url: successUrl,
        user_id: input.userId,
        workspace_id: input.workspaceId
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const data = (await response.json().catch(() => null)) as
      | (YouCanPayTokenResponse & YouCanPayErrorResponse)
      | null;

    if (!response.ok) {
      console.error("youcan checkout failed", {
        errors: data?.errors ?? null,
        message: data?.message ?? response.statusText,
        method: input.method,
        planId: input.planId,
        status: response.status,
        userId: input.userId,
        workspaceId: input.workspaceId
      });
      return {
        code: "checkout_failed",
        message: "Could not start YouCan Pay checkout. Verify platform YouCan Pay configuration.",
        ok: false
      };
    }

    const tokenId = data?.token?.id ?? data?.tokenId ?? data?.id ?? null;
    const url =
      data?.payment_url ??
      data?.paymentUrl ??
      data?.paymentURL ??
      (tokenId ? paymentFormUrl(tokenId) : null);

    if (!url) {
      console.error("youcan checkout failed", {
        method: input.method,
        planId: input.planId,
        reason: "missing_payment_url",
        userId: input.userId,
        workspaceId: input.workspaceId
      });
      return {
        code: "checkout_failed",
        message: "YouCan Pay checkout did not return a payment URL.",
        ok: false
      };
    }

    console.info("youcan checkout created", {
      method: input.method,
      orderId: providerOrderId,
      planId: input.planId,
      provider: YOUCAN_PAY_PROVIDER,
      userId: input.userId,
      workspaceId: input.workspaceId
    });

    return { ok: true, url };
  } catch (error) {
    console.error("youcan checkout failed", {
      message: error instanceof Error ? error.message : String(error),
      method: input.method,
      planId: input.planId,
      userId: input.userId,
      workspaceId: input.workspaceId
    });
    return {
      code: "checkout_failed",
      message: "Could not start YouCan Pay checkout. Please try again.",
      ok: false
    };
  }
}

export function verifyYouCanPayWebhookSignature(rawBody: string, signature: string | null) {
  const privateKey = youCanPayPrivateKey();

  if (!privateKey || !signature) {
    return false;
  }

  const expected = crypto.createHmac("sha256", privateKey).update(rawBody).digest("hex");

  if (expected.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function syncYouCanPayPlatformWebhook(payload: YouCanPayWebhookPayload) {
  const kind = transactionStatusKind(payload);
  const context = webhookContext(payload);
  const providerEventId =
    payload.id ??
    context.transactionId ??
    context.orderId ??
    `youcan:${Date.now()}`;
  const eventType = eventName(payload);

  if (kind === "paid") {
    console.info("youcan payment paid", {
      eventType,
      method: context.method,
      orderId: context.orderId,
      planId: context.planId,
      transactionId: context.transactionId,
      userId: context.userId
    });

    if (!context.userId || !context.planId || !context.method || !context.transactionId) {
      console.error("youcan activation failed", {
        eventType,
        orderId: context.orderId,
        reason: "missing_activation_context",
        transactionId: context.transactionId
      });
      await logYouCanPayBillingEvent({
        eventType,
        outcome: "failed",
        payload: {
          context,
          kind
        },
        providerEventId,
        reason: "missing_activation_context",
        userId: context.userId
      });
      throw new Error("YouCan Pay webhook is missing activation context.");
    }

    await activateYouCanPaySubscription({
      customerId: context.customerId,
      method: context.method,
      orderId: context.orderId,
      planId: context.planId,
      transactionId: context.transactionId,
      userId: context.userId,
      workspaceId: context.workspaceId
    });

    await logYouCanPayBillingEvent({
      eventType,
      outcome: "success",
      payload: {
        amount: context.amount,
        currency: context.currency,
        method: context.method,
        orderId: context.orderId,
        planId: context.planId,
        transactionId: context.transactionId,
        workspaceId: context.workspaceId
      },
      providerEventId,
      userId: context.userId
    });

    return { activated: true, reason: "payment_paid" };
  }

  if (kind === "failed" || kind === "refunded") {
    await logYouCanPayBillingEvent({
      eventType,
      outcome: kind === "failed" ? "failed" : "skipped",
      payload: {
        amount: context.amount,
        currency: context.currency,
        kind,
        method: context.method,
        orderId: context.orderId,
        planId: context.planId,
        transactionId: context.transactionId,
        workspaceId: context.workspaceId
      },
      providerEventId,
      reason: kind,
      userId: context.userId
    });

    return { activated: false, reason: `payment_${kind}` };
  }

  await logYouCanPayBillingEvent({
    eventType,
    outcome: "skipped",
    payload: {
      kind,
      orderId: context.orderId,
      transactionId: context.transactionId
    },
    providerEventId,
    reason: "unsupported_youcan_event",
    userId: context.userId
  });

  return { activated: false, reason: "unsupported_youcan_event" };
}
