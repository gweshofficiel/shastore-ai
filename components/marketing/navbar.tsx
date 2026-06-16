import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export function MarketingNavbar({ logoUrl }: { logoUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link className="text-base font-black tracking-tight text-ink" href="/" style={{ color: "var(--platform-primary)" }}>
          {logoUrl ? (
            <object
              aria-label="SHASTORE AI"
              className="h-9 max-w-40"
              data={logoUrl}
              type="image/png"
            >
              SHASTORE AI
            </object>
          ) : (
            "SHASTORE AI"
          )}
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          <Link className="hover:text-ink" href="/pricing">
            Pricing
          </Link>
          <Link className="hover:text-ink" href="/login">
            Login
          </Link>
        </nav>
        <ButtonLink href="/register">Start free</ButtonLink>
      </div>
    </header>
  );
}
