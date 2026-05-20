export function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-[2rem] border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] backdrop-blur sm:flex-row sm:items-end sm:justify-between lg:p-6">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
