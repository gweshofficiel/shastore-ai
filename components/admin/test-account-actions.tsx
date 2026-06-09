"use client";

import Link from "next/link";
import { useState } from "react";

export function TestAccountActions({
  email,
  userId
}: {
  email: string;
  userId: string;
}) {
  const [copied, setCopied] = useState(false);
  const canOpen = userId !== "Not found";
  const canCopy = email !== "Not found";

  async function copyEmail() {
    if (!canCopy) {
      return;
    }

    await navigator.clipboard.writeText(email);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex min-w-72 flex-wrap gap-2">
      <Link
        aria-disabled={!canOpen}
        className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${
          canOpen
            ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            : "pointer-events-none border-slate-100 bg-slate-50 text-slate-300"
        }`}
        href={canOpen ? `/admin/users/${userId}` : "#"}
      >
        View Account
      </Link>
      <Link
        aria-disabled={!canOpen}
        className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${
          canOpen
            ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            : "pointer-events-none border-slate-100 bg-slate-50 text-slate-300"
        }`}
        href={canOpen ? `/admin/users/${userId}` : "#"}
      >
        Open Account
      </Link>
      <button
        className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${
          canCopy
            ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            : "border-slate-100 bg-slate-50 text-slate-300"
        }`}
        disabled={!canCopy}
        onClick={copyEmail}
        type="button"
      >
        {copied ? "Copied" : "Copy Email"}
      </button>
    </div>
  );
}
