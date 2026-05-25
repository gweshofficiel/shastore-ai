import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acceptInviteToken, getInviteTokenPreview } from "@/lib/workspace-members";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const invitePath = `/invite/${token}`;

  if (!user) {
    const invite = await getInviteTokenPreview(token);

    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
        <Card className="max-w-lg p-8 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Workspace invitation
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
            Accept your SHASTORE AI invite
          </h1>
          {invite.ok ? (
            <>
              <p className="mt-3 text-sm font-semibold leading-6 text-muted">
                This invitation is for <strong>{invite.email}</strong>. Log in or create an
                account with that email to join the workspace.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <ButtonLink href={`/login?next=${encodeURIComponent(invitePath)}`}>
                  Log in
                </ButtonLink>
                <ButtonLink href={`/register?next=${encodeURIComponent(invitePath)}`} variant="secondary">
                  Create account
                </ButtonLink>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-semibold leading-6 text-muted">{invite.message}</p>
              <div className="mt-6 flex justify-center">
                <ButtonLink href="/login">Go to login</ButtonLink>
              </div>
            </>
          )}
        </Card>
      </main>
    );
  }

  console.info("[invite-auth] authenticated invite accept attempt", {
    userEmail: user.email ?? null,
    userId: user.id
  });

  const result = await acceptInviteToken(token, user.id, user.email);

  if (result.ok) {
    redirect("/dashboard/team?team=invite-accepted");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <Card className="max-w-lg p-8 text-center">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Workspace invitation
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
          Invitation could not be accepted
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">{result.message}</p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/dashboard/team">Go to team</ButtonLink>
        </div>
      </Card>
    </main>
  );
}
