export default function AdminSupportLoading() {
  return (
    <div className="grid gap-6 lg:gap-8">
      <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] backdrop-blur lg:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Admin</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">Support</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
          Loading read-only support dashboard and ticket details runtime.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {["Tickets", "Open", "In review", "Urgent"].map((label) => (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 lg:p-6" key={label}>
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <div className="mt-4 h-8 w-24 rounded-full bg-slate-100" />
            <p className="mt-3 h-4 w-36 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
        <div className="h-5 w-40 rounded-full bg-slate-100" />
        <div className="mt-4 grid gap-3">
          <div className="h-4 w-full rounded-full bg-slate-100" />
          <div className="h-4 w-5/6 rounded-full bg-slate-100" />
          <div className="h-4 w-2/3 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
