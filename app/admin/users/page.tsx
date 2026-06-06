import {
  AdminBadge,
  AdminHeader,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminUsers } from "@/lib/admin/data";
import { activateAdminUser, suspendAdminUser } from "@/lib/admin/user-actions";

function statusTone(status: string) {
  if (status === "active" || status === "trialing") {
    return "green" as const;
  }

  if (status === "past_due" || status === "incomplete" || status === "unpaid") {
    return "amber" as const;
  }

  return "red" as const;
}

export default async function AdminUsersPage() {
  const users = await getAdminUsers();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Owner-only user management with real account, plan, usage, and subscription status controls."
        title="Users"
      />
      <AdminTable
        empty={!users.length ? "No users found or service-role admin access is not configured." : null}
        headers={[
          "Email",
          "Plan",
          "Status",
          "Created",
          "Stores",
          "Landings",
          "Orders",
          "Actions"
        ]}
      >
        {users.map((user) => (
          <tr key={user.id}>
            <td className="px-5 py-4 font-bold text-slate-950">{user.email}</td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{user.plan}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={statusTone(user.status)}>{user.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(user.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{user.storesCount}</td>
            <td className="px-5 py-4 text-slate-600">{user.landingsCount}</td>
            <td className="px-5 py-4 text-slate-600">{user.ordersCount}</td>
            <td className="px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <a
                  className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-blue-700"
                  href={`/admin/users/${encodeURIComponent(user.id)}`}
                >
                  View details
                </a>
                <form action={suspendAdminUser}>
                  <input name="userId" type="hidden" value={user.id} />
                  <button
                    className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-amber-700 disabled:opacity-50"
                    disabled={user.status === "incomplete"}
                    type="submit"
                  >
                    Suspend
                  </button>
                </form>
                <form action={activateAdminUser}>
                  <input name="userId" type="hidden" value={user.id} />
                  <button
                    className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 disabled:opacity-50"
                    disabled={user.status === "active"}
                    type="submit"
                  >
                    Activate
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
