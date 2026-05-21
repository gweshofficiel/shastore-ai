"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AccountProfile } from "@/lib/account-profiles";

export function AccountIdCard({
  account,
  unavailableMessage
}: {
  account: AccountProfile | null;
  unavailableMessage: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyAccountId() {
    if (!account?.account_id) {
      return;
    }

    await navigator.clipboard.writeText(account.account_id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Card className="border-blue-200 bg-blue-50 p-5 lg:p-6">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-500">
        SHASTORE Account ID
      </p>
      {account ? (
        <>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-3xl font-black tracking-[-0.04em] text-blue-950">
                {account.account_id}
              </p>
              <p className="mt-1 text-sm font-semibold capitalize text-blue-800">
                {account.account_type} account identifier
              </p>
            </div>
            <Button onClick={copyAccountId} type="button" variant="secondary">
              {copied ? "Copied" : "Copy account ID"}
            </Button>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-blue-800">
            This ID never changes and is used to target future store ownership transfers.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm font-bold leading-6 text-blue-800">{unavailableMessage}</p>
      )}
    </Card>
  );
}
