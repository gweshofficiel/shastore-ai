import { AuthForm } from "@/components/auth/auth-form";
import { deliveryRegister } from "@/lib/auth-actions";

function registrationFeedback(
  status: string | string[] | undefined,
  error: string | string[] | undefined,
  message: string | string[] | undefined
) {
  const statusCode = Array.isArray(status) ? status[0] : status;
  const errorCode = Array.isArray(error) ? error[0] : error;
  const detail = Array.isArray(message) ? message[0] : message;

  if (statusCode === "check-email" || errorCode === "check-email") {
    return {
      text: "Check your email to activate this delivery account before logging in.",
      tone: "success" as const
    };
  }

  if (errorCode === "auth") {
    return {
      text: detail?.trim() || "Delivery registration could not be started.",
      tone: "error" as const
    };
  }

  if (errorCode === "rate-limit") {
    return {
      text: "Too many delivery registration attempts. Wait a few minutes and try again.",
      tone: "error" as const
    };
  }

  return null;
}

export default async function DeliveryRegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[]; message?: string | string[]; status?: string | string[] }>;
}) {
  const query = await searchParams;
  const feedback = registrationFeedback(query?.status, query?.error, query?.message);

  return (
    <main className="flex min-h-screen items-center justify-center bg-emerald-50 px-4 py-12">
      <div className="grid w-full max-w-md gap-4">
        {feedback ? (
          <div
            className={
              feedback.tone === "success"
                ? "rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900"
                : "rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900"
            }
          >
            {feedback.text}
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
