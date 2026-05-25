import Link from "next/link";
import { redirect } from "next/navigation";
import { registerWithInvite } from "@/lib/auth-actions";
import { getInviteTokenPreview } from "@/lib/workspace-members";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

function formatRole(value: string) {
  return value.replace(/_/g, " ");
}

export default async function InviteSignupPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const invite = await getInviteTokenPreview(token);

  console.log("[invite-signup-page] rendering invite signup", {
    hasInvite: invite.ok,
    role: invite.role
  });

  if (!invite.ok || !invite.email || !invite.role) {
    redirect(`/invite/${encodeURIComponent(token)}`);
  }

  console.log("[invite-signup-email-locked] invite email locked in signup UI", {
    email: invite.email,
    role: invite.role
  });

  const errorMessage =
    query?.error === "password"
      ? "Passwords do not match."
      : query?.error === "email"
        ? "Use the email address that received this invitation."
        : query?.error === "auth"
          ? "Account could not be created. If you already have an account, log in instead."
          : query?.error === "invite"
            ? "Invitation is invalid or expired."
            : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <Link className="text-base font-black tracking-tight text-ink" href="/">
          SHASTORE AI
        </Link>
        <h1 className="mt-8 text-3xl font-black tracking-tight text-ink">
          Create account for invite
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          You are joining this workspace as <strong>{formatRole(invite.role)}</strong>. This
          invite signup creates only your auth account, then attaches you to the invited
          workspace.
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <form action={registerWithInvite} className="mt-8 grid gap-4">
          <input name="inviteToken" type="hidden" value={token} />
          <Input
            id="email"
            label="Invited email"
            name="email"
            readOnly
            required
            type="email"
            value={invite.email}
          />
          <Input
            id="password"
            label="Password"
            minLength={8}
            name="password"
            required
            type="password"
          />
          <Input
            id="confirmPassword"
            label="Confirm password"
            minLength={8}
            name="confirmPassword"
            required
            type="password"
          />
          <Button className="mt-2 w-full" type="submit">
            Create account and accept invite
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            className="font-semibold text-ink hover:underline"
            href={`/auth/login?invite=${encodeURIComponent(token)}`}
          >
            Log in to accept
          </Link>
        </p>
      </Card>
    </main>
  );
}
