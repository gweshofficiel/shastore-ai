import { AuthForm } from "@/components/auth/auth-form";
import { login } from "@/lib/auth-actions";

function safeNextPath(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return undefined;
  }

  if (next.startsWith("/login") || next.startsWith("/register")) {
    return undefined;
  }

  return next;
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const nextPath = safeNextPath((await searchParams)?.next);
  const registerHref = nextPath ? `/register?next=${encodeURIComponent(nextPath)}` : "/register";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <AuthForm
        action={login}
        buttonLabel="Log in"
        footerHref={registerHref}
        footerLabel="Create an account"
        footerText="New to SHASTORE AI?"
        nextPath={nextPath}
        subtitle="Welcome back. Continue building and publishing product landing pages."
        title="Log in"
      />
    </main>
  );
}
