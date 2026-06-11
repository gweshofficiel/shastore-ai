import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate,
  formatAdminMoney
} from "@/components/admin/admin-control";
import { getAdminUserDetail } from "@/lib/admin/data";
import {
  clearAdminUserRisk,
  exportAdminUserPlaceholder,
  markAdminUserHighRisk,
  markAdminUserReviewed,
  suspendAdminUserShortcut
} from "@/lib/admin/user-actions";

type AdminUserDetailsPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

function statusTone(status: string) {
  if (status === "active" || status === "trialing") {
    return "green" as const;
  }

  if (status === "past_due" || status === "incomplete" || status === "unpaid") {
    return "amber" as const;
  }

  return "red" as const;
}

function riskTone(status: string) {
  if (status === "high_risk") {
    return "red" as const;
  }

  if (status === "reviewed") {
    return "green" as const;
  }

  return "blue" as const;
}

function UserHiddenFields({ userId }: { userId: string }) {
  return <input name="userId" type="hidden" value={userId} />;
}

export default async function AdminUserDetailsPage({ params }: AdminUserDetailsPageProps) {
  const { userId } = await params;
  const user = await getAdminUserDetail(userId);

  if (!user) {
    return (
      <div className="grid gap-6 lg:gap-8">
        <AdminHeader
          description="The requested user was not found in real platform records."
          title="User details"
        />
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
          No user record found.
        </div>
      </div>
    );
  }

  const orderTotal = user.recentOrders.reduce((total, order) => total + order.total, 0);

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Real user account, subscription, stores, and order signals for admin review."
        title={user.emailMasked}
      />

      <div className="flex flex-wrap gap-3">
        <Link
          className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
          href="/admin/users"
        >
          Back to users
        </Link>
        <form action={markAdminUserReviewed}>
          <UserHiddenFields userId={user.id} />
          <button className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700" type="submit">
            Mark reviewed
          </button>
        </form>
        <form action={markAdminUserHighRisk}>
          <UserHiddenFields userId={user.id} />
          <button className="inline-flex h-10 items-center rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
            Mark high risk
          </button>
        </form>
        <form action={clearAdminUserRisk}>
          <UserHiddenFields userId={user.id} />
          <button className="inline-flex h-10 items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
            Clear risk
          </button>
        </form>
        <form action={suspendAdminUserShortcut}>
          <UserHiddenFields userId={user.id} />
          <button className="inline-flex h-10 items-center rounded-full border border-red-200 bg-red-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-red-700" type="submit">
            Suspend shortcut
          </button>
        </form>
        <form action={exportAdminUserPlaceholder}>
          <UserHiddenFields userId={user.id} />
          <button className="inline-flex h-10 items-center rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
            Export placeholder
          </button>
        </form>
      </div>

      <AdminStatGrid
        stats={[
          { label: "Stores", value: user.storesCount },
          { label: "Landings", value: user.landingsCount },
          { label: "Orders", value: user.ordersCount },
          { label: "Recent order value", value: formatAdminMoney(orderTotal) }
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="grid gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <p>
            User ID <span className="mt-1 block break-all font-black text-slate-950">{user.id}</span>
          </p>
          <p>
            Email <span className="mt-1 block break-all font-black text-slate-950">{user.emailMasked}</span>
          </p>
          <p>
            Role <span className="mt-1 block"><AdminBadge tone="blue">{user.primaryRole}</AdminBadge></span>
          </p>
          <p>
            Plan <span className="mt-1 block"><AdminBadge tone="blue">{user.plan}</AdminBadge></span>
          </p>
          <p>
            Status <span className="mt-1 block"><AdminBadge tone={statusTone(user.status)}>{user.status}</AdminBadge></span>
          </p>
          <p>
            Created <span className="mt-1 block font-black text-slate-950">{formatAdminDate(user.createdAt)}</span>
          </p>
          <p>
            Last sign-in <span className="mt-1 block font-black text-slate-950">{formatAdminDate(user.lastLoginAt)}</span>
          </p>
          <p>
            Risk <span className="mt-1 block"><AdminBadge tone={riskTone(user.riskStatus)}>{user.riskStatus}</AdminBadge></span>
          </p>
          <p>
            Subscription <span className="mt-1 block font-black text-slate-950">{user.activeSubscriptionLabel}</span>
          </p>
        </div>
      </div>

      <AdminTable
        empty={!user.workspaces.length ? "No workspace memberships found for this user." : null}
        headers={["Workspace", "Role", "Status", "Created"]}
      >
        {user.workspaces.map((workspace) => (
          <tr key={`${workspace.id}-${workspace.role}`}>
            <td className="break-all px-5 py-4 font-bold text-slate-950">{workspace.id}</td>
            <td className="px-5 py-4 text-slate-600">{workspace.role}</td>
            <td className="px-5 py-4"><AdminBadge>{workspace.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(workspace.createdAt)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!user.securitySignals.length ? "No security or risk signals found for this user." : null}
        headers={["Signal", "Severity", "Created"]}
      >
        {user.securitySignals.map((signal) => (
          <tr key={`${signal.label}-${signal.createdAt}`}>
            <td className="px-5 py-4 font-bold text-slate-950">{signal.label}</td>
            <td className="px-5 py-4"><AdminBadge tone={signal.severity === "high" ? "red" : signal.severity === "medium" ? "amber" : "blue"}>{signal.severity}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(signal.createdAt)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!user.stores.length ? "No stores found for this user." : null}
        headers={["Store", "Status", "Created", "Store ID"]}
      >
        {user.stores.map((store) => (
          <tr key={store.id}>
            <td className="px-5 py-4 font-bold text-slate-950">{store.name}</td>
            <td className="px-5 py-4"><AdminBadge>{store.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(store.createdAt)}</td>
            <td className="px-5 py-4 text-slate-500">{store.id}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!user.recentOrders.length ? "No recent orders found for this user." : null}
        headers={["Order", "Source", "Status", "Total", "Created"]}
      >
        {user.recentOrders.map((order) => (
          <tr key={order.id}>
            <td className="px-5 py-4 font-bold text-slate-950">{order.id}</td>
            <td className="px-5 py-4 text-slate-600">{order.sourceType}</td>
            <td className="px-5 py-4"><AdminBadge>{order.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">
              {formatAdminMoney(order.total, order.currency)}
            </td>
            <td className="px-5 py-4 text-slate-500">{formatAdminDate(order.createdAt)}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
