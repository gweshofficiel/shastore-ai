import Link from "next/link";
import {
  acceptInternalTeamInvitation,
  getInternalTeamInviteTokenPreview,
  loginInternalTeamInvitee,
  logoutForInternalTeamInvitation,
  signupInternalTeamInvitee
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
  const supabase = await createClient({ role: "admin" });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const acceptPath = `/admin/internal-team/accept/${encodeURIComponent(token)}`;
  const emailMatches = Boolean(user?.email && invite.email && user.email.toLowerCase() === invite.email.toLowerCase());
  const mode = Array.isArray(query?.mode) ? query?.mode[0] : query?.mode;
  const inviteStatus = Array.isArray(query?.invite) ? query?.invite[0] : query?.invite;
  const showLogin = invite.authUserExists || mode === "login" || inviteStatus === "account-exists" || inviteStatus === "login-required";
  const feedback = inviteFeedback(query?.invite);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-white p-8 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">SHASTORE Internal Team</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Accept team invitation</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{invite.message}</p>
        {feedback ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            {feedback}
          </div>
        ) : null}

        {invite.ok ? (
          <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
            <p>Invited email: <span className="font-black text-slate-950">{invite.email}</span></p>
            <p>Role: <span className="font-black text-slate-950">{invite.role}</span></p>
            <p>Current session: <span className="font-black text-slate-950">{user?.email ?? "Not logged in"}</span></p>
          </div>
        ) : null}

        {!invite.ok ? (
          <Link
            className="mt-6 inline-flex h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white"
            href="/admin/login"
          >
            Go to Admin login
          </Link>
        ) : !user ? (
          showLogin ? (
            <form action={loginInternalTeamInvitee} className="mt-6 grid gap-4">
              <input name="token" type="hidden" value={token} />
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Invited email
                <input
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
                  name="email"
                  readOnly
                  type="email"
                  value={invite.email ?? ""}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Password
                <input
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  minLength={8}
                  name="password"
                  required
                  type="password"
                />
              </label>
              <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
                Log in and continue
              </button>
              {!invite.authUserExists ? (
                <Link className="text-sm font-bold text-slate-600 underline" href={`${acceptPath}?mode=signup`}>
                  Need to create this account?
                </Link>
              ) : null}
            </form>
          ) : (
            <form action={signupInternalTeamInvitee} className="mt-6 grid gap-4">
              <input name="token" type="hidden" value={token} />
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Invited email
                <input
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
                  name="email"
                  readOnly
                  type="email"
                  value={invite.email ?? ""}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Password
                <input
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  minLength={8}
                  name="password"
                  required
                  type="password"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Confirm password
                <input
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  minLength={8}
                  name="confirmPassword"
                  required
                  type="password"
                />
              </label>
              <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
                Create account and continue
              </button>
              <Link className="text-sm font-bold text-slate-600 underline" href={`${acceptPath}?mode=login`}>
                Already have this account?
              </Link>
            </form>
          )
        ) : !emailMatches ? (
          <>
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              Log out and sign in with the invited email before accepting this invitation.
            </div>
            <form action={logoutForInternalTeamInvitation} className="mt-4">
              <input name="token" type="hidden" value={token} />
              <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
                Log out and return to invitation
              </button>
            </form>
          </>
        ) : (
          <form action={acceptInternalTeamInvitation} className="mt-6">
            <input name="token" type="hidden" value={token} />
            <button className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white" type="submit">
              Accept invitation
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
