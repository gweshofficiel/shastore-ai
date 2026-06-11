import { NextRequest, NextResponse } from "next/server";
import {
  hashInternalTeamInviteToken,
  internalTeamDefaultPathForRole,
  normalizeInternalTeamRole
} from "@/lib/admin/internal-team-runtime";
import { getRequestAuditFields, recordSecurityAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SetupRouteProps = {
  params: Promise<{
    token: string;
  }>;
};

function invitePath(token: string, status?: string) {
  const params = new URLSearchParams();

  if (status) {
    params.set("invite", status);
    params.set("mode", "setup");
  }

  return `/admin/internal-team/accept/${encodeURIComponent(token)}${params.size ? `?${params.toString()}` : ""}`;
}

function isOpenInvite(invite: { expires_at?: string | null; status?: string | null } | null) {
  if (!invite || invite.status !== "pending") {
    return false;
  }

  return !invite.expires_at || new Date(invite.expires_at).getTime() >= Date.now();
}

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    console.warn("[internal-team-setup] auth user lookup failed", {
      email,
      message: error.message
    });
    return null;
  }

  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function POST(request: NextRequest, { params }: SetupRouteProps) {
  const { token } = await params;
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const admin = createAdminClient();

  if (!admin || !/^[A-Za-z0-9_-]{20,256}$/.test(token)) {
    return NextResponse.redirect(new URL(invitePath(token, "invalid"), request.url));
  }

  if (password.length < 8 || password !== confirmPassword) {
    return NextResponse.redirect(new URL(invitePath(token, "password"), request.url));
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

  if (!isOpenInvite(invite) || !invite?.email) {
    if (invite?.status === "pending" && invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      await admin
        .from("internal_team_invitations" as never)
        .update({ status: "expired" } as never)
        .eq("id" as never, invite.id as never);
    }

    return NextResponse.redirect(new URL(invitePath(token, "invalid"), request.url));
  }

  const invitedEmail = invite.email.toLowerCase();
  const existingUser = await findAuthUserByEmail(invitedEmail);
  const internalSupabase = await createClient({ role: "internal_team" });
  const {
    data: { user: activeInternalUser }
  } = await internalSupabase.auth.getUser();

  if (activeInternalUser?.email?.toLowerCase() !== invitedEmail) {
    await internalSupabase.auth.signOut();
  }

  if (!existingUser) {
    const { error: createError } = await admin.auth.admin.createUser({
      email: invitedEmail,
      email_confirm: true,
      password,
      user_metadata: {
        full_name: invite.display_name ?? undefined,
        shastore_internal_invite: true,
        shastore_internal_role: normalizeInternalTeamRole(invite.role)
      }
    });

    if (createError) {
      console.warn("[internal-team-setup] auth user creation failed", {
        email: invitedEmail,
        message: createError.message
      });
      return NextResponse.redirect(new URL(invitePath(token, "signup-failed"), request.url));
    }
  }

  const { data: signInData, error: signInError } = await internalSupabase.auth.signInWithPassword({
    email: invitedEmail,
    password
  });

  if (signInError || !signInData.user || signInData.user.email?.toLowerCase() !== invitedEmail) {
    return NextResponse.redirect(new URL(invitePath(token, existingUser ? "login-failed" : "login-required"), request.url));
  }

  const role = normalizeInternalTeamRole(invite.role);
  const now = new Date().toISOString();
  const { data: existingMember } = await admin
    .from("internal_team_members" as never)
    .select("id")
    .ilike("email" as never, invitedEmail as never)
    .maybeSingle();

  if (existingMember) {
    await admin
      .from("internal_team_members" as never)
      .update({
        accepted_at: now,
        display_name: invite.display_name ?? signInData.user.user_metadata?.full_name ?? null,
        role,
        status: "active",
        user_id: signInData.user.id
      } as never)
      .eq("id" as never, (existingMember as { id: string }).id as never);
  } else {
    await admin.from("internal_team_members" as never).insert({
      accepted_at: now,
      display_name: invite.display_name ?? signInData.user.user_metadata?.full_name ?? null,
      email: invitedEmail,
      invited_at: now,
      role,
      status: "active",
      user_id: signInData.user.id
    } as never);
  }

  await admin.from("profiles" as never).upsert({
    email: invitedEmail,
    full_name: invite.display_name ?? signInData.user.user_metadata?.full_name ?? null,
    id: signInData.user.id
  } as never);

  await admin
    .from("internal_team_invitations" as never)
    .update({
      accepted_at: now,
      accepted_by_user_id: signInData.user.id,
      accepted_user_id: signInData.user.id,
      status: "accepted"
    } as never)
    .eq("id" as never, invite.id as never)
    .eq("status" as never, "pending" as never);

  const auditMetadata = {
    invitation_id: invite.id,
    role,
    source: "internal_team_isolated_setup",
    staff_email: invitedEmail
  };
  await admin.from("monitoring_events" as never).insert({
    entity_id: signInData.user.id,
    entity_type: "admin_internal_team_center",
    event_status: "info",
    event_type: "admin_internal_team_invitation_accepted",
    metadata: auditMetadata,
    store_id: null,
    user_id: signInData.user.id,
    workspace_id: null
  } as never);

  await recordSecurityAuditLog({
    ...(await getRequestAuditFields()),
    action: "admin_internal_team_invitation_accepted",
    client: admin,
    metadata: auditMetadata,
    reason: "Internal team invitation accepted through isolated setup flow.",
    route: "/admin/internal-team/accept/[token]/setup",
    userId: signInData.user.id
  });

  return NextResponse.redirect(new URL(`${internalTeamDefaultPathForRole(role)}?team=accepted`, request.url));
}
