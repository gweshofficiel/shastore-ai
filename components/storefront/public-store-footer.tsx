import Link from "next/link";
import type { ReactNode } from "react";
import {
  Camera,
  CreditCard,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PlayCircle,
  RotateCcw,
  Share2,
  ShieldCheck,
  Truck
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
  storeBusinessHours?: string | null;
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
  storeBusinessHours,
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
    const contactEmail = storeSupportEmail || storeEmail || "example@yourstore.com";
    const contactPhone = storeSupportPhone || "+212 123 456 789";
    const whatsappNumber = storeWhatsappNumber || "+212 123 456 789";
    const contactAddress = storeBusinessAddress || "Casablanca, Morocco";
    const contactHours = storeBusinessHours || "Mon - Sat, 9:00 - 18:00";
    const brandDescription =
      storeDescription ||
      "A premium ecommerce storefront powered by SHASTORE AI, built for elegant product discovery and trusted shopping.";
    const shopLinks = [
      { href: `/store/${storeSlug}#products`, label: "All Products" },
      { href: `/store/${storeSlug}#products`, label: "New Arrivals" },
      { href: `/store/${storeSlug}#top-selling`, label: "Best Sellers" },
      { href: `/store/${storeSlug}#deals`, label: "Deals" },
      { href: `/store/${storeSlug}#categories`, label: "Collections" },
      { href: `/store/${storeSlug}#products`, label: "Gift Cards" }
    ];
    const serviceLinks = [
      { href: `/store/${storeSlug}/contact`, label: "Contact Us" },
      { href: `/store/${storeSlug}/track`, label: "Track Order" },
      { href: `/store/${storeSlug}/shipping`, label: "Shipping Policy" },
      { href: `/store/${storeSlug}/refund`, label: "Returns & Refunds" },
      { href: `/store/${storeSlug}/faq`, label: "FAQ" },
      { href: `/store/${storeSlug}/account/support`, label: "Support Center" }
    ];
    const companyLinks = [
      { href: `/store/${storeSlug}/about`, label: "About Us" },
      { href: `/store/${storeSlug}/blog`, label: "Blog" },
      { href: `/store/${storeSlug}/contact`, label: "Careers" },
      { href: `/store/${storeSlug}/contact`, label: "Affiliate Program" },
      { href: `/store/${storeSlug}/privacy`, label: "Privacy Policy" },
      { href: `/store/${storeSlug}/terms`, label: "Terms of Service" }
    ];
    const trustItems = [
      { body: "Protected payment experience", icon: ShieldCheck, title: "Secure Checkout" },
      { body: "Delivery options ready", icon: Truck, title: "Fast Delivery" },
      { body: "Refund policy support", icon: RotateCcw, title: "Money Back Guarantee" },
      { body: "Premium customer care", icon: Headphones, title: "24/7 Support" }
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
      "COD",
      "Wallet"
    ];

    return (
      <footer className="bg-slate-950 text-white">
        <div className="border-y border-white/10 bg-slate-900/80 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map(({ body, icon: Icon, title }) => (
              <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4" key={title}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-slate-950">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-black text-white">{title}</span>
                  <span className="mt-1 block text-xs font-semibold text-white/55">{body}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center lg:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Newsletter</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">
                Join the SHASTORE premium community
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/60">
                Get updates about new products, offers, and store news.
              </p>
            </div>
            <div>
              <form className="flex overflow-hidden rounded-full border border-white/10 bg-white text-slate-950">
                <input
                  className="min-h-12 flex-1 px-5 text-sm font-semibold outline-none"
                  placeholder="Enter your email"
                  type="email"
                />
                <button className="bg-amber-300 px-6 text-xs font-black uppercase tracking-[0.14em] text-slate-950" type="button">
                  Subscribe
                </button>
              </form>
              <p className="mt-3 text-xs font-semibold text-white/45">
                We respect your privacy. Unsubscribe anytime.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 border-t border-white/10 pt-12">
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-[1.25fr_0.75fr_0.9fr_0.9fr_1.1fr_1.2fr]">
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300 text-xl font-black text-slate-950">
                    S
                  </span>
                  <div>
                    <h2 className="text-xl font-black tracking-[-0.04em] text-white">
                      SHASTORE Flagship Premium
                    </h2>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
                      {storeTitle}
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-sm font-semibold leading-7 text-white/60">
                  {brandDescription}
                </p>
                <div className="mt-5 flex gap-2">
                  {socialItems.map(({ href, icon: Icon, label }) => (
                    href === "#" ? (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70" key={label} title={label}>
                        <Icon className="h-4 w-4" />
                      </span>
                    ) : (
                      <a className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-amber-300 hover:text-amber-300" href={href} key={label} rel="noreferrer" target="_blank" title={label}>
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
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Contact</h3>
                <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-white/60">
                  <FooterIconLabel icon={Mail}>Email: {contactEmail}</FooterIconLabel>
                  <FooterIconLabel icon={Phone}>Phone: {contactPhone}</FooterIconLabel>
                  <FooterIconLabel icon={MessageCircle}>WhatsApp: {whatsappNumber}</FooterIconLabel>
                  <FooterIconLabel icon={MapPin}>Address: {contactAddress}</FooterIconLabel>
                  <FooterIconLabel icon={Headphones}>Hours: {contactHours}</FooterIconLabel>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Payments</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {paymentLabels.map((label) => (
                    <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/70" key={label}>
                      <span className="inline-flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-amber-300" />
                        {label}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs font-black uppercase tracking-[0.16em] text-white/50">
              <p>{copyrightText || `© ${new Date().getFullYear()} ${storeTitle}`}</p>
              <div className="flex flex-wrap items-center gap-2">
                {languageSettings ? <StorefrontLanguageSwitcher settings={languageSettings} /> : <span>Language</span>}
                {currencySettings ? <StorefrontCurrencySwitcher settings={currencySettings} /> : <span>Currency</span>}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link className="transition hover:text-white" href="/sitemap.xml">
                  Sitemap
                </Link>
                <Link className="transition hover:text-white" href={`/store/${storeSlug}/privacy`}>
                  Privacy Policy
                </Link>
                <Link className="transition hover:text-white" href={`/store/${storeSlug}/terms`}>
                  Terms of Service
                </Link>
              </div>
              <p>Powered by SHASTORE AI</p>
            </div>
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
