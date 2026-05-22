import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClaimAccountForm } from "@/components/store-activation/claim-account-form";
import { getStoreActivationByToken } from "@/lib/store-activation";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (status === "activated") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "expired" || status === "cancelled" || status === "revoked" || status === "not_found") {
    return "bg-red-100 text-red-700";
  }

  return "bg-blue-100 text-blue-700";
}

function StateMessage({
  children,
  tone = "slate"
}: {
  children: ReactNode;
  tone?: "emerald" | "red" | "slate";
}) {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-muted"
  };

  return (
    <p className={`rounded-2xl border px-4 py-3 text-sm font-bold ${classes[tone]}`}>
      {children}
    </p>
  );
}

export default async function ClaimAccountPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const activation = await getStoreActivationByToken(token);

  if (!activation) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card className="grid gap-4 p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">
              Invalid claim link
            </p>
            <h1 className="text-3xl font-black tracking-[-0.05em] text-ink">
              This account claim link is not valid
            </h1>
            <StateMessage tone="red">
              Ask your reseller to generate a fresh delivery package for this purchased store.
            </StateMessage>
          </Card>
        </div>
      </main>
    );
  }

  const isExpired = activation.activation_status === "expired";
  const isCancelled =
    activation.activation_status === "cancelled" || activation.activation_status === "revoked";
  const isAttached =
    (activation.activation_status === "activated" || activation.activation_status === "claimed") &&
    activation.auth_attachment_status === "attached_to_auth_user";
  const canClaim = !isExpired && !isCancelled && !isAttached;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-3xl gap-6">
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-white lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/60">
              SHASTORE AI · Buyer account claim
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.06em]">
              Create your account and claim your store
            </h1>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/70">
              Set the buyer password, create the real Supabase Auth account, and attach this store
              to the buyer dashboard.
            </p>
          </div>

          <div className="grid gap-5 p-6 lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Prepared store
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink">
                  {activation.store_name}
                </h2>
                <p className="mt-1 text-sm font-semibold text-muted">
                  Buyer email: {activation.buyer_email}
                </p>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusClass(
                  activation.activation_status
                )}`}
              >
                {activation.activation_status.replace(/-/g, " ")}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Transfer code
                </p>
                <p className="mt-2 font-mono text-lg font-black text-ink">
                  {activation.transfer_code}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                  Auth attachment
                </p>
                <p className="mt-2 text-sm font-black capitalize text-emerald-950">
                  {activation.auth_attachment_status.replace(/_/g, " ")}
                </p>
              </div>
            </div>

            {isExpired ? (
              <StateMessage tone="red">
                This claim link has expired. Ask your reseller to generate a new delivery PDF with a
                fresh activation link.
              </StateMessage>
            ) : null}

            {isCancelled ? (
              <StateMessage tone="red">
                This claim link was {activation.activation_status}.
              </StateMessage>
            ) : null}

            {isAttached ? (
              <div className="grid gap-4 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-sm font-black text-emerald-950">Store already claimed</p>
                <p className="text-sm font-semibold leading-6 text-emerald-800">
                  This purchased store is already attached to a SHASTORE buyer account.
                </p>
                <ButtonLink href="/dashboard/stores">Go to My Stores</ButtonLink>
              </div>
            ) : null}

            {canClaim && activation.buyer_email ? (
              <ClaimAccountForm buyerEmail={activation.buyer_email} token={token} />
            ) : null}
          </div>
        </Card>
      </div>
    </main>
  );
}
