import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  activateStoreByToken,
  getStoreActivationByToken
} from "@/lib/store-activation";

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

export default async function ActivateStorePage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const activation = await getStoreActivationByToken(token);

  if (!activation) {
    notFound();
  }

  const status = query.status ?? activation.activation_status;
  const canActivate = activation.activation_status === "pending";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-3xl gap-6">
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-white lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/60">
              SHASTORE AI Store Activation
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.06em]">
              Activate your prepared store
            </h1>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/70">
              This foundation verifies the activation token and records a safe ownership claim
              placeholder. Real auth invite, password setup, and email delivery remain future steps.
            </p>
          </div>

          <div className="grid gap-5 p-6 lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Store
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
                  status
                )}`}
              >
                {status.replace(/-/g, " ")}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Transfer Code
                </p>
                <p className="mt-2 font-mono text-lg font-black text-ink">
                  {activation.transfer_code}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Account Target
                </p>
                <p className="mt-2 font-mono text-sm font-black text-ink">
                  {activation.target_account_id ?? "New buyer account placeholder"}
                </p>
                <p className="mt-1 text-xs font-bold text-muted">
                  {activation.target_account_lookup_status ?? "new_account_placeholder"}
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-black text-blue-950">Password setup placeholder</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-blue-800">
                Future flow: Supabase auth invite, password setup email, store owner role, login
                redirect, PDF credentials, and WhatsApp delivery will connect here.
              </p>
            </div>

            {canActivate ? (
              <form action={activateStoreByToken}>
                <input name="token" type="hidden" value={token} />
                <Button type="submit">Activate store</Button>
              </form>
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-muted">
                This activation token is {activation.activation_status}.
              </p>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
