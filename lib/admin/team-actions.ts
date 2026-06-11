"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { configuredSuperAdminEmails } from "@/lib/account-roles";
import { getAdminAccess } from "@/lib/admin-access";
import {
  countActiveInternalSuperAdmins,
  createInternalTeamInviteToken,
  internalTeamDefaultPathForRole,
  hashInternalTeamInviteToken,
  internalTeamInviteAcceptPath,
  internalTeamRoleMeta,
  normalizeInternalTeamRole,
  type InternalTeamRole
} from "@/lib/admin/internal-team-runtime";
import { getPublicUrl } from "@/lib/deployment/config";
import { sendWorkspaceInviteEmailSafe } from "@/lib/notifications/email-provider";
import { getRequestAuditFields, recordSecurityAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type InternalTeamAction =
  | "admin_internal_team_invitation_accepted"
  | "admin_internal_team_invitation_cancelled"
  | "admin_internal_team_invitation_created"
  | "admin_internal_team_invitation_resent"
  | "admin_internal_team_member_restored"
  | "admin_internal_team_member_suspended"
  | "admin_internal_team_role_changed";

function cleanText(value: FormDataEntryValue | null, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanEmail(value: FormDataEntryValue | null) {
  return cleanText(value, 254).toLowerCase();
}

function teamRedirect(status: string): never {
  redirect(`/admin/internal-team?team=${encodeURIComponent(status)}`);
}

function teamInviteRedirect(token: string, status: string): never {
  const params = new URLSearchParams({ invite: status });
  redirect(`${internalTeamInviteAcceptPath(token)}?${params.toString()}`);
}

function cleanPassword(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  if (!admin || !normalizedEmail) {
    return null;
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    console.warn("[internal-team] auth user lookup failed", {
      email: normalizedEmail,
      message: error.message
    });
    return null;
  }

  return data.users.find((user) => user.email?.toLowerCase() === normalizedEmail) ?? null;
}

async function getValidInternalTeamInvitation(token: string) {
  const admin = createAdminClient();

  if (!admin || !/^[A-Za-z0-9_-]{20,256}$/.test(token)) {
    return { admin, invite: null };
  }

  const { data } = await admin
    .from("internal_team_invitations" as never)
    .select("id, email, display_name, role, status, expires_at")
    .eq("token_hash" as never, hashInternalTeamInviteToken(token) as never)
    .maybeSingle();
  const invite = data as {
    display_name?: string | null;
    email?: string | null;
    expires_at?: string | null;
    id: string;
    role?: string | null;
    status?: string | null;
  } | null;

  return { admin, invite };
}

function invitationIsOpen(invite: { expires_at?: string | null; status?: string | null } | null) {
  if (!invite || invite.status !== "pending") {
    return false;
  }

  return !invite.expires_at || new Date(invite.expires_at).getTime() >= Date.now();
}

async function requireSuperAdminTeamAccess() {
  const access = await getAdminAccess();

  if (access.internalRole !== "super_admin") {
    throw new Error("Only Super Admins can manage internal team membership.");
  }

  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required for internal team controls.");
  }

  return { access, admin };
}

async function recordInternalTeamAudit({
  action,
  actorUserId,
  metadata,
  reason,
  targetUserId
}: {
  action: InternalTeamAction;
  actorUserId: string;
  metadata: Record<string, unknown>;
  reason: string;
  targetUserId?: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const request = await getRequestAuditFields();

  await admin.from("monitoring_events" as never).insert({
    entity_id: targetUserId ?? null,
    entity_type: "admin_internal_team_center",
    event_status: "info",
    event_type: action,
    metadata: {
      ...metadata,
      actor_user_id: actorUserId,
      source: "super_admin_internal_team_runtime"
    },
    store_id: null,
    user_id: actorUserId,
    workspace_id: null
  } as never);

  await recordSecurityAuditLog({
    ...request,
    action,
    client: admin,
    metadata: {
      ...metadata,
      actor_user_id: actorUserId,
      source: "super_admin_internal_team_runtime"
    },
    reason,
    route: "/admin/internal-team",
    userId: targetUserId ?? actorUserId
  });
}

async function requireMutableSuperAdminTarget({
  memberId,
  nextRole
}: {
  memberId: string;
  nextRole?: InternalTeamRole;
}) {
  const { access, admin } = await requireSuperAdminTeamAccess();
  const { data, error } = await admin
    .from("internal_team_members" as never)
    .select("id, user_id, email, display_name, role, status")
    .eq("id" as never, memberId as never)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Internal team member was not found.");
  }

  const member = data as {
    display_name?: string | null;
    email?: string | null;
    id: string;
    role?: string | null;
    status?: string | null;
    user_id?: string | null;
  };
  const currentRole = normalizeInternalTeamRole(member.role);
  const configuredAdmins = configuredSuperAdminEmails();
  const activeSuperAdminCount = configuredAdmins.length + await countActiveInternalSuperAdmins(admin);
  const removesSuperAdmin = currentRole === "super_admin" && nextRole !== "super_admin";

  if (member.user_id === access.user.id && removesSuperAdmin) {
    throw new Error("You cannot remove your own Super Admin access.");
  }

  if (removesSuperAdmin && activeSuperAdminCount <= 1) {
    throw new Error("Final Super Admin protection blocks this action.");
  }

  return { access, admin, currentRole, member };
}

export async function inviteInternalStaff(formData: FormData) {
  const { access, admin } = await requireSuperAdminTeamAccess();
  const staffEmail = cleanEmail(formData.get("staffEmail"));
  const staffName = cleanText(formData.get("staffName"));
  const role = normalizeInternalTeamRole(cleanText(formData.get("roleKey")));

  if (!staffEmail) {
    throw new Error("Missing internal staff email.");
  }

  const { data: existingMember } = await admin
    .from("internal_team_members" as never)
    .select("id")
    .ilike("email" as never, staffEmail as never)
    .maybeSingle();

  if (existingMember) {
    throw new Error("This email is already an internal team member.");
  }

  const { token, tokenHash } = createInternalTeamInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const { data: invitation, error } = await admin
    .from("internal_team_invitations" as never)
    .insert({
      display_name: staffName || null,
      email: staffEmail,
      email_status: "attempted",
      expires_at: expiresAt,
      invited_by: access.user.id,
      last_sent_at: now,
      role,
      status: "pending",
      token_hash: tokenHash
    } as never)
    .select("id")
    .single();

  if (error || !invitation) {
    throw new Error("Unable to create internal team invitation.");
  }

  const acceptUrl = getPublicUrl(internalTeamInviteAcceptPath(token));
  await sendWorkspaceInviteEmailSafe({
    acceptUrl,
    email: staffEmail,
    role: internalTeamRoleMeta(role).name
  });

  await recordInternalTeamAudit({
    action: "admin_internal_team_invitation_created",
    actorUserId: access.user.id,
    metadata: {
      email_status: "attempted",
      invitation_id: (invitation as { id: string }).id,
      role,
      staff_email: staffEmail,
      staff_name: staffName || null
    },
    reason: "Super Admin created an internal team invitation.",
    targetUserId: null
  });

  revalidatePath("/admin/team");
  revalidatePath("/admin/internal-team");
  teamRedirect("invited");
}

export async function changeInternalStaffRole(formData: FormData) {
  const memberId = cleanText(formData.get("memberId"), 80);
  const role = normalizeInternalTeamRole(cleanText(formData.get("roleKey")));

  if (!memberId) {
    throw new Error("Missing internal team member ID.");
  }

  const { access, admin, currentRole, member } = await requireMutableSuperAdminTarget({
    memberId,
    nextRole: role
  });

  const { error } = await admin
    .from("internal_team_members" as never)
    .update({ role } as never)
    .eq("id" as never, memberId as never);

  if (error) {
    throw new Error("Unable to change internal team role.");
  }

  await recordInternalTeamAudit({
    action: "admin_internal_team_role_changed",
    actorUserId: access.user.id,
    metadata: {
      member_id: memberId,
      new_role: role,
      previous_role: currentRole,
      staff_email: member.email ?? null
    },
    reason: "Super Admin changed an internal team member role.",
    targetUserId: member.user_id ?? null
  });

  revalidatePath("/admin/team");
  revalidatePath("/admin/internal-team");
}

export async function suspendInternalStaff(formData: FormData) {
  const memberId = cleanText(formData.get("memberId"), 80);

  if (!memberId) {
    throw new Error("Missing internal team member ID.");
  }

  const { access, admin, member } = await requireMutableSuperAdminTarget({
    memberId,
    nextRole: undefined
  });
  const role = normalizeInternalTeamRole(member.role);

  if (role === "super_admin") {
    const activeSuperAdminCount = configuredSuperAdminEmails().length + await countActiveInternalSuperAdmins(admin);

    if (member.user_id === access.user.id || activeSuperAdminCount <= 1) {
      throw new Error("Final Super Admin protection blocks this suspension.");
    }
  }

  const { error } = await admin
    .from("internal_team_members" as never)
    .update({
      status: "suspended",
      suspended_at: new Date().toISOString()
    } as never)
    .eq("id" as never, memberId as never);

  if (error) {
    throw new Error("Unable to suspend internal team member.");
  }

  if (member.user_id) {
    await admin.auth.admin.signOut(member.user_id, "global");
  }

  await recordInternalTeamAudit({
    action: "admin_internal_team_member_suspended",
    actorUserId: access.user.id,
    metadata: {
      member_id: memberId,
      role,
      staff_email: member.email ?? null
    },
    reason: "Super Admin suspended an internal team member without deleting account history.",
    targetUserId: member.user_id ?? null
  });

  revalidatePath("/admin/team");
  revalidatePath("/admin/internal-team");
}

export async function restoreInternalStaff(formData: FormData) {
  const memberId = cleanText(formData.get("memberId"), 80);

  if (!memberId) {
    throw new Error("Missing internal team member ID.");
  }

  const { access, admin, member } = await requireMutableSuperAdminTarget({
    memberId,
    nextRole: normalizeInternalTeamRole((formData.get("currentRoleKey") as string | null) ?? "read_only_auditor")
  });
  const { error } = await admin
    .from("internal_team_members" as never)
    .update({
      restored_at: new Date().toISOString(),
      status: "active"
    } as never)
    .eq("id" as never, memberId as never);

  if (error) {
    throw new Error("Unable to restore internal team member.");
  }

  if (member.user_id) {
    await admin.auth.admin.updateUserById(member.user_id, {
      ban_duration: "none"
    });
  }

  await recordInternalTeamAudit({
    action: "admin_internal_team_member_restored",
    actorUserId: access.user.id,
    metadata: {
      member_id: memberId,
      role: normalizeInternalTeamRole(member.role),
      staff_email: member.email ?? null
    },
    reason: "Super Admin restored an internal team member.",
    targetUserId: member.user_id ?? null
  });

  revalidatePath("/admin/team");
  revalidatePath("/admin/internal-team");
}

export async function resendInternalStaffInvitation(formData: FormData) {
  const { access, admin } = await requireSuperAdminTeamAccess();
  const invitationId = cleanText(formData.get("invitationId"), 80);

  if (!invitationId) {
    throw new Error("Missing invitation ID.");
  }

  const { data, error } = await admin
    .from("internal_team_invitations" as never)
    .select("id, email, display_name, role, status")
    .eq("id" as never, invitationId as never)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Internal team invitation was not found.");
  }

  const invite = data as { display_name?: string | null; email: string; id: string; role: InternalTeamRole; status: string };

  if (invite.status !== "pending") {
    throw new Error("Only pending invitations can be resent.");
  }

  const { token, tokenHash } = createInternalTeamInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("internal_team_invitations" as never)
    .update({
      email_status: "attempted",
      expires_at: expiresAt,
      last_sent_at: now,
      token_hash: tokenHash
    } as never)
    .eq("id" as never, invitationId as never);

  if (updateError) {
    throw new Error("Unable to resend invitation.");
  }

  await sendWorkspaceInviteEmailSafe({
    acceptUrl: getPublicUrl(internalTeamInviteAcceptPath(token)),
    email: invite.email,
    role: internalTeamRoleMeta(normalizeInternalTeamRole(invite.role)).name
  });

  await recordInternalTeamAudit({
    action: "admin_internal_team_invitation_resent",
    actorUserId: access.user.id,
    metadata: {
      invitation_id: invitationId,
      role: invite.role,
      staff_email: invite.email
    },
    reason: "Super Admin resent an internal team invitation.",
    targetUserId: null
  });

  revalidatePath("/admin/team");
  revalidatePath("/admin/internal-team");
}

export async function cancelInternalStaffInvitation(formData: FormData) {
  const { access, admin } = await requireSuperAdminTeamAccess();
  const invitationId = cleanText(formData.get("invitationId"), 80);

  if (!invitationId) {
    throw new Error("Missing invitation ID.");
  }

  const { data, error } = await admin
    .from("internal_team_invitations" as never)
    .update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: access.user.id,
      status: "cancelled"
    } as never)
    .eq("id" as never, invitationId as never)
    .eq("status" as never, "pending" as never)
    .select("email, role")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Unable to cancel pending invitation.");
  }

  const invite = data as { email?: string | null; role?: string | null };

  await recordInternalTeamAudit({
    action: "admin_internal_team_invitation_cancelled",
    actorUserId: access.user.id,
    metadata: {
      invitation_id: invitationId,
      role: normalizeInternalTeamRole(invite.role),
      staff_email: invite.email ?? null
    },
    reason: "Super Admin cancelled an internal team invitation.",
    targetUserId: null
  });

  revalidatePath("/admin/team");
  revalidatePath("/admin/internal-team");
}

export async function getInternalTeamInviteTokenPreview(token: string) {
  const { admin, invite } = await getValidInternalTeamInvitation(token);

  if (!admin) {
    return { authUserExists: false, email: null, message: "Invitation is invalid.", ok: false, role: null, status: "invalid" };
  }

  if (!invite) {
    return { authUserExists: false, email: null, message: "Invitation was not found.", ok: false, role: null, status: "missing" };
  }

  if (invite.status !== "pending") {
    return {
      authUserExists: Boolean(invite.email ? await findAuthUserByEmail(invite.email) : null),
      email: invite.email ?? null,
      message: `Invitation is ${invite.status}.`,
      ok: false,
      role: null,
      status: invite.status ?? "closed"
    };
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return {
      authUserExists: Boolean(invite.email ? await findAuthUserByEmail(invite.email) : null),
      email: invite.email ?? null,
      message: "Invitation has expired.",
      ok: false,
      role: null,
      status: "expired"
    };
  }

  const authUserExists = Boolean(invite.email ? await findAuthUserByEmail(invite.email) : null);

  return {
    authUserExists,
    email: invite.email ?? null,
    message: "Invitation is ready to accept.",
    ok: true,
    role: normalizeInternalTeamRole(invite.role),
    status: "pending"
  };
}

export async function signupInternalTeamInvitee(formData: FormData) {
  const token = cleanText(formData.get("token"), 256);
  const password = cleanPassword(formData.get("password"));
  const confirmPassword = cleanPassword(formData.get("confirmPassword"));
  const { admin, invite } = await getValidInternalTeamInvitation(token);

  if (!admin || !invitationIsOpen(invite) || !invite?.email) {
    teamInviteRedirect(token, "invalid");
  }

  if (password.length < 8 || password !== confirmPassword) {
    teamInviteRedirect(token, "password");
  }

  const invitedEmail = invite.email.toLowerCase();
  const existingUser = await findAuthUserByEmail(invitedEmail);

  if (existingUser) {
    teamInviteRedirect(token, "account-exists");
  }

  const { error } = await admin.auth.admin.createUser({
    email: invitedEmail,
    email_confirm: true,
    password,
    user_metadata: {
      full_name: invite.display_name ?? undefined,
      shastore_internal_invite: true,
      shastore_internal_role: normalizeInternalTeamRole(invite.role)
    }
  });

  if (error) {
    console.warn("[internal-team] invite signup failed", {
      email: invitedEmail,
      message: error.message
    });
    teamInviteRedirect(token, error.message.toLowerCase().includes("already") ? "account-exists" : "signup-failed");
  }

  const supabase = await createClient({ role: "admin" });
  const signIn = await supabase.auth.signInWithPassword({
    email: invitedEmail,
    password
  });

  if (signIn.error || !signIn.data.user) {
    console.warn("[internal-team] invite signup sign-in failed", {
      email: invitedEmail,
      message: signIn.error?.message ?? "No authenticated user returned after signup."
    });
    teamInviteRedirect(token, "login-required");
  }

  await acceptInternalTeamInvitationForUser({
    token,
    user: signIn.data.user
  });
}

export async function loginInternalTeamInvitee(formData: FormData) {
  const token = cleanText(formData.get("token"), 256);
  const password = cleanPassword(formData.get("password"));
  const { invite } = await getValidInternalTeamInvitation(token);

  if (!invitationIsOpen(invite) || !invite?.email) {
    teamInviteRedirect(token, "invalid");
  }

  const supabase = await createClient({ role: "admin" });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: invite.email.toLowerCase(),
    password
  });

  if (error || !data.user) {
    teamInviteRedirect(token, "login-failed");
  }

  await acceptInternalTeamInvitationForUser({
    token,
    user: data.user
  });
}

export async function logoutForInternalTeamInvitation(formData: FormData) {
  const token = cleanText(formData.get("token"), 256);
  const supabase = await createClient({ role: "admin" });

  await supabase.auth.signOut();
  redirect(`${internalTeamInviteAcceptPath(token)}?mode=auth`);
}

export async function enterInternalTeamWorkspace(formData: FormData) {
  const token = cleanText(formData.get("token"), 256);
  const supabase = await createClient({ role: "admin" });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${internalTeamInviteAcceptPath(token)}?mode=auth`);
  }

  const { invite } = await getValidInternalTeamInvitation(token);
  const userEmail = user.email?.toLowerCase();

  if (!invitationIsOpen(invite) || !invite?.email) {
    teamInviteRedirect(token, "invalid");
  }

  if (!userEmail || userEmail !== invite.email.toLowerCase()) {
    await supabase.auth.signOut();
    redirect(`${internalTeamInviteAcceptPath(token)}?mode=auth`);
  }

  await acceptInternalTeamInvitationForUser({
    token,
    user
  });
}

async function acceptInternalTeamInvitationForUser({
  token,
  user
}: {
  token: string;
  user: NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>>["data"]["user"]>;
}) {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Service-role admin access is required to accept internal invitations.");
  }

  const { data } = await admin
    .from("internal_team_invitations" as never)
    .select("id, email, display_name, role, status, expires_at")
    .eq("token_hash" as never, hashInternalTeamInviteToken(token) as never)
    .maybeSingle();
  const invite = data as { display_name?: string | null; email?: string | null; expires_at?: string | null; id: string; role?: string | null; status?: string | null } | null;

  if (!invite || invite.status !== "pending") {
    teamRedirect("invalid-invite");
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    await admin
      .from("internal_team_invitations" as never)
      .update({ status: "expired" } as never)
      .eq("id" as never, invite.id as never);
    teamRedirect("expired");
  }

  const userEmail = user.email?.toLowerCase();

  if (!userEmail || userEmail !== invite.email?.toLowerCase()) {
    throw new Error("You must accept this invitation with the invited email address.");
  }

  const role = normalizeInternalTeamRole(invite.role);
  const now = new Date().toISOString();
  const { data: existingMember } = await admin
    .from("internal_team_members" as never)
    .select("id")
    .ilike("email" as never, userEmail as never)
    .maybeSingle();

  if (existingMember) {
    await admin
      .from("internal_team_members" as never)
      .update({
        accepted_at: now,
        display_name: invite.display_name ?? user.user_metadata?.full_name ?? null,
        role,
        status: "active",
        user_id: user.id
      } as never)
      .eq("id" as never, (existingMember as { id: string }).id as never);
  } else {
    await admin.from("internal_team_members" as never).insert({
      accepted_at: now,
      display_name: invite.display_name ?? user.user_metadata?.full_name ?? null,
      email: userEmail,
      invited_at: now,
      role,
      status: "active",
      user_id: user.id
    } as never);
  }

  await admin
    .from("internal_team_invitations" as never)
    .update({
      accepted_at: now,
      accepted_user_id: user.id,
      status: "accepted"
    } as never)
    .eq("id" as never, invite.id as never);

  await recordInternalTeamAudit({
    action: "admin_internal_team_invitation_accepted",
    actorUserId: user.id,
    metadata: {
      invitation_id: invite.id,
      role,
      staff_email: userEmail
    },
    reason: "Internal team invitation was accepted by the invited user.",
    targetUserId: user.id
  });

  revalidatePath("/admin/team");
  revalidatePath("/admin/internal-team");
  redirect(`${internalTeamDefaultPathForRole(role)}?team=accepted`);
}

export async function acceptInternalTeamInvitation(formData: FormData) {
  await enterInternalTeamWorkspace(formData);
}

