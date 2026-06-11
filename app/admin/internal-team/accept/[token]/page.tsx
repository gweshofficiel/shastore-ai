import Link from "next/link";
import { InternalTeamInviteAuthForm } from "@/components/admin/internal-team-invite-auth-form";
import {
  enterInternalTeamWorkspace,
  getInternalTeamInviteTokenPreview
} from "@/lib/admin/team-actions";
import { createClient } from "@/lib/supabase/server";

type InternalTeamAcceptPageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams?: Promise<{
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

  if (status === "invalid") {
    return "This invitation can no longer be accepted.";
  }

  return null;
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
  const showAuthForm =
    mode === "setup" ||
    mode === "login" ||
    mode === "signup" ||
    inviteStatus === "account-exists" ||
    inviteStatus === "login-failed" ||
    inviteStatus === "login-required" ||
    inviteStatus === "password" ||
    inviteStatus === "signup-failed";
  const showLogin = invite.authUserExists || mode === "login" || inviteStatus === "account-exists" || inviteStatus === "login-required";
  const feedback = inviteFeedback(query?.invite);
  const title = showAuthForm && !emailMatches ? "Set up your internal team account" : "You are invited to join the internal team";
  const setupApiPath = `/api/admin/internal-team/invitations/${encodeURIComponent(token)}/setup`;

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
              email={invite.email ?? ""}
              mode="login"
              setupApiPath={setupApiPath}
              switchHref={`${acceptPath}?mode=setup`}
              token={token}
            />
          ) : (
            <InternalTeamInviteAuthForm
              email={invite.email ?? ""}
              mode="signup"
              setupApiPath={setupApiPath}
              switchHref={`${acceptPath}?mode=login`}
              token={token}
            />
          )
        ) : null}
      </div>
    </main>
  );
}
