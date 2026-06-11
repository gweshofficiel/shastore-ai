import Link from "next/link";

export function AdminTopbar({
  isRoleConfigured
}: {
  isRoleConfigured: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[2rem] border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Admin Panel
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Platform owner workspace for SHASTORE AI operations.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!isRoleConfigured ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-amber-700">
            Configure ADMIN_EMAILS
          </span>
        ) : null}
        <Link
          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          href="/admin/internal-team/settings"
        >
          Account settings
        </Link>
        <Link
          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          href="/dashboard"
        >
          User dashboard
        </Link>
      </div>
    </div>
  );
}
