import { Card } from "@/components/ui/card";

export default function DomainsLoading() {
  return (
    <div className="grid gap-6 lg:gap-8">
      <Card className="h-32 animate-pulse bg-slate-50 p-6" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="h-64 animate-pulse bg-slate-50 p-6" />
        <Card className="h-64 animate-pulse bg-slate-50 p-6" />
      </div>
      <Card className="h-72 animate-pulse bg-slate-50 p-6" />
    </div>
  );
}
