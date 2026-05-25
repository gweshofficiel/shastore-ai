import { AuthForm } from "@/components/auth/auth-form";
import { register } from "@/lib/auth-actions";

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

export default async function AuthRegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ invite?: string | string[]; next?: string | string[] }>;
}) {
  const query = await searchParams;
  const inviteToken = safeInviteToken(query?.invite);
  const nextPath = inviteToken ? `/invite/${inviteToken}` : safeNextPath(query?.next);
  const loginHref = inviteToken
    ? `/auth/login?invite=${encodeURIComponent(inviteToken)}`
    : nextPath
      ? `/auth/login?next=${encodeURIComponent(nextPath)}`
      : "/auth/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <AuthForm
        action={register}
        buttonLabel="Create account"
        footerHref={loginHref}
        footerLabel="Log in"
        footerText="Already have an account?"
        nextPath={nextPath}
        subtitle={
          inviteToken
            ? "Create an account with the invited email. After verification, the invite will be accepted automatically."
            : "Create your workspace and launch your first product landing page."
        }
        title={inviteToken ? "Create account to accept invite" : "Start selling faster"}
      />
    </main>
  );
}
