import { AuthForm } from "@/components/auth/auth-form";
import { register } from "@/lib/auth-actions";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <AuthForm
        action={register}
        buttonLabel="Create account"
        footerHref="/login"
        footerLabel="Log in"
        footerText="Already have an account?"
        subtitle="Create your workspace and launch your first product landing page."
        title="Start selling faster"
      />
    </main>
  );
}
