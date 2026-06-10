import { AuthForm } from "@/components/auth/auth-form";
import { AdminLoginSessionReset } from "@/components/admin/admin-login-session-reset";
import { adminLogin } from "@/lib/auth-actions";

function errorMessage(error: string | string[] | undefined) {
  const code = Array.isArray(error) ? error[0] : error;

  if (code === "restricted") {
    return "Super Admin access is restricted.";
  }

  if (code === "role") {
    return "This account is not allowed in Super Admin.";
  }

  if (code === "auth") {
    return "Admin email or password is incorrect.";
  }

  if (code === "rate-limit") {
    return "Too many admin login attempts. Wait a few minutes and try again.";
  }

  return null;
}

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const query = await searchParams;
  const message = errorMessage(query?.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <AdminLoginSessionReset />
      <div className="grid w-full max-w-md gap-4">
        {message ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            {message}
          </div>
        ) : null}
        <AuthForm
          action={adminLogin}
          buttonLabel="Log in"
          footerHref="/login"
          footerLabel="Use owner login"
          footerText="Not a Super Admin?"
          nextPath="/admin"
          subtitle="Super Admin access is limited to official configured admin emails."
          title="Super Admin Login"
        />
      </div>
    </main>
  );
}
