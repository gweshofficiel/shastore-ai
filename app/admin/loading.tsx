import { Card } from "@/components/ui/card";

export default function AdminLoading() {
  return (
    <div className="grid gap-4">
      <Card className="p-6">
        <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-9 w-80 max-w-full animate-pulse rounded-2xl bg-slate-200" />
      </Card>
      <Card className="p-0">
        <div className="h-64 animate-pulse rounded-[2rem] bg-slate-100" />
      </Card>
    </div>
  );
}
