import {
  AdminBadge,
  AdminHeader,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminUsers } from "@/lib/admin/data";

export default async function AdminUsersPage() {
  const users = await getAdminUsers();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Owner-only user management with account, plan, usage, and moderation placeholders."
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
            <td className="px-5 py-4"><AdminBadge tone="green">{user.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(user.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{user.storesCount}</td>
            <td className="px-5 py-4 text-slate-600">{user.landingsCount}</td>
            <td className="px-5 py-4 text-slate-600">{user.ordersCount}</td>
            <td className="px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <AdminBadge tone="amber">Suspend placeholder</AdminBadge>
                <AdminBadge tone="green">Activate placeholder</AdminBadge>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
