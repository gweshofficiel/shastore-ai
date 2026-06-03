import Link from "next/link";
import type { ReactNode } from "react";
import {
  Camera,
  CreditCard,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PlayCircle,
  Share2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  storeBusinessAddress?: string | null;
  storeDescription?: string | null;
  storeEmail?: string | null;
  storeSlug: string;
  storeSupportEmail?: string | null;
  storeSupportPhone?: string | null;
  storeTitle: string;
  storeWhatsappNumber?: string | null;
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

function FooterIconLabel({
  children,
  icon: Icon
}: {
  children: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <span className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <span>{children}</span>
    </span>
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
  storeBusinessAddress,
  storeDescription,
  storeEmail,
  storeSlug,
  storeSupportEmail,
  storeSupportPhone,
  storeTitle,
  storeWhatsappNumber
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
    const brandInitial = storeTitle.trim().slice(0, 1) || "S";
    const contactEmail = storeSupportEmail || storeEmail || "example@yourstore.com";
    const contactPhone = storeSupportPhone || "+212 123 456 789";
    const whatsappNumber = storeWhatsappNumber || "+212 123 456 789";
    const contactAddress = storeBusinessAddress || "Casablanca, Morocco";
    const brandDescription =
      storeDescription ||
      "A premium ecommerce storefront powered by SHASTORE AI, built for elegant product discovery and trusted shopping.";
    const shopLinks = [
      { href: `/store/${storeSlug}#products`, label: "All Products" },
      { href: `/store/${storeSlug}#products`, label: "Featured" },
      { href: `/store/${storeSlug}#products`, label: "New Arrivals" },
      { href: `/store/${storeSlug}#top-selling`, label: "Best Sellers" },
      { href: `/store/${storeSlug}#deals`, label: "Deals" },
      { href: `/store/${storeSlug}/cart`, label: "Cart" }
    ];
    const serviceLinks = [
      { href: `/store/${storeSlug}/faq`, label: "Help Center" },
      { href: `/store/${storeSlug}/track`, label: "Track Order" },
      { href: `/store/${storeSlug}/shipping`, label: "Shipping Policy" },
      { href: `/store/${storeSlug}/refund`, label: "Returns & Refunds" },
      { href: `/store/${storeSlug}/account/orders`, label: "Orders" },
      { href: `/store/${storeSlug}/account/support`, label: "Support Center" }
    ];
    const companyLinks = links.length
      ? links.slice(0, 8).map((link) => ({ href: link.href, label: link.label }))
      : [
          { href: `/store/${storeSlug}/about`, label: "About Us" },
          { href: `/store/${storeSlug}/blog`, label: "Blog" },
          { href: `/store/${storeSlug}/contact`, label: "Contact" },
          { href: `/store/${storeSlug}/privacy`, label: "Privacy Policy" },
          { href: `/store/${storeSlug}/terms`, label: "Terms of Service" },
          { href: `/store/${storeSlug}/refund`, label: "Refund Policy" }
        ];
    const socialItems = [
      { href: socialLinks.instagram || "#", icon: Camera, label: "Instagram" },
      { href: socialLinks.facebook || "#", icon: MessageCircle, label: "Facebook" },
      { href: socialLinks.tiktok || "#", icon: PlayCircle, label: "TikTok" },
      { href: socialLinks.youtube || "#", icon: Share2, label: "YouTube" }
    ];
    const paymentLabels = [
      "Visa",
      "Mastercard",
      "PayPal",
      "Stripe",
      "Apple Pay",
      "Google Pay",
      "Crypto",
      "COD"
    ];

    return (
      <>
        <section className="border-y border-slate-200 bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Mail className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                  Subscribe to our newsletter
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  Get the latest updates on new products and upcoming sales
                </p>
              </div>
            </div>
            <form className="flex overflow-hidden rounded-full border-2 border-slate-200 bg-white text-slate-950 shadow-inner">
              <input
                className="min-h-12 flex-1 px-5 text-sm font-semibold outline-none"
                placeholder="Enter your email address"
                type="email"
              />
              <button className="bg-slate-950 px-7 text-sm font-black text-white transition hover:bg-slate-800" type="button">
                Subscribe
              </button>
            </form>
          </div>
        </section>

        <footer className="min-h-[560px] bg-[#070d1a] text-white">
          <div className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="xl:col-span-1">
                <div className="flex items-center gap-3">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-black text-slate-950">
                    {brandInitial}
                  </span>
                  <div>
                    <h2 className="text-lg font-black leading-tight tracking-[-0.03em] text-white">
                      {storeTitle}
                    </h2>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                      Premium storefront
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-sm font-semibold leading-7 text-white/65">
                  {brandDescription}
                </p>
                <div className="mt-6 flex gap-3">
                  {socialItems.map(({ href, icon: Icon, label }) => (
                    href === "#" ? (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/75" key={label} title={label}>
                        <Icon className="h-4 w-4" />
                      </span>
                    ) : (
                      <a className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/75 transition hover:border-white hover:text-white" href={href} key={label} rel="noreferrer" target="_blank" title={label}>
                        <Icon className="h-4 w-4" />
                      </a>
                    )
                  ))}
                </div>
              </div>
              <FooterColumn links={shopLinks} title="Shop" />
              <FooterColumn links={serviceLinks} title="Customer Service" />
              <FooterColumn links={companyLinks} title="Company" />
              <div>
                <h3 className="text-base font-black text-white">Contact Us</h3>
                <div className="mt-5 grid gap-3 text-sm font-semibold leading-6 text-white/65">
                  <FooterIconLabel icon={Mail}>Email: {contactEmail}</FooterIconLabel>
                  <FooterIconLabel icon={Phone}>Phone: {contactPhone}</FooterIconLabel>
                  <FooterIconLabel icon={MessageCircle}>WhatsApp: {whatsappNumber}</FooterIconLabel>
                  <FooterIconLabel icon={MapPin}>Address: {contactAddress}</FooterIconLabel>
                </div>
              </div>
              <div>
                <h3 className="text-base font-black text-white">We Accept</h3>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {paymentLabels.map((label) => (
                    <span className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-black text-white/80" key={label}>
                      <span className="inline-flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5 text-amber-300" />
                        {label}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-sm font-semibold text-white/55">
              <p>{copyrightText || `© ${new Date().getFullYear()} ${storeTitle}`}</p>
              <div className="flex flex-wrap items-center gap-2">
                {languageSettings ? <StorefrontLanguageSwitcher settings={languageSettings} /> : null}
                {currencySettings ? <StorefrontCurrencySwitcher settings={currencySettings} /> : null}
              </div>
              <div className="flex flex-wrap gap-4">
                <Link className="transition hover:text-white" href={`/store/${storeSlug}/privacy`}>
                  Privacy Policy
                </Link>
                <Link className="transition hover:text-white" href={`/store/${storeSlug}/terms`}>
                  Terms of Service
                </Link>
                <Link className="transition hover:text-white" href={`/store/${storeSlug}/refund`}>
                  Refund Policy
                </Link>
                <Link className="transition hover:text-white" href="/sitemap.xml">
                  Sitemap
                </Link>
              </div>
              <p>Powered by SHASTORE AI</p>
            </div>
          </div>
        </footer>
      </>
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
