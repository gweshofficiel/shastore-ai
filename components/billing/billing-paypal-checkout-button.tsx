"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SubscriptionPlanId } from "@/lib/billing/plans";

type BillingPayPalCheckoutButtonProps = {
  className?: string;
  planId: SubscriptionPlanId;
};

type PayPalCheckoutJsonResponse = {
  code?: string;
  error?: string;
  message?: string;
  ok?: boolean;
  url?: string;
};

export function BillingPayPalCheckoutButton({
  className,
  planId
}: BillingPayPalCheckoutButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    console.info("[paypal_checkout_button_clicked]", { planId });
    setPending(true);
    setError(null);

    try {
      console.info("[paypal_checkout_request_started]", { planId });

      const response = await fetch("/api/paypal/platform-billing/checkout", {
        body: JSON.stringify({ plan: planId }),
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      const payload = (await response.json().catch(() => null)) as PayPalCheckoutJsonResponse | null;
      const redirectUrl = payload?.url ?? null;

      if (response.ok && payload?.ok && redirectUrl) {
        console.info("[paypal_checkout_redirect_ready]", { planId, redirectUrl });
        window.location.href = redirectUrl;
        return;
      }

      const failureMessage =
        payload?.error ??
        payload?.message ??
        "PayPal checkout could not be started. Please try again.";

      console.error("[paypal_checkout_failed]", {
        code: payload?.code ?? null,
        message: failureMessage,
        planId,
        status: response.status
      });
      setError(failureMessage);
    } catch (caughtError) {
      console.error("[paypal_checkout_failed]", {
        message: caughtError instanceof Error ? caughtError.message : String(caughtError),
        planId
      });
      setError("PayPal checkout could not be started. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={className}>
      {error ? (
        <p className="mb-3 text-sm font-bold leading-6 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        className="w-full"
        disabled={pending}
        onClick={handleClick}
        type="button"
        variant="secondary"
      >
        {pending ? "Starting PayPal checkout..." : "Pay with PayPal"}
      </Button>
    </div>
  );
}
