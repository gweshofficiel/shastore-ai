import { AuthForm } from "@/components/auth/auth-form";
import { resellerRegister } from "@/lib/auth-actions";

function statusMessage(error: string | string[] | undefined) {
  const code = Array.isArray(error) ? error[0] : error;

  if (code === "check-email") {
    return "Check your email to activate this reseller account before logging in.";
  }

  if (code === "auth") {
    return "Reseller registration could not be started.";
  }

  return code === "rate-limit" ? "Too many reseller registration attempts. Wait a few minutes and try again." : null;
}

export default async function ResellerRegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const query = await searchParams;
  const message = statusMessage(query?.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-fuchsia-50 px-4 py-12">
      <div className="grid w-full max-w-md gap-4">
        {message ? (
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
            {message}
          </div>
        ) : null}
        <AuthForm
          action={resellerRegister}
          buttonLabel="Create reseller account"
          footerHref="/reseller/login"
          footerLabel="Log in"
          footerText="Already activated?"
          nextPath="/reseller/dashboard"
          subtitle="Create a reseller account. Email confirmation is required before dashboard access."
          title="Reseller Registration"
        />
      </div>
    </main>
  );
}
