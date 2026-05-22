import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";

export default function StoresLoading() {
  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Loading stores attached to your buyer account."
        title="My Stores"
      />
      <Card className="p-6 lg:p-8">
        <div className="animate-pulse space-y-5">
          <div className="h-4 w-40 rounded-full bg-slate-200" />
          <div className="h-8 w-64 rounded-full bg-slate-200" />
          <div className="h-4 max-w-xl rounded-full bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56 rounded-3xl bg-slate-100" />
            <div className="h-56 rounded-3xl bg-slate-100" />
          </div>
        </div>
      </Card>
    </div>
  );
}
