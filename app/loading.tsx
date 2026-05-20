import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-xl p-6 lg:p-8">
        <div className="h-3 w-32 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-5 h-8 w-3/4 animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-4 grid gap-3">
          <div className="h-4 animate-pulse rounded-full bg-slate-100" />
          <div className="h-4 w-5/6 animate-pulse rounded-full bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-100" />
        </div>
      </Card>
    </main>
  );
}
