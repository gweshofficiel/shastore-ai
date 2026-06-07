import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminInternalTeamControl } from "@/lib/admin/data";
import {
  changeInternalStaffRolePlaceholder,
  inviteInternalStaffPlaceholder,
  restoreInternalStaffPlaceholder,
  suspendInternalStaffPlaceholder,
  viewInternalStaffActivity
} from "@/lib/admin/team-actions";

function toneForStatus(status: string) {
  if (["active", "enforced", "full", "restored_placeholder"].includes(status)) {
    return "green" as const;
  }

  if (["suspended_placeholder"].includes(status)) {
    return "red" as const;
  }

  if (["invited_placeholder", "limited", "specialized"].includes(status)) {
    return "amber" as const;
  }

  return "blue" as const;
}

function roleKeyFromName(role: string) {
  return role.toLowerCase().replace(/\s*\/\s*/g, "_").replace(/-/g, "_").replace(/\s+/g, "_");
}

function StaffHiddenFields({
  currentRoleKey,
  email,
  name,
  roleKey
}: {
  currentRoleKey?: string;
  email: string;
  name: string;
  roleKey?: string;
}) {
  return (
    <>
      <input name="staffEmail" type="hidden" value={email} />
      <input name="staffName" type="hidden" value={name} />
      <input name="currentRoleKey" type="hidden" value={currentRoleKey ?? roleKey ?? "read_only_auditor"} />
      {roleKey ? <input name="roleKey" type="hidden" value={roleKey} /> : null}
    </>
  );
}

function StaffActionButtons({
  currentRoleKey,
  email,
  name,
  role
}: {
  currentRoleKey: string;
  email: string;
  name: string;
  role: string;
}) {
  const isSuperAdmin = currentRoleKey === "super_admin";

  return (
    <div className="grid min-w-56 gap-2">
      <form action={viewInternalStaffActivity}>
        <StaffHiddenFields currentRoleKey={currentRoleKey} email={email} name={name} />
        <button className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700" type="submit">
          View activity
        </button>
      </form>
      <form action={changeInternalStaffRolePlaceholder}>
        <StaffHiddenFields currentRoleKey={currentRoleKey} email={email} name={name} roleKey={currentRoleKey} />
        <button className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700" type="submit">
          Change role
        </button>
      </form>
      <form action={suspendInternalStaffPlaceholder}>
        <StaffHiddenFields currentRoleKey={currentRoleKey} email={email} name={name} />
        <button
          className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={isSuperAdmin}
          title={isSuperAdmin ? "Final Super Admin protection" : `Suspend ${role} placeholder`}
          type="submit"
        >
          Suspend
        </button>
      </form>
      <form action={restoreInternalStaffPlaceholder}>
        <StaffHiddenFields currentRoleKey={currentRoleKey} email={email} name={name} />
        <button className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700" type="submit">
          Restore
        </button>
      </form>
    </div>
  );
}

export default async function AdminTeamPage() {
  const control = await getAdminInternalTeamControl();

  return (
    <div className="grid gap-6 lg:gap-8">
      <AdminHeader
        description="Internal SHASTORE staff governance for platform roles, access areas, permission groups, and audit-only staff actions. This is separate from Store Owner workspace team members and does not rewrite auth."
        title="Team & Internal Roles"
      />

      <AdminStatGrid
        stats={[
          { label: "Internal roles", value: control.overview.roles },
          { label: "Permission groups", value: control.overview.permissionGroups },
          { label: "Active staff", value: control.overview.activeStaff },
          { label: "Invites", value: control.overview.placeholderInvites },
          { label: "Suspended placeholders", value: control.overview.suspendedPlaceholders },
          { label: "Final Super Admin", value: control.overview.finalSuperAdminProtected }
        ]}
      />

      <AdminTable headers={["Invite staff placeholder", "Role", "Action"]}>
        <tr>
          <td className="px-5 py-4">
            <input
              className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none"
              form="internal-staff-invite-form"
              name="staffEmail"
              placeholder="staff@example.com"
              type="email"
            />
          </td>
          <td className="px-5 py-4">
            <select
              className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
              form="internal-staff-invite-form"
              name="roleKey"
            >
              {control.roles.map((role) => (
                <option key={role.key} value={role.key}>{role.name}</option>
              ))}
            </select>
          </td>
          <td className="px-5 py-4">
            <form action={inviteInternalStaffPlaceholder} id="internal-staff-invite-form">
              <button className="h-10 rounded-full border border-slate-900 bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
                Invite placeholder
              </button>
            </form>
          </td>
        </tr>
      </AdminTable>

      <AdminTable headers={["Role", "Access level", "Assigned area", "Permissions summary"]}>
        {control.roles.map((role) => (
          <tr key={role.key}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{role.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{role.key}</p>
            </td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(role.accessLevel)}>{role.accessLevel}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{role.assignedArea}</td>
            <td className="px-5 py-4 text-slate-600">{role.permissionsSummary}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Name / email", "Role", "Status", "Last active", "Created", "Permissions", "Assigned area", "Actions"]}>
        {control.members.map((member) => {
          const currentRoleKey = roleKeyFromName(member.role);

          return (
            <tr key={member.id}>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-950">{member.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{member.email}</p>
              </td>
              <td className="px-5 py-4"><AdminBadge tone="blue">{member.role}</AdminBadge></td>
              <td className="px-5 py-4"><AdminBadge tone={toneForStatus(member.status)}>{member.status}</AdminBadge></td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(member.lastActiveAt)}</td>
              <td className="px-5 py-4 text-slate-600">{formatAdminDate(member.createdAt)}</td>
              <td className="px-5 py-4 text-slate-600">{member.permissionsSummary}</td>
              <td className="px-5 py-4 text-slate-600">{member.assignedArea}</td>
              <td className="px-5 py-4">
                <StaffActionButtons
                  currentRoleKey={currentRoleKey}
                  email={member.email}
                  name={member.name}
                  role={member.role}
                />
              </td>
            </tr>
          );
        })}
      </AdminTable>

      <AdminTable headers={["Permission group", "Key", "Description"]}>
        {control.permissionGroups.map((group) => (
          <tr key={group.key}>
            <td className="px-5 py-4 font-bold text-slate-950">{group.label}</td>
            <td className="px-5 py-4"><AdminBadge tone="slate">{group.key}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{group.description}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Access safety", "Status", "Notes"]}>
        {control.accessSafety.map((item) => (
          <tr key={item.name}>
            <td className="px-5 py-4 font-bold text-slate-950">{item.name}</td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(item.status)}>{item.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{item.note}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable headers={["Future hook", "Status"]}>
        {control.futureHooks.map((hook) => (
          <tr key={hook}>
            <td className="px-5 py-4 font-bold text-slate-950">{hook}</td>
            <td className="px-5 py-4">
              <button
                className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                disabled
                type="button"
              >
                Reserved placeholder
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
