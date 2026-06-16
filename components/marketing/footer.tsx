import Link from "next/link";
import type { PlatformWhiteLabelShellProps } from "@/src/lib/platform-theme/platform-white-label";

export function MarketingFooter({
  brandName = "SHASTORE AI",
  documentationUrl,
  supportUrl
}: PlatformWhiteLabelShellProps) {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-base font-black tracking-tight" style={{ color: "var(--platform-primary)" }}>
            {brandName}
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">
            Platform website powered by published SHASTORE theme runtime.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-5 text-sm font-semibold text-muted">
          <Link className="hover:text-ink" href="/pricing" style={{ color: "var(--platform-secondary)" }}>
            Pricing
          </Link>
          <Link className="hover:text-ink" href="/features">
            Features
          </Link>
          <Link className="hover:text-ink" href="/about">
            About
          </Link>
          <Link className="hover:text-ink" href="/contact">
            Contact
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
        </nav>
      </div>
    </footer>
  );
}
