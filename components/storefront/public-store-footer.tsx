import Link from "next/link";
import type { PublicStorefrontPageLink } from "@/lib/public-storefront-preview";

type PublicStoreFooterProps = {
  copyrightText?: string;
  footerBackgroundColor: string;
  footerTextColor: string;
  pages: PublicStorefrontPageLink[];
  storeSlug: string;
  storeTitle: string;
};

export function PublicStoreFooter({
  copyrightText,
  footerBackgroundColor,
  footerTextColor,
  pages,
  storeSlug,
  storeTitle
}: PublicStoreFooterProps) {
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
          {pages.map((page) => (
            <Link
              className="transition hover:opacity-100"
              href={`/store/${storeSlug}/pages/${page.slug}`}
              key={page.id}
            >
              {page.title}
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
