import { notFound } from "next/navigation";
import { ActivateStoreForm } from "@/components/store-activation/activate-store-form";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getStoreActivationByToken } from "@/lib/store-activation";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (status === "activated") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "expired" || status === "cancelled" || status === "not_found") {
    return "bg-red-100 text-red-700";
  }

  return "bg-blue-100 text-blue-700";
}

function accountModeLabel(mode: "existing_account" | "new_account") {
  return mode === "existing_account"
    ? "Existing SHASTORE account target"
    : "New buyer account setup";
}

export default async function ActivateStorePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const activation = await getStoreActivationByToken(token);

  if (!activation) {
    notFound();
  }

  const canActivate = activation.activation_status === "pending";
  const alreadyActivated = activation.activation_status === "activated";
  const isExpired = activation.activation_status === "expired";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-3xl gap-6">
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-white lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/60">
              SHASTORE AI · Step 2 of 2
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.06em]">
              Claim your purchased store
            </h1>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/70">
              Verify your delivery package, set a password placeholder, and record real ownership
              claim data. Supabase auth invite, automatic login, and credential email delivery are
              prepared for a future release.
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
                {activation.store_slug ? (
                  <p className="mt-1 font-mono text-xs font-bold text-muted">
                    Preview slug: {activation.store_slug}
                  </p>
                ) : null}
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
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Target account mode
                </p>
                <p className="mt-2 text-sm font-black text-ink">
                  {accountModeLabel(activation.account_claim_mode)}
                </p>
                <p className="mt-1 font-mono text-xs font-bold text-muted">
                  {activation.target_account_id ?? "New account placeholder"}
                </p>
                <p className="mt-1 text-xs font-semibold capitalize text-muted">
                  Lookup: {(activation.target_account_lookup_status ?? "new_account_placeholder").replace(
                    /_/g,
                    " "
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                  Auth attachment
                </p>
                <p className="mt-2 text-sm font-black capitalize text-emerald-950">
                  {activation.auth_attachment_status.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-800">
                  Access role: {activation.access_role ?? "owner"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Domain foundation
                </p>
                <p className="mt-2 text-sm font-black text-ink">
                  {activation.connected_domain ??
                    activation.requested_domain ??
                    "Domain not requested yet"}
                </p>
                <p className="mt-1 text-xs font-semibold text-muted">
                  DNS and SSL remain handled by the domain foundation.
                </p>
              </div>
            </div>

            {isExpired ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                This activation link has expired. Ask your reseller to generate a new delivery PDF
                with a fresh activation link.
              </p>
            ) : null}

            {alreadyActivated ? (
              <div className="grid gap-4 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-sm font-black text-emerald-950">Store already activated</p>
                <p className="text-sm font-semibold leading-6 text-emerald-800">
                  Ownership for this store has already been claimed. Open your buyer dashboard to
                  view the store preview and future management tools.
                </p>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href="/dashboard/stores">Go to My Stores</ButtonLink>
                  {activation.store_slug ? (
                    <ButtonLink
                      href={`/dashboard/stores/preview/${activation.store_slug}`}
                      variant="secondary"
                    >
                      View store preview
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
            ) : null}

            {canActivate ? (
              <ActivateStoreForm
                accountClaimMode={activation.account_claim_mode}
                token={token}
                transferDestination={activation.transfer_destination}
              />
            ) : null}

            {!canActivate && !alreadyActivated && !isExpired ? (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-muted">
                This activation token is {activation.activation_status.replace(/-/g, " ")}.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </main>
  );
}
