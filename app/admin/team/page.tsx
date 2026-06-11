import {
  AdminBadge,
  AdminHeader,
  AdminStatGrid,
  AdminTable,
  formatAdminDate
} from "@/components/admin/admin-control";
import { getAdminInternalTeamControl } from "@/lib/admin/data";
import {
  cancelInternalStaffInvitation,
  changeInternalStaffRole,
  inviteInternalStaff,
  resendInternalStaffInvitation,
  restoreInternalStaff,
  suspendInternalStaff
} from "@/lib/admin/team-actions";

type InternalTeamControl = Awaited<ReturnType<typeof getAdminInternalTeamControl>>;

function toneForStatus(status: string) {
  if (["accepted", "active", "enforced", "full", "runtime", "sent"].includes(status)) {
    return "green" as const;
  }

  if (["cancelled", "expired", "failed", "suspended"].includes(status)) {
    return "red" as const;
  }

  if (["attempted", "limited", "pending", "specialized"].includes(status)) {
    return "amber" as const;
  }

  return "blue" as const;
}

function StaffHiddenFields({ currentRoleKey, memberId }: { currentRoleKey: string; memberId: string }) {
  return (
    <>
      <input name="memberId" type="hidden" value={memberId} />
      <input name="currentRoleKey" type="hidden" value={currentRoleKey} />
    </>
  );
}

function StaffActionButtons({
  currentRoleKey,
  memberId,
  roles,
  status
}: {
  currentRoleKey: string;
  memberId: string;
  roles: InternalTeamControl["roles"];
  status: string;
}) {
  const isSuperAdmin = currentRoleKey === "super_admin";

  return (
    <div className="grid min-w-56 gap-2">
      <form action={changeInternalStaffRole} className="grid gap-2">
        <StaffHiddenFields currentRoleKey={currentRoleKey} memberId={memberId} />
        <select
          className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
          defaultValue={currentRoleKey}
          disabled={isSuperAdmin}
          name="roleKey"
        >
          {roles.map((role) => (
            <option key={role.key} value={role.key}>{role.name}</option>
          ))}
        </select>
        <button
          className="h-9 w-full rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={isSuperAdmin}
          type="submit"
        >
          Change role
        </button>
      </form>
      <form action={suspendInternalStaff}>
        <StaffHiddenFields currentRoleKey={currentRoleKey} memberId={memberId} />
        <button
          className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={isSuperAdmin || status === "suspended"}
          title={isSuperAdmin ? "Final Super Admin protection" : "Suspend member"}
          type="submit"
        >
          Suspend
        </button>
      </form>
      <form action={restoreInternalStaff}>
        <StaffHiddenFields currentRoleKey={currentRoleKey} memberId={memberId} />
        <button
          className="h-9 w-full rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={status === "active"}
          type="submit"
        >
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
        description="Internal SHASTORE staff governance for platform roles, access areas, invitations, RBAC, and audited staff actions. This is separate from Store Owner workspace team members."
        title="Team & Internal Roles"
      />

      <AdminStatGrid
        stats={[
          { label: "Internal roles", value: control.overview.roles },
          { label: "Permission groups", value: control.overview.permissionGroups },
          { label: "Active staff", value: control.overview.activeStaff },
          { label: "Pending invites", value: control.overview.pendingInvites },
          { label: "Suspended staff", value: control.overview.suspendedStaff },
          { label: "Final Super Admin", value: control.overview.finalSuperAdminProtected }
        ]}
      />

      <AdminTable headers={["Invite staff", "Display name", "Role", "Action"]}>
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
            <input
              className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none"
              form="internal-staff-invite-form"
              name="staffName"
              placeholder="Display name"
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
            <form action={inviteInternalStaff} id="internal-staff-invite-form">
              <button className="h-10 rounded-full border border-slate-900 bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white" type="submit">
                Invite staff
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

      <AdminTable
        empty={!control.members.length ? "No internal team members found." : null}
        headers={["User ID", "Name / email", "Role", "Status", "Invited", "Accepted", "Last active", "Permissions", "Assigned area", "Actions"]}
      >
        {control.members.map((member) => (
          <tr key={member.id}>
            <td className="break-all px-5 py-4 text-xs font-bold text-slate-500">{member.userId ?? member.id}</td>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{member.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{member.email}</p>
            </td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{member.role}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(member.status)}>{member.status}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(member.invitedAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(member.acceptedAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(member.lastActiveAt)}</td>
            <td className="px-5 py-4 text-slate-600">{member.permissionsSummary}</td>
            <td className="px-5 py-4 text-slate-600">{member.assignedArea}</td>
            <td className="px-5 py-4">
              <StaffActionButtons
                currentRoleKey={member.roleKey}
                memberId={member.id}
                roles={control.roles}
                status={member.status}
              />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        empty={!control.invitations.length ? "No internal team invitations found." : null}
        headers={["Invite", "Role", "Status", "Email", "Invited", "Expires", "Accepted", "Actions"]}
      >
        {control.invitations.map((invite) => (
          <tr key={invite.id}>
            <td className="px-5 py-4">
              <p className="font-bold text-slate-950">{invite.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{invite.email}</p>
            </td>
            <td className="px-5 py-4"><AdminBadge tone="blue">{invite.role}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(invite.status)}>{invite.status}</AdminBadge></td>
            <td className="px-5 py-4"><AdminBadge tone={toneForStatus(invite.emailStatus)}>{invite.emailStatus}</AdminBadge></td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(invite.invitedAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(invite.expiresAt)}</td>
            <td className="px-5 py-4 text-slate-600">{formatAdminDate(invite.acceptedAt)}</td>
            <td className="px-5 py-4">
              <div className="grid min-w-44 gap-2">
                <form action={resendInternalStaffInvitation}>
                  <input name="invitationId" type="hidden" value={invite.id} />
                  <button
                    className="h-9 w-full rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={invite.status !== "pending"}
                    type="submit"
                  >
                    Resend
                  </button>
                </form>
                <form action={cancelInternalStaffInvitation}>
                  <input name="invitationId" type="hidden" value={invite.id} />
                  <button
                    className="h-9 w-full rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black uppercase tracking-[0.14em] text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={invite.status !== "pending"}
                    type="submit"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
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
    </div>
  );
}
