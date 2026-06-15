"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deploymentLogger } from "@/lib/deployment/logging";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    deploymentLogger.error("Route render failed", error, {
      digest: error.digest
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="max-w-xl p-6 text-center lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Production fallback
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          SHASTORE AI caught this safely. Try again, or return to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset} type="button">
            Try again
          </Button>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-ink"
            href="/dashboard"
          >
            Dashboard
          </Link>
        </div>
      </Card>
    </main>
  );
}
