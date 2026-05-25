import { PageHeader } from "@/components/dashboard/page-header";
import { ConfirmSubmitButton } from "@/components/dashboard/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getUserSubscriptionAccessForClient } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveWorkspaceForUser,
  switchActiveWorkspace
} from "@/lib/workspaces/active-workspace";
import {
  canManageWorkspace,
  changeMemberRole,
  getWorkspaceMembers,
  inviteMember,
  removeMember,
  resendInvite,
  type WorkspaceMember
} from "@/lib/workspace-members";

export const dynamic = "force-dynamic";

function formatRole(value: string) {
  return value.replace(/_/g, " ");
}

async function resolveMemberEmails(members: WorkspaceMember[]) {
  const admin = createAdminClient();
  const emails = new Map<string, string>();

  if (!admin || members.length === 0) {
    return emails;
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    console.warn("[workspace-member] member email lookup failed", {
      message: error.message
    });
    return emails;
  }

  for (const user of data.users) {
    if (user.email) {
      emails.set(user.id, user.email);
    }
  }

  return emails;
}

export default async function TeamPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; team?: string; workspace?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="grid gap-6">
        <PageHeader
          description="Sign in to manage workspace team members."
          title="Team"
        />
        <Card className="p-6">
          <p className="text-sm font-bold text-muted">Please sign in to manage your team.</p>
        </Card>
      </div>
    );
  }

  const selection = await getActiveWorkspaceForUser({
    requestedWorkspaceId: query.workspace,
    supabase,
    userId: user.id
  });
  const workspaceId = selection.activeWorkspaceId;
  const billingClient = createAdminClient() ?? supabase;

  console.log("[workspace-selection] team page workspace selected", {
    role: selection.activeWorkspaceRole,
    source: selection.source,
    userId: user.id,
    workspaceId
  });

  const [access, management] = await Promise.all([
    getUserSubscriptionAccessForClient(billingClient, workspaceId),
    canManageWorkspace(supabase, workspaceId, user.id)
  ]);

  if (!management.allowed) {
    console.warn("[permission-denied] team page denied", {
      permission: "manage_team",
      role: management.role,
      userId: user.id,
      workspaceId
    });

  }

  const { invites, invitesError, members, membersError } = await getWorkspaceMembers(
    supabase,
    workspaceId,
    user.id
  );
  const memberEmails = await resolveMemberEmails(members);
  const limit = access.usage.teamMemberLimit;
  const seatsUsed = members.length + invites.length;
  const seatsLabel = limit === null ? `${seatsUsed} / Unlimited` : `${seatsUsed} / ${limit}`;
  const seatsAtLimit = limit !== null && seatsUsed >= limit;

  return (
    <div className="grid gap-6 lg:gap-8">
      <PageHeader
        description="Invite teammates to help manage your SHASTORE AI workspace securely."
        title="Team"
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Active workspace
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-ink">
              {workspaceId === user.id ? "Personal workspace" : `Workspace ${workspaceId.slice(0, 8)}`}
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted">
              Current role: {formatRole(selection.activeWorkspaceRole)}
            </p>
          </div>
          <form action={switchActiveWorkspace} className="flex flex-wrap items-end gap-3">
            <input name="next" type="hidden" value="/dashboard/team" />
            <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor="workspaceId">
              <span>Switch workspace</span>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                defaultValue={workspaceId}
                id="workspaceId"
                name="workspaceId"
              >
                {selection.workspaces.map((workspace) => (
                  <option key={workspace.workspaceId} value={workspace.workspaceId}>
                    {workspace.isPersonal
                      ? "Personal workspace"
                      : `Workspace ${workspace.workspaceId.slice(0, 8)}`}{" "}
                    - {formatRole(workspace.role)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              Switch
            </Button>
          </form>
        </div>
      </Card>

      {query.team === "error" ? (
        <Card className="border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">
            {query.message ?? "Team action failed. Please try again."}
          </p>
        </Card>
      ) : null}
      {query.team && query.team !== "error" ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            {query.team === "invite-created"
              ? "Invite created and email delivery was attempted."
              : query.team === "invite-resent"
                ? "Invite email resent."
              : query.team === "member-added"
                ? "Member added to the workspace."
                : query.team === "removed"
                  ? "Team member or invite removed."
                    : query.team === "member-role-updated"
                      ? "Team member role updated."
                  : query.team === "invite-accepted"
                    ? "Invitation accepted. Welcome to the workspace."
                  : "Team updated."}
          </p>
        </Card>
      ) : null}
      {membersError || invitesError ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">
            {membersError ?? invitesError}
          </p>
        </Card>
      ) : null}
      {!management.allowed ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">
            You can view this workspace, but only owners and admins can invite or remove team
            members.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Workspace seats
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
            {seatsLabel}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Current plan: {access.plan.name}. Owners count as a member. Pending invites reserve a seat.
          </p>
          {seatsAtLimit ? (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
              Your current plan has reached its team member limit. Upgrade at /dashboard/billing.
            </div>
          ) : null}
        </Card>

        <Card className="p-6 lg:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Invite teammate
          </p>
          <form action={inviteMember} className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px_auto]">
            <input name="workspaceId" type="hidden" value={workspaceId} />
            <Input
              disabled={!management.allowed || seatsAtLimit}
              id="email"
              label="Email"
              name="email"
              placeholder="teammate@example.com"
              type="email"
            />
            <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor="role">
              <span>Role</span>
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                disabled={!management.allowed || seatsAtLimit}
                id="role"
                name="role"
                defaultValue="editor"
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="support">Support</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button disabled={!management.allowed || seatsAtLimit} type="submit">
                Invite
              </Button>
            </div>
          </form>
          {!management.allowed ? (
            <p className="mt-4 text-sm font-bold text-amber-700">
              Only workspace owners and admins can invite or remove members.
            </p>
          ) : null}
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Members
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              Workspace access
            </h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">
            {members.length} active
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {members.map((member) => (
            <div
              className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_auto]"
              key={member.id}
            >
              <div>
                <p className="font-black text-ink">
                  {memberEmails.get(member.user_id) ?? member.user_id}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                  {formatRole(member.role)}
                </p>
              </div>
              {member.role !== "owner" && management.allowed ? (
                <div className="flex flex-wrap items-end gap-2">
                  <form action={changeMemberRole} className="flex flex-wrap items-end gap-2">
                    <input name="workspaceId" type="hidden" value={workspaceId} />
                    <input name="memberId" type="hidden" value={member.id} />
                    <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor={`role-${member.id}`}>
                      <span>Change role</span>
                      <select
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        defaultValue={member.role}
                        id={`role-${member.id}`}
                        name="role"
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="support">Support</option>
                      </select>
                    </label>
                    <Button type="submit" variant="secondary">
                      Change role
                    </Button>
                  </form>
                  <form action={removeMember}>
                    <input name="workspaceId" type="hidden" value={workspaceId} />
                    <input name="memberId" type="hidden" value={member.id} />
                    <ConfirmSubmitButton
                      confirmMessage="Remove this member from the workspace?"
                      type="submit"
                      variant="secondary"
                    >
                      Remove
                    </ConfirmSubmitButton>
                  </form>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Pending invites
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">
              Email invite foundation
            </h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">
            {invites.length} pending
          </span>
        </div>

        {invites.length ? (
          <div className="mt-5 grid gap-3">
            {invites.map((invite) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                key={invite.id}
              >
                <div>
                  <p className="font-black text-ink">{invite.email}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                    Pending {formatRole(invite.role)}
                  </p>
                  {invite.expires_at ? (
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Expires {new Intl.DateTimeFormat("en", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      }).format(new Date(invite.expires_at))}
                    </p>
                  ) : null}
                </div>
                {management.allowed ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={resendInvite}>
                      <input name="workspaceId" type="hidden" value={workspaceId} />
                      <input name="inviteId" type="hidden" value={invite.id} />
                      <Button type="submit" variant="secondary">
                        Resend
                      </Button>
                    </form>
                    <form action={removeMember}>
                      <input name="workspaceId" type="hidden" value={workspaceId} />
                      <input name="inviteId" type="hidden" value={invite.id} />
                      <Button type="submit" variant="secondary">
                        Revoke
                      </Button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-muted">
            No pending invites.
          </p>
        )}
      </Card>
    </div>
  );
}
