import Link from "next/link";
import { customerRegister } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
      text: "Check your email to activate this customer account before logging in.",
      tone: "success" as const
    };
  }

  if (errorCode === "auth") {
    return {
      text: detail?.trim() || "Customer registration could not be started.",
      tone: "error" as const
    };
  }

  if (errorCode === "rate-limit") {
    return {
      text: "Too many customer registration attempts. Wait a few minutes and try again.",
      tone: "error" as const
    };
  }

  return null;
}

export default async function CustomerRegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[]; message?: string | string[]; status?: string | string[] }>;
}) {
  const query = await searchParams;
  const feedback = registrationFeedback(query?.status, query?.error, query?.message);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
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
        <Card className="w-full max-w-md p-8">
          <div>
            <Link className="text-base font-black tracking-tight text-ink" href="/">
              SHASTORE AI
            </Link>
            <h1 className="mt-8 text-3xl font-black tracking-tight text-ink">
              Customer Registration
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Create a secure customer login with email, password, and your checkout phone or WhatsApp number.
            </p>
          </div>
          <form action={customerRegister} className="mt-8 grid gap-4">
            <input name="next" type="hidden" value="/customer/dashboard" />
            <Input id="email" label="Email" name="email" required type="email" />
            <Input id="phone" label="Phone / WhatsApp" name="phone" placeholder="+15551234567" required />
            <Input id="password" label="Password" minLength={8} name="password" required type="password" />
            <Button className="mt-2 w-full" type="submit">
              Create customer account
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            Already activated?{" "}
            <Link className="font-semibold text-ink hover:underline" href="/customer/login">
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
