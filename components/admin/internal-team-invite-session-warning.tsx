"use client";

import { useState } from "react";

type InternalTeamInviteSessionWarningProps = {
  acceptUrl: string;
  continueAction: (formData: FormData) => void | Promise<void>;
  token: string;
};

export function InternalTeamInviteSessionWarning({
  acceptUrl,
  continueAction,
  token
}: InternalTeamInviteSessionWarningProps) {
  const [copied, setCopied] = useState(false);

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="text-lg font-black text-amber-950">Use a separate browser session</h2>
      <p className="mt-3 font-semibold leading-6">
        You are currently signed in as Platform Owner. To accept this invitation safely, open this invite link in a
        private window or another browser.
      </p>
      <p className="mt-3 font-semibold leading-6">
        Continue anyway will switch the current browser session to the invited account.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="h-11 rounded-full border border-amber-300 bg-white px-5 text-sm font-black text-amber-800"
          onClick={copyInviteLink}
          type="button"
        >
          {copied ? "Invite link copied" : "Copy invite link"}
        </button>
        <form action={continueAction}>
          <input name="token" type="hidden" value={token} />
          <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
            Continue anyway
          </button>
        </form>
      </div>
    </section>
  );
}
