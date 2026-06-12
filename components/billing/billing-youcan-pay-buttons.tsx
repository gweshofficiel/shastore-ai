"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { youCanPayCustomerBranding } from "@/lib/commerce/youcan-pay-branding";
import type { SubscriptionPlanId } from "@/lib/billing/plans";

type BillingYouCanPayButtonsProps = {
  planId: SubscriptionPlanId;
};

const provider = "youcan_pay" as const;
const methodByLabel = {
  "Cash Plus": "cashplus",
  "Credit Card (Morocco)": "card"
} as const;

type YouCanCheckoutJsonResponse = {
  code?: string;
  error?: string;
  message?: string;
  ok?: boolean;
  url?: string;
};

export function BillingYouCanPayButtons({ planId }: BillingYouCanPayButtonsProps) {
  const [error, setError] = useState<string | null>(null);
  const [pendingMethod, setPendingMethod] = useState<string | null>(null);

  async function handleClick(methodLabel: keyof typeof methodByLabel) {
    const method = methodByLabel[methodLabel];

    console.info("youcan method selected", {
      method,
      methodLabel,
      planId,
      provider
    });
    setPendingMethod(method);
    setError(null);

    try {
      console.info("youcan checkout started", {
        method,
        planId,
        provider
      });

      const response = await fetch("/api/billing/checkout/youcan-pay", {
        body: JSON.stringify({
          method,
          plan_id: planId,
          provider
        }),
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as YouCanCheckoutJsonResponse | null;

      if (response.ok && payload?.ok && payload.url) {
        console.info("youcan checkout created", {
          method,
          planId,
          provider,
          url: payload.url
        });
        window.location.href = payload.url;
        return;
      }

      const failureMessage =
        payload?.error ??
        payload?.message ??
        "YouCan Pay checkout could not be started. Please try again.";

      console.error("youcan checkout failed", {
        code: payload?.code ?? null,
        message: failureMessage,
        method,
        planId,
        provider,
        status: response.status
      });
      setError(failureMessage);
    } catch (caughtError) {
      console.error("youcan checkout failed", {
        message: caughtError instanceof Error ? caughtError.message : String(caughtError),
        method,
        planId,
        provider
      });
      setError("YouCan Pay checkout could not be started. Please try again.");
    } finally {
      setPendingMethod(null);
    }
  }

  return (
    <div className="rounded-3xl border border-orange-200 bg-orange-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-800">
          Moroccan payment methods
        </p>
        <span className="rounded-full border border-orange-200 bg-white px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-orange-700">
          {youCanPayCustomerBranding.badge}
        </span>
      </div>
      <div className="grid gap-2">
        {youCanPayCustomerBranding.methods.map((method) => (
          <Button
            className="w-full border-orange-200 bg-white text-orange-900 hover:border-orange-300 hover:bg-orange-100"
            disabled={Boolean(pendingMethod)}
            key={method.label}
            onClick={() => handleClick(method.label)}
            type="button"
            variant="secondary"
          >
            {pendingMethod === methodByLabel[method.label] ? "Starting checkout..." : method.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="mt-3 text-xs font-bold leading-5 text-red-700" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-xs font-semibold leading-5 text-orange-900">
          {youCanPayCustomerBranding.description}
        </p>
      )}
    </div>
  );
}
