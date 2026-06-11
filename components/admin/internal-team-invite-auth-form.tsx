"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type InternalTeamInviteAuthFormProps = {
  email: string;
  mode: "login" | "signup";
  setupApiPath: string;
  switchHref: string;
  token: string;
};

function PasswordField({
  label,
  name
}: {
  label: string;
  name: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <span className="flex h-11 items-center rounded-2xl border border-slate-200 bg-white">
        <input
          className="min-w-0 flex-1 bg-transparent px-4 text-sm font-semibold text-slate-700 outline-none"
          minLength={8}
          name={name}
          required
          type={visible ? "text" : "password"}
        />
        <button
          className="h-full px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}

export function InternalTeamInviteAuthForm({
  email,
  mode,
  setupApiPath,
  switchHref,
  token
}: InternalTeamInviteAuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    try {
      const response = await fetch(setupApiPath, {
        body: JSON.stringify({
          confirmPassword,
          password
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      const payload = (await response.json()) as {
        email?: string;
        message?: string;
        redirectTo?: string;
        success?: boolean;
      };

      if (!response.ok || !payload.success || !payload.redirectTo || !payload.email) {
        setError(payload.message ?? "Setup failed. Try again.");
        return;
      }

      const supabase = createClient({ role: "internal_team" });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: payload.email,
        password
      });

      if (signInError) {
        setError("Account is ready but sign-in failed. Try again.");
        return;
      }

      router.replace(payload.redirectTo);
    } catch {
      setError("Setup failed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
      <input name="token" type="hidden" value={token} />
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          {error}
        </div>
      ) : null}
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Invited email
        <input
          aria-disabled="true"
          className="h-11 rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-500"
          disabled
          name="email"
          readOnly
          type="email"
          value={email}
        />
      </label>
      <PasswordField label="Password" name="password" />
      <PasswordField label="Confirm password" name="confirmPassword" />
      <button
        className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Setting up account..." : isSignup ? "Create account and enter workspace" : "Log in and enter workspace"}
      </button>
      <a className="text-sm font-bold text-slate-600 underline" href={switchHref}>
        {isSignup ? "Already have this account?" : "Need to create this account?"}
      </a>
    </form>
  );
}
