import Link from "next/link";
import { AdminBadge, AdminHeader } from "@/components/admin/admin-control";
import { getAdminAccess } from "@/lib/admin-access";
import { internalTeamDefaultPathForRole, internalTeamRoleMeta } from "@/lib/admin/internal-team-runtime";

export default async function InternalTeamWorkspacePage() {
  const access = await getAdminAccess();
  const role = internalTeamRoleMeta(access.internalRole);
  const rolePath = internalTeamDefaultPathForRole(access.internalRole);

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Role-scoped workspace entry for internal team accounts."
        title="Internal Team Workspace"
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <AdminBadge tone="blue">{role.name}</AdminBadge>
          <span className="text-sm font-bold text-slate-500">{access.user.email}</span>
        </div>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Your access is limited to the workspace and admin areas assigned to this internal team role.
        </p>
        {rolePath !== "/admin/internal-team/workspace" ? (
          <Link
            className="mt-5 inline-flex h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white"
            href={rolePath}
          >
            Open assigned workspace
          </Link>
        ) : null}
      </section>
    </div>
  );
}
