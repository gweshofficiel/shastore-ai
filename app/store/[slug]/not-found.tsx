import { ButtonLink } from "@/components/ui/button";

export default function StorefrontNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-16 text-center">
      <div className="max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.9)]">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          SHASTORE AI Store
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-ink">
          Store not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This storefront preview is unavailable, private, inactive, or has no matching
          public store slug.
        </p>
        <div className="mt-6">
          <ButtonLink href="/" variant="secondary">
            Back to SHASTORE AI
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
