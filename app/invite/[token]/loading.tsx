import { Card } from "@/components/ui/card";

export default function InviteLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <Card className="max-w-lg p-8 text-center">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Validating invitation
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
          Accepting invitation
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">
          Checking your invite, accepting workspace access, and redirecting you.
        </p>
      </Card>
    </main>
  );
}
