import Link from "next/link";
import type { PublicStorefrontPageLink } from "@/lib/public-storefront-preview";
import type { PublicStoreNavigationLink } from "@/lib/storefront/navigation";

type PublicStoreFooterProps = {
  copyrightText?: string;
  footerBackgroundColor: string;
  footerTextColor: string;
  navigationLinks?: PublicStoreNavigationLink[];
  pages: PublicStorefrontPageLink[];
  storeSlug: string;
  storeTitle: string;
};

export function PublicStoreFooter({
  copyrightText,
  footerBackgroundColor,
  footerTextColor,
  navigationLinks = [],
  pages,
  storeSlug,
  storeTitle
}: PublicStoreFooterProps) {
  const pageFallbackLinks = pages.map((page) => ({
    href: `/store/${storeSlug}/pages/${page.slug}`,
    id: page.id,
    label: page.title
  }));
  const navigationHrefs = new Set(navigationLinks.map((link) => link.href));
  const links = [
    ...navigationLinks,
    ...pageFallbackLinks.filter((link) => !navigationHrefs.has(link.href))
  ];

  return (
    <footer
      className="px-4 py-8 sm:px-6 lg:px-8"
      style={{
        backgroundColor: footerBackgroundColor,
        color: footerTextColor
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-bold">
          {copyrightText || `© ${new Date().getFullYear()} ${storeTitle}`}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-[0.18em] opacity-75">
          {links.map((link) => (
            <Link
              className="transition hover:opacity-100"
              href={link.href}
              key={link.id}
            >
              {link.label}
            </Link>
          ))}
          <Link className="transition hover:opacity-100" href={`/store/${storeSlug}/privacy`}>
            Privacy
          </Link>
          <Link className="transition hover:opacity-100" href={`/store/${storeSlug}/terms`}>
            Terms
          </Link>
          <Link className="transition hover:opacity-100" href={`/store/${storeSlug}/refund`}>
            Refund
          </Link>
          <span>Powered by SHASTORE AI</span>
        </div>
      </div>
    </footer>
  );
}
