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
import { activateAdminUser, suspendAdminUser } from "@/lib/admin/user-actions";

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
        title={user.email}
      />

      <div className="flex flex-wrap gap-3">
        <Link
          className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700"
          href="/admin/users"
        >
          Back to users
        </Link>
        <form action={suspendAdminUser}>
          <input name="userId" type="hidden" value={user.id} />
          <button
            className="inline-flex h-10 items-center rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-amber-700 disabled:opacity-50"
            disabled={user.status === "incomplete"}
            type="submit"
          >
            Suspend
          </button>
        </form>
        <form action={activateAdminUser}>
          <input name="userId" type="hidden" value={user.id} />
          <button
            className="inline-flex h-10 items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 disabled:opacity-50"
            disabled={user.status === "active"}
            type="submit"
          >
            Activate
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
            Plan <span className="mt-1 block"><AdminBadge tone="blue">{user.plan}</AdminBadge></span>
          </p>
          <p>
            Status <span className="mt-1 block"><AdminBadge tone={statusTone(user.status)}>{user.status}</AdminBadge></span>
          </p>
          <p>
            Created <span className="mt-1 block font-black text-slate-950">{formatAdminDate(user.createdAt)}</span>
          </p>
        </div>
      </div>

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
