import { AuthForm } from "@/components/auth/auth-form";
import { customerLogin } from "@/lib/auth-actions";

function errorMessage(error: string | string[] | undefined) {
  const code = Array.isArray(error) ? error[0] : error;

  if (code === "role") {
    return "This account is not allowed here.";
  }

  if (code === "auth") {
    return "Customer email or password is incorrect.";
  }

  if (code === "profile") {
    return "Customer profile setup could not be completed. Contact support before trying again.";
  }

  return code === "rate-limit" ? "Too many customer login attempts. Wait a few minutes and try again." : null;
}

export default async function CustomerLoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const query = await searchParams;
  const message = errorMessage(query?.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="grid w-full max-w-md gap-4">
        {message ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            {message}
          </div>
        ) : null}
        <AuthForm
          action={customerLogin}
          buttonLabel="Log in"
          footerHref="/customer/register"
          footerLabel="Create customer account"
          footerText="New customer?"
          nextPath="/customer/dashboard"
          subtitle="Access is limited to confirmed customer accounts."
          title="Customer Login"
        />
      </div>
    </main>
  );
}
