"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  claimStoreByActivationToken,
  type StoreActivationFormState
} from "@/lib/store-activation";

const initialState: StoreActivationFormState = {
  message: "",
  status: "idle"
};

function ActivateSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-auto" disabled={pending} type="submit">
      {pending ? "Activating store..." : "Activate store"}
    </Button>
  );
}

export function ActivateStoreForm({
  accountClaimMode,
  token,
  transferDestination
}: {
  accountClaimMode: "existing_account" | "new_account";
  token: string;
  transferDestination: string;
}) {
  const [state, formAction] = useActionState(claimStoreByActivationToken, initialState);

  if (state.status === "success") {
    return (
      <div className="grid gap-4 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
          Activation complete
        </p>
        <h3 className="text-2xl font-black tracking-[-0.04em] text-emerald-950">
          Your store ownership claim is recorded
        </h3>
        <p className="text-sm font-semibold leading-6 text-emerald-800">{state.message}</p>
        {state.authAttachmentStatus ? (
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Auth attachment: {state.authAttachmentStatus.replace(/_/g, " ")}
          </p>
        ) : null}
        {state.ownerLinkId ? (
          <p className="font-mono text-xs font-bold text-emerald-800">
            Owner link: {state.ownerLinkId}
          </p>
        ) : null}
        <p className="text-sm font-semibold text-emerald-800">
          {/* Future: automatic login after Supabase auth invite */}
          Sign in with the same buyer email to manage the store from your dashboard.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/dashboard/stores">Go to My Stores</ButtonLink>
          {state.storeSlug ? (
            <ButtonLink href={`/dashboard/stores/preview/${state.storeSlug}`} variant="secondary">
              View store preview
            </ButtonLink>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-5">
      <input name="token" type="hidden" value={token} />

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">
          Account claim mode
        </p>
        <p className="mt-2 text-lg font-black text-blue-950">
          {accountClaimMode === "existing_account"
            ? "Existing SHASTORE account target"
            : "New buyer account setup"}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-blue-800">
          Transfer destination: {transferDestination.replace(/_/g, " ")}. If you are already signed
          in, SHASTORE attaches the store to your current Supabase Auth user. If not, it records an
          onboarding placeholder for future invite, password setup email, automatic login, buyer
          role creation, and store owner role assignment.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Password (placeholder)
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
        Passwords are validated for matching only. This foundation records the ownership claim and,
        when a buyer session exists, creates real owner/access rows tied to Supabase Auth. It does not
        send onboarding email yet.
      </p>

      {state.status === "error" ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <ActivateSubmitButton />
    </form>
  );
}
