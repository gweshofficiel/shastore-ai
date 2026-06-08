import { AuthForm } from "@/components/auth/auth-form";
import { login } from "@/lib/auth-actions";

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

function deliveryErrorMessage(value: string | string[] | undefined) {
  const error = Array.isArray(value) ? value[0] : value;

  if (error === "delivery_required") {
    return "This area is reserved for delivery accounts. Use an approved delivery login to continue.";
  }

  if (error === "suspended_delivery") {
    return "This delivery account is suspended placeholder status. Contact support for review.";
  }

  return null;
}

export default async function DeliveryLoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  const query = await searchParams;
  const nextPath = safeNextPath(query?.next);
  const errorMessage = deliveryErrorMessage(query?.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_46%,#f1f5f9_100%)] px-4 py-12">
      <div className="grid w-full max-w-md gap-4">
        {errorMessage ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
            {errorMessage}
          </div>
        ) : null}
        <AuthForm
          action={login}
          buttonLabel="Log in"
          footerHref="/login"
          footerLabel="Use standard login"
          footerText="Not a delivery user?"
          nextPath={nextPath}
          subtitle="Delivery access is isolated from admin, store owner, reseller, and customer dashboards."
          title="Delivery login"
        />
      </div>
    </main>
  );
}
