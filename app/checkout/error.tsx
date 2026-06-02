"use client";

import { useEffect } from "react";
import Link from "next/link";
import { deploymentLogger } from "@/lib/deployment/logging";

export default function CheckoutError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    deploymentLogger.error("Checkout route failed", error, {
      digest: error.digest
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-950">
      <section className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-sm lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Checkout unavailable
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">
          We could not load checkout
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-slate-500">
          Your order was not submitted. Please try again, or return to the storefront and reopen checkout.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-slate-700"
            href="/"
          >
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
