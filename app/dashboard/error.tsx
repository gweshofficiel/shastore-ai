"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deploymentLogger } from "@/lib/deployment/logging";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    deploymentLogger.error("Dashboard route failed", error, {
      digest: error.digest
    });
  }, [error]);

  return (
    <Card className="p-6 lg:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
        Dashboard fallback
      </p>
      <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-ink">
        Dashboard could not load
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        The production error boundary handled this safely.
      </p>
      <Button className="mt-6" onClick={reset} type="button">
        Try again
      </Button>
    </Card>
  );
}
