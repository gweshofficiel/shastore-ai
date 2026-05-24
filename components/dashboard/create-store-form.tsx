"use client";

import { useState } from "react";
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard";
import type { PaidSubscriptionPlanId } from "@/lib/billing/platform-checkout";

type CreateStoreFormProps = {
  currentPlan?: string | null;
  recommendedPlan?: string | null;
  recommendedPlanId?: PaidSubscriptionPlanId | null;
};

export default function CreateStoreForm({
  currentPlan,
  recommendedPlan,
  recommendedPlanId
}: CreateStoreFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  async function handleCreateStore() {
    setLoading(true);
    setMessage("");
    setUpgradeRequired(false);

    try {
      const response = await fetch("/api/stores/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setUpgradeRequired(true);
        }

        throw new Error(data.error || "Failed to create store");
      }

      setMessage("Store created successfully");
      setName("");
      setSlug("");
      setDescription("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create store");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border p-6">
      <h2 className="text-xl font-semibold">Create real store</h2>

      <input className="w-full rounded-lg border p-3" placeholder="Store name" value={name} onChange={(e) => setName(e.target.value)} />

      <input className="w-full rounded-lg border p-3" placeholder="Store slug" value={slug} onChange={(e) => setSlug(e.target.value)} />

      <textarea className="w-full rounded-lg border p-3" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

      <button type="button" onClick={handleCreateStore} disabled={loading} className="rounded-lg bg-black px-5 py-3 text-white">
        {loading ? "Creating..." : "Create Store"}
      </button>

      {upgradeRequired ? (
        <UpgradeRequiredCard
          blockedAction="Store limit reached"
          currentPlan={currentPlan}
          reason={message || "Store limit reached on your current plan."}
          recommendedPlan={recommendedPlan ?? "Pro"}
          recommendedPlanId={recommendedPlanId}
        />
      ) : message ? (
        <p className="text-sm text-neutral-600">{message}</p>
      ) : null}
    </div>
  );
}