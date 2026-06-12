"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SubscriptionPlanId } from "@/lib/billing/plans";

type BillingPlanChangeFormProps = {
  className?: string;
  label: string;
  planId: SubscriptionPlanId;
  variant?: "primary" | "secondary";
};

type ChangePlanJsonResponse = {
  code?: string;
  error?: string;
  message?: string;
  ok?: boolean;
  url?: string;
};

export function BillingPlanChangeForm({
  className,
  label,
  planId,
  variant = "primary"
}: BillingPlanChangeFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/change-plan", {
        body: JSON.stringify({ plan: planId }),
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      const payload = (await response.json().catch(() => null)) as ChangePlanJsonResponse | null;

      if (response.ok && payload?.ok && typeof payload.url === "string" && payload.url) {
        window.location.href = payload.url;
        return;
      }

      if (response.ok && payload?.ok && payload.message) {
        const params = new URLSearchParams({
          billing: "plan_change_pending",
          message: payload.message,
          ...(payload.code ? { reason: payload.code } : {})
        });
        window.location.href = `/dashboard/billing?${params.toString()}`;
        return;
      }

      setError(
        payload?.error ??
          payload?.message ??
          "Checkout could not be started. Verify platform billing Stripe price IDs and try again."
      );
    } catch {
      setError("Checkout could not be started. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      {error ? (
        <p className="mb-3 text-sm font-bold leading-6 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit" variant={variant}>
        {pending ? "Starting checkout..." : label}
      </Button>
    </form>
  );
}
