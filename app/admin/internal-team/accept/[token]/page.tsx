import Link from "next/link";
import { headers } from "next/headers";
import { InternalTeamInviteAuthForm } from "@/components/admin/internal-team-invite-auth-form";
import { InternalTeamInviteSessionWarning } from "@/components/admin/internal-team-invite-session-warning";
import {
  getAccountRoleForUser,
  isConfiguredSuperAdminEmail
} from "@/lib/account-roles";
import {
  enterInternalTeamWorkspace,
  getInternalTeamInviteTokenPreview,
  continueInternalTeamInviteSetup,
  submitInternalTeamInviteSetup
} from "@/lib/admin/team-actions";
import { createClient } from "@/lib/supabase/server";

type InternalTeamAcceptPageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams?: Promise<{
    continue?: string | string[];
    invite?: string | string[];
    mode?: string | string[];
  }>;
};

function inviteFeedback(value: string | string[] | undefined) {
  const status = Array.isArray(value) ? value[0] : value;

  if (status === "account-exists") {
    return "An account already exists for this email. Log in with that password to continue.";
  }

  if (status === "login-failed") {
    return "Login failed for the invited email. Check the password and try again.";
  }

  if (status === "login-required") {
    return "Account created. Log in with the invited email to continue.";
  }

  if (status === "password") {
    return "Password must be at least 8 characters and match the confirmation.";
  }

  if (status === "signup-failed") {
    return "Account creation failed. Try again or use login if the account already exists.";
  }

  if (status === "already-accepted") {
    return "This invitation has already been accepted.";
  }

  if (status === "expired") {
    return "This invitation has expired.";
  }

  if (status === "invalid") {
    return "This invitation can no longer be accepted.";
  }

  if (status === "role-failed") {
    return "Unable to assign the invited internal team role. Try again.";
  }

  return null;
}

async function hasActivePlatformOwnerSession() {
  const [adminSupabase, ownerSupabase] = await Promise.all([
    createClient({ role: "admin" }),
    createClient({ role: "owner" })
  ]);
  const [adminAuth, ownerAuth] = await Promise.all([
    adminSupabase.auth.getUser(),
    ownerSupabase.auth.getUser()
  ]);
  const adminUser = adminAuth.data.user;
  const ownerUser = ownerAuth.data.user;

  if (adminUser) {
    const adminRole = await getAccountRoleForUser(adminSupabase, adminUser.id);
    const isSuperAdmin =
      isConfiguredSuperAdminEmail(adminUser.email) &&
      adminRole?.role === "super_admin" &&
      adminRole.status === "active";

    if (isSuperAdmin) {
      return true;
    }
  }

  if (ownerUser) {
    const ownerRole = await getAccountRoleForUser(ownerSupabase, ownerUser.id);

    if (ownerRole?.role === "owner" && ownerRole.status === "active") {
      return true;
    }
  }

  return false;
}

async function absoluteInviteUrl(path: string) {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";

  return host ? `${protocol}://${host}${path}` : path;
}

export default async function InternalTeamAcceptPage({ params, searchParams }: InternalTeamAcceptPageProps) {
  const { token } = await params;
  const query = await searchParams;
  const invite = await getInternalTeamInviteTokenPreview(token);
  const supabase = await createClient({ role: "internal_team" });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const acceptPath = `/admin/internal-team/accept/${encodeURIComponent(token)}`;
  const emailMatches = Boolean(user?.email && invite.email && user.email.toLowerCase() === invite.email.toLowerCase());
  const mode = Array.isArray(query?.mode) ? query?.mode[0] : query?.mode;
  const inviteStatus = Array.isArray(query?.invite) ? query?.invite[0] : query?.invite;
  const continueSetup = (Array.isArray(query?.continue) ? query?.continue[0] : query?.continue) === "1";
  const showOwnerSessionWarning =
    invite.ok &&
    !continueSetup &&
    !emailMatches &&
    await hasActivePlatformOwnerSession();
  const showAuthForm =
    mode === "setup" ||
    mode === "login" ||
    mode === "signup" ||
    inviteStatus === "account-exists" ||
    inviteStatus === "login-failed" ||
    inviteStatus === "login-required" ||
    inviteStatus === "password" ||
    inviteStatus === "role-failed" ||
    inviteStatus === "signup-failed" ||
    inviteStatus === "expired" ||
    inviteStatus === "already-accepted";
  const showLogin = invite.authUserExists || mode === "login" || inviteStatus === "account-exists" || inviteStatus === "login-required";
  const feedback = inviteFeedback(query?.invite);
  const title =
    showOwnerSessionWarning || showAuthForm && !emailMatches
      ? "Set up your internal team account"
      : "You are invited to join the internal team";
  const acceptUrl = await absoluteInviteUrl(acceptPath);
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-white p-8 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">SHASTORE AI</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">{title}</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{invite.message}</p>
        {feedback ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            {feedback}
          </div>
        ) : null}

        {invite.ok ? (
          <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
            <p>Invited email: <span className="font-black text-slate-950">{invite.email}</span></p>
            <p>Invited role: <span className="font-black text-slate-950">{invite.role}</span></p>
            <p>Invitation status: <span className="font-black text-slate-950">{invite.status}</span></p>
            {user && !emailMatches ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                A different admin session is active.
              </p>
            ) : null}
          </div>
        ) : null}

        {!invite.ok ? (
          <Link
            className="mt-6 inline-flex h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white"
            href="/"
          >
            Return home
          </Link>
        ) : showOwnerSessionWarning ? (
          <InternalTeamInviteSessionWarning
            acceptUrl={acceptUrl}
            continueAction={continueInternalTeamInviteSetup}
            token={token}
          />
        ) : !showAuthForm || (user && !emailMatches) || emailMatches ? (
          <form action={enterInternalTeamWorkspace} className="mt-6">
            <input name="token" type="hidden" value={token} />
            <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
              Enter your workspace
            </button>
          </form>
        ) : !emailMatches ? (
          showLogin ? (
            <InternalTeamInviteAuthForm
              action={submitInternalTeamInviteSetup}
              email={invite.email ?? ""}
              mode="login"
              switchHref={`${acceptPath}?mode=setup`}
              token={token}
            />
          ) : (
            <InternalTeamInviteAuthForm
              action={submitInternalTeamInviteSetup}
              email={invite.email ?? ""}
              mode="signup"
              switchHref={`${acceptPath}?mode=login`}
              token={token}
            />
          )
        ) : null}
      </div>
    </main>
  );
}
