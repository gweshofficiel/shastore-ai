import { AuthForm } from "@/components/auth/auth-form";
import { register } from "@/lib/auth-actions";

function safeNextPath(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return undefined;
  }

  if (next.startsWith("/login") || next.startsWith("/register")) {
    return undefined;
  }

  return next;
}

function registrationFeedback(
  status: string | string[] | undefined,
  error: string | string[] | undefined,
  message: string | string[] | undefined
) {
  const statusCode = Array.isArray(status) ? status[0] : status;
  const errorCode = Array.isArray(error) ? error[0] : error;
  const detail = Array.isArray(message) ? message[0] : message;

  if (statusCode === "check-email") {
    return {
      text: "Check your email to activate this owner account before logging in.",
      tone: "success" as const
    };
  }

  if (errorCode === "auth") {
    return {
      text: detail?.trim() || "Owner registration could not be started.",
      tone: "error" as const
    };
  }

  if (errorCode === "rate-limit") {
    return {
      text: "Too many registration attempts. Wait a few minutes and try again.",
      tone: "error" as const
    };
  }

  return null;
}

export default async function RegisterPage({
  searchParams
}: {
  searchParams?: Promise<{
    error?: string | string[];
    message?: string | string[];
    next?: string | string[];
    status?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const nextPath = safeNextPath(query?.next);
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  const feedback = registrationFeedback(query?.status, query?.error, query?.message);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
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
          action={register}
          buttonLabel="Create owner account"
          footerHref={loginHref}
          footerLabel="Log in"
          footerText="Already have an account?"
          nextPath={nextPath}
          subtitle="Create your owner workspace and launch your first store."
          title="Owner Registration"
        />
      </div>
    </main>
  );
}
