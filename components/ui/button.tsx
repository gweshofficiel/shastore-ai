import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ghost" | "platform" | "primary" | "secondary";
};

const variants = {
  primary: "bg-ink text-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.9)] hover:bg-slate-800",
  platform: "text-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.35)] hover:opacity-90 [background-color:var(--platform-primary,#0f172a)]",
  secondary: "border border-slate-200 bg-white text-ink shadow-sm hover:border-slate-300 hover:bg-slate-50",
  ghost: "text-muted hover:bg-slate-100 hover:text-ink"
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full px-5 text-sm font-bold transition",
        "focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  className?: string;
  variant?: "ghost" | "platform" | "primary" | "secondary";
};

export function ButtonLink({
  className,
  variant = "primary",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full px-5 text-sm font-bold transition",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
