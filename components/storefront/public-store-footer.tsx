import Link from "next/link";
import { Camera, CreditCard, Mail, MapPin, MessageCircle, Phone, Share2 } from "lucide-react";
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
  premiumSkeleton?: boolean;
  socialLinks?: Record<string, string>;
  storeSlug: string;
  storeTitle: string;
};

function FooterColumn({
  links,
  title
}: {
  links: Array<{ href: string; label: string }>;
  title: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">{title}</h3>
      <div className="mt-4 grid gap-2">
        {links.map((link) => (
          <Link className="text-sm font-semibold text-white/60 transition hover:text-white" href={link.href} key={link.label}>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

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
  premiumSkeleton = false,
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

  if (premiumSkeleton) {
    const shopLinks = [
      { href: `/store/${storeSlug}#categories`, label: "Shop by Categories" },
      { href: `/store/${storeSlug}#products`, label: "Featured Products" },
      { href: `/store/${storeSlug}#deals`, label: "Flash Deals" },
      { href: `/store/${storeSlug}#top-selling`, label: "Top Selling" }
    ];
    const serviceLinks = [
      { href: `/store/${storeSlug}/track`, label: "Track Order" },
      { href: `/store/${storeSlug}/faq`, label: "Help Center" },
      { href: `/store/${storeSlug}/account/support`, label: "Support Tickets" },
      { href: `/store/${storeSlug}/refund`, label: "Returns" }
    ];
    const companyLinks = [
      { href: `/store/${storeSlug}/about`, label: "About Us" },
      { href: `/store/${storeSlug}/blog`, label: "Blog" },
      { href: `/store/${storeSlug}/contact`, label: "Contact Us" },
      { href: `/store/${storeSlug}/privacy`, label: "Privacy Policy" },
      { href: `/store/${storeSlug}/terms`, label: "Terms" }
    ];

    return (
      <footer className="bg-slate-950 px-4 py-14 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.05em]">{storeTitle}</h2>
              <p className="mt-4 text-sm font-semibold leading-7 text-white/60">
                Store brand summary placeholder for the SHASTORE Flagship Premium ecommerce experience.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Visa", "Mastercard", "COD", "Wallet"].map((label) => (
                  <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white/70" key={label}>
                    <span className="inline-flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> {label}</span>
                  </span>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                {[
                  { icon: Camera, label: "Instagram" },
                  { icon: MessageCircle, label: "Community" },
                  { icon: Share2, label: "Social" }
                ].map(({ icon: Icon, label }) => (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70" key={label}>
                    <Icon className="h-4 w-4" />
                  </span>
                ))}
              </div>
            </div>
            <FooterColumn links={shopLinks} title="Shop" />
            <FooterColumn links={serviceLinks} title="Customer Service" />
            <FooterColumn links={companyLinks} title="Company" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Contact Us</h3>
              <div className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-white/60">
                <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> example@yourstore.com</p>
                <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> +212 123 456 789</p>
                <p className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp: +212 123 456 789</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Casablanca, Morocco</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs font-black uppercase tracking-[0.18em] text-white/50">
            <p>{copyrightText || `© ${new Date().getFullYear()} ${storeTitle}`}</p>
            <div className="flex flex-wrap items-center gap-2">
              {languageSettings ? <StorefrontLanguageSwitcher settings={languageSettings} /> : null}
              {currencySettings ? <StorefrontCurrencySwitcher settings={currencySettings} /> : null}
            </div>
            <p>Powered by SHASTORE AI</p>
          </div>
        </div>
      </footer>
    );
  }

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
