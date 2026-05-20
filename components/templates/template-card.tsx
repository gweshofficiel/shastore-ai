import { Card } from "@/components/ui/card";
import type { LandingTemplate } from "@/types/landing";

export function TemplateCard({ template }: { template: LandingTemplate }) {
  return (
    <Card className="overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-slate-300">
      <div className="aspect-[4/3] bg-gradient-to-br from-slate-50 via-white to-slate-200 p-5">
        <div className="h-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-28 rounded-2xl bg-slate-50" />
          <div className="mt-4 h-3 w-2/3 rounded-full bg-slate-200" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-slate-100" />
          <div className="mt-6 h-9 w-28 rounded-full bg-ink" />
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-black tracking-[-0.02em] text-ink">
          {template.name}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          {template.description}
        </p>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-muted">
          {template.placeholders.length} placeholders
        </p>
      </div>
    </Card>
  );
}
