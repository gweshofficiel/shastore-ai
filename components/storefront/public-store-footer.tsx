import Link from "next/link";
import { StorefrontCurrencySwitcher } from "@/components/storefront/currency-switcher";
import { StorefrontLanguageSwitcher } from "@/components/storefront/language-switcher";
import type { PublicStorefrontPageLink } from "@/lib/public-storefront-preview";
import type { StoreCurrencySettings } from "@/lib/store-currencies";
import type { StoreLanguageSettings } from "@/lib/store-languages";
import type { PublicStoreNavigationLink } from "@/lib/storefront/navigation";
import {
  buildManagedFooterLinks,
  defaultStoreFooterLinkSettings,
  type StoreFooterLinkSettings
} from "@/lib/store-footer-links";

type PublicStoreFooterProps = {
  copyrightText?: string;
  footerBackgroundColor: string;
  footerLinkSettings?: StoreFooterLinkSettings;
  footerStyle?: string;
  footerTextColor: string;
  currencySettings?: StoreCurrencySettings;
  hasPublishedBlogArticles?: boolean;
  hasPublishedFaqs?: boolean;
  languageSettings?: StoreLanguageSettings;
  navigationLinks?: PublicStoreNavigationLink[];
  pages: PublicStorefrontPageLink[];
  socialLinks?: Record<string, string>;
  storeSlug: string;
  storeTitle: string;
};

export function PublicStoreFooter({
  copyrightText,
  footerBackgroundColor,
  footerLinkSettings = defaultStoreFooterLinkSettings,
  footerStyle = "minimal",
  footerTextColor,
  currencySettings,
  hasPublishedBlogArticles = false,
  hasPublishedFaqs = false,
  languageSettings,
  navigationLinks = [],
  pages,
  socialLinks = {},
  storeSlug,
  storeTitle
}: PublicStoreFooterProps) {
  const managedLinks = buildManagedFooterLinks({
    hasPublishedBlogArticles,
    hasPublishedFaqs,
    pages,
    settings: footerLinkSettings,
    storeSlug
  });
  const managedHrefs = new Set(managedLinks.map((link) => link.href.toLowerCase()));
  const managedLabels = new Set(managedLinks.map((link) => link.label.toLowerCase()));
  const skeletonLinks = [
    { href: `/store/${storeSlug}/about`, id: "about", label: "About" },
    { href: `/store/${storeSlug}/faq`, id: "faq-skeleton", label: "FAQ" },
    { href: `/store/${storeSlug}/blog`, id: "blog-skeleton", label: "Blog" }
  ];
  const links = [
    ...managedLinks,
    ...skeletonLinks,
    ...navigationLinks,
    ...pages.map((page) => ({
      href: `/store/${storeSlug}/pages/${page.slug}`,
      id: page.id,
      label: page.title
    }))
  ].filter((link, index, allLinks) => {
    const hrefKey = link.href.toLowerCase();
    const labelKey = link.label.toLowerCase();

    if (index < managedLinks.length) {
      return true;
    }

    if (managedHrefs.has(hrefKey) || managedLabels.has(labelKey)) {
      return false;
    }

    return allLinks.findIndex((item) => item.href.toLowerCase() === hrefKey || item.label.toLowerCase() === labelKey) === index;
  });
  const visibleSocialLinks = Object.entries(socialLinks).filter(([, href]) => href.trim());

  return (
    <footer
      className={`px-4 sm:px-6 lg:px-8 ${
        footerStyle === "bold"
          ? "py-12"
          : footerStyle === "glass"
            ? "py-10 backdrop-blur"
            : "py-8"
      }`}
      style={{
        backgroundColor:
          footerStyle === "glass" ? `${footerBackgroundColor}ee` : footerBackgroundColor,
        color: footerTextColor
      }}
    >
      <div
        className={`mx-auto grid max-w-7xl gap-6 ${
          footerStyle === "bold" ? "text-lg" : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-bold">
            {copyrightText || `© ${new Date().getFullYear()} ${storeTitle}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {languageSettings ? <StorefrontLanguageSwitcher settings={languageSettings} /> : null}
            {currencySettings ? <StorefrontCurrencySwitcher settings={currencySettings} /> : null}
          </div>
        </div>
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
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-black uppercase tracking-[0.18em] opacity-75">
          <div className="flex flex-wrap gap-2">
            {["COD", "Card", "Wallet", "WhatsApp"].map((label) => (
              <span className="rounded-full border border-current/20 px-3 py-1" key={label}>
                {label}
              </span>
            ))}
          </div>
          {visibleSocialLinks.length ? (
            <div className="flex flex-wrap gap-3">
              {visibleSocialLinks.map(([label, href]) => (
                <a className="transition hover:opacity-100" href={href} key={label} rel="noreferrer" target="_blank">
                  {label}
                </a>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {["Instagram", "Facebook", "TikTok"].map((label) => (
                <span className="transition hover:opacity-100" key={label}>
                  {label}
                </span>
              ))}
            </div>
          )}
          <span>Powered by SHASTORE AI</span>
        </div>
      </div>
    </footer>
  );
}
