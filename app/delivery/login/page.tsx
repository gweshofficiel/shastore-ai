import { AuthForm } from "@/components/auth/auth-form";
import { deliveryLogin } from "@/lib/delivery/auth-actions";

function safeNextPath(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/delivery/dashboard";
  }

  if (!next.startsWith("/delivery") || next.startsWith("/delivery/login")) {
    return "/delivery/dashboard";
  }

  return next;
}

function deliveryErrorMessage({
  email,
  error
}: {
  email?: string | string[];
  error?: string | string[];
}) {
  const code = Array.isArray(error) ? error[0] : error;
  const agentEmail = Array.isArray(email) ? email[0] : email;

  if (code === "delivery_required") {
    return "This area is reserved for approved delivery agents. Ask your store owner to create your delivery agent profile first.";
  }

  if (code === "suspended_delivery") {
    return "This delivery agent profile is inactive. Contact the store owner to reactivate your access.";
  }

  if (code === "auth_setup_required") {
    return agentEmail
      ? `Delivery account exists for ${agentEmail}, but a user login account is not created yet. Ask the store owner to invite you or complete delivery account setup.`
      : "Delivery account exists, but a user login account is not created yet. Ask the store owner to invite you or complete delivery account setup.";
  }

  if (code === "auth_failed") {
    return "Delivery agent found, but the email or password is incorrect.";
  }

  if (code === "rate-limit") {
    return "Too many delivery login attempts. Wait a few minutes and try again.";
  }

  return null;
}

export default async function DeliveryLoginPage({
  searchParams
}: {
  searchParams?: Promise<{ email?: string | string[]; error?: string | string[]; next?: string | string[] }>;
}) {
  const query = await searchParams;
  const nextPath = safeNextPath(query?.next);
  const errorMessage = deliveryErrorMessage({ email: query?.email, error: query?.error });
  const setupRequired = (Array.isArray(query?.error) ? query?.error[0] : query?.error) === "auth_setup_required";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_46%,#f1f5f9_100%)] px-4 py-12">
      <div className="grid w-full max-w-md gap-4">
        {errorMessage ? (
          <div
            className={`rounded-3xl border p-4 text-sm font-bold leading-6 ${
              setupRequired
                ? "border-blue-200 bg-blue-50 text-blue-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {errorMessage}
          </div>
        ) : null}
        {setupRequired ? (
          <div className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-950">
            Invitation and setup flow placeholder: once your login account is created with this same
            email, return here to access the delivery dashboard.
          </div>
        ) : null}
        <AuthForm
          action={deliveryLogin}
          buttonLabel="Log in"
          footerHref="/login"
          footerLabel="Use standard login"
          footerText="Not a delivery user?"
          nextPath={nextPath}
          subtitle="Use the same email your store owner saved when creating your delivery agent profile."
          title="Delivery login"
        />
      </div>
    </main>
  );
}
