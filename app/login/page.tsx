import { AuthForm } from "@/components/auth/auth-form";
import { login } from "@/lib/auth-actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <AuthForm
        action={login}
        buttonLabel="Log in"
        footerHref="/register"
        footerLabel="Create an account"
        footerText="New to SHASTORE AI?"
        subtitle="Welcome back. Continue building and publishing product landing pages."
        title="Log in"
      />
    </main>
  );
}
