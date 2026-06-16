import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import type { PlatformWhiteLabelShellProps } from "@/src/lib/platform-theme/platform-white-label";

export function MarketingNavbar({
  brandName = "SHASTORE AI",
  documentationUrl,
  logoUrl,
  poweredByLabel,
  showPoweredBy = false,
  supportUrl
}: {
  logoUrl?: string | null;
} & PlatformWhiteLabelShellProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link className="text-base font-black tracking-tight text-ink" href="/" style={{ color: "var(--platform-primary)" }}>
          {logoUrl ? (
            <object
              aria-label={brandName}
              className="h-9 max-w-40"
              data={logoUrl}
              type="image/png"
            >
              {brandName}
            </object>
          ) : (
            brandName
          )}
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          <Link className="hover:text-ink" href="/pricing">
            Pricing
          </Link>
          {supportUrl ? (
            <a className="hover:text-ink" href={supportUrl} rel="noreferrer" target="_blank">
              Support
            </a>
          ) : null}
          {documentationUrl ? (
            <a className="hover:text-ink" href={documentationUrl} rel="noreferrer" target="_blank">
              Docs
            </a>
          ) : null}
          <Link className="hover:text-ink" href="/login">
            Login
          </Link>
        </nav>
        <ButtonLink href="/register" variant="platform">Start free</ButtonLink>
      </div>
      {showPoweredBy && poweredByLabel ? (
        <div className="border-t border-line/70 bg-white/90 px-4 py-2 text-center text-xs font-semibold text-muted sm:px-6 lg:px-8">
          {poweredByLabel}
        </div>
      ) : null}
    </header>
  );
}
