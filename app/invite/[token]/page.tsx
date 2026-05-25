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

  if (!user) {
    const invite = await getInviteTokenPreview(token);

    if (!invite.ok) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
          <Card className="max-w-lg p-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Validating invitation
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink">
              Invitation could not be accepted
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">{invite.message}</p>
            <div className="mt-6 flex justify-center">
              <ButtonLink href="/auth/login">Go to login</ButtonLink>
            </div>
          </Card>
        </main>
      );
    }

    console.info("[invite-auth-redirect] redirecting unauthenticated invite visitor", {
      inviteEmail: invite.email
    });
    redirect(`/auth/login?invite=${encodeURIComponent(token)}`);
  }

  console.info("[invite-auth-success] authenticated invite accept attempt", {
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
