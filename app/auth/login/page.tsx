import { AuthForm } from "@/components/auth/auth-form";
import { login } from "@/lib/auth-actions";

function safeInviteToken(value: string | string[] | undefined) {
  const token = Array.isArray(value) ? value[0] : value;
  return token && /^[A-Za-z0-9_-]{20,256}$/.test(token) ? token : undefined;
}

function safeNextPath(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return undefined;
  }

  if (next.startsWith("/login") || next.startsWith("/register") || next.startsWith("/auth")) {
    return undefined;
  }

  return next;
}

export default async function AuthLoginPage({
  searchParams
}: {
  searchParams?: Promise<{ invite?: string | string[]; next?: string | string[] }>;
}) {
  const query = await searchParams;
  const inviteToken = safeInviteToken(query?.invite);
  const nextPath = inviteToken ? `/invite/${inviteToken}` : safeNextPath(query?.next);
  const registerHref = inviteToken
    ? `/auth/register?invite=${encodeURIComponent(inviteToken)}`
    : nextPath
      ? `/auth/register?next=${encodeURIComponent(nextPath)}`
      : "/auth/register";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <AuthForm
        action={login}
        buttonLabel="Log in"
        footerHref={registerHref}
        footerLabel="Create an account"
        footerText="New to SHASTORE AI?"
        nextPath={nextPath}
        subtitle={
          inviteToken
            ? "Log in with the invited email to accept your workspace invitation."
            : "Welcome back. Continue building and publishing product landing pages."
        }
        title={inviteToken ? "Log in to accept invite" : "Log in"}
      />
    </main>
  );
}
