import { AuthForm } from "@/components/auth/auth-form";
import { customerRegister } from "@/lib/auth-actions";

function statusMessage(error: string | string[] | undefined) {
  const code = Array.isArray(error) ? error[0] : error;

  if (code === "check-email") {
    return "Check your email to activate this customer account before logging in.";
  }

  if (code === "auth") {
    return "Customer registration could not be started.";
  }

  return code === "rate-limit" ? "Too many customer registration attempts. Wait a few minutes and try again." : null;
}

export default async function CustomerRegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const query = await searchParams;
  const message = statusMessage(query?.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="grid w-full max-w-md gap-4">
        {message ? (
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
            {message}
          </div>
        ) : null}
        <AuthForm
          action={customerRegister}
          buttonLabel="Create customer account"
          footerHref="/customer/login"
          footerLabel="Log in"
          footerText="Already activated?"
          nextPath="/customer"
          subtitle="Create a customer login. Phone lookup remains available for existing store portals."
          title="Customer Registration"
        />
      </div>
    </main>
  );
}
