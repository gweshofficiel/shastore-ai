import { Card } from "@/components/ui/card";

type AdminPageShellProps = {
  title: string;
  description: string;
  cards: Array<{
    label: string;
    value: string;
    note: string;
  }>;
};

export function AdminPageShell({
  title,
  description,
  cards
}: AdminPageShellProps) {
  return (
    <div className="grid gap-6 lg:gap-8">
      <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] backdrop-blur lg:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
          {description}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card className="p-5 lg:p-6" key={card.label}>
            <p className="text-sm font-bold text-slate-500">{card.label}</p>
            <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-slate-950">
              {card.value}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-500">{card.note}</p>
          </Card>
        ))}
      </div>
      <Card className="p-6 lg:p-8">
        <h2 className="text-2xl font-black tracking-[-0.03em] text-slate-950">
          Next steps
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          This admin surface is intentionally separated from customer workflows.
          Data tables, moderation actions, and owner-only controls can be wired
          here without changing the user dashboard or landing publish flow.
        </p>
      </Card>
    </div>
  );
}
