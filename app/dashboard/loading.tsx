import { Card } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="grid gap-4">
      <Card className="p-6">
        <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-9 w-72 max-w-full animate-pulse rounded-2xl bg-slate-200" />
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card className="p-5" key={item}>
            <div className="h-20 animate-pulse rounded-3xl bg-slate-100" />
          </Card>
        ))}
      </div>
    </div>
  );
}
