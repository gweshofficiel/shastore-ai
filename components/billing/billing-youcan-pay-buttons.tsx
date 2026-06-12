"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { youCanPayCustomerBranding } from "@/lib/commerce/youcan-pay-branding";
import type { SubscriptionPlanId } from "@/lib/billing/plans";

type BillingYouCanPayButtonsProps = {
  planId: SubscriptionPlanId;
};

const provider = "youcan_pay" as const;

export function BillingYouCanPayButtons({ planId }: BillingYouCanPayButtonsProps) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  function handleClick(methodLabel: string) {
    console.info("[youcan_pay_billing_method_selected]", {
      methodLabel,
      planId,
      provider
    });
    setSelectedMethod(methodLabel);
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
            key={method.label}
            onClick={() => handleClick(method.label)}
            type="button"
            variant="secondary"
          >
            {method.label}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-orange-900">
        {selectedMethod
          ? `${selectedMethod} selected. Checkout processing is not connected yet.`
          : youCanPayCustomerBranding.description}
      </p>
    </div>
  );
}
