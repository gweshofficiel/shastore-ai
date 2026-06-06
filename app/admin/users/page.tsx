import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminUsers } from "@/lib/admin/data";
import { restoreAdminUser, suspendAdminUser } from "@/lib/admin/user-actions";

type AdminUsersPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

function statusTone(status: string) {
  if (status === "active" || status === "trialing") {
    return "green" as const;
  }

  if (status === "suspended") {
    return "red" as const;
  }

  if (status === "past_due" || status === "incomplete" || status === "unpaid") {
    return "amber" as const;
  }

  return "red" as const;
}

function isNewThisMonth(createdAt: string | null) {
  if (!createdAt) {
    return false;
  }

  const created = new Date(createdAt);
  const now = new Date();

  return created.getUTCFullYear() === now.getUTCFullYear() && created.getUTCMonth() === now.getUTCMonth();
}

function cleanStatusFilter(value: string | undefined) {
  return value === "active" || value === "suspended" ? value : "all";
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const query = await searchParams;
  const users = await getAdminUsers();
  const statusFilter = cleanStatusFilter(query.status);
  const searchTerm = String(query.q ?? "").trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchTerm ||
      user.email.toLowerCase().includes(searchTerm) ||
      user.id.toLowerCase().includes(searchTerm);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "suspended"
        ? user.accountStatus === "suspended"
        : user.accountStatus !== "suspended");

    return matchesSearch && matchesStatus;
  });
  const suspendedUsers = users.filter((user) => user.accountStatus === "suspended").length;

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Real Super Admin user control center using existing account, workspace, store, subscription, and activity data."
        title="User Management"
      />

      <AdminStatGrid
        stats={[
          { label: "Total users", value: users.length },
          { label: "Active users", value: users.length - suspendedUsers },
          { label: "Suspended users", value: suspendedUsers },
          { label: "New this month", value: users.filter((user) => isNewThisMonth(user.createdAt)).length }
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <form className="grid gap-4 lg:grid-cols-[1fr_220px_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Search users</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.q ?? ""}
              name="q"
              placeholder="Email or user ID"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Status</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={statusFilter}
              name="status"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
            Filter users
          </button>
        </form>
      </div>

      <AdminTable
        empty={!filteredUsers.length ? "No users matched the selected search or filter." : null}
        headers={[
          "User ID",
          "Email",
          "Full name",
          "Created",
          "Last login",
          "Account status",
          "Workspaces",
          "Stores",
          "Plan",
          "Actions"
        ]}
      >
        {filteredUsers.map((user) => (
          <tr key={user.id}>
            <td className="max-w-64 break-all px-5 py-4 font-bold text-slate-950">{user.id}</td>
            <td className="px-5 py-4 font-bold text-slate-950">{user.email}</td>
            <td className="px-5 py-4 text-slate-600">{user.fullName ?? "Not set"}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(user.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(user.lastLoginAt)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={statusTone(user.accountStatus)}>{user.accountStatus}</AdminBadge>
            </td>
            <td className="px-5 py-4 text-slate-600">{user.workspaceCount}</td>
            <td className="px-5 py-4 text-slate-600">{user.storesCount}</td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{user.plan}</AdminBadge></td>
            <td className="px-5 py-4">
              <div className="grid min-w-72 gap-2">
                <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                    User details
                  </summary>
                  <div className="mt-3 grid gap-4 text-sm text-slate-600">
                    <section className="rounded-xl bg-white p-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Profile</p>
                      <p className="mt-2 break-all font-bold text-slate-950">{user.fullName ?? "No full name"}</p>
                      <p className="break-all">{user.email}</p>
                      <p className="break-all text-slate-400">{user.id}</p>
                    </section>
                    <section className="rounded-xl bg-white p-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Subscription</p>
                      <p className="mt-2 font-bold text-slate-950">{user.subscription.planName}</p>
                      <p>Status: {user.subscription.status}</p>
                      <p>Period end: {formatAdminDate(user.subscription.currentPeriodEnd)}</p>
                    </section>
                    <section className="rounded-xl bg-white p-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Stores owned</p>
                      <div className="mt-2 grid gap-2">
                        {user.stores.length ? (
                          user.stores.map((store) => (
                            <p className="rounded-lg bg-slate-50 p-2" key={store.id}>
                              <span className="block font-bold text-slate-950">{store.name}</span>
                              {store.status} · {formatAdminDate(store.createdAt)}
                            </p>
                          ))
                        ) : (
                          <p>No stores owned.</p>
                        )}
                      </div>
                    </section>
                    <section className="rounded-xl bg-white p-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Workspaces</p>
                      <div className="mt-2 grid gap-2">
                        {user.workspaces.length ? (
                          user.workspaces.map((workspace) => (
                            <p className="rounded-lg bg-slate-50 p-2" key={`${user.id}-${workspace.id}-${workspace.role}`}>
                              <span className="block break-all font-bold text-slate-950">{workspace.id}</span>
                              {workspace.role} · {workspace.status}
                            </p>
                          ))
                        ) : (
                          <p>No workspace memberships found.</p>
                        )}
                      </div>
                    </section>
                    <section className="rounded-xl bg-white p-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Recent activity</p>
                      <div className="mt-2 grid gap-2">
                        {user.recentActivity.length ? (
                          user.recentActivity.map((activity) => (
                            <p className="rounded-lg bg-slate-50 p-2" key={`${user.id}-${activity.label}-${activity.createdAt}`}>
                              <span className="block font-bold text-slate-950">{activity.label}</span>
                              {formatAdminDate(activity.createdAt)}
                            </p>
                          ))
                        ) : (
                          <p>No recent admin activity found.</p>
                        )}
                      </div>
                    </section>
                  </div>
                </details>
                <form action={suspendAdminUser}>
                  <input name="userId" type="hidden" value={user.id} />
                  <button
                    className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-red-700 disabled:opacity-50"
                    disabled={user.accountStatus === "suspended"}
                    type="submit"
                  >
                    Suspend user
                  </button>
                </form>
                <form action={restoreAdminUser}>
                  <input name="userId" type="hidden" value={user.id} />
                  <button
                    className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 disabled:opacity-50"
                    disabled={user.accountStatus !== "suspended"}
                    type="submit"
                  >
                    Restore user
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
