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

function statusMessage(status: string | string[] | undefined, error: string | string[] | undefined) {
  const statusCode = Array.isArray(status) ? status[0] : status;
  const errorCode = Array.isArray(error) ? error[0] : error;

  if (statusCode === "check-email") {
    return "Check your email to activate this owner account before logging in.";
  }

  if (errorCode === "auth") {
    return "Owner registration could not be started.";
  }

  return errorCode === "rate-limit" ? "Too many registration attempts. Wait a few minutes and try again." : null;
}

export default async function RegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[]; next?: string | string[]; status?: string | string[] }>;
}) {
  const query = await searchParams;
  const nextPath = safeNextPath(query?.next);
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  const message = statusMessage(query?.status, query?.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="grid w-full max-w-md gap-4">
        {message ? (
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
            {message}
          </div>
        ) : null}
        <AuthForm
          action={register}
          buttonLabel="Create owner account"
          footerHref={loginHref}
          footerLabel="Log in"
          footerText="Already have an account?"
          nextPath={nextPath}
          subtitle="Create your owner workspace and launch your first store."
          title="Owner Registration"
        />
      </div>
    </main>
  );
}
