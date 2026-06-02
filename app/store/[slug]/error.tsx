"use client";

import { useEffect } from "react";
import Link from "next/link";
import { deploymentLogger } from "@/lib/deployment/logging";

export default function StorefrontError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    deploymentLogger.error("Storefront route failed", error, {
      digest: error.digest
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 text-center shadow-2xl lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/45">
          Storefront fallback
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">
          This store could not load
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-white/65">
          The storefront is temporarily unavailable. Try again, or return home while the seller keeps their data safe.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-slate-950"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-black text-white"
            href="/"
          >
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
