import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuthFormProps = {
  title: string;
  subtitle: string;
  buttonLabel: string;
  footerText: string;
  footerHref: string;
  footerLabel: string;
  nextPath?: string;
  action: (formData: FormData) => Promise<void>;
};

export function AuthForm({
  title,
  subtitle,
  buttonLabel,
  footerText,
  footerHref,
  footerLabel,
  nextPath,
  action
}: AuthFormProps) {
  return (
    <Card className="w-full max-w-md p-8">
      <div>
        <Link className="text-base font-black tracking-tight text-ink" href="/">
          SHASTORE AI
        </Link>
        <h1 className="mt-8 text-3xl font-black tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>
      </div>
      <form action={action} className="mt-8 grid gap-4">
        {nextPath ? <input name="next" type="hidden" value={nextPath} /> : null}
        <Input id="email" label="Email" name="email" required type="email" />
        <Input
          id="password"
          label="Password"
          minLength={8}
          name="password"
          required
          type="password"
        />
        <Button className="mt-2 w-full" type="submit">
          {buttonLabel}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {footerText}{" "}
        <Link className="font-semibold text-ink hover:underline" href={footerHref}>
          {footerLabel}
        </Link>
      </p>
    </Card>
  );
}
