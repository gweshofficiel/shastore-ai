"use client";

import { useState } from "react";

type InternalTeamInviteAuthFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  email: string;
  mode: "login" | "signup";
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
  action,
  email,
  mode,
  switchHref,
  token
}: InternalTeamInviteAuthFormProps) {
  const isSignup = mode === "signup";

  return (
    <form action={action} className="mt-6 grid gap-4">
      <input name="token" type="hidden" value={token} />
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Invited email
        <input
          className="h-11 rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-500"
          name="email"
          readOnly
          type="email"
          value={email}
        />
      </label>
      <PasswordField label="Password" name="password" />
      <PasswordField label="Confirm password" name="confirmPassword" />
      <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
        {isSignup ? "Create account and enter workspace" : "Log in and enter workspace"}
      </button>
      <a className="text-sm font-bold text-slate-600 underline" href={switchHref}>
        {isSignup ? "Already have this account?" : "Need to create this account?"}
      </a>
    </form>
  );
}
