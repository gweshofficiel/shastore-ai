import Link from "next/link";
import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminUsers } from "@/lib/admin/data";
import {
  adminUserRuntimeFiltersFromParams,
  filterAdminUsersForRuntime
} from "@/lib/admin/user-runtime-filters";
import {
  clearAdminUserRisk,
  markAdminUserHighRisk,
  markAdminUserReviewed,
  suspendAdminUserShortcut
} from "@/lib/admin/user-actions";

type AdminUsersPageProps = {
  searchParams: Promise<{
    q?: string;
    plan?: string;
    risk?: string;
    role?: string;
    stores?: string;
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

function toneForRisk(status: string) {
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

function exportHref(query: Awaited<AdminUsersPageProps["searchParams"]>, format: "csv" | "json") {
  const params = new URLSearchParams();

  for (const key of ["q", "status", "role", "plan", "stores", "risk"] as const) {
    const value = query[key];

    if (value) {
      params.set(key, value);
    }
  }

  params.set("format", format);

  return `/admin/users/export?${params.toString()}`;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const query = await searchParams;
  const users = await getAdminUsers();
  const filters = adminUserRuntimeFiltersFromParams(query);
  const { planFilter, riskFilter, roleFilter, statusFilter, storeFilter } = filters;
  const roleOptions = Array.from(new Set(users.map((user) => user.primaryRole).filter(Boolean))).sort();
  const planOptions = Array.from(new Set(users.map((user) => user.planId).filter(Boolean))).sort();
  const filteredUsers = filterAdminUsersForRuntime(users, filters);
  const suspendedUsers = users.filter((user) => user.accountStatus === "suspended").length;
  const highRiskUsers = users.filter((user) => user.isHighRisk).length;

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
          { label: "High risk", value: highRiskUsers },
          { label: "New this month", value: users.filter((user) => isNewThisMonth(user.createdAt)).length }
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <form className="grid gap-4 lg:grid-cols-[1fr_repeat(5,180px)_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Search users</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none"
              defaultValue={query.q ?? ""}
              name="q"
              placeholder="Email, name, or user ID"
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
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Role</span>
            <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none" defaultValue={roleFilter} name="role">
              <option value="all">All roles</option>
              {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Plan</span>
            <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none" defaultValue={planFilter} name="plan">
              <option value="all">All plans</option>
              {planOptions.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Stores</span>
            <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none" defaultValue={storeFilter} name="stores">
              <option value="all">All</option>
              <option value="owner">Owns stores</option>
              <option value="none">No stores</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>Risk</span>
            <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none" defaultValue={riskFilter} name="risk">
              <option value="all">All</option>
              <option value="high_risk">High risk</option>
              <option value="reviewed">Reviewed</option>
              <option value="clear">Clear</option>
            </select>
          </label>
          <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
            Filter users
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="inline-flex h-10 items-center rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
            href={exportHref(query, "csv")}
          >
            Export CSV
          </Link>
          <Link
            className="inline-flex h-10 items-center rounded-full border border-blue-200 bg-blue-50 px-4 text-xs font-black uppercase tracking-[0.14em] text-blue-700"
            href={exportHref(query, "json")}
          >
            Export JSON
          </Link>
        </div>
      </div>

      <AdminTable
        empty={!filteredUsers.length ? "No users matched the selected search or filter." : null}
        headers={[
          "User ID",
          "Email",
          "Full name",
          "Role",
          "Created",
          "Last login",
          "Account status",
          "Risk",
          "Workspaces",
          "Stores",
          "Plan",
          "Actions"
        ]}
      >
        {filteredUsers.map((user) => (
          <tr key={user.id}>
            <td className="max-w-64 break-all px-5 py-4 font-bold text-slate-950">
              <Link className="text-blue-700 underline-offset-2 hover:underline" href={`/admin/users/${user.id}`}>
                {user.id}
              </Link>
            </td>
            <td className="px-5 py-4">
              <div className="grid gap-1">
                <Link
                  className="font-bold text-blue-700 underline-offset-2 hover:underline"
                  href={`/admin/users/${user.id}`}
                >
                  {user.emailMasked}
                </Link>
                <Link
                  className="text-xs font-semibold text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
                  href={`/admin/users/${user.id}`}
                >
                  Open user detail
                </Link>
              </div>
            </td>
            <td className="px-5 py-4 text-slate-600">{user.fullName ?? "Not set"}</td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{user.primaryRole}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(user.createdAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(user.lastLoginAt)}</td>
            <td className="px-5 py-4">
              <AdminBadge tone={statusTone(user.accountStatus)}>{user.accountStatus}</AdminBadge>
            </td>
            <td className="px-5 py-4">
              <AdminBadge tone={toneForRisk(user.riskStatus)}>{user.riskStatus}</AdminBadge>
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
                      <p className="break-all">{user.emailMasked}</p>
                      <p className="break-all text-slate-400">{user.id}</p>
                      <p className="mt-2">Role: {user.primaryRole}</p>
                      <p>Last sign-in: {formatAdminDate(user.lastLoginAt)}</p>
                    </section>
                    <section className="rounded-xl bg-white p-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Subscription</p>
                      <p className="mt-2 font-bold text-slate-950">{user.subscription.planName}</p>
                      <p>Status: {user.subscription.status}</p>
                      <p>Period end: {formatAdminDate(user.subscription.currentPeriodEnd)}</p>
                    </section>
                    <section className="rounded-xl bg-white p-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Security / Risk</p>
                      <p className="mt-2">Status: {user.riskStatus}</p>
                      <p>Reviewed: {formatAdminDate(user.reviewedAt)}</p>
                      <div className="mt-2 grid gap-2">
                        {user.securitySignals.length ? (
                          user.securitySignals.map((signal) => (
                            <p className="rounded-lg bg-slate-50 p-2" key={`${user.id}-${signal.label}-${signal.createdAt}`}>
                              <span className="block font-bold text-slate-950">{signal.label}</span>
                              {signal.severity} · {formatAdminDate(signal.createdAt)}
                            </p>
                          ))
                        ) : (
                          <p>No security signals found.</p>
                        )}
                      </div>
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
                <form action={markAdminUserReviewed}>
                  <UserHiddenFields userId={user.id} />
                  <button className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.16em] text-slate-700" type="submit">
                    Mark reviewed
                  </button>
                </form>
                <form action={markAdminUserHighRisk}>
                  <UserHiddenFields userId={user.id} />
                  <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-amber-700" type="submit">
                    Mark high risk
                  </button>
                </form>
                <form action={clearAdminUserRisk}>
                  <UserHiddenFields userId={user.id} />
                  <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-700" type="submit">
                    Clear risk
                  </button>
                </form>
                <form action={suspendAdminUserShortcut}>
                  <UserHiddenFields userId={user.id} />
                  <button className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-red-700" type="submit">
                    Suspend user
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
