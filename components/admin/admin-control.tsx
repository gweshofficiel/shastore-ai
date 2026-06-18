import { Card } from "@/components/ui/card";

export function AdminHeader({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.8)] backdrop-blur lg:p-6">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
        Admin
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
        {description}
      </p>
    </div>
  );
}

export function AdminStatGrid({
  stats
}: {
  stats: Array<{ label: string; value: string | number; note?: string }>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card className="p-5 lg:p-6" key={stat.label}>
          <p className="text-sm font-bold text-slate-500">{stat.label}</p>
          <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-slate-950">
            {stat.value}
          </p>
          {stat.note ? (
            <p className="mt-3 text-sm leading-6 text-slate-500">{stat.note}</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

export function AdminBadge({
  children,
  tone = "slate"
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "blue" | "red";
}) {
  const classes = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200"
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${classes[tone]}`}
    >
      {children}
    </span>
  );
}

export function AdminTable({
  children,
  empty,
  headers
}: {
  children: React.ReactNode;
  empty?: React.ReactNode;
  headers: string[];
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            <tr>
              {headers.map((header) => (
                <th className="px-5 py-4" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">{children}</tbody>
        </table>
      </div>
      {empty ? <div className="p-6 text-sm leading-6 text-slate-500">{empty}</div> : null}
    </Card>
  );
}

export function formatAdminDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    console.warn(`[formatAdminDate] Invalid admin date value: ${value}`);
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(parsed);
}

export function formatAdminMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(value);
}
