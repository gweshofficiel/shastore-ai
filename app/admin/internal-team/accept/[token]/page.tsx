import Link from "next/link";
import { acceptInternalTeamInvitation, getInternalTeamInviteTokenPreview } from "@/lib/admin/team-actions";
import { createClient } from "@/lib/supabase/server";

type InternalTeamAcceptPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InternalTeamAcceptPage({ params }: InternalTeamAcceptPageProps) {
  const { token } = await params;
  const invite = await getInternalTeamInviteTokenPreview(token);
  const supabase = await createClient({ role: "admin" });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const acceptPath = `/admin/internal-team/accept/${encodeURIComponent(token)}`;
  const loginHref = `/admin/login?next=${encodeURIComponent(acceptPath)}`;
  const registerHref = `/auth/register?next=${encodeURIComponent(acceptPath)}`;
  const emailMatches = Boolean(user?.email && invite.email && user.email.toLowerCase() === invite.email.toLowerCase());

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-white p-8 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">SHASTORE Internal Team</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Accept team invitation</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{invite.message}</p>

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
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="inline-flex h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-black text-white" href={loginHref}>
              Log in to accept
            </Link>
            <Link className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-slate-800" href={registerHref}>
              Create account
            </Link>
          </div>
        ) : !emailMatches ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Log out and sign in with the invited email before accepting this invitation.
          </div>
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
