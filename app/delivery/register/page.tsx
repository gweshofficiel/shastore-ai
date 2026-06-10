import { AuthForm } from "@/components/auth/auth-form";
import { deliveryRegister } from "@/lib/auth-actions";

function statusMessage(error: string | string[] | undefined) {
  const code = Array.isArray(error) ? error[0] : error;

  if (code === "check-email") {
    return "Check your email to activate this delivery account before logging in.";
  }

  if (code === "auth") {
    return "Delivery registration could not be started.";
  }

  return code === "rate-limit" ? "Too many delivery registration attempts. Wait a few minutes and try again." : null;
}

export default async function DeliveryRegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const query = await searchParams;
  const message = statusMessage(query?.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-emerald-50 px-4 py-12">
      <div className="grid w-full max-w-md gap-4">
        {message ? (
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
            {message}
          </div>
        ) : null}
        <AuthForm
          action={deliveryRegister}
          buttonLabel="Create delivery account"
          footerHref="/delivery/login"
          footerLabel="Log in"
          footerText="Already activated?"
          nextPath="/delivery/dashboard"
          subtitle="Create a delivery agent login. Store assignment may still be required by the owner."
          title="Delivery Registration"
        />
      </div>
    </main>
  );
}
