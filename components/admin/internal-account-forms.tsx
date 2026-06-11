"use client";

import { useState } from "react";

function PasswordInput({ name }: { name: string }) {
  const [visible, setVisible] = useState(false);

  return (
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
  );
}

export function InternalPasswordChangeForm({
  action
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        New password
        <PasswordInput name="password" />
      </label>
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Confirm password
        <PasswordInput name="confirmPassword" />
      </label>
      <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
        Change password
      </button>
    </form>
  );
}
