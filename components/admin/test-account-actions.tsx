"use client";

import Link from "next/link";
import { useState } from "react";
import { deactivateTestEnvironmentAccount } from "@/lib/admin/test-environment-actions";

export function TestAccountActions({
  email,
  role,
  userId
}: {
  email: string;
  role: string;
  userId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
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

  async function handleOpenAccount() {
    if (!canOpen || opening) {
      return;
    }

    setOpening(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/test-environment/open-account", {
        body: JSON.stringify({ role }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        ok: boolean;
        url?: string;
      };

      if (response.ok && result.ok && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else if (result.error === "super-admin-required") {
        setErrorMessage("Super Admin session is required. Log in at /admin/login and try again.");
      } else {
        setErrorMessage(result.message ?? "Could not open this test account.");
      }
    } catch {
      setErrorMessage("Could not open this test account.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="min-w-72">
      <div className="flex flex-wrap gap-2">
      <Link
        aria-disabled={!canOpen}
        className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${
          canOpen
            ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            : "pointer-events-none border-slate-100 bg-slate-50 text-slate-300"
        }`}
        href={canOpen ? `/admin/users/${userId}` : "#"}
        rel="noopener noreferrer"
        target="_blank"
      >
        View Account
      </Link>
      <button
        className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${
          canOpen
            ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "border-slate-100 bg-slate-50 text-slate-300"
        }`}
        disabled={!canOpen || opening}
        onClick={handleOpenAccount}
        type="button"
      >
        {opening ? "Opening..." : "Open Account"}
      </button>
      <form action={deactivateTestEnvironmentAccount}>
        <input name="role" type="hidden" value={role} />
        <button
          className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${
            canOpen
              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              : "border-slate-100 bg-slate-50 text-slate-300"
          }`}
          disabled={!canOpen}
          type="submit"
        >
          Deactivate
        </button>
      </form>
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
      {errorMessage ? (
        <p className="mt-2 max-w-sm text-xs font-bold text-red-700">{errorMessage}</p>
      ) : null}
    </div>
  );
}
