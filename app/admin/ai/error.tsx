"use client";

export default function AdminAIError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid gap-6 lg:gap-8">
      <div className="rounded-[2rem] border border-red-200 bg-red-50 p-5 shadow-[0_18px_60px_-48px_rgba(127,29,29,0.5)] lg:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-red-950 sm:text-4xl">
          AI Control Center could not load
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-red-700 sm:text-base">
          A safe runtime snapshot failed to render. No provider calls, generations, billing, credits, or secrets were touched.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-red-500">
            Error digest: {error.digest}
          </p>
        ) : null}
        <button
          className="mt-5 rounded-full border border-red-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-red-700"
          onClick={reset}
          type="button"
        >
          Retry AI Control Center
        </button>
      </div>
    </div>
  );
}
