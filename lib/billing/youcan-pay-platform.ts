import { getManagedBillingPlanForCheckout } from "@/lib/billing/managed-plans";
import type { SubscriptionPlanId } from "@/lib/billing/plans";
import { isPaidSubscriptionPlan } from "@/lib/billing/platform-checkout";

export type YouCanPayBillingMethod = "card" | "cashplus";

type CreateYouCanPayPlatformCheckoutInput = {
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
  token?: {
    id?: string;
  };
};

type YouCanPayErrorResponse = {
  errors?: unknown;
  message?: string;
};

const YOUCAN_PAY_PROVIDER = "youcan_pay";

function readEnv(key: string) {
  return process.env[key]?.trim() || null;
}

function youCanPayPrivateKey() {
  return (
    readEnv("YOUCAN_PAY_PRIVATE_KEY") ??
    readEnv("YOUCAN_PAY_SECRET_KEY") ??
    readEnv("YOUCAN_PAY_API_KEY")
  );
}

function youCanPayIsSandbox() {
  return readEnv("YOUCAN_PAY_ENVIRONMENT") !== "live";
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
  return `${youCanPayBaseUrl()}${youCanPayIsSandbox() ? "/sandbox" : ""}/api/tokenize/`;
}

function paymentFormUrl(tokenId: string) {
  return `${youCanPayBaseUrl()}${youCanPayIsSandbox() ? "/sandbox" : ""}/payment-form/${encodeURIComponent(tokenId)}?lang=en`;
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

  const privateKey = youCanPayPrivateKey();
  const successUrl = checkoutUrl("/dashboard/billing?billing=success&provider=youcan_pay");
  const errorUrl = checkoutUrl("/dashboard/billing?billing=cancelled&provider=youcan_pay");

  if (!privateKey || !successUrl || !errorUrl) {
    return {
      code: "missing_config",
      message: "YouCan Pay platform billing is not configured.",
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

  try {
    const response = await fetch(paymentTokenEndpoint(), {
      body: JSON.stringify({
        amount: amountInSmallestUnit(plan.priceCents),
        currency: "USD",
        customer_ip: "127.0.0.1",
        error_url: errorUrl,
        metadata: {
          method: input.method,
          plan_id: input.planId,
          provider: YOUCAN_PAY_PROVIDER,
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

    const tokenId = data?.token?.id ?? data?.id ?? null;
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
