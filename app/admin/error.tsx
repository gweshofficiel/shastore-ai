"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deploymentLogger } from "@/lib/deployment/logging";

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    deploymentLogger.error("Admin route failed", error, {
      digest: error.digest
    });
  }, [error]);

  return (
    <Card className="p-6 lg:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
        Admin fallback
      </p>
      <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">
        Admin could not load
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        The production error boundary handled this safely.
      </p>
      <Button className="mt-6" onClick={reset} type="button">
        Try again
      </Button>
    </Card>
  );
}
