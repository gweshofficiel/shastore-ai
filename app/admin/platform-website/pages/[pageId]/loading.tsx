import { Card } from "@/components/ui/card";

export default function PlatformPageEditorLoading() {
  return (
    <div className="grid gap-6">
      <Card className="p-6 lg:p-8">
        <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-96 max-w-full animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-3 h-4 w-[32rem] max-w-full animate-pulse rounded-full bg-slate-100" />
      </Card>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="h-[42rem] animate-pulse rounded-[2rem] bg-slate-100" />
        <Card className="h-96 animate-pulse rounded-[2rem] bg-slate-100" />
      </div>
    </div>
  );
}
