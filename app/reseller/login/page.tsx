import { AuthForm } from "@/components/auth/auth-form";
import { resellerLogin } from "@/lib/auth-actions";

function safeNextPath(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;
  return next?.startsWith("/reseller") && !next.startsWith("/reseller/login") ? next : "/reseller/dashboard";
}

function errorMessage(error: string | string[] | undefined) {
  const code = Array.isArray(error) ? error[0] : error;

  if (code === "role") {
    return "This account is not allowed here.";
  }

  if (code === "auth") {
    return "Reseller email or password is incorrect.";
  }

  return code === "rate-limit" ? "Too many reseller login attempts. Wait a few minutes and try again." : null;
}

export default async function ResellerLoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  const query = await searchParams;
  const nextPath = safeNextPath(query?.next);
  const message = errorMessage(query?.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-fuchsia-50 px-4 py-12">
      <div className="grid w-full max-w-md gap-4">
        {message ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            {message}
          </div>
        ) : null}
        <AuthForm
          action={resellerLogin}
          buttonLabel="Log in"
          footerHref="/reseller/register"
          footerLabel="Create reseller account"
          footerText="New reseller?"
          nextPath={nextPath}
          subtitle="Access is limited to confirmed reseller accounts."
          title="Reseller Login"
        />
      </div>
    </main>
  );
}
