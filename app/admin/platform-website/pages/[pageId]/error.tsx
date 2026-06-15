"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { deploymentLogger } from "@/lib/deployment/logging";

export default function PlatformPageEditorError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    deploymentLogger.error("Platform page editor failed", error, {
      digest: error.digest
    });
  }, [error]);

  return (
    <Card className="p-6 lg:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">
        Platform editor error
      </p>
      <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">
        Editor could not load
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        The platform page editor failed safely. No public route or page status was changed.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="h-10 rounded-full bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.16em] text-white"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
        <Link
          className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600"
          href="/admin/platform-website"
        >
          Back to platform pages
        </Link>
      </div>
    </Card>
  );
}
