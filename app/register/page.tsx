import { AuthForm } from "@/components/auth/auth-form";
import { register } from "@/lib/auth-actions";

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

export default async function RegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const nextPath = safeNextPath((await searchParams)?.next);
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <AuthForm
        action={register}
        buttonLabel="Create account"
        footerHref={loginHref}
        footerLabel="Log in"
        footerText="Already have an account?"
        nextPath={nextPath}
        subtitle="Create your workspace and launch your first product landing page."
        title="Start selling faster"
      />
    </main>
  );
}
