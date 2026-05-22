"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { claimBuyerAccountWithPassword, type AccountClaimFormState } from "@/lib/account-claim";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AccountClaimFormState = {
  message: "",
  status: "idle"
};

function ClaimSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-auto" disabled={pending} type="submit">
      {pending ? "Creating account..." : "Create account and claim store"}
    </Button>
  );
}

export function ClaimAccountForm({
  buyerEmail,
  token
}: {
  buyerEmail: string;
  token: string;
}) {
  const [state, formAction] = useActionState(claimBuyerAccountWithPassword, initialState);

  return (
    <form action={formAction} className="grid gap-5">
      <input name="token" type="hidden" value={token} />

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">
          Buyer account
        </p>
        <p className="mt-2 text-lg font-black text-blue-950">{buyerEmail}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-blue-800">
          SHASTORE will create a Supabase Auth account for this buyer email, sign you in, and attach
          this purchased store to your buyer dashboard.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Password
          </span>
          <Input
            autoComplete="new-password"
            minLength={8}
            name="password"
            placeholder="Minimum 8 characters"
            required
            type="password"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Confirm password
          </span>
          <Input
            autoComplete="new-password"
            minLength={8}
            name="confirmPassword"
            placeholder="Repeat password"
            required
            type="password"
          />
        </label>
      </div>

      <p className="text-sm font-semibold leading-6 text-muted">
        If this email already has a SHASTORE account, use that account password here or log in first
        and reopen this claim link.
      </p>

      {state.status === "error" ? (
        <p
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <ClaimSubmitButton />
    </form>
  );
}
