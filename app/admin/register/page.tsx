import { AuthForm } from "@/components/auth/auth-form";
import { adminRegister } from "@/lib/auth-actions";

function statusMessage({
  error,
  status
}: {
  error?: string | string[];
  status?: string | string[];
}) {
  const errorCode = Array.isArray(error) ? error[0] : error;
  const statusCode = Array.isArray(status) ? status[0] : status;

  if (statusCode === "check-email" || errorCode === "check-email") {
    return "Check your email to confirm this Super Admin account before logging in.";
  }

  if (errorCode === "role") {
    return "This account is not allowed here.";
  }

  if (errorCode === "auth") {
    return "Super Admin registration could not be started.";
  }

  return null;
}

export default async function AdminRegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[]; status?: string | string[] }>;
}) {
  const query = await searchParams;
  const message = statusMessage({ error: query?.error, status: query?.status });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="grid w-full max-w-md gap-4">
        {message ? (
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
            {message}
          </div>
        ) : null}
        <AuthForm
          action={adminRegister}
          buttonLabel="Register admin"
          footerHref="/admin/login"
          footerLabel="Log in"
          footerText="Already confirmed?"
          nextPath="/admin"
          subtitle="Only configured official admin emails can create Super Admin access."
          title="Register Super Admin"
        />
      </div>
    </main>
  );
}
